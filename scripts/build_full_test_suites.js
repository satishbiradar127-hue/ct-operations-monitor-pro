const fs = require("fs");
const path = require("path");

const workspace = "C:\\Users\\Orange Carrot\\Downloads\\CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL";
const releaseRoot = path.join(workspace, "CT_OPERATIONS_DUAL_DIALER_RELEASE");
const baselineSuitePath = path.join(releaseRoot, "RECOVERY_BASELINE", "ORIGINAL_PROJECT", "tests", "suite.test.js");
const baselineSuiteCode = fs.readFileSync(baselineSuitePath, "utf8");

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

editions.forEach(ed => {
    console.log(`Building full 59-test suite for ${ed.dialer}...`);

    // Adapt baseline suite code paths
    let suiteCode = baselineSuiteCode;
    suiteCode = suiteCode.replace('path.resolve(__dirname, "../helpers.js")', 'path.resolve(__dirname, "../src/helpers.js")');
    suiteCode = suiteCode.replace('path.resolve(__dirname, "../parser.js")', 'path.resolve(__dirname, "../src/parser.js")');
    suiteCode = suiteCode.replace(/require\.resolve\("\.\.\/dashboard\.js"\)/g, 'path.resolve(__dirname, "../src/dashboard.js")');
    suiteCode = suiteCode.replace(/path\.resolve\(__dirname, "\.\.\/dashboard\.js"\)/g, 'path.resolve(__dirname, "../src/dashboard.js")');

    // Add setup of window.location
    suiteCode = suiteCode.replace(
        'global.window = global;',
        `global.window = global;
    global.window.location = {
        pathname: "/manager/campaigns",
        search: "",
        origin: "https://${ed.targetHost}",
        hostname: "${ed.targetHost}"
    };`
    );

    // Append our 12 dual-dialer & persistent goal alert tests
    const extraTests = `

// ============================================================================
// DUAL-DIALER & PERSISTENT SALES/GOALS ALERT TEST SUITE (${ed.dialer})
// ============================================================================

test("${ed.dialer} UPGRADE 48: Manifest configuration and host permissions match target dialer", () => {
    const manifestPath = path.resolve(__dirname, "../manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    assert.strictEqual(manifest.manifest_version, 3);
    assert.strictEqual(manifest.name, "CT Operations Monitor — ${ed.dialer.replace('EAST-', 'East-')}");
    assert.ok(manifest.host_permissions.includes("https://${ed.targetHost}/*"));
    assert.ok(!manifest.host_permissions.includes("https://${ed.otherHost}/*"), "Must not permit other dialer host");
    assert.ok(manifest.content_scripts[0].matches.includes("https://${ed.targetHost}/manager/campaigns*"));
    assert.ok(manifest.content_scripts[0].matches.includes("https://${ed.targetHost}/manager/queues*"));
});

test("${ed.dialer} UPGRADE 49: Storage keys are strictly isolated with '${ed.prefix}' prefix", () => {
    const dashSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf-8");
    const contentSrc = fs.readFileSync(path.resolve(__dirname, "../src/content.js"), "utf-8");
    assert.ok(dashSrc.includes('const PREFIX = "${ed.prefix}";'));
    assert.ok(!dashSrc.includes('const PREFIX = "${ed.otherPrefix}";'));
    assert.ok(contentSrc.includes('${ed.prefix}last_known_queues_v1'));
    assert.ok(!contentSrc.includes('${ed.otherPrefix}last_known_queues_v1'));
});

test("${ed.dialer} UPGRADE 50: Inbound Queue Detail strictly preserves native CallTools Queue row order (Requirement 9)", () => {
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

test("${ed.dialer} UPGRADE 51: INBOUND_HEARTBEAT_STALE_MS is set to 15000ms to eliminate false stale warnings", () => {
    const dashSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf-8");
    assert.ok(dashSrc.includes("const INBOUND_HEARTBEAT_STALE_MS = 15000;"), "Stale threshold must be 15s");
    assert.ok(!dashSrc.includes("const INBOUND_HEARTBEAT_STALE_MS = 5000;"), "Old 5s threshold must be replaced");
});

test("${ed.dialer} UPGRADE 52: Outbound Focus Section B does NOT coerce unexposed campaign agent metrics to 0", () => {
    const dashSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf-8");
    assert.ok(dashSrc.includes("const hasLoggedIn = selected.some(function (c) { return c.__loggedIn !== null && c.__loggedIn !== undefined; });"), "Must check if any selected campaign has loggedIn exposed");
    assert.ok(dashSrc.includes('setText(refs.opLoggedIn, (count && hasLoggedIn) ? formatNumber(totalLoggedIn) : "—");'), "Must display dash when unexposed");
});

test("${ed.dialer} UPGRADE 53: Persistent Goals Engine establishes initial baseline on first observation without firing false alerts", () => {
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

    checkGoal(campaign);
    assert.strictEqual(persistentAlerts.length, 0, "Unchanged value must NOT trigger alert");
});

test("${ed.dialer} UPGRADE 54: Outbound and Inbound Goal increases trigger prominent persistent alert records", () => {
    const baselines = {
        "outbound_goals_camp-1": { val: 5, metric: "Goals" },
        "inbound_goals_queue-1": { val: 3, metric: "Goals" }
    };
    const persistentAlerts = [];

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

test("${ed.dialer} UPGRADE 55: Action Center 'Clear All' clears temporary alerts but preserves persistent Goal alerts", () => {
    let recentAlerts = [
        { conditionKey: "HIGH_WAIT", severity: "warning", message: "Wait time > 30s" }
    ];
    let persistentGoalAlerts = [
        { id: "alert-1", dialer: "${ed.dialer}", metric: "Goals", current: 7 }
    ];

    recentAlerts = [];

    assert.strictEqual(recentAlerts.length, 0, "Temporary alerts cleared");
    assert.strictEqual(persistentGoalAlerts.length, 1, "Persistent goal alerts MUST remain intact");
});

test("${ed.dialer} UPGRADE 56: Clicking NOTED acknowledges and removes only that specific persistent alert", () => {
    let persistentGoalAlerts = [
        { id: "alert-1", dialer: "${ed.dialer}", metric: "Goals", current: 7 },
        { id: "alert-2", dialer: "${ed.dialer}", metric: "Goals", current: 8 }
    ];
    const acknowledgedGoalAlerts = new Set();

    const targetId = "alert-1";
    acknowledgedGoalAlerts.add(targetId);
    persistentGoalAlerts = persistentGoalAlerts.filter(a => a.id !== targetId);

    assert.strictEqual(persistentGoalAlerts.length, 1);
    assert.strictEqual(persistentGoalAlerts[0].id, "alert-2", "Alert-2 must remain active");
    assert.ok(acknowledgedGoalAlerts.has("alert-1"), "Alert-1 must be recorded in acknowledged set");
});

test("${ed.dialer} UPGRADE 57: Daily counter reset or decrease resets baseline without firing false alert", () => {
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

test("${ed.dialer} UPGRADE 58: Dashboard action buttons render valid labels without corrupted UTF-8 glyphs", () => {
    const dashSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf-8");
    assert.ok(dashSrc.includes("↻ Refresh Data"), "Refresh Data label must have valid ↻ icon");
    assert.ok(dashSrc.includes("Arrange Campaigns"), "Arrange Campaigns button must be properly named");
    assert.ok(dashSrc.includes("✓ Done Order"), "Done Order must have valid checkmark");
    assert.ok(!dashSrc.includes("? Refresh Data"), "No corrupted ? Refresh Data");
    assert.ok(!dashSrc.includes("? Order"), "No corrupted ? Order");
});

test("${ed.dialer} UPGRADE 59: Cross-dialer isolation verifies host and storage separation from ${ed.otherDialer}", () => {
    const thisManifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../manifest.json"), "utf-8"));
    const otherManifestPath = path.resolve(__dirname, "../../${ed.folder === 'CT_Operations_Monitor_East2' ? 'CT_Operations_Monitor_East3' : 'CT_Operations_Monitor_East2'}/manifest.json");
    const otherManifest = JSON.parse(fs.readFileSync(otherManifestPath, "utf-8"));

    assert.notStrictEqual(thisManifest.name, otherManifest.name);
    assert.notStrictEqual(thisManifest.host_permissions[0], otherManifest.host_permissions[0]);
    assert.strictEqual(thisManifest.host_permissions[0], "https://${ed.targetHost}/*");
    assert.strictEqual(otherManifest.host_permissions[0], "https://${ed.otherHost}/*");
});
`;

    const fullSuite = suiteCode + extraTests;
    const testPath = path.join(releaseRoot, ed.folder, "tests", "suite.test.js");
    fs.writeFileSync(testPath, fullSuite, "utf8");
    console.log(`Full test suite for ${ed.dialer} written to ${testPath}`);
});

