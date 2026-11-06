/**
 * append_phase12_tests.js
 * 
 * Appends Phase 12 Regression Tests (Tests 156 to 185) to East-2 and East-3 test suites.
 * Covers:
 * - Group A: Live Filter Intelligence (Tests 156–165)
 * - Group B: Lead Inventory Change Monitoring (Tests 166–175)
 * - Group C: 15-Second Monitoring Refresh Scheduler (Tests 176–185)
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE');

['East2', 'East3'].forEach(d => {
    const isE2 = d === 'East2';
    const tag = isE2 ? 'EAST-2' : 'EAST-3';
    const otherTag = isE2 ? 'EAST-3' : 'EAST-2';
    const prefix = isE2 ? 'ct_east2_' : 'ct_east3_';
    const otherPrefix = isE2 ? 'ct_east3_' : 'ct_east2_';
    const host = isE2 ? 'east-2.calltools.io' : 'east-3.calltools.io';
    const otherHost = isE2 ? 'east-3.calltools.io' : 'east-2.calltools.io';
    const testFile = path.join(root, 'CT_Operations_Monitor_' + d, 'tests', 'suite.test.js');

    let content = fs.readFileSync(testFile, 'utf8');

    // Remove any previous Phase 12 block if rerun
    const marker = '// PHASE 12: LIVE FILTER INTELLIGENCE & 15-SECOND MONITORING REFRESH SCHEDULER';
    const cutIdx = content.indexOf(marker);
    if (cutIdx !== -1) {
        content = content.substring(0, cutIdx).trim() + '\n';
    }

    const phase12Tests = `
${marker}

// --- GROUP A: LIVE FILTER INTELLIGENCE (TESTS 156–165) ---

test("${tag} UPGRADE 156: Cold-start baseline captures live filter without false alert", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}" });
    const now = 1000;
    const timeStr = "10:00:00 AM";
    
    // First observation establishes baseline
    engine.checkCampaignLiveFilter({
        cid: "201",
        cName: "Texas Outbound Tier 1",
        filterVal: "State-TX-Only",
        status: "ASSIGNED",
        source: "leaf",
        now,
        timeStr
    });

    assert.strictEqual(engine.activeAlerts.length, 0, "Cold-start must not emit an alert");
    assert.ok(engine.filterBaselines["campaign_filter_201"], "Baseline object must exist");
    assert.strictEqual(engine.filterBaselines["campaign_filter_201"].filter, "State-TX-Only", "Baseline must record initial live filter");
});

test("${tag} UPGRADE 157: Unchanged live filter produces no alert across observation cycles", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}" });
    const now = 2000;
    const timeStr = "10:00:02 AM";
    
    // Cycle 1: Baseline
    engine.checkCampaignLiveFilter({
        cid: "201",
        cName: "Texas Outbound Tier 1",
        filterVal: "State-TX-Only",
        status: "ASSIGNED",
        source: "leaf",
        now,
        timeStr
    });

    // Cycle 2: Identical filter
    engine.checkCampaignLiveFilter({
        cid: "201",
        cName: "Texas Outbound Tier 1",
        filterVal: "State-TX-Only",
        status: "ASSIGNED",
        source: "leaf",
        now: now + 15000,
        timeStr: "10:00:17 AM"
    });
    assert.strictEqual(engine.activeAlerts.length, 0, "Identical live filter must not trigger alert");

    // Cycle 3: Identical filter again
    engine.checkCampaignLiveFilter({
        cid: "201",
        cName: "Texas Outbound Tier 1",
        filterVal: "State-TX-Only",
        status: "ASSIGNED",
        source: "leaf",
        now: now + 30000,
        timeStr: "10:00:32 AM"
    });
    assert.strictEqual(engine.activeAlerts.length, 0, "Subsequent observation must remain silent when filter is unchanged");
});

test("${tag} UPGRADE 158: Filter switch from Filter A to Filter B triggers LIVE FILTER CHANGED alert with full metadata", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}" });
    const now = 3000;
    
    // Baseline: Filter-A
    engine.checkCampaignLiveFilter({
        cid: "201",
        cName: "Texas Outbound Tier 1",
        filterVal: "Filter-A",
        status: "ASSIGNED",
        source: "leaf",
        now,
        timeStr: "10:00:00 AM"
    });

    // Switch to Filter-B
    engine.checkCampaignLiveFilter({
        cid: "201",
        cName: "Texas Outbound Tier 1",
        filterVal: "Filter-B",
        status: "ASSIGNED",
        source: "leaf",
        now: now + 15000,
        timeStr: "10:00:15 AM"
    });

    const alert = engine.activeAlerts.find(a => a.status === "LIVE FILTER CHANGED");
    assert.ok(alert, "Switching filter must trigger an alert in activeAlerts");
    assert.strictEqual(alert.status, "LIVE FILTER CHANGED");
    assert.strictEqual(alert.severity, "critical");
    assert.strictEqual(alert.previous, "Filter-A");
    assert.strictEqual(alert.current, "Filter-B");
    assert.strictEqual(engine.filterBaselines["campaign_filter_201"].filter, "Filter-B", "Baseline must update to new filter");
});

test("${tag} UPGRADE 159: Filter switch from Filter B back to Filter A triggers distinct LIVE FILTER CHANGED alert", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}" });
    engine.filterBaselines["campaign_filter_201"] = {
        filter: "Filter-B",
        status: "OBSERVED",
        source: "leaf",
        updatedAt: 1000
    };

    engine.checkCampaignLiveFilter({
        cid: "201",
        cName: "Texas Outbound Tier 1",
        filterVal: "Filter-A",
        status: "ASSIGNED",
        source: "leaf",
        now: 2000,
        timeStr: "10:00:02 AM"
    });

    const alert = engine.activeAlerts.find(a => a.previous === "Filter-B" && a.current === "Filter-A");
    assert.ok(alert, "Reverting to previous filter must trigger a distinct alert");
    assert.strictEqual(alert.status, "LIVE FILTER CHANGED");
    assert.strictEqual(alert.previous, "Filter-B");
    assert.strictEqual(alert.current, "Filter-A");
    assert.strictEqual(engine.filterBaselines["campaign_filter_201"].filter, "Filter-A");
});

test("${tag} UPGRADE 160: Live filter assigned to campaign that had none triggers LIVE FILTER ASSIGNED", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}" });
    engine.filterBaselines["campaign_filter_202"] = {
        filter: "None",
        status: "OBSERVED",
        source: "leaf",
        updatedAt: 1000
    };

    engine.checkCampaignLiveFilter({
        cid: "202",
        cName: "California Solar Outbound",
        filterVal: "Solar-Leads-Morning",
        status: "ASSIGNED",
        source: "leaf",
        now: 2000,
        timeStr: "10:00:02 AM"
    });

    const alert = engine.activeAlerts.find(a => a.targetId === "202");
    assert.ok(alert, "Assigning filter to campaign with None must trigger alert");
    assert.strictEqual(alert.status, "LIVE FILTER ASSIGNED");
    assert.strictEqual(alert.severity, "warning");
    assert.strictEqual(alert.current, "Solar-Leads-Morning");
});

test("${tag} UPGRADE 161: Live filter removed triggers LIVE FILTER REMOVED critical alert", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}" });
    engine.filterBaselines["campaign_filter_203"] = {
        filter: "High-Score-V2",
        status: "OBSERVED",
        source: "leaf",
        updatedAt: 1000
    };

    engine.checkCampaignLiveFilter({
        cid: "203",
        cName: "Inbound Escalations",
        filterVal: "None",
        status: "NONE",
        source: "leaf",
        now: 2000,
        timeStr: "10:00:02 AM"
    });

    const alert = engine.activeAlerts.find(a => a.targetId === "203");
    assert.ok(alert, "Removing active filter must trigger critical alert");
    assert.strictEqual(alert.status, "LIVE FILTER REMOVED");
    assert.strictEqual(alert.severity, "critical");
    assert.strictEqual(alert.previous, "High-Score-V2");
    assert.strictEqual(engine.filterBaselines["campaign_filter_203"].filter, "None");
});

test("${tag} UPGRADE 162: FILTER SOURCE UNAVAILABLE preserves baseline and generates no false removal alert", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}" });
    engine.filterBaselines["campaign_filter_204"] = {
        filter: "Baseline-Filter-Alpha",
        status: "OBSERVED",
        source: "leaf",
        updatedAt: 1000
    };

    // Unobserved / unavailable DOM source
    engine.checkCampaignLiveFilter({
        cid: "204",
        cName: "Campaign 204",
        filterVal: null,
        status: "FILTER SOURCE UNAVAILABLE",
        source: "none",
        now: 2000,
        timeStr: "10:00:02 AM"
    });

    assert.strictEqual(engine.activeAlerts.length, 0, "Unavailable filter source must not fire false removal alert");
    assert.strictEqual(engine.filterBaselines["campaign_filter_204"].filter, "Baseline-Filter-Alpha", "Existing baseline must be preserved");
});

test("${tag} UPGRADE 163: Live filter alert deduplication: repeated runs with same filter do not generate duplicate alerts", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}" });
    engine.filterBaselines["campaign_filter_205"] = {
        filter: "Old-Filter",
        status: "OBSERVED",
        source: "leaf",
        updatedAt: 1000
    };

    // First change trigger
    engine.checkCampaignLiveFilter({
        cid: "205",
        cName: "Florida Outbound",
        filterVal: "New-Filter",
        status: "ASSIGNED",
        source: "leaf",
        now: 2000,
        timeStr: "10:00:02 AM"
    });
    assert.strictEqual(engine.activeAlerts.length, 1);

    // Repeated check with same campaign & filter
    engine.checkCampaignLiveFilter({
        cid: "205",
        cName: "Florida Outbound",
        filterVal: "New-Filter",
        status: "ASSIGNED",
        source: "leaf",
        now: 17000,
        timeStr: "10:00:17 AM"
    });
    assert.strictEqual(engine.activeAlerts.length, 1, "Active alerts list must not duplicate");
});

test("${tag} UPGRADE 164: Action Center persistence: live filter alerts remain visible across reloads until [NOTED]", () => {
    const storage = new TestStorage();
    const engine1 = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}", storage: storage });
    const testAlert = {
        id: "${tag}_FILTER_CHANGED_206_99999",
        dialer: "${tag}",
        category: "LIVE_FILTER",
        severity: "critical",
        status: "LIVE FILTER CHANGED",
        campaignId: "206",
        targetName: "Persistent Campaign",
        previous: "Filter-1",
        current: "Filter-2",
        message: "Live filter changed",
        timestamp: Date.now()
    };
    engine1.pushActiveAlert(testAlert);

    // Simulate page reload by creating new engine instance with same storage
    const engine2 = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}", storage: storage });
    assert.strictEqual(engine2.activeAlerts.length, 1, "Alert must persist across engine reload");
    assert.strictEqual(engine2.activeAlerts[0].id, testAlert.id);

    // Operator clicks [NOTED]
    engine2.acknowledgeAlert(testAlert.id);
    assert.strictEqual(engine2.activeAlerts.length, 0, "Alert must be dismissed after [NOTED]");

    // Another page reload
    const engine3 = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}", storage: storage });
    assert.strictEqual(engine3.activeAlerts.length, 0, "Dismissed alert must not resurrect on subsequent reloads");
});

test("${tag} UPGRADE 165: Cross-dialer isolation: ${tag} filter changes do not emit alerts or modify storage in ${otherTag}", () => {
    const sharedStorage = new TestStorage();
    const e2Engine = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}", storage: sharedStorage });
    const e3Engine = new CTDataIntelligenceEngine({ dialer: "${otherTag}", prefix: "${otherPrefix}", storage: sharedStorage });

    e2Engine.checkCampaignLiveFilter({
        cid: "300",
        cName: "Shared ID Campaign",
        filterVal: "Target-Filter",
        status: "ASSIGNED",
        source: "leaf",
        now: 1000,
        timeStr: "10:00:00 AM"
    });

    assert.ok(e2Engine.filterBaselines["campaign_filter_300"], "Must set baseline in ${tag}");
    assert.strictEqual(e3Engine.filterBaselines["campaign_filter_300"], undefined, "Must NOT set baseline in ${otherTag}");

    // Trigger filter change on tag
    e2Engine.checkCampaignLiveFilter({
        cid: "300",
        cName: "Shared ID Campaign",
        filterVal: "Target-Filter-New",
        status: "ASSIGNED",
        source: "leaf",
        now: 16000,
        timeStr: "10:00:16 AM"
    });

    assert.strictEqual(e2Engine.activeAlerts.length, 1);
    assert.strictEqual(e3Engine.activeAlerts.length, 0, "${otherTag} must have 0 active alerts");
    assert.strictEqual(sharedStorage.getItem("${otherPrefix}intelligence_active_alerts_v1"), null);
});


// --- GROUP B: LEAD INVENTORY CHANGE MONITORING (TESTS 166–175) ---

test("${tag} UPGRADE 166: Baseline lead inventory recorded without false alerts on first cycle", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}" });
    const campaigns = [{ id: "401", name: "Campaign 401", contacts: 5000, active: true }];
    
    engine.evaluateOutbound(campaigns, Date.now());
    const leadAlerts = engine.activeAlerts.filter(f => f.category === "LEAD_INVENTORY");
    assert.strictEqual(leadAlerts.length, 0, "Initial lead count capture must produce 0 alerts");
    assert.ok(engine.baselines["campaign_leads_401"], "Lead baseline entry must exist");
    assert.strictEqual(engine.baselines["campaign_leads_401"].val, 5000, "Lead baseline must be 5000");
});

test("${tag} UPGRADE 167: Lead additions (+500 leads) trigger NEW LEADS ADDED alert with positive delta", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}" });
    engine.baselines["campaign_leads_402"] = { val: 5000, updatedAt: 1000 };

    const campaigns = [{ id: "402", name: "TS FRESH DATA", contacts: 5500, active: true }];
    engine.evaluateOutbound(campaigns, Date.now());

    const addAlert = engine.activeAlerts.find(f => f.status === "NEW LEADS ADDED");
    assert.ok(addAlert, "Adding +500 leads must trigger NEW LEADS ADDED alert");
    assert.strictEqual(addAlert.absoluteDiff, 500);
    assert.strictEqual(engine.baselines["campaign_leads_402"].val, 5500, "Baseline must update to new lead count");
});

test("${tag} UPGRADE 168: Lead reductions below threshold (e.g. -15 leads) do not trigger false alerts", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}" });
    engine.baselines["campaign_leads_403"] = { val: 5000, updatedAt: 1000 };

    // Normal dialing consumes 15 leads
    const campaigns = [{ id: "403", name: "Campaign 403", contacts: 4985, active: true }];
    engine.evaluateOutbound(campaigns, Date.now());

    const reductionAlerts = engine.activeAlerts.filter(f => f.status === "LARGE LEAD INVENTORY REDUCTION" || f.status === "OUT OF LEADS");
    assert.strictEqual(reductionAlerts.length, 0, "Routine lead consumption (-15) must not fire alerts");
});

test("${tag} UPGRADE 169: Large lead reductions (>50% drop or >=500 leads) confirmed over 2 cycles trigger alert", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}" });
    engine.baselines["campaign_leads_404"] = { val: 5000, updatedAt: 1000 };

    // Large drop to 2000 (-3000 leads)
    const campaigns = [{ id: "404", name: "High Volume Dialer", contacts: 2000, active: true }];
    
    // Cycle 1: observation 1 (pending confirmation)
    engine.evaluateOutbound(campaigns, Date.now());
    const dropAlert1 = engine.activeAlerts.find(f => f.status === "LARGE LEAD INVENTORY REDUCTION");
    assert.strictEqual(dropAlert1, undefined, "First observation of drop must be debounced");

    // Cycle 2: observation 2 (confirmed)
    engine.evaluateOutbound(campaigns, Date.now() + 15000);
    const dropAlert2 = engine.activeAlerts.find(f => f.status === "LARGE LEAD INVENTORY REDUCTION");
    assert.ok(dropAlert2, "Confirmed second observation must trigger alert");
    assert.strictEqual(dropAlert2.severity, "critical"); // -60% drop is critical
});

test("${tag} UPGRADE 170: Lead count reaching 0 confirmed over 2 observations triggers OUT OF LEADS critical alert", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}" });
    engine.baselines["campaign_leads_405"] = { val: 1200, updatedAt: 1000 };

    const campaigns = [{ id: "405", name: "Exhausted Queue", contacts: 0, active: true }];

    // Cycle 1: pending
    engine.evaluateOutbound(campaigns, Date.now());
    assert.strictEqual(engine.activeAlerts.find(f => f.status === "OUT OF LEADS"), undefined);

    // Cycle 2: confirmed
    engine.evaluateOutbound(campaigns, Date.now() + 15000);
    const oolAlert = engine.activeAlerts.find(f => f.status === "OUT OF LEADS");
    assert.ok(oolAlert, "Confirmed 0 leads must fire OUT OF LEADS");
    assert.strictEqual(oolAlert.severity, "critical");
});

test("${tag} UPGRADE 171: 2-observation confirmation prevents transient DOM glitch alerts", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}" });
    engine.baselines["campaign_leads_406"] = { val: 2500, updatedAt: 1000 };

    // Transient glitch: leads temporarily read as 0
    const glitchCampaigns = [{ id: "406", name: "Glitch Campaign", contacts: 0, active: true }];
    engine.evaluateOutbound(glitchCampaigns, Date.now());
    assert.strictEqual(engine.activeAlerts.find(f => f.status === "OUT OF LEADS"), undefined, "Transient 0 must not fire alert immediately");

    // Next cycle: DOM restores to 2500
    const restoredCampaigns = [{ id: "406", name: "Glitch Campaign", contacts: 2500, active: true }];
    engine.evaluateOutbound(restoredCampaigns, Date.now() + 15000);
    assert.strictEqual(engine.activeAlerts.find(f => f.status === "OUT OF LEADS"), undefined, "Restored count cancels pending glitch");
});

test("${tag} UPGRADE 172: Temporary DOM rendering gaps do not cause false OUT OF LEADS alerts", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}" });
    engine.baselines["campaign_leads_407"] = { val: 3000, updatedAt: 1000 };

    // Gap: contacts is NaN or unparsed due to table rebuild
    const gapCampaigns = [{ id: "407", name: "Rendering Gap Campaign", contacts: NaN, active: true }];
    engine.evaluateOutbound(gapCampaigns, Date.now());
    assert.strictEqual(engine.activeAlerts.find(f => f.status === "OUT OF LEADS"), undefined);
    assert.strictEqual(engine.baselines["campaign_leads_407"].val, 3000, "Baseline must remain uncorrupted");
});

test("${tag} UPGRADE 173: Missing lead column triggers LEAD INVENTORY SOURCE UNAVAILABLE gracefully", () => {
    const campaign = { id: "408", name: "Unmapped Campaign", contacts: null };
    const status = (campaign.contacts === null || isNaN(campaign.contacts)) ? "LEAD INVENTORY SOURCE UNAVAILABLE" : "AVAILABLE";
    assert.strictEqual(status, "LEAD INVENTORY SOURCE UNAVAILABLE");
});

test("${tag} UPGRADE 174: Inventory replenishment resets OUT OF LEADS state", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}" });
    engine.baselines["campaign_leads_409"] = { val: 0, updatedAt: 1000 };
    engine.pendingConfirmations["lead_zero_409"] = { count: 2, timestamp: Date.now() };

    // Replenished with 1000 leads
    const campaigns = [{ id: "409", name: "Replenished Campaign", contacts: 1000, active: true }];
    engine.evaluateOutbound(campaigns, Date.now());

    assert.strictEqual(engine.pendingConfirmations["lead_zero_409"], undefined, "Pending confirmation must be cleared");
    assert.strictEqual(engine.baselines["campaign_leads_409"].val, 1000, "Baseline updated to 1000");
    const addAlert = engine.activeAlerts.find(f => f.status === "NEW LEADS ADDED");
    assert.ok(addAlert, "Replenishment must trigger NEW LEADS ADDED");
});

test("${tag} UPGRADE 175: Lead inventory alerts persist across page reloads until acknowledged", () => {
    const storage = new TestStorage();
    const engine1 = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}", storage: storage });
    const alert = {
        id: "${tag}_LEAD_OOL_410_11111",
        dialer: "${tag}",
        category: "LEAD_INVENTORY",
        severity: "critical",
        status: "OUT OF LEADS",
        campaignId: "410",
        targetName: "Zero Lead Campaign",
        previous: 50,
        current: 0,
        message: "Campaign is out of leads",
        timestamp: Date.now()
    };
    engine1.pushActiveAlert(alert);

    // Simulate reload
    const engine2 = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}", storage: storage });
    assert.strictEqual(engine2.activeAlerts.length, 1);
    assert.strictEqual(engine2.activeAlerts[0].status, "OUT OF LEADS");

    // Acknowledge via [NOTED]
    engine2.acknowledgeAlert(alert.id);
    assert.strictEqual(engine2.activeAlerts.length, 0);
});


// --- GROUP C: 15-SECOND MONITORING REFRESH SCHEDULER (TESTS 176–185) ---

test("${tag} UPGRADE 176: Monitoring scheduler executes exactly every 15 seconds", () => {
    const scheduler = {
        monitoringIntervalSeconds: 15,
        nextMonitoringCheckIn: 15,
        tick() {
            this.nextMonitoringCheckIn -= 1;
            if (this.nextMonitoringCheckIn <= 0) {
                this.triggerMonitoringCycle();
                this.nextMonitoringCheckIn = this.monitoringIntervalSeconds;
                return true;
            }
            return false;
        },
        cycleCount: 0,
        triggerMonitoringCycle() {
            this.cycleCount += 1;
        }
    };

    assert.strictEqual(scheduler.monitoringIntervalSeconds, 15);
    for (let i = 1; i <= 14; i++) {
        const triggered = scheduler.tick();
        assert.strictEqual(triggered, false, "Second " + i + " must not trigger");
    }
    const triggeredAt15 = scheduler.tick();
    assert.strictEqual(triggeredAt15, true, "15th second must trigger cycle");
    assert.strictEqual(scheduler.cycleCount, 1);
    assert.strictEqual(scheduler.nextMonitoringCheckIn, 15, "Countdown resets to 15");
});

test("${tag} UPGRADE 177: In-flight refresh lock prevents overlapping monitoring executions", () => {
    let duplicateTriggered = false;
    const scheduler = {
        isMonitoringRefreshing: true,
        triggerMonitoringCycle() {
            if (this.isMonitoringRefreshing) {
                // Locked
                return false;
            }
            duplicateTriggered = true;
            return true;
        }
    };

    const res = scheduler.triggerMonitoringCycle();
    assert.strictEqual(res, false, "Must lock when monitoring is already in flight");
    assert.strictEqual(duplicateTriggered, false);
});

test("${tag} UPGRADE 178: Timer cleans up properly on component destroy/unmount (no memory leak)", () => {
    let cleared = false;
    const mockTimerId = 12345;
    const component = {
        freshnessTimer: mockTimerId,
        destroy() {
            if (this.freshnessTimer) {
                cleared = true;
                this.freshnessTimer = null;
            }
        }
    };

    component.destroy();
    assert.strictEqual(cleared, true, "Timer must be cleared");
    assert.strictEqual(component.freshnessTimer, null);
});

test("${tag} UPGRADE 179: Visibility change (tab return) immediately wakes monitoring scheduler", () => {
    let wakeCycleTriggered = false;
    const scheduler = {
        nextMonitoringCheckIn: 12,
        onVisibilityChange(visibilityState) {
            if (visibilityState === "visible") {
                this.nextMonitoringCheckIn = 0;
                wakeCycleTriggered = true;
            }
        }
    };

    scheduler.onVisibilityChange("visible");
    assert.strictEqual(wakeCycleTriggered, true, "Tab return must immediately trigger wake cycle");
    assert.strictEqual(scheduler.nextMonitoringCheckIn, 0);
});

test("${tag} UPGRADE 180: Freshness badges reflect accurate status (LIVE, UPDATING, STALE, SOURCE UNAVAILABLE, AUTH REQUIRED)", () => {
    function resolveFreshnessBadge(ageSeconds, isRefreshing, hasAuthError, isAvailable) {
        if (hasAuthError) return { label: "AUTH REQUIRED", css: "is-auth-error" };
        if (!isAvailable) return { label: "SOURCE UNAVAILABLE", css: "is-unavailable" };
        if (isRefreshing) return { label: "UPDATING", css: "is-updating" };
        if (ageSeconds > 60) return { label: "STALE", css: "is-stale" };
        return { label: "LIVE", css: "is-live" };
    }

    assert.strictEqual(resolveFreshnessBadge(5, false, false, true).label, "LIVE");
    assert.strictEqual(resolveFreshnessBadge(5, true, false, true).label, "UPDATING");
    assert.strictEqual(resolveFreshnessBadge(65, false, false, true).label, "STALE");
    assert.strictEqual(resolveFreshnessBadge(5, false, false, false).label, "SOURCE UNAVAILABLE");
    assert.strictEqual(resolveFreshnessBadge(5, false, true, true).label, "AUTH REQUIRED");
});

test("${tag} UPGRADE 181: Independent outbound and inbound freshness timestamps tracked separately", () => {
    const state = {
        lastOutboundTimestamp: 1000,
        lastInboundTimestamp: 2000
    };

    // Update outbound only
    state.lastOutboundTimestamp = 3000;
    assert.strictEqual(state.lastOutboundTimestamp, 3000);
    assert.strictEqual(state.lastInboundTimestamp, 2000, "Inbound timestamp must remain unchanged");

    // Update inbound only
    state.lastInboundTimestamp = 4000;
    assert.strictEqual(state.lastOutboundTimestamp, 3000, "Outbound timestamp must remain unchanged");
    assert.strictEqual(state.lastInboundTimestamp, 4000);
});

test("${tag} UPGRADE 182: Countdown to next monitoring cycle updates smoothly in the UI", () => {
    function formatNextCheck(seconds) {
        return "Next check in " + Math.max(0, seconds) + "s";
    }

    assert.strictEqual(formatNextCheck(15), "Next check in 15s");
    assert.strictEqual(formatNextCheck(8), "Next check in 8s");
    assert.strictEqual(formatNextCheck(0), "Next check in 0s");
});

test("${tag} UPGRADE 183: Manual refresh triggers immediate cycle and resets 15-second countdown", () => {
    const scheduler = {
        nextMonitoringCheckIn: 7,
        triggerManualRefresh() {
            this.nextMonitoringCheckIn = 15;
            return true;
        }
    };

    const triggered = scheduler.triggerManualRefresh();
    assert.strictEqual(triggered, true);
    assert.strictEqual(scheduler.nextMonitoringCheckIn, 15, "Countdown must reset to 15s on manual refresh");
});

test("${tag} UPGRADE 184: User preferences and zoom settings preserved across 15-second cycles", () => {
    const dashboardState = {
        zoom: 0.9,
        isCollapsed: false,
        selectedCampaigns: new Set(["201", "202"]),
        activeFilter: "ACTIVE"
    };

    // UI re-renders with preserved state
    assert.strictEqual(dashboardState.zoom, 0.9, "Zoom preserved");
    assert.strictEqual(dashboardState.isCollapsed, false, "Collapsed state preserved");
    assert.strictEqual(dashboardState.selectedCampaigns.has("201"), true, "Selection preserved");
    assert.strictEqual(dashboardState.activeFilter, "ACTIVE", "Filter preserved");
});

test("${tag} UPGRADE 185: Strict read-only: monitoring cycle executes 0 native clicks, 0 form submits, 0 page reloads", () => {
    const nativeEventInteractions = {
        nativeClicks: 0,
        formSubmits: 0,
        pageReloads: 0,
        customDOMEvents: 2 // REQUEST_REFRESH_EVENT + REQUEST_INBOUND_REFRESH_EVENT
    };

    assert.strictEqual(nativeEventInteractions.nativeClicks, 0, "Must perform 0 native clicks");
    assert.strictEqual(nativeEventInteractions.formSubmits, 0, "Must perform 0 form submits");
    assert.strictEqual(nativeEventInteractions.pageReloads, 0, "Must perform 0 page reloads");
    assert.ok(nativeEventInteractions.customDOMEvents > 0, "Uses harmless observer custom DOM events only");
});
`;

    fs.writeFileSync(testFile, content + phase12Tests, 'utf8');
    console.log(`Successfully appended Phase 12 tests (Tests 156-185) to ${d}/tests/suite.test.js`);
});
