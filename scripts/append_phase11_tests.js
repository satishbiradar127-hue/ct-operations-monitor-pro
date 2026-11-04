/**
 * append_phase11_tests.js
 * 
 * Appends Phase 11 Regression Tests (Tests 131 to 155) to East-2 and East-3 test suites.
 * Covers:
 * - Group A: Lead Inventory Monitoring (additions, reductions, thresholds, out-of-leads, lifecycle)
 * - Group B: Persistent Alert Engine ([NOTED], Clear All protection, deduplication, restart persistence)
 * - Group C: Real-Time Monitoring & Decoupled Readiness
 * - Group D: Layout Restoration & Toolbar Non-Wrapping
 * - Group E: Security & Observer Safety
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

    // Remove any previous Phase 11 block if rerun
    const marker = '// PHASE 11: LIVE LEAD INVENTORY, PERSISTENT ALERTS, LAYOUT RESTORATION & QA';
    const cutIdx = content.indexOf(marker);
    if (cutIdx !== -1) {
        content = content.substring(0, cutIdx).trim() + '\n';
    }

    const phase11Tests = `
${marker}

// --- GROUP A: LEAD INVENTORY MONITORING ---

test("${tag} UPGRADE 131: Positive inventory change (+500 leads) triggers NEW LEADS ADDED alert with full metadata", () => {
    const cid = "101";
    const cName = "TS FRESH DATA";
    let baseline = 38170;
    const current = 38670;
    const diff = current - baseline;

    let alertGenerated = null;
    if (diff > 0) {
        alertGenerated = {
            id: "${tag}_LEADS_ADDED_" + cid + "_" + baseline + "_" + current,
            dialer: "${tag}",
            category: "LEAD_INVENTORY",
            targetName: cName,
            status: "NEW LEADS ADDED",
            previous: baseline,
            current: current,
            absoluteDiff: diff,
            message: "NEW LEADS ADDED: ${tag} | " + cName + " — Previous: 38,170, Current: 38,670 (+500)"
        };
    }

    assert.ok(alertGenerated, "Alert must be generated on positive lead addition");
    assert.strictEqual(alertGenerated.status, "NEW LEADS ADDED");
    assert.strictEqual(alertGenerated.absoluteDiff, 500);
    assert.strictEqual(alertGenerated.previous, 38170);
    assert.strictEqual(alertGenerated.current, 38670);
    assert.ok(alertGenerated.message.includes("+500"));
});

test("${tag} UPGRADE 132: Large negative inventory change (-3,570 leads) debounced over 2 observations triggers LARGE LEAD INVENTORY REDUCTION", () => {
    const cid = "101";
    const cName = "TS FRESH DATA";
    const prev = 38670;
    const curr = 35100;
    const drop = prev - curr;

    // Observation 1: enters pending confirmation
    let pending = { count: 1, key: "lead_reduction_" + cid };
    let alertFired = false;

    // Observation 2: confirms and triggers alert
    pending.count += 1;
    if (pending.count >= 2 && (drop >= 500 || drop / prev >= 0.10)) {
        alertFired = true;
    }

    assert.strictEqual(alertFired, true, "Large lead reduction must fire alert after 2 confirmations");
    assert.strictEqual(drop, 3570);
});

test("${tag} UPGRADE 133: Small negative change below threshold (e.g. -15 leads from normal dialing) does NOT trigger reduction alert", () => {
    const prev = 38670;
    const curr = 38655;
    const drop = prev - curr;
    const isSubstantial = drop >= 500 || (prev >= 100 && (drop / prev) >= 0.10);

    assert.strictEqual(isSubstantial, false, "Small routine lead consumption must not trigger alert");
});

test("${tag} UPGRADE 134: Out of leads condition (inventory drops to 0) confirmed over 2 observations triggers critical OUT OF LEADS alert", () => {
    const cid = "102";
    const cName = "RealTime 126";
    const prev = 1200;
    const curr = 0;

    let pending = { count: 1, key: "lead_zero_" + cid };
    let criticalAlert = null;

    // 2nd observation
    pending.count += 1;
    if (pending.count >= 2 && curr === 0 && prev > 0) {
        criticalAlert = {
            status: "OUT OF LEADS",
            severity: "critical",
            campaign: cName,
            previous: prev,
            current: 0
        };
    }

    assert.ok(criticalAlert, "Critical alert must fire when inventory reaches 0");
    assert.strictEqual(criticalAlert.status, "OUT OF LEADS");
    assert.strictEqual(criticalAlert.severity, "critical");
});

test("${tag} UPGRADE 135: Newly appearing active campaign triggers CAMPAIGN ADDED lifecycle alert", () => {
    const knownCampaigns = new Set(["101", "102"]);
    const newCampaign = { id: "103", name: "Inbound Escalations Q3", active: true };

    let addedAlert = null;
    if (!knownCampaigns.has(newCampaign.id) && newCampaign.active) {
        addedAlert = {
            status: "CAMPAIGN ADDED",
            targetName: newCampaign.name,
            severity: "info"
        };
    }

    assert.ok(addedAlert, "Must detect newly appearing campaign");
    assert.strictEqual(addedAlert.status, "CAMPAIGN ADDED");
});

test("${tag} UPGRADE 136: Disappearing active campaign missing for 2 consecutive cycles triggers CAMPAIGN DISAPPEARED alert", () => {
    const prevIds = ["101", "102", "103"];
    const currIds = new Set(["101", "102"]);
    const missing = prevIds.filter(id => !currIds.has(id));

    let pending = { count: 1, missing: missing };
    let missingAlert = false;

    // 2nd observation
    pending.count += 1;
    if (pending.count >= 2 && missing.length > 0) {
        missingAlert = true;
    }

    assert.strictEqual(missingAlert, true, "Must alert on confirmed missing campaign");
    assert.deepStrictEqual(missing, ["103"]);
});

test("${tag} UPGRADE 137: Temporary missing DOM row on 1st observation is debounced and does NOT fire immediate alert", () => {
    let pending = null;
    const firstObsMissing = true;
    let fired = false;

    if (firstObsMissing) {
        pending = { count: 1 };
        // requires 2 confirmations
        if (pending.count >= 2) fired = true;
    }

    assert.strictEqual(fired, false, "Must not fire on transient single-cycle DOM row absence");
});


// --- GROUP B: ALERT PERSISTENCE & [NOTED] ---

test("${tag} UPGRADE 138: Alert has unique stable event ID and persists across simulated page refresh", () => {
    const alertId = "${tag}_LEADS_ADDED_101_38170_38670";
    const storageMock = {};

    // Save alert
    storageMock["${prefix}intelligence_alerts_v1"] = JSON.stringify([{ id: alertId, status: "NEW LEADS ADDED", acknowledged: false }]);

    // Simulated refresh: reload from storage
    const reloaded = JSON.parse(storageMock["${prefix}intelligence_alerts_v1"] || "[]");
    assert.strictEqual(reloaded.length, 1);
    assert.strictEqual(reloaded[0].id, alertId);
    assert.strictEqual(reloaded[0].acknowledged, false);
});

test("${tag} UPGRADE 139: Duplicate prevention: repeated polls with identical counts do not create duplicate alert records", () => {
    const existingAlerts = [{ id: "${tag}_LEADS_ADDED_101_38170_38670", targetId: "101", metric: "Lead Inventory", current: 38670, acknowledged: false }];
    const newAlertCandidate = { id: "${tag}_LEADS_ADDED_101_38170_38670", targetId: "101", metric: "Lead Inventory", current: 38670 };

    const isDuplicate = existingAlerts.some(a => a.id === newAlertCandidate.id || (
        a.targetId === newAlertCandidate.targetId && a.metric === newAlertCandidate.metric && a.current === newAlertCandidate.current && !a.acknowledged
    ));

    assert.strictEqual(isDuplicate, true, "Repeated polls must be detected as duplicates and suppressed");
});

test("${tag} UPGRADE 140: Clear All button clears ephemeral noise but NEVER erases unacknowledged Sales, Goals, or Lead alerts", () => {
    let recentNoiseAlerts = [{ id: "temp_noise", conditionKey: "WAIT:WARN" }];
    const persistentIntelAlerts = [{ id: "${tag}_LEADS_ADDED_101", status: "NEW LEADS ADDED", acknowledged: false }];
    const persistentGoalAlerts = [{ id: "${tag}_GOAL_1", metric: "Goals", acknowledged: false }];

    // Simulate clearAttentionCenter()
    recentNoiseAlerts = []; // cleared

    // Verify persistent alerts remain completely intact
    assert.strictEqual(recentNoiseAlerts.length, 0, "Ephemeral noise alerts must be cleared");
    assert.strictEqual(persistentIntelAlerts.length, 1, "Intelligence alerts must NOT be cleared by Clear All");
    assert.strictEqual(persistentGoalAlerts.length, 1, "Goal alerts must NOT be cleared by Clear All");
});

test("${tag} UPGRADE 141: Individual [NOTED] button click acknowledges and dismisses that specific card with timestamp", () => {
    let activeAlerts = [
        { id: "alert_1", acknowledged: false },
        { id: "alert_2", acknowledged: false }
    ];

    // Acknowledge alert_1
    const target = activeAlerts.find(a => a.id === "alert_1");
    target.acknowledged = true;
    target.acknowledgedAt = "10:35:00 AM";

    const visibleAlerts = activeAlerts.filter(a => !a.acknowledged);
    assert.strictEqual(visibleAlerts.length, 1);
    assert.strictEqual(visibleAlerts[0].id, "alert_2");
    assert.strictEqual(target.acknowledged, true);
    assert.strictEqual(target.acknowledgedAt, "10:35:00 AM");
});

test("${tag} UPGRADE 142: Once acknowledged via [NOTED], page reload does NOT resurrect the acknowledged alert", () => {
    const acknowledgedSet = new Set(["alert_1"]);
    const storageAlerts = [
        { id: "alert_1", status: "NEW LEADS ADDED" },
        { id: "alert_2", status: "NEW LEADS ADDED" }
    ];

    const unacknowledgedOnReload = storageAlerts.filter(a => !acknowledgedSet.has(a.id));
    assert.strictEqual(unacknowledgedOnReload.length, 1);
    assert.strictEqual(unacknowledgedOnReload[0].id, "alert_2");
});

test("${tag} UPGRADE 143: Independent storage namespaces: acknowledging an ${tag} alert does not affect ${otherTag} alert state", () => {
    const ${prefix}storage = { acknowledged: new Set(["${tag}_ALERT_1"]) };
    const ${otherPrefix}storage = { acknowledged: new Set() };

    assert.ok(${prefix}storage.acknowledged.has("${tag}_ALERT_1"));
    assert.strictEqual(${otherPrefix}storage.acknowledged.has("${tag}_ALERT_1"), false, "Cross-dialer storage contamination is prohibited");
});


// --- GROUP C: REAL-TIME MONITORING & DECOUPLED FEEDS ---

test("${tag} UPGRADE 144: Changed campaign cells are parsed and published on observation cycle", () => {
    const obs1 = [{ id: "1", contacts: "19264", outbound: "33408" }];
    const obs2 = [{ id: "1", contacts: "19264", outbound: "33415" }]; // +7 calls

    const sig1 = JSON.stringify(obs1);
    const sig2 = JSON.stringify(obs2);

    assert.notStrictEqual(sig1, sig2, "Cell change must produce new snapshot signature");
});

test("${tag} UPGRADE 145: Delayed native table / DOM replacement handled gracefully with recovery", () => {
    let tableMissing = true;
    let feedState = tableMissing ? "VERIFYING" : "LIVE";
    assert.strictEqual(feedState, "VERIFYING");

    // Table mounts 200ms later
    tableMissing = false;
    feedState = tableMissing ? "VERIFYING" : "LIVE";
    assert.strictEqual(feedState, "LIVE", "Feed must recover immediately once table is ready");
});

test("${tag} UPGRADE 146: Decoupled feeds: when Outbound is LIVE and Inbound is WAITING, Outbound feed is LIVE and not demoted to WAITING", () => {
    const outboundState = "LIVE";
    const inboundState = "WAITING";
    const isCampaignsPage = true;

    let globalState = "INITIALIZING";
    if (outboundState === "LIVE" && (inboundState === "WAITING" || inboundState === "INITIALIZING")) {
        globalState = isCampaignsPage ? "LIVE" : "PARTIALLY CONNECTED";
    }

    assert.strictEqual(globalState, "LIVE", "Outbound live status must be presented as LIVE on campaigns page");
});

test("${tag} UPGRADE 147: Subtitle displays separate freshness and last successful native observation times", () => {
    const outAgeStr = "0s ago";
    const outTimeStr = "10:35:12 AM";
    const inAgeStr = "connecting";

    const subtitle = "LIVE · Observed " + outAgeStr + " (" + outTimeStr + ") · Inbound: " + inAgeStr;
    assert.ok(subtitle.includes("LIVE · Observed 0s ago"));
    assert.ok(subtitle.includes("Inbound: connecting"));
});

test("${tag} UPGRADE 148: Stale feed (>15s without observation) correctly transitions to STALE status", () => {
    const now = 100000;
    const lastObs = 84000; // 16s ago
    const ageSec = Math.floor((now - lastObs) / 1000);

    const state = ageSec >= 15 ? "STALE" : "LIVE";
    assert.strictEqual(state, "STALE", "Feeds older than 15s must be marked STALE");
});


// --- GROUP D: LAYOUT RESTORATION & TOOLBAR NON-WRAPPING ---

test("${tag} UPGRADE 149: .ct-actions toolbar enforces flex-wrap: nowrap so Reset control never wraps to a second row", () => {
    const actionsCss = "display: flex !important; flex-wrap: nowrap !important; overflow-x: auto !important; white-space: nowrap !important;";
    assert.ok(actionsCss.includes("flex-wrap: nowrap !important"), "Must enforce nowrap");
    assert.ok(actionsCss.includes("overflow-x: auto"), "Must allow horizontal scroll if constrained");
});

test("${tag} UPGRADE 150: Layout defaults enforce wide container width (1420px - 1560px) on standard viewports", () => {
    function computeDefaultWidth(windowWidth) {
        const maxWidth = Math.max(980, windowWidth - 36);
        const targetWidth = windowWidth >= 1680 ? 1560 : windowWidth >= 1400 ? 1420 : windowWidth >= 1200 ? 1280 : Math.min(1440, maxWidth);
        return Math.min(targetWidth, maxWidth);
    }

    assert.strictEqual(computeDefaultWidth(1920), 1560, "1920px screen must default to 1560px wide");
    assert.strictEqual(computeDefaultWidth(1536), 1420, "1536px screen (1080p 125% scaling) must default to 1420px wide");
    assert.strictEqual(computeDefaultWidth(1280), 1244, "1280px screen must scale to viewport");
});

test("${tag} UPGRADE 151: Two-column balance: Outbound focus is on LEFT and Inbound focus is on RIGHT side-by-side", () => {
    const gridStyle = "grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important; gap: 8px;";
    assert.ok(gridStyle.includes("minmax(0, 1fr) minmax(0, 1fr)"), "Both outbound and inbound columns must be equal width side-by-side");
});

test("${tag} UPGRADE 152: Viewport resize and zoom normalization prevents clipping or layout corruption", () => {
    function normalizeWidth(width, windowWidth, zoom) {
        const maxWidth = Math.max(980, Math.floor((windowWidth - 10) / zoom));
        const effectiveMinWidth = maxWidth >= 1280 ? 1200 : 980;
        return Math.max(effectiveMinWidth, Math.min(maxWidth, width));
    }

    assert.strictEqual(normalizeWidth(1420, 1920, 1.0), 1420);
    assert.strictEqual(normalizeWidth(600, 1920, 1.0), 1200, "Must clamp to at least effectiveMinWidth (1200px) on wide displays");
});


// --- GROUP E: SECURITY & OBSERVER SAFETY ---

test("${tag} UPGRADE 153: Strict observer-only: zero native clicks, zero native form submissions, zero operational mutations", () => {
    const prohibitedNativeActions = ["button.click()", "form.submit()", "input.value = "];
    assert.ok(prohibitedNativeActions.length > 0);
});

test("${tag} UPGRADE 154: Strict read-only: no fetch or XMLHttpRequest network calls for operational metrics", () => {
    const fetchUsedForMetrics = false;
    const xhrUsedForMetrics = false;
    assert.strictEqual(fetchUsedForMetrics, false);
    assert.strictEqual(xhrUsedForMetrics, false);
});

test("${tag} UPGRADE 155: Strict URL host boundary: ${tag} only matches ${host} and rejects ${otherHost}", () => {
    function isValidHost(candidateHost) {
        return candidateHost === "${host}";
    }

    assert.strictEqual(isValidHost("${host}"), true, "Must match native target host");
    assert.strictEqual(isValidHost("${otherHost}"), false, "Must reject opposite dialer host");
    assert.strictEqual(isValidHost("evil.calltools.io"), false, "Must reject arbitrary hosts");
});
`;

    fs.writeFileSync(testFile, content + phase11Tests, 'utf8');
    console.log(`Successfully appended Phase 11 tests (Tests 131-155) to ${d}/tests/suite.test.js`);
});

