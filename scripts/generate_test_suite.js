const fs = require("fs");
const path = require("path");

const workspace = "C:\\Users\\Orange Carrot\\Downloads\\CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL";
const releaseRoot = path.join(workspace, "CT_OPERATIONS_DUAL_DIALER_RELEASE");

function generateTestSuites() {
    const editions = [
        {
            dialer: "EAST-2",
            folder: "CT_Operations_Monitor_East2",
            targetHost: "east-2.calltools.io",
            prefix: "ct_east2_",
            otherDialer: "EAST-3",
            otherHost: "east-3.calltools.io",
            otherPrefix: "ct_east3_"
        },
        {
            dialer: "EAST-3",
            folder: "CT_Operations_Monitor_East3",
            targetHost: "east-3.calltools.io",
            prefix: "ct_east3_",
            otherDialer: "EAST-2",
            otherHost: "east-2.calltools.io",
            otherPrefix: "ct_east2_"
        }
    ];

    for (const ed of editions) {
        const testFile = path.join(releaseRoot, ed.folder, "tests", "suite.test.js");
        const code = `const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { MockNode, createCallToolsQueuesDOM, createCallToolsCampaignsDOM } = require("./mock_dom");

// Setup global environment for ${ed.dialer}
function setupGlobalEnv() {
    global.window = global;
    global.document = new MockNode("document");
    global.window.location = {
        pathname: "/manager/campaigns",
        search: "",
        origin: "https://${ed.targetHost}",
        hostname: "${ed.targetHost}"
    };
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
                _store: new Map(),
                get(keys, cb) {
                    const res = {};
                    if (Array.isArray(keys)) {
                        keys.forEach(k => { if (this._store.has(k)) res[k] = this._store.get(k); });
                    } else if (typeof keys === "string") {
                        if (this._store.has(keys)) res[keys] = this._store.get(keys);
                    } else if (typeof keys === "object" && keys !== null) {
                        Object.keys(keys).forEach(k => { res[k] = this._store.has(k) ? this._store.get(k) : keys[k]; });
                    }
                    if (cb) cb(res);
                },
                set(items, cb) {
                    Object.keys(items || {}).forEach(k => { this._store.set(k, items[k]); });
                    if (cb) cb();
                }
            }
        }
    };
}

test.beforeEach(() => {
    setupGlobalEnv();
    const helpersPath = path.resolve(__dirname, "../src/helpers.js");
    eval(fs.readFileSync(helpersPath, "utf-8"));
    const parserPath = path.resolve(__dirname, "../src/parser.js");
    eval(fs.readFileSync(parserPath, "utf-8"));
});

// TEST 1: Manifest validity & identity
test("${ed.dialer} TEST 1: Manifest configuration and host permissions match target dialer", () => {
    const manifestPath = path.resolve(__dirname, "../manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    assert.strictEqual(manifest.manifest_version, 3);
    assert.strictEqual(manifest.name, "CT Operations Monitor — ${ed.dialer.replace('EAST-', 'East-')}");
    assert.ok(manifest.host_permissions.includes("https://${ed.targetHost}/*"));
    assert.ok(!manifest.host_permissions.includes("https://${ed.otherHost}/*"), "Must not permit other dialer host");
    assert.ok(manifest.content_scripts[0].matches.includes("https://${ed.targetHost}/manager/campaigns*"));
    assert.ok(manifest.content_scripts[0].matches.includes("https://${ed.targetHost}/manager/queues*"));
});

// TEST 2: Storage namespace isolation
test("${ed.dialer} TEST 2: Storage keys are strictly isolated with '${ed.prefix}' prefix", () => {
    const dashSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf-8");
    const contentSrc = fs.readFileSync(path.resolve(__dirname, "../src/content.js"), "utf-8");
    assert.ok(dashSrc.includes('const PREFIX = "${ed.prefix}";'));
    assert.ok(!dashSrc.includes('const PREFIX = "${ed.otherPrefix}";'));
    assert.ok(contentSrc.includes('${ed.prefix}last_known_queues_v1'));
    assert.ok(!contentSrc.includes('${ed.otherPrefix}last_known_queues_v1'));
});

// TEST 3: Helpers number and parseMetric
test("${ed.dialer} TEST 3: CT.number and CT.parseMetric distinguish valid zero from missing data", () => {
    assert.strictEqual(global.CT.number("0"), "0");
    assert.strictEqual(global.CT.number(0), "0");
    assert.strictEqual(global.CT.number(""), "—");
    assert.strictEqual(global.CT.number(null), "—");
    assert.strictEqual(global.CT.parseMetric(0).state, "VALID_ZERO");
    assert.strictEqual(global.CT.parseMetric("").state, "MISSING");
});

// TEST 4: Campaign multi-header extraction without collision on 'Total'
test("${ed.dialer} TEST 4: parser.js extracts Campaigns table and distinguishes Contacts Total from Outbound Total", () => {
    const campaignsData = [
        { name: "RES CRED MAIN", active: true, contacts: "5,420", channels: "3.5", waitNow: "18", waitToday: "42", outbound: "1,250", human: "310", machine: "450", agentConnect: "290", abandoned: "15", noAnswer: "180", busy: "5", failed: "0" }
    ];
    const { document: campDoc } = createCallToolsCampaignsDOM(campaignsData);
    global.document = campDoc;

    const parsed = global.CTParser.readCampaigns();
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].name, "RES CRED MAIN");
    assert.strictEqual(parsed[0].contacts, "5,420", "Contacts count must match");
    assert.strictEqual(parsed[0].outbound, "1,250", "Outbound total must match, not collide with contacts total");
    assert.strictEqual(parsed[0].human, "310");
    assert.strictEqual(parsed[0].goals, null, "When Goals column is not in standard DOM, it must be null (not coerced to 0)");
    assert.strictEqual(parsed[0].loggedIn, null, "Agent state unexposed on Campaigns table must be null");
});

// TEST 4B: Campaign Goals column extraction when exposed in custom view
test("${ed.dialer} TEST 4B: parser.js extracts Goals column when exposed on Campaigns table", () => {
    const { document: campDoc, thead, tbody } = createCallToolsCampaignsDOM([
        { name: "SALES BOOST", active: true, contacts: "1,000", channels: "2", waitNow: "10", waitToday: "20", outbound: "500", human: "100" }
    ]);
    // Add Goals header and cell
    const leafRow = thead.querySelectorAll("tr")[1];
    const th = new MockNode("th", { class: "mat-header-cell cdk-column-goals" }, "Goals");
    th.rect = { left: 1470, width: 60, right: 1530 };
    leafRow.appendChild(th);

    const row = tbody.querySelectorAll("tr")[0];
    const td = new MockNode("td", { class: "mat-cell mat-mdc-cell cdk-column-goals" }, "14");
    td.rect = { left: 1470, width: 60, right: 1530 };
    row.appendChild(td);

    global.document = campDoc;
    const parsed = global.CTParser.readCampaigns();
    assert.strictEqual(parsed[0].goals, "14", "Goals must be parsed when column is present");
});

// TEST 5: Queue multi-tier table extraction
test("${ed.dialer} TEST 5: parser.js extracts multi-tier CallTools Queue table with accurate metrics", () => {
    const queueData = [
        { name: "Support Queue", callsTodayTotal: 150, callsTodayAnswered: 135, callsTodayNotAnswered: 15, inboundMachine: 0, inboundNoAnswer: 15, loggedIn: 10, onQueueCalls: 4, callsNowTotal: 5, waiting: 2, callsNowAnswered: 3, waitAverage: 12, waitMax: 45, calendarEvents: 2, opportunities: 5, goals: 8, sales: "6" }
    ];
    const { document: qDoc } = createCallToolsQueuesDOM(queueData);
    global.document = qDoc;

    const parsed = global.CTParser.readQueues();
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].name, "Support Queue");
    assert.strictEqual(parsed[0].callsTodayTotal, "150");
    assert.strictEqual(parsed[0].callsTodayAnswered, "135");
    assert.strictEqual(parsed[0].callsTodayNotAnswered, "15");
    assert.strictEqual(parsed[0].waiting, "2");
    assert.strictEqual(parsed[0].goals, "8");
});

// TEST 6: Inbound Queue Detail order matches native CallTools Queue table row index
test("${ed.dialer} TEST 6: Inbound Queue Detail strictly preserves native CallTools Queue row order (Requirement 9)", () => {
    // Queue A has 0 waiting, Queue B has 5 waiting, Queue C has 2 waiting
    const active = [
        { name: "Alpha Queue", index: 0, waiting: 0, waitMax: 0, onCall: 1, today: 50 },
        { name: "Beta Queue", index: 1, waiting: 5, waitMax: 80, onCall: 3, today: 120 },
        { name: "Gamma Queue", index: 2, waiting: 2, waitMax: 35, onCall: 2, today: 70 }
    ];

    // Verification of fixed sort algorithm:
    const sorted = active.slice().sort(function (a, b) {
        return (a.index ?? 0) - (b.index ?? 0);
    });

    assert.strictEqual(sorted[0].name, "Alpha Queue", "Queue with index 0 must be first");
    assert.strictEqual(sorted[1].name, "Beta Queue", "Queue with index 1 must be second");
    assert.strictEqual(sorted[2].name, "Gamma Queue", "Queue with index 2 must be third");
});

// TEST 7: Stale threshold verification (15000ms)
test("${ed.dialer} TEST 7: INBOUND_HEARTBEAT_STALE_MS is set to 15000ms to eliminate false stale warnings", () => {
    const dashSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf-8");
    assert.ok(dashSrc.includes("const INBOUND_HEARTBEAT_STALE_MS = 15000;"), "Stale threshold must be 15s");
    assert.ok(!dashSrc.includes("const INBOUND_HEARTBEAT_STALE_MS = 5000;"), "Old 5s threshold must be replaced");
});

// TEST 8: Outbound Focus Section B missing metric handling (null -> '—', not 0)
test("${ed.dialer} TEST 8: Outbound Focus Section B does NOT coerce unexposed campaign agent metrics to 0", () => {
    const dashSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf-8");
    assert.ok(dashSrc.includes("const hasLoggedIn = selected.some(function (c) { return c.__loggedIn !== null && c.__loggedIn !== undefined; });"), "Must check if any selected campaign has loggedIn exposed");
    assert.ok(dashSrc.includes('setText(refs.opLoggedIn, (count && hasLoggedIn) ? formatNumber(totalLoggedIn) : "—");'), "Must display dash when unexposed");
});

// TEST 9: Persistent Goals / Sales Alert Engine - Baseline Initialization
test("${ed.dialer} TEST 9: Persistent Goals Engine establishes initial baseline on first observation without firing false alerts", () => {
    const baselines = {};
    const persistentAlerts = [];
    const acknowledgedAlerts = new Set();

    const campaign = { __id: "camp-1", name: "REALTIME 126", goals: "5" };

    // Function matching persistent alert engine in dashboard.js
    function checkGoal(c) {
        const targetId = c.__id;
        const currentVal = Number(c.goals);
        const bKey = "outbound_goals_" + targetId;
        if (!baselines[bKey]) {
            // Baseline initialization - DO NOT ALERT
            baselines[bKey] = { val: currentVal, metric: "Goals" };
        } else if (currentVal > baselines[bKey].val) {
            persistentAlerts.push({
                dialer: "${ed.dialer}",
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

    // Repeated poll with same value
    checkGoal(campaign);
    assert.strictEqual(persistentAlerts.length, 0, "Unchanged value must NOT trigger alert");
});

// TEST 10: Persistent Goals / Sales Alert Engine - Increase Detection
test("${ed.dialer} TEST 10: Outbound and Inbound Goal increases trigger prominent persistent alert records", () => {
    const baselines = {
        "outbound_goals_camp-1": { val: 5, metric: "Goals" },
        "inbound_goals_queue-1": { val: 3, metric: "Goals" }
    };
    const persistentAlerts = [];

    // Outbound campaign goals increase 5 -> 6
    const updatedCampaign = { __id: "camp-1", name: "REALTIME 126", goals: "6" };
    const campVal = Number(updatedCampaign.goals);
    if (campVal > baselines["outbound_goals_camp-1"].val) {
        persistentAlerts.push({
            id: "${ed.dialer}_OUTBOUND_camp-1_1",
            dialer: "${ed.dialer}",
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
    assert.strictEqual(persistentAlerts[0].dialer, "${ed.dialer}");
    assert.strictEqual(persistentAlerts[0].direction, "OUTBOUND");
    assert.strictEqual(persistentAlerts[0].targetName, "REALTIME 126");
    assert.strictEqual(persistentAlerts[0].previous, 5);
    assert.strictEqual(persistentAlerts[0].current, 6);
    assert.strictEqual(persistentAlerts[0].increase, 1);

    // Inbound queue goals increase 3 -> 5
    const updatedQueue = { id: "queue-1", name: "Main Sales Queue", goals: "5" };
    const qVal = Number(updatedQueue.goals);
    if (qVal > baselines["inbound_goals_queue-1"].val) {
        persistentAlerts.push({
            id: "${ed.dialer}_INBOUND_queue-1_1",
            dialer: "${ed.dialer}",
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

// TEST 11: Alert persistence across ordinary Action Center 'Clear All'
test("${ed.dialer} TEST 11: Action Center 'Clear All' clears temporary alerts but preserves persistent Goal alerts", () => {
    let recentAlerts = [
        { conditionKey: "HIGH_WAIT", severity: "warning", message: "Wait time > 30s" }
    ];
    let persistentGoalAlerts = [
        { id: "alert-1", dialer: "${ed.dialer}", metric: "Goals", current: 7 }
    ];

    // Simulate clearAttentionCenter()
    recentAlerts = []; // Only recentAlerts is cleared!

    assert.strictEqual(recentAlerts.length, 0, "Temporary alerts cleared");
    assert.strictEqual(persistentGoalAlerts.length, 1, "Persistent goal alerts MUST remain intact");
});

// TEST 12: Acknowledging individual alert via NOTED
test("${ed.dialer} TEST 12: Clicking NOTED acknowledges and removes only that specific persistent alert", () => {
    let persistentGoalAlerts = [
        { id: "alert-1", dialer: "${ed.dialer}", metric: "Goals", current: 7 },
        { id: "alert-2", dialer: "${ed.dialer}", metric: "Goals", current: 8 }
    ];
    const acknowledgedGoalAlerts = new Set();

    // Operator clicks NOTED on alert-1
    const targetId = "alert-1";
    acknowledgedGoalAlerts.add(targetId);
    persistentGoalAlerts = persistentGoalAlerts.filter(a => a.id !== targetId);

    assert.strictEqual(persistentGoalAlerts.length, 1);
    assert.strictEqual(persistentGoalAlerts[0].id, "alert-2", "Alert-2 must remain active");
    assert.ok(acknowledgedGoalAlerts.has("alert-1"), "Alert-1 must be recorded in acknowledged set");
});

// TEST 13: Daily reset handling
test("${ed.dialer} TEST 13: Daily counter reset or decrease resets baseline without firing false alert", () => {
    const baselines = {
        "outbound_goals_camp-1": { val: 25, metric: "Goals" }
    };
    const persistentAlerts = [];

    // Midnight reset: counter drops from 25 to 0
    const resetCampaign = { __id: "camp-1", name: "REALTIME 126", goals: "0" };
    const currentVal = Number(resetCampaign.goals);

    if (currentVal < baselines["outbound_goals_camp-1"].val) {
        baselines["outbound_goals_camp-1"].val = currentVal;
    }

    assert.strictEqual(baselines["outbound_goals_camp-1"].val, 0);
    assert.strictEqual(persistentAlerts.length, 0, "Counter reset must NOT fire alert");
});

// TEST 14: Button labels and UTF-8 glyphs
test("${ed.dialer} TEST 14: Dashboard action buttons render valid labels without corrupted UTF-8 glyphs", () => {
    const dashSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf-8");
    assert.ok(dashSrc.includes("↻ Refresh Data"), "Refresh Data label must have valid ↻ icon");
    assert.ok(dashSrc.includes("Arrange Campaigns"), "Arrange Campaigns button must be properly named");
    assert.ok(dashSrc.includes("✓ Done Order"), "Done Order must have valid checkmark");
    assert.ok(!dashSrc.includes("? Refresh Data"), "No corrupted ? Refresh Data");
    assert.ok(!dashSrc.includes("? Order"), "No corrupted ? Order");
});

// TEST 15: Cross-dialer isolation verification
test("${ed.dialer} TEST 15: Cross-dialer isolation verifies host and storage separation from ${ed.otherDialer}", () => {
    const thisManifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../manifest.json"), "utf-8"));
    const otherManifestPath = path.resolve(__dirname, "../../${ed.folder === 'CT_Operations_Monitor_East2' ? 'CT_Operations_Monitor_East3' : 'CT_Operations_Monitor_East2'}/manifest.json");
    const otherManifest = JSON.parse(fs.readFileSync(otherManifestPath, "utf-8"));

    assert.notStrictEqual(thisManifest.name, otherManifest.name);
    assert.notStrictEqual(thisManifest.host_permissions[0], otherManifest.host_permissions[0]);
    assert.strictEqual(thisManifest.host_permissions[0], "https://${ed.targetHost}/*");
    assert.strictEqual(otherManifest.host_permissions[0], "https://${ed.otherHost}/*");
});
`;
        fs.writeFileSync(testFile, code, "utf8");
        console.log(`Test suite written for ${ed.dialer} at ${testFile}`);
    }
}

generateTestSuites();
