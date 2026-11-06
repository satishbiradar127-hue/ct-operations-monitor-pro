console.log("CT Operations Monitor (EAST-3) — Production live feed controller v11.3.3");

(function () {
    "use strict";

    const TARGET_HOST = "east-3.calltools.io";
    const EDITION = "EAST-3";
    if (window.location.hostname && window.location.hostname !== TARGET_HOST) {
        console.log("CT Operations Monitor (" + EDITION + ") — wrong host " + window.location.hostname + "; expected " + TARGET_HOST);
        return;
    }

    const POLL_MS = 1000;
    const NATIVE_REFRESH_MS = 5000;
    const REFRESH_VERIFY_TIMEOUT_MS = 7000;
    const REFRESH_VERIFY_STEP_MS = 350;
    const INBOUND_DATA_KEY = "ct_east3_last_known_queues_v1";
    const INBOUND_STATUS_KEY = "ct_east3_inbound_feed_status_v1";
    const INBOUND_STORAGE_DATA_KEY = "ct_east3_inbound_data_v2";
    const INBOUND_STORAGE_STATUS_KEY = "ct_east3_inbound_status_v2";
    const VERIFIED_FILTERS_KEY = "ct_east3_verified_campaign_filters_v1";
    const LIVE_FILTERS_INVENTORY_KEY = "ct_east3_live_filters_inventory_v1";
    const INBOUND_COORDINATION_MS = 5000;
    const INBOUND_HEARTBEAT_MS = 2500;
    const INBOUND_MONITOR_PARAM = "ct_inbound_monitor";
    // No-data-change is not equivalent to a stale feed. The native table can
    // remain live while metrics are unchanged, so feed health is heartbeat based.

    let lastPersistedFeedStatusSig = "";
    let lastPersistedFeedStatusAt = 0;

    function currentRoute() {
        const path = window.location.pathname.replace(/\/+$/, "");
        if (path === "/manager/campaigns") return "campaigns";
        if (path.startsWith("/manager/campaigns/edit/")) return "campaign_edit";
        if (path === "/manager/queues") return "queues";
        if (path === "/manager/live-filters" || path.startsWith("/manager/live-filters")) return "live_filters";
        return "other";
    }

    function isCampaignsPage() { return currentRoute() === "campaigns"; }
    function isCampaignEditPage() { return currentRoute() === "campaign_edit"; }
    function isQueuesPage() { return currentRoute() === "queues"; }
    function isLiveFiltersPage() { return currentRoute() === "live_filters"; }
    function isMonitorPage() { return isCampaignsPage() || isQueuesPage() || isCampaignEditPage() || isLiveFiltersPage(); }

    function observeLiveFiltersPage() {
        if (!isLiveFiltersPage()) return;
        if (!window.CTParser || !window.CTParser.readLiveFilters) return;
        try {
            const filters = window.CTParser.readLiveFilters(document);
            if (filters && filters.length > 0) {
                let inventory = {};
                try {
                    inventory = JSON.parse(localStorage.getItem(LIVE_FILTERS_INVENTORY_KEY) || "{}");
                } catch (e) {}
                if (!inventory.items) inventory.items = {};

                filters.forEach(f => {
                    const fId = String(f.id);
                    inventory.items[fId] = {
                        id: fId,
                        name: f.name,
                        active: f.active,
                        count: f.count,
                        totalCount: f.totalCount,
                        observedAt: f.observedAt || Date.now(),
                        source: "LIVE_FILTERS_PAGE"
                    };
                });
                inventory.lastObservedAt = Date.now();
                inventory.totalCount = Object.keys(inventory.items).length;

                try {
                    localStorage.setItem(LIVE_FILTERS_INVENTORY_KEY, JSON.stringify(inventory));
                    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                        const obj = {};
                        obj[LIVE_FILTERS_INVENTORY_KEY] = inventory;
                        chrome.storage.local.set(obj);
                    }
                } catch (e) {}
            }
        } catch (e) {}
    }

    function observeCampaignEditForm() {
        if (!window.CTParser || !window.CTParser.readCampaignEditForm) return;
        try {
            const editData = window.CTParser.readCampaignEditForm(document);
            if (editData && editData.campaignId && editData.campaignId !== "unknown") {
                let registry = {};
                try {
                    registry = JSON.parse(localStorage.getItem(VERIFIED_FILTERS_KEY) || "{}");
                } catch (e) {}

                const entry = {
                    campaignId: String(editData.campaignId),
                    campaignName: editData.campaignName,
                    liveFilter: editData.liveFilter,
                    status: editData.status,
                    source: "CAMPAIGN_EDIT_DOM",
                    timestamp: editData.timestamp
                };
                registry[String(editData.campaignId)] = entry;
                if (editData.campaignName) {
                    registry[String(editData.campaignName).trim()] = entry;
                }

                try {
                    localStorage.setItem(VERIFIED_FILTERS_KEY, JSON.stringify(registry));
                    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                        const obj = {};
                        obj[VERIFIED_FILTERS_KEY] = registry;
                        chrome.storage.local.set(obj);
                    }
                } catch (e) {}
            }
        } catch (e) {}
    }
    function isBackgroundInboundMonitor() {
        return isQueuesPage() && new URLSearchParams(window.location.search).get(INBOUND_MONITOR_PARAM) === "1";
    }

    const INBOUND_IFRAME_ID = "ct-operations-hidden-queue-feed-east3";
    const INBOUND_IFRAME_URL = "https://east-3.calltools.io/manager/queues?ct_inbound_monitor=1&ct_inbound_owner=ctompro_east3";
    let inboundIframe = null;
    let inboundIframeReady = false;

    function isInboundMonitorFrame() {
        return isQueuesPage() && new URLSearchParams(window.location.search).get(INBOUND_MONITOR_PARAM) === "1";
    }

    function setInboundFrameStatus(status, reason) {
        if (!isCampaignsPage()) return;
        const now = Date.now();
        persistInboundFeedStatus(status, 0, now);
        try {
            localStorage.setItem(INBOUND_STATUS_KEY, JSON.stringify({
                status: String(status || "WAITING"), heartbeatAt: now, rowCount: 0,
                backgroundMonitor: false, route: "campaigns", reason: String(reason || "")
            }));
        } catch (error) {}
    }

    function ensureInboundFeedMonitor() {
        if (!isCampaignsPage()) return;
        let frame = document.getElementById(INBOUND_IFRAME_ID);
        if (frame && frame.tagName !== "IFRAME") {
            try { frame.remove(); } catch (error) {}
            frame = null;
        }
        if (!frame) {
            frame = document.createElement("iframe");
            frame.id = INBOUND_IFRAME_ID;
            frame.title = "CT Operations Monitor native Queue feed";
            frame.setAttribute("aria-hidden", "true");
            frame.tabIndex = -1;
            frame.style.cssText = "position:fixed;left:-10000px;top:-10000px;width:2px;height:2px;border:0;opacity:0;pointer-events:none;visibility:hidden;";
            frame.addEventListener("load", function () {
                inboundIframeReady = true;
                try {
                    const path = String(frame.contentWindow.location.pathname || "");
                    if (/\/(login|signin)(?:\/|$)/i.test(path)) {
                        inboundIframeReady = false;
                        setInboundFrameStatus("AUTH_REQUIRED", "CallTools redirected the hidden Queue feed to the login screen");
                        return;
                    }
                } catch (error) {}
                setInboundFrameStatus("VERIFYING", "Hidden native Queue feed loaded; waiting for verified Queue table");
            });
            frame.addEventListener("error", function () {
                inboundIframeReady = false;
                setInboundFrameStatus("FRAME_ERROR", "Hidden native Queue feed could not load");
            });
            document.documentElement.appendChild(frame);
        }
        inboundIframe = frame;
        if (!frame.src || frame.src.indexOf("ct_inbound_monitor=1") === -1) frame.src = INBOUND_IFRAME_URL;
    }

    function requestInboundIframeRefresh() {
        if (!isCampaignsPage()) return;
        ensureInboundFeedMonitor();
        const frame = document.getElementById(INBOUND_IFRAME_ID);
        if (!frame || !frame.contentWindow) return;
        try {
            frame.contentWindow.postMessage({ type: "CT_EAST_3_REFRESH_INBOUND_FEED" }, window.location.origin);
        } catch (error) {}
    }

    function teardownInboundIframe() {
        const frame = document.getElementById(INBOUND_IFRAME_ID);
        if (frame) {
            try { frame.remove(); } catch (error) {}
        }
        inboundIframe = null;
        inboundIframeReady = false;
    }

    function inspectInboundIframeAuth() {
        if (!isCampaignsPage()) return;
        const frame = document.getElementById(INBOUND_IFRAME_ID);
        if (!frame || !frame.contentWindow) return;
        try {
            const path = String(frame.contentWindow.location.pathname || "");
            if (/\/(login|signin)(?:\/|$)/i.test(path)) {
                inboundIframeReady = false;
                setInboundFrameStatus("AUTH_REQUIRED", "CallTools redirected the hidden Queue feed to the login screen");
            }
        } catch (error) {}
    }

    function persistInboundFeedStatus(status, queueCount, timestamp) {
        const now = timestamp || Date.now();
        const normalizedStatus = String(status || "WAITING");
        const count = Number(queueCount) || 0;
        const sig = normalizedStatus + "|" + count + "|" + currentRoute();

        // Avoid hammering storage when status has not changed unless 5 seconds have elapsed
        if (sig === lastPersistedFeedStatusSig && now - lastPersistedFeedStatusAt < 5000) {
            return;
        }
        lastPersistedFeedStatusSig = sig;
        lastPersistedFeedStatusAt = now;

        const payload = {
            status: normalizedStatus,
            heartbeatAt: now,
            rowCount: count,
            backgroundMonitor: isBackgroundInboundMonitor(),
            route: currentRoute()
        };
        // Extension storage is the authoritative cross-tab bridge. localStorage
        // remains only as a compatibility fallback for older installed builds.
        try {
            if (chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ [INBOUND_STORAGE_STATUS_KEY]: payload });
            }
        } catch (error) {}
        try { localStorage.setItem(INBOUND_STATUS_KEY, JSON.stringify(payload)); } catch (error) {}
    }

    function persistInboundSnapshot(queues, timestamp) {
        const payload = {
            data: Array.isArray(queues) ? queues : [],
            updatedAt: timestamp || Date.now(),
            source: "CallTools Queues DOM"
        };
        try {
            if (chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ [INBOUND_STORAGE_DATA_KEY]: payload });
            }
        } catch (error) {}
        try { localStorage.setItem(INBOUND_DATA_KEY, JSON.stringify(payload)); } catch (error) {}
    }

    function normalizeText(value) {
        return String(value || "").replace(/\s+/g, " ").trim();
    }

    // STRICTLY READ-ONLY OBSERVER: Zero native button clicks. All native refresh button finders and clickers permanently removed.
    function tableReady(campaigns) {
        return Array.isArray(campaigns) && campaigns.length > 0 && campaigns.some(function (campaign) {
            return campaign && String(campaign.name || "").trim();
        });
    }

    function snapshotKey(campaigns) {
        // Order is intentionally excluded from the freshness signature.
        // A CallTools row reorder must never masquerade as new operational data.
        return JSON.stringify((campaigns || []).map(function (c) {
            return [
                c.id || c.name || "",
                c.name || "",
                c.active === true ? 1 : c.active === false ? 0 : -1,
                c.contacts || "",
                c.channels || "",
                c.waitNow || "",
                c.waitToday || "",
                c.outbound || "",
                c.human || "",
                c.machine || "",
                c.agentConnect || "",
                c.abandoned || "",
                c.noAnswer || "",
                c.busy || "",
                c.failed || "",
                c.loggedIn || "",
                c.waiting || "",
                c.onCall || "",
                c.postCall || "",
                c.goals || "",
                c.liveFilter || ""
            ];
        }).sort(function (a, b) {
            return String(a[0]).localeCompare(String(b[0]));
        }));
    }

    function isCallToolsLoginPage() {
        const password = document.querySelector("input[type='password']");
        const bodyText = normalizeText(document.body && (document.body.innerText || document.body.textContent || "")).toLowerCase();
        return Boolean(password) && /log in|login|forgot password/.test(bodyText);
    }

    function queueTableReady(queues) {
        return Array.isArray(queues) && queues.length > 0 && queues.some(function (queue) {
            return queue && String(queue.name || "").trim();
        });
    }

    function queueSnapshotKey(queues) {
        return JSON.stringify((queues || []).map(function (q) {
            return [
                q.id || q.name || "", q.name || "", q.callsTodayTotal || "", q.callsTodayAnswered || "",
                q.callsTodayNotAnswered || "", q.inboundMachine || "", q.inboundNoAnswer || "",
                q.loggedIn || "", q.onQueueCalls || "", q.callsNowTotal || "", q.waiting || "",
                q.callsNowAnswered || "", q.waitAverage || "", q.waitMax || "", q.calendarEvents || "",
                q.opportunities || "", q.goals || ""
            ];
        }).sort(function(a,b){ return String(a[0]).localeCompare(String(b[0])); }));
    }

    let intervalId = null;
    let observer = null;
    let observerTimer = null;
    let lastSnapshot = "";
    let lastPublishAt = 0;
    let lastDataChangeAt = 0;
    let lastSourceRefreshAt = 0;
    let lastRefreshClickAt = 0;
    let refreshVerificationTimer = null;
    let refreshVerificationStartedAt = 0;
    let refreshWasBusy = false;
    let refreshSnapshotBefore = "";
    let hasPublishedData = false;
    let lastQueueSnapshot = "";
    let lastQueueDataChangeAt = 0;
    let hasPublishedQueues = false;
    let lastInboundCoordinationAt = 0;
    let lastInboundHeartbeatAt = 0;

    function publish(campaigns, meta, queues) {
        document.dispatchEvent(new CustomEvent("CT_EAST_3_UPDATE", {
            detail: {
                campaigns: Array.isArray(campaigns) ? campaigns : [],
                queues: Array.isArray(queues) ? queues : [],
                route: currentRoute(),
                meta: meta
            }
        }));
        lastPublishAt = Date.now();
    }

    function publishFeedStatus(status, extra) {
        document.dispatchEvent(new CustomEvent("CT_EAST_3_FEED_STATUS", {
            detail: Object.assign({
                status: status,
                lastSourceRefreshAt: lastSourceRefreshAt || null,
                lastDataChangeAt: lastDataChangeAt || null,
                lastPublishAt: lastPublishAt || null,
                lastCheckAt: Date.now(),
                dataAgeMs: lastDataChangeAt ? Date.now() - lastDataChangeAt : null,
                rowCount: hasPublishedData ? undefined : 0
            }, extra || {})
        }));
    }

    function readAndPublish(reason, forcePublish) {
        if (!isMonitorPage() || !window.CTParser) return;

        try {
            const route = currentRoute();
            const now = Date.now();

            if (isCallToolsLoginPage()) {
                publish([], {
                    authRequired: true,
                    observationAt: now,
                    status: "AUTH_REQUIRED",
                    reason: "CallTools login screen detected"
                }, []);
                publishFeedStatus("AUTH_REQUIRED", { reason: "CallTools login screen detected; authentication required.", route: route, rowCount: 0, authRequired: true, lastCheckAt: now });
                return;
            }

            if (route === "campaigns") {
                const campaigns = window.CTParser.readCampaigns();
                const tableNode = window.CTParser.findCampaignTable ? window.CTParser.findCampaignTable() : document.querySelector("table, mat-table");
                const isPageLoading = typeof document !== "undefined" && document.readyState && document.readyState !== "complete";
                if (!tableReady(campaigns)) {
                    const tableMissing = !tableNode && !isPageLoading;
                    publishFeedStatus(tableMissing ? "SOURCE_ERROR" : "VERIFYING", {
                        reason: tableMissing ? "Campaign table not found in DOM" : (isPageLoading ? "CallTools page is loading" : (hasPublishedData ? "CallTools is rebuilding the campaign table" : "Waiting for the CallTools campaign table")),
                        route: route,
                        tableMissing: tableMissing,
                        lastCheckAt: now
                    });
                    if (tableMissing) {
                        publish([], { tableMissing: true, observationAt: now, status: "SOURCE_ERROR" }, []);
                    }
                    return;
                }
                const nextSnapshot = snapshotKey(campaigns);
                const changed = nextSnapshot !== lastSnapshot;
                const unverified = campaigns.filter(function (c) { return c.active !== true && c.active !== false; }).length;
                if (changed) { lastSnapshot = nextSnapshot; lastDataChangeAt = now; }
                hasPublishedData = true;

                // Always publish snapshot to notify dashboard of live observation and update observation timestamp
                publish(campaigns, {
                    sourceUpdatedAt: lastDataChangeAt || now,
                    dataChangedAt: lastDataChangeAt || now,
                    observationAt: now,
                    changed: changed,
                    status: unverified ? "DATA CHECK" : "LIVE",
                    reason: changed ? (reason || "data-change") : (forcePublish ? (reason || "manual-refresh") : "poll-heartbeat"),
                    rowCount: campaigns.length,
                    unverifiedCount: unverified
                }, []);

                if (unverified) {
                    publishFeedStatus("DATA CHECK", { reason: unverified + " campaign status" + (unverified === 1 ? " is" : "es are") + " unverified", rowCount: campaigns.length, unverifiedCount: unverified, route: route, lastCheckAt: now });
                    return;
                }
                publishFeedStatus("LIVE", { reason: changed ? "New CallTools campaign data received" : "CallTools checked; feed alive", rowCount: campaigns.length, unverifiedCount: 0, route: route, lastCheckAt: now });
                return;
            }

            // Queues page
            const queues = window.CTParser.readQueues ? window.CTParser.readQueues() : [];
            const queueTableNode = window.CTParser.findQueueTable ? window.CTParser.findQueueTable() : document.querySelector("table, mat-table");
            if (!queueTableReady(queues)) {
                const tableMissing = !queueTableNode;
                if (now - lastInboundHeartbeatAt >= INBOUND_HEARTBEAT_MS) {
                    lastInboundHeartbeatAt = now;
                    persistInboundFeedStatus(tableMissing ? "SOURCE_ERROR" : "VERIFYING", 0, now);
                }
                publishFeedStatus(tableMissing ? "SOURCE_ERROR" : "VERIFYING", {
                    reason: tableMissing ? "Queue table not found in DOM" : (hasPublishedQueues ? "CallTools is rebuilding the queue table" : "Waiting for the CallTools queue table"),
                    route: route,
                    tableMissing: tableMissing,
                    lastCheckAt: now
                });
                if (tableMissing) {
                    publish([], { tableMissing: true, observationAt: now, status: "SOURCE_ERROR" }, []);
                }
                return;
            }

            const nextQueueSnapshot = queueSnapshotKey(queues);
            const queueChanged = nextQueueSnapshot !== lastQueueSnapshot;
            if (queueChanged) { lastQueueSnapshot = nextQueueSnapshot; lastQueueDataChangeAt = now; }
            hasPublishedQueues = true;
            persistInboundSnapshot(queues, now);

            publish([], {
                sourceUpdatedAt: lastQueueDataChangeAt || now,
                dataChangedAt: lastQueueDataChangeAt || now,
                observationAt: now,
                changed: queueChanged,
                status: "LIVE",
                reason: queueChanged ? (reason || "queue-data-change") : (forcePublish ? (reason || "manual-queue-refresh") : "queue-poll-heartbeat"),
                rowCount: queues.length,
                unverifiedCount: 0
            }, queues);

            if (now - lastInboundHeartbeatAt >= INBOUND_HEARTBEAT_MS || queueChanged || !hasPublishedQueues) {
                lastInboundHeartbeatAt = now;
                persistInboundFeedStatus("LIVE", queues.length, now);
            }
            publishFeedStatus("LIVE", { reason: queueChanged ? "New CallTools queue data received" : "CallTools checked; feed alive", rowCount: queues.length, unverifiedCount: 0, route: route, lastCheckAt: now });
        } catch (err) {
            console.error("CT Operations Monitor (" + EDITION + ") feed processing error:", err);
            publishFeedStatus("ERROR", { reason: "Processing error: " + (err && err.message ? err.message : String(err)), route: currentRoute(), lastCheckAt: Date.now() });
        }
    }

    // STRICTLY READ-ONLY OBSERVER: No simulated button clicks or verification timers.
    function poll() {
        if (!isMonitorPage() || !window.CTParser) return;
        if (isLiveFiltersPage()) {
            observeLiveFiltersPage();
            return;
        }
        if (isCampaignEditPage()) {
            observeCampaignEditForm();
            return;
        }
        const now = Date.now();
        if (isCampaignsPage()) {
            observeCampaignEditForm();
            if (now - lastInboundCoordinationAt >= INBOUND_COORDINATION_MS) {
                lastInboundCoordinationAt = now;
                ensureInboundFeedMonitor();
                requestInboundIframeRefresh();
            }
            if (now - lastInboundHeartbeatAt >= INBOUND_HEARTBEAT_MS) inspectInboundIframeAuth();
        }
        if (isQueuesPage()) {
            teardownInboundIframe();
            readAndPublish("queue-poll");
            return;
        }

        readAndPublish("poll");
    }

    // A successful parser poll is the feed heartbeat. Unchanged campaign
        // values are normal and must not be mislabeled as stale.
        // IMPORTANT: stale data is reported, but the extension NEVER reloads
        // the CallTools page automatically. Automatic page reloads destroy the
        // operator's diagnostic session and can interrupt live monitoring.
        // Recovery is operator-controlled through the dashboard's Refresh Data
        // button or a normal browser refresh when genuinely required.

    const ROW_SELECTOR = "tr.mat-row, tr.mat-mdc-row, mat-row, tr[mat-row], tbody tr, [role='row'].mat-row, [role='row'].mat-mdc-row";

    function mutationTouchesCampaignTable(mutation) {
        if (!mutation) return false;
        const dashboard = document.querySelector("#ct-operations-dashboard, #ct-operations-dashboard-east3, #ct-operations-dashboard-east2, [id^='ct-operations-dashboard']");
        if (dashboard && mutation.target && dashboard.contains(mutation.target)) return false;

        if (mutation.type === "childList") {
            const target = mutation.target;
            if (target && target.closest && target.closest(ROW_SELECTOR)) return true;
            for (const node of Array.from(mutation.addedNodes || [])) {
                if (node.nodeType !== 1) continue;
                if ((node.matches && node.matches(ROW_SELECTOR)) ||
                    (node.querySelector && node.querySelector(ROW_SELECTOR))) return true;
            }
            return false;
        }

        // CallTools frequently updates existing campaign cells in place.
        const target = mutation.target;
        const row = target && target.closest ? target.closest(ROW_SELECTOR) : (target && target.parentElement && target.parentElement.closest ? target.parentElement.closest(ROW_SELECTOR) : null);
        if (!row) return false;
        if (mutation.type === "characterData") return true;
        if (mutation.type === "attributes") {
            return ["class", "style", "aria-label", "title", "data-state", "data-value"].includes(String(mutation.attributeName || "").toLowerCase());
        }
        return false;
    }

    function mutationTouchesQueueTable(mutation) {
        if (!mutation) return false;
        const dashboard = document.querySelector("#ct-operations-dashboard, #ct-operations-dashboard-east3, #ct-operations-dashboard-east2, [id^='ct-operations-dashboard']");
        if (dashboard && mutation.target && dashboard.contains(mutation.target)) return false;
        const target = mutation.target;
        const rowFromTarget = target && target.closest ? target.closest("tr.mat-row, tr.mat-mdc-row, tbody tr") : null;
        const tableLooksLikeQueue = function(table) {
            if (!table) return false;
            const text = String(table.innerText || table.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
            return /calls \(today\)/.test(text) && /agents \(now\)/.test(text) && /wait time \(now\)/.test(text);
        };
        if (rowFromTarget && tableLooksLikeQueue(rowFromTarget.closest("table, mat-table"))) return true;
        if (mutation.type === "childList") {
            for (const node of Array.from(mutation.addedNodes || [])) {
                if (node.nodeType !== 1) continue;
                const row = node.matches && node.matches("tr.mat-row, tr.mat-mdc-row, tbody tr") ? node : node.querySelector && node.querySelector("tr.mat-row, tr.mat-mdc-row, tbody tr");
                if (row && tableLooksLikeQueue(row.closest("table, mat-table"))) return true;
            }
        }
        return false;
    }

    function scheduleDomRead() {
        if (observerTimer) return;
        observerTimer = window.setTimeout(function () {
            observerTimer = null;
            readAndPublish("dom-change");
            // CallTools may replace the table node during a render. Keep the
            // observer attached to the body so replacement is still detected.
        }, 80);
    }

    function installObserver() {
        if (observer) observer.disconnect();
        const target = document.body;
        observer = new MutationObserver(function (mutations) {
            if (!isMonitorPage()) return;
            if (isLiveFiltersPage()) {
                observeLiveFiltersPage();
                return;
            }
            if (isQueuesPage()) {
                if (mutations.some(mutationTouchesQueueTable)) scheduleDomRead();
                return;
            }
            if (mutations.some(mutationTouchesCampaignTable)) scheduleDomRead();
        });
        // Watch structural table changes only. Text/attribute churn elsewhere
        // on the CallTools page must not trigger parser work.
        observer.observe(target, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "style", "aria-label", "title", "data-state", "data-value"] });
    }

    function cleanup() {
        if (intervalId) window.clearInterval(intervalId);
        if (observerTimer) window.clearTimeout(observerTimer);
        if (refreshVerificationTimer) window.clearTimeout(refreshVerificationTimer);
        if (observer) observer.disconnect();
        intervalId = null;
        observerTimer = null;
        refreshVerificationTimer = null;
        observer = null;
    }

    function init() {
        cleanup();
        if (!isMonitorPage()) return;

        window.__CTOperationsFeedCleanup = cleanup;
        installObserver();
        if (isCampaignsPage()) {
            lastInboundCoordinationAt = Date.now();
            ensureInboundFeedMonitor();
        } else if (isQueuesPage()) {
            teardownInboundIframe();
        }
        if (isBackgroundInboundMonitor()) {
            persistInboundFeedStatus("VERIFYING", 0, Date.now());
        }
        readAndPublish("initial");
        [120, 350, 750, 1200].forEach(function (delay) {
            window.setTimeout(function () {
                readAndPublish("mount-settle-" + delay);
            }, delay);
        });
        document.addEventListener("visibilitychange", function () {
            if (document.visibilityState === "visible") {
                readAndPublish("tab-visibility-recovery", true);
            }
        });
        intervalId = window.setInterval(poll, POLL_MS);
    }

    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener(function (message) {
            if (!message || message.type !== "CT_EAST_3_REFRESH_INBOUND_FEED" || !isQueuesPage()) return;
            lastSourceRefreshAt = Date.now();
            publishFeedStatus("VERIFYING", { reason: "Inbound feed re-check requested from Operations Monitor", route: "queues" });
            readAndPublish("manual-inbound-refresh-check", true);
        });
    }

    window.addEventListener("message", function (event) {
        if (!isInboundMonitorFrame() || event.origin !== window.location.origin) return;
        if (!event.data || event.data.type !== "CT_EAST_3_REFRESH_INBOUND_FEED") return;
        lastSourceRefreshAt = Date.now();
        publishFeedStatus("VERIFYING", { reason: "Inbound feed re-check requested from Operations Monitor", route: "queues" });
        readAndPublish("manual-inbound-refresh-check", true);
    });

    document.addEventListener("CT_EAST_3_REQUEST_INBOUND_REFRESH", function () {
        if (isQueuesPage()) {
            lastSourceRefreshAt = Date.now();
            publishFeedStatus("VERIFYING", { reason: "Manual inbound feed re-check requested", route: "queues" });
            readAndPublish("manual-inbound-refresh-check", true);
            return;
        }
        requestInboundIframeRefresh();
    });

    document.addEventListener("CT_EAST_3_REQUEST_REFRESH", function () {
        lastSourceRefreshAt = Date.now();
        if (isQueuesPage()) {
            publishFeedStatus("VERIFYING", { reason: "Manual queue feed re-check requested", route: "queues" });
            readAndPublish("manual-queue-refresh-check", true);
            return;
        }
        publishFeedStatus("VERIFYING", { reason: "Manual campaign feed re-check requested", route: "campaigns" });
        readAndPublish("manual-campaign-refresh", true);
    });

    init();
})();
