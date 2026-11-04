const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE');

function getTestsBlock(dialer, prefix, otherDialer, otherPrefix) {
    return `
// ===============================================================================
// CT DATA CHANGE INTELLIGENCE ENGINE AUTOMATED TESTS (UPGRADE TESTS 60-79)
// ===============================================================================
const { CTDataIntelligenceEngine, METRIC_THRESHOLDS } = require("../src/intelligence.js");

class TestStorage {
    constructor() { this.store = new Map(); }
    getItem(k) { return this.store.get(k) || null; }
    setItem(k, v) { this.store.set(k, String(v)); }
    removeItem(k) { this.store.delete(k); }
    clear() { this.store.clear(); }
}

test("${dialer} UPGRADE 60: Initial baseline establishment (0 false alerts on cold start)", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "${dialer}", prefix: "${prefix}", storage });
    const snap1 = {
        campaigns: [
            { id: "c1", name: "REALTIME 101", active: true, contacts: 15000, abandoned: 5, waiting: 0, waitNow: 4, loggedIn: 10, failed: 2, goals: 12 },
            { id: "c2", name: "SOLAR 202", active: true, contacts: 8000, abandoned: 2, waiting: 0, waitNow: 3, loggedIn: 6, failed: 0, goals: 8 }
        ],
        queues: [
            { id: "q1", name: "Support Queue", active: true, waiting: 0, waitMax: 12, loggedIn: 5, callsTodayTotal: 45, callsTodayAnswered: 40, callsTodayNotAnswered: 5, goals: 4 }
        ],
        isCampaignsRoute: true,
        campaignTableFound: true,
        isStale: false,
        authLost: false
    };
    const alerts = engine.processSnapshot(snap1);
    assert.strictEqual(alerts.length, 0, "Cold start baseline must NOT generate false alerts");
    assert.strictEqual(engine.activeAlerts.length, 0);
});

test("${dialer} UPGRADE 61: Normal increments within thresholds trigger zero alerts", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "${dialer}", prefix: "${prefix}", storage });
    engine.processSnapshot({
        campaigns: [{ id: "c1", name: "C1", active: true, contacts: 15000, abandoned: 5, waiting: 0, waitNow: 4, loggedIn: 10, failed: 2, goals: 12 }],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: true
    });
    const alerts = engine.processSnapshot({
        campaigns: [{ id: "c1", name: "C1", active: true, contacts: 14980, abandoned: 6, waiting: 1, waitNow: 6, loggedIn: 10, failed: 2, goals: 12 }],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: true
    });
    assert.strictEqual(alerts.length, 0, "Normal increments within threshold must not trigger alerts");
});

test("${dialer} UPGRADE 62: Normal decreases within thresholds trigger zero alerts", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "${dialer}", prefix: "${prefix}", storage });
    engine.processSnapshot({
        campaigns: [{ id: "c1", name: "C1", active: true, contacts: 15000, abandoned: 10, waiting: 2, waitNow: 15, loggedIn: 10, failed: 2, goals: 12 }],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: true
    });
    const alerts = engine.processSnapshot({
        campaigns: [{ id: "c1", name: "C1", active: true, contacts: 14700, abandoned: 10, waiting: 1, waitNow: 10, loggedIn: 9, failed: 2, goals: 12 }],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: true
    });
    assert.strictEqual(alerts.length, 0, "Normal agent variation (-1 agent) must not trigger alerts");
});

test("${dialer} UPGRADE 63: Sudden increase observation 1 held in pending confirmation", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "${dialer}", prefix: "${prefix}", storage });
    engine.processSnapshot({
        campaigns: [{ id: "c1", name: "C1", active: true, contacts: 15000, abandoned: 5, waiting: 0, waitNow: 4, loggedIn: 10, failed: 2, goals: 12 }],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: true
    });
    const alerts = engine.processSnapshot({
        campaigns: [{ id: "c1", name: "C1", active: true, contacts: 15000, abandoned: 35, waiting: 0, waitNow: 4, loggedIn: 10, failed: 2, goals: 12 }],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: true
    });
    assert.strictEqual(alerts.length, 0, "First observation of sudden increase must be held in pending queue");
    assert.ok(Object.keys(engine.pendingConfirmations).length > 0, "Pending queue must hold unconfirmed change");
});

test("${dialer} UPGRADE 64: Consecutive observation 2 confirms sudden increase anomaly (Engine B)", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "${dialer}", prefix: "${prefix}", storage });
    const snapNormal = {
        campaigns: [{ id: "c1", name: "C1", active: true, contacts: 15000, abandoned: 5, waiting: 0, waitNow: 4, loggedIn: 10, failed: 2, goals: 12 }],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: true
    };
    const snapSurge = {
        campaigns: [{ id: "c1", name: "C1", active: true, contacts: 15000, abandoned: 35, waiting: 0, waitNow: 4, loggedIn: 10, failed: 2, goals: 12 }],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: true
    };
    engine.processSnapshot(snapNormal);
    engine.processSnapshot(snapSurge); // Tick 1 (pending)
    const alerts = engine.processSnapshot(snapSurge); // Tick 2 (confirmed)
    assert.ok(alerts.length >= 1, "Tick 2 must promote pending increase to active alert");
    const abnd = alerts.find(a => a.metric === "Abandoned Calls");
    assert.ok(abnd);
    assert.strictEqual(abnd.status, "INCREASE");
    assert.strictEqual(abnd.severity, "critical");
    assert.strictEqual(abnd.dialer, "${dialer}");
});

test("${dialer} UPGRADE 65: Sudden decrease in agent capacity triggers confirmed DECREASE alert (Engine C)", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "${dialer}", prefix: "${prefix}", storage });
    const snapHigh = {
        campaigns: [
            { id: "c1", name: "C1", active: true, loggedIn: 10, goals: 10 },
            { id: "c2", name: "C2", active: true, loggedIn: 6, goals: 10 }
        ],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: true
    };
    const snapDrop = {
        campaigns: [
            { id: "c1", name: "C1", active: true, loggedIn: 4, goals: 10 },
            { id: "c2", name: "C2", active: true, loggedIn: 2, goals: 10 }
        ],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: true
    };
    engine.processSnapshot(snapHigh);
    engine.processSnapshot(snapDrop); // Tick 1 (pending)
    const alerts = engine.processSnapshot(snapDrop); // Tick 2 (confirmed)
    const agentAlert = alerts.find(a => a.metric === "Total Agents Logged In" && a.status === "DECREASE");
    assert.ok(agentAlert, "Sudden drop in logged in agents must trigger confirmed DECREASE alert");
    assert.strictEqual(agentAlert.severity, "critical");
});

test("${dialer} UPGRADE 66: Independent percentage and absolute threshold rules per metric profile", () => {
    assert.strictEqual(METRIC_THRESHOLDS.outbound_abandoned.increaseAbs, 20);
    assert.strictEqual(METRIC_THRESHOLDS.outbound_abandoned.increasePct, 0.30);
    assert.strictEqual(METRIC_THRESHOLDS.inbound_max_wait.increaseAbs, 30);
    assert.strictEqual(METRIC_THRESHOLDS.outbound_agents_logged_in.decreaseAbs, 3);
    assert.strictEqual(METRIC_THRESHOLDS.outbound_agents_logged_in.decreasePct, 0.35);
});

test("${dialer} UPGRADE 67: Repeated polling duplicate suppression across identical snapshots", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "${dialer}", prefix: "${prefix}", storage });
    const snap = {
        campaigns: [{ id: "c1", name: "C1", active: true, abandoned: 50, goals: 5 }],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: true
    };
    engine.baselines["metric_outbound_abandoned_ALL"] = { val: 5, updatedAt: Date.now() };
    engine.processSnapshot(snap);
    const alerts = engine.processSnapshot(snap);
    const countBefore = alerts.length;
    for (let i = 0; i < 5; i++) {
        engine.processSnapshot(snap);
    }
    assert.strictEqual(engine.activeAlerts.length, countBefore, "Repeated polls must NOT create duplicate alerts");
});

test("${dialer} UPGRADE 68: Midnight reset safe downward adjustment with zero false alerts", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "${dialer}", prefix: "${prefix}", storage });
    engine.baselines["metric_outbound_abandoned_ALL"] = { val: 80, updatedAt: Date.now() };
    engine.isMidnightResetWindow = () => true;
    const snapMidnight = {
        campaigns: [{ id: "c1", name: "C1", active: true, abandoned: 0, goals: 0 }],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: true
    };
    const alerts = engine.processSnapshot(snapMidnight);
    assert.strictEqual(alerts.length, 0, "Midnight reset must not fire false alert");
    assert.strictEqual(engine.baselines["metric_outbound_abandoned_ALL"].val, 0);
});

test("${dialer} UPGRADE 69: Unexpected counter reset outside midnight window flags RESET integrity alert", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "${dialer}", prefix: "${prefix}", storage });
    engine.baselines["metric_outbound_failed_calls_ALL"] = { val: 120, updatedAt: Date.now() };
    engine.isMidnightResetWindow = () => false;
    const snapDaytimeReset = {
        campaigns: [{ id: "c1", name: "C1", active: true, failed: 0 }],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: true
    };
    const alerts = engine.processSnapshot(snapDaytimeReset);
    const resetAlert = alerts.find(a => a.status === "RESET" && a.metric === "Failed Call Volume");
    assert.ok(resetAlert, "Daytime counter reset must trigger RESET integrity alert");
});

test("${dialer} UPGRADE 70: Outbound campaign disappearance detection and confirmation (Engine D)", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "${dialer}", prefix: "${prefix}", storage });
    engine.baselines["outbound_campaign_list"] = { ids: ["c1", "c2", "c3"], updatedAt: Date.now() };
    const snapMissing = {
        campaigns: [{ id: "c1", name: "C1", active: true }],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: true
    };
    engine.processSnapshot(snapMissing); // Tick 1 (pending)
    const alerts = engine.processSnapshot(snapMissing); // Tick 2 (confirmed)
    const missingAlert = alerts.find(a => a.status === "MISSING" && a.metric === "Campaign Availability");
    assert.ok(missingAlert, "Campaign disappearance must generate confirmed MISSING alert");
});

test("${dialer} UPGRADE 71: Inbound queue disappearance detection and confirmation (Engine D)", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "${dialer}", prefix: "${prefix}", storage });
    engine.baselines["inbound_queue_list"] = { ids: ["q1", "q2"], updatedAt: Date.now() };
    const snapMissing = {
        campaigns: [],
        queues: [{ id: "q1", name: "Q1", active: true }],
        isCampaignsRoute: true,
        campaignTableFound: true
    };
    engine.processSnapshot(snapMissing); // Tick 1
    const alerts = engine.processSnapshot(snapMissing); // Tick 2
    const missingQ = alerts.find(a => a.status === "MISSING" && a.metric === "Queue Availability");
    assert.ok(missingQ, "Queue disappearance must generate confirmed MISSING alert");
});

test("${dialer} UPGRADE 72: Missing native table container in DOM flags TABLE_MISSING alert immediately", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "${dialer}", prefix: "${prefix}", storage });
    const alerts = engine.processSnapshot({
        campaigns: [],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: false
    });
    const tableAlert = alerts.find(a => a.status === "TABLE_MISSING");
    assert.ok(tableAlert, "Missing native table must flag TABLE_MISSING immediately");
});

test("${dialer} UPGRADE 73: Stale source feed (>15s) flags FEED_STALE warning and suspends comparisons", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "${dialer}", prefix: "${prefix}", storage });
    const alerts = engine.processSnapshot({
        campaigns: [],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: true,
        isStale: true
    });
    const staleAlert = alerts.find(a => a.status === "FEED_STALE");
    assert.ok(staleAlert, "Stale source feed must flag FEED_STALE warning");
});

test("${dialer} UPGRADE 74: Authentication loss flags AUTH_LOST critical alert immediately", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "${dialer}", prefix: "${prefix}", storage });
    const alerts = engine.processSnapshot({
        campaigns: [],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: false,
        authLost: true
    });
    const authAlert = alerts.find(a => a.status === "AUTH_LOST");
    assert.ok(authAlert, "Authentication loss must flag AUTH_LOST critical alert");
});

test("${dialer} UPGRADE 75: Browser and extension restart survival reloads active alerts from storage", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "${dialer}", prefix: "${prefix}", storage });
    engine.processSnapshot({
        campaigns: [],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: false
    });
    assert.ok(engine.activeAlerts.length > 0);
    const countBefore = engine.activeAlerts.length;

    // Simulate restart with new engine instance
    const restarted = new CTDataIntelligenceEngine({ dialer: "${dialer}", prefix: "${prefix}", storage });
    assert.strictEqual(restarted.activeAlerts.length, countBefore, "Active alerts must persist across restart");
});

test("${dialer} UPGRADE 76: Operator individual acknowledgement via [NOTED] dismisses active card and retains history", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "${dialer}", prefix: "${prefix}", storage });
    engine.processSnapshot({
        campaigns: [],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: false
    });
    const alert = engine.activeAlerts[0];
    const initialActive = engine.activeAlerts.length;
    const initialHist = engine.history.length;

    const res = engine.acknowledgeAlert(alert.id);
    assert.strictEqual(res.acknowledged, true);
    assert.strictEqual(engine.activeAlerts.length, initialActive - 1, "Alert must be dismissed from active view");
    assert.strictEqual(engine.history.length, initialHist, "History must retain acknowledged record");
    assert.strictEqual(engine.history[0].acknowledged, true);
});

test("${dialer} UPGRADE 77: Action Center Clear All preserves unacknowledged intelligence alerts", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "${dialer}", prefix: "${prefix}", storage });
    engine.processSnapshot({
        campaigns: [],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: false
    });
    const preserved = engine.clearActionCenterPreservingIntelligence();
    assert.ok(preserved.length > 0, "Clear All must preserve unacknowledged intelligence alerts");
});

test("${dialer} UPGRADE 78: Complete bidirectional storage and namespace isolation from ${otherDialer}", () => {
    const storageThis = new TestStorage();
    const storageOther = new TestStorage();
    const engineThis = new CTDataIntelligenceEngine({ dialer: "${dialer}", prefix: "${prefix}", storage: storageThis });
    const engineOther = new CTDataIntelligenceEngine({ dialer: "${otherDialer}", prefix: "${otherPrefix}", storage: storageOther });

    engineThis.processSnapshot({ campaigns: [{ id: "c1", name: "C1", goals: 10 }], queues: [], isCampaignsRoute: true, campaignTableFound: true });
    engineThis.processSnapshot({ campaigns: [{ id: "c1", name: "C1", goals: 15 }], queues: [], isCampaignsRoute: true, campaignTableFound: true });

    assert.strictEqual(engineThis.activeAlerts.length, 1);
    assert.strictEqual(engineOther.activeAlerts.length, 0);

    const keysThis = Array.from(storageThis.store.keys());
    const keysOther = Array.from(storageOther.store.keys());
    assert.ok(keysThis.every(k => k.startsWith("${prefix}")), "All keys must have '${prefix}'");
    assert.strictEqual(keysOther.length, 0);
});

test("${dialer} UPGRADE 79: Sales & Goals immediate increase detection (Engine A) without 2-observation delay", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "${dialer}", prefix: "${prefix}", storage });
    engine.processSnapshot({
        campaigns: [{ id: "c1", name: "C1", goals: 10, sales: 2 }],
        queues: [{ id: "q1", name: "Q1", goals: 5, sales: 1 }],
        isCampaignsRoute: true,
        campaignTableFound: true
    });
    // Single observation with increase
    const alerts = engine.processSnapshot({
        campaigns: [{ id: "c1", name: "C1", goals: 14, sales: 2 }],
        queues: [{ id: "q1", name: "Q1", goals: 8, sales: 1 }],
        isCampaignsRoute: true,
        campaignTableFound: true
    });
    const cGoal = alerts.find(a => a.category === "SALES_GOAL" && a.targetId === "c1");
    const qGoal = alerts.find(a => a.category === "SALES_GOAL" && a.targetId === "q1");
    assert.ok(cGoal, "Campaign Goal increase must fire on observation 1");
    assert.ok(qGoal, "Queue Goal increase must fire on observation 1");
    assert.strictEqual(cGoal.absoluteDiff, 4);
    assert.strictEqual(qGoal.absoluteDiff, 3);
});
`;
}

// Append to East-2
const e2TestPath = path.join(root, 'CT_Operations_Monitor_East2', 'tests', 'suite.test.js');
let e2Content = fs.readFileSync(e2TestPath, 'utf8');
if (!e2Content.includes('CT DATA CHANGE INTELLIGENCE ENGINE AUTOMATED TESTS')) {
    e2Content += getTestsBlock('EAST-2', 'ct_east2_', 'EAST-3', 'ct_east3_');
    fs.writeFileSync(e2TestPath, e2Content, 'utf8');
    console.log('Appended 20 intelligence tests to East-2 suite.test.js');
}

// Append to East-3
const e3TestPath = path.join(root, 'CT_Operations_Monitor_East3', 'tests', 'suite.test.js');
let e3Content = fs.readFileSync(e3TestPath, 'utf8');
if (!e3Content.includes('CT DATA CHANGE INTELLIGENCE ENGINE AUTOMATED TESTS')) {
    e3Content += getTestsBlock('EAST-3', 'ct_east3_', 'EAST-2', 'ct_east2_');
    fs.writeFileSync(e3TestPath, e3Content, 'utf8');
    console.log('Appended 20 intelligence tests to East-3 suite.test.js');
}

