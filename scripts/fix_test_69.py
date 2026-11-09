file_path = "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/tests/suite.test.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

old_test_69 = """test("EAST-2 UPGRADE 69: Unexpected counter reset outside midnight window flags RESET integrity alert", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-2", prefix: "ct_east2_", storage });
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

new_test_69 = """test("EAST-2 UPGRADE 69: Unexpected counter reset outside midnight window flags RESET integrity alert", () => {
    const storage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({ dialer: "EAST-2", prefix: "ct_east2_", storage });
    engine.baselines["metric_outbound_abandoned_ALL"] = { val: 120, updatedAt: Date.now() };
    engine.isMidnightResetWindow = () => false;
    const snapDaytimeReset = {
        campaigns: [{ id: "c1", name: "C1", active: true, abandoned: 0 }],
        queues: [],
        isCampaignsRoute: true,
        campaignTableFound: true
    };
    const alerts = engine.processSnapshot(snapDaytimeReset);
    const resetAlert = alerts.find(a => a.status === "RESET" && a.metric === "Total Abandoned");
    assert.ok(resetAlert, "Daytime counter reset must trigger RESET integrity alert");
});"""

if old_test_69 in content:
    content = content.replace(old_test_69, new_test_69, 1)
    print("Test 69 updated to use Total Abandoned rather than disabled Failed Call Volume.")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
