console.log("CT Operations Monitor (" + ("EAST-2") + ") — Production live feed controller v11.3.9"); // compat v11.3.8

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
    const VERIFIED_FILTERS_KEY = "ct_east2_verified_campaign_filters_v1";
    const LIVE_FILTERS_INVENTORY_KEY = "ct_east2_live_filters_inventory_v1";
    const FILTER_ID_MAP_KEY = "ct_east2_filter_id_map_v1";
    let lastEditWriteAt = 0;
    let lastEditSig = "";
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

    const LF_MONITOR_PARAM = "ct_lf_monitor";
    const LF_INVENTORY_IFRAME_ID = "ct-operations-hidden-livefilters-feed-east2";
    const LF_EDIT_IFRAME_ID = "ct-operations-hidden-campaign-filter-east2";
    const LF_INVENTORY_REFRESH_MS = 4500;
    const LF_ACTIVE_PROBE_MS = 12000;
    const LF_IDLE_PROBE_MS = 90000;
    const LF_BETWEEN_PROBES_MS = 550;
    const LF_PROBE_TIMEOUT_MS = 10500;
    const MANUAL_REFRESH_TIMEOUT_MS = 20000;
    let lastInvSig = "";
    let lastInvWriteAt = 0;
    let invCompletedEpoch = -1;
    let editCompletedEpoch = -1;
    let bgCampCompletedEpoch = -1;
    let lfInvInFlightStartedAt = 0;
    let lfInvLastCompletedAt = 0;
    let lfProbeInFlight = null;
    let lfLastProbeCompletedAt = 0;
    const lfLastProbeByCid = {};
    let lfAuthPaused = false;
    let lfSpaBooted = false;
    let lfSpaLastCompletedKind = "";
    let lfConsecutiveTimeouts = 0;
    let bgRouteEpoch = 0;
    let manualRefreshSession = null;

    function isCampaignsPage() { return currentRoute() === "campaigns"; }
    function isTopLevelCampaignsPage() { return isCampaignsPage() && (typeof window === "undefined" || !window.top || window === window.top); }
    function isBackgroundCampaignsFrame() { return isCampaignsPage() && new URLSearchParams(window.location.search).get(LF_MONITOR_PARAM) === "1" && (typeof window !== "undefined" && window.top && window !== window.top); }
    function isCampaignEditPage() { return currentRoute() === "campaign_edit"; }
    function isQueuesPage() { return currentRoute() === "queues"; }
    function isLiveFiltersPage() { return currentRoute() === "live_filters"; }
    function isBackgroundCampaignEditFrame() { return isCampaignEditPage() && new URLSearchParams(window.location.search).get(LF_MONITOR_PARAM) === "1"; }
    function isBackgroundLiveFiltersFrame() { return isLiveFiltersPage() && new URLSearchParams(window.location.search).get(LF_MONITOR_PARAM) === "1"; }
    function isMonitorPage() { return isCampaignsPage() || isQueuesPage() || isCampaignEditPage() || isLiveFiltersPage(); }

    function normFilterKey(name) {
        return String(name || "")
            .replace(/[\(\[]\s*(?:Count|Contacts)?\s*:?\s*[0-9,]+\s*[\)\]]/gi, "")
            .replace(/\s*\(\s*Not\s+Active\s*\)\s*$/i, "")
            .trim()
            .toLowerCase();
    }

    function observeLiveFiltersPage() {
        if (!isLiveFiltersPage()) return false;
        if (!window.CTParser || !window.CTParser.readLiveFilters) return false;
        try {
            const filters = window.CTParser.readLiveFilters(document);
            if (filters && filters.length > 0) {
                const now = Date.now();
                const sig = filters.map(function (f) { return [f.id, f.name, f.active ? 1 : 0, f.count, f.totalCount].join(":"); }).join("|");
                const needEpochNotify = isBackgroundLiveFiltersFrame() && invCompletedEpoch !== bgRouteEpoch;
                if (!needEpochNotify && sig === lastInvSig && (now - lastInvWriteAt) < 4000) {
                    return false;
                }
                let inventory = {};
                let idMap = {};
                try {
                    inventory = JSON.parse(localStorage.getItem(LIVE_FILTERS_INVENTORY_KEY) || "{}");
                } catch (e) {}
                try {
                    idMap = JSON.parse(localStorage.getItem(FILTER_ID_MAP_KEY) || "{}");
                } catch (e) {}
                if (!inventory.items || typeof inventory.items !== "object") inventory.items = {};

                const observedByNormName = new Set();
                filters.forEach(function (f) {
                    const nKey = normFilterKey(f.name);
                    if (nKey) observedByNormName.add(nKey);
                    const mapHit = nKey && idMap[nKey] ? idMap[nKey] : null;
                    const resolvedId = (f.rawId && /^[0-9]+$/.test(String(f.rawId)))
                        ? String(f.rawId)
                        : (mapHit && mapHit.filterId && /^[0-9]+$/.test(String(mapHit.filterId)) ? String(mapHit.filterId) : String(f.id));
                    const slugId = String(f.id);
                    if (slugId !== resolvedId && inventory.items[slugId]) {
                        delete inventory.items[slugId];
                    }
                    const existingInv = inventory.items[resolvedId];
                    const nextObsAt = Number(f.observedAt || now);
                    if (existingInv && existingInv.observedAt && nextObsAt < Number(existingInv.observedAt)) {
                        return;
                    }
                    inventory.items[resolvedId] = {
                        id: resolvedId,
                        name: f.name,
                        active: f.active,
                        count: f.count,
                        totalCount: f.totalCount,
                        observedAt: nextObsAt,
                        source: "LIVE_FILTERS_PAGE"
                    };
                });

                // Prune deleted / unreferenced stale ghost entries when we have an authoritative filter catalog map
                const catalogKnownCount = Object.keys(idMap).length;
                Object.keys(inventory.items).forEach(function (k) {
                    const item = inventory.items[k];
                    if (!item || !item.name) {
                        delete inventory.items[k];
                        return;
                    }
                    const nKey = normFilterKey(item.name);
                    const inLiveScan = observedByNormName.has(nKey);
                    const inCatalog = catalogKnownCount > 0 && Boolean(idMap[nKey]);
                    const itemAge = now - (Number(item.observedAt) || 0);
                    if (!inLiveScan && ((catalogKnownCount > 0 && !inCatalog) || itemAge > 300000)) {
                        delete inventory.items[k];
                    }
                });

                inventory.lastObservedAt = Math.max(Number(inventory.lastObservedAt || 0), now);
                inventory.totalCount = Object.keys(inventory.items).length;
                lastInvSig = sig;
                lastInvWriteAt = now;
                invCompletedEpoch = bgRouteEpoch;

                try {
                    localStorage.setItem(LIVE_FILTERS_INVENTORY_KEY, JSON.stringify(inventory));
                    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                        const obj = {};
                        obj[LIVE_FILTERS_INVENTORY_KEY] = inventory;
                        chrome.storage.local.set(obj);
                    }
                    if (window.parent && window.parent !== window) {
                        window.parent.postMessage({
                            type: "CT_EAST_2_BG_INVENTORY_OBSERVED",
                            dialer: EDITION,
                            inventory: inventory,
                            count: filters.length,
                            observedAt: now
                        }, window.location.origin);
                    } else {
                        window.dispatchEvent(new CustomEvent("CT_EAST_2_INVENTORY_UPDATED", { detail: { count: filters.length, observedAt: now } }));
                        document.dispatchEvent(new CustomEvent("CT_EAST_2_INVENTORY_UPDATED", { detail: { count: filters.length, observedAt: now } }));
                    }
                } catch (e) {}
                return true;
            }
        } catch (e) {}
        return false;
    }

    function observeCampaignEditForm() {
        if (!window.CTParser || !window.CTParser.readCampaignEditForm) return false;
        try {
            const editData = window.CTParser.readCampaignEditForm(document);
            if (!editData) return false;

            const pathCidMatch = String(window.location.pathname || "").match(/\/manager\/campaigns\/edit\/([0-9]+)/i);
            if (pathCidMatch && editData.campaignId && String(editData.campaignId).trim() !== pathCidMatch[1]) {
                return false;
            }

            // Cache permitted dropdown filterId <-> filterName mapping AND sync full authoritative catalog into inventory
            const now = Date.now();
            if (Array.isArray(editData.filterCatalog) && editData.filterCatalog.length > 0) {
                try {
                    const idMap = {};
                    const catById = {};
                    const catByNorm = {};
                    editData.filterCatalog.forEach(function (f) {
                        if (f && f.filterId && f.name) {
                            const key = normFilterKey(f.name);
                            const fid = String(f.filterId).trim();
                            const entryMap = { filterId: fid, name: f.name, count: f.count, active: f.active !== false };
                            idMap[key] = entryMap;
                            catById[fid] = entryMap;
                            catByNorm[key] = entryMap;
                        }
                    });
                    localStorage.setItem(FILTER_ID_MAP_KEY, JSON.stringify(idMap));

                    const inv = JSON.parse(localStorage.getItem(LIVE_FILTERS_INVENTORY_KEY) || "{}");
                    if (!inv.items || typeof inv.items !== "object") inv.items = {};
                    let invUpdated = false;

                    // Migrate slug keys to numeric filter IDs and remove deleted filters absent from catalog + recent scan
                    Object.keys(inv.items).forEach(function (k) {
                        const item = inv.items[k];
                        if (!item || !item.name) {
                            delete inv.items[k];
                            invUpdated = true;
                            return;
                        }
                        const nKey = normFilterKey(item.name);
                        const catHit = catById[k] || catByNorm[nKey] || null;
                        if (!catHit) {
                            // Remove stale ghost filters that no longer exist in CallTools catalog
                            if ((now - (Number(item.observedAt) || 0)) > 15000) {
                                delete inv.items[k];
                                invUpdated = true;
                            }
                            return;
                        }
                        if (k !== catHit.filterId) {
                            if (!inv.items[catHit.filterId]) {
                                inv.items[catHit.filterId] = Object.assign({}, item, { id: catHit.filterId });
                            }
                            delete inv.items[k];
                            invUpdated = true;
                        }
                    });

                    // Sync active flags, live counts, and page-2 items from the full unpaginated CallTools <select> catalog
                    editData.filterCatalog.forEach(function (f) {
                        if (!f || !f.filterId || !f.name) return;
                        const fid = String(f.filterId).trim();
                        const existing = inv.items[fid];
                        const isLiveActive = f.active !== false;
                        const prevTotal = existing && existing.totalCount !== undefined && existing.totalCount !== null ? Number(existing.totalCount) : null;
                        const nextCount = isLiveActive ? (f.count !== null && f.count !== undefined ? Number(f.count) : (existing ? Number(existing.count) || 0 : 0)) : 0;
                        const prevObsAt = existing ? (Number(existing.observedAt) || 0) : 0;
                        const recentlyScannedOnPage1 = existing && existing.source === "LIVE_FILTERS_PAGE" && (now - prevObsAt) < 12000;
                        if (!existing || existing.active !== isLiveActive || (!recentlyScannedOnPage1 && (existing.count !== nextCount || (now - prevObsAt) >= 4000))) {
                            inv.items[fid] = {
                                id: fid,
                                name: f.name,
                                active: isLiveActive,
                                count: nextCount,
                                totalCount: recentlyScannedOnPage1 && prevTotal !== null ? prevTotal : (prevTotal !== null && prevTotal >= nextCount ? prevTotal : nextCount),
                                observedAt: recentlyScannedOnPage1 ? prevObsAt : now,
                                source: recentlyScannedOnPage1 ? "LIVE_FILTERS_PAGE" : "CAMPAIGN_EDIT_CATALOG"
                            };
                            invUpdated = true;
                        }
                    });

                    if (invUpdated) {
                        inv.totalCount = Object.keys(inv.items).length;
                        if (!inv.lastObservedAt) inv.lastObservedAt = now;
                        localStorage.setItem(LIVE_FILTERS_INVENTORY_KEY, JSON.stringify(inv));
                        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                            const objInv = {};
                            objInv[LIVE_FILTERS_INVENTORY_KEY] = inv;
                            chrome.storage.local.set(objInv);
                        }
                    }
                } catch (e) {}
            }

            // Skip transient mid-load state until campaign form has actually hydrated
            if (editData.status === "LOADING") return false;
            if (editData.campaignId && editData.campaignId !== "unknown" && (editData.liveFilter || editData.status === "NONE")) {
                const cid = String(editData.campaignId).trim();
                if (!cid || !/^[0-9]+$/.test(cid)) return false;

                const sig = [cid, editData.campaignName || "", editData.liveFilter || "", editData.filterId || "", editData.filterCount ?? "", editData.status || ""].join("|");
                const needEpochNotify = isBackgroundCampaignEditFrame() && editCompletedEpoch !== bgRouteEpoch;
                if (!needEpochNotify && sig === lastEditSig && (now - lastEditWriteAt) < 5000) {
                    return false;
                }

                let registry = {};
                try {
                    registry = JSON.parse(localStorage.getItem(VERIFIED_FILTERS_KEY) || "{}");
                } catch (e) {}

                // Clean registry of non-numeric or contaminated keys
                Object.keys(registry).forEach(function(k) {
                    if (!/^[0-9]+$/.test(k)) {
                        delete registry[k];
                    } else if (registry[k] && registry[k].liveFilter && (
                        String(registry[k].liveFilter).startsWith("Detected:") ||
                        String(registry[k].liveFilter).toLowerCase().includes("calltools operations") ||
                        String(registry[k].liveFilter).toLowerCase().includes("scheduled tasks")
                    )) {
                        delete registry[k];
                    }
                });

                const entry = {
                    campaignId: cid,
                    campaignName: editData.campaignName || "",
                    liveFilter: editData.liveFilter || null,
                    rawLiveFilter: editData.rawLiveFilter || null,
                    filterId: editData.filterId || null,
                    filterCount: editData.filterCount !== undefined ? editData.filterCount : null,
                    filterActive: editData.filterActive !== undefined ? editData.filterActive : true,
                    status: editData.status || (editData.liveFilter ? "ASSIGNED" : "NONE"),
                    source: "CAMPAIGN_EDIT_DOM",
                    timestamp: editData.timestamp || now
                };

                const existingReg = registry[cid];
                if (existingReg && existingReg.timestamp && Number(entry.timestamp || 0) < Number(existingReg.timestamp)) {
                    return false;
                }

                // STRICTLY KEY ONLY BY IMMUTABLE CAMPAIGN ID! NEVER BY NAME!
                registry[cid] = entry;
                lastEditSig = sig;
                lastEditWriteAt = now;
                editCompletedEpoch = bgRouteEpoch;

                try {
                    localStorage.setItem(VERIFIED_FILTERS_KEY, JSON.stringify(registry));
                    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                        const obj = {};
                        obj[VERIFIED_FILTERS_KEY] = registry;
                        chrome.storage.local.set(obj);
                    }
                    if (window.parent && window.parent !== window) {
                        window.parent.postMessage({
                            type: "CT_EAST_2_BG_FILTER_OBSERVED",
                            dialer: EDITION,
                            entry: entry,
                            catalogCount: Array.isArray(editData.filterCatalog) ? editData.filterCatalog.length : 0
                        }, window.location.origin);
                    } else {
                        window.dispatchEvent(new CustomEvent("CT_EAST_2_VERIFIED_FILTER_CHANGED", { detail: entry }));
                        document.dispatchEvent(new CustomEvent("CT_EAST_2_VERIFIED_FILTER_CHANGED", { detail: entry }));
                    }
                } catch (e) {}
                return true;
            }
        } catch (e) {}
        return false;
    }
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
        if (!isTopLevelCampaignsPage()) return;
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

    function ensureOffscreenIframe(frameId, title) {
        let frame = document.getElementById(frameId);
        if (frame && frame.tagName !== "IFRAME") {
            try { frame.remove(); } catch (e) {}
            frame = null;
        }
        if (!frame) {
            frame = document.createElement("iframe");
            frame.id = frameId;
            frame.title = title;
            frame.setAttribute("aria-hidden", "true");
            frame.tabIndex = -1;
            frame.style.cssText = "position:fixed;left:-20000px;top:-20000px;width:1024px;height:700px;border:0;opacity:0;pointer-events:none;";
            frame.addEventListener("load", function () {
                try {
                    const p = String(frame.contentWindow.location.pathname || "");
                    if (/\/(login|signin)(?:\/|$)/i.test(p)) {
                        lfAuthPaused = true;
                        lfSpaBooted = false;
                        lfProbeInFlight = null;
                        lfInvInFlightStartedAt = 0;
                    }
                } catch (e) {}
            });
            document.documentElement.appendChild(frame);
        }
        return frame;
    }

    function teardownLiveFilterMonitors() {
        [LF_INVENTORY_IFRAME_ID, LF_EDIT_IFRAME_ID].forEach(function (id) {
            const el = document.getElementById(id);
            if (el) {
                try { el.remove(); } catch (e) {}
            }
        });
        lfSpaBooted = false;
        lfSpaLastCompletedKind = "";
        lfProbeInFlight = null;
        lfInvInFlightStartedAt = 0;
    }

    function collectProbeCampaignTargets() {
        const byId = new Map();
        const opIds = new Set();
        try {
            const rawOp = JSON.parse(localStorage.getItem("ct_east2_operating_campaigns") || "[]");
            if (Array.isArray(rawOp)) {
                rawOp.forEach(function (v) {
                    const s = String(v || "").trim();
                    if (/^[0-9]+$/.test(s)) opIds.add(s);
                });
            }
        } catch (e) {}

        // 1. Live Angular row index exported passively by ng_bridge.js (dialer-scoped attribute)
        try {
            const rawIdx = document.documentElement
                ? (document.documentElement.getAttribute("data-ct-east2-campaign-index") || document.documentElement.getAttribute("data-ct-campaign-index"))
                : "";
            if (rawIdx) {
                const arr = JSON.parse(rawIdx);
                if (Array.isArray(arr)) {
                    arr.forEach(function (item) {
                        if (item && item.dialer && item.dialer !== EDITION) return;
                        const cid = item && item.id ? String(item.id).trim() : "";
                        if (/^[0-9]+$/.test(cid)) {
                            byId.set(cid, {
                                id: cid,
                                name: String(item.name || "").trim(),
                                active: item.active === true,
                                operating: opIds.has(cid)
                            });
                        }
                    });
                }
            }
        } catch (e) {}

        // 2. Parsed native campaigns table rows
        try {
            if (window.CTParser && window.CTParser.readCampaigns) {
                const parsed = window.CTParser.readCampaigns() || [];
                parsed.forEach(function (c) {
                    const cid = String((c && (c.rawId || c.id)) || "").trim();
                    if (/^[0-9]+$/.test(cid)) {
                        const prev = byId.get(cid) || { id: cid, name: c.name || "", active: false, operating: opIds.has(cid) };
                        byId.set(cid, {
                            id: cid,
                            name: c.name || prev.name,
                            active: c.active === true || prev.active,
                            operating: opIds.has(cid) || prev.operating
                        });
                    }
                });
            }
        } catch (e) {}

        // 3. Previously observed verified registry keys
        try {
            const reg = JSON.parse(localStorage.getItem(VERIFIED_FILTERS_KEY) || "{}");
            Object.keys(reg).forEach(function (k) {
                if (/^[0-9]+$/.test(k) && !byId.has(k)) {
                    byId.set(k, {
                        id: k,
                        name: (reg[k] && reg[k].campaignName) || "",
                        active: false,
                        operating: opIds.has(k)
                    });
                }
            });
        } catch (e) {}

        // 4. Explicit operating IDs
        opIds.forEach(function (cid) {
            if (!byId.has(cid)) {
                byId.set(cid, { id: cid, name: "", active: false, operating: true });
            }
        });

        return Array.from(byId.values());
    }

    function pickNextCampaignToProbe(targets, now, forceNow) {
        if (!targets.length) return null;
        let regMap = {};
        try { regMap = JSON.parse(localStorage.getItem(VERIFIED_FILTERS_KEY) || "{}"); } catch (e) {}
        const lastObservedTs = function (cid) {
            const mem = lfLastProbeByCid[cid] || 0;
            if (mem > 0) return mem;
            const regEntry = regMap && regMap[cid];
            const regTs = regEntry && Number(regEntry.timestamp);
            return Number.isFinite(regTs) && regTs > 0 ? regTs : 0;
        };
        const priorityTargets = targets.filter(function (t) { return Boolean(t.operating || t.active); });
        const standbyTargets = targets.filter(function (t) { return !(t.operating || t.active); });

        // Priority Tier 1: ALWAYS keep Operating & Active campaigns fresh (<120s TTL) before probing standby/inactive ones.
        // Guard against operating campaign starvation so sibling active campaigns rotate cleanly before approaching 120s staleness.
        const duePriority = priorityTargets.filter(function (t) {
            const ts = lastObservedTs(t.id);
            return !ts || forceNow || (now - ts) >= LF_ACTIVE_PROBE_MS;
        }).sort(function (a, b) {
            const aTs = lastObservedTs(a.id);
            const bTs = lastObservedTs(b.id);
            const aUrgent = !aTs || (now - aTs) >= 45000;
            const bUrgent = !bTs || (now - bTs) >= 45000;
            if (aUrgent !== bUrgent) return aUrgent ? -1 : 1;
            if (!aUrgent && Boolean(a.operating) !== Boolean(b.operating)) return a.operating ? -1 : 1;
            if (aTs !== bTs) return aTs - bTs;
            return (a.operating ? 0 : 1) - (b.operating ? 0 : 1);
        });
        if (duePriority.length > 0) return duePriority[0];

        // Priority Tier 2: Probe oldest due Standby/Inactive campaign ONLY when all Operating & Active campaigns are fresh
        const dueStandby = standbyTargets.filter(function (t) {
            const ts = lastObservedTs(t.id);
            return !ts || forceNow || (now - ts) >= LF_IDLE_PROBE_MS;
        }).sort(function (a, b) {
            return lastObservedTs(a.id) - lastObservedTs(b.id);
        });
        if (dueStandby.length > 0) return dueStandby[0];

        return null;
    }

    function dispatchBgSpaStep(frame, routePath, kind, cid, forceHardReload) {
        const now = Date.now();
        lfProbeInFlight = { kind: kind, cid: cid || null, startedAt: now };
        if (kind === "live_filters") lfInvInFlightStartedAt = now;

        let usedSpa = false;
        if (!forceHardReload && lfSpaBooted && lfConsecutiveTimeouts === 0) {
            try {
                const fw = frame.contentWindow;
                const fwPath = fw && fw.location && fw.location.pathname ? String(fw.location.pathname) : "";
                if (fw && fw.history && fwPath && !/\/(login|signin)(?:\/|$)/i.test(fwPath)) {
                    fw.history.pushState(null, "", routePath);
                    const PopCtor = fw.PopStateEvent || PopStateEvent;
                    fw.dispatchEvent(new PopCtor("popstate", { state: null }));
                    usedSpa = true;
                }
            } catch (e) {
                usedSpa = false;
            }
        }
        if (!usedSpa) {
            lfSpaBooted = false;
            const sep = routePath.includes("?") ? "&" : "?";
            frame.src = "https://" + TARGET_HOST + routePath + sep + "ct_ts=" + now;
        }
    }

    function coordinateLiveFilterMonitors(forceNow) {
        if (!isTopLevelCampaignsPage()) {
            teardownLiveFilterMonitors();
            return;
        }
        if (lfAuthPaused) return;

        // Clean up any stale second iframe from prior releases
        const legacyInv = document.getElementById(LF_INVENTORY_IFRAME_ID);
        if (legacyInv) {
            try { legacyInv.remove(); } catch (e) {}
        }

        const now = Date.now();
        if (lfProbeInFlight) {
            if ((now - lfProbeInFlight.startedAt) < LF_PROBE_TIMEOUT_MS) return;
            // Timed out; record failure recovery with short retry backoff and force hard reload fallback
            lfConsecutiveTimeouts++;
            lfSpaBooted = false;
            if (lfProbeInFlight.cid) {
                lfLastProbeByCid[lfProbeInFlight.cid] = now - LF_IDLE_PROBE_MS + 3500;
            }
            if (lfProbeInFlight.kind === "live_filters") lfInvInFlightStartedAt = 0;
            lfLastProbeCompletedAt = now;
            lfSpaLastCompletedKind = lfProbeInFlight.kind;
            lfProbeInFlight = null;
        }

        const frame = ensureOffscreenIframe(LF_EDIT_IFRAME_ID, "CT Operations Monitor Unified Live Filter SPA feed");
        const targets = collectProbeCampaignTargets();

        // Priority Manual Refresh pipeline: campaigns -> live_filters -> active/operating campaign_edit
        if (manualRefreshSession && !manualRefreshSession.done) {
            if (manualRefreshSession.needCampaigns && !manualRefreshSession.doneCampaigns) {
                dispatchBgSpaStep(
                    frame,
                    "/manager/campaigns?" + LF_MONITOR_PARAM + "=1&ct_lf_owner=ctompro_east2",
                    "campaigns",
                    null,
                    !lfSpaBooted || lfConsecutiveTimeouts > 0 || lfSpaLastCompletedKind === "campaigns"
                );
                return;
            }
            if (manualRefreshSession.needInventory && !manualRefreshSession.doneInventory) {
                dispatchBgSpaStep(
                    frame,
                    "/manager/live-filters?" + LF_MONITOR_PARAM + "=1&ct_lf_owner=ctompro_east2",
                    "live_filters",
                    null,
                    !lfSpaBooted || lfConsecutiveTimeouts > 0 || lfSpaLastCompletedKind === "live_filters"
                );
                return;
            }
            if (manualRefreshSession.needEdit && !manualRefreshSession.doneEdit) {
                const editCid = manualRefreshSession.editCid || (targets[0] && targets[0].id);
                if (editCid) {
                    dispatchBgSpaStep(
                        frame,
                        "/manager/campaigns/edit/" + encodeURIComponent(editCid) + "?" + LF_MONITOR_PARAM + "=1&ct_lf_owner=ctompro_east2",
                        "campaign_edit",
                        editCid,
                        !lfSpaBooted || lfConsecutiveTimeouts > 0 || lfSpaLastCompletedKind === "campaign_edit"
                    );
                    return;
                }
                manualRefreshSession.doneEdit = true;
            }
        }

        if (!forceNow && lfLastProbeCompletedAt && (now - lfLastProbeCompletedAt) < LF_BETWEEN_PROBES_MS) {
            return;
        }

        // Always alternate clean component routes: live_filters <-> campaign_edit
        // This forces Angular to destroy & recreate CampaignEditComponent cleanly with zero cross-campaign leak.
        const needInitialBootOrInv = !lfSpaBooted || !lfInvLastCompletedAt;
        const canRunEdit = targets.length > 0 && lfSpaLastCompletedKind !== "campaign_edit";

        if (!needInitialBootOrInv && canRunEdit) {
            const nextCamp = pickNextCampaignToProbe(targets, now, Boolean(forceNow));
            if (nextCamp) {
                dispatchBgSpaStep(
                    frame,
                    "/manager/campaigns/edit/" + encodeURIComponent(nextCamp.id) + "?" + LF_MONITOR_PARAM + "=1&ct_lf_owner=ctompro_east2",
                    "campaign_edit",
                    nextCamp.id,
                    false
                );
                return;
            }
        }

        const invDue = needInitialBootOrInv || Boolean(forceNow) || (lfSpaLastCompletedKind !== "live_filters" && (!lfInvLastCompletedAt || (now - lfInvLastCompletedAt) >= LF_INVENTORY_REFRESH_MS));
        if (invDue) {
            dispatchBgSpaStep(
                frame,
                "/manager/live-filters?" + LF_MONITOR_PARAM + "=1&ct_lf_owner=ctompro_east2",
                "live_filters",
                null,
                lfConsecutiveTimeouts > 0 || !lfSpaBooted
            );
            return;
        }

        // If inventory isn't due yet, check if an edit probe is due via clean alternation
        const fallbackCamp = pickNextCampaignToProbe(targets, now, Boolean(forceNow));
        if (fallbackCamp && lfSpaLastCompletedKind !== "campaign_edit") {
            dispatchBgSpaStep(
                frame,
                "/manager/campaigns/edit/" + encodeURIComponent(fallbackCamp.id) + "?" + LF_MONITOR_PARAM + "=1&ct_lf_owner=ctompro_east2",
                "campaign_edit",
                fallbackCamp.id,
                false
            );
        }
    }

    function requestInboundIframeRefresh(forceReload) {
        if (!isCampaignsPage()) return;
        ensureInboundFeedMonitor();
        const frame = document.getElementById(INBOUND_IFRAME_ID);
        if (!frame) return;
        if (forceReload) {
            try {
                inboundIframeReady = false;
                frame.src = INBOUND_IFRAME_URL + "&ct_ts=" + Date.now();
                return;
            } catch (error) {}
        }
        if (!frame.contentWindow) return;
        try {
            frame.contentWindow.postMessage({ type: "CT_EAST_2_REFRESH_INBOUND_FEED", dialer: EDITION, manual: Boolean(forceReload) }, window.location.origin);
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
                c.liveFilter || "",
                c.liveFilterId || "",
                c.liveFilterCount ?? ""
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
    let tableMissingStreak = 0;

    function publish(campaigns, meta, queues) {
        document.dispatchEvent(new CustomEvent("CT_EAST_2_UPDATE", {
            detail: {
                dialer: EDITION,
                targetHost: TARGET_HOST,
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
                dialer: EDITION,
                targetHost: TARGET_HOST,
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
                if (isBackgroundCampaignsFrame()) {
                    if (tableReady(campaigns) && window.parent && window.parent !== window) {
                        const sig = snapshotKey(campaigns);
                        const needNotify = bgCampCompletedEpoch !== bgRouteEpoch || sig !== lastSnapshot;
                        if (needNotify) {
                            lastSnapshot = sig;
                            lastDataChangeAt = now;
                            bgCampCompletedEpoch = bgRouteEpoch;
                            try {
                                window.parent.postMessage({
                                    type: "CT_EAST_2_BG_CAMPAIGNS_OBSERVED",
                                    dialer: EDITION,
                                    campaigns: campaigns,
                                    observedAt: now,
                                    count: campaigns.length
                                }, window.location.origin);
                            } catch (e) {}
                        }
                    }
                    return;
                }
                if (!tableReady(campaigns)) {
                    const missingNow = !tableNode && !isPageLoading;
                    tableMissingStreak = missingNow ? (tableMissingStreak + 1) : 0;
                    const tableMissing = missingNow && tableMissingStreak >= 6;
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
                tableMissingStreak = 0;
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

            if (route === "campaign_edit") {
                observeCampaignEditForm();
                return;
            }
            if (route === "live_filters") {
                observeLiveFiltersPage();
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
                manualRefresh: reason === "manual-inbound-refresh-check" || reason === "initial",
                status: "LIVE",
                reason: queueChanged ? (reason || "queue-data-change") : (forcePublish ? (reason || "manual-queue-refresh") : "queue-poll-heartbeat"),
                rowCount: queues.length,
                unverifiedCount: 0
            }, queues);

            if (isInboundMonitorFrame() && window.parent && window.parent !== window && (forcePublish || queueChanged || reason === "initial" || String(reason || "").indexOf("mount-settle") === 0)) {
                try {
                    window.parent.postMessage({
                        type: "CT_EAST_2_BG_INBOUND_OBSERVED",
                        dialer: EDITION,
                        count: queues.length,
                        queues: queues,
                        observedAt: now,
                        reason: reason || "queue-poll"
                    }, window.location.origin);
                } catch (e) {}
            }

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
        if (isTopLevelCampaignsPage()) {
            if (now - lastInboundCoordinationAt >= INBOUND_COORDINATION_MS) {
                lastInboundCoordinationAt = now;
                ensureInboundFeedMonitor();
                requestInboundIframeRefresh();
            }
            if (now - lastInboundHeartbeatAt >= INBOUND_HEARTBEAT_MS) inspectInboundIframeAuth();
            coordinateLiveFilterMonitors(false);
        } else if (isCampaignsPage()) {
            teardownInboundIframe();
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
        const dashboard = document.getElementById("ct-operations-dashboard-east2");
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
        const dashboard = document.getElementById("ct-operations-dashboard-east2");
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
            if (isCampaignEditPage()) {
                observeCampaignEditForm();
                return;
            }
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

    let fastBgRetryTimer = null;
    function scheduleBackgroundFastPoll() {
        if (!isBackgroundCampaignEditFrame() && !isBackgroundLiveFiltersFrame() && !isBackgroundCampaignsFrame()) return;
        let ticks = 0;
        const epoch = bgRouteEpoch;
        if (fastBgRetryTimer) window.clearInterval(fastBgRetryTimer);
        fastBgRetryTimer = window.setInterval(function () {
            ticks++;
            if (epoch !== bgRouteEpoch) {
                window.clearInterval(fastBgRetryTimer);
                fastBgRetryTimer = null;
                return;
            }
            if (isBackgroundCampaignEditFrame()) {
                observeCampaignEditForm();
                if (editCompletedEpoch === epoch || ticks >= 45) {
                    window.clearInterval(fastBgRetryTimer);
                    fastBgRetryTimer = null;
                }
            } else if (isBackgroundLiveFiltersFrame()) {
                observeLiveFiltersPage();
                if (invCompletedEpoch === epoch || ticks >= 45) {
                    window.clearInterval(fastBgRetryTimer);
                    fastBgRetryTimer = null;
                }
            } else if (isBackgroundCampaignsFrame()) {
                readAndPublish("bg-campaigns-fast-poll", true);
                if (bgCampCompletedEpoch === epoch || ticks >= 45) {
                    window.clearInterval(fastBgRetryTimer);
                    fastBgRetryTimer = null;
                }
            } else {
                window.clearInterval(fastBgRetryTimer);
                fastBgRetryTimer = null;
            }
        }, 200);
    }

    function cleanup() {
        if (intervalId) window.clearInterval(intervalId);
        if (observerTimer) window.clearTimeout(observerTimer);
        if (refreshVerificationTimer) window.clearTimeout(refreshVerificationTimer);
        if (fastBgRetryTimer) window.clearInterval(fastBgRetryTimer);
        if (observer) observer.disconnect();
        intervalId = null;
        observerTimer = null;
        refreshVerificationTimer = null;
        fastBgRetryTimer = null;
        observer = null;
    }

    function init() {
        cleanup();
        if (!isMonitorPage()) return;

        window.__CTOperationsFeedCleanup_EAST2 = cleanup;
        // Proactive interactive edit form event tracking (SPA-safe: checks route on event)
        if (!window.__CT_EDIT_EVENTS_ATTACHED_EAST2) {
            window.__CT_EDIT_EVENTS_ATTACHED_EAST2 = true;
            ['change', 'input', 'click', 'blur'].forEach(function(evType) {
                document.addEventListener(evType, function() {
                    if (!isCampaignEditPage()) return;
                    [20, 80, 200, 450, 900].forEach(function(delay) {
                        window.setTimeout(observeCampaignEditForm, delay);
                    });
                }, true);
            });
        }
        installObserver();
        if (isTopLevelCampaignsPage()) {
            lastInboundCoordinationAt = Date.now();
            ensureInboundFeedMonitor();
            window.setTimeout(function () { coordinateLiveFilterMonitors(false); }, 600);
        } else if (isQueuesPage()) {
            teardownInboundIframe();
            teardownLiveFilterMonitors();
        } else if (isCampaignEditPage()) {
            observeCampaignEditForm();
            scheduleBackgroundFastPoll();
        } else if (isLiveFiltersPage()) {
            observeLiveFiltersPage();
            scheduleBackgroundFastPoll();
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
                if (isCampaignEditPage()) {
                    observeCampaignEditForm();
                } else if (isCampaignsPage()) {
                    readAndPublish("tab-visibility-recovery", true);
                }
            }
        });

        // Intercept Angular SPA Navigation
        (function interceptSpa() {
            if (window.__CT_SPA_INTERCEPTED_EAST2) return;
            window.__CT_SPA_INTERCEPTED_EAST2 = true;
            const pushStateOrig = history.pushState;
            const replaceStateOrig = history.replaceState;
            function onRouteTransition() {
                bgRouteEpoch++;
                invCompletedEpoch = -1;
                editCompletedEpoch = -1;
                bgCampCompletedEpoch = -1;
                lastEditSig = "";
                lastEditWriteAt = 0;
                lastInvSig = "";
                lastInvWriteAt = 0;
                const myEpoch = bgRouteEpoch;
                window.setTimeout(function () {
                    if (myEpoch !== bgRouteEpoch) return;
                    if (isCampaignEditPage()) {
                        observeCampaignEditForm();
                        scheduleBackgroundFastPoll();
                    } else if (isLiveFiltersPage()) {
                        observeLiveFiltersPage();
                        scheduleBackgroundFastPoll();
                    } else if (isCampaignsPage()) {
                        readAndPublish("spa-navigation", isBackgroundCampaignsFrame());
                        if (isBackgroundCampaignsFrame()) scheduleBackgroundFastPoll();
                    }
                }, 180);
            }
            history.pushState = function () {
                const res = pushStateOrig.apply(this, arguments);
                onRouteTransition();
                return res;
            };
            history.replaceState = function () {
                const res = replaceStateOrig.apply(this, arguments);
                onRouteTransition();
                return res;
            };
            window.addEventListener("popstate", onRouteTransition);
        })();

        // Cross-tab immediate storage sync
        window.addEventListener("storage", function (e) {
            if ((e.key === VERIFIED_FILTERS_KEY || e.key === LIVE_FILTERS_INVENTORY_KEY) && isCampaignsPage()) {
                readAndPublish("storage-sync-verified-filter", true);
            }
        });
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener(function (changes) {
                if (changes && (changes[VERIFIED_FILTERS_KEY] || changes[LIVE_FILTERS_INVENTORY_KEY]) && isCampaignsPage()) {
                    readAndPublish("chrome-storage-verified-filter", true);
                }
            });
        }
        intervalId = window.setInterval(poll, POLL_MS);
    }

    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener(function (message) {
            if (!message || message.type !== "CT_EAST_2_REFRESH_INBOUND_FEED" || !isQueuesPage()) return;
            lastSourceRefreshAt = Date.now();
            publishFeedStatus("VERIFYING", { reason: "Inbound feed re-check requested from Operations Monitor", route: "queues" });
            readAndPublish("manual-inbound-refresh-check", true);
        });
    }

    function finalizeManualRefreshSession(timedOut) {
        const s = manualRefreshSession;
        if (!s || s.done) return;
        s.done = true;
        if (s.timer) {
            try { window.clearTimeout(s.timer); } catch (e) {}
            s.timer = null;
        }
        const completedAt = Date.now();
        const unavailableSources = [];
        if (s.needCampaigns && !s.doneCampaigns) unavailableSources.push("Campaigns Table");
        if (s.needInventory && !s.doneInventory) unavailableSources.push("Live Filter Inventory");
        if (s.needEdit && !s.doneEdit) unavailableSources.push("Campaign Edit Filter DOM");
        if (s.needInbound && !s.doneInbound) unavailableSources.push("Inbound Queues");

        const anySucceeded = Boolean(s.doneCampaigns || s.doneInventory || s.doneEdit || s.doneInbound);
        const result = unavailableSources.length === 0 ? "SUCCESS" : (anySucceeded ? "PARTIAL" : "FAILED");
        const totalRecords = Number(s.counts.campaigns || 0) + Number(s.counts.filters || 0) + Number(s.counts.queues || 0);

        const detail = {
            refreshId: s.id,
            requestAt: s.startedAt,
            completedAt: completedAt,
            elapsedMs: Math.max(0, completedAt - s.startedAt),
            timedOut: Boolean(timedOut),
            source: "CallTools (Campaigns · Live Filters · Edit DOM · Queues)",
            result: result,
            recordsRead: totalRecords,
            failureReason: unavailableSources.length ? ("Timed out waiting for: " + unavailableSources.join(", ")) : null,
            unavailableSources: unavailableSources,
            sourceDetails: {
                campaigns: { status: s.doneCampaigns ? "SUCCESS" : "TIMEOUT", count: s.counts.campaigns || 0 },
                liveFilters: { status: s.doneInventory ? "SUCCESS" : "TIMEOUT", count: s.counts.filters || 0 },
                campaignEdit: { status: s.doneEdit ? "SUCCESS" : (s.needEdit ? "TIMEOUT" : "SKIPPED"), campaignId: s.editCid || null },
                inboundQueues: { status: s.doneInbound ? "SUCCESS" : "TIMEOUT", count: s.counts.queues || 0 }
            }
        };
        manualRefreshSession = null;
        document.dispatchEvent(new CustomEvent("CT_EAST_2_REFRESH_RESULT", { detail: detail }));
        window.setTimeout(function () { coordinateLiveFilterMonitors(false); }, 150);
    }

    function maybeCompleteManualRefreshSession() {
        const s = manualRefreshSession;
        if (!s || s.done) return;
        const allDone = (!s.needCampaigns || s.doneCampaigns) &&
                        (!s.needInventory || s.doneInventory) &&
                        (!s.needEdit || s.doneEdit) &&
                        (!s.needInbound || s.doneInbound);
        if (allDone) {
            finalizeManualRefreshSession(false);
        }
    }

    window.addEventListener("message", function (event) {
        if (event.origin !== window.location.origin || !event.data) return;
        if (window.location.hostname && window.location.hostname !== TARGET_HOST) return;
        if (event.data.dialer && event.data.dialer !== EDITION) return;
        if (isTopLevelCampaignsPage() && event.data.type === "CT_EAST_2_BG_CAMPAIGNS_OBSERVED" && Array.isArray(event.data.campaigns)) {
            const now = Date.now();
            const incoming = event.data.campaigns;
            const targets = collectProbeCampaignTargets();
            const idByName = new Map();
            targets.forEach(function (t) {
                if (t.name && t.id) idByName.set(String(t.name).trim().toLowerCase(), String(t.id));
            });
            const merged = incoming.map(function (c) {
                const copy = Object.assign({}, c);
                if (!copy.rawId && copy.name) {
                    const mId = idByName.get(String(copy.name).trim().toLowerCase());
                    if (mId) {
                        copy.rawId = mId;
                        copy.id = mId;
                    }
                }
                return copy;
            });
            lfAuthPaused = false;
            lfSpaBooted = true;
            lfConsecutiveTimeouts = 0;
            lfSpaLastCompletedKind = "campaigns";
            if (lfProbeInFlight && lfProbeInFlight.kind === "campaigns") {
                lfProbeInFlight = null;
                lfLastProbeCompletedAt = now;
            }
            if (merged.length > 0) {
                lastSnapshot = snapshotKey(merged);
                lastDataChangeAt = now;
                hasPublishedData = true;
                const unverified = merged.filter(function (c) { return c.active !== true && c.active !== false; }).length;
                publish(merged, {
                    sourceUpdatedAt: now,
                    dataChangedAt: now,
                    observationAt: now,
                    changed: true,
                    manualRefresh: true,
                    verifiedFromServer: true,
                    status: unverified ? "DATA CHECK" : "LIVE",
                    reason: "manual-bg-campaigns-refresh",
                    rowCount: merged.length,
                    unverifiedCount: unverified
                }, []);
                publishFeedStatus(unverified ? "DATA CHECK" : "LIVE", {
                    reason: "Fresh CallTools campaign data received",
                    rowCount: merged.length,
                    unverifiedCount: unverified,
                    route: "campaigns",
                    lastCheckAt: now
                });
            }
            if (manualRefreshSession && !manualRefreshSession.done) {
                manualRefreshSession.doneCampaigns = true;
                manualRefreshSession.counts.campaigns = merged.length;
                maybeCompleteManualRefreshSession();
                if (manualRefreshSession && !manualRefreshSession.done) {
                    window.setTimeout(function () { coordinateLiveFilterMonitors(true); }, 120);
                }
                return;
            }
            window.setTimeout(function () { coordinateLiveFilterMonitors(false); }, LF_BETWEEN_PROBES_MS);
            return;
        }
        if (isTopLevelCampaignsPage() && event.data.type === "CT_EAST_2_BG_FILTER_OBSERVED" && event.data.entry) {
            const entry = event.data.entry;
            const now = Date.now();
            // Reject stale pre-transition edit payloads whose campaignId/name disagrees with active probe
            if (lfProbeInFlight && lfProbeInFlight.kind === "campaign_edit" && lfProbeInFlight.cid) {
                if (String(entry.campaignId) !== String(lfProbeInFlight.cid)) {
                    return;
                }
                const targetObj = collectProbeCampaignTargets().find(function (t) { return String(t.id) === String(lfProbeInFlight.cid); });
                if (targetObj && targetObj.name && entry.campaignName &&
                    String(entry.campaignName).trim().toLowerCase() !== String(targetObj.name).trim().toLowerCase()) {
                    return;
                }
            }
            lfAuthPaused = false;
            lfSpaBooted = true;
            lfConsecutiveTimeouts = 0;
            lfSpaLastCompletedKind = "campaign_edit";
            if (entry.campaignId) {
                lfLastProbeByCid[String(entry.campaignId)] = now;
                if (lfProbeInFlight && (!lfProbeInFlight.cid || String(lfProbeInFlight.cid) === String(entry.campaignId))) {
                    lfProbeInFlight = null;
                    lfLastProbeCompletedAt = now;
                }
            }
            readAndPublish("bg-filter-observed", true);
            window.dispatchEvent(new CustomEvent("CT_EAST_2_VERIFIED_FILTER_CHANGED", { detail: entry }));
            document.dispatchEvent(new CustomEvent("CT_EAST_2_VERIFIED_FILTER_CHANGED", { detail: entry }));
            if (manualRefreshSession && !manualRefreshSession.done) {
                if (!manualRefreshSession.editCid || String(entry.campaignId) === String(manualRefreshSession.editCid)) {
                    manualRefreshSession.doneEdit = true;
                }
                maybeCompleteManualRefreshSession();
                if (manualRefreshSession && !manualRefreshSession.done) {
                    window.setTimeout(function () { coordinateLiveFilterMonitors(true); }, 120);
                }
                return;
            }
            window.setTimeout(function () { coordinateLiveFilterMonitors(false); }, LF_BETWEEN_PROBES_MS + 50);
            return;
        }
        if (isTopLevelCampaignsPage() && event.data.type === "CT_EAST_2_BG_INVENTORY_OBSERVED") {
            const now = Date.now();
            lfAuthPaused = false;
            lfSpaBooted = true;
            lfConsecutiveTimeouts = 0;
            lfSpaLastCompletedKind = "live_filters";
            lfInvInFlightStartedAt = 0;
            lfInvLastCompletedAt = now;
            if (lfProbeInFlight && lfProbeInFlight.kind === "live_filters") {
                lfProbeInFlight = null;
                lfLastProbeCompletedAt = now;
            }
            readAndPublish("bg-inventory-observed", true);
            window.dispatchEvent(new CustomEvent("CT_EAST_2_INVENTORY_UPDATED", { detail: { count: event.data.count || 0, observedAt: event.data.observedAt || now } }));
            document.dispatchEvent(new CustomEvent("CT_EAST_2_INVENTORY_UPDATED", { detail: { count: event.data.count || 0, observedAt: event.data.observedAt || now } }));
            if (manualRefreshSession && !manualRefreshSession.done) {
                manualRefreshSession.doneInventory = true;
                manualRefreshSession.counts.filters = event.data.count || 0;
                maybeCompleteManualRefreshSession();
                if (manualRefreshSession && !manualRefreshSession.done) {
                    window.setTimeout(function () { coordinateLiveFilterMonitors(true); }, 120);
                }
                return;
            }
            window.setTimeout(function () { coordinateLiveFilterMonitors(false); }, LF_BETWEEN_PROBES_MS + 50);
            return;
        }
        if (isTopLevelCampaignsPage() && event.data.type === "CT_EAST_2_BG_INBOUND_OBSERVED") {
            const now = Date.now();
            lastInboundHeartbeatAt = now;
            if (manualRefreshSession && !manualRefreshSession.done) {
                manualRefreshSession.doneInbound = true;
                manualRefreshSession.counts.queues = Number(event.data.count) || 0;
                maybeCompleteManualRefreshSession();
            }
            return;
        }
        if (!isInboundMonitorFrame()) return;
        if (event.data.type !== "CT_EAST_2_REFRESH_INBOUND_FEED") return;
        lastSourceRefreshAt = Date.now();
        publishFeedStatus("VERIFYING", { reason: "Inbound feed re-check requested from Operations Monitor", route: "queues" });
        readAndPublish("manual-inbound-refresh-check", true);
    });

    document.addEventListener("CT_EAST_2_REQUEST_INBOUND_REFRESH", function (ev) {
        if (isQueuesPage()) {
            lastSourceRefreshAt = Date.now();
            publishFeedStatus("VERIFYING", { reason: "Manual inbound feed re-check requested", route: "queues" });
            readAndPublish("manual-inbound-refresh-check", true);
            return;
        }
        const forceReload = Boolean(ev && ev.detail && ev.detail.forceReload);
        requestInboundIframeRefresh(forceReload);
    });

    document.addEventListener("CT_EAST_2_REQUEST_REFRESH", function (ev) {
        const now = Date.now();
        const route = currentRoute();
        const isManual = Boolean(ev && ev.detail && (ev.detail.manual === true || (ev.detail.refreshId && !ev.detail.background)));

        if (!isManual) {
            if (route === "campaigns" && isTopLevelCampaignsPage()) {
                readAndPublish("scheduler-heartbeat", false);
                requestInboundIframeRefresh(false);
                coordinateLiveFilterMonitors(false);
            } else if (route === "live_filters") {
                observeLiveFiltersPage();
            } else if (route === "campaign_edit") {
                observeCampaignEditForm();
            } else if (route === "queues") {
                readAndPublish("scheduler-queue-poll", false);
            }
            return;
        }

        lastSourceRefreshAt = now;
        const refreshId = ev && ev.detail && ev.detail.refreshId ? ev.detail.refreshId : now;

        if (route === "campaigns" && isTopLevelCampaignsPage()) {
            publishFeedStatus("VERIFYING", { reason: "Refreshing CallTools Campaigns, Live Filters, Edit DOM, and Inbound Queues…", route: "campaigns" });
            if (manualRefreshSession && manualRefreshSession.timer) {
                try { window.clearTimeout(manualRefreshSession.timer); } catch (e) {}
            }
            const targets = collectProbeCampaignTargets();
            const priorityTarget = targets.find(function (t) { return t.operating; }) || targets.find(function (t) { return t.active; }) || targets[0] || null;
            manualRefreshSession = {
                id: refreshId,
                startedAt: now,
                needCampaigns: true,
                needInventory: true,
                needEdit: Boolean(priorityTarget),
                needInbound: true,
                editCid: priorityTarget ? String(priorityTarget.id) : null,
                doneCampaigns: false,
                doneInventory: false,
                doneEdit: !priorityTarget,
                doneInbound: false,
                counts: { campaigns: 0, filters: 0, queues: 0 },
                done: false,
                timer: window.setTimeout(function () { finalizeManualRefreshSession(true); }, MANUAL_REFRESH_TIMEOUT_MS)
            };
            lfAuthPaused = false;
            lfProbeInFlight = null;
            lfLastProbeCompletedAt = 0;
            lastInvSig = "";
            lastInvWriteAt = 0;
            lastEditSig = "";
            lastEditWriteAt = 0;
            invCompletedEpoch = -1;
            editCompletedEpoch = -1;
            bgCampCompletedEpoch = -1;

            requestInboundIframeRefresh(true);
            coordinateLiveFilterMonitors(true);
            return;
        }

        let recordsRead = 0;
        let result = "SUCCESS";
        let failureReason = null;
        let unavailableSources = [];
        const sourceDetails = {};
        if (route === "campaigns") {
            readAndPublish("manual-campaign-refresh", true);
            const campaigns = window.CTParser && window.CTParser.readCampaigns ? window.CTParser.readCampaigns() : [];
            recordsRead = campaigns.length;
            sourceDetails.campaigns = { status: campaigns.length > 0 ? "SUCCESS" : "EMPTY", count: campaigns.length, timestamp: now };
        } else if (route === "live_filters") {
            observeLiveFiltersPage();
            const filters = window.CTParser && window.CTParser.readLiveFilters ? window.CTParser.readLiveFilters(document) : [];
            recordsRead = filters.length;
            sourceDetails.liveFilters = { status: filters.length > 0 ? "SUCCESS" : "EMPTY", count: filters.length, timestamp: now };
            unavailableSources = ["Campaigns Table (requires navigation to /manager/campaigns)"];
        } else if (route === "queues") {
            publishFeedStatus("VERIFYING", { reason: "Manual queue feed re-check requested", route: "queues" });
            readAndPublish("manual-queue-refresh-check", true);
            const queues = window.CTParser && window.CTParser.readQueues ? window.CTParser.readQueues() : [];
            recordsRead = queues.length;
            sourceDetails.queues = { status: queues.length > 0 ? "SUCCESS" : "EMPTY", count: queues.length, timestamp: now };
            unavailableSources = ["Campaigns Table (requires navigation to /manager/campaigns)", "Live Filter Inventory (requires navigation to /manager/live-filters)"];
        } else {
            result = "PARTIAL";
            failureReason = "Current page (" + route + ") does not contain primary operational tables";
            unavailableSources = ["Campaigns Table", "Live Filter Inventory", "Queues Table"];
        }

        const detail = {
            refreshId: refreshId,
            requestAt: now,
            completedAt: Date.now(),
            source: route,
            result: result,
            recordsRead: recordsRead,
            failureReason: failureReason,
            unavailableSources: unavailableSources,
            sourceDetails: sourceDetails
        };

        document.dispatchEvent(new CustomEvent("CT_EAST_2_REFRESH_RESULT", { detail: detail }));
    });

    init();
})();
