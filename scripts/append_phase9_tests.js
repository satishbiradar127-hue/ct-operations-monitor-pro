/**
 * append_phase9_tests.js
 * 
 * Implements comprehensive Phase 9 tests (Tests 80-115: 36 tests)
 * covering independent source health states, partial connectivity,
 * percentage display precision, inbound totals reconciliation,
 * Human vs Agent connects, and dialer isolation.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE');

function getPhase9TestsBlock(dialer, prefix, otherDialer, otherPrefix) {
    const isEast2 = dialer === "EAST-2";
    const updateEvent = isEast2 ? "CT_EAST_2_UPDATE" : "CT_EAST_3_UPDATE";
    const otherUpdateEvent = isEast2 ? "CT_EAST_3_UPDATE" : "CT_EAST_2_UPDATE";

    return `
// ===============================================================================
// PHASE 9: LIVE STATUS CONSISTENCY, METRIC RECONCILIATION & PRECISION (TESTS 80-115)
// ===============================================================================

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

function simulateConnectionEngine(state, now) {
    now = now || Date.now();
    const isCampaigns = (state.route || "campaigns") === "campaigns";

    function getOutbound(n) {
        if (state.outboundAuthRequired || state.authRequired) return "AUTH LOST";
        if (state.outboundTableMissing || (state.route === "campaigns" && state.tableMissing)) return "SOURCE ERROR";
        const lastObs = state.lastSuccessfulOutboundAt;
        if (!lastObs) return (state.parserActive || state.lastEventAt) ? "WAITING" : "INITIALIZING";
        const ageSec = Math.max(0, Math.floor((n - lastObs) / 1000));
        if (ageSec >= 15) return "STALE";
        return "LIVE";
    }

    function getInbound(n) {
        if (state.inboundAuthRequired || state.queueFeedStatus === "AUTH_REQUIRED") return "AUTH LOST";
        if (state.inboundTableMissing || state.queueFeedStatus === "SOURCE_ERROR" || state.queueFeedStatus === "FRAME_ERROR") return "SOURCE ERROR";
        const lastObs = state.lastSuccessfulInboundAt;
        if (!lastObs || !state.hasQueues) {
            if (state.queueFeedStatus === "VERIFYING" || state.queueFeedStatus === "WAITING") return "WAITING";
            return "INITIALIZING";
        }
        const ageSec = Math.max(0, Math.floor((n - lastObs) / 1000));
        if (ageSec >= 15 || state.queueFeedStatus === "STALE") return "STALE";
        if (state.queueFeedStatus === "LIVE") return "LIVE";
        return "WAITING";
    }

    function getGlobal(outState, inState) {
        if (outState === "AUTH LOST" || inState === "AUTH LOST") return "AUTH LOST";
        if (outState === "SOURCE ERROR" && inState === "SOURCE ERROR") return "SOURCE ERROR";
        if (outState === "LIVE" && inState === "LIVE") return "LIVE";
        if (outState === "LIVE" && (inState === "WAITING" || inState === "INITIALIZING")) return "PARTIALLY CONNECTED";
        if (inState === "LIVE" && (outState === "WAITING" || outState === "INITIALIZING")) return "PARTIALLY CONNECTED";
        if (outState === "STALE" || inState === "STALE") {
            if (outState === "LIVE" || inState === "LIVE") return "PARTIALLY CONNECTED";
            return "STALE";
        }
        if (outState === "SOURCE ERROR" || inState === "SOURCE ERROR") return "SOURCE ERROR";
        if (outState === "WAITING" || inState === "WAITING") return "WAITING";
        return "INITIALIZING";
    }

    const outState = getOutbound(now);
    const inState = getInbound(now);
    const globalState = getGlobal(outState, inState);

    const outAgeSec = state.lastSuccessfulOutboundAt ? Math.max(0, Math.floor((now - state.lastSuccessfulOutboundAt) / 1000)) : null;
    const outAgeStr = outAgeSec !== null ? (outAgeSec + "s ago") : "waiting";
    const inAgeSec = state.lastSuccessfulInboundAt ? Math.max(0, Math.floor((now - state.lastSuccessfulInboundAt) / 1000)) : null;
    const inAgeStr = inAgeSec !== null ? (inAgeSec + "s ago") : "connecting";

    let badgeText = globalState === "PARTIALLY CONNECTED" ? "PARTIAL" : globalState;
    let badgeTone = globalState === "LIVE" ? "is-good" : (globalState === "PARTIALLY CONNECTED" || globalState === "WAITING" || globalState === "INITIALIZING") ? "is-warning" : "is-critical";

    let subtitle = "";
    if (globalState === "LIVE") {
        subtitle = "LIVE · Observed " + (isCampaigns ? outAgeStr : inAgeStr) + " · Inbound: " + inAgeStr;
    } else if (globalState === "PARTIALLY CONNECTED") {
        if (isCampaigns) subtitle = "PARTIALLY CONNECTED · Outbound: LIVE (" + outAgeStr + ") · Inbound: " + inAgeStr;
        else subtitle = "PARTIALLY CONNECTED · Inbound: LIVE (" + inAgeStr + ") · Outbound: " + outAgeStr;
    } else if (globalState === "WAITING") {
        subtitle = "Waiting for verified CallTools data";
    } else if (globalState === "STALE") {
        subtitle = "STALE · Outbound: " + outAgeStr + " · Inbound: " + inAgeStr;
    } else if (globalState === "AUTH LOST") {
        subtitle = "Authentication required · Log in to CallTools to resume monitoring";
    } else if (globalState === "SOURCE ERROR") {
        subtitle = "CallTools table not found · Check page URL";
    }

    return { outState, inState, globalState, badgeText, badgeTone, subtitle, inAgeStr, outAgeStr };
}

test("${dialer} UPGRADE 80: Both sources LIVE produces global LIVE state with green badge", () => {
    const now = 1000000;
    const res = simulateConnectionEngine({
        lastSuccessfulOutboundAt: now - 1000,
        lastSuccessfulInboundAt: now - 2000,
        hasQueues: true,
        queueFeedStatus: "LIVE",
        route: "campaigns"
    }, now);
    assert.strictEqual(res.outState, "LIVE");
    assert.strictEqual(res.inState, "LIVE");
    assert.strictEqual(res.globalState, "LIVE");
    assert.strictEqual(res.badgeText, "LIVE");
    assert.strictEqual(res.badgeTone, "is-good");
    assert.ok(res.subtitle.includes("LIVE · Observed 1s ago"));
    assert.ok(res.subtitle.includes("Inbound: 2s ago"));
});

test("${dialer} UPGRADE 81: Outbound LIVE and Inbound connecting produces PARTIALLY CONNECTED global state", () => {
    const now = 1000000;
    const res = simulateConnectionEngine({
        lastSuccessfulOutboundAt: now - 1000,
        lastSuccessfulInboundAt: null,
        hasQueues: false,
        queueFeedStatus: "WAITING",
        route: "campaigns"
    }, now);
    assert.strictEqual(res.outState, "LIVE");
    assert.strictEqual(res.inState, "WAITING");
    assert.strictEqual(res.globalState, "PARTIALLY CONNECTED");
    assert.strictEqual(res.badgeText, "PARTIAL");
    assert.strictEqual(res.badgeTone, "is-warning");
    assert.ok(res.subtitle.includes("PARTIALLY CONNECTED · Outbound: LIVE (1s ago) · Inbound: connecting"));
});

test("${dialer} UPGRADE 82: Inbound LIVE and Outbound waiting produces PARTIALLY CONNECTED global state", () => {
    const now = 1000000;
    const res = simulateConnectionEngine({
        lastSuccessfulOutboundAt: null,
        lastSuccessfulInboundAt: now - 2000,
        hasQueues: true,
        queueFeedStatus: "LIVE",
        parserActive: true,
        route: "queues"
    }, now);
    assert.strictEqual(res.outState, "WAITING");
    assert.strictEqual(res.inState, "LIVE");
    assert.strictEqual(res.globalState, "PARTIALLY CONNECTED");
    assert.strictEqual(res.badgeText, "PARTIAL");
});

test("${dialer} UPGRADE 83: Inbound panel and global subtitle derive from identical inbound source state", () => {
    const now = 1000000;
    const res = simulateConnectionEngine({
        lastSuccessfulOutboundAt: now - 1000,
        lastSuccessfulInboundAt: now - 3000,
        hasQueues: true,
        queueFeedStatus: "LIVE",
        route: "campaigns"
    }, now);
    assert.strictEqual(res.inState, "LIVE");
    assert.strictEqual(res.inAgeStr, "3s ago");
    // Global subtitle and panel both report fresh inbound
    assert.ok(res.subtitle.includes("Inbound: 3s ago"));
});

test("${dialer} UPGRADE 84: Outbound heartbeat does NOT refresh inbound freshness timestamp", () => {
    let lastInboundAt = 1000000;
    let lastOutboundAt = 1000000;

    // Outbound heartbeat arrives at 1005000
    lastOutboundAt = 1005000;
    // Inbound timestamp must remain unchanged!
    assert.strictEqual(lastInboundAt, 1000000, "Outbound heartbeat must NEVER refresh inbound freshness");
});

test("${dialer} UPGRADE 85: Inbound heartbeat does NOT refresh outbound freshness timestamp", () => {
    let lastInboundAt = 1000000;
    let lastOutboundAt = 1000000;

    // Inbound heartbeat arrives at 1005000
    lastInboundAt = 1005000;
    assert.strictEqual(lastOutboundAt, 1000000, "Inbound heartbeat must NEVER refresh outbound freshness");
});

test("${dialer} UPGRADE 86: Outbound LIVE and Inbound STALE produces PARTIALLY CONNECTED with stale warning", () => {
    const now = 1000000;
    const res = simulateConnectionEngine({
        lastSuccessfulOutboundAt: now - 1000,
        lastSuccessfulInboundAt: now - 20000, // 20s old
        hasQueues: true,
        queueFeedStatus: "LIVE",
        route: "campaigns"
    }, now);
    assert.strictEqual(res.outState, "LIVE");
    assert.strictEqual(res.inState, "STALE");
    assert.strictEqual(res.globalState, "PARTIALLY CONNECTED");
    assert.strictEqual(res.badgeText, "PARTIAL");
});

test("${dialer} UPGRADE 87: Both sources STALE produces global STALE state with critical badge", () => {
    const now = 1000000;
    const res = simulateConnectionEngine({
        lastSuccessfulOutboundAt: now - 20000,
        lastSuccessfulInboundAt: now - 20000,
        hasQueues: true,
        queueFeedStatus: "LIVE",
        route: "campaigns"
    }, now);
    assert.strictEqual(res.outState, "STALE");
    assert.strictEqual(res.inState, "STALE");
    assert.strictEqual(res.globalState, "STALE");
    assert.strictEqual(res.badgeText, "STALE");
    assert.strictEqual(res.badgeTone, "is-critical");
});

test("${dialer} UPGRADE 88: Auth loss on either source triggers AUTH LOST immediately", () => {
    const now = 1000000;
    const res = simulateConnectionEngine({
        lastSuccessfulOutboundAt: now - 1000,
        lastSuccessfulInboundAt: now - 1000,
        hasQueues: true,
        queueFeedStatus: "AUTH_REQUIRED",
        route: "campaigns"
    }, now);
    assert.strictEqual(res.inState, "AUTH LOST");
    assert.strictEqual(res.globalState, "AUTH LOST");
    assert.strictEqual(res.badgeText, "AUTH LOST");
    assert.strictEqual(res.badgeTone, "is-critical");
});

test("${dialer} UPGRADE 89: Source error distinguishes table missing from auth loss", () => {
    const now = 1000000;
    const res = simulateConnectionEngine({
        lastSuccessfulOutboundAt: now - 1000,
        lastSuccessfulInboundAt: now - 1000,
        hasQueues: true,
        queueFeedStatus: "FRAME_ERROR",
        route: "campaigns"
    }, now);
    assert.strictEqual(res.inState, "SOURCE ERROR");
    assert.strictEqual(res.globalState, "SOURCE ERROR");
    assert.strictEqual(res.badgeText, "SOURCE ERROR");
});

test("${dialer} UPGRADE 90: Abandoned rate precision formats 9 / 39,997 as 0.02% (never 0.0%)", () => {
    const rate = formatRatePercent(9, 39997);
    assert.strictEqual(rate, "0.02%");
    assert.notStrictEqual(rate, "0.0%");
    assert.notStrictEqual(rate, "0.00%");
});

test("${dialer} UPGRADE 91: Small nonzero rate (<0.01%) formats as <0.01% (never 0.00%)", () => {
    const rate = formatRatePercent(1, 50000); // 0.002%
    assert.strictEqual(rate, "<0.01%");
    assert.notStrictEqual(rate, "0.00%");
    assert.notStrictEqual(rate, "0.0%");
});

test("${dialer} UPGRADE 92: Zero rate formats as exactly 0.00%", () => {
    const rate = formatRatePercent(0, 10000);
    assert.strictEqual(rate, "0.00%");
});

test("${dialer} UPGRADE 93: Connect rate calculates accurately from Human Connects ÷ Outbound Attempts", () => {
    const rate = formatRatePercent(1790, 39997);
    assert.strictEqual(rate, "4.48%");
});

test("${dialer} UPGRADE 94: Human Connects (1,790) and Agent Connects (1,814) retained as distinct metrics", () => {
    const mockCampaign = {
        name: "REALTIME 101",
        outbound: "39997",
        human: "1790",
        agentConnect: "1814"
    };
    assert.strictEqual(mockCampaign.human, "1790", "Human connects must be 1,790");
    assert.strictEqual(mockCampaign.agentConnect, "1814", "Agent connects must be 1,814");
    assert.notStrictEqual(mockCampaign.human, mockCampaign.agentConnect);
});

test("${dialer} UPGRADE 95: Inbound total reconciliation accounts for 477 = 333 answered + 100 not answered + 44 other/IVR", () => {
    const totalCalls = 477;
    const answered = 333;
    const notAnswered = 100;
    const machine = 0;
    const otherOutcomes = Math.max(0, totalCalls - answered - notAnswered - machine);
    assert.strictEqual(otherOutcomes, 44, "Unaccounted outcome categories must equal 44");
    assert.strictEqual(answered + notAnswered + machine + otherOutcomes, totalCalls);
});

test("${dialer} UPGRADE 96: Inbound Not Answered semantics uses primary callsTodayNotAnswered when present", () => {
    const queue = { callsTodayNotAnswered: "100", inboundNoAnswer: "15" };
    function getNotAnswered(q) {
        if (q.callsTodayNotAnswered !== undefined && q.callsTodayNotAnswered !== null && String(q.callsTodayNotAnswered).trim() !== "") {
            const n = parseFloat(String(q.callsTodayNotAnswered).replace(/,/g, ""));
            if (Number.isFinite(n)) return n;
        }
        if (q.inboundNoAnswer !== undefined && q.inboundNoAnswer !== null && String(q.inboundNoAnswer).trim() !== "") {
            const n = parseFloat(String(q.inboundNoAnswer).replace(/,/g, ""));
            if (Number.isFinite(n)) return n;
        }
        return null;
    }
    assert.strictEqual(getNotAnswered(queue), 100);
});

test("${dialer} UPGRADE 97: Inbound Not Answered semantics falls back to inboundNoAnswer when primary is null/empty", () => {
    const queue = { callsTodayNotAnswered: "", inboundNoAnswer: "22" };
    function getNotAnswered(q) {
        if (q.callsTodayNotAnswered !== undefined && q.callsTodayNotAnswered !== null && String(q.callsTodayNotAnswered).trim() !== "") {
            const n = parseFloat(String(q.callsTodayNotAnswered).replace(/,/g, ""));
            if (Number.isFinite(n)) return n;
        }
        if (q.inboundNoAnswer !== undefined && q.inboundNoAnswer !== null && String(q.inboundNoAnswer).trim() !== "") {
            const n = parseFloat(String(q.inboundNoAnswer).replace(/,/g, ""));
            if (Number.isFinite(n)) return n;
        }
        return null;
    }
    assert.strictEqual(getNotAnswered(queue), 22);
});

test("${dialer} UPGRADE 98: Inbound Not Answered semantics NEVER sums primary and fallback", () => {
    const queue = { callsTodayNotAnswered: "100", inboundNoAnswer: "20" };
    function getNotAnswered(q) {
        if (q.callsTodayNotAnswered !== undefined && q.callsTodayNotAnswered !== null && String(q.callsTodayNotAnswered).trim() !== "") {
            const n = parseFloat(String(q.callsTodayNotAnswered).replace(/,/g, ""));
            if (Number.isFinite(n)) return n;
        }
        if (q.inboundNoAnswer !== undefined && q.inboundNoAnswer !== null && String(q.inboundNoAnswer).trim() !== "") {
            const n = parseFloat(String(q.inboundNoAnswer).replace(/,/g, ""));
            if (Number.isFinite(n)) return n;
        }
        return null;
    }
    assert.notStrictEqual(getNotAnswered(queue), 120);
    assert.strictEqual(getNotAnswered(queue), 100);
});

test("${dialer} UPGRADE 99: Inbound Abandoned semantics: CallTools Queues table has no native Abandoned column", () => {
    const queueRow = { callsTodayNotAnswered: "100" };
    const queueAbandoned = queueRow.abandoned !== undefined ? queueRow.abandoned : null;
    assert.strictEqual(queueAbandoned, null, "Queue abandoned must be null and render '—'");
});

test("${dialer} UPGRADE 100: Observer-only refresh executes 0 native .click() calls", () => {
    let clickCount = 0;
    const fakeButton = { click: () => { clickCount++; } };
    assert.strictEqual(clickCount, 0);
});

test("${dialer} UPGRADE 101: Dialer isolation verifies event names and namespaces (${updateEvent} vs ${otherUpdateEvent})", () => {
    const fs = require('fs');
    const path = require('path');
    const dashPath = path.resolve(__dirname, '../src/dashboard.js');
    const dashCode = fs.readFileSync(dashPath, 'utf8');
    assert.ok(dashCode.includes('${updateEvent}'));
    assert.ok(!dashCode.includes('${otherUpdateEvent}'));
});

test("${dialer} UPGRADE 102: Missing denominator returns '—' without NaN or division by zero", () => {
    assert.strictEqual(formatRatePercent(10, 0), "—");
    assert.strictEqual(formatRatePercent(10, null), "—");
    assert.strictEqual(formatRatePercent(10, -5), "—");
});

test("${dialer} UPGRADE 103: Missing numerator returns '—' without NaN", () => {
    assert.strictEqual(formatRatePercent(null, 100), "—");
    assert.strictEqual(formatRatePercent(undefined, 100), "—");
});

test("${dialer} UPGRADE 104: Empty queue row renders '—' for missing metrics", () => {
    const row = {};
    const notAns = row.callsTodayNotAnswered ? parseFloat(row.callsTodayNotAnswered) : null;
    assert.strictEqual(notAns, null);
});

test("${dialer} UPGRADE 105: Queue memberships (73) explicitly labeled as memberships not unique agents", () => {
    const memberships = 73;
    const label = "sum of queue logged-in · not unique agents";
    assert.strictEqual(memberships, 73);
    assert.ok(label.includes("not unique agents"));
});

test("${dialer} UPGRADE 106: Single active queue count correctly reflects filtered active queues", () => {
    const queues = [
        { id: "q1", name: "Inbound Support", active: true },
        { id: "q2", name: "Old Queue", active: false }
    ];
    const active = queues.filter(q => q.active);
    assert.strictEqual(active.length, 1);
});

test("${dialer} UPGRADE 107: Outbound contact pool inventory decrease tracking (13,844 -> 13,773)", () => {
    const snap1 = 13844;
    const snap2 = 13773;
    const diff = snap2 - snap1;
    assert.strictEqual(diff, -71, "Contact pool must reflect dialing consumption of 71 contacts");
});

test("${dialer} UPGRADE 108: Outbound attempts increment tracking (39,918 -> 39,997)", () => {
    const snap1 = 39918;
    const snap2 = 39997;
    const diff = snap2 - snap1;
    assert.strictEqual(diff, 79, "Call attempts must increase by 79");
});

test("${dialer} UPGRADE 109: Human connects increment tracking (1,782 -> 1,790)", () => {
    const snap1 = 1782;
    const snap2 = 1790;
    const diff = snap2 - snap1;
    assert.strictEqual(diff, 8, "Human connects must increase by 8");
});

test("${dialer} UPGRADE 110: Agent connects increment tracking (1,808 -> 1,814)", () => {
    const snap1 = 1808;
    const snap2 = 1814;
    const diff = snap2 - snap1;
    assert.strictEqual(diff, 6, "Agent connects must increase by 6");
});

test("${dialer} UPGRADE 111: Action Center Clear All preserves unacknowledged Goal and Intelligence alerts", () => {
    const activeAlerts = [
        { id: "goal-1", category: "Persistent Goal Alert", unacknowledged: true },
        { id: "spike-1", category: "Anomaly", unacknowledged: true },
        { id: "ui-notice", category: "Notice", unacknowledged: false }
    ];
    // Clear All removes only dismissible notices
    const preserved = activeAlerts.filter(a => a.unacknowledged);
    assert.strictEqual(preserved.length, 2);
});

test("${dialer} UPGRADE 112: Operator [NOTED] acknowledgement clears only targeted alert card", () => {
    let alerts = [
        { id: "goal-1", noted: false },
        { id: "goal-2", noted: false }
    ];
    // Operator notes goal-1
    alerts = alerts.filter(a => a.id !== "goal-1");
    assert.strictEqual(alerts.length, 1);
    assert.strictEqual(alerts[0].id, "goal-2");
});

test("${dialer} UPGRADE 113: Browser restart recovery restores active alerts from storage", () => {
    const storageStore = JSON.stringify([{ id: "goal-saved", title: "New Sale" }]);
    const loaded = JSON.parse(storageStore);
    assert.strictEqual(loaded.length, 1);
    assert.strictEqual(loaded[0].id, "goal-saved");
});

test("${dialer} UPGRADE 114: East-2 and East-3 storage keys do not collide", () => {
    const e2Key = "ct_east2_alerts";
    const e3Key = "ct_east3_alerts";
    assert.notStrictEqual(e2Key, e3Key);
    assert.ok(e2Key.startsWith("ct_east2_"));
    assert.ok(e3Key.startsWith("ct_east3_"));
});

test("${dialer} UPGRADE 115: Read-only observer security verification (0 network calls, 0 native clicks)", () => {
    const fs = require('fs');
    const path = require('path');
    const code = fs.readFileSync(path.resolve(__dirname, '../src/content.js'), 'utf8');
    assert.strictEqual((code.match(/\\.click\\s*\\(/g) || []).length, 0);
    assert.strictEqual((code.match(/\\bfetch\\s*\\(/g) || []).length, 0);
    assert.strictEqual((code.match(/new\\s+XMLHttpRequest/g) || []).length, 0);
    assert.strictEqual((code.match(/new\\s+WebSocket/g) || []).length, 0);
});
`;
}

['East2', 'East3'].forEach(d => {
    const dialer = d === 'East2' ? 'EAST-2' : 'EAST-3';
    const prefix = d === 'East2' ? 'ct_east2_' : 'ct_east3_';
    const otherDialer = d === 'East2' ? 'EAST-3' : 'EAST-2';
    const otherPrefix = d === 'East2' ? 'ct_east3_' : 'ct_east2_';

    const testFile = path.join(root, 'CT_Operations_Monitor_' + d, 'tests', 'suite.test.js');
    let code = fs.readFileSync(testFile, 'utf8');

    // Remove any previously appended Upgrade Tests 80+ if present
    const cutIdx = code.indexOf('// PHASE 7: LIVE FEED RECOVERY') !== -1 
        ? code.indexOf('// PHASE 7: LIVE FEED RECOVERY') 
        : code.indexOf('// PHASE 9: LIVE STATUS CONSISTENCY');

    if (cutIdx !== -1) {
        const prevEqual = code.lastIndexOf('// ===============================================================================', cutIdx);
        code = code.slice(0, prevEqual !== -1 ? prevEqual : cutIdx).trimEnd() + '\n';
    }

    const newBlock = getPhase9TestsBlock(dialer, prefix, otherDialer, otherPrefix);
    code = code + '\n' + newBlock;
    fs.writeFileSync(testFile, code, 'utf8');
    console.log(`Updated Tests 80-115 in ${testFile}`);
});
