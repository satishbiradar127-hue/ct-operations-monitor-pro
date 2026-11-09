const isEast3 = typeof window !== "undefined" && window.location && window.location.hostname.includes("east-3");
console.log("Dashboard Loaded — CT Operations Monitor Pro (" + (isEast3 ? "EAST-3" : "EAST-2") + ") v11.3.8");

(function () {
    "use strict";

    const TARGET_HOST = isEast3 ? "east-3.calltools.io" : "east-2.calltools.io";
    const EDITION = isEast3 ? "EAST-3" : "EAST-2";
    const DIALER = isEast3 ? "EAST-3" : "EAST-2";
    const PREFIX = isEast3 ? "ct_east3_" : "ct_east2_";

    if (window.location.hostname && window.location.hostname !== TARGET_HOST) {
        console.log("CT Operations Monitor (" + EDITION + ") — wrong host " + window.location.hostname + "; expected " + TARGET_HOST);
        return;
    }

    // The inbound bridge uses a same-page hidden native CallTools Queue iframe
    // as the DOM source of truth. The feed frame must not render a second dashboard.
    if (new URLSearchParams(window.location.search).get("ct_inbound_monitor") === "1" || window.self !== window.top) {
        console.log("CT Operations Monitor — iframe context; skipping duplicate dashboard root");
        return;
    }

    const DASHBOARD_ID = isEast3 ? "ct-operations-dashboard-east3" : "ct-operations-dashboard-east2";
    const STYLE_ID = isEast3 ? "ct-operations-dashboard-styles-east3-v11-3-3" : "ct-operations-dashboard-styles-east2-v11-3-3";
    const THEME_KEY = isEast3 ? "ct_east3_dashboard_theme" : "ct_east2_dashboard_theme";
    const CONTACT_THRESHOLD_KEY = isEast3 ? "ct_east3_contact_threshold" : "ct_east2_contact_threshold";
    const ZOOM_KEY = isEast3 ? "ct_east3_dashboard_zoom" : "ct_east2_dashboard_zoom";
    const LAYOUT_KEY = isEast3 ? "ct_east3_dashboard_layout_v20" : "ct_east2_dashboard_layout_v20";
    const LAYOUT_VERSION_KEY = isEast3 ? "ct_east3_dashboard_layout_version" : "ct_east2_dashboard_layout_version";
    const LAYOUT_VERSION = 20;
    const SELECTED_CAMPAIGNS_KEY = "ct_east2_selected_campaign_ids_v1";
    const FILTER_STATE_KEY = "ct_east2_campaign_state_filter_v1";
    const FILTER_HEALTH_KEY = "ct_east2_campaign_health_filter_v1";
    const SEARCH_QUERY_KEY = isEast3 ? "ct_east3_campaign_query_v1" : "ct_east2_campaign_query_v1";
    const ORDER_KEY = isEast3 ? "ct_east3_dashboard_campaign_order" : "ct_east2_dashboard_campaign_order";
    const ORDER_META_KEY = isEast3 ? "ct_east3_dashboard_campaign_order-meta" : "ct_east2_dashboard_campaign_order-meta";
    const EMPTY = "-";
    const MAX_ALERTS = 12;
        const ORDER_VERSION = 4;
    const PINNED_ORDER = ["RES CRED MAIN", "REALTIME 126", "REALTIME 484"];
    const FRESHNESS_WARN_MS = 30000;
    const FRESHNESS_CRITICAL_MS = 60000;
    const RUNWAY_WINDOW_MS = 5 * 60 * 1000;
    const RUNWAY_MIN_OBSERVATION_MS = 30000;
    const RUNWAY_MIN_LEAD_DROP = 10;
    const RUNWAY_MAX_SAMPLES = 120;
    const DISMISSED_ALERTS_KEY = isEast3 ? "ct_east3_dismissed_alerts_v3" : "ct_east2_dismissed_alerts_v3";
    const ALERT_LOGIC_VERSION = "v11.3.3";
    const INBOUND_DATA_KEY = isEast3 ? "ct_east3_last_known_queues_v1" : isEast3 ? "ct_east3_last_known_queues_v1" : "ct_east2_last_known_queues_v1";
    const INBOUND_STATUS_KEY = isEast3 ? "ct_east3_inbound_feed_status_v1" : "ct_east2_inbound_feed_status_v1";
    const INBOUND_STORAGE_DATA_KEY = isEast3 ? "ct_east3_inbound_data_v2" : "ct_east2_inbound_data_v2";
    const INBOUND_STORAGE_STATUS_KEY = isEast3 ? "ct_east3_inbound_status_v2" : "ct_east2_inbound_status_v2";
    const INBOUND_HEARTBEAT_STALE_MS = 15000;
    const DIALER_ID = isEast3 ? "east-3" : "east-2";
    const DIALER_NAME = isEast3 ? "East-3" : "East-2";
    const DIALER_TAG = isEast3 ? "EAST-3" : "EAST-2";
    const UPDATE_EVENT = isEast3 ? "CT_EAST_3_UPDATE" : "CT_EAST_2_UPDATE";
    const FEED_STATUS_EVENT = isEast3 ? "CT_EAST_3_FEED_STATUS" : "CT_EAST_2_FEED_STATUS";
    const REQUEST_REFRESH_EVENT = isEast3 ? "CT_EAST_3_REQUEST_REFRESH" : "CT_EAST_2_REQUEST_REFRESH";
    const REFRESH_RESULT_EVENT = isEast3 ? "CT_EAST_3_REFRESH_RESULT" : "CT_EAST_2_REFRESH_RESULT";
    const REQUEST_INBOUND_REFRESH_EVENT = isEast3 ? "CT_EAST_3_REQUEST_INBOUND_REFRESH" : "CT_EAST_2_REQUEST_INBOUND_REFRESH";
    const INBOUND_HISTORY_WINDOW_MS = 5 * 60 * 1000;
    const INBOUND_TREND_BASELINE_MS = 45 * 1000;
    const INBOUND_TREND_MAX_BASELINE_MS = 120 * 1000;
    const OPERATING_BASELINE_KEY = isEast3 ? "ct_east3_operating_baseline_v1" : "ct_east2_operating_baseline_v1";
    const GOAL_BASELINES_KEY = PREFIX + "goal_baselines_v1";
    const PERSISTENT_GOAL_ALERTS_KEY = PREFIX + "persistent_goal_alerts_v1";
    const ACKNOWLEDGED_GOAL_ALERTS_KEY = PREFIX + "acknowledged_goal_alerts_v1";
    const INBOUND_SETTINGS_KEY = PREFIX + "inbound_settings_v1";
    const VERIFIED_FILTERS_KEY = PREFIX + "verified_campaign_filters_v1";
    const LIVE_FILTERS_INVENTORY_KEY = PREFIX + "live_filters_inventory_v1";

    function readPersistentGoalBaselines() {
        try {
            return JSON.parse(readStorage(GOAL_BASELINES_KEY, "{}")) || {};
        } catch (e) {
            return {};
        }
    }

    function readPersistentGoalAlerts() {
        try {
            const raw = localStorage.getItem(PERSISTENT_GOAL_ALERTS_KEY) || readStorage(PERSISTENT_GOAL_ALERTS_KEY, "[]");
            const list = typeof raw === "string" ? JSON.parse(raw) : raw;
            return Array.isArray(list) ? list : [];
        } catch (e) {
            return [];
        }
    }

    function readAcknowledgedGoalAlerts() {
        try {
            const raw = localStorage.getItem(ACKNOWLEDGED_GOAL_ALERTS_KEY) || readStorage(ACKNOWLEDGED_GOAL_ALERTS_KEY, "[]");
            const setArray = typeof raw === "string" ? JSON.parse(raw) : raw;
            return new Set(Array.isArray(setArray) ? setArray : []);
        } catch (e) {
            return new Set();
        }
    }

    function readInboundSettings() {
        try {
            const raw = JSON.parse(readStorage(INBOUND_SETTINGS_KEY, "{}")) || {};
            return {
                showArchived: Boolean(raw.showArchived),
                warnWaitThreshold: Number(raw.warnWaitThreshold) || 30,
                critWaitThreshold: Number(raw.critWaitThreshold) || 60,
                alertZeroCapacity: raw.alertZeroCapacity !== false
            };
        } catch (e) {
            return { showArchived: false, warnWaitThreshold: 30, critWaitThreshold: 60, alertZeroCapacity: true };
        }
    }

    function persistInboundSettings() {
        writeStorage(INBOUND_SETTINGS_KEY, JSON.stringify(state.inboundSettings || {}));
    }

    function persistGoalBaselines() {
        writeStorage(GOAL_BASELINES_KEY, JSON.stringify(state.persistentGoalBaselines || {}));
        try {
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ [GOAL_BASELINES_KEY]: state.persistentGoalBaselines });
            }
        } catch (e) {}
    }

    function persistPersistentGoalAlerts() {
        writeStorage(PERSISTENT_GOAL_ALERTS_KEY, JSON.stringify(state.persistentGoalAlerts || []));
        try {
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ [PERSISTENT_GOAL_ALERTS_KEY]: state.persistentGoalAlerts });
            }
        } catch (e) {}
    }

    function persistAcknowledgedGoalAlerts() {
        const arr = Array.from(state.acknowledgedGoalAlerts || []);
        writeStorage(ACKNOWLEDGED_GOAL_ALERTS_KEY, JSON.stringify(arr));
        try {
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ [ACKNOWLEDGED_GOAL_ALERTS_KEY]: arr });
            }
        } catch (e) {}
    }

    const DEFAULT_LAYOUT = {
        left: 14,
        top: 14,
        width: 1560,
        height: 920,
        collapsed: false
    };

    const TREND_KEYS = ["waitNow", "loggedIn", "waiting", "outbound", "abandoned"];
    const METRICS = [
        { key: "contacts", label: "Contacts", group: "Campaign" },
        { key: "channels", label: "Channels", group: "Campaign" },
        { key: "waitNow", label: "Wait Now", group: "Wait", trend: true },
        { key: "waitToday", label: "Wait Today", group: "Wait" },
        { key: "outbound", label: "Outbound", group: "Calls", trend: true },
        { key: "human", label: "Human", group: "Calls" },
        { key: "machine", label: "Machine", group: "Calls" },
        { key: "agentConnect", label: "Agent Connect", group: "Calls" },
        { key: "abandoned", label: "Abandoned", group: "Calls", trend: true },
        { key: "noAnswer", label: "No Answer", group: "Calls" },
        { key: "busy", label: "Busy", group: "Calls" },
        { key: "failed", label: "Failed", group: "Calls" },
        { key: "loggedIn", label: "Logged In", group: "Agents", trend: true },
        { key: "waiting", label: "Waiting", group: "Agents", trend: true },
        { key: "onCall", label: "On Call", group: "Agents" },
        { key: "postCall", label: "Post Call", group: "Agents" }
    ];

    const HEALTH = {
        excellent: { label: "HEALTHY", rank: 3 },
        good: { label: "STABLE", rank: 2 },
        warning: { label: "AT RISK", rank: 1 },
        critical: { label: "CRITICAL", rank: 0 }
    };

    const state = {
        campaigns: readLastKnownCampaigns().data,
        queues: readLastKnownQueues().data,
        previousQueuesById: new Map(),
        queueLastUpdated: readLastKnownQueues().updatedAt ? new Date(readLastKnownQueues().updatedAt) : null,
        queueLastFeedHeartbeatAt: readLastKnownInboundStatus().heartbeatAt ? new Date(readLastKnownInboundStatus().heartbeatAt) : null,
        queueFeedStatus: readLastKnownInboundStatus().status,
        route: window.location.pathname.replace(/\/+$/, "") === "/manager/queues" ? "queues" : "campaigns",
        previousById: new Map(),
        query: readStorage(SEARCH_QUERY_KEY, ""),
        filter: readStorage(FILTER_HEALTH_KEY, "all"),
        stateFilter: readStorage(FILTER_STATE_KEY, "active"),
        allCollapsed: false,
        theme: readStorage(THEME_KEY, "dark") === "light" ? "light" : "dark",
        contactThreshold: numberValue(readStorage(CONTACT_THRESHOLD_KEY, "2000")),
        zoom: Math.min(1.2, Math.max(0.8, numberValue(readStorage(ZOOM_KEY, "1")))),
        operatingCampaign: readStorage(isEast3 ? "ct_east3_operating_campaign" : "ct_east2_operating_campaign", ""),
        operatingCampaigns: readOperatingCampaigns(),
        operatingBaseline: readOperatingBaseline(),
        reorderMode: false,
        recoveryCount: 0,
        lastRecoveryReason: "",
        layout: readLayout(),
        manualOrder: readCampaignOrder(),
        lastUpdated: null,
        pendingRender: 0,
        recentAlerts: [],
        lastSeveritySignature: "",
        sortedIds: [],
        visibleIds: [],
        draggingCampaignId: "",
        lastEventAt: null,
        lastFeedHeartbeatAt: null,
        lastDataChangeAt: null,
        lastDataSignature: "",
        routeVisible: true,
        lastRecoveryAt: 0,
        dismissedConditions: readDismissedConditions(),
        persistentGoalBaselines: readPersistentGoalBaselines(),
        persistentGoalAlerts: readPersistentGoalAlerts(),
        acknowledgedGoalAlerts: readAcknowledgedGoalAlerts(),
        inboundSettings: readInboundSettings(),
        recoveryInFlightUntil: 0,
        sourceState: "WAITING",
        feedStatus: "WAITING",
        connectionState: "INITIALIZING",
        outboundSourceState: "INITIALIZING",
        inboundSourceState: "INITIALIZING",
        outboundAuthRequired: false,
        inboundAuthRequired: false,
        outboundTableMissing: false,
        inboundTableMissing: false,
        lastSuccessfulObservationAt: null,
        lastSuccessfulOutboundAt: null,
        lastSuccessfulInboundAt: null,
        authRequired: false,
        tableMissing: false,
        parserActive: false,
        nextMonitoringCheckIn: 15,
        isMonitoringRefreshing: false,
        monitoringIntervalSeconds: 15,
        runwayHistory: new Map(),
        inboundHistory: [],
        selectedCampaignIds: new Set(readJsonStorage(SELECTED_CAMPAIGNS_KEY, []))
    };

    function readJsonStorage(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key) || "") || fallback; } catch (e) { return fallback; }
    }

    function persistSelectedCampaigns() {
        try {
            localStorage.setItem(SELECTED_CAMPAIGNS_KEY, JSON.stringify(Array.from(state.selectedCampaignIds || [])));
        } catch (e) {}
    }

    function persistFilterState() {
        try {
            localStorage.setItem(FILTER_STATE_KEY, state.stateFilter || "all");
        } catch (e) {}
    }

    function persistHealthFilter() {
        try {
            localStorage.setItem(FILTER_HEALTH_KEY, state.filter || "all");
        } catch (e) {}
    }

    function persistSearchQuery() {
        try {
            localStorage.setItem(SEARCH_QUERY_KEY, state.query || "");
        } catch (e) {}
    }

    function readLastKnownQueues() {
        const raw = readJsonStorage(isEast3 ? "ct_east3_last_known_queues_v1" : "ct_east2_last_known_queues_v1", null);
        if (!raw || !Array.isArray(raw.data)) return { data: [], updatedAt: 0 };
        return { data: raw.data, updatedAt: Number(raw.updatedAt) || 0 };
    }

    function readLastKnownInboundStatus() {
        const raw = readJsonStorage(INBOUND_STATUS_KEY, null);
        if (!raw) return { status: "WAITING", heartbeatAt: 0, rowCount: 0 };
        return {
            status: String(raw.status || "WAITING").toUpperCase(),
            heartbeatAt: Number(raw.heartbeatAt) || 0,
            rowCount: Number(raw.rowCount) || 0
        };
    }

    function readLastKnownCampaigns() {
        const raw = readJsonStorage(isEast3 ? "ct_east3_last_known_campaigns_v1" : "ct_east2_last_known_campaigns_v1", null);
        if (!raw || !Array.isArray(raw.data)) return { data: [], updatedAt: 0 };
        return { data: raw.data, updatedAt: Number(raw.updatedAt) || 0 };
    }

    function persistLastKnownQueues(queues, timestamp) {
        try { localStorage.setItem(isEast3 ? "ct_east3_last_known_queues_v1" : "ct_east2_last_known_queues_v1", JSON.stringify({ data: queues || [], updatedAt: timestamp || Date.now() })); } catch (e) {}
    }

    function persistLastKnownCampaigns(campaigns, timestamp) {
        try { localStorage.setItem(isEast3 ? "ct_east3_last_known_campaigns_v1" : "ct_east2_last_known_campaigns_v1", JSON.stringify({ data: campaigns || [], updatedAt: timestamp || Date.now() })); } catch (e) {}
    }

    function readOperatingCampaigns() {
        // v11.1.19 stores a set so multiple operating campaigns can be monitored.
        // Migrate the prior single-campaign value without losing the user's selection.
        const raw = readStorage(isEast3 ? "ct_east3_operating_campaigns" : "ct_east2_operating_campaigns", "");
        try {
            const parsed = raw ? JSON.parse(raw) : [];
            if (Array.isArray(parsed)) return Array.from(new Set(parsed.map(function (v) { return String(v || "").trim(); }).filter(Boolean)));
        } catch (e) {}
        const legacy = String(readStorage(isEast3 ? "ct_east3_operating_campaign" : "ct_east2_operating_campaign", "") || "").trim();
        return legacy ? [legacy] : [];
    }

    function operatingSelectionKey(ids) {
        return Array.from(new Set((ids || []).map(function (v) { return String(v || "").trim(); }).filter(Boolean))).sort().join("|");
    }

    function readOperatingBaseline() {
        try {
            const raw = JSON.parse(readStorage(OPERATING_BASELINE_KEY, "") || "null");
            if (!raw || typeof raw !== "object" || !raw.selectionKey || !raw.counts || typeof raw.counts !== "object") return null;
            return { selectionKey: String(raw.selectionKey), counts: raw.counts, capturedAt: Number(raw.capturedAt) || 0 };
        } catch (e) { return null; }
    }

    function persistOperatingBaseline() {
        try {
            if (!state.operatingBaseline) { localStorage.removeItem(OPERATING_BASELINE_KEY); return; }
            localStorage.setItem(OPERATING_BASELINE_KEY, JSON.stringify(state.operatingBaseline));
        } catch (e) {}
    }

    function captureOperatingBaseline(ids, campaigns) {
        const selectionKey = operatingSelectionKey(ids);
        if (!selectionKey || !Array.isArray(campaigns) || !campaigns.length) {
            state.operatingBaseline = null;
            persistOperatingBaseline();
            return;
        }
        const counts = {};
        campaigns.forEach(function (campaign, index) {
            const id = campaign && campaign.__id ? String(campaign.__id) : campaignId(campaign || {}, index);
            counts[id] = Math.max(0, numberValue(campaign.__loggedIn ?? campaign.loggedIn));
        });
        state.operatingBaseline = { selectionKey: selectionKey, counts: counts, capturedAt: Date.now() };
        persistOperatingBaseline();
    }

    function ensureOperatingBaseline(campaigns) {
        const key = operatingSelectionKey(state.operatingCampaigns || []);
        if (!key) {
            if (state.operatingBaseline) { state.operatingBaseline = null; persistOperatingBaseline(); }
            return;
        }
        if (!state.operatingBaseline || state.operatingBaseline.selectionKey !== key) captureOperatingBaseline(state.operatingCampaigns, campaigns);
    }

    function writeOperatingCampaigns(ids) {
        const clean = Array.from(new Set((ids || []).map(function (v) { return String(v || "").trim(); }).filter(Boolean)));
        const changed = operatingSelectionKey(clean) !== operatingSelectionKey(state.operatingCampaigns || []);
        state.operatingCampaigns = clean;
        state.operatingCampaign = clean[0] || "";
        writeStorage(isEast3 ? "ct_east3_operating_campaigns" : "ct_east2_operating_campaigns", JSON.stringify(clean));
        writeStorage(isEast3 ? "ct_east3_operating_campaign" : "ct_east2_operating_campaign", state.operatingCampaign);
        if (changed) captureOperatingBaseline(clean, state.campaigns);
    }

    function syncFilterButtons() {
        if (!root) return;
        const stateBtns = root.querySelectorAll("[data-state-filter]");
        stateBtns.forEach(function (button) {
            button.classList.toggle("is-active", (button.dataset.stateFilter || "all") === state.stateFilter);
        });
        const healthBtns = root.querySelectorAll("[data-health-filter]");
        healthBtns.forEach(function (button) {
            button.classList.toggle("is-active", (button.dataset.healthFilter || "all") === state.filter);
        });
        const filterBtns = root.querySelectorAll(".ct-filter-btn");
        filterBtns.forEach(function (button) {
            button.classList.toggle("is-active", (button.dataset.filter || "all") === state.filter);
        });
        const searchInput = root.querySelector(".ct-search input");
        if (searchInput && searchInput.value !== (state.query || "")) {
            searchInput.value = state.query || "";
        }
    }

    const root = ensureRoot();
    const cardCache = new Map();
    let refs = {};
    let operatingOutsideClickHandler = null;
    let operatingEscapeHandler = null;
    let campaignReorderCleanup = null;

    state.allCollapsed = Boolean(state.layout.collapsed);

    ensureStyles();
    mount();
    applyLayout(state.layout);
    applyZoom();
    installGlobalInteractions();
    window.addEventListener("resize", function () {
        const next = normalizeLayout(state.layout);
        state.layout.left = next.left;
        state.layout.top = next.top;
        state.layout.width = next.width;
        state.layout.height = next.height;
        applyLayout(state.layout);
        persistLayout();
    });
    scheduleRender();

    function hydrateInboundFromExtensionStorage() {
        if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;
        try {
            chrome.storage.local.get([INBOUND_STORAGE_DATA_KEY, INBOUND_STORAGE_STATUS_KEY], function (items) {
                if (chrome.runtime && chrome.runtime.lastError) return;
                const data = items && items[INBOUND_STORAGE_DATA_KEY];
                const status = items && items[INBOUND_STORAGE_STATUS_KEY];
                if (data && Array.isArray(data.data)) {
                    const nextQueues = data.data;
                    const signature = queueDataSignature(nextQueues);
                    if (signature !== queueDataSignature(state.queues) || !state.queues.length) {
                        state.previousQueuesById = snapshotQueuesById(state.queues);
                        state.queues = nextQueues;
                        state.queueLastUpdated = new Date(Number(data.updatedAt) || Date.now());
                        recordInboundHistory(nextQueues, Number(data.updatedAt) || Date.now());
                        addInboundAlerts(nextQueues);
                    }
                    if (data.updatedAt && nextQueues.length > 0) {
                        state.lastSuccessfulInboundAt = Number(data.updatedAt);
                    }
                }
                if (status) {
                    state.queueFeedStatus = String(status.status || "WAITING").toUpperCase();
                    state.queueLastFeedHeartbeatAt = Number(status.heartbeatAt) ? new Date(Number(status.heartbeatAt)) : null;
                }
                scheduleRender();
            });
        } catch (error) {}
    }

    function onInboundExtensionStorageChanged(changes, areaName) {
        if (areaName !== "local" || !changes) return;
        const dataChange = changes[INBOUND_STORAGE_DATA_KEY];
        const statusChange = changes[INBOUND_STORAGE_STATUS_KEY];
        if (dataChange && dataChange.newValue) {
            const payload = dataChange.newValue;
            const nextQueues = payload && Array.isArray(payload.data) ? payload.data : [];
            const signature = queueDataSignature(nextQueues);
            if (signature !== queueDataSignature(state.queues) || !state.queues.length) {
                state.previousQueuesById = snapshotQueuesById(state.queues);
                state.queues = nextQueues;
                state.queueLastUpdated = new Date(Number(payload.updatedAt) || Date.now());
                recordInboundHistory(nextQueues, Number(payload.updatedAt) || Date.now());
                addInboundAlerts(nextQueues);
            }
            if (payload.updatedAt && nextQueues.length > 0) {
                state.lastSuccessfulInboundAt = Number(payload.updatedAt);
            }
        }
        if (statusChange && statusChange.newValue) {
            const payload = statusChange.newValue;
            state.queueFeedStatus = String(payload.status || "WAITING").toUpperCase();
            state.queueLastFeedHeartbeatAt = Number(payload.heartbeatAt) ? new Date(Number(payload.heartbeatAt)) : null;
        }
        if (changes && (changes[VERIFIED_FILTERS_KEY] || changes[LIVE_FILTERS_INVENTORY_KEY])) {
            if (changes[VERIFIED_FILTERS_KEY] && changes[VERIFIED_FILTERS_KEY].newValue) {
                const reg = changes[VERIFIED_FILTERS_KEY].newValue;
                if (Array.isArray(state.campaigns)) {
                    state.campaigns.forEach(function (c) {
                        const cid = c.rawId || c.id || c.__id;
                        const entry = (cid && reg[String(cid)]) || (c.name && reg[String(c.name).trim()]) || null;
                        if (entry && entry.liveFilter) {
                            c.liveFilter = entry.liveFilter;
                            c.liveFilterSource = entry.source || "VERIFIED_REGISTRY";
                            c.liveFilterTimestamp = entry.timestamp || null;
                            c.liveFilterCount = entry.filterCount !== undefined ? entry.filterCount : null;
                        }
                    });
                }
            }
            scheduleRender();
        }
        if (dataChange || statusChange) scheduleRender();
    }

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener(onInboundExtensionStorageChanged);
    }
    hydrateInboundFromExtensionStorage();

    function hydratePersistentAlertsFromExtensionStorage() {
        if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;
        try {
            chrome.storage.local.get([PERSISTENT_GOAL_ALERTS_KEY, ACKNOWLEDGED_GOAL_ALERTS_KEY, GOAL_BASELINES_KEY], function (items) {
                if (chrome.runtime && chrome.runtime.lastError) return;
                let changed = false;
                if (items && Array.isArray(items[PERSISTENT_GOAL_ALERTS_KEY])) {
                    const existingIds = new Set((state.persistentGoalAlerts || []).map(function (a) { return a.id; }));
                    items[PERSISTENT_GOAL_ALERTS_KEY].forEach(function (a) {
                        if (a && a.id && !existingIds.has(a.id) && !state.acknowledgedGoalAlerts.has(a.id)) {
                            state.persistentGoalAlerts.push(a);
                            changed = true;
                        }
                    });
                }
                if (items && Array.isArray(items[ACKNOWLEDGED_GOAL_ALERTS_KEY])) {
                    items[ACKNOWLEDGED_GOAL_ALERTS_KEY].forEach(function (id) {
                        state.acknowledgedGoalAlerts.add(id);
                    });
                }
                if (changed) {
                    persistPersistentGoalAlerts();
                    updateAlerts();
                }
            });
        } catch (e) {}
    }
    hydratePersistentAlertsFromExtensionStorage();

    // Centralized 15-second Live Monitoring Scheduler (Stage 5)
    const MONITORING_CYCLE_SECONDS = 15;
    let secondsUntilNextMonitoring = MONITORING_CYCLE_SECONDS;
    let isMonitoringCheckInFlight = false;

    function trigger15sMonitoringRefresh(reason) {
        if (isMonitoringCheckInFlight) return;
        isMonitoringCheckInFlight = true;
        state.isMonitoringRefreshing = true;

        if (refs && refs.live && state.connectionState === "LIVE") {
            setText(refs.live, "UPDATING");
            setClass(refs.live, "ct-live is-warning");
        }

        try {
            document.dispatchEvent(new CustomEvent(REQUEST_REFRESH_EVENT));
            document.dispatchEvent(new CustomEvent(REQUEST_INBOUND_REFRESH_EVENT));
        } catch (e) {}

        setTimeout(function () {
            isMonitoringCheckInFlight = false;
            state.isMonitoringRefreshing = false;
            updateConnectionState(Date.now());
        }, 400);
    }

    const freshnessTimer = setInterval(function () {
        const now = Date.now();
        secondsUntilNextMonitoring--;
        state.nextMonitoringCheckIn = Math.max(0, secondsUntilNextMonitoring);

        if (secondsUntilNextMonitoring <= 0) {
            secondsUntilNextMonitoring = MONITORING_CYCLE_SECONDS;
            state.nextMonitoringCheckIn = MONITORING_CYCLE_SECONDS;
            trigger15sMonitoringRefresh("15s-scheduler-cycle");
        }

        updateConnectionState(now);
    }, 1000);
    const routeTimer = setInterval(function () {
        const path = window.location.pathname.replace(/\/+$/, "");
        const route = path === "/manager/queues" ? "queues" : path === "/manager/campaigns" ? "campaigns" : "other";
        const visible = route === "campaigns" || route === "queues";
        if (route === state.route && visible === state.routeVisible) return;
        state.route = route;
        state.routeVisible = visible;
        root.style.display = visible ? "flex" : "none";
        if (visible) scheduleRender();
    }, 1000);
    // Local runway sampling uses already-parsed state only: no API, no DOM scan,
    // and no extra CallTools activity. It supplies elapsed-time anchors even
    // when the native Leads number is temporarily unchanged.
    const runwayTimer = setInterval(function () {
        if (state.campaigns && state.campaigns.length) {
            const now = Date.now();
            recordRunwaySamples(state.campaigns, now);
            if (state.sourceState === "LIVE") addCurrentStateAlerts(state.campaigns);
        }
    }, 1000);

    if (window.__CTOperationsDashboardCleanup) {
        window.__CTOperationsDashboardCleanup();
    }

    const onCtUpdate = function (event) {
        const detail = event && event.detail;
        const now = Date.now();
        const route = String((detail && detail.route) || state.route || "campaigns");
        state.route = route;
        state.lastEventAt = now;
        state.parserActive = true;

        const meta = (detail && detail.meta) || {};
        if (meta.authRequired) {
            state.authRequired = true;
            updateConnectionState(now);
            scheduleRender();
            return;
        }
        if (meta.tableMissing) {
            state.tableMissing = true;
            updateConnectionState(now);
            scheduleRender();
            return;
        }

        state.authRequired = false;
        state.tableMissing = false;
        const obsTime = Number(meta.observationAt) || now;
        state.lastSuccessfulObservationAt = obsTime;

        if (route === "queues" || (detail && Array.isArray(detail.queues) && detail.queues.length && !detail.campaigns?.length)) {
            state.lastSuccessfulInboundAt = obsTime;
            const nextQueues = detail && Array.isArray(detail.queues) ? detail.queues : [];
            const signature = queueDataSignature(nextQueues);
            const changed = signature !== queueDataSignature(state.queues);
            if (changed || !state.queues.length) {
                state.previousQueuesById = snapshotQueuesById(state.queues);
                state.queues = nextQueues;
                state.queueLastUpdated = new Date(now);
                recordInboundHistory(nextQueues, now);
                addInboundAlerts(nextQueues);
                persistLastKnownQueues(nextQueues, now);
            }
            updateConnectionState(now);
            scheduleRender();
            return;
        }

        // Campaigns route
        state.lastSuccessfulOutboundAt = obsTime;
        const nextCampaigns = Array.isArray(detail)
            ? detail
            : (detail && Array.isArray(detail.campaigns) ? detail.campaigns : []);
        const signature = dataSignature(nextCampaigns);
        const changed = signature !== state.lastDataSignature;

        state.lastFeedHeartbeatAt = obsTime;
        if (refs && refs.feedHeartbeat) setText(refs.feedHeartbeat, "0s");

        if (changed || !state.campaigns.length) {
            const previousById = state.campaigns.length ? snapshotById(state.campaigns) : new Map();
            state.previousById = previousById;
            state.campaigns = nextCampaigns;
            state.lastDataSignature = signature;
            state.lastDataChangeAt = obsTime;
            state.lastUpdated = new Date(obsTime);
            state.recoveryInFlightUntil = 0;
            recordRunwaySamples(nextCampaigns, obsTime);
            addCurrentStateAlerts(nextCampaigns);
            persistLastKnownCampaigns(nextCampaigns, obsTime);
        } else {
            recordRunwaySamples(nextCampaigns, obsTime);
        }

        updateConnectionState(now);
        scheduleRender();
    };

    document.addEventListener(UPDATE_EVENT, onCtUpdate);

    const onCtFeedStatus = function (event) {
        const detail = event && event.detail ? event.detail : {};
        const now = Date.now();
        state.lastEventAt = Number(detail.lastCheckAt) || now;
        state.parserActive = true;
        if (detail.route) state.route = String(detail.route);
        if (detail.authRequired || detail.status === "AUTH_REQUIRED") {
            state.authRequired = true;
        }
        if (detail.tableMissing || detail.status === "SOURCE_ERROR") {
            state.tableMissing = true;
        }
        if (detail.status === "LIVE" && (detail.rowCount > 0 || state.campaigns.length > 0 || state.queues.length > 0)) {
            state.authRequired = false;
            state.tableMissing = false;
            const checkAt = Number(detail.lastCheckAt) || now;
            state.lastSuccessfulObservationAt = checkAt;
            if (state.route === "campaigns") state.lastSuccessfulOutboundAt = checkAt;
            if (state.route === "queues") state.lastSuccessfulInboundAt = checkAt;
        }
        if (state.route === "queues") state.queueLastFeedHeartbeatAt = new Date(state.lastEventAt);
        state.lastFeedHeartbeatAt = state.lastEventAt;
        if (detail.status) {
            const status = String(detail.status).toUpperCase();
            state.feedStatus = status;
        }
        updateConnectionState(now);
    };
    document.addEventListener(FEED_STATUS_EVENT, onCtFeedStatus);

    const onStorage = function (event) {
        if (!event || !event.key) return;
        if (event.key === VERIFIED_FILTERS_KEY || event.key === LIVE_FILTERS_INVENTORY_KEY) {
            scheduleRender();
            return;
        }
        if (event.key === INBOUND_DATA_KEY && event.newValue) {
            try {
                const payload = JSON.parse(event.newValue);
                const nextQueues = payload && Array.isArray(payload.data) ? payload.data : [];
                const signature = queueDataSignature(nextQueues);
                const changed = signature !== queueDataSignature(state.queues);
                if (changed || !state.queues.length) {
                    state.previousQueuesById = snapshotQueuesById(state.queues);
                    state.queues = nextQueues;
                    state.queueLastUpdated = new Date(Number(payload.updatedAt) || Date.now());
                    recordInboundHistory(nextQueues, Number(payload.updatedAt) || Date.now());
                    addInboundAlerts(nextQueues);
                    scheduleRender();
                }
                if (payload.updatedAt && nextQueues.length > 0) {
                    state.lastSuccessfulInboundAt = Number(payload.updatedAt);
                }
            } catch (error) {}
            return;
        }
        if (event.key === INBOUND_STATUS_KEY && event.newValue) {
            try {
                const payload = JSON.parse(event.newValue);
                state.queueFeedStatus = String(payload.status || "WAITING").toUpperCase();
                const heartbeat = Number(payload.heartbeatAt) || 0;
                state.queueLastFeedHeartbeatAt = heartbeat ? new Date(heartbeat) : null;
                scheduleRender();
            } catch (error) {}
        }
    };
    window.addEventListener("storage", onStorage);

    const onVisibilityChange = function () {
        if (document.visibilityState === "visible") {
            secondsUntilNextMonitoring = 0;
            state.nextMonitoringCheckIn = 0;
            hydrateInboundFromExtensionStorage();
            trigger15sMonitoringRefresh("visibility-change-recovery");
            updateConnectionState(Date.now());
            scheduleRender();
        }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    window.__CTOperationsDashboardCleanup = function () {
        document.removeEventListener(UPDATE_EVENT, onCtUpdate);
        document.removeEventListener(FEED_STATUS_EVENT, onCtFeedStatus);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("storage", onStorage);
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.removeListener(onInboundExtensionStorageChanged);
        }
        if (operatingOutsideClickHandler) document.removeEventListener("click", operatingOutsideClickHandler);
        if (operatingEscapeHandler) document.removeEventListener("keydown", operatingEscapeHandler);
        if (campaignReorderCleanup) {
            try { campaignReorderCleanup(); } catch (error) { console.warn("CT reorder cleanup warning", error); }
            campaignReorderCleanup = null;
        }
        clearInterval(freshnessTimer);
        clearInterval(runwayTimer);
        clearInterval(routeTimer);
    };

    function ensureRoot() {
        const dashboards = Array.from(document.querySelectorAll("#" + DASHBOARD_ID));
        const existing = dashboards.shift() || null;

        dashboards.forEach(function (dashboard) {
            dashboard.remove();
        });

        if (existing) {
            return existing;
        }

        const panel = document.createElement("section");
        panel.id = DASHBOARD_ID;
        panel.setAttribute("aria-label", "CallTools Operations Dashboard");
        document.body.appendChild(panel);

        return panel;
    }

    function ensureStyles() {
        let style = document.getElementById(STYLE_ID);
        if (!style) {
            style = document.createElement("style");
            style.id = STYLE_ID;
            document.head.appendChild(style);
        }
        style.textContent = `
            #${DASHBOARD_ID} {
                --ct-bg: #eef2f7;
                --ct-surface: #ffffff;
                --ct-surface-2: #f8fafc;
                --ct-text: #111827;
                --ct-muted: #667085;
                --ct-border: #d9e1ec;
                --ct-shadow: 0 24px 70px rgba(15, 23, 42, 0.25);
                --ct-green: #157347;
                --ct-green-bg: #e8f7ef;
                --ct-blue: #2563eb;
                --ct-blue-bg: #e7efff;
                --ct-amber: #a85300;
                --ct-amber-bg: #fff0d7;
                --ct-red: #b42318;
                --ct-red-bg: #fde7e7;
                --ct-header: linear-gradient(135deg, #172033 0%, #283955 54%, #1f6259 100%);
                position: fixed;
                top: 18px;
                left: 18px;
                right: auto;
                z-index: 999999;
                display: flex;
                flex-direction: column;
                width: min(1520px, calc(100vw - 28px));
                max-height: calc(100vh - 24px);
                color: var(--ct-text);
                background: var(--ct-bg);
                border: 1px solid rgba(17, 24, 39, 0.14);
                border-radius: 8px;
                box-shadow: var(--ct-shadow);
                font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
                font-size: 12px;
                line-height: 1.25;
                overflow: hidden;
                resize: none;
            }

            #${DASHBOARD_ID}.is-dragging,
            #${DASHBOARD_ID}.is-resizing {
                user-select: none;
            }

            #${DASHBOARD_ID}[data-theme="dark"] {
                --ct-bg: #0f172a;
                --ct-surface: #172033;
                --ct-surface-2: #202b42;
                --ct-text: #f8fafc;
                --ct-muted: #aab4c5;
                --ct-border: #334155;
                --ct-shadow: 0 24px 70px rgba(0, 0, 0, 0.46);
                --ct-green: #65d98b;
                --ct-green-bg: rgba(34, 197, 94, 0.16);
                --ct-blue: #8bb6ff;
                --ct-blue-bg: rgba(37, 99, 235, 0.2);
                --ct-amber: #ffc36b;
                --ct-amber-bg: rgba(245, 158, 11, 0.18);
                --ct-red: #ff8a80;
                --ct-red-bg: rgba(239, 68, 68, 0.2);
                --ct-header: linear-gradient(135deg, #060914 0%, #172033 58%, #14453f 100%);
            }

            #${DASHBOARD_ID} * {
                box-sizing: border-box;
            }

            #${DASHBOARD_ID} button,
            #${DASHBOARD_ID} input {
                font: inherit;
            }

            #${DASHBOARD_ID} button {
                cursor: pointer;
            }

            #${DASHBOARD_ID} .ct-shell {
                flex: 1 1 auto;
                min-height: 0;
                overflow: auto;
            }

            #${DASHBOARD_ID} .ct-summary {
                position: sticky;
                top: 0;
                z-index: 3;
                display: grid;
                gap: 9px;
                padding: 11px;
                color: #ffffff;
                background: var(--ct-header);
                box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
                cursor: grab;
                touch-action: none;
                user-select: none;
            }

            #${DASHBOARD_ID}.is-dragging .ct-summary {
                cursor: grabbing;
            }

            #${DASHBOARD_ID} .ct-row,
            #${DASHBOARD_ID} .ct-actions,
            #${DASHBOARD_ID} .ct-card-head,
            #${DASHBOARD_ID} .ct-card-main,
            #${DASHBOARD_ID} .ct-badges,
            #${DASHBOARD_ID} .ct-meta,
            #${DASHBOARD_ID} .ct-alert-row,
            #${DASHBOARD_ID} .ct-health-row,
            #${DASHBOARD_ID} .ct-util-row {
                display: flex;
                align-items: center;
            }

            #${DASHBOARD_ID} .ct-row,
            #${DASHBOARD_ID} .ct-card-head,
            #${DASHBOARD_ID} .ct-alert-row,
            #${DASHBOARD_ID} .ct-health-row,
            #${DASHBOARD_ID} .ct-util-row {
                justify-content: space-between;
                gap: 8px;
            }

            #${DASHBOARD_ID} .ct-title {
                min-width: 0;
            }

            #${DASHBOARD_ID} .ct-title h2 {
                margin: 0;
                overflow: hidden;
                font-size: 17px;
                font-weight: 800;
                letter-spacing: 0;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            #${DASHBOARD_ID} .ct-updated {
                display: block;
                margin-top: 2px;
                color: rgba(255, 255, 255, 0.72);
                font-size: 11px;
            }

            #${DASHBOARD_ID} .ct-live {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                flex: 0 0 auto;
                padding: 5px 8px;
                border: 1px solid rgba(255, 255, 255, 0.22);
                border-radius: 999px;
                color: #e7f8ef;
                background: rgba(255, 255, 255, 0.11);
                font-size: 10px;
                font-weight: 800;
                text-transform: uppercase;
            }

            #${DASHBOARD_ID} .ct-live::before {
                content: "";
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: #37d67a;
                box-shadow: 0 0 0 3px rgba(55, 214, 122, 0.22);
            }

            #${DASHBOARD_ID} .ct-kpis {
                display: grid;
                grid-template-columns: repeat(5, minmax(0, 1fr));
                gap: 6px;
            }

            #${DASHBOARD_ID} .ct-kpi {
                min-width: 0;
                padding: 7px;
                border: 1px solid rgba(255, 255, 255, 0.16);
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.1);
            }

            #${DASHBOARD_ID} .ct-kpi-label {
                overflow: hidden;
                color: rgba(255, 255, 255, 0.68);
                font-size: 9px;
                font-weight: 800;
                text-overflow: ellipsis;
                text-transform: uppercase;
                white-space: nowrap;
            }

            #${DASHBOARD_ID} .ct-kpi-value {
                margin-top: 3px;
                overflow: hidden;
                color: #ffffff;
                font-size: 16px;
                font-weight: 850;
                line-height: 1.05;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            #${DASHBOARD_ID} .ct-kpi-note {
                margin-top: 2px;
                overflow: hidden;
                color: rgba(255, 255, 255, 0.72);
                font-size: 10px;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            #${DASHBOARD_ID} .ct-alerts {
                display: grid;
                gap: 6px;
                max-height: 110px;
                overflow: auto;
                padding: 7px;
                border: 1px solid rgba(255, 255, 255, 0.18);
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.1);
            }

            #${DASHBOARD_ID} .ct-alert-clear {
                margin-left: 6px;
                padding: 2px 7px;
                border: 1px solid var(--ct-border);
                border-radius: 999px;
                color: var(--ct-muted);
                background: var(--ct-surface);
                font-size: 9px;
                font-weight: 900;
                cursor: pointer;
            }

            #${DASHBOARD_ID} .ct-alert-clear:hover { color: var(--ct-text); background: var(--ct-surface-2); }

            #${DASHBOARD_ID} .ct-live.is-warning { color: #fff0d7; }
            #${DASHBOARD_ID} .ct-live.is-critical { color: #ffd6d2; }

            #${DASHBOARD_ID} .ct-alert-title {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                color: rgba(255, 255, 255, 0.74);
                font-size: 10px;
                font-weight: 850;
                text-transform: uppercase;
            }

            #${DASHBOARD_ID} .ct-alert-list {
                display: grid;
                gap: 5px;
            }

            #${DASHBOARD_ID} .ct-alert {
                min-width: 0;
                padding: 5px 7px;
                border-radius: 7px;
                background: rgba(255, 255, 255, 0.13);
            }

            #${DASHBOARD_ID} .ct-alert.is-critical {
                border-left: 3px solid #ff8a80;
            }

            #${DASHBOARD_ID} .ct-alert.is-warning {
                border-left: 3px solid #ffc36b;
            }

            #${DASHBOARD_ID} .ct-alert-campaign {
                min-width: 0;
                overflow: hidden;
                color: #ffffff;
                font-weight: 800;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            #${DASHBOARD_ID} .ct-alert-severity {
                flex: 0 0 auto;
                font-size: 10px;
                font-weight: 850;
                text-transform: uppercase;
            }

            #${DASHBOARD_ID} .ct-alert.is-critical .ct-alert-severity {
                color: #ffb4ac;
            }

            #${DASHBOARD_ID} .ct-alert.is-warning .ct-alert-severity {
                color: #ffd79a;
            }

            #${DASHBOARD_ID} .ct-alert-message {
                margin-top: 2px;
                overflow: hidden;
                color: rgba(255, 255, 255, 0.74);
                font-size: 11px;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            #${DASHBOARD_ID} .ct-actions {
                gap: 7px;
            }

            #${DASHBOARD_ID} .ct-search {
                position: relative;
                flex: 1 1 auto;
                min-width: 0;
            }

            #${DASHBOARD_ID} .ct-search input,
            #${DASHBOARD_ID} .ct-threshold {
                width: 100%;
                height: 31px;
                border: 1px solid rgba(255, 255, 255, 0.22);
                border-radius: 7px;
                color: #ffffff;
                background: rgba(255, 255, 255, 0.12);
                outline: none;
            }

            #${DASHBOARD_ID} .ct-search input {
                padding: 0 10px 0 31px;
            }

            #${DASHBOARD_ID} .ct-search input::placeholder,
            #${DASHBOARD_ID} .ct-threshold::placeholder {
                color: rgba(255, 255, 255, 0.58);
            }

            #${DASHBOARD_ID} .ct-search::before {
                content: "";
                position: absolute;
                left: 11px;
                top: 50%;
                width: 10px;
                height: 10px;
                border: 2px solid rgba(255, 255, 255, 0.64);
                border-radius: 50%;
                transform: translateY(-58%);
            }

            #${DASHBOARD_ID} .ct-search::after {
                content: "";
                position: absolute;
                left: 22px;
                top: 19px;
                width: 7px;
                height: 2px;
                border-radius: 2px;
                background: rgba(255, 255, 255, 0.64);
                transform: rotate(45deg);
            }

            #${DASHBOARD_ID} .ct-threshold-wrap {
                flex: 0 0 92px;
                min-width: 0;
            }

            #${DASHBOARD_ID} .ct-threshold {
                padding: 0 8px;
            }

            #${DASHBOARD_ID} .ct-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex: 0 0 auto;
                min-width: 31px;
                height: 31px;
                padding: 0 9px;
                border: 1px solid rgba(255, 255, 255, 0.22);
                border-radius: 7px;
                color: #ffffff;
                background: rgba(255, 255, 255, 0.12);
            }

            #${DASHBOARD_ID} .ct-btn:hover,
            #${DASHBOARD_ID} .ct-search input:focus,
            #${DASHBOARD_ID} .ct-threshold:focus {
                border-color: rgba(255, 255, 255, 0.48);
                background: rgba(255, 255, 255, 0.18);
            }

            #${DASHBOARD_ID} .ct-btn-text {
                min-width: 70px;
                font-size: 11px;
                font-weight: 800;
            }

            #${DASHBOARD_ID} .ct-reset-btn {
                min-width: 48px;
                font-size: 11px;
                font-weight: 800;
            }

            #${DASHBOARD_ID} .ct-content {
                display: grid;
                gap: 7px;
                padding: 8px;
            }

            #${DASHBOARD_ID}.is-panel-collapsed {
                height: auto !important;
                min-height: 0 !important;
            }

            #${DASHBOARD_ID}.is-panel-collapsed .ct-content,
            #${DASHBOARD_ID}.is-panel-collapsed .ct-kpis,
            #${DASHBOARD_ID}.is-panel-collapsed .ct-alerts,
            #${DASHBOARD_ID}.is-panel-collapsed .ct-insights-panel,
            #${DASHBOARD_ID}.is-panel-collapsed .ct-operating-panel,
            #${DASHBOARD_ID}.is-panel-collapsed .ct-command-strip,
            #${DASHBOARD_ID}.is-panel-collapsed .ct-table-head,
            #${DASHBOARD_ID}.is-panel-collapsed .ct-list,
            #${DASHBOARD_ID}.is-panel-collapsed .ct-system-footer {
                display: none;
            }

            #${DASHBOARD_ID}.is-panel-collapsed .ct-actions {
                display: flex;
                justify-content: flex-end;
            }

            #${DASHBOARD_ID}.is-panel-collapsed .ct-search,
            #${DASHBOARD_ID}.is-panel-collapsed .ct-threshold-wrap,
            #${DASHBOARD_ID}.is-panel-collapsed .ct-theme-btn,
            #${DASHBOARD_ID}.is-panel-collapsed .ct-reset-btn {
                display: none;
            }

            #${DASHBOARD_ID}.is-panel-collapsed .ct-summary {
                gap: 6px;
                padding: 9px 10px;
            }

            #${DASHBOARD_ID} .ct-ops-health,
            #${DASHBOARD_ID} .ct-action-panel,
            #${DASHBOARD_ID} .ct-filter-bar {
                border: 1px solid var(--ct-border);
                border-radius: 8px;
                background: var(--ct-surface);
            }

            #${DASHBOARD_ID} .ct-ops-health {
                display: grid;
                gap: 7px;
                padding: 8px;
            }

            #${DASHBOARD_ID} .ct-ops-head,
            #${DASHBOARD_ID} .ct-action-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
            }

            #${DASHBOARD_ID} .ct-section-title {
                color: var(--ct-muted);
                font-size: 10px;
                font-weight: 850;
                text-transform: uppercase;
            }

            #${DASHBOARD_ID} .ct-health-state {
                display: inline-flex;
                align-items: center;
                min-height: 22px;
                padding: 2px 8px;
                border-radius: 999px;
                font-size: 10px;
                font-weight: 850;
                text-transform: uppercase;
            }

            #${DASHBOARD_ID} .ct-health-state.is-healthy {
                color: var(--ct-green);
                background: var(--ct-green-bg);
            }

            #${DASHBOARD_ID} .ct-health-state.is-watch,
            #${DASHBOARD_ID} .ct-health-state.is-warning {
                color: var(--ct-amber);
                background: var(--ct-amber-bg);
            }

            #${DASHBOARD_ID} .ct-health-state.is-critical {
                color: var(--ct-red);
                background: var(--ct-red-bg);
            }

            #${DASHBOARD_ID} .ct-ops-score {
                display: flex;
                align-items: baseline;
                gap: 4px;
            }

            #${DASHBOARD_ID} .ct-ops-score strong {
                color: var(--ct-text);
                font-size: 24px;
                line-height: 1;
            }

            #${DASHBOARD_ID} .ct-ops-score span {
                color: var(--ct-muted);
                font-size: 10px;
                font-weight: 800;
            }

            #${DASHBOARD_ID} .ct-ops-grid {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 6px;
            }

            #${DASHBOARD_ID} .ct-ops-metric {
                min-width: 0;
                padding: 6px;
                border-radius: 7px;
                background: var(--ct-surface-2);
            }

            #${DASHBOARD_ID} .ct-ops-label {
                overflow: hidden;
                color: var(--ct-muted);
                font-size: 9px;
                font-weight: 850;
                text-overflow: ellipsis;
                text-transform: uppercase;
                white-space: nowrap;
            }

            #${DASHBOARD_ID} .ct-ops-value {
                margin-top: 2px;
                overflow: hidden;
                color: var(--ct-text);
                font-size: 13px;
                font-weight: 850;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            #${DASHBOARD_ID} .ct-action-panel {
                display: grid;
                gap: 5px;
                padding: 8px;
            }

            #${DASHBOARD_ID} .ct-action-text {
                color: var(--ct-text);
                font-size: 12px;
                font-weight: 750;
            }

            #${DASHBOARD_ID} .ct-filter-bar {
                display: flex;
                gap: 5px;
                padding: 5px;
            }
            #${DASHBOARD_ID} .ct-campaigns-head {
                display:flex;
                align-items:center;
                justify-content:space-between;
                gap:10px;
                padding:8px 10px 6px;
                border:1px solid var(--ct-border);
                border-bottom:0;
                border-radius:9px 9px 0 0;
                background:var(--ct-surface);
            }
            #${DASHBOARD_ID} .ct-campaigns-head > div { min-width:0; display:flex; flex-direction:column; gap:2px; }
            #${DASHBOARD_ID} .ct-campaigns-head strong { color:var(--ct-text); font-size:11px; font-weight:950; letter-spacing:.07em; }
            #${DASHBOARD_ID} .ct-campaigns-head small { color:var(--ct-muted); font-size:9px; font-weight:750; }
            #${DASHBOARD_ID} .ct-campaigns-state { padding:3px 7px; border:1px solid var(--ct-border); border-radius:999px; color:var(--ct-muted); background:var(--ct-surface-2); font-size:8px; font-weight:950; letter-spacing:.05em; }
            #${DASHBOARD_ID} .ct-campaigns-state.is-live { color:var(--ct-green); background:var(--ct-green-bg); border-color:#bbf7d0; }
            #${DASHBOARD_ID} .ct-campaigns-state.is-warning { color:#a16207; background:#fef3c7; border-color:#fde68a; }
            #${DASHBOARD_ID} .ct-campaigns-state.is-critical { color:#b91c1c; background:#fee2e2; border-color:#fecaca; }

            #${DASHBOARD_ID} .ct-filter-btn {
                flex: 1 1 0;
                min-width: 0;
                height: 26px;
                border: 1px solid var(--ct-border);
                border-radius: 6px;
                color: var(--ct-muted);
                background: var(--ct-surface-2);
                font-size: 10px;
                font-weight: 850;
            }

            #${DASHBOARD_ID} .ct-filter-btn.is-active {
                color: #ffffff;
                border-color: rgba(255, 255, 255, 0.12);
                background: #2563eb;
            }

            #${DASHBOARD_ID} .ct-order-hint {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 5px 7px;
                color: var(--ct-muted);
                font-size: 9px;
            }

            #${DASHBOARD_ID} .ct-order-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 18px;
                height: 18px;
                border-radius: 5px;
                color: var(--ct-blue);
                background: var(--ct-blue-bg);
                font-size: 12px;
                font-weight: 900;
            }

            #${DASHBOARD_ID} .ct-status-strip {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 6px;
            }

            #${DASHBOARD_ID} .ct-status {
                min-width: 0;
                padding: 6px;
                border: 1px solid var(--ct-border);
                border-radius: 8px;
                background: var(--ct-surface);
            }

            #${DASHBOARD_ID} .ct-status-label {
                color: var(--ct-muted);
                font-size: 9px;
                font-weight: 800;
                text-transform: uppercase;
            }

            #${DASHBOARD_ID} .ct-status-value {
                margin-top: 2px;
                color: var(--ct-text);
                font-size: 15px;
                font-weight: 850;
            }

            #${DASHBOARD_ID} .ct-insights {
                display: grid;
                gap: 5px;
                padding: 7px 8px;
                border: 1px solid var(--ct-border);
                border-radius: 8px;
                background: var(--ct-surface);
            }

            #${DASHBOARD_ID} .ct-insight {
                display: flex;
                align-items: center;
                justify-content: space-between;
                min-width: 0;
                gap: 10px;
            }

            #${DASHBOARD_ID} .ct-insight-label {
                flex: 0 0 auto;
                color: var(--ct-muted);
                font-size: 9px;
                font-weight: 800;
                text-transform: uppercase;
            }

            #${DASHBOARD_ID} .ct-insight-value {
                min-width: 0;
                overflow: hidden;
                color: var(--ct-text);
                font-size: 11px;
                font-weight: 800;
                text-align: right;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            #${DASHBOARD_ID} .ct-list {
                display: grid;
                gap: 7px;
            }

            #${DASHBOARD_ID} .ct-list.is-reordering .ct-card {
                transition: transform 0.12s ease, opacity 0.12s ease;
            }

            #${DASHBOARD_ID} .ct-card {
                position: relative;
                border: 1px solid var(--ct-border);
                border-left-width: 4px;
                border-radius: 10px;
                background: var(--ct-surface);
                overflow: hidden;
                box-shadow: 0 2px 7px rgba(15, 23, 42, 0.06);
                transition: box-shadow 0.14s ease, transform 0.14s ease;
            }

            #${DASHBOARD_ID} .ct-card:hover {
                box-shadow: 0 6px 18px rgba(15, 23, 42, 0.10);
            }

            #${DASHBOARD_ID} .ct-card.is-dragging {
                opacity: 0.45;
                transform: scale(0.99);
            }

            #${DASHBOARD_ID} .ct-card.is-drop-target {
                outline: 2px solid var(--ct-blue);
                outline-offset: 2px;
            }

            #${DASHBOARD_ID} .ct-card.is-critical { border-left-color: var(--ct-red); }
            #${DASHBOARD_ID} .ct-card.is-warning { border-left-color: var(--ct-amber); }
            #${DASHBOARD_ID} .ct-card.is-good { border-left-color: var(--ct-blue); }
            #${DASHBOARD_ID} .ct-card.is-excellent { border-left-color: var(--ct-green); }

            #${DASHBOARD_ID} .ct-card-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                width: 100%;
                padding: 8px 9px;
                border: 0;
                color: var(--ct-text);
                background: var(--ct-surface);
                text-align: left;
            }

            #${DASHBOARD_ID} .ct-card-head:hover { background: var(--ct-surface-2); }

            #${DASHBOARD_ID} .ct-card-main {
                min-width: 0;
                gap: 7px;
            }

            #${DASHBOARD_ID} .ct-drag-handle {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex: 0 0 22px;
                width: 22px;
                height: 26px;
                border-radius: 6px;
                color: var(--ct-muted);
                background: var(--ct-surface-2);
                cursor: grab;
                user-select: none;
                touch-action: none;
            }

            #${DASHBOARD_ID} .ct-drag-handle:active { cursor: grabbing; }

            #${DASHBOARD_ID} .ct-order-number {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex: 0 0 22px;
                width: 22px;
                height: 22px;
                border-radius: 6px;
                color: var(--ct-muted);
                background: var(--ct-surface-2);
                font-size: 9px;
                font-weight: 900;
            }

            #${DASHBOARD_ID} .ct-chevron {
                flex: 0 0 auto;
                color: var(--ct-muted);
                transition: transform 0.16s ease;
            }

            #${DASHBOARD_ID} .ct-card.is-collapsed .ct-chevron { transform: rotate(-90deg); }

            #${DASHBOARD_ID} .ct-name-wrap { min-width: 0; }

            #${DASHBOARD_ID} .ct-name {
                overflow: hidden;
                color: var(--ct-text);
                font-size: 13px;
                font-weight: 850;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            #${DASHBOARD_ID} .ct-meta {
                gap: 7px;
                margin-top: 2px;
                color: var(--ct-muted);
                font-size: 10px;
            }

            #${DASHBOARD_ID} .ct-badges {
                justify-content: flex-end;
                flex: 0 0 auto;
                gap: 4px;
            }

            #${DASHBOARD_ID} .ct-badge,
            #${DASHBOARD_ID} .ct-wait,
            #${DASHBOARD_ID} .ct-score {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-height: 20px;
                padding: 2px 6px;
                border-radius: 999px;
                font-size: 10px;
                font-weight: 850;
                white-space: nowrap;
            }

            #${DASHBOARD_ID} .ct-status-value.is-critical,
            #${DASHBOARD_ID} .ct-value-text.is-critical,
            #${DASHBOARD_ID} .ct-trend.is-critical {
                color: var(--ct-red);
            }

            #${DASHBOARD_ID} .ct-status-value.is-warning,
            #${DASHBOARD_ID} .ct-value-text.is-warning,
            #${DASHBOARD_ID} .ct-trend.is-warning {
                color: var(--ct-amber);
            }

            #${DASHBOARD_ID} .ct-status-value.is-good,
            #${DASHBOARD_ID} .ct-value-text.is-good,
            #${DASHBOARD_ID} .ct-trend.is-good {
                color: var(--ct-blue);
            }

            #${DASHBOARD_ID} .ct-status-value.is-excellent,
            #${DASHBOARD_ID} .ct-status-value.is-healthy,
            #${DASHBOARD_ID} .ct-value-text.is-excellent,
            #${DASHBOARD_ID} .ct-value-text.is-healthy,
            #${DASHBOARD_ID} .ct-trend.is-excellent,
            #${DASHBOARD_ID} .ct-trend.is-healthy {
                color: var(--ct-green);
            }

            #${DASHBOARD_ID} .ct-badge.is-critical,
            #${DASHBOARD_ID} .ct-wait.is-critical,
            #${DASHBOARD_ID} .ct-score.is-critical {
                color: var(--ct-red);
                background: var(--ct-red-bg);
            }

            #${DASHBOARD_ID} .ct-badge.is-warning,
            #${DASHBOARD_ID} .ct-wait.is-warning,
            #${DASHBOARD_ID} .ct-score.is-warning {
                color: var(--ct-amber);
                background: var(--ct-amber-bg);
            }

            #${DASHBOARD_ID} .ct-badge.is-good,
            #${DASHBOARD_ID} .ct-score.is-good {
                color: var(--ct-blue);
                background: var(--ct-blue-bg);
            }

            #${DASHBOARD_ID} .ct-badge.is-inactive { color:#667085; background:#eef2f6; border-color:#cbd5e1; }

            #${DASHBOARD_ID} .ct-badge.is-excellent,
            #${DASHBOARD_ID} .ct-wait.is-healthy,
            #${DASHBOARD_ID} .ct-score.is-excellent {
                color: var(--ct-green);
                background: var(--ct-green-bg);
            }

            #${DASHBOARD_ID} .ct-quick-grid {
                display: grid;
                grid-template-columns: repeat(6, minmax(0, 1fr));
                gap: 1px;
                border-top: 1px solid var(--ct-border);
                background: var(--ct-border);
            }

            #${DASHBOARD_ID} .ct-quick-item {
                min-width: 0;
                padding: 6px 7px;
                background: var(--ct-surface-2);
            }

            #${DASHBOARD_ID} .ct-quick-label {
                color: var(--ct-muted);
                font-size: 8px;
                font-weight: 850;
                text-transform: uppercase;
            }

            #${DASHBOARD_ID} .ct-quick-value {
                margin-top: 2px;
                overflow: hidden;
                color: var(--ct-text);
                font-size: 12px;
                font-weight: 900;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            #${DASHBOARD_ID} .ct-quick-value.is-critical { color: var(--ct-red); }
            #${DASHBOARD_ID} .ct-quick-value.is-warning { color: var(--ct-amber); }
            #${DASHBOARD_ID} .ct-quick-value.is-good { color: var(--ct-blue); }
            #${DASHBOARD_ID} .ct-quick-value.is-excellent { color: var(--ct-green); }

            #${DASHBOARD_ID} .ct-grid {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 1px;
                background: var(--ct-border);
            }

            #${DASHBOARD_ID} .ct-card.is-collapsed .ct-grid,
            #${DASHBOARD_ID} .ct-card.is-collapsed .ct-health-row,
            #${DASHBOARD_ID} .ct-card.is-collapsed .ct-util-row {
                display: none;
            }

            #${DASHBOARD_ID} .ct-details-label {
                padding: 5px 8px;
                border-top: 1px solid var(--ct-border);
                color: var(--ct-muted);
                background: var(--ct-surface-2);
                font-size: 8px;
                font-weight: 850;
                letter-spacing: 0.04em;
                text-transform: uppercase;
            }

            #${DASHBOARD_ID} .ct-health-row,
            #${DASHBOARD_ID} .ct-util-row {
                padding: 5px 8px;
                border-top: 1px solid var(--ct-border);
                background: var(--ct-surface-2);
            }

            #${DASHBOARD_ID} .ct-health-label,
            #${DASHBOARD_ID} .ct-util-label {
                color: var(--ct-muted);
                font-size: 9px;
                font-weight: 800;
                text-transform: uppercase;
            }

            #${DASHBOARD_ID} .ct-health-bar,
            #${DASHBOARD_ID} .ct-util-bar {
                flex: 1 1 auto;
                height: 6px;
                margin: 0 8px;
                border-radius: 999px;
                background: var(--ct-border);
                overflow: hidden;
            }

            #${DASHBOARD_ID} .ct-health-fill,
            #${DASHBOARD_ID} .ct-util-fill {
                display: block;
                height: 100%;
                width: 0;
                border-radius: inherit;
                transition: width 0.24s ease;
            }

            #${DASHBOARD_ID} .ct-health-fill.is-critical {
                background: var(--ct-red);
            }

            #${DASHBOARD_ID} .ct-health-fill.is-warning {
                background: var(--ct-amber);
            }

            #${DASHBOARD_ID} .ct-health-fill.is-good {
                background: var(--ct-blue);
            }

            #${DASHBOARD_ID} .ct-health-fill.is-excellent,
            #${DASHBOARD_ID} .ct-util-fill {
                background: var(--ct-green);
            }

            #${DASHBOARD_ID} .ct-util-stats {
                flex: 0 0 auto;
                color: var(--ct-text);
                font-size: 10px;
                font-weight: 800;
                white-space: nowrap;
            }

            #${DASHBOARD_ID} .ct-metric {
                min-width: 0;
                padding: 5px 6px;
                background: var(--ct-surface);
            }

            #${DASHBOARD_ID} .ct-metric-label {
                overflow: hidden;
                color: var(--ct-muted);
                font-size: 9px;
                font-weight: 800;
                text-overflow: ellipsis;
                text-transform: uppercase;
                white-space: nowrap;
            }

            #${DASHBOARD_ID} .ct-metric-value {
                display: flex;
                align-items: center;
                gap: 4px;
                margin-top: 2px;
                overflow: hidden;
                color: var(--ct-text);
                font-size: 12px;
                font-weight: 800;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            #${DASHBOARD_ID} .ct-trend {
                flex: 0 0 auto;
                font-size: 11px;
                line-height: 1;
            }

            #${DASHBOARD_ID} .ct-empty {
                padding: 22px 14px;
                border: 1px dashed var(--ct-border);
                border-radius: 8px;
                color: var(--ct-muted);
                background: var(--ct-surface);
                text-align: center;
            }

            #${DASHBOARD_ID} .ct-resize-handle {
                position: absolute;
                right: 0;
                bottom: 0;
                width: 18px;
                height: 18px;
                cursor: nwse-resize;
                z-index: 4;
                pointer-events: auto;
                touch-action: none;
            }

            #${DASHBOARD_ID} .ct-resize-handle::after {
                content: "";
                position: absolute;
                right: 4px;
                bottom: 4px;
                width: 9px;
                height: 9px;
                border-right: 2px solid rgba(148, 163, 184, 0.85);
                border-bottom: 2px solid rgba(148, 163, 184, 0.85);
            }

            #${DASHBOARD_ID} .ct-alerts {
                position: relative;
                border: 1px solid var(--ct-border);
                box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
            }

            #${DASHBOARD_ID} .ct-alert-title {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
            }

            #${DASHBOARD_ID} .ct-alert-title span:first-child {
                font-weight: 900;
                letter-spacing: .04em;
            }

            #${DASHBOARD_ID} .ct-alert-title span:last-child {
                padding: 2px 7px;
                border-radius: 999px;
                background: var(--ct-surface-2);
                color: var(--ct-muted);
                font-size: 9px;
                font-weight: 900;
            }

            #${DASHBOARD_ID} .ct-alert {
                position: relative;
                overflow: hidden;
                border-left-width: 4px;
                padding: 8px 10px;
                transition: transform .16s ease, box-shadow .16s ease;
            }

            #${DASHBOARD_ID} .ct-alert:hover {
                transform: translateY(-1px);
                box-shadow: 0 5px 14px rgba(15, 23, 42, .08);
            }

            #${DASHBOARD_ID} .ct-alert.is-critical {
                border-left-color: var(--ct-red);
                background: linear-gradient(90deg, var(--ct-red-bg), var(--ct-surface));
            }

            #${DASHBOARD_ID} .ct-alert.is-warning {
                border-left-color: var(--ct-amber);
                background: linear-gradient(90deg, var(--ct-amber-bg), var(--ct-surface));
            }

            #${DASHBOARD_ID} .ct-alert.is-good {
                border-left-color: var(--ct-green);
                background: linear-gradient(90deg, var(--ct-green-bg), var(--ct-surface));
            }

            #${DASHBOARD_ID} .ct-alert-priority {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                margin-right: 7px;
                font-size: 8px;
                font-weight: 950;
                letter-spacing: .07em;
            }

            #${DASHBOARD_ID} .ct-alert-why {
                margin-top: 3px;
                color: var(--ct-text);
                font-size: 10px;
                font-weight: 750;
            }

            #${DASHBOARD_ID} .ct-alert-action {
                margin-top: 3px;
                color: var(--ct-muted);
                font-size: 9px;
                font-weight: 750;
            }

            #${DASHBOARD_ID} .ct-command-strip {
                display: grid;
                grid-template-columns: 1.2fr .8fr .8fr .8fr;
                gap: 6px;
                padding: 7px 9px;
                border-top: 1px solid var(--ct-border);
                border-bottom: 1px solid var(--ct-border);
                background: var(--ct-surface);
            }

            #${DASHBOARD_ID} .ct-command-item {
                min-width: 0;
                padding: 6px 8px;
                border: 1px solid var(--ct-border);
                border-radius: 7px;
                background: var(--ct-surface-2);
            }

            #${DASHBOARD_ID} .ct-command-label {
                color: var(--ct-muted);
                font-size: 8px;
                font-weight: 900;
                letter-spacing: .05em;
                text-transform: uppercase;
            }

            #${DASHBOARD_ID} .ct-command-value {
                margin-top: 2px;
                overflow: hidden;
                color: var(--ct-text);
                font-size: 12px;
                font-weight: 950;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            #${DASHBOARD_ID} .ct-command-value.is-critical { color: var(--ct-red); }
            #${DASHBOARD_ID} .ct-command-value.is-warning { color: var(--ct-amber); }
            #${DASHBOARD_ID} .ct-command-value.is-good { color: var(--ct-green); }

            #${DASHBOARD_ID} .ct-ops-health {
                border: 1px solid var(--ct-border);
                box-shadow: 0 4px 14px rgba(15, 23, 42, .05);
            }

            #${DASHBOARD_ID} .ct-ops-head {
                background: linear-gradient(90deg, var(--ct-surface), var(--ct-surface-2));
            }

            #${DASHBOARD_ID} .ct-action-panel {
                border-width: 1px;
                box-shadow: 0 4px 14px rgba(15, 23, 42, .05);
            }

            #${DASHBOARD_ID} .ct-card {
                transition: border-color .16s ease, box-shadow .16s ease, transform .16s ease;
            }

            #${DASHBOARD_ID} .ct-card:hover {
                box-shadow: 0 6px 18px rgba(15, 23, 42, .08);
            }

            #${DASHBOARD_ID} .ct-card.is-critical .ct-name::before {
                content: "";
                display: inline-block;
                width: 6px;
                height: 6px;
                margin: 0 6px 1px 0;
                border-radius: 50%;
                background: var(--ct-red);
                box-shadow: 0 0 0 3px var(--ct-red-bg);
            }

            #${DASHBOARD_ID} .ct-card.is-warning .ct-name::before {
                content: "";
                display: inline-block;
                width: 6px;
                height: 6px;
                margin: 0 6px 1px 0;
                border-radius: 50%;
                background: var(--ct-amber);
                box-shadow: 0 0 0 3px var(--ct-amber-bg);
            }

            @media (max-width: 620px) {
                #${DASHBOARD_ID} {
                    top: 10px;
                    right: 10px;
                    width: calc(100vw - 20px);
                    max-height: calc(100vh - 20px);
                }

                #${DASHBOARD_ID} .ct-kpis {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }

                #${DASHBOARD_ID} .ct-status-strip,
                #${DASHBOARD_ID} .ct-grid {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }

                #${DASHBOARD_ID} .ct-quick-grid {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                }

                #${DASHBOARD_ID} .ct-actions {
                    display: grid;
                    grid-template-columns: 1fr 92px 31px 52px 48px 76px;
                }

                #${DASHBOARD_ID} .ct-badges {
                    flex-direction: column;
                    align-items: flex-end;
                }
            }
        `;

        style.textContent += `
            #${DASHBOARD_ID} .ct-kpis { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
            #${DASHBOARD_ID} .ct-kpi { min-height: 58px; padding: 8px; }
            #${DASHBOARD_ID} .ct-kpi-value { font-size: 17px; }
            #${DASHBOARD_ID} .ct-alerts { max-height: 250px; min-height: 92px; padding: 9px; }
            #${DASHBOARD_ID} .ct-alert-list { max-height: 214px; overflow-y: auto; gap: 7px; }
            #${DASHBOARD_ID} .ct-alert { padding: 10px 12px; border-left-width: 4px; }
            #${DASHBOARD_ID} .ct-alert-campaign { font-size: 12px; }
            #${DASHBOARD_ID} .ct-alert-severity { font-size: 10px; }
            #${DASHBOARD_ID} .ct-alert-why { font-size: 12px; line-height: 1.35; }
            #${DASHBOARD_ID} .ct-alert-action { font-size: 11px; line-height: 1.3; }
            #${DASHBOARD_ID} .ct-actions {
                display: flex !important;
                flex-wrap: nowrap !important;
                overflow-x: auto !important;
                white-space: nowrap !important;
                align-items: center !important;
                gap: 6px !important;
                scrollbar-width: none !important;
                -ms-overflow-style: none !important;
            }
            #${DASHBOARD_ID} .ct-actions::-webkit-scrollbar { display: none !important; }
            #${DASHBOARD_ID} .ct-actions > .ct-btn { flex: 0 0 auto !important; white-space: nowrap !important; }
            #${DASHBOARD_ID} .ct-reset-btn { flex-shrink: 0 !important; white-space: nowrap !important; }
            #${DASHBOARD_ID} .ct-search { flex: 1 1 180px !important; min-width: 130px !important; }
            #${DASHBOARD_ID} .ct-threshold-wrap { flex: 0 0 88px !important; min-width: 80px !important; }
            #${DASHBOARD_ID} .ct-operating-wrap { flex: 0 1 190px !important; min-width: 160px !important; z-index: 40 !important; }
            #${DASHBOARD_ID} .ct-threshold-label, #${DASHBOARD_ID} .ct-operating-label { display:block; margin: 0 0 2px 2px; color: rgba(255,255,255,.68); font-size:8px; font-weight:900; text-transform:uppercase; }
            #${DASHBOARD_ID} .ct-threshold, #${DASHBOARD_ID} .ct-operating { height: 31px; width:100%; padding: 0 8px; border:1px solid rgba(255,255,255,.22); border-radius:7px; color:#fff; background:rgba(255,255,255,.12); outline:none; }
            #${DASHBOARD_ID} .ct-operating option { color:#111827; background:#fff; }
            #${DASHBOARD_ID} .ct-operating[multiple] { min-height:58px; height:58px; padding:5px 8px; }
            #${DASHBOARD_ID} .ct-operating-help { display:block; margin-top:2px; color:rgba(255,255,255,.52); font-size:7px; font-weight:700; white-space:nowrap; }
            #${DASHBOARD_ID} .ct-btn.is-active { color:#fff; background:#2563eb; border-color:#8bb6ff; }
            #${DASHBOARD_ID} .ct-filter-bar { position: relative; z-index: 1; }
            #${DASHBOARD_ID} .ct-table-head { display:grid; grid-template-columns:34px minmax(150px,1.7fr) 72px 82px 68px 68px 78px 78px 78px 92px 92px 92px 116px; gap:0; align-items:center; margin-top:7px; padding:8px 9px; border:1px solid rgba(148,163,184,.28); border-bottom:0; border-radius:9px 9px 0 0; background:#172033; color:#cbd5e1; font-size:8px; font-weight:950; letter-spacing:.04em; text-transform:uppercase; white-space:nowrap; overflow:auto; }
            #${DASHBOARD_ID} .ct-table-head span { overflow:hidden; text-overflow:ellipsis; }
            #${DASHBOARD_ID} .ct-list { min-height: 80px; }
            #${DASHBOARD_ID} .ct-list .ct-card { border-radius:0; margin-bottom:0; border-top:0; }
            #${DASHBOARD_ID} .ct-list .ct-card:last-child { border-radius:0 0 9px 9px; }
            #${DASHBOARD_ID} .ct-card-head { display:grid; grid-template-columns:34px minmax(150px,1.7fr) 72px 82px 68px 68px 78px 78px 78px 92px 92px 92px 116px; gap:0; align-items:center; width:100%; min-height:58px; padding:8px 9px; border:0; border-bottom:1px solid var(--ct-border); background:transparent; color:var(--ct-text); text-align:left; }
            #${DASHBOARD_ID} .ct-row-cell { min-width:0; padding:0 7px; overflow:hidden; }
            #${DASHBOARD_ID} .ct-row-cell .ct-row-label { display:none; }
            #${DASHBOARD_ID} .ct-row-value { display:block; font-size:12px; font-weight:900; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            #${DASHBOARD_ID} .ct-row-value.is-critical { color:#dc2626; }
            #${DASHBOARD_ID} .ct-row-value.is-warning { color:#d97706; }
            #${DASHBOARD_ID} .ct-row-value.is-good { color:#0f9f5d; }
            #${DASHBOARD_ID} .ct-row-actions { display:flex; align-items:center; justify-content:flex-end; gap:4px; padding-left:6px; }
            #${DASHBOARD_ID} .ct-row-action { width:27px; height:27px; border:1px solid var(--ct-border); border-radius:6px; background:var(--ct-surface-2); color:var(--ct-muted); font-size:13px; font-weight:900; }
            #${DASHBOARD_ID} .ct-row-action:hover { color:var(--ct-text); border-color:var(--ct-blue); background:var(--ct-blue-bg); }
            #${DASHBOARD_ID} .ct-list .ct-quick-grid { display:none; }
            #${DASHBOARD_ID} .ct-list .ct-health-row, #${DASHBOARD_ID} .ct-list .ct-util-row { display:none; }
            #${DASHBOARD_ID} .ct-list .ct-details-label { padding:8px 12px 4px; }
            @media (max-width: 1200px) { #${DASHBOARD_ID} .ct-table-head, #${DASHBOARD_ID} .ct-card-head { grid-template-columns:32px minmax(145px,1.6fr) 68px 78px 62px 62px 72px 72px 72px 84px 84px 84px 105px; } }
            @media (max-width: 900px) { #${DASHBOARD_ID} .ct-table-head, #${DASHBOARD_ID} .ct-card-head { width:1050px; } #${DASHBOARD_ID} .ct-table-head { overflow:hidden; } #${DASHBOARD_ID} .ct-list { overflow-x:auto; } }
            #${DASHBOARD_ID} .ct-order-hint { margin: 0 0 4px; border:1px dashed var(--ct-blue); background:var(--ct-blue-bg); color:var(--ct-text); }
            #${DASHBOARD_ID} .ct-system-footer { display:grid; grid-template-columns:1fr 110px 150px; gap:6px; padding:7px 8px; border:1px solid var(--ct-border); border-radius:8px; background:var(--ct-surface); color:var(--ct-muted); font-size:9px; }
            #${DASHBOARD_ID} .ct-system-footer > div { display:flex; justify-content:space-between; gap:6px; min-width:0; }
            #${DASHBOARD_ID} .ct-system-footer strong { color:var(--ct-text); }
            /* Never hide the summary/header controls in collapsed mode. The header Expand button is the persistent reopen control. */
            #${DASHBOARD_ID}.is-panel-collapsed .ct-actions { display:none !important; }
            #${DASHBOARD_ID}.is-panel-collapsed .ct-kpis { display:none; }
            #${DASHBOARD_ID}.is-panel-collapsed .ct-header-collapse { display:inline-flex !important; }
            @media (max-width: 980px) { #${DASHBOARD_ID} .ct-actions { grid-template-columns: minmax(130px,1fr) 88px 130px 88px 88px; } #${DASHBOARD_ID} .ct-theme-btn, #${DASHBOARD_ID} .ct-reset-btn { display:none; } }
            @media (max-width: 620px) { #${DASHBOARD_ID} .ct-kpis { grid-template-columns: repeat(2, minmax(0,1fr)); } #${DASHBOARD_ID} .ct-actions { grid-template-columns: 1fr 92px; } #${DASHBOARD_ID} .ct-system-footer { grid-template-columns:1fr; } }

            /* v11 Attention Center: deliberately high-contrast and scannable. */
            #${DASHBOARD_ID} .ct-alerts {
                min-height: 118px;
                max-height: 235px;
                padding: 9px;
                border: 1px solid rgba(255,255,255,.30);
                border-radius: 10px;
                background: linear-gradient(180deg, rgba(7,15,30,.96), rgba(17,30,51,.96));
                box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 10px 28px rgba(2,8,23,.26);
            }
            #${DASHBOARD_ID} .ct-alert-title { color: #fff; font-size: 11px; letter-spacing: .06em; }
            #${DASHBOARD_ID} .ct-alert-title > span:first-child::before { content: "⚡"; margin-right: 6px; }
            #${DASHBOARD_ID} .ct-alert-title span:last-child { background: rgba(255,255,255,.12); color: rgba(255,255,255,.90); border: 1px solid rgba(255,255,255,.16); }
            #${DASHBOARD_ID} .ct-alert-list { gap: 7px; }
            #${DASHBOARD_ID} .ct-alert {
                min-height: 76px;
                padding: 10px 12px 9px 13px;
                border: 1px solid rgba(255,255,255,.14);
                border-left-width: 6px;
                border-radius: 9px;
                color: #fff;
                box-shadow: 0 5px 18px rgba(0,0,0,.18);
            }
            #${DASHBOARD_ID} .ct-alert.is-critical { border-left-color: #ff4d5f; background: linear-gradient(90deg, rgba(255,58,76,.28), rgba(25,34,53,.96) 52%); }
            #${DASHBOARD_ID} .ct-alert.is-warning { border-left-color: #ffbf3f; background: linear-gradient(90deg, rgba(255,177,31,.25), rgba(25,34,53,.96) 52%); }
            #${DASHBOARD_ID} .ct-alert.is-good { border-left-color: #39e58c; background: linear-gradient(90deg, rgba(38,196,122,.20), rgba(25,34,53,.96) 52%); }
            #${DASHBOARD_ID} .ct-alert-campaign { color:#fff; font-size:12px; font-weight:900; letter-spacing:.01em; }
            #${DASHBOARD_ID} .ct-alert-severity { color:#fff !important; font-size:10px; font-weight:950; letter-spacing:.06em; }
            #${DASHBOARD_ID} .ct-alert-priority { padding:3px 6px; border-radius:999px; background:rgba(255,255,255,.14); color:#fff; font-size:8px; }
            #${DASHBOARD_ID} .ct-alert-why { margin-top:6px; color:#fff; font-size:11px; font-weight:800; line-height:1.35; white-space:normal; }
            #${DASHBOARD_ID} .ct-alert-action { margin-top:4px; color:rgba(255,255,255,.80); font-size:10px; font-weight:700; line-height:1.3; white-space:normal; }
            #${DASHBOARD_ID} .ct-alert-clear { color:#fff; background:rgba(255,255,255,.10); border-color:rgba(255,255,255,.24); }
            #${DASHBOARD_ID} .ct-alert-clear:hover { color:#fff; background:rgba(255,255,255,.18); }
            #${DASHBOARD_ID} .ct-action-notice { min-height:18px; margin:0 0 7px; padding:4px 8px; border:1px solid rgba(96,165,250,.30); border-radius:7px; color:#bfdbfe; background:rgba(59,130,246,.09); font-size:9px; font-weight:800; letter-spacing:.02em; }
            #${DASHBOARD_ID} .ct-action-notice[hidden] { display:none !important; }

            /* Explicit interaction affordances. */
            #${DASHBOARD_ID} .ct-summary { cursor: grab; touch-action: none; user-select: none; }
            #${DASHBOARD_ID}.is-dragging { cursor: grabbing; }
            #${DASHBOARD_ID} .ct-resize-handle { width:24px; height:24px; }
            #${DASHBOARD_ID} .ct-resize-handle::before { content:""; position:absolute; right:3px; bottom:3px; width:13px; height:13px; border-right:2px solid rgba(255,255,255,.55); border-bottom:2px solid rgba(255,255,255,.55); }
            #${DASHBOARD_ID} .ct-manage-order-btn.is-active { background:#2563eb; color:#fff; border-color:#8bb6ff; }
            #${DASHBOARD_ID} .ct-drag-handle { cursor:grab; user-select:none; touch-action:none; }
            #${DASHBOARD_ID} .ct-list.is-reordering .ct-drag-handle { cursor:grab; }
            #${DASHBOARD_ID} .ct-list.is-dragging-campaign { user-select:none; }
            #${DASHBOARD_ID} .ct-list.is-dragging-campaign .ct-drag-handle { cursor:grabbing; }
        `;

        style.textContent += `
            /* v11.0.5 command-center redesign */
            #${DASHBOARD_ID} .ct-alerts { min-height: 0; max-height: 310px; padding: 11px; border-radius: 12px; background: linear-gradient(145deg,#08111f,#12223a 68%,#123f3b); }
            #${DASHBOARD_ID} .ct-alert-title { min-height: 34px; display:flex; align-items:center; justify-content:space-between; gap:10px; color:#fff; }
            #${DASHBOARD_ID} .ct-alert-heading { display:flex; flex-direction:column; gap:2px; }
            #${DASHBOARD_ID} .ct-alert-heading > span { font-size:12px; font-weight:950; letter-spacing:.08em; text-transform:uppercase; }
            #${DASHBOARD_ID} .ct-alert-heading > span::before { content:"⚡"; margin-right:6px; }
            #${DASHBOARD_ID} .ct-alert-heading small { color:rgba(255,255,255,.58); font-size:9px; font-weight:650; letter-spacing:.01em; }
            #${DASHBOARD_ID} .ct-alert-controls { display:flex; align-items:center; gap:5px; flex-wrap:wrap; justify-content:flex-end; }
            #${DASHBOARD_ID} .ct-alert-counter { padding:4px 7px; border:1px solid rgba(255,255,255,.16); border-radius:999px; background:rgba(255,255,255,.07); color:rgba(255,255,255,.78); font-size:8px; font-weight:950; letter-spacing:.05em; }
            #${DASHBOARD_ID} .ct-critical-counter { color:#ff8c97; }
            #${DASHBOARD_ID} .ct-warning-counter { color:#ffd47a; }
            #${DASHBOARD_ID} .ct-alert-clear { padding:5px 9px; border-radius:7px; border:1px solid rgba(255,255,255,.20); color:#fff; background:rgba(255,255,255,.10); font-size:9px; font-weight:900; }
            #${DASHBOARD_ID} .ct-alert-list { display:flex; flex-direction:column; gap:6px; max-height:245px; overflow:auto; padding-right:1px; }
            #${DASHBOARD_ID} .ct-alert { min-height:0; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:10px; padding:10px 10px 10px 12px; border:1px solid rgba(255,255,255,.13); border-left-width:5px; border-radius:9px; color:#fff; }
            #${DASHBOARD_ID} .ct-alert-main { min-width:0; }
            #${DASHBOARD_ID} .ct-alert-top { display:flex; align-items:center; justify-content:space-between; gap:8px; }
            #${DASHBOARD_ID} .ct-alert-campaign { min-width:0; overflow:hidden; color:#fff; font-size:11px; font-weight:950; text-overflow:ellipsis; white-space:nowrap; }
            #${DASHBOARD_ID} .ct-alert-priority { display:inline-block; margin-right:6px; padding:3px 6px; border-radius:999px; background:rgba(255,255,255,.12); color:#fff; font-size:7px; font-weight:950; letter-spacing:.06em; vertical-align:1px; }
            #${DASHBOARD_ID} .ct-alert-severity { flex:0 0 auto; color:#fff; font-size:8px; font-weight:950; letter-spacing:.08em; }
            #${DASHBOARD_ID} .ct-alert-why { margin-top:5px; color:#fff; font-size:10px; font-weight:800; line-height:1.35; }
            #${DASHBOARD_ID} .ct-alert-action { margin-top:3px; color:rgba(255,255,255,.64); font-size:9px; font-weight:650; line-height:1.35; }
            #${DASHBOARD_ID} .ct-alert-buttons { display:flex; flex-direction:column; justify-content:center; gap:5px; min-width:72px; }
            #${DASHBOARD_ID} .ct-alert-btn { min-width:72px; padding:6px 7px; border:1px solid rgba(255,255,255,.20); border-radius:6px; color:#fff; background:rgba(255,255,255,.08); font-size:8px; font-weight:950; letter-spacing:.04em; }
            #${DASHBOARD_ID} .ct-alert-btn-primary { background:#2563eb; border-color:#7eabff; box-shadow:0 3px 10px rgba(37,99,235,.28); }
            #${DASHBOARD_ID} .ct-alert-btn:hover { filter:brightness(1.12); transform:translateY(-1px); }
            #${DASHBOARD_ID} .ct-alert.is-critical { border-left-color:#ff4d5f; background:linear-gradient(90deg,rgba(255,58,76,.25),rgba(25,34,53,.94) 62%); }
            #${DASHBOARD_ID} .ct-alert.is-warning { border-left-color:#ffbf3f; background:linear-gradient(90deg,rgba(255,177,31,.22),rgba(25,34,53,.94) 62%); }
            #${DASHBOARD_ID} .ct-all-clear { min-height:52px; display:flex; align-items:center; gap:10px; padding:9px 11px; border:1px solid rgba(57,229,140,.22); border-radius:8px; background:linear-gradient(90deg,rgba(57,229,140,.10),rgba(255,255,255,.035)); color:#fff; }
            #${DASHBOARD_ID} .ct-all-clear-icon { width:25px; height:25px; display:grid; place-items:center; border-radius:50%; background:rgba(57,229,140,.16); color:#5df0a2; font-size:13px; font-weight:950; }
            #${DASHBOARD_ID} .ct-all-clear div:nth-child(2) { display:flex; flex-direction:column; gap:2px; min-width:0; }
            #${DASHBOARD_ID} .ct-all-clear strong { font-size:10px; letter-spacing:.07em; }
            #${DASHBOARD_ID} .ct-all-clear span { color:rgba(255,255,255,.62); font-size:9px; }
            #${DASHBOARD_ID} .ct-all-clear-live { margin-left:auto; padding:4px 6px; border-radius:999px; color:#5df0a2 !important; background:rgba(57,229,140,.08); font-size:7px !important; font-weight:950 !important; letter-spacing:.08em; }
            #${DASHBOARD_ID} .ct-insights-panel { margin-top:7px; padding:9px; border:1px solid rgba(148,163,184,.28); border-radius:10px; background:var(--ct-surface); box-shadow:0 5px 18px rgba(15,23,42,.08); }
            #${DASHBOARD_ID} .ct-insights-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:7px; }
            #${DASHBOARD_ID} .ct-insights-head div { display:flex; flex-direction:column; gap:2px; }
            #${DASHBOARD_ID} .ct-insights-head strong { color:var(--ct-text); font-size:9px; letter-spacing:.07em; }
            #${DASHBOARD_ID} .ct-insights-head span { color:var(--ct-muted); font-size:8px; }
            #${DASHBOARD_ID} .ct-insights-head > span { padding:3px 6px; border-radius:999px; background:var(--ct-green-bg); color:var(--ct-green); font-size:7px; font-weight:950; }
            #${DASHBOARD_ID} .ct-insights-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:5px; }
            #${DASHBOARD_ID} .ct-insight { min-width:0; min-height:54px; padding:7px 8px; border:1px solid var(--ct-border); border-radius:7px; background:var(--ct-surface-2); }
            #${DASHBOARD_ID} .ct-insight-label { color:var(--ct-muted); font-size:7px; font-weight:900; letter-spacing:.05em; text-transform:uppercase; }
            #${DASHBOARD_ID} .ct-insight-value { margin-top:4px; overflow:hidden; color:var(--ct-text); font-size:10px; font-weight:950; line-height:1.25; text-overflow:ellipsis; white-space:nowrap; }
            #${DASHBOARD_ID} .ct-focus-flash { animation:ctFocusFlash .9s ease 1; }
            @keyframes ctFocusFlash { 0%,100%{box-shadow:0 0 0 rgba(37,99,235,0)} 40%{box-shadow:0 0 0 3px rgba(37,99,235,.35),0 8px 25px rgba(37,99,235,.25)} }
            #${DASHBOARD_ID}.is-panel-collapsed .ct-insights-panel { display:none; }
            @media (max-width: 620px) { #${DASHBOARD_ID} .ct-insights-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } #${DASHBOARD_ID} .ct-alert { grid-template-columns:1fr; } #${DASHBOARD_ID} .ct-alert-buttons { flex-direction:row; } }

        `;
        style.textContent += `
            /* v11.0.6 command-center visual + interaction hardening */
            #${DASHBOARD_ID} .ct-summary-controls { display:flex; align-items:center; gap:7px; margin-left:auto; }
            #${DASHBOARD_ID} .ct-feed-poll { color:rgba(255,255,255,.72); font-size:10px; font-weight:800; white-space:nowrap; }
            #${DASHBOARD_ID} .ct-header-refresh { width:30px; height:29px; border:1px solid rgba(255,255,255,.24); border-radius:7px; color:#fff; background:rgba(255,255,255,.10); font-size:17px; font-weight:900; cursor:pointer; }
            #${DASHBOARD_ID} .ct-header-refresh:hover { background:rgba(255,255,255,.18); }
            #${DASHBOARD_ID} .ct-operating-panel { display:flex; flex-direction:column; gap:10px; margin-top:7px; padding:10px; border-radius:10px; border:1px solid rgba(148,163,184,.28); background:linear-gradient(180deg,rgba(15,23,42,.98),rgba(13,21,36,.98)); box-shadow:0 8px 22px rgba(0,0,0,.16); color:#f8fafc; }
            #${DASHBOARD_ID}[data-theme="dark"] .ct-operating-panel { background:linear-gradient(180deg,rgba(15,23,42,.98),rgba(13,21,36,.98)); color:#f8fafc; }
            #${DASHBOARD_ID} .ct-operating-identity { border:1px solid rgba(148,163,184,.28); border-radius:8px; padding:7px 11px; background:linear-gradient(180deg,rgba(30,41,59,.85) 0%,rgba(15,23,42,.95) 100%); min-width:0; box-shadow:0 3px 10px rgba(0,0,0,.2); }
            #${DASHBOARD_ID} .ct-operating-identity-top { display:flex; align-items:center; justify-content:space-between; gap:8px; padding-bottom:5px; border-bottom:1px solid rgba(148,163,184,.18); }
            #${DASHBOARD_ID} .ct-operating-eyebrow { color:#38bdf8; font-size:9.5px; font-weight:950; letter-spacing:.08em; text-transform:uppercase; }
            #${DASHBOARD_ID} .ct-operating-name-row { display:flex; align-items:center; gap:8px; margin-top:5px; min-width:0; }
            #${DASHBOARD_ID} .ct-operating-name-row strong { color:#f8fafc; font-size:16px; font-weight:950; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
            #${DASHBOARD_ID} .ct-operating-target { color:#38bdf8; font-size:16px; font-weight:900; }
            #${DASHBOARD_ID} .ct-operating-live { padding:2px 8px; border:1px solid rgba(34,197,94,.45); border-radius:999px; color:#4ade80; background:rgba(34,197,94,.15); font-size:9.5px; font-weight:900; letter-spacing:.06em; }
            #${DASHBOARD_ID} .ct-operating-live.is-neutral { color:#94a3b8; border-color:rgba(148,163,184,.3); background:rgba(148,163,184,.1); }
            #${DASHBOARD_ID} .ct-operating-meta { display:inline-flex; align-items:center; gap:10px; }
            #${DASHBOARD_ID} .ct-operating-meta span { display:inline-flex; align-items:center; gap:4px; }
            #${DASHBOARD_ID} .ct-operating-meta b { color:#94a3b8; font-size:8.5px; text-transform:uppercase; letter-spacing:.05em; font-weight:800; }
            #${DASHBOARD_ID} .ct-operating-meta strong { color:#f8fafc; font-size:10.5px; font-weight:900; font-variant-numeric:tabular-nums; }
            #${DASHBOARD_ID} .ct-operating-selected-list { display:inline-flex; align-items:center; gap:5px; margin-left:auto; }
            #${DASHBOARD_ID} .ct-operating-chip { display:inline-flex; align-items:center; gap:5px; padding:2px 7px; border-radius:4px; font-size:9.5px; background:rgba(15,23,42,.65); border:1px solid rgba(148,163,184,.22); color:#cbd5e1; }
            #${DASHBOARD_ID} .ct-operating-chip.is-live { border-color:rgba(34,197,94,.35); color:#86efac; background:rgba(34,197,94,.1); }
            #${DASHBOARD_ID} .ct-operating-chip.is-neutral { border-color:rgba(148,163,184,.25); color:#94a3b8; }
            #${DASHBOARD_ID} .ct-operating-metrics { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:0; border:1px solid rgba(148,163,184,.22); border-radius:8px; background:rgba(15,23,42,.7); overflow:hidden; }
            #${DASHBOARD_ID} .ct-operating-metric { min-width:0; padding:8px 10px; border-right:1px solid rgba(148,163,184,.15); border-bottom:1px solid rgba(148,163,184,.15); }
            #${DASHBOARD_ID} .ct-operating-metric:nth-child(5n) { border-right:0; }
            #${DASHBOARD_ID} .ct-operating-metric:nth-child(n+6) { border-bottom:0; }
            #${DASHBOARD_ID} .ct-operating-metric b { display:block; color:#94a3b8; font-size:8.5px; font-weight:850; white-space:nowrap; text-transform:uppercase; letter-spacing:.05em; }
            #${DASHBOARD_ID} .ct-operating-metric strong { display:block; margin-top:3px; color:#f8fafc; font-size:16px; font-weight:900; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-variant-numeric:tabular-nums; }
            #${DASHBOARD_ID} .ct-operating-metric small { display:block; margin-top:2px; color:#94a3b8; font-size:8.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            #${DASHBOARD_ID} .ct-operating-metric-value.is-critical { color:#f87171 !important; font-weight:900; }
            #${DASHBOARD_ID} .ct-operating-metric-value.is-warning { color:#fbbf24 !important; font-weight:900; }
            #${DASHBOARD_ID} .ct-operating-metric-value.is-good { color:#4ade80 !important; font-weight:900; }
            #${DASHBOARD_ID} .ct-operating-metric-value.is-highlight { color:#38bdf8 !important; font-weight:900; }
            #${DASHBOARD_ID} .ct-operating-metric-value.is-neutral { color:#94a3b8 !important; }
            @media (max-width: 980px) { #${DASHBOARD_ID} .ct-operating-panel { grid-template-columns:1fr; } }
            @media (max-width: 620px) { #${DASHBOARD_ID} .ct-operating-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); } #${DASHBOARD_ID} .ct-operating-metric:nth-child(4n) { border-right:1px solid #cbd5e1; } #${DASHBOARD_ID} .ct-operating-metric:nth-child(2n) { border-right:0; } }
            #${DASHBOARD_ID} .ct-header-collapse { display:inline-flex; align-items:center; justify-content:center; min-width:74px; height:29px; padding:0 9px; border:1px solid rgba(255,255,255,.24); border-radius:7px; color:#fff; background:rgba(255,255,255,.10); font-size:9px; font-weight:950; letter-spacing:.03em; cursor:pointer; }
            #${DASHBOARD_ID} .ct-header-collapse:hover { background:rgba(255,255,255,.18); border-color:rgba(255,255,255,.42); }
            #${DASHBOARD_ID}.is-panel-collapsed .ct-header-collapse { display:inline-flex !important; }
            #${DASHBOARD_ID}.is-panel-collapsed .ct-summary { cursor:default; }
            #${DASHBOARD_ID} .ct-insights-panel { margin-top:10px; padding:10px 12px; border:1px solid rgba(148,163,184,.28); border-radius:10px; background:linear-gradient(180deg,rgba(15,23,42,.98),rgba(13,21,36,.98)); box-shadow:0 8px 22px rgba(0,0,0,.16); color:#f8fafc; }
            #${DASHBOARD_ID} .ct-insights-head { display:flex; align-items:center; justify-content:space-between; padding:2px 2px 7px; border-bottom:1px solid rgba(148,163,184,.18); margin-bottom:8px; }
            #${DASHBOARD_ID} .ct-insights-head strong { font-size:11px; font-weight:900; color:#f8fafc; letter-spacing:.08em; }
            #${DASHBOARD_ID} .ct-insights-head span { font-size:9px; color:#94a3b8; }
            #${DASHBOARD_ID} .ct-insights-head > span { background:rgba(148,163,184,.12); color:#cbd5e1; border:1px solid rgba(148,163,184,.25); padding:2px 8px; border-radius:999px; font-size:9px; font-weight:850; }
            #${DASHBOARD_ID} .ct-insights-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:7px; }
            #${DASHBOARD_ID} .ct-insight { position:relative; overflow:hidden; min-height:72px; padding:8px 10px 8px 13px; border:1px solid rgba(148,163,184,.2); border-radius:8px; background:linear-gradient(180deg,rgba(30,41,59,.75) 0%,rgba(20,29,46,.9) 100%); box-shadow:0 2px 8px rgba(0,0,0,.15); }
            #${DASHBOARD_ID} .ct-insight-accent { position:absolute; left:0; top:0; bottom:0; width:4px; background:#64748b; }
            #${DASHBOARD_ID} .ct-insight-top { display:flex; align-items:center; justify-content:space-between; gap:6px; }
            #${DASHBOARD_ID} .ct-insight-label { color:#94a3b8; font-size:8px; font-weight:950; letter-spacing:.07em; text-transform:uppercase; }
            #${DASHBOARD_ID} .ct-insight-state { padding:1px 6px; border-radius:999px; background:rgba(148,163,184,.15); color:#cbd5e1; font-size:7.5px; font-weight:950; letter-spacing:.05em; border:1px solid rgba(148,163,184,.25); }
            #${DASHBOARD_ID} .ct-insight-value { margin-top:5px; color:#f8fafc; font-size:16px; font-weight:950; line-height:1.1; font-variant-numeric:tabular-nums; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            #${DASHBOARD_ID} .ct-insight-campaign { margin-top:4px; color:#8fa0b5; font-size:8.5px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            #${DASHBOARD_ID} .ct-insight.is-critical { border-color:rgba(239,68,68,.5); background:linear-gradient(180deg,rgba(239,68,68,.16),rgba(20,29,46,.95)); }
            #${DASHBOARD_ID} .ct-insight.is-critical .ct-insight-accent { background:#ef4444; }
            #${DASHBOARD_ID} .ct-insight.is-critical .ct-insight-value { color:#f87171; }
            #${DASHBOARD_ID} .ct-insight.is-critical .ct-insight-state { background:rgba(239,68,68,.25); color:#fca5a5; border-color:rgba(239,68,68,.4); }
            #${DASHBOARD_ID} .ct-insight.is-warning { border-color:rgba(245,158,11,.5); background:linear-gradient(180deg,rgba(245,158,11,.16),rgba(20,29,46,.95)); }
            #${DASHBOARD_ID} .ct-insight.is-warning .ct-insight-accent { background:#f59e0b; }
            #${DASHBOARD_ID} .ct-insight.is-warning .ct-insight-value { color:#fbbf24; }
            #${DASHBOARD_ID} .ct-insight.is-warning .ct-insight-state { background:rgba(245,158,11,.25); color:#fde047; border-color:rgba(245,158,11,.4); }
            #${DASHBOARD_ID} .ct-insight.is-good { border-color:rgba(34,197,94,.35); background:linear-gradient(180deg,rgba(34,197,94,.12),rgba(20,29,46,.95)); }
            #${DASHBOARD_ID} .ct-insight.is-good .ct-insight-accent { background:#22c55e; }
            #${DASHBOARD_ID} .ct-insight.is-good .ct-insight-value { color:#4ade80; }
            #${DASHBOARD_ID} .ct-insight.is-good .ct-insight-state { background:rgba(34,197,94,.22); color:#86efac; border-color:rgba(34,197,94,.35); }
            #${DASHBOARD_ID} .ct-insight.is-info { border-color:rgba(59,130,246,.35); background:linear-gradient(180deg,rgba(59,130,246,.12),rgba(20,29,46,.95)); }
            #${DASHBOARD_ID} .ct-insight.is-info .ct-insight-accent { background:#3b82f6; }
            #${DASHBOARD_ID} .ct-insight.is-info .ct-insight-value { color:#60a5fa; }
            #${DASHBOARD_ID} .ct-insight.is-info .ct-insight-state { background:rgba(59,130,246,.22); color:#93c5fd; border-color:rgba(59,130,246,.35); }
            #${DASHBOARD_ID} .ct-insight.is-neutral { border-color:rgba(148,163,184,.2); background:rgba(30,41,59,.5); }
            #${DASHBOARD_ID} .ct-insight.is-neutral .ct-insight-accent { background:#64748b; }
            #${DASHBOARD_ID} .ct-insight.is-neutral .ct-insight-value { color:#cbd5e1; }
            #${DASHBOARD_ID} .ct-insight.is-neutral .ct-insight-state { background:rgba(148,163,184,.15); color:#94a3b8; }
            @media (max-width: 980px) { #${DASHBOARD_ID} .ct-insights-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
            @media (max-width: 620px) { #${DASHBOARD_ID} .ct-insights-grid { grid-template-columns:1fr 1fr; } #${DASHBOARD_ID} .ct-header-collapse { min-width:62px; } }
        `;

        style.textContent += `
            /* v11.0.7 final visual hardening */
            #${DASHBOARD_ID} { width:min(1040px,calc(100vw - 24px)); max-height:calc(100vh - 24px); }
            #${DASHBOARD_ID} .ct-summary { padding:12px; }
            #${DASHBOARD_ID} .ct-title h2 { font-size:18px; font-weight:950; }
            #${DASHBOARD_ID} .ct-updated { font-size:10px; font-weight:650; }
            #${DASHBOARD_ID} .ct-kpis { grid-template-columns:repeat(10,minmax(0,1fr)); gap:7px; }
            #${DASHBOARD_ID} .ct-kpi { min-height:64px; padding:9px; }
            #${DASHBOARD_ID} .ct-kpi-label { font-size:8px; }
            #${DASHBOARD_ID} .ct-kpi-value { font-size:18px; }
            #${DASHBOARD_ID} .ct-kpi-note { font-size:9px; }
            #${DASHBOARD_ID} .ct-alerts { min-height:150px; }
            #${DASHBOARD_ID} .ct-alert { min-height:82px; }
            #${DASHBOARD_ID} .ct-alert-buttons { min-width:84px; }
            #${DASHBOARD_ID} .ct-alert-btn { min-width:84px; }
            /* v11.1.24 insight compactness: pressure signals should be scannable,
               not dominate the command center vertically. */
            #${DASHBOARD_ID} .ct-insights-grid { grid-template-columns:repeat(4,minmax(0,1fr)); gap:7px; }
            #${DASHBOARD_ID} .ct-insight { min-height:70px; padding:8px 10px 8px 12px; }
            #${DASHBOARD_ID} .ct-insight-label { font-size:7px; }
            #${DASHBOARD_ID} .ct-insight-state { font-size:6px; }
            #${DASHBOARD_ID} .ct-insight-value { margin-top:5px; font-size:17px; }
            #${DASHBOARD_ID} .ct-insight-campaign { margin-top:4px; font-size:8px; font-weight:900; }
            @media (max-width: 760px) {
                #${DASHBOARD_ID} .ct-insights-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
                #${DASHBOARD_ID} .ct-insight { min-height:66px; }
            }
            #${DASHBOARD_ID} .ct-operating-panel { grid-template-columns:270px minmax(0,1fr); gap:12px; padding:11px; }
            #${DASHBOARD_ID} .ct-operating-metrics { grid-template-columns:repeat(5,minmax(0,1fr)); }
            #${DASHBOARD_ID} .ct-operating-metric:nth-child(4n) { border-right:1px solid #cbd5e1; }
            #${DASHBOARD_ID} .ct-operating-metric:nth-child(5n) { border-right:0; }
            #${DASHBOARD_ID} .ct-operating-metric:nth-child(n+6) { border-bottom:0; }
            #${DASHBOARD_ID} .ct-operating-metric:nth-child(n+5) { border-bottom:1px solid #cbd5e1; }
            #${DASHBOARD_ID} .ct-operating-metric:nth-child(n+6) { border-bottom:0; }
            #${DASHBOARD_ID} .ct-operating-metric strong { font-size:18px; }
            #${DASHBOARD_ID} .ct-command-strip { min-height:58px; }
            #${DASHBOARD_ID} .ct-campaigns-head { margin-top:2px; }
            #${DASHBOARD_ID} .ct-table-head, #${DASHBOARD_ID} .ct-card-head { grid-template-columns:34px minmax(190px,2.1fr) 82px 88px 70px 70px 82px 88px 82px 100px 100px 100px 138px; }
            #${DASHBOARD_ID} .ct-card-head { min-height:64px; }
            #${DASHBOARD_ID} .ct-name { font-size:14px; font-weight:950; }
            #${DASHBOARD_ID} .ct-meta { font-size:9px; }
            #${DASHBOARD_ID} .ct-row-value { font-size:13px; }
            #${DASHBOARD_ID} .ct-row-action { width:auto; min-width:31px; padding:0 7px; font-size:8px; letter-spacing:.02em; }
            #${DASHBOARD_ID} .ct-details-action { min-width:58px; }
            #${DASHBOARD_ID} .ct-order-hint { font-size:10px; font-weight:750; }
            #${DASHBOARD_ID} .ct-header-collapse { min-width:82px; font-size:10px; }
            @media (max-width: 980px) {
                #${DASHBOARD_ID} .ct-kpis { grid-template-columns:repeat(4,minmax(0,1fr)); }
                #${DASHBOARD_ID} .ct-operating-panel { grid-template-columns:1fr; }
                #${DASHBOARD_ID} .ct-operating-metrics { grid-template-columns:repeat(5,minmax(0,1fr)); }
            }
            @media (max-width: 700px) {
                #${DASHBOARD_ID} .ct-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); }
                #${DASHBOARD_ID} .ct-operating-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); }
                #${DASHBOARD_ID} .ct-operating-metric:nth-child(5n), #${DASHBOARD_ID} .ct-operating-metric:nth-child(4n) { border-right:1px solid #cbd5e1; }
                #${DASHBOARD_ID} .ct-operating-metric:nth-child(2n) { border-right:0; }
                #${DASHBOARD_ID} .ct-operating-metric:nth-child(n+6) { border-bottom:0; }
            }
        `;

        style.textContent += `
            /* v11.1.9 hard-lock interaction fixes */
            #${DASHBOARD_ID} .ct-alert-buttons { flex-direction:row; align-items:center; justify-content:flex-end; min-width:auto; flex-wrap:wrap; }
            #${DASHBOARD_ID} .ct-alert-btn { min-width:78px; height:30px; padding:0 8px; }
            #${DASHBOARD_ID} .ct-alert-btn-secondary { background:rgba(59,130,246,.14); border-color:rgba(126,171,255,.46); }
            #${DASHBOARD_ID} .ct-alert-btn-dismiss { background:rgba(255,255,255,.06); }
            #${DASHBOARD_ID} .ct-campaigns-head { margin-top:18px; border-top:2px solid rgba(148,163,184,.30); padding-top:10px; }
            #${DASHBOARD_ID} .ct-filter-bar { margin-bottom:6px; }
            #${DASHBOARD_ID} .ct-table-head { position:relative; }
            @media (max-width: 700px) { #${DASHBOARD_ID} .ct-alert-buttons { justify-content:flex-start; } }

            #${DASHBOARD_ID} .ct-zoom-controls { display:inline-flex; align-items:center; height:29px; border:1px solid rgba(255,255,255,.24); border-radius:7px; overflow:hidden; background:rgba(0,0,0,.18); }
            #${DASHBOARD_ID} .ct-zoom-controls button { width:27px; height:29px; border:0; border-right:1px solid rgba(255,255,255,.16); color:#fff; background:transparent; font-size:14px; font-weight:950; cursor:pointer; }
            #${DASHBOARD_ID} .ct-zoom-controls button:last-child { border-right:0; }
            #${DASHBOARD_ID} .ct-zoom-controls button:hover { background:rgba(255,255,255,.16); }
            #${DASHBOARD_ID} .ct-zoom-controls button[data-zoom-value] { width:48px; font-size:9px; letter-spacing:.04em; }
            #${DASHBOARD_ID} .ct-alerts { border:1px solid rgba(148,163,184,.32); background:linear-gradient(180deg,rgba(15,23,42,.98),rgba(10,16,30,.98)); box-shadow:0 12px 32px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.05); }
            #${DASHBOARD_ID} .ct-alert-title { padding:2px 2px 8px; }
            #${DASHBOARD_ID} .ct-alert-heading span:first-child { color:#f8fafc; font-size:13px; }
            #${DASHBOARD_ID} .ct-alert-counter { border:1px solid currentColor; box-shadow:0 0 14px rgba(255,255,255,.05); }
            #${DASHBOARD_ID} .ct-critical-counter { color:#ff5b67; background:rgba(220,38,38,.13); }
            #${DASHBOARD_ID} .ct-warning-counter { color:#ffbd55; background:rgba(245,158,11,.12); }
            #${DASHBOARD_ID} .ct-alert { border:1px solid rgba(148,163,184,.24); border-left-width:5px; border-radius:9px; background:rgba(255,255,255,.035); box-shadow:0 5px 18px rgba(0,0,0,.18); }
            #${DASHBOARD_ID} .ct-alert.is-critical { border-color:rgba(255,76,86,.55); border-left-color:#ff3b4d; background:linear-gradient(90deg,rgba(220,38,38,.18),rgba(255,255,255,.035)); box-shadow:0 0 0 1px rgba(255,59,77,.08),0 8px 22px rgba(220,38,38,.12); }
            #${DASHBOARD_ID} .ct-alert.is-warning { border-color:rgba(255,184,69,.48); border-left-color:#ffb62e; background:linear-gradient(90deg,rgba(245,158,11,.15),rgba(255,255,255,.035)); box-shadow:0 0 0 1px rgba(255,182,46,.06),0 8px 22px rgba(245,158,11,.09); }
            #${DASHBOARD_ID} .ct-alert-campaign { color:#fff; font-size:13px; font-weight:950; letter-spacing:.01em; }
            #${DASHBOARD_ID} .ct-alert-severity { font-size:10px; font-weight:1000; letter-spacing:.08em; }
            #${DASHBOARD_ID} .ct-alert-why { color:#f8fafc; font-size:11px; font-weight:800; }
            #${DASHBOARD_ID} .ct-alert-action { color:#aebbd0; font-size:10px; }
            #${DASHBOARD_ID} .ct-alert button { border:1px solid rgba(255,255,255,.2); border-radius:6px; }
            @media (max-width: 760px) { #${DASHBOARD_ID} .ct-zoom-controls { display:none; } }

            /* v11.1.24 command-bar fit and scanability lock */
            #${DASHBOARD_ID} .ct-actions {
                display:flex !important;
                flex-wrap:wrap;
                align-items:flex-end;
                gap:6px;
                width:100%;
                min-width:0;
            }
            #${DASHBOARD_ID} .ct-search { flex:1 1 240px; min-width:180px; }
            #${DASHBOARD_ID} .ct-threshold-wrap { flex:0 0 92px; }
            #${DASHBOARD_ID} .ct-operating-wrap { flex:1 1 220px; min-width:190px; z-index:30; }
            #${DASHBOARD_ID} .ct-refresh-btn, #${DASHBOARD_ID} .ct-manage-order-btn, #${DASHBOARD_ID} .ct-order-reset-btn, #${DASHBOARD_ID} .ct-theme-btn, #${DASHBOARD_ID} .ct-reset-btn { flex:0 0 auto; }
            #${DASHBOARD_ID} .ct-operating-menu { z-index:100001; }

            /* Stronger operating-set hierarchy */
            #${DASHBOARD_ID} .ct-operating-panel { position:relative; overflow:hidden; border:1px solid rgba(148,163,184,.28); }
            #${DASHBOARD_ID} .ct-operating-panel::before { content:""; position:absolute; left:0; top:0; bottom:0; width:4px; background:linear-gradient(#16a36a,#3b82f6); }
            #${DASHBOARD_ID} .ct-operating-identity { background:linear-gradient(180deg,rgba(30,41,59,.85) 0%,rgba(15,23,42,.95) 100%); }
            #${DASHBOARD_ID} .ct-operating-eyebrow { color:#38bdf8; }
            #${DASHBOARD_ID} .ct-operating-caption { margin-top:3px; color:#94a3b8; font-size:8.5px; font-weight:700; }
            #${DASHBOARD_ID} .ct-operating-summary-bar { border:1px solid rgba(148,163,184,.22); border-radius:9px; overflow:hidden; background:transparent; }
            #${DASHBOARD_ID} .ct-operating-summary-item { min-width:0; }
            #${DASHBOARD_ID} .ct-operating-summary-item strong { font-size:16px; }
            #${DASHBOARD_ID} .ct-operating-campaign-grid { margin-top:8px; }
            #${DASHBOARD_ID} .ct-operating-campaign-card { border:1px solid rgba(148,163,184,.28); border-radius:9px; background:linear-gradient(180deg,rgba(20,30,48,.95),rgba(15,23,42,.98)); box-shadow:0 5px 16px rgba(0,0,0,.22); }
            #${DASHBOARD_ID} .ct-operating-campaign-head { background:rgba(30,41,59,.85); border:1px solid rgba(148,163,184,.2); border-radius:6px; }

            /* Compact insight cards with clearer priority/value separation */
            #${DASHBOARD_ID} .ct-insights-panel { padding:10px 12px; }
            #${DASHBOARD_ID} .ct-insights-head { margin-bottom:6px; }
            #${DASHBOARD_ID} .ct-insights-head strong { font-size:11px; letter-spacing:.08em; color:#f8fafc; }
            #${DASHBOARD_ID} .ct-insights-head div span { font-size:8.5px; color:#94a3b8; }
            #${DASHBOARD_ID} .ct-insights-grid { gap:6px; }
            #${DASHBOARD_ID} .ct-insight { min-height:68px; padding:8px 10px 8px 12px; }
            #${DASHBOARD_ID} .ct-insight-value { margin-top:5px; font-size:16px; color:#f8fafc; }
            #${DASHBOARD_ID} .ct-insight-campaign { margin-top:4px; font-size:8.5px; color:#94a3b8; }
            @media (max-width: 1080px) {
                #${DASHBOARD_ID} .ct-actions { gap:5px; }
                #${DASHBOARD_ID} .ct-search { flex-basis:210px; }
                #${DASHBOARD_ID} .ct-operating-wrap { flex-basis:210px; }
            }
        `;


        style.textContent += `
            /* v11.1.20 operating campaign selector and multi-campaign summary */
            #${DASHBOARD_ID} .ct-operating-wrap { position:relative; min-width:190px; z-index:20; }
            #${DASHBOARD_ID} .ct-operating-trigger { width:100%; min-height:34px; display:grid; grid-template-columns:minmax(0,1fr) auto 14px; align-items:center; gap:7px; padding:0 9px; border:1px solid rgba(255,255,255,.24); border-radius:7px; color:#fff; background:rgba(255,255,255,.10); cursor:pointer; text-align:left; }
            #${DASHBOARD_ID} .ct-operating-trigger:hover { background:rgba(255,255,255,.16); }
            #${DASHBOARD_ID} .ct-operating-trigger.has-selection { border-color:rgba(82,220,150,.55); box-shadow:0 0 0 1px rgba(82,220,150,.08); }
            #${DASHBOARD_ID} .ct-operating-trigger-text { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:10px; font-weight:850; }
            #${DASHBOARD_ID} .ct-operating-trigger-count { min-width:20px; height:18px; display:inline-grid; place-items:center; border-radius:999px; background:rgba(82,220,150,.18); color:#9ef0c5; font-size:9px; font-weight:950; }
            #${DASHBOARD_ID} .ct-operating-trigger-arrow { color:#b8c4d6; font-size:12px; }
            #${DASHBOARD_ID} .ct-operating-menu { position:absolute; top:calc(100% + 6px); left:0; width:min(360px,42vw); max-height:360px; overflow:auto; padding:8px; border:1px solid rgba(148,163,184,.46); border-radius:9px; background:#111a2b; box-shadow:0 18px 42px rgba(0,0,0,.36); z-index:100000; }
            #${DASHBOARD_ID} .ct-operating-menu[hidden] { display:none !important; }
            #${DASHBOARD_ID} .ct-operating-menu-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:3px 3px 8px; color:#f8fafc; font-size:10px; }
            #${DASHBOARD_ID} .ct-operating-menu-head button { border:0; background:transparent; color:#93c5fd; cursor:pointer; font-size:9px; font-weight:900; }
            #${DASHBOARD_ID} .ct-operating-options { display:grid; gap:5px; }
            #${DASHBOARD_ID} .ct-operating-option { width:100%; display:grid; grid-template-columns:22px minmax(0,1fr); align-items:center; gap:8px; padding:8px; border:1px solid rgba(148,163,184,.22); border-radius:7px; color:#fff; background:rgba(255,255,255,.035); cursor:pointer; text-align:left; }
            #${DASHBOARD_ID} .ct-operating-option:hover { background:rgba(255,255,255,.08); }
            #${DASHBOARD_ID} .ct-operating-option.is-selected { border-color:rgba(82,220,150,.55); background:rgba(21,115,71,.14); }
            #${DASHBOARD_ID} .ct-operating-check { width:18px; height:18px; display:grid; place-items:center; border:1px solid rgba(203,213,225,.5); border-radius:4px; color:#fff; font-size:11px; font-weight:1000; }
            #${DASHBOARD_ID} .ct-operating-option.is-selected .ct-operating-check { border-color:#42d392; background:#157347; }
            #${DASHBOARD_ID} .ct-operating-option-main { min-width:0; display:flex; align-items:baseline; justify-content:space-between; gap:8px; }
            #${DASHBOARD_ID} .ct-operating-option-main b { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:10px; }
            #${DASHBOARD_ID} .ct-operating-option-main small { color:#9fb0c7; font-size:8px; white-space:nowrap; }
            #${DASHBOARD_ID} .ct-operating-menu-foot { margin-top:7px; padding:7px 3px 1px; border-top:1px solid rgba(148,163,184,.18); color:#94a3b8; font-size:8px; line-height:1.35; }
            #${DASHBOARD_ID} .ct-operating-selected-list { display:flex; flex-wrap:wrap; gap:5px; margin-top:9px; }
            #${DASHBOARD_ID} .ct-operating-chip { display:inline-flex; align-items:center; gap:6px; max-width:100%; padding:3px 7px; border:1px solid rgba(148,163,184,.3); border-radius:999px; background:rgba(30,41,59,.7); color:#f8fafc; }
            #${DASHBOARD_ID} .ct-operating-chip.is-live { border-color:rgba(34,197,94,.4); background:rgba(34,197,94,.12); color:#4ade80; }
            #${DASHBOARD_ID} .ct-operating-chip b { max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:9px; color:#f8fafc; }
            #${DASHBOARD_ID} .ct-operating-chip small { color:#94a3b8; font-size:8px; white-space:nowrap; }
            #${DASHBOARD_ID} .ct-operating-empty { color:#94a3b8; font-size:9px; }
            #${DASHBOARD_ID} .ct-operating-right { min-width:0; display:grid; gap:9px; }
            #${DASHBOARD_ID} .ct-operating-summary-bar { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:6px; border:none; border-radius:8px; background:transparent; overflow:hidden; }
            #${DASHBOARD_ID} .ct-operating-summary-item { min-width:0; padding:6px 9px; border:1px solid rgba(148,163,184,.22); border-radius:6px; background:linear-gradient(180deg,rgba(30,41,59,.78) 0%,rgba(15,23,42,.92) 100%); }
            #${DASHBOARD_ID} .ct-operating-summary-item b { display:block; color:#94a3b8; font-size:8.5px; font-weight:850; text-transform:uppercase; letter-spacing:.05em; }
            #${DASHBOARD_ID} .ct-operating-summary-item strong { display:block; margin-top:2px; color:#f8fafc; font-size:16px; font-weight:900; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-variant-numeric:tabular-nums; }
            #${DASHBOARD_ID} .ct-operating-campaign-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(330px,1fr)); gap:9px; }
            #${DASHBOARD_ID} .ct-operating-campaign-card { border:1px solid rgba(148,163,184,.24); border-radius:8px; background:linear-gradient(180deg,rgba(20,29,46,.95) 0%,rgba(13,20,34,.98) 100%); overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,.25); padding:8px 10px 10px; }
            #${DASHBOARD_ID} .ct-operating-campaign-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:6px 9px; margin-bottom:8px; border:1px solid rgba(148,163,184,.22); border-radius:6px; background:linear-gradient(180deg,rgba(30,41,59,.85) 0%,rgba(15,23,42,.95) 100%); }
            #${DASHBOARD_ID} .ct-operating-campaign-head b { color:#f8fafc; font-size:12px; font-weight:900; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
            #${DASHBOARD_ID} .ct-operating-campaign-state { flex:0 0 auto; padding:2px 7px; border-radius:999px; border:1px solid rgba(148,163,184,.35); color:#cbd5e1; background:rgba(148,163,184,.15); font-size:8.5px; font-weight:900; letter-spacing:.04em; }
            #${DASHBOARD_ID} .ct-operating-campaign-state.is-live { color:#4ade80; border-color:rgba(34,197,94,.45); background:rgba(34,197,94,.16); }
            #${DASHBOARD_ID} .ct-operating-agent-band, #${DASHBOARD_ID} .ct-operating-data-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:6px; }
            #${DASHBOARD_ID} .ct-operating-data-grid-half { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric { display:flex; flex-direction:column; justify-content:space-between; min-height:56px; padding:7px 9px; border-radius:6px; background:linear-gradient(180deg,rgba(30,41,59,.72) 0%,rgba(15,23,42,.88) 100%) !important; border:1px solid rgba(148,163,184,.22) !important; box-shadow:0 2px 6px rgba(0,0,0,.15); transition:border-color .15s ease, background .15s ease; }
            #${DASHBOARD_ID} .ct-operating-card-metric:hover { border-color:rgba(148,163,184,.45) !important; background:linear-gradient(180deg,rgba(30,41,59,.88) 0%,rgba(20,29,46,.96) 100%) !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric b { display:block; color:#94a3b8 !important; font-size:9px !important; font-weight:800 !important; text-transform:uppercase !important; letter-spacing:.05em !important; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            #${DASHBOARD_ID} .ct-operating-card-metric strong { display:block; margin-top:2px; margin-bottom:2px; color:#f8fafc !important; font-size:16px !important; font-weight:900 !important; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-variant-numeric:tabular-nums !important; line-height:1.15; }
            #${DASHBOARD_ID} .ct-operating-card-metric small { display:block; color:#cbd5e1 !important; font-size:8px !important; font-weight:600 !important; line-height:1.25; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; opacity:.82; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-critical { border-color:rgba(239,68,68,.6) !important; background:linear-gradient(180deg,rgba(239,68,68,.22) 0%,rgba(35,15,18,.9) 100%) !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-critical b { color:#fca5a5 !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-critical strong { color:#f87171 !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-critical small { color:#fca5a5 !important; opacity:.95 !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-warning { border-color:rgba(245,158,11,.55) !important; background:linear-gradient(180deg,rgba(245,158,11,.2) 0%,rgba(30,25,15,.9) 100%) !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-warning b { color:#fde68a !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-warning strong { color:#fbbf24 !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-warning small { color:#fcd34d !important; opacity:.95 !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-good { border-color:rgba(34,197,94,.45) !important; background:linear-gradient(180deg,rgba(34,197,94,.16) 0%,rgba(15,30,24,.9) 100%) !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-good b { color:#a7f3d0 !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-good strong { color:#4ade80 !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-good small { color:#86efac !important; opacity:.95 !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-highlight { border-color:rgba(56,189,248,.45) !important; background:linear-gradient(180deg,rgba(56,189,248,.16) 0%,rgba(15,25,40,.9) 100%) !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-highlight b { color:#bae6fd !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-highlight strong { color:#38bdf8 !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-highlight small { color:#7dd3fc !important; opacity:.95 !important; }
            #${DASHBOARD_ID} .ct-operating-campaign-empty { grid-column:1/-1; padding:18px; border:1px dashed rgba(148,163,184,.3); border-radius:8px; color:#94a3b8; background:rgba(15,23,42,.6); font-size:11px; font-weight:800; text-align:center; }
            @media (max-width:980px) { #${DASHBOARD_ID} .ct-operating-summary-bar { grid-template-columns:repeat(3,minmax(0,1fr)); } }
            @media (max-width:700px) { #${DASHBOARD_ID} .ct-operating-summary-bar { grid-template-columns:repeat(2,minmax(0,1fr)); } #${DASHBOARD_ID} .ct-operating-data-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
            @media (max-width:900px) { #${DASHBOARD_ID} .ct-operating-menu { width:min(330px,70vw); } }

            /* v11.1.25 final layout authority — prevent control overlap and make multi-campaign/insight scanning readable. */
            #${DASHBOARD_ID} .ct-actions {
                display: flex !important;
                flex-wrap: nowrap !important;
                overflow-x: auto !important;
                white-space: nowrap !important;
                align-items: center !important;
                gap: 6px !important;
                scrollbar-width: none !important;
                -ms-overflow-style: none !important;
            }
            #${DASHBOARD_ID} .ct-actions::-webkit-scrollbar { display: none !important; }
            #${DASHBOARD_ID} .ct-actions > .ct-btn { flex: 0 0 auto !important; white-space: nowrap !important; }
            #${DASHBOARD_ID} .ct-reset-btn { flex-shrink: 0 !important; white-space: nowrap !important; }
            #${DASHBOARD_ID} .ct-search { flex: 1 1 180px !important; min-width: 130px !important; }
            #${DASHBOARD_ID} .ct-threshold-wrap { flex: 0 0 88px !important; min-width: 80px !important; }
            #${DASHBOARD_ID} .ct-operating-wrap { flex: 0 1 190px !important; min-width: 160px !important; z-index: 40 !important; }
            #${DASHBOARD_ID} .ct-operating-label,
            #${DASHBOARD_ID} .ct-threshold-label { display:block; min-height:12px; white-space:nowrap; }
            #${DASHBOARD_ID} .ct-operating-trigger { position:relative; z-index:41; }
            #${DASHBOARD_ID} .ct-operating-menu { z-index:60; }

            #${DASHBOARD_ID} .ct-operating-panel {
                grid-template-columns:250px minmax(0,1fr);
                gap:10px;
                padding:10px;
            }
            #${DASHBOARD_ID} .ct-operating-identity { min-width:0; }
            #${DASHBOARD_ID} .ct-operating-summary-bar { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); }
            #${DASHBOARD_ID} .ct-operating-campaign-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(360px,1fr)); gap:8px; }
            #${DASHBOARD_ID} .ct-operating-campaign-card { min-width:0; }
            #${DASHBOARD_ID} .ct-operating-card-metric { min-width:0; }

            /* Insight cards use explicit grid lanes so long labels/status badges never overlap. */
            #${DASHBOARD_ID} .ct-insights-panel { padding:10px 11px 11px; }
            #${DASHBOARD_ID} .ct-insights-grid { grid-template-columns:repeat(4,minmax(0,1fr)); gap:7px; }
            #${DASHBOARD_ID} .ct-insight { min-width:0; min-height:82px; padding:10px 11px 9px 13px; display:grid; grid-template-rows:auto auto auto; align-content:start; }
            #${DASHBOARD_ID} .ct-insight-top { min-width:0; width:100%; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:7px; align-items:center; }
            #${DASHBOARD_ID} .ct-insight-label { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
            #${DASHBOARD_ID} .ct-insight-state { justify-self:end; flex:0 0 auto; max-width:72px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
            #${DASHBOARD_ID} .ct-insight-value { min-width:0; margin-top:6px; font-size:16px; line-height:1.05; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
            #${DASHBOARD_ID} .ct-insight-campaign { min-width:0; margin-top:5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

            #${DASHBOARD_ID} .ct-table-head,
            #${DASHBOARD_ID} .ct-card-head {
                min-width:1260px;
                grid-template-columns:34px minmax(190px,2.1fr) 82px 88px 70px 70px 82px 88px 82px 100px 100px 100px 138px;
            }
            #${DASHBOARD_ID} .ct-table-head { overflow:hidden; }
            #${DASHBOARD_ID} .ct-list { overflow-x:auto; }

            #${DASHBOARD_ID} .ct-section-divider { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:2px 0 8px; padding:7px 9px; border:1px solid var(--ct-border); border-radius:9px; background:var(--ct-surface-2); }
            #${DASHBOARD_ID} .ct-section-divider span { display:block; color:var(--ct-blue); font-size:10px; font-weight:900; letter-spacing:.12em; }
            #${DASHBOARD_ID} .ct-section-divider small { display:block; margin-top:2px; color:var(--ct-muted); font-size:8px; }
            #${DASHBOARD_ID} .ct-section-divider b { color:var(--ct-green); font-size:8px; letter-spacing:.1em; }
            #${DASHBOARD_ID} .ct-focus-grid { display:grid; grid-template-columns:minmax(300px,.58fr) minmax(720px,1.72fr); gap:10px; align-items:start; }
            #${DASHBOARD_ID} .ct-focus-column { min-width:0; padding:9px; border:1px solid var(--ct-border); border-radius:12px; background:var(--ct-surface); box-shadow:0 8px 24px rgba(15,23,42,.06); }
            #${DASHBOARD_ID} .ct-focus-column-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px; padding:0 1px 5px; border-bottom:1px solid var(--ct-border); }
            #${DASHBOARD_ID} .ct-focus-column-head span { color:var(--ct-blue); font-size:8px; font-weight:900; letter-spacing:.12em; }
            #${DASHBOARD_ID} .ct-focus-column-head small { display:block; margin-top:2px; color:var(--ct-muted); font-size:7px; }
            #${DASHBOARD_ID} .ct-focus-column-head b { padding:3px 6px; border-radius:999px; color:var(--ct-green); background:var(--ct-green-bg); border:1px solid #b8e1c7; font-size:8px; letter-spacing:.08em; }
            #${DASHBOARD_ID} .ct-focus-outbound .ct-operating-panel { margin-bottom:8px; }
            #${DASHBOARD_ID} .ct-focus-outbound .ct-insights-panel { margin:0; box-shadow:none; }
            #${DASHBOARD_ID} .ct-focus-inbound .ct-inbound-panel { margin:0; padding:0; border:0; box-shadow:none; background:transparent; }
            #${DASHBOARD_ID} .ct-focus-inbound .ct-inbound-kpis { grid-template-columns:repeat(5,minmax(0,1fr)); }
            #${DASHBOARD_ID} .ct-focus-inbound .ct-inbound-focus { grid-template-columns:1fr; }
            #${DASHBOARD_ID} .ct-focus-inbound .ct-inbound-focus-metrics { grid-template-columns:repeat(5,minmax(0,1fr)); }

            #${DASHBOARD_ID} .ct-inbound-panel { margin:0 0 10px; padding:11px; border:1px solid var(--ct-border); border-radius:12px; background:var(--ct-surface); box-shadow:0 8px 24px rgba(15,23,42,.08); }
            #${DASHBOARD_ID} .ct-inbound-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; }
            #${DASHBOARD_ID} .ct-inbound-head strong { display:block; font-size:15px; letter-spacing:.01em; }
            #${DASHBOARD_ID} .ct-inbound-head small { display:block; color:var(--ct-muted); font-size:9px; margin-top:2px; }
            #${DASHBOARD_ID} .ct-section-kicker { color:var(--ct-blue); font-size:9px; font-weight:800; letter-spacing:.14em; margin-bottom:2px; }
            #${DASHBOARD_ID} .ct-inbound-head-right { display:flex; align-items:center; gap:7px; }
            #${DASHBOARD_ID} .ct-inbound-live { padding:4px 8px; border-radius:999px; font-size:9px; font-weight:800; letter-spacing:.08em; background:var(--ct-surface-2); color:var(--ct-muted); border:1px solid var(--ct-border); }
            #${DASHBOARD_ID} .ct-inbound-live.is-live { color:var(--ct-green); background:var(--ct-green-bg); border-color:#b8e1c7; }
            #${DASHBOARD_ID} .ct-inbound-live.is-warning { color:var(--ct-amber); background:var(--ct-amber-bg); border-color:#f2d29b; }
            #${DASHBOARD_ID} .ct-inbound-refresh { border:1px solid var(--ct-border); background:var(--ct-surface-2); border-radius:8px; width:28px; height:28px; cursor:pointer; font-size:15px; color:var(--ct-text); }
            #${DASHBOARD_ID} .ct-inbound-hero { margin-top:8px; display:grid; grid-template-columns:1.55fr 1fr 1fr 1fr; gap:7px; }
            #${DASHBOARD_ID} .ct-inbound-hero-card { min-width:0; padding:10px 11px; border:1px solid var(--ct-border); border-radius:10px; background:var(--ct-surface-2); }
            #${DASHBOARD_ID} .ct-inbound-hero-card.is-primary { border-color:#8fb4ef; background:linear-gradient(135deg,var(--ct-surface-2),rgba(59,130,246,.08)); }
            #${DASHBOARD_ID} .ct-inbound-hero-label { font-size:8px; font-weight:900; letter-spacing:.1em; color:var(--ct-muted); }
            #${DASHBOARD_ID} .ct-inbound-hero-value { margin-top:4px; font-size:26px; line-height:1; font-weight:900; font-variant-numeric:tabular-nums; color:var(--ct-text); }
            #${DASHBOARD_ID} .ct-inbound-hero-value.is-good { color:var(--ct-green); }
            #${DASHBOARD_ID} .ct-inbound-hero-value.is-warning { color:var(--ct-amber); }
            #${DASHBOARD_ID} .ct-inbound-hero-value.is-critical { color:var(--ct-red); }
            #${DASHBOARD_ID} .ct-inbound-hero-note { margin-top:4px; font-size:8px; line-height:1.25; color:var(--ct-muted); white-space:normal; }
            #${DASHBOARD_ID} .ct-inbound-total-strip { margin-top:7px; display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:6px; }
            #${DASHBOARD_ID} .ct-inbound-kpi { min-width:0; padding:7px 8px; border:1px solid var(--ct-border); border-radius:8px; background:var(--ct-surface-2); }
            #${DASHBOARD_ID} .ct-inbound-kpi-label { font-size:8px; text-transform:uppercase; letter-spacing:.08em; color:var(--ct-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            #${DASHBOARD_ID} .ct-inbound-kpi-value { margin-top:3px; font-size:15px; font-weight:850; line-height:1.05; color:var(--ct-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            #${DASHBOARD_ID} .ct-inbound-kpi-note { margin-top:3px; font-size:8px; line-height:1.25; color:var(--ct-muted); white-space:normal; }
            #${DASHBOARD_ID} .ct-inbound-staffing { margin-top:7px; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; }
            #${DASHBOARD_ID} .ct-inbound-staff-item { min-width:0; padding:8px 9px; border:1px solid var(--ct-border); border-radius:8px; background:var(--ct-surface-2); }
            #${DASHBOARD_ID} .ct-inbound-staff-item b { display:block; font-size:8px; color:var(--ct-muted); text-transform:uppercase; letter-spacing:.07em; }
            #${DASHBOARD_ID} .ct-inbound-staff-item strong { display:block; margin-top:3px; font-size:16px; line-height:1.05; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            #${DASHBOARD_ID} .ct-inbound-staff-item small { display:block; margin-top:3px; color:var(--ct-muted); font-size:8px; line-height:1.3; white-space:normal; }
            #${DASHBOARD_ID} .ct-inbound-control { margin-top:8px; display:none; padding:9px; border:1px solid var(--ct-border); border-radius:10px; background:var(--ct-surface-2); }
            #${DASHBOARD_ID} .ct-inbound-control-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:7px; }
            #${DASHBOARD_ID} .ct-inbound-control-kicker { color:var(--ct-blue); font-size:8px; font-weight:900; letter-spacing:.12em; }
            #${DASHBOARD_ID} .ct-inbound-control-head strong { display:block; margin-top:2px; font-size:12px; line-height:1.15; }
            #${DASHBOARD_ID} .ct-inbound-control-head small { display:block; margin-top:2px; color:var(--ct-muted); font-size:8px; line-height:1.25; }
            #${DASHBOARD_ID} .ct-inbound-control-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:7px; }
            #${DASHBOARD_ID} .ct-inbound-control-group { min-width:0; padding:8px; border:1px solid var(--ct-border); border-radius:8px; background:var(--ct-surface); }
            #${DASHBOARD_ID} .ct-inbound-control-group.is-warning { border-color:#e9c57d; }
            #${DASHBOARD_ID} .ct-inbound-control-group.is-critical { border-color:#e3a6a0; }
            #${DASHBOARD_ID} .ct-inbound-control-group-title { display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:6px; }
            #${DASHBOARD_ID} .ct-inbound-control-group-title b { font-size:8px; color:var(--ct-muted); letter-spacing:.08em; }
            #${DASHBOARD_ID} .ct-inbound-control-group-title em { font-style:normal; font-size:7px; font-weight:900; padding:2px 5px; border-radius:999px; color:var(--ct-green); background:var(--ct-green-bg); }
            #${DASHBOARD_ID} .ct-inbound-control-group.is-warning .ct-inbound-control-group-title em { color:var(--ct-amber); background:var(--ct-amber-bg); }
            #${DASHBOARD_ID} .ct-inbound-control-group.is-critical .ct-inbound-control-group-title em { color:var(--ct-red); background:var(--ct-red-bg); }
            #${DASHBOARD_ID} .ct-inbound-metric-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:5px; }
            #${DASHBOARD_ID} .ct-inbound-metric { min-width:0; padding:6px; border:1px solid var(--ct-border); border-radius:7px; background:var(--ct-surface-2); }
            #${DASHBOARD_ID} .ct-inbound-metric.is-primary { border-color:#8fb4ef; }
            #${DASHBOARD_ID} .ct-inbound-metric b { display:block; font-size:7px; color:var(--ct-muted); letter-spacing:.06em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            #${DASHBOARD_ID} .ct-inbound-metric strong { display:block; margin-top:3px; font-size:15px; line-height:1; font-variant-numeric:tabular-nums; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            #${DASHBOARD_ID} .ct-inbound-metric small { display:block; margin-top:3px; font-size:7px; line-height:1.2; color:var(--ct-muted); min-height:17px; }

            #${DASHBOARD_ID} .ct-inbound-focus { margin-top:8px; display:grid; grid-template-columns:250px minmax(0,1fr); gap:10px; padding:10px; border:1px solid var(--ct-border); border-radius:10px; background:linear-gradient(90deg,var(--ct-surface-2),var(--ct-surface)); }
            #${DASHBOARD_ID} .ct-inbound-focus.is-warning { border-color:#e9c57d; }
            #${DASHBOARD_ID} .ct-inbound-focus.is-critical { border-color:#e3a6a0; }
            #${DASHBOARD_ID} .ct-inbound-focus-main { min-width:0; display:flex; flex-direction:column; justify-content:center; }
            #${DASHBOARD_ID} .ct-inbound-focus-kicker { font-size:8px; font-weight:900; letter-spacing:.12em; color:var(--ct-muted); }
            #${DASHBOARD_ID} .ct-inbound-focus-main strong { margin-top:4px; font-size:16px; line-height:1.1; white-space:normal; }
            #${DASHBOARD_ID} .ct-inbound-focus-main span { margin-top:4px; font-size:8px; color:var(--ct-green); font-weight:800; letter-spacing:.06em; }
            #${DASHBOARD_ID} .ct-inbound-focus-main p { margin:7px 0 0; font-size:9px; line-height:1.35; color:var(--ct-muted); }
            #${DASHBOARD_ID} .ct-inbound-focus-metrics { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:6px; align-items:stretch; }
            #${DASHBOARD_ID} .ct-inbound-focus-metrics > div { min-width:0; padding:7px; border-left:1px solid var(--ct-border); }
            #${DASHBOARD_ID} .ct-inbound-focus-metrics b { display:block; font-size:8px; color:var(--ct-muted); text-transform:uppercase; letter-spacing:.06em; }
            #${DASHBOARD_ID} .ct-inbound-focus-metrics strong { display:block; margin-top:4px; font-size:15px; line-height:1.05; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            #${DASHBOARD_ID} .ct-inbound-focus-metrics small { display:block; margin-top:4px; color:var(--ct-muted); font-size:8px; line-height:1.25; white-space:normal; }
            #${DASHBOARD_ID} .ct-inbound-command-band { margin-top:8px; display:grid; grid-template-columns:minmax(220px,1.05fr) minmax(0,1.95fr); gap:8px; padding:9px; border:1px solid var(--ct-border); border-radius:10px; background:linear-gradient(100deg,var(--ct-surface-2),var(--ct-surface)); box-shadow:inset 3px 0 0 var(--ct-green); }
            #${DASHBOARD_ID} .ct-inbound-command-band.is-warning { border-color:#e9c57d; box-shadow:inset 3px 0 0 var(--ct-amber); }
            #${DASHBOARD_ID} .ct-inbound-command-band.is-critical { border-color:#e3a6a0; box-shadow:inset 3px 0 0 var(--ct-red); }
            #${DASHBOARD_ID} .ct-inbound-command-main { min-width:0; display:flex; flex-direction:column; justify-content:center; padding-left:5px; }
            #${DASHBOARD_ID} .ct-inbound-command-main > span { font-size:8px; font-weight:900; letter-spacing:.12em; color:var(--ct-blue); }
            #${DASHBOARD_ID} .ct-inbound-command-main > strong { margin-top:4px; font-size:17px; line-height:1.05; font-weight:950; letter-spacing:.01em; }
            #${DASHBOARD_ID} .ct-inbound-command-main > small { margin-top:4px; font-size:8px; line-height:1.25; color:var(--ct-muted); }
            #${DASHBOARD_ID} .ct-inbound-command-metrics { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); align-items:stretch; }
            #${DASHBOARD_ID} .ct-inbound-command-metrics > div { min-width:0; padding:4px 8px; border-left:1px solid var(--ct-border); }
            #${DASHBOARD_ID} .ct-inbound-command-metrics b { display:block; font-size:7px; color:var(--ct-muted); letter-spacing:.07em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            #${DASHBOARD_ID} .ct-inbound-command-metrics strong { display:block; margin-top:4px; font-size:16px; line-height:1; font-variant-numeric:tabular-nums; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            #${DASHBOARD_ID} .ct-inbound-command-metrics small { display:block; margin-top:3px; font-size:7px; color:var(--ct-muted); }
            #${DASHBOARD_ID} .ct-inbound-signal-grid { margin-top:8px; display:none; grid-template-columns:repeat(6,minmax(0,1fr)); gap:6px; }
            #${DASHBOARD_ID} .ct-inbound-signal { min-width:0; padding:7px 8px; border:1px solid var(--ct-border); border-radius:8px; background:var(--ct-surface-2); }
            #${DASHBOARD_ID} .ct-inbound-signal b { display:block; font-size:8px; color:var(--ct-muted); text-transform:uppercase; letter-spacing:.06em; }
            #${DASHBOARD_ID} .ct-inbound-signal strong { display:block; margin-top:3px; font-size:12px; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            #${DASHBOARD_ID} .ct-inbound-signal small { display:block; margin-top:3px; color:var(--ct-muted); font-size:8px; line-height:1.25; white-space:normal; }
            #${DASHBOARD_ID} .ct-inbound-signal.is-warning { border-color:#e9c57d; }
            #${DASHBOARD_ID} .ct-inbound-signal.is-critical { border-color:#e3a6a0; }
            #${DASHBOARD_ID} .ct-inbound-signal.is-good { border-color:#a8dfc2; }
            #${DASHBOARD_ID} .ct-inbound-table-title { margin-top:9px; display:flex; align-items:baseline; justify-content:space-between; gap:8px; }
            #${DASHBOARD_ID} .ct-inbound-table-title strong { font-size:11px; letter-spacing:.08em; }
            #${DASHBOARD_ID} .ct-inbound-table-title span { font-size:10px; color:var(--ct-muted); }
            #${DASHBOARD_ID} .ct-inbound-table-wrap { margin-top:5px; overflow:hidden; border:1px solid var(--ct-border); border-radius:9px; }
            #${DASHBOARD_ID} .ct-inbound-table-head, #${DASHBOARD_ID} .ct-inbound-row { display:grid; grid-template-columns:minmax(130px,1.8fr) 52px 48px 56px 62px 46px 48px 52px 44px 84px; gap:0; align-items:center; }
            #${DASHBOARD_ID} .ct-inbound-table-head { padding:6px 8px; background:var(--ct-surface-2); color:var(--ct-muted); font-size:9.5px; font-weight:850; letter-spacing:.05em; }
            #${DASHBOARD_ID} .ct-inbound-row { padding:7px 8px; border-top:1px solid var(--ct-border); font-size:11px; }
            #${DASHBOARD_ID} .ct-inbound-row > span:not(.ct-inbound-name) { text-align:right; font-variant-numeric:tabular-nums; }
            #${DASHBOARD_ID} .ct-inbound-name { min-width:0; }
            #${DASHBOARD_ID} .ct-inbound-name b { display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            #${DASHBOARD_ID} .ct-inbound-name small { display:block; color:var(--ct-muted); font-size:9.5px; margin-top:2px; line-height:1.25; white-space:normal; }
            #${DASHBOARD_ID} .ct-inbound-row em { justify-self:end; font-style:normal; font-size:9.5px; font-weight:850; padding:3px 6px; border-radius:999px; background:var(--ct-green-bg); color:var(--ct-green); white-space:nowrap; }
            #${DASHBOARD_ID} .ct-inbound-row.is-warning em { background:var(--ct-amber-bg); color:var(--ct-amber); }
            #${DASHBOARD_ID} .ct-inbound-row.is-critical em { background:var(--ct-red-bg); color:var(--ct-red); }
            #${DASHBOARD_ID} .ct-inbound-row.is-neutral em { background:var(--ct-surface-2); color:var(--ct-muted); }
            #${DASHBOARD_ID} .ct-inbound-note { margin-top:7px; font-size:10px; line-height:1.35; color:var(--ct-muted); }
            #${DASHBOARD_ID} .ct-inbound-empty { padding:12px; border:1px dashed var(--ct-border); border-radius:8px; display:flex; flex-direction:column; gap:4px; }
            #${DASHBOARD_ID} .ct-inbound-empty strong { font-size:10px; }
            #${DASHBOARD_ID} .ct-inbound-empty span { font-size:9px; color:var(--ct-muted); line-height:1.35; }
            #${DASHBOARD_ID} .ct-inbound-findings { margin-top:8px; padding:8px 10px; border:1px solid var(--ct-border); border-radius:8px; background:var(--ct-surface-2); }
            #${DASHBOARD_ID} .ct-inbound-findings.is-critical { border-color:#e3a6a0; background:linear-gradient(135deg,var(--ct-surface-2),rgba(220,38,38,0.06)); }
            #${DASHBOARD_ID} .ct-inbound-findings.is-warning { border-color:#e9c57d; background:linear-gradient(135deg,var(--ct-surface-2),rgba(217,119,6,0.06)); }
            #${DASHBOARD_ID} .ct-inbound-findings.is-good { border-color:#a8dfc2; background:linear-gradient(135deg,var(--ct-surface-2),rgba(22,163,74,0.06)); }
            #${DASHBOARD_ID} .ct-inbound-findings-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
            #${DASHBOARD_ID} .ct-inbound-findings-head strong { font-size:9px; letter-spacing:.08em; text-transform:uppercase; color:var(--ct-muted); }
            #${DASHBOARD_ID} .ct-inbound-findings-badge { font-size:8px; font-weight:800; padding:2px 6px; border-radius:999px; }
            #${DASHBOARD_ID} .ct-inbound-findings-badge.is-critical { background:var(--ct-red); color:#fff; }
            #${DASHBOARD_ID} .ct-inbound-findings-badge.is-warning { background:var(--ct-amber); color:#fff; }
            #${DASHBOARD_ID} .ct-inbound-findings-badge.is-good { background:var(--ct-green); color:#fff; }
            #${DASHBOARD_ID} .ct-inbound-findings-list { display:flex; flex-wrap:wrap; gap:5px; }
            #${DASHBOARD_ID} .ct-finding-pill { display:inline-flex; align-items:center; gap:5px; padding:4px 7px; border-radius:6px; font-size:9px; background:var(--ct-surface); border:1px solid var(--ct-border); }
            #${DASHBOARD_ID} .ct-finding-pill.is-critical { border-color:#e3a6a0; }
            #${DASHBOARD_ID} .ct-finding-pill.is-warning { border-color:#e9c57d; }
            #${DASHBOARD_ID} .ct-finding-pill.is-good { border-color:#a8dfc2; }
            #${DASHBOARD_ID} .ct-finding-pill b { font-size:8px; text-transform:uppercase; letter-spacing:.06em; }
            #${DASHBOARD_ID} .ct-finding-pill.is-critical b { color:var(--ct-red); }
            #${DASHBOARD_ID} .ct-finding-pill.is-warning b { color:var(--ct-amber); }
            #${DASHBOARD_ID} .ct-finding-pill.is-good b { color:var(--ct-green); }
            #${DASHBOARD_ID} .ct-focus-flash { animation: ctRowFlash 1.8s ease-in-out; }
            @keyframes ctRowFlash { 0%, 100% { background:inherit; } 20%, 60% { background:rgba(37,99,235,0.25); outline:2px solid #2563eb; } }

            @media (max-width:1180px) {
                #${DASHBOARD_ID} .ct-focus-grid { grid-template-columns:1fr; }
                #${DASHBOARD_ID} .ct-inbound-command-band { grid-template-columns:1fr; }
                #${DASHBOARD_ID} .ct-inbound-command-metrics > div:first-child { border-left:0; }
                #${DASHBOARD_ID} .ct-inbound-hero { grid-template-columns:repeat(4,minmax(0,1fr)); }
                #${DASHBOARD_ID} .ct-inbound-total-strip { grid-template-columns:repeat(3,minmax(0,1fr)); }
                #${DASHBOARD_ID} .ct-inbound-control-grid { grid-template-columns:1fr; }
                #${DASHBOARD_ID} .ct-inbound-focus { grid-template-columns:220px minmax(0,1fr); }
                #${DASHBOARD_ID} .ct-inbound-focus-metrics { grid-template-columns:repeat(3,minmax(0,1fr)); }
                #${DASHBOARD_ID} .ct-inbound-signal-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
            }
            @media (max-width:1120px) {
                #${DASHBOARD_ID} .ct-inbound-hero { grid-template-columns:repeat(2,minmax(0,1fr)); }
                #${DASHBOARD_ID} .ct-inbound-total-strip { grid-template-columns:repeat(3,minmax(0,1fr)); }
                #${DASHBOARD_ID} .ct-inbound-control-grid { grid-template-columns:1fr; }
                #${DASHBOARD_ID} .ct-inbound-focus { grid-template-columns:1fr; }
                #${DASHBOARD_ID} .ct-inbound-focus-metrics { grid-template-columns:repeat(3,minmax(0,1fr)); }
                #${DASHBOARD_ID} .ct-inbound-signal-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
                #${DASHBOARD_ID} .ct-operating-panel { grid-template-columns:1fr; }
                #${DASHBOARD_ID} .ct-operating-campaign-grid { grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); }
                #${DASHBOARD_ID} .ct-insights-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
            }
            @media (max-width:720px) {
                #${DASHBOARD_ID} .ct-inbound-hero { grid-template-columns:1fr; }
                #${DASHBOARD_ID} .ct-inbound-total-strip { grid-template-columns:repeat(2,minmax(0,1fr)); }
                #${DASHBOARD_ID} .ct-inbound-staffing { grid-template-columns:1fr; }
                #${DASHBOARD_ID} .ct-inbound-focus-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); }
                #${DASHBOARD_ID} .ct-inbound-signal-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
                #${DASHBOARD_ID} .ct-inbound-table-wrap { overflow-x:auto; }
                #${DASHBOARD_ID} .ct-inbound-table-head, #${DASHBOARD_ID} .ct-inbound-row { min-width:650px; }
                #${DASHBOARD_ID} .ct-search { flex-basis:100%; }
                #${DASHBOARD_ID} .ct-operating-wrap { flex-basis:100%; }
                #${DASHBOARD_ID} .ct-insights-grid { grid-template-columns:1fr; }
                #${DASHBOARD_ID} .ct-operating-summary-bar { grid-template-columns:repeat(2,minmax(0,1fr)); }
                #${DASHBOARD_ID} .ct-operating-data-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
            }
        `;
        style.textContent += `
            /* v11.1.53 inbound command-center hierarchy */
            #${DASHBOARD_ID} .ct-focus-grid { grid-template-columns:minmax(280px,.55fr) minmax(740px,1.82fr); gap:10px; align-items:start; }
            #${DASHBOARD_ID} .ct-focus-outbound { min-width:0; }
            #${DASHBOARD_ID} .ct-focus-inbound { min-width:0; }
            #${DASHBOARD_ID} .ct-inbound-panel { border:1px solid rgba(148,163,184,.28) !important; border-radius:12px !important; padding:10px !important; background:linear-gradient(180deg,rgba(15,23,42,.98),rgba(13,21,36,.98)) !important; box-shadow:0 10px 28px rgba(0,0,0,.18) !important; }
            #${DASHBOARD_ID} .ct-inbound-head { padding-bottom:8px; border-bottom:1px solid rgba(148,163,184,.18); }
            #${DASHBOARD_ID} .ct-inbound-head strong { font-size:14px; letter-spacing:.01em; }
            #${DASHBOARD_ID} .ct-inbound-hero { grid-template-columns:1.35fr 1fr 1fr 1fr; gap:7px; }
            #${DASHBOARD_ID} .ct-inbound-hero-card { min-height:78px; padding:11px 12px; }
            #${DASHBOARD_ID} .ct-inbound-hero-card.is-primary { border-color:#f0bd4c; background:linear-gradient(135deg,rgba(37,47,70,.98),rgba(63,48,17,.28)); box-shadow:inset 3px 0 0 #f0bd4c; }
            #${DASHBOARD_ID} .ct-inbound-hero-card:nth-child(2) { border-color:#5b8ee8; }
            #${DASHBOARD_ID} .ct-inbound-hero-card:nth-child(3) { border-color:#65748c; }
            #${DASHBOARD_ID} .ct-inbound-hero-card:nth-child(4) { border-color:#65748c; }
            #${DASHBOARD_ID} .ct-inbound-hero-value { font-size:29px; }
            #${DASHBOARD_ID} .ct-inbound-total-strip { margin-top:7px; grid-template-columns:repeat(7,minmax(0,1fr)); gap:6px; }
            #${DASHBOARD_ID} .ct-inbound-kpi { min-height:58px; padding:7px 8px; }
            #${DASHBOARD_ID} .ct-inbound-kpi-value { font-size:16px; }
            #${DASHBOARD_ID} .ct-inbound-command-board { margin-top:8px; border:1px solid rgba(148,163,184,.34); border-radius:10px; overflow:hidden; background:rgba(17,27,45,.96); box-shadow:inset 3px 0 0 #22c55e; }
            #${DASHBOARD_ID} .ct-inbound-command-board.is-active { box-shadow:inset 3px 0 0 #f59e0b; border-color:rgba(245,158,11,.55); }
            #${DASHBOARD_ID} .ct-inbound-command-board.is-warning { box-shadow:inset 3px 0 0 #f59e0b; border-color:rgba(245,158,11,.7); }
            #${DASHBOARD_ID} .ct-inbound-command-board.is-critical { box-shadow:inset 3px 0 0 #ef4444; border-color:rgba(239,68,68,.75); }
            #${DASHBOARD_ID} .ct-inbound-command-head { display:grid; grid-template-columns:minmax(220px,.85fr) minmax(430px,1.65fr); gap:0; border-bottom:1px solid rgba(148,163,184,.2); }
            #${DASHBOARD_ID} .ct-inbound-command-head > div:first-child { padding:10px 12px; }
            #${DASHBOARD_ID} .ct-inbound-command-head > div:first-child > span { display:block; color:#8fb9ff; font-size:8px; font-weight:950; letter-spacing:.13em; }
            #${DASHBOARD_ID} .ct-inbound-command-head > div:first-child > strong { display:block; margin-top:4px; font-size:19px; line-height:1.05; color:#f8fafc; }
            #${DASHBOARD_ID} .ct-inbound-command-head > div:first-child > small { display:block; margin-top:4px; color:#9aa9bf; font-size:8px; line-height:1.3; }
            #${DASHBOARD_ID} .ct-inbound-command-summary { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); }
            #${DASHBOARD_ID} .ct-inbound-command-summary > div { padding:10px 9px; border-left:1px solid rgba(148,163,184,.18); }
            #${DASHBOARD_ID} .ct-inbound-command-summary b { display:block; color:#91a1b8; font-size:7px; letter-spacing:.07em; }
            #${DASHBOARD_ID} .ct-inbound-command-summary strong { display:block; margin-top:4px; color:#f8fafc; font-size:18px; line-height:1; font-variant-numeric:tabular-nums; }
            #${DASHBOARD_ID} .ct-inbound-command-summary small { display:block; margin-top:4px; color:#8190a5; font-size:7px; line-height:1.25; }
            #${DASHBOARD_ID} .ct-inbound-wait-title { display:flex; align-items:baseline; justify-content:space-between; gap:10px; padding:8px 11px 6px; }
            #${DASHBOARD_ID} .ct-inbound-wait-title b { color:#e6edf7; font-size:8px; letter-spacing:.08em; }
            #${DASHBOARD_ID} .ct-inbound-wait-title span { color:#7f8da2; font-size:7px; text-align:right; }
            #${DASHBOARD_ID} .ct-inbound-wait-list { display:grid; gap:4px; padding:0 7px 7px; }
            #${DASHBOARD_ID} .ct-inbound-wait-row { display:grid; grid-template-columns:minmax(190px,1.3fr) 70px 78px 92px minmax(220px,1.45fr); gap:0; align-items:center; min-height:47px; border:1px solid rgba(148,163,184,.18); border-radius:7px; background:rgba(255,255,255,.025); }
            #${DASHBOARD_ID} .ct-inbound-wait-row > div { min-width:0; padding:6px 8px; border-left:1px solid rgba(148,163,184,.13); }
            #${DASHBOARD_ID} .ct-inbound-wait-row > div:first-child { border-left:0; }
            #${DASHBOARD_ID} .ct-inbound-wait-row b { display:block; color:#f8fafc; font-size:9px; line-height:1.15; }
            #${DASHBOARD_ID} .ct-inbound-wait-row small { display:block; margin-top:3px; color:#8290a5; font-size:7px; line-height:1.25; }
            #${DASHBOARD_ID} .ct-inbound-wait-name b { font-size:10px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
            #${DASHBOARD_ID} .ct-inbound-wait-cap b { color:#9ed8b8; font-size:8px; }
            #${DASHBOARD_ID} .ct-inbound-wait-row.is-warning { border-color:rgba(245,158,11,.4); background:rgba(245,158,11,.045); }
            #${DASHBOARD_ID} .ct-inbound-wait-row.is-warning .ct-inbound-wait-cap b { color:#f5c56b; }
            #${DASHBOARD_ID} .ct-inbound-wait-row.is-critical { border-color:rgba(239,68,68,.5); background:rgba(239,68,68,.055); }
            #${DASHBOARD_ID} .ct-inbound-wait-row.is-critical .ct-inbound-wait-cap b { color:#ff9a9a; }
            #${DASHBOARD_ID} .ct-inbound-wait-empty { padding:12px; border:1px dashed rgba(148,163,184,.25); border-radius:7px; text-align:center; }
            #${DASHBOARD_ID} .ct-inbound-wait-empty strong { display:block; color:#9fe4be; font-size:10px; letter-spacing:.06em; }
            #${DASHBOARD_ID} .ct-inbound-wait-empty span { display:block; margin-top:4px; color:#8290a5; font-size:8px; }
            #${DASHBOARD_ID} .ct-inbound-wait-more { padding:2px 8px 7px; color:#8290a5; font-size:7px; text-align:right; }
            #${DASHBOARD_ID} .ct-inbound-command-foot { padding:7px 11px; border-top:1px solid rgba(148,163,184,.15); color:#7f8da2; font-size:7px; line-height:1.35; }
            #${DASHBOARD_ID} .ct-inbound-command-foot b { color:#b6c4d8; }
            #${DASHBOARD_ID} .ct-inbound-signal-grid { display:none !important; }
            #${DASHBOARD_ID} .ct-inbound-table-title { margin-top:9px; }
            @media (max-width:1180px) { #${DASHBOARD_ID} .ct-focus-grid { grid-template-columns:minmax(260px,.52fr) minmax(650px,1.48fr); } #${DASHBOARD_ID} .ct-inbound-total-strip { grid-template-columns:repeat(4,minmax(0,1fr)); } #${DASHBOARD_ID} .ct-inbound-command-head { grid-template-columns:1fr; } #${DASHBOARD_ID} .ct-inbound-command-summary > div:first-child { border-left:0; } }
            @media (max-width:900px) { #${DASHBOARD_ID} .ct-focus-grid { grid-template-columns:1fr; } #${DASHBOARD_ID} .ct-inbound-total-strip { grid-template-columns:repeat(3,minmax(0,1fr)); } #${DASHBOARD_ID} .ct-inbound-wait-row { grid-template-columns:1.5fr repeat(3,70px); } #${DASHBOARD_ID} .ct-inbound-wait-cap { grid-column:1/-1; border-left:0 !important; border-top:1px solid rgba(148,163,184,.13); } }
        `;
        style.textContent += `
            #${DASHBOARD_ID} .ct-summary-section-label { display:flex; align-items:baseline; justify-content:space-between; gap:8px; padding:2px 2px 0; color:rgba(255,255,255,.9); }
            #${DASHBOARD_ID} .ct-summary-section-label span { font-size:11px; font-weight:950; letter-spacing:.1em; }
            #${DASHBOARD_ID} .ct-summary-section-label small { color:rgba(255,255,255,.65); font-size:10px; font-weight:750; }

            /* v11.1.53 balanced command-center lock */
            #${DASHBOARD_ID} .ct-focus-grid { grid-template-columns:minmax(0,1fr) minmax(0,1fr) !important; gap:12px !important; align-items:start; }
            #${DASHBOARD_ID} .ct-focus-column { min-width:0; }
            #${DASHBOARD_ID} .ct-focus-column-head { min-height:42px; padding:8px 10px; border:1px solid var(--ct-border); border-radius:9px 9px 0 0; background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.018)); }
            #${DASHBOARD_ID} .ct-focus-column-head span { color:#dbe7f8; font-size:11.5px; font-weight:950; letter-spacing:.09em; }
            #${DASHBOARD_ID} .ct-focus-column-head small { color:#8290a5; font-size:10px; }
            #${DASHBOARD_ID} .ct-focus-column-head b { flex:0 0 auto; padding:3px 7px; border:1px solid rgba(34,197,94,.45); border-radius:999px; color:#8fe0ac; background:rgba(34,197,94,.08); font-size:9.5px; letter-spacing:.08em; }
            #${DASHBOARD_ID} .ct-focus-outbound > .ct-operating-panel, #${DASHBOARD_ID} .ct-focus-inbound > .ct-inbound-panel { border-radius:0 0 10px 10px !important; }
            #${DASHBOARD_ID} .ct-focus-inbound .ct-inbound-panel { border-top:0 !important; box-shadow:0 8px 22px rgba(0,0,0,.16) !important; }
            #${DASHBOARD_ID} .ct-focus-outbound .ct-operating-panel { border-top:0; }
            #${DASHBOARD_ID} .ct-inbound-table-wrap { max-height:390px; overflow:auto; }
            #${DASHBOARD_ID} .ct-inbound-row, #${DASHBOARD_ID} .ct-inbound-table-head { min-width:650px; }
            #${DASHBOARD_ID} .ct-filter-group { display:inline-flex; align-items:center; border:1px solid var(--ct-border); border-radius:7px; background:var(--ct-surface-2); padding:2px; gap:2px; }
            #${DASHBOARD_ID} .ct-filter-pill { padding:3px 8px; border:none; border-radius:5px; background:transparent; color:var(--ct-muted); font-size:10px; font-weight:850; cursor:pointer; transition:all .15s ease; white-space:nowrap; }
            #${DASHBOARD_ID} .ct-filter-pill:hover { color:var(--ct-text); background:rgba(255,255,255,.08); }
            #${DASHBOARD_ID} .ct-filter-pill.is-active { color:#fff; background:#2563eb; box-shadow:0 1px 3px rgba(0,0,0,.25); }
            #${DASHBOARD_ID} .ct-order-editor { margin:7px 0 8px; border:1px solid rgba(139,182,255,.48); border-radius:10px; background:linear-gradient(180deg,rgba(20,34,58,.98),rgba(13,23,40,.98)); box-shadow:0 10px 26px rgba(0,0,0,.2); overflow:hidden; }
            #${DASHBOARD_ID} .ct-order-editor-head { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 11px; border-bottom:1px solid rgba(148,163,184,.18); }
            #${DASHBOARD_ID} .ct-order-editor-head strong { display:block; color:#f8fafc; font-size:12px; letter-spacing:.08em; }
            #${DASHBOARD_ID} .ct-order-editor-head small { display:block; margin-top:3px; color:#8f9db1; font-size:10px; }
            #${DASHBOARD_ID} .ct-order-editor-actions { display:flex; gap:5px; flex:0 0 auto; }
            #${DASHBOARD_ID} .ct-order-editor-btn { height:27px; padding:0 9px; border:1px solid rgba(148,163,184,.3); border-radius:6px; color:#c8d3e2; background:rgba(255,255,255,.05); font-size:10px; font-weight:900; }
            #${DASHBOARD_ID} .ct-order-editor-btn:hover { background:rgba(255,255,255,.1); }
            #${DASHBOARD_ID} .ct-order-editor-btn.is-primary { color:#fff; border-color:#7fb0ff; background:#2563eb; }
            #${DASHBOARD_ID} .ct-order-editor-tip { display:flex; align-items:center; gap:7px; padding:6px 10px; color:#9aa9bf; background:rgba(59,130,246,.08); border-bottom:1px solid rgba(148,163,184,.12); font-size:10px; }
            #${DASHBOARD_ID} .ct-order-editor-tip > span:first-child { color:#8bb6ff; font-size:13px; font-weight:950; }
            #${DASHBOARD_ID} .ct-order-editor-list { display:grid; gap:4px; max-height:310px; overflow:auto; padding:7px; }
            #${DASHBOARD_ID} .ct-order-editor-row { display:grid; grid-template-columns:28px 24px minmax(0,1fr) 58px 54px; align-items:center; min-height:42px; border:1px solid rgba(148,163,184,.17); border-radius:7px; background:rgba(255,255,255,.035); }
            #${DASHBOARD_ID} .ct-order-editor-row:hover { border-color:rgba(139,182,255,.4); background:rgba(59,130,246,.07); }
            #${DASHBOARD_ID} .ct-order-editor-number { margin-left:7px; color:#8fb9ff; font-size:10.5px; font-weight:950; text-align:center; }
            #${DASHBOARD_ID} .ct-order-editor-drag { color:#718096; font-size:13px; text-align:center; cursor:grab; user-select:none; }
            #${DASHBOARD_ID} .ct-order-editor-name { min-width:0; padding:6px 7px; }
            #${DASHBOARD_ID} .ct-order-editor-name b { display:block; overflow:hidden; color:#f8fafc; font-size:11px; text-overflow:ellipsis; white-space:nowrap; }
            #${DASHBOARD_ID} .ct-order-editor-name small { display:block; margin-top:2px; color:#7f8da2; font-size:9.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            #${DASHBOARD_ID} .ct-order-editor-state { justify-self:center; padding:3px 6px; border:1px solid rgba(148,163,184,.22); border-radius:999px; font-size:9px; font-weight:950; }
            #${DASHBOARD_ID} .ct-order-editor-state.is-live { color:#8fe0ac; border-color:rgba(34,197,94,.35); background:rgba(34,197,94,.08); }
            #${DASHBOARD_ID} .ct-order-editor-state.is-inactive { color:#9aa9bf; }
            #${DASHBOARD_ID} .ct-order-editor-state.is-check { color:#f4c56d; border-color:rgba(245,158,11,.35); }
            #${DASHBOARD_ID} .ct-order-editor-move { display:flex; gap:3px; padding-right:6px; }
            #${DASHBOARD_ID} .ct-order-editor-move button { width:23px; height:23px; padding:0; border:1px solid rgba(148,163,184,.26); border-radius:5px; color:#dbe7f8; background:rgba(255,255,255,.05); font-size:12px; font-weight:950; }
            #${DASHBOARD_ID} .ct-order-editor-move button:hover:not(:disabled) { background:#2563eb; border-color:#7fb0ff; color:#fff; }
            #${DASHBOARD_ID} .ct-order-editor-move button:disabled { opacity:.28; cursor:default; }
            #${DASHBOARD_ID} .ct-active-command-summary { margin:6px 0 8px; border:1px solid rgba(139,182,255,.35); border-radius:9px; background:linear-gradient(180deg,rgba(23,32,51,.95),rgba(15,23,42,.95)); box-shadow:0 4px 16px rgba(0,0,0,.22); overflow:hidden; }
            #${DASHBOARD_ID} .ct-active-summary-head { display:flex; align-items:center; justify-content:space-between; padding:7px 12px; background:rgba(37,99,235,.12); border-bottom:1px solid rgba(148,163,184,.16); }
            #${DASHBOARD_ID} .ct-active-summary-title { display:flex; align-items:center; gap:8px; }
            #${DASHBOARD_ID} .ct-active-pulse-dot { width:8px; height:8px; border-radius:50%; background:#10b981; box-shadow:0 0 8px #10b981; animation:ct-pulse 2s infinite ease-in-out; }
            @keyframes ct-pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.5; transform:scale(.85); } }
            #${DASHBOARD_ID} .ct-active-summary-title strong { font-size:12px; font-weight:900; color:#f8fafc; letter-spacing:.06em; }
            #${DASHBOARD_ID} .ct-active-summary-title small { color:#94a3b8; font-size:10.5px; }
            #${DASHBOARD_ID} .ct-active-summary-status { display:flex; align-items:center; gap:6px; }
            #${DASHBOARD_ID} .ct-active-summary-badge { padding:3px 9px; border-radius:999px; font-size:10px; font-weight:900; letter-spacing:.05em; border:1px solid rgba(16,185,129,.4); background:rgba(16,185,129,.12); color:#6ee7b7; }
            #${DASHBOARD_ID} .ct-active-summary-badge.is-inactive { border-color:rgba(148,163,184,.3); background:rgba(148,163,184,.1); color:#94a3b8; }
            #${DASHBOARD_ID} .ct-clear-selection-btn { padding:2px 8px; border-radius:4px; font-size:9.5px; font-weight:850; background:rgba(239,68,68,.15); color:#f87171; border:1px solid rgba(239,68,68,.3); cursor:pointer; }
            #${DASHBOARD_ID} .ct-clear-selection-btn:hover { background:rgba(239,68,68,.28); color:#fff; }
            #${DASHBOARD_ID} .ct-active-summary-table-wrap { max-height:220px; overflow-x:auto; overflow-y:auto; border-radius:8px; border:1px solid rgba(139,182,255,.3); background:rgba(15,23,42,.85); box-shadow:0 3px 12px rgba(0,0,0,.22); }
            #${DASHBOARD_ID} .ct-active-summary-table { table-layout:fixed; width:100%; min-width:1380px; border-collapse:collapse; font-size:11px; font-variant-numeric:tabular-nums; white-space:nowrap; }
            #${DASHBOARD_ID} .ct-active-summary-table th { position:sticky; top:0; z-index:2; background:#172033; color:#94a3b8; font-size:9.5px; font-weight:850; letter-spacing:.06em; text-transform:uppercase; padding:7px 8px; text-align:left; border:1px solid rgba(148,163,184,.45) !important; border-bottom:2px solid rgba(148,163,184,.65) !important; }
            #${DASHBOARD_ID} .ct-col-drag { width:38px; }
            #${DASHBOARD_ID} .ct-col-select { width:32px; }
            #${DASHBOARD_ID} .ct-col-name { width:180px; }
            #${DASHBOARD_ID} .ct-col-state { width:72px; }
            #${DASHBOARD_ID} .ct-col-agents { width:64px; }
            #${DASHBOARD_ID} .ct-col-waiting { width:66px; }
            #${DASHBOARD_ID} .ct-col-waitnow { width:70px; }
            #${DASHBOARD_ID} .ct-col-waittoday { width:74px; }
            #${DASHBOARD_ID} .ct-col-outbound { width:95px; }
            #${DASHBOARD_ID} .ct-col-human { width:90px; }
            #${DASHBOARD_ID} .ct-col-agentconnect { width:90px; }
            #${DASHBOARD_ID} .ct-col-goals { width:68px; }
            #${DASHBOARD_ID} .ct-col-abandoned { width:92px; }
            #${DASHBOARD_ID} .ct-col-connectrate { width:84px; }
            #${DASHBOARD_ID} .ct-col-leads { width:80px; }
            #${DASHBOARD_ID} .ct-col-runway { width:92px; }
            #${DASHBOARD_ID} .ct-col-health { width:80px; }
            #${DASHBOARD_ID} .ct-col-focus { width:65px; }
            #${DASHBOARD_ID} .ct-th-drag, #${DASHBOARD_ID} .ct-td-drag,
            #${DASHBOARD_ID} .ct-th-select, #${DASHBOARD_ID} .ct-td-select,
            #${DASHBOARD_ID} .ct-th-state, #${DASHBOARD_ID} .ct-td-state,
            #${DASHBOARD_ID} .ct-th-runway, #${DASHBOARD_ID} .ct-td-runway,
            #${DASHBOARD_ID} .ct-th-health, #${DASHBOARD_ID} .ct-td-health,
            #${DASHBOARD_ID} .ct-th-focus, #${DASHBOARD_ID} .ct-td-focus { text-align:center; }
            #${DASHBOARD_ID} .ct-th-name, #${DASHBOARD_ID} .ct-td-name { text-align:left; }
            #${DASHBOARD_ID} .ct-active-summary-table th.ct-th-num, #${DASHBOARD_ID} .ct-active-summary-table td.ct-td-num { text-align:right; font-variant-numeric:tabular-nums; }
            #${DASHBOARD_ID} .ct-active-summary-table td { padding:6px 8px; border:1px solid rgba(148,163,184,.38) !important; color:#e2e8f0; font-size:11.5px; vertical-align:middle; background:rgba(15,23,42,.65); }
            #${DASHBOARD_ID} .ct-active-summary-table tr:hover td { background:rgba(59,130,246,.12); }
            #${DASHBOARD_ID} .ct-active-summary-table tr.is-selected td { background:rgba(59,130,246,.20); }
            #${DASHBOARD_ID} .ct-active-summary-table td.ct-td-waitnow.is-critical { color:#f87171 !important; font-weight:850; }
            #${DASHBOARD_ID} .ct-active-summary-table td.ct-td-waitnow.is-warning { color:#fbbf24 !important; font-weight:850; }
            #${DASHBOARD_ID} .ct-active-summary-table td.ct-td-waiting.is-critical { color:#f87171 !important; font-weight:850; }
            #${DASHBOARD_ID} .ct-active-summary-table td.ct-td-waiting.is-warning { color:#fbbf24 !important; font-weight:850; }
            #${DASHBOARD_ID} .ct-active-summary-table td.ct-td-goals.is-good { color:#4ade80 !important; font-weight:850; }
            #${DASHBOARD_ID} .ct-active-summary-table td.ct-td-abandoned.is-critical { color:#f87171 !important; font-weight:850; }
            #${DASHBOARD_ID} .ct-active-summary-table td.ct-td-abandoned.is-warning { color:#fbbf24 !important; font-weight:850; }
            #${DASHBOARD_ID} .ct-drag-cell-inner { display:inline-flex; align-items:center; justify-content:center; gap:2px; }
            #${DASHBOARD_ID} .ct-table-drag-handle { display:inline-block; padding:1px 2px; border-radius:3px; cursor:grab; color:#64748b; font-size:12px; font-weight:900; letter-spacing:-1px; }
            #${DASHBOARD_ID} .ct-table-drag-handle:hover { color:#93c5fd; background:rgba(59,130,246,.2); }
            #${DASHBOARD_ID} .ct-table-drag-handle:active { cursor:grabbing; }
            #${DASHBOARD_ID} .ct-row-order-btns { display:inline-flex; flex-direction:column; gap:1px; }
            #${DASHBOARD_ID} .ct-row-order-btn { border:none; background:none; color:#64748b; font-size:8px; line-height:8px; padding:1px 2px; cursor:pointer; border-radius:2px; }
            #${DASHBOARD_ID} .ct-row-order-btn:hover { color:#38bdf8; background:rgba(59,130,246,.25); }
            #${DASHBOARD_ID} .ct-row-order-btn:disabled { opacity:.2; cursor:not-allowed; }
            #${DASHBOARD_ID} .ct-table-select-cb { cursor:pointer; accent-color:#3b82f6; width:13px; height:13px; margin:0; vertical-align:middle; }

            #${DASHBOARD_ID} .ct-active-name { color:#f8fafc; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px; }
            #${DASHBOARD_ID} .ct-active-status-tag { display:inline-block; padding:2px 7px; border-radius:4px; font-size:9.5px; font-weight:900; background:rgba(16,185,129,.15); color:#34d399; border:1px solid rgba(16,185,129,.3); }
            #${DASHBOARD_ID} .ct-active-status-tag.is-inactive { background:rgba(148,163,184,.15); color:#94a3b8; border-color:rgba(148,163,184,.3); }
            #${DASHBOARD_ID} .ct-health-pill { display:inline-block; padding:2px 7px; border-radius:4px; font-size:9.5px; font-weight:900; text-transform:uppercase; }
            #${DASHBOARD_ID} .ct-health-pill.is-excellent, #${DASHBOARD_ID} .ct-health-pill.is-good { background:rgba(16,185,129,.15); color:#34d399; border:1px solid rgba(16,185,129,.3); }
            #${DASHBOARD_ID} .ct-health-pill.is-warning { background:rgba(245,158,11,.15); color:#fbbf24; border:1px solid rgba(245,158,11,.3); }
            #${DASHBOARD_ID} .ct-health-pill.is-critical { background:rgba(239,68,68,.15); color:#f87171; border:1px solid rgba(239,68,68,.3); }
            #${DASHBOARD_ID} .ct-active-focus-btn { padding:3px 9px; border-radius:4px; border:1px solid rgba(148,163,184,.3); background:rgba(255,255,255,.05); color:#93c5fd; font-size:9.5px; font-weight:850; cursor:pointer; }
            #${DASHBOARD_ID} .ct-active-focus-btn:hover { background:#2563eb; color:#fff; border-color:#3b82f6; }
            #${DASHBOARD_ID} .ct-active-focus-btn.is-operating { background:rgba(34,197,94,.22) !important; color:#4ade80 !important; border-color:rgba(34,197,94,.5) !important; font-weight:900 !important; }
            #${DASHBOARD_ID} .ct-active-focus-btn.is-operating:hover { background:rgba(34,197,94,.38) !important; color:#86efac !important; border-color:rgba(34,197,94,.75) !important; }
            #${DASHBOARD_ID} .ct-td-name b { cursor:pointer; }
            #${DASHBOARD_ID} .ct-td-name b:hover { color:#60a5fa; text-decoration:underline; }
            #${DASHBOARD_ID} .ct-campaign-filter-badge { font-size:8.5px; font-weight:750; line-height:1.1; margin-top:2px; padding:1px 5px; border-radius:3px; display:inline-block; max-width:170px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            #${DASHBOARD_ID} .ct-campaign-filter-badge.is-assigned { background:rgba(56,189,248,.16); color:#7dd3fc; border:1px solid rgba(56,189,248,.35); }
            #${DASHBOARD_ID} .ct-campaign-filter-badge.is-unavailable { background:rgba(148,163,184,.1); color:#94a3b8; border:1px solid rgba(148,163,184,.2); font-style:italic; }
            #${DASHBOARD_ID} .ct-intel-badge.is-filter-change { background:rgba(245,158,11,.22); color:#fbbf24; border:1px solid rgba(245,158,11,.45); }
            #${DASHBOARD_ID} .ct-active-empty { text-align:center; padding:18px; color:#94a3b8; font-style:italic; }
            #${DASHBOARD_ID} .ct-reconciled-footer { display:flex; align-items:center; justify-content:space-between; padding:6px 12px; margin-top:6px; border:1px solid rgba(148,163,184,.15); border-radius:6px; background:rgba(15,23,42,.6); font-size:10.5px; color:#94a3b8; font-variant-numeric:tabular-nums; }
            #${DASHBOARD_ID} .ct-reconciled-footer b { color:#f1f5f9; }
            #${DASHBOARD_ID} .ct-kpi-value, #${DASHBOARD_ID} .ct-command-value, #${DASHBOARD_ID} .ct-row-cell { font-variant-numeric:tabular-nums; }

            /* Outbound Focus upgraded layout */
            #${DASHBOARD_ID} .ct-focus-outbound .ct-operating-panel { display:flex !important; flex-direction:column !important; gap:8px !important; background:linear-gradient(180deg,rgba(15,23,42,.98),rgba(13,21,36,.98)) !important; border:1px solid rgba(148,163,184,.28) !important; border-top:0 !important; border-radius:0 0 10px 10px !important; padding:10px !important; box-shadow:0 8px 22px rgba(0,0,0,.16) !important; color:#f8fafc !important; }
            #${DASHBOARD_ID} .ct-operating-summary-bar { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:7px; margin-bottom:4px; background:transparent; border:none; padding:0; }
            #${DASHBOARD_ID} .ct-operating-summary-bar[hidden] { display:none !important; }
            #${DASHBOARD_ID} .ct-operating-summary-item:hover { border-color:rgba(148,163,184,.42); background:linear-gradient(180deg,rgba(30,41,59,.9) 0%,rgba(15,23,42,.98) 100%); }
            #${DASHBOARD_ID} .ct-operating-summary-item b { color:#94a3b8; font-size:9px; font-weight:850; letter-spacing:.06em; text-transform:uppercase; line-height:1.2; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            #${DASHBOARD_ID} .ct-operating-summary-item strong { color:#f8fafc; font-size:15px; font-weight:900; line-height:1.1; font-variant-numeric:tabular-nums; }
            #${DASHBOARD_ID} .ct-operating-campaign-card { border:1px solid rgba(148,163,184,.24) !important; border-radius:8px !important; background:linear-gradient(180deg,rgba(20,29,46,.95) 0%,rgba(13,20,34,.98) 100%) !important; overflow:hidden !important; box-shadow:0 4px 16px rgba(0,0,0,.25) !important; padding:8px 10px 10px !important; }
            #${DASHBOARD_ID} .ct-operating-campaign-card.is-single-campaign > .ct-operating-campaign-head { display:none !important; }
            #${DASHBOARD_ID} .ct-operating-cluster-label { display:flex; align-items:center; gap:8px; margin:9px 0 5px; font-size:9.5px; font-weight:900; letter-spacing:.08em; color:#38bdf8 !important; text-transform:uppercase; }
            #${DASHBOARD_ID} .ct-operating-campaign-card > .ct-operating-cluster-label:first-of-type, #${DASHBOARD_ID} .ct-operating-cluster-label:first-child { margin-top:2px !important; }
            #${DASHBOARD_ID} .ct-operating-cluster-label::after { content:''; flex:1; height:1px; background:linear-gradient(90deg,rgba(56,189,248,.35),rgba(148,163,184,.1)); }
            #${DASHBOARD_ID} .ct-operating-agent-band, #${DASHBOARD_ID} .ct-operating-data-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:6px; }
            #${DASHBOARD_ID} .ct-operating-data-grid-half { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric { display:flex; flex-direction:column; justify-content:space-between; min-height:56px; padding:7px 9px; border-radius:6px; background:linear-gradient(180deg,rgba(30,41,59,.72) 0%,rgba(15,23,42,.88) 100%) !important; border:1px solid rgba(148,163,184,.22) !important; box-shadow:0 2px 6px rgba(0,0,0,.15); transition:border-color .15s ease, background .15s ease; }
            #${DASHBOARD_ID} .ct-operating-card-metric:hover { border-color:rgba(148,163,184,.45) !important; background:linear-gradient(180deg,rgba(30,41,59,.88) 0%,rgba(20,29,46,.96) 100%) !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric b { color:#94a3b8 !important; font-size:9px !important; font-weight:800 !important; text-transform:uppercase !important; letter-spacing:.05em !important; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            #${DASHBOARD_ID} .ct-operating-card-metric strong { color:#f8fafc !important; font-size:16px !important; font-weight:900 !important; font-variant-numeric:tabular-nums !important; line-height:1.15; margin:2px 0 2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            #${DASHBOARD_ID} .ct-operating-card-metric small { color:#cbd5e1 !important; font-size:8px !important; font-weight:600 !important; line-height:1.25; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; opacity:.82; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-critical { border-color:rgba(239,68,68,.6) !important; background:linear-gradient(180deg,rgba(239,68,68,.22) 0%,rgba(35,15,18,.9) 100%) !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-critical b { color:#fca5a5 !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-critical strong { color:#f87171 !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-critical small { color:#fca5a5 !important; opacity:.95 !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-warning { border-color:rgba(245,158,11,.55) !important; background:linear-gradient(180deg,rgba(245,158,11,.2) 0%,rgba(30,25,15,.9) 100%) !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-warning b { color:#fde68a !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-warning strong { color:#fbbf24 !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-warning small { color:#fcd34d !important; opacity:.95 !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-good { border-color:rgba(34,197,94,.45) !important; background:linear-gradient(180deg,rgba(34,197,94,.16) 0%,rgba(15,30,24,.9) 100%) !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-good b { color:#a7f3d0 !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-good strong { color:#4ade80 !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-good small { color:#86efac !important; opacity:.95 !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-highlight { border-color:rgba(56,189,248,.45) !important; background:linear-gradient(180deg,rgba(56,189,248,.16) 0%,rgba(15,25,40,.9) 100%) !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-highlight b { color:#bae6fd !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-highlight strong { color:#38bdf8 !important; }
            #${DASHBOARD_ID} .ct-operating-card-metric.is-highlight small { color:#7dd3fc !important; opacity:.95 !important; }
            #${DASHBOARD_ID} .ct-operating-findings { width:100%; margin:0; box-sizing:border-box; border:1px solid rgba(148,163,184,.28); border-radius:8px; background:rgba(15,23,42,.85); padding:9px 11px; box-shadow:0 2px 8px rgba(0,0,0,.15); }
            #${DASHBOARD_ID} .ct-operating-findings.is-critical { border-color:rgba(239,68,68,.5); background:linear-gradient(180deg,rgba(239,68,68,.1) 0%,rgba(15,23,42,.9) 100%); }
            #${DASHBOARD_ID} .ct-operating-findings.is-warning { border-color:rgba(245,158,11,.5); background:linear-gradient(180deg,rgba(245,158,11,.1) 0%,rgba(15,23,42,.9) 100%); }
            #${DASHBOARD_ID} .ct-operating-findings.is-good { border-color:rgba(34,197,94,.4); background:linear-gradient(180deg,rgba(34,197,94,.08) 0%,rgba(15,23,42,.9) 100%); }
            #${DASHBOARD_ID} .ct-operating-findings-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:7px; padding-bottom:5px; border-bottom:1px solid rgba(148,163,184,.18); }
            #${DASHBOARD_ID} .ct-operating-findings-head strong { font-size:10.5px; font-weight:900; letter-spacing:.06em; color:#f8fafc; }
            #${DASHBOARD_ID} .ct-operating-findings-badge { font-size:9.5px; font-weight:900; padding:2px 8px; border-radius:999px; text-transform:uppercase; letter-spacing:.04em; border:1px solid rgba(148,163,184,.35); background:rgba(148,163,184,.15); color:#cbd5e1; }
            #${DASHBOARD_ID} .ct-operating-findings-badge.is-critical { border-color:#ef4444; background:rgba(239,68,68,.25); color:#fca5a5; }
            #${DASHBOARD_ID} .ct-operating-findings-badge.is-warning { border-color:#f59e0b; background:rgba(245,158,11,.25); color:#fde047; }
            #${DASHBOARD_ID} .ct-operating-findings-badge.is-good { border-color:#22c55e; background:rgba(34,197,94,.25); color:#86efac; }
            #${DASHBOARD_ID} .ct-operating-findings-list { display:flex; flex-direction:column; gap:5px; }
            #${DASHBOARD_ID} .ct-finding-pill { display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:6px; font-size:11px; line-height:1.35; background:rgba(30,41,59,.85); border:1px solid rgba(148,163,184,.25); color:#f8fafc; min-width:0; }
            #${DASHBOARD_ID} .ct-finding-pill b { display:inline-block; padding:2px 6px; border-radius:4px; font-size:8.5px; font-weight:950; text-transform:uppercase; letter-spacing:.05em; white-space:nowrap; flex-shrink:0; background:rgba(148,163,184,.2); color:#94a3b8; }
            #${DASHBOARD_ID} .ct-finding-pill span { color:#f8fafc; font-weight:600; font-size:11px; min-width:0; word-break:break-word; }
            #${DASHBOARD_ID} .ct-finding-pill.is-critical { border-color:rgba(239,68,68,.5); background:rgba(239,68,68,.18); }
            #${DASHBOARD_ID} .ct-finding-pill.is-critical b { background:#ef4444; color:#ffffff; }
            #${DASHBOARD_ID} .ct-finding-pill.is-critical span { color:#fee2e2; font-weight:650; }
            #${DASHBOARD_ID} .ct-finding-pill.is-warning { border-color:rgba(245,158,11,.5); background:rgba(245,158,11,.18); }
            #${DASHBOARD_ID} .ct-finding-pill.is-warning b { background:#f59e0b; color:#0f172a; font-weight:950; }
            #${DASHBOARD_ID} .ct-finding-pill.is-warning span { color:#fef08a; font-weight:650; }
            #${DASHBOARD_ID} .ct-finding-pill.is-good { border-color:rgba(34,197,94,.4); background:rgba(34,197,94,.14); }
            #${DASHBOARD_ID} .ct-finding-pill.is-good b { background:#22c55e; color:#ffffff; }
            #${DASHBOARD_ID} .ct-finding-pill.is-good span { color:#bbf7d0; font-weight:600; }
            #${DASHBOARD_ID} .ct-finding-pill.is-good span { color:#bbf7d0; }

            /* Inbound Queue Table explicit grid columns and sticky header */
            #${DASHBOARD_ID} .ct-inbound-table-head, #${DASHBOARD_ID} .ct-inbound-row { display:grid; grid-template-columns:minmax(140px,2fr) 56px 52px 64px 60px 50px 56px 64px 50px 88px; gap:0; align-items:center; min-width:680px; }
            #${DASHBOARD_ID} .ct-inbound-table-head { position:sticky; top:0; z-index:5; padding:7px 10px; background:var(--ct-surface-2); border-bottom:1px solid var(--ct-border); color:var(--ct-muted); font-size:10px; font-weight:850; letter-spacing:.05em; }
            #${DASHBOARD_ID} .ct-qcol-name { text-align:left; min-width:0; }
            #${DASHBOARD_ID} .ct-qcol-logged, #${DASHBOARD_ID} .ct-qcol-today, #${DASHBOARD_ID} .ct-qcol-answered, #${DASHBOARD_ID} .ct-qcol-notans, #${DASHBOARD_ID} .ct-qcol-wait, #${DASHBOARD_ID} .ct-qcol-oncall, #${DASHBOARD_ID} .ct-qcol-maxwait, #${DASHBOARD_ID} .ct-qcol-goals { text-align:right; padding-right:6px; font-variant-numeric:tabular-nums; font-weight:600; }
            #${DASHBOARD_ID} .ct-qcol-state { text-align:center; }
            #${DASHBOARD_ID} .ct-inbound-row { padding:6px 10px; border-bottom:1px solid rgba(148,163,184,.08); font-size:11px; }
            
            @media (max-width:900px) { #${DASHBOARD_ID} .ct-focus-grid { grid-template-columns:1fr !important; } }
            @media (max-width:700px) { #${DASHBOARD_ID} .ct-order-editor-head { align-items:flex-start; flex-direction:column; } #${DASHBOARD_ID} .ct-order-editor-row { grid-template-columns:26px 22px minmax(0,1fr) 52px 50px; } }
        `;
    }

    function mount() {
        root.dataset.theme = state.theme;
        root.innerHTML = `
            <div class="ct-shell">
                <header class="ct-summary">
                    <div class="ct-row">
                        <div class="ct-title">
                            <h2>CallTools Operations <span class="ct-dialer-tag " + (isEast3 ? "ct-dialer-east3" : "ct-dialer-east2") + "">" + (isEast3 ? "EAST-3" : "EAST-2") + "</span></h2>
                            <span class="ct-updated">Waiting for verified CallTools data</span>
                        </div>
                        <div class="ct-summary-controls">
                            <span class="ct-live" data-ref="live">WAITING</span>
                            <span class="ct-feed-poll" title="Live parser polling interval">Feed poll: 1.0s</span>
                            <button class="ct-header-refresh" type="button" data-ref="headerRefresh" aria-label="Refresh live CallTools data" title="Refresh live CallTools data">↻</button>
                            <div class="ct-zoom-controls" role="group" aria-label="Dashboard zoom"><button type="button" data-ref="zoomOut" aria-label="Zoom out">−</button><button type="button" data-ref="zoomReset" aria-label="Reset zoom" data-zoom-value>100%</button><button type="button" data-ref="zoomIn" aria-label="Zoom in">+</button></div>
                            <button class="ct-header-collapse" type="button" data-ref="headerCollapse" aria-label="Collapse operations panel">Collapse</button>
                        </div>
                    </div>

                    <!-- LIVE FILTER TARGETING (HIGH-VISIBILITY 6-CARD COMMAND CENTER) -->
                    <section class="ct-lft-panel" data-ref="topLiveFilterPanel" aria-label="Live Filter Targeting Command Center">
                        <div class="ct-lft-header">
                            <div class="ct-lft-header-left">
                                <span class="ct-lft-title-tag">LIVE FILTER TARGETING</span>
                                <span class="ct-lft-dialer-pill" data-ref="topFilterDialer">${DIALER}</span>
                                <span class="ct-lft-campaign-title" data-ref="topFilterCampaign">—</span>
                            </div>
                            <div class="ct-lft-header-right">
                                <span class="ct-lft-verify-badge is-unavailable" data-ref="topFilterVerificationState">TARGETING: UNAVAILABLE</span>
                                <span class="ct-lft-source-pill" data-ref="topFilterSource">Source: Awaiting DOM</span>
                                <span class="ct-tlf-badge is-unavailable" data-ref="topFilterBadge" hidden>FILTER SOURCE UNAVAILABLE</span>
                            </div>
                        </div>
                        <div class="ct-lft-cards-grid">
                            <!-- Card 1: Assigned Live Filter -->
                            <div class="ct-lft-card ct-lft-card-filter">
                                <div class="ct-lft-card-eyebrow">ASSIGNED LIVE FILTER</div>
                                <div class="ct-lft-card-primary" data-ref="topFilterName">—</div>
                                <div class="ct-lft-card-meta">
                                    <span class="ct-lft-status-pill is-unavailable" data-ref="topFilterStatus">UNAVAILABLE</span>
                                    <span class="ct-lft-card-id" data-ref="topFilterId">ID: —</span>
                                </div>
                            </div>
                            <!-- Card 2: Campaign Callable Pool -->
                            <div class="ct-lft-card ct-lft-card-pool">
                                <div class="ct-lft-card-eyebrow">CAMPAIGN CALLABLE POOL</div>
                                <div class="ct-lft-card-primary ct-lft-pool-val" data-ref="topFilterPool">—</div>
                                <div class="ct-lft-card-meta">
                                    <span class="ct-lft-source-tag">Campaigns Page</span>
                                    <span class="ct-lft-card-time" data-ref="topFilterPoolTime">Live Queue</span>
                                </div>
                            </div>
                            <!-- Card 3: Filter Available Contacts -->
                            <div class="ct-lft-card ct-lft-card-avail">
                                <div class="ct-lft-card-eyebrow">FILTER AVAILABLE CONTACTS</div>
                                <div class="ct-lft-card-primary ct-lft-avail-val" data-ref="topFilterAvailableContacts">—</div>
                                <div class="ct-lft-card-meta">
                                    <span class="ct-lft-source-tag">Live Filter Inventory</span>
                                    <span class="ct-lft-card-time" data-ref="topFilterAvailableTime">Awaiting /manager/live-filters</span>
                                </div>
                            </div>
                            <!-- Card 4: Filter Total Matches -->
                            <div class="ct-lft-card ct-lft-card-match">
                                <div class="ct-lft-card-eyebrow">FILTER TOTAL MATCHES</div>
                                <div class="ct-lft-card-primary ct-lft-match-val" data-ref="topFilterMatch">—</div>
                                <div class="ct-lft-card-meta">
                                    <span class="ct-lft-source-tag">Demographic Matches</span>
                                    <small class="ct-lft-match-note">All timezones</small>
                                </div>
                            </div>
                            <!-- Card 5: Targeting Verification -->
                            <div class="ct-lft-card ct-lft-card-verify">
                                <div class="ct-lft-card-eyebrow">TARGETING VERIFICATION</div>
                                <div class="ct-lft-card-primary" data-ref="topFilterConfidence">UNVERIFIED</div>
                                <div class="ct-lft-card-meta">
                                    <span class="ct-lft-source-tag" data-ref="topFilterVerifySource">Awaiting Source</span>
                                    <span class="ct-lft-card-time" data-ref="topFilterObserved">—</span>
                                </div>
                            </div>
                            <!-- Card 6: Data Freshness -->
                            <div class="ct-lft-card ct-lft-card-fresh">
                                <div class="ct-lft-card-eyebrow">DATA FRESHNESS</div>
                                <div class="ct-lft-card-primary ct-lft-freshness-val is-waiting" data-ref="topFilterFreshness">NOT OBSERVED</div>
                                <div class="ct-lft-card-meta">
                                    <span class="ct-lft-card-age" data-ref="topFilterAge">—</span>
                                </div>
                            </div>
                        </div>
                        <!-- Latest Verified Targeting Transition -->
                        <div class="ct-lft-transition-bar" data-ref="topFilterTransitionBar">
                            <span class="ct-lft-transition-label">LATEST TARGETING TRANSITION:</span>
                            <div class="ct-lft-transition-content" data-ref="topFilterChange">No verified targeting changes recorded</div>
                        </div>
                    </section>

                    <div class="ct-summary-section-label"><span>OUTBOUND LIVE SNAPSHOT</span><small>Campaign feed · current outbound operating metrics</small></div>
                    <div class="ct-kpis" aria-label="Outbound Operations KPIs">
                        ${kpiShell("campaigns", "Campaigns")}
                        ${kpiShell("waiting", "Waiting")}
                        ${kpiShell("onCall", "On Call")}
                        ${kpiShell("contacts", "Contact Pool")}
                        ${kpiShell("outbound", "Call Attempts")}
                        ${kpiShell("connected", "Connected Calls")}
                        ${kpiShell("loggedIn", "Logged In")}
                        ${kpiShell("maxWait", "Max Wait")}
                        ${kpiShell("abandoned", "Abandoned")}
                        ${kpiShell("goals", "Total Goals")}
                    </div>

                </header>

                <main class="ct-content">
                    <div class="ct-section-divider ct-outbound-divider" aria-label="Outbound Operations">
                        <div><span>OUTBOUND OPERATIONS</span><small>Campaign control · operating capacity · live performance</small></div>
                        <b>CAMPAIGNS FEED</b>
                    </div>
                    <section class="ct-alerts" aria-label="Operations Action Center">
                        <div class="ct-alert-title">
                            <div class="ct-alert-heading"><span>Action Center</span><small data-ref="alertSubtitle">Immediate operator actions</small></div>
                            <div class="ct-alert-controls"><span class="ct-alert-counter ct-critical-counter" data-ref="criticalCount">0 CRITICAL</span><span class="ct-alert-counter ct-warning-counter" data-ref="warningCount">0 AT RISK</span><button class="ct-alert-clear" type="button" data-ref="clearAlerts">Clear All</button></div>
                        </div>
                        <div class="ct-action-notice" data-ref="actionNotice" hidden aria-live="polite"></div><div class="ct-persistent-goals-container" data-ref="persistentGoalsContainer"></div><div class="ct-alert-list"></div>
                    </section>

                    <section class="ct-active-command-summary" data-ref="activeCommandSummary" aria-label="Active Campaigns Command Summary">
                        <div class="ct-active-summary-head">
                            <div class="ct-active-summary-title">
                                <span class="ct-active-pulse-dot"></span>
                                <strong>ACTIVE CAMPAIGNS COMMAND SUMMARY</strong>
                                <small data-ref="activeSummaryCount">Waiting for verified campaign data</small>
                            </div>
                            <div class="ct-active-summary-status">
                                <button type="button" class="ct-btn ct-clear-selection-btn" data-ref="clearSelectionBtn" hidden title="Clear selected campaign rows">Clear Selection (<span data-ref="selectionCount">0</span>)</button>
                                <span class="ct-active-summary-badge" data-ref="activeSummaryBadge">— ACTIVE</span>
                            </div>
                        </div>
                        <div class="ct-active-summary-table-wrap">
                            <table class="ct-active-summary-table">
                                <colgroup>
                                    <col class="ct-col-drag">
                                    <col class="ct-col-select">
                                    <col class="ct-col-name">
                                    <col class="ct-col-state">
                                    <col class="ct-col-agents">
                                    <col class="ct-col-waiting">
                                    <col class="ct-col-waitnow">
                                    <col class="ct-col-waittoday">
                                    <col class="ct-col-outbound">
                                    <col class="ct-col-human">
                                    <col class="ct-col-agentconnect">
                                    <col class="ct-col-goals">
                                    <col class="ct-col-abandoned">
                                    <col class="ct-col-connectrate">
                                    <col class="ct-col-leads">
                                    <col class="ct-col-runway">
                                    <col class="ct-col-health">
                                    <col class="ct-col-focus">
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th class="ct-th-drag" title="Drag to reorder rows">↕</th>
                                        <th class="ct-th-select" title="Select visible rows"><input type="checkbox" data-campaign-action="toggle-select-all" title="Select all visible campaigns"></th>
                                        <th class="ct-th-name">CAMPAIGN</th>
                                        <th class="ct-th-state">STATE</th>
                                        <th class="ct-th-agents ct-th-num" title="Logged in agents (if exposed)">AGENTS</th>
                                        <th class="ct-th-waiting ct-th-num" title="Current queue load (callers waiting / waiting agents)">WAITING</th>
                                        <th class="ct-th-waitnow ct-th-num" title="Current caller wait time">WAIT NOW</th>
                                        <th class="ct-th-waittoday ct-th-num" title="Maximum caller wait time today">WAIT TODAY</th>
                                        <th class="ct-th-outbound ct-th-num" title="Total outbound call attempts today">OUTBOUND ATTEMPTS</th>
                                        <th class="ct-th-human ct-th-num" title="Total human answered connects">HUMAN CONNECTS</th>
                                        <th class="ct-th-agentconnect ct-th-num" title="Total agent connected calls">AGENT CONNECTS</th>
                                        <th class="ct-th-goals ct-th-num" title="Total goals / conversions achieved today">GOALS</th>
                                        <th class="ct-th-abandoned ct-th-num" title="Abandoned calls and abandonment rate">ABANDONED</th>
                                        <th class="ct-th-connectrate ct-th-num" title="Verified Human Connects ÷ Outbound Attempts %">CONNECT RATE</th>
                                        <th class="ct-th-leads ct-th-num" title="Current live contacts in campaign">LIVE LEADS</th>
                                        <th class="ct-th-runway ct-th-center" title="Estimated contact runway">LEAD RUNWAY</th>
                                        <th class="ct-th-health ct-th-center" title="Campaign operational health rating">HEALTH</th>
                                        <th class="ct-th-focus ct-th-center" title="Focus Outbound monitor on this campaign">FOCUS</th>
                                    </tr>
                                </thead>
                                <tbody data-ref="activeSummaryRows">
                                    <tr><td colspan="18" class="ct-active-empty">Waiting for active campaigns…</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </section>



                    <div class="ct-actions">
                        <label class="ct-search" title="Filter campaigns by name">
                            <input type="search" placeholder="Search campaigns…" aria-label="Search campaigns" autocomplete="off">
                        </label>
                        <div class="ct-filter-group ct-state-filters" role="group" aria-label="Campaign state filter">
                            <button class="ct-filter-pill is-active" type="button" data-state-filter="all">All</button>
                            <button class="ct-filter-pill" type="button" data-state-filter="active">Active</button>
                            <button class="ct-filter-pill" type="button" data-state-filter="inactive">Inactive</button>
                        </div>
                        <div class="ct-filter-group ct-health-filters" role="group" aria-label="Campaign health filter">
                            <button class="ct-filter-pill is-active" type="button" data-health-filter="all">All Health</button>
                            <button class="ct-filter-pill" type="button" data-health-filter="critical">Critical</button>
                            <button class="ct-filter-pill" type="button" data-health-filter="warning">At Risk</button>
                            <button class="ct-filter-pill" type="button" data-health-filter="healthy">Healthy</button>
                            <button class="ct-filter-pill" type="button" data-health-filter="data">Data Check</button>
                        </div>
                        <label class="ct-threshold-wrap" title="Low lead alert threshold">
                            <span class="ct-threshold-label">Lead alert</span>
                            <input class="ct-threshold" type="number" min="0" step="1" aria-label="Low lead alert threshold" placeholder="2000">
                        </label>
                        <div class="ct-operating-wrap" title="Select one or more campaigns you are actively operating">
                            <span class="ct-operating-label">Operating Campaigns</span>
                            <button class="ct-operating-trigger" type="button" aria-label="Select operating campaigns" aria-haspopup="listbox" aria-expanded="false">
                                <span class="ct-operating-trigger-text">Select campaign(s)</span><span class="ct-operating-trigger-count">0</span><span class="ct-operating-trigger-arrow">▾</span>
                            </button>
                            <div class="ct-operating-menu" data-ref="operatingMenu" hidden>
                                <div class="ct-operating-menu-head"><strong>Select Operating Campaigns</strong><div class="ct-operating-menu-actions"><button type="button" class="ct-btn-sm" data-operating-action="all">All</button><button type="button" class="ct-btn-sm" data-operating-action="clear">Clear</button></div></div>
                                <div class="ct-operating-options" role="listbox" aria-multiselectable="true"></div>
                                <div class="ct-operating-menu-foot">Tick one or more campaigns. Your selections remain active until you change them.</div>
                            </div>
                        </div>
                        <button class="ct-btn ct-btn-text ct-refresh-btn" type="button" title="Refresh live CallTools data" aria-label="Refresh live CallTools data">↻ Refresh Data</button>
                        <button class="ct-btn ct-btn-text ct-manage-order-btn" type="button" title="Arrange campaign order" aria-label="Arrange campaign order">Arrange Campaigns</button>
                        <button class="ct-btn ct-btn-text ct-order-reset-btn" type="button" title="Reset campaign order" aria-label="Reset campaign order">Reset Order</button>
                        <button class="ct-btn ct-theme-btn" type="button" title="Toggle dark mode" aria-label="Toggle dark mode">${themeIcon()}</button>
                        <button class="ct-btn ct-btn-text ct-reset-btn" type="button" title="Reset dashboard position and size" aria-label="Reset dashboard position and size">Reset</button>
                    </div>

                    <!-- LIVE FILTER INTELLIGENCE SECTION -->
                    <section class="ct-lfi-section" data-ref="lfiSection" aria-label="Live Filter Intelligence">
                        <div class="ct-lfi-head">
                            <div class="ct-lfi-title-group">
                                <span class="ct-lfi-pulse-dot"></span>
                                <strong>LIVE FILTER INTELLIGENCE</strong>
                                <small data-ref="lfiHealthSubtitle">Monitoring inventory & verified campaign targeting</small>
                            </div>
                            <div class="ct-lfi-head-controls">
                                <span class="ct-lfi-badge is-waiting" data-ref="lfiFreshnessBadge">INVENTORY: WAITING</span>
                                <button type="button" class="ct-btn ct-lfi-toggle-btn" data-ref="lfiToggleBtn" title="Collapse or expand Live Filter Intelligence">Collapse ▴</button>
                            </div>
                        </div>

                        <div class="ct-lfi-body" data-ref="lfiBody">
                            <!-- A. Summary KPIs -->
                            <div class="ct-lfi-kpi-grid" aria-label="Live Filter Summary KPIs">
                                <div class="ct-lfi-kpi-card">
                                    <div class="ct-lfi-kpi-label">TOTAL FILTERS</div>
                                    <div class="ct-lfi-kpi-value" data-ref="lfiTotalFilters">—</div>
                                    <div class="ct-lfi-kpi-sub" data-ref="lfiTotalFiltersSub">Known filter inventory</div>
                                </div>
                                <div class="ct-lfi-kpi-card">
                                    <div class="ct-lfi-kpi-label">ACTIVE FILTERS</div>
                                    <div class="ct-lfi-kpi-value" data-ref="lfiActiveFilters">—</div>
                                    <div class="ct-lfi-kpi-sub" data-ref="lfiActiveFiltersSub">Active targeting rules</div>
                                </div>
                                <div class="ct-lfi-kpi-card">
                                    <div class="ct-lfi-kpi-label">INACTIVE FILTERS</div>
                                    <div class="ct-lfi-kpi-value" data-ref="lfiInactiveFilters">—</div>
                                    <div class="ct-lfi-kpi-sub" data-ref="lfiInactiveFiltersSub">Dormant / disabled rules</div>
                                </div>
                                <div class="ct-lfi-kpi-card">
                                    <div class="ct-lfi-kpi-label">AVAILABLE CONTACTS</div>
                                    <div class="ct-lfi-kpi-value" data-ref="lfiAvailableContacts">—</div>
                                    <div class="ct-lfi-kpi-sub" data-ref="lfiAvailableContactsSub">Contacts in matching filters</div>
                                </div>
                                <div class="ct-lfi-kpi-card">
                                    <div class="ct-lfi-kpi-label">RUNNING CAMPAIGNS</div>
                                    <div class="ct-lfi-kpi-value" data-ref="lfiRunningCampaigns">—</div>
                                    <div class="ct-lfi-kpi-sub" data-ref="lfiRunningCampaignsSub">Active dialer campaigns</div>
                                </div>
                                <div class="ct-lfi-kpi-card is-highlight">
                                    <div class="ct-lfi-kpi-label">VERIFIED ACTIVE CONFIGURATIONS</div>
                                    <div class="ct-lfi-kpi-value" data-ref="lfiVerifiedConfigs">—</div>
                                    <div class="ct-lfi-kpi-sub" data-ref="lfiVerifiedConfigsSub">Confirmed filter in use</div>
                                </div>
                            </div>

                            <!-- B & C: Tables Grid -->
                            <div class="ct-lfi-tables-grid">
                                <!-- B. Live Filter Inventory -->
                                <div class="ct-lfi-card">
                                    <div class="ct-lfi-card-head">
                                        <strong>Live Filter Inventory</strong>
                                        <small data-ref="lfiInventoryNote">Sourced from /manager/live-filters</small>
                                    </div>
                                    <div class="ct-lfi-table-wrap">
                                        <table class="ct-lfi-table">
                                            <thead>
                                                <tr>
                                                    <th>FILTER NAME</th>
                                                    <th>ACTIVE STATUS</th>
                                                    <th>AVAILABLE CONTACTS</th>
                                                    <th>TOTAL MATCHING CONTACTS</th>
                                                    <th>DIALER</th>
                                                    <th>LAST OBSERVED</th>
                                                    <th>FRESHNESS</th>
                                                </tr>
                                            </thead>
                                            <tbody data-ref="lfiInventoryTableBody">
                                                <tr><td colspan="7" class="ct-lfi-empty">No inventory observed yet. Open /manager/live-filters in CallTools to discover filters.</td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <!-- C. Campaign Assignment Matrix -->
                                <div class="ct-lfi-card">
                                    <div class="ct-lfi-card-head">
                                        <strong>Campaign Assignment Matrix</strong>
                                        <small data-ref="lfiMatrixNote">Correlated with /manager/campaigns</small>
                                    </div>
                                    <div class="ct-lfi-table-wrap">
                                        <table class="ct-lfi-table">
                                            <thead>
                                                <tr>
                                                    <th>CAMPAIGN</th>
                                                    <th>CAMPAIGN ID</th>
                                                    <th>STATE</th>
                                                    <th>AGENTS</th>
                                                    <th>CAMPAIGN LEAD POOL</th>
                                                    <th>ASSIGNED LIVE FILTER</th>
                                                    <th>FILTER COUNT</th>
                                                    <th>VERIFICATION SOURCE</th>
                                                    <th>LAST VERIFIED</th>
                                                    <th>FRESHNESS</th>
                                                    <th>USAGE STATUS</th>
                                                </tr>
                                            </thead>
                                            <tbody data-ref="lfiMatrixTableBody">
                                                <tr><td colspan="11" class="ct-lfi-empty">Waiting for campaign data…</td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div class="ct-focus-grid" aria-label="Outbound and inbound operating focus">
                        <section class="ct-focus-column ct-focus-outbound" aria-label="Outbound operating focus">
                            <div class="ct-focus-column-head"><div><span>OUTBOUND FOCUS</span><small>Operating campaign control & live performance</small></div><b>LIVE</b></div>
                    <section class="ct-operating-panel" aria-label="Operating campaign details">
                        <div class="ct-operating-identity">
                            <div class="ct-operating-identity-top">
                                <div class="ct-operating-eyebrow" data-ref="operatingEyebrow">OPERATING CAMPAIGN</div>
                                <div class="ct-operating-meta">
                                    <span><b>Selected</b><strong data-ref="operatingStatusText">—</strong></span>
                                    <span><b>Active</b><strong data-ref="operatingActiveSince">—</strong></span>
                                    <span><b>Selection</b><strong data-ref="operatingPriority">—</strong></span>
                                </div>
                                <span class="ct-operating-live" data-ref="operatingStatus">—</span>
                            </div>
                            <div class="ct-operating-name-row">
                                <span class="ct-operating-target">◎</span>
                                <strong data-ref="operatingCampaignName">No campaign selected</strong>
                                <div class="ct-operating-selected-list" data-ref="operatingSelectedList" aria-label="Selected operating campaigns"></div>
                            </div>
                        </div>
                        <div class="ct-operating-findings" data-ref="operatingFindings" aria-label="Outbound Operational Findings">
                            <div class="ct-operating-findings-head">
                                <strong>OUTBOUND OPERATIONAL FINDINGS</strong>
                                <span class="ct-operating-findings-badge" data-ref="operatingFindingsBadge">—</span>
                            </div>
                            <div class="ct-operating-findings-list" data-ref="operatingFindingsList"></div>
                        </div>
                        <div class="ct-operating-right">
                            <div class="ct-operating-summary-bar" aria-label="Operating campaign aggregate summary">
                                <div class="ct-operating-summary-item" title="Total logged-in agents across selected operating campaigns (if exposed in feed)"><b>TOTAL AGENTS</b><strong data-ref="opLoggedIn">—</strong></div>
                                <div class="ct-operating-summary-item" title="Current callers waiting across selected operating campaigns"><b>WAITING</b><strong data-ref="opWaiting">—</strong></div>
                                <div class="ct-operating-summary-item" title="Longest caller wait time currently observed among selected operating campaigns"><b>HIGHEST WAIT</b><strong data-ref="opWorstWait">—</strong></div>
                                <div class="ct-operating-summary-item" title="Agents currently connected on active calls across selected operating campaigns"><b>ON CALL</b><strong data-ref="opOnCall">—</strong></div>
                                <div class="ct-operating-summary-item" title="Verified human answered connects across selected operating campaigns"><b>CONNECTED</b><strong data-ref="opConnected">—</strong></div>
                                <div class="ct-operating-summary-item" title="Verified Human Connects ÷ Outbound Attempts % across selected operating campaigns"><b>CONNECT RATE</b><strong data-ref="opConnectRate">—</strong></div>
                                <div class="ct-operating-summary-item" title="Total outbound call attempts today across selected operating campaigns"><b>CALL ATTEMPTS</b><strong data-ref="opAttempts">—</strong></div>
                                <div class="ct-operating-summary-item" title="Total abandoned calls and abandonment rate % today across selected operating campaigns"><b>ABANDONED</b><strong data-ref="opAbandoned">—</strong></div>
                                <div class="ct-operating-summary-item" title="Total live contacts/leads available in selected operating campaigns"><b>LIVE LEADS</b><strong data-ref="opLiveLeads">—</strong></div>
                                <div class="ct-operating-summary-item" title="Estimated time until lead exhaustion at observed depletion rate"><b>LEAD RUNWAY</b><strong data-ref="opRunway">Measuring…</strong></div>
                            </div>
                            <div class="ct-operating-campaign-grid" data-ref="operatingCampaignCards" aria-label="Selected operating campaign metrics"></div>
                        </div>
                    </section>
                        </section>
                        <section class="ct-focus-column ct-focus-inbound" aria-label="Inbound operating focus">
                    <section class="ct-inbound-panel" aria-label="Inbound Operations">
                        <div class="ct-inbound-head">
                            <div><div class="ct-section-kicker">INBOUND OPERATIONS</div><strong>Overall inbound load · live demand · staffing pressure</strong><small data-ref="inboundStatus">Waiting for verified CallTools Queue data</small></div>
                            <div class="ct-inbound-head-right">
            <span class="ct-inbound-live" data-ref="inboundLive">WAITING</span>
            <button type="button" class="ct-inbound-refresh" data-ref="inboundRefresh" title="Refresh current CallTools feed">↻</button>
            <div class="ct-inbound-settings-wrap">
                <button type="button" class="ct-btn ct-inbound-settings-btn" data-ref="inboundSettingsBtn" title="Inbound Queue Settings">⚙ Inbound</button>
                <div class="ct-inbound-settings-menu" data-ref="inboundSettingsMenu" hidden>
                    <div class="ct-inbound-settings-title">Inbound Display & Alert Settings</div>
                    <label class="ct-inbound-setting-item"><input type="checkbox" data-inbound-setting="showArchived"> Show Archived Queues</label>
                    <label class="ct-inbound-setting-item"><input type="checkbox" data-inbound-setting="alertZeroCapacity" checked> Alert on 0-Capacity Holding</label>
                    <div class="ct-inbound-setting-row"><span>Warning Wait:</span><input type="number" min="5" max="300" step="5" data-inbound-setting="warnWaitThreshold" value="30">s</div>
                    <div class="ct-inbound-setting-row"><span>Critical Wait:</span><input type="number" min="10" max="600" step="5" data-inbound-setting="critWaitThreshold" value="60">s</div>
                </div>
            </div>
        </div>
                        </div>

                        <div class="ct-inbound-hero" aria-label="Inbound overall totals and live pressure">
                            <div class="ct-inbound-hero-card is-primary"><div class="ct-inbound-hero-label">CALLERS WAITING NOW</div><div class="ct-inbound-hero-value" data-ref="inboundHeroWaiting">—</div><div class="ct-inbound-hero-note" data-ref="inboundHeroWaitingNote">Current callers holding in active queues</div></div>
                            <div class="ct-inbound-hero-card"><div class="ct-inbound-hero-label">CALLS TODAY</div><div class="ct-inbound-hero-value" data-ref="inboundHeroToday">—</div><div class="ct-inbound-hero-note" data-ref="inboundHeroTodayNote">Active-queue total · answered + not answered</div></div>
                            <div class="ct-inbound-hero-card"><div class="ct-inbound-hero-label">LIVE CALLS NOW</div><div class="ct-inbound-hero-value" data-ref="inboundHeroCallsNow">—</div><div class="ct-inbound-hero-note" data-ref="inboundHeroCallsNowNote">Current Calls (Now) total across active queues</div></div>
                            <div class="ct-inbound-hero-card"><div class="ct-inbound-hero-label">MAX WAIT NOW</div><div class="ct-inbound-hero-value" data-ref="inboundHeroMaxWait">—</div><div class="ct-inbound-hero-note" data-ref="inboundHeroMaxWaitNote">Longest current caller wait in any active queue</div></div>
                        </div>

                        <div class="ct-inbound-total-strip" aria-label="Inbound total statistics">
                            ${inboundKpiShell("answeredToday", "ANSWERED TODAY")}
                            ${inboundKpiShell("notAnsweredToday", "NOT ANSWERED")}
                            ${inboundKpiShell("answerRate", "ANSWER RATE")}
                            ${inboundKpiShell("onQueue", "AGENTS ON QUEUE CALLS")}
                            ${inboundKpiShell("loggedMemberships", "QUEUE MEMBERSHIPS")}
                            ${inboundKpiShell("queues", "ACTIVE QUEUES")}
                            ${inboundKpiShell("goalsToday", "GOALS TODAY")}
                        </div>

                        <div class="ct-inbound-control" data-ref="inboundFocus"></div>

                        <div class="ct-inbound-signal-grid" data-ref="inboundSignals"></div>

                        <div class="ct-inbound-table-title"><strong>QUEUE DETAIL</strong><span>Every row uses the same verified snapshot as the totals above.</span></div>
                        <div class="ct-inbound-table-wrap">
                            <div class="ct-inbound-table-head"><span class="ct-qcol-name" style="text-align:left">QUEUE</span><span class="ct-qcol-logged" style="text-align:right" title="Logged in queue members">LOGGED</span><span class="ct-qcol-today" style="text-align:right" title="Total calls today">TODAY</span><span class="ct-qcol-answered" style="text-align:right" title="Answered calls today">ANSWERED</span><span class="ct-qcol-notans" style="text-align:right" title="Not answered calls today">NOT ANS</span><span class="ct-qcol-wait" style="text-align:right" title="Current callers waiting">WAIT</span><span class="ct-qcol-oncall" style="text-align:right" title="Agents on queue calls">ON CALL</span><span class="ct-qcol-maxwait" style="text-align:right" title="Maximum wait time">MAX WAIT</span><span class="ct-qcol-goals" style="text-align:right" title="Goals achieved today">GOALS</span><span class="ct-qcol-state" style="text-align:center" title="Queue operational state">STATE</span></div>
                            <div class="ct-inbound-table" data-ref="inboundTable"></div>
                        </div>
                        <div class="ct-inbound-note" data-ref="inboundNote">Inbound source: native CallTools Queues DOM. Queue Logged In is a queue-level membership metric, not a unique-agent count.</div>
                    </section>
                    <section class="ct-insights-panel" aria-label="Live Operations Insights">
                        <div class="ct-insights-head"><div><strong>LIVE OPERATIONS INSIGHTS</strong><span>Priority signals first · current live campaign conditions</span></div><span data-ref="insightsUpdated">Live</span></div>
                        <div class="ct-insights-grid">
                            ${insightShell("highestWait", "Highest Wait")}
                            ${insightShell("highestAbandoned", "Highest Abandoned")}
                            ${insightShell("highestQueue", "Highest Queue Load")}
                            ${insightShell("highestOnCall", "Highest Active Calls")}
                            ${insightShell("lowestLeads", "Lowest Live Leads")}
                            ${insightShell("noAgentQueue", "Queue Coverage")}
                            ${insightShell("maxUtilization", "Max Utilization")}
                            ${insightShell("abandonRate", "Highest Abandon %")}
                        </div>
                    </section>
                        </section>
                    </div>

                    <div class="ct-reconciled-footer" data-ref="reconciledFooter">
                        <span><b>Active Campaigns:</b> <span data-ref="footerActiveTotals">—</span></span>
                        <span><b>All Visible Directory Rows:</b> <span data-ref="footerVisibleTotals">—</span></span>
                    </div>

                    <details class="ct-directory-drawer" style="margin-top:6px;border:1px solid rgba(148,163,184,.15);border-radius:6px;padding:3px 8px;background:rgba(15,23,42,.35);">
                        <summary style="cursor:pointer;color:#94a3b8;font-size:10px;font-weight:700;padding:3px 0;user-select:none;">▸ Secondary Campaign Directory & Detailed Cards (<span data-ref="campaignSectionCount">18 campaigns</span>)</summary>
                        <section class="ct-command-strip ct-source-strip" aria-label="Source health">
                            <div class="ct-command-item"><div class="ct-command-label">Data Freshness</div><div class="ct-command-value" data-ref="dataAge">Waiting</div></div>
                            <div class="ct-command-item"><div class="ct-command-label">Feed Heartbeat</div><div class="ct-command-value" data-ref="feedHeartbeat">Waiting</div></div>
                            <div class="ct-command-item"><div class="ct-command-label">Lead Runway</div><div class="ct-command-value" data-ref="leadRunway">Measuring…</div></div>
                            <div class="ct-command-item"><div class="ct-command-label">Recovery</div><div class="ct-command-value" data-ref="recoveryState">Standby</div></div>
                        </section>

                        <div class="ct-campaigns-head" aria-label="Campaign list status">
                            <div><strong>CAMPAIGNS</strong><small data-ref="campaignSectionCountSub">Waiting for CallTools campaign data</small></div>
                            <span class="ct-campaigns-state" data-ref="campaignSectionState">WAITING</span>
                        </div>
                        <div class="ct-filter-bar" aria-label="Campaign filters">
                            <button class="ct-filter-btn is-active" type="button" data-filter="all">All</button>
                            <button class="ct-filter-btn" type="button" data-filter="critical">Critical</button>
                            <button class="ct-filter-btn" type="button" data-filter="warning">At Risk</button>
                            <button class="ct-filter-btn" type="button" data-filter="healthy">Healthy</button>
                            <button class="ct-filter-btn" type="button" data-filter="data">Data Check</button>
                        </div>
                        <div class="ct-order-hint" data-ref="orderHint" hidden><span class="ct-order-icon">↕</span><span>ARRANGE MODE ON — use the dedicated order workspace below. Live metrics never change your manual order.</span></div>
                        <section class="ct-order-editor" data-ref="orderEditor" hidden aria-label="Campaign arrangement workspace">
                            <div class="ct-order-editor-head">
                                <div><strong>ARRANGE CAMPAIGNS</strong><small>Set the exact display order once. This order stays fixed while live metrics update.</small></div>
                                <div class="ct-order-editor-actions"><button type="button" class="ct-order-editor-btn" data-order-action="reset">Reset to default</button><button type="button" class="ct-order-editor-btn is-primary" data-order-action="done">Done</button></div>
                            </div>
                            <div class="ct-order-editor-tip"><span>↕</span><span>Use <b>↑ / ↓</b> for precise positioning. The order affects display only — it never changes CallTools campaign settings. Changes persist immediately.</span></div>
                            <div class="ct-order-editor-list" data-ref="orderEditorList"></div>
                        </section>
                        <div class="ct-table-head" aria-hidden="true"><span>#</span><span>CAMPAIGN</span><span>STATUS</span><span>TOTAL AGENTS</span><span>WAITING</span><span>ON CALL</span><span>WORST WAIT</span><span>LIVE LEADS</span><span>CONNECTED</span><span>CALL ATTEMPTS</span><span>ABANDONED</span><span>RUNWAY</span><span>ACTIONS</span></div>
                        <div class="ct-list" aria-live="polite"></div>
                    </details>

                </main>
                <div class="ct-resize-handle" title="Resize dashboard" aria-hidden="true"></div>
            </div>
        `;

        refs = {
            updated: root.querySelector(".ct-updated"),
            live: root.querySelector('[data-ref="live"]'),
            headerRefresh: root.querySelector('[data-ref="headerRefresh"]'),
            zoomOut: root.querySelector('[data-ref="zoomOut"]'),
            zoomReset: root.querySelector('[data-ref="zoomReset"]'),
            zoomIn: root.querySelector('[data-ref="zoomIn"]'),
            topLiveFilterStrip: root.querySelector('[data-ref="topLiveFilterStrip"]') || root.querySelector('[data-ref="topLiveFilterPanel"]'),
            topLiveFilterPanel: root.querySelector('[data-ref="topLiveFilterPanel"]'),
            topFilterDialer: root.querySelector('[data-ref="topFilterDialer"]'),
            topFilterCampaign: root.querySelector('[data-ref="topFilterCampaign"]'),
            topFilterVerificationState: root.querySelector('[data-ref="topFilterVerificationState"]'),
            topFilterBadge: root.querySelector('[data-ref="topFilterBadge"]'),
            topFilterSource: root.querySelector('[data-ref="topFilterSource"]'),
            topFilterObserved: root.querySelector('[data-ref="topFilterObserved"]'),
            topFilterChange: root.querySelector('[data-ref="topFilterChange"]'),
            topFilterPool: root.querySelector('[data-ref="topFilterPool"]'),
            topFilterPoolTime: root.querySelector('[data-ref="topFilterPoolTime"]'),
            topFilterAvailableContacts: root.querySelector('[data-ref="topFilterAvailableContacts"]'),
            topFilterAvailableTime: root.querySelector('[data-ref="topFilterAvailableTime"]'),
            topFilterMatch: root.querySelector('[data-ref="topFilterMatch"]'),
            topFilterFreshness: root.querySelector('[data-ref="topFilterFreshness"]'),
            topFilterName: root.querySelector('[data-ref="topFilterName"]'),
            topFilterStatus: root.querySelector('[data-ref="topFilterStatus"]'),
            topFilterId: root.querySelector('[data-ref="topFilterId"]'),
            topFilterConfidence: root.querySelector('[data-ref="topFilterConfidence"]'),
            topFilterVerifySource: root.querySelector('[data-ref="topFilterVerifySource"]'),
            topFilterAge: root.querySelector('[data-ref="topFilterAge"]'),
            activeCommandSummary: root.querySelector('[data-ref="activeCommandSummary"]'),
            activeSummaryCount: root.querySelector('[data-ref="activeSummaryCount"]'),
            activeSummaryBadge: root.querySelector('[data-ref="activeSummaryBadge"]'),
            activeSummaryRows: root.querySelector('[data-ref="activeSummaryRows"]'),
            clearSelectionBtn: root.querySelector('[data-ref="clearSelectionBtn"]'),
            selectionCount: root.querySelector('[data-ref="selectionCount"]'),
            reconciledFooter: root.querySelector('[data-ref="reconciledFooter"]'),
            footerActiveTotals: root.querySelector('[data-ref="footerActiveTotals"]'),
            footerVisibleTotals: root.querySelector('[data-ref="footerVisibleTotals"]'),
            lfiSection: root.querySelector('[data-ref="lfiSection"]'),
            lfiHealthSubtitle: root.querySelector('[data-ref="lfiHealthSubtitle"]'),
            lfiFreshnessBadge: root.querySelector('[data-ref="lfiFreshnessBadge"]'),
            lfiToggleBtn: root.querySelector('[data-ref="lfiToggleBtn"]'),
            lfiBody: root.querySelector('[data-ref="lfiBody"]'),
            lfiTotalFilters: root.querySelector('[data-ref="lfiTotalFilters"]'),
            lfiTotalFiltersSub: root.querySelector('[data-ref="lfiTotalFiltersSub"]'),
            lfiActiveFilters: root.querySelector('[data-ref="lfiActiveFilters"]'),
            lfiActiveFiltersSub: root.querySelector('[data-ref="lfiActiveFiltersSub"]'),
                lfiInactiveFilters: root.querySelector('[data-ref="lfiInactiveFilters"]'),
                lfiInactiveFiltersSub: root.querySelector('[data-ref="lfiInactiveFiltersSub"]'),
                lfiAvailableContacts: root.querySelector('[data-ref="lfiAvailableContacts"]'),
                lfiAvailableContactsSub: root.querySelector('[data-ref="lfiAvailableContactsSub"]'),
            lfiRunningCampaigns: root.querySelector('[data-ref="lfiRunningCampaigns"]'),
            lfiRunningCampaignsSub: root.querySelector('[data-ref="lfiRunningCampaignsSub"]'),
            lfiVerifiedConfigs: root.querySelector('[data-ref="lfiVerifiedConfigs"]'),
            lfiVerifiedConfigsSub: root.querySelector('[data-ref="lfiVerifiedConfigsSub"]'),
            lfiInventoryNote: root.querySelector('[data-ref="lfiInventoryNote"]'),
            lfiInventoryTableBody: root.querySelector('[data-ref="lfiInventoryTableBody"]'),
            lfiMatrixNote: root.querySelector('[data-ref="lfiMatrixNote"]'),
            lfiMatrixTableBody: root.querySelector('[data-ref="lfiMatrixTableBody"]'),
            lfiHistoryList: root.querySelector('[data-ref="lfiHistoryList"]'),
            search: root.querySelector(".ct-search input"),
            threshold: root.querySelector(".ct-threshold"),
            operatingTrigger: root.querySelector(".ct-operating-trigger"),
            operatingTriggerText: root.querySelector(".ct-operating-trigger-text"),
            operatingTriggerCount: root.querySelector(".ct-operating-trigger-count"),
            operatingMenu: root.querySelector('[data-ref="operatingMenu"]'),
            operatingOptions: root.querySelector(".ct-operating-options"),
            refresh: root.querySelector(".ct-refresh-btn"),
            manageOrder: root.querySelector(".ct-manage-order-btn"),
            theme: root.querySelector(".ct-theme-btn"),
            orderReset: root.querySelector(".ct-order-reset-btn"),
            reset: root.querySelector(".ct-reset-btn"),
            collapse: root.querySelector('[data-ref="headerCollapse"]'),
            header: root.querySelector(".ct-summary"),
            resize: root.querySelector(".ct-resize-handle"),
            campaignSectionCount: root.querySelector('[data-ref="campaignSectionCount"]'),
            campaignSectionState: root.querySelector('[data-ref="campaignSectionState"]'),
            alertCount: root.querySelector('[data-ref="alertCount"]'),
            criticalCount: root.querySelector('[data-ref="criticalCount"]'),
            warningCount: root.querySelector('[data-ref="warningCount"]'),
            alertSubtitle: root.querySelector('[data-ref="alertSubtitle"]'),
            actionNotice: root.querySelector('[data-ref="actionNotice"]'),
            persistentGoalsContainer: root.querySelector('[data-ref="persistentGoalsContainer"]'),
            alerts: root.querySelector(".ct-alert-list"),
            insightsUpdated: root.querySelector('[data-ref="insightsUpdated"]'),
            insights: {
                highestWait: insightRefs("highestWait"), highestAbandoned: insightRefs("highestAbandoned"),
                highestQueue: insightRefs("highestQueue"), highestOnCall: insightRefs("highestOnCall"),
                lowestLeads: insightRefs("lowestLeads"), noAgentQueue: insightRefs("noAgentQueue"),
                maxUtilization: insightRefs("maxUtilization"), abandonRate: insightRefs("abandonRate")
            },
            operatingCampaign: root.querySelector('[data-ref="operatingCampaign"]'),
            operatingEyebrow: root.querySelector('[data-ref="operatingEyebrow"]'),
            operatingCampaignName: root.querySelector('[data-ref="operatingCampaignName"]'),
            operatingSelectedList: root.querySelector('[data-ref="operatingSelectedList"]'),
            operatingCampaignCards: root.querySelector('[data-ref="operatingCampaignCards"]'),
            operatingFindings: root.querySelector('[data-ref="operatingFindings"]'),
            operatingFindingsBadge: root.querySelector('[data-ref="operatingFindingsBadge"]'),
            operatingFindingsList: root.querySelector('[data-ref="operatingFindingsList"]'),
            operatingStatus: root.querySelector('[data-ref="operatingStatus"]'),
            operatingStatusText: root.querySelector('[data-ref="operatingStatusText"]'),
            operatingActiveSince: root.querySelector('[data-ref="operatingActiveSince"]'),
            operatingPriority: root.querySelector('[data-ref="operatingPriority"]'),
            opLiveLeads: root.querySelector('[data-ref="opLiveLeads"]'),
            opWaiting: root.querySelector('[data-ref="opWaiting"]'),
            opOnCall: root.querySelector('[data-ref="opOnCall"]'),
            opLoggedIn: root.querySelector('[data-ref="opLoggedIn"]'),
            opWorstWait: root.querySelector('[data-ref="opWorstWait"]'),
            opQueue: root.querySelector('[data-ref="opQueue"]'),
            opAbandoned: root.querySelector('[data-ref="opAbandoned"]'),
            opAttempts: root.querySelector('[data-ref="opAttempts"]'),
            opConnected: root.querySelector('[data-ref="opConnected"]'),
            opConnectRate: root.querySelector('[data-ref="opConnectRate"]'),
            opRunway: root.querySelector('[data-ref="opRunway"]'),
            opAlignment: root.querySelector('[data-ref="opAlignment"]'),
            topWait: root.querySelector('[data-ref="topWait"]'),
            queueLoad: root.querySelector('[data-ref="queueLoad"]'),
            agentAlignment: root.querySelector('[data-ref="agentAlignment"]'),
            calltoolsHealth: root.querySelector('[data-ref="calltoolsHealth"]'),
            dataAge: root.querySelector('[data-ref="dataAge"]'),
            feedHeartbeat: root.querySelector('[data-ref="feedHeartbeat"]'),
            leadRunway: root.querySelector('[data-ref="leadRunway"]'),
            recoveryState: root.querySelector('[data-ref="recoveryState"]'),
            inboundStatus: root.querySelector('[data-ref="inboundStatus"]'),
            inboundLive: root.querySelector('[data-ref="inboundLive"]'),
            inboundHeroWaiting: root.querySelector('[data-ref="inboundHeroWaiting"]'),
            inboundHeroWaitingNote: root.querySelector('[data-ref="inboundHeroWaitingNote"]'),
            inboundHeroCallsNow: root.querySelector('[data-ref="inboundHeroCallsNow"]'),
            inboundHeroCallsNowNote: root.querySelector('[data-ref="inboundHeroCallsNowNote"]'),
            inboundHeroToday: root.querySelector('[data-ref="inboundHeroToday"]'),
            inboundHeroTodayNote: root.querySelector('[data-ref="inboundHeroTodayNote"]'),
            inboundHeroMaxWait: root.querySelector('[data-ref="inboundHeroMaxWait"]'),
            inboundHeroMaxWaitNote: root.querySelector('[data-ref="inboundHeroMaxWaitNote"]'),
            inboundRefresh: root.querySelector('[data-ref="inboundRefresh"]'),
            inboundFocus: root.querySelector('[data-ref="inboundFocus"]'),
            inboundSignals: root.querySelector('[data-ref="inboundSignals"]'),
            inboundTable: root.querySelector('[data-ref="inboundTable"]'),
            inboundNote: root.querySelector('[data-ref="inboundNote"]'),
            inboundKpis: {
                queues: inboundKpiRefs("queues"), todayCalls: inboundKpiRefs("todayCalls"), answeredToday: inboundKpiRefs("answeredToday"),
                notAnsweredToday: inboundKpiRefs("notAnsweredToday"), callsNow: inboundKpiRefs("callsNow"), waiting: inboundKpiRefs("waiting"),
                onQueue: inboundKpiRefs("onQueue"), maxWait: inboundKpiRefs("maxWait"), goalsToday: inboundKpiRefs("goalsToday"), answerRate: inboundKpiRefs("answerRate"),
                loggedMemberships: inboundKpiRefs("loggedMemberships")
            },
            inboundStaffing: root.querySelector('[data-ref="inboundStaffing"]'),
            clearAlerts: root.querySelector('[data-ref="clearAlerts"]'),
            orderHint: root.querySelector('[data-ref="orderHint"]'),
            orderEditor: root.querySelector('[data-ref="orderEditor"]'),
            orderEditorList: root.querySelector('[data-ref="orderEditorList"]'),
            systemHealth: root.querySelector('[data-ref="systemHealth"]'),
            recoveryCount: root.querySelector('[data-ref="recoveryCount"]'),
            dataConfidence: root.querySelector('[data-ref="dataConfidence"]'),
            list: root.querySelector(".ct-list"),
            filterButtons: Array.from(root.querySelectorAll(".ct-filter-btn")),
            stateFilterButtons: Array.from(root.querySelectorAll("[data-state-filter]")),
            healthFilterButtons: Array.from(root.querySelectorAll("[data-health-filter]")),
            kpis: {
                campaigns: kpiRefs("campaigns"), waiting: kpiRefs("waiting"), onCall: kpiRefs("onCall"),
                contacts: kpiRefs("contacts"), outbound: kpiRefs("outbound"), connected: kpiRefs("connected"), loggedIn: kpiRefs("loggedIn"),
                maxWait: kpiRefs("maxWait"), abandoned: kpiRefs("abandoned"), goals: kpiRefs("goals")
            }
        };

        refs.threshold.value = String(state.contactThreshold);
        refs.collapse.textContent = state.allCollapsed ? "Expand" : "Collapse";
        refs.collapse.setAttribute("aria-label", state.allCollapsed ? "Expand operations panel" : "Collapse operations panel");
        root.classList.toggle("is-panel-collapsed", state.allCollapsed);
        if (refs.search && state.query) {
            refs.search.value = state.query;
        }

        const applyCampaignSearch = function () {
            state.query = String(refs.search.value || "").trim();
            persistSearchQuery();
            scheduleRender();
        };
        refs.search.addEventListener("input", applyCampaignSearch);
        refs.search.addEventListener("change", applyCampaignSearch);
        refs.search.addEventListener("search", applyCampaignSearch);
        refs.search.addEventListener("keyup", function (event) {
            if (event.key === "Escape" && refs.search.value) {
                refs.search.value = "";
                applyCampaignSearch();
            }
        });
        refs.threshold.addEventListener("input", function () {
            state.contactThreshold = Math.max(0, numberValue(refs.threshold.value));
            writeStorage(CONTACT_THRESHOLD_KEY, String(state.contactThreshold));
            state.lastSeveritySignature = "";
            addCurrentStateAlerts(state.campaigns);
            scheduleRender();
        });
        refs.operatingTrigger.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            const willOpen = refs.operatingMenu.hidden;
            refs.operatingMenu.hidden = !willOpen;
            refs.operatingTrigger.setAttribute("aria-expanded", String(willOpen));
            if (willOpen) {
                updateOperatingSelect(state.campaigns);
            }
        });
        refs.operatingMenu.addEventListener("click", function (event) {
            event.stopPropagation();
            const selectAll = event.target.closest('[data-operating-action="all"]');
            if (selectAll) {
                event.preventDefault();
                const all = state.campaigns || [];
                const allIds = all.map(function(c) {
                    return c.rawId ? String(c.rawId) : c.id ? String(c.id) : c.__id ? String(c.__id) : String(c.name || "").trim().toLowerCase();
                }).filter(Boolean);
                writeOperatingCampaigns(allIds);
                addCurrentStateAlerts(state.campaigns);
                showActionNotice("All visible campaigns selected.");
                updateOperatingSelect(state.campaigns);
                scheduleRender();
                return;
            }
            const clear = event.target.closest('[data-operating-action="clear"]');
            if (clear) {
                event.preventDefault();
                writeOperatingCampaigns([]);
                addCurrentStateAlerts(state.campaigns);
                showActionNotice("Operating campaign selection cleared.");
                updateOperatingSelect(state.campaigns);
                scheduleRender();
                return;
            }
            const option = event.target.closest('[data-operating-id]');
            if (!option) return;
            event.preventDefault();
            const id = option.getAttribute('data-operating-id');
            const next = new Set((state.operatingCampaigns || []).map(function(v) { return String(v || "").trim(); }).filter(Boolean));
            let adding = true;
            const all = state.campaigns || [];
            const targetCampaign = all.find(function(c) {
                const cid = c.rawId || c.id || c.__id || campaignId(c);
                return (cid && cid === id) || (c.name && String(c.name).trim().toLowerCase() === id.toLowerCase());
            });
            const canonicalId = targetCampaign ? (targetCampaign.rawId ? String(targetCampaign.rawId) : targetCampaign.id ? String(targetCampaign.id) : targetCampaign.__id ? String(targetCampaign.__id) : String(targetCampaign.name || "").trim().toLowerCase()) : id;
            if (targetCampaign) {
                if (isCampaignSelected(targetCampaign, next)) {
                    if (targetCampaign.rawId) next.delete(String(targetCampaign.rawId));
                    if (targetCampaign.id) next.delete(String(targetCampaign.id));
                    if (targetCampaign.__id) next.delete(String(targetCampaign.__id));
                    if (targetCampaign.name) next.delete(String(targetCampaign.name).trim().toLowerCase());
                    next.delete(canonicalId);
                    next.delete(id);
                    adding = false;
                } else {
                    next.add(canonicalId);
                    adding = true;
                }
            } else {
                if (next.has(id)) {
                    next.delete(id);
                    adding = false;
                } else {
                    next.add(id);
                    adding = true;
                }
            }
            option.classList.toggle("is-selected", adding);
            option.setAttribute("aria-selected", String(adding));
            const check = option.querySelector(".ct-operating-check");
            if (check) check.textContent = adding ? "✓" : "";
            writeOperatingCampaigns(Array.from(next));
            addCurrentStateAlerts(state.campaigns);
            showActionNotice(adding ? (targetCampaign ? safeValue(targetCampaign.name) : "Campaign") + " added to operating set." : (targetCampaign ? safeValue(targetCampaign.name) : "Campaign") + " removed from operating set.");
            updateOperatingSelect(state.campaigns);
            scheduleRender();
        });
        operatingOutsideClickHandler = function (event) {
            if (!refs.operatingMenu || refs.operatingMenu.hidden) return;
            if (event.target.closest && (event.target.closest(".ct-operating-wrap") || event.target.closest(".ct-operating-menu"))) return;
            refs.operatingMenu.hidden = true;
            refs.operatingTrigger.setAttribute("aria-expanded", "false");
        };
        operatingEscapeHandler = function (event) {
            if (event.key === "Escape" && refs.operatingMenu && !refs.operatingMenu.hidden) {
                refs.operatingMenu.hidden = true;
                refs.operatingTrigger.setAttribute("aria-expanded", "false");
                refs.operatingTrigger.focus();
            }
        };
        document.addEventListener("click", operatingOutsideClickHandler);
        document.addEventListener("keydown", operatingEscapeHandler);

        document.addEventListener(REFRESH_RESULT_EVENT, function (event) {
            state.isRefreshing = false;
            if (refs.refresh) {
                refs.refresh.classList.remove("is-refreshing");
                refs.refresh.textContent = "↻ Refresh Data";
            }
            if (refs.headerRefresh) {
                refs.headerRefresh.classList.remove("is-refreshing");
            }
            const detail = event.detail || {};
            if (intelligenceEngine && intelligenceEngine.recordRefreshResult) {
                intelligenceEngine.recordRefreshResult(detail);
            }
            state.lastRefreshedAt = detail.completedAt || Date.now();
            const recordsText = detail.recordsRead !== undefined ? detail.recordsRead + " records" : "data";
            let noticeMsg = "Refreshed " + recordsText + " from " + (detail.source || "CallTools");
            if (detail.unavailableSources && detail.unavailableSources.length > 0) {
                noticeMsg += " (Unavailable: " + detail.unavailableSources.join(", ") + ")";
            }
            showActionNotice(noticeMsg);
            updateConnectionState(Date.now());
            scheduleRender();
        });
        const requestRefresh = function () {
            if (state.isRefreshing) return;
            state.isRefreshing = true;
            if (refs.refresh) {
                refs.refresh.classList.add("is-refreshing");
                refs.refresh.textContent = "↻ Refreshing…";
            }
            if (refs.headerRefresh) {
                refs.headerRefresh.classList.add("is-refreshing");
            }
            document.dispatchEvent(new CustomEvent(REQUEST_REFRESH_EVENT));
            setTimeout(function () {
                if (state.isRefreshing) {
                    state.isRefreshing = false;
                    if (refs.refresh) {
                        refs.refresh.classList.remove("is-refreshing");
                        refs.refresh.textContent = "↻ Refresh Data";
                    }
                    if (refs.headerRefresh) {
                        refs.headerRefresh.classList.remove("is-refreshing");
                    }
                }
            }, 5000);
        };
                if (refs.inboundSettingsBtn && refs.inboundSettingsMenu) {
            refs.inboundSettingsBtn.addEventListener("click", function (e) {
                e.stopPropagation();
                const isHidden = refs.inboundSettingsMenu.hidden;
                refs.inboundSettingsMenu.hidden = !isHidden;
            });
            document.addEventListener("click", function (e) {
                if (refs.inboundSettingsMenu && !refs.inboundSettingsMenu.contains(e.target) && e.target !== refs.inboundSettingsBtn) {
                    refs.inboundSettingsMenu.hidden = true;
                }
            });
            refs.inboundSettingsMenu.addEventListener("change", function (e) {
                const target = e.target;
                const setting = target.dataset.inboundSetting;
                if (!setting) return;
                if (target.type === "checkbox") {
                    state.inboundSettings[setting] = Boolean(target.checked);
                } else if (target.type === "number") {
                    state.inboundSettings[setting] = Math.max(1, Number(target.value) || 30);
                }
                persistInboundSettings();
                updateInboundPanel();
            });
        }
        if (refs.inboundRefresh) refs.inboundRefresh.addEventListener("click", function () {
            document.dispatchEvent(new CustomEvent(REQUEST_INBOUND_REFRESH_EVENT));
        });
        refs.refresh.addEventListener("click", requestRefresh);
        if (refs.headerRefresh) refs.headerRefresh.addEventListener("click", requestRefresh);
        if (refs.zoomOut) refs.zoomOut.addEventListener("click", function () { setZoom(state.zoom - 0.1); });
        if (refs.zoomIn) refs.zoomIn.addEventListener("click", function () { setZoom(state.zoom + 0.1); });
        if (refs.zoomReset) refs.zoomReset.addEventListener("click", function () { setZoom(1); });
        refs.manageOrder.addEventListener("click", function () { setReorderMode(!state.reorderMode); });
        refs.theme.addEventListener("click", function () {
            state.theme = state.theme === "dark" ? "light" : "dark";
            root.dataset.theme = state.theme;
            writeStorage(THEME_KEY, state.theme);
        });
        refs.collapse.addEventListener("click", function () {
            state.allCollapsed = !state.allCollapsed;
            state.layout.collapsed = state.allCollapsed;
            refs.collapse.textContent = state.allCollapsed ? "Expand" : "Collapse";
        refs.collapse.setAttribute("aria-label", state.allCollapsed ? "Expand operations panel" : "Collapse operations panel");
            root.classList.toggle("is-panel-collapsed", state.allCollapsed);
            applyLayout(state.layout); persistLayout();
        });
        if (refs.lfiToggleBtn) {
            refs.lfiToggleBtn.addEventListener("click", function () {
                const isCollapsed = refs.lfiBody ? !refs.lfiBody.hidden : false;
                if (refs.lfiBody) refs.lfiBody.hidden = isCollapsed;
                refs.lfiToggleBtn.textContent = isCollapsed ? "Expand ▾" : "Collapse ▴";
                try {
                    localStorage.setItem(PREFIX + "lfi_collapsed_v1", isCollapsed ? "1" : "0");
                } catch (e) {}
            });
            try {
                const savedCollapsed = localStorage.getItem(PREFIX + "lfi_collapsed_v1");
                if (savedCollapsed === "1" && refs.lfiBody) {
                    refs.lfiBody.hidden = true;
                    refs.lfiToggleBtn.textContent = "Expand ▾";
                }
            } catch (e) {}
        }
        refs.orderReset.addEventListener("click", function () {
            const sourceOrder = state.campaigns.map(function (campaign, index) { return campaignId(campaign, index); });
            state.manualOrder = defaultCampaignOrder(state.campaigns, sourceOrder);
            persistCampaignOrder();
            state.sortedIds = [];
            scheduleRender();
        });
        if (refs.orderEditor) refs.orderEditor.addEventListener("click", function (event) {
            const action = event.target.closest("[data-order-action]");
            if (!action) return;
            event.preventDefault();
            event.stopPropagation();
            const type = action.dataset.orderAction;
            if (type === "done") {
                setReorderMode(false);
                return;
            }
            if (type === "reset") {
                const sourceOrder = state.campaigns.map(function (campaign, index) { return campaignId(campaign, index); });
                state.manualOrder = defaultCampaignOrder(state.campaigns, sourceOrder);
                persistCampaignOrder();
                state.sortedIds = [];
                renderOrderEditor();
                scheduleRender();
                showActionNotice("Campaign display order reset to the CallTools/source order.");
                return;
            }
            const row = action.closest("[data-order-id]");
            if (!row) return;
            const id = row.dataset.orderId;
            const direction = type === "up" ? -1 : type === "down" ? 1 : 0;
            if (!direction) return;
            const order = Array.isArray(state.manualOrder) ? state.manualOrder.slice() : [];
            const index = order.indexOf(id);
            const target = index + direction;
            if (index < 0 || target < 0 || target >= order.length) return;
            const swap = order[target];
            order[target] = order[index];
            order[index] = swap;
            state.manualOrder = order;
            persistCampaignOrder();
            state.sortedIds = order.slice();
            renderOrderEditor();
            scheduleRender();
        });
        refs.clearAlerts.addEventListener("click", clearAttentionCenter);
        if (refs.persistentGoalsContainer) {
            refs.persistentGoalsContainer.addEventListener("click", function(event) {
                const btn = event.target.closest("[data-noted-id]");
                if (btn) {
                    event.preventDefault();
                    event.stopPropagation();
                    const card = btn.closest(".ct-persistent-goal-card");
                    if (card) card.remove();
                    if (refs.persistentGoalsContainer) refs.persistentGoalsContainer.dataset.signature = "";
                    acknowledgePersistentGoalAlert(btn.getAttribute("data-noted-id"));
                    updateAlerts();
                    showActionNotice("Persistent goal alert acknowledged [NOTED].");
                    return;
                }
                const intelActionBtn = event.target.closest("[data-intel-action]");
                if (intelActionBtn) {
                    event.preventDefault();
                    event.stopPropagation();
                    const action = intelActionBtn.dataset.intelAction;
                    if (action === "dismiss") {
                        const intelId = intelActionBtn.dataset.intelId;
                        const card = intelActionBtn.closest(".ct-intelligence-card");
                        if (card) card.remove();
                        if (refs.persistentGoalsContainer) refs.persistentGoalsContainer.dataset.signature = "";
                        if (intelligenceEngine && intelId) {
                            intelligenceEngine.acknowledgeAlert(intelId);
                        }
                        updateAlerts();
                        showActionNotice("Alert dismissed until condition changes.");
                        scheduleRender();
                    } else if (action === "focus") {
                        const target = intelActionBtn.dataset.target;
                        if (target) {
                            focusCampaign(target, false);
                        }
                    }
                    return;
                }
                const intelBtn = event.target.closest("[data-intel-noted-id]");
                if (intelBtn) {
                    event.preventDefault();
                    event.stopPropagation();
                    const card = intelBtn.closest(".ct-intelligence-card");
                    if (card) card.remove();
                    if (refs.persistentGoalsContainer) refs.persistentGoalsContainer.dataset.signature = "";
                    if (intelligenceEngine) {
                        intelligenceEngine.acknowledgeAlert(intelBtn.getAttribute("data-intel-noted-id"));
                    }
                    updateAlerts();
                    showActionNotice("Change intelligence alert acknowledged [NOTED].");
                    scheduleRender();
                    return;
                }
            });
        }
        if (refs.activeSummaryRows) {
            refs.activeSummaryRows.addEventListener("click", function (event) {
                const orderBtn = event.target.closest("[data-row-order-action]");
                if (orderBtn) {
                    event.preventDefault();
                    event.stopPropagation();
                    const tr = orderBtn.closest("tr.ct-active-row");
                    if (!tr) return;
                    const id = tr.dataset.campaignId;
                    const visibleTrs = Array.from(refs.activeSummaryRows.querySelectorAll("tr.ct-active-row"));
                    const visibleIdx = visibleTrs.indexOf(tr);
                    if (visibleIdx === -1) return;
                    const action = orderBtn.dataset.rowOrderAction;
                    if (action === "up" && visibleIdx > 0) {
                        const prevId = visibleTrs[visibleIdx - 1].dataset.campaignId;
                        reorderCampaignByIds(id, prevId, false);
                    } else if (action === "down" && visibleIdx < visibleTrs.length - 1) {
                        const nextId = visibleTrs[visibleIdx + 1].dataset.campaignId;
                        reorderCampaignByIds(id, nextId, true);
                    }
                    return;
                }
                const btn = event.target.closest("[data-campaign-focus]");
                if (btn) {
                    event.preventDefault();
                    event.stopPropagation();
                    const id = btn.getAttribute("data-campaign-focus");
                    if (id) focusCampaign(id, true);
                    return;
                }
                const nameBtn = event.target.closest(".ct-td-campaign b, .ct-td-campaign");
                if (nameBtn && !event.target.closest("input, button, a")) {
                    const row = nameBtn.closest("tr.ct-active-row");
                    const id = row ? row.dataset.campaignId : null;
                    if (id) {
                        focusCampaign(id, true);
                        return;
                    }
                }
            });

            // Checkbox selection in rows
            refs.activeSummaryRows.addEventListener("change", function (event) {
                const cb = event.target.closest(".ct-table-select-cb");
                if (!cb) return;
                const id = cb.dataset.campaignId;
                if (!id) return;

                if (!state.selectedCampaignIds) state.selectedCampaignIds = new Set();
                if (cb.checked) {
                    state.selectedCampaignIds.add(id);
                } else {
                    state.selectedCampaignIds.delete(id);
                }
                persistSelectedCampaigns();
                scheduleRender();
            });

            // Robust Drag and drop & Pointer event reordering
            function reorderCampaignByIds(draggedId, targetId, insertAfter) {
                if (!draggedId || !targetId || draggedId === targetId) return;
                const allPrepared = prepareCampaigns(state.campaigns);
                const allIds = allPrepared.map(function (c) { return c.__id; });
                let curOrder = Array.isArray(state.manualOrder) && state.manualOrder.length ? state.manualOrder.slice() : allIds.slice();
                allIds.forEach(function (id) {
                    if (!curOrder.includes(id)) curOrder.push(id);
                });

                const fromIdx = curOrder.indexOf(draggedId);
                if (fromIdx !== -1) curOrder.splice(fromIdx, 1);
                let toIdx = curOrder.indexOf(targetId);
                if (toIdx !== -1) {
                    if (insertAfter) toIdx++;
                    curOrder.splice(toIdx, 0, draggedId);
                } else {
                    curOrder.push(draggedId);
                }
                state.manualOrder = curOrder;
                state.sortedIds = curOrder.slice();
                persistCampaignOrder();
                scheduleRender();
                showActionNotice("Campaign display order updated.");
            }

            let pointerDragState = {
                active: false,
                pointerId: null,
                draggedId: null,
                targetId: null,
                insertAfter: false
            };

            // Pure Pointer-based drag-and-drop on campaign table rows
            refs.activeSummaryRows.addEventListener("pointerdown", function (event) {
                const handle = event.target.closest(".ct-table-drag-handle, .ct-td-drag");
                if (!handle || event.button !== 0) return;
                const tr = handle.closest("tr.ct-active-row");
                if (!tr) return;

                event.preventDefault();
                pointerDragState.active = true;
                pointerDragState.pointerId = event.pointerId;
                pointerDragState.draggedId = tr.dataset.campaignId;
                pointerDragState.targetId = null;
                pointerDragState.insertAfter = false;
                tr.classList.add("is-dragging");
                document.documentElement.style.cursor = "grabbing";
                document.documentElement.style.userSelect = "none";
            });

            document.addEventListener("pointermove", function (event) {
                if (!pointerDragState.active) return;
                event.preventDefault();

                const el = document.elementFromPoint(event.clientX, event.clientY);
                const tr = el ? el.closest("tr.ct-active-row") : null;
                if (!tr || tr.dataset.campaignId === pointerDragState.draggedId) {
                    if (refs.activeSummaryRows) {
                        refs.activeSummaryRows.querySelectorAll("tr.ct-active-row").forEach(function (row) {
                            row.classList.remove("is-drop-target", "is-drop-before", "is-drop-after");
                        });
                    }
                    pointerDragState.targetId = null;
                    return;
                }

                if (refs.activeSummaryRows) {
                    refs.activeSummaryRows.querySelectorAll("tr.ct-active-row").forEach(function (row) {
                        if (row !== tr) row.classList.remove("is-drop-target", "is-drop-before", "is-drop-after");
                    });
                }

                const rect = tr.getBoundingClientRect();
                const allVisible = Array.from(refs.activeSummaryRows.querySelectorAll("tr.ct-active-row"));
                const draggedTr = refs.activeSummaryRows.querySelector('tr.ct-active-row[data-campaign-id="' + pointerDragState.draggedId + '"]');
                const fromIdx = draggedTr ? allVisible.indexOf(draggedTr) : -1;
                const toIdx = allVisible.indexOf(tr);

                let isAfter;
                if (fromIdx !== -1 && toIdx !== -1) {
                    if (fromIdx < toIdx) {
                        isAfter = event.clientY > (rect.top + rect.height * 0.25);
                    } else {
                        isAfter = event.clientY > (rect.bottom - rect.height * 0.25);
                    }
                } else {
                    isAfter = event.clientY > (rect.top + rect.height / 2);
                }

                tr.classList.add("is-drop-target");
                tr.classList.toggle("is-drop-after", isAfter);
                tr.classList.toggle("is-drop-before", !isAfter);

                pointerDragState.targetId = tr.dataset.campaignId;
                pointerDragState.insertAfter = isAfter;
            }, { passive: false });

            const finishTablePointerDrag = function () {
                if (!pointerDragState.active) return;
                const draggedId = pointerDragState.draggedId;
                const targetId = pointerDragState.targetId;
                const insertAfter = pointerDragState.insertAfter;

                if (refs.activeSummaryRows) {
                    refs.activeSummaryRows.querySelectorAll("tr.ct-active-row").forEach(function (row) {
                        row.classList.remove("is-dragging", "is-drop-target", "is-drop-before", "is-drop-after");
                    });
                }

                pointerDragState.active = false;
                pointerDragState.pointerId = null;
                pointerDragState.draggedId = null;
                pointerDragState.targetId = null;
                state.draggingCampaignId = "";
                document.documentElement.style.cursor = "";
                document.documentElement.style.userSelect = "";

                if (draggedId && targetId && draggedId !== targetId) {
                    reorderCampaignByIds(draggedId, targetId, insertAfter);
                }
            };

            document.addEventListener("pointerup", finishTablePointerDrag);
            document.addEventListener("pointercancel", finishTablePointerDrag);

            // Alt+Up / Alt+Down accessible keyboard alternative
            refs.activeSummaryRows.addEventListener("keydown", function (event) {
                if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
                const tr = event.target.closest("tr.ct-active-row");
                if (!tr) return;
                const id = tr.dataset.campaignId;
                if (!id) return;

                event.preventDefault();
                const visibleTrs = Array.from(refs.activeSummaryRows.querySelectorAll("tr.ct-active-row"));
                const visibleIdx = visibleTrs.indexOf(tr);
                if (visibleIdx === -1) return;

                const focusMoved = function () {
                    setTimeout(function () {
                        if (!refs || !refs.activeSummaryRows) return;
                        const handle = refs.activeSummaryRows.querySelector('tr.ct-active-row[data-campaign-id="' + id + '"] .ct-table-drag-handle');
                        if (handle) handle.focus();
                    }, 40);
                };

                if (event.key === "ArrowUp" && visibleIdx > 0) {
                    const prevId = visibleTrs[visibleIdx - 1].dataset.campaignId;
                    reorderCampaignByIds(id, prevId, false);
                    focusMoved();
                } else if (event.key === "ArrowDown" && visibleIdx < visibleTrs.length - 1) {
                    const nextId = visibleTrs[visibleIdx + 1].dataset.campaignId;
                    reorderCampaignByIds(id, nextId, true);
                    focusMoved();
                }
            });
        }
        const toggleSelectAll = root ? root.querySelector('input[data-campaign-action="toggle-select-all"]') : null;
        if (toggleSelectAll) {
            toggleSelectAll.addEventListener("change", function () {
                if (!state.selectedCampaignIds) state.selectedCampaignIds = new Set();
                const prepared = prepareCampaigns(state.campaigns);
                const visibleCamps = prepared.filter(function (c) {
                    if (state.stateFilter === "active" && !c.__active) return false;
                    if (state.stateFilter === "inactive" && c.__active) return false;
                    if (state.filter === "critical" && c.__health !== "critical") return false;
                    if (state.filter === "warning" && c.__health !== "warning") return false;
                    if (state.filter === "healthy" && c.__health !== "good" && c.__health !== "excellent") return false;
                    if (state.filter === "data" && !c.__dataCheck) return false;
                    const needle = (state.query || "").trim().toLowerCase();
                    return !needle || String(c.name || "").toLowerCase().includes(needle);
                });
                if (toggleSelectAll.checked) {
                    visibleCamps.forEach(function (c) { state.selectedCampaignIds.add(c.__id); });
                } else {
                    visibleCamps.forEach(function (c) { state.selectedCampaignIds.delete(c.__id); });
                }
                persistSelectedCampaigns();
                scheduleRender();
            });
        }

        // Clear selection button in header
        if (refs.clearSelectionBtn) {
            refs.clearSelectionBtn.addEventListener("click", function () {
                if (state.selectedCampaignIds) state.selectedCampaignIds.clear();
                persistSelectedCampaigns();
                scheduleRender();
                showActionNotice("Campaign selections cleared.");
            });
        }
        refs.alerts.addEventListener("click", function (event) {
            const action = event.target.closest("[data-alert-action], [data-intel-action], [data-noted-id], [data-intel-noted-id]");
            if (!action) return;
            event.preventDefault();
            event.stopPropagation();

            // Intelligence Alert DISMISS or FOCUS
            if (action.dataset && action.dataset.intelAction) {
                const intelAct = action.dataset.intelAction;
                if (intelAct === "dismiss") {
                    const intelId = action.dataset.intelId;
                    const card = action.closest(".ct-intelligence-card, .ct-alert");
                    if (card) card.remove();
                    if (refs.alerts) refs.alerts.dataset.signature = "";
                    if (refs.persistentGoalsContainer) refs.persistentGoalsContainer.dataset.signature = "";
                    if (intelligenceEngine && intelId) {
                        intelligenceEngine.dismissActiveAlert(intelId);
                    }
                    updateAlerts();
                    showActionNotice("Alert dismissed until condition changes.");
                    scheduleRender();
                    return;
                }
                if (intelAct === "focus") {
                    const target = action.dataset.target;
                    if (target) {
                        focusCampaign(target, false);
                    }
                    return;
                }
            }

            // Persistent Goal NOTED
            if (action.getAttribute && action.getAttribute("data-noted-id")) {
                const notedId = action.getAttribute("data-noted-id");
                const card = action.closest(".ct-persistent-goal-card, .ct-intelligence-card, .ct-alert");
                if (card) card.remove();
                if (refs.alerts) refs.alerts.dataset.signature = "";
                if (refs.persistentGoalsContainer) refs.persistentGoalsContainer.dataset.signature = "";
                acknowledgePersistentGoalAlert(notedId);
                updateAlerts();
                showActionNotice("Persistent goal alert acknowledged [NOTED].");
                scheduleRender();
                return;
            }

            // Intelligence Card NOTED
            if (action.getAttribute && action.getAttribute("data-intel-noted-id")) {
                const intelId = action.getAttribute("data-intel-noted-id");
                const card = action.closest(".ct-intelligence-card, .ct-alert");
                if (card) card.remove();
                if (refs.alerts) refs.alerts.dataset.signature = "";
                if (refs.persistentGoalsContainer) refs.persistentGoalsContainer.dataset.signature = "";
                if (intelligenceEngine) {
                    intelligenceEngine.acknowledgeAlert(intelId);
                }
                updateAlerts();
                showActionNotice("Change intelligence alert acknowledged [NOTED].");
                scheduleRender();
                return;
            }
            const alertNode = action.closest(".ct-alert");
            const conditionKey = alertNode ? alertNode.dataset.conditionKey : "";
            const alertItem = state.recentAlerts.find(function (a) { return a.conditionKey === conditionKey; });
            if (!alertItem) return;
            event.preventDefault();
            event.stopPropagation();
            if (action.dataset.alertAction === "operate") {
                focusCampaign(alertItem.campaignId || alertItem.name, true);
            } else if (action.dataset.alertAction === "focus") {
                focusCampaign(alertItem.campaignId || alertItem.name, false);
            } else if (action.dataset.alertAction === "dismiss") {
                dismissAndRememberAlert(alertItem);
            } else if (action.dataset.alertAction === "refresh") {
                requestPageRefresh("Action Center refresh requested");
                showActionNotice("Live data refresh requested.");
            } else if (action.dataset.alertAction === "inbound-focus") {
                const targetQueueName = (alertItem.name || alertItem.campaignId || "").trim();
                let targetRow = null;
                if (refs.inboundTable) {
                    const rows = Array.from(refs.inboundTable.querySelectorAll('.ct-inbound-row'));
                    targetRow = rows.find(function(r) {
                        const rowName = (r.getAttribute('data-queue-name') || '').trim().toLowerCase();
                        const rowId = (r.getAttribute('data-queue-id') || '').trim().toLowerCase();
                        const target = targetQueueName.toLowerCase();
                        return (rowName && rowName === target) || (rowId && rowId === target) || (rowName && target.includes(rowName));
                    });
                }
                if (targetRow && typeof targetRow.scrollIntoView === "function") {
                    targetRow.scrollIntoView({ behavior: "smooth", block: "center" });
                    targetRow.classList.add("ct-focus-flash");
                    window.setTimeout(function(){ targetRow.classList.remove("ct-focus-flash"); }, 1800);
                    showActionNotice('Focused on queue "' + targetQueueName + '" in Queue Detail.');
                } else {
                    const inboundPanel = root.querySelector('.ct-inbound-panel');
                    if (inboundPanel && typeof inboundPanel.scrollIntoView === "function") {
                        inboundPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
                        inboundPanel.classList.add("ct-inbound-attention-pulse");
                        window.setTimeout(function(){ inboundPanel.classList.remove("ct-inbound-attention-pulse"); }, 1400);
                    }
                    showActionNotice("Inbound queue condition is highlighted in the live command view.");
                }
            }
        });
        refs.reset.addEventListener("click", function () {
            state.layout = defaultLayout();
            state.allCollapsed = false;
            state.layout.collapsed = false;
            refs.collapse.textContent = "Collapse";
            root.classList.remove("is-panel-collapsed");
            applyLayout(state.layout);
            persistLayout();
            showActionNotice("Dashboard view auto-adjusted to screen.");
        });
        refs.list.addEventListener("click", function (event) {
            const action = event.target.closest("[data-row-action]");
            if (action) {
                event.preventDefault();
                event.stopPropagation();
                const cardNode = action.closest(".ct-card");
                const card = cardNode ? cardCache.get(cardNode.dataset.id) : null;
                if (!card) return;
                if (action.dataset.rowAction === "focus") focusCampaign(cardNode.dataset.id, true);
                else if (action.dataset.rowAction === "operate") {
                    const id = cardNode.dataset.id;
                    const next = new Set(state.operatingCampaigns || []);
                    const adding = !next.has(id);
                    if (adding) next.add(id); else next.delete(id);
                    writeOperatingCampaigns(Array.from(next));
                    addCurrentStateAlerts(state.campaigns);
                    showActionNotice(adding ? "Campaign added to the operating set." : "Campaign removed from the operating set.");
                    scheduleRender();
                } else if (action.dataset.rowAction === "details") {
                    card.collapsed = !card.collapsed;
                    card.node.classList.toggle("is-collapsed", card.collapsed || state.allCollapsed);
                    const head = card.node.querySelector('.ct-card-head');
                    if (head) head.setAttribute('aria-expanded', String(!card.collapsed && !state.allCollapsed));
                }
                return;
            }
            if (state.reorderMode || event.target.closest(".ct-drag-handle")) return;
            const header = event.target.closest(".ct-card-head");
            if (!header) return;
            const cardNode = header.closest(".ct-card");
            const card = cardNode ? cardCache.get(cardNode.dataset.id) : null;
            if (card) { card.collapsed = !card.collapsed; card.node.classList.toggle("is-collapsed", card.collapsed || state.allCollapsed); header.setAttribute('aria-expanded', String(!card.collapsed && !state.allCollapsed)); }
        });
        installCampaignReordering();

        function syncFilterButtons() {
            if (refs.stateFilterButtons) {
                refs.stateFilterButtons.forEach(function (button) {
                    button.classList.toggle("is-active", (button.dataset.stateFilter || "all") === state.stateFilter);
                });
            }
            if (refs.healthFilterButtons) {
                refs.healthFilterButtons.forEach(function (button) {
                    button.classList.toggle("is-active", (button.dataset.healthFilter || "all") === state.filter);
                });
            }
            if (refs.filterButtons) {
                refs.filterButtons.forEach(function (button) {
                    button.classList.toggle("is-active", (button.dataset.filter || "all") === state.filter);
                });
            }
            if (refs.search && refs.search.value !== state.query) {
                refs.search.value = state.query || "";
            }
        }
        syncFilterButtons();

        refs.filterButtons.forEach(function (button) {
            button.addEventListener("click", function () {
                state.filter = button.dataset.filter || "all";
                persistHealthFilter();
                syncFilterButtons();
                scheduleRender();
            });
        });
        if (refs.stateFilterButtons) {
            refs.stateFilterButtons.forEach(function (button) {
                button.addEventListener("click", function () {
                    state.stateFilter = button.dataset.stateFilter || "all";
                    persistFilterState();
                    syncFilterButtons();
                    scheduleRender();
                });
            });
        }
        if (refs.healthFilterButtons) {
            refs.healthFilterButtons.forEach(function (button) {
                button.addEventListener("click", function () {
                    state.filter = button.dataset.healthFilter || "all";
                    persistHealthFilter();
                    syncFilterButtons();
                    scheduleRender();
                });
            });
        }
    }

    function setReorderMode(enabled) {
        state.reorderMode = Boolean(enabled);
        if (refs.manageOrder) {
            refs.manageOrder.textContent = state.reorderMode ? "✓ Done Order" : "Arrange Campaigns";
            refs.manageOrder.classList.toggle("is-active", state.reorderMode);
        }
        if (refs.orderHint) refs.orderHint.hidden = !state.reorderMode;
        if (refs.orderEditor) refs.orderEditor.hidden = !state.reorderMode;
        if (refs.list) refs.list.classList.toggle("is-reordering", state.reorderMode);
        if (state.reorderMode) renderOrderEditor();
        if (refs && refs.list) refs.list.querySelectorAll(".ct-drag-handle").forEach(function (handle) {
            handle.draggable = false;
            handle.setAttribute("draggable", "false");
            handle.setAttribute("aria-disabled", String(!state.reorderMode));
        });
    }

    function installGlobalInteractions() {
        if (!window.__CTOperationsDashboardInteractions) {
            const interactionState = {
                mode: "",
                pointerId: null,
                startX: 0,
                startY: 0,
                startLeft: 0,
                startTop: 0,
                startWidth: 0,
                startHeight: 0,
                root: null,
                layout: null,
                applyLayout: null,
                persistLayout: null
            };

            const move = function (event) {
                if (!interactionState.mode || !interactionState.layout || !interactionState.applyLayout) {
                    return;
                }

                if (interactionState.pointerId !== null && event.pointerId !== undefined && event.pointerId !== interactionState.pointerId) {
                    return;
                }

                event.preventDefault();

                const zoom = Number(interactionState.root && interactionState.root.style.zoom ? interactionState.root.style.zoom : (state && state.zoom ? state.zoom : 1)) || 1;
                const dx = (event.clientX - interactionState.startX) / zoom;
                const dy = (event.clientY - interactionState.startY) / zoom;

                if (interactionState.mode === "drag") {
                    const maxLeft = Math.max(0, Math.floor((window.innerWidth - 10) / zoom - interactionState.layout.width));
                    const maxTop = Math.max(0, Math.floor((window.innerHeight - 10) / zoom - interactionState.layout.height));
                    interactionState.layout.left = clamp(interactionState.startLeft + dx, 0, maxLeft);
                    interactionState.layout.top = clamp(interactionState.startTop + dy, 0, maxTop);
                } else if (interactionState.mode === "resize") {
                    const maxWidth = Math.max(980, Math.floor((window.innerWidth - 10) / zoom - interactionState.layout.left));
                    const maxHeight = Math.max(540, Math.floor((window.innerHeight - 10) / zoom - interactionState.layout.top));
                    interactionState.layout.width = clamp(interactionState.startWidth + dx, 980, maxWidth);
                    interactionState.layout.height = clamp(interactionState.startHeight + dy, 540, maxHeight);
                }

                interactionState.applyLayout(interactionState.layout);
            };

            const end = function () {
                if (!interactionState.mode) {
                    return;
                }

                if (interactionState.root) {
                    interactionState.root.classList.remove("is-dragging", "is-resizing");
                }

                document.documentElement.style.userSelect = "";

                if (interactionState.layout) {
                    interactionState.layout.isCustom = true;
                    interactionState.layout.isAutoAdjusted = false;
                }
                if (interactionState.persistLayout) {
                    interactionState.persistLayout();
                }

                interactionState.mode = "";
                interactionState.pointerId = null;
                interactionState.root = null;
                interactionState.layout = null;
                interactionState.applyLayout = null;
                interactionState.persistLayout = null;
            };

            document.addEventListener("pointermove", move, { passive: false });
            document.addEventListener("mousemove", move, { passive: false });
            document.addEventListener("pointerup", end);
            document.addEventListener("mouseup", end);
            document.addEventListener("pointercancel", end);

            window.__CTOperationsDashboardInteractions = {
                state: interactionState,
                begin: function (mode, event, dashboardRoot, layout, layoutApplier, layoutPersister) {
                    interactionState.mode = mode;
                    interactionState.pointerId = event.pointerId !== undefined ? event.pointerId : null;
                    interactionState.startX = event.clientX;
                    interactionState.startY = event.clientY;
                    interactionState.startLeft = layout.left;
                    interactionState.startTop = layout.top;
                    interactionState.startWidth = layout.width;
                    interactionState.startHeight = layout.height;
                    interactionState.root = dashboardRoot;
                    interactionState.layout = layout;
                    interactionState.applyLayout = layoutApplier;
                    interactionState.persistLayout = layoutPersister;
                    dashboardRoot.classList.toggle("is-dragging", mode === "drag");
                    dashboardRoot.classList.toggle("is-resizing", mode === "resize");
                    document.documentElement.style.userSelect = "none";
                }
            };
        }

        refs.header.addEventListener("pointerdown", startDrag);
        refs.header.addEventListener("mousedown", startDrag);
        refs.resize.addEventListener("pointerdown", startResize);
        refs.resize.addEventListener("mousedown", startResize);
    }

    function installCampaignReordering() {
        // Pointer-based reordering is intentionally used instead of native HTML5
        // drag-and-drop. CallTools/Angular/Zone can interfere with native drag
        // events, while pointer events give deterministic control inside our
        // dashboard without touching the CallTools DOM.
        let drag = {
            active: false,
            pointerId: null,
            card: null,
            handle: null,
            moved: false
        };

        const clearDrag = function (commit) {
            if (!drag.active) return;

            if (drag.card) {
                drag.card.classList.remove("is-dragging", "is-drop-target");
            }
            if (refs.list) {
                refs.list.querySelectorAll(".ct-card.is-drop-target").forEach(function (node) {
                    node.classList.remove("is-drop-target");
                });
                refs.list.classList.remove("is-dragging-campaign");
            }

            try {
                if (drag.handle && drag.pointerId !== null &&
                    drag.handle.hasPointerCapture &&
                    drag.handle.hasPointerCapture(drag.pointerId)) {
                    drag.handle.releasePointerCapture(drag.pointerId);
                }
            } catch (ignored) {}

            if (commit && drag.moved) {
                syncManualOrderFromVisibleList();
                persistCampaignOrder();
                refreshOrderNumbers();
            }

            state.draggingCampaignId = "";
            drag.active = false;
            drag.pointerId = null;
            drag.card = null;
            drag.handle = null;
            drag.moved = false;
            document.documentElement.style.userSelect = "";
        };

        const moveCardToPointer = function (event) {
            if (!drag.active || !state.reorderMode || !drag.card) return;
            if (drag.pointerId !== null && event.pointerId !== drag.pointerId) return;

            event.preventDefault();

            const targetElement = document.elementFromPoint(event.clientX, event.clientY);
            const target = targetElement && targetElement.closest
                ? targetElement.closest(".ct-card")
                : null;

            if (!target || !refs.list.contains(target) || target === drag.card) {
                return;
            }

            const rect = target.getBoundingClientRect();
            const before = event.clientY < rect.top + rect.height / 2;

            if (before) {
                if (target.previousElementSibling !== drag.card) {
                    refs.list.insertBefore(drag.card, target);
                    drag.moved = true;
                }
            } else {
                if (target.nextElementSibling !== drag.card) {
                    refs.list.insertBefore(drag.card, target.nextSibling);
                    drag.moved = true;
                }
            }

            refs.list.querySelectorAll(".ct-card.is-drop-target").forEach(function (node) {
                node.classList.remove("is-drop-target");
            });
            target.classList.add("is-drop-target");
            refreshOrderNumbers();
        };

        const onPointerDown = function (event) {
            if (!state.reorderMode || event.button !== 0) return;

            const handle = event.target.closest(".ct-drag-handle");
            if (!handle || !refs.list.contains(handle)) return;

            const card = handle.closest(".ct-card");
            if (!card || !refs.list.contains(card)) return;

            event.preventDefault();
            event.stopPropagation();

            clearDrag(false);

            drag.active = true;
            drag.pointerId = event.pointerId;
            drag.card = card;
            drag.handle = handle;
            drag.moved = false;
            state.draggingCampaignId = card.dataset.id || "";

            card.classList.add("is-dragging");
            refs.list.classList.add("is-dragging-campaign");
            document.documentElement.style.userSelect = "none";

            try {
                if (handle.setPointerCapture) handle.setPointerCapture(event.pointerId);
            } catch (ignored) {}
        };

        const onPointerMove = function (event) {
            if (!drag.active) return;
            moveCardToPointer(event);
        };

        const onPointerUp = function (event) {
            if (!drag.active) return;
            if (drag.pointerId !== null && event.pointerId !== drag.pointerId) return;
            event.preventDefault();
            clearDrag(true);
        };

        const onPointerCancel = function (event) {
            if (!drag.active) return;
            if (drag.pointerId !== null && event.pointerId !== drag.pointerId) return;
            clearDrag(false);
        };

        const onNativeDragStart = function (event) {
            if (event.target && event.target.closest &&
                event.target.closest(".ct-drag-handle")) {
                event.preventDefault();
                event.stopPropagation();
            }
        };

        refs.list.addEventListener("pointerdown", onPointerDown, { passive: false });
        document.addEventListener("pointermove", onPointerMove, { passive: false, capture: true });
        document.addEventListener("pointerup", onPointerUp, { capture: true });
        document.addEventListener("pointercancel", onPointerCancel, { capture: true });
        refs.list.addEventListener("dragstart", onNativeDragStart, true);

        refs.list.querySelectorAll(".ct-drag-handle").forEach(function (handle) {
            handle.draggable = false;
            handle.setAttribute("draggable", "false");
        });

        // Explicit teardown prevents stale document-level handlers after a
        // dashboard re-injection/reload.
        campaignReorderCleanup = function () {
            clearDrag(false);
            refs.list.removeEventListener("pointerdown", onPointerDown, { passive: false });
            document.removeEventListener("pointermove", onPointerMove, { capture: true });
            document.removeEventListener("pointerup", onPointerUp, { capture: true });
            document.removeEventListener("pointercancel", onPointerCancel, { capture: true });
            refs.list.removeEventListener("dragstart", onNativeDragStart, true);
            refs.list.classList.remove("is-dragging-campaign");
            document.documentElement.style.userSelect = "";
        };
    }

    function syncManualOrderFromVisibleList() {
        const visible = Array.from(refs.list.querySelectorAll(".ct-card"))
            .map(function (node) { return node.dataset.id; })
            .filter(Boolean);

        if (!visible.length) return;

        const visibleSet = new Set(visible);
        const existing = Array.isArray(state.manualOrder) ? state.manualOrder.slice() : [];
        const slots = [];

        existing.forEach(function (id, index) {
            if (visibleSet.has(id)) slots.push(index);
        });

        // Replace only the positions occupied by visible cards. Hidden/filtered
        // campaigns keep their original positions. This makes drag ordering
        // stable even when search/filter is active.
        const next = existing.slice();
        visible.forEach(function (id, i) {
            if (i < slots.length) next[slots[i]] = id;
            else next.push(id);
        });

        // Remove duplicates while preserving first occurrence.
        const seen = new Set();
        state.manualOrder = next.filter(function (id) {
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
        });
        state.sortedIds = state.manualOrder.slice();
        persistCampaignOrder();
    }

    function persistCampaignOrder() {
        state.manualOrder = Array.isArray(state.manualOrder) ? state.manualOrder.filter(Boolean) : [];
        writeStorage(ORDER_KEY, JSON.stringify(state.manualOrder));
        writeStorage(ORDER_META_KEY, JSON.stringify({ version: ORDER_VERSION, updatedAt: Date.now(), count: state.manualOrder.length }));
    }

    function refreshOrderNumbers() {
        const visibleNodes = Array.from(refs.list.querySelectorAll(".ct-card"));
        visibleNodes.forEach(function (node, index) {
            const card = cardCache.get(node.dataset.id);
            if (card) setText(card.fields.orderNumber, "#" + (index + 1));
        });
    }

    function startDrag(event) {
        if (event.type === "mousedown" && window.PointerEvent) {
            return;
        }

        if (!isPrimaryButton(event) || shouldIgnoreDragStart(event.target)) {
            return;
        }

        event.preventDefault();
        try { if (event.pointerId !== undefined && refs.header.setPointerCapture) refs.header.setPointerCapture(event.pointerId); } catch (ignored) {}
        window.__CTOperationsDashboardInteractions.begin("drag", event, root, state.layout, applyLayout, persistLayout);
    }

    function startResize(event) {
        if (event.type === "mousedown" && window.PointerEvent) {
            return;
        }

        if (!isPrimaryButton(event)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        try { if (event.pointerId !== undefined && refs.resize.setPointerCapture) refs.resize.setPointerCapture(event.pointerId); } catch (ignored) {}
        window.__CTOperationsDashboardInteractions.begin("resize", event, root, state.layout, applyLayout, persistLayout);
    }

    function shouldIgnoreDragStart(target) {
        return Boolean(target && target.closest("button,input,select,textarea,a,.ct-resize-handle"));
    }

    function isPrimaryButton(event) {
        return event.button === undefined || event.button === 0;
    }

    function applyLayout(layout) {
        const next = normalizeLayout(layout);
        const zoom = (state && state.zoom) ? state.zoom : 1;

        layout.left = next.left;
        layout.top = next.top;
        layout.width = next.width;
        layout.height = next.height;
        if (next.isCustom) {
            layout.isCustom = true;
            layout.isAutoAdjusted = false;
        } else {
            layout.isAutoAdjusted = true;
            layout.isCustom = false;
        }

        root.style.left = next.left + "px";
        root.style.top = next.top + "px";
        root.style.right = "auto";
        root.style.width = next.width + "px";
        root.style.height = state.allCollapsed ? "auto" : next.height + "px";
        root.style.maxWidth = "calc((100vw - 10px) / " + zoom + ")";
        root.style.maxHeight = "calc((100vh - 10px) / " + zoom + ")";
    }

    function persistLayout() {
        state.layout.collapsed = state.allCollapsed;
        writeStorage(LAYOUT_KEY, JSON.stringify(state.layout));
        writeStorage(LAYOUT_VERSION_KEY, String(LAYOUT_VERSION));
    }

    function scheduleRender() {
        if (state.pendingRender) {
            return;
        }

        state.pendingRender = requestAnimationFrame(function () {
            state.pendingRender = 0;
            render();
        });
    }

    function render() {
        const prepared = prepareCampaigns(state.campaigns);
        const ordered = orderCampaigns(prepared);
        const filtered = filterCampaigns(ordered);
        const stats = summarize(prepared);

        updateSummary(stats, filtered.length, ordered);
        updateInsights(stats);
        checkPersistentGoalAlerts(state.campaigns, state.queues);
            if (intelligenceEngine) {
                intelligenceEngine.processSnapshot({
                    campaigns: state.campaigns,
                    queues: state.queues,
                    isCampaignsRoute: Boolean(window.location && window.location.pathname && window.location.pathname.includes("/manager/campaigns")),
                    campaignTableFound: (function () {
                        const nativeTable = (window.CTParser && window.CTParser.findCampaignTable)
                            ? window.CTParser.findCampaignTable()
                            : document.querySelector("mat-table, table.mat-table, table.mat-mdc-table, table[mat-table], table.cdk-table, tr.mat-row, tr.mat-mdc-row, mat-row");
                        return Boolean(nativeTable || (state.campaigns && state.campaigns.length > 0) || document.querySelector("tr.mat-row, tr.mat-mdc-row, mat-row, [role='row'].mat-row"));
                    })(),
                    isStale: state.feedHeartbeatStale,
                    authLost: state.authRequired
                });
            }
        updateInboundPanel();
        updateAlerts();
        updateLiveFilterIntelligence(stats);
        updateCampaignList(filtered);
        if (state.reorderMode) renderOrderEditor();
        syncFilterButtons();
    }

    function updateSummary(stats, filteredCount, ordered) {
        updateConnectionState(Date.now());
        const activeCampaigns = (stats.campaigns || state.campaigns || []).filter(function (c) { return c.__active === true; });
        const outboundTooltip = stats.outbound > 0
            ? "Total Outbound Attempts: " + formatNumber(stats.outbound) + "\n" +
              (activeCampaigns.length > 1
                  ? activeCampaigns.map(function (c) { return "• " + safeValue(c.name) + ": " + formatNumber(c.__outbound); }).join("\n")
                  : "Single active campaign")
            : "No outbound attempts recorded";
        const outboundNote = state.route === "queues"
            ? "LAST KNOWN OUTBOUND · " + (outboundAge !== null ? formatAge(outboundAge) + " old" : "not loaded")
            : (stats.total < stats.visibleTotal && stats.allOutbound !== stats.outbound
                ? "Active: " + formatNumber(stats.outbound) + " · All: " + formatNumber(stats.allOutbound)
                : (activeCampaigns.length > 1
                    ? "Active sum · " + activeCampaigns.length + " campaigns"
                    : "Active campaign attempts"));
        const connectedNote = state.route === "queues"
            ? "LAST KNOWN OUTBOUND"
            : (stats.total < stats.visibleTotal && stats.allHuman !== stats.connected
                ? "Active: " + formatNumber(stats.connected) + " · All: " + formatNumber(stats.allHuman)
                : (stats.outbound > 0 ? ((stats.connected / stats.outbound) * 100).toFixed(2) + "% connect rate" : "connect rate unavailable"));
        updateKpi("campaigns", stats.total, stats.total + " active / " + stats.visibleTotal + " visible");
        updateKpi("waiting", stats.waitingAvailable ? formatNumber(stats.waiting) : "—", stats.waitingAvailable ? "current queue load" : "Not exposed by Campaigns feed");
        updateKpi("onCall", stats.onCallAvailable ? formatNumber(stats.onCall) : "—", stats.onCallAvailable ? "active calls" : "Not exposed by Campaigns feed");
        updateKpi("contacts", formatNumber(stats.contacts), stats.realtimeShared ? "shared CallTools contact pool · deduped" : "CallTools saved contact count");
        updateKpi("outbound", formatNumber(stats.outbound), outboundNote, outboundTooltip);
        updateKpi("connected", formatNumber(stats.connected), connectedNote);
        updateKpi("loggedIn", state.route === "queues" ? formatNumber(stats.loggedIn) : (stats.loggedInAvailable ? formatNumber(stats.loggedIn) : "—"), state.route === "queues" ? "LAST KNOWN OUTBOUND" : (stats.loggedInAvailable ? "agents in feed" : "Not exposed by Campaigns feed"));
        updateKpi("maxWait", stats.highestWait ? safeValue(stats.highestWait.waitNow) + "s" : "0s", stats.highestWait ? safeValue(stats.highestWait.name) : "no wait signal");
        updateKpi("abandoned", formatNumber(stats.abandonmentTotal), stats.highestAbandoned && stats.highestAbandoned.__abandoned ? "highest: " + safeValue(stats.highestAbandoned.name) : "no current signal");
        
        // TOTAL GOALS (INBOUND + OUTBOUND) RECONCILIATION
        const queues = Array.isArray(state.queues) ? state.queues : [];
        const activeQueues = queues.filter(function (q) { return !isArchivedQueue(q); });
        const inState = state.inboundSourceState || getInboundState(Date.now());
        const inboundAvailable = activeQueues.length > 0 && (inState === "LIVE" || inState === "STALE" || inState === "WAITING");
        const inboundGoals = inboundAvailable ? activeQueues.reduce(function (sum, q) { return sum + queueNumber(q, "goals"); }, 0) : null;
        const outboundGoals = stats.goalsAvailable ? stats.goals : null;

        let totalGoalsVal = "—";
        let totalGoalsNote = "Awaiting verified Goals feed";
        let totalGoalsTooltip = "Total verified goal events across campaigns and queues";

        if (outboundGoals !== null && inboundGoals !== null) {
            const combined = outboundGoals + inboundGoals;
            totalGoalsVal = formatNumber(combined);
            totalGoalsNote = "Outbound: " + formatNumber(outboundGoals) + " · Inbound: " + formatNumber(inboundGoals);
            totalGoalsTooltip = "Combined Goals: " + formatNumber(combined) + " (Outbound Campaigns: " + formatNumber(outboundGoals) + ", Inbound Queues: " + formatNumber(inboundGoals) + ")";
        } else if (outboundGoals !== null && inboundGoals === null) {
            totalGoalsVal = formatNumber(outboundGoals);
            totalGoalsNote = "PARTIAL · Outbound: " + formatNumber(outboundGoals) + " · Inbound: " + (inState === "WAITING" ? "connecting" : "unavailable");
            totalGoalsTooltip = "Partial Total: Outbound only (" + formatNumber(outboundGoals) + " goals). Inbound feed " + inState;
        } else if (outboundGoals === null && inboundGoals !== null) {
            totalGoalsVal = formatNumber(inboundGoals);
            totalGoalsNote = "PARTIAL · Outbound: unavailable · Inbound: " + formatNumber(inboundGoals);
            totalGoalsTooltip = "Partial Total: Inbound only (" + formatNumber(inboundGoals) + " goals). Outbound feed unavailable";
        }

        updateKpi("goals", totalGoalsVal, totalGoalsNote, totalGoalsTooltip);
        if (refs.campaignSectionCount) {
            const filtered = Number.isFinite(filteredCount) ? filteredCount : stats.visibleTotal;
            const filteredState = state.query.trim() || state.filter !== "all";
            setText(refs.campaignSectionCount, filteredState
                ? filtered + " matching / " + stats.visibleTotal + " campaign rows"
                : stats.total + " active / " + stats.visibleTotal + " visible campaign rows");
        }
        if (refs.campaignSectionState) {
            const sectionLabel = state.sourceState === "LIVE" ? "LIVE" : state.sourceState === "STALE" ? "STALE" : state.sourceState === "DATA CHECK" ? "DATA CHECK" : state.sourceState || "WAITING";
            setText(refs.campaignSectionState, sectionLabel);
            setClass(refs.campaignSectionState, "ct-campaigns-state " + (state.sourceState === "LIVE" ? "is-live" : state.sourceState === "STALE" ? "is-critical" : state.sourceState === "DATA CHECK" || state.sourceState === "DELAYED" || state.sourceState === "RECOVERING" ? "is-warning" : ""));
        }

        const operatingSet = getOperatingCampaigns(stats.campaigns || state.campaigns);
        const operating = operatingSet[0] || null;
        setText(refs.operatingCampaign, operatingSet.length > 1 ? operatingSet.length + " Campaigns" : operating ? safeValue(operating.name) : "Select Campaign");
        setClass(refs.operatingCampaign, "ct-command-value " + (operating && operating.__health === "critical" ? "is-critical" : operating && operating.__health === "warning" ? "is-warning" : "is-good"));
        setText(refs.topWait, stats.highestWait ? safeValue(stats.highestWait.waitNow) + "s" : "0s");
        setClass(refs.topWait, "ct-command-value " + (stats.highestWait && stats.highestWait.__wait >= 60 ? "is-critical" : stats.highestWait && stats.highestWait.__wait >= 30 ? "is-warning" : "is-good"));
        setText(refs.queueLoad, formatNumber(stats.waiting) + " waiting");
        setClass(refs.queueLoad, "ct-command-value " + (stats.waiting >= 5 ? "is-warning" : "is-good"));
        const alignmentState = getOperatingAlignmentState(stats.campaigns || state.campaigns);
        setText(refs.agentAlignment, alignmentState.label);
        setClass(refs.agentAlignment, "ct-command-value " + alignmentState.tone);
        setText(refs.calltoolsHealth, state.sourceState === "STALE" ? "STALE" : state.sourceState === "DELAYED" ? "DELAYED" : state.sourceState === "LIVE" ? "LIVE" : "Waiting");
        setClass(refs.calltoolsHealth, "ct-command-value " + (state.sourceState === "STALE" ? "is-critical" : state.sourceState === "DELAYED" ? "is-warning" : state.sourceState === "LIVE" ? "is-good" : ""));

        ensureOperatingBaseline(stats.campaigns || state.campaigns);

        // Update Live Filter Targeting Command Center Panel
        if (refs.topLiveFilterPanel || refs.topFilterCampaign) {
            const allCampList = stats.campaigns || state.campaigns || [];
            let targetCamp = operating || (allCampList.find(function(c) { return c && c.active !== false; })) || allCampList[0] || null;

            if (targetCamp) {
                const cId = targetCamp.rawId || targetCamp.id || "";
                const cName = safeValue(targetCamp.name, cId ? "Campaign #" + cId : "Unnamed Campaign");
                let fRaw = targetCamp.liveFilter || null;
                let fName = fRaw;
                let fCount = targetCamp.liveFilterCount !== undefined && targetCamp.liveFilterCount !== null ? targetCamp.liveFilterCount : null;

                if (fRaw) {
                    const mCount = String(fRaw).match(/[\(\[]\s*(?:Count|Contacts)?\s*:?\s*([0-9,]+)\s*[\)\]]/i);
                    if (mCount && mCount[1]) {
                        fCount = Number(mCount[1].replace(/,/g, ""));
                        fName = String(fRaw).replace(/[\(\[]\s*(?:Count|Contacts)?\s*:?\s*[0-9,]+\s*[\)\]]/i, "").trim();
                    }
                }

                const pool = (targetCamp.contacts !== undefined && targetCamp.contacts !== null)
                    ? (typeof targetCamp.contacts === "object" ? targetCamp.contacts.value : targetCamp.contacts)
                    : (targetCamp.__contacts || null);

                let invMatch = null;
                if (fName && intelligenceEngine && intelligenceEngine.inventory) {
                    const normFName = String(fName).trim().toLowerCase();
                    invMatch = intelligenceEngine.inventory.find(function(inv) {
                        return inv && String(inv.name || "").trim().toLowerCase() === normFName;
                    });
                }
                const fAvailContacts = invMatch ? (invMatch.count !== undefined ? invMatch.count : invMatch.totalCount) : null;
                const fId = targetCamp.liveFilterId || (invMatch ? invMatch.id : null);

                const fSource = targetCamp.liveFilterSource || "DOM_UNAVAILABLE";
                const fTimeMs = targetCamp.liveFilterTimestamp || null;
                const fTime = targetCamp.liveFilterTimestamp ? new Date(targetCamp.liveFilterTimestamp).toLocaleTimeString() : (fName ? new Date().toLocaleTimeString() : "Awaiting DOM");
                const targetingFreshness = evaluateFreshness(fTimeMs, Date.now());

                let lastChangeHtml = "No verified targeting transitions recorded";
                let changeFound = false;
                if (intelligenceEngine && intelligenceEngine.history) {
                    const recentChange = intelligenceEngine.history.find(function(h) {
                        return h.category === "LIVE_FILTER" && (
                            (cId && String(h.targetId) === String(cId)) ||
                            (cId && String(h.campaignId) === String(cId)) ||
                            String(h.targetName || "").trim().toLowerCase() === String(targetCamp.name || "").trim().toLowerCase()
                        );
                    });
                    if (recentChange) {
                        changeFound = true;
                        const prevCountStr = recentChange.previousCount !== undefined && recentChange.previousCount !== null ? ' (' + formatNumber(recentChange.previousCount) + ')' : '';
                        const currCountStr = recentChange.currentCount !== undefined && recentChange.currentCount !== null ? ' (' + formatNumber(recentChange.currentCount) + ')' : '';
                        lastChangeHtml = '<span class="ct-lft-change-campaign">' + escapeHtml(cName) + ': </span>' +
                            '<span class="ct-lfi-prev">' + escapeHtml(recentChange.previousFilter || recentChange.previous || "None") + prevCountStr + '</span>' +
                            '<span class="ct-lfi-arrow"> ➔ </span>' +
                            '<span class="ct-lfi-curr">' + escapeHtml(recentChange.currentFilter || recentChange.current || "None") + currCountStr + '</span>' +
                            ' <span class="ct-lft-change-time">(' + escapeHtml(recentChange.confirmedAt || (recentChange.timestamp ? new Date(recentChange.timestamp).toLocaleTimeString() : "")) + ')</span>' +
                            ' <span class="ct-lfi-source">Evidence: ' + escapeHtml(recentChange.source || "CONFIRMED OBSERVATION") + '</span>';
                    }
                }

                // 1. Header elements
                const isTargetingCurrent = Boolean(fName && fSource !== "DOM_UNAVAILABLE" && fTimeMs && (Date.now() - fTimeMs) <= 120000);
                if (refs.topFilterCampaign) setText(refs.topFilterCampaign, cName);
                if (refs.topFilterDialer) setText(refs.topFilterDialer, DIALER);
                if (refs.topFilterVerificationState) {
                    if (isTargetingCurrent) {
                        setText(refs.topFilterVerificationState, "TARGETING: VERIFIED");
                        setClass(refs.topFilterVerificationState, "ct-lft-verify-badge is-verified");
                    } else if (fName && fSource !== "DOM_UNAVAILABLE") {
                        const ageStr = fTimeMs ? formatAge(Math.floor((Date.now() - fTimeMs)/1000)) + " ago" : "STALE";
                        setText(refs.topFilterVerificationState, "TARGETING: STALE (" + ageStr + ")");
                        setClass(refs.topFilterVerificationState, "ct-lft-verify-badge is-stale");
                    } else if (fName) {
                        setText(refs.topFilterVerificationState, "TARGETING: UNVERIFIED");
                        setClass(refs.topFilterVerificationState, "ct-lft-verify-badge is-unverified");
                    } else {
                        setText(refs.topFilterVerificationState, "TARGETING: AWAITING OBSERVATION");
                        setClass(refs.topFilterVerificationState, "ct-lft-verify-badge is-unavailable");
                    }
                }
                if (refs.topFilterSource) {
                    const sourceLabel = fSource === "TABLE_COLUMN" ? "Campaigns Table" :
                                        fSource === "CAMPAIGN_EDIT_DOM" ? "Edit Page DOM" :
                                        fSource === "VERIFIED_REGISTRY" ? "Verified Registry" : "DOM Unavailable";
                    setText(refs.topFilterSource, "Source: " + sourceLabel);
                }

                // 2. Card 1: Assigned Live Filter
                if (refs.topFilterName) {
                    setText(refs.topFilterName, fName || "No filter assigned");
                    refs.topFilterName.title = fName || "";
                }
                if (refs.topFilterStatus) {
                    const st = fName ? (targetCamp.active !== false ? "ASSIGNED & ACTIVE" : "ASSIGNED (IDLE)") : "UNASSIGNED / NONE";
                    setText(refs.topFilterStatus, st);
                    setClass(refs.topFilterStatus, "ct-lft-status-pill " + (fName ? "is-assigned" : "is-unassigned"));
                }
                if (refs.topFilterId) {
                    const cidDisplay = cId ? "#" + cId : "Unavailable";
                    const fidDisplay = fId ? "#" + fId : "—";
                    setText(refs.topFilterId, "Campaign ID: " + cidDisplay + " · Filter ID: " + fidDisplay);
                }
                if (refs.topFilterBadge) {
                    setText(refs.topFilterBadge, fName ? "Filter: " + fName : "FILTER SOURCE UNAVAILABLE");
                    setClass(refs.topFilterBadge, "ct-tlf-badge " + (fName ? "is-assigned" : "is-unavailable"));
                }

                // 3. Card 2: Campaign Callable Pool
                if (refs.topFilterPool) {
                    setText(refs.topFilterPool, pool !== null ? formatNumber(pool) : "—");
                }
                if (refs.topFilterPoolTime) {
                    setText(refs.topFilterPoolTime, state.lastDataChangeAt ? formatAge(Math.floor((Date.now() - state.lastDataChangeAt)/1000)) + " ago" : "Live Queue");
                }

                // 4. Card 3: Filter Available Contacts
                if (refs.topFilterAvailableContacts) {
                    setText(refs.topFilterAvailableContacts, fAvailContacts !== null ? formatNumber(fAvailContacts) : (fName ? "Nav required" : "—"));
                }
                if (refs.topFilterAvailableTime) {
                    const invFresh = (intelligenceEngine && intelligenceEngine.lastObservedAt) ? formatAge(Math.floor((Date.now() - intelligenceEngine.lastObservedAt)/1000)) + " ago" : "Awaiting /manager/live-filters";
                    setText(refs.topFilterAvailableTime, invFresh);
                }

                // 5. Card 4: Filter Total Matches
                if (refs.topFilterMatch) {
                    setText(refs.topFilterMatch, fCount !== null ? formatNumber(fCount) : "—");
                }

                // 6. Card 5: Targeting Verification
                if (refs.topFilterConfidence) {
                    if (isTargetingCurrent) {
                        setText(refs.topFilterConfidence, "VERIFIED");
                        setClass(refs.topFilterConfidence, "ct-lft-card-primary is-verified");
                    } else if (fName && fSource !== "DOM_UNAVAILABLE") {
                        setText(refs.topFilterConfidence, "STALE (LAST OBSERVED)");
                        setClass(refs.topFilterConfidence, "ct-lft-card-primary is-stale");
                    } else if (fName) {
                        setText(refs.topFilterConfidence, "UNVERIFIED");
                        setClass(refs.topFilterConfidence, "ct-lft-card-primary is-unverified");
                    } else {
                        setText(refs.topFilterConfidence, "AWAITING OBSERVATION");
                        setClass(refs.topFilterConfidence, "ct-lft-card-primary is-unavailable");
                    }
                }
                if (refs.topFilterVerifySource) {
                    setText(refs.topFilterVerifySource, fSource === "TABLE_COLUMN" ? "Campaigns Table" : fSource === "CAMPAIGN_EDIT_DOM" ? "Edit Page DOM" : fSource === "VERIFIED_REGISTRY" ? "Verified Registry" : "DOM Unavailable");
                }
                if (refs.topFilterObserved) {
                    setText(refs.topFilterObserved, "Last observed: " + fTime);
                }

                // 7. Card 6: Data Freshness
                if (refs.topFilterFreshness) {
                    setText(refs.topFilterFreshness, targetingFreshness.label.toUpperCase());
                    setClass(refs.topFilterFreshness, "ct-lft-card-primary ct-lft-freshness-val " + targetingFreshness.className);
                }
                if (refs.topFilterAge) {
                    setText(refs.topFilterAge, fTimeMs ? formatAge(Math.floor((Date.now() - fTimeMs)/1000)) + " old" : "Never observed");
                }

                // 8. Transition Bar
                if (refs.topFilterChange) {
                    if (changeFound) {
                        refs.topFilterChange.innerHTML = lastChangeHtml;
                    } else {
                        setText(refs.topFilterChange, "No verified targeting transitions recorded for " + cName);
                    }
                }
            } else {
                if (refs.topFilterCampaign) setText(refs.topFilterCampaign, "—");
                if (refs.topFilterName) setText(refs.topFilterName, "—");
                if (refs.topFilterStatus) {
                    setText(refs.topFilterStatus, "UNAVAILABLE");
                    setClass(refs.topFilterStatus, "ct-lft-status-pill is-unavailable");
                }
                if (refs.topFilterId) setText(refs.topFilterId, "ID: —");
                if (refs.topFilterPool) setText(refs.topFilterPool, "—");
                if (refs.topFilterAvailableContacts) setText(refs.topFilterAvailableContacts, "—");
                if (refs.topFilterMatch) setText(refs.topFilterMatch, "—");
                if (refs.topFilterConfidence) setText(refs.topFilterConfidence, "UNAVAILABLE");
                if (refs.topFilterVerifySource) setText(refs.topFilterVerifySource, "DOM Unavailable");
                if (refs.topFilterObserved) setText(refs.topFilterObserved, "Awaiting DOM");
                if (refs.topFilterFreshness) {
                    setText(refs.topFilterFreshness, "NOT OBSERVED");
                    setClass(refs.topFilterFreshness, "ct-lft-card-primary ct-lft-freshness-val is-waiting");
                }
                if (refs.topFilterAge) setText(refs.topFilterAge, "—");
                if (refs.topFilterChange) setText(refs.topFilterChange, "No verified targeting changes recorded");
                if (refs.topFilterBadge) {
                    setText(refs.topFilterBadge, "FILTER SOURCE UNAVAILABLE");
                    setClass(refs.topFilterBadge, "ct-tlf-badge is-unavailable");
                }
            }
        }
        updateOperatingPanel(operating, stats);
        updateSourceStrip(stats);
        updateOperatingSelect(stats.campaigns || state.campaigns);
        setText(refs.systemHealth, stats.integrityIssues > 0 ? "CallTools campaign data check required" : state.sourceState === "STALE" ? "CallTools feed stale — recovery required" : state.sourceState === "RECOVERING" ? "CallTools feed recovering" : state.sourceState === "DATA CHECK" ? "CallTools feed requires verification" : state.sourceState === "DELAYED" ? "Feed delayed — watching" : state.sourceState === "LIVE" ? "Live monitoring active" : "Waiting for data");
        setText(refs.recoveryCount, String(state.recoveryCount));
        setText(refs.dataConfidence, stats.integrityIssues > 0 ? "DATA CHECK" : state.sourceState === "LIVE" ? "VERIFIED" : state.sourceState === "DATA CHECK" ? "DATA CHECK" : state.sourceState === "DELAYED" ? "PARTIAL" : state.sourceState === "STALE" ? "STALE" : "WAITING");

        if (refs.footerActiveTotals) {
            setText(refs.footerActiveTotals, stats.total + " active · " + formatNumber(stats.outbound) + " attempts · " + formatNumber(stats.connected) + " human connects · " + formatNumber(stats.contacts) + " leads");
        }
        if (refs.footerVisibleTotals) {
            setText(refs.footerVisibleTotals, stats.visibleTotal + " total rows · " + formatNumber(stats.allOutbound) + " attempts · " + formatNumber(stats.allHuman) + " human connects · " + formatNumber(stats.allContacts) + " leads");
        }

        updateActiveCommandSummary(ordered || orderCampaigns(prepareCampaigns(state.campaigns)));
    }

    function updateActiveCommandSummary(campaigns) {
        if (!refs || !refs.activeSummaryRows) return;
        const allCamp = campaigns || [];
        const active = allCamp.filter(function (c) { return c.__active === true; });
        const visible = allCamp.filter(function (c) {
            if (state.stateFilter === "active" && !c.__active) return false;
            if (state.stateFilter === "inactive" && c.__active) return false;
            if (state.filter === "critical" && c.__health !== "critical") return false;
            if (state.filter === "warning" && c.__health !== "warning") return false;
            if (state.filter === "healthy" && c.__health !== "good" && c.__health !== "excellent") return false;
            if (state.filter === "data" && !c.__dataCheck) return false;
            const needle = state.query.trim().toLowerCase();
            return !needle || String(c.name || "").toLowerCase().includes(needle);
        });

        const selectedCount = state.selectedCampaignIds ? state.selectedCampaignIds.size : 0;
        if (refs.activeSummaryCount) {
            setText(refs.activeSummaryCount, active.length + " active of " + allCamp.length + " campaigns (" + visible.length + " shown" + (selectedCount ? ", " + selectedCount + " selected" : "") + ")");
        }
        if (refs.activeSummaryBadge) {
            setText(refs.activeSummaryBadge, active.length ? active.length + " ACTIVE" : "0 ACTIVE");
            setClass(refs.activeSummaryBadge, "ct-active-summary-badge " + (active.length ? "is-live" : "is-inactive"));
        }
        if (refs.clearSelectionBtn) {
            refs.clearSelectionBtn.hidden = selectedCount === 0;
            if (refs.selectionCount) setText(refs.selectionCount, selectedCount);
        }

        const headerSelectAll = root ? root.querySelector('input[data-campaign-action="toggle-select-all"]') : null;
        if (headerSelectAll) {
            const visibleIds = visible.map(function (c) { return c.__id; });
            const allSel = visibleIds.length > 0 && visibleIds.every(function (id) { return state.selectedCampaignIds && state.selectedCampaignIds.has(id); });
            const someSel = visibleIds.some(function (id) { return state.selectedCampaignIds && state.selectedCampaignIds.has(id); });
            headerSelectAll.checked = allSel;
            headerSelectAll.indeterminate = !allSel && someSel;
        }

        if (!visible.length) {
            refs.activeSummaryRows.innerHTML = '<tr><td colspan="18" class="ct-active-empty">No campaigns match current filters.</td></tr>';
            return;
        }
        const fragment = document.createDocumentFragment();
        visible.forEach(function (c) {
            const isSelected = Boolean(state.selectedCampaignIds && state.selectedCampaignIds.has(c.__id));
            const tr = document.createElement("tr");
            tr.className = "ct-active-row is-" + (c.__health || "good") + (isSelected ? " is-selected" : "");
            tr.dataset.campaignId = c.__id;
            tr.draggable = false;

            const runway = estimateCampaignRunway(c);
            const agentsText = c.__loggedInAvailable ? formatNumber(c.__loggedIn) : "—";
            const agentsTitle = c.__loggedInAvailable ? c.__loggedIn + " logged in" : "Not exposed in Campaigns feed";
            const waitingText = c.__waitingAvailable ? formatNumber(c.__waiting) : "—";
            const waitingTitle = c.__waitingAvailable ? c.__waiting + " waiting · current queue load" : "Queue load not exposed in CallTools Campaigns table";
            const waitingTone = c.__waitingAvailable && c.__waiting > 0 ? (c.__waiting >= 5 ? "is-critical" : "is-warning") : "";
            const waitNowText = c.waitNow ? safeValue(c.waitNow) + "s" : "0s";
            const waitTodayText = c.waitToday ? safeValue(c.waitToday) + "s" : "0s";
            const outboundText = formatNumber(c.__outbound);
            const humanText = formatNumber(c.__human);
            const agentConnectText = formatNumber(c.__agentConnect);
            const goalsText = c.__goalsAvailable ? formatNumber(c.__goals) : "—";
            const goalsTitle = c.__goalsAvailable ? c.__goals + " goals achieved today" : "Goals not exposed in CallTools Campaigns table";
            const goalsTone = c.__goalsAvailable && c.__goals > 0 ? "is-good" : "";
            const contactsText = formatNumber(c.__contacts);
            const healthLabel = (HEALTH[c.__health] && HEALTH[c.__health].label) || "HEALTHY";

            const abandonRate = c.__outbound > 0 ? (c.__abandoned / c.__outbound) * 100 : 0;
            const abandonRateStr = formatRatePercent(c.__abandoned, c.__outbound);
            const abandonedText = c.__abandoned > 0
                ? (c.__outbound > 0 ? formatNumber(c.__abandoned) + " (" + abandonRateStr + ")" : formatNumber(c.__abandoned))
                : "0 (0.00%)";
            const abandonedTitle = c.__abandoned + " abandoned call" + (c.__abandoned === 1 ? "" : "s") + (c.__outbound > 0 ? " (" + abandonRateStr + " of outbound attempts)" : "");

            const connectRate = c.__outbound > 0 ? (c.__human / c.__outbound) * 100 : 0;
            const connectRateText = c.__outbound > 0 ? formatRatePercent(c.__human, c.__outbound) : "—";
            const connectRateTitle = c.__outbound > 0
                ? formatNumber(c.__human) + " human connects ÷ " + formatNumber(c.__outbound) + " outbound attempts (" + connectRate.toFixed(2) + "%)"
                : "No outbound attempts recorded today";
            const connectRateClass = c.__outbound > 0 ? (connectRate >= 3 ? "is-good" : connectRate >= 1.5 ? "is-highlight" : "is-warning") : "";

                const isOperating = isCampaignSelected(c, new Set((state.operatingCampaigns || []).map(function(id) { return String(id || "").trim(); }).filter(Boolean)));
                const focusBtnClass = "ct-active-focus-btn" + (isOperating ? " is-operating" : "");
                const focusBtnText = isOperating ? "Operating ✓" : "Focus";
                const focusBtnTitle = isOperating ? "Operating campaign (click to toggle)" : "Click to select and operate " + escapeHtml(c.name);

                tr.innerHTML = '<td class="ct-td-drag" tabindex="0" role="button" aria-label="Drag or click arrows to reorder ' + escapeHtml(c.name) + '" data-campaign-id="' + escapeHtml(c.__id) + '">' +
                '<div class="ct-drag-cell-inner">' +
                '<span class="ct-table-drag-handle" title="Drag to reorder (or use Alt+Up/Down)">⋮⋮</span>' +
                '<div class="ct-row-order-btns">' +
                '<button type="button" class="ct-row-order-btn is-up" data-row-order-action="up" title="Move ' + escapeHtml(c.name) + ' up" aria-label="Move ' + escapeHtml(c.name) + ' up">▲</button>' +
                '<button type="button" class="ct-row-order-btn is-down" data-row-order-action="down" title="Move ' + escapeHtml(c.name) + ' down" aria-label="Move ' + escapeHtml(c.name) + ' down">▼</button>' +
                '</div>' +
                '</div></td>' +
                '<td class="ct-td-select"><input type="checkbox" class="ct-table-select-cb" data-campaign-id="' + escapeHtml(c.__id) + '" ' + (isSelected ? 'checked' : '') + ' aria-label="Select ' + escapeHtml(c.name) + '"></td>' +
                '<td class="ct-td-name ct-active-name" title="' + escapeHtml(safeValue(c.name)) + ' (click to operate)"><b>' + escapeHtml(safeValue(c.name)) + '</b>' +
                '<div class="ct-campaign-filter-badge ' + (c.liveFilter ? 'is-assigned' : 'is-unavailable') + '" title="Live Filter: ' + escapeHtml(c.liveFilter || 'Source Unavailable') + '">Filter: ' + escapeHtml(c.liveFilter || 'FILTER SOURCE UNAVAILABLE') + '</div></td>' +
                '<td class="ct-td-state"><span class="ct-active-status-tag ' + (c.__active ? 'is-live' : 'is-inactive') + '">' + (c.__active ? 'ACTIVE' : 'INACTIVE') + '</span></td>' +
                '<td class="ct-td-agents ct-td-num" title="' + escapeHtml(agentsTitle) + '">' + escapeHtml(agentsText) + '</td>' +
                '<td class="ct-td-waiting ct-td-num ' + escapeHtml(waitingTone) + '" title="' + escapeHtml(waitingTitle) + '">' + escapeHtml(waitingText) + '</td>' +
                '<td class="ct-td-waitnow ct-td-num ' + (c.__wait >= 60 ? 'is-critical' : c.__wait >= 30 ? 'is-warning' : '') + '">' + escapeHtml(waitNowText) + '</td>' +
                '<td class="ct-td-waittoday ct-td-num">' + escapeHtml(waitTodayText) + '</td>' +
                '<td class="ct-td-outbound ct-td-num">' + escapeHtml(outboundText) + '</td>' +
                '<td class="ct-td-human ct-td-num is-highlight">' + escapeHtml(humanText) + '</td>' +
                '<td class="ct-td-agentconnect ct-td-num">' + escapeHtml(agentConnectText) + '</td>' +
                '<td class="ct-td-goals ct-td-num ' + escapeHtml(goalsTone) + '" title="' + escapeHtml(goalsTitle) + '">' + escapeHtml(goalsText) + '</td>' +
                '<td class="ct-td-abandoned ct-td-num ' + (c.__abandoned >= 500 || abandonRate >= 5 ? 'is-critical' : abandonRate >= 2 ? 'is-warning' : '') + '" title="' + escapeHtml(abandonedTitle) + '">' + escapeHtml(abandonedText) + '</td>' +
                '<td class="ct-td-connectrate ct-td-num ' + escapeHtml(connectRateClass) + '" title="' + escapeHtml(connectRateTitle) + '">' + escapeHtml(connectRateText) + '</td>' +
                '<td class="ct-td-leads ct-td-num">' + escapeHtml(contactsText) + '</td>' +
                '<td class="ct-td-runway ct-td-center ' + escapeHtml(runway.tone) + '">' + escapeHtml(runway.label) + '</td>' +
                '<td class="ct-td-health ct-td-center"><span class="ct-health-pill is-' + escapeHtml(c.__health || 'good') + '">' + escapeHtml(healthLabel) + '</span></td>' +
                '<td class="ct-td-focus ct-td-center"><button type="button" class="' + focusBtnClass + '" data-campaign-focus="' + escapeHtml(c.__id) + '" title="' + focusBtnTitle + '">' + focusBtnText + '</button></td>';
            fragment.appendChild(tr);
        });
        refs.activeSummaryRows.replaceChildren(fragment);
    }

    function getOperatingAlignmentState(campaigns) {
        const selectedIds = new Set(state.operatingCampaigns || []);
        if (!selectedIds.size) return { label: "Not selected", tone: "" };
        const baseline = state.operatingBaseline;
        if (!baseline || baseline.selectionKey !== operatingSelectionKey(state.operatingCampaigns || [])) return { label: "Baseline pending", tone: "is-warning" };
        let selectedDrop = 0, outsideRise = 0;
        (campaigns || []).forEach(function (c, i) {
            const id = c.__id || campaignId(c, i);
            const current = numberValue(c.__loggedIn ?? c.loggedIn);
            const base = numberValue(baseline.counts[id]);
            if (selectedIds.has(id)) selectedDrop += Math.max(0, base - current);
            else outsideRise += Math.max(0, current - base);
        });
        if (selectedDrop > 0 && outsideRise > 0) return { label: "Shift detected", tone: "is-warning" };
        return { label: "Aligned", tone: "is-good" };
    }

    function selectedOperatingCampaigns(campaigns) {
        if (!Array.isArray(campaigns) || !campaigns.length) return [];
        const ids = new Set((state.operatingCampaigns || []).map(function (id) { return String(id || "").trim(); }).filter(Boolean));
        if (ids.size === 0) return [];
        return campaigns.filter(function (c, i) {
            return isCampaignSelected(c, ids, i);
        });
    }

    function operatingLeadTotal(campaigns) {
        const selected = campaigns || [];
        const realtime = selected.filter(function (c) { return /^realtime\b/i.test(String(c.name || "")); });
        const nonRealtime = selected.filter(function (c) { return !/^realtime\b/i.test(String(c.name || "")); });
        let total = nonRealtime.reduce(function (sum, c) { return sum + numberValue(c.__contacts ?? c.contacts); }, 0);
        if (realtime.length) {
            const values = realtime.map(function (c) { return numberValue(c.__contacts ?? c.contacts); });
            const same = values.every(function (v) { return v === values[0]; });
            total += same ? values[0] : values.reduce(function (sum, v) { return sum + v; }, 0);
        }
        return total;
    }

    function updateOperatingPanel(operating, stats) {
        const allCampaigns = stats.campaigns || state.campaigns;
        const selected = selectedOperatingCampaigns(allCampaigns);
        const campaign = selected.length === 1 ? selected[0] : null;
        const count = selected.length;
        const selectedStoredCount = (state.operatingCampaigns || []).length;
        const activeCount = selected.filter(function (c) { return c.__active === true; }).length;
        const sum = function (key) { return selected.reduce(function (total, c) { return total + numberValue(c[key]); }, 0); };
        const max = function (key) { return selected.reduce(function (value, c) { return Math.max(value, numberValue(c[key])); }, 0); };
        const runwayLabels = selected.map(function (c) { return estimateCampaignRunway(c); });
        const measured = runwayLabels.filter(function (r) { return r.measured; });
        const alignment = getOperatingAlignmentState(allCampaigns);

        setText(refs.operatingEyebrow, selectedStoredCount === 1 ? "OPERATING CAMPAIGN" : "OPERATING CAMPAIGNS");
        setText(refs.operatingCampaignName, selectedStoredCount === 0 ? "No campaign selected" : selectedStoredCount === 1 && campaign ? safeValue(campaign.name) : selectedStoredCount + " campaigns selected");
        setText(refs.operatingStatus, selectedStoredCount ? activeCount + "/" + selectedStoredCount + " LIVE" : "—");
        setClass(refs.operatingStatus, "ct-operating-live " + (selectedStoredCount && activeCount ? "is-live" : "is-neutral"));
        setText(refs.operatingStatusText, selectedStoredCount ? selectedStoredCount + " selected" : "—");
        setText(refs.operatingActiveSince, selectedStoredCount ? activeCount + " active" : "—");
        setText(refs.operatingPriority, selectedStoredCount > 1 ? "MULTI" : selectedStoredCount ? "SINGLE" : "—");

        if (refs.operatingSelectedList) {
            if (selected.length === 1) {
                const c = selected[0];
                const active = c.__active === true;
                const status = active ? "LIVE" : c.__active === false ? "INACTIVE" : "CHECK";
                refs.operatingSelectedList.innerHTML = '<span class="ct-operating-chip ' + (active ? 'is-live' : 'is-neutral') + '"><small>' + status + ' · ' + formatNumber(c.__loggedIn) + ' agents assigned</small></span>';
            } else {
                const present = selected.map(function (c) {
                    const active = c.__active === true;
                    const status = active ? "LIVE" : c.__active === false ? "INACTIVE" : "CHECK";
                    return '<span class="ct-operating-chip ' + (active ? 'is-live' : 'is-neutral') + '"><b>' + escapeHtml(safeValue(c.name, 'Unnamed Campaign')) + '</b><small>' + status + ' · ' + formatNumber(c.__loggedIn) + ' agents</small></span>';
                });
                const presentIds = new Set(selected.map(function (c) { return c.__id; }));
                const missing = (state.operatingCampaigns || []).filter(function (id) { return !presentIds.has(id); }).map(function (id) {
                    return '<span class="ct-operating-chip is-neutral"><b>' + escapeHtml(String(id || 'Selected campaign')) + '</b><small>AWAITING CURRENT FEED</small></span>';
                });
                refs.operatingSelectedList.innerHTML = present.length || missing.length ? present.concat(missing).join('') : '<span class="ct-operating-empty">Choose one or more campaigns from the selector above.</span>';
            }
        }

        const totalAttempts = sum("__outbound");
        const totalHuman = sum("__human");
        const totalAbandoned = sum("__abandoned");
        const totalLoggedIn = sum("__loggedIn");
        const totalWaiting = sum("__waiting");
        const totalOnCall = sum("__onCall");
        const worstWait = count ? max("__wait") : 0;
        const connectRate = totalAttempts > 0 ? (totalHuman / totalAttempts) * 100 : 0;
        const connectRateText = count && totalAttempts > 0 ? connectRate.toFixed(1) + "%" : "—";
        const connectRateClass = totalAttempts > 0 ? (connectRate >= 3 ? "is-good" : connectRate >= 1.5 ? "is-highlight" : "is-warning") : "";
        const abandonRate = totalAttempts > 0 ? (totalAbandoned / totalAttempts) * 100 : 0;
        const abandonedText = count ? (totalAttempts > 0 ? formatNumber(totalAbandoned) + " (" + abandonRate.toFixed(1) + "%)" : formatNumber(totalAbandoned)) : "—";

        // Section B: 10-metric operational strip (for aggregate multi-campaign or full summary)
        const hasLoggedIn = selected.some(function (c) { return c.__loggedIn !== null && c.__loggedIn !== undefined; });
        const hasWaiting = selected.some(function (c) { return c.__waiting !== null && c.__waiting !== undefined; });
        setText(refs.opLoggedIn, (count && hasLoggedIn) ? formatNumber(totalLoggedIn) : "—");
        setText(refs.opWaiting, (count && hasWaiting) ? formatNumber(totalWaiting) : "—");
        setText(refs.opWorstWait, count ? formatNumber(worstWait) + "s" : "—");
        if (refs.opWorstWait) {
            setClass(refs.opWorstWait, "ct-operating-metric-value " + (count ? (worstWait >= 60 ? "is-critical" : worstWait >= 30 ? "is-warning" : "is-good") : "is-neutral"));
        }
        const hasOnCall = selected.some(function (c) { return c.__onCall !== null && c.__onCall !== undefined; });
        setText(refs.opOnCall, (count && hasOnCall) ? formatNumber(totalOnCall) : "—");
        setText(refs.opConnected, count ? formatNumber(totalHuman) : "—");
        if (refs.opConnectRate) {
            setText(refs.opConnectRate, connectRateText);
            setClass(refs.opConnectRate, "ct-operating-metric-value " + (count ? connectRateClass : "is-neutral"));
        }
        if (refs.opAttempts) setText(refs.opAttempts, count ? formatNumber(totalAttempts) : "—");
        if (refs.opAbandoned) {
            setText(refs.opAbandoned, abandonedText);
            const abandonTone = totalAbandoned >= 500 || abandonRate >= 5 ? "is-critical" : abandonRate >= 2 ? "is-warning" : "is-good";
            setClass(refs.opAbandoned, "ct-operating-metric-value " + (count ? abandonTone : "is-neutral"));
        }
        if (refs.opLiveLeads) setText(refs.opLiveLeads, count ? formatNumber(operatingLeadTotal(selected)) : "—");

        let runwayText = count === 0 ? "—" : "Measuring…";
        let runwayTone = "is-neutral";
        if (count === 1) {
            const runway = runwayLabels[0];
            runwayText = runway.label;
            runwayTone = runway.tone;
        } else if (count > 1) {
            if (measured.length === count) {
                const lowest = measured.slice().sort(function (a, b) { return a.minutes - b.minutes; })[0];
                runwayText = "Lowest " + lowest.label;
                runwayTone = lowest.tone;
            } else {
                runwayText = "Measuring…";
            }
        }
        setText(refs.opRunway, runwayText);
        setClass(refs.opRunway, "ct-operating-metric-value " + runwayTone);

        const summaryBar = root ? root.querySelector(".ct-operating-summary-bar") : null;
        if (summaryBar) {
            summaryBar.hidden = count <= 1;
            summaryBar.style.display = count > 1 ? "grid" : "none";
        }

        // Section C: Campaign Details (Logical clusters)
        if (refs.operatingCampaignCards) {
            if (!selected.length) {
                refs.operatingCampaignCards.innerHTML = '<div class="ct-operating-campaign-empty">Select one or more campaigns to see each campaign’s live agent state and source-backed metrics separately.</div>';
            } else {
                refs.operatingCampaignCards.innerHTML = selected.map(function (c) {
                    const active = c.__active === true;
                    const stateLabel = active ? "LIVE" : c.__active === false ? "INACTIVE" : "CHECK";
                    const runway = estimateCampaignRunway(c);
                    const waitTone = waitHealth(c.__wait, c.__waiting) === "critical" ? "is-critical" : waitHealth(c.__wait, c.__waiting) === "warning" ? "is-warning" : "is-good";
                    const cAbandonRate = c.__outbound > 0 ? (c.__abandoned / c.__outbound) * 100 : 0;
                    const abandonTone = c.__abandoned >= 500 || cAbandonRate >= 5 ? "is-critical" : cAbandonRate >= 2 ? "is-warning" : "is-good";
                    const leadTone = c.__active === true && c.__contacts <= state.contactThreshold ? "is-warning" : "is-good";
                    const cConnectRate = c.__outbound > 0 ? (c.__human / c.__outbound) * 100 : 0;
                    const cConnectRateText = c.__outbound > 0 ? cConnectRate.toFixed(1) + "%" : "—";
                    const cConnectRateClass = c.__outbound > 0 ? (cConnectRate >= 3 ? "is-good" : cConnectRate >= 1.5 ? "is-highlight" : "is-warning") : "";
                    const isSingle = selected.length === 1;
                    return '<article class="ct-operating-campaign-card' + (isSingle ? ' is-single-campaign' : '') + '" data-operating-campaign="' + escapeHtml(c.__id) + '">' +
                        (isSingle ? '' : '<div class="ct-operating-campaign-head"><b>' + escapeHtml(safeValue(c.name, "Unnamed Campaign")) + '</b><span class="ct-operating-campaign-state ' + (active ? 'is-live' : '') + '">' + stateLabel + '</span></div>') +
                        '<div class="ct-operating-cluster-label"><span>AGENT CAPACITY & QUEUE PRESSURE</span></div>' +
                        '<div class="ct-operating-agent-band">' +
                            '<div class="ct-operating-card-metric"><b>Total Agents</b><strong>' + formatNumber(c.__loggedIn) + '</strong><small>Native campaign count</small></div>' +
                            '<div class="ct-operating-card-metric"><b>Waiting</b><strong>' + formatNumber(c.__waiting) + '</strong><small>Current queue load</small></div>' +
                            '<div class="ct-operating-card-metric ' + waitTone + '"><b>Worst Wait</b><strong>' + formatNumber(c.__wait) + 's</strong><small>Current maximum wait</small></div>' +
                            '<div class="ct-operating-card-metric"><b>On Call</b><strong>' + formatNumber(c.__onCall) + '</strong><small>Active agents</small></div>' +
                        '</div>' +
                        '<div class="ct-operating-cluster-label"><span>CALL VOLUME & OUTCOMES</span></div>' +
                        '<div class="ct-operating-data-grid">' +
                            '<div class="ct-operating-card-metric"><b>Connected</b><strong>' + formatNumber(c.__human) + '</strong><small>Native Human</small></div>' +
                            '<div class="ct-operating-card-metric ' + cConnectRateClass + '" title="Verified Human Connects ÷ Outbound Attempts"><b>Connect Rate</b><strong>' + escapeHtml(cConnectRateText) + '</strong><small>Human ÷ Outbound</small></div>' +
                            '<div class="ct-operating-card-metric"><b>Call Attempts</b><strong>' + formatNumber(c.__outbound) + '</strong><small>Native Outbound</small></div>' +
                            '<div class="ct-operating-card-metric ' + abandonTone + '"><b>Abandoned</b><strong>' + formatNumber(c.__abandoned) + '</strong><small>Native reported</small></div>' +
                        '</div>' +
                        '<div class="ct-operating-cluster-label"><span>LEAD INVENTORY & RUNWAY</span></div>' +
                        '<div class="ct-operating-data-grid ct-operating-data-grid-half">' +
                            '<div class="ct-operating-card-metric ' + leadTone + '"><b>Live Leads</b><strong>' + formatNumber(c.__contacts) + '</strong><small>CallTools Leads</small></div>' +
                            '<div class="ct-operating-card-metric ' + runway.tone + '"><b>Lead Runway</b><strong>' + escapeHtml(runway.label) + '</strong><small>Observed depletion</small></div>' +
                        '</div>' +
                        '<div class="ct-operating-cluster-label"><span>DATA QUALITY & FRESHNESS</span></div>' +
                        '<div class="ct-operating-data-grid ct-operating-data-grid-half">' +
                            '<div class="ct-operating-card-metric"><b>Campaign State</b><strong>' + (active ? 'ACTIVE' : 'INACTIVE') + '</strong><small>Feed Verified</small></div>' +
                            '<div class="ct-operating-card-metric ' + alignment.tone + '"><b>Staffing Alignment</b><strong>' + escapeHtml(alignment.label) + '</strong><small>Baseline check</small></div>' +
                        '</div>' +
                    '</article>';
                }).join("");
            }
        }

        // Section D: Operational Findings
        if (refs.operatingFindingsList) {
            const findings = [];
            if (!count) {
                refs.operatingFindingsList.innerHTML = '<div class="ct-finding-pill"><b>NO SELECTION</b><span>Select one or more operating campaigns above to view operational findings.</span></div>';
                if (refs.operatingFindingsBadge) {
                    setText(refs.operatingFindingsBadge, "NO SELECTION");
                    refs.operatingFindingsBadge.className = "ct-operating-findings-badge is-neutral";
                }
            } else {
                selected.forEach(function (c) {
                    const cAbandonRate = c.__outbound > 0 ? (c.__abandoned / c.__outbound) * 100 : 0;
                    const runway = estimateCampaignRunway(c);
                    if (c.__wait >= 60) {
                        findings.push('<div class="ct-finding-pill is-critical"><b>CRITICAL WAIT</b><span>' + escapeHtml(c.name) + ': ' + formatNumber(c.__wait) + 's maximum caller wait' + (c.__waiting > 0 ? ' with ' + formatNumber(c.__waiting) + ' waiting.' : '.') + '</span></div>');
                    } else if (c.__wait >= 30) {
                        findings.push('<div class="ct-finding-pill is-warning"><b>ELEVATED WAIT</b><span>' + escapeHtml(c.name) + ': ' + formatNumber(c.__wait) + 's wait time' + (c.__waiting > 0 ? ' with active caller queue (' + formatNumber(c.__waiting) + ' waiting).' : '.') + '</span></div>');
                    }
                    if (c.__waiting > 0 && c.__loggedIn === 0) {
                        findings.push('<div class="ct-finding-pill is-critical"><b>NO CAPACITY</b><span>' + escapeHtml(c.name) + ': ' + formatNumber(c.__waiting) + ' callers waiting with 0 logged-in agents.</span></div>');
                    }
                    if (c.__abandoned >= 500 || (c.__outbound >= 50 && cAbandonRate >= 5)) {
                        findings.push('<div class="ct-finding-pill is-critical"><b>HIGH ABANDONMENT</b><span>' + escapeHtml(c.name) + ': ' + formatNumber(c.__abandoned) + ' abandoned calls (' + cAbandonRate.toFixed(1) + '% rate).</span></div>');
                    } else if (c.__outbound >= 50 && cAbandonRate >= 2) {
                        findings.push('<div class="ct-finding-pill is-warning"><b>ELEVATED ABANDONMENT</b><span>' + escapeHtml(c.name) + ': ' + cAbandonRate.toFixed(1) + '% abandon rate.</span></div>');
                    }
                    if (c.__active === true && c.__contacts <= state.contactThreshold) {
                        findings.push('<div class="ct-finding-pill is-warning"><b>LOW CONTACT POOL</b><span>' + escapeHtml(c.name) + ': only ' + formatNumber(c.__contacts) + ' live leads remaining in pool.</span></div>');
                    }
                    if (runway.measured && runway.minutes <= 120) {
                        findings.push('<div class="ct-finding-pill ' + (runway.minutes <= 60 ? 'is-critical' : 'is-warning') + '"><b>SHORT RUNWAY</b><span>' + escapeHtml(c.name) + ': estimated lead depletion in ' + escapeHtml(runway.label) + '.</span></div>');
                    }
                });

                if (alignment.label === "Shift detected") {
                    findings.push('<div class="ct-finding-pill is-warning"><b>STAFFING SHIFT</b><span>Agent allocation has shifted away from selected operating campaigns since baseline.</span></div>');
                }

                const hasCritical = findings.some(function (f) { return f.includes("is-critical"); });
                const hasWarning = findings.some(function (f) { return f.includes("is-warning"); });
                const findingsTone = hasCritical ? "is-critical" : hasWarning ? "is-warning" : "is-good";
                const findingsBadgeText = hasCritical ? "CRITICAL ALERTS" : hasWarning ? "AT RISK" : "NORMAL OPERATIONS";

                if (!findings.length) {
                    refs.operatingFindingsList.innerHTML = '<div class="ct-finding-pill is-good"><b>NORMAL OPERATIONS</b><span>All selected operating campaigns within healthy parameters · No wait or inventory alerts.</span></div>';
                } else {
                    refs.operatingFindingsList.innerHTML = findings.join("");
                }

                if (refs.operatingFindingsBadge) {
                    setText(refs.operatingFindingsBadge, findingsBadgeText);
                    refs.operatingFindingsBadge.className = "ct-operating-findings-badge " + findingsTone;
                }
                if (refs.operatingFindings) {
                    refs.operatingFindings.className = "ct-operating-findings " + findingsTone;
                }
            }
        }

        // Legacy refs update
        if (refs.opQueue) setText(refs.opQueue, count ? formatNumber(sum("__waiting")) : "—");
        if (refs.opAlignment) {
            setText(refs.opAlignment, selectedStoredCount ? alignment.label : "—");
            setClass(refs.opAlignment, "ct-operating-metric-value " + (selectedStoredCount ? alignment.tone : "is-neutral"));
        }
    }

    function updateOperatingSelect(campaigns) {
        if (!refs.operatingOptions || !refs.operatingTrigger) return;
        const rawList = Array.isArray(campaigns) && campaigns.length ? campaigns : (Array.isArray(state.campaigns) && state.campaigns.length ? state.campaigns : []);
        const all = prepareCampaigns(rawList);
        const current = new Set((state.operatingCampaigns || []).map(function(id) { return String(id || "").trim(); }).filter(Boolean));
        const signature = all.map(function (c) {
            const id = c.rawId || c.id || c.__id || campaignId(c);
            const isSel = isCampaignSelected(c, current);
            return [id, c.name || "", c.__active === true ? 1 : c.__active === false ? 0 : -1, numberValue(c.__loggedIn), isSel ? 1 : 0].join("|");
        }).join("||") + "::" + Array.from(current).sort().join(",");

        if (refs.operatingOptions.dataset.signature !== signature) {
            const preservedScrollTop = refs.operatingOptions.scrollTop;
            const existingButtons = Array.from(refs.operatingOptions.querySelectorAll('.ct-operating-option'));
            const canUpdateInPlace = existingButtons.length === all.length && existingButtons.every(function(btn, idx) {
                const c = all[idx];
                const id = c.rawId || c.id || c.__id || campaignId(c);
                return btn.getAttribute('data-operating-id') === String(id);
            });

            if (canUpdateInPlace) {
                existingButtons.forEach(function(btn, idx) {
                    const c = all[idx];
                    const checked = isCampaignSelected(c, current);
                    btn.classList.toggle('is-selected', checked);
                    btn.setAttribute('aria-selected', String(checked));
                    const checkSpan = btn.querySelector('.ct-operating-check');
                    if (checkSpan) checkSpan.textContent = checked ? '✓' : '';
                });
            } else {
                refs.operatingOptions.innerHTML = all.map(function (c) {
                    const id = c.rawId || c.id || c.__id || campaignId(c);
                    const checked = isCampaignSelected(c, current);
                    const active = c.__active === true ? "LIVE" : c.__active === false ? "INACTIVE" : "CHECK";
                    const nativeIdBadge = (c.rawId || c.id) ? '<span class="ct-operating-option-id">#' + escapeHtml(c.rawId || c.id) + '</span>' : '';
                    return '<button type="button" class="ct-operating-option' + (checked ? ' is-selected' : '') + '" role="option" aria-selected="' + checked + '" data-operating-id="' + escapeHtml(id) + '">' +
                        '<span class="ct-operating-check" aria-hidden="true">' + (checked ? '✓' : '') + '</span>' +
                        '<span class="ct-operating-option-main"><b>' + escapeHtml(safeValue(c.name, "Unnamed Campaign")) + '</b> ' + nativeIdBadge + '<small>' + active + ' · ' + formatNumber(c.__loggedIn) + ' agents</small></span>' +
                        '</button>';
                }).join("");
            }
            refs.operatingOptions.dataset.signature = signature;
            if (preservedScrollTop > 0) refs.operatingOptions.scrollTop = preservedScrollTop;
        }
        const selectedCampaigns = all.filter(function (c) { return isCampaignSelected(c, current); });
        const selectedNames = selectedCampaigns.map(function (c) { return safeValue(c.name, "Campaign"); });
        const selectedCount = selectedCampaigns.length || current.size;
        setText(refs.operatingTriggerText, selectedCount === 0 ? "Select campaign(s)" : selectedNames.length === 1 ? selectedNames[0] : selectedCount + " campaigns selected");
        setText(refs.operatingTriggerCount, String(selectedCount));
        refs.operatingTrigger.classList.toggle("has-selection", selectedCount > 0);
    }

    function getOperatingCampaigns(campaigns) {
        return selectedOperatingCampaigns(campaigns);
    }

    function getOperatingCampaign(campaigns) {
        const selected = getOperatingCampaigns(campaigns);
        return selected[0] || null;
    }

    function updateSourceStrip(stats) {
        const now = Date.now();
        const queueMode = state.route === "queues";
        const sourceUpdated = queueMode ? (state.queueLastUpdated ? state.queueLastUpdated.getTime() : 0) : (state.lastDataChangeAt ? state.lastDataChangeAt : 0);
        const dataAge = sourceUpdated ? Math.max(0, Math.floor((now - sourceUpdated) / 1000)) : null;
        const heartbeatSource = queueMode ? state.queueLastFeedHeartbeatAt : state.lastEventAt;
        const heartbeatAge = heartbeatSource ? Math.max(0, Math.floor((now - heartbeatSource) / 1000)) : null;
        setText(refs.dataAge, dataAge === null ? "Waiting" : formatAge(dataAge));
        setClass(refs.dataAge, "ct-command-value " + (dataAge === null ? "" : dataAge >= 60 ? "is-critical" : dataAge >= 30 ? "is-warning" : "is-good"));
        setText(refs.feedHeartbeat, heartbeatAge === null ? "Waiting" : formatAge(heartbeatAge));
        setClass(refs.feedHeartbeat, "ct-command-value " + (heartbeatAge !== null && heartbeatAge >= 30 ? "is-warning" : "is-good"));
        if (queueMode) {
            setText(refs.leadRunway, "N/A · inbound queue feed");
            setClass(refs.leadRunway, "ct-command-value is-neutral");
            setText(refs.recoveryState, state.feedStatus === "LIVE" ? "Queue feed stable" : "Queue feed " + (state.feedStatus || "waiting").toLowerCase());
            setClass(refs.recoveryState, "ct-command-value " + (state.feedStatus === "LIVE" ? "is-good" : "is-warning"));
            return;
        }
        const operating = getOperatingCampaigns(stats.campaigns || state.campaigns);
        const runwayItems = operating.map(function (c) { return estimateCampaignRunway(c); });
        const measured = runwayItems.filter(function (r) { return r.measured; });
        const runway = operating.length === 1 ? runwayItems[0] : measured.length === operating.length && measured.length ? measured.slice().sort(function(a,b){ return a.minutes-b.minutes; })[0] : unavailableRunway(operating.length ? "Measuring…" : "Select campaign");
        setText(refs.leadRunway, operating.length > 1 && runway.measured ? "Lowest " + runway.label : runway.label);
        setClass(refs.leadRunway, "ct-command-value " + runway.tone);
        const recoveryPending = state.recoveryInFlightUntil > now;
        setText(refs.recoveryState, recoveryPending ? "Recovering" : state.lastRecoveryAt ? (Math.floor((now - state.lastRecoveryAt) / 1000) < 15 ? "Refresh pending" : "Standby") : "Standby");
        setClass(refs.recoveryState, "ct-command-value " + (recoveryPending || state.lastRecoveryAt ? "is-warning" : "is-good"));
    }

    // CallTools' native campaign table exposes the live "Leads" value through
    // total_saved_contact_count. The native table itself is the source of truth.
    // A runway estimate is therefore based ONLY on observed decreases in that
    // same Leads value over time. Outbound attempts are deliberately NOT used as
    // a proxy because multiple attempts can occur against one contact.
    //
    // REALTIME campaigns are treated as one shared pool only when CallTools is
    // visibly reporting the same Leads value for every active REALTIME row. If
    // those values diverge, we refuse to invent a shared-pool assumption and use
    // the selected campaign's own observed Leads series instead.
    function runwayDescriptor(campaign, campaigns) {
        const active = (campaigns || []).filter(function (c) { return c.__active === true || resolveActiveState(c) === true; });
        const isRealtime = /^realtime\b/i.test(String(campaign && campaign.name || ""));
        const realtime = active.filter(function (c) { return /^realtime\b/i.test(String(c.name || "")); });
        if (isRealtime && realtime.length > 1) {
            const values = realtime.map(function (c) { return numberValue(c.__contacts ?? c.contacts); });
            const first = values[0];
            const samePool = values.every(function (v) { return v === first; });
            if (samePool) {
                return { key: "REALTIME_SHARED", value: first, shared: true, verified: true };
            }
        }
        return { key: campaign && campaign.__id ? campaign.__id : campaignId(campaign || {}, 0), value: numberValue(campaign && (campaign.__contacts ?? campaign.contacts)), shared: false, verified: true };
    }

    function recordRunwaySamples(campaigns, now) {
        const active = (campaigns || []).filter(function (c) { return c && c.active !== false; });
        const seen = new Set();
        active.forEach(function (raw) {
            const c = Object.assign({}, raw);
            c.__id = campaignId(c, 0);
            c.__active = resolveActiveState(c);
            if (c.__active !== true) return;
            const descriptor = runwayDescriptor(c, active.map(function (item) {
                const copy = Object.assign({}, item);
                copy.__id = campaignId(copy, 0);
                copy.__active = resolveActiveState(copy);
                return copy;
            }));
            if (seen.has(descriptor.key)) return;
            seen.add(descriptor.key);
            const value = Math.max(0, Number(descriptor.value) || 0);
            const history = state.runwayHistory.get(descriptor.key) || [];
            const last = history[history.length - 1];
            // Keep periodic timestamps even when the value is unchanged. Without a
            // second timestamp, a valid drop can never age into a measurable rate.
            if (!last || last.value !== value || now - last.at >= 5000) {
                history.push({ at: now, value: value });
            }
            const cutoff = now - RUNWAY_WINDOW_MS;
            while (history.length && history[0].at < cutoff) history.shift();
            if (history.length > RUNWAY_MAX_SAMPLES) history.splice(0, history.length - RUNWAY_MAX_SAMPLES);
            state.runwayHistory.set(descriptor.key, history);
        });
    }

    function unavailableRunway(label) {
        return { label: label || "Measuring…", tone: "is-neutral", minutes: null, measured: false };
    }

    function estimateCampaignRunway(campaign) {
        if (!campaign || campaign.__active !== true) return unavailableRunway("—");
        const descriptor = runwayDescriptor(campaign, state.campaigns || []);
        const current = Math.max(0, Number(descriptor.value) || 0);
        if (current <= 0) return { label: "0m", tone: "is-critical", minutes: 0, measured: true };
        const history = state.runwayHistory.get(descriptor.key) || [];
        if (history.length < 2) return unavailableRunway("Gathering data…");

        const now = Date.now();
        const cutoff = now - RUNWAY_WINDOW_MS;
        const samples = history.filter(function (sample) { return sample.at >= cutoff; });
        if (samples.length < 2) return unavailableRunway("Gathering data…");

        const first = samples[0];
        const last = samples[samples.length - 1];
        const elapsedMs = last.at - first.at;
        if (elapsedMs < RUNWAY_MIN_OBSERVATION_MS) return unavailableRunway("Gathering (<30s)");

        // Sum only real decreases. If CallTools adds/reloads leads, that
        // increase is a supply event and is not counted as consumption.
        let consumed = 0;
        for (let i = 1; i < samples.length; i++) {
            const delta = samples[i - 1].value - samples[i].value;
            if (delta > 0) consumed += delta;
        }
        if (consumed < RUNWAY_MIN_LEAD_DROP) return { label: "Stable lead pool", tone: "is-good", minutes: Infinity, measured: false };

        const minutesObserved = elapsedMs / 60000;
        const leadsPerMinute = consumed / minutesObserved;
        if (!Number.isFinite(leadsPerMinute) || leadsPerMinute <= 0) return unavailableRunway("Measuring…");
        const minutes = current / leadsPerMinute;
        if (!Number.isFinite(minutes)) return unavailableRunway("Measuring…");

        let label;
        if (minutes < 1) label = "<1m";
        else if (minutes < 60) label = Math.round(minutes) + "m";
        else if (minutes < 1440) label = Math.floor(minutes / 60) + "h " + Math.round(minutes % 60) + "m";
        else label = ">24h";

        const tone = minutes <= 15 ? "is-critical" : minutes <= 30 ? "is-warning" : "is-good";
        return { label: label, tone: tone, minutes: minutes, measured: true, leadsPerMinute: leadsPerMinute, consumed: consumed, shared: descriptor.shared };
    }

    function applyZoom() {
        if (!root) return;
        root.style.zoom = state.zoom.toFixed(2);
        if (refs && refs.zoomReset) refs.zoomReset.textContent = Math.round(state.zoom * 100) + "%";
        if (state && state.layout) {
            applyLayout(state.layout);
        }
    }

    function setZoom(value) {
        state.zoom = Math.min(1.2, Math.max(0.8, Math.round(value * 10) / 10));
        writeStorage(ZOOM_KEY, String(state.zoom));
        applyZoom();
        persistLayout();
    }

    function getOutboundState(now) {
        if (state.outboundAuthRequired || state.authRequired) return "AUTH LOST";
        if (state.outboundTableMissing || (state.route === "campaigns" && state.tableMissing)) return "SOURCE ERROR";
        const lastObs = state.lastSuccessfulOutboundAt;
        if (!lastObs) {
            return (state.campaigns && state.campaigns.length > 0) ? "CONNECTING" : ((state.parserActive || state.lastEventAt) ? "WAITING" : "INITIALIZING");
        }
        const ageSec = Math.max(0, Math.floor((now - lastObs) / 1000));
        if (ageSec >= 15) return "STALE";
        return "LIVE";
    }

    function getInboundState(now) {
        if (state.inboundAuthRequired || state.queueFeedStatus === "AUTH_REQUIRED") return "AUTH LOST";
        if (state.inboundTableMissing || state.queueFeedStatus === "SOURCE_ERROR" || state.queueFeedStatus === "FRAME_ERROR") return "SOURCE ERROR";
        const lastObs = state.lastSuccessfulInboundAt;
        if (!lastObs || !state.queues.length) {
            if (state.queueFeedStatus === "VERIFYING" || state.queueFeedStatus === "WAITING") return "WAITING";
            return "INITIALIZING";
        }
        const ageSec = Math.max(0, Math.floor((now - lastObs) / 1000));
        if (ageSec >= 15 || state.queueFeedStatus === "STALE") return "STALE";
        if (state.queueFeedStatus === "LIVE") return "LIVE";
        return "WAITING";
    }

    function getGlobalState(outboundState, inboundState) {
        if (outboundState === "AUTH LOST" || inboundState === "AUTH LOST") return "AUTH LOST";
        if (outboundState === "SOURCE ERROR" && inboundState === "SOURCE ERROR") return "SOURCE ERROR";
        if (outboundState === "LIVE" && inboundState === "LIVE") return "LIVE";
        if (outboundState === "LIVE" && (inboundState === "WAITING" || inboundState === "INITIALIZING" || inboundState === "CONNECTING")) {
            return "LIVE";
        }
        if (inboundState === "LIVE" && (outboundState === "WAITING" || outboundState === "INITIALIZING" || outboundState === "CONNECTING")) {
            return "PARTIALLY CONNECTED";
        }
        if (outboundState === "STALE" || inboundState === "STALE") {
            if (outboundState === "LIVE" || inboundState === "LIVE") return "PARTIALLY CONNECTED";
            return "STALE";
        }
        if (outboundState === "SOURCE ERROR" || inboundState === "SOURCE ERROR") return "SOURCE ERROR";
        if (outboundState === "CONNECTING" || inboundState === "CONNECTING") return "CONNECTING";
        if (outboundState === "WAITING" || inboundState === "WAITING") return "WAITING";
        return "INITIALIZING";
    }

        function evaluateFreshness(observedAt, now) {
        now = now || Date.now();
        if (!observedAt) {
            return {
                status: "NOT_OBSERVED",
                label: "NOT OBSERVED",
                ageSec: null,
                ageStr: "never",
                timeStr: "—",
                className: "is-waiting"
            };
        }
        const ageSec = Math.max(0, Math.floor((now - observedAt) / 1000));
        const timeStr = new Date(observedAt).toLocaleTimeString();
        const ageStr = formatAge(ageSec);
        if (ageSec < 15) {
            return {
                status: "LIVE",
                label: "LIVE (" + ageStr + " ago)",
                ageSec: ageSec,
                ageStr: ageStr,
                timeStr: timeStr,
                className: "is-live"
            };
        }
        if (ageSec <= 60) {
            return {
                status: "RECENT",
                label: "RECENT (" + ageStr + " ago)",
                ageSec: ageSec,
                ageStr: ageStr,
                timeStr: timeStr,
                className: "is-recent"
            };
        }
        return {
            status: "STALE",
            label: "STALE (" + ageStr + " ago)",
            ageSec: ageSec,
            ageStr: ageStr,
            timeStr: timeStr,
            className: "is-stale"
        };
    }

    function updateConnectionState(now) {
        now = now || Date.now();
        const isCampaigns = (state.route || "campaigns") === "campaigns";

        const outboundState = getOutboundState(now);
        const inboundState = getInboundState(now);
        const globalState = getGlobalState(outboundState, inboundState);

        state.outboundSourceState = outboundState;
        state.inboundSourceState = inboundState;
        state.connectionState = globalState;
        state.sourceState = globalState;

        // Ages
        const outAgeSec = state.lastSuccessfulOutboundAt ? Math.max(0, Math.floor((now - state.lastSuccessfulOutboundAt) / 1000)) : null;
        const outAgeStr = outAgeSec !== null ? formatAge(outAgeSec) + " ago" : (outboundState === "WAITING" ? "waiting" : "initializing");
        const outTimeStr = state.lastSuccessfulOutboundAt ? formatDateTime(new Date(state.lastSuccessfulOutboundAt)) : "";

        const inAgeSec = state.lastSuccessfulInboundAt ? Math.max(0, Math.floor((now - state.lastSuccessfulInboundAt) / 1000)) : null;
        const inAgeStr = inAgeSec !== null ? formatAge(inAgeSec) + " ago" : (inboundState === "WAITING" ? "connecting" : "awaiting feed");
        const inTimeStr = state.lastSuccessfulInboundAt ? formatDateTime(new Date(state.lastSuccessfulInboundAt)) : "";

        let badgeText = "INITIALIZING";
        let badgeTone = "is-warning";
        let subtitleText = "Initializing monitor · Awaiting CallTools DOM";

        if (globalState === "AUTH LOST") {
            badgeText = "AUTH LOST";
            badgeTone = "is-critical";
            subtitleText = "Authentication required · Log in to CallTools to resume monitoring";
        } else if (globalState === "SOURCE ERROR") {
            badgeText = "SOURCE ERROR";
            badgeTone = "is-critical";
            subtitleText = "CallTools table not found · Check page URL";
        } else if (globalState === "CONNECTING") {
            badgeText = "CONNECTING";
            badgeTone = "is-warning";
            subtitleText = "Connecting to live CallTools feed · Restoring session";
        } else if (globalState === "WAITING") {
            badgeText = "WAITING";
            badgeTone = "is-warning";
            subtitleText = "Waiting for verified CallTools data";
        } else if (globalState === "STALE") {
            badgeText = "STALE";
            badgeTone = "is-critical";
            subtitleText = "STALE · Outbound: " + outAgeStr + " · Inbound: " + inAgeStr;
        } else if (globalState === "PARTIALLY CONNECTED") {
            badgeText = "PARTIAL";
            badgeTone = "is-warning";
            if (isCampaigns) {
                subtitleText = "PARTIALLY CONNECTED · Outbound: " + (outboundState === "LIVE" ? "LIVE (" + outAgeStr + ")" : outboundState) + " · Inbound: " + inAgeStr;
            } else {
                subtitleText = "PARTIALLY CONNECTED · Inbound: LIVE (" + inAgeStr + ") · Outbound: " + outAgeStr;
            }
        } else if (globalState === "LIVE") {
            badgeText = state.isMonitoringRefreshing ? "UPDATING" : "LIVE OBSERVED";
            badgeTone = state.isMonitoringRefreshing ? "is-warning" : "is-good";
            const nextStr = " · Next check: " + (state.nextMonitoringCheckIn != null ? state.nextMonitoringCheckIn : 15) + "s";
            if (isCampaigns) {
                subtitleText = "LIVE · Observed " + outAgeStr + " (" + outTimeStr + ")" + (inboundState === "LIVE" ? " · Inbound live" : " · Inbound connecting") + nextStr;
            } else {
                subtitleText = "LIVE · Observed " + inAgeStr + " (" + inTimeStr + ")" + (outboundState === "LIVE" ? " · Outbound live" : " · Outbound connecting") + nextStr;
            }
        }

        if (refs && refs.feedPoll) {
            setText(refs.feedPoll, "15s cycle · Next in " + (state.nextMonitoringCheckIn != null ? state.nextMonitoringCheckIn : 15) + "s");
        }

        if (refs && refs.live) {
            setText(refs.live, badgeText);
            setClass(refs.live, "ct-live " + badgeTone);
            refs.live.title = "Connection: " + globalState + " (Outbound: " + outboundState + ", Inbound: " + inboundState + ")";
        }
        if (refs && refs.updated) {
            setText(refs.updated, subtitleText);
        }

        // Operational alerts
        if (outboundState === "STALE" || inboundState === "STALE") {
            upsertOperationalAlert("SOURCE_STALE", "CallTools Page Health", "critical",
                "CallTools feed heartbeat delayed (Outbound: " + outAgeStr + ", Inbound: " + inAgeStr + ").",
                "Live monitoring is passive. Check CallTools connectivity; no automatic page reload will be performed.",
                "critical|SOURCE_STALE");
        } else if (outboundState === "LIVE" && inboundState === "LIVE") {
            dismissOperationalAlert("SOURCE_STALE");
            dismissOperationalAlert("SOURCE_RECOVERY");
            if (state.dismissedConditions) {
                state.dismissedConditions.delete("SOURCE_STALE");
                state.dismissedConditions.delete("SOURCE_RECOVERY");
            }
        }

        if (refs && refs.calltoolsHealth) {
            setText(refs.calltoolsHealth, globalState);
            setClass(refs.calltoolsHealth, "ct-command-value " + (globalState === "LIVE" ? "is-good" : (globalState === "STALE" || globalState === "AUTH LOST" || globalState === "SOURCE ERROR") ? "is-critical" : "is-warning"));
        }
        if (refs && refs.dataConfidence) {
            setText(refs.dataConfidence, globalState === "LIVE" ? "VERIFIED" : globalState === "PARTIALLY CONNECTED" ? "PARTIAL" : globalState === "STALE" ? "STALE" : "WAITING");
        }
        if (refs && refs.systemHealth) {
            setText(refs.systemHealth, globalState === "LIVE" ? "Live monitoring active" : globalState === "PARTIALLY CONNECTED" ? "Partially connected — watching" : globalState === "STALE" ? "Feed stale — watching" : globalState === "AUTH LOST" ? "Authentication required" : "Waiting for data");
        }

        return globalState;
    }

    function updateSourceWatchdog() {
        return updateConnectionState(Date.now());
    }

    function requestPageRefresh(reason) {
        state.lastRecoveryAt = Date.now();
        state.lastRecoveryReason = reason || "manual refresh";
        state.recoveryCount += 1;
        state.recoveryInFlightUntil = Date.now() + 5000;
        if (refs && refs.recoveryState) {
            setText(refs.recoveryState, "Refresh requested");
            setClass(refs.recoveryState, "ct-command-value is-warning");
        }
        document.dispatchEvent(new CustomEvent(REQUEST_REFRESH_EVENT));
    }

    function focusCampaign(identifier, setOperating) {
        const raw = String(identifier || "").trim().toLowerCase();
        const prepared = prepareCampaigns(state.campaigns);
        const match = prepared.find(function(c){
            return (c.__id && String(c.__id).trim().toLowerCase() === raw) ||
                   (c.id && String(c.id).trim().toLowerCase() === raw) ||
                   (c.rawId && String(c.rawId).trim().toLowerCase() === raw) ||
                   (c.name && String(c.name).trim().toLowerCase() === raw);
        });
        if (!match) return;
        const primaryId = match.rawId || match.id || match.__id || String(match.name || "").trim().toLowerCase();
        const shouldOperate = setOperating !== false;
        if (shouldOperate) {
            const next = new Set((state.operatingCampaigns || []).map(function(id) { return String(id || "").trim(); }).filter(Boolean));
            const alreadySelected = isCampaignSelected(match, next);
            if (!alreadySelected) {
                next.add(primaryId);
                showActionNotice(safeValue(match.name) + " selected as operating campaign.");
            } else {
                if (match.rawId) next.delete(String(match.rawId));
                if (match.id) next.delete(String(match.id));
                if (match.__id) next.delete(String(match.__id));
                if (match.name) next.delete(String(match.name).trim().toLowerCase());
                next.delete(primaryId);
                showActionNotice(safeValue(match.name) + " removed from operating set.");
            }
            writeOperatingCampaigns(Array.from(next));
            addCurrentStateAlerts(state.campaigns);
        } else {
            showActionNotice("Viewing " + safeValue(match.name) + ".");
        }
        state.query = "";
        if (refs.search) refs.search.value = "";
        scheduleRender();
        window.requestAnimationFrame(function () {
            const card = refs.list.querySelector('.ct-card[data-id="' + CSS.escape(match.__id) + '"]');
            if (card) {
                card.scrollIntoView({ behavior: "smooth", block: "center" });
                card.classList.add("ct-focus-flash");
                window.setTimeout(function(){ card.classList.remove("ct-focus-flash"); }, 1200);
            }
        });
    }

    function showActionNotice(message) {
        if (!refs || !refs.actionNotice) return;
        refs.actionNotice.textContent = String(message || "");
        refs.actionNotice.hidden = !message;
        window.clearTimeout(showActionNotice._timer);
        if (message) showActionNotice._timer = window.setTimeout(function () {
            if (refs && refs.actionNotice) refs.actionNotice.hidden = true;
        }, 4500);
    }

    function dismissAndRememberAlert(alertItem) {
        if (!alertItem) return;
        state.dismissedConditions.set(alertItem.conditionKey, alertItem.signature || alertItem.message || "");
        persistDismissedConditions();
        state.recentAlerts = state.recentAlerts.filter(function(a){ return a.conditionKey !== alertItem.conditionKey; });
        if (refs.alerts) refs.alerts.dataset.signature = "";
        showActionNotice("Alert dismissed until the condition changes.");
        scheduleRender();
    }

    function clearAttentionCenter() {
        state.recentAlerts.forEach(function (alertItem) {
            if (alertItem && alertItem.conditionKey) {
                state.dismissedConditions.set(alertItem.conditionKey, alertItem.signature || alertItem.message || "");
            }
        });
        persistDismissedConditions();
        state.recentAlerts = [];
        if (intelligenceEngine && typeof intelligenceEngine.clearAllDismissibleAlerts === "function") {
            intelligenceEngine.clearAllDismissibleAlerts();
        }
        if (refs.alerts) {
            refs.alerts.dataset.signature = "";
            refs.alerts.textContent = "";
        }
        if (refs.persistentGoalsContainer) {
            refs.persistentGoalsContainer.dataset.signature = "";
            refs.persistentGoalsContainer.textContent = "";
        }
        updateAlerts();
        showActionNotice("Current Action Center signals cleared until conditions change.");
        scheduleRender();
    }

    function dismissOperationalAlert(key) {
        state.recentAlerts = state.recentAlerts.filter(function (a) { return a.conditionKey !== key; });
    }

    function upsertOperationalAlert(conditionKey, name, severity, message, action, signatureOverride, campaignIdOverride) {
        const signature = signatureOverride ? (String(signatureOverride).startsWith(ALERT_LOGIC_VERSION + "|") ? String(signatureOverride) : ALERT_LOGIC_VERSION + "|" + signatureOverride) : ALERT_LOGIC_VERSION + "|" + severity + "|" + message;
        const dismissed = state.dismissedConditions.get(conditionKey);
        if (dismissed && dismissed === signature) return;
        const existing = state.recentAlerts.find(function (a) { return a.conditionKey === conditionKey; });
        if (existing) {
            existing.signature = signature;
            existing.message = message;
            existing.action = action;
            existing.severity = severity;
            return;
        }
        state.recentAlerts.unshift({
            id: "operational:" + conditionKey,
            conditionKey: conditionKey,
            signature: signature,
            campaignId: String(campaignIdOverride || (conditionKey === "REALTIME:LEADS"
                ? ((state.campaigns || []).find(function(c){ return /^realtime 126$/i.test(String(c.name || "")) && c.active === true; })?.name || name)
                : (String(conditionKey).split(":")[0] || name))).toLowerCase(),
            name: name,
            severity: severity,
            label: severity === "critical" ? "ACTION NOW" : "WATCH",
            message: message,
            action: action,
            createdAt: Date.now()
        });
        state.recentAlerts = state.recentAlerts.slice(0, MAX_ALERTS);
    }

    function updateOperationsHealth(stats) {
        const health = operationsHealth(stats);
        const longestWait = stats.highestWait ? `${safeValue(stats.highestWait.waitNow)} / ${safeValue(stats.highestWait.name)}` : EMPTY;
        const abandonment = stats.highestAbandoned && stats.highestAbandoned.__abandoned > 0 ?
            `${formatNumber(stats.highestAbandoned.__abandoned)} / ${safeValue(stats.highestAbandoned.name)}` :
            "No current signal";

        setText(refs.ops.score, health.score);
        setText(refs.ops.state, health.label);
        setClass(refs.ops.state, "ct-health-state is-" + health.tone);
        setText(refs.ops.actionState, health.actionState);
        setClass(refs.ops.actionState, "ct-health-state is-" + health.tone);
        setText(refs.ops.actionText, health.action);

        updateOpsMetric("queuePressure", health.queuePressure);
        updateOpsMetric("agentCapacity", health.agentCapacity);
        updateOpsMetric("longestWait", longestWait);
        updateOpsMetric("waitingCalls", formatNumber(stats.waiting));
        updateOpsMetric("activeCalls", formatNumber(stats.onCall));
        updateOpsMetric("loggedAgents", formatNumber(stats.loggedIn));
        updateOpsMetric("utilization", stats.utilization + "%");
        updateOpsMetric("abandonment", abandonment);
    }

    function alertChangeText(campaign, field, label, unit) {
        const previous = state.previousById.get(campaign.__id);
        if (!previous) return "";
        const current = field === "abandoned" ? abandonedCount(campaign.abandoned) : numberValue(campaign[field]);
        const before = field === "abandoned" ? abandonedCount(previous.abandoned) : numberValue(previous[field]);
        const delta = current - before;
        if (delta === 0) return "";
        const sign = delta > 0 ? "+" : "";
        return label + ": " + formatNumber(before) + " → " + formatNumber(current) + " (" + sign + formatNumber(delta) + (unit || "") + ")";
    }

    function addInboundAlerts(queues) {
        const activeKeys = new Set();
        const upsert = function(key, name, severity, message, action, queueName, signature) {
            activeKeys.add(key);
            const sig = ALERT_LOGIC_VERSION + "|" + (signature || severity + "|" + message);
            if (state.dismissedConditions.get(key) === sig) return;
            upsertOperationalAlert(key, name, severity, message, action, sig, queueName || name);
        };
        (queues || []).filter(function(q){ return !isArchivedQueue(q); }).forEach(function(q, index) {
            const name = String(q.name || "Inbound Queue " + (index + 1));
            const waiting = queueNumber(q, "waiting");
            const loggedIn = queueNumber(q, "loggedIn");
            const maxWait = Math.max(queueNumber(q, "waitMax"), queueNumber(q, "waitAverage"));
            if (waiting > 0 && loggedIn === 0) {
                const waitTier = waiting >= 5 ? "5+" : String(waiting);
                upsert("INBOUND:" + name + ":CAPACITY", name, "critical", waiting + " caller" + (waiting === 1 ? " is" : "s are") + " waiting with 0 logged-in agents in this queue.", "Check queue membership and agent readiness immediately.", name, "CAPACITY|tier:" + waitTier);
            } else if (waiting > 0 && maxWait >= 60) {
                const waitBucket = Math.floor(waiting / 3);
                upsert("INBOUND:" + name + ":WAIT", name, "critical", maxWait + "s maximum wait with " + waiting + " caller" + (waiting === 1 ? " waiting." : "s waiting."), "Review inbound capacity and the highest-wait queue first.", name, "WAIT|tier:60|bucket:" + waitBucket);
            } else if (waiting > 0 && maxWait >= 30) {
                const waitBucket = Math.floor(waiting / 3);
                upsert("INBOUND:" + name + ":WAIT", name, "warning", maxWait + "s maximum wait with " + waiting + " caller" + (waiting === 1 ? " waiting." : "s waiting."), "Watch inbound wait growth and intervene if pressure continues.", name, "WAIT|tier:30|bucket:" + waitBucket);
            }
            if (waiting > 0 && loggedIn > 0 && queueNumber(q,"onQueueCalls") >= loggedIn) {
                upsert("INBOUND:" + name + ":SATURATION", name, "warning", waiting + " waiting while all " + loggedIn + " logged-in agents are on queue calls.", "Watch the queue closely and add capacity if wait continues rising.", name, "SATURATION|loggedIn:" + loggedIn);
            }
        });
        const trend = inboundTrendMetrics(queues);
        if (trend.waitDelta !== null && trend.waitDelta >= 10 && (queues || []).some(function(q){ return !isArchivedQueue(q) && queueNumber(q,"waiting") > 0; })) {
            upsert("INBOUND:GLOBAL:RISING_WAIT", "Inbound Operations", "warning", "Maximum queue wait rose " + signedValue(trend.waitDelta) + "s over the live trend window while callers are waiting.", "Review the highest-wait queue and available capacity now.", "Inbound Operations", "RISING_WAIT|tier:10+");
        }
        state.recentAlerts.forEach(function(a) {
            if (a && String(a.conditionKey || "").startsWith("INBOUND:") && !activeKeys.has(a.conditionKey)) {
                state.dismissedConditions.delete(a.conditionKey);
                if (a.id && String(a.id).indexOf("operational:") === 0) {
                    a.__inactive = true;
                    state.recoveryCount++;
                    state.lastRecoveryAt = Date.now();
                    state.lastRecoveryReason = a.name + " condition resolved.";
                }
            }
        });
        state.recentAlerts = state.recentAlerts.filter(function(a){ return !a.__inactive; }).slice(0, MAX_ALERTS);
    }

    function addCurrentStateAlerts(campaigns) {
        const now = Date.now();
        const prepared = prepareCampaigns(campaigns);
        const activeKeys = new Set();
        const upsert = function (key, name, severity, label, message, action, campaignIdOverride, signatureOverride) {
            activeKeys.add(key);
            const signature = signatureOverride ? (String(signatureOverride).startsWith(ALERT_LOGIC_VERSION + "|") ? String(signatureOverride) : ALERT_LOGIC_VERSION + "|" + signatureOverride) : ALERT_LOGIC_VERSION + "|" + severity + "|" + message;
            if (state.dismissedConditions.get(key) === signature) return;
            upsertOperationalAlert(key, name, severity, message, action, signature, campaignIdOverride);
            const item = state.recentAlerts.find(function (a) { return a.conditionKey === key; });
            if (item) { item.label = label; item.createdAt = item.createdAt || now; }
        };

        const operational = prepared.filter(function (c) { return c.__active === true; });
        const selectedIds = new Set((state.operatingCampaigns || []).map(function (id) {
            return String(id || "").trim();
        }).filter(Boolean));
        const alertOperational = operational.filter(function (c) {
            return c.__loggedIn > 0 ||
                c.__waiting > 0 ||
                c.__onCall > 0 ||
                c.__wait >= 30 ||
                c.__abandoned >= 500 ||
                selectedIds.has(c.__id);
        });
        const realtime = operational.filter(function (c) {
            return /^realtime\b/i.test(String(c.name || ""));
        });
        const realtimeAlertOperational = realtime.filter(function (c) {
            return c.__loggedIn > 0 ||
                c.__waiting > 0 ||
                c.__onCall > 0 ||
                c.__wait >= 30 ||
                c.__abandoned >= 500 ||
                selectedIds.has(c.__id);
        });
        const threshold = Math.max(0, numberValue(state.contactThreshold));

        // REALTIME lead supply is operationally important even when the current
        // REALTIME rows have 0 agents / 0 waiting / 0 on-call. The lead alert must
        // therefore use ALL ACTIVE REALTIME rows, while other campaign alerts keep
        // the low-noise operational scope below.
        if (realtime.length > 1) {
            const values = realtime.map(function (c) { return c.__contacts; });
            const samePool = values.every(function (value) { return value === values[0]; });
            if (samePool) {
                const pool = values[0];
                const target = getOperatingCampaigns(prepared).find(function (c) { return /^realtime\b/i.test(String(c.name || "")); }) || realtime[0];
                if (pool === 0) {
                    upsert(
                        "REALTIME:OUT_OF_LEADS",
                        "REALTIME — SHARED FILTER",
                        "critical",
                        "OUT OF LEADS",
                        "0 live leads across " + realtime.length + " active REALTIME campaigns sharing the same CallTools pool." + (target && alertChangeText(target, "contacts", "Live Leads", "") ? " " + alertChangeText(target, "contacts", "Live Leads", "") + "." : ""),
                        "Move agents according to the current approved lead-allocation procedure.",
                        target ? target.__id : "",
                        ALERT_LOGIC_VERSION + "|critical|OUT_OF_LEADS|leads:0"
                    );
                } else if (threshold > 0 && pool <= threshold) {
                    upsert(
                        "REALTIME:LOW_LEADS",
                        "REALTIME — SHARED FILTER",
                        "warning",
                        "LOW LEADS",
                        formatNumber(pool) + " live leads remain across " + realtime.length + " active REALTIME campaigns; alert threshold is " + formatNumber(threshold) + "." + (target && alertChangeText(target, "contacts", "Live Leads", "") ? " " + alertChangeText(target, "contacts", "Live Leads", "") + "." : ""),
                        "Prepare the next approved lead source before the shared pool is exhausted.",
                        target ? target.__id : "",
                        ALERT_LOGIC_VERSION + "|warning|LOW_LEADS|threshold:" + threshold + "|leads:" + pool
                    );
                }
            }
        } else if (realtime.length === 1) {
            const c = realtime[0];
            if (c.__contacts === 0) {
                upsert(c.__id + ":OUT_OF_LEADS", safeValue(c.name, "REALTIME"), "critical", "OUT OF LEADS", "0 live leads reported by the active CallTools REALTIME campaign feed." + (alertChangeText(c, "contacts", "Live Leads", "") ? " " + alertChangeText(c, "contacts", "Live Leads", "") + "." : ""), "Move agents according to the current approved lead-allocation procedure.", c.__id, ALERT_LOGIC_VERSION + "|critical|OUT_OF_LEADS|leads:0");
            } else if (threshold > 0 && c.__contacts <= threshold) {
                upsert(c.__id + ":LOW_LEADS", safeValue(c.name, "REALTIME"), "warning", "LOW LEADS", formatNumber(c.__contacts) + " live leads remaining; alert threshold is " + formatNumber(threshold) + "." + (alertChangeText(c, "contacts", "Live Leads", "") ? " " + alertChangeText(c, "contacts", "Live Leads", "") + "." : ""), "Prepare the next approved lead source before this campaign exhausts its available pool.", c.__id, ALERT_LOGIC_VERSION + "|warning|LOW_LEADS|threshold:" + threshold + "|leads:" + c.__contacts);
            }
        }

        // Direct operating-campaign alignment is a current-state alert. If the
        // operator explicitly selected a LIVE campaign, that campaign has 0 logged-in
        // agents, and another operational campaign currently has agents, the monitor
        // must surface the mismatch. This is a verified feed condition; it does not
        // infer where individual agents should be assigned.
        const selectedOperatingIdsForAlert = new Set(state.operatingCampaigns || []);
        selectedOperatingIdsForAlert.forEach(function (selectedId) {
            const selected = operational.find(function (c) { return c.__id === selectedId; });
            if (!selected || !selected.__loggedInAvailable || selected.__loggedIn !== 0) return;
            const other = operational
                .filter(function (c) { return c.__id !== selected.__id && c.__loggedInAvailable && c.__loggedIn > 0; })
                .sort(function (a, b) {
                    return b.__loggedIn - a.__loggedIn || (b.__waiting || 0) - (a.__waiting || 0);
                })[0];
            if (!other) return;
            const severity = selected.__waiting > 0 ? "critical" : "warning";
            const message = safeValue(selected.name) + " has 0 logged-in agents while " +
                safeValue(other.name) + " has " + formatNumber(other.__loggedIn) +
                " logged-in agent" + (other.__loggedIn === 1 ? "" : "s") + ".";
            const action = selected.__waiting > 0
                ? "Check agent readiness and queue assignment immediately; do not infer individual agent movement from the campaign feed."
                : "Verify the intended campaign assignment before operating this campaign.";
            upsert(
                "OPERATING_AGENTS:" + selected.__id,
                safeValue(selected.name),
                severity,
                "AGENT ALIGNMENT",
                message,
                action,
                selected.__id,
                ALERT_LOGIC_VERSION + "|" + severity + "|AGENT_ALIGNMENT|selected:" + selected.__id +
                    "|selectedAgents:" + selected.__loggedIn + "|selectedWaiting:" + selected.__waiting +
                    "|other:" + other.__id + "|otherAgents:" + other.__loggedIn
            );
        });

        // Operating-set alignment is aggregate-only. Establish a baseline when the
        // operator manually changes the selected set, then alert only on a verified
        // distribution shift. Other active campaigns having agents is not itself an alert.
        ensureOperatingBaseline(prepared);
        const operatingSelectedIds = new Set(state.operatingCampaigns || []);
        const selectedOperating = operational.filter(function (c) { return operatingSelectedIds.has(c.__id); });
        const baseline = state.operatingBaseline && state.operatingBaseline.selectionKey === operatingSelectionKey(state.operatingCampaigns || []) ? state.operatingBaseline : null;
        if (selectedOperating.length && baseline && baseline.counts) {
            const selectedDrop = selectedOperating.reduce(function (sum, c) {
                return sum + Math.max(0, numberValue(baseline.counts[c.__id]) - c.__loggedIn);
            }, 0);
            const outsideRiseRows = operational.filter(function (c) { return !operatingSelectedIds.has(c.__id); }).map(function (c) {
                return { campaign: c, rise: Math.max(0, c.__loggedIn - numberValue(baseline.counts[c.__id])) };
            }).filter(function (x) { return x.rise > 0; }).sort(function (a, b) { return b.rise - a.rise; });
            const outsideRise = outsideRiseRows.reduce(function (sum, x) { return sum + x.rise; }, 0);
            if (selectedDrop > 0 && outsideRise > 0) {
                const strongest = outsideRiseRows[0];
                const severity = selectedDrop + outsideRise >= 3 ? "critical" : "warning";
                const message = "Aggregate agent distribution shifted: selected operating campaigns are down " + selectedDrop + " while outside campaigns are up " + outsideRise + ".";
                const action = "Review campaign assignment. This is an aggregate feed shift; individual agent movement is not inferred from the native campaign table.";
                upsert("OPERATING_AGENTS:ALIGNMENT", strongest ? safeValue(strongest.campaign.name) : "Operating Set", severity, "AGENT ALIGNMENT SHIFT", message, action, strongest ? strongest.campaign.__id : "");
            }
        }

        alertOperational.forEach(function (c) {
            const name = safeValue(c.name, "Unnamed Campaign");
            const isRealtime = /^realtime\b/i.test(String(c.name || ""));
            const realtimeSharedPool = realtimeAlertOperational.length > 1 && realtime.every(function (r) { return r.__contacts === realtime[0].__contacts; });

            // REALTIME lead supply was evaluated for ALL active REALTIME rows above.
            // Here we only evaluate non-REALTIME campaigns and mismatched REALTIME
            // pools that are currently operationally relevant.
            if (!isRealtime || !realtimeSharedPool) {
                if (c.__contacts === 0) {
                    upsert(c.__id + ":OUT_OF_LEADS", name, "critical", "OUT OF LEADS", "0 live leads reported by the active CallTools campaign feed." + (alertChangeText(c, "contacts", "Live Leads", "") ? " " + alertChangeText(c, "contacts", "Live Leads", "") + "." : ""), "Move agents according to the current approved lead-allocation procedure.", c.__id, ALERT_LOGIC_VERSION + "|critical|OUT_OF_LEADS|leads:0");
                } else if (threshold > 0 && c.__contacts <= threshold) {
                    upsert(c.__id + ":LOW_LEADS", name, "warning", "LOW LEADS", formatNumber(c.__contacts) + " live leads remaining; alert threshold is " + formatNumber(threshold) + "." + (alertChangeText(c, "contacts", "Live Leads", "") ? " " + alertChangeText(c, "contacts", "Live Leads", "") + "." : ""), "Prepare the next approved lead source before this campaign exhausts its available pool.", c.__id, ALERT_LOGIC_VERSION + "|warning|LOW_LEADS|threshold:" + threshold + "|leads:" + c.__contacts);
                }
            }

            if (c.__waitingAvailable && c.__loggedInAvailable && c.__waiting > 0 && c.__loggedIn === 0) {
                upsert(c.__id + ":CAPACITY", name, "critical", "NO AGENT CAPACITY", c.__waiting + " waiting with 0 logged-in agents" + (c.__wait ? " and " + c.__wait + "s wait." : ".") + ((alertChangeText(c, "waiting", "Waiting", "") || alertChangeText(c, "waitNow", "Wait", "s")) ? " " + [alertChangeText(c, "waiting", "Waiting", ""), alertChangeText(c, "waitNow", "Wait", "s")].filter(Boolean).join("; ") + "." : ""), "Check agent readiness, queue membership, and campaign assignment.", c.__id);
            } else if (c.__wait >= 60) {
                const waitDetail = (c.__waitingAvailable && c.__waiting > 0) ? " with " + c.__waiting + " waiting." : ".";
                upsert(c.__id + ":WAIT", name, "critical", "QUEUE DELAY", c.__wait + "s wait" + waitDetail + ((alertChangeText(c, "waitNow", "Wait", "s") || alertChangeText(c, "waiting", "Waiting", "")) ? " " + [alertChangeText(c, "waitNow", "Wait", "s"), alertChangeText(c, "waiting", "Waiting", "")].filter(Boolean).join("; ") + "." : ""), "Review available capacity and the highest-wait queue first.", c.__id, ALERT_LOGIC_VERSION + "|critical|QUEUE_DELAY|tier:60");
            } else if (c.__wait >= 30) {
                const waitDetail = (c.__waitingAvailable && c.__waiting > 0) ? " with " + c.__waiting + " waiting." : ".";
                upsert(c.__id + ":WAIT", name, "warning", "HIGH WAIT", c.__wait + "s wait" + waitDetail + ((alertChangeText(c, "waitNow", "Wait", "s") || alertChangeText(c, "waiting", "Waiting", "")) ? " " + [alertChangeText(c, "waitNow", "Wait", "s"), alertChangeText(c, "waiting", "Waiting", "")].filter(Boolean).join("; ") + "." : ""), "Watch wait growth and intervene if the queue continues rising.", c.__id, ALERT_LOGIC_VERSION + "|warning|HIGH_WAIT|tier:30");
            }

            // Queue saturation is a distinct condition from wait time. It catches
            // queues where every logged-in agent is occupied while calls are waiting.
            if (c.__waitingAvailable && c.__loggedInAvailable && c.__onCallAvailable && c.__waiting >= 5 && c.__loggedIn > 0 && c.__onCall >= c.__loggedIn) {
                upsert(c.__id + ":SATURATION", name, "warning", "QUEUE SATURATED", c.__waiting + " waiting while all " + c.__loggedIn + " logged-in agents are occupied." + (alertChangeText(c, "waiting", "Waiting", "") ? " " + alertChangeText(c, "waiting", "Waiting", "") + "." : ""), "Watch wait growth and add capacity if the queue continues rising.", c.__id);
            }

            if (hasCampaignDataIntegrityIssue(c)) {
                upsert(c.__id + ":DATA_CHECK", name, "warning", "DATA CHECK", "The current campaign feed contains missing or internally inconsistent operational values.", "Verify the CallTools campaign row before acting on affected metrics.", c.__id);
            }
        });

        // Material abandonment is a campaign-health signal, not an agent-presence
        // signal. Evaluate it across ALL active campaigns so a live campaign with
        // no current agents can still surface a verified high abandonment rate or
        // a newly reported abandoned call. This is deliberately limited to the
        // existing material/new-event thresholds to preserve low-noise behavior.
        // IMPORTANT: keep this scope explicit. A previous build referenced
        // `activeCampaigns` here without declaring it, which stopped the alert
        // pipeline with a ReferenceError.
        const activeCampaigns = prepared.filter(function (c) { return c.__active === true; });
        activeCampaigns.forEach(function (c) {
            const name = safeValue(c.name, "Unnamed Campaign");
            if (c.__abandoned <= 0) return;
            const abandonRate = c.__outbound > 0 ? (c.__abandoned / c.__outbound) * 100 : 0;
            const previous = state.previousById.get(c.__id);
            const previousAbandoned = previous ? abandonedCount(previous.abandoned) : 0;
            const delta = Math.max(0, c.__abandoned - previousAbandoned);
            const materiallyHigh = c.__abandoned >= 500 || abandonRate >= 5;
            if (!materiallyHigh && delta <= 0) return;
            const abandonSeverity = c.__abandoned >= 500 || abandonRate >= 5 ? "critical" : "warning";
            const spikeText = delta > 0 ? " (+" + delta + " since the previous feed update)" : "";
            upsert(c.__id + ":ABANDON", name, abandonSeverity, "ABANDONED CALLS",
                c.__abandoned + " abandoned call" + (c.__abandoned === 1 ? "" : "s") + " reported" + spikeText + (c.__outbound > 0 ? " (" + abandonRate.toFixed(1) + "% of outbound)." : "."),
                "Review queue wait, agent capacity, and call distribution around this campaign.", c.__id,
                ALERT_LOGIC_VERSION + "|" + abandonSeverity + "|ABANDON|count:" + c.__abandoned + "|delta:" + delta);
        });

        // Runway alerts are intentionally limited to explicitly selected
        // operating campaigns and only after the native Leads series has a
        // measured depletion rate. Multiple selected campaigns are evaluated
        // independently so one queue cannot hide another queue's low runway.
        getOperatingCampaigns(prepared).forEach(function (selected) {
            const runway = estimateCampaignRunway(selected);
            if (runway.measured && runway.minutes <= 15) {
                const severity = runway.minutes <= 5 ? "critical" : "warning";
                upsert("RUNWAY:" + (runway.shared ? "REALTIME_SHARED" : selected.__id), safeValue(selected.name), severity, "LOW LEAD RUNWAY",
                    "CallTools Leads are projected to last about " + runway.label + " at the observed depletion rate.",
                    "Review lead supply and the next campaign before the pool is exhausted.", selected.__id);
            }
        });

        state.recentAlerts.forEach(function (a) {
            if (a && a.conditionKey && !activeKeys.has(a.conditionKey) && a.conditionKey !== "SOURCE_STALE" && a.conditionKey !== "SOURCE_RECOVERY") {
                state.dismissedConditions.delete(a.conditionKey);
                persistDismissedConditions();
                if (a.id && String(a.id).indexOf("operational:") === 0) a.__inactive = true;
            }
        });
        state.recentAlerts = state.recentAlerts.filter(function (a) { return !a.__inactive; }).slice(0, MAX_ALERTS);
    }

    function updateInsights(stats) {
        // Insights must use the same operational scope as Action Center.
        // Active-but-unused campaigns (0 agents, 0 waiting, 0 on-call) are not
        // treated as live pressure merely because CallTools marks them Active.
        const activeCampaigns = (stats.campaigns || []).filter(function (c) { return c.__active === true; });
        const selectedIds = new Set((state.operatingCampaigns || []).map(function (id) { return String(id || "").trim(); }).filter(Boolean));
        const campaigns = activeCampaigns.filter(function (c) {
            return c.__loggedIn > 0 || c.__waiting > 0 || c.__onCall > 0 || selectedIds.has(c.__id);
        });
        const highestWait = campaigns.slice().sort(function(a,b){return b.__wait-a.__wait;})[0];
        const highestAbandoned = campaigns.slice().sort(function(a,b){return b.__abandoned-a.__abandoned;})[0];
        const highestQueue = campaigns.slice().sort(function(a,b){return b.__waiting-a.__waiting;})[0];
        const highestOnCall = campaigns.slice().sort(function(a,b){return b.__onCall-a.__onCall;})[0];
        // Lowest Live Leads is a supply indicator, not an agent-pressure indicator.
        // It must consider every ACTIVE CallTools campaign, including an active
        // REALTIME campaign that currently has 0 agents / 0 waiting / 0 on-call.
        // In the current native table, the shared REALTIME pool is 2,931, so that
        // value must beat RES CRED MAIN's 36K+ when determining the lowest lead row.
        // Supply ranking must use operationally relevant campaigns. An idle
        // CallTools row (for example a callback/source campaign with 0 agents,
        // 0 waiting, and 0 on-call) is not a live operating supply signal.
        // REALTIME is the exception because its shared lead pool is operational
        // supply even when agents are temporarily on another campaign.
        const lowestLeadIds = new Set();
        campaigns.forEach(function (c) { lowestLeadIds.add(c.__id); });
        const lowestLeadCandidates = activeCampaigns.filter(function (c) {
            const isRealtime = /^realtime\b/i.test(String(c.name || ""));
            return (lowestLeadIds.has(c.__id) || isRealtime) && Number.isFinite(c.__contacts) && c.__contacts >= 0;
        });
        const lowestLeadsRaw = lowestLeadCandidates.slice().sort(function(a,b){
            return a.__contacts-b.__contacts || String(a.name || "").localeCompare(String(b.name || ""));
        })[0];
        const lowestRealtime = activeCampaigns.filter(function (c) { return /^realtime\b/i.test(String(c.name || "")); });
        const lowestRealtimeShared = lowestRealtime.length > 1 && lowestRealtime.every(function (c) { return c.__contacts === lowestRealtime[0].__contacts; });
        const lowestLeads = lowestRealtimeShared && lowestLeadsRaw && /^realtime\b/i.test(String(lowestLeadsRaw.name || ""))
            ? Object.assign({}, lowestLeadsRaw, { name: "REALTIME — SHARED POOL" })
            : lowestLeadsRaw;
        const noAgent = campaigns.slice().sort(function(a,b){
            const av = (a.__loggedIn === 0 && a.__waiting > 0 ? 1 : 0);
            const bv = (b.__loggedIn === 0 && b.__waiting > 0 ? 1 : 0);
            return bv-av || b.__waiting-a.__waiting;
        })[0];
        const maxUtil = campaigns.slice().sort(function(a,b){return utilizationPercent(b.__loggedIn,b.__onCall)-utilizationPercent(a.__loggedIn,a.__onCall);})[0];
        const abandonRateCandidates = campaigns.map(function(c){
            const derived = c.__outbound > 0 ? (c.__abandoned / c.__outbound) * 100 : null;
            return { campaign:c, rate:derived };
        }).filter(function(x){ return Number.isFinite(x.rate); }).sort(function(a,b){ return b.rate-a.rate; });
        const highestAbandonRate = abandonRateCandidates[0];

        function setInsight(key, value, campaignName, tone, stateLabel, title) {
            const ref = refs.insights[key];
            if (!ref || !ref.node) return;
            ref.node.classList.remove("is-critical","is-warning","is-good","is-info","is-neutral");
            ref.node.classList.add("is-" + (tone || "neutral"));
            if (ref.value) { setText(ref.value, value); ref.value.title = title || value; }
            if (ref.campaign) setText(ref.campaign, campaignName || "No active signal");
            if (ref.state) setText(ref.state, stateLabel || "LIVE");
        }

        const waitTone = !highestWait ? "neutral" : highestWait.__wait >= 60 ? "critical" : highestWait.__wait >= 30 ? "warning" : "good";
        setInsight("highestWait", highestWait ? highestWait.__wait + "s" : "—", highestWait ? highestWait.name : "No active campaign", waitTone, highestWait ? (waitTone === "critical" ? "CRITICAL" : waitTone === "warning" ? "AT RISK" : "HEALTHY") : "NO DATA", "Highest current wait campaign");

        const highestAbandonRateValue = highestAbandoned && highestAbandoned.__outbound > 0 ? (highestAbandoned.__abandoned / highestAbandoned.__outbound) * 100 : 0;
        const abandonTone = !highestAbandoned || highestAbandoned.__abandoned === 0 ? "good" : (highestAbandoned.__abandoned >= 500 || highestAbandonRateValue >= 5) ? "critical" : highestAbandonRateValue >= 2 ? "warning" : "good";
        setInsight("highestAbandoned", highestAbandoned ? formatNumber(highestAbandoned.__abandoned) : "0", highestAbandoned ? highestAbandoned.name : "No operational campaign", abandonTone, abandonTone === "critical" ? "CRITICAL" : abandonTone === "warning" ? "WATCH" : "INFO", "Highest abandoned count among operationally relevant active campaigns; severity reflects observed rate/magnitude");

        const queueTone = highestQueue && highestQueue.__waiting >= 5 ? "critical" : highestQueue && highestQueue.__waiting > 0 ? "warning" : "good";
        setInsight("highestQueue", highestQueue ? formatNumber(highestQueue.__waiting) + " waiting" : "0", highestQueue ? highestQueue.name : "No active queue", queueTone, highestQueue && highestQueue.__waiting >= 5 ? "HIGH" : highestQueue && highestQueue.__waiting ? "WATCH" : "CLEAR", "Highest current queue load");

        setInsight("highestOnCall", highestOnCall ? formatNumber(highestOnCall.__onCall) : "0", highestOnCall ? highestOnCall.name : "No active calls", "info", "LIVE", "Highest active-call count");

        const leadsTone = !lowestLeads ? "neutral" : lowestLeads.__contacts === 0 ? "critical" : lowestLeads.__contacts <= state.contactThreshold ? "warning" : lowestLeads.__contacts <= state.contactThreshold * 2 ? "info" : "good";
        setInsight("lowestLeads", lowestLeads ? formatNumber(lowestLeads.__contacts) : "—", lowestLeads ? lowestLeads.name : "No operational campaign", leadsTone, !lowestLeads ? "NO DATA" : lowestLeads.__contacts === 0 ? "OUT" : lowestLeads.__contacts <= state.contactThreshold ? "LOW" : "HEALTHY", "Lowest CallTools Leads value among active campaigns");

        // A queue is operationally uncovered only when it has callers waiting and zero
        // logged-in agents. A campaign with zero agents but no waiting callers is not
        // presented as a false incident. The clear state must therefore be explicit,
        // rather than the ambiguous "None / All active queues covered" wording.
        const noAgentActive = noAgent && noAgent.__loggedIn === 0 && noAgent.__waiting > 0;
        // The card title must describe the current state. Do not display
        // "Uncovered Queue" as a clear/healthy condition because that reads as
        // an active problem even when there is none.
        if (refs.insights.noAgentQueue && refs.insights.noAgentQueue.label) {
            setText(refs.insights.noAgentQueue.label, noAgentActive ? "UNCOVERED QUEUE" : "QUEUE COVERAGE");
        }
        setInsight(
            "noAgentQueue",
            noAgentActive ? formatNumber(noAgent.__waiting) + " waiting" : "COVERED",
            noAgentActive ? noAgent.name : "0 queues uncovered",
            noAgentActive ? "critical" : "good",
            noAgentActive ? "ACTION" : "CLEAR",
            noAgentActive
                ? "Active campaign has waiting calls but zero logged-in agents"
                : "No active campaign currently has waiting calls with zero logged-in agents"
        );

        const utilValue = maxUtil ? utilizationPercent(maxUtil.__loggedIn,maxUtil.__onCall) : 0;
        setInsight("maxUtilization", maxUtil ? utilValue + "%" : "0%", maxUtil ? maxUtil.name : "No active campaign", utilValue >= 100 ? "warning" : "info", utilValue >= 100 ? "FULL" : "LIVE", "Highest on-call utilization among active campaigns");

        if (highestAbandonRate) {
            const rateTone = highestAbandonRate.rate >= 5 ? "critical" : highestAbandonRate.rate >= 2 ? "warning" : "good";
            const formattedRate = formatRatePercent(highestAbandonRate.campaign.__abandoned, highestAbandonRate.campaign.__outbound);
            setInsight("abandonRate", formattedRate, highestAbandonRate.campaign.name, rateTone, rateTone === "critical" ? "CRITICAL" : rateTone === "warning" ? "WATCH" : "HEALTHY", "Highest abandon percentage from the feed (2-decimal precision), or derived from abandoned calls / attempts");
        } else {
            setInsight("abandonRate", "—", "Percentage not supplied by current feed", "neutral", "DATA", "CallTools did not provide an explicit abandon percentage");
        }

        if (refs.insightsUpdated) setText(refs.insightsUpdated, state.lastDataChangeAt ? "Updated " + formatDateTime(new Date(state.lastDataChangeAt)) : "Waiting for data");
    }


    // ==========================================
    // PERSISTENT SALES / GOALS ALERT ENGINE (EAST-2)
    // ==========================================
    
    // =========================================================================
    // CT DATA CHANGE INTELLIGENCE ENGINE INTEGRATION (EAST-2)
    // =========================================================================
    const intelligenceEngine = (typeof CTDataIntelligence !== "undefined" && CTDataIntelligence.CTDataIntelligenceEngine) ?
        new CTDataIntelligence.CTDataIntelligenceEngine({
            dialer: DIALER,
            prefix: PREFIX,
            storage: typeof localStorage !== "undefined" ? localStorage : null
        }) : null;



    function checkPersistentGoalAlerts(campaigns, queues) {
        let alertsChanged = false;
        let baselinesChanged = false;
        const now = Date.now();
        const timeStr = formatDateTime(new Date(now));

        // 1. Check Outbound Campaigns (Sales & Goals)
        (campaigns || []).forEach(function (c, index) {
            if (!c) return;
            const targetId = String(c.__id || campaignId(c, index) || c.name || "").trim().toLowerCase();
            const targetName = String(c.name || "Campaign " + (index + 1)).trim();

            const goalsVal = c.goals !== null && c.goals !== undefined && c.goals !== "" ? numberValue(c.goals) : null;
            if (goalsVal !== null && Number.isFinite(goalsVal)) {
                const bKey = "outbound_goals_" + targetId;
                const baseline = state.persistentGoalBaselines[bKey];
                if (!baseline) {
                    state.persistentGoalBaselines[bKey] = { val: goalsVal, metric: "Goals", updatedAt: now };
                    baselinesChanged = true;
                } else if (goalsVal > baseline.val) {
                    const increase = goalsVal - baseline.val;
                    const alertId = DIALER + "_OUTBOUND_GOALS_" + targetId + "_" + now + "_" + goalsVal;
                    if (!state.acknowledgedGoalAlerts.has(alertId) && !state.persistentGoalAlerts.some(a => a.id === alertId)) {
                        state.persistentGoalAlerts.push({
                            id: alertId,
                            dialer: DIALER,
                            direction: "OUTBOUND",
                            targetName: targetName,
                            targetId: targetId,
                            metric: "Goals",
                            previous: baseline.val,
                            current: goalsVal,
                            increase: increase,
                            detectedAt: timeStr,
                            timestamp: now,
                            acknowledged: false
                        });
                        alertsChanged = true;
                    }
                    baseline.val = goalsVal;
                    baseline.updatedAt = now;
                    baselinesChanged = true;
                } else if (goalsVal < baseline.val) {
                    baseline.val = goalsVal;
                    baseline.updatedAt = now;
                    baselinesChanged = true;
                }
            }

            const salesVal = c.sales !== null && c.sales !== undefined && c.sales !== "" ? numberValue(c.sales) : null;
            if (salesVal !== null && Number.isFinite(salesVal)) {
                const bKey = "outbound_sales_" + targetId;
                const baseline = state.persistentGoalBaselines[bKey];
                if (!baseline) {
                    state.persistentGoalBaselines[bKey] = { val: salesVal, metric: "Sales", updatedAt: now };
                    baselinesChanged = true;
                } else if (salesVal > baseline.val) {
                    const increase = salesVal - baseline.val;
                    const alertId = DIALER + "_OUTBOUND_SALES_" + targetId + "_" + now + "_" + salesVal;
                    if (!state.acknowledgedGoalAlerts.has(alertId) && !state.persistentGoalAlerts.some(a => a.id === alertId)) {
                        state.persistentGoalAlerts.push({
                            id: alertId,
                            dialer: DIALER,
                            direction: "OUTBOUND",
                            targetName: targetName,
                            targetId: targetId,
                            metric: "Sales",
                            previous: baseline.val,
                            current: salesVal,
                            increase: increase,
                            detectedAt: timeStr,
                            timestamp: now,
                            acknowledged: false
                        });
                        alertsChanged = true;
                    }
                    baseline.val = salesVal;
                    baseline.updatedAt = now;
                    baselinesChanged = true;
                } else if (salesVal < baseline.val) {
                    baseline.val = salesVal;
                    baseline.updatedAt = now;
                    baselinesChanged = true;
                }
            }
        });

        // 2. Check Inbound Queues (Goals & Sales)
        (queues || []).forEach(function (q, index) {
            if (!q || isArchivedQueue(q)) return;
            const targetId = String(queueId(q, index) || q.name || "").trim().toLowerCase();
            const targetName = String(q.name || "Queue " + (index + 1)).trim();

            const goalsVal = q.goals !== null && q.goals !== undefined && q.goals !== "" ? numberValue(q.goals) : null;
            if (goalsVal !== null && Number.isFinite(goalsVal)) {
                const bKey = "inbound_goals_" + targetId;
                const baseline = state.persistentGoalBaselines[bKey];
                if (!baseline) {
                    state.persistentGoalBaselines[bKey] = { val: goalsVal, metric: "Goals", updatedAt: now };
                    baselinesChanged = true;
                } else if (goalsVal > baseline.val) {
                    const increase = goalsVal - baseline.val;
                    const alertId = DIALER + "_INBOUND_GOALS_" + targetId + "_" + now + "_" + goalsVal;
                    if (!state.acknowledgedGoalAlerts.has(alertId) && !state.persistentGoalAlerts.some(a => a.id === alertId)) {
                        state.persistentGoalAlerts.push({
                            id: alertId,
                            dialer: DIALER,
                            direction: "INBOUND",
                            targetName: targetName,
                            targetId: targetId,
                            metric: "Goals",
                            previous: baseline.val,
                            current: goalsVal,
                            increase: increase,
                            detectedAt: timeStr,
                            timestamp: now,
                            acknowledged: false
                        });
                        alertsChanged = true;
                    }
                    baseline.val = goalsVal;
                    baseline.updatedAt = now;
                    baselinesChanged = true;
                } else if (goalsVal < baseline.val) {
                    baseline.val = goalsVal;
                    baseline.updatedAt = now;
                    baselinesChanged = true;
                }
            }

            const salesVal = q.sales !== null && q.sales !== undefined && q.sales !== "" ? numberValue(q.sales) : null;
            if (salesVal !== null && Number.isFinite(salesVal)) {
                const bKey = "inbound_sales_" + targetId;
                const baseline = state.persistentGoalBaselines[bKey];
                if (!baseline) {
                    state.persistentGoalBaselines[bKey] = { val: salesVal, metric: "Sales", updatedAt: now };
                    baselinesChanged = true;
                } else if (salesVal > baseline.val) {
                    const increase = salesVal - baseline.val;
                    const alertId = DIALER + "_INBOUND_SALES_" + targetId + "_" + now + "_" + salesVal;
                    if (!state.acknowledgedGoalAlerts.has(alertId) && !state.persistentGoalAlerts.some(a => a.id === alertId)) {
                        state.persistentGoalAlerts.push({
                            id: alertId,
                            dialer: DIALER,
                            direction: "INBOUND",
                            targetName: targetName,
                            targetId: targetId,
                            metric: "Sales",
                            previous: baseline.val,
                            current: salesVal,
                            increase: increase,
                            detectedAt: timeStr,
                            timestamp: now,
                            acknowledged: false
                        });
                        alertsChanged = true;
                    }
                    baseline.val = salesVal;
                    baseline.updatedAt = now;
                    baselinesChanged = true;
                } else if (salesVal < baseline.val) {
                    baseline.val = salesVal;
                    baseline.updatedAt = now;
                    baselinesChanged = true;
                }
            }
        });

        if (baselinesChanged) persistGoalBaselines();
        if (alertsChanged) persistPersistentGoalAlerts();
    }

    function acknowledgePersistentGoalAlert(alertId) {
        if (!alertId) return;
        state.acknowledgedGoalAlerts.add(alertId);
        state.persistentGoalAlerts = state.persistentGoalAlerts.filter(function (a) { return a.id !== alertId; });
        persistPersistentGoalAlerts();
        persistAcknowledgedGoalAlerts();
        updateAlerts();
        showActionNotice("Persistent " + DIALER + " alert acknowledged [NOTED].");
    }

    function updateAlerts() {
        const alerts = state.recentAlerts.filter(function (a) {
            if (!a || a.__inactive) return false;
            if (a.campaignId && !String(a.conditionKey || "").startsWith("SOURCE_")) {
                const target = String(a.campaignId).trim().toLowerCase();
                if (String(a.conditionKey || "").startsWith("INBOUND:")) {
                    // Inbound alerts are intentionally visible on the outbound
                    // command center. Global inbound conditions are not tied to
                    // one queue; queue-specific conditions must still resolve to
                    // a live non-archived queue before they are shown.
                    const isGlobalInbound = String(a.conditionKey || "").indexOf("INBOUND:GLOBAL:") === 0 || String(a.campaignId || "").indexOf("operational:") === 0;
                    if (!isGlobalInbound) {
                        const queue = (state.queues || []).find(function(q){ return String(q.name || "").trim().toLowerCase() === target; });
                        if (!queue || isArchivedQueue(queue)) return false;
                    }
                } else {
                    const source = (state.campaigns || []).find(function(c, i){
                        const cid = c.__id || campaignId(c, i);
                        return String(cid).trim().toLowerCase() === target ||
                               String(c.name || "").trim().toLowerCase() === target ||
                               String(c.id || "").trim().toLowerCase() === target;
                    });
                    if (source && resolveActiveState(source) === false) return false;
                }
            }
            return true;
        })
            .sort(function (a, b) { return severityRank(a.severity) - severityRank(b.severity) || (b.createdAt || 0) - (a.createdAt || 0); });
        const critical = alerts.filter(function (a) { return a.severity === "critical"; }).length;
        const warning = alerts.filter(function (a) { return a.severity === "warning"; }).length;
        setText(refs.criticalCount, critical + " CRITICAL");
        setText(refs.warningCount, warning + " AT RISK");
        // Render Persistent Goals & Intelligence Alerts (NEVER AUTO-DISMISSED BY CLEAR ALL)
        if (refs.persistentGoalsContainer) {
            const activePersistent = (state.persistentGoalAlerts || []).filter(function (a) {
                return !state.acknowledgedGoalAlerts.has(a.id);
            });
            // Render CT Data Change Intelligence Cards (Engines A, B, C, D)
            const activeIntelCards = (intelligenceEngine ? intelligenceEngine.activeAlerts : []).filter(function (a) {
                return !a.acknowledged && a.category !== "SALES_GOAL";
            }).map(function (alert) {
                const sevClass = alert.severity === "critical" ? "is-critical" : alert.severity === "warning" ? "is-warning" : "is-info";
                const badgeClass = alert.status === "INCREASE" || alert.status === "NEW LEADS ADDED" || alert.status === "LIVE FILTER ASSIGNED"
                    ? "is-increase"
                    : (alert.status === "DECREASE" || alert.status === "LARGE LEAD INVENTORY REDUCTION" || alert.status === "LIVE FILTER REMOVED"
                        ? "is-decrease"
                        : (alert.status === "LIVE FILTER CHANGED" ? "is-filter-change" : "is-integrity"));
                const dialerClass = "ct-dialer-" + String(alert.dialer || DIALER).toLowerCase().replace(/[^a-z0-9]/g, "");
                return '<div class="ct-intelligence-card ' + sevClass + '" data-intel-id="' + escapeHtml(alert.id) + '">' +
                    '<div class="ct-intel-card-top">' +
                        '<span class="ct-intel-badge ' + badgeClass + '">' + escapeHtml(alert.status) + '</span>' +
                        '<span class="ct-dialer-tag ' + dialerClass + '">[' + escapeHtml(alert.dialer) + ']</span>' +
                        '<span class="ct-goal-direction-tag">[' + escapeHtml(alert.direction) + ']</span>' +
                        '<span class="ct-goal-time" title="Detected: ' + escapeHtml(alert.firstDetectedAt) + ' · Confirmed: ' + escapeHtml(alert.confirmedAt) + '">' + escapeHtml(alert.confirmedAt || alert.firstDetectedAt) + '</span>' +
                    '</div>' +
                    '<div class="ct-intel-card-body">' +
                        '<div class="ct-intel-target-row">' +
                            '<strong>' + escapeHtml(alert.targetName) + '</strong> · <span class="ct-intel-metric-title">' + escapeHtml(alert.metric) + '</span>' +
                        '</div>' +
                        '<div class="ct-goal-stat-row">' +
                            '<span class="ct-goal-count-prev">' + alert.previous + '</span>' +
                            '<span class="ct-goal-arrow">→</span>' +
                            '<span class="ct-goal-count-curr">' + alert.current + '</span>' +
                            '<span class="ct-intel-delta">(' + (alert.absoluteDiff > 0 ? '+' : '') + alert.absoluteDiff + ' / ' + alert.percentDiff + ')</span>' +
                        '</div>' +
                        (alert.message ? '<div class="ct-intel-msg-row">' + escapeHtml(alert.message) + '</div>' : '') +
                    '</div>' +
                    '<div class="ct-goal-card-actions">' +
                        (alert.severity === "critical" || alert.severity === "warning" || alert.direction === "INCREASE" || alert.direction === "DECREASE"
                            ? '<button type="button" class="ct-alert-btn ct-alert-btn-primary" data-intel-action="focus" data-target="' + escapeHtml(alert.targetId || alert.campaignId || alert.targetName || "") + '">FOCUS</button>' +
                              '<button type="button" class="ct-alert-btn ct-alert-btn-dismiss" data-intel-action="dismiss" data-intel-id="' + escapeHtml(alert.id) + '">DISMISS</button>'
                            : '<span class="ct-intel-auto-tag" title="Updates automatically with live CallTools observations">AUTO-UPDATING</span>') +
                    '</div>' +
                '</div>';
            }).join("");

            const activeGoalCards = activePersistent.map(function (alert) {
                const dialerClass = "ct-dialer-" + String(alert.dialer || DIALER).toLowerCase().replace(/[^a-z0-9]/g, "");
                return '<div class="ct-persistent-goal-card" data-goal-id="' + escapeHtml(alert.id) + '">' +
                    '<div class="ct-goal-card-top">' +
                        '<span class="ct-goal-badge">NEW ' + escapeHtml(alert.metric.toUpperCase()) + ' DETECTED</span>' +
                        '<span class="ct-dialer-tag ' + dialerClass + '">' + escapeHtml(alert.dialer) + '</span>' +
                        '<span class="ct-goal-direction-tag">' + escapeHtml(alert.direction) + '</span>' +
                        '<span class="ct-goal-time">' + escapeHtml(alert.detectedAt) + '</span>' +
                    '</div>' +
                    '<div class="ct-goal-card-body">' +
                        '<div class="ct-goal-target-name"><strong>' + escapeHtml(alert.targetName) + '</strong></div>' +
                        '<div class="ct-goal-stat-row">' +
                            '<span class="ct-goal-metric-label">' + escapeHtml(alert.metric) + ':</span>' +
                            '<span class="ct-goal-count-prev">' + formatNumber(alert.previous) + '</span>' +
                            '<span class="ct-goal-arrow">→</span>' +
                            '<span class="ct-goal-count-curr">' + formatNumber(alert.current) + '</span>' +
                            '<span class="ct-goal-increase">(+' + formatNumber(alert.increase) + ')</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="ct-goal-card-actions">' +
                        '<button type="button" class="ct-btn ct-btn-noted" data-noted-id="' + escapeHtml(alert.id) + '" title="Acknowledge this goal alert">NOTED</button>' +
                    '</div>' +
                '</div>';
            }).join("");

            const persistentSig = activeIntelCards + "::" + activeGoalCards;
            if (refs.persistentGoalsContainer.dataset.signature !== persistentSig) {
                refs.persistentGoalsContainer.innerHTML = activeIntelCards + activeGoalCards;
                refs.persistentGoalsContainer.dataset.signature = persistentSig;
            }
        }
        const unackIntelCount = (intelligenceEngine ? intelligenceEngine.activeAlerts : []).filter(function (a) {
            return !a.acknowledged && a.category !== "SALES_GOAL";
        }).length;
        const totalActiveSignals = alerts.length + unackIntelCount + (state.persistentGoalAlerts || []).filter(function (a) {
            return !state.acknowledgedGoalAlerts.has(a.id);
        }).length;
        setText(refs.alertSubtitle, totalActiveSignals ? "Immediate operator actions" : "Live monitoring · no intervention required");
        if (refs.alertCount) setText(refs.alertCount, totalActiveSignals + (totalActiveSignals === 1 ? " ACTIVE SIGNAL" : " ACTIVE SIGNALS"));
        const signature = alerts.map(function (a) { return [a.conditionKey, a.severity, a.message, a.action].join("|"); }).join("::");
        if (signature === refs.alerts.dataset.signature) return;
        refs.alerts.dataset.signature = signature;
        refs.alerts.textContent = "";
        if (!alerts.length) {
            const empty = document.createElement("div");
            empty.className = "ct-all-clear";
            empty.innerHTML = '<div class="ct-all-clear-icon">✓</div><div><strong>ALL CLEAR</strong><span>No critical or at-risk condition is active right now.</span></div><span class="ct-all-clear-live">MONITORING</span>';
            refs.alerts.appendChild(empty);
            return;
        }
        const fragment = document.createDocumentFragment();
        alerts.slice(0, MAX_ALERTS).forEach(function (a) {
            const item = document.createElement("div");
            item.className = "ct-alert is-" + a.severity;
            item.dataset.conditionKey = a.conditionKey;
            const campaignId = a.campaignId && !String(a.campaignId).startsWith("operational:") ? String(a.campaignId).trim().toLowerCase() : String(a.name || "").trim().toLowerCase();
            const sourceAlert = String(a.conditionKey || "").startsWith("SOURCE_");
            const inboundAlert = String(a.conditionKey || "").startsWith("INBOUND:");
            const campaignIsOperating = !sourceAlert && !inboundAlert && (state.operatingCampaigns || []).map(function (id) { return String(id || "").trim().toLowerCase(); }).includes(campaignId);
            const actionLabel = sourceAlert ? "REFRESH" : inboundAlert ? "VIEW QUEUE" : campaignIsOperating ? "FOCUS" : "OPERATE";
            const actionType = sourceAlert ? "refresh" : inboundAlert ? "inbound-focus" : campaignIsOperating ? "focus" : "operate";
            const secondary = sourceAlert || inboundAlert || campaignIsOperating ? "" : '<button type="button" class="ct-alert-btn ct-alert-btn-secondary" data-alert-action="focus" data-campaign="' + escapeHtml(campaignId) + '">FOCUS</button>';
            item.innerHTML = '<div class="ct-alert-main"><div class="ct-alert-top"><div class="ct-alert-campaign"><span class="ct-alert-priority">' + escapeHtml(a.label || (a.severity === "critical" ? "ACTION NOW" : "WATCH")) + '</span>' + escapeHtml(a.name) + '</div><span class="ct-alert-severity">' + escapeHtml(a.severity === "critical" ? "CRITICAL" : "AT RISK") + '</span></div><div class="ct-alert-why">' + escapeHtml(a.message) + '</div><div class="ct-alert-action">' + escapeHtml(a.action || "Review the condition.") + '</div></div><div class="ct-alert-buttons"><button type="button" class="ct-alert-btn ct-alert-btn-primary" data-alert-action="' + actionType + '" data-campaign="' + escapeHtml(campaignId) + '">' + actionLabel + '</button>' + secondary + '<button type="button" class="ct-alert-btn ct-alert-btn-dismiss" data-alert-action="dismiss">DISMISS</button></div>';
            fragment.appendChild(item);
        });
        refs.alerts.appendChild(fragment);
    }

    function renderOrderEditor() {
        if (!refs.orderEditorList || !state.reorderMode) return;
        const prepared = prepareCampaigns(state.campaigns);
        const byId = new Map(prepared.map(function (campaign) { return [campaign.__id, campaign]; }));
        const sourceIds = prepared.map(function (campaign) { return campaign.__id; });
        const order = normalizePinnedOrder(state.manualOrder, prepared, sourceIds);
        state.manualOrder = order.slice();
        const fragment = document.createDocumentFragment();
        order.forEach(function (id, index) {
            const campaign = byId.get(id);
            if (!campaign) return;
            const row = document.createElement("div");
            row.className = "ct-order-editor-row";
            row.dataset.orderId = id;
            row.innerHTML = '<span class="ct-order-editor-number">' + (index + 1) + '</span>' +
                '<span class="ct-order-editor-drag" aria-hidden="true">⋮⋮</span>' +
                '<div class="ct-order-editor-name"><b>' + escapeHtml(safeValue(campaign.name, "Unnamed Campaign")) + '</b><small>' + escapeHtml(campaign.__active === true ? "ACTIVE" : campaign.__active === false ? "INACTIVE" : "STATUS UNVERIFIED") + ' · ' + formatNumber(campaign.__loggedIn) + ' agents · ' + formatNumber(campaign.__waiting) + ' waiting</small></div>' +
                '<span class="ct-order-editor-state ' + (campaign.__active === true ? 'is-live' : campaign.__active === false ? 'is-inactive' : 'is-check') + '">' + escapeHtml(campaign.__active === true ? 'LIVE' : campaign.__active === false ? 'INACTIVE' : 'CHECK') + '</span>' +
                '<div class="ct-order-editor-move"><button type="button" data-order-action="up" aria-label="Move ' + escapeHtml(campaign.name) + ' up" ' + (index === 0 ? 'disabled' : '') + '>↑</button><button type="button" data-order-action="down" aria-label="Move ' + escapeHtml(campaign.name) + ' down" ' + (index === order.length - 1 ? 'disabled' : '') + '>↓</button></div>';
            fragment.appendChild(row);
        });
        refs.orderEditorList.replaceChildren(fragment);
    }

    function updateCampaignList(campaigns) {
        const nextIds = campaigns.map(function (campaign) {
            return campaign.__id;
        });
        const nextIdSet = new Set(nextIds);

        if (!campaigns.length) {
            refs.list.textContent = "";
            refs.list.appendChild(emptyState(state.campaigns.length ? "No campaigns match the current search." : "Waiting for CallTools campaign data."));
            state.visibleIds = [];
            return;
        }

        const empty = refs.list.querySelector(".ct-empty");
        if (empty) empty.remove();

        campaigns.forEach(function (campaign) {
            const card = getCampaignCard(campaign);
            updateCampaignCard(card, campaign);
            refs.list.appendChild(card.node);
        });

        cardCache.forEach(function (card, id) {
            if (!nextIdSet.has(id)) {
                card.node.remove();
                cardCache.delete(id);
            }
        });

        state.visibleIds = nextIds;
        refreshOrderNumbers();
    }

    function getCampaignCard(campaign) {
        const cached = cardCache.get(campaign.__id);

        if (cached) {
            return cached;
        }

        const node = document.createElement("article");
        node.className = "ct-card";
        node.dataset.id = campaign.__id;
        node.innerHTML = `
            <div class="ct-card-head" role="button" tabindex="0" aria-expanded="false">
                <div class="ct-row-cell ct-row-order"><span class="ct-drag-handle" draggable="false" title="Drag to reorder" aria-label="Drag to reorder">⋮⋮</span><span class="ct-order-number" data-field="orderNumber">#</span></div>
                <div class="ct-row-cell ct-name-cell"><div class="ct-name-wrap"><div class="ct-name" data-field="name"></div><div class="ct-meta"><span data-field="metaLoggedIn"></span><span data-field="metaWaiting"></span><span data-field="metaOnCall"></span></div></div></div>
                <div class="ct-row-cell"><span class="ct-badge" data-field="health"></span></div>
                <div class="ct-row-cell"><span class="ct-row-value" data-field="agents"></span></div>
                <div class="ct-row-cell"><span class="ct-row-value" data-field="waiting"></span></div>
                <div class="ct-row-cell"><span class="ct-row-value" data-field="onCall"></span></div>
                <div class="ct-row-cell"><span class="ct-row-value" data-field="waitPill"></span></div>
                <div class="ct-row-cell"><span class="ct-row-value" data-field="liveLeads"></span></div>
                <div class="ct-row-cell"><span class="ct-row-value" data-field="connected"></span></div>
                <div class="ct-row-cell"><span class="ct-row-value" data-field="attempts"></span></div>
                <div class="ct-row-cell"><span class="ct-row-value" data-field="abandoned"></span></div>
                <div class="ct-row-cell"><span class="ct-row-value" data-field="runway"></span></div>
                <div class="ct-row-cell ct-row-actions">
                    <button type="button" class="ct-row-action" data-row-action="focus" title="Focus campaign" aria-label="Focus campaign">◎</button>
                    <button type="button" class="ct-row-action ct-details-action" data-row-action="details" title="Expand campaign details" aria-label="Expand campaign details">EXPAND</button>
                    <button type="button" class="ct-row-action" data-row-action="operate" title="Toggle operating campaign" aria-label="Toggle operating campaign">⚙</button>
                </div>
            </div>
            <div class="ct-details-label">Detailed campaign metrics</div>
            <div class="ct-grid">
                ${METRICS.map(metricShell).join("")}
            </div>
        `;

        const card = {
            node: node,
            collapsed: true,
            fields: {
                name: node.querySelector('[data-field="name"]'),
                orderNumber: node.querySelector('[data-field="orderNumber"]'),
                dragHandle: node.querySelector('.ct-drag-handle'),
                metaLoggedIn: node.querySelector('[data-field="metaLoggedIn"]'),
                metaWaiting: node.querySelector('[data-field="metaWaiting"]'),
                metaOnCall: node.querySelector('[data-field="metaOnCall"]'),
                health: node.querySelector('[data-field="health"]'),
                liveLeads: node.querySelector('[data-field="liveLeads"]'),
                waiting: node.querySelector('[data-field="waiting"]'),
                onCall: node.querySelector('[data-field="onCall"]'),
                waitPill: node.querySelector('[data-field="waitPill"]'),
                abandoned: node.querySelector('[data-field="abandoned"]'),
                connected: node.querySelector('[data-field="connected"]'),
                runway: node.querySelector('[data-field="runway"]'),
                agents: node.querySelector('[data-field="agents"]'),
                attempts: node.querySelector('[data-field="attempts"]')
            },
            metrics: {}
        };

        METRICS.forEach(function (metric) {
            card.metrics[metric.key] = {
                value: node.querySelector(`[data-metric="${metric.key}"] .ct-value-text`),
                trend: node.querySelector(`[data-metric="${metric.key}"] .ct-trend`)
            };
        });

        cardCache.set(campaign.__id, card);

        return card;
    }

    function updateCampaignCard(card, campaign) {
        const healthClass = "is-" + campaign.__health;
        const waitClassName = "is-" + waitHealth(campaign.__wait, campaign.__waiting);

        setClass(card.node, "ct-card " + healthClass + ((card.collapsed || state.allCollapsed) ? " is-collapsed" : ""));
        card.node.dataset.health = campaign.__health;
        // Preferred campaigns are ordered first only on initial/reset order.
        // They are NOT locked: every visible campaign remains movable while
        // Order mode is enabled.
        if (card.fields.dragHandle) {
            card.fields.dragHandle.draggable = false;
            card.fields.dragHandle.setAttribute("draggable", "false");
            card.fields.dragHandle.setAttribute("aria-disabled", String(!state.reorderMode));
            card.fields.dragHandle.classList.remove("is-pinned");
            card.fields.dragHandle.title = "Drag to reorder";
            card.fields.dragHandle.setAttribute("aria-label", "Drag to reorder");
        }
        card.node.classList.toggle("is-operating", (state.operatingCampaigns || []).includes(campaign.__id));
        card.node.classList.toggle("is-data-check", Boolean(campaign.__dataCheck));
        setText(card.fields.name, safeValue(campaign.name, "Unnamed Campaign"));
        card.fields.name.title = safeValue(campaign.name, "Unnamed Campaign");
        setText(card.fields.metaLoggedIn, campaign.__loggedInAvailable ? `${formatNumber(campaign.__loggedIn)} total agents` : `Agents: N/A in table`);
        setText(card.fields.metaWaiting, campaign.__waitingAvailable ? `${formatNumber(campaign.__waiting)} waiting` : `Waiting: N/A`);
        setText(card.fields.metaOnCall, `${campaign.__onCallAvailable ? formatNumber(campaign.__onCall) + " on call · " : ""}${campaign.__active === false ? "INACTIVE" : campaign.__active === null ? "STATUS UNVERIFIED" : "ACTIVE"}`);
        setText(card.fields.health, campaign.__dataCheck ? "DATA CHECK" : campaign.__active === true ? HEALTH[campaign.__health].label : campaign.__active === false ? "INACTIVE" : "DATA CHECK");
        setClass(card.fields.health, "ct-badge " + (campaign.__dataCheck ? "is-warning" : campaign.__active === true ? healthClass : campaign.__active === false ? "is-inactive" : "is-warning"));
        setText(card.fields.liveLeads, formatNumber(campaign.__contacts));
        setClass(card.fields.liveLeads, "ct-row-value " + (campaign.__active !== true ? "" : campaign.__contacts <= state.contactThreshold ? "is-warning" : "is-good"));
        setText(card.fields.waiting, campaign.__waitingAvailable ? formatNumber(campaign.__waiting) : "—");
        setClass(card.fields.waiting, "ct-row-value " + (campaign.__waitingAvailable && campaign.__waiting > 0 ? "is-warning" : "is-good"));
        setText(card.fields.onCall, campaign.__onCallAvailable ? formatNumber(campaign.__onCall) : "—");
        setClass(card.fields.onCall, "ct-row-value is-info");
        setText(card.fields.waitPill, `${campaign.__wait}s`);
        setClass(card.fields.waitPill, "ct-row-value " + waitClassName);
        setText(card.fields.abandoned, formatNumber(campaign.__abandoned));
        const cardAbandonRate = campaign.__outbound > 0 ? (campaign.__abandoned / campaign.__outbound) * 100 : 0;
        setClass(card.fields.abandoned, "ct-row-value " + (campaign.__abandoned >= 500 || cardAbandonRate >= 5 ? "is-critical" : cardAbandonRate >= 2 ? "is-warning" : "is-good"));
        setText(card.fields.connected, String(campaign.human ?? "").trim() === "" ? "—" : formatNumber(campaign.__human));
        card.fields.connected.title = String(campaign.human ?? "").trim() === "" ? "CallTools Human field unavailable" : (campaign.__outbound > 0 ? ((campaign.__human / campaign.__outbound) * 100).toFixed(2) + "% human connect rate" : "0.00% human connect rate");
        setClass(card.fields.connected, "ct-row-value is-info");
        const runway = estimateCampaignRunway(campaign);
        setText(card.fields.runway, runway.label);
        setClass(card.fields.runway, "ct-row-value " + runway.tone);
        setText(card.fields.agents, campaign.__loggedInAvailable ? `${formatNumber(campaign.__loggedIn)}` : "—");
        card.fields.agents.title = campaign.__loggedInAvailable ? "Native CallTools Logged In agents count" : "Agent count not exposed in CallTools Campaigns table";
        setClass(card.fields.agents, "ct-row-value " + (campaign.__loggedInAvailable && campaign.__loggedIn === 0 && campaign.__active === true && campaign.__waiting > 0 ? "is-critical" : "is-info"));
        setText(card.fields.attempts, formatNumber(campaign.__outbound));
        setClass(card.fields.attempts, "ct-row-value");
        const head = card.node.querySelector('.ct-card-head');
        if (head) head.setAttribute('aria-expanded', String(!card.collapsed && !state.allCollapsed));
        const detailsAction = card.node.querySelector('.ct-details-action');
        if (detailsAction) {
            const expanded = !card.collapsed && !state.allCollapsed;
            detailsAction.textContent = expanded ? "COLLAPSE" : "EXPAND";
            detailsAction.title = expanded ? "Collapse campaign details" : "Expand campaign details";
            detailsAction.setAttribute("aria-label", expanded ? "Collapse campaign details" : "Expand campaign details");
        }

        METRICS.forEach(function (metric) {
            const refsForMetric = card.metrics[metric.key];
            const value = safeValue(campaign[metric.key], metric.key === "contacts" || metric.key === "channels" ? "0" : EMPTY);
            const tone = metricTone(metric, campaign, value);

            setText(refsForMetric.value, value);
            setClass(refsForMetric.value, "ct-value-text " + tone);

            if (refsForMetric.trend) {
                setText(refsForMetric.trend, metric.trend ? trendSymbol(campaign, metric.key) : "");
                setClass(refsForMetric.trend, "ct-trend " + trendTone(campaign, metric.key));
            }
        });
    }

    function prepareCampaigns(campaigns) {
        return campaigns.map(function (campaign, index) {
            const prepared = Object.assign({}, campaign || {});

            prepared.__index = index;
            prepared.__id = campaignId(prepared, index);
            prepared.__previous = state.previousById.get(prepared.__id) || null;
            prepared.__wait = numberValue(prepared.waitNow);
            prepared.__waitToday = numberValue(prepared.waitToday);
            prepared.__contacts = numberValue(prepared.contacts);
            prepared.__abandoned = abandonedCount(prepared.abandoned);
            prepared.__failed = numberValue(prepared.failed);
            prepared.__loggedInAvailable = prepared.loggedIn !== null && prepared.loggedIn !== undefined && String(prepared.loggedIn).trim() !== "";
            prepared.__loggedIn = prepared.__loggedInAvailable ? numberValue(prepared.loggedIn) : null;
            prepared.__waitingAvailable = prepared.waiting !== null && prepared.waiting !== undefined && String(prepared.waiting).trim() !== "";
            prepared.__waiting = prepared.__waitingAvailable ? numberValue(prepared.waiting) : null;
            prepared.__onCallAvailable = prepared.onCall !== null && prepared.onCall !== undefined && String(prepared.onCall).trim() !== "";
            prepared.__onCall = prepared.__onCallAvailable ? numberValue(prepared.onCall) : null;
            prepared.__outbound = numberValue(prepared.outbound);
            prepared.__human = numberValue(prepared.human);
            prepared.__agentConnect = numberValue(prepared.agentConnect);
            prepared.__goalsAvailable = prepared.goals !== null && prepared.goals !== undefined && String(prepared.goals).trim() !== "";
            prepared.__goals = prepared.__goalsAvailable ? numberValue(prepared.goals) : null;
            prepared.__active = resolveActiveState(prepared);
            prepared.__operational = prepared.__active === true;
            // A campaign is a Data Check item when CallTools has not verified
            // the active state or the feed itself is not currently LIVE.
            // This is derived from existing parser/content status only; no
            // synthetic campaign data is introduced.
            prepared.__integrityIssue = hasCampaignDataIntegrityIssue(prepared);
            prepared.__dataCheck = prepared.__active === null || state.sourceState !== "LIVE" || prepared.__integrityIssue;
            prepared.__score = prepared.__operational ? healthScore(prepared) : 100;
            prepared.__health = prepared.__operational ? scoreHealth(prepared.__score) : "excellent";

            return prepared;
        });
    }

    function orderCampaigns(campaigns) {
        const byId = new Map();
        campaigns.forEach(function (campaign) { byId.set(campaign.__id, campaign); });
        const sourceIds = campaigns.map(function (campaign) { return campaign.__id; });
        const order = normalizePinnedOrder(state.manualOrder, campaigns, sourceIds);
        state.manualOrder = order.slice();
        state.sortedIds = order.slice();
        persistCampaignOrder();
        return order.map(function (id) { return byId.get(id); }).filter(Boolean);
    }

    function isPinnedCampaignId(id) {
        const normalized = String(id || "").toLowerCase();
        return PINNED_ORDER.some(function (name) { return name.toLowerCase() === normalized; });
    }

    function defaultCampaignOrder(campaigns, sourceIds) {
        const valid = new Set((campaigns || []).map(function (c, index) { return c.__id || campaignId(c, index); }));
        const available = Array.from(valid);
        const pinned = PINNED_ORDER.map(function (name) {
            const id = name.toLowerCase();
            return valid.has(id) ? id : null;
        }).filter(Boolean);
        const seen = new Set(pinned);
        const rest = [];
        (sourceIds || available).forEach(function (id) {
            if (!seen.has(id)) { seen.add(id); rest.push(id); }
        });
        return pinned.concat(rest);
    }

    function normalizePinnedOrder(order, campaigns, sourceIds) {
        const valid = new Set((campaigns || []).map(function (c, index) { return c.__id || campaignId(c, index); }));
        const available = Array.from(valid);
        const input = Array.isArray(order) ? order.filter(function (id) { return valid.has(id); }) : [];

        // HARD RULE: once an operator has an order, it is authoritative.
        // The old implementation re-pinned the first three campaigns on every
        // render, which made drag-and-drop appear to work and then immediately
        // snap back. Only use the preferred pinned order when no saved order
        // exists (first initialization).
        if (!input.length) return defaultCampaignOrder(campaigns, sourceIds || available);

        const seen = new Set();
        const result = [];
        input.forEach(function (id) {
            if (!seen.has(id)) { seen.add(id); result.push(id); }
        });
        (sourceIds || available).forEach(function (id) {
            if (!seen.has(id)) { seen.add(id); result.push(id); }
        });
        return result;
    }

    function compareCampaigns(a, b) {
        return campaignPriority(b) - campaignPriority(a) ||
            HEALTH[a.__health].rank - HEALTH[b.__health].rank ||
            b.__wait - a.__wait ||
            b.__abandoned - a.__abandoned ||
            String(a.name || "").localeCompare(String(b.name || "")) ||
            a.__index - b.__index;
    }

    function campaignPriority(campaign) {
        let priority = 0;

        if (campaign.__health === "critical") {
            priority += 1000;
        } else if (campaign.__health === "warning") {
            priority += 600;
        }

        priority += Math.min(250, campaign.__wait * 3);
        priority += Math.min(160, campaign.__waiting * 22);

        if (campaign.__loggedIn === 0 && (campaign.__waiting > 0 || campaign.__wait >= 30)) {
            priority += 260;
        } else if (campaign.__loggedIn > 0 && campaign.__onCall >= campaign.__loggedIn && campaign.__waiting > 0) {
            priority += 180;
        }

        priority += Math.min(120, campaign.__abandoned * 8);

        return priority;
    }

    function filterCampaigns(campaigns) {
        const needle = state.query.trim().toLowerCase();

        return campaigns.filter(function (campaign) {
            if (state.stateFilter === "active" && !campaign.__active) return false;
            if (state.stateFilter === "inactive" && campaign.__active) return false;

            if (state.filter === "critical" && campaign.__health !== "critical") {
                return false;
            }

            if (state.filter === "warning" && campaign.__health !== "warning") {
                return false;
            }

            if (state.filter === "healthy" && campaign.__health !== "good" && campaign.__health !== "excellent") return false;
            if (state.filter === "data" && !campaign.__dataCheck) return false;
            return !needle || String(campaign.name || "").toLowerCase().includes(needle);
        });
    }

    function summarize(campaigns) {
        const stats = {
            campaigns: campaigns,
            total: campaigns.filter(function (campaign) { return campaign.__active === true; }).length,
            visibleTotal: campaigns.length,
            excellent: 0,
            good: 0,
            warning: 0,
            critical: 0,
            loggedIn: 0,
            loggedInAvailable: false,
            waiting: 0,
            waitingAvailable: false,
            onCall: 0,
            onCallAvailable: false,
            contacts: 0,
            outbound: 0,
            connected: 0,
            waitTotal: 0,
            averageWait: 0,
            utilization: 0,
            highestWait: null,
            highestAbandoned: null,
            abandonmentTotal: 0,
            goals: 0,
            goalsAvailable: false,
            integrityIssues: 0,
            realtimeShared: false,
            realtimePool: 0
        };

        const realtime = campaigns.filter(function (campaign) { return campaign.__operational && /^realtime\b/i.test(String(campaign.name || "")); });
        const realtimeValues = realtime.map(function (campaign) { return campaign.__contacts; });
        const realtimeSamePool = realtime.length > 1 && realtimeValues.every(function (value) { return value === realtimeValues[0]; });
        stats.realtimeShared = realtimeSamePool;
        stats.realtimePool = realtimeSamePool ? realtimeValues[0] : 0;
        stats.realtimePoolMismatch = realtime.length > 1 && !realtimeSamePool;

        campaigns.forEach(function (campaign) {
            if (!campaign.__operational) return;
            stats[campaign.__health] += 1;
            if (campaign.__loggedInAvailable) {
                stats.loggedInAvailable = true;
                stats.loggedIn += campaign.__loggedIn;
            }
            if (campaign.__waitingAvailable) {
                stats.waitingAvailable = true;
                stats.waiting += campaign.__waiting;
            }
            if (campaign.__onCallAvailable) {
                stats.onCallAvailable = true;
                stats.onCall += campaign.__onCall;
            }
            stats.contacts += campaign.__contacts;
            stats.outbound += campaign.__outbound;
            stats.connected += campaign.__human;
            if (campaign.__integrityIssue) stats.integrityIssues += 1;
            stats.waitTotal += campaign.__wait;
            stats.abandonmentTotal += campaign.__abandoned;
            if (campaign.__goalsAvailable) { stats.goalsAvailable = true; stats.goals += campaign.__goals; }

            if (!stats.highestWait || campaign.__wait > stats.highestWait.__wait) {
                stats.highestWait = campaign;
            }

            if (!stats.highestAbandoned || campaign.__abandoned > stats.highestAbandoned.__abandoned) {
                stats.highestAbandoned = campaign;
            }
        });

        if (stats.realtimeShared) {
            const realtimeSum = realtime.reduce(function (sum, campaign) { return sum + campaign.__contacts; }, 0);
            stats.contacts = Math.max(0, stats.contacts - realtimeSum + stats.realtimePool);
        }

        stats.averageWait = stats.total ? Math.round(stats.waitTotal / stats.total) : 0;
        stats.utilization = stats.loggedInAvailable ? utilizationPercent(stats.loggedIn, stats.onCall) : 0;

        let allOutbound = 0;
        let allHuman = 0;
        let allToAgents = 0;
        let allContacts = 0;
        (campaigns || []).forEach(function (c) {
            allOutbound += (c.__outbound || 0);
            allHuman += (c.__human || 0);
            allToAgents += (c.__agentConnect || 0);
            allContacts += (c.__contacts || 0);
        });
        stats.allOutbound = allOutbound;
        stats.allHuman = allHuman;
        stats.allToAgents = allToAgents;
        stats.allContacts = allContacts;

        return stats;
    }

    function alert(id, name, severity, message) {
        const conditionKey = id + ":" + severity + ":" + message.split(":")[0];
        const signature = severity + "|" + message;
        const dismissed = state.dismissedConditions.get(conditionKey);
        if (dismissed && dismissed === signature) return null;
        return {
            id: id,
            conditionKey: conditionKey,
            signature: signature,
            name: name,
            severity: severity,
            label: severity === "critical" ? "Critical" : "Warning",
            message: message,
            createdAt: Date.now()
        };
    }

    function normalizeForAlert(campaign) {
        return {
            waitNow: numberValue(campaign.waitNow),
            loggedIn: numberValue(campaign.loggedIn),
            waiting: numberValue(campaign.waiting),
            onCall: numberValue(campaign.onCall),
            health: scoreHealth({
                __wait: numberValue(campaign.waitNow),
                __loggedIn: numberValue(campaign.loggedIn),
                __waiting: numberValue(campaign.waiting),
                __abandoned: abandonedCount(campaign.abandoned),
                __failed: numberValue(campaign.failed),
                __contacts: numberValue(campaign.contacts)
            }) < 50 ? "critical" : "stable"
        };
    }

    function hasCampaignDataIntegrityIssue(campaign) {
        const outbound = numberValue(campaign.outbound);
        const human = numberValue(campaign.human);
        const agentConnect = numberValue(campaign.agentConnect);
        const abandoned = abandonedCount(campaign.abandoned);
        const contacts = numberValue(campaign.contacts);
        const required = [campaign.contacts, campaign.outbound, campaign.human];
        if (required.some(function (value) { return String(value ?? "").trim() === ""; })) return true;
        if (outbound < 0 || human < 0 || abandoned < 0 || contacts < 0) return true;
        if (human > outbound || abandoned > outbound) return true;
        if (campaign.__loggedInAvailable && campaign.__onCallAvailable && campaign.__onCall > campaign.__loggedIn) return true;
        return false;
    }

    function resolveActiveState(campaign) {
        if (typeof campaign.active === "boolean") return campaign.active;
        if (typeof campaign.isActive === "boolean") return campaign.isActive;
        const status = String(campaign.active ?? campaign.status ?? "").trim().toLowerCase();
        if (["active", "on", "true", "1", "enabled"].includes(status)) return true;
        if (["inactive", "off", "false", "0", "disabled"].includes(status)) return false;
        return null;
    }

    function healthScore(campaign) {
        // Health is an operational signal, not a penalty counter. Do not mark an
        // active campaign critical merely because it has zero agents, zero waiting,
        // or a small historical abandoned count. Severity must agree with the
        // Action Center's operator-facing conditions.
        if (campaign.__dataCheck || campaign.__active === null) return 35;
        if (campaign.__active !== true) return 100;

        const wait = campaign.__wait;
        const waiting = campaign.__waitingAvailable ? campaign.__waiting : 0;
        const loggedIn = campaign.__loggedInAvailable ? campaign.__loggedIn : 1;
        const onCall = campaign.__onCallAvailable ? campaign.__onCall : 0;
        const leads = campaign.__contacts;
        const outbound = campaign.__outbound;
        const abandoned = campaign.__abandoned;
        const abandonRate = outbound > 0 ? (abandoned / outbound) * 100 : 0;

        // Critical only for conditions that represent an immediate operational
        // problem and are also surfaced as critical Action Center conditions.
        if ((campaign.__waitingAvailable && campaign.__loggedInAvailable && waiting > 0 && loggedIn === 0) ||
            (wait >= 60) ||
            leads === 0 ||
            abandoned >= 500 ||
            abandonRate >= 5) return 35;

        // Warning conditions mirror the Action Center's non-critical pressure
        // signals. A low abandoned count alone is informational, not unhealthy.
        if ((wait >= 30) ||
            (campaign.__waitingAvailable && campaign.__loggedInAvailable && waiting >= 5 && loggedIn > 0 && onCall >= loggedIn) ||
            (state.contactThreshold > 0 && leads <= state.contactThreshold) ||
            (abandoned > 0 && abandonRate >= 2)) return 65;

        return 92;
    }

    function scoreHealth(score) {
        if (score < 50) {
            return "critical";
        }

        if (score < 70) {
            return "warning";
        }

        if (score < 90) {
            return "good";
        }

        return "excellent";
    }

    function waitHealth(wait, waiting) {
        if (numberValue(waiting) <= 0) return "healthy";
        if (wait >= 60) {
            return "critical";
        }

        if (wait >= 30) {
            return "warning";
        }

        return "healthy";
    }

    function metricTone(metric, campaign, value) {
        if (metric.key === "waitNow") {
            return "is-" + waitHealth(campaign.__wait, campaign.__waiting);
        }

        if ((metric.key === "abandoned" || metric.key === "failed") && numberValue(value) > 0) {
            return "is-critical";
        }

        if (metric.key === "waiting" && campaign.__waiting > 0) {
            return "is-excellent";
        }

        if (metric.key === "loggedIn" && campaign.__loggedIn === 0 && campaign.__active === true && campaign.__waiting > 0) {
            return "is-critical";
        }

        if (metric.key === "contacts" && campaign.__active === true && campaign.__contacts <= state.contactThreshold) {
            return "is-warning";
        }

        return "";
    }

    function trendSymbol(campaign, key) {
        const previous = campaign.__previous;

        if (!previous || !TREND_KEYS.includes(key)) {
            return "\u2192";
        }

        const currentValue = comparableValue(campaign, key);
        const previousValue = comparableValue(previous, key);

        if (currentValue > previousValue) {
            return "\u2191";
        }

        if (currentValue < previousValue) {
            return "\u2193";
        }

        return "\u2192";
    }

    function trendTone(campaign, key) {
        const symbol = trendSymbol(campaign, key);

        if (symbol === "\u2192") {
            return "";
        }

        const higherIsBad = key === "waitNow" || key === "abandoned";

        if ((symbol === "\u2191" && higherIsBad) || (symbol === "\u2193" && !higherIsBad)) {
            return "is-critical";
        }

        return "is-excellent";
    }

    function comparableValue(campaign, key) {
        if (key === "abandoned") {
            return abandonedCount(campaign.abandoned);
        }

        return numberValue(campaign[key]);
    }

    function queueDataSignature(queues) {
        return (queues || []).map(function(q, i) {
            return [q.id || q.name || "queue-" + i, q.name, q.callsTodayTotal, q.callsTodayAnswered, q.callsTodayNotAnswered, q.inboundMachine, q.inboundNoAnswer, q.loggedIn, q.onQueueCalls, q.callsNowTotal, q.waiting, q.callsNowAnswered, q.waitAverage, q.waitMax, q.calendarEvents, q.opportunities, q.goals].map(function(v){ return String(v ?? ""); }).join("~");
        }).sort().join("||");
    }

    function snapshotQueuesById(queues) {
        const map = new Map();
        (queues || []).forEach(function(q, i) { map.set(queueId(q, i), Object.assign({}, q || {})); });
        return map;
    }

    function queueId(queue, index) {
        const id = String(queue && (queue.id || queue.name) || "").trim();
        return id || "queue-" + index;
    }

    function isArchivedQueue(queue) {
        return /\barchived\b/i.test(String(queue && queue.name || ""));
    }

    function queueNumber(queue, key) { return numberValue(queue && queue[key]); }

    function dataSignature(campaigns) {
        return campaigns.map(function (campaign, index) {
            const c = campaign || {};
            return [
                campaignId(c, index),
                c.active, c.status, c.contacts, c.waitNow, c.waiting, c.onCall,
                c.loggedIn, c.outbound, c.abandoned, c.human, c.machine, c.agentConnect,
                c.noAnswer, c.busy, c.failed, c.postCall, c.goals
            ].map(function (value) { return String(value ?? ""); }).join("~");
        }).sort().join("||");
    }

    function formatAge(seconds) {
        const n = Math.max(0, Number(seconds) || 0);
        if (n < 60) return n + "s";
        const m = Math.floor(n / 60);
        const s = n % 60;
        if (m < 60) return m + "m " + s + "s";
        const h = Math.floor(m / 60);
        return h + "h " + (m % 60) + "m";
    }

    function snapshotById(campaigns) {
        const map = new Map();

        campaigns.forEach(function (campaign, index) {
            map.set(campaignId(campaign || {}, index), Object.assign({}, campaign || {}));
        });

        return map;
    }

    function isCampaignSelected(campaign, selectedSet) {
        if (!campaign || !selectedSet || !(selectedSet instanceof Set) || selectedSet.size === 0) return false;
        if (campaign.rawId && selectedSet.has(String(campaign.rawId).trim())) return true;
        if (campaign.id && selectedSet.has(String(campaign.id).trim())) return true;
        if (campaign.__id && selectedSet.has(String(campaign.__id).trim())) return true;
        const name = String(campaign.name || "").trim().toLowerCase();
        if (name && selectedSet.has(name)) return true;
        for (const item of selectedSet) {
            if (name && item.toLowerCase() === name) return true;
            if (campaign.rawId && item === String(campaign.rawId).trim()) return true;
            if (campaign.id && item === String(campaign.id).trim()) return true;
        }
        return false;
    }

    function campaignId(campaign) {
        if (campaign) {
            const rawId = campaign.rawId || campaign.id;
            if (rawId && String(rawId).trim()) {
                return String(rawId).trim();
            }
            if (campaign.__id && String(campaign.__id).trim() && !String(campaign.__id).startsWith("campaign-")) {
                return String(campaign.__id).trim();
            }
            const name = String(campaign.name || "").trim();
            if (name) {
                return name.toLowerCase();
            }
        }
        return "";
    }

    function utilizationPercent(loggedIn, onCall) {
        if (!loggedIn) {
            return 0;
        }

        return Math.max(0, Math.min(100, Math.round((onCall / loggedIn) * 100)));
    }

    function inboundNotAnswered(queue) {
        if (!queue) return null;
        // Strictly use verified native CallTools Not Answered / Inbound No Answer count. Never synthesize from Total - Answered.
        if (queue._metrics && queue._metrics.callsTodayNotAnswered && typeof queue._metrics.callsTodayNotAnswered.value === "number") {
            return queue._metrics.callsTodayNotAnswered.value;
        }
        if (queue._metrics && queue._metrics.inboundNoAnswer && typeof queue._metrics.inboundNoAnswer.value === "number") {
            return queue._metrics.inboundNoAnswer.value;
        }
        if (typeof queue.callsTodayNotAnswered === "number") {
            return queue.callsTodayNotAnswered;
        }
        if (typeof queue.inboundNoAnswer === "number") {
            return queue.inboundNoAnswer;
        }
        if (queue.callsTodayNotAnswered !== undefined && queue.callsTodayNotAnswered !== null && String(queue.callsTodayNotAnswered).trim() !== "") {
            const num = parseFloat(String(queue.callsTodayNotAnswered).replace(/,/g, ""));
            if (Number.isFinite(num)) return num;
        }
        if (queue.inboundNoAnswer !== undefined && queue.inboundNoAnswer !== null && String(queue.inboundNoAnswer).trim() !== "") {
            const num = parseFloat(String(queue.inboundNoAnswer).replace(/,/g, ""));
            if (Number.isFinite(num)) return num;
        }
        return null;
    }

    function updateLiveFilterIntelligence(stats) {
        if (!refs.lfiSection) return;
        let lfi = null;
        if (intelligenceEngine && intelligenceEngine.getLiveFilterIntelligenceSummary) {
            try {
                lfi = intelligenceEngine.getLiveFilterIntelligenceSummary({ campaigns: state.campaigns });
            } catch (e) {
                console.error("Failed to get live filter intelligence summary:", e);
            }
        }
        if (!lfi) return;

        const summary = lfi.summary || {};
        const inventory = lfi.inventory || [];
        const matrix = lfi.assignmentMatrix || [];
        const history = lfi.changeHistory || [];
        const health = lfi.health || {};

        // KPIs (6 Separated Cards)
        if (refs.lfiTotalFilters) setText(refs.lfiTotalFilters, formatNumber(summary.totalFilters));
        if (refs.lfiActiveFilters) setText(refs.lfiActiveFilters, formatNumber(summary.activeFilters));
        const inactiveFilters = (summary.totalFilters !== null && summary.activeFilters !== null) ? Math.max(0, summary.totalFilters - summary.activeFilters) : null;
        if (refs.lfiInactiveFilters) setText(refs.lfiInactiveFilters, formatNumber(inactiveFilters));
        const availContacts = summary.availableContacts !== undefined && summary.availableContacts !== null ? summary.availableContacts : summary.totalContacts;
        if (refs.lfiAvailableContacts) setText(refs.lfiAvailableContacts, formatNumber(availContacts));
        if (refs.lfiRunningCampaigns) setText(refs.lfiRunningCampaigns, formatNumber(summary.runningCampaignsCount));
        if (refs.lfiVerifiedConfigs) setText(refs.lfiVerifiedConfigs, formatNumber(summary.verifiedActiveConfigurations));

        // Subtitles
        if (refs.lfiTotalFiltersSub) setText(refs.lfiTotalFiltersSub, "Known filter inventory");
        if (refs.lfiActiveFiltersSub) setText(refs.lfiActiveFiltersSub, "Active targeting rules");
        if (refs.lfiInactiveFiltersSub) setText(refs.lfiInactiveFiltersSub, "Dormant / disabled rules");
        if (refs.lfiAvailableContactsSub) setText(refs.lfiAvailableContactsSub, "Contacts in matching filters");
        if (refs.lfiRunningCampaignsSub) setText(refs.lfiRunningCampaignsSub, "Active dialer campaigns");
        if (refs.lfiVerifiedConfigsSub) setText(refs.lfiVerifiedConfigsSub, summary.verifiedActiveConfigurations > 0 ? "Targeting verified" : "Pending verification");

        // Freshness Badge
        if (refs.lfiFreshnessBadge) {
            if (health.hasInventory) {
                setText(refs.lfiFreshnessBadge, "INVENTORY: " + summary.totalFilters + " FILTERS (" + health.inventoryFreshness + ")");
                setClass(refs.lfiFreshnessBadge, "ct-lfi-badge is-live");
            } else {
                setText(refs.lfiFreshnessBadge, "INVENTORY: WAITING (/manager/live-filters)");
                setClass(refs.lfiFreshnessBadge, "ct-lfi-badge is-waiting");
            }
        }

        // Inventory Table
        if (refs.lfiInventoryTableBody) {
            if (inventory.length === 0) {
                refs.lfiInventoryTableBody.innerHTML = '<tr><td colspan="7" class="ct-lfi-empty">No inventory observed yet. Open /manager/live-filters in CallTools to discover filters.</td></tr>';
            } else {
                refs.lfiInventoryTableBody.innerHTML = inventory.map(function (f) {
                    const statusClass = f.status === "ACTIVE" ? "is-active" : "is-inactive";
                    const ageSec = f.observedAt ? Math.max(0, Math.floor((Date.now() - f.observedAt) / 1000)) : null;
                    const timeStr = f.observedAt ? new Date(f.observedAt).toLocaleTimeString() : "—";
                    const freshClass = ageSec !== null ? (ageSec < 15 ? "is-live" : ageSec <= 60 ? "is-recent" : "is-stale") : "is-waiting";
                    const freshLabel = ageSec !== null ? (ageSec < 15 ? "LIVE (" + ageSec + "s ago)" : ageSec <= 60 ? "RECENT (" + formatAge(ageSec) + " ago)" : "STALE (" + formatAge(ageSec) + " ago)") : "NOT OBSERVED";
                    return '<tr>' +
                        '<td title="' + escapeHtml(f.name) + '"><strong>' + escapeHtml(f.name) + '</strong></td>' +
                        '<td><span class="ct-lfi-badge ' + statusClass + '">' + escapeHtml(f.status) + '</span></td>' +
                        '<td style="text-align:right;">' + formatNumber(f.count) + '</td>' +
                        '<td style="text-align:right;">' + formatNumber(f.totalCount) + '</td>' +
                        '<td>' + escapeHtml(f.dialer) + '</td>' +
                        '<td>' + escapeHtml(timeStr) + '</td>' +
                        '<td><span class="ct-lfi-badge ' + freshClass + '">' + escapeHtml(freshLabel) + '</span></td>' +
                    '</tr>';
                }).join("");
            }
        }

        // Matrix Table
        if (refs.lfiMatrixTableBody) {
            if (matrix.length === 0) {
                refs.lfiMatrixTableBody.innerHTML = '<tr><td colspan="11" class="ct-lfi-empty">Waiting for campaign data…</td></tr>';
            } else {
                refs.lfiMatrixTableBody.innerHTML = matrix.map(function (m) {
                    const stateClass = m.state === "RUNNING" ? "is-running" : "is-idle";
                    const usageClass = m.usageStatus === "VERIFIED ACTIVE" ? "is-verified-active" :
                                       (m.usageStatus === "STALE" || m.usageStatus === "STALE (ACTIVE)") ? "is-stale" :
                                       m.usageStatus === "UNASSIGNED" ? "is-unassigned" : "is-unknown";
                    const freshClass = m.freshness === "LIVE" ? "is-live" : m.freshness === "RECENT" ? "is-recent" : m.freshness === "STALE" ? "is-stale" : "is-waiting";
                    const freshLabel = m.freshness === "LIVE" ? "LIVE (" + (m.ageSec || 0) + "s ago)" :
                                       m.freshness === "RECENT" ? "RECENT (" + formatAge(m.ageSec) + " ago)" :
                                       m.freshness === "STALE" ? "STALE (" + formatAge(m.ageSec) + " ago)" : "NOT OBSERVED";

                    return '<tr>' +
                        '<td title="' + escapeHtml(m.campaignName) + '"><strong>' + escapeHtml(m.campaignName) + '</strong></td>' +
                        '<td>' + (m.rawId ? escapeHtml(m.rawId) : '<span class="ct-campaign-id-badge is-unverified">Awaiting ID</span>') + '</td>' +
                        '<td><span class="ct-lfi-badge ' + stateClass + '">' + escapeHtml(m.state) + '</span></td>' +
                        '<td style="text-align:right;">' + formatNumber(m.agents) + '</td>' +
                        '<td style="text-align:right;"><span class="ct-lfi-lead-pool" title="Campaign callable lead pool in active dialer queue">' + (m.campaignLeadPool !== "UNAVAILABLE" ? formatNumber(m.campaignLeadPool) : "—") + '</span> <small class="ct-pool-tag">Callable</small></td>' +
                        '<td title="' + escapeHtml(m.assignedFilter || "None") + '"><strong>' + escapeHtml(m.assignedFilter || "None") + '</strong></td>' +
                        '<td style="text-align:right;">' + (m.filterCount !== null ? '<span class="ct-lfi-filter-count" title="Filter-matching contacts from targeting snapshot">' + formatNumber(m.filterCount) + '</span>' : '<span class="ct-lfi-empty-val">—</span>') + '</td>' +
                        '<td><span class="ct-lfi-source">' + escapeHtml(m.verification) + '</span></td>' +
                        '<td>' + escapeHtml(m.lastObservedTimeStr || "—") + '</td>' +
                        '<td><span class="ct-lfi-badge ' + freshClass + '">' + escapeHtml(freshLabel) + '</span></td>' +
                        '<td><span class="ct-lfi-badge ' + usageClass + '">' + escapeHtml(m.usageStatus) + '</span></td>' +
                    '</tr>';
                }).join("");
            }
        }

// Verified Change History removed from dashboard per directive

        // Data Health section removed from dashboard per directive
    }

    function updateInboundPanel() {
        const queues = Array.isArray(state.queues) ? state.queues : [];
        const active = queues.filter(function (q) { return !isArchivedQueue(q); });
        const archived = queues.filter(isArchivedQueue);
        const now = Date.now();
        const queueHeartbeatAge = state.queueLastFeedHeartbeatAt
            ? Math.max(0, now - state.queueLastFeedHeartbeatAt.getTime())
            : Infinity;
        const hasLiveQueueFeed = active.length > 0 && state.queueFeedStatus === "LIVE" && queueHeartbeatAge < INBOUND_HEARTBEAT_STALE_MS;
        const latestKnown = !hasLiveQueueFeed && state.queueLastUpdated;

        if (!queues.length || state.queueFeedStatus === "AUTH_REQUIRED" || state.queueFeedStatus === "FRAME_ERROR") {
            const connecting = state.queueFeedStatus === "VERIFYING" || state.queueFeedStatus === "WAITING";
            const blocked = state.queueFeedStatus === "AUTH_REQUIRED" || state.queueFeedStatus === "FRAME_ERROR";
            setText(refs.inboundStatus, connecting ? "AUTO-CONNECTING · native Queue feed" : "No verified Queue data in the current feed");
            setText(refs.inboundLive, connecting ? "CONNECTING" : "NO DATA");
            setClass(refs.inboundLive, "ct-inbound-live " + (connecting ? "is-warning" : "is-neutral"));
            setText(refs.inboundHeroWaiting, "—");
            setText(refs.inboundHeroWaitingNote, connecting ? "Waiting for native Queue data" : "No verified queue load");
            setText(refs.inboundHeroCallsNow, "—");
            setText(refs.inboundHeroCallsNowNote, "No verified live call count");
            setText(refs.inboundHeroToday, "—");
            setText(refs.inboundHeroTodayNote, "No verified daily queue totals");
            setText(refs.inboundHeroMaxWait, "—");
            setText(refs.inboundHeroMaxWaitNote, "No verified wait signal");
            Object.keys(refs.inboundKpis).forEach(function (k) { updateInboundKpi(k, "—", connecting ? "Automatic Queue feed starting" : "Awaiting verified Queue data"); });
            if (refs.inboundStaffing) refs.inboundStaffing.innerHTML = '';
            if (refs.inboundSignals) { refs.inboundSignals.innerHTML = ''; refs.inboundSignals.style.display = 'none'; }
            if (refs.inboundFocus) refs.inboundFocus.innerHTML = '<div class="ct-inbound-empty"><strong>' + (blocked ? (state.queueFeedStatus === "AUTH_REQUIRED" ? 'INBOUND FEED AUTH REQUIRED' : 'INBOUND FEED LOAD ERROR') : (connecting ? 'INBOUND AUTO-FEED STARTING' : 'INBOUND FEED NOT LOADED')) + '</strong><span>' + (blocked ? (state.queueFeedStatus === "AUTH_REQUIRED" ? 'The native Queue context is showing the CallTools login screen, so stale queue numbers are intentionally hidden.' : 'The native Queue context could not load. No stale queue numbers are presented as live.') : (connecting ? 'The monitor is loading the native CallTools Queues DOM. No extra tab or window is required.' : 'No verified Queue data is currently available.')) + '</span></div>';
            if (refs.inboundTable) refs.inboundTable.innerHTML = '';
            return;
        }

        // Build one immutable operational snapshot. Every KPI, finding,
        // and table row below is derived from this exact snapshot.
        const rows = active.map(function (q, index) {
            const today = queueNumber(q, "callsTodayTotal");
            const answered = queueNumber(q, "callsTodayAnswered");
            const notAnswered = inboundNotAnswered(q);
            return {
                q: q,
                id: q.id || q.name || "q-" + index,
                index: index,
                name: String(q.name || "Unnamed Queue").trim() || "Unnamed Queue",
                loggedIn: queueNumber(q, "loggedIn"),
                today: today,
                answered: answered,
                notAnswered: notAnswered,
                waiting: queueNumber(q, "waiting"),
                onCall: queueNumber(q, "onQueueCalls"),
                callsNow: queueNumber(q, "callsNowTotal"),
                maxWait: queueNumber(q, "waitMax"),
                goals: queueNumber(q, "goals"),
                opportunities: queueNumber(q, "opportunities"),
                calendarEvents: queueNumber(q, "calendarEvents")
            };
        });

        const anyNotAnswered = rows.some(function (r) { return r.notAnswered !== null; });
        const totals = rows.reduce(function (acc, row) {
            acc.today += row.today;
            acc.answered += row.answered;
            if (row.notAnswered !== null) {
                acc.notAnswered = (acc.notAnswered ?? 0) + row.notAnswered;
            }
            acc.waiting += row.waiting;
            acc.onCall += row.onCall;
            acc.callsNow += row.callsNow;
            acc.goals += row.goals;
            acc.loggedMemberships += row.loggedIn;
            if (row.waiting > 0) {
                acc.maxWait = Math.max(acc.maxWait, row.maxWait);
            }
            return acc;
        }, { today: 0, answered: 0, notAnswered: anyNotAnswered ? 0 : null, waiting: 0, onCall: 0, callsNow: 0, goals: 0, loggedMemberships: 0, maxWait: 0 });

        const waitingQueues = rows.filter(function (r) { return r.waiting > 0; });
        const noCapacityQueues = rows.filter(function (r) { return r.waiting > 0 && r.loggedIn === 0; });
        const saturatedQueues = rows.filter(function (r) { return r.waiting > 0 && r.loggedIn > 0 && r.onCall >= r.loggedIn; });
        const answerRate = totals.today > 0 ? totals.answered / totals.today * 100 : 0;
        const missRate = (totals.today > 0 && totals.notAnswered !== null) ? totals.notAnswered / totals.today * 100 : null;
        const consistency = totals.notAnswered !== null ? (totals.today === totals.answered + totals.notAnswered) : true;
        const inState = state.inboundSourceState || getInboundState(now);
        const inAgeSec = state.lastSuccessfulInboundAt ? Math.max(0, Math.floor((now - state.lastSuccessfulInboundAt) / 1000)) : null;
        const inAgeStr = inAgeSec !== null ? formatAge(inAgeSec) + " old" : "not connected";

        let statusText = "QUEUE FEED " + inState;
        let badgeText = "CONNECTING";
        let badgeClass = "ct-inbound-live is-warning";

        if (inState === "LIVE") {
            statusText = "LIVE · automatic native Queue feed (Observed " + inAgeStr + ")";
            badgeText = "LIVE";
            badgeClass = "ct-inbound-live is-live";
        } else if (inState === "STALE") {
            statusText = "STALE · Queue feed last observed " + inAgeStr;
            badgeText = "STALE";
            badgeClass = "ct-inbound-live is-critical";
        } else if (inState === "AUTH LOST") {
            statusText = "AUTH REQUIRED · Queue context showing CallTools login screen";
            badgeText = "AUTH REQUIRED";
            badgeClass = "ct-inbound-live is-critical";
        } else if (inState === "WAITING") {
            statusText = "AUTO-CONNECTING · native Queue feed";
            badgeText = "CONNECTING";
            badgeClass = "ct-inbound-live is-warning";
        } else {
            statusText = latestKnown ? "LAST VERIFIED · Queue feed " + inAgeStr : "QUEUE FEED NOT LOADED";
            badgeText = latestKnown ? "LAST KNOWN" : "NO DATA";
            badgeClass = "ct-inbound-live is-warning";
        }

        setText(refs.inboundStatus, statusText);
        setText(refs.inboundLive, badgeText);
        setClass(refs.inboundLive, badgeClass);

        // Compact hero metrics:
        setText(refs.inboundHeroWaiting, formatNumber(totals.waiting));
        setText(refs.inboundHeroWaitingNote, totals.waiting > 0
            ? waitingQueues.length + " active queue" + (waitingQueues.length === 1 ? "" : "s") + " holding callers"
            : "No callers currently waiting");
        setText(refs.inboundHeroCallsNow, formatNumber(totals.callsNow));
        setText(refs.inboundHeroCallsNowNote, totals.onCall + " agent" + (totals.onCall === 1 ? "" : "s") + " currently on queue calls");
        setText(refs.inboundHeroToday, formatNumber(totals.today));
        const otherOutcomes = Math.max(0, totals.today - totals.answered - (totals.notAnswered ?? 0) - totals.machine);
        let todayBreakdown = formatNumber(totals.answered) + " answered";
        if (totals.notAnswered !== null) {
            todayBreakdown += " · " + formatNumber(totals.notAnswered) + " not answered";
        }
        if (totals.machine > 0) {
            todayBreakdown += " · " + formatNumber(totals.machine) + " machine";
        }
        if (otherOutcomes > 0) {
            todayBreakdown += " · " + formatNumber(otherOutcomes) + " other/IVR";
        }
        setText(refs.inboundHeroTodayNote, todayBreakdown);
        setText(refs.inboundHeroMaxWait, totals.waiting > 0 ? formatNumber(totals.maxWait) + "s" : "0s");
        setText(refs.inboundHeroMaxWaitNote, totals.waiting > 0 ? "highest wait while callers are waiting" : "no callers waiting");
        if (refs.inboundHeroWaiting) refs.inboundHeroWaiting.className = "ct-inbound-hero-value " + (totals.waiting >= 5 ? "is-critical" : totals.waiting > 0 ? "is-warning" : "is-good");

        // Total strip:
        updateInboundKpi("queues", formatNumber(active.length), active.length + " active" + (archived.length ? " · " + archived.length + " archived excluded" : ""));
        updateInboundKpi("answeredToday", formatNumber(totals.answered), totals.today ? answerRate.toFixed(1) + "% of active-queue calls today" : "no calls today");
        updateInboundKpi("notAnsweredToday", totals.notAnswered !== null ? formatNumber(totals.notAnswered) : "—", totals.notAnswered !== null ? (totals.today ? missRate.toFixed(1) + "% of active-queue calls today" : "no calls today") : "unexposed in queue table");
        updateInboundKpi("answerRate", totals.today ? answerRate.toFixed(1) + "%" : "—", "answered ÷ calls today (" + formatNumber(totals.answered) + " ÷ " + formatNumber(totals.today) + ")");
        updateInboundKpi("onQueue", formatNumber(totals.onCall), "agents currently on live queue calls");
        updateInboundKpi("loggedMemberships", formatNumber(totals.loggedMemberships), "sum of queue logged-in · not unique agents");
        updateInboundKpi("goalsToday", formatNumber(totals.goals), "queue outcomes · today");

        if (refs.inboundStaffing) refs.inboundStaffing.innerHTML = '';

        // Priority Inbound Operational Findings (compact, high-density, action-oriented)
        if (refs.inboundFocus) {
            const findings = [];
            noCapacityQueues.forEach(function(r) {
                findings.push('<div class="ct-finding-pill is-critical"><b>NO CAPACITY</b><span>' + escapeHtml(r.name) + ': ' + formatNumber(r.waiting) + ' waiting · 0 logged in</span></div>');
            });
            rows.filter(function(r){ return r.waiting > 0 && r.maxWait >= 60; }).forEach(function(r) {
                findings.push('<div class="ct-finding-pill is-critical"><b>CRITICAL WAIT</b><span>' + escapeHtml(r.name) + ': ' + formatNumber(r.maxWait) + 's wait · ' + formatNumber(r.waiting) + ' waiting</span></div>');
            });
            rows.filter(function(r){ return r.waiting > 0 && r.maxWait >= 30 && r.maxWait < 60; }).forEach(function(r) {
                findings.push('<div class="ct-finding-pill is-warning"><b>ELEVATED WAIT</b><span>' + escapeHtml(r.name) + ': ' + formatNumber(r.maxWait) + 's wait · ' + formatNumber(r.waiting) + ' waiting</span></div>');
            });
            saturatedQueues.forEach(function(r) {
                findings.push('<div class="ct-finding-pill is-warning"><b>QUEUE SATURATED</b><span>' + escapeHtml(r.name) + ': all ' + formatNumber(r.loggedIn) + ' agents on calls · ' + formatNumber(r.waiting) + ' waiting</span></div>');
            });
            // CRITICAL: Any queue with callers waiting that wasn't already caught above MUST be reported!
            // Never allow a queue with callers waiting to be omitted, which previously caused the banner to
            // falsely claim "No callers waiting" when callers were holding!
            rows.filter(function(r) {
                return r.waiting > 0 && r.maxWait < 30 && r.loggedIn > 0 && (r.loggedIn > r.onCall);
            }).forEach(function(r) {
                findings.push('<div class="ct-finding-pill is-warning"><b>CALLERS WAITING</b><span>' + escapeHtml(r.name) + ': ' + formatNumber(r.waiting) + (r.waiting === 1 ? ' caller' : ' callers') + ' holding (' + formatNumber(r.maxWait) + 's wait) · ' + formatNumber(r.loggedIn) + ' logged in</span></div>');
            });

            const demandTone = totals.waiting > 0 ? (totals.maxWait >= 60 || noCapacityQueues.length > 0 ? 'is-critical' : 'is-warning') : 'is-good';
            const badgeLabel = totals.waiting > 0 ? formatNumber(totals.waiting) + ' WAITING' : 'COVERED';
            let findingsHtml = '';
            if (findings.length > 0) {
                findingsHtml = findings.join('');
            } else if (totals.waiting > 0) {
                findingsHtml = '<div class="ct-finding-pill is-warning"><b>CALLERS WAITING</b><span>' + formatNumber(totals.waiting) + ' callers waiting across queues</span></div>';
            } else if (state.queueFeedStatus === 'WAITING' || !rows.length) {
                findingsHtml = '<div class="ct-finding-pill"><b>AWAITING FEED</b><span>Inbound queue feed initializing…</span></div>';
            } else {
                findingsHtml = '<div class="ct-finding-pill is-good"><b>NORMAL OPERATIONS</b><span>All active queues covered · No callers waiting</span></div>';
            }

            refs.inboundFocus.className = 'ct-inbound-findings ' + demandTone;
            refs.inboundFocus.innerHTML =
                '<div class="ct-inbound-findings-head">' +
                '<strong>INBOUND OPERATIONAL FINDINGS</strong>' +
                '<span class="ct-inbound-findings-badge ' + demandTone + '">' + badgeLabel + '</span>' +
                '</div>' +
                '<div class="ct-inbound-findings-list">' + findingsHtml + '</div>';
        }

        if (refs.inboundSignals) {
            refs.inboundSignals.innerHTML = '';
            refs.inboundSignals.style.display = 'none';
        }

        if (refs.inboundTable) {
            const sorted = rows.slice().sort(function (a, b) {
                return (a.index ?? 0) - (b.index ?? 0);
            });
            const archivedRows = archived.map(function (q, index) {
                return { q:q, id: queueId(q, index), index:index, name:String(q.name || "Unnamed Queue").trim() || "Unnamed Queue", loggedIn:queueNumber(q,"loggedIn"), today:queueNumber(q,"callsTodayTotal"), answered:queueNumber(q,"callsTodayAnswered"), notAnswered:inboundNotAnswered(q), waiting:queueNumber(q,"waiting"), onCall:queueNumber(q,"onQueueCalls"), maxWait:queueNumber(q,"waitMax"), goals:queueNumber(q,"goals"), archived:true };
            });
            refs.inboundTable.innerHTML = sorted.concat(archivedRows).map(function (row) {
                const archivedRow = Boolean(row.archived);
                const qWait = row.maxWait, qWaiting = row.waiting, qToday = row.today, qAnswered = row.answered, qNotAnswered = row.notAnswered, qLoggedIn = row.loggedIn;
                const qRate = qToday > 0 ? (qAnswered / qToday * 100).toFixed(1) + "%" : "—";
                const stateLabel = archivedRow ? "ARCHIVED" : qWaiting > 0 && qLoggedIn === 0 ? "NO CAPACITY" : qWait >= 60 && qWaiting > 0 ? "CRITICAL WAIT" : qWait >= 30 && qWaiting > 0 ? "HIGH WAIT" : qWaiting > 0 ? "CALLERS WAITING" : "READY";
                const stateClass = archivedRow ? "is-neutral" : /CRITICAL|NO CAPACITY/.test(stateLabel) ? "is-critical" : /HIGH|WAITING/.test(stateLabel) ? "is-warning" : "is-good";
                const loginNote = archivedRow ? "excluded from active totals" : qLoggedIn + " queue members logged in · " + qRate + " answer rate";
                return '<div class="ct-inbound-row ' + stateClass + '" data-queue-id="' + escapeHtml(row.id || row.name) + '" data-queue-name="' + escapeHtml(row.name) + '">' +
                    '<span class="ct-qcol-name ct-inbound-name"><b>' + escapeHtml(row.name) + '</b><small>' + loginNote + '</small></span>' +
                    '<span class="ct-qcol-logged">' + formatNumber(qLoggedIn) + '</span>' +
                    '<span class="ct-qcol-today">' + formatNumber(qToday) + '</span>' +
                    '<span class="ct-qcol-answered">' + formatNumber(qAnswered) + '</span>' +
                    '<span class="ct-qcol-notans">' + formatNumber(qNotAnswered) + '</span>' +
                    '<span class="ct-qcol-wait ' + (qWaiting >= 5 ? 'is-critical' : qWaiting > 0 ? 'is-warning' : '') + '">' + formatNumber(qWaiting) + '</span>' +
                    '<span class="ct-qcol-oncall">' + formatNumber(row.onCall) + '</span>' +
                    '<span class="ct-qcol-maxwait ' + (qWait >= 60 && qWaiting > 0 ? 'is-critical' : qWait >= 30 && qWaiting > 0 ? 'is-warning' : '') + '">' + formatNumber(qWait) + 's</span>' +
                    '<span class="ct-qcol-goals">' + formatNumber(row.goals) + '</span>' +
                    '<span class="ct-qcol-state"><em>' + stateLabel + '</em></span>' +
                    '</div>';
            }).join('');
        }

        if (refs.inboundNote) {
            const consistencyNote = totals.notAnswered === null
                ? "Notice: Inbound Not Answered column not exposed in native CallTools Queue table; reporting verified raw counts without synthesis."
                : (consistency ? "Native CallTools Queue totals reconcile (Total = Answered + Not Answered)." : "Notice: CallTools native Total does not equal Answered + Not Answered; reporting verified raw counts without synthesis.");
            setText(refs.inboundNote, "Source: native CallTools Queues DOM · " + consistencyNote + " Scope: active queues only; archived queues excluded. Calls Today is the sum of active queue rows shown in Queue Detail. Logged In is queue membership, not a unique-agent count." );
        }
    }

    function signedValue(value) {
        const n = Number(value) || 0;
        return (n > 0 ? "+" : "") + formatNumber(n);
    }

    function inboundSignal(label, value, note, tone) {
        return '<div class="ct-inbound-signal is-' + escapeHtml(tone || "info") + '"><b>' + escapeHtml(label) + '</b><strong>' + escapeHtml(value) + '</strong><small>' + escapeHtml(note || "") + '</small></div>';
    }

    function inboundRiskTone(waiting, noCapacity, saturated, maxWait) {
        if ((waiting > 0 && noCapacity > 0) || (waiting > 0 && maxWait >= 60)) return "critical";
        if ((waiting > 0 && saturated > 0) || (waiting > 0 && maxWait >= 30)) return "warning";
        return "good";
    }

    function inboundRiskLabel(waiting, noCapacity, saturated, maxWait) {
        const tone = inboundRiskTone(waiting, noCapacity, saturated, maxWait);
        return tone === "critical" ? "CRITICAL" : tone === "warning" ? "WATCH" : "STABLE";
    }

    function inboundRiskNote(waiting, noCapacity, saturated, maxWait, trend) {
        if (waiting > 0 && noCapacity > 0) return noCapacity + " queue" + (noCapacity === 1 ? " has" : "s have") + " waiting callers with zero logged-in agents";
        if (waiting > 0 && maxWait >= 60) return maxWait + "s max wait with callers still waiting";
        if (waiting > 0 && saturated > 0) return saturated + " queue" + (saturated === 1 ? " is" : "s are") + " fully occupied while callers wait";
        if (waiting > 0 && maxWait >= 30) return maxWait + "s max wait with active caller load";
        if (trend && trend.waitDelta !== null && trend.waitDelta >= 10) return "wait is rising " + signedValue(trend.waitDelta) + "s over the trend window";
        return "No current native queue risk condition";
    }

    function inboundTrendMetrics(queues) {
        const history = state.inboundHistory || [];
        if (history.length < 2) return { waitDelta:null, waitingDelta:null, demandPerMin:null, missedPerMin:null, answeredPerMin:null, waitTone:"good", waitingTone:"good" };
        const nowSample = history[history.length - 1];
        let baseline = null;
        for (let i = history.length - 2; i >= 0; i--) {
            const age = nowSample.at - history[i].at;
            if (age >= INBOUND_TREND_BASELINE_MS && age <= INBOUND_TREND_MAX_BASELINE_MS) { baseline = history[i]; break; }
        }
        if (!baseline) return { waitDelta:null, waitingDelta:null, demandPerMin:null, missedPerMin:null, answeredPerMin:null, waitTone:"good", waitingTone:"good" };
        const mins = Math.max(1 / 60, (nowSample.at - baseline.at) / 60000);
        const waitDelta = nowSample.maxWait - baseline.maxWait;
        const waitingDelta = nowSample.waiting - baseline.waiting;
        const demandPerMin = Math.max(0, nowSample.totalToday - baseline.totalToday) / mins;
        const missedPerMin = (nowSample.notAnswered !== null && baseline.notAnswered !== null)
            ? Math.max(0, nowSample.notAnswered - baseline.notAnswered) / mins
            : null;
        const answeredPerMin = Math.max(0, nowSample.answeredToday - baseline.answeredToday) / mins;
        return {
            waitDelta: waitDelta, waitingDelta: waitingDelta, demandPerMin: demandPerMin, missedPerMin: missedPerMin, answeredPerMin: answeredPerMin,
            waitTone: waitDelta >= 10 ? "critical" : waitDelta >= 5 ? "warning" : "good",
            waitingTone: waitingDelta > 0 ? "warning" : waitingDelta < 0 ? "good" : "good"
        };
    }

    function recordInboundHistory(queues, timestamp) {
        const active = (queues || []).filter(function(q){ return !isArchivedQueue(q); });
        var hasAnyNotAnswered = false;
        var notAnsweredSum = 0;
        active.forEach(function(q) {
            var v = inboundNotAnswered(q);
            if (v !== null) {
                hasAnyNotAnswered = true;
                notAnsweredSum += v;
            }
        });
        const sample = {
            at: Number(timestamp) || Date.now(),
            totalToday: active.reduce(function(sum,q){ return sum + queueNumber(q,"callsTodayTotal"); },0),
            answeredToday: active.reduce(function(sum,q){ return sum + queueNumber(q,"callsTodayAnswered"); },0),
            notAnswered: hasAnyNotAnswered ? notAnsweredSum : null,
            waiting: active.reduce(function(sum,q){ return sum + queueNumber(q,"waiting"); },0),
            maxWait: active.reduce(function(max,q){ return Math.max(max, queueNumber(q,"waitMax")); },0)
        };
        const last = state.inboundHistory[state.inboundHistory.length - 1];
        if (last && last.at === sample.at && last.totalToday === sample.totalToday && last.answeredToday === sample.answeredToday && last.notAnswered === sample.notAnswered && last.waiting === sample.waiting && last.maxWait === sample.maxWait) return;
        state.inboundHistory.push(sample);
        const cutoff = sample.at - INBOUND_HISTORY_WINDOW_MS;
        state.inboundHistory = state.inboundHistory.filter(function(item){ return item.at >= cutoff; }).slice(-180);
    }

    function inboundKpiShell(key, label) {
        return '<div class="ct-inbound-kpi" data-inbound-kpi="' + escapeHtml(key) + '"><div class="ct-inbound-kpi-label">' + escapeHtml(label) + '</div><div class="ct-inbound-kpi-value">—</div><div class="ct-inbound-kpi-note">—</div></div>';
    }

    function inboundKpiRefs(key) {
        const node = root.querySelector('[data-inbound-kpi="' + key + '"]');
        return { value: node ? node.querySelector('.ct-inbound-kpi-value') : null, note: node ? node.querySelector('.ct-inbound-kpi-note') : null };
    }

    function updateInboundKpi(key, value, note) {
        const item = refs.inboundKpis && refs.inboundKpis[key];
        if (!item) return;
        setText(item.value, String(value));
        setText(item.note, String(note || ""));
    }

    function updateKpi(key, value, note, title) {
        if (!refs.kpis || !refs.kpis[key]) return;
        setText(refs.kpis[key].value, String(value));
        setText(refs.kpis[key].note, note);
        if (title !== undefined && refs.kpis[key].card) {
            refs.kpis[key].card.title = title;
        }
    }

    function updateStatus(key, value) {
        setText(refs.status[key].value, formatNumber(value));
    }

    function updateInsight(key, value) {
        setText(refs.insights[key].value, value);
        refs.insights[key].value.title = value;
    }

    function opsMetricShell(key, label) {
        return `
            <div class="ct-ops-metric" data-ops-metric="${escapeHtml(key)}">
                <div class="ct-ops-label">${escapeHtml(label)}</div>
                <div class="ct-ops-value">-</div>
            </div>
        `;
    }

    function opsMetricRefs(key) {
        const node = root.querySelector(`[data-ops-metric="${key}"]`);

        return {
            value: node ? node.querySelector(".ct-ops-value") : null
        };
    }

    function updateOpsMetric(key, value) {
        const metric = refs.ops && refs.ops.metrics ? refs.ops.metrics[key] : null;

        if (metric) {
            setText(metric.value, value);
        }
    }

    function operationsHealth(stats) {
        const waiting = numberValue(stats.waiting);
        const loggedIn = numberValue(stats.loggedIn);
        const onCall = numberValue(stats.onCall);
        const averageWait = numberValue(stats.averageWait);
        const critical = numberValue(stats.critical);
        const warning = numberValue(stats.warning);

        const utilization = utilizationPercent(loggedIn, onCall);
        const queuePressure = loggedIn > 0
            ? Math.round((waiting / loggedIn) * 100)
            : (waiting > 0 ? 100 : 0);

        const capacityLabel = loggedIn === 0
            ? (waiting > 0 ? "No capacity" : "No agents")
            : utilization >= 100
                ? "Full"
                : utilization >= 85
                    ? "Tight"
                    : "Available";

        let score = 100;
        score -= Math.min(35, averageWait * 0.45);
        score -= Math.min(30, waiting * 5);
        score -= Math.min(25, critical * 12);
        score -= Math.min(10, warning * 3);

        if (loggedIn === 0 && waiting > 0) {
            score -= 30;
        } else if (loggedIn > 0 && onCall >= loggedIn && waiting > 0) {
            score -= 15;
        }

        score = Math.max(0, Math.min(100, Math.round(score)));

        let tone = "healthy";
        let label = "Healthy";
        let actionState = "Normal";
        let action = "No immediate action indicated by current parser data.";

        if (score < 50) {
            tone = "critical";
            label = "Critical";
            actionState = "Critical";
            action = loggedIn === 0 && waiting > 0
                ? "Agents are not logged in while calls are waiting. Restore agent capacity."
                : "Operations are under significant pressure. Review the highest-wait and critical campaigns.";
        } else if (score < 70) {
            tone = "warning";
            label = "Watch";
            actionState = "Attention";
            action = "Queue pressure or campaign health is elevated. Monitor wait time and available agent capacity.";
        } else if (score < 90) {
            tone = "good";
            label = "Good";
            actionState = "Monitor";
            action = "Operations are stable, with some pressure visible in the current parser data.";
        }

        return {
            score: score,
            tone: tone,
            label: label,
            actionState: actionState,
            action: action,
            queuePressure: queuePressure + "%",
            agentCapacity: capacityLabel
        };
    }

    function kpiShell(key, label) {
        return `
            <div class="ct-kpi" data-kpi="${escapeHtml(key)}">
                <div class="ct-kpi-label">${escapeHtml(label)}</div>
                <div class="ct-kpi-value">0</div>
                <div class="ct-kpi-note">-</div>
            </div>
        `;
    }

    function statusShell(key, label) {
        return `
            <div class="ct-status" data-status="${escapeHtml(key)}">
                <div class="ct-status-label">${escapeHtml(label)}</div>
                <div class="ct-status-value is-${escapeHtml(key)}">0</div>
            </div>
        `;
    }

    function insightShell(key, label) {
        return `
            <div class="ct-insight is-neutral" data-insight="${escapeHtml(key)}">
                <div class="ct-insight-accent"></div>
                <div class="ct-insight-top"><div class="ct-insight-label">${escapeHtml(label)}</div><span class="ct-insight-state">LIVE</span></div>
                <div class="ct-insight-value">—</div>
                <div class="ct-insight-campaign">Waiting for data</div>
            </div>
        `;
    }

    function quickMetricShell(key, label) {
        return `
            <div class="ct-quick-item" data-quick="${escapeHtml(key)}">
                <div class="ct-quick-label">${escapeHtml(label)}</div>
                <div class="ct-quick-value">-</div>
            </div>
        `;
    }

    function metricShell(metric) {
        return `
            <div class="ct-metric" data-metric="${escapeHtml(metric.key)}" title="${escapeHtml(metric.group + ": " + metric.label)}">
                <div class="ct-metric-label">${escapeHtml(metric.label)}</div>
                <div class="ct-metric-value">
                    <span class="ct-value-text"></span>
                    <span class="ct-trend"></span>
                </div>
            </div>
        `;
    }

    function kpiRefs(key) {
        const node = root.querySelector(`[data-kpi="${key}"]`);

        return {
            card: node,
            value: node ? node.querySelector(".ct-kpi-value") : null,
            note: node ? node.querySelector(".ct-kpi-note") : null
        };
    }

    function statusRefs(key) {
        const node = root.querySelector(`[data-status="${key}"]`);

        return {
            value: node.querySelector(".ct-status-value")
        };
    }

    function insightRefs(key) {
        const node = root.querySelector(`[data-insight="${key}"]`);

        return {
            node: node,
            label: node ? node.querySelector(".ct-insight-label") : null,
            value: node ? node.querySelector(".ct-insight-value") : null,
            campaign: node ? node.querySelector(".ct-insight-campaign") : null,
            state: node ? node.querySelector(".ct-insight-state") : null
        };
    }

    function emptyState(message) {
        const empty = document.createElement("div");
        empty.className = "ct-empty";
        empty.textContent = message;

        return empty;
    }

    function severityRank(severity) {
        return severity === "critical" ? 0 : 1;
    }

    function abandonedCount(value) {
        const match = String(value || "").match(/^\s*([\d,]+)/);

        return match ? numberValue(match[1]) : 0;
    }

    function numberValue(value) {
        const number = parseFloat(String(value ?? "").replace(/,/g, ""));

        return Number.isFinite(number) ? number : 0;
    }

    function formatNumber(value, fallback) {
        if (value === null || value === undefined || String(value).trim() === "") {
            return fallback !== undefined ? fallback : "—";
        }
        const num = parseFloat(String(value).replace(/,/g, ""));
        if (!Number.isFinite(num)) {
            return String(value).trim() || (fallback !== undefined ? fallback : "—");
        }
        return num.toLocaleString();
    }

    function safeValue(value, fallback) {
        const text = String(value ?? "").trim();

        return text || (fallback || EMPTY);
    }

        function formatRatePercent(numerator, denominator) {
        if (denominator === null || denominator === undefined || denominator <= 0 || numerator === null || numerator === undefined) {
            return "—";
        }
        const num = Number(numerator);
        const den = Number(denominator);
        if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return "—";
        const rate = (num / den) * 100;
        if (rate === 0) return "0.00%";
        if (rate > 0 && rate < 0.01) return "<0.01%";
        return rate.toFixed(2) + "%";
    }

    function formatDateTime(date) {
        return date.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit"
        });
    }

    function setText(node, value) {
        const nextValue = String(value ?? "");

        if (node && node.textContent !== nextValue) {
            node.textContent = nextValue;
        }
    }

    function setClass(node, value) {
        if (node && node.className !== value) {
            node.className = value;
        }
    }

    function setWidth(node, value) {
        const nextValue = Math.max(0, Math.min(100, value)) + "%";

        if (node && node.style.width !== nextValue) {
            node.style.width = nextValue;
        }
    }

    function readDismissedConditions() {
        const map = new Map();
        try {
            const raw = JSON.parse(localStorage.getItem(DISMISSED_ALERTS_KEY) || "{}");
            Object.keys(raw || {}).forEach(function (key) {
                const item = raw[key];
                if (!item || !item.signature) return;
                map.set(key, String(item.signature));
            });
        } catch (error) {}
        return map;
    }

    function persistDismissedConditions() {
        try {
            const now = Date.now();
            const payload = {};
            state.dismissedConditions.forEach(function (signature, key) {
                payload[key] = { signature: signature, savedAt: now };
            });
            localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify(payload));
        } catch (error) {}
    }

    function readCampaignOrder() {
        try {
            const value = JSON.parse(localStorage.getItem(ORDER_KEY) || "[]");
            return Array.isArray(value) ? value.filter(function (id) { return typeof id === "string" && id; }) : [];
        } catch (error) {
            return [];
        }
    }

    function readLayout() {
        try {
            const storedVersion = Number(localStorage.getItem(LAYOUT_VERSION_KEY) || 0);
            if (storedVersion !== LAYOUT_VERSION) {
                const fresh = defaultLayout();
                localStorage.setItem(LAYOUT_KEY, JSON.stringify(fresh));
                localStorage.setItem(LAYOUT_VERSION_KEY, String(LAYOUT_VERSION));
                return fresh;
            }
            return normalizeLayout(JSON.parse(localStorage.getItem(LAYOUT_KEY) || "null"));
        } catch (error) {
            return defaultLayout();
        }
    }

    function defaultLayout() {
        const padding = 14;
        const maxWidth = Math.max(980, window.innerWidth - (padding * 2));
        const targetWidth = window.innerWidth >= 1680 ? 1560 : window.innerWidth >= 1400 ? 1420 : window.innerWidth >= 1200 ? 1280 : Math.min(DEFAULT_LAYOUT.width, maxWidth);
        // Automatically adjust to fill the available desktop viewport (matching Image 2)
        const autoWidth = Math.max(targetWidth, window.innerWidth - (padding * 2));
        const width = Math.min(autoWidth, maxWidth);
        const autoHeight = Math.max(720, window.innerHeight - (padding * 2));
        const height = Math.min(autoHeight, Math.max(540, window.innerHeight - (padding * 2)));

        return {
            left: padding,
            top: padding,
            width: width,
            height: height,
            collapsed: DEFAULT_LAYOUT.collapsed,
            isAutoAdjusted: true,
            isCustom: false
        };
    }

    function normalizeLayout(layout) {
        const def = defaultLayout();
        if (!layout) return def;

        // If the layout was auto-adjusted or not explicitly customized by the user,
        // auto-adjust to current screen dimensions across refresh (Point 1)!
        if (layout.isAutoAdjusted || !layout.isCustom) {
            return def;
        }

        const source = Object.assign(def, layout || {});
        const zoom = (state && state.zoom) ? state.zoom : (Number(readStorage(ZOOM_KEY, "1")) || 1);
        const padding = 14;
        const maxWidth = Math.max(980, Math.floor((window.innerWidth - (padding * 2)) / zoom));
        const maxHeight = Math.max(540, Math.floor((window.innerHeight - (padding * 2)) / zoom));
        const effectiveMinWidth = maxWidth >= 1280 ? 1200 : 980;
        const width = clamp(numberValue(source.width) || def.width, effectiveMinWidth, maxWidth);
        const height = clamp(numberValue(source.height) || def.height, 540, maxHeight);
        const maxLeft = Math.max(0, Math.floor((window.innerWidth - (padding * 2)) / zoom - width + padding));
        const maxTop = Math.max(0, Math.floor((window.innerHeight - (padding * 2)) / zoom - height + padding));

        return {
            left: clamp(numberValue(source.left), 0, maxLeft),
            top: clamp(numberValue(source.top), 0, maxTop),
            width: width,
            height: height,
            collapsed: Boolean(source.collapsed),
            isAutoAdjusted: false,
            isCustom: true
        };
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function readStorage(key, fallback) {
        try {
            return localStorage.getItem(key) || fallback;
        } catch (error) {
            return fallback;
        }
    }

    function writeStorage(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            return;
        }
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function themeIcon() {
        return `
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3v2.2M12 18.8V21M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M3 12h2.2M18.8 12H21M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="2"/>
            </svg>
        `;
    }

    function chevronIcon() {
        return `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
        `;
    }
})();
