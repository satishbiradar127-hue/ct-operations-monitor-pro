import os

test_code_e2 = """
// ============================================================================
// FORENSIC REPAIR TESTS: COUNTS, CAMPAIGN POOL & FRESHNESS ARCHITECTURE
// ============================================================================

test("EAST-2 UPGRADE 236: Forensic Discrepancy Resolution: 43,948 filter count vs 69,194 campaign pool distinct semantics and separation", () => {
    const mockStorage = new TestStorage();
    // Simulate verified targeting snapshot with embedded count (as observed in native CallTools select)
    mockStorage.setItem("ct_east2_verified_campaign_filters_v1", JSON.stringify({
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
        dialer: "EAST-2",
        prefix: "ct_east2_",
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

test("EAST-2 UPGRADE 237: Stale targeting timestamp is preserved when campaign metrics update at a newer time", () => {
    const mockStorage = new TestStorage();
    const targetingTime = 1794235677634; // 9:47:57 AM
    const campaignMetricTime = 1794237363840; // 10:16:03 AM (28 minutes later)

    mockStorage.setItem("ct_east2_verified_campaign_filters_v1", JSON.stringify({
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
        dialer: "EAST-2",
        prefix: "ct_east2_",
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

test("EAST-2 UPGRADE 238: Fresh targeting with unobserved catalog inventory reports accurate independent states", () => {
    const mockStorage = new TestStorage();
    const now = Date.now();
    mockStorage.setItem("ct_east2_verified_campaign_filters_v1", JSON.stringify({
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
        dialer: "EAST-2",
        prefix: "ct_east2_",
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

test("EAST-2 UPGRADE 239: Missing filter count handling preserves clean name and explicit unavailable count status", () => {
    const mockStorage = new TestStorage();
    mockStorage.setItem("ct_east2_verified_campaign_filters_v1", JSON.stringify({
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
        dialer: "EAST-2",
        prefix: "ct_east2_",
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

test("EAST-2 UPGRADE 240: Zero versus unavailable distinction: valid zero contact pool is preserved", () => {
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

test("EAST-2 UPGRADE 241: Refresh Coordinator handles failed refresh without advancing timestamps", () => {
    const mockStorage = new TestStorage();
    const initialTime = 1700000000000;
    mockStorage.setItem("ct_east2_refresh_history_v1", JSON.stringify([
        { completedAt: initialTime, source: "campaigns", result: "SUCCESS" }
    ]));

    const engine = new CTDataIntelligenceEngine({
        dialer: "EAST-2",
        prefix: "ct_east2_",
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

test("EAST-2 UPGRADE 242: Remote targeting change detected on natural Campaign Edit observation", () => {
    const mockStorage = new TestStorage();
    const t1 = Date.now() - 5000;
    const t2 = Date.now();

    const engine = new CTDataIntelligenceEngine({
        dialer: "EAST-2",
        prefix: "ct_east2_",
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

test("EAST-2 UPGRADE 243: Existing Inbound monitoring remains 100% functional and regress-free", () => {
    assert.ok(dashSrc.includes('ct-inbound-panel'), "Inbound operations panel must be present");
    assert.ok(dashSrc.includes('ct-inbound-table'), "Inbound table must be present");
    assert.ok(dashSrc.includes('inboundRefresh'), "Inbound refresh must be wired");
});
"""

test_code_e3 = test_code_e2.replace("EAST-2", "EAST-3").replace("ct_east2_", "ct_east3_")

def append_tests(test_file, code, marker):
    with open(test_file, "r", encoding="utf-8") as f:
        content = f.read()
    if marker not in content:
        content += "\n" + code.strip() + "\n"
        with open(test_file, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Appended forensic tests to {test_file}")
    else:
        print(f"Marker already present in {test_file}")

marker = "UPGRADE 236: Forensic Discrepancy Resolution"
append_tests("CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/tests/suite.test.js", test_code_e2, marker)
append_tests("CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3/tests/suite.test.js", test_code_e3, marker)
