// ===============================================================================
// CT DATA CHANGE INTELLIGENCE ENGINE (v11.3.8)
// Independent Bidirectional Metric Anomaly & Event Detection Engine
// Strictly Read-Only DOM Observation & Persistent Multi-Dialer Intelligence
// ===============================================================================

(function (root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else {
        root.CTDataIntelligence = factory();
    }
}(typeof self !== "undefined" ? self : this, function () {
    "use strict";

    /**
     * Default Metric Threshold Profiles
     * Independent absolute and percentage thresholds per monitored metric.
     */
    const METRIC_THRESHOLDS = {
        // --- OUTBOUND METRICS ---
        outbound_campaigns_count: {
            direction: "OUTBOUND",
            metric: "Active Campaigns Count",
            minBaseline: 1,
            increaseAbs: null,
            increasePct: null,
            decreaseAbs: 2,       // Drop of 2 or more active campaigns
            decreasePct: 0.25,    // 25% drop in active campaign pool
            severity: "critical",
            confirmationsRequired: 2,
            description: "Detects unexpected widespread pausing or loss of active campaigns"
        },
        outbound_leads_inventory: {
            direction: "OUTBOUND",
            metric: "Lead Inventory",
            minBaseline: 1000,
            increaseAbs: null,
            increasePct: null,
            decreaseAbs: 5000,    // 5k lead drop beyond normal dialer consumption
            decreasePct: 0.35,    // 35% drop in lead pool
            severity: "warning",
            confirmationsRequired: 2,
            description: "Detects rapid exhaustion or premature recycling of lead inventory"
        },
        outbound_abandoned: {
            direction: "OUTBOUND",
            metric: "Abandoned Calls",
            minBaseline: 10,
            increaseAbs: 20,      // Sudden spike of 20 abandoned calls
            increasePct: 0.30,    // 30% increase in abandoned volume
            decreaseAbs: null,    // Decreases in abandoned count are normal
            decreasePct: null,
            severity: "critical",
            confirmationsRequired: 2,
            description: "Surges in outbound abandon volume"
        },
        outbound_wait_time: {
            direction: "OUTBOUND",
            metric: "Worst Wait Time",
            minBaseline: 10,
            increaseAbs: 30,      // +30 seconds wait spike
            increasePct: 0.50,    // 50% increase in holding delay
            decreaseAbs: null,
            decreasePct: null,
            severity: "critical",
            confirmationsRequired: 2,
            description: "Holding delays and queue starvation"
        },
        outbound_callers_waiting: {
            direction: "OUTBOUND",
            metric: "Callers Waiting",
            minBaseline: 1,
            increaseAbs: 8,       // 8 or more callers holding
            increasePct: 0.75,
            decreaseAbs: null,
            decreasePct: null,
            severity: "warning",
            confirmationsRequired: 2,
            description: "Outbound connect holding backlog"
        },
        outbound_agents_logged_in: {
            direction: "OUTBOUND",
            metric: "Total Agents Logged In",
            minBaseline: 3,
            increaseAbs: null,
            increasePct: null,
            decreaseAbs: 3,       // Loss of 3+ agents
            decreasePct: 0.35,    // 35% agent capacity drop
            severity: "critical",
            confirmationsRequired: 2,
            description: "Agent staffing drop"
        },
        // outbound_failed_calls disabled at rule-generation level per alert policy


        // --- INBOUND METRICS ---
        inbound_active_queues: {
            direction: "INBOUND",
            metric: "Active Queues Count",
            minBaseline: 1,
            increaseAbs: null,
            increasePct: null,
            decreaseAbs: 1,       // Any active queue disappearance
            decreasePct: 0.20,
            severity: "critical",
            confirmationsRequired: 2,
            description: "Inbound queue availability"
        },
        inbound_callers_waiting: {
            direction: "INBOUND",
            metric: "Callers Waiting",
            minBaseline: 1,
            increaseAbs: 4,       // 4 callers holding in queue
            increasePct: 0.50,
            decreaseAbs: null,
            decreasePct: null,
            severity: "warning",
            confirmationsRequired: 2,
            description: "Surges in inbound callers holding"
        },
        inbound_max_wait: {
            direction: "INBOUND",
            metric: "Max Wait Time",
            minBaseline: 15,
            increaseAbs: 30,      // +30s max wait increase
            increasePct: 0.50,
            decreaseAbs: null,
            decreasePct: null,
            severity: "critical",
            confirmationsRequired: 2,
            description: "Inbound caller hold time"
        },
        inbound_agents_logged_in: {
            direction: "INBOUND",
            metric: "Queue Members Logged In",
            minBaseline: 2,
            increaseAbs: null,
            increasePct: null,
            decreaseAbs: 2,       // Drop of 2 queue members
            decreasePct: 0.40,    // 40% staffing drop
            severity: "critical",
            confirmationsRequired: 2,
            description: "Inbound queue staffing capacity drops"
        },
        inbound_not_answered: {
            direction: "INBOUND",
            metric: "Not Answered Calls",
            minBaseline: 5,
            increaseAbs: 15,      // Spike of 15 missed queue opportunities
            increasePct: 0.35,
            decreaseAbs: null,
            decreasePct: null,
            severity: "warning",
            confirmationsRequired: 2,
            description: "Inbound queue missed call spikes"
        }
    };

    class CTDataIntelligenceEngine {
        constructor(options = {}) {
            const isEast3 = typeof window !== "undefined" && window.location && window.location.hostname.includes("east-3");
        this.dialer = options.dialer || (isEast3 ? "EAST-3" : "EAST-2");
            this.prefix = options.prefix || (isEast3 ? "ct_east3_" : "ct_east2_");
            this.storage = options.storage || (typeof localStorage !== "undefined" ? localStorage : null);

            // Storage Keys
            this.BASELINES_KEY = this.prefix + "intelligence_baselines_v1";
            this.PENDING_KEY = this.prefix + "intelligence_pending_v1";
            this.ALERTS_KEY = this.prefix + "intelligence_alerts_v1";
            this.HISTORY_KEY = this.prefix + "intelligence_history_v1";
            this.FILTER_BASELINES_KEY = this.prefix + "intelligence_filter_baselines_v1";
            this.LIVE_FILTERS_INVENTORY_KEY = this.prefix + "live_filters_inventory_v1";
            this.VERIFIED_FILTERS_KEY = this.prefix + "verified_campaign_filters_v1";
            this.CHANGE_HISTORY_KEY = this.prefix + "live_filter_change_history_v1";

            // In-Memory State
            this.baselines = {};
            this.filterBaselines = {}; // cid -> { filter, status, source, updatedAt }
            this.pendingConfirmations = {}; // targetKey -> { count, firstDetectedAt, value, ... }
            this.activeAlerts = [];
            this.history = [];
            this.liveFilterChangeHistory = [];

            this.loadState();
        }

        loadState() {
            if (this.storage) {
                try {
                    this.baselines = JSON.parse(this.storage.getItem(this.BASELINES_KEY) || "{}");
                    this.filterBaselines = JSON.parse(this.storage.getItem(this.FILTER_BASELINES_KEY) || "{}");
                    this.pendingConfirmations = JSON.parse(this.storage.getItem(this.PENDING_KEY) || "{}");
                    this.activeAlerts = (JSON.parse(this.storage.getItem(this.ALERTS_KEY) || "[]") || []).filter(a => a && a.metric !== "Failed Call Volume" && a.profileKey !== "outbound_failed_calls");
                    this.history = JSON.parse(this.storage.getItem(this.HISTORY_KEY) || "[]");
                    this.liveFilterChangeHistory = JSON.parse(this.storage.getItem(this.CHANGE_HISTORY_KEY) || "[]");
                } catch (e) {
                    console.error("CTDataIntelligence failed to load state from storage:", e);
                    this.baselines = {};
                    this.filterBaselines = {};
                    this.pendingConfirmations = {};
                    this.activeAlerts = [];
                    this.history = [];
                    this.liveFilterChangeHistory = [];
                }
            }
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                try {
                    chrome.storage.local.get([this.BASELINES_KEY, this.FILTER_BASELINES_KEY, this.PENDING_KEY, this.ALERTS_KEY, this.HISTORY_KEY, this.CHANGE_HISTORY_KEY], (items) => {
                        if (items) {
                            if (items[this.BASELINES_KEY]) this.baselines = Object.assign(this.baselines, items[this.BASELINES_KEY]);
                            if (items[this.FILTER_BASELINES_KEY]) this.filterBaselines = Object.assign(this.filterBaselines, items[this.FILTER_BASELINES_KEY]);
                            if (items[this.PENDING_KEY]) this.pendingConfirmations = Object.assign(this.pendingConfirmations, items[this.PENDING_KEY]);
                            if (Array.isArray(items[this.CHANGE_HISTORY_KEY])) this.liveFilterChangeHistory = items[this.CHANGE_HISTORY_KEY];
                            if (Array.isArray(items[this.ALERTS_KEY]) && items[this.ALERTS_KEY].length) {
                                const currentIds = new Set(this.activeAlerts.map(a => a.id));
                                items[this.ALERTS_KEY].forEach(a => {
                                    if (a && a.id && !currentIds.has(a.id) && !a.acknowledged) {
                                        this.activeAlerts.push(a);
                                    }
                                });
                            }
                        }
                    });
                } catch (e) {}
            }
        }

        saveState() {
            if (this.storage) {
                try {
                    this.storage.setItem(this.BASELINES_KEY, JSON.stringify(this.baselines));
                    this.storage.setItem(this.FILTER_BASELINES_KEY, JSON.stringify(this.filterBaselines));
                    this.storage.setItem(this.PENDING_KEY, JSON.stringify(this.pendingConfirmations));
                    this.storage.setItem(this.ALERTS_KEY, JSON.stringify(this.activeAlerts));
                    this.storage.setItem(this.HISTORY_KEY, JSON.stringify(this.history.slice(-500))); // Keep last 500 events
                    this.storage.setItem(this.CHANGE_HISTORY_KEY, JSON.stringify(this.liveFilterChangeHistory.slice(0, 100)));
                } catch (e) {
                    console.error("CTDataIntelligence failed to persist state:", e);
                }
            }
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                try {
                    chrome.storage.local.set({
                        [this.BASELINES_KEY]: this.baselines,
                        [this.FILTER_BASELINES_KEY]: this.filterBaselines,
                        [this.PENDING_KEY]: this.pendingConfirmations,
                        [this.ALERTS_KEY]: this.activeAlerts,
                        [this.HISTORY_KEY]: this.history.slice(-500),
                        [this.CHANGE_HISTORY_KEY]: this.liveFilterChangeHistory.slice(0, 100)
                    });
                } catch (e) {}
            }
        }

        updateVerifiedCampaignFilter(campaignId, campaignName, filterName, source = "CAMPAIGN_EDIT_DOM", timestamp = Date.now(), filterCount = null) {
            if (!campaignId) return;
            try {
                let registry = {};
                if (this.storage) {
                    const raw = this.storage.getItem(this.VERIFIED_FILTERS_KEY);
                    if (raw) registry = JSON.parse(raw);
                }
                registry[String(campaignId)] = {
                    campaignId: String(campaignId),
                    campaignName: campaignName || "",
                    liveFilter: filterName || "",
                    cleanFilterName: filterName ? String(filterName).replace(/\s*\(Count:\s*[\d,]+\)/i, "").trim() : "",
                    filterCount: filterCount,
                    status: filterName ? "ASSIGNED" : "NO_FILTER",
                    source: source,
                    timestamp: timestamp
                };
                if (this.storage) {
                    this.storage.setItem(this.VERIFIED_FILTERS_KEY, JSON.stringify(registry));
                }
                if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.set({ [this.VERIFIED_FILTERS_KEY]: registry });
                }
            } catch (e) {
                console.error("Failed to update verified campaign filter:", e);
            }
        }

        /**
         * Checks whether the current time falls within a legitimate daily reset window (23:55 to 00:15)
         */
        isMidnightResetWindow() {
            const d = new Date();
            const h = d.getHours();
            const m = d.getMinutes();
            return (h === 23 && m >= 55) || (h === 0 && m <= 15);
        }

        /**
         * Main observation entry point.
         * Ingests native snapshot of campaigns and queues.
         */
        processSnapshot(snapshot = {}) {
            const now = Date.now();
            const timeStr = new Date(now).toLocaleTimeString();

            const isAuthLost = Boolean(snapshot.authLost);
            const isStale = Boolean(snapshot.isStale);

            // ENGINE D: Data Integrity - Auth Loss
            if (isAuthLost) {
                this.recordIntegrityAlert({
                    id: `${this.dialer}_AUTH_LOSS_${now}`,
                    metric: "Authentication Status",
                    status: "AUTH_LOST",
                    severity: "critical",
                    message: "CallTools authentication session expired or redirected to login",
                    timestamp: now,
                    timeStr
                });
                this.saveState();
                return this.activeAlerts;
            }

            // ENGINE D: Data Integrity - Stale Source Feed
            if (isStale) {
                this.recordIntegrityAlert({
                    id: `${this.dialer}_FEED_STALE_${now}`,
                    metric: "Feed Heartbeat",
                    status: "FEED_STALE",
                    severity: "warning",
                    message: "CallTools DOM feed heartbeat exceeded stale threshold (>15s)",
                    timestamp: now,
                    timeStr
                });
                // Suspend operational comparisons while stale
                this.saveState();
                return this.activeAlerts;
            }

            const campaigns = Array.isArray(snapshot.campaigns) ? snapshot.campaigns : [];
            const queues = Array.isArray(snapshot.queues) ? snapshot.queues : [];

            // ENGINE D: Native Table Missing or Empty Table Checks
            if (snapshot.isCampaignsRoute && !snapshot.campaignTableFound) {
                this.recordIntegrityAlert({
                    id: `${this.dialer}_TABLE_MISSING_CAMPAIGNS_${now}`,
                    metric: "Native Table Container",
                    status: "TABLE_MISSING",
                    severity: "critical",
                    message: "Native CallTools Campaigns table container not found in DOM",
                    timestamp: now,
                    timeStr
                });
            } else if (snapshot.isCampaignsRoute && snapshot.campaignTableFound) {
                // Auto-resolve TABLE_MISSING alert when table is confirmed present and healthy
                if (this.activeAlerts.some(a => a && a.status === "TABLE_MISSING")) {
                    this.activeAlerts = this.activeAlerts.filter(a => !a || a.status !== "TABLE_MISSING");
                }
            }

            // 1. Process Outbound Campaigns
            this.evaluateOutbound(campaigns, now, timeStr);

            // 2. Process Inbound Queues
            this.evaluateInbound(queues, now, timeStr);

            this.saveState();
            return this.activeAlerts;
        }

        evaluateOutbound(campaigns, now, timeStr) {
            const currentCampaignIds = new Set();
            const activeCampaigns = campaigns.filter(c => c && c.active !== false && c.__active !== false);

            let totalLeads = 0;
            let totalAbandoned = 0;
            let totalWaiting = 0;
            let worstWait = 0;
            let totalAgents = 0;
            let totalFailed = 0;

            campaigns.forEach(c => {
                if (!c || !c.id) return;
                const cid = String(c.id);
                currentCampaignIds.add(cid);

                const cGoals = Number(c.goals ?? c.__goals ?? 0);
                const cSales = Number(c.sales ?? c.__sales ?? 0);

                // ENGINE A: SALES / GOALS ALERTS (Instant on increase)
                this.checkSalesGoalsAlert({
                    targetId: cid,
                    targetName: c.name || `Campaign ${cid}`,
                    direction: "OUTBOUND",
                    goalsVal: Number.isFinite(cGoals) ? cGoals : null,
                    salesVal: Number.isFinite(cSales) && cSales > 0 ? cSales : null,
                    now,
                    timeStr
                });

                // Per-campaign aggregations and live lead inventory tracking
                const leads = Number(c.contacts ?? c.__contacts ?? 0);
                if (Number.isFinite(leads)) {
                    totalLeads += leads;
                    const isActive = c.active !== false && c.__active !== false;
                    if (isActive) {
                        this.checkCampaignLeadInventory({
                            cid,
                            cName: c.name || `Campaign ${cid}`,
                            contactsVal: leads,
                            now,
                            timeStr
                        });
                    }
                }

                // STAGE 3: Live Filter Change Intelligence
                this.checkCampaignLiveFilter({
                    cid,
                    cName: c.name || `Campaign ${cid}`,
                    filterVal: c.liveFilter,
                    status: c.liveFilterStatus || (c.liveFilter ? "OBSERVED" : "FILTER SOURCE UNAVAILABLE"),
                    source: c.liveFilterSource || "TABLE_COLUMN",
                    confidence: c.liveFilterConfidence || (c.liveFilter ? "VERIFIED" : "UNAVAILABLE"),
                    now,
                    timeStr
                });

                const abnd = Number(c.abandoned ?? c.__abandoned ?? 0);
                if (Number.isFinite(abnd)) totalAbandoned += abnd;

                const wait = Number(c.waiting ?? c.__waiting ?? 0);
                if (Number.isFinite(wait)) totalWaiting += wait;

                const waitTime = Number(c.waitNow ?? c.__waitNow ?? 0);
                if (Number.isFinite(waitTime)) worstWait = Math.max(worstWait, waitTime);

                const agents = Number(c.loggedIn ?? c.__loggedIn ?? 0);
                if (Number.isFinite(agents)) totalAgents += agents;

                const failed = Number(c.failed ?? c.__failed ?? 0);
                if (Number.isFinite(failed)) totalFailed += failed;

                // Contradictory Metric Check
                const answered = Number(c.answered ?? c.__answered ?? 0);
                const totalCalls = Number(c.callsToday ?? c.__callsToday ?? c.outbound ?? c.__outbound ?? 0);
                if (answered > totalCalls && totalCalls > 0) {
                    this.recordIntegrityAlert({
                        id: `${this.dialer}_CONTRADICTORY_CAMPAIGN_${cid}_${now}`,
                        metric: "Call Totals Consistency",
                        status: "CONTRADICTORY",
                        severity: "critical",
                        message: `Campaign '${c.name}': answered calls (${answered}) exceeds total calls (${totalCalls})`,
                        timestamp: now,
                        timeStr
                    });
                }
            });

            // ENGINE D: Campaign Disappearance Check
            if (this.baselines["outbound_campaign_list"]) {
                const prevList = this.baselines["outbound_campaign_list"].ids || [];
                const missingIds = prevList.filter(id => !currentCampaignIds.has(id));
                if (missingIds.length > 0 && campaigns.length > 0) {
                    const confirmed = this.confirmAndTriggerAlert({
                        key: "disappeared_campaigns",
                        metric: "Campaign Availability",
                        direction: "OUTBOUND",
                        targetId: missingIds.join(","),
                        targetName: `${missingIds.length} Campaign(s) Missing`,
                        status: "MISSING",
                        previous: prevList.length,
                        current: currentCampaignIds.size,
                        absoluteDiff: missingIds.length,
                        percentDiff: `-${Math.round((missingIds.length / prevList.length) * 100)}%`,
                        severity: "critical",
                        confirmationsRequired: 2,
                        message: `Campaign ID(s) disappeared from native DOM: ${missingIds.join(", ")}`,
                        now,
                        timeStr
                    });
                    if (confirmed) {
                        this.baselines["outbound_campaign_list"] = { ids: Array.from(currentCampaignIds), updatedAt: now };
                    }
                } else {
                    this.baselines["outbound_campaign_list"] = { ids: Array.from(currentCampaignIds), updatedAt: now };
                }
            } else {
                this.baselines["outbound_campaign_list"] = { ids: Array.from(currentCampaignIds), updatedAt: now };
            }

            // Check Monitored Outbound Operational Aggregates
            this.evaluateOperationalMetric("outbound_campaigns_count", activeCampaigns.length, "OUTBOUND", "ALL", "Active Campaigns", now, timeStr);
            this.evaluateOperationalMetric("outbound_leads_inventory", totalLeads, "OUTBOUND", "ALL", "Lead Inventory", now, timeStr);
            this.evaluateOperationalMetric("outbound_abandoned", totalAbandoned, "OUTBOUND", "ALL", "Total Abandoned", now, timeStr);
            this.evaluateOperationalMetric("outbound_wait_time", worstWait, "OUTBOUND", "ALL", "Worst Wait Delay", now, timeStr);
            this.evaluateOperationalMetric("outbound_callers_waiting", totalWaiting, "OUTBOUND", "ALL", "Callers Waiting", now, timeStr);
            this.evaluateOperationalMetric("outbound_agents_logged_in", totalAgents, "OUTBOUND", "ALL", "Total Agents Logged In", now, timeStr);
            // Failed-call volume alert disabled per alert policy
            // this.evaluateOperationalMetric("outbound_failed_calls", totalFailed, "OUTBOUND", "ALL", "Failed Call Volume", now, timeStr);
        }

        evaluateInbound(queues, now, timeStr) {
            const currentQueueIds = new Set();
            const activeQueues = queues.filter(q => q && !q.archived);

            let totalWaiting = 0;
            let maxWait = 0;
            let totalLoggedIn = 0;
            let totalNotAnswered = 0;

            queues.forEach(q => {
                if (!q || !q.id) return;
                const qid = String(q.id);
                currentQueueIds.add(qid);

                const qGoals = Number(q.goals ?? 0);
                const qSales = Number(q.sales ?? 0);

                // ENGINE A: SALES / GOALS ALERTS
                this.checkSalesGoalsAlert({
                    targetId: qid,
                    targetName: q.name || `Queue ${qid}`,
                    direction: "INBOUND",
                    goalsVal: Number.isFinite(qGoals) ? qGoals : null,
                    salesVal: Number.isFinite(qSales) && qSales > 0 ? qSales : null,
                    now,
                    timeStr
                });

                const waiting = Number(q.waiting ?? 0);
                if (Number.isFinite(waiting)) totalWaiting += waiting;

                const waitTime = Number(q.waitMax ?? q.maxWait ?? 0);
                if (Number.isFinite(waitTime)) maxWait = Math.max(maxWait, waitTime);

                const logged = Number(q.loggedIn ?? 0);
                if (Number.isFinite(logged)) totalLoggedIn += logged;

                const notAns = Number(q.callsTodayNotAnswered ?? q.inboundNoAnswer ?? 0);
                if (Number.isFinite(notAns)) totalNotAnswered += notAns;

                // Contradictory Metric Check
                const answered = Number(q.callsTodayAnswered ?? 0);
                const totalCalls = Number(q.callsTodayTotal ?? 0);
                if (answered > totalCalls && totalCalls > 0) {
                    this.recordIntegrityAlert({
                        id: `${this.dialer}_CONTRADICTORY_QUEUE_${qid}_${now}`,
                        metric: "Queue Calls Consistency",
                        status: "CONTRADICTORY",
                        severity: "critical",
                        message: `Queue '${q.name}': answered calls (${answered}) exceeds total calls (${totalCalls})`,
                        timestamp: now,
                        timeStr
                    });
                }
            });

            // ENGINE D: Queue Disappearance Check
            if (this.baselines["inbound_queue_list"]) {
                const prevList = this.baselines["inbound_queue_list"].ids || [];
                const missingIds = prevList.filter(id => !currentQueueIds.has(id));
                if (missingIds.length > 0 && queues.length > 0) {
                    const confirmed = this.confirmAndTriggerAlert({
                        key: "disappeared_queues",
                        metric: "Queue Availability",
                        direction: "INBOUND",
                        targetId: missingIds.join(","),
                        targetName: `${missingIds.length} Queue(s) Missing`,
                        status: "MISSING",
                        previous: prevList.length,
                        current: currentQueueIds.size,
                        absoluteDiff: missingIds.length,
                        percentDiff: `-${Math.round((missingIds.length / prevList.length) * 100)}%`,
                        severity: "critical",
                        confirmationsRequired: 2,
                        message: `Queue ID(s) disappeared from native DOM: ${missingIds.join(", ")}`,
                        now,
                        timeStr
                    });
                    if (confirmed) {
                        this.baselines["inbound_queue_list"] = { ids: Array.from(currentQueueIds), updatedAt: now };
                    }
                } else {
                    this.baselines["inbound_queue_list"] = { ids: Array.from(currentQueueIds), updatedAt: now };
                }
            } else {
                this.baselines["inbound_queue_list"] = { ids: Array.from(currentQueueIds), updatedAt: now };
            }

            // Check Monitored Inbound Operational Aggregates
            this.evaluateOperationalMetric("inbound_active_queues", activeQueues.length, "INBOUND", "ALL", "Active Queues", now, timeStr);
            this.evaluateOperationalMetric("inbound_callers_waiting", totalWaiting, "INBOUND", "ALL", "Inbound Callers Waiting", now, timeStr);
            this.evaluateOperationalMetric("inbound_max_wait", maxWait, "INBOUND", "ALL", "Queue Max Wait Time", now, timeStr);
            this.evaluateOperationalMetric("inbound_agents_logged_in", totalLoggedIn, "INBOUND", "ALL", "Queue Staffing Members", now, timeStr);
            this.evaluateOperationalMetric("inbound_not_answered", totalNotAnswered, "INBOUND", "ALL", "Not Answered Queue Calls", now, timeStr);
        }

        /**
         * Evaluates an operational aggregate against its threshold profile.
         * Distinguishes sudden increase vs sudden decrease vs counter reset.
         */
        evaluateOperationalMetric(profileKey, currentValue, direction, targetId, targetName, now, timeStr) {
            // Rule-level disablement: failed-call volume alerts are strictly disabled
            if (profileKey === "outbound_failed_calls" || profileKey === "failed_calls") return;
            const profile = METRIC_THRESHOLDS[profileKey];
            if (!profile || !Number.isFinite(currentValue)) return;

            const bKey = `metric_${profileKey}_${targetId}`;
            const baseline = this.baselines[bKey];

            // 1. Cold start baseline establishment: NO FALSE ALERTS
            if (!baseline) {
                this.baselines[bKey] = { val: currentValue, updatedAt: now };
                return;
            }

            const previousValue = baseline.val;
            const diff = currentValue - previousValue;

            // 2. Midnight Reset Handling
            if (currentValue === 0 && previousValue > 0) {
                if (this.isMidnightResetWindow()) {
                    // Legitimate daily midnight reset: update baseline downward silently
                    baseline.val = currentValue;
                    baseline.updatedAt = now;
                    return;
                } else {
                    // Unexpected counter reset during operating hours
                    this.recordIntegrityAlert({
                        id: `${this.dialer}_UNEXPECTED_RESET_${profileKey}_${now}`,
                        metric: profile.metric,
                        direction,
                        targetId,
                        targetName,
                        status: "RESET",
                        severity: "warning",
                        previous: previousValue,
                        current: currentValue,
                        absoluteDiff: -previousValue,
                        percentDiff: "-100%",
                        message: `Unexpected counter reset observed outside midnight window for '${profile.metric}' (${previousValue} -> 0)`,
                        timestamp: now,
                        timeStr
                    });
                    baseline.val = currentValue;
                    baseline.updatedAt = now;
                    return;
                }
            }

            const pKeyIncrease = `${profileKey}_increase_${targetId}`;
            const pKeyDecrease = `${profileKey}_decrease_${targetId}`;

            // Check if there was a pending anomaly that has now reverted back to normal
            if (diff === 0) {
                if (this.pendingConfirmations[pKeyIncrease]) delete this.pendingConfirmations[pKeyIncrease];
                if (this.pendingConfirmations[pKeyDecrease]) delete this.pendingConfirmations[pKeyDecrease];
                return;
            }

            // SUDDEN INCREASE CHECK (ENGINE B)
            if (diff > 0 && (profile.increaseAbs !== null || profile.increasePct !== null)) {
                let isAnomaly = false;
                if (profile.increaseAbs !== null && diff >= profile.increaseAbs) {
                    isAnomaly = true;
                }
                if (profile.increasePct !== null && previousValue >= profile.minBaseline && (diff / previousValue) >= profile.increasePct) {
                    isAnomaly = true;
                }

                if (isAnomaly) {
                    const pctStr = previousValue > 0 ? `+${Math.round((diff / previousValue) * 100)}%` : `+${diff}`;
                    const confirmed = this.confirmAndTriggerAlert({
                        key: pKeyIncrease,
                        metric: profile.metric,
                        direction,
                        targetId,
                        targetName,
                        status: "INCREASE",
                        previous: previousValue,
                        current: currentValue,
                        absoluteDiff: diff,
                        percentDiff: pctStr,
                        severity: profile.severity,
                        confirmationsRequired: profile.confirmationsRequired,
                        message: `Sudden increase in ${profile.metric}: ${previousValue} -> ${currentValue} (${pctStr})`,
                        now,
                        timeStr
                    });
                    if (confirmed) {
                        baseline.val = currentValue;
                        baseline.updatedAt = now;
                    }
                    return;
                }
            }

            // SUDDEN DECREASE CHECK (ENGINE C)
            if (diff < 0 && (profile.decreaseAbs !== null || profile.decreasePct !== null)) {
                const drop = Math.abs(diff);
                let isAnomaly = false;
                if (profile.decreaseAbs !== null && drop >= profile.decreaseAbs) {
                    isAnomaly = true;
                }
                if (profile.decreasePct !== null && previousValue >= profile.minBaseline && (drop / previousValue) >= profile.decreasePct) {
                    isAnomaly = true;
                }

                if (isAnomaly) {
                    const pctStr = `-${Math.round((drop / previousValue) * 100)}%`;
                    const confirmed = this.confirmAndTriggerAlert({
                        key: pKeyDecrease,
                        metric: profile.metric,
                        direction,
                        targetId,
                        targetName,
                        status: "DECREASE",
                        previous: previousValue,
                        current: currentValue,
                        absoluteDiff: -drop,
                        percentDiff: pctStr,
                        severity: profile.severity,
                        confirmationsRequired: profile.confirmationsRequired,
                        message: `Sudden decrease in ${profile.metric}: ${previousValue} -> ${currentValue} (${pctStr})`,
                        now,
                        timeStr
                    });
                    if (confirmed) {
                        baseline.val = currentValue;
                        baseline.updatedAt = now;
                    }
                    return;
                }
            }

            // Update rolling baseline for normal variations
            baseline.val = currentValue;
            baseline.updatedAt = now;
        }

        /**
         * Campaign-level Lead Inventory Change Intelligence
         * Detects:
         * 1. NEW LEADS ADDED (+delta)
         * 2. LARGE LEAD INVENTORY REDUCTION (>= 500 drop or >= 10% drop, debounced over 2 observations)
         * 3. OUT OF LEADS (contacts drops to 0, confirmed over 2 observations)
         */
        checkCampaignLeadInventory({ cid, cName, contactsVal, now, timeStr }) {
            const bKey = `campaign_leads_${cid}`;
            const baseline = this.baselines[bKey];

            // Cold start: establish baseline without false alerts
            if (!baseline) {
                this.baselines[bKey] = { val: contactsVal, updatedAt: now };
                return;
            }

            const previousVal = baseline.val;
            const diff = contactsVal - previousVal;

            if (diff === 0) {
                // Clear any pending alerts for this campaign if stable
                const pKeyReduction = `lead_reduction_${cid}`;
                const pKeyZero = `lead_zero_${cid}`;
                if (this.pendingConfirmations[pKeyReduction]) delete this.pendingConfirmations[pKeyReduction];
                if (this.pendingConfirmations[pKeyZero]) delete this.pendingConfirmations[pKeyZero];
                return;
            }

            // 1. POSITIVE CHANGE: NEW LEADS ADDED
            if (diff > 0) {
                const pKeyReduction = `lead_reduction_${cid}`;
                const pKeyZero = `lead_zero_${cid}`;
                if (this.pendingConfirmations[pKeyReduction]) delete this.pendingConfirmations[pKeyReduction];
                if (this.pendingConfirmations[pKeyZero]) delete this.pendingConfirmations[pKeyZero];

                const pctStr = previousVal > 0 ? `+${Math.round((diff / previousVal) * 100)}%` : `+${diff}`;
                const alertId = `${this.dialer}_LEADS_ADDED_${cid}_${previousVal}_${contactsVal}`;
                this.pushActiveAlert({
                    id: alertId,
                    dialer: this.dialer,
                    category: "LEAD_INVENTORY",
                    direction: "OUTBOUND",
                    targetId: cid,
                    targetName: cName,
                    metric: "Lead Inventory",
                    status: "NEW LEADS ADDED",
                    previous: previousVal,
                    current: contactsVal,
                    absoluteDiff: diff,
                    percentDiff: pctStr,
                    severity: "good",
                    message: `NEW LEADS ADDED: ${this.dialer} | ${cName} — Previous inventory: ${previousVal.toLocaleString()}, Current inventory: ${contactsVal.toLocaleString()} (Increase: +${diff.toLocaleString()})`,
                    firstDetectedAt: timeStr,
                    confirmedAt: timeStr,
                    timestamp: now,
                    acknowledged: false
                });
                baseline.val = contactsVal;
                baseline.updatedAt = now;
                return;
            }

            // 2. NEGATIVE CHANGE: REDUCTION OR ZERO
            const drop = Math.abs(diff);

            // A. OUT OF LEADS (exhaustion to 0)
            if (contactsVal === 0 && previousVal > 0) {
                const confirmed = this.confirmAndTriggerAlert({
                    key: `lead_zero_${cid}`,
                    metric: "Lead Inventory",
                    category: "LEAD_INVENTORY",
                    direction: "OUTBOUND",
                    targetId: cid,
                    targetName: cName,
                    status: "OUT OF LEADS",
                    previous: previousVal,
                    current: 0,
                    absoluteDiff: -previousVal,
                    percentDiff: "-100%",
                    severity: "critical",
                    confirmationsRequired: 2,
                    message: `OUT OF LEADS: ${this.dialer} | ${cName} — Lead inventory exhausted to 0 (Previous: ${previousVal.toLocaleString()})`,
                    now,
                    timeStr
                });
                if (confirmed) {
                    baseline.val = 0;
                    baseline.updatedAt = now;
                }
                return;
            }

            // B. LARGE LEAD INVENTORY REDUCTION (>= 500 or >= 10%)
            const isSubstantialDrop = drop >= 500 || (previousVal >= 100 && (drop / previousVal) >= 0.10);
            if (isSubstantialDrop) {
                const pctStr = `-${Math.round((drop / previousVal) * 100)}%`;
                const severity = (drop / previousVal) >= 0.30 ? "critical" : "warning";
                const confirmed = this.confirmAndTriggerAlert({
                    key: `lead_reduction_${cid}`,
                    metric: "Lead Inventory",
                    category: "LEAD_INVENTORY",
                    direction: "OUTBOUND",
                    targetId: cid,
                    targetName: cName,
                    status: "LARGE LEAD INVENTORY REDUCTION",
                    previous: previousVal,
                    current: contactsVal,
                    absoluteDiff: -drop,
                    percentDiff: pctStr,
                    severity: severity,
                    confirmationsRequired: 2,
                    message: `LARGE LEAD INVENTORY REDUCTION: ${this.dialer} | ${cName} — Previous inventory: ${previousVal.toLocaleString()}, Current inventory: ${contactsVal.toLocaleString()} (Reduction: -${drop.toLocaleString()})`,
                    now,
                    timeStr
                });
                if (confirmed) {
                    baseline.val = contactsVal;
                    baseline.updatedAt = now;
                }
                return;
            }

            // C. Minor routine consumption (< 500 and < 10%): update rolling baseline without alert noise
            baseline.val = contactsVal;
            baseline.updatedAt = now;
        }

        /**
         * STAGE 3: Live Filter Change Intelligence
         * Tracks assigned live filter per campaign across observations.
         * Generates persistent alerts on ASSIGNED, REMOVED, or CHANGED with 2-observation confirmation.
         * First observation establishes baseline (no false alert).
         * Unavailable source does NOT overwrite baseline or trigger false removal.
         * Distinct alerts for A -> B -> A transitions.
         */
        checkCampaignLiveFilter({ cid, cName, filterVal, status, source, confidence, now, timeStr }) {
            const pKey = `filter_change_${cid}`;

            // If source is unavailable or unreadable, preserve existing baseline and do not alert
            if (status === "FILTER SOURCE UNAVAILABLE" || filterVal === null || filterVal === undefined) {
                if (this.pendingConfirmations[pKey]) delete this.pendingConfirmations[pKey];
                return null;
            }

            const cleanFilter = String(filterVal).trim();
            if (!cleanFilter) return null;

            const bKey = `campaign_filter_${cid}`;
            const baseline = this.filterBaselines[bKey];

            // 1. Cold start / First observation establishes baseline without false alert
            if (!baseline) {
                this.filterBaselines[bKey] = {
                    filter: cleanFilter,
                    status: status || "OBSERVED",
                    source: source || "TABLE_COLUMN",
                    updatedAt: now
                };
                this.saveState();
                return null;
            }

            const previousFilter = baseline.filter;

            // 2. Unchanged filter: clear any pending confirmation
            if (previousFilter === cleanFilter) {
                if (this.pendingConfirmations[pKey]) delete this.pendingConfirmations[pKey];
                return null;
            }

            // 3. Genuine change detected: require 2 consecutive observations
            const pending = this.pendingConfirmations[pKey];
            if (!pending || pending.targetFilter !== cleanFilter) {
                this.pendingConfirmations[pKey] = {
                    count: 1,
                    targetFilter: cleanFilter,
                    previousFilter: previousFilter,
                    firstDetectedAt: timeStr,
                    timestamp: now
                };
                return null;
            }

            // Second observation confirms the change!
            pending.count += 1;
            if (pending.count < 2) {
                return null;
            }

            delete this.pendingConfirmations[pKey];

            // 4. Determine transition type
            const isPrevEmpty = !previousFilter || previousFilter === "None" || previousFilter === "Unassigned" || previousFilter === "—";
            const isCurrEmpty = !cleanFilter || cleanFilter === "None" || cleanFilter === "Unassigned" || cleanFilter === "—";

            let alertStatus = "LIVE FILTER CHANGED";
            let severity = "critical";
            let message = "";

            if (isPrevEmpty && !isCurrEmpty) {
                alertStatus = "LIVE FILTER ASSIGNED";
                severity = "warning";
                message = `LIVE FILTER ASSIGNED — Campaign: ${cName} — Filter: ${cleanFilter}`;
            } else if (!isPrevEmpty && isCurrEmpty) {
                alertStatus = "LIVE FILTER REMOVED";
                severity = "critical";
                message = `LIVE FILTER REMOVED — Campaign: ${cName} — Previous filter: ${previousFilter}`;
            } else {
                alertStatus = "LIVE FILTER CHANGED";
                severity = "critical";
                message = `LIVE FILTER CHANGED — Campaign: ${cName} — From: [${previousFilter}] — To: [${cleanFilter}]`;
            }

            const alertId = `${this.dialer}_FILTER_CHANGED_${cid}_${encodeURIComponent(previousFilter)}_${encodeURIComponent(cleanFilter)}_${now}`;

            const alertObj = {
                id: alertId,
                dialer: this.dialer,
                category: "LIVE_FILTER",
                direction: "OUTBOUND",
                targetId: cid,
                targetName: cName,
                metric: "Live Filter",
                status: alertStatus,
                previous: previousFilter,
                current: cleanFilter,
                source: source || "TABLE_COLUMN",
                confidence: confidence || "VERIFIED",
                severity: severity,
                message: message,
                firstDetectedAt: pending.firstDetectedAt || timeStr,
                confirmedAt: timeStr,
                timestamp: now,
                acknowledged: false
            };

            this.pushActiveAlert(alertObj);

            // Record into persistent live filter change history
            const historyEntry = {
                campaignId: cid,
                campaignName: cName,
                previousFilter: previousFilter,
                currentFilter: cleanFilter,
                status: alertStatus,
                confirmedAt: timeStr,
                timestamp: now,
                source: source || "TABLE_COLUMN",
                dialer: this.dialer,
                severity: severity
            };
            if (!this.liveFilterChangeHistory) this.liveFilterChangeHistory = [];
            this.liveFilterChangeHistory.unshift(historyEntry);
            if (this.liveFilterChangeHistory.length > 100) {
                this.liveFilterChangeHistory = this.liveFilterChangeHistory.slice(0, 100);
            }

            // Update baseline
            baseline.filter = cleanFilter;
            baseline.status = status || "OBSERVED";
            baseline.source = source || "TABLE_COLUMN";
            baseline.updatedAt = now;
            this.saveState();
            return alertObj;
        }

        /**
         * ENGINE A: Sales & Goals immediate increase detection.
         * Bypasses 2-observation delay; fires immediately on any verified increase.
         */
        checkSalesGoalsAlert({ targetId, targetName, direction, goalsVal, salesVal, now, timeStr }) {
            // Check Goals
            if (goalsVal !== null && Number.isFinite(goalsVal)) {
                const bKey = `goals_${direction}_${targetId}`;
                const baseline = this.baselines[bKey];
                if (!baseline) {
                    this.baselines[bKey] = { val: goalsVal, updatedAt: now };
                } else if (goalsVal > baseline.val) {
                    const increase = goalsVal - baseline.val;
                    const alertId = `${this.dialer}_${direction}_GOALS_${targetId}_${now}_${goalsVal}`;
                    this.pushActiveAlert({
                        id: alertId,
                        dialer: this.dialer,
                        category: "SALES_GOAL",
                        direction,
                        targetId,
                        targetName,
                        metric: "Goals",
                        status: "INCREASE",
                        previous: baseline.val,
                        current: goalsVal,
                        absoluteDiff: increase,
                        percentDiff: baseline.val > 0 ? `+${Math.round((increase / baseline.val) * 100)}%` : `+${increase}`,
                        severity: "good",
                        firstDetectedAt: timeStr,
                        confirmedAt: timeStr,
                        timestamp: now,
                        acknowledged: false
                    });
                    baseline.val = goalsVal;
                } else if (goalsVal < baseline.val) {
                    // Safe downward adjustment on midnight reset
                    baseline.val = goalsVal;
                }
            }

            // Check Sales
            if (salesVal !== null && Number.isFinite(salesVal)) {
                const bKey = `sales_${direction}_${targetId}`;
                const baseline = this.baselines[bKey];
                if (!baseline) {
                    this.baselines[bKey] = { val: salesVal, updatedAt: now };
                } else if (salesVal > baseline.val) {
                    const increase = salesVal - baseline.val;
                    const alertId = `${this.dialer}_${direction}_SALES_${targetId}_${now}_${salesVal}`;
                    this.pushActiveAlert({
                        id: alertId,
                        dialer: this.dialer,
                        category: "SALES_GOAL",
                        direction,
                        targetId,
                        targetName,
                        metric: "Sales",
                        status: "INCREASE",
                        previous: baseline.val,
                        current: salesVal,
                        absoluteDiff: increase,
                        percentDiff: baseline.val > 0 ? `+${Math.round((increase / baseline.val) * 100)}%` : `+${increase}`,
                        severity: "good",
                        firstDetectedAt: timeStr,
                        confirmedAt: timeStr,
                        timestamp: now,
                        acknowledged: false
                    });
                    baseline.val = salesVal;
                } else if (salesVal < baseline.val) {
                    baseline.val = salesVal;
                }
            }
        }

        /**
         * 2-Observation Confirmation Engine for Operational Anomalies
         * Requires two consecutive valid observations of suspicious change before alerting.
         */
        confirmAndTriggerAlert(params) {
            const pending = this.pendingConfirmations[params.key];

            if (!pending) {
                // First observation: enter pending confirmation
                this.pendingConfirmations[params.key] = {
                    count: 1,
                    firstDetectedAt: params.timeStr,
                    params: params
                };
                return false;
            }

            // Second observation: confirmed!
            pending.count += 1;
            if (pending.count >= (params.confirmationsRequired || 2)) {
                const alertId = `${this.dialer}_${params.status}_${params.key}_${params.now}`;
                this.pushActiveAlert({
                    id: alertId,
                    dialer: this.dialer,
                    category: params.category || (params.status.includes("LEAD") || params.metric === "Lead Inventory" ? "LEAD_INVENTORY" : (params.status === "INCREASE" ? "SUDDEN_INCREASE" : params.status === "DECREASE" ? "SUDDEN_DECREASE" : "INTEGRITY")),
                    direction: params.direction,
                    targetId: params.targetId,
                    targetName: params.targetName,
                    metric: params.metric,
                    status: params.status,
                    previous: params.previous,
                    current: params.current,
                    absoluteDiff: params.absoluteDiff,
                    percentDiff: params.percentDiff,
                    severity: params.severity || "warning",
                    message: params.message,
                    firstDetectedAt: pending.firstDetectedAt,
                    confirmedAt: params.timeStr,
                    timestamp: params.now,
                    acknowledged: false
                });

                delete this.pendingConfirmations[params.key];
                return true;
            }
            return false;
        }

        recordIntegrityAlert(params) {
            // Check deduplication (do not fire duplicate integrity alert within 60 seconds)
            const recentDuplicate = this.activeAlerts.find(a => 
                a.category === "INTEGRITY" && 
                a.metric === params.metric && 
                (params.timestamp - a.timestamp) < 60000
            );
            if (recentDuplicate) return;

            this.pushActiveAlert({
                id: params.id,
                dialer: this.dialer,
                category: "INTEGRITY",
                direction: "SYSTEM",
                targetId: "SYSTEM",
                targetName: "System Integrity",
                metric: params.metric,
                status: params.status,
                previous: params.previous ?? "—",
                current: params.current ?? "—",
                absoluteDiff: params.absoluteDiff ?? "—",
                percentDiff: params.percentDiff ?? "—",
                severity: params.severity || "critical",
                message: params.message,
                firstDetectedAt: params.timeStr,
                confirmedAt: params.timeStr,
                timestamp: params.timestamp,
                acknowledged: false
            });
        }

        pushActiveAlert(alertObj) {
            if (!alertObj || alertObj.metric === "Failed Call Volume" || alertObj.profileKey === "outbound_failed_calls") {
                return; // Suppressed at rule generation level
            }
            // Duplicate Suppression: check if alert with same target and metric is already active
            const exists = this.activeAlerts.some(a => a.id === alertObj.id || (
                a.targetId === alertObj.targetId && 
                a.metric === alertObj.metric && 
                a.current === alertObj.current &&
                !a.acknowledged
            ));
            if (exists) return;

            this.activeAlerts.unshift(alertObj); // Pinned to top
            this.history.unshift(Object.assign({}, alertObj));
            this.saveState();
        }

        /**
         * Operator Acknowledgement via [NOTED]
         * Moves targeted alert to acknowledged archive without deleting history.
         */
        acknowledgeAlert(alertId) {
            const alert = this.activeAlerts.find(a => a.id === alertId);
            if (alert) {
                alert.acknowledged = true;
                alert.acknowledgedAt = new Date().toLocaleTimeString();
            }

            // Remove from active alerts display
            this.activeAlerts = this.activeAlerts.filter(a => a.id !== alertId);

            // Update history entry
            const histItem = this.history.find(h => h.id === alertId);
            if (histItem) {
                histItem.acknowledged = true;
                histItem.acknowledgedAt = new Date().toLocaleTimeString();
            }

            this.saveState();
            return alert;
        }

        /**
         * Dismiss active alert alias for operator acknowledgement.
         */
        dismissActiveAlert(alertId) {
            return this.acknowledgeAlert(alertId);
        }

        /**
         * Clears all currently dismissible (non-goal) active alerts.
         * Moves them to acknowledged archive and removes them from active display.
         * Preserves SALES_GOAL alerts which strictly require manual [NOTED].
         */
        clearAllDismissibleAlerts() {
            const nowTime = new Date().toLocaleTimeString();
            const dismissible = this.activeAlerts.filter(a => a.category !== "SALES_GOAL");
            dismissible.forEach(alert => {
                alert.acknowledged = true;
                alert.acknowledgedAt = nowTime;
                const hist = this.history.find(h => h.id === alert.id);
                if (hist) {
                    hist.acknowledged = true;
                    hist.acknowledgedAt = nowTime;
                }
            });
            // Keep only unacknowledged SALES_GOAL alerts
            this.activeAlerts = this.activeAlerts.filter(a => a.category === "SALES_GOAL" && !a.acknowledged);
            this.saveState();
            return this.activeAlerts;
        }

        /**
         * Clears transient non-persistent alerts.
         * In strict compliance with Rule 7, ALL Intelligence Alerts remain active until NOTED!
         */
        clearActionCenterPreservingIntelligence() {
            // Backward-compatible method: preserves active intelligence alerts
            return this.activeAlerts;
        }

        /**
         * Searchable and filterable history retrieval
         */
        getFilteredHistory(filters = {}) {
            return this.history.filter(item => {
                if (filters.dialer && item.dialer !== filters.dialer) return false;
                if (filters.direction && item.direction !== filters.direction) return false;
                if (filters.category && item.category !== filters.category) return false;
                if (filters.severity && item.severity !== filters.severity) return false;
                if (filters.acknowledged !== undefined && item.acknowledged !== filters.acknowledged) return false;
                if (filters.search) {
                    const q = String(filters.search).toLowerCase();
                    const match = (item.targetName && item.targetName.toLowerCase().includes(q)) ||
                                  (item.metric && item.metric.toLowerCase().includes(q)) ||
                                  (item.message && item.message.toLowerCase().includes(q));
                    if (!match) return false;
                }
                return true;
            });
        }

        /**
         * Live Filter Intelligence Summary & Synthesis Engine
         * Synthesizes Live Filter Inventory, Campaign Assignment Matrix,
         * Verified Change History, and Data Health.
         */
        getLiveFilterIntelligenceSummary(stats = {}) {
            const now = Date.now();
            let inventory = { items: {}, lastObservedAt: null, totalCount: 0 };
            let verifiedRegistry = {};

            if (this.storage) {
                try {
                    const rawInv = this.storage.getItem(this.LIVE_FILTERS_INVENTORY_KEY);
                    if (rawInv) inventory = JSON.parse(rawInv);
                } catch (e) {}
                try {
                    const rawReg = this.storage.getItem(this.VERIFIED_FILTERS_KEY);
                    if (rawReg) verifiedRegistry = JSON.parse(rawReg);
                } catch (e) {}
            }

            const items = inventory.items || {};
            const filterList = Object.values(items);
            const hasInventory = filterList.length > 0 && Boolean(inventory.lastObservedAt);
            const totalFilters = hasInventory ? filterList.length : null;
            const activeFilters = hasInventory ? filterList.filter(f => f.active === true || f.active === "true" || String(f.active).toLowerCase() === "true").length : null;
            const totalContacts = hasInventory ? filterList.reduce((sum, f) => sum + (Number(f.count) || 0), 0) : null;

            // Campaign evaluation
            const campaigns = (stats && Array.isArray(stats.campaigns)) ? stats.campaigns : [];
            let runningCampaignsCount = 0;
            let verifiedActiveConfigs = 0;
            let staleCount = 0;
            let missingVerificationCount = 0;

            const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

            const matrix = campaigns.map((c, idx) => {
                // Strict Real ID: Never fabricate synthetic campaign-0
                const realId = (c.id && String(c.id).trim() !== "") ? String(c.id).trim() :
                               (c.rawId && String(c.rawId).trim() !== "") ? String(c.rawId).trim() :
                               (c.__id && !String(c.__id).startsWith("campaign-") ? String(c.__id).trim() : null);
                const displayId = realId || "Awaiting ID";
                const cName = String(c.name || c.__name || (realId ? `Campaign ${realId}` : "Unnamed Campaign")).trim();

                // Robust running state calculation
                const agents = Number(c.loggedIn ?? c.__loggedIn ?? c._metrics?.loggedIn?.value ?? c.agents ?? c.__agents ?? 0);
                const rawState = String(c.state || c.__state || "").trim().toUpperCase();
                const isActiveBool = c.active === true || c.__active === true || c.__operational === true;
                const isRunning = isActiveBool || rawState === "ACTIVE" || rawState === "RUNNING" || agents > 0;
                if (isRunning) runningCampaignsCount++;

                // Lookup verified assignment by real ID first, then name
                let entry = null;
                if (realId && verifiedRegistry[realId]) {
                    entry = verifiedRegistry[realId];
                } else if (cName) {
                    if (verifiedRegistry[cName]) {
                        entry = verifiedRegistry[cName];
                    } else {
                        for (const k of Object.keys(verifiedRegistry)) {
                            if (verifiedRegistry[k] && verifiedRegistry[k].campaignName &&
                                String(verifiedRegistry[k].campaignName).trim().toLowerCase() === cName.toLowerCase()) {
                                entry = verifiedRegistry[k];
                                break;
                            }
                        }
                    }
                }

                let assignedFilter = null;
                let rawFilter = null;
                let filterCount = null;
                let filterId = null;
                let verification = "DOM_UNAVAILABLE";
                let usageStatus = "UNKNOWN";
                let observationTime = null;
                let isStale = false;

                if (entry) {
                    observationTime = entry.timestamp || entry.observedAt || null;
                    const age = observationTime ? (now - observationTime) : 0;
                    const FRESHNESS_WINDOW_MS = 120 * 1000; // 120 seconds freshness window
                    isStale = age > FRESHNESS_WINDOW_MS;
                    if (isStale) staleCount++;

                    rawFilter = entry.rawLiveFilter || entry.liveFilter || entry.filter || null;
                    assignedFilter = entry.liveFilter || entry.filter || null;
                    filterCount = entry.filterCount !== undefined ? entry.filterCount : null;

                    if (filterCount === null && rawFilter) {
                        const mCount = String(rawFilter).match(/[\(\[]\s*(?:Count|Contacts)?\s*:?\s*([0-9,]+)\s*[\)\]]/i);
                        if (mCount && mCount[1]) {
                            filterCount = Number(mCount[1].replace(/,/g, ""));
                            assignedFilter = String(rawFilter).replace(/[\(\[]\s*(?:Count|Contacts)?\s*:?\s*[0-9,]+\s*[\)\]]/i, "").trim();
                        }
                    }

                    filterId = entry.liveFilterId || entry.filterId || null;
                    verification = entry.source === "CAMPAIGN_EDIT_FORM" ? "VERIFIED (Edit)" :
                                   entry.source === "CAMPAIGN_EDIT_DOM" ? "VERIFIED (Edit)" :
                                   entry.source === "ACTIVE_OVERLAY" ? "VERIFIED (Overlay)" :
                                   (entry.source || "VERIFIED (Registry)");
                } else if (c.liveFilter) {
                    rawFilter = c.liveFilter;
                    assignedFilter = c.liveFilter;
                    const mCount = String(assignedFilter).match(/[\(\[]\s*(?:Count|Contacts)?\s*:?\s*([0-9,]+)\s*[\)\]]/i);
                    if (mCount && mCount[1]) {
                        filterCount = Number(mCount[1].replace(/,/g, ""));
                        assignedFilter = String(assignedFilter).replace(/[\(\[]\s*(?:Count|Contacts)?\s*:?\s*[0-9,]+\s*[\)\]]/i, "").trim();
                    }
                    verification = c.liveFilterSource === "ACTIVE_OVERLAY" ? "VERIFIED (Overlay)" :
                                   c.liveFilterSource === "TABLE_COLUMN" ? "VERIFIED (Table)" :
                                   (c.liveFilterSource || "VERIFIED");
                    observationTime = c.liveFilterTimestamp || now;
                }

                const hasFilter = Boolean(assignedFilter && assignedFilter !== "None" && assignedFilter !== "Unassigned" && assignedFilter !== "—" && assignedFilter !== "FILTER SOURCE UNAVAILABLE");

                if (isStale) {
                    usageStatus = "STALE";
                } else if (!hasFilter) {
                    if (assignedFilter === "None" || assignedFilter === "Unassigned") {
                        usageStatus = "UNASSIGNED";
                        verification = "VERIFIED (None)";
                    } else {
                        usageStatus = isRunning ? "UNKNOWN" : "IDLE";
                        if (isRunning) missingVerificationCount++;
                    }
                } else {
                    if (isRunning) {
                        usageStatus = "VERIFIED ACTIVE";
                        verifiedActiveConfigs++;
                    } else {
                        usageStatus = "STANDBY";
                    }
                }

                const leadsVal = (c.contacts && typeof c.contacts === "object" && c.contacts.value !== undefined) ? c.contacts.value :
                                 (c._metrics && c._metrics.contacts && c._metrics.contacts.value !== undefined) ? c._metrics.contacts.value :
                                 (c.contacts !== undefined && c.contacts !== null && c.contacts !== "" && !isNaN(Number(c.contacts))) ? Number(c.contacts) :
                                 (c.contactCount !== undefined ? c.contactCount : null);

                const ageSec = observationTime ? Math.max(0, Math.floor((now - observationTime) / 1000)) : null;
                let freshness = "UNOBSERVED";
                if (observationTime) {
                    if (isStale || ageSec > 120) freshness = "STALE";
                    else if (ageSec <= 30) freshness = "LIVE";
                    else freshness = "RECENT";
                }

                return {
                    campaignId: displayId,
                    rawId: realId,
                    campaignName: cName,
                    state: isRunning ? (agents > 0 ? "RUNNING" : "ACTIVE") : (isActiveBool ? "ACTIVE" : (rawState || "IDLE")),
                    agents: agents,
                    campaignLeadPool: leadsVal !== null ? leadsVal : "UNAVAILABLE",
                    assignedFilter: hasFilter ? assignedFilter : (assignedFilter === "None" ? "None Assigned" : "Filter Unavailable"),
                    rawAssignedFilter: rawFilter,
                    filterCount: filterCount,
                    filterCountSource: filterCount !== null ? "TARGETING_SNAPSHOT" : "UNAVAILABLE",
                    leadList: c.leadList || "UNAVAILABLE",
                    verification: !realId && verification.startsWith("DOM_UNAVAILABLE") ? "UNVERIFIED_DOM (Awaiting ID)" : verification,
                    usageStatus: usageStatus,
                    lastObserved: observationTime,
                    lastObservedTimeStr: observationTime ? new Date(observationTime).toLocaleTimeString() : "—",
                    freshness: freshness,
                    ageSec: ageSec,
                    lastRefill: "Not exposed by available source",
                    leads: leadsVal !== null ? leadsVal : "UNAVAILABLE",
                    dialer: this.dialer
                };
            });

            let inventoryFreshness = "Awaiting observation (/manager/live-filters)";
            if (inventory.lastObservedAt) {
                const diffSec = Math.floor((now - inventory.lastObservedAt) / 1000);
                if (diffSec < 60) inventoryFreshness = `Fresh (${diffSec}s ago)`;
                else if (diffSec < 3600) inventoryFreshness = `${Math.floor(diffSec / 60)}m ago`;
                else inventoryFreshness = `${Math.floor(diffSec / 3600)}h ago`;
            }

            const inactiveFilters = (totalFilters !== null && activeFilters !== null) ? Math.max(0, totalFilters - activeFilters) : null;
            return {
                summary: {
                    totalFilters,
                    activeFilters,
                    inactiveFilters,
                    availableContacts: totalContacts,
                    totalContacts,
                    runningCampaignsCount,
                    verifiedActiveConfigurations: verifiedActiveConfigs
                },
                inventory: filterList.map(f => ({
                    id: f.id,
                    rawId: f.rawId || null,
                    name: f.name,
                    status: (f.active === true || f.active === "true" || String(f.active).toLowerCase() === "true") ? "ACTIVE" : "INACTIVE",
                    count: Number(f.count) || 0,
                    totalCount: Number(f.totalCount) || Number(f.count) || 0,
                    dialer: this.dialer,
                    observedAt: f.observedAt,
                    lastRefill: "Not exposed by available source"
                })),
                assignmentMatrix: matrix,
                changeHistory: (this.liveFilterChangeHistory || []).slice(0, 20),
                leadListDetails: matrix.map(m => ({
                    campaignName: m.campaignName,
                    campaignId: m.campaignId,
                    leadList: m.leadList !== "UNAVAILABLE" ? m.leadList : "Not exposed by available source",
                    contactPool: m.leads,
                    nativeRefillStatus: "Native refill time: Not available from permitted source",
                    observationTime: m.lastObserved
                })),
                health: {
                    dialer: this.dialer,
                    inventoryFreshness,
                    lastObservedAt: inventory.lastObservedAt || null,
                    staleCount,
                    missingVerificationCount,
                    hasInventory: hasInventory,
                    inventoryStatus: hasInventory ? "OBSERVED" : "AWAITING_OBSERVATION",
                    missingPages: hasInventory ? [] : ["/manager/live-filters"]
                }
            };
        }

        getRefreshHistory() {
            try {
                const raw = this.storage ? this.storage.getItem(this.prefix + "refresh_history_v1") : null;
                return raw ? JSON.parse(raw) : [];
            } catch (e) {
                return [];
            }
        }

        recordRefreshResult(record) {
            try {
                const history = this.getRefreshHistory();
                history.unshift(Object.assign({
                    timestamp: Date.now(),
                    dialer: this.dialer
                }, record));
                const trimmed = history.slice(0, 30);
                if (this.storage) {
                    this.storage.setItem(this.prefix + "refresh_history_v1", JSON.stringify(trimmed));
                }
                return trimmed;
            } catch (e) {
                return [];
            }
        }
    }

    return {
        CTDataIntelligenceEngine,
        METRIC_THRESHOLDS
    };
}));
