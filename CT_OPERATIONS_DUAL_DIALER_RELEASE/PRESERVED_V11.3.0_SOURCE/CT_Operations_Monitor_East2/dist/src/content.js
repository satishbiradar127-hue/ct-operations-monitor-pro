console.log("CT Operations Monitor (EAST-2) — Production live feed controller v11.2.0");

(function () {
    "use strict";

    const TARGET_HOST = "east-2.calltools.io";
    const EDITION = "EAST-2";
    if (window.location.hostname && window.location.hostname !== TARGET_HOST) {
        console.log("CT Operations Monitor (" + EDITION + ") — wrong host " + window.location.hostname + "; expected " + TARGET_HOST);
        return;
    }

    const POLL_MS = 1000;
    const NATIVE_REFRESH_MS = 5000;
    const REFRESH_VERIFY_TIMEOUT_MS = 7000;
    const REFRESH_VERIFY_STEP_MS = 350;
    const INBOUND_DATA_KEY = "ct_east2_last_known_queues_v1";
    const INBOUND_STATUS_KEY = "ct_east2_inbound_feed_status_v1";
    const INBOUND_STORAGE_DATA_KEY = "ct_east2_inbound_data_v2";
    const INBOUND_STORAGE_STATUS_KEY = "ct_east2_inbound_status_v2";
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
        if (path === "/manager/queues") return "queues";
        return "other";
    }

    function isCampaignsPage() { return currentRoute() === "campaigns"; }
    function isQueuesPage() { return currentRoute() === "queues"; }
    function isMonitorPage() { return isCampaignsPage() || isQueuesPage(); }
    function isBackgroundInboundMonitor() {
        return isQueuesPage() && new URLSearchParams(window.location.search).get(INBOUND_MONITOR_PARAM) === "1";
    }

    const INBOUND_IFRAME_ID = "ct-operations-hidden-queue-feed-east2";
    const INBOUND_IFRAME_URL = "https://east-2.calltools.io/manager/queues?ct_inbound_monitor=1&ct_inbound_owner=ctompro_east2";
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
            frame.contentWindow.postMessage({ type: "CT_EAST_2_REFRESH_INBOUND_FEED" }, window.location.origin);
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

    function findNativeRefreshButton() {
        const candidates = Array.from(document.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit'], mat-icon, [data-testid], [class*='refresh'], [aria-label*='refresh' i], [title*='refresh' i]"));
        const matches = [];
        candidates.forEach(function (node) {
            if (!node || node.offsetParent === null) return;
            if (node.closest && node.closest("#ct-operations-dashboard")) return;
            const text = normalizeText(node.innerText || node.textContent || node.value || "");
            const aria = normalizeText(node.getAttribute("aria-label"));
            const title = normalizeText(node.getAttribute("title"));
            const testid = normalizeText(node.getAttribute("data-testid"));
            const cls = typeof node.className === "string" ? normalizeText(node.className) : "";
            const icon = normalizeText(node.getAttribute("data-icon"));
            const signal = (text + " " + aria + " " + title + " " + testid + " " + cls + " " + icon).toLowerCase();
            if (!/(^|\b)refresh(\b|$)|\brefresh[_-]?(icon|button)\b|\bmat-icon\b.*\brefresh\b/.test(signal)) return;
            const clickable = node.matches("button,[role='button'],input") ? node : node.closest("button,[role='button'],[role='menuitem']");
            if (clickable && clickable.offsetParent !== null && !matches.includes(clickable)) matches.push(clickable);
        });

        return matches.find(function (node) {
            return /^refresh$/i.test(normalizeText(node.innerText || node.textContent || node.value || ""));
        }) || matches[0] || null;
    }

    function refreshButtonBusy(button) {
        if (!button) return false;
        const text = normalizeText(button.innerText || button.textContent || button.value || "").toLowerCase();
        return button.disabled || button.getAttribute("aria-busy") === "true" || /refreshing/.test(text);
    }

    function tableReady(campaigns) {
        return Array.isArray(campaigns) && campaigns.length > 0 && campaigns.every(function (campaign) {
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
        return Array.isArray(queues) && queues.length > 0 && queues.every(function (queue) {
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
        document.dispatchEvent(new CustomEvent("CT_EAST_2_UPDATE", {
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
        document.dispatchEvent(new CustomEvent("CT_EAST_2_FEED_STATUS", {
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

        const route = currentRoute();
        if (route === "campaigns") {
            const campaigns = window.CTParser.readCampaigns();
            if (!tableReady(campaigns)) {
                publishFeedStatus("VERIFYING", { reason: hasPublishedData ? "CallTools is rebuilding the campaign table" : "Waiting for the CallTools campaign table", route: route });
                return;
            }
            const now = Date.now();
            const nextSnapshot = snapshotKey(campaigns);
            const changed = nextSnapshot !== lastSnapshot;
            const unverified = campaigns.filter(function (c) { return c.active !== true && c.active !== false; }).length;
            if (changed) { lastSnapshot = nextSnapshot; lastDataChangeAt = now; }
            if (changed || !hasPublishedData || forcePublish) {
                hasPublishedData = true;
                publish(campaigns, {
                    sourceUpdatedAt: lastDataChangeAt || now, dataChangedAt: lastDataChangeAt || now,
                    sourceRefreshAt: lastSourceRefreshAt || null, status: unverified ? "DATA CHECK" : "LIVE",
                    reason: changed ? (reason || "data-change") : (forcePublish ? (reason || "source-refresh") : "initial-data"),
                    rowCount: campaigns.length, unverifiedCount: unverified
                }, []);
            }
            if (unverified) {
                publishFeedStatus("DATA CHECK", { reason: unverified + " campaign status" + (unverified === 1 ? " is" : "es are") + " unverified", rowCount: campaigns.length, unverifiedCount: unverified, route: route });
                return;
            }
            publishFeedStatus("LIVE", { reason: changed ? "New CallTools campaign data received" : "CallTools checked; no campaign data change detected", rowCount: campaigns.length, unverifiedCount: 0, route: route });
            return;
        }

        if (isCallToolsLoginPage()) {
            const authNow = Date.now();
            if (authNow - lastInboundHeartbeatAt >= INBOUND_HEARTBEAT_MS) {
                lastInboundHeartbeatAt = authNow;
                persistInboundFeedStatus("AUTH_REQUIRED", 0, authNow);
            }
            publishFeedStatus("AUTH_REQUIRED", { reason: "CallTools Queue context is showing the login screen; no Queue metrics are accepted as live.", route: route, rowCount: 0 });
            return;
        }
        const queues = window.CTParser.readQueues ? window.CTParser.readQueues() : [];
        if (!queueTableReady(queues)) {
            const verifyNow = Date.now();
            if (verifyNow - lastInboundHeartbeatAt >= INBOUND_HEARTBEAT_MS) {
                lastInboundHeartbeatAt = verifyNow;
                persistInboundFeedStatus("VERIFYING", 0, verifyNow);
            }
            publishFeedStatus("VERIFYING", { reason: hasPublishedQueues ? "CallTools is rebuilding the queue table" : "Waiting for the CallTools queue table", route: route });
            return;
        }
        const now = Date.now();
        const nextQueueSnapshot = queueSnapshotKey(queues);
        const queueChanged = nextQueueSnapshot !== lastQueueSnapshot;
        if (queueChanged) { lastQueueSnapshot = nextQueueSnapshot; lastQueueDataChangeAt = now; }
        if (queueChanged || !hasPublishedQueues || forcePublish) {
            hasPublishedQueues = true;
            persistInboundSnapshot(queues, now);
            publish([], {
                sourceUpdatedAt: lastQueueDataChangeAt || now, dataChangedAt: lastQueueDataChangeAt || now,
                sourceRefreshAt: lastSourceRefreshAt || null, status: "LIVE",
                reason: queueChanged ? (reason || "queue-data-change") : (forcePublish ? (reason || "queue-source-refresh") : "initial-queue-data"),
                rowCount: queues.length, unverifiedCount: 0
            }, queues);
        }
        if (now - lastInboundHeartbeatAt >= INBOUND_HEARTBEAT_MS || queueChanged || !hasPublishedQueues) {
            lastInboundHeartbeatAt = now;
            persistInboundFeedStatus("LIVE", queues.length, now);
        }
        publishFeedStatus("LIVE", { reason: queueChanged ? "New CallTools queue data received" : "CallTools checked; no queue data change detected", rowCount: queues.length, unverifiedCount: 0, route: route });
    }

    function finishRefreshVerification() {
        if (!isCampaignsPage()) return;

        const button = findNativeRefreshButton();
        const campaigns = window.CTParser ? window.CTParser.readCampaigns() : [];
        const elapsed = Date.now() - refreshVerificationStartedAt;
        const currentSnapshot = tableReady(campaigns) ? snapshotKey(campaigns) : "";
        const dataChanged = currentSnapshot && currentSnapshot !== refreshSnapshotBefore;
        const cycleComplete = refreshWasBusy && !refreshButtonBusy(button);

        if (dataChanged || cycleComplete || elapsed >= REFRESH_VERIFY_TIMEOUT_MS) {
            lastSourceRefreshAt = Date.now();
            refreshVerificationTimer = null;
            readAndPublish(dataChanged ? "refresh-data-change" : "refresh-check-complete", true);
            return;
        }

        refreshVerificationTimer = window.setTimeout(finishRefreshVerification, REFRESH_VERIFY_STEP_MS);
    }

    function requestNativeRefresh(reason) {
        if (!isCampaignsPage() || !window.CTParser) return false;

        const now = Date.now();
        if (now - lastRefreshClickAt < NATIVE_REFRESH_MS - 1000) return false;

        const button = findNativeRefreshButton();
        if (!button || refreshButtonBusy(button)) return false;

        const text = normalizeText(button.innerText || button.textContent || button.value || "");
        if (!/^refresh$/i.test(text) && !/\brefresh\b/i.test(text)) return false;

        const before = window.CTParser.readCampaigns();
        refreshSnapshotBefore = tableReady(before) ? snapshotKey(before) : "";
        lastRefreshClickAt = now;
        refreshVerificationStartedAt = now;
        refreshWasBusy = false;
        button.click();

        if (refreshVerificationTimer) window.clearTimeout(refreshVerificationTimer);
        refreshVerificationTimer = window.setTimeout(finishRefreshVerification, REFRESH_VERIFY_STEP_MS);
        publishFeedStatus("VERIFYING", {
            reason: reason || "Requesting a native CallTools refresh"
        });
        return true;
    }

    function poll() {
        if (!isMonitorPage() || !window.CTParser) return;
        const now = Date.now();
        if (isCampaignsPage()) {
            if (now - lastInboundCoordinationAt >= INBOUND_COORDINATION_MS) {
                lastInboundCoordinationAt = now;
                ensureInboundFeedMonitor();
                requestInboundIframeRefresh();
            }
            if (now - lastInboundHeartbeatAt >= INBOUND_HEARTBEAT_MS) inspectInboundIframeAuth();
        }
        if (isQueuesPage()) {
            teardownInboundIframe();
            // Automatically refresh queue feed if native button exists and interval elapsed
            const qButton = findNativeRefreshButton();
            if (qButton && !refreshButtonBusy(qButton) && now - lastRefreshClickAt >= NATIVE_REFRESH_MS) {
                lastRefreshClickAt = now;
                try { qButton.click(); } catch (error) {}
            }
            readAndPublish("queue-poll");
            return;
        }

        const button = findNativeRefreshButton();
        const busyNow = refreshButtonBusy(button);
        if (busyNow) {
            refreshWasBusy = true;
            publishFeedStatus("VERIFYING", { reason: "CallTools is refreshing" });
        } else if (refreshWasBusy) {
            refreshWasBusy = false;
            lastSourceRefreshAt = Date.now();
            readAndPublish("native-refresh-complete", true);
        } else if (isCampaignsPage() && now - lastRefreshClickAt >= NATIVE_REFRESH_MS) {
            // Automatic periodic live refresh: trigger CallTools native table refresh every NATIVE_REFRESH_MS (5s)
            const activeEl = document.activeElement;
            const isTyping = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA") && !activeEl.closest("#ct-operations-dashboard");
            const isInteracting = Boolean(document.querySelector("#ct-operations-dashboard.is-dragging, #ct-operations-dashboard.is-resizing"));
            if (!isTyping && !isInteracting) {
                requestNativeRefresh("Automated periodic live feed refresh");
            }
        }

        readAndPublish("poll");

        // A successful parser poll is the feed heartbeat. Unchanged campaign
        // values are normal and must not be mislabeled as stale.
        // IMPORTANT: stale data is reported, but the extension NEVER reloads
        // the CallTools page automatically. Automatic page reloads destroy the
        // operator's diagnostic session and can interrupt live monitoring.
        // Recovery is operator-controlled through the dashboard's Refresh Data
        // button or a normal browser refresh when genuinely required.
    }

    function mutationTouchesCampaignTable(mutation) {
        if (!mutation) return false;
        const dashboard = document.getElementById("ct-operations-dashboard");
        if (dashboard && mutation.target && dashboard.contains(mutation.target)) return false;

        if (mutation.type === "childList") {
            const target = mutation.target;
            if (target && target.closest && target.closest("tr.mat-row, tr.mat-mdc-row")) return true;
            for (const node of Array.from(mutation.addedNodes || [])) {
                if (node.nodeType !== 1) continue;
                if ((node.matches && node.matches("tr.mat-row, tr.mat-mdc-row")) ||
                    (node.querySelector && node.querySelector("tr.mat-row, tr.mat-mdc-row"))) return true;
            }
            return false;
        }

        // CallTools frequently updates existing campaign cells in place. Those
        // updates can be characterData/attribute mutations without replacing the
        // row, so capture only mutations that occur inside a campaign row. The
        // dashboard itself is excluded above, preventing a parser/render loop.
        const target = mutation.target;
        const row = target && target.closest ? target.closest("tr.mat-row, tr.mat-mdc-row") : (target && target.parentElement && target.parentElement.closest ? target.parentElement.closest("tr.mat-row, tr.mat-mdc-row") : null);
        if (!row) return false;
        if (mutation.type === "characterData") return true;
        if (mutation.type === "attributes") {
            return ["class", "style", "aria-label", "title", "data-state", "data-value"].includes(String(mutation.attributeName || "").toLowerCase());
        }
        return false;
    }

    function mutationTouchesQueueTable(mutation) {
        if (!mutation) return false;
        const dashboard = document.getElementById("ct-operations-dashboard");
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
        intervalId = window.setInterval(poll, POLL_MS);
    }

    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener(function (message) {
            if (!message || message.type !== "CT_EAST_2_REFRESH_INBOUND_FEED" || !isQueuesPage()) return;
            lastSourceRefreshAt = Date.now();
            const qBtn = findNativeRefreshButton();
            if (qBtn && !refreshButtonBusy(qBtn)) {
                try { qBtn.click(); } catch (error) {}
            }
            publishFeedStatus("VERIFYING", { reason: "Inbound feed re-check requested from Operations Monitor", route: "queues" });
            readAndPublish("manual-inbound-refresh-check", true);
        });
    }

    window.addEventListener("message", function (event) {
        if (!isInboundMonitorFrame() || event.origin !== window.location.origin) return;
        if (!event.data || event.data.type !== "CT_EAST_2_REFRESH_INBOUND_FEED") return;
        lastSourceRefreshAt = Date.now();
        const qBtn = findNativeRefreshButton();
        if (qBtn && !refreshButtonBusy(qBtn)) {
            try { qBtn.click(); } catch (error) {}
        }
        publishFeedStatus("VERIFYING", { reason: "Inbound feed re-check requested from Operations Monitor", route: "queues" });
        readAndPublish("manual-inbound-refresh-check", true);
    });

    document.addEventListener("CT_EAST_2_REQUEST_INBOUND_REFRESH", function () {
        if (isQueuesPage()) {
            lastSourceRefreshAt = Date.now();
            publishFeedStatus("VERIFYING", { reason: "Manual inbound feed re-check requested", route: "queues" });
            readAndPublish("manual-inbound-refresh-check", true);
            return;
        }
        requestInboundIframeRefresh();
    });

    document.addEventListener("CT_EAST_2_REQUEST_REFRESH", function () {
        if (isQueuesPage()) {
            lastSourceRefreshAt = Date.now();
            publishFeedStatus("VERIFYING", { reason: "Manual queue feed re-check requested", route: "queues" });
            readAndPublish("manual-queue-refresh-check", true);
            return;
        }
        const requested = requestNativeRefresh("Manual refresh requested from Operations Monitor");
        if (requested) return;
        lastSourceRefreshAt = Date.now();
        publishFeedStatus("VERIFYING", { reason: "No native CallTools refresh control found; verified parser re-read only", route: "campaigns" });
        readAndPublish("manual-refresh-check", true);
    });

    init();
})();
