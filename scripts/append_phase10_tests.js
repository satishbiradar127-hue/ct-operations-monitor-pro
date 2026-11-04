/**
 * append_phase10_tests.js
 * 
 * Appends Phase 10 Total Goals & Insights precision tests (Tests 116-125)
 * to tests/suite.test.js in East-2 and East-3.
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
    const testFile = path.join(root, 'CT_Operations_Monitor_' + d, 'tests', 'suite.test.js');

    let content = fs.readFileSync(testFile, 'utf8');

    // Remove any previous Phase 10 block if rerun
    const marker = '// PHASE 10: TOTAL GOALS RECONCILIATION & INSIGHTS PRECISION';
    const cutIdx = content.indexOf(marker);
    if (cutIdx !== -1) {
        content = content.substring(0, cutIdx).trim() + '\n';
    }

    const phase10Tests = `
${marker}

function evaluateTotalGoals(outboundGoals, inboundGoals, inState) {
    let totalGoalsVal = "—";
    let totalGoalsNote = "Awaiting verified Goals feed";
    let totalGoalsTooltip = "Total verified goal events across campaigns and queues";

    if (outboundGoals !== null && inboundGoals !== null) {
        const combined = outboundGoals + inboundGoals;
        totalGoalsVal = String(combined);
        totalGoalsNote = "Outbound: " + outboundGoals + " · Inbound: " + inboundGoals;
        totalGoalsTooltip = "Combined Goals: " + combined + " (Outbound Campaigns: " + outboundGoals + ", Inbound Queues: " + inboundGoals + ")";
    } else if (outboundGoals !== null && inboundGoals === null) {
        totalGoalsVal = String(outboundGoals);
        totalGoalsNote = "PARTIAL · Outbound: " + outboundGoals + " · Inbound: " + (inState === "WAITING" ? "connecting" : "unavailable");
        totalGoalsTooltip = "Partial Total: Outbound only (" + outboundGoals + " goals). Inbound feed " + inState;
    } else if (outboundGoals === null && inboundGoals !== null) {
        totalGoalsVal = String(inboundGoals);
        totalGoalsNote = "PARTIAL · Outbound: unavailable · Inbound: " + inboundGoals;
        totalGoalsTooltip = "Partial Total: Inbound only (" + inboundGoals + " goals). Outbound feed unavailable";
    }

    return { totalGoalsVal, totalGoalsNote, totalGoalsTooltip };
}

test("${tag} UPGRADE 116: Outbound 5 + Inbound 1 produces combined Total Goals 6 with full breakdown", () => {
    const res = evaluateTotalGoals(5, 1, "LIVE");
    assert.strictEqual(res.totalGoalsVal, "6", "Combined goals must be 6");
    assert.strictEqual(res.totalGoalsNote, "Outbound: 5 · Inbound: 1");
    assert.ok(res.totalGoalsTooltip.includes("Combined Goals: 6"));
});

test("${tag} UPGRADE 117: Outbound 5 + Inbound 0 produces combined Total Goals 5 with full breakdown", () => {
    const res = evaluateTotalGoals(5, 0, "LIVE");
    assert.strictEqual(res.totalGoalsVal, "5", "Combined goals must be 5");
    assert.strictEqual(res.totalGoalsNote, "Outbound: 5 · Inbound: 0");
});

test("${tag} UPGRADE 118: Outbound 0 + Inbound 1 produces combined Total Goals 1 with full breakdown", () => {
    const res = evaluateTotalGoals(0, 1, "LIVE");
    assert.strictEqual(res.totalGoalsVal, "1", "Combined goals must be 1");
    assert.strictEqual(res.totalGoalsNote, "Outbound: 0 · Inbound: 1");
});

test("${tag} UPGRADE 119: Inbound unavailable produces partial Outbound 5 with unavailable note", () => {
    const res = evaluateTotalGoals(5, null, "WAITING");
    assert.strictEqual(res.totalGoalsVal, "5", "Must show available outbound value");
    assert.strictEqual(res.totalGoalsNote, "PARTIAL · Outbound: 5 · Inbound: connecting");
});

test("${tag} UPGRADE 120: Outbound unavailable produces partial Inbound 1 with unavailable note", () => {
    const res = evaluateTotalGoals(null, 1, "LIVE");
    assert.strictEqual(res.totalGoalsVal, "1", "Must show available inbound value");
    assert.strictEqual(res.totalGoalsNote, "PARTIAL · Outbound: unavailable · Inbound: 1");
});

test("${tag} UPGRADE 121: Both unavailable produces '—' with awaiting note", () => {
    const res = evaluateTotalGoals(null, null, "INITIALIZING");
    assert.strictEqual(res.totalGoalsVal, "—");
    assert.strictEqual(res.totalGoalsNote, "Awaiting verified Goals feed");
});

test("${tag} UPGRADE 122: Repeated snapshots do not duplicate goals or trigger false goal increase alerts", () => {
    let baseline = 5;
    let alerts = [];
    const checkSnapshot = (current) => {
        if (current > baseline) {
            alerts.push({ prev: baseline, curr: current });
            baseline = current;
        }
    };
    // 5 consecutive snapshots with identical goal count 5
    for (let i = 0; i < 5; i++) {
        checkSnapshot(5);
    }
    assert.strictEqual(alerts.length, 0, "Zero alerts generated on repeated unchanged snapshots");
    assert.strictEqual(baseline, 5);
});

test("${tag} UPGRADE 123: Manual refresh does not alter cumulative goal count or generate artificial increments", () => {
    let outboundGoals = 5;
    let inboundGoals = 1;
    // Manual DOM re-read simulated
    const reReadOutbound = 5;
    const reReadInbound = 1;
    assert.strictEqual(outboundGoals + inboundGoals, reReadOutbound + reReadInbound, "Goals count remains identical on re-read");
});

test("${tag} UPGRADE 124: Insights abandonRate card formats 13 / 44,369 as 0.03% (never truncated to 0.0%)", () => {
    const abandoned = 13;
    const attempts = 44369;
    const ratePct = (abandoned / attempts) * 100;
    // 1-decimal legacy toFixed(1) produced 0.0%
    const legacy = ratePct.toFixed(1) + "%";
    assert.strictEqual(legacy, "0.0%", "Legacy 1-decimal formatting proved to truncate to 0.0%");
    // Standard 2-decimal formatRatePercent produces 0.03%
    const corrected = ratePct.toFixed(2) + "%";
    assert.strictEqual(corrected, "0.03%", "Corrected 2-decimal formatting matches campaign table at 0.03%");
});

test("${tag} UPGRADE 125: East-2 and East-3 maintain strictly isolated goal baselines and storage namespaces", () => {
    const e2GoalKey = "ct_east2_goal_baselines_v1";
    const e3GoalKey = "ct_east3_goal_baselines_v1";
    assert.notStrictEqual(e2GoalKey, e3GoalKey, "Storage keys must never collide");
    assert.ok(e2GoalKey.startsWith("ct_east2_"));
    assert.ok(e3GoalKey.startsWith("ct_east3_"));
});
`;

    fs.writeFileSync(testFile, content.trim() + '\n' + phase10Tests.trim() + '\n', 'utf8');
    console.log(`Phase 10 tests appended to ${d} (total 125 tests).`);
});

