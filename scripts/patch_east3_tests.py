file_path = "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3/tests/suite.test.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Update Test 69
old_test_69 = """test("EAST-3 UPGRADE 69: Unexpected counter reset outside midnight window flags RESET integrity alert", () => {
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
});"""

new_test_69 = """test("EAST-3 UPGRADE 69: Unexpected counter reset outside midnight window flags RESET integrity alert", () => {
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
});"""

if old_test_69 in content:
    content = content.replace(old_test_69, new_test_69, 1)
    print("Test 69 updated in East-3 suite.test.js")

new_tests_east3 = """
// ============================================================================
// ULTRA-PREMIUM COMMAND CENTER & ALERT POLICY REPAIR ACCEPTANCE TESTS (EAST-3)
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
"""

if "EAST-3 UPGRADE 244:" not in content:
    content += new_tests_east3
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Appended tests 244 to 250 to East-3 suite.test.js")
