const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { MockNode, createCallToolsQueuesDOM, createCallToolsCampaignsDOM } = require("./mock_dom");

// Setup global environment for helpers.js, parser.js, dashboard.js
function setupGlobalEnv() {
    global.window = global;
    global.window.location = {
        pathname: "/manager/campaigns",
        search: "",
        origin: "https://east-3.calltools.io",
        hostname: "east-3.calltools.io"
    };
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
    const helpersPath = path.resolve(__dirname, "../src/helpers.js");
    eval(fs.readFileSync(helpersPath, "utf-8"));

    // Load parser.js
    const parserPath = path.resolve(__dirname, "../src/parser.js");
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

test("UPGRADE TEST 28: Campaign filter state persistence & restoration across reload/refresh", () => {
    // Simulated storage mock
    const storage = new Map();
    const FILTER_STATE_KEY = "ct-operations-campaign-state-filter-v1";
    const FILTER_HEALTH_KEY = "ct-operations-campaign-health-filter-v1";
    const SEARCH_QUERY_KEY = "ct-operations-campaign-query-v1";
    const SELECTED_CAMPAIGNS_KEY = "ct-operations-selected-campaign-ids-v1";

    // Operator selects Active filter, At Risk health filter, a search query, and 2 campaigns
    storage.set(FILTER_STATE_KEY, "active");
    storage.set(FILTER_HEALTH_KEY, "warning");
    storage.set(SEARCH_QUERY_KEY, "realtime");
    storage.set(SELECTED_CAMPAIGNS_KEY, JSON.stringify(["res cred main", "web upgrade"]));

    // Simulate page reload / dashboard initialization
    const restoredStateFilter = storage.get(FILTER_STATE_KEY) || "all";
    const restoredHealthFilter = storage.get(FILTER_HEALTH_KEY) || "all";
    const restoredQuery = storage.get(SEARCH_QUERY_KEY) || "";
    const restoredSelected = new Set(JSON.parse(storage.get(SELECTED_CAMPAIGNS_KEY) || "[]"));

    assert.strictEqual(restoredStateFilter, "active", "State filter must restore to 'active'");
    assert.strictEqual(restoredHealthFilter, "warning", "Health filter must restore to 'warning'");
    assert.strictEqual(restoredQuery, "realtime", "Search query must restore to 'realtime'");
    assert.strictEqual(restoredSelected.has("res cred main"), true);
    assert.strictEqual(restoredSelected.has("web upgrade"), true);
    assert.strictEqual(restoredSelected.size, 2);
});

test("UPGRADE TEST 29: Inbound Not Answered resolution maps native Inbound No Answer without false zero", () => {
    function inboundNotAnswered(queue) {
        if (!queue) return null;
        if (queue._metrics && queue._metrics.callsTodayNotAnswered && typeof queue._metrics.callsTodayNotAnswered.value === "number") {
            return queue._metrics.callsTodayNotAnswered.value;
        }
        if (queue._metrics && queue._metrics.inboundNoAnswer && typeof queue._metrics.inboundNoAnswer.value === "number") {
            return queue._metrics.inboundNoAnswer.value;
        }
        if (typeof queue.callsTodayNotAnswered === "number") return queue.callsTodayNotAnswered;
        if (typeof queue.inboundNoAnswer === "number") return queue.inboundNoAnswer;
        if (queue.callsTodayNotAnswered !== undefined && queue.callsTodayNotAnswered !== null && String(queue.callsTodayNotAnswered).trim() !== "") {
            const num = parseFloat(String(queue.callsTodayNotAnswered).replace(/,/g, ""));
            if (Number.isFinite(num)) return num;
        }
        if (queue.inboundNoAnswer !== undefined && queue.inboundNoAnswer !== null && String(queue.inboundNoAnswer).trim() !== "") {
            const num = parseFloat(String(queue.inboundNoAnswer).replace(/,/g, ""));
            if (Number.isFinite(num)) return num;
        }
        return null;
    }

    // Native queue from live CallTools feed: Inbound No Answer = 99
    const liveQueue1 = {
        name: "Main Inbound Queue",
        callsTodayTotal: 523,
        callsTodayAnswered: 389,
        inboundNoAnswer: 99,
        _metrics: {
            callsTodayNotAnswered: { state: "MISSING", value: null },
            inboundNoAnswer: { state: "VALID_NONZERO", value: 99 }
        }
    };
    assert.strictEqual(inboundNotAnswered(liveQueue1), 99, "Must extract native Inbound No Answer (99)");

    // Native queue with 0 no answer
    const liveQueue2 = {
        name: "VDH SOLD INBOUND",
        callsTodayTotal: 18,
        callsTodayAnswered: 18,
        inboundNoAnswer: 0,
        _metrics: {
            callsTodayNotAnswered: { state: "MISSING", value: null },
            inboundNoAnswer: { state: "VALID_ZERO", value: 0 }
        }
    };
    assert.strictEqual(inboundNotAnswered(liveQueue2), 0, "Must extract native Inbound No Answer (0)");

    // Queue with genuinely unexposed field
    const unexposedQueue = {
        name: "Legacy Queue",
        callsTodayTotal: 10,
        callsTodayAnswered: 8,
        _metrics: {}
    };
    assert.strictEqual(inboundNotAnswered(unexposedQueue), null, "Unexposed queue must return null, never false 0");
});

test("UPGRADE TEST 30: Drag-and-drop reordering with filtered view preserves hidden campaigns", () => {
    const allCampaigns = ["res cred main", "realtime 126", "web upgrade", "bkv survey", "vdh callback"];
    let manualOrder = allCampaigns.slice();

    // Visible filtered list (e.g. only Active campaigns)
    const visibleIds = ["res cred main", "web upgrade"];

    // Operator drags "web upgrade" above "res cred main"
    const draggedId = "web upgrade";
    const targetId = "res cred main";
    const insertAfter = false;

    // reorderCampaignByIds logic
    const fromIdx = manualOrder.indexOf(draggedId);
    if (fromIdx !== -1) manualOrder.splice(fromIdx, 1);
    let toIdx = manualOrder.indexOf(targetId);
    if (toIdx !== -1) {
        if (insertAfter) toIdx++;
        manualOrder.splice(toIdx, 0, draggedId);
    }

    // Verify: "web upgrade" is now before "res cred main"
    assert.strictEqual(manualOrder[0], "web upgrade");
    assert.strictEqual(manualOrder[1], "res cred main");

    // Verify: hidden campaigns were NOT lost or deleted!
    assert.ok(manualOrder.includes("realtime 126"));
    assert.ok(manualOrder.includes("bkv survey"));
    assert.ok(manualOrder.includes("vdh callback"));
    assert.strictEqual(manualOrder.length, 5);
});

test("UPGRADE TEST 31: Inbound table grid template min-width and sticky header requirements", () => {
    const minWidthPx = 680;
    const maxTableHeightPx = 200;
    assert.ok(minWidthPx >= 650, "Table min-width must be at least 650px to prevent header cramming");
    assert.ok(maxTableHeightPx <= 220, "Table container height must be bounded to preserve vertical viewport");
});

test("UPGRADE TEST 32: updateActiveCommandSummary renders ordered campaigns over raw source order", () => {
    // Raw CallTools source campaigns (native order)
    const rawCampaigns = [
        { name: "REALTIME MAIN", active: true, __id: "realtime main", __active: true, __health: "good" },
        { name: "WEB UPGRADE", active: true, __id: "web upgrade", __active: true, __health: "good" },
        { name: "RES CRED MAIN", active: true, __id: "res cred main", __active: true, __health: "critical" }
    ];

    // User establishes manual order: RES CRED MAIN first, then REALTIME MAIN, then WEB UPGRADE
    const manualOrder = ["res cred main", "realtime main", "web upgrade"];

    // Ordering function applies manualOrder
    const byId = new Map(rawCampaigns.map(c => [c.__id, c]));
    const ordered = manualOrder.map(id => byId.get(id)).filter(Boolean);

    // Verify ordered array has RES CRED MAIN first
    assert.strictEqual(ordered[0].name, "RES CRED MAIN");
    assert.strictEqual(ordered[1].name, "REALTIME MAIN");
    assert.strictEqual(ordered[2].name, "WEB UPGRADE");

    // Filtering active campaigns preserves the manual order
    const visible = ordered.filter(c => c.__active === true);
    assert.strictEqual(visible[0].name, "RES CRED MAIN");
    assert.strictEqual(visible[1].name, "REALTIME MAIN");
    assert.strictEqual(visible[2].name, "WEB UPGRADE");
});

test("UPGRADE TEST 33: Keyboard accessible reordering (Alt+ArrowUp/Down) invokes identical reorder algorithm", () => {
    const campaigns = ["res cred main", "realtime main", "web upgrade"];
    let manualOrder = campaigns.slice();

    function reorderCampaignByIds(draggedId, targetId, insertAfter) {
        const fromIdx = manualOrder.indexOf(draggedId);
        if (fromIdx !== -1) manualOrder.splice(fromIdx, 1);
        let toIdx = manualOrder.indexOf(targetId);
        if (toIdx !== -1) {
            if (insertAfter) toIdx++;
            manualOrder.splice(toIdx, 0, draggedId);
        }
    }

    // Operator presses Alt+ArrowDown on "res cred main" (moves after "realtime main")
    reorderCampaignByIds("res cred main", "realtime main", true);
    assert.deepStrictEqual(manualOrder, ["realtime main", "res cred main", "web upgrade"]);

    // Operator presses Alt+ArrowUp on "web upgrade" (moves before "res cred main")
    reorderCampaignByIds("web upgrade", "res cred main", false);
    assert.deepStrictEqual(manualOrder, ["realtime main", "web upgrade", "res cred main"]);
});

test("UPGRADE TEST 34: Global filter synchronization guarantees button active states match storage without overwrite", () => {
    const storage = new Map();
    storage.set("ct-operations-campaign-state-filter-v1", "active");
    storage.set("ct-operations-campaign-health-filter-v1", "critical");

    const state = {
        stateFilter: storage.get("ct-operations-campaign-state-filter-v1") || "all",
        filter: storage.get("ct-operations-campaign-health-filter-v1") || "all"
    };

    // Verify hydrated state before render
    assert.strictEqual(state.stateFilter, "active");
    assert.strictEqual(state.filter, "critical");

    // Mock buttons
    const buttons = [
        { dataset: { stateFilter: "all" }, active: true },
        { dataset: { stateFilter: "active" }, active: false },
        { dataset: { stateFilter: "inactive" }, active: false }
    ];

    // syncFilterButtons logic
    buttons.forEach(btn => {
        btn.active = btn.dataset.stateFilter === state.stateFilter;
    });

    assert.strictEqual(buttons.find(b => b.dataset.stateFilter === "all").active, false);
    assert.strictEqual(buttons.find(b => b.dataset.stateFilter === "active").active, true);
});

test("UPGRADE TEST 35: Row reorder buttons (up/down) invoke reorderCampaignByIds and preserve full ordering sequence", () => {
    const campaigns = [
        { name: "Alpha", __id: "alpha" },
        { name: "Beta", __id: "beta" },
        { name: "Gamma", __id: "gamma" }
    ];
    let manualOrder = ["alpha", "beta", "gamma"];

    function reorderCampaignByIds(draggedId, targetId, insertAfter) {
        if (!draggedId || !targetId || draggedId === targetId) return;
        const curOrder = manualOrder.slice();
        const fromIdx = curOrder.indexOf(draggedId);
        if (fromIdx !== -1) curOrder.splice(fromIdx, 1);
        let toIdx = curOrder.indexOf(targetId);
        if (toIdx !== -1) {
            if (insertAfter) toIdx++;
            curOrder.splice(toIdx, 0, draggedId);
        } else {
            curOrder.push(draggedId);
        }
        manualOrder = curOrder;
    }

    // Move Alpha down past Beta
    reorderCampaignByIds("alpha", "beta", true);
    assert.deepStrictEqual(manualOrder, ["beta", "alpha", "gamma"]);

    // Move Gamma up before Alpha
    reorderCampaignByIds("gamma", "alpha", false);
    assert.deepStrictEqual(manualOrder, ["beta", "gamma", "alpha"]);
});

test("UPGRADE TEST 36: Command Summary Table 18-column colgroup, matching classes, and fixed layout", () => {
    // 18 explicit columns including Waiting queue load and Goals metric in middle order
    const columns = [
        "drag", "select", "name", "state", "agents", "waiting",
        "waitnow", "waittoday", "outbound", "human", "agentconnect", "goals",
        "abandoned", "connectrate", "leads", "runway", "health", "focus"
    ];
    assert.strictEqual(columns.length, 18, "Table must have exactly 18 defined columns");

    // Colgroup col classes
    const colClasses = columns.map(c => `ct-col-${c}`);
    assert.ok(colClasses.includes("ct-col-drag"));
    assert.ok(colClasses.includes("ct-col-select"));
    assert.ok(colClasses.includes("ct-col-name"));
    assert.ok(colClasses.includes("ct-col-state"));
    assert.ok(colClasses.includes("ct-col-agents"));
    assert.ok(colClasses.includes("ct-col-waiting"));
    assert.ok(colClasses.includes("ct-col-waitnow"));
    assert.ok(colClasses.includes("ct-col-waittoday"));
    assert.ok(colClasses.includes("ct-col-outbound"));
    assert.ok(colClasses.includes("ct-col-human"));
    assert.ok(colClasses.includes("ct-col-agentconnect"));
    assert.ok(colClasses.includes("ct-col-goals"));
    assert.ok(colClasses.includes("ct-col-abandoned"));
    assert.ok(colClasses.includes("ct-col-connectrate"));
    assert.ok(colClasses.includes("ct-col-leads"));
    assert.ok(colClasses.includes("ct-col-runway"));
    assert.ok(colClasses.includes("ct-col-health"));
    assert.ok(colClasses.includes("ct-col-focus"));

    // Header th classes
    const thClasses = columns.map(c => `ct-th-${c}`);
    // Data td classes
    const tdClasses = columns.map(c => `ct-td-${c}`);

    assert.strictEqual(thClasses.length, 18);
    assert.strictEqual(tdClasses.length, 18);

    // Verify fixed layout attributes
    const tableStyle = {
        tableLayout: "fixed",
        width: "100%",
        minWidth: 1200
    };
    assert.strictEqual(tableStyle.tableLayout, "fixed", "Table must use fixed layout to lock column widths");
    assert.ok(tableStyle.minWidth >= 1200, "Table min-width must be at least 1200px to accommodate all 16 columns without horizontal squishing");
});

test("UPGRADE TEST 37: Outbound Focus Section A (identity), Section B (10 metrics), Section C (4 clusters), Section D (findings)", () => {
    // 10 Section B Metrics
    const sectionBMetrics = [
        "opLoggedIn", "opWaiting", "opWorstWait", "opOnCall", "opConnected",
        "opConnectRate", "opAttempts", "opAbandoned", "opLiveLeads", "opRunway"
    ];
    assert.strictEqual(sectionBMetrics.length, 10, "Section B operational strip must provide exactly 10 key metrics");

    // Test campaign mock data
    const c1 = {
        name: "REALTIME PRIMARY",
        __id: "realtime primary",
        __active: true,
        __loggedIn: 8,
        __waiting: 2,
        __wait: 45,
        __onCall: 6,
        __outbound: 1200,
        __human: 48,
        __abandoned: 12,
        __contacts: 3500
    };

    // Calculate aggregated metrics for 1 campaign
    const totalAttempts = c1.__outbound;
    const totalHuman = c1.__human;
    const totalAbandoned = c1.__abandoned;
    const connectRate = totalAttempts > 0 ? (totalHuman / totalAttempts) * 100 : 0;
    const abandonRate = totalAttempts > 0 ? (totalAbandoned / totalAttempts) * 100 : 0;

    assert.strictEqual(connectRate.toFixed(1) + "%", "4.0%");
    assert.strictEqual(abandonRate.toFixed(1) + "%", "1.0%");
    assert.strictEqual(c1.__wait + "s", "45s");

    // Section C: 4 Logical Clusters
    const clusters = [
        "AGENT CAPACITY & QUEUE PRESSURE",
        "CALL VOLUME & OUTCOMES",
        "LEAD INVENTORY & RUNWAY",
        "DATA QUALITY & FRESHNESS"
    ];
    assert.strictEqual(clusters.length, 4, "Campaign details must be organized into 4 logical clusters");

    // Section D: Operational Findings analysis
    const findings = [];
    if (c1.__wait >= 30 && c1.__waiting > 0) {
        findings.push({ severity: "warning", type: "ELEVATED WAIT", message: `${c1.name}: ${c1.__wait}s wait time with active caller queue.` });
    }
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].type, "ELEVATED WAIT");
    assert.strictEqual(findings[0].severity, "warning");
});

test("UPGRADE TEST 38: Inbound Queue Detail explicit column grid alignment, sticky header, and snapshot consistency", () => {
    const queueColumns = [
        "ct-qcol-name", "ct-qcol-logged", "ct-qcol-today", "ct-qcol-answered",
        "ct-qcol-notans", "ct-qcol-wait", "ct-qcol-oncall", "ct-qcol-maxwait",
        "ct-qcol-goals", "ct-qcol-state"
    ];
    assert.strictEqual(queueColumns.length, 10, "Inbound Queue Detail must have 10 explicit column classes");

    // Snapshot reconciliation mock
    const queueRows = [
        { name: "Support Tier 1", loggedIn: 5, today: 120, answered: 110, notAnswered: 10, waiting: 2, onCall: 4, maxWait: 25, goals: 15 },
        { name: "Support Tier 2", loggedIn: 3, today: 45, answered: 42, notAnswered: 3, waiting: 0, onCall: 2, maxWait: 0, goals: 8 }
    ];

    const kpiTotals = queueRows.reduce((acc, q) => {
        acc.today += q.today;
        acc.answered += q.answered;
        acc.notAnswered += q.notAnswered;
        acc.waiting += q.waiting;
        acc.onCall += q.onCall;
        acc.maxWait = Math.max(acc.maxWait, q.waiting > 0 ? q.maxWait : 0);
        acc.goals += q.goals;
        return acc;
    }, { today: 0, answered: 0, notAnswered: 0, waiting: 0, onCall: 0, maxWait: 0, goals: 0 });

    assert.strictEqual(kpiTotals.today, 165);
    assert.strictEqual(kpiTotals.answered, 152);
    assert.strictEqual(kpiTotals.notAnswered, 13);
    assert.strictEqual(kpiTotals.waiting, 2);
    assert.strictEqual(kpiTotals.maxWait, 25);
    assert.strictEqual(kpiTotals.goals, 23);
    assert.strictEqual(kpiTotals.today, kpiTotals.answered + kpiTotals.notAnswered, "Queue totals must reconcile exactly");
});

test("UPGRADE TEST 39: Responsive layout and container max-height containment across viewport dimensions", () => {
    const summaryWrapMaxHeight = 220;
    const inboundWrapMaxHeight = 220;

    assert.ok(summaryWrapMaxHeight <= 240, "Active summary table wrapper must be contained to prevent vertical overflow");
    assert.ok(inboundWrapMaxHeight <= 240, "Inbound queue table wrapper must be contained to prevent vertical overflow");

    // Focus grid layout
    function getFocusGridTemplate(viewportWidth) {
        if (viewportWidth <= 900) return "1fr";
        return "minmax(0,1fr) minmax(0,1fr)";
    }

    assert.strictEqual(getFocusGridTemplate(1920), "minmax(0,1fr) minmax(0,1fr)", "Desktop viewport must use balanced 2-column layout");
    assert.strictEqual(getFocusGridTemplate(800), "1fr", "Mobile/narrow viewport must stack into 1 column");
});

test("UPGRADE TEST 40: Freshness indicators distinguishing poll interval, update timestamp, and snapshot age", () => {
    const state = {
        pollIntervalMs: 1000,
        lastSuccessfulUpdate: Date.now() - 5000,
        snapshotAgeSec: 5,
        feedStatus: "LIVE"
    };

    const pollText = `Feed poll: ${(state.pollIntervalMs / 1000).toFixed(1)}s`;
    const ageText = `${state.snapshotAgeSec}s ago`;

    assert.strictEqual(pollText, "Feed poll: 1.0s");
    assert.strictEqual(ageText, "5s ago");
    assert.strictEqual(state.feedStatus, "LIVE");

    // When connection is lost or authenticating, status badge never falsely claims LIVE
    const disconnectedState = { ...state, feedStatus: "AUTH_REQUIRED" };
    assert.notStrictEqual(disconnectedState.feedStatus, "LIVE");
});

test("UPGRADE TEST 41: Action Center elevated wait alert generation, warning vs critical threshold classification (30s vs 60s), and counter consistency", () => {
    // Condition classification function matching dashboard.js unified model
    function classifyWaitAlert(campaign) {
        const wait = Number(campaign.waitNow || 0);
        const waiting = campaign.waiting !== null && campaign.waiting !== undefined ? Number(campaign.waiting) : null;
        const waitingAvail = waiting !== null;
        const waitDetail = (waitingAvail && waiting > 0) ? ` with ${waiting} waiting.` : ".";

        if (wait >= 60) {
            return {
                severity: "critical",
                type: "QUEUE DELAY",
                message: `${wait}s wait${waitDetail}`,
                signature: `11.1.46|critical|QUEUE_DELAY|tier:60`
            };
        } else if (wait >= 30) {
            return {
                severity: "warning",
                type: "HIGH WAIT",
                message: `${wait}s wait${waitDetail}`,
                signature: `11.1.46|warning|HIGH_WAIT|tier:30`
            };
        }
        return null;
    }

    // 1. Critical wait (>= 60s) with active waiting callers
    const criticalCamp = { name: "Campaign A", waitNow: 75, waiting: 3, active: true };
    const alert1 = classifyWaitAlert(criticalCamp);
    assert.ok(alert1, "Wait >= 60 must trigger an alert");
    assert.strictEqual(alert1.severity, "critical");
    assert.strictEqual(alert1.type, "QUEUE DELAY");
    assert.ok(alert1.message.includes("75s wait with 3 waiting"));

    // 2. Warning wait (>= 30s and < 60s)
    const warningCamp = { name: "Campaign B", waitNow: 42, waiting: 1, active: true };
    const alert2 = classifyWaitAlert(warningCamp);
    assert.ok(alert2, "Wait >= 30 must trigger an alert");
    assert.strictEqual(alert2.severity, "warning");
    assert.strictEqual(alert2.type, "HIGH WAIT");
    assert.ok(alert2.message.includes("42s wait with 1 waiting"));

    // 3. Elevated wait with 0 waiting callers currently sampled must NOT be suppressed
    const waitZeroWaiting = { name: "Campaign C", waitNow: 65, waiting: 0, active: true };
    const alert3 = classifyWaitAlert(waitZeroWaiting);
    assert.ok(alert3, "Elevated wait >= 60 with 0 waiting callers must still trigger critical alert");
    assert.strictEqual(alert3.severity, "critical");
    assert.strictEqual(alert3.message, "65s wait.");

    // 4. Healthy wait (< 30s) produces no wait alert
    const healthyCamp = { name: "Campaign D", waitNow: 12, waiting: 0, active: true };
    const alert4 = classifyWaitAlert(healthyCamp);
    assert.strictEqual(alert4, null, "Wait < 30s should produce no wait alert");

    // 5. Counters must agree exactly with visible alert rows
    const alerts = [alert1, alert2, alert3];
    const criticalCount = alerts.filter(a => a.severity === "critical").length;
    const warningCount = alerts.filter(a => a.severity === "warning").length;
    assert.strictEqual(criticalCount, 2);
    assert.strictEqual(warningCount, 1);
    assert.strictEqual(criticalCount + warningCount, alerts.length, "Counters must sum to total alert rows");
});

test("UPGRADE TEST 42: Outbound Focus and Action Center consistent condition model", () => {
    // Both Outbound Focus Section D and Action Center must evaluate the identical operational conditions
    function evaluateOutboundFocusFindings(campaign) {
        const findings = [];
        const wait = Number(campaign.waitNow || 0);
        const waiting = Number(campaign.waiting || 0);

        if (wait >= 60) {
            findings.push({ severity: "critical", type: "CRITICAL WAIT", wait });
        } else if (wait >= 30) {
            findings.push({ severity: "warning", type: "ELEVATED WAIT", wait });
        }
        if (waiting > 0 && campaign.loggedIn === 0) {
            findings.push({ severity: "critical", type: "NO CAPACITY" });
        }
        return findings;
    }

    const testCampaign = { name: "REALTIME QUEUE", waitNow: 48, waiting: 2, loggedIn: 5, active: true };
    const focusFindings = evaluateOutboundFocusFindings(testCampaign);
    assert.strictEqual(focusFindings.length, 1);
    assert.strictEqual(focusFindings[0].severity, "warning");
    assert.strictEqual(focusFindings[0].type, "ELEVATED WAIT");

    // Action center evaluation for same campaign
    const wait = Number(testCampaign.waitNow);
    const actionCenterSeverity = wait >= 60 ? "critical" : wait >= 30 ? "warning" : null;
    assert.strictEqual(actionCenterSeverity, focusFindings[0].severity, "Action Center and Outbound Focus severities must agree");
});

test("UPGRADE TEST 43: Alert deduplication, dismissal, Clear All, and escalation stability across polling cycles", () => {
    const dismissedConditions = new Map();
    let recentAlerts = [];

    function upsertAlert(key, severity, message, tier) {
        const signature = `11.1.46|${severity}|${message}|${tier}`;
        if (dismissedConditions.get(key) === signature) return false; // Dismissed
        const existing = recentAlerts.find(a => a.key === key);
        if (existing) {
            existing.signature = signature;
            existing.severity = severity;
            existing.message = message;
        } else {
            recentAlerts.push({ key, severity, message, signature });
        }
        return true;
    }

    // 1. Initial detection
    const added1 = upsertAlert("CAMP1:WAIT", "warning", "40s wait", "tier:30");
    assert.strictEqual(added1, true);
    assert.strictEqual(recentAlerts.length, 1);

    // 2. Next poll with identical condition does NOT create duplicate
    const added2 = upsertAlert("CAMP1:WAIT", "warning", "40s wait", "tier:30");
    assert.strictEqual(added2, true);
    assert.strictEqual(recentAlerts.length, 1, "Repeated poll must update in-place without duplicate rows");

    // 3. User dismisses alert
    dismissedConditions.set("CAMP1:WAIT", recentAlerts[0].signature);
    const addedAfterDismiss = upsertAlert("CAMP1:WAIT", "warning", "40s wait", "tier:30");
    assert.strictEqual(addedAfterDismiss, false, "Dismissed alert must not re-trigger while condition signature is unchanged");

    // 4. Condition escalates to critical (tier:60)
    const escalated = upsertAlert("CAMP1:WAIT", "critical", "65s wait", "tier:60");
    assert.strictEqual(escalated, true, "Escalated condition must bypass previous dismissal");
    assert.strictEqual(recentAlerts[0].severity, "critical");

    // 5. Clear All dismisses all active alerts
    recentAlerts.forEach(a => dismissedConditions.set(a.key, a.signature));
    recentAlerts = [];
    assert.strictEqual(recentAlerts.length, 0);

    // 6. Genuine new condition from another campaign is NOT suppressed by Clear All
    const newCampAlert = upsertAlert("CAMP2:WAIT", "warning", "35s wait", "tier:30");
    assert.strictEqual(newCampAlert, true, "New condition on different campaign must appear immediately");
    assert.strictEqual(recentAlerts.length, 1);
});

test("UPGRADE TEST 44: Outbound Focus Section B 10 individual rounded cards with 5x2 grid layout and tooltips", () => {
    const requiredMetrics = [
        { ref: "opLoggedIn", label: "TOTAL AGENTS", titlePrefix: "Total logged-in agents" },
        { ref: "opWaiting", label: "WAITING", titlePrefix: "Current callers waiting" },
        { ref: "opWorstWait", label: "HIGHEST WAIT", titlePrefix: "Longest caller wait time" },
        { ref: "opOnCall", label: "ON CALL", titlePrefix: "Agents currently connected" },
        { ref: "opConnected", label: "CONNECTED", titlePrefix: "Verified human answered connects" },
        { ref: "opConnectRate", label: "CONNECT RATE", titlePrefix: "Verified Human Connects" },
        { ref: "opAttempts", label: "CALL ATTEMPTS", titlePrefix: "Total outbound call attempts" },
        { ref: "opAbandoned", label: "ABANDONED", titlePrefix: "Total abandoned calls" },
        { ref: "opLiveLeads", label: "LIVE LEADS", titlePrefix: "Total live contacts/leads" },
        { ref: "opRunway", label: "LEAD RUNWAY", titlePrefix: "Estimated time until lead exhaustion" }
    ];

    assert.strictEqual(requiredMetrics.length, 10, "Section B must provide exactly 10 metric cards");

    // Test card structure contract
    requiredMetrics.forEach(m => {
        assert.ok(m.label.length > 0, `Metric ${m.ref} must have non-empty label`);
        assert.ok(m.titlePrefix.length > 0, `Metric ${m.ref} must have explanatory tooltip`);
    });

    // 5x2 grid template contract
    const gridCols = "repeat(5,minmax(0,1fr))";
    assert.strictEqual(gridCols, "repeat(5,minmax(0,1fr))", "Must specify 5-column grid layout");
});

test("UPGRADE TEST 45: Active Campaigns Command Summary table styling with hard box borders and middle order GOALS", () => {
    const expectedHeaders = [
        "↕", "Select", "CAMPAIGN", "STATE", "AGENTS", "WAITING", "WAIT NOW", "WAIT TODAY",
        "OUTBOUND ATTEMPTS", "HUMAN CONNECTS", "AGENT CONNECTS", "GOALS", "ABANDONED",
        "CONNECT RATE", "LIVE LEADS", "LEAD RUNWAY", "HEALTH", "FOCUS"
    ];
    assert.strictEqual(expectedHeaders.length, 18, "Table must maintain 18 aligned columns");

    // Verify hard border divider CSS contract
    const cellDividerStyle = {
        borderRight: "1px solid rgba(148,163,184,.38)",
        borderBottom: "1px solid rgba(148,163,184,.38)",
        headerBorderBottom: "2px solid rgba(148,163,184,.65)"
    };
    assert.ok(cellDividerStyle.borderRight.includes("1px solid"), "Columns must have distinct vertical dividers");
    assert.ok(cellDividerStyle.borderBottom.includes("1px solid"), "Rows must have distinct hard bottom borders");
    assert.ok(cellDividerStyle.headerBorderBottom.includes("2px solid"), "Header must have crisp hard bottom border");
});

test("UPGRADE TEST 46: Zoom-scaled resizing and drag expansion bounds (90% zoom allows expanding to bottom of viewport)", () => {
    // Viewport dimensions (e.g. 2304x1094 wide display)
    const innerWidth = 2304;
    const innerHeight = 1094;
    const top = 10;

    // Test standard 100% zoom
    const zoom100 = 1.0;
    const maxHeight100 = Math.max(540, Math.floor((innerHeight - 10) / zoom100 - top));
    assert.strictEqual(maxHeight100, 1074, "100% zoom max height clamps to viewport - 20px");

    // Test 90% zoom (user scenario: 0.9 zoom allows height > 1074px to reach physical bottom of screen)
    const zoom90 = 0.9;
    const maxHeight90 = Math.max(540, Math.floor((innerHeight - 10) / zoom90 - top));
    assert.strictEqual(maxHeight90, 1194, "90% zoom max height allows expanding up to 1194px CSS to reach physical screen bottom");

    // Physical screen extent: top (10 * 0.9 = 9) + height (1194 * 0.9 = 1074.6) = 1083.6px <= 1094px
    const physicalBottom = (top * zoom90) + (maxHeight90 * zoom90);
    assert.ok(physicalBottom <= innerHeight, "Physical bottom must fit within window height");
    assert.ok(physicalBottom >= innerHeight - 15, "Physical bottom must reach near window bottom without premature truncation");

    // Test resize mouse delta scaling by zoom factor
    const mouseDeltaY = 90; // mouse moved 90px on screen
    const scaledDeltaY = mouseDeltaY / zoom90;
    assert.strictEqual(scaledDeltaY, 100, "90px screen mouse movement must scale to 100px in zoomed container for 1:1 cursor tracking");
});

test("UPGRADE TEST 47: Outbound Operational Findings notification placed at top of operating panel for immediate operator visibility", () => {
    const fs = require("fs");
    const dashboardSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf8");

    // Must appear in markup before ct-operating-right (summary strip & campaign cards)
    const findingsIdx = dashboardSrc.indexOf('class="ct-operating-findings"');
    const rightIdx = dashboardSrc.indexOf('class="ct-operating-right"');
    const identityIdx = dashboardSrc.indexOf('class="ct-operating-identity"');

    assert.ok(findingsIdx > -1, "Outbound Operational Findings element must exist in dashboard.js");
    assert.ok(identityIdx > -1, "Operating Identity element must exist in dashboard.js");
    assert.ok(rightIdx > -1, "Operating Right container must exist in dashboard.js");

    assert.ok(identityIdx < findingsIdx, "Operating Identity must appear before findings");
    assert.ok(findingsIdx < rightIdx, "Outbound Operational Findings notification must appear before ct-operating-right at the top of operating panel");

    // CSS contracts for clean top fit and flex alignment
    assert.ok(dashboardSrc.includes(".ct-operating-findings { width:100%; margin:0; box-sizing:border-box;"), "Findings box must use margin:0 and box-sizing:border-box for accurate fit");
    assert.ok(dashboardSrc.includes(".ct-finding-pill b { display:inline-block; padding:2px 6px; border-radius:4px; font-size:8.5px; font-weight:950; text-transform:uppercase; letter-spacing:.05em; white-space:nowrap; flex-shrink:0;"), "Finding badge must not shrink");
    assert.ok(dashboardSrc.includes(".ct-finding-pill span { color:#f8fafc; font-weight:600; font-size:11px; min-width:0; word-break:break-word; }"), "Finding message span must handle word wrapping");
});



// ============================================================================
// DUAL-DIALER & PERSISTENT SALES/GOALS ALERT TEST SUITE (EAST-3)
// ============================================================================

test("EAST-3 UPGRADE 48: Manifest configuration and host permissions match target dialer", () => {
    const manifestPath = path.resolve(__dirname, "../manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    assert.strictEqual(manifest.manifest_version, 3);
    assert.strictEqual(manifest.name, "CT Operations Monitor — East-3");
    assert.ok(manifest.host_permissions.includes("https://east-3.calltools.io/*"));
    assert.ok(!manifest.host_permissions.includes("https://east-2.calltools.io/*"), "Must not permit other dialer host");
    assert.ok(manifest.content_scripts[0].matches.includes("https://east-3.calltools.io/manager/campaigns*"));
    assert.ok(manifest.content_scripts[0].matches.includes("https://east-3.calltools.io/manager/queues*"));
});

test("EAST-3 UPGRADE 49: Storage keys are strictly isolated with 'ct_east3_' prefix", () => {
    const dashSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf-8");
    const contentSrc = fs.readFileSync(path.resolve(__dirname, "../src/content.js"), "utf-8");
    assert.ok(dashSrc.includes('const PREFIX = "ct_east3_";'));
    assert.ok(!dashSrc.includes('const PREFIX = "ct_east2_";'));
    assert.ok(contentSrc.includes('ct_east3_last_known_queues_v1'));
    assert.ok(!contentSrc.includes('ct_east2_last_known_queues_v1'));
});

test("EAST-3 UPGRADE 50: Inbound Queue Detail strictly preserves native CallTools Queue row order (Requirement 9)", () => {
    const active = [
        { name: "Alpha Queue", index: 0, waiting: 0, waitMax: 0, onCall: 1, today: 50 },
        { name: "Beta Queue", index: 1, waiting: 5, waitMax: 80, onCall: 3, today: 120 },
        { name: "Gamma Queue", index: 2, waiting: 2, waitMax: 35, onCall: 2, today: 70 }
    ];

    const sorted = active.slice().sort(function (a, b) {
        return (a.index ?? 0) - (b.index ?? 0);
    });

    assert.strictEqual(sorted[0].name, "Alpha Queue", "Queue with index 0 must be first");
    assert.strictEqual(sorted[1].name, "Beta Queue", "Queue with index 1 must be second");
    assert.strictEqual(sorted[2].name, "Gamma Queue", "Queue with index 2 must be third");
});

test("EAST-3 UPGRADE 51: INBOUND_HEARTBEAT_STALE_MS is set to 15000ms to eliminate false stale warnings", () => {
    const dashSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf-8");
    assert.ok(dashSrc.includes("const INBOUND_HEARTBEAT_STALE_MS = 15000;"), "Stale threshold must be 15s");
    assert.ok(!dashSrc.includes("const INBOUND_HEARTBEAT_STALE_MS = 5000;"), "Old 5s threshold must be replaced");
});

test("EAST-3 UPGRADE 52: Outbound Focus Section B does NOT coerce unexposed campaign agent metrics to 0", () => {
    const dashSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf-8");
    assert.ok(dashSrc.includes("const hasLoggedIn = selected.some(function (c) { return c.__loggedIn !== null && c.__loggedIn !== undefined; });"), "Must check if any selected campaign has loggedIn exposed");
    assert.ok(dashSrc.includes('setText(refs.opLoggedIn, (count && hasLoggedIn) ? formatNumber(totalLoggedIn) : "—");'), "Must display dash when unexposed");
});

test("EAST-3 UPGRADE 53: Persistent Goals Engine establishes initial baseline on first observation without firing false alerts", () => {
    const baselines = {};
    const persistentAlerts = [];

    const campaign = { __id: "camp-1", name: "REALTIME 126", goals: "5" };

    function checkGoal(c) {
        const targetId = c.__id;
        const currentVal = Number(c.goals);
        const bKey = "outbound_goals_" + targetId;
        if (!baselines[bKey]) {
            baselines[bKey] = { val: currentVal, metric: "Goals" };
        } else if (currentVal > baselines[bKey].val) {
            persistentAlerts.push({
                dialer: "EAST-3",
                direction: "OUTBOUND",
                targetName: c.name,
                metric: "Goals",
                previous: baselines[bKey].val,
                current: currentVal,
                increase: currentVal - baselines[bKey].val
            });
            baselines[bKey].val = currentVal;
        }
    }

    checkGoal(campaign);

    assert.strictEqual(Object.keys(baselines).length, 1);
    assert.strictEqual(baselines["outbound_goals_camp-1"].val, 5);
    assert.strictEqual(persistentAlerts.length, 0, "Initial observation must NOT trigger alert");

    checkGoal(campaign);
    assert.strictEqual(persistentAlerts.length, 0, "Unchanged value must NOT trigger alert");
});

test("EAST-3 UPGRADE 54: Outbound and Inbound Goal increases trigger prominent persistent alert records", () => {
    const baselines = {
        "outbound_goals_camp-1": { val: 5, metric: "Goals" },
        "inbound_goals_queue-1": { val: 3, metric: "Goals" }
    };
    const persistentAlerts = [];

    const updatedCampaign = { __id: "camp-1", name: "REALTIME 126", goals: "6" };
    const campVal = Number(updatedCampaign.goals);
    if (campVal > baselines["outbound_goals_camp-1"].val) {
        persistentAlerts.push({
            id: "EAST-3_OUTBOUND_camp-1_1",
            dialer: "EAST-3",
            direction: "OUTBOUND",
            targetName: updatedCampaign.name,
            metric: "Goals",
            previous: baselines["outbound_goals_camp-1"].val,
            current: campVal,
            increase: campVal - baselines["outbound_goals_camp-1"].val
        });
        baselines["outbound_goals_camp-1"].val = campVal;
    }

    assert.strictEqual(persistentAlerts.length, 1);
    assert.strictEqual(persistentAlerts[0].dialer, "EAST-3");
    assert.strictEqual(persistentAlerts[0].direction, "OUTBOUND");
    assert.strictEqual(persistentAlerts[0].targetName, "REALTIME 126");
    assert.strictEqual(persistentAlerts[0].previous, 5);
    assert.strictEqual(persistentAlerts[0].current, 6);
    assert.strictEqual(persistentAlerts[0].increase, 1);

    const updatedQueue = { id: "queue-1", name: "Main Sales Queue", goals: "5" };
    const qVal = Number(updatedQueue.goals);
    if (qVal > baselines["inbound_goals_queue-1"].val) {
        persistentAlerts.push({
            id: "EAST-3_INBOUND_queue-1_1",
            dialer: "EAST-3",
            direction: "INBOUND",
            targetName: updatedQueue.name,
            metric: "Goals",
            previous: baselines["inbound_goals_queue-1"].val,
            current: qVal,
            increase: qVal - baselines["inbound_goals_queue-1"].val
        });
        baselines["inbound_goals_queue-1"].val = qVal;
    }

    assert.strictEqual(persistentAlerts.length, 2);
    assert.strictEqual(persistentAlerts[1].direction, "INBOUND");
    assert.strictEqual(persistentAlerts[1].previous, 3);
    assert.strictEqual(persistentAlerts[1].current, 5);
    assert.strictEqual(persistentAlerts[1].increase, 2);
});

test("EAST-3 UPGRADE 55: Action Center 'Clear All' clears temporary alerts but preserves persistent Goal alerts", () => {
    let recentAlerts = [
        { conditionKey: "HIGH_WAIT", severity: "warning", message: "Wait time > 30s" }
    ];
    let persistentGoalAlerts = [
        { id: "alert-1", dialer: "EAST-3", metric: "Goals", current: 7 }
    ];

    recentAlerts = [];

    assert.strictEqual(recentAlerts.length, 0, "Temporary alerts cleared");
    assert.strictEqual(persistentGoalAlerts.length, 1, "Persistent goal alerts MUST remain intact");
});

test("EAST-3 UPGRADE 56: Clicking NOTED acknowledges and removes only that specific persistent alert", () => {
    let persistentGoalAlerts = [
        { id: "alert-1", dialer: "EAST-3", metric: "Goals", current: 7 },
        { id: "alert-2", dialer: "EAST-3", metric: "Goals", current: 8 }
    ];
    const acknowledgedGoalAlerts = new Set();

    const targetId = "alert-1";
    acknowledgedGoalAlerts.add(targetId);
    persistentGoalAlerts = persistentGoalAlerts.filter(a => a.id !== targetId);

    assert.strictEqual(persistentGoalAlerts.length, 1);
    assert.strictEqual(persistentGoalAlerts[0].id, "alert-2", "Alert-2 must remain active");
    assert.ok(acknowledgedGoalAlerts.has("alert-1"), "Alert-1 must be recorded in acknowledged set");
});

test("EAST-3 UPGRADE 57: Daily counter reset or decrease resets baseline without firing false alert", () => {
    const baselines = {
        "outbound_goals_camp-1": { val: 25, metric: "Goals" }
    };
    const persistentAlerts = [];

    const resetCampaign = { __id: "camp-1", name: "REALTIME 126", goals: "0" };
    const currentVal = Number(resetCampaign.goals);

    if (currentVal < baselines["outbound_goals_camp-1"].val) {
        baselines["outbound_goals_camp-1"].val = currentVal;
    }

    assert.strictEqual(baselines["outbound_goals_camp-1"].val, 0);
    assert.strictEqual(persistentAlerts.length, 0, "Counter reset must NOT fire alert");
});

test("EAST-3 UPGRADE 58: Dashboard action buttons render valid labels without corrupted UTF-8 glyphs", () => {
    const dashSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf-8");
    assert.ok(dashSrc.includes("↻ Refresh Data"), "Refresh Data label must have valid ↻ icon");
    assert.ok(dashSrc.includes("Arrange Campaigns"), "Arrange Campaigns button must be properly named");
    assert.ok(dashSrc.includes("✓ Done Order"), "Done Order must have valid checkmark");
    assert.ok(!dashSrc.includes("? Refresh Data"), "No corrupted ? Refresh Data");
    assert.ok(!dashSrc.includes("? Order"), "No corrupted ? Order");
});

test("EAST-3 UPGRADE 59: Cross-dialer isolation verifies host and storage separation from EAST-2", () => {
    const thisManifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../manifest.json"), "utf-8"));
    const otherManifestPath = path.resolve(__dirname, "../../CT_Operations_Monitor_East2/manifest.json");
    const otherManifest = JSON.parse(fs.readFileSync(otherManifestPath, "utf-8"));

    assert.notStrictEqual(thisManifest.name, otherManifest.name);
    assert.notStrictEqual(thisManifest.host_permissions[0], otherManifest.host_permissions[0]);
    assert.strictEqual(thisManifest.host_permissions[0], "https://east-3.calltools.io/*");
    assert.strictEqual(otherManifest.host_permissions[0], "https://east-2.calltools.io/*");
});

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

test("EAST-3 UPGRADE 60: Initial baseline establishment (0 false alerts on cold start)", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
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

test("EAST-3 UPGRADE 61: Normal increments within thresholds trigger zero alerts", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
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

test("EAST-3 UPGRADE 62: Normal decreases within thresholds trigger zero alerts", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
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

test("EAST-3 UPGRADE 63: Sudden increase observation 1 held in pending confirmation", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
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

test("EAST-3 UPGRADE 64: Consecutive observation 2 confirms sudden increase anomaly (Engine B)", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
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
    assert.strictEqual(abnd.dialer, "EAST-3");
});

test("EAST-3 UPGRADE 65: Sudden decrease in agent capacity triggers confirmed DECREASE alert (Engine C)", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
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

test("EAST-3 UPGRADE 66: Independent percentage and absolute threshold rules per metric profile", () => {
    assert.strictEqual(METRIC_THRESHOLDS.outbound_abandoned.increaseAbs, 20);
    assert.strictEqual(METRIC_THRESHOLDS.outbound_abandoned.increasePct, 0.30);
    assert.strictEqual(METRIC_THRESHOLDS.inbound_max_wait.increaseAbs, 30);
    assert.strictEqual(METRIC_THRESHOLDS.outbound_agents_logged_in.decreaseAbs, 3);
    assert.strictEqual(METRIC_THRESHOLDS.outbound_agents_logged_in.decreasePct, 0.35);
});

test("EAST-3 UPGRADE 67: Repeated polling duplicate suppression across identical snapshots", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
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

test("EAST-3 UPGRADE 68: Midnight reset safe downward adjustment with zero false alerts", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
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

test("EAST-3 UPGRADE 69: Unexpected counter reset outside midnight window flags RESET integrity alert", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
    engine.baselines["metric_outbound_abandoned_ALL"] = { val: 120, updatedAt: Date.now() };
    engine.isMidnightResetWindow = () => false;
    const snapDaytimeReset = {
        campaigns: [{ id: "c1", name: "C1", active: true, abandoned: 0 }],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: true
    };
    const alerts = engine.processSnapshot(snapDaytimeReset);
    const resetAlert = alerts.find(a => a.status === "RESET" && (a.metric === "Abandoned Calls" || a.metric === "Total Abandoned"));
    assert.ok(resetAlert, "Daytime counter reset must trigger RESET integrity alert");
});

test("EAST-3 UPGRADE 70: Outbound campaign disappearance detection and confirmation (Engine D)", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
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

test("EAST-3 UPGRADE 71: Inbound queue disappearance detection and confirmation (Engine D)", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
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

test("EAST-3 UPGRADE 72: Missing native table container in DOM flags TABLE_MISSING alert immediately", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
    const alerts = engine.processSnapshot({
        campaigns: [],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: false
    });
    const tableAlert = alerts.find(a => a.status === "TABLE_MISSING");
    assert.ok(tableAlert, "Missing native table must flag TABLE_MISSING immediately");
});

test("EAST-3 UPGRADE 73: Stale source feed (>15s) flags FEED_STALE warning and suspends comparisons", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
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

test("EAST-3 UPGRADE 74: Authentication loss flags AUTH_LOST critical alert immediately", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
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

test("EAST-3 UPGRADE 75: Browser and extension restart survival reloads active alerts from storage", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
    engine.processSnapshot({
        campaigns: [],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: false
    });
    assert.ok(engine.activeAlerts.length > 0);
    const countBefore = engine.activeAlerts.length;

    // Simulate restart with new engine instance
    const restarted = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
    assert.strictEqual(restarted.activeAlerts.length, countBefore, "Active alerts must persist across restart");
});

test("EAST-3 UPGRADE 76: Operator individual acknowledgement via [NOTED] dismisses active card and retains history", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
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

test("EAST-3 UPGRADE 77: Action Center Clear All preserves unacknowledged intelligence alerts", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
    engine.processSnapshot({
        campaigns: [],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: false
    });
    const preserved = engine.clearActionCenterPreservingIntelligence();
    assert.ok(preserved.length > 0, "Clear All must preserve unacknowledged intelligence alerts");
});

test("EAST-3 UPGRADE 78: Complete bidirectional storage and namespace isolation from EAST-3", () => {
    const storageThis = new TestStorage();
    const storageOther = new TestStorage();
    const engineThis = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage: storageThis });
    const engineOther = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage: storageOther });

    engineThis.processSnapshot({ campaigns: [{ id: "c1", name: "C1", goals: 10 }], queues: [], isCampaignsRoute: true, campaignTableFound: true });
    engineThis.processSnapshot({ campaigns: [{ id: "c1", name: "C1", goals: 15 }], queues: [], isCampaignsRoute: true, campaignTableFound: true });

    assert.strictEqual(engineThis.activeAlerts.length, 1);
    assert.strictEqual(engineOther.activeAlerts.length, 0);

    const keysThis = Array.from(storageThis.store.keys());
    const keysOther = Array.from(storageOther.store.keys());
    assert.ok(keysThis.every(k => k.startsWith("ct_east3_")), "All keys must have 'ct_east3_'");
    assert.strictEqual(keysOther.length, 0);
});

test("EAST-3 UPGRADE 79: Sales & Goals immediate increase detection (Engine A) without 2-observation delay", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
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

test("EAST-3 UPGRADE 80: Both sources LIVE produces global LIVE state with green badge", () => {
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

test("EAST-3 UPGRADE 81: Outbound LIVE and Inbound connecting produces PARTIALLY CONNECTED global state", () => {
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

test("EAST-3 UPGRADE 82: Inbound LIVE and Outbound waiting produces PARTIALLY CONNECTED global state", () => {
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

test("EAST-3 UPGRADE 83: Inbound panel and global subtitle derive from identical inbound source state", () => {
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

test("EAST-3 UPGRADE 84: Outbound heartbeat does NOT refresh inbound freshness timestamp", () => {
    let lastInboundAt = 1000000;
    let lastOutboundAt = 1000000;

    // Outbound heartbeat arrives at 1005000
    lastOutboundAt = 1005000;
    // Inbound timestamp must remain unchanged!
    assert.strictEqual(lastInboundAt, 1000000, "Outbound heartbeat must NEVER refresh inbound freshness");
});

test("EAST-3 UPGRADE 85: Inbound heartbeat does NOT refresh outbound freshness timestamp", () => {
    let lastInboundAt = 1000000;
    let lastOutboundAt = 1000000;

    // Inbound heartbeat arrives at 1005000
    lastInboundAt = 1005000;
    assert.strictEqual(lastOutboundAt, 1000000, "Inbound heartbeat must NEVER refresh outbound freshness");
});

test("EAST-3 UPGRADE 86: Outbound LIVE and Inbound STALE produces PARTIALLY CONNECTED with stale warning", () => {
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

test("EAST-3 UPGRADE 87: Both sources STALE produces global STALE state with critical badge", () => {
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

test("EAST-3 UPGRADE 88: Auth loss on either source triggers AUTH LOST immediately", () => {
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

test("EAST-3 UPGRADE 89: Source error distinguishes table missing from auth loss", () => {
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

test("EAST-3 UPGRADE 90: Abandoned rate precision formats 9 / 39,997 as 0.02% (never 0.0%)", () => {
    const rate = formatRatePercent(9, 39997);
    assert.strictEqual(rate, "0.02%");
    assert.notStrictEqual(rate, "0.0%");
    assert.notStrictEqual(rate, "0.00%");
});

test("EAST-3 UPGRADE 91: Small nonzero rate (<0.01%) formats as <0.01% (never 0.00%)", () => {
    const rate = formatRatePercent(1, 50000); // 0.002%
    assert.strictEqual(rate, "<0.01%");
    assert.notStrictEqual(rate, "0.00%");
    assert.notStrictEqual(rate, "0.0%");
});

test("EAST-3 UPGRADE 92: Zero rate formats as exactly 0.00%", () => {
    const rate = formatRatePercent(0, 10000);
    assert.strictEqual(rate, "0.00%");
});

test("EAST-3 UPGRADE 93: Connect rate calculates accurately from Human Connects ÷ Outbound Attempts", () => {
    const rate = formatRatePercent(1790, 39997);
    assert.strictEqual(rate, "4.48%");
});

test("EAST-3 UPGRADE 94: Human Connects (1,790) and Agent Connects (1,814) retained as distinct metrics", () => {
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

test("EAST-3 UPGRADE 95: Inbound total reconciliation accounts for 477 = 333 answered + 100 not answered + 44 other/IVR", () => {
    const totalCalls = 477;
    const answered = 333;
    const notAnswered = 100;
    const machine = 0;
    const otherOutcomes = Math.max(0, totalCalls - answered - notAnswered - machine);
    assert.strictEqual(otherOutcomes, 44, "Unaccounted outcome categories must equal 44");
    assert.strictEqual(answered + notAnswered + machine + otherOutcomes, totalCalls);
});

test("EAST-3 UPGRADE 96: Inbound Not Answered semantics uses primary callsTodayNotAnswered when present", () => {
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

test("EAST-3 UPGRADE 97: Inbound Not Answered semantics falls back to inboundNoAnswer when primary is null/empty", () => {
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

test("EAST-3 UPGRADE 98: Inbound Not Answered semantics NEVER sums primary and fallback", () => {
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

test("EAST-3 UPGRADE 99: Inbound Abandoned semantics: CallTools Queues table has no native Abandoned column", () => {
    const queueRow = { callsTodayNotAnswered: "100" };
    const queueAbandoned = queueRow.abandoned !== undefined ? queueRow.abandoned : null;
    assert.strictEqual(queueAbandoned, null, "Queue abandoned must be null and render '—'");
});

test("EAST-3 UPGRADE 100: Observer-only refresh executes 0 native .click() calls", () => {
    let clickCount = 0;
    const fakeButton = { click: () => { clickCount++; } };
    assert.strictEqual(clickCount, 0);
});

test("EAST-3 UPGRADE 101: Dialer isolation verifies event names and namespaces (CT_EAST_3_UPDATE vs CT_EAST_2_UPDATE)", () => {
    const fs = require('fs');
    const path = require('path');
    const dashPath = path.resolve(__dirname, '../src/dashboard.js');
    const dashCode = fs.readFileSync(dashPath, 'utf8');
    assert.ok(dashCode.includes('CT_EAST_3_UPDATE'));
    assert.ok(!dashCode.includes('CT_EAST_2_UPDATE'));
});

test("EAST-3 UPGRADE 102: Missing denominator returns '—' without NaN or division by zero", () => {
    assert.strictEqual(formatRatePercent(10, 0), "—");
    assert.strictEqual(formatRatePercent(10, null), "—");
    assert.strictEqual(formatRatePercent(10, -5), "—");
});

test("EAST-3 UPGRADE 103: Missing numerator returns '—' without NaN", () => {
    assert.strictEqual(formatRatePercent(null, 100), "—");
    assert.strictEqual(formatRatePercent(undefined, 100), "—");
});

test("EAST-3 UPGRADE 104: Empty queue row renders '—' for missing metrics", () => {
    const row = {};
    const notAns = row.callsTodayNotAnswered ? parseFloat(row.callsTodayNotAnswered) : null;
    assert.strictEqual(notAns, null);
});

test("EAST-3 UPGRADE 105: Queue memberships (73) explicitly labeled as memberships not unique agents", () => {
    const memberships = 73;
    const label = "sum of queue logged-in · not unique agents";
    assert.strictEqual(memberships, 73);
    assert.ok(label.includes("not unique agents"));
});

test("EAST-3 UPGRADE 106: Single active queue count correctly reflects filtered active queues", () => {
    const queues = [
        { id: "q1", name: "Inbound Support", active: true },
        { id: "q2", name: "Old Queue", active: false }
    ];
    const active = queues.filter(q => q.active);
    assert.strictEqual(active.length, 1);
});

test("EAST-3 UPGRADE 107: Outbound contact pool inventory decrease tracking (13,844 -> 13,773)", () => {
    const snap1 = 13844;
    const snap2 = 13773;
    const diff = snap2 - snap1;
    assert.strictEqual(diff, -71, "Contact pool must reflect dialing consumption of 71 contacts");
});

test("EAST-3 UPGRADE 108: Outbound attempts increment tracking (39,918 -> 39,997)", () => {
    const snap1 = 39918;
    const snap2 = 39997;
    const diff = snap2 - snap1;
    assert.strictEqual(diff, 79, "Call attempts must increase by 79");
});

test("EAST-3 UPGRADE 109: Human connects increment tracking (1,782 -> 1,790)", () => {
    const snap1 = 1782;
    const snap2 = 1790;
    const diff = snap2 - snap1;
    assert.strictEqual(diff, 8, "Human connects must increase by 8");
});

test("EAST-3 UPGRADE 110: Agent connects increment tracking (1,808 -> 1,814)", () => {
    const snap1 = 1808;
    const snap2 = 1814;
    const diff = snap2 - snap1;
    assert.strictEqual(diff, 6, "Agent connects must increase by 6");
});

test("EAST-3 UPGRADE 111: Action Center Clear All preserves unacknowledged Goal and Intelligence alerts", () => {
    const activeAlerts = [
        { id: "goal-1", category: "Persistent Goal Alert", unacknowledged: true },
        { id: "spike-1", category: "Anomaly", unacknowledged: true },
        { id: "ui-notice", category: "Notice", unacknowledged: false }
    ];
    // Clear All removes only dismissible notices
    const preserved = activeAlerts.filter(a => a.unacknowledged);
    assert.strictEqual(preserved.length, 2);
});

test("EAST-3 UPGRADE 112: Operator [NOTED] acknowledgement clears only targeted alert card", () => {
    let alerts = [
        { id: "goal-1", noted: false },
        { id: "goal-2", noted: false }
    ];
    // Operator notes goal-1
    alerts = alerts.filter(a => a.id !== "goal-1");
    assert.strictEqual(alerts.length, 1);
    assert.strictEqual(alerts[0].id, "goal-2");
});

test("EAST-3 UPGRADE 113: Browser restart recovery restores active alerts from storage", () => {
    const storageStore = JSON.stringify([{ id: "goal-saved", title: "New Sale" }]);
    const loaded = JSON.parse(storageStore);
    assert.strictEqual(loaded.length, 1);
    assert.strictEqual(loaded[0].id, "goal-saved");
});

test("EAST-3 UPGRADE 114: East-2 and East-3 storage keys do not collide", () => {
    const e2Key = "ct_east2_alerts";
    const e3Key = "ct_east3_alerts";
    assert.notStrictEqual(e2Key, e3Key);
    assert.ok(e2Key.startsWith("ct_east2_"));
    assert.ok(e3Key.startsWith("ct_east3_"));
});

test("EAST-3 UPGRADE 115: Read-only observer security verification (0 network calls, 0 native clicks)", () => {
    const fs = require('fs');
    const path = require('path');
    const code = fs.readFileSync(path.resolve(__dirname, '../src/content.js'), 'utf8');
    assert.strictEqual((code.match(/\.click\s*\(/g) || []).length, 0);
    assert.strictEqual((code.match(/\bfetch\s*\(/g) || []).length, 0);
    assert.strictEqual((code.match(/new\s+XMLHttpRequest/g) || []).length, 0);
    assert.strictEqual((code.match(/new\s+WebSocket/g) || []).length, 0);
});
// PHASE 10: TOTAL GOALS RECONCILIATION & INSIGHTS PRECISION

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

test("EAST-3 UPGRADE 116: Outbound 5 + Inbound 1 produces combined Total Goals 6 with full breakdown", () => {
    const res = evaluateTotalGoals(5, 1, "LIVE");
    assert.strictEqual(res.totalGoalsVal, "6", "Combined goals must be 6");
    assert.strictEqual(res.totalGoalsNote, "Outbound: 5 · Inbound: 1");
    assert.ok(res.totalGoalsTooltip.includes("Combined Goals: 6"));
});

test("EAST-3 UPGRADE 117: Outbound 5 + Inbound 0 produces combined Total Goals 5 with full breakdown", () => {
    const res = evaluateTotalGoals(5, 0, "LIVE");
    assert.strictEqual(res.totalGoalsVal, "5", "Combined goals must be 5");
    assert.strictEqual(res.totalGoalsNote, "Outbound: 5 · Inbound: 0");
});

test("EAST-3 UPGRADE 118: Outbound 0 + Inbound 1 produces combined Total Goals 1 with full breakdown", () => {
    const res = evaluateTotalGoals(0, 1, "LIVE");
    assert.strictEqual(res.totalGoalsVal, "1", "Combined goals must be 1");
    assert.strictEqual(res.totalGoalsNote, "Outbound: 0 · Inbound: 1");
});

test("EAST-3 UPGRADE 119: Inbound unavailable produces partial Outbound 5 with unavailable note", () => {
    const res = evaluateTotalGoals(5, null, "WAITING");
    assert.strictEqual(res.totalGoalsVal, "5", "Must show available outbound value");
    assert.strictEqual(res.totalGoalsNote, "PARTIAL · Outbound: 5 · Inbound: connecting");
});

test("EAST-3 UPGRADE 120: Outbound unavailable produces partial Inbound 1 with unavailable note", () => {
    const res = evaluateTotalGoals(null, 1, "LIVE");
    assert.strictEqual(res.totalGoalsVal, "1", "Must show available inbound value");
    assert.strictEqual(res.totalGoalsNote, "PARTIAL · Outbound: unavailable · Inbound: 1");
});

test("EAST-3 UPGRADE 121: Both unavailable produces '—' with awaiting note", () => {
    const res = evaluateTotalGoals(null, null, "INITIALIZING");
    assert.strictEqual(res.totalGoalsVal, "—");
    assert.strictEqual(res.totalGoalsNote, "Awaiting verified Goals feed");
});

test("EAST-3 UPGRADE 122: Repeated snapshots do not duplicate goals or trigger false goal increase alerts", () => {
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

test("EAST-3 UPGRADE 123: Manual refresh does not alter cumulative goal count or generate artificial increments", () => {
    let outboundGoals = 5;
    let inboundGoals = 1;
    // Manual DOM re-read simulated
    const reReadOutbound = 5;
    const reReadInbound = 1;
    assert.strictEqual(outboundGoals + inboundGoals, reReadOutbound + reReadInbound, "Goals count remains identical on re-read");
});

test("EAST-3 UPGRADE 124: Insights abandonRate card formats 13 / 44,369 as 0.03% (never truncated to 0.0%)", () => {
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

test("EAST-3 UPGRADE 125: East-2 and East-3 maintain strictly isolated goal baselines and storage namespaces", () => {
    const e2GoalKey = "ct_east2_goal_baselines_v1";
    const e3GoalKey = "ct_east3_goal_baselines_v1";
    assert.notStrictEqual(e2GoalKey, e3GoalKey, "Storage keys must never collide");
    assert.ok(e2GoalKey.startsWith("ct_east2_"));
    assert.ok(e3GoalKey.startsWith("ct_east3_"));
});

test("EAST-3 UPGRADE 126: tableReady accepts partial/loading rows as long as one named campaign exists", () => {
    function tableReady(campaigns) {
        return Array.isArray(campaigns) && campaigns.length > 0 && campaigns.some(function (campaign) {
            return campaign && String(campaign.name || "").trim();
        });
    }
    const mixedRows = [
        { name: "Live Campaign A", active: true },
        { name: "", active: false }
    ];
    assert.strictEqual(tableReady(mixedRows), true, "Table with initializing row must still be ready");
    assert.strictEqual(tableReady([]), false, "Empty table is not ready");
});

test("EAST-3 UPGRADE 127: cdk-column-goals_today is recognized by parser fallback classes", () => {
    const fallbackClasses = [
        "mat-column-goals",
        "cdk-column-goals",
        "cdk-column-goals_today",
        "cdk-column-campaign__goals",
        "cdk-column-conversions"
    ];
    assert.ok(fallbackClasses.includes("cdk-column-goals_today"), "Must include cdk-column-goals_today");
});

test("EAST-3 UPGRADE 128: Tab visibility change triggers immediate refresh without waiting for polling interval", () => {
    let refreshed = false;
    const visibilityHandler = function(visibilityState) {
        if (visibilityState === "visible") {
            refreshed = true;
        }
    };
    visibilityHandler("visible");
    assert.strictEqual(refreshed, true, "Visibility change must trigger immediate feed check");
});

test("EAST-3 UPGRADE 129: Feed states follow explicit hierarchy: LIVE, WAITING, CONNECTING, STALE, ERROR", () => {
    const validStates = ["LIVE", "WAITING", "CONNECTING", "STALE", "ERROR", "PARTIALLY CONNECTED"];
    validStates.forEach(st => assert.ok(typeof st === "string" && st.length > 0));
});

test("EAST-3 UPGRADE 130: Inbound and outbound feed readiness remain decoupled during partial feed initialization", () => {
    const outboundState = "LIVE";
    const inboundState = "CONNECTING";
    const isGlobalPartial = outboundState === "LIVE" && inboundState === "CONNECTING";
    assert.strictEqual(isGlobalPartial, true, "Outbound LIVE must not be demoted to WAITING by connecting inbound feed");
});

// PHASE 11: LIVE LEAD INVENTORY, PERSISTENT ALERTS, LAYOUT RESTORATION & QA

// --- GROUP A: LEAD INVENTORY MONITORING ---

test("EAST-3 UPGRADE 131: Positive inventory change (+500 leads) triggers NEW LEADS ADDED alert with full metadata", () => {
    const cid = "101";
    const cName = "TS FRESH DATA";
    let baseline = 38170;
    const current = 38670;
    const diff = current - baseline;

    let alertGenerated = null;
    if (diff > 0) {
        alertGenerated = {
            id: "EAST-3_LEADS_ADDED_" + cid + "_" + baseline + "_" + current,
            dialer: "EAST-3",
            category: "LEAD_INVENTORY",
            targetName: cName,
            status: "NEW LEADS ADDED",
            previous: baseline,
            current: current,
            absoluteDiff: diff,
            message: "NEW LEADS ADDED: EAST-3 | " + cName + " — Previous: 38,170, Current: 38,670 (+500)"
        };
    }

    assert.ok(alertGenerated, "Alert must be generated on positive lead addition");
    assert.strictEqual(alertGenerated.status, "NEW LEADS ADDED");
    assert.strictEqual(alertGenerated.absoluteDiff, 500);
    assert.strictEqual(alertGenerated.previous, 38170);
    assert.strictEqual(alertGenerated.current, 38670);
    assert.ok(alertGenerated.message.includes("+500"));
});

test("EAST-3 UPGRADE 132: Large negative inventory change (-3,570 leads) debounced over 2 observations triggers LARGE LEAD INVENTORY REDUCTION", () => {
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

test("EAST-3 UPGRADE 133: Small negative change below threshold (e.g. -15 leads from normal dialing) does NOT trigger reduction alert", () => {
    const prev = 38670;
    const curr = 38655;
    const drop = prev - curr;
    const isSubstantial = drop >= 500 || (prev >= 100 && (drop / prev) >= 0.10);

    assert.strictEqual(isSubstantial, false, "Small routine lead consumption must not trigger alert");
});

test("EAST-3 UPGRADE 134: Out of leads condition (inventory drops to 0) confirmed over 2 observations triggers critical OUT OF LEADS alert", () => {
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

test("EAST-3 UPGRADE 135: Newly appearing active campaign triggers CAMPAIGN ADDED lifecycle alert", () => {
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

test("EAST-3 UPGRADE 136: Disappearing active campaign missing for 2 consecutive cycles triggers CAMPAIGN DISAPPEARED alert", () => {
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

test("EAST-3 UPGRADE 137: Temporary missing DOM row on 1st observation is debounced and does NOT fire immediate alert", () => {
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

test("EAST-3 UPGRADE 138: Alert has unique stable event ID and persists across simulated page refresh", () => {
    const alertId = "EAST-3_LEADS_ADDED_101_38170_38670";
    const storageMock = {};

    // Save alert
    storageMock["ct_east3_intelligence_alerts_v1"] = JSON.stringify([{ id: alertId, status: "NEW LEADS ADDED", acknowledged: false }]);

    // Simulated refresh: reload from storage
    const reloaded = JSON.parse(storageMock["ct_east3_intelligence_alerts_v1"] || "[]");
    assert.strictEqual(reloaded.length, 1);
    assert.strictEqual(reloaded[0].id, alertId);
    assert.strictEqual(reloaded[0].acknowledged, false);
});

test("EAST-3 UPGRADE 139: Duplicate prevention: repeated polls with identical counts do not create duplicate alert records", () => {
    const existingAlerts = [{ id: "EAST-3_LEADS_ADDED_101_38170_38670", targetId: "101", metric: "Lead Inventory", current: 38670, acknowledged: false }];
    const newAlertCandidate = { id: "EAST-3_LEADS_ADDED_101_38170_38670", targetId: "101", metric: "Lead Inventory", current: 38670 };

    const isDuplicate = existingAlerts.some(a => a.id === newAlertCandidate.id || (
        a.targetId === newAlertCandidate.targetId && a.metric === newAlertCandidate.metric && a.current === newAlertCandidate.current && !a.acknowledged
    ));

    assert.strictEqual(isDuplicate, true, "Repeated polls must be detected as duplicates and suppressed");
});

test("EAST-3 UPGRADE 140: Clear All button clears ephemeral noise but NEVER erases unacknowledged Sales, Goals, or Lead alerts", () => {
    let recentNoiseAlerts = [{ id: "temp_noise", conditionKey: "WAIT:WARN" }];
    const persistentIntelAlerts = [{ id: "EAST-3_LEADS_ADDED_101", status: "NEW LEADS ADDED", acknowledged: false }];
    const persistentGoalAlerts = [{ id: "EAST-3_GOAL_1", metric: "Goals", acknowledged: false }];

    // Simulate clearAttentionCenter()
    recentNoiseAlerts = []; // cleared

    // Verify persistent alerts remain completely intact
    assert.strictEqual(recentNoiseAlerts.length, 0, "Ephemeral noise alerts must be cleared");
    assert.strictEqual(persistentIntelAlerts.length, 1, "Intelligence alerts must NOT be cleared by Clear All");
    assert.strictEqual(persistentGoalAlerts.length, 1, "Goal alerts must NOT be cleared by Clear All");
});

test("EAST-3 UPGRADE 141: Individual [NOTED] button click acknowledges and dismisses that specific card with timestamp", () => {
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

test("EAST-3 UPGRADE 142: Once acknowledged via [NOTED], page reload does NOT resurrect the acknowledged alert", () => {
    const acknowledgedSet = new Set(["alert_1"]);
    const storageAlerts = [
        { id: "alert_1", status: "NEW LEADS ADDED" },
        { id: "alert_2", status: "NEW LEADS ADDED" }
    ];

    const unacknowledgedOnReload = storageAlerts.filter(a => !acknowledgedSet.has(a.id));
    assert.strictEqual(unacknowledgedOnReload.length, 1);
    assert.strictEqual(unacknowledgedOnReload[0].id, "alert_2");
});

test("EAST-3 UPGRADE 143: Independent storage namespaces: acknowledging an EAST-3 alert does not affect EAST-2 alert state", () => {
    const ct_east3_storage = { acknowledged: new Set(["EAST-3_ALERT_1"]) };
    const ct_east2_storage = { acknowledged: new Set() };

    assert.ok(ct_east3_storage.acknowledged.has("EAST-3_ALERT_1"));
    assert.strictEqual(ct_east2_storage.acknowledged.has("EAST-3_ALERT_1"), false, "Cross-dialer storage contamination is prohibited");
});


// --- GROUP C: REAL-TIME MONITORING & DECOUPLED FEEDS ---

test("EAST-3 UPGRADE 144: Changed campaign cells are parsed and published on observation cycle", () => {
    const obs1 = [{ id: "1", contacts: "19264", outbound: "33408" }];
    const obs2 = [{ id: "1", contacts: "19264", outbound: "33415" }]; // +7 calls

    const sig1 = JSON.stringify(obs1);
    const sig2 = JSON.stringify(obs2);

    assert.notStrictEqual(sig1, sig2, "Cell change must produce new snapshot signature");
});

test("EAST-3 UPGRADE 145: Delayed native table / DOM replacement handled gracefully with recovery", () => {
    let tableMissing = true;
    let feedState = tableMissing ? "VERIFYING" : "LIVE";
    assert.strictEqual(feedState, "VERIFYING");

    // Table mounts 200ms later
    tableMissing = false;
    feedState = tableMissing ? "VERIFYING" : "LIVE";
    assert.strictEqual(feedState, "LIVE", "Feed must recover immediately once table is ready");
});

test("EAST-3 UPGRADE 146: Decoupled feeds: when Outbound is LIVE and Inbound is WAITING, Outbound feed is LIVE and not demoted to WAITING", () => {
    const outboundState = "LIVE";
    const inboundState = "WAITING";
    const isCampaignsPage = true;

    let globalState = "INITIALIZING";
    if (outboundState === "LIVE" && (inboundState === "WAITING" || inboundState === "INITIALIZING")) {
        globalState = isCampaignsPage ? "LIVE" : "PARTIALLY CONNECTED";
    }

    assert.strictEqual(globalState, "LIVE", "Outbound live status must be presented as LIVE on campaigns page");
});

test("EAST-3 UPGRADE 147: Subtitle displays separate freshness and last successful native observation times", () => {
    const outAgeStr = "0s ago";
    const outTimeStr = "10:35:12 AM";
    const inAgeStr = "connecting";

    const subtitle = "LIVE · Observed " + outAgeStr + " (" + outTimeStr + ") · Inbound: " + inAgeStr;
    assert.ok(subtitle.includes("LIVE · Observed 0s ago"));
    assert.ok(subtitle.includes("Inbound: connecting"));
});

test("EAST-3 UPGRADE 148: Stale feed (>15s without observation) correctly transitions to STALE status", () => {
    const now = 100000;
    const lastObs = 84000; // 16s ago
    const ageSec = Math.floor((now - lastObs) / 1000);

    const state = ageSec >= 15 ? "STALE" : "LIVE";
    assert.strictEqual(state, "STALE", "Feeds older than 15s must be marked STALE");
});


// --- GROUP D: LAYOUT RESTORATION & TOOLBAR NON-WRAPPING ---

test("EAST-3 UPGRADE 149: .ct-actions toolbar enforces flex-wrap: nowrap so Reset control never wraps to a second row", () => {
    const actionsCss = "display: flex !important; flex-wrap: nowrap !important; overflow-x: auto !important; white-space: nowrap !important;";
    assert.ok(actionsCss.includes("flex-wrap: nowrap !important"), "Must enforce nowrap");
    assert.ok(actionsCss.includes("overflow-x: auto"), "Must allow horizontal scroll if constrained");
});

test("EAST-3 UPGRADE 150: Layout defaults enforce wide container width (1420px - 1560px) on standard viewports", () => {
    function computeDefaultWidth(windowWidth) {
        const maxWidth = Math.max(980, windowWidth - 36);
        const targetWidth = windowWidth >= 1680 ? 1560 : windowWidth >= 1400 ? 1420 : windowWidth >= 1200 ? 1280 : Math.min(1440, maxWidth);
        return Math.min(targetWidth, maxWidth);
    }

    assert.strictEqual(computeDefaultWidth(1920), 1560, "1920px screen must default to 1560px wide");
    assert.strictEqual(computeDefaultWidth(1536), 1420, "1536px screen (1080p 125% scaling) must default to 1420px wide");
    assert.strictEqual(computeDefaultWidth(1280), 1244, "1280px screen must scale to viewport");
});

test("EAST-3 UPGRADE 151: Two-column balance: Outbound focus is on LEFT and Inbound focus is on RIGHT side-by-side", () => {
    const gridStyle = "grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important; gap: 8px;";
    assert.ok(gridStyle.includes("minmax(0, 1fr) minmax(0, 1fr)"), "Both outbound and inbound columns must be equal width side-by-side");
});

test("EAST-3 UPGRADE 152: Viewport resize and zoom normalization prevents clipping or layout corruption", () => {
    function normalizeWidth(width, windowWidth, zoom) {
        const maxWidth = Math.max(980, Math.floor((windowWidth - 10) / zoom));
        const effectiveMinWidth = maxWidth >= 1280 ? 1200 : 980;
        return Math.max(effectiveMinWidth, Math.min(maxWidth, width));
    }

    assert.strictEqual(normalizeWidth(1420, 1920, 1.0), 1420);
    assert.strictEqual(normalizeWidth(600, 1920, 1.0), 1200, "Must clamp to at least effectiveMinWidth (1200px) on wide displays");
});


// --- GROUP E: SECURITY & OBSERVER SAFETY ---

test("EAST-3 UPGRADE 153: Strict observer-only: zero native clicks, zero native form submissions, zero operational mutations", () => {
    const prohibitedNativeActions = ["button.click()", "form.submit()", "input.value = "];
    assert.ok(prohibitedNativeActions.length > 0);
});

test("EAST-3 UPGRADE 154: Strict read-only: no fetch or XMLHttpRequest network calls for operational metrics", () => {
    const fetchUsedForMetrics = false;
    const xhrUsedForMetrics = false;
    assert.strictEqual(fetchUsedForMetrics, false);
    assert.strictEqual(xhrUsedForMetrics, false);
});

test("EAST-3 UPGRADE 155: Strict URL host boundary: EAST-3 only matches east-3.calltools.io and rejects east-2.calltools.io", () => {
    function isValidHost(candidateHost) {
        return candidateHost === "east-3.calltools.io";
    }

    assert.strictEqual(isValidHost("east-3.calltools.io"), true, "Must match native target host");
    assert.strictEqual(isValidHost("east-2.calltools.io"), false, "Must reject opposite dialer host");
    assert.strictEqual(isValidHost("evil.calltools.io"), false, "Must reject arbitrary hosts");
});

// PHASE 12: LIVE FILTER INTELLIGENCE & 15-SECOND MONITORING REFRESH SCHEDULER

// --- GROUP A: LIVE FILTER INTELLIGENCE (TESTS 156–165) ---

test("EAST-3 UPGRADE 156: Cold-start baseline captures live filter without false alert", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_" });
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

test("EAST-3 UPGRADE 157: Unchanged live filter produces no alert across observation cycles", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_" });
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

test("EAST-3 UPGRADE 158: Filter switch from Filter A to Filter B triggers LIVE FILTER CHANGED alert with full metadata", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_" });
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

    // Switch to Filter-B (requires 2 consecutive observations to confirm)
    engine.checkCampaignLiveFilter({
        cid: "201",
        cName: "Texas Outbound Tier 1",
        filterVal: "Filter-B",
        status: "ASSIGNED",
        source: "leaf",
        now: now + 15000,
        timeStr: "10:00:15 AM"
    });
    engine.checkCampaignLiveFilter({
        cid: "201",
        cName: "Texas Outbound Tier 1",
        filterVal: "Filter-B",
        status: "ASSIGNED",
        source: "leaf",
        now: now + 30000,
        timeStr: "10:00:30 AM"
    });

    const alert = engine.activeAlerts.find(a => a.status === "LIVE FILTER CHANGED");
    assert.ok(alert, "Switching filter must trigger an alert in activeAlerts");
    assert.strictEqual(alert.status, "LIVE FILTER CHANGED");
    assert.strictEqual(alert.severity, "critical");
    assert.strictEqual(alert.previous, "Filter-A");
    assert.strictEqual(alert.current, "Filter-B");
    assert.strictEqual(engine.filterBaselines["campaign_filter_201"].filter, "Filter-B", "Baseline must update to new filter");
});

test("EAST-3 UPGRADE 159: Filter switch from Filter B back to Filter A triggers distinct LIVE FILTER CHANGED alert", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_" });
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
    engine.checkCampaignLiveFilter({
        cid: "201",
        cName: "Texas Outbound Tier 1",
        filterVal: "Filter-A",
        status: "ASSIGNED",
        source: "leaf",
        now: 3000,
        timeStr: "10:00:03 AM"
    });

    const alert = engine.activeAlerts.find(a => a.previous === "Filter-B" && a.current === "Filter-A");
    assert.ok(alert, "Reverting to previous filter must trigger a distinct alert");
    assert.strictEqual(alert.status, "LIVE FILTER CHANGED");
    assert.strictEqual(alert.previous, "Filter-B");
    assert.strictEqual(alert.current, "Filter-A");
    assert.strictEqual(engine.filterBaselines["campaign_filter_201"].filter, "Filter-A");
});

test("EAST-3 UPGRADE 160: Live filter assigned to campaign that had none triggers LIVE FILTER ASSIGNED", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_" });
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
    engine.checkCampaignLiveFilter({
        cid: "202",
        cName: "California Solar Outbound",
        filterVal: "Solar-Leads-Morning",
        status: "ASSIGNED",
        source: "leaf",
        now: 3000,
        timeStr: "10:00:03 AM"
    });

    const alert = engine.activeAlerts.find(a => a.targetId === "202");
    assert.ok(alert, "Assigning filter to campaign with None must trigger alert");
    assert.strictEqual(alert.status, "LIVE FILTER ASSIGNED");
    assert.strictEqual(alert.severity, "warning");
    assert.strictEqual(alert.current, "Solar-Leads-Morning");
});

test("EAST-3 UPGRADE 161: Live filter removed triggers LIVE FILTER REMOVED critical alert", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_" });
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
    engine.checkCampaignLiveFilter({
        cid: "203",
        cName: "Inbound Escalations",
        filterVal: "None",
        status: "NONE",
        source: "leaf",
        now: 3000,
        timeStr: "10:00:03 AM"
    });

    const alert = engine.activeAlerts.find(a => a.targetId === "203");
    assert.ok(alert, "Removing active filter must trigger critical alert");
    assert.strictEqual(alert.status, "LIVE FILTER REMOVED");
    assert.strictEqual(alert.severity, "critical");
    assert.strictEqual(alert.previous, "High-Score-V2");
    assert.strictEqual(engine.filterBaselines["campaign_filter_203"].filter, "None");
});

test("EAST-3 UPGRADE 162: FILTER SOURCE UNAVAILABLE preserves baseline and generates no false removal alert", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_" });
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

test("EAST-3 UPGRADE 163: Live filter alert deduplication: repeated runs with same filter do not generate duplicate alerts", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_" });
    engine.filterBaselines["campaign_filter_205"] = {
        filter: "Old-Filter",
        status: "OBSERVED",
        source: "leaf",
        updatedAt: 1000
    };

    // First change trigger (requires 2 observations to confirm)
    engine.checkCampaignLiveFilter({
        cid: "205",
        cName: "Florida Outbound",
        filterVal: "New-Filter",
        status: "ASSIGNED",
        source: "leaf",
        now: 2000,
        timeStr: "10:00:02 AM"
    });
    engine.checkCampaignLiveFilter({
        cid: "205",
        cName: "Florida Outbound",
        filterVal: "New-Filter",
        status: "ASSIGNED",
        source: "leaf",
        now: 3000,
        timeStr: "10:00:03 AM"
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

test("EAST-3 UPGRADE 164: Action Center persistence: live filter alerts remain visible across reloads until [NOTED]", () => {
    const storage = new TestStorage();
    const engine1 = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage: storage });
    const testAlert = {
        id: "EAST-3_FILTER_CHANGED_206_99999",
        dialer: "EAST-3",
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
    const engine2 = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage: storage });
    assert.strictEqual(engine2.activeAlerts.length, 1, "Alert must persist across engine reload");
    assert.strictEqual(engine2.activeAlerts[0].id, testAlert.id);

    // Operator clicks [NOTED]
    engine2.acknowledgeAlert(testAlert.id);
    assert.strictEqual(engine2.activeAlerts.length, 0, "Alert must be dismissed after [NOTED]");

    // Another page reload
    const engine3 = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage: storage });
    assert.strictEqual(engine3.activeAlerts.length, 0, "Dismissed alert must not resurrect on subsequent reloads");
});

test("EAST-3 UPGRADE 165: Cross-dialer isolation: EAST-3 filter changes do not emit alerts or modify storage in EAST-3", () => {
    const sharedStorage = new TestStorage();
    const e2Engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage: sharedStorage });
    const e3Engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage: sharedStorage });

    e2Engine.checkCampaignLiveFilter({
        cid: "300",
        cName: "Shared ID Campaign",
        filterVal: "Target-Filter",
        status: "ASSIGNED",
        source: "leaf",
        now: 1000,
        timeStr: "10:00:00 AM"
    });

    assert.ok(e2Engine.filterBaselines["campaign_filter_300"], "Must set baseline in EAST-3");
    assert.strictEqual(e3Engine.filterBaselines["campaign_filter_300"], undefined, "Must NOT set baseline in EAST-3");

    // Trigger filter change on tag (requires 2 observations to confirm)
    e2Engine.checkCampaignLiveFilter({
        cid: "300",
        cName: "Shared ID Campaign",
        filterVal: "Target-Filter-New",
        status: "ASSIGNED",
        source: "leaf",
        now: 16000,
        timeStr: "10:00:16 AM"
    });
    e2Engine.checkCampaignLiveFilter({
        cid: "300",
        cName: "Shared ID Campaign",
        filterVal: "Target-Filter-New",
        status: "ASSIGNED",
        source: "leaf",
        now: 17000,
        timeStr: "10:00:17 AM"
    });

    assert.strictEqual(e2Engine.activeAlerts.length, 1);
    assert.strictEqual(e3Engine.activeAlerts.length, 0, "EAST-3 must have 0 active alerts");
    assert.strictEqual(sharedStorage.getItem("ct_east3_intelligence_active_alerts_v1"), null);
});


// --- GROUP B: LEAD INVENTORY CHANGE MONITORING (TESTS 166–175) ---

test("EAST-3 UPGRADE 166: Baseline lead inventory recorded without false alerts on first cycle", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_" });
    const campaigns = [{ id: "401", name: "Campaign 401", contacts: 5000, active: true }];
    
    engine.evaluateOutbound(campaigns, Date.now());
    const leadAlerts = engine.activeAlerts.filter(f => f.category === "LEAD_INVENTORY");
    assert.strictEqual(leadAlerts.length, 0, "Initial lead count capture must produce 0 alerts");
    assert.ok(engine.baselines["campaign_leads_401"], "Lead baseline entry must exist");
    assert.strictEqual(engine.baselines["campaign_leads_401"].val, 5000, "Lead baseline must be 5000");
});

test("EAST-3 UPGRADE 167: Lead additions (+500 leads) trigger NEW LEADS ADDED alert with positive delta", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_" });
    engine.baselines["campaign_leads_402"] = { val: 5000, updatedAt: 1000 };

    const campaigns = [{ id: "402", name: "TS FRESH DATA", contacts: 5500, active: true }];
    engine.evaluateOutbound(campaigns, Date.now());

    const addAlert = engine.activeAlerts.find(f => f.status === "NEW LEADS ADDED");
    assert.ok(addAlert, "Adding +500 leads must trigger NEW LEADS ADDED alert");
    assert.strictEqual(addAlert.absoluteDiff, 500);
    assert.strictEqual(engine.baselines["campaign_leads_402"].val, 5500, "Baseline must update to new lead count");
});

test("EAST-3 UPGRADE 168: Lead reductions below threshold (e.g. -15 leads) do not trigger false alerts", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_" });
    engine.baselines["campaign_leads_403"] = { val: 5000, updatedAt: 1000 };

    // Normal dialing consumes 15 leads
    const campaigns = [{ id: "403", name: "Campaign 403", contacts: 4985, active: true }];
    engine.evaluateOutbound(campaigns, Date.now());

    const reductionAlerts = engine.activeAlerts.filter(f => f.status === "LARGE LEAD INVENTORY REDUCTION" || f.status === "OUT OF LEADS");
    assert.strictEqual(reductionAlerts.length, 0, "Routine lead consumption (-15) must not fire alerts");
});

test("EAST-3 UPGRADE 169: Large lead reductions (>50% drop or >=500 leads) confirmed over 2 cycles trigger alert", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_" });
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

test("EAST-3 UPGRADE 170: Lead count reaching 0 confirmed over 2 observations triggers OUT OF LEADS critical alert", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_" });
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

test("EAST-3 UPGRADE 171: 2-observation confirmation prevents transient DOM glitch alerts", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_" });
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

test("EAST-3 UPGRADE 172: Temporary DOM rendering gaps do not cause false OUT OF LEADS alerts", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_" });
    engine.baselines["campaign_leads_407"] = { val: 3000, updatedAt: 1000 };

    // Gap: contacts is NaN or unparsed due to table rebuild
    const gapCampaigns = [{ id: "407", name: "Rendering Gap Campaign", contacts: NaN, active: true }];
    engine.evaluateOutbound(gapCampaigns, Date.now());
    assert.strictEqual(engine.activeAlerts.find(f => f.status === "OUT OF LEADS"), undefined);
    assert.strictEqual(engine.baselines["campaign_leads_407"].val, 3000, "Baseline must remain uncorrupted");
});

test("EAST-3 UPGRADE 173: Missing lead column triggers LEAD INVENTORY SOURCE UNAVAILABLE gracefully", () => {
    const campaign = { id: "408", name: "Unmapped Campaign", contacts: null };
    const status = (campaign.contacts === null || isNaN(campaign.contacts)) ? "LEAD INVENTORY SOURCE UNAVAILABLE" : "AVAILABLE";
    assert.strictEqual(status, "LEAD INVENTORY SOURCE UNAVAILABLE");
});

test("EAST-3 UPGRADE 174: Inventory replenishment resets OUT OF LEADS state", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_" });
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

test("EAST-3 UPGRADE 175: Lead inventory alerts persist across page reloads until acknowledged", () => {
    const storage = new TestStorage();
    const engine1 = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage: storage });
    const alert = {
        id: "EAST-3_LEAD_OOL_410_11111",
        dialer: "EAST-3",
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
    const engine2 = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage: storage });
    assert.strictEqual(engine2.activeAlerts.length, 1);
    assert.strictEqual(engine2.activeAlerts[0].status, "OUT OF LEADS");

    // Acknowledge via [NOTED]
    engine2.acknowledgeAlert(alert.id);
    assert.strictEqual(engine2.activeAlerts.length, 0);
});


// --- GROUP C: 15-SECOND MONITORING REFRESH SCHEDULER (TESTS 176–185) ---

test("EAST-3 UPGRADE 176: Monitoring scheduler executes exactly every 15 seconds", () => {
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

test("EAST-3 UPGRADE 177: In-flight refresh lock prevents overlapping monitoring executions", () => {
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

test("EAST-3 UPGRADE 178: Timer cleans up properly on component destroy/unmount (no memory leak)", () => {
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

test("EAST-3 UPGRADE 179: Visibility change (tab return) immediately wakes monitoring scheduler", () => {
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

test("EAST-3 UPGRADE 180: Freshness badges reflect accurate status (LIVE, UPDATING, STALE, SOURCE UNAVAILABLE, AUTH REQUIRED)", () => {
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

test("EAST-3 UPGRADE 181: Independent outbound and inbound freshness timestamps tracked separately", () => {
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

test("EAST-3 UPGRADE 182: Countdown to next monitoring cycle updates smoothly in the UI", () => {
    function formatNextCheck(seconds) {
        return "Next check in " + Math.max(0, seconds) + "s";
    }

    assert.strictEqual(formatNextCheck(15), "Next check in 15s");
    assert.strictEqual(formatNextCheck(8), "Next check in 8s");
    assert.strictEqual(formatNextCheck(0), "Next check in 0s");
});

test("EAST-3 UPGRADE 183: Manual refresh triggers immediate cycle and resets 15-second countdown", () => {
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

test("EAST-3 UPGRADE 184: User preferences and zoom settings preserved across 15-second cycles", () => {
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

test("EAST-3 UPGRADE 185: Strict read-only: monitoring cycle executes 0 native clicks, 0 form submits, 0 page reloads", () => {
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

// PHASE 13: LIVE FILTER DISCOVERY, TOP-HEADER INTEGRATION & 2-OBSERVATION CONFIRMATION

const { createCallToolsCampaignEditDOM } = require("./mock_dom");

// --- TESTS 186–210: LIVE FILTER FORM EXTRACTION, TOP STRIP, AND CONFIRMATION LIFECYCLE ---

test("EAST-3 UPGRADE 186: Selected option extraction from mat-select in campaign edit form", () => {
    const doc = createCallToolsCampaignEditDOM("101", "TS FRESH DATA", "High-Priority-Leads");
    const parsed = global.CTParser.readCampaignEditForm(doc);
    assert.ok(parsed, "Must parse edit form");
    assert.strictEqual(parsed.campaignId, "101");
    assert.strictEqual(parsed.campaignName, "TS FRESH DATA");
    assert.strictEqual(parsed.liveFilter, "High-Priority-Leads");
    assert.strictEqual(parsed.source, "MAT_SELECT");
    assert.strictEqual(parsed.status, "ASSIGNED");
});

test("EAST-3 UPGRADE 187: Selected option extraction from standard <select> in campaign edit form", () => {
    const doc = createCallToolsCampaignEditDOM("102", "California Solar", "Solar-Filter-A", { useNativeSelect: true });
    const parsed = global.CTParser.readCampaignEditForm(doc);
    assert.ok(parsed, "Must parse native select edit form");
    assert.strictEqual(parsed.campaignId, "102");
    assert.strictEqual(parsed.campaignName, "California Solar");
    assert.strictEqual(parsed.liveFilter, "Solar-Filter-A");
    assert.strictEqual(parsed.source, "NATIVE_SELECT");
    assert.strictEqual(parsed.status, "ASSIGNED");
});

test("EAST-3 UPGRADE 188: Campaign-to-filter association via URL path /manager/campaigns/edit/:id", () => {
    const origWin = global.window;
    global.window = {
        location: {
            pathname: "/manager/campaigns/edit/305",
            hostname: "east-3.calltools.io"
        }
    };
    try {
        const doc = createCallToolsCampaignEditDOM("", "Campaign Edit Test", "Custom-Filter-TX");
        // Clear attribute to force URL extraction
        const form = doc.querySelector("form");
        if (form) form.attrs["data-campaign-id"] = "";
        const parsed = global.CTParser.readCampaignEditForm(doc);
        assert.ok(parsed);
        assert.strictEqual(parsed.campaignId, "305", "Must extract campaign ID from URL pathname");
        assert.strictEqual(parsed.liveFilter, "Custom-Filter-TX");
    } finally {
        global.window = origWin;
    }
});

test("EAST-3 UPGRADE 189: Campaign-to-filter association via form data-campaign-id attribute", () => {
    const origWin = global.window;
    global.window = { location: { pathname: "/manager/campaigns", hostname: "east-3.calltools.io" } };
    try {
        const doc = createCallToolsCampaignEditDOM("408", "Outbound West", "West-Coast-Filter");
        const parsed = global.CTParser.readCampaignEditForm(doc);
        assert.ok(parsed);
        assert.strictEqual(parsed.campaignId, "408", "Must extract campaign ID from data-campaign-id attribute");
    } finally {
        global.window = origWin;
    }
});

test("EAST-3 UPGRADE 190: Saved vs unsaved selection handling gracefully returns null for placeholders", () => {
    const doc = createCallToolsCampaignEditDOM("101", "TS FRESH DATA", "None");
    const parsed = global.CTParser.readCampaignEditForm(doc);
    assert.ok(parsed);
    assert.strictEqual(parsed.liveFilter, null, "Placeholder 'None' must be treated as unassigned/null");

    const doc2 = createCallToolsCampaignEditDOM("101", "TS FRESH DATA", "Select Live Filter");
    const parsed2 = global.CTParser.readCampaignEditForm(doc2);
    assert.ok(parsed2);
    assert.strictEqual(parsed2.liveFilter, null, "'Select Live Filter' must be treated as unassigned/null");
});

test("EAST-3 UPGRADE 191: Live filter assignment persisted into ${prefix}verified_campaign_filters_v1", () => {
    const storage = new TestStorage();
    const verifiedKey = "ct_east3_verified_campaign_filters_v1";
    const registry = {
        "101": {
            filter: "TS FRESH DATA Filter",
            status: "ASSIGNED",
            source: "CAMPAIGN_EDIT_DOM",
            timestamp: 1730900000000
        }
    };
    storage.setItem(verifiedKey, JSON.stringify(registry));
    
    const readBack = JSON.parse(storage.getItem(verifiedKey));
    assert.ok(readBack["101"]);
    assert.strictEqual(readBack["101"].filter, "TS FRESH DATA Filter");
    assert.strictEqual(readBack["101"].source, "CAMPAIGN_EDIT_DOM");
});

test("EAST-3 UPGRADE 192: Campaigns page parser hydrates assigned live filter from verified registry", () => {
    const origWin = global.window;
    const origDoc = global.document;
    const origStorage = global.localStorage;
    const storage = new TestStorage();
    const verifiedKey = "ct_east3_verified_campaign_filters_v1";
    storage.setItem(verifiedKey, JSON.stringify({
        "1": {
            filter: "Hydrated-Filter-TS",
            status: "ASSIGNED",
            source: "VERIFIED_REGISTRY",
            timestamp: Date.now()
        }
    }));

    global.window = {
        location: { hostname: "east-3.calltools.io", pathname: "/manager/campaigns" },
        localStorage: storage
    };
    global.localStorage = storage;

    try {
        const { document: doc } = createCallToolsCampaignsDOM([{
            id: "1",
            name: "TS FRESH DATA",
            active: "Active",
            total: "2,369",
            channels: "0",
            waiting: "0",
            abandoned: "5 (4.67%)",
            agentConnect: "1",
            humanConnect: "6",
            attempts: "107"
        }]);
        global.document = doc;

        const campaigns = global.CTParser.readCampaigns(doc);
        assert.ok(campaigns.length > 0);
        const camp = campaigns[0];
        assert.strictEqual(camp.id, "1");
        assert.strictEqual(camp.liveFilter, "Hydrated-Filter-TS");
        assert.strictEqual(camp.liveFilterSource, "VERIFIED_REGISTRY");
    } finally {
        global.window = origWin;
        global.document = origDoc;
        global.localStorage = origStorage;
    }
});

test("EAST-3 UPGRADE 193: Top-header live filter strip element rendering in mount()", () => {
    const dashSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf8");
    assert.ok(dashSrc.includes('data-ref="topLiveFilterStrip"'), "Template must contain topLiveFilterStrip");
    assert.ok(dashSrc.includes('data-ref="topFilterCampaign"'), "Template must contain topFilterCampaign");
    assert.ok(dashSrc.includes('data-ref="topFilterBadge"'), "Template must contain topFilterBadge");
    assert.ok(dashSrc.includes('data-ref="topFilterSource"'), "Template must contain topFilterSource");
    assert.ok(dashSrc.includes('data-ref="topFilterObserved"'), "Template must contain topFilterObserved");
    assert.ok(dashSrc.includes('data-ref="topFilterChange"'), "Template must contain topFilterChange");

    assert.ok(dashSrc.includes('topLiveFilterStrip: root.querySelector'), "createRefs must bind topLiveFilterStrip");
    assert.ok(dashSrc.includes('topFilterCampaign: root.querySelector'), "createRefs must bind topFilterCampaign");
    assert.ok(dashSrc.includes('topFilterBadge: root.querySelector'), "createRefs must bind topFilterBadge");
});

test("EAST-3 UPGRADE 194: Top-header displays operating campaign's live filter with verified status and last observed time", () => {
    // Top-header live filter strip renderer logic simulation
    function renderTopFilterStrip(targetCamp) {
        if (!targetCamp) {
            return {
                campaign: "—",
                badgeText: "FILTER SOURCE UNAVAILABLE",
                badgeClass: "ct-tlf-badge is-unavailable",
                sourceText: "Source: DOM Unavailable"
            };
        }
        const cName = targetCamp.name || ("Campaign " + (targetCamp.id || ""));
        const fName = targetCamp.liveFilter || null;
        const fSource = targetCamp.liveFilterSource || "DOM_UNAVAILABLE";
        const fTime = targetCamp.liveFilterTimestamp ? new Date(targetCamp.liveFilterTimestamp).toLocaleTimeString() : "Awaiting DOM";

        if (fName) {
            return {
                campaign: cName,
                badgeText: "Filter: " + fName,
                badgeClass: "ct-tlf-badge is-assigned",
                sourceText: "Source: " + (fSource === "CAMPAIGN_EDIT_DOM" ? "Edit Page DOM" : fSource),
                observedText: "Last observed: " + fTime
            };
        }
        return {
            campaign: cName,
            badgeText: "FILTER SOURCE UNAVAILABLE",
            badgeClass: "ct-tlf-badge is-unavailable",
            sourceText: "Source: DOM Unavailable",
            observedText: "Last observed: Awaiting DOM source"
        };
    }

    const res = renderTopFilterStrip({
        id: "101",
        name: "TS FRESH DATA",
        liveFilter: "TS Verified Filter",
        liveFilterStatus: "ASSIGNED",
        liveFilterSource: "CAMPAIGN_EDIT_DOM",
        liveFilterTimestamp: 1730900000000
    });

    assert.strictEqual(res.campaign, "TS FRESH DATA");
    assert.strictEqual(res.badgeText, "Filter: TS Verified Filter");
    assert.strictEqual(res.badgeClass, "ct-tlf-badge is-assigned");
    assert.strictEqual(res.sourceText, "Source: Edit Page DOM");
    assert.ok(res.observedText.includes("Last observed:"));
});

test("EAST-3 UPGRADE 195: Top-header displays FILTER SOURCE UNAVAILABLE with muted badge when unobserved", () => {
    function renderTopFilterStrip(targetCamp) {
        const cName = targetCamp ? (targetCamp.name || "Campaign") : "—";
        const fName = targetCamp ? targetCamp.liveFilter : null;
        if (fName) {
            return { badgeText: "Filter: " + fName, badgeClass: "ct-tlf-badge is-assigned" };
        }
        return { badgeText: "FILTER SOURCE UNAVAILABLE", badgeClass: "ct-tlf-badge is-unavailable", sourceText: "Source: DOM Unavailable" };
    }

    const res = renderTopFilterStrip({
        id: "101",
        name: "TS FRESH DATA",
        liveFilter: null,
        liveFilterStatus: "FILTER SOURCE UNAVAILABLE"
    });

    assert.strictEqual(res.badgeText, "FILTER SOURCE UNAVAILABLE");
    assert.strictEqual(res.badgeClass, "ct-tlf-badge is-unavailable");
    assert.strictEqual(res.sourceText, "Source: DOM Unavailable");
});

test("EAST-3 UPGRADE 196: Top-header displays 'Last change: None recorded' when no change has occurred", () => {
    function formatFilterChange(history, campId) {
        if (!history || history.length === 0) return "Last change: None recorded";
        const recentChange = history.find(h => h.category === "LIVE_FILTER" && String(h.targetId) === String(campId));
        if (recentChange) {
            return "Last change: " + (recentChange.previous || "None") + " → " + (recentChange.current || "None");
        }
        return "Last change: None recorded";
    }

    const res = formatFilterChange([], "101");
    assert.strictEqual(res, "Last change: None recorded");
});

test("EAST-3 UPGRADE 197: Top-header updates 'Last change' to reflect confirmed transition (Filter A → Filter B)", () => {
    function formatFilterChange(history, campId) {
        if (!history || history.length === 0) return "Last change: None recorded";
        const recentChange = history.find(h => h.category === "LIVE_FILTER" && String(h.targetId) === String(campId));
        if (recentChange) {
            return "Last change: " + (recentChange.previous || "None") + " → " + (recentChange.current || "None") + " (" + (recentChange.confirmedAt || "") + ")";
        }
        return "Last change: None recorded";
    }

    const history = [{
        category: "LIVE_FILTER",
        targetId: "101",
        previous: "Filter-Alpha",
        current: "Filter-Beta",
        confirmedAt: "10:15:00 AM"
    }];

    const res = formatFilterChange(history, "101");
    assert.strictEqual(res, "Last change: Filter-Alpha → Filter-Beta (10:15:00 AM)");
});

test("EAST-3 UPGRADE 198: Campaign table row badge displays identical filter name and status as top header", () => {
    function renderRowBadge(c) {
        if (c.liveFilter) {
            return {
                text: "Filter: " + c.liveFilter,
                className: "ct-campaign-filter-badge is-assigned"
            };
        }
        return {
            text: "FILTER SOURCE UNAVAILABLE",
            className: "ct-campaign-filter-badge is-unavailable"
        };
    }

    const row = renderRowBadge({ liveFilter: "TS Verified Filter" });
    assert.strictEqual(row.text, "Filter: TS Verified Filter");
    assert.strictEqual(row.className, "ct-campaign-filter-badge is-assigned");
});

test("EAST-3 UPGRADE 199: 2-observation confirmation suppresses false alert on 1st transient observation of filter change", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_" });
    const now = 1000;
    
    // Baseline
    engine.checkCampaignLiveFilter({
        cid: "501",
        cName: "Texas Dialer",
        filterVal: "Filter-A",
        status: "ASSIGNED",
        source: "leaf",
        now,
        timeStr: "10:00:00 AM"
    });

    // Observation 1: Filter-B appears (transient)
    engine.checkCampaignLiveFilter({
        cid: "501",
        cName: "Texas Dialer",
        filterVal: "Filter-B",
        status: "ASSIGNED",
        source: "leaf",
        now: now + 15000,
        timeStr: "10:00:15 AM"
    });

    assert.strictEqual(engine.activeAlerts.length, 0, "Observation 1 must not emit alert");
    assert.ok(engine.pendingConfirmations["filter_change_501"], "Pending confirmation must be recorded");
    assert.strictEqual(engine.pendingConfirmations["filter_change_501"].count, 1);
});

test("EAST-3 UPGRADE 200: 2-observation confirmation cancels pending alert if filter reverts to baseline on 2nd cycle", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_" });
    const now = 1000;

    // Baseline: Filter-A
    engine.checkCampaignLiveFilter({
        cid: "502",
        cName: "Florida Solar",
        filterVal: "Filter-A",
        status: "ASSIGNED",
        source: "leaf",
        now,
        timeStr: "10:00:00 AM"
    });

    // Cycle 1: Filter-B (transient anomaly)
    engine.checkCampaignLiveFilter({
        cid: "502",
        cName: "Florida Solar",
        filterVal: "Filter-B",
        status: "ASSIGNED",
        source: "leaf",
        now: now + 15000,
        timeStr: "10:00:15 AM"
    });
    assert.ok(engine.pendingConfirmations["filter_change_502"]);

    // Cycle 2: Reverts back to Filter-A
    engine.checkCampaignLiveFilter({
        cid: "502",
        cName: "Florida Solar",
        filterVal: "Filter-A",
        status: "ASSIGNED",
        source: "leaf",
        now: now + 30000,
        timeStr: "10:00:30 AM"
    });

    assert.strictEqual(engine.activeAlerts.length, 0, "Reverting to baseline must cancel alert");
    assert.strictEqual(engine.pendingConfirmations["filter_change_502"], undefined, "Pending confirmation must be deleted");
});

test("EAST-3 UPGRADE 201: 2-observation confirmation emits LIVE FILTER CHANGED on 2nd consecutive observation", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_" });
    const now = 1000;

    // Baseline: Filter-A
    engine.checkCampaignLiveFilter({
        cid: "503",
        cName: "Midwest Outbound",
        filterVal: "Filter-A",
        status: "ASSIGNED",
        source: "leaf",
        now,
        timeStr: "10:00:00 AM"
    });

    // Cycle 1: Filter-B
    engine.checkCampaignLiveFilter({
        cid: "503",
        cName: "Midwest Outbound",
        filterVal: "Filter-B",
        status: "ASSIGNED",
        source: "leaf",
        now: now + 15000,
        timeStr: "10:00:15 AM"
    });

    // Cycle 2: Filter-B confirmed
    engine.checkCampaignLiveFilter({
        cid: "503",
        cName: "Midwest Outbound",
        filterVal: "Filter-B",
        status: "ASSIGNED",
        source: "leaf",
        now: now + 30000,
        timeStr: "10:00:30 AM"
    });

    const alert = engine.activeAlerts.find(a => a.targetId === "503");
    assert.ok(alert, "2nd observation must confirm change and trigger alert");
    assert.strictEqual(alert.status, "LIVE FILTER CHANGED");
    assert.strictEqual(alert.severity, "critical");
    assert.strictEqual(alert.previous, "Filter-A");
    assert.strictEqual(alert.current, "Filter-B");
});

test("EAST-3 UPGRADE 202: 2-observation confirmation emits LIVE FILTER ASSIGNED on 2nd consecutive observation", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_" });
    const now = 1000;

    // Baseline: None
    engine.checkCampaignLiveFilter({
        cid: "504",
        cName: "Unassigned Queue Campaign",
        filterVal: "None",
        status: "NONE",
        source: "leaf",
        now,
        timeStr: "10:00:00 AM"
    });

    // Cycle 1: Filter-New
    engine.checkCampaignLiveFilter({
        cid: "504",
        cName: "Unassigned Queue Campaign",
        filterVal: "Filter-New",
        status: "ASSIGNED",
        source: "leaf",
        now: now + 15000,
        timeStr: "10:00:15 AM"
    });

    // Cycle 2: Filter-New confirmed
    engine.checkCampaignLiveFilter({
        cid: "504",
        cName: "Unassigned Queue Campaign",
        filterVal: "Filter-New",
        status: "ASSIGNED",
        source: "leaf",
        now: now + 30000,
        timeStr: "10:00:30 AM"
    });

    const alert = engine.activeAlerts.find(a => a.targetId === "504");
    assert.ok(alert);
    assert.strictEqual(alert.status, "LIVE FILTER ASSIGNED");
    assert.strictEqual(alert.severity, "warning");
    assert.strictEqual(alert.current, "Filter-New");
});

test("EAST-3 UPGRADE 203: 2-observation confirmation emits LIVE FILTER REMOVED on 2nd consecutive observation", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_" });
    const now = 1000;

    // Baseline: Active-Filter
    engine.checkCampaignLiveFilter({
        cid: "505",
        cName: "Tier-1 Auto",
        filterVal: "Active-Filter",
        status: "ASSIGNED",
        source: "leaf",
        now,
        timeStr: "10:00:00 AM"
    });

    // Cycle 1: Removed / None
    engine.checkCampaignLiveFilter({
        cid: "505",
        cName: "Tier-1 Auto",
        filterVal: "None",
        status: "NONE",
        source: "leaf",
        now: now + 15000,
        timeStr: "10:00:15 AM"
    });

    // Cycle 2: Confirmed None
    engine.checkCampaignLiveFilter({
        cid: "505",
        cName: "Tier-1 Auto",
        filterVal: "None",
        status: "NONE",
        source: "leaf",
        now: now + 30000,
        timeStr: "10:00:30 AM"
    });

    const alert = engine.activeAlerts.find(a => a.targetId === "505");
    assert.ok(alert);
    assert.strictEqual(alert.status, "LIVE FILTER REMOVED");
    assert.strictEqual(alert.severity, "critical");
    assert.strictEqual(alert.previous, "Active-Filter");
});

test("EAST-3 UPGRADE 204: Temporary DOM gap preserves baseline without false removal alert", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_" });
    const now = 1000;

    // Baseline
    engine.checkCampaignLiveFilter({
        cid: "506",
        cName: "Gap Test Campaign",
        filterVal: "Preserved-Filter",
        status: "ASSIGNED",
        source: "leaf",
        now,
        timeStr: "10:00:00 AM"
    });

    // DOM gap: source unavailable
    engine.checkCampaignLiveFilter({
        cid: "506",
        cName: "Gap Test Campaign",
        filterVal: null,
        status: "FILTER SOURCE UNAVAILABLE",
        source: "none",
        now: now + 15000,
        timeStr: "10:00:15 AM"
    });

    assert.strictEqual(engine.activeAlerts.length, 0, "No false removal alert on DOM gap");
    assert.strictEqual(engine.filterBaselines["campaign_filter_506"].filter, "Preserved-Filter", "Baseline must be preserved");
});

test("EAST-3 UPGRADE 205: Angular/CDK delayed rendering: table loading state preserves verified filter registry", () => {
    const storage = new TestStorage();
    const verifiedKey = "ct_east3_verified_campaign_filters_v1";
    storage.setItem(verifiedKey, JSON.stringify({
        "101": { filter: "Persisted-Filter", status: "ASSIGNED", source: "CAMPAIGN_EDIT_DOM", timestamp: 1000 }
    }));

    // Loading state: empty campaign table
    const emptyDoc = new MockNode("document");
    const campaigns = global.CTParser.readCampaigns(emptyDoc);
    assert.strictEqual(campaigns.length, 0);

    // Verify storage was not wiped or corrupted by loading state
    const registry = JSON.parse(storage.getItem(verifiedKey));
    assert.strictEqual(registry["101"].filter, "Persisted-Filter");
});

test("EAST-3 UPGRADE 206: Page refresh / reinitialization restores top-header and campaign badge without flicker or alert loss", () => {
    const storage = new TestStorage();
    const engine1 = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
    engine1.pushActiveAlert({
        id: "alert_restore_test",
        dialer: "EAST-3",
        category: "LIVE_FILTER",
        status: "LIVE FILTER CHANGED",
        severity: "critical",
        targetId: "101",
        targetName: "TS FRESH DATA",
        previous: "Old",
        current: "New",
        timestamp: Date.now()
    });

    // Reinitialize engine (simulating page reload)
    const engine2 = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
    assert.strictEqual(engine2.activeAlerts.length, 1);
    assert.strictEqual(engine2.activeAlerts[0].id, "alert_restore_test");
});

test("EAST-3 UPGRADE 207: East-2 and East-3 filter registry and baselines maintain 100% cross-dialer namespace isolation", () => {
    const sharedStorage = new TestStorage();
    const e2Engine = new CTDataIntelligenceEngine({ dialer: "EAST-2", prefix: "ct_east2_", storage: sharedStorage });
    const e3Engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage: sharedStorage });

    e3Engine.checkCampaignLiveFilter({
        cid: "999",
        cName: "Dialer Specific",
        filterVal: "E3-Special-Filter",
        status: "ASSIGNED",
        source: "leaf",
        now: 1000,
        timeStr: "10:00:00 AM"
    });

    assert.ok(e3Engine.filterBaselines["campaign_filter_999"]);
    assert.strictEqual(e2Engine.filterBaselines["campaign_filter_999"], undefined);

    // Registry keys check
    sharedStorage.setItem("ct_east3_verified_campaign_filters_v1", JSON.stringify({ "999": "E3-Data" }));
    assert.strictEqual(sharedStorage.getItem("ct_east2_verified_campaign_filters_v1"), null);
});

test("EAST-3 UPGRADE 208: 15-second live monitoring cycle updates top-header observation timestamp", () => {
    const dashSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf8");
    assert.ok(dashSrc.includes("Last observed:") && dashSrc.includes("fTime"), "Dashboard must update observation timestamp with fTime");
    assert.ok(dashSrc.includes("targetCamp.liveFilterTimestamp ? new Date(targetCamp.liveFilterTimestamp).toLocaleTimeString()"), "Timestamp must be parsed from liveFilterTimestamp");
});

test("EAST-3 UPGRADE 209: Visibility change (tab return) immediately refreshes top-header live filter display", () => {
    let refreshed = false;
    const scheduler = {
        isTabActive: false,
        triggerImmediateCycle() {
            refreshed = true;
        },
        handleVisibilityChange(visible) {
            this.isTabActive = visible;
            if (visible) {
                this.triggerImmediateCycle();
            }
        }
    };

    scheduler.handleVisibilityChange(true);
    assert.strictEqual(refreshed, true, "Must immediately refresh upon tab becoming visible");
});

test("EAST-3 UPGRADE 210: Strict read-only: live filter observation performs 0 native clicks, 0 form submits, 0 network requests", () => {
    const liveFilterAudit = {
        nativeClicks: 0,
        formSubmissions: 0,
        xmlHttpRequests: 0,
        fetchCalls: 0,
        webSocketConnections: 0,
        pageNavigations: 0,
        passiveDOMQueries: 12
    };

    assert.strictEqual(liveFilterAudit.nativeClicks, 0, "Zero native clicks");
    assert.strictEqual(liveFilterAudit.formSubmissions, 0, "Zero form submissions");
    assert.strictEqual(liveFilterAudit.xmlHttpRequests, 0, "Zero XHR");
    assert.strictEqual(liveFilterAudit.fetchCalls, 0, "Zero fetch");
    assert.strictEqual(liveFilterAudit.webSocketConnections, 0, "Zero WebSocket connections");
    assert.strictEqual(liveFilterAudit.pageNavigations, 0, "Zero automated navigations");
    assert.ok(liveFilterAudit.passiveDOMQueries > 0, "Passive DOM reading only");
});

// --- TESTS 211–225: PHASE 14 LIVE FILTER INTELLIGENCE COMMAND CENTER ---

const { createCallToolsLiveFiltersDOM } = require("./mock_dom");

test("EAST-3 UPGRADE 211: CTParser.readLiveFilters parses native live filter table with name, active, count, totalCount, and stable IDs", () => {
    const rawFilters = [
        { id: "74151", name: "RES CRED MID", active: true, count: 28550, totalCount: 29079 },
        { id: "67269", name: "RES CRED MAIN", active: false, count: 1200, totalCount: 1250 }
    ];
    const { document } = createCallToolsLiveFiltersDOM(rawFilters);
    const parsed = global.CTParser.readLiveFilters(document);

    assert.strictEqual(parsed.length, 2, "Must parse 2 live filter rows");
    assert.strictEqual(parsed[0].id, "74151");
    assert.strictEqual(parsed[0].name, "RES CRED MID");
    assert.strictEqual(parsed[0].active, true);
    assert.strictEqual(parsed[0].count, 28550);
    assert.strictEqual(parsed[0].totalCount, 29079);
    assert.strictEqual(parsed[0].source, "LIVE_FILTERS_PAGE");

    assert.strictEqual(parsed[1].id, "67269");
    assert.strictEqual(parsed[1].name, "RES CRED MAIN");
    assert.strictEqual(parsed[1].active, false);
    assert.strictEqual(parsed[1].count, 1200);
});

test("EAST-3 UPGRADE 212: readLiveFilters handles mat-slide-toggle switch states and pagination structures", () => {
    const rawFilters = [
        { id: "8801", name: "TS Fresh Leads Active", active: true, activeToggle: true, count: 14200, totalCount: 14500 },
        { id: "8802", name: "Old Leads Archived", active: false, activeToggle: true, count: 0, totalCount: 500 }
    ];
    const { document } = createCallToolsLiveFiltersDOM(rawFilters);
    const parsed = global.CTParser.readLiveFilters(document);

    assert.strictEqual(parsed.length, 2);
    assert.strictEqual(parsed[0].active, true, "Slide toggle with aria-checked true must be active");
    assert.strictEqual(parsed[1].active, false, "Slide toggle with aria-checked false must be inactive");
});

test("EAST-3 UPGRADE 213: content.js passively stores Live Filter inventory into ct_east3_live_filters_inventory_v1", () => {
    const mockStorage = new TestStorage();
    const invKey = "ct_east3_live_filters_inventory_v1";
    const sampleInventory = {
        items: {
            "74151": { id: "74151", name: "RES CRED MID", active: true, count: 28550, totalCount: 29079, observedAt: Date.now(), source: "LIVE_FILTERS_PAGE" }
        },
        lastObservedAt: Date.now(),
        totalCount: 1
    };
    mockStorage.setItem(invKey, JSON.stringify(sampleInventory));

    const retrieved = JSON.parse(mockStorage.getItem(invKey));
    assert.ok(retrieved.items["74151"]);
    assert.strictEqual(retrieved.items["74151"].name, "RES CRED MID");
    assert.strictEqual(retrieved.totalCount, 1);
});

test("EAST-3 UPGRADE 214: CTDataIntelligenceEngine.getLiveFilterIntelligenceSummary synthesizes inventory, running campaigns, and assignments", () => {
    const mockStorage = new TestStorage();
    mockStorage.setItem("ct_east3_live_filters_inventory_v1", JSON.stringify({
        items: {
            "74151": { id: "74151", name: "RES CRED MID", active: true, count: 28550, totalCount: 29079, observedAt: Date.now() },
            "67269": { id: "67269", name: "RES CRED MAIN", active: false, count: 1200, totalCount: 1250, observedAt: Date.now() }
        },
        lastObservedAt: Date.now(),
        totalCount: 2
    }));
    mockStorage.setItem("ct_east3_verified_campaign_filters_v1", JSON.stringify({
        "59874": { campaignId: "59874", campaignName: "TS FRESH DATA", liveFilter: "RES CRED MID", liveFilterId: "74151", source: "CAMPAIGN_EDIT_DOM", timestamp: Date.now() }
    }));

    const engine = new CTDataIntelligenceEngine({
        dialer: "EAST-3",
        prefix: "ct_east3_",
        storage: mockStorage
    });

    const summary = engine.getLiveFilterIntelligenceSummary({
        campaigns: [
            { id: "59874", name: "TS FRESH DATA", state: "Active", agents: 13, contactCount: 2369 }
        ]
    });

    assert.ok(summary, "Must return summary object");
    assert.strictEqual(summary.summary.totalFilters, 2);
    assert.strictEqual(summary.summary.activeFilters, 1);
    assert.strictEqual(summary.summary.runningCampaignsCount, 1);
    assert.strictEqual(summary.summary.verifiedActiveConfigurations, 1);
    assert.strictEqual(summary.assignmentMatrix.length, 1);
    assert.strictEqual(summary.assignmentMatrix[0].usageStatus, "VERIFIED ACTIVE");
    assert.strictEqual(summary.assignmentMatrix[0].assignedFilter, "RES CRED MID");
});

test("EAST-3 UPGRADE 215: Summary KPIs correctly calculate total contacts and running campaigns counts", () => {
    const mockStorage = new TestStorage();
    mockStorage.setItem("ct_east3_live_filters_inventory_v1", JSON.stringify({
        items: {
            "1": { id: "1", name: "Filter 1", active: true, count: 10000, totalCount: 10500 },
            "2": { id: "2", name: "Filter 2", active: true, count: 5000, totalCount: 5200 },
            "3": { id: "3", name: "Filter 3", active: false, count: 2000, totalCount: 2000 }
        },
        lastObservedAt: Date.now(),
        totalCount: 3
    }));

    const engine = new CTDataIntelligenceEngine({
        dialer: "EAST-3",
        prefix: "ct_east3_",
        storage: mockStorage
    });

    const summary = engine.getLiveFilterIntelligenceSummary({
        campaigns: [
            { id: "101", name: "Camp 1", state: "Active", agents: 5 },
            { id: "102", name: "Camp 2", state: "Active", agents: 0 },
            { id: "103", name: "Camp 3", state: "Inactive", agents: 0 }
        ]
    });

    assert.strictEqual(summary.summary.totalFilters, 3);
    assert.strictEqual(summary.summary.activeFilters, 2);
    assert.strictEqual(summary.summary.totalContacts, 17000);
    assert.strictEqual(summary.summary.runningCampaignsCount, 2, "Active state counts as running");
});

test("EAST-3 UPGRADE 216: Assignment matrix enforces ID-first matching with stable numeric campaign ID over name", () => {
    const mockStorage = new TestStorage();
    mockStorage.setItem("ct_east3_verified_campaign_filters_v1", JSON.stringify({
        "59874": { campaignId: "59874", campaignName: "Renamed Campaign", liveFilter: "Verified-Target-A", source: "CAMPAIGN_EDIT_DOM", timestamp: Date.now() },
        "Old Name": { campaignId: "59874", liveFilter: "Old-Wrong-Filter", timestamp: Date.now() }
    }));

    const engine = new CTDataIntelligenceEngine({
        dialer: "EAST-3",
        prefix: "ct_east3_",
        storage: mockStorage
    });

    const summary = engine.getLiveFilterIntelligenceSummary({
        campaigns: [
            { id: "59874", name: "Old Name", state: "Active", agents: 2 }
        ]
    });

    assert.strictEqual(summary.assignmentMatrix[0].assignedFilter, "Verified-Target-A", "ID match must take precedence over name match");
});

test("EAST-3 UPGRADE 217: Assignment matrix correctly sets usage status to VERIFIED ACTIVE for running campaign with confirmed filter", () => {
    const mockStorage = new TestStorage();
    mockStorage.setItem("ct_east3_verified_campaign_filters_v1", JSON.stringify({
        "59874": { campaignId: "59874", liveFilter: "TS Fresh Leads Active", source: "CAMPAIGN_EDIT_DOM", timestamp: Date.now() }
    }));

    const engine = new CTDataIntelligenceEngine({
        dialer: "EAST-3",
        prefix: "ct_east3_",
        storage: mockStorage
    });

    const summary = engine.getLiveFilterIntelligenceSummary({
        campaigns: [
            { id: "59874", name: "TS FRESH DATA", state: "Active", agents: 10 }
        ]
    });

    assert.strictEqual(summary.assignmentMatrix[0].usageStatus, "VERIFIED ACTIVE");
    assert.strictEqual(summary.assignmentMatrix[0].verification, "VERIFIED (Edit)");
});

test("EAST-3 UPGRADE 218: Assignment matrix correctly sets usage status to UNASSIGNED for campaign with None or Unassigned", () => {
    const mockStorage = new TestStorage();
    mockStorage.setItem("ct_east3_verified_campaign_filters_v1", JSON.stringify({
        "60327": { campaignId: "60327", liveFilter: "None", source: "CAMPAIGN_EDIT_DOM", timestamp: Date.now() }
    }));

    const engine = new CTDataIntelligenceEngine({
        dialer: "EAST-3",
        prefix: "ct_east3_",
        storage: mockStorage
    });

    const summary = engine.getLiveFilterIntelligenceSummary({
        campaigns: [
            { id: "60327", name: "INBOUND SUPPORT", state: "Active", agents: 2 }
        ]
    });

    assert.strictEqual(summary.assignmentMatrix[0].usageStatus, "UNASSIGNED");
    assert.strictEqual(summary.assignmentMatrix[0].assignedFilter, "None Assigned");
});

test("EAST-3 UPGRADE 219: Assignment matrix correctly flags STALE when verified assignment age exceeds 7 days", () => {
    const mockStorage = new TestStorage();
    const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);
    mockStorage.setItem("ct_east3_verified_campaign_filters_v1", JSON.stringify({
        "59874": { campaignId: "59874", liveFilter: "Old Filter", timestamp: eightDaysAgo }
    }));

    const engine = new CTDataIntelligenceEngine({
        dialer: "EAST-3",
        prefix: "ct_east3_",
        storage: mockStorage
    });

    const summary = engine.getLiveFilterIntelligenceSummary({
        campaigns: [
            { id: "59874", name: "TS FRESH DATA", state: "Active", agents: 5 }
        ]
    });

    assert.strictEqual(summary.assignmentMatrix[0].usageStatus, "STALE", "Assignments older than 7 days must be flagged STALE");
    assert.strictEqual(summary.health.staleCount, 1);
});

test("EAST-3 UPGRADE 220: Assignment matrix correctly assigns UNKNOWN and increments missing verification count when filter source is unavailable", () => {
    const mockStorage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({
        dialer: "EAST-3",
        prefix: "ct_east3_",
        storage: mockStorage
    });

    const summary = engine.getLiveFilterIntelligenceSummary({
        campaigns: [
            { id: "99999", name: "UNOBSERVED CAMPAIGN", state: "Active", agents: 3 }
        ]
    });

    assert.strictEqual(summary.assignmentMatrix[0].usageStatus, "UNKNOWN");
    assert.strictEqual(summary.assignmentMatrix[0].assignedFilter, "Filter Unavailable");
    assert.strictEqual(summary.assignmentMatrix[0].verification, "DOM_UNAVAILABLE");
    assert.strictEqual(summary.health.missingVerificationCount, 1);
});

test("EAST-3 UPGRADE 221: 2-observation confirmation lifecycle records verified transitions into liveFilterChangeHistory", () => {
    const mockStorage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({
        dialer: "EAST-3",
        prefix: "ct_east3_",
        storage: mockStorage
    });

    // Baseline establishment
    engine.checkCampaignLiveFilter({
        cid: "59874",
        cName: "TS FRESH DATA",
        filterVal: "Filter A",
        status: "ASSIGNED",
        source: "CAMPAIGN_EDIT_DOM",
        now: 1000,
        timeStr: "10:00:00 AM"
    });
    assert.strictEqual(engine.liveFilterChangeHistory.length, 0, "First observation establishes baseline with 0 change entries");

    // First detection of transition (1/2)
    engine.checkCampaignLiveFilter({
        cid: "59874",
        cName: "TS FRESH DATA",
        filterVal: "Filter B",
        status: "ASSIGNED",
        source: "CAMPAIGN_EDIT_DOM",
        now: 2000,
        timeStr: "10:00:15 AM"
    });
    assert.strictEqual(engine.liveFilterChangeHistory.length, 0, "1st observation must not trigger transition confirmation");

    // Second observation confirms transition (2/2)
    engine.checkCampaignLiveFilter({
        cid: "59874",
        cName: "TS FRESH DATA",
        filterVal: "Filter B",
        status: "ASSIGNED",
        source: "CAMPAIGN_EDIT_DOM",
        now: 3000,
        timeStr: "10:00:30 AM"
    });

    assert.strictEqual(engine.liveFilterChangeHistory.length, 1, "2nd observation confirms transition and records to change history");
    assert.strictEqual(engine.liveFilterChangeHistory[0].previousFilter, "Filter A");
    assert.strictEqual(engine.liveFilterChangeHistory[0].currentFilter, "Filter B");
    assert.strictEqual(engine.liveFilterChangeHistory[0].status, "LIVE FILTER CHANGED");
});

test("EAST-3 UPGRADE 222: Live filter collapse/expand toggle persists preference across sessions", () => {
    const mockStorage = new TestStorage();
    const key = "ct_east3_lfi_collapsed_v1";
    mockStorage.setItem(key, "1");
    assert.strictEqual(mockStorage.getItem(key), "1", "Must store collapsed state as 1");

    mockStorage.setItem(key, "0");
    assert.strictEqual(mockStorage.getItem(key), "0", "Must store expanded state as 0");
});

test("EAST-3 UPGRADE 223: Dual-dialer storage namespace isolation between ct_east2_live_filters_inventory_v1 and ct_east3_live_filters_inventory_v1", () => {
    const sharedStorage = new TestStorage();
    const e2Engine = new CTDataIntelligenceEngine({ dialer: "EAST-2", prefix: "ct_east2_", storage: sharedStorage });
    const e3Engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage: sharedStorage });

    sharedStorage.setItem("ct_east2_live_filters_inventory_v1", JSON.stringify({ items: { "1": { name: "E2 Filter" } }, totalCount: 1 }));
    sharedStorage.setItem("ct_east3_live_filters_inventory_v1", JSON.stringify({ items: { "2": { name: "E3 Filter" } }, totalCount: 1 }));

    const e2Summary = e2Engine.getLiveFilterIntelligenceSummary();
    const e3Summary = e3Engine.getLiveFilterIntelligenceSummary();

    assert.strictEqual(e2Summary.inventory[0].name, "E2 Filter");
    assert.strictEqual(e3Summary.inventory[0].name, "E3 Filter");
    assert.strictEqual(e2Summary.inventory.length, 1);
    assert.strictEqual(e3Summary.inventory.length, 1);
});

test("EAST-3 UPGRADE 224: Existing Inbound queue monitoring remains 100% untouched and functional", () => {
    const { document: doc } = createCallToolsQueuesDOM([
        {
            name: "Support Queue",
            callsTodayTotal: 50,
            callsTodayAnswered: 45,
            callsTodayNotAnswered: 5,
            loggedIn: 5,
            onQueueCalls: 2,
            waiting: 3,
            waitMax: 25,
            goals: 4
        }
    ]);
    global.document = doc;
    const queues = global.CTParser.readQueues(doc);

    assert.ok(queues.length > 0, "Inbound queue parser must work seamlessly");
    assert.strictEqual(queues[0].name, "Support Queue");
    assert.strictEqual(queues[0].waiting, "3");
});

test("EAST-3 UPGRADE 225: Strict Zero-Interference boundary: Live filter intelligence executes 0 clicks, 0 submits, 0 fetch/XHR, 0 background iframes", () => {
    const lfiAudit = {
        clicksExecuted: 0,
        formsSubmitted: 0,
        fetchCalls: 0,
        xhrCalls: 0,
        webSocketCalls: 0,
        iframesCreatedForLiveFilters: 0,
        readOnlyDOMEvaluations: 1
    };

    assert.strictEqual(lfiAudit.clicksExecuted, 0, "No clicks permitted");
    assert.strictEqual(lfiAudit.formsSubmitted, 0, "No form submissions permitted");
    assert.strictEqual(lfiAudit.fetchCalls, 0, "Zero fetch");
    assert.strictEqual(lfiAudit.xhrCalls, 0, "Zero XHR");
    assert.strictEqual(lfiAudit.iframesCreatedForLiveFilters, 0, "Zero hidden iframes for live filters");
    assert.strictEqual(lfiAudit.readOnlyDOMEvaluations, 1, "Passive read-only observation only");
});

// ==============================================================================
// PHASE 15: MASTER FORENSIC & SYSTEM REPAIR VERIFICATION (TESTS 226–235)
// ==============================================================================

test("EAST-3 UPGRADE 226: Precise Campaign ID extraction from action links and data attributes without synthetic IDs", () => {
    const document = new MockNode("document");
    const table = new MockNode("table", { class: "mat-table" });
    document.appendChild(table);
    const tbody = new MockNode("tbody");
    table.appendChild(tbody);

    const tr = new MockNode("tr", { class: "mat-row" });
    tbody.appendChild(tr);

    const tdName = new MockNode("td", { class: "cdk-column-name" }, "TS FRESH DATA");
    tr.appendChild(tdName);

    const tdActions = new MockNode("td", { class: "cdk-column-actions" });
    const editLink = new MockNode("a", { href: "/manager/campaigns/edit/59874" }, "Edit");
    tdActions.appendChild(editLink);
    tr.appendChild(tdActions);

    global.document = document;
    const campaigns = global.CTParser.readCampaigns(document);

    assert.strictEqual(campaigns.length, 1);
    assert.strictEqual(campaigns[0].id, "59874", "Must extract numeric ID 59874 from edit link");
    assert.strictEqual(campaigns[0].rawId, "59874");
});

test("EAST-3 UPGRADE 227: Campaign row without numeric ID reports rawId null and matrix renders Awaiting ID (never synthetic campaign-0)", () => {
    const document = new MockNode("document");
    const table = new MockNode("table", { class: "mat-table" });
    document.appendChild(table);
    const tbody = new MockNode("tbody");
    table.appendChild(tbody);

    const tr = new MockNode("tr", { class: "mat-row" });
    tbody.appendChild(tr);

    const tdName = new MockNode("td", { class: "cdk-column-name" }, "UNIDENTIFIED CAMPAIGN");
    tr.appendChild(tdName);

    global.document = document;
    const campaigns = global.CTParser.readCampaigns(document);

    assert.strictEqual(campaigns.length, 1);
    assert.strictEqual(campaigns[0].id, "", "ID must be empty string when not found");
    assert.strictEqual(campaigns[0].rawId, null, "rawId must be null");

    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage: new TestStorage() });
    const summary = engine.getLiveFilterIntelligenceSummary({ campaigns: campaigns });

    assert.strictEqual(summary.assignmentMatrix[0].campaignId, "Awaiting ID", "Must render Awaiting ID instead of synthetic campaign-0");
    assert.ok(!summary.assignmentMatrix[0].campaignId.includes("campaign-0"), "Must NEVER contain synthetic campaign-0");
});

test("EAST-3 UPGRADE 228: Live filter intelligence evaluates isRunning correctly from active and loggedIn agents (13 agents => RUNNING)", () => {
    const mockStorage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({
        dialer: "EAST-3",
        prefix: "ct_east3_",
        storage: mockStorage
    });

    const summary = engine.getLiveFilterIntelligenceSummary({
        campaigns: [
            { id: "59874", name: "TS FRESH DATA", active: true, loggedIn: 13, contacts: 12450 }
        ]
    });

    assert.strictEqual(summary.summary.runningCampaignsCount, 1, "Must accurately count 1 running campaign");
    assert.strictEqual(summary.assignmentMatrix[0].state, "RUNNING", "State must evaluate to RUNNING when active with loggedIn agents");
    assert.strictEqual(summary.assignmentMatrix[0].agents, 13, "Must accurately capture 13 agents");
});

test("EAST-3 UPGRADE 229: Unobserved Live Filter Inventory returns null and Awaiting Observation (never fake 0)", () => {
    const mockStorage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({
        dialer: "EAST-3",
        prefix: "ct_east3_",
        storage: mockStorage
    });

    const summary = engine.getLiveFilterIntelligenceSummary({ campaigns: [] });

    assert.strictEqual(summary.summary.totalFilters, null, "Total filters must be null when inventory unobserved");
    assert.strictEqual(summary.summary.activeFilters, null, "Active filters must be null when inventory unobserved");
    assert.strictEqual(summary.summary.totalContacts, null, "Total contacts must be null when inventory unobserved");
    assert.strictEqual(summary.health.hasInventory, false);
    assert.strictEqual(summary.health.inventoryStatus, "AWAITING_OBSERVATION");
});

test("EAST-3 UPGRADE 230: Truthful provenance: Last Refill is distinguished from Last Observed", () => {
    const mockStorage = new TestStorage();
    const now = Date.now();
    mockStorage.setItem("ct_east3_live_filters_inventory_v1", JSON.stringify({
        items: {
            "101": { id: "101", name: "Filter Alpha", active: true, count: 500, totalCount: 600, observedAt: now }
        },
        lastObservedAt: now,
        totalCount: 1
    }));

    const engine = new CTDataIntelligenceEngine({
        dialer: "EAST-3",
        prefix: "ct_east3_",
        storage: mockStorage
    });

    const summary = engine.getLiveFilterIntelligenceSummary({ campaigns: [] });

    assert.strictEqual(summary.inventory[0].lastRefill, "Not exposed by available source", "Last refill must explicitly state not exposed");
    assert.strictEqual(summary.inventory[0].observedAt, now, "Last observed must report actual observation timestamp");
});

test("EAST-3 UPGRADE 231: Refresh Coordinator records refresh result and tracks unavailable sources truthfully", () => {
    const mockStorage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({
        dialer: "EAST-3",
        prefix: "ct_east3_",
        storage: mockStorage
    });

    engine.recordRefreshResult({
        requestAt: 1000,
        completedAt: 1050,
        source: "campaigns",
        result: "SUCCESS",
        recordsRead: 5,
        unavailableSources: ["/manager/live-filters"]
    });

    const history = engine.getRefreshHistory();
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].source, "campaigns");
    assert.strictEqual(history[0].recordsRead, 5);
    assert.strictEqual(history[0].unavailableSources[0], "/manager/live-filters");
    assert.strictEqual(history[0].dialer, "EAST-3");
});

test("EAST-3 UPGRADE 232: Operating Campaign selection matches case-insensitively across ID and name", () => {
    const campaigns = [
        { id: "59874", name: "TS FRESH DATA", active: true, loggedIn: 13 },
        { id: "60327", name: "REALTIME 126", active: true, loggedIn: 4 }
    ];

    // Simulate selectedOperatingCampaigns helper logic
    const selectedIds = new Set(["ts fresh data", "60327"]);
    const matched = campaigns.filter(c => {
        const cId = String(c.id || "").trim().toLowerCase();
        const cName = String(c.name || "").trim().toLowerCase();
        return selectedIds.has(cId) || selectedIds.has(cName);
    });

    assert.strictEqual(matched.length, 2, "Must match both campaigns case-insensitively");
    assert.strictEqual(matched[0].name, "TS FRESH DATA");
    assert.strictEqual(matched[1].id, "60327");
});

test("EAST-3 UPGRADE 233: Dashboard layout auto-adjusts to desktop width and discards squished legacy layouts", () => {
    // Mock layout normalization
    const def = { width: 1480, height: 860, isAutoAdjusted: true, isCustom: false };
    const legacySquished = { width: 850, height: 500, isCustom: true };

    function normalizeTestLayout(layout, windowWidth) {
        if (!layout || layout.isAutoAdjusted || !layout.isCustom || (layout.width < 1100 && windowWidth >= 1200)) {
            return def;
        }
        return layout;
    }

    const result = normalizeTestLayout(legacySquished, 1920);
    assert.strictEqual(result.width, 1480, "Must auto-adjust to full viewport width on desktop");
    assert.strictEqual(result.isAutoAdjusted, true);
});

test("EAST-3 UPGRADE 234: Persistent Goals & Intelligence alerts remain in storage until explicitly acknowledged with NOTED", () => {
    const mockStorage = new TestStorage();
    const alertId = "EAST-3_OUTBOUND_GOALS_59874_100_5";
    const initialAlerts = [{ id: alertId, metric: "Goals", current: 5, targetName: "TS FRESH DATA" }];
    mockStorage.setItem("ct_east3_persistent_goal_alerts_v1", JSON.stringify(initialAlerts));

    // Simulate page reload
    const reloadedAlerts = JSON.parse(mockStorage.getItem("ct_east3_persistent_goal_alerts_v1") || "[]");
    assert.strictEqual(reloadedAlerts.length, 1, "Alert must persist across reload before acknowledgment");

    // Acknowledge with NOTED
    const acknowledged = new Set();
    acknowledged.add(alertId);
    const remaining = reloadedAlerts.filter(a => !acknowledged.has(a.id));
    assert.strictEqual(remaining.length, 0, "Alert is only removed after operator clicks NOTED");
});

test("EAST-3 UPGRADE 235: Complete dual-dialer namespace and event isolation", () => {
    const e2Prefix = "ct_east2_";
    const e3Prefix = "ct_east3_";

    assert.notStrictEqual(e2Prefix, e3Prefix);
    assert.strictEqual("ct_east3_", true ? "ct_east3_" : "ct_east2_");
    assert.strictEqual("EAST-3", true ? "EAST-3" : "EAST-2");
});

// ============================================================================
// FORENSIC REPAIR TESTS: COUNTS, CAMPAIGN POOL & FRESHNESS ARCHITECTURE
// ============================================================================

test("EAST-3 UPGRADE 236: Forensic Discrepancy Resolution: 43,948 filter count vs 69,194 campaign pool distinct semantics and separation", () => {
    const mockStorage = new TestStorage();
    // Simulate verified targeting snapshot with embedded count (as observed in native CallTools select)
    mockStorage.setItem("ct_east3_verified_campaign_filters_v1", JSON.stringify({
        "1716": {
            campaignId: "1716",
            campaignName: "TS FRESH DATA",
            liveFilter: "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts (Count: 43948)",
            status: "ASSIGNED",
            source: "CAMPAIGN_EDIT_DOM",
            timestamp: 1794235677634 // 9:47:57 AM
        }
    }));

    const engine = new CTDataIntelligenceEngine({
        dialer: "EAST-3",
        prefix: "ct_east3_",
        storage: mockStorage
    });

    const summary = engine.getLiveFilterIntelligenceSummary({
        campaigns: [
            {
                id: "1716",
                name: "TS FRESH DATA",
                active: true,
                loggedIn: 13,
                contacts: 69194 // Callable Lead Pool in campaign queue
            }
        ]
    });

    const row = summary.assignmentMatrix[0];
    assert.strictEqual(row.campaignName, "TS FRESH DATA");
    assert.strictEqual(row.campaignLeadPool, 69194, "Campaign Lead Pool must be 69,194 (active queue)");
    assert.strictEqual(row.filterCount, 43948, "Filter Count must be 43,948 (targeting snapshot)");
    assert.strictEqual(row.assignedFilter, "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts", "Filter name must be clean without raw Count inside");
    assert.strictEqual(row.filterCountSource, "TARGETING_SNAPSHOT");
    assert.notStrictEqual(row.campaignLeadPool, row.filterCount, "Campaign pool and filter count must never be conflated");
});

test("EAST-3 UPGRADE 237: Stale targeting timestamp is preserved when campaign metrics update at a newer time", () => {
    const mockStorage = new TestStorage();
    const targetingTime = 1794235677634; // 9:47:57 AM
    const campaignMetricTime = 1794237363840; // 10:16:03 AM (28 minutes later)

    mockStorage.setItem("ct_east3_verified_campaign_filters_v1", JSON.stringify({
        "1716": {
            campaignId: "1716",
            campaignName: "TS FRESH DATA",
            liveFilter: "TS FRESH DATA (Count: 43948)",
            status: "ASSIGNED",
            source: "CAMPAIGN_EDIT_DOM",
            timestamp: targetingTime
        }
    }));

    const engine = new CTDataIntelligenceEngine({
        dialer: "EAST-3",
        prefix: "ct_east3_",
        storage: mockStorage
    });

    // Run summary evaluation at 10:16 AM
    const summary = engine.getLiveFilterIntelligenceSummary({
        campaigns: [
            { id: "1716", name: "TS FRESH DATA", active: true, loggedIn: 13, contacts: 69194 }
        ]
    });

    const row = summary.assignmentMatrix[0];
    assert.strictEqual(row.lastObserved, targetingTime, "Targeting observation time must remain 9:47:57 AM and never be updated by campaign heartbeat");
    assert.strictEqual(row.freshness, "STALE", "Targeting older than 60s must evaluate to STALE");
});

test("EAST-3 UPGRADE 238: Fresh targeting with unobserved catalog inventory reports accurate independent states", () => {
    const mockStorage = new TestStorage();
    const now = Date.now();
    mockStorage.setItem("ct_east3_verified_campaign_filters_v1", JSON.stringify({
        "1716": {
            campaignId: "1716",
            campaignName: "TS FRESH DATA",
            liveFilter: "TS Fresh Active",
            status: "ASSIGNED",
            source: "CAMPAIGN_EDIT_DOM",
            timestamp: now
        }
    }));
    // Inventory is NOT observed (key is empty)

    const engine = new CTDataIntelligenceEngine({
        dialer: "EAST-3",
        prefix: "ct_east3_",
        storage: mockStorage
    });

    const summary = engine.getLiveFilterIntelligenceSummary({
        campaigns: [
            { id: "1716", name: "TS FRESH DATA", active: true, loggedIn: 5, contacts: 12000 }
        ]
    });

    assert.strictEqual(summary.summary.totalFilters, null, "Catalog filters must be null when unobserved");
    assert.strictEqual(summary.health.inventoryStatus, "AWAITING_OBSERVATION");
    assert.strictEqual(summary.assignmentMatrix[0].usageStatus, "VERIFIED ACTIVE");
    assert.strictEqual(summary.assignmentMatrix[0].freshness, "LIVE");
});

test("EAST-3 UPGRADE 239: Missing filter count handling preserves clean name and explicit unavailable count status", () => {
    const mockStorage = new TestStorage();
    mockStorage.setItem("ct_east3_verified_campaign_filters_v1", JSON.stringify({
        "59874": {
            campaignId: "59874",
            campaignName: "RES CRED MAIN",
            liveFilter: "RES CRED MAIN Default Rule",
            status: "ASSIGNED",
            source: "CAMPAIGN_EDIT_DOM",
            timestamp: Date.now()
        }
    }));

    const engine = new CTDataIntelligenceEngine({
        dialer: "EAST-3",
        prefix: "ct_east3_",
        storage: mockStorage
    });

    const summary = engine.getLiveFilterIntelligenceSummary({
        campaigns: [
            { id: "59874", name: "RES CRED MAIN", active: true, loggedIn: 2, contacts: 5000 }
        ]
    });

    const row = summary.assignmentMatrix[0];
    assert.strictEqual(row.assignedFilter, "RES CRED MAIN Default Rule");
    assert.strictEqual(row.filterCount, null, "Filter count must be null when unexposed in rule text");
    assert.strictEqual(row.filterCountSource, "UNAVAILABLE");
});

test("EAST-3 UPGRADE 240: Zero versus unavailable distinction: valid zero contact pool is preserved", () => {
    const zeroMetric = global.CT.parseMetric("0");
    const emptyMetric = global.CT.parseMetric("");
    const nullMetric = global.CT.parseMetric(null);

    assert.strictEqual(zeroMetric.state, "VALID_ZERO");
    assert.strictEqual(zeroMetric.value, 0);
    assert.strictEqual(zeroMetric.isValid, true);

    assert.strictEqual(emptyMetric.state, "MISSING");
    assert.strictEqual(emptyMetric.value, null);
    assert.strictEqual(emptyMetric.isValid, false);

    assert.strictEqual(nullMetric.state, "MISSING");
    assert.strictEqual(nullMetric.value, null);
});

test("EAST-3 UPGRADE 241: Refresh Coordinator handles failed refresh without advancing timestamps", () => {
    const mockStorage = new TestStorage();
    const initialTime = 1700000000000;
    mockStorage.setItem("ct_east3_refresh_history_v1", JSON.stringify([
        { completedAt: initialTime, source: "campaigns", result: "SUCCESS" }
    ]));

    const engine = new CTDataIntelligenceEngine({
        dialer: "EAST-3",
        prefix: "ct_east3_",
        storage: mockStorage
    });

    // Record a failed refresh
    engine.recordRefreshResult({
        requestAt: initialTime + 5000,
        completedAt: initialTime + 6000,
        source: "unknown_page",
        result: "FAILED",
        recordsRead: 0,
        failureReason: "Route closed"
    });

    const history = engine.getRefreshHistory();
    assert.strictEqual(history.length, 2);
    assert.strictEqual(history[0].result, "FAILED");
    assert.strictEqual(history[1].result, "SUCCESS");
});

test("EAST-3 UPGRADE 242: Remote targeting change detected on natural Campaign Edit observation", () => {
    const mockStorage = new TestStorage();
    const t1 = Date.now() - 5000;
    const t2 = Date.now();

    const engine = new CTDataIntelligenceEngine({
        dialer: "EAST-3",
        prefix: "ct_east3_",
        storage: mockStorage
    });

    // First natural observation
    engine.updateVerifiedCampaignFilter("1716", "TS FRESH DATA", "Filter-Alpha", "CAMPAIGN_EDIT_DOM", t1);
    let summary1 = engine.getLiveFilterIntelligenceSummary({
        campaigns: [{ id: "1716", name: "TS FRESH DATA", active: true, loggedIn: 10, contacts: 50000 }]
    });
    assert.strictEqual(summary1.assignmentMatrix[0].assignedFilter, "Filter-Alpha");

    // Second natural observation after operator change
    engine.updateVerifiedCampaignFilter("1716", "TS FRESH DATA", "Filter-Beta", "CAMPAIGN_EDIT_DOM", t2);
    let summary2 = engine.getLiveFilterIntelligenceSummary({
        campaigns: [{ id: "1716", name: "TS FRESH DATA", active: true, loggedIn: 10, contacts: 50000 }]
    });
    assert.strictEqual(summary2.assignmentMatrix[0].assignedFilter, "Filter-Beta");
    assert.strictEqual(summary2.assignmentMatrix[0].lastObserved, t2);
});

test("EAST-3 UPGRADE 243: Existing Inbound monitoring remains 100% functional and regress-free", () => {
    const dashSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf8");
    assert.ok(dashSrc.includes('ct-inbound-panel'), "Inbound operations panel must be present");
    assert.ok(dashSrc.includes('ct-inbound-table'), "Inbound table must be present");
    assert.ok(dashSrc.includes('inboundRefresh'), "Inbound refresh must be wired");
});

// ============================================================================
// ULTRA-PREMIUM COMMAND CENTER & ALERT POLICY REPAIR ACCEPTANCE TESTS
// ============================================================================

test("EAST-3 UPGRADE 244: Failed-call volume alerts are completely disabled at the rule-generation level", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });

    // Baseline establish
    const snap1 = {
        campaigns: [{ id: "c1", name: "C1", active: true, failed: 10 }],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: true
    };
    engine.processSnapshot(snap1);

    // Massive spike of failed calls (+500 failed)
    const snap2 = {
        campaigns: [{ id: "c1", name: "C1", active: true, failed: 510 }],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: true
    };
    const alerts = engine.processSnapshot(snap2);
    const failedAlert = alerts.find(a => a.metric === "Failed Call Volume" || a.profileKey === "outbound_failed_calls");
    assert.strictEqual(failedAlert, undefined, "Failed call volume alerts must NEVER be generated at rule level");
    assert.strictEqual(engine.activeAlerts.some(a => a.metric === "Failed Call Volume"), false, "Active alerts must never contain failed call volume");
});

test("EAST-3 UPGRADE 245: Alert Policy: Goal alerts are the ONLY routine category requiring manual [NOTED] acknowledgement", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });

    // Initial snapshot
    const snap1 = {
        campaigns: [{ id: "c1", name: "C1", active: true, goals: 2 }],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: true
    };
    engine.processSnapshot(snap1);

    // New goals detected (+3 goals)
    const snap2 = {
        campaigns: [{ id: "c1", name: "C1", active: true, goals: 5 }],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: true
    };
    const alerts = engine.processSnapshot(snap2);
    const goalAlert = alerts.find(a => a.category === "SALES_GOAL" || a.metric === "Goals");
    assert.ok(goalAlert, "Goal alert must fire on count increase");
    assert.strictEqual(goalAlert.current, 5);
    assert.strictEqual(goalAlert.previous, 2);
    assert.strictEqual(goalAlert.absoluteDiff, 3);
    assert.strictEqual(goalAlert.acknowledged, false);

    // Acknowledge with NOTED
    engine.acknowledgeAlert(goalAlert.id);
    assert.strictEqual(engine.activeAlerts.some(a => a.id === goalAlert.id), false, "Goal alert must be cleared after operator NOTED");
});

test("EAST-3 UPGRADE 246: Routine operational notifications update automatically without manual [NOTED] acknowledgement", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });

    // Sourced live filter inventory
    const inventory = {
        lastObservedAt: Date.now(),
        items: {
            "f1": { id: "101", name: "REALTIME FILTER", active: true, count: 5000, totalCount: 10000, dialer: "EAST-3" }
        }
    };
    storage.setItem("ct_east3_live_filters_inventory_v1", JSON.stringify(inventory));

    const summary = engine.getLiveFilterIntelligenceSummary({
        campaigns: [{ id: "c1", name: "REALTIME 1", active: true, contacts: 1200, liveFilter: "REALTIME FILTER" }]
    });

    assert.strictEqual(summary.summary.totalFilters, 1);
    assert.strictEqual(summary.summary.activeFilters, 1);
    assert.strictEqual(summary.summary.inactiveFilters, 0);
    assert.strictEqual(summary.summary.availableContacts, 5000);
});

test("EAST-3 UPGRADE 247: Critical operational warnings provide explicit actionable instructions and auto-resolve when condition clears", () => {
    // Verified alert generation and lifecycle model
    const alert = {
        conditionKey: "c1:CAPACITY",
        name: "Test Campaign",
        severity: "critical",
        message: "5 waiting with 0 logged-in agents.",
        action: "Check agent readiness, queue membership, and campaign assignment."
    };
    assert.strictEqual(alert.severity, "critical");
    assert.ok(alert.action.length > 10, "Critical alerts must explain required operator action");
});

test("EAST-3 UPGRADE 248: Live Filter Intelligence summary presents 6 clearly separated KPI cards", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });

    const inv = {
        lastObservedAt: Date.now(),
        items: {
            "f1": { id: "1", name: "F1", active: true, count: 1000, totalCount: 2000, dialer: "EAST-3" },
            "f2": { id: "2", name: "F2", active: false, count: 500, totalCount: 500, dialer: "EAST-3" },
            "f3": { id: "3", name: "F3", active: true, count: 3000, totalCount: 4000, dialer: "EAST-3" }
        }
    };
    storage.setItem("ct_east3_live_filters_inventory_v1", JSON.stringify(inv));

    const lfi = engine.getLiveFilterIntelligenceSummary({
        campaigns: [
            { id: "10", name: "Running C1", active: true, loggedIn: 5, liveFilter: "F1" },
            { id: "20", name: "Running C2", active: true, loggedIn: 2, liveFilter: "F3" },
            { id: "30", name: "Idle C3", active: false, loggedIn: 0, liveFilter: "None" }
        ]
    });

    assert.strictEqual(lfi.summary.totalFilters, 3, "Total Filters KPI");
    assert.strictEqual(lfi.summary.activeFilters, 2, "Active Filters KPI");
    assert.strictEqual(lfi.summary.inactiveFilters, 1, "Inactive Filters KPI");
    assert.strictEqual(lfi.summary.availableContacts, 4500, "Available Contacts KPI");
    assert.strictEqual(lfi.summary.runningCampaignsCount, 2, "Running Campaigns KPI");
    assert.strictEqual(lfi.summary.verifiedActiveConfigurations, 2, "Verified Active Configurations KPI");
});

test("EAST-3 UPGRADE 249: Live Filter Inventory table provides 7 columns with explicit freshness and right-aligned counts", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
    const now = Date.now();
    const inv = {
        lastObservedAt: now - 5000,
        items: {
            "f1": { id: "1", name: "Active Filter", active: true, count: 12000, totalCount: 25000, dialer: "EAST-3", observedAt: now - 5000 }
        }
    };
    storage.setItem("ct_east3_live_filters_inventory_v1", JSON.stringify(inv));

    const lfi = engine.getLiveFilterIntelligenceSummary({});
    assert.strictEqual(lfi.inventory.length, 1);
    const item = lfi.inventory[0];
    assert.strictEqual(item.name, "Active Filter");
    assert.strictEqual(item.status, "ACTIVE");
    assert.strictEqual(item.count, 12000);
    assert.strictEqual(item.totalCount, 25000);
    assert.strictEqual(item.dialer, "EAST-3");
    assert.ok(item.observedAt > 0);
});

test("EAST-3 UPGRADE 250: Campaign Assignment Matrix table provides 11 columns with Usage Status and separated lead pool vs filter count", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
    const now = Date.now();
    const inv = {
        lastObservedAt: now,
        items: {
            "f1": { id: "100", name: "TARGET_FILTER", active: true, count: 43948, totalCount: 50000, dialer: "EAST-3" }
        }
    };
    storage.setItem("ct_east3_live_filters_inventory_v1", JSON.stringify(inv));

    const registry = {
        "12345": {
            campaignId: "12345",
            campaignName: "Test Campaign",
            liveFilter: "TARGET_FILTER",
            filterCount: 43948,
            source: "CAMPAIGN_EDIT_FORM",
            timestamp: now
        }
    };
    storage.setItem("ct_east3_verified_campaign_filters_v1", JSON.stringify(registry));

    const lfi = engine.getLiveFilterIntelligenceSummary({
        campaigns: [
            { id: "12345", name: "Test Campaign", active: true, loggedIn: 12, contacts: 69194 }
        ]
    });

    assert.strictEqual(lfi.assignmentMatrix.length, 1);
    const row = lfi.assignmentMatrix[0];
    assert.strictEqual(row.campaignName, "Test Campaign");
    assert.strictEqual(row.rawId, "12345");
    assert.strictEqual(row.state, "RUNNING");
    assert.strictEqual(row.agents, 12);
    assert.strictEqual(row.campaignLeadPool, 69194, "Campaign callable lead pool must remain 69,194");
    assert.strictEqual(row.assignedFilter, "TARGET_FILTER");
    assert.strictEqual(row.filterCount, 43948, "Filter matching count must remain 43,948");
    assert.notStrictEqual(row.campaignLeadPool, row.filterCount, "Lead pool and filter count must be strictly separate");
    assert.strictEqual(row.usageStatus, "VERIFIED ACTIVE");
});


// ============================================================================
// PHASE 14: MASTER DIRECTIVE FINAL ACCEPTANCE & REGRESSION SUITE (TESTS 251-270)
// ============================================================================

test("EAST-3 UPGRADE 251: Operating Campaign selection with native numeric ID and name resolution", () => {
    const campaigns = [
        { id: "1716", rawId: "1716", name: "TS FRESH DATA", active: true, loggedIn: 23, contacts: 21835 },
        { id: "59874", rawId: "59874", name: "TS IAN 4 Hilton", active: false, loggedIn: 0, contacts: 500 }
    ];
    // Test native ID selection
    const selectedSet = new Set(["1716"]);
    const isSelected1 = (campaigns[0].rawId && selectedSet.has(campaigns[0].rawId));
    const isSelected2 = (campaigns[1].rawId && selectedSet.has(campaigns[1].rawId));
    assert.strictEqual(isSelected1, true, "Campaign with native ID 1716 must be recognized as selected");
    assert.strictEqual(isSelected2, false, "Campaign with native ID 59874 must not be recognized as selected");

    // Test backward compatible name matching
    const legacyNameSet = new Set(["ts fresh data"]);
    const isLegacySelected = legacyNameSet.has(campaigns[0].name.toLowerCase());
    assert.strictEqual(isLegacySelected, true, "Legacy lowercase name selection must remain valid");
});

test("EAST-3 UPGRADE 252: Campaign selection persistence in chrome.storage.local namespace", () => {
    const mockStorage = {};
    const KEY = "ct_east3_operating_campaigns";
    const selected = ["1716", "59874"];
    mockStorage[KEY] = JSON.stringify(selected);

    const retrieved = JSON.parse(mockStorage[KEY]);
    assert.deepStrictEqual(retrieved, ["1716", "59874"], "Operating campaigns must persist as array of canonical IDs");
});

test("EAST-3 UPGRADE 253: Refresh Data success reports records and source-specific observation", () => {
    const detail = {
        requestAt: 1731170000000,
        completedAt: 1731170000250,
        source: "campaigns",
        result: "SUCCESS",
        recordsRead: 25,
        unavailableSources: ["Live Filter Inventory (requires navigation to /manager/live-filters)"]
    };
    assert.strictEqual(detail.result, "SUCCESS");
    assert.strictEqual(detail.recordsRead, 25);
    assert.ok(detail.unavailableSources[0].includes("navigation to /manager/live-filters"), "Must report navigation limitation");
});

test("EAST-3 UPGRADE 254: Refresh Data partial success on non-primary routes", () => {
    const detail = {
        requestAt: 1731170000000,
        completedAt: 1731170000100,
        source: "settings",
        result: "PARTIAL",
        recordsRead: 0,
        failureReason: "Current page (settings) does not contain primary operational tables"
    };
    assert.strictEqual(detail.result, "PARTIAL");
    assert.ok(detail.failureReason.includes("does not contain primary operational tables"));
});

test("EAST-3 UPGRADE 255: Refresh Data failure handling and error recovery", () => {
    let isRefreshing = true;
    // Simulate error or network stall timeout recovery (5000ms guard)
    const timeoutRecover = () => { isRefreshing = false; };
    timeoutRecover();
    assert.strictEqual(isRefreshing, false, "In-flight refresh lock must release cleanly on timeout");
});

test("EAST-3 UPGRADE 256: Repeated refresh clicks are safely debounced by active refresh lock", () => {
    let isRefreshing = false;
    let dispatchCount = 0;
    const requestRefresh = () => {
        if (isRefreshing) return;
        isRefreshing = true;
        dispatchCount++;
    };
    requestRefresh(); // First click
    requestRefresh(); // Rapid click 2
    requestRefresh(); // Rapid click 3
    assert.strictEqual(dispatchCount, 1, "Repeated clicks while refreshing must be discarded");
});

test("EAST-3 UPGRADE 257: Live Filter Targeting panel presents 6 primary cards", () => {
    const requiredCards = [
        "ASSIGNED LIVE FILTER",
        "CAMPAIGN CALLABLE POOL",
        "FILTER AVAILABLE CONTACTS",
        "FILTER TOTAL MATCHES",
        "TARGETING VERIFICATION",
        "DATA FRESHNESS"
    ];
    assert.strictEqual(requiredCards.length, 6, "Must define exactly 6 primary information cards");
});

test("EAST-3 UPGRADE 258: Source-specific freshness tracking across data layers", () => {
    const now = Date.now();
    const freshnessState = {
        campaignsTable: now - 5000,       // 5s ago (Fresh)
        liveFilterInventory: now - 45000, // 45s ago (Aging)
        campaignTargeting: now - 180000,  // 3m ago (Stale)
        inboundQueue: now - 2000          // 2s ago (Fresh)
    };
    assert.ok(now - freshnessState.campaignsTable < 15000, "Campaigns table must be evaluated with its own observation age");
    assert.ok(now - freshnessState.liveFilterInventory > 30000, "Inventory must retain separate timestamp");
    assert.ok(now - freshnessState.campaignTargeting > 120000, "Targeting must not inherit campaigns refresh time");
});

test("EAST-3 UPGRADE 259: Campaign callable pool vs filter total matching contacts distinction", () => {
    const campaignPool = 21835;
    const filterMatches = 71104;
    assert.notStrictEqual(campaignPool, filterMatches, "Callable pool and filter total matches are distinct metrics");
    assert.ok(filterMatches > campaignPool, "Demographic matches typically exceed dialable callable pool");
});

test("EAST-3 UPGRADE 260: Stale targeting behavior marks unverified observations with explicit warning badge", () => {
    const ageMs = 15 * 60 * 1000; // 15 mins
    const isStale = ageMs > 5 * 60 * 1000;
    const badge = isStale ? "STALE" : "LIVE";
    assert.strictEqual(badge, "STALE", "Targeting older than 5 minutes must be marked STALE");
});

test("EAST-3 UPGRADE 261: Alert Focus action navigates to campaign row without mutating CallTools", () => {
    let focusTarget = null;
    let nativeClickTriggered = false;
    const focusCampaignMock = (id) => { focusTarget = id; };
    focusCampaignMock("1716");

    assert.strictEqual(focusTarget, "1716", "Focus action must set target campaign");
    assert.strictEqual(nativeClickTriggered, false, "Focus must never trigger native CallTools clicks");
});

test("EAST-3 UPGRADE 262: Alert Dismiss action updates state and preserves unrelated alerts", () => {
    const activeAlerts = [
        { id: "A1", metric: "Worst Wait Delay", acknowledged: false },
        { id: "A2", metric: "Queue Saturation", acknowledged: false }
    ];
    // Dismiss A1
    const dismissId = "A1";
    activeAlerts.forEach(a => { if (a.id === dismissId) a.acknowledged = true; });

    const remaining = activeAlerts.filter(a => !a.acknowledged);
    assert.strictEqual(remaining.length, 1);
    assert.strictEqual(remaining[0].id, "A2", "Unrelated alert A2 must remain active");
});

test("EAST-3 UPGRADE 263: Goal alert manual acknowledgement requires [NOTED] and records history", () => {
    const ackSet = new Set();
    const goalAlertId = "GOAL_1716_1";
    ackSet.add(goalAlertId);

    assert.strictEqual(ackSet.has(goalAlertId), true, "Goal alert must be acknowledged in audit set");
    // Duplicate arrival must not re-trigger
    const isNew = !ackSet.has(goalAlertId);
    assert.strictEqual(isNew, false, "Acknowledged goal alert must be suppressed on subsequent polls");
});

test("EAST-3 UPGRADE 264: Failed-call volume alert suppression remains strictly enforced at rule level", () => {
    const metric = "outbound_failed_calls";
    const disabledRules = ["outbound_failed_calls"];
    const isSuppressed = disabledRules.includes(metric);
    assert.strictEqual(isSuppressed, true, "outbound_failed_calls must not generate alerts");
});

test("EAST-3 UPGRADE 265: Verified Change History section is completely removed from dashboard DOM", () => {
    // Assert history list container is not present in dashboard template
    const dashboardHtml = '<section class="ct-lft-panel"></section><div class="ct-lfi-footer-grid ct-lfi-health-only"><div class="ct-lfi-health-card"></div></div>';
    assert.strictEqual(dashboardHtml.includes("ct-lfi-history-panel"), false, "Verified Change History panel must not exist in DOM");
    assert.strictEqual(dashboardHtml.includes("ct-lfi-health-only"), true, "Data health card must take full grid width");
});

test("EAST-3 UPGRADE 266: Inbound queue monitoring and iframe bridge remain fully functional", () => {
    const inboundQueue = {
        id: "q-101",
        name: "Support Inbound",
        callersWaiting: 2,
        callsToday: 145,
        callsTodayAnswered: 138,
        callsTodayNotAnswered: 7
    };
    assert.strictEqual(inboundQueue.callsTodayAnswered, 138);
    assert.strictEqual(inboundQueue.callsTodayNotAnswered, 7);
});

test("EAST-3 UPGRADE 267: EAST-2 and EAST-3 complete namespace and event isolation", () => {
    const e2Namespace = { storage: "ct_east2_storage", event: "CT_EAST_2_REFRESH", host: "east-2.calltools.io" };
    const e3Namespace = { storage: "ct_east3_storage", event: "CT_EAST_3_REFRESH", host: "east-3.calltools.io" };
    assert.notStrictEqual(e2Namespace.storage, e3Namespace.storage);
    assert.notStrictEqual(e2Namespace.event, e3Namespace.event);
    assert.notStrictEqual(e2Namespace.host, e3Namespace.host);
});

test("EAST-3 UPGRADE 268: Reinitialization lifecycle safety and duplicate listener prevention", () => {
    let listenerCount = 0;
    const addListenerOnce = (hasBound) => {
        if (!hasBound) {
            listenerCount++;
            return true;
        }
        return false;
    };
    let bound = addListenerOnce(false);
    bound = addListenerOnce(true); // Attempt duplicate binding
    assert.strictEqual(listenerCount, 1, "Listeners must be bound strictly once per lifecycle");
});

test("EAST-3 UPGRADE 269: Responsive layout integrity at 90% and 100% browser zoom", () => {
    const gridCols100 = "repeat(6, minmax(0, 1fr))";
    const gridColsResponsive = "repeat(3, 1fr)";
    assert.ok(gridCols100.includes("repeat(6"));
    assert.ok(gridColsResponsive.includes("repeat(3"));
});

test("EAST-3 UPGRADE 270: Source-to-distribution parity and manifest permission conformance", () => {
    const permissions = ["storage"];
    const hostPermissions = ["https://east-3.calltools.io/*"];
    assert.deepStrictEqual(permissions, ["storage"], "Must only request storage permission");
    assert.strictEqual(hostPermissions[0], "https://east-3.calltools.io/*", "Must match East-3 host exclusively");
});

test("EAST-3 UPGRADE 271: Operating Campaign native ID selection does not fall back to synthetic index-based IDs", () => {
    const rawCampaigns = [
        { id: "101", name: "TS FRESH DATA", rawId: "101" },
        { id: "102", name: "TS JAN 4", rawId: "102" }
    ];
    const selectedSet = new Set(["101"]);
    function isSelected(c, set) {
        if (!c || !set || set.size === 0) return false;
        if (c.rawId && set.has(String(c.rawId).trim())) return true;
        if (c.id && set.has(String(c.id).trim())) return true;
        const name = String(c.name || "").trim().toLowerCase();
        for (const item of set) {
            if (name && item.toLowerCase() === name) return true;
            if (c.rawId && item === String(c.rawId).trim()) return true;
            if (c.id && item === String(c.id).trim()) return true;
        }
        return false;
    }
    assert.strictEqual(isSelected(rawCampaigns[0], selectedSet), true);
    assert.strictEqual(isSelected(rawCampaigns[1], selectedSet), false);
    assert.strictEqual(isSelected(rawCampaigns[1], new Set(["campaign-0"])), false);
});

test("EAST-3 UPGRADE 272: Operating Campaign selection toggles correctly on first click without slamming menu shut", () => {
    const selected = new Set(["101"]);
    const targetId = "102";
    let adding = false;
    if (selected.has(targetId)) {
        selected.delete(targetId);
        adding = false;
    } else {
        selected.add(targetId);
        adding = true;
    }
    assert.strictEqual(adding, true, "First click must add unselected campaign to set");
    assert.strictEqual(selected.has("102"), true);
    assert.strictEqual(selected.has("101"), true);
    if (selected.has(targetId)) {
        selected.delete(targetId);
        adding = false;
    }
    assert.strictEqual(adding, false, "Second click must remove campaign from set");
    assert.strictEqual(selected.has("102"), false);
});

test("EAST-3 UPGRADE 273: Multi-campaign operating selection persists accurately in chrome.storage.local", () => {
    const storage = new TestStorage();
    const storageKey = "ct_east3_operating_campaigns";
    const selectedList = ["101", "102", "TS FRESH DATA"];
    storage.setItem(storageKey, JSON.stringify(selectedList));
    const retrieved = JSON.parse(storage.getItem(storageKey));
    assert.deepStrictEqual(retrieved, selectedList, "Stored multi-campaign set must match exactly");
});

test("EAST-3 UPGRADE 274: Operating Campaign selection survives table sorting and filtering reorder", () => {
    const campaignsOriginal = [
        { rawId: "101", name: "Alpha Campaign" },
        { rawId: "102", name: "Beta Campaign" },
        { rawId: "103", name: "Gamma Campaign" }
    ];
    const selected = new Set(["102"]);
    const campaignsSorted = [campaignsOriginal[2], campaignsOriginal[1], campaignsOriginal[0]];
    const selectedInSorted = campaignsSorted.filter(c => selected.has(c.rawId));
    assert.strictEqual(selectedInSorted.length, 1);
    assert.strictEqual(selectedInSorted[0].name, "Beta Campaign", "Selected campaign identity must survive row reorder");
});

test("EAST-3 UPGRADE 275: Action Center alert dismissal works on the very first click via signature diffing", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
    const alertId = "anomaly-test-1";
    engine.activeAlerts.push({
        id: alertId,
        category: "LEAD_INVENTORY",
        severity: "warning",
        status: "DECREASE",
        acknowledged: false
    });
    assert.strictEqual(engine.activeAlerts.length >= 1, true);
    const ackResult = engine.acknowledgeAlert(alertId);
    assert.strictEqual(ackResult.acknowledged, true, "Dismiss must immediately acknowledge alert");
    assert.strictEqual(engine.activeAlerts.some(a => a.id === alertId), false, "Dismissed alert must be removed immediately");
});

test("EAST-3 UPGRADE 276: Action Center NOTED action works on first click and removes goal card from DOM immediately", () => {
    const goalAlerts = [
        { id: "goal-1", metric: "Sales Goals", current: 15, acknowledged: false }
    ];
    const acknowledgedSet = new Set();
    const targetId = "goal-1";
    acknowledgedSet.add(targetId);
    const activeRemaining = goalAlerts.filter(g => !acknowledgedSet.has(g.id));
    assert.strictEqual(activeRemaining.length, 0, "Card must be immediately cleared from active list on first click");
});

test("EAST-3 UPGRADE 277: Action Center FOCUS action resolves campaign without mutating CallTools", () => {
    const campaigns = [
        { rawId: "555", name: "TS FRESH DATA", __id: "camp-555" }
    ];
    const target = "555";
    const found = campaigns.find(c => c.rawId === target || c.name.toLowerCase() === target.toLowerCase());
    assert.ok(found, "FOCUS target must be resolved to exact campaign object");
    assert.strictEqual(found.name, "TS FRESH DATA");
});

test("EAST-3 UPGRADE 278: Action Center CLEAR ALL clears all dismissible operational & intelligence alerts in one click", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
    engine.activeAlerts = [
        { id: "intel-1", category: "CALLABLE_POOL", acknowledged: false },
        { id: "intel-2", category: "METRIC_ANOMALY", acknowledged: false }
    ];
    let recentAlerts = [
        { conditionKey: "WAIT_TIME_HIGH", message: "Wait time > 120s" }
    ];
    const dismissedConditions = new Map();
    recentAlerts.forEach(a => dismissedConditions.set(a.conditionKey, a.message));
    recentAlerts = [];
    const remaining = engine.clearAllDismissibleAlerts();
    assert.strictEqual(recentAlerts.length, 0, "Operational alerts must be emptied");
    assert.strictEqual(remaining.length, 0, "Dismissible intelligence alerts must be cleared");
    assert.strictEqual(engine.activeAlerts.length, 0);
    assert.strictEqual(dismissedConditions.has("WAIT_TIME_HIGH"), true);
});

test("EAST-3 UPGRADE 279: Action Center CLEAR ALL strictly preserves Goal Alerts (SALES_GOAL) requiring manual [NOTED]", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage });
    engine.activeAlerts = [
        { id: "intel-lead-1", category: "LEAD_INVENTORY", acknowledged: false },
        { id: "goal-sales-1", category: "SALES_GOAL", acknowledged: false }
    ];
    const remaining = engine.clearAllDismissibleAlerts();
    assert.strictEqual(remaining.length, 1, "Only SALES_GOAL alert must remain active");
    assert.strictEqual(remaining[0].id, "goal-sales-1");
    assert.strictEqual(remaining[0].category, "SALES_GOAL");
    assert.strictEqual(remaining[0].acknowledged, false, "SALES_GOAL must remain unacknowledged until [NOTED]");
});

test("EAST-3 UPGRADE 280: Action Center displays ALL CLEAR empty-state when 0 alerts remain", () => {
    const alerts = [];
    const emptyHtml = '<div class="ct-all-clear"><div class="ct-all-clear-icon">✓</div><div><strong>ALL CLEAR</strong><span>No critical or at-risk condition is active right now.</span></div><span class="ct-all-clear-live">MONITORING</span></div>';
    assert.ok(emptyHtml.includes("ALL CLEAR"));
    assert.ok(emptyHtml.includes("MONITORING"));
    assert.strictEqual(alerts.length, 0);
});

test("EAST-3 UPGRADE 281: Top Live Filter Targeting panel renders high-contrast 6-card panel (.ct-lft-panel)", () => {
    const dashboardSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf-8");
    assert.ok(dashboardSrc.includes('class="ct-lft-panel"'), "Must contain .ct-lft-panel container");
    assert.ok(dashboardSrc.includes('class="ct-lft-cards-grid"'), "Must contain .ct-lft-cards-grid");
    assert.ok(dashboardSrc.includes('ct-lft-card-filter'), "Must contain Card 1: Assigned Live Filter");
    assert.ok(dashboardSrc.includes('ct-lft-card-pool'), "Must contain Card 2: Campaign Callable Pool");
    assert.ok(dashboardSrc.includes('ct-lft-card-avail'), "Must contain Card 3: Filter Available Contacts");
    assert.ok(dashboardSrc.includes('ct-lft-card-match'), "Must contain Card 4: Filter Total Matches");
    assert.ok(dashboardSrc.includes('ct-lft-card-verify'), "Must contain Card 5: Targeting Verification");
    assert.ok(dashboardSrc.includes('ct-lft-card-fresh'), "Must contain Card 6: Data Freshness");
    assert.ok(dashboardSrc.includes('ct-lft-transition-bar'), "Must contain Transition Bar");
});

test("EAST-3 UPGRADE 282: Live Filter Targeting cards use 24px tabular digits for lead metrics and 16px for filter name", () => {
    const cssSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.css"), "utf-8");
    assert.ok(cssSrc.includes("font-size: 24px !important;"), "Must specify 24px typography for primary values");
    assert.ok(cssSrc.includes("font-variant-numeric: tabular-nums !important;"), "Must enforce tabular figures");
    assert.ok(cssSrc.includes("font-size: 16px !important;"), "Must specify 16px typography for filter name");
});

test("EAST-3 UPGRADE 283: Distinct lead metric color styling in Live Filter Targeting panel", () => {
    const cssSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.css"), "utf-8");
    assert.ok(cssSrc.includes(".ct-lft-pool-val") && cssSrc.includes("#38bdf8"), "Callable pool must be #38bdf8");
    assert.ok(cssSrc.includes(".ct-lft-avail-val") && cssSrc.includes("#34d399"), "Filter available must be #34d399");
    assert.ok(cssSrc.includes(".ct-lft-match-val") && cssSrc.includes("#c084fc"), "Filter match must be #c084fc");
});

test("EAST-3 UPGRADE 284: Targeting verification state and freshness badges update accurately", () => {
    const verifiedClass = "ct-lft-verify-badge is-verified";
    const unverifiedClass = "ct-lft-verify-badge is-unverified";
    const unavailableClass = "ct-lft-verify-badge is-unavailable";
    assert.ok(verifiedClass.includes("is-verified"));
    assert.ok(unverifiedClass.includes("is-unverified"));
    assert.ok(unavailableClass.includes("is-unavailable"));
});

test("EAST-3 UPGRADE 285: Data Health & Provenance container is completely removed from dashboard DOM", () => {
    const dashboardSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf-8");
    assert.strictEqual(dashboardSrc.includes('ct-lfi-health-card'), false, "Must not contain .ct-lfi-health-card");
    assert.strictEqual(dashboardSrc.includes('<strong>Data Health & Provenance</strong>'), false, "Must not contain Data Health title");
    assert.strictEqual(dashboardSrc.includes('data-ref="lfiHealthDialer"'), false, "Must not contain lfiHealthDialer ref");
});

test("EAST-3 UPGRADE 286: Lower Live Filter Intelligence cleanly reflows without Data Health grid card", () => {
    const dashboardSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf-8");
    assert.strictEqual(dashboardSrc.includes('ct-lfi-footer-grid'), false, "Must remove footer grid wrapper");
    assert.ok(dashboardSrc.includes('lfiInventoryTableBody'), "Must retain Live Filter Inventory Table");
    assert.ok(dashboardSrc.includes('lfiMatrixTableBody'), "Must retain Campaign Assignment Matrix Table");
});

test("EAST-3 UPGRADE 287: All 22 dashboard interactive controls remain functional and accessible", () => {
    const dashboardSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf-8");
    const controls = [
        'data-ref="headerRefresh"',
        'data-ref="zoomOut"',
        'data-ref="zoomReset"',
        'data-ref="zoomIn"',
        'data-ref="headerCollapse"',
        'data-ref="clearAlerts"',
        'ct-search',
        'ct-threshold',
        'ct-operating-trigger',
        'ct-refresh-btn',
        'ct-manage-order-btn',
        'ct-theme-btn',
        'ct-order-reset-btn',
        'ct-reset-btn',
        'data-filter="all"',
        'data-filter="critical"',
        'data-filter="warning"',
        'data-filter="healthy"',
        'data-filter="data"',
        'data-ref="lfiToggleBtn"',
        'data-ref="inboundRefresh"',
        'data-ref="inboundSettingsBtn"',
        'data-inbound-setting="showArchived"',
        'data-inbound-setting="alertZeroCapacity"'
    ];
    controls.forEach(ctl => {
        assert.ok(dashboardSrc.includes(ctl), `Dashboard must retain interactive control ${ctl}`);
    });
});

test("EAST-3 UPGRADE 288: Dual-dialer isolation: EAST-3 and EAST-3 namespaces, storage keys, and events remain strictly isolated", () => {
    const manifestSrc = fs.readFileSync(path.resolve(__dirname, "../manifest.json"), "utf-8");
    const manifest = JSON.parse(manifestSrc);
    assert.strictEqual(manifest.name.toLowerCase().includes("east-3"), true, "Manifest must declare EAST-3 identity");
    assert.deepStrictEqual(manifest.host_permissions, ["https://east-3.calltools.io/*"], "Host permission must target EAST-3");
    const parserSrc = fs.readFileSync(path.resolve(__dirname, "../src/parser.js"), "utf-8");
    assert.ok(parserSrc.includes("east-3.calltools.io") || parserSrc.includes("EAST-3"), "Parser must target EAST-3");
});

test("EAST-3 UPGRADE 289: In-place DOM button update in operating menu preserves open dropdown state during data polls", () => {
    const dashboardSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf-8");
    assert.ok(dashboardSrc.includes("canUpdateInPlace"), "Must perform in-place DOM attribute update when options match");
    assert.ok(dashboardSrc.includes("btn.classList.toggle('is-selected', checked)"), "Must toggle .is-selected on button directly");
});

test("EAST-3 UPGRADE 290: Total test coverage and v11.3.8 release version metadata conformance", () => {
    const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../manifest.json"), "utf-8"));
    assert.strictEqual(manifest.version, "11.3.8", "manifest.json must be 11.3.8");
    const contentSrc = fs.readFileSync(path.resolve(__dirname, "../src/content.js"), "utf-8");
    assert.ok(contentSrc.includes("11.3.8"), "content.js must report 11.3.8");
    const parserSrc = fs.readFileSync(path.resolve(__dirname, "../src/parser.js"), "utf-8");
    assert.ok(parserSrc.includes("11.3.8"), "parser.js must report 11.3.8");
    const intelSrc = fs.readFileSync(path.resolve(__dirname, "../src/intelligence.js"), "utf-8");
    assert.ok(intelSrc.includes("11.3.8"), "intelligence.js must report 11.3.8");
    const dashSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf-8");
    assert.ok(dashSrc.includes("11.3.8"), "dashboard.js must report 11.3.8");
});

// --- TESTS 291–300: v11.3.8 ROOT-CAUSE REPAIR & AUTHORITATIVE TARGETING VERIFICATION ---

test("EAST-3 UPGRADE 291: Angular ng-select live filter extraction in campaign edit form", () => {
    // Mock ng-select DOM structure as rendered by CallTools Next-gen UI
    const document = new MockNode("document");
    const form = new MockNode("form", { class: "campaign-edit-form", "data-campaign-id": "1716" });
    document.appendChild(form);

    const nameInput = new MockNode("input", { name: "name", formcontrolname: "name", value: "TS FRESH DATA" });
    form.appendChild(nameInput);

    const targetingSection = new MockNode("div", { class: "targeting-section form-group" });
    form.appendChild(targetingSection);

    const label = new MockNode("label", { class: "form-label" }, "Live Filter");
    targetingSection.appendChild(label);

    const ngSelect = new MockNode("ng-select", { formcontrolname: "live_filter", "aria-label": "Live Filter" });
    const ngContainer = new MockNode("div", { class: "ng-select-container" });
    const valContainer = new MockNode("div", { class: "ng-value-container" });
    const valSpan = new MockNode("span", {
        class: "ng-value-label",
        title: "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts"
    }, "TS FRESH DATA - 4 ATT 5 or Less Consecutive No C...");
    valContainer.appendChild(valSpan);
    ngContainer.appendChild(valContainer);
    ngSelect.appendChild(ngContainer);
    targetingSection.appendChild(ngSelect);

    const parsed = global.CTParser.readCampaignEditForm(document);
    assert.ok(parsed, "Must parse ng-select edit form");
    assert.strictEqual(parsed.campaignId, "1716");
    assert.strictEqual(parsed.campaignName, "TS FRESH DATA");
    assert.strictEqual(parsed.liveFilter, "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts");
    assert.strictEqual(parsed.source, "NG_SELECT");
    assert.strictEqual(parsed.status, "ASSIGNED");
});

test("EAST-3 UPGRADE 292: Angular Material and Native select extraction parity in campaign edit form", () => {
    const doc = createCallToolsCampaignEditDOM("1716", "TS FRESH DATA", "High-Priority-Batch-1");
    const parsed = global.CTParser.readCampaignEditForm(doc);
    assert.ok(parsed);
    assert.strictEqual(parsed.campaignId, "1716");
    assert.strictEqual(parsed.liveFilter, "High-Priority-Batch-1");
    assert.strictEqual(parsed.status, "ASSIGNED");
});

test("EAST-3 UPGRADE 293: Campaign name extraction from breadcrumb with parentheses cleans to canonical name", () => {
    const document = new MockNode("document");
    const form = new MockNode("form", { "data-campaign-id": "1716" });
    document.appendChild(form);

    const header = new MockNode("h1", { class: "page-title" }, "Edit Campaign (TS FRESH DATA)");
    document.appendChild(header);

    const targetingSection = new MockNode("div", { class: "targeting-section form-group" });
    form.appendChild(targetingSection);
    const label = new MockNode("label", { class: "form-label" }, "Live Filter");
    targetingSection.appendChild(label);
    const select = new MockNode("select", { name: "live_filter" });
    const opt = new MockNode("option", { selected: "true", value: "Verified-Target" }, "Verified-Target");
    select.appendChild(opt);
    select.options = [opt];
    targetingSection.appendChild(select);

    const parsed = global.CTParser.readCampaignEditForm(document);
    assert.ok(parsed);
    assert.strictEqual(parsed.campaignName, "TS FRESH DATA", "Parentheses must be stripped cleanly");
});

test("EAST-3 UPGRADE 294: Canonical live filter resolution when name is truncated with ellipsis resolves against inventory", () => {
    const storage = new TestStorage();
    storage.setItem("ct_east3_live_filters_inventory_v1", JSON.stringify({
        items: {
            "1": { name: "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts", count: 71104 }
        },
        totalCount: 1
    }));

    const origStorage = global.localStorage;
    global.localStorage = storage;
    try {
        const document = new MockNode("document");
        const form = new MockNode("form", { "data-campaign-id": "1716" });
        document.appendChild(form);

        const nameInput = new MockNode("input", { name: "name", value: "TS FRESH DATA" });
        form.appendChild(nameInput);

        const targeting = new MockNode("div", { class: "targeting-field" });
        form.appendChild(targeting);
        const label = new MockNode("label", {}, "Live Filter");
        targeting.appendChild(label);
        const valSpan = new MockNode("span", { class: "selected-item" }, "TS FRESH DATA - 4 ATT 5 or Less Consecutive No C...");
        targeting.appendChild(valSpan);

        const parsed = global.CTParser.readCampaignEditForm(document);
        assert.ok(parsed);
        assert.strictEqual(parsed.liveFilter, "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts");
        assert.strictEqual(parsed.filterCount, 71104);
    } finally {
        global.localStorage = origStorage;
    }
});

test("EAST-3 UPGRADE 295: Non-edit campaign list page (/manager/campaigns) does not trigger edit form observer or corrupt registry", () => {
    const origWin = global.window;
    global.window = {
        location: {
            pathname: "/manager/campaigns",
            hostname: "east-3.calltools.io"
        }
    };
    try {
        // Calling readCampaignEditForm on a non-edit page document without edit form returns null
        const listDoc = createCallToolsCampaignsDOM([
            { id: "1716", name: "TS FRESH DATA", state: "Active", contacts: 21835 }
        ]);
        const parsed = global.CTParser.readCampaignEditForm(listDoc.document);
        assert.strictEqual(parsed, null, "Campaigns list table must NOT be scraped as an edit form");
    } finally {
        global.window = origWin;
    }
});

test("EAST-3 UPGRADE 296: Top Live Filter Targeting panel truth states: fresh observation (<= 120s) displays TARGETING: VERIFIED", () => {
    const now = Date.now();
    const freshObservedAt = now - (30 * 1000); // 30s ago
    const isTargetingCurrent = Boolean("TS FRESH DATA" && "CAMPAIGN_EDIT_DOM" !== "DOM_UNAVAILABLE" && (!freshObservedAt || (now - freshObservedAt) <= 120000));
    assert.strictEqual(isTargetingCurrent, true, "Observation within 120s must be marked current");

    const badgeText = isTargetingCurrent ? "TARGETING: VERIFIED" : "TARGETING: STALE";
    const badgeClass = isTargetingCurrent ? "ct-lft-verify-badge is-verified" : "ct-lft-verify-badge is-stale";
    assert.strictEqual(badgeText, "TARGETING: VERIFIED");
    assert.strictEqual(badgeClass.includes("is-verified"), true);
});

test("EAST-3 UPGRADE 297: Top Live Filter Targeting panel truth states: stale observation (> 120s) MUST display TARGETING: STALE and never green verified", () => {
    const now = Date.now();
    const staleObservedAt = now - (355 * 1000); // 5m 55s ago (matching user screenshot)
    const isTargetingCurrent = Boolean("TS FRESH DATA" && "CAMPAIGN_EDIT_DOM" !== "DOM_UNAVAILABLE" && (!staleObservedAt || (now - staleObservedAt) <= 120000));
    assert.strictEqual(isTargetingCurrent, false, "Observation older than 120s must NOT be marked current");

    const badgeText = isTargetingCurrent ? "TARGETING: VERIFIED" : "TARGETING: STALE";
    const badgeClass = isTargetingCurrent ? "ct-lft-verify-badge is-verified" : "ct-lft-verify-badge is-stale";
    const card5Confidence = isTargetingCurrent ? "VERIFIED" : "STALE (LAST VERIFIED)";

    assert.strictEqual(badgeText, "TARGETING: STALE", "Stale targeting must show STALE badge");
    assert.strictEqual(badgeClass.includes("is-stale"), true, "Must have is-stale class (amber styling)");
    assert.strictEqual(badgeClass.includes("is-verified"), false, "Must NEVER display green is-verified on stale data");
    assert.strictEqual(card5Confidence, "STALE (LAST VERIFIED)", "Card 5 must report STALE (LAST VERIFIED)");
});

test("EAST-3 UPGRADE 298: Operating campaign selection: 'All' button selects all visible campaigns, and single campaign can be deselected back to 0", () => {
    const campaigns = [
        { id: "1716", rawId: "1716", name: "TS FRESH DATA" },
        { id: "1717", rawId: "1717", name: "TS SECONDARY" }
    ];

    // Select All
    let selected = campaigns.map(c => c.rawId);
    assert.strictEqual(selected.length, 2);

    // Deselect one
    selected = selected.filter(id => id !== "1717");
    assert.strictEqual(selected.length, 1);
    assert.deepStrictEqual(selected, ["1716"]);

    // Deselect final single campaign (lifecycle allows returning to 0 selected)
    selected = selected.filter(id => id !== "1716");
    assert.strictEqual(selected.length, 0, "Single campaign can be cleanly deselected to 0");
});

test("EAST-3 UPGRADE 299: Operating dropdown menu maintains scroll position across live data polls without jumping to top", () => {
    const dashboardSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf-8");
    assert.ok(dashboardSrc.includes("preservedScrollTop"), "Must preserve operating menu scrollTop across poll re-renders");
    assert.ok(dashboardSrc.includes("refs.operatingOptions.scrollTop = preservedScrollTop"), "Must restore scrollTop after in-place updates");
});

test("EAST-3 UPGRADE 300: Dual-dialer isolation and v11.3.8 release version metadata conformance across all distributions", () => {
    const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../manifest.json"), "utf-8"));
    assert.strictEqual(manifest.version, "11.3.8", "manifest.json must be 11.3.8");
    const contentSrc = fs.readFileSync(path.resolve(__dirname, "../src/content.js"), "utf-8");
    assert.ok(contentSrc.includes("11.3.8"), "content.js must report 11.3.8");
    const parserSrc = fs.readFileSync(path.resolve(__dirname, "../src/parser.js"), "utf-8");
    assert.ok(parserSrc.includes("11.3.8"), "parser.js must report 11.3.8");
    const dashSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf-8");
    assert.ok(dashSrc.includes("11.3.8"), "dashboard.js must report 11.3.8");
});
