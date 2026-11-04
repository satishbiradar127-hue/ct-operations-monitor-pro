// ===============================================================================
// CT DATA CHANGE INTELLIGENCE ENGINE (v11.3.0)
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
        outbound_failed_calls: {
            direction: "OUTBOUND",
            metric: "Failed Call Volume",
            minBaseline: 10,
            increaseAbs: 35,      // Spike of 35 failed attempts
            increasePct: 0.40,
            decreaseAbs: null,
            decreasePct: null,
            severity: "critical",
            confirmationsRequired: 2,
            description: "Telephony carrier or trunk failure anomalies"
        },

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
            this.dialer = options.dialer || "EAST-3";
            this.prefix = options.prefix || "ct_east3_";
            this.storage = options.storage || (typeof localStorage !== "undefined" ? localStorage : null);

            // Storage Keys
            this.BASELINES_KEY = this.prefix + "intelligence_baselines_v1";
            this.PENDING_KEY = this.prefix + "intelligence_pending_v1";
            this.ALERTS_KEY = this.prefix + "intelligence_alerts_v1";
            this.HISTORY_KEY = this.prefix + "intelligence_history_v1";

            // In-Memory State
            this.baselines = {};
            this.pendingConfirmations = {}; // targetKey -> { count, firstDetectedAt, value, ... }
            this.activeAlerts = [];
            this.history = [];

            this.loadState();
        }

        loadState() {
            if (!this.storage) return;
            try {
                this.baselines = JSON.parse(this.storage.getItem(this.BASELINES_KEY) || "{}");
                this.pendingConfirmations = JSON.parse(this.storage.getItem(this.PENDING_KEY) || "{}");
                this.activeAlerts = JSON.parse(this.storage.getItem(this.ALERTS_KEY) || "[]");
                this.history = JSON.parse(this.storage.getItem(this.HISTORY_KEY) || "[]");
            } catch (e) {
                console.error("CTDataIntelligence failed to load state from storage:", e);
                this.baselines = {};
                this.pendingConfirmations = {};
                this.activeAlerts = [];
                this.history = [];
            }
        }

        saveState() {
            if (!this.storage) return;
            try {
                this.storage.setItem(this.BASELINES_KEY, JSON.stringify(this.baselines));
                this.storage.setItem(this.PENDING_KEY, JSON.stringify(this.pendingConfirmations));
                this.storage.setItem(this.ALERTS_KEY, JSON.stringify(this.activeAlerts));
                this.storage.setItem(this.HISTORY_KEY, JSON.stringify(this.history.slice(-500))); // Keep last 500 events
            } catch (e) {
                console.error("CTDataIntelligence failed to persist state:", e);
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

                // Per-campaign aggregations
                const leads = Number(c.contacts ?? c.__contacts ?? 0);
                if (Number.isFinite(leads)) totalLeads += leads;

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
            this.evaluateOperationalMetric("outbound_failed_calls", totalFailed, "OUTBOUND", "ALL", "Failed Call Volume", now, timeStr);
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
                    category: params.status === "INCREASE" ? "SUDDEN_INCREASE" : params.status === "DECREASE" ? "SUDDEN_DECREASE" : "INTEGRITY",
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
         * Clears transient non-persistent alerts.
         * In strict compliance with Rule 7, ALL Intelligence Alerts remain active until NOTED!
         */
        clearActionCenterPreservingIntelligence() {
            // Intelligence alerts are NEVER auto-dismissed by Clear All.
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
    }

    return {
        CTDataIntelligenceEngine,
        METRIC_THRESHOLDS
    };
}));
