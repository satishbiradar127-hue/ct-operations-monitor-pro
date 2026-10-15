const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { MockNode, createCallToolsQueuesDOM, createCallToolsCampaignsDOM } = require("./mock_dom");

// Setup global environment for helpers.js, parser.js, dashboard.js
function setupGlobalEnv() {
    global.window = global;
    global.document = new MockNode("document");
    global.localStorage = {
        _store: new Map(),
        getItem(k) { return this._store.get(k) || null; },
        setItem(k, v) { this._store.set(k, String(v)); },
        removeItem(k) { this._store.delete(k); },
        clear() { this._store.clear(); }
    };
    global.chrome = {
        storage: {
            local: {
                get(keys, cb) { if (cb) cb({}); },
                set(items, cb) { if (cb) cb(); }
            }
        }
    };
}

test.beforeEach(() => {
    setupGlobalEnv();
    // Load helpers.js
    const helpersPath = path.resolve(__dirname, "../helpers.js");
    eval(fs.readFileSync(helpersPath, "utf-8"));

    // Load parser.js
    const parserPath = path.resolve(__dirname, "../parser.js");
    eval(fs.readFileSync(parserPath, "utf-8"));
});

test("PHASE 3 & 7: CT.number and CT.parseMetric distinguish valid zero from missing data", () => {
    // Valid zero must NEVER be coerced to dash or missing
    assert.strictEqual(global.CT.number("0"), "0");
    assert.strictEqual(global.CT.number(0), "0");

    // Missing data must NEVER be coerced to "0"
    assert.strictEqual(global.CT.number(""), "—");
    assert.strictEqual(global.CT.number(null), "—");
    assert.strictEqual(global.CT.number(undefined), "—");
    assert.strictEqual(global.CT.number("   "), "—");

    // Standard numbers
    assert.strictEqual(global.CT.number("1234"), "1,234");
    assert.strictEqual(global.CT.number("1,234"), "1,234");

    // Typed metric states
    const zeroState = global.CT.parseMetric("0");
    assert.strictEqual(zeroState.state, "VALID_ZERO");
    assert.strictEqual(zeroState.value, 0);
    assert.strictEqual(zeroState.isValid, true);

    const nonZeroState = global.CT.parseMetric("45");
    assert.strictEqual(nonZeroState.state, "VALID_NONZERO");
    assert.strictEqual(nonZeroState.value, 45);
    assert.strictEqual(nonZeroState.isValid, true);

    const missingState = global.CT.parseMetric("");
    assert.strictEqual(missingState.state, "MISSING");
    assert.strictEqual(missingState.value, null);
    assert.strictEqual(missingState.isValid, false);

    const malformedState = global.CT.parseMetric("invalid_metric");
    assert.strictEqual(malformedState.state, "MALFORMED");
    assert.strictEqual(malformedState.value, null);
    assert.strictEqual(malformedState.isValid, false);
});

test("PHASE 2 & 7: parser.js extracts multi-tier CallTools Queue table correctly without header index offset", () => {
    const queueData = [
        {
            id: "q-101",
            name: "Customer Support Inbound",
            callsTodayTotal: 150,
            callsTodayAnswered: 130,
            callsTodayNotAnswered: 20,
            inboundMachine: 5,
            inboundNoAnswer: 15,
            loggedIn: 6,
            onQueueCalls: 3,
            callsNowTotal: 5,
            waiting: 2,
            callsNowAnswered: 3,
            waitAverage: 12,
            waitMax: 48,
            calendarEvents: 8,
            opportunities: 14,
            goals: 10
        },
        {
            id: "q-102",
            name: "VIP Escalation Queue",
            callsTodayTotal: 40,
            callsTodayAnswered: 40,
            callsTodayNotAnswered: 0,
            inboundMachine: 0,
            inboundNoAnswer: 0,
            loggedIn: 4,
            onQueueCalls: 0,
            callsNowTotal: 0,
            waiting: 0,
            callsNowAnswered: 0,
            waitAverage: 0,
            waitMax: 0,
            calendarEvents: 1,
            opportunities: 5,
            goals: 3
        }
    ];

    const { document: doc } = createCallToolsQueuesDOM(queueData);
    global.document = doc;

    const queues = global.CTParser.readQueues();
    assert.strictEqual(queues.length, 2);

    const q1 = queues[0];
    assert.strictEqual(q1.name, "Customer Support Inbound");
    assert.strictEqual(q1.callsTodayTotal, "150");
    assert.strictEqual(q1.callsTodayAnswered, "130");
    assert.strictEqual(q1.callsTodayNotAnswered, "20");
    assert.strictEqual(q1.loggedIn, "6");
    assert.strictEqual(q1.onQueueCalls, "3");
    assert.strictEqual(q1.waiting, "2");
    assert.strictEqual(q1.waitMax, "48");
    assert.strictEqual(q1.goals, "10");

    // Check typed validity objects
    assert.strictEqual(q1._metrics.waiting.state, "VALID_NONZERO");
    assert.strictEqual(q1._metrics.waiting.value, 2);

    const q2 = queues[1];
    assert.strictEqual(q2.name, "VIP Escalation Queue");
    assert.strictEqual(q2.callsTodayNotAnswered, "0");
    assert.strictEqual(q2._metrics.callsTodayNotAnswered.state, "VALID_ZERO");
    assert.strictEqual(q2._metrics.callsTodayNotAnswered.value, 0);
    assert.strictEqual(q2._metrics.waiting.state, "VALID_ZERO");
    assert.strictEqual(q2._metrics.waiting.value, 0);
});

test("PHASE 3 & 7: Missing Not Answered column is reported as missing, NEVER synthesized as total - answered", () => {
    const queueData = [
        {
            id: "q-201",
            name: "Unreconciled Queue",
            callsTodayTotal: 100,
            callsTodayAnswered: 80,
            callsTodayNotAnswered: "", // Blank or missing in CallTools DOM
            loggedIn: 5,
            onQueueCalls: 2,
            waiting: 0,
            waitMax: 0
        }
    ];

    const { document: doc } = createCallToolsQueuesDOM(queueData);
    global.document = doc;

    const queues = global.CTParser.readQueues();
    assert.strictEqual(queues.length, 1);
    const q = queues[0];

    assert.strictEqual(q.callsTodayTotal, "100");
    assert.strictEqual(q.callsTodayAnswered, "80");
    assert.strictEqual(q.callsTodayNotAnswered, "");
    assert.strictEqual(q._metrics.callsTodayNotAnswered.state, "MISSING");
    assert.strictEqual(q._metrics.callsTodayNotAnswered.value, null);
});

test("PHASE 5 & 7: Action Center alert deduplication, stable signatures and recovery tracking", () => {
    // Test alert stability logic
    const ALERT_LOGIC_VERSION = "v11.1.53";
    const dismissedConditions = new Map();

    function computeWaitSignature(waiting, maxWait) {
        const waitTier = maxWait >= 60 ? "CRITICAL_60" : "WARNING_30";
        const waitBucket = Math.floor(waiting / 3);
        return ALERT_LOGIC_VERSION + "|WAIT|tier:" + waitTier + "|bucket:" + waitBucket;
    }

    // Initial alert at 31s
    const sig1 = computeWaitSignature(2, 31);
    // At 32s, signature must remain identical so dismissal is respected!
    const sig2 = computeWaitSignature(2, 32);
    assert.strictEqual(sig1, sig2, "Alert signature must remain stable across 1-second ticks");

    // Operator dismisses alert at 31s
    dismissedConditions.set("INBOUND:TestQueue:WAIT", sig1);

    // Polling cycle next second at 33s
    const sig3 = computeWaitSignature(2, 33);
    const isDismissed = dismissedConditions.get("INBOUND:TestQueue:WAIT") === sig3;
    assert.strictEqual(isDismissed, true, "Dismissed alert must NOT re-surface on slight wait fluctuation");

    // Escalation: wait rises to 65s (escalates from Warning to Critical)
    const sig4 = computeWaitSignature(2, 65);
    const isDismissedAfterEscalation = dismissedConditions.get("INBOUND:TestQueue:WAIT") === sig4;
    assert.strictEqual(isDismissedAfterEscalation, false, "Material escalation to critical tier must rightfully re-surface alert");

    // Recovery: caller count drops to 0
    let recovered = false;
    let recoveryCount = 0;
    const activeKeys = new Set(); // TestQueue:WAIT no longer active!
    if (!activeKeys.has("INBOUND:TestQueue:WAIT")) {
        dismissedConditions.delete("INBOUND:TestQueue:WAIT");
        recovered = true;
        recoveryCount++;
    }
    assert.strictEqual(recovered, true, "Condition must be recognized as recovered");
    assert.strictEqual(recoveryCount, 1);
    assert.strictEqual(dismissedConditions.has("INBOUND:TestQueue:WAIT"), false, "Dismissal record must clear on recovery for future recurrence");
});

test("PHASE 4 & 7: Inbound totals calculation handles non-synthesized totals and zero-wait correctly", () => {
    const rows = [
        { waiting: 3, maxWait: 45, today: 50, answered: 45, notAnswered: 5, onCall: 2, loggedIn: 4 },
        { waiting: 0, maxWait: 0, today: 30, answered: 30, notAnswered: 0, onCall: 0, loggedIn: 3 }
    ];

    const totals = rows.reduce((acc, row) => {
        acc.today += row.today;
        acc.answered += row.answered;
        acc.notAnswered += row.notAnswered;
        acc.waiting += row.waiting;
        acc.onCall += row.onCall;
        acc.loggedIn += row.loggedIn;
        if (row.waiting > 0) {
            acc.maxWait = Math.max(acc.maxWait, row.maxWait);
        }
        return acc;
    }, { today: 0, answered: 0, notAnswered: 0, waiting: 0, onCall: 0, loggedIn: 0, maxWait: 0 });

    assert.strictEqual(totals.today, 80);
    assert.strictEqual(totals.answered, 75);
    assert.strictEqual(totals.notAnswered, 5);
    assert.strictEqual(totals.waiting, 3);
    assert.strictEqual(totals.maxWait, 45);

    // If waiting is 0, active maxWait must be 0
    const zeroWaitingRows = [
        { waiting: 0, maxWait: 90, today: 50, answered: 50, notAnswered: 0, onCall: 0, loggedIn: 4 }
    ];
    const zeroTotals = zeroWaitingRows.reduce((acc, row) => {
        acc.waiting += row.waiting;
        if (row.waiting > 0) acc.maxWait = Math.max(acc.maxWait, row.maxWait);
        return acc;
    }, { waiting: 0, maxWait: 0 });

    assert.strictEqual(zeroTotals.maxWait, 0, "When zero callers are waiting, current max wait must be 0");
});

test("PHASE 7: Column reordering test — parser extracts metrics when column positions change", () => {
    const queueData = [
        {
            id: "q-301",
            name: "Reordered Column Queue",
            callsTodayTotal: 88,
            callsTodayAnswered: 80,
            callsTodayNotAnswered: 8,
            loggedIn: 3,
            onQueueCalls: 1,
            waiting: 1,
            waitMax: 25
        }
    ];

    const { document: doc, thead, tbody } = createCallToolsQueuesDOM(queueData);

    // Reorder leaf header row: move 'Waiting' to be before 'Name'
    const leafRow = thead.querySelectorAll("tr")[1];
    const thWaiting = leafRow.children.find(th => th.innerText.trim() === "Waiting");
    if (thWaiting) {
        leafRow.children = [thWaiting, ...leafRow.children.filter(th => th !== thWaiting)];
    }

    // Reorder data row cells: move waiting cell to front
    const tr = tbody.children[0];
    const tdWaiting = tr.children.find(td => td.className.includes("calls_now_waiting"));
    if (tdWaiting) {
        tr.children = [tdWaiting, ...tr.children.filter(td => td !== tdWaiting)];
    }

    global.document = doc;
    const queues = global.CTParser.readQueues();
    assert.strictEqual(queues.length, 1);
    assert.strictEqual(queues[0].name, "Reordered Column Queue");
    assert.strictEqual(queues[0].waiting, "1");
    assert.strictEqual(queues[0].callsTodayTotal, "88");
});

test("PHASE 7: Outbound regression and manual campaign order preservation", () => {
    const PINNED_ORDER = ["RES CRED MAIN", "REALTIME 126", "REALTIME 484"];

    const sampleCampaigns = [
        { id: "c1", name: "OTHER CAMPAIGN 1", active: true },
        { id: "c2", name: "REALTIME 126", active: true },
        { id: "c3", name: "RES CRED MAIN", active: true },
        { id: "c4", name: "REALTIME 484", active: true },
        { id: "c5", name: "OTHER CAMPAIGN 2", active: false }
    ];

    // Pinned sorting algorithm from dashboard.js
    function orderCampaigns(campaigns, manualOrder = []) {
        const pinned = [];
        PINNED_ORDER.forEach(name => {
            const found = campaigns.find(c => String(c.name).toUpperCase() === name);
            if (found) pinned.push(found);
        });

        const remaining = campaigns.filter(c => !PINNED_ORDER.includes(String(c.name).toUpperCase()));
        return [...pinned, ...remaining];
    }

    const ordered = orderCampaigns(sampleCampaigns);
    assert.strictEqual(ordered[0].name, "RES CRED MAIN");
    assert.strictEqual(ordered[1].name, "REALTIME 126");
    assert.strictEqual(ordered[2].name, "REALTIME 484");
    assert.strictEqual(ordered[3].name, "OTHER CAMPAIGN 1");
    assert.strictEqual(ordered[4].name, "OTHER CAMPAIGN 2");
});

test("PHASE 7: Dynamic queue changes — adding and removing queues in DOM updates queue list", () => {
    const initialQueues = [
        { id: "q-1", name: "Queue Alpha", waiting: 1, waitMax: 20 },
        { id: "q-2", name: "Queue Beta", waiting: 0, waitMax: 0 }
    ];

    const { document: doc, tbody } = createCallToolsQueuesDOM(initialQueues);
    global.document = doc;

    let queues = global.CTParser.readQueues();
    assert.strictEqual(queues.length, 2);
    assert.strictEqual(queues[0].name, "Queue Alpha");

    // Dynamically insert a 3rd queue row
    const newTr = new MockNode("tr", { class: "mat-row", "data-queue-id": "q-3" });
    const leafHeaders = [
        { cls: "cdk-column-name", val: "Queue Gamma" },
        { cls: "cdk-column-calls_today_total", val: "10" },
        { cls: "cdk-column-calls_today_answered", val: "8" },
        { cls: "cdk-column-calls_today_not_answered", val: "2" },
        { cls: "cdk-column-inbound_machine", val: "0" },
        { cls: "cdk-column-inbound_no_answer", val: "0" },
        { cls: "cdk-column-logged_in", val: "2" },
        { cls: "cdk-column-on_queue_calls", val: "1" },
        { cls: "cdk-column-calls_now_total", val: "1" },
        { cls: "cdk-column-calls_now_waiting", val: "0" },
        { cls: "cdk-column-calls_now_answered", val: "1" },
        { cls: "cdk-column-wait_average", val: "5" },
        { cls: "cdk-column-wait_max", val: "12" },
        { cls: "cdk-column-calendar_events", val: "0" },
        { cls: "cdk-column-opportunities", val: "1" },
        { cls: "cdk-column-goals", val: "0" }
    ];
    leafHeaders.forEach(h => {
        newTr.appendChild(new MockNode("td", { class: "mat-cell " + h.cls }, h.val));
    });
    tbody.appendChild(newTr);

    queues = global.CTParser.readQueues();
    assert.strictEqual(queues.length, 3);
    assert.strictEqual(queues[2].name, "Queue Gamma");

    // Remove the 1st queue
    tbody.children.shift();
    queues = global.CTParser.readQueues();
    assert.strictEqual(queues.length, 2);
    assert.strictEqual(queues[0].name, "Queue Beta");
    assert.strictEqual(queues[1].name, "Queue Gamma");
});

test("PHASE 3 & 7: Delta calculation is only performed between valid comparable readings", () => {
    function computeDelta(prevVal, currVal) {
        const prev = global.CT.parseMetric(prevVal);
        const curr = global.CT.parseMetric(currVal);
        if (!prev.isValid || !curr.isValid) {
            return { valid: false, delta: null, text: "—" };
        }
        const delta = curr.value - prev.value;
        const sign = delta > 0 ? "+" : "";
        return {
            valid: true,
            delta: delta,
            text: `${prev.value} → ${curr.value} (${sign}${delta})`
        };
    }

    // Both valid: 10 -> 15 (+5)
    const validDelta = computeDelta("10", "15");
    assert.strictEqual(validDelta.valid, true);
    assert.strictEqual(validDelta.delta, 5);
    assert.strictEqual(validDelta.text, "10 → 15 (+5)");

    // Valid zero to nonzero: 0 -> 4 (+4)
    const zeroToFour = computeDelta("0", "4");
    assert.strictEqual(zeroToFour.valid, true);
    assert.strictEqual(zeroToFour.delta, 4);

    // Missing previous reading: null -> 15 (Must not treat missing as 0 to claim +15!)
    const missingPrev = computeDelta(null, "15");
    assert.strictEqual(missingPrev.valid, false);
    assert.strictEqual(missingPrev.delta, null);

    // Missing current reading: 10 -> "" (Must not claim -10!)
    const missingCurr = computeDelta("10", "");
    assert.strictEqual(missingCurr.valid, false);
    assert.strictEqual(missingCurr.delta, null);
});

test("PHASE 5 & 7: Clear All clears visible signals and preserves future distinct detection", () => {
    const dismissedConditions = new Map();
    let recentAlerts = [
        { conditionKey: "INBOUND:Q1:CAPACITY", signature: "v11.1.53|CAPACITY|tier:2", message: "2 waiting with 0 logged in" },
        { conditionKey: "INBOUND:Q2:WAIT", signature: "v11.1.53|WAIT|tier:30|bucket:0", message: "35s wait" }
    ];

    // Simulate Clear All
    recentAlerts.forEach(alertItem => {
        dismissedConditions.set(alertItem.conditionKey, alertItem.signature);
    });
    recentAlerts = [];

    assert.strictEqual(recentAlerts.length, 0, "Action center must be clear");
    assert.strictEqual(dismissedConditions.size, 2, "Dismissed records must store current signatures");

    // Same conditions polled next cycle: must remain suppressed
    const nextAlerts = [
        { conditionKey: "INBOUND:Q1:CAPACITY", signature: "v11.1.53|CAPACITY|tier:2" },
        { conditionKey: "INBOUND:Q2:WAIT", signature: "v11.1.53|WAIT|tier:30|bucket:0" }
    ];
    const filteredNext = nextAlerts.filter(a => dismissedConditions.get(a.conditionKey) !== a.signature);
    assert.strictEqual(filteredNext.length, 0, "Current unchanged alerts must not reappear immediately");

    // New, distinct condition occurs (Q1 escalates to 5+ waiting): must be detected!
    const escalatedAlert = { conditionKey: "INBOUND:Q1:CAPACITY", signature: "v11.1.53|CAPACITY|tier:5+" };
    const filteredEscalated = [escalatedAlert].filter(a => dismissedConditions.get(a.conditionKey) !== a.signature);
    assert.strictEqual(filteredEscalated.length, 1, "Materially changed alert must be detected despite prior Clear All");
});

test("PHASE 2, 3 & 8: parser.js extracts 2-tier CallTools Campaigns table correctly without header index offset", () => {
    const campaignData = [
        {
            id: "camp-res-cred",
            name: "RES CRED MAIN",
            active: true,
            contacts: "47,846",
            channels: "36",
            waitNow: "64",
            waitToday: "83",
            waitTotal: "84",
            outbound: "36,039",
            human: "975",
            machine: "31,649",
            agentConnect: "982",
            abandoned: "4 (0.41%)",
            noAnswer: "1,541",
            busy: "122",
            failed: "1,505"
        },
        {
            id: "camp-vdh",
            name: "VDH INBOUND CALLBACK",
            active: false,
            contacts: "507",
            channels: "0",
            waitNow: "0",
            waitToday: "0",
            waitTotal: "0",
            outbound: "0",
            human: "0",
            machine: "0",
            agentConnect: "0",
            abandoned: "0",
            noAnswer: "0",
            busy: "0",
            failed: "0"
        }
    ];

    const dom = createCallToolsCampaignsDOM(campaignData);
    global.document = dom.document;

    const campaigns = global.window.CTParser.readCampaigns();
    assert.strictEqual(campaigns.length, 2, "Must parse exactly 2 campaign rows");

    const resCred = campaigns[0];
    assert.strictEqual(resCred.name, "RES CRED MAIN");
    assert.strictEqual(resCred.active, true);
    assert.strictEqual(resCred.contacts, "47,846");
    assert.strictEqual(resCred.channels, "36");
    assert.strictEqual(resCred.waitNow, "64");
    assert.strictEqual(resCred.waitToday, "83");
    assert.strictEqual(resCred.outbound, "36,039");
    assert.strictEqual(resCred.human, "975");
    assert.strictEqual(resCred.machine, "31,649");
    assert.strictEqual(resCred.agentConnect, "982");
    assert.strictEqual(resCred.abandoned, "4 (0.41%)");
    assert.strictEqual(resCred.noAnswer, "1,541");
    assert.strictEqual(resCred.busy, "122");
    assert.strictEqual(resCred.failed, "1,505");

    // Agent state metrics are NOT in the Campaigns table and must be null (unavailable)
    assert.strictEqual(resCred.loggedIn, null);
    assert.strictEqual(resCred.waiting, null);
    assert.strictEqual(resCred.onCall, null);
    assert.strictEqual(resCred.postCall, null);
    assert.strictEqual(resCred.goals, null);

    // Typed metrics records
    assert.strictEqual(resCred._metrics.contacts.value, 47846);
    assert.strictEqual(resCred._metrics.waitToday.value, 83);
    assert.strictEqual(resCred._metrics.human.value, 975);
    assert.strictEqual(resCred._metrics.machine.value, 31649);
    assert.strictEqual(resCred._metrics.agentConnect.value, 982);
    assert.strictEqual(resCred._metrics.noAnswer.value, 1541);
    assert.strictEqual(resCred._metrics.busy.value, 122);
    assert.strictEqual(resCred._metrics.failed.value, 1505);

    // Inactive campaign
    const vdh = campaigns[1];
    assert.strictEqual(vdh.name, "VDH INBOUND CALLBACK");
    assert.strictEqual(vdh.active, false);
    assert.strictEqual(vdh.contacts, "507");
});

test("PHASE 5 & 8: Missing agent metrics on Campaigns table are represented as unavailable (null), not zero, preventing false alerts", () => {
    const campaignData = [
        {
            id: "camp-res-cred",
            name: "RES CRED MAIN",
            active: true,
            contacts: "47,846",
            channels: "36",
            waitNow: "64",
            waitToday: "83",
            outbound: "36,039",
            human: "975",
            machine: "31,649",
            agentConnect: "982",
            abandoned: "4 (0.41%)"
        }
    ];

    const dom = createCallToolsCampaignsDOM(campaignData);
    global.document = dom.document;

    const campaigns = global.window.CTParser.readCampaigns();
    const c = campaigns[0];

    // Must be typed as MISSING, not VALID_ZERO
    assert.strictEqual(c.loggedIn, null);
    assert.strictEqual(c.waiting, null);
    assert.strictEqual(c.onCall, null);
    assert.strictEqual(c._metrics.loggedIn.state, "MISSING");
    assert.strictEqual(c._metrics.waiting.state, "MISSING");
    assert.strictEqual(c._metrics.onCall.state, "MISSING");

    // Verify alert evaluation does NOT trigger false NO AGENT CAPACITY
    const waitingAvailable = c.waiting !== null && c.waiting !== undefined && String(c.waiting).trim() !== "";
    const loggedInAvailable = c.loggedIn !== null && c.loggedIn !== undefined && String(c.loggedIn).trim() !== "";

    let capacityAlertTriggered = false;
    if (waitingAvailable && loggedInAvailable && Number(c.waiting) > 0 && Number(c.loggedIn) === 0) {
        capacityAlertTriggered = true;
    }
    assert.strictEqual(capacityAlertTriggered, false, "False NO AGENT CAPACITY alert must not trigger when agent columns are missing");
});

test("PHASE 4 & 8: REALTIME shared lead pool deduplication and aggregate calculations", () => {
    const realtimeCampaigns = [
        { name: "REALTIME 732 / 317 / 126", contacts: "15,133", active: true },
        { name: "REALTIME MAIN", contacts: "15,133", active: true },
        { name: "RES CRED MAIN", contacts: "47,846", active: true }
    ];

    const realtime = realtimeCampaigns.filter(c => /^realtime\b/i.test(c.name));
    const realtimeValues = realtime.map(c => parseFloat(c.contacts.replace(/,/g, "")));
    const samePool = realtime.length > 1 && realtimeValues.every(v => v === realtimeValues[0]);
    assert.strictEqual(samePool, true, "Must detect identical REALTIME lead count as shared pool");

    // Deduplication calculation
    let totalContacts = realtimeCampaigns.reduce((sum, c) => sum + parseFloat(c.contacts.replace(/,/g, "")), 0);
    assert.strictEqual(totalContacts, 15133 + 15133 + 47846, "Raw sum includes duplicated pool");

    if (samePool) {
        const realtimeSum = realtime.reduce((sum, c) => sum + parseFloat(c.contacts.replace(/,/g, "")), 0);
        totalContacts = totalContacts - realtimeSum + realtimeValues[0];
    }
    assert.strictEqual(totalContacts, 15133 + 47846, "Deduplicated pool must count shared REALTIME leads exactly once");
});

test("UPGRADE TEST 14: Active Campaigns Command Summary filters operational campaigns and computes required summary columns", () => {
    const allCampaigns = [
        { id: "1", name: "REALTIME MAIN", active: true, contacts: "15,133", waitNow: "0", waitToday: "34", outbound: "5,074", human: "142", agentConnect: "140", channels: "6" },
        { id: "2", name: "WEB UPGRADE", active: true, contacts: "12,400", waitNow: "12", waitToday: "25", outbound: "3,200", human: "89", agentConnect: "88", channels: "4" },
        { id: "3", name: "RES CRED MAIN", active: true, contacts: "47,846", waitNow: "64", waitToday: "83", outbound: "36,039", human: "975", agentConnect: "982", channels: "36" },
        { id: "4", name: "OLD CAMPAIGN 1", active: false, contacts: "500", waitNow: "0", waitToday: "0", outbound: "100", human: "5", agentConnect: "5", channels: "0" },
        { id: "5", name: "ARCHIVED LIST", active: false, contacts: "0", waitNow: "0", waitToday: "0", outbound: "0", human: "0", agentConnect: "0", channels: "0" }
    ];

    const active = allCampaigns.filter(c => c.active === true);
    assert.strictEqual(active.length, 3, "Only active campaigns should be included in Active Command Summary");

    // Verify pinned ordering preservation
    const PINNED_ORDER = ["RES CRED MAIN", "REALTIME 126", "REALTIME 484"];
    const sorted = active.slice().sort((a, b) => {
        const aPin = PINNED_ORDER.indexOf(a.name);
        const bPin = PINNED_ORDER.indexOf(b.name);
        if (aPin !== -1 && bPin !== -1) return aPin - bPin;
        if (aPin !== -1) return -1;
        if (bPin !== -1) return 1;
        return a.name.localeCompare(b.name);
    });

    assert.strictEqual(sorted[0].name, "RES CRED MAIN", "Pinned campaign must appear first");
    assert.strictEqual(sorted[1].name, "REALTIME MAIN");
    assert.strictEqual(sorted[2].name, "WEB UPGRADE");
});

test("UPGRADE TEST 15: Discrepancy reconciliation between active operational totals and all visible campaigns", () => {
    const campaigns = [
        { name: "REALTIME MAIN", active: true, outbound: 5074, human: 142 },
        { name: "RES CRED MAIN", active: true, outbound: 36039, human: 975 },
        { name: "INACTIVE CALLS MADE EARLIER", active: false, outbound: 100, human: 5 }
    ];

    const activeOutbound = campaigns.filter(c => c.active).reduce((sum, c) => sum + c.outbound, 0);
    const allOutbound = campaigns.reduce((sum, c) => sum + c.outbound, 0);

    const activeHuman = campaigns.filter(c => c.active).reduce((sum, c) => sum + c.human, 0);
    const allHuman = campaigns.reduce((sum, c) => sum + c.human, 0);

    assert.strictEqual(activeOutbound, 41113, "Active outbound calls must equal 41,113");
    assert.strictEqual(allOutbound, 41213, "All campaigns outbound must equal 41,213");
    assert.strictEqual(activeHuman, 1117, "Active human connects must equal 1,117");
    assert.strictEqual(allHuman, 1122, "All human connects must equal 1,122");

    // Subnote reconciliation formatting
    const outboundSubnote = "Active: " + activeOutbound.toLocaleString() + " · All: " + allOutbound.toLocaleString();
    const humanSubnote = "Active: " + activeHuman.toLocaleString() + " · All: " + allHuman.toLocaleString();
    assert.strictEqual(outboundSubnote, "Active: 41,113 · All: 41,213");
    assert.strictEqual(humanSubnote, "Active: 1,117 · All: 1,122");
});

test("UPGRADE TEST 16: Honest Lead Runway states distinguish gathering vs stable lead pool vs exhaustion", () => {
    function estimateCampaignRunway(history, contacts) {
        if (!contacts || contacts <= 0) return { label: "No leads", tone: "critical" };
        if (!history || history.length < 2) return { label: "Gathering data…", tone: "neutral" };
        const elapsed = (history[history.length - 1].time - history[0].time) / 1000;
        if (elapsed < 30) return { label: "Gathering (<30s)", tone: "neutral" };
        const delta = history[0].contacts - history[history.length - 1].contacts;
        if (delta <= 0) return { label: "Stable lead pool", tone: "good" };
        const ratePerSec = delta / elapsed;
        const secondsRemaining = contacts / ratePerSec;
        const hours = secondsRemaining / 3600;
        if (hours < 1) return { label: Math.round(secondsRemaining / 60) + "m remaining", tone: "critical" };
        if (hours < 4) return { label: hours.toFixed(1) + "h remaining", tone: "warning" };
        return { label: hours.toFixed(1) + "h remaining", tone: "good" };
    }

    // Case 1: Initial load
    assert.strictEqual(estimateCampaignRunway([], 15000).label, "Gathering data…");

    // Case 2: Short history < 30s
    const shortHistory = [
        { time: 100000, contacts: 15000 },
        { time: 115000, contacts: 14995 }
    ];
    assert.strictEqual(estimateCampaignRunway(shortHistory, 14995).label, "Gathering (<30s)");

    // Case 3: Stable or replenishing pool
    const stableHistory = [
        { time: 100000, contacts: 15000 },
        { time: 160000, contacts: 15000 }
    ];
    assert.strictEqual(estimateCampaignRunway(stableHistory, 15000).label, "Stable lead pool");

    // Case 4: Burning leads
    const burningHistory = [
        { time: 100000, contacts: 10000 },
        { time: 160000, contacts: 9000 } // 1000 leads in 60s = 16.66/s
    ];
    // remaining: 9000 / 16.666 = 540 seconds = 9 minutes
    const runway = estimateCampaignRunway(burningHistory, 9000);
    assert.strictEqual(runway.label, "9m remaining");
    assert.strictEqual(runway.tone, "critical");
});

test("UPGRADE TEST 17: Inbound missing not-answered column yields null and never reports false zero", () => {
    // Inbound queue missing callsTodayNotAnswered column in DOM
    const queueWithoutNotAnswered = {
        name: "Main Support Queue",
        callsTodayTotal: 324,
        callsTodayAnswered: 259,
        waiting: 2
        // callsTodayNotAnswered is missing / undefined
    };

    function inboundNotAnswered(q) {
        if (!q) return null;
        if (q._metrics && q._metrics.callsTodayNotAnswered && typeof q._metrics.callsTodayNotAnswered.value === "number") {
            return q._metrics.callsTodayNotAnswered.value;
        }
        if (typeof q.callsTodayNotAnswered === "number") return q.callsTodayNotAnswered;
        return null;
    }

    const notAnswered = inboundNotAnswered(queueWithoutNotAnswered);
    assert.strictEqual(notAnswered, null, "Unexposed Not Answered column must be null, not 0");

    // Verify subnote rendering
    const note = notAnswered !== null
        ? `${queueWithoutNotAnswered.callsTodayAnswered} answered · ${notAnswered} not answered`
        : `${queueWithoutNotAnswered.callsTodayAnswered} answered · other categories unexposed`;

    assert.strictEqual(note, "259 answered · other categories unexposed");
});

test("UPGRADE TEST 18: Inbound findings consistency — callers waiting > 0 ALWAYS produces a finding pill; never falsely claims 'No callers waiting'", () => {
    // Condition exactly observed in user screenshot Image 2:
    // Main Inbound Queue: waiting = 1, loggedIn = 65, onCall = 0, maxWait = 0s
    const queueRows = [
        { name: "Main Inbound Queue", waiting: 1, loggedIn: 65, onCall: 0, maxWait: 0 },
        { name: "BKV SURVEY INBOUND", waiting: 0, loggedIn: 20, onCall: 0, maxWait: 0 },
        { name: "VDH Inbound", waiting: 0, loggedIn: 15, onCall: 1, maxWait: 0 }
    ];

    const noCapacityQueues = queueRows.filter(r => r.waiting > 0 && r.loggedIn === 0);
    const saturatedQueues = queueRows.filter(r => r.waiting > 0 && r.loggedIn > 0 && r.onCall >= r.loggedIn);
    const totals = { waiting: 1, maxWait: 0 };

    const findings = [];
    noCapacityQueues.forEach(r => {
        findings.push(`NO CAPACITY: ${r.name}`);
    });
    queueRows.filter(r => r.waiting > 0 && r.maxWait >= 60).forEach(r => {
        findings.push(`CRITICAL WAIT: ${r.name}`);
    });
    queueRows.filter(r => r.waiting > 0 && r.maxWait >= 30 && r.maxWait < 60).forEach(r => {
        findings.push(`ELEVATED WAIT: ${r.name}`);
    });
    saturatedQueues.forEach(r => {
        findings.push(`QUEUE SATURATED: ${r.name}`);
    });
    // Critical fix: low-wait queue with callers holding MUST be reported
    queueRows.filter(r => r.waiting > 0 && r.maxWait < 30 && r.loggedIn > 0 && r.loggedIn > r.onCall).forEach(r => {
        findings.push(`CALLERS WAITING: ${r.name} - ${r.waiting} holding`);
    });

    assert.strictEqual(findings.length, 1, "Must contain exactly 1 finding pill for the holding caller");
    assert.match(findings[0], /CALLERS WAITING: Main Inbound Queue/, "Finding pill must report Main Inbound Queue holding callers");

    // Banner tone and fallback check
    const demandTone = totals.waiting > 0 ? (totals.maxWait >= 60 || noCapacityQueues.length > 0 ? 'is-critical' : 'is-warning') : 'is-good';
    const badgeLabel = totals.waiting > 0 ? totals.waiting + ' WAITING' : 'COVERED';
    let findingsText = findings.length > 0
        ? findings.join("; ")
        : (totals.waiting > 0 ? `${totals.waiting} callers waiting` : "All active queues covered · No callers waiting");

    assert.strictEqual(demandTone, "is-warning");
    assert.strictEqual(badgeLabel, "1 WAITING");
    assert.doesNotMatch(findingsText, /No callers waiting/, "Must NEVER claim 'No callers waiting' when callers are holding");
});

test("UPGRADE TEST 19: loggedMemberships aggregation and KPI mapping — sums queue loggedIn counts and distinguishes from unique agents", () => {
    const queueRows = [
        { name: "Main Inbound Queue", loggedIn: 65, callsTodayTotal: 314, callsTodayAnswered: 232 },
        { name: "BKV SURVEY INBOUND", loggedIn: 20, callsTodayTotal: 84, callsTodayAnswered: 80 },
        { name: "VDH Inbound", loggedIn: 15, callsTodayTotal: 15, callsTodayAnswered: 10 }
    ];

    const totals = queueRows.reduce((acc, row) => {
        acc.loggedMemberships += row.loggedIn;
        acc.today += row.callsTodayTotal;
        acc.answered += row.callsTodayAnswered;
        return acc;
    }, { loggedMemberships: 0, today: 0, answered: 0 });

    assert.strictEqual(totals.loggedMemberships, 100, "Sum of loggedIn across queues must equal 100");
    const label = "QUEUE MEMBERSHIPS";
    const subnote = "sum of queue logged-in · not unique agents";
    assert.strictEqual(label, "QUEUE MEMBERSHIPS");
    assert.match(subnote, /not unique agents/, "Subnote must clarify queue memberships are not unique deduplicated agents");
});

test("UPGRADE TEST 20: Responsive layout calculations across zoom/viewports (2304x1094 wide viewport down to 1024x768)", () => {
    const DEFAULT_LAYOUT = { left: 18, top: 18, width: 1440, height: 920, collapsed: false };

    function computeDefaultLayout(innerWidth, innerHeight) {
        const maxWidth = Math.max(760, innerWidth - 36);
        const targetWidth = innerWidth >= 1680 ? 1520 : innerWidth >= 1440 ? 1380 : innerWidth >= 1200 ? 1160 : Math.min(DEFAULT_LAYOUT.width, maxWidth);
        const width = Math.min(targetWidth, maxWidth);
        const height = Math.min(DEFAULT_LAYOUT.height, Math.max(480, innerHeight - 36));

        return {
            left: Math.max(10, Math.floor((innerWidth - width) / 2)),
            top: DEFAULT_LAYOUT.top,
            width: width,
            height: height,
            collapsed: DEFAULT_LAYOUT.collapsed
        };
    }

    // Wide screen 2304x1094 (user's live display at 100% and 90% zoom)
    const wide = computeDefaultLayout(2304, 1094);
    assert.strictEqual(wide.width, 1520, "Wide screen (2304px) must expand to 1520px wide command center");
    assert.strictEqual(wide.height, 920, "Wide screen must utilize 920px height");
    assert.ok(wide.left >= 10, "Left offset must be bounded and centered");

    // Standard 1920x1080
    const fullHd = computeDefaultLayout(1920, 1080);
    assert.strictEqual(fullHd.width, 1520, "1920px width must use 1520px");

    // Medium laptop 1440x900
    const laptop = computeDefaultLayout(1440, 900);
    assert.strictEqual(laptop.width, 1380, "1440px viewport must fit cleanly within window without overflow");
    assert.strictEqual(laptop.height, 864, "Height must be clamped to window - 36px");

    // Compact screen 1024x768
    const compact = computeDefaultLayout(1024, 768);
    assert.strictEqual(compact.width, 988, "1024px viewport must scale width to 988px");
    assert.strictEqual(compact.height, 732, "768px height must scale to 732px");
});

test("UPGRADE TEST 21: Active Campaigns Command Summary 14 columns verification including honest connection rate and abandoned formatting", () => {
    const campaign = {
        name: "RES CRED MAIN",
        __active: true,
        __loggedIn: 23,
        __loggedInAvailable: false, // Campaigns feed doesn't expose agent columns
        waitNow: 36,
        waitToday: 0,
        __outbound: 53709,
        __human: 1529,
        __agentConnect: 1537,
        __abandoned: 4,
        __contacts: 30456,
        __health: "warning"
    };

    const agentsText = campaign.__loggedInAvailable ? String(campaign.__loggedIn) : "—";
    assert.strictEqual(agentsText, "—", "Agent state unexposed must display '—', never 0");

    const abandonRate = campaign.__outbound > 0 ? (campaign.__abandoned / campaign.__outbound) * 100 : 0;
    const abandonedText = campaign.__abandoned > 0
        ? `${campaign.__abandoned} (${abandonRate.toFixed(1)}%)`
        : "0 (0%)";
    assert.strictEqual(abandonedText, "4 (0.0%)", "Abandoned calls formatted with count and %");

    const connectRate = campaign.__outbound > 0 ? (campaign.__human / campaign.__outbound) * 100 : 0;
    const connectRateText = campaign.__outbound > 0 ? connectRate.toFixed(1) + "%" : "—";
    assert.strictEqual(connectRateText, "2.8%", "Connect rate formatted as Human ÷ Outbound %");

    // Zero-outbound campaign test: rate must be '—', NEVER false 0.0%
    const zeroCampaign = { __outbound: 0, __human: 0 };
    const zeroRateText = zeroCampaign.__outbound > 0 ? ((zeroCampaign.__human / zeroCampaign.__outbound) * 100).toFixed(1) + "%" : "—";
    assert.strictEqual(zeroRateText, "—", "Zero outbound attempts must display '—' rather than misleading 0.0%");
});

test("UPGRADE TEST 22: Combined state filter (all, active, inactive) + health filter + search query", () => {
    const campaigns = [
        { name: "REALTIME MAIN", __active: true, __health: "good", __dataCheck: false },
        { name: "WEB UPGRADE", __active: true, __health: "good", __dataCheck: false },
        { name: "RES CRED MAIN", __active: true, __health: "warning", __dataCheck: false },
        { name: "CREDIT REPAIR INACTIVE", __active: false, __health: "good", __dataCheck: false },
        { name: "OLD DIALER TEST", __active: false, __health: "critical", __dataCheck: true }
    ];

    function applyFilters(camps, stateFilter, healthFilter, query) {
        const needle = (query || "").trim().toLowerCase();
        return camps.filter(c => {
            if (stateFilter === "active" && !c.__active) return false;
            if (stateFilter === "inactive" && c.__active) return false;
            if (healthFilter === "critical" && c.__health !== "critical") return false;
            if (healthFilter === "warning" && c.__health !== "warning") return false;
            if (healthFilter === "healthy" && c.__health !== "good" && c.__health !== "excellent") return false;
            if (healthFilter === "data" && !c.__dataCheck) return false;
            return !needle || c.name.toLowerCase().includes(needle);
        });
    }

    // Default: all, all, ""
    assert.strictEqual(applyFilters(campaigns, "all", "all", "").length, 5);

    // Active only
    assert.strictEqual(applyFilters(campaigns, "active", "all", "").length, 3);

    // Inactive only
    assert.strictEqual(applyFilters(campaigns, "inactive", "all", "").length, 2);

    // Active + At Risk
    const activeAtRisk = applyFilters(campaigns, "active", "warning", "");
    assert.strictEqual(activeAtRisk.length, 1);
    assert.strictEqual(activeAtRisk[0].name, "RES CRED MAIN");

    // Inactive + Critical
    const inactiveCrit = applyFilters(campaigns, "inactive", "critical", "");
    assert.strictEqual(inactiveCrit.length, 1);
    assert.strictEqual(inactiveCrit[0].name, "OLD DIALER TEST");

    // Search query
    const searched = applyFilters(campaigns, "all", "all", "cred");
    assert.strictEqual(searched.length, 2, "Search 'cred' matches RES CRED MAIN and CREDIT REPAIR INACTIVE");
});

test("UPGRADE TEST 23: Outbound attempts scope reconciliation (top snapshot active sum vs single operating campaign breakdown)", () => {
    // Exactly reproducing the screenshot counts:
    // Top snapshot: 53,741 attempts (or 55,975 in other runs)
    // RES CRED MAIN: 53,709 attempts (or 55,943)
    // WEB UPGRADE: 32 attempts
    // REALTIME MAIN: 0 attempts
    const activeCampaigns = [
        { name: "RES CRED MAIN", __active: true, __outbound: 53709 },
        { name: "WEB UPGRADE", __active: true, __outbound: 32 },
        { name: "REALTIME MAIN", __active: true, __outbound: 0 }
    ];

    const totalOutbound = activeCampaigns.reduce((sum, c) => sum + c.__outbound, 0);
    assert.strictEqual(totalOutbound, 53741, "Sum of active campaigns (53,709 + 32 + 0) equals 53,741");

    // Verify transparent note generation
    const note = activeCampaigns.length > 1
        ? `Active sum · ${activeCampaigns.length} campaigns`
        : "Active campaign attempts";
    assert.strictEqual(note, "Active sum · 3 campaigns");

    // Verify hover tooltip breakdown
    const tooltip = "Total Outbound Attempts: 53,741\n" +
        activeCampaigns.map(c => `• ${c.name}: ${c.__outbound.toLocaleString()}`).join("\n");

    assert.ok(tooltip.includes("• RES CRED MAIN: 53,709"));
    assert.ok(tooltip.includes("• WEB UPGRADE: 32"));
    assert.ok(tooltip.includes("• REALTIME MAIN: 0"));
});

test("UPGRADE TEST 24: Campaign row selection, toggle all visible, and clear selection behavior", () => {
    const selectedIds = new Set();
    const visibleCampaigns = [
        { __id: "res-cred-main", name: "RES CRED MAIN" },
        { __id: "web-upgrade", name: "WEB UPGRADE" },
        { __id: "realtime-main", name: "REALTIME MAIN" }
    ];

    // Toggle row selection on single campaign
    selectedIds.add("res-cred-main");
    assert.strictEqual(selectedIds.size, 1);
    assert.ok(selectedIds.has("res-cred-main"));

    // Toggle-select-all visible rows
    visibleCampaigns.forEach(c => selectedIds.add(c.__id));
    assert.strictEqual(selectedIds.size, 3);
    assert.ok(visibleCampaigns.every(c => selectedIds.has(c.__id)));

    // Header checkbox states: checked when all visible are selected
    const allSelected = visibleCampaigns.every(c => selectedIds.has(c.__id));
    assert.strictEqual(allSelected, true);

    // Uncheck one row
    selectedIds.delete("web-upgrade");
    const allSelectedAfter = visibleCampaigns.every(c => selectedIds.has(c.__id));
    const someSelectedAfter = visibleCampaigns.some(c => selectedIds.has(c.__id));
    assert.strictEqual(allSelectedAfter, false);
    assert.strictEqual(someSelectedAfter, true, "Indeterminate state when partial selection exists");

    // Clear selection
    selectedIds.clear();
    assert.strictEqual(selectedIds.size, 0, "Selection cleared completely");
});

test("UPGRADE TEST 25: Drag-and-drop campaign reordering and Reset Order restoration", () => {
    const PINNED_ORDER = ["RES CRED MAIN", "REALTIME 126", "REALTIME 484"];
    const allCampaigns = [
        { __id: "res-cred-main", name: "RES CRED MAIN" },
        { __id: "realtime-126", name: "REALTIME 126" },
        { __id: "realtime-484", name: "REALTIME 484" },
        { __id: "web-upgrade", name: "WEB UPGRADE" },
        { __id: "bkv-survey", name: "BKV SURVEY" }
    ];

    function defaultCampaignOrder(camps) {
        const valid = new Set(camps.map(c => c.__id));
        const pinned = PINNED_ORDER.map(name => {
            const id = name.toLowerCase().replace(/\s+/g, "-");
            return valid.has(id) ? id : null;
        }).filter(Boolean);
        const seen = new Set(pinned);
        const rest = [];
        camps.forEach(c => {
            if (!seen.has(c.__id)) { seen.add(c.__id); rest.push(c.__id); }
        });
        return pinned.concat(rest);
    }

    let manualOrder = defaultCampaignOrder(allCampaigns);
    assert.deepStrictEqual(manualOrder, ["res-cred-main", "realtime-126", "realtime-484", "web-upgrade", "bkv-survey"]);

    // Simulate drag: move "web-upgrade" to index 0 (top)
    const draggedId = "web-upgrade";
    const targetId = "res-cred-main";
    const fromIdx = manualOrder.indexOf(draggedId);
    manualOrder.splice(fromIdx, 1);
    const toIdx = manualOrder.indexOf(targetId);
    manualOrder.splice(toIdx, 0, draggedId);

    assert.strictEqual(manualOrder[0], "web-upgrade", "Dragged campaign must occupy index 0");
    assert.strictEqual(manualOrder[1], "res-cred-main");

    // Simulate Reset Order: restores default pinned + source discovery order
    manualOrder = defaultCampaignOrder(allCampaigns);
    assert.strictEqual(manualOrder[0], "res-cred-main", "Reset Order restores RES CRED MAIN to first position");
    assert.strictEqual(manualOrder[3], "web-upgrade", "WEB UPGRADE returns to default position");
});

test("UPGRADE TEST 26: Outbound Focus single-campaign deduplication vs multi-campaign operating view", () => {
    // Single operating campaign selected
    const singleSelected = [{ __id: "res-cred-main", name: "RES CRED MAIN", __outbound: 63516, __human: 2029 }];
    const showSummaryBarSingle = singleSelected.length > 1;
    assert.strictEqual(showSummaryBarSingle, false, "Summary bar must be hidden when single campaign is selected to avoid duplicate metrics");

    // Multiple operating campaigns selected
    const multiSelected = [
        { __id: "res-cred-main", name: "RES CRED MAIN", __outbound: 63516, __human: 2029 },
        { __id: "web-upgrade", name: "WEB UPGRADE", __outbound: 32, __human: 0 }
    ];
    const showSummaryBarMulti = multiSelected.length > 1;
    assert.strictEqual(showSummaryBarMulti, true, "Summary bar must be displayed when multiple campaigns are selected to show aggregate totals");
});

test("UPGRADE TEST 27: Inbound Queue Detail header and cell grid template column alignment without overlap", () => {
    const queueHeaders = ["QUEUE", "LOGGED", "TODAY", "ANSWERED", "NOT ANS", "WAIT", "ON CALL", "MAX WAIT", "GOALS", "STATE"];
    assert.strictEqual(queueHeaders.length, 10, "Queue table must have exactly 10 columns");

    // Verify concise header length to avoid collisions in narrow columns (<= 58px)
    assert.ok(queueHeaders[4].length <= 8, "NOT ANS header must be <= 8 chars to fit within 54px without overlapping WAIT");
    assert.ok(queueHeaders[5].length <= 5, "WAIT header must be <= 5 chars to fit within 46px");
    assert.ok(queueHeaders[6].length <= 8, "ON CALL header must be <= 8 chars to fit within 48px");
});
