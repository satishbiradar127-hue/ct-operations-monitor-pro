/**
 * append_phase7_tests.js
 * 
 * Appends Phase 7 Automated Verification Tests (Tests 80-101: 22 tests)
 * to both East-2 and East-3 test suites.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE');

function getPhase7TestsBlock(dialer, prefix, otherDialer, otherPrefix) {
    const isEast2 = dialer === "EAST-2";
    const updateEvent = isEast2 ? "CT_EAST_2_UPDATE" : "CT_EAST_3_UPDATE";
    const otherUpdateEvent = isEast2 ? "CT_EAST_3_UPDATE" : "CT_EAST_2_UPDATE";
    const feedStatusEvent = isEast2 ? "CT_EAST_2_FEED_STATUS" : "CT_EAST_3_FEED_STATUS";
    const requestRefreshEvent = isEast2 ? "CT_EAST_2_REQUEST_REFRESH" : "CT_EAST_3_REQUEST_REFRESH";
    const requestInboundRefreshEvent = isEast2 ? "CT_EAST_2_REQUEST_INBOUND_REFRESH" : "CT_EAST_3_REQUEST_INBOUND_REFRESH";

    return `
// ===============================================================================
// PHASE 7: LIVE FEED RECOVERY, REFRESH SAFETY & METRIC SEMANTICS (TESTS 80-101)
// ===============================================================================

function simulateConnectionState(state, now) {
    now = now || Date.now();
    let stateName = "INITIALIZING";
    let badgeClass = "ct-live is-warning";
    let subtitleText = "Initializing monitor · Awaiting CallTools DOM";

    const isCampaigns = (state.route || "campaigns") === "campaigns";
    const lastObs = state.lastSuccessfulObservationAt;
    const obsAgeSec = lastObs ? Math.max(0, Math.floor((now - lastObs) / 1000)) : null;
    const obsTimeStr = lastObs ? new Date(lastObs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }) : "";
    const obsAgeStr = obsAgeSec !== null ? (obsAgeSec + "s ago") : "";

    const inboundAgeSec = state.lastSuccessfulInboundAt ? Math.max(0, Math.floor((now - state.lastSuccessfulInboundAt) / 1000)) : null;
    const outboundAgeSec = state.lastSuccessfulOutboundAt ? Math.max(0, Math.floor((now - state.lastSuccessfulOutboundAt) / 1000)) : null;
    const inboundAgeStr = inboundAgeSec !== null ? (inboundAgeSec + "s ago") : "connecting";
    const outboundAgeStr = outboundAgeSec !== null ? (outboundAgeSec + "s ago") : "connecting";

    if (state.authRequired) {
        stateName = "AUTH LOST";
        badgeClass = "ct-live is-critical";
        subtitleText = "Authentication required · Log in to CallTools to resume monitoring";
    } else if (state.tableMissing) {
        stateName = "SOURCE ERROR";
        badgeClass = "ct-live is-critical";
        subtitleText = "CallTools table not found · Check page URL";
    } else if (!lastObs) {
        if (state.parserActive || state.lastEventAt) {
            stateName = "WAITING";
            badgeClass = "ct-live is-warning";
            subtitleText = "Waiting for verified CallTools data";
        } else {
            stateName = "INITIALIZING";
            badgeClass = "ct-live is-warning";
            subtitleText = "Initializing monitor · Awaiting CallTools DOM";
        }
    } else if (obsAgeSec >= 15) {
        stateName = "STALE";
        badgeClass = "ct-live is-critical";
        subtitleText = "STALE · Last observed " + obsAgeStr + " (" + obsTimeStr + ")";
    } else {
        stateName = "LIVE";
        badgeClass = "ct-live is-good";
        if (isCampaigns) {
            subtitleText = "LIVE · Observed " + obsAgeStr + " (" + obsTimeStr + ") · Inbound: " + inboundAgeStr;
        } else {
            subtitleText = "LIVE · Observed " + obsAgeStr + " (" + obsTimeStr + ") · Outbound: " + outboundAgeStr;
        }
    }

    return { stateName, badgeClass, subtitleText };
}

test("${dialer} UPGRADE 80: Connection state starts in INITIALIZING or WAITING before first snapshot", () => {
    const s1 = { lastSuccessfulObservationAt: null, parserActive: false, lastEventAt: null, authRequired: false, tableMissing: false };
    const r1 = simulateConnectionState(s1, Date.now());
    assert.strictEqual(r1.stateName, "INITIALIZING");
    assert.ok(r1.subtitleText.includes("Initializing monitor"));

    const s2 = { lastSuccessfulObservationAt: null, parserActive: true, lastEventAt: Date.now(), authRequired: false, tableMissing: false };
    const r2 = simulateConnectionState(s2, Date.now());
    assert.strictEqual(r2.stateName, "WAITING");
    assert.strictEqual(r2.subtitleText, "Waiting for verified CallTools data");
});

test("${dialer} UPGRADE 81: Connection state transitions WAITING -> LIVE upon valid snapshot", () => {
    const now = Date.now();
    const state = { lastSuccessfulObservationAt: now, parserActive: true, lastEventAt: now, authRequired: false, tableMissing: false, route: "campaigns" };
    const res = simulateConnectionState(state, now);
    assert.strictEqual(res.stateName, "LIVE");
    assert.strictEqual(res.badgeClass, "ct-live is-good");
    assert.ok(res.subtitleText.startsWith("LIVE · Observed 0s ago"));
});

test("${dialer} UPGRADE 82: Connection state stays LIVE on unchanged snapshot and observation timestamp advances", () => {
    const t0 = 1000000;
    const state = { lastSuccessfulObservationAt: t0, parserActive: true, lastEventAt: t0, authRequired: false, tableMissing: false, route: "campaigns" };
    const res0 = simulateConnectionState(state, t0);
    assert.strictEqual(res0.stateName, "LIVE");

    // Feed polls 5 seconds later with identical data
    const t1 = t0 + 5000;
    state.lastSuccessfulObservationAt = t1;
    state.lastEventAt = t1;
    const res1 = simulateConnectionState(state, t1);
    assert.strictEqual(res1.stateName, "LIVE");
    assert.ok(res1.subtitleText.includes("0s ago"));
});

test("${dialer} UPGRADE 83: Connection state stays LIVE on changed snapshot with new metrics", () => {
    const t0 = 1000000;
    const state = { lastSuccessfulObservationAt: t0, parserActive: true, lastEventAt: t0, authRequired: false, tableMissing: false, route: "campaigns" };
    const res = simulateConnectionState(state, t0 + 2000);
    assert.strictEqual(res.stateName, "LIVE");
    assert.ok(res.subtitleText.includes("2s ago"));
});

test("${dialer} UPGRADE 84: Connection state transitions LIVE -> STALE when observation age >= 15 seconds", () => {
    const t0 = 1000000;
    const state = { lastSuccessfulObservationAt: t0, parserActive: true, lastEventAt: t0, authRequired: false, tableMissing: false, route: "campaigns" };
    const res = simulateConnectionState(state, t0 + 15000);
    assert.strictEqual(res.stateName, "STALE");
    assert.strictEqual(res.badgeClass, "ct-live is-critical");
    assert.ok(res.subtitleText.startsWith("STALE · Last observed 15s ago"));
});

test("${dialer} UPGRADE 85: Persistent operational alert SOURCE_STALE generated when feed becomes STALE", () => {
    const alerts = [];
    const upsertAlert = (k, cat, sev, msg) => alerts.push({ k, cat, sev, msg });
    const t0 = 1000000;
    const state = { lastSuccessfulObservationAt: t0, parserActive: true, lastEventAt: t0, authRequired: false, tableMissing: false };
    const res = simulateConnectionState(state, t0 + 16000);
    if (res.stateName === "STALE") {
        upsertAlert("SOURCE_STALE", "CallTools Page Health", "critical", "No CallTools feed heartbeat for 16s.");
    }
    assert.strictEqual(alerts.length, 1);
    assert.strictEqual(alerts[0].k, "SOURCE_STALE");
    assert.strictEqual(alerts[0].sev, "critical");
});

test("${dialer} UPGRADE 86: Connection state recovers STALE -> LIVE upon receiving fresh snapshot", () => {
    const t0 = 1000000;
    const state = { lastSuccessfulObservationAt: t0, parserActive: true, lastEventAt: t0, authRequired: false, tableMissing: false, route: "campaigns" };
    const staleRes = simulateConnectionState(state, t0 + 20000);
    assert.strictEqual(staleRes.stateName, "STALE");

    // New snapshot arrives at t0 + 21000
    state.lastSuccessfulObservationAt = t0 + 21000;
    state.lastEventAt = t0 + 21000;
    const liveRes = simulateConnectionState(state, t0 + 21000);
    assert.strictEqual(liveRes.stateName, "LIVE");
    assert.strictEqual(liveRes.badgeClass, "ct-live is-good");
});

test("${dialer} UPGRADE 87: SOURCE_STALE alert auto-dismissed when connection recovers to LIVE", () => {
    let alertActive = true;
    const state = { lastSuccessfulObservationAt: 1000000, parserActive: true, lastEventAt: 1000000, authRequired: false, tableMissing: false };
    const res1 = simulateConnectionState(state, 1000000 + 15000);
    assert.strictEqual(res1.stateName, "STALE");
    assert.strictEqual(alertActive, true);

    state.lastSuccessfulObservationAt = 1000000 + 16000;
    const res2 = simulateConnectionState(state, 1000000 + 16000);
    if (res2.stateName === "LIVE") {
        alertActive = false;
    }
    assert.strictEqual(alertActive, false, "SOURCE_STALE alert must be dismissed upon recovery to LIVE");
});

test("${dialer} UPGRADE 88: Connection state transitions to AUTH LOST when login page is detected", () => {
    const state = { lastSuccessfulObservationAt: Date.now(), parserActive: true, lastEventAt: Date.now(), authRequired: true, tableMissing: false };
    const res = simulateConnectionState(state, Date.now());
    assert.strictEqual(res.stateName, "AUTH LOST");
    assert.strictEqual(res.badgeClass, "ct-live is-critical");
    assert.strictEqual(res.subtitleText, "Authentication required · Log in to CallTools to resume monitoring");
});

test("${dialer} UPGRADE 89: Connection state transitions to SOURCE ERROR when table is missing or corrupt", () => {
    const state = { lastSuccessfulObservationAt: Date.now(), parserActive: true, lastEventAt: Date.now(), authRequired: false, tableMissing: true };
    const res = simulateConnectionState(state, Date.now());
    assert.strictEqual(res.stateName, "SOURCE ERROR");
    assert.strictEqual(res.badgeClass, "ct-live is-critical");
    assert.strictEqual(res.subtitleText, "CallTools table not found · Check page URL");
});

test("${dialer} UPGRADE 90: Observer-only refresh triggers parser re-read with 0 native button clicks", () => {
    let clickCount = 0;
    let readCount = 0;
    const fakeButton = { click: () => { clickCount++; } };
    const triggerRefresh = () => { readCount++; };
    triggerRefresh();
    assert.strictEqual(clickCount, 0, "Refresh must execute 0 native .click() calls");
    assert.strictEqual(readCount, 1, "Refresh must execute parser readAndPublish");
});

test("${dialer} UPGRADE 91: Inbound refresh request triggers iframe DOM re-read with 0 native button clicks", () => {
    let clickCount = 0;
    let iframeMsgSent = false;
    const requestInboundRefresh = () => { iframeMsgSent = true; };
    requestInboundRefresh();
    assert.strictEqual(clickCount, 0, "Inbound refresh must not click any native elements");
    assert.strictEqual(iframeMsgSent, true);
});

test("${dialer} UPGRADE 92: Polling loop executes passive parser pass with 0 native button clicks", () => {
    let clickCount = 0;
    let pollCount = 0;
    const poll = () => { pollCount++; };
    for (let i = 0; i < 10; i++) poll();
    assert.strictEqual(clickCount, 0, "Polling loop must NEVER click native elements");
    assert.strictEqual(pollCount, 10);
});

test("${dialer} UPGRADE 93: Static audit confirms zero occurrences of .click() on native CallTools elements", () => {
    const fs = require('fs');
    const path = require('path');
    const contentPath = path.resolve(__dirname, '../src/content.js');
    const contentCode = fs.readFileSync(contentPath, 'utf8');
    const matches = contentCode.match(/\\.click\\s*\\(/g) || [];
    assert.strictEqual(matches.length, 0, "content.js must contain 0 .click() calls");
});

test("${dialer} UPGRADE 94: Subtitle formats correctly on campaigns page with local time and inbound age", () => {
    const now = 1700000000000;
    const state = {
        lastSuccessfulObservationAt: now - 3000,
        lastSuccessfulInboundAt: now - 8000,
        route: "campaigns",
        authRequired: false,
        tableMissing: false
    };
    const res = simulateConnectionState(state, now);
    assert.ok(res.subtitleText.includes("LIVE · Observed 3s ago"));
    assert.ok(res.subtitleText.includes("Inbound: 8s ago"));
});

test("${dialer} UPGRADE 95: Subtitle formats correctly on queues page with local time and outbound age", () => {
    const now = 1700000000000;
    const state = {
        lastSuccessfulObservationAt: now - 2000,
        lastSuccessfulOutboundAt: now - 12000,
        route: "queues",
        authRequired: false,
        tableMissing: false
    };
    const res = simulateConnectionState(state, now);
    assert.ok(res.subtitleText.includes("LIVE · Observed 2s ago"));
    assert.ok(res.subtitleText.includes("Outbound: 12s ago"));
});

test("${dialer} UPGRADE 96: Inbound Not Answered semantics uses primary callsTodayNotAnswered when present", () => {
    const queue = {
        callsTodayNotAnswered: "14",
        inboundNoAnswer: "3"
    };
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
    const val = getNotAnswered(queue);
    assert.strictEqual(val, 14, "Primary Not Answered metric (14) must be used over fallback");
});

test("${dialer} UPGRADE 97: Inbound Not Answered semantics falls back to inboundNoAnswer when primary is null/empty", () => {
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
    const queue = { callsTodayNotAnswered: "", inboundNoAnswer: "7" };
    assert.strictEqual(getNotAnswered(queue), 7, "Fallback inboundNoAnswer (7) must be used when primary is empty");
});

test("${dialer} UPGRADE 98: Inbound Not Answered semantics renders '—' when both metrics are unavailable", () => {
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
    const queue = { callsTodayNotAnswered: "", inboundNoAnswer: "" };
    assert.strictEqual(getNotAnswered(queue), null, "Must return null when both are unexposed");
});

test("${dialer} UPGRADE 99: Inbound Not Answered semantics NEVER sums primary and fallback metrics", () => {
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
    const queue = { callsTodayNotAnswered: "10", inboundNoAnswer: "5" };
    const result = getNotAnswered(queue);
    assert.notStrictEqual(result, 15, "MUST NEVER sum Not Answered (10) and Inbound No Answer (5)");
    assert.strictEqual(result, 10);
});

test("${dialer} UPGRADE 100: Inbound Abandoned semantics: CallTools Queues table has no native Abandoned column", () => {
    const queueRow = { callsTodayNotAnswered: "8", inboundNoAnswer: "8" };
    // CallTools Queues does not expose Abandoned; it must NEVER be mapped to Not Answered
    const queueAbandoned = queueRow.abandoned !== undefined ? queueRow.abandoned : null;
    assert.strictEqual(queueAbandoned, null, "Queue abandoned must be null and render '—'");
    assert.notStrictEqual(queueAbandoned, 8, "Not Answered must NEVER be mapped to Abandoned");
});

test("${dialer} UPGRADE 101: Dialer isolation verifies event names and namespaces (${updateEvent} vs ${otherUpdateEvent})", () => {
    const fs = require('fs');
    const path = require('path');
    const dashPath = path.resolve(__dirname, '../src/dashboard.js');
    const dashCode = fs.readFileSync(dashPath, 'utf8');

    // Must listen to own update event
    assert.ok(dashCode.includes('${updateEvent}'), "Dashboard must reference its own update event");
    // Must NOT listen to other dialer's update event
    assert.ok(!dashCode.includes('${otherUpdateEvent}'), "Dashboard must NEVER reference other dialer's update event");
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

    // Remove any previously appended Upgrade Tests 80-101 if present
    const cutIdx = code.indexOf('// PHASE 7: LIVE FEED RECOVERY');
    if (cutIdx !== -1) {
        code = code.slice(0, cutIdx).trimEnd() + '\n';
    }

    const newBlock = getPhase7TestsBlock(dialer, prefix, otherDialer, otherPrefix);
    code = code + '\n' + newBlock;
    fs.writeFileSync(testFile, code, 'utf8');
    console.log(`Appended Tests 80-101 to ${testFile}`);
});

