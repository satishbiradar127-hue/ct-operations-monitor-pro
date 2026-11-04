const assert = require("assert");
const path = require("path");
const fs = require("fs");

console.log("===============================================================================");
console.log("CT DATA CHANGE INTELLIGENCE ENGINE — AUTOMATED VERIFICATION SUITE");
console.log("Verifying 20 Core Intelligence & Durability Requirements");
console.log("===============================================================================\n");

const root = "C:\\Users\\Orange Carrot\\Downloads\\CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL\\CT_OPERATIONS_DUAL_DIALER_RELEASE";
const { CTDataIntelligenceEngine, METRIC_THRESHOLDS } = require(path.join(root, "CT_Operations_Monitor_East2", "src", "intelligence.js"));

class MockStorage {
    constructor() { this.store = new Map(); }
    getItem(k) { return this.store.get(k) || null; }
    setItem(k, v) { this.store.set(k, String(v)); }
    removeItem(k) { this.store.delete(k); }
    clear() { this.store.clear(); }
}

const storageE2 = new MockStorage();
const storageE3 = new MockStorage();

const engineE2 = new CTDataIntelligenceEngine({ dialer: "EAST-2", prefix: "ct_east2_", storage: storageE2 });
const engineE3 = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage: storageE3 });

// --- TEST 1: Initial Baseline Establishment ---
console.log("Test 1: Initial baseline establishment (0 false alerts)...");
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
let alerts = engineE2.processSnapshot(snap1);
assert.strictEqual(alerts.length, 0, "Cold start baseline must NOT generate false alerts");
console.log("  PASS: Baseline recorded, 0 false alerts.");

// --- TEST 2 & 3: Normal Increases & Decreases ---
console.log("Test 2 & 3: Normal increments/decreases within thresholds...");
const snapNormal = {
    campaigns: [
        { id: "c1", name: "REALTIME 101", active: true, contacts: 14980, abandoned: 6, waiting: 1, waitNow: 6, loggedIn: 10, failed: 2, goals: 12 },
        { id: "c2", name: "SOLAR 202", active: true, contacts: 7990, abandoned: 2, waiting: 0, waitNow: 3, loggedIn: 6, failed: 0, goals: 8 }
    ],
    queues: [
        { id: "q1", name: "Support Queue", active: true, waiting: 1, waitMax: 15, loggedIn: 5, callsTodayTotal: 48, callsTodayAnswered: 43, callsTodayNotAnswered: 5, goals: 4 }
    ],
    isCampaignsRoute: true,
    campaignTableFound: true,
    isStale: false,
    authLost: false
};
alerts = engineE2.processSnapshot(snapNormal);
assert.strictEqual(alerts.length, 0, "Normal increments must NOT trigger alerts");
console.log("  PASS: Normal dialer activity produces 0 anomaly alerts.");

// --- TEST 4 & 5: Sudden Increase & 2-Observation Confirmation ---
console.log("Test 4 & 5: Sudden increase & two-observation confirmation (Engine B)...");
const snapSurge = {
    campaigns: [
        { id: "c1", name: "REALTIME 101", active: true, contacts: 14950, abandoned: 35, waiting: 10, waitNow: 45, loggedIn: 10, failed: 45, goals: 12 }, // +29 abandoned, +39s wait
        { id: "c2", name: "SOLAR 202", active: true, contacts: 7980, abandoned: 2, waiting: 0, waitNow: 3, loggedIn: 6, failed: 0, goals: 8 }
    ],
    queues: [
        { id: "q1", name: "Support Queue", active: true, waiting: 6, waitMax: 50, loggedIn: 5, callsTodayTotal: 50, callsTodayAnswered: 43, callsTodayNotAnswered: 7, goals: 4 }
    ],
    isCampaignsRoute: true,
    campaignTableFound: true,
    isStale: false,
    authLost: false
};
// Observation 1: held in pending queue
alerts = engineE2.processSnapshot(snapSurge);
assert.strictEqual(alerts.length, 0, "Observation 1 of sudden increase must be held in pending queue");
assert.ok(Object.keys(engineE2.pendingConfirmations).length > 0, "Pending queue must hold unconfirmed changes");

// Observation 2: consecutive tick confirms anomaly!
alerts = engineE2.processSnapshot(snapSurge);
assert.ok(alerts.length >= 1, "Observation 2 must confirm and promote sudden increase alerts");
const abndAlert = alerts.find(a => a.metric === "Abandoned Calls");
assert.ok(abndAlert, "Abandoned Calls alert must be confirmed");
assert.strictEqual(abndAlert.dialer, "EAST-2");
assert.strictEqual(abndAlert.status, "INCREASE");
assert.strictEqual(abndAlert.severity, "critical");
console.log("  PASS: 2-observation confirmation verified. Pending -> Confirmed.");

// --- TEST 6: Sudden Decrease (Engine C) ---
console.log("Test 6: Sudden decrease in agent capacity (Engine C)...");
const snapDrop = {
    campaigns: [
        { id: "c1", name: "REALTIME 101", active: true, contacts: 14950, abandoned: 35, waiting: 10, waitNow: 45, loggedIn: 4, failed: 45, goals: 12 }, // Drop from 10 to 4 agents
        { id: "c2", name: "SOLAR 202", active: true, contacts: 7980, abandoned: 2, waiting: 0, waitNow: 3, loggedIn: 2, failed: 0, goals: 8 }   // Drop from 6 to 2 agents
    ],
    queues: snapSurge.queues,
    isCampaignsRoute: true,
    campaignTableFound: true,
    isStale: false,
    authLost: false
};
engineE2.processSnapshot(snapDrop); // Tick 1 (pending)
alerts = engineE2.processSnapshot(snapDrop); // Tick 2 (confirmed)
const agentAlert = alerts.find(a => a.metric === "Total Agents Logged In" && a.status === "DECREASE");
assert.ok(agentAlert, "Sudden drop in logged in agents must trigger confirmed DECREASE alert");
console.log("  PASS: Confirmed sudden decrease alert fired.");

// --- TEST 7: Percentage vs Absolute Thresholds ---
console.log("Test 7: Independent percentage and absolute threshold rules...");
assert.strictEqual(METRIC_THRESHOLDS.outbound_abandoned.increaseAbs, 20);
assert.strictEqual(METRIC_THRESHOLDS.outbound_abandoned.increasePct, 0.30);
assert.strictEqual(METRIC_THRESHOLDS.inbound_max_wait.increaseAbs, 30);
console.log("  PASS: Independent thresholds verified per metric profile.");

// --- TEST 8: Repeated Polling Duplicate Suppression ---
console.log("Test 8: Repeated polling duplicate suppression...");
const alertCountBefore = alerts.length;
for (let i = 0; i < 5; i++) {
    alerts = engineE2.processSnapshot(snapDrop);
}
assert.strictEqual(alerts.length, alertCountBefore, "Duplicate alerts must NOT be generated across repeated polls");
console.log(`  PASS: Zero duplicate alerts created across 5 identical polling cycles.`);

// --- TEST 9: Midnight Reset Protection ---
console.log("Test 9: Midnight reset safe downward adjustment...");
// Mock midnight reset window
const origIsMidnight = engineE2.isMidnightResetWindow;
engineE2.isMidnightResetWindow = () => true;

const snapMidnight = {
    campaigns: [
        { id: "c1", name: "REALTIME 101", active: true, contacts: 14950, abandoned: 0, waiting: 0, waitNow: 0, loggedIn: 4, failed: 0, goals: 0 },
        { id: "c2", name: "SOLAR 202", active: true, contacts: 7980, abandoned: 0, waiting: 0, waitNow: 0, loggedIn: 2, failed: 0, goals: 0 }
    ],
    queues: [
        { id: "q1", name: "Support Queue", active: true, waiting: 0, waitMax: 0, loggedIn: 5, callsTodayTotal: 0, callsTodayAnswered: 0, callsTodayNotAnswered: 0, goals: 0 }
    ],
    isCampaignsRoute: true,
    campaignTableFound: true,
    isStale: false,
    authLost: false
};
const countBeforeMidnight = engineE2.activeAlerts.length;
engineE2.processSnapshot(snapMidnight);
assert.strictEqual(engineE2.activeAlerts.length, countBeforeMidnight, "Midnight reset must NOT fire false alerts");
engineE2.isMidnightResetWindow = origIsMidnight;
console.log("  PASS: Midnight reset adjusted baseline to 0 with zero false alerts.");

// --- TEST 10: Unexpected Counter Reset Outside Midnight Window ---
console.log("Test 10: Unexpected counter reset outside midnight window...");
engineE2.isMidnightResetWindow = () => false;
// Set baseline to high value
engineE2.baselines["metric_outbound_failed_calls_ALL"] = { val: 120, updatedAt: Date.now() };
const snapUnexpectedReset = {
    campaigns: [
        { id: "c1", name: "REALTIME 101", active: true, contacts: 14950, abandoned: 0, waiting: 0, waitNow: 0, loggedIn: 4, failed: 0, goals: 0 },
        { id: "c2", name: "SOLAR 202", active: true, contacts: 7980, abandoned: 0, waiting: 0, waitNow: 0, loggedIn: 2, failed: 0, goals: 0 }
    ],
    queues: snapMidnight.queues,
    isCampaignsRoute: true,
    campaignTableFound: true,
    isStale: false,
    authLost: false
};
alerts = engineE2.processSnapshot(snapUnexpectedReset);
const resetAlert = alerts.find(a => a.status === "RESET" && a.metric === "Failed Call Volume");
assert.ok(resetAlert, "Unexpected counter reset during business hours must generate RESET alert");
console.log("  PASS: Unexpected counter reset flagged as integrity alert.");

// --- TEST 11: Campaign Disappearance (Engine D) ---
console.log("Test 11: Campaign disappearance detection...");
engineE2.baselines["outbound_campaign_list"] = { ids: ["c1", "c2", "c3"], updatedAt: Date.now() };
const snapMissingCamp = {
    campaigns: [
        { id: "c1", name: "REALTIME 101", active: true, contacts: 14950, abandoned: 0, waiting: 0, waitNow: 0, loggedIn: 4, failed: 0, goals: 0 }
    ], // c2 and c3 missing!
    queues: snapMidnight.queues,
    isCampaignsRoute: true,
    campaignTableFound: true,
    isStale: false,
    authLost: false
};
engineE2.processSnapshot(snapMissingCamp); // Tick 1 (pending)
alerts = engineE2.processSnapshot(snapMissingCamp); // Tick 2 (confirmed)
const missingAlert = alerts.find(a => a.status === "MISSING" && a.metric === "Campaign Availability");
assert.ok(missingAlert, "Campaign disappearance must generate MISSING alert");
console.log("  PASS: Campaign disappearance confirmed and alerted.");

// --- TEST 12: Queue Disappearance (Engine D) ---
console.log("Test 12: Queue disappearance detection...");
engineE2.baselines["inbound_queue_list"] = { ids: ["q1", "q2"], updatedAt: Date.now() };
const snapMissingQueue = {
    campaigns: snapMissingCamp.campaigns,
    queues: [{ id: "q1", name: "Support Queue", active: true, goals: 0 }], // q2 missing!
    isCampaignsRoute: true,
    campaignTableFound: true,
    isStale: false,
    authLost: false
};
engineE2.processSnapshot(snapMissingQueue); // Tick 1
alerts = engineE2.processSnapshot(snapMissingQueue); // Tick 2
const missingQAlert = alerts.find(a => a.status === "MISSING" && a.metric === "Queue Availability");
assert.ok(missingQAlert, "Queue disappearance must generate MISSING alert");
console.log("  PASS: Queue disappearance confirmed and alerted.");

// --- TEST 13: Incomplete Native DOM / Table Missing ---
console.log("Test 13: Missing native table container in DOM...");
const snapMissingTable = {
    campaigns: [],
    queues: [],
    isCampaignsRoute: true,
    campaignTableFound: false,
    isStale: false,
    authLost: false
};
alerts = engineE2.processSnapshot(snapMissingTable);
const tableAlert = alerts.find(a => a.status === "TABLE_MISSING");
assert.ok(tableAlert, "Missing table container must generate TABLE_MISSING alert");
console.log("  PASS: Missing native table flagged immediately.");

// --- TEST 14: Stale Source Feed Heartbeat ---
console.log("Test 14: Stale source feed handling...");
const snapStale = {
    campaigns: [],
    queues: [],
    isCampaignsRoute: true,
    campaignTableFound: true,
    isStale: true,
    authLost: false
};
alerts = engineE2.processSnapshot(snapStale);
const staleAlert = alerts.find(a => a.status === "FEED_STALE");
assert.ok(staleAlert, "Stale source feed must generate FEED_STALE warning");
console.log("  PASS: Stale feed safely flagged and comparisons suspended.");

// --- TEST 15: Authentication Loss ---
console.log("Test 15: Authentication loss detection...");
const snapAuth = {
    campaigns: [],
    queues: [],
    isCampaignsRoute: true,
    campaignTableFound: false,
    isStale: false,
    authLost: true
};
alerts = engineE2.processSnapshot(snapAuth);
const authAlert = alerts.find(a => a.status === "AUTH_LOST");
assert.ok(authAlert, "Authentication loss must generate AUTH_LOST critical alert");
console.log("  PASS: Authentication loss detected and alerted.");

// --- TEST 16: Browser / Extension Restart Survival ---
console.log("Test 16: Browser / extension restart survival...");
const countBeforeRestart = engineE2.activeAlerts.length;
const restartedEngine = new CTDataIntelligenceEngine({ dialer: "EAST-2", prefix: "ct_east2_", storage: storageE2 });
assert.strictEqual(restartedEngine.activeAlerts.length, countBeforeRestart, "Active alerts must reload from storage on restart");
console.log(`  PASS: Loaded ${restartedEngine.activeAlerts.length} active alerts from storage on clean boot.`);

// --- TEST 17: Persistent Acknowledgement via [NOTED] ---
console.log("Test 17: Individual [NOTED] acknowledgement...");
const targetAlert = restartedEngine.activeAlerts[0];
const totalBefore = restartedEngine.activeAlerts.length;
const ackResult = restartedEngine.acknowledgeAlert(targetAlert.id);
assert.strictEqual(ackResult.acknowledged, true, "Acknowledged flag must be true");
assert.strictEqual(restartedEngine.activeAlerts.length, totalBefore - 1, "Alert must be removed from active display");

// Verify history retained
const historyItem = restartedEngine.history.find(h => h.id === targetAlert.id);
assert.ok(historyItem, "Acknowledged alert must remain in searchable history");
assert.strictEqual(historyItem.acknowledged, true, "History item must show acknowledged: true");
console.log("  PASS: [NOTED] dismissed active card and preserved event in history.");

// --- TEST 18: Action Center Clear All Protection ---
console.log("Test 18: Action Center Clear All protection...");
const activeRemaining = restartedEngine.clearActionCenterPreservingIntelligence();
assert.ok(activeRemaining.length > 0, "Clear All must preserve unacknowledged intelligence alerts");
console.log(`  PASS: Clear All called, all ${activeRemaining.length} unacknowledged alerts preserved.`);

// --- TEST 19: East-2 and East-3 Isolation ---
console.log("Test 19: East-2 and East-3 bidirectional isolation...");
// Seed an alert in East-3
engineE3.processSnapshot({
    campaigns: [{ id: "e3_c1", name: "E3 Campaign", goals: 5 }],
    queues: [],
    isCampaignsRoute: true,
    campaignTableFound: true
});
engineE3.processSnapshot({
    campaigns: [{ id: "e3_c1", name: "E3 Campaign", goals: 9 }], // +4 Goals
    queues: [],
    isCampaignsRoute: true,
    campaignTableFound: true
});
assert.strictEqual(engineE3.activeAlerts.length, 1);
assert.strictEqual(engineE3.activeAlerts[0].dialer, "EAST-3");

// Check East-2 storage has ZERO East-3 items and vice-versa
const e2Keys = Array.from(storageE2.store.keys());
const e3Keys = Array.from(storageE3.store.keys());
assert.ok(e2Keys.every(k => k.startsWith("ct_east2_")), "All East-2 storage keys must have 'ct_east2_' prefix");
assert.ok(e3Keys.every(k => k.startsWith("ct_east3_")), "All East-3 storage keys must have 'ct_east3_' prefix");
console.log("  PASS: 100% namespace and storage isolation verified.");

// --- TEST 20: Sales / Goals Alert Independence (Engine A) ---
console.log("Test 20: Sales/Goals alert independence (Engine A)...");
engineE2.baselines["goals_OUTBOUND_c1"] = { val: 12, updatedAt: Date.now() };
engineE2.baselines["goals_INBOUND_q1"] = { val: 4, updatedAt: Date.now() };
const snapGoalsInstant = {
    campaigns: [
        { id: "c1", name: "REALTIME 101", goals: 18, sales: 5 } // Goals increased from 12 to 18
    ],
    queues: [
        { id: "q1", name: "Support Queue", goals: 7, sales: 2 }  // Goals increased from 4 to 7
    ],
    isCampaignsRoute: true,
    campaignTableFound: true,
    isStale: false,
    authLost: false
};
const alertsInstant = engineE2.processSnapshot(snapGoalsInstant);
const instantGoalAlert = alertsInstant.find(a => a.category === "SALES_GOAL" && a.targetId === "c1");
assert.ok(instantGoalAlert, "Engine A must trigger immediately on Goal increase without 2-observation delay");
assert.strictEqual(instantGoalAlert.direction, "OUTBOUND");
assert.strictEqual(instantGoalAlert.previous, 12);
assert.strictEqual(instantGoalAlert.current, 18);
assert.strictEqual(instantGoalAlert.absoluteDiff, 6);
console.log("  PASS: Engine A fired instantly on Goal increase (+6).");

console.log("\n===============================================================================");
console.log("ALL 20 DATA CHANGE INTELLIGENCE TESTS PASSED (100% SUCCESS)");
console.log("===============================================================================");
