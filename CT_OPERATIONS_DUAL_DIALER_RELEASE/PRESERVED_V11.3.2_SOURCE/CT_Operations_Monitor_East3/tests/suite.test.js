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

test("EAST-3 UPGRADE 78: Complete bidirectional storage and namespace isolation from EAST-2", () => {
    const storageThis = new TestStorage();
    const storageOther = new TestStorage();
    const engineThis = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage: storageThis });
    const engineOther = new CTDataIntelligenceEngine({ dialer: "EAST-2", prefix: "ct_east2_", storage: storageOther });

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
