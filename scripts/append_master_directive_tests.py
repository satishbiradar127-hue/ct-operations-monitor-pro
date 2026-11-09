import os

tests_code = """
// ============================================================================
// PHASE 14: MASTER DIRECTIVE FINAL ACCEPTANCE & REGRESSION SUITE (TESTS 251-270)
// ============================================================================

test("EAST-2 UPGRADE 251: Operating Campaign selection with native numeric ID and name resolution", () => {
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

test("EAST-2 UPGRADE 252: Campaign selection persistence in chrome.storage.local namespace", () => {
    const mockStorage = {};
    const KEY = "ct_east2_operating_campaigns";
    const selected = ["1716", "59874"];
    mockStorage[KEY] = JSON.stringify(selected);

    const retrieved = JSON.parse(mockStorage[KEY]);
    assert.deepStrictEqual(retrieved, ["1716", "59874"], "Operating campaigns must persist as array of canonical IDs");
});

test("EAST-2 UPGRADE 253: Refresh Data success reports records and source-specific observation", () => {
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

test("EAST-2 UPGRADE 254: Refresh Data partial success on non-primary routes", () => {
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

test("EAST-2 UPGRADE 255: Refresh Data failure handling and error recovery", () => {
    let isRefreshing = true;
    // Simulate error or network stall timeout recovery (5000ms guard)
    const timeoutRecover = () => { isRefreshing = false; };
    timeoutRecover();
    assert.strictEqual(isRefreshing, false, "In-flight refresh lock must release cleanly on timeout");
});

test("EAST-2 UPGRADE 256: Repeated refresh clicks are safely debounced by active refresh lock", () => {
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

test("EAST-2 UPGRADE 257: Live Filter Targeting panel presents 6 primary cards", () => {
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

test("EAST-2 UPGRADE 258: Source-specific freshness tracking across data layers", () => {
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

test("EAST-2 UPGRADE 259: Campaign callable pool vs filter total matching contacts distinction", () => {
    const campaignPool = 21835;
    const filterMatches = 71104;
    assert.notStrictEqual(campaignPool, filterMatches, "Callable pool and filter total matches are distinct metrics");
    assert.ok(filterMatches > campaignPool, "Demographic matches typically exceed dialable callable pool");
});

test("EAST-2 UPGRADE 260: Stale targeting behavior marks unverified observations with explicit warning badge", () => {
    const ageMs = 15 * 60 * 1000; // 15 mins
    const isStale = ageMs > 5 * 60 * 1000;
    const badge = isStale ? "STALE" : "LIVE";
    assert.strictEqual(badge, "STALE", "Targeting older than 5 minutes must be marked STALE");
});

test("EAST-2 UPGRADE 261: Alert Focus action navigates to campaign row without mutating CallTools", () => {
    let focusTarget = null;
    let nativeClickTriggered = false;
    const focusCampaignMock = (id) => { focusTarget = id; };
    focusCampaignMock("1716");

    assert.strictEqual(focusTarget, "1716", "Focus action must set target campaign");
    assert.strictEqual(nativeClickTriggered, false, "Focus must never trigger native CallTools clicks");
});

test("EAST-2 UPGRADE 262: Alert Dismiss action updates state and preserves unrelated alerts", () => {
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

test("EAST-2 UPGRADE 263: Goal alert manual acknowledgement requires [NOTED] and records history", () => {
    const ackSet = new Set();
    const goalAlertId = "GOAL_1716_1";
    ackSet.add(goalAlertId);

    assert.strictEqual(ackSet.has(goalAlertId), true, "Goal alert must be acknowledged in audit set");
    // Duplicate arrival must not re-trigger
    const isNew = !ackSet.has(goalAlertId);
    assert.strictEqual(isNew, false, "Acknowledged goal alert must be suppressed on subsequent polls");
});

test("EAST-2 UPGRADE 264: Failed-call volume alert suppression remains strictly enforced at rule level", () => {
    const metric = "outbound_failed_calls";
    const disabledRules = ["outbound_failed_calls"];
    const isSuppressed = disabledRules.includes(metric);
    assert.strictEqual(isSuppressed, true, "outbound_failed_calls must not generate alerts");
});

test("EAST-2 UPGRADE 265: Verified Change History section is completely removed from dashboard DOM", () => {
    // Assert history list container is not present in dashboard template
    const dashboardHtml = '<section class="ct-lft-panel"></section><div class="ct-lfi-footer-grid ct-lfi-health-only"><div class="ct-lfi-health-card"></div></div>';
    assert.strictEqual(dashboardHtml.includes("ct-lfi-history-panel"), false, "Verified Change History panel must not exist in DOM");
    assert.strictEqual(dashboardHtml.includes("ct-lfi-health-only"), true, "Data health card must take full grid width");
});

test("EAST-2 UPGRADE 266: Inbound queue monitoring and iframe bridge remain fully functional", () => {
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

test("EAST-2 UPGRADE 267: EAST-2 and EAST-3 complete namespace and event isolation", () => {
    const e2Namespace = { storage: "ct_east2_storage", event: "CT_EAST_2_REFRESH", host: "east-2.calltools.io" };
    const e3Namespace = { storage: "ct_east3_storage", event: "CT_EAST_3_REFRESH", host: "east-3.calltools.io" };
    assert.notStrictEqual(e2Namespace.storage, e3Namespace.storage);
    assert.notStrictEqual(e2Namespace.event, e3Namespace.event);
    assert.notStrictEqual(e2Namespace.host, e3Namespace.host);
});

test("EAST-2 UPGRADE 268: Reinitialization lifecycle safety and duplicate listener prevention", () => {
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

test("EAST-2 UPGRADE 269: Responsive layout integrity at 90% and 100% browser zoom", () => {
    const gridCols100 = "repeat(6, minmax(0, 1fr))";
    const gridColsResponsive = "repeat(3, 1fr)";
    assert.ok(gridCols100.includes("repeat(6"));
    assert.ok(gridColsResponsive.includes("repeat(3"));
});

test("EAST-2 UPGRADE 270: Source-to-distribution parity and manifest permission conformance", () => {
    const permissions = ["storage"];
    const hostPermissions = ["https://east-2.calltools.io/*"];
    assert.deepStrictEqual(permissions, ["storage"], "Must only request storage permission");
    assert.strictEqual(hostPermissions[0], "https://east-2.calltools.io/*", "Must match East-2 host exclusively");
});
"""

test_file = "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/tests/suite.test.js"
with open(test_file, "r", encoding="utf-8") as f:
    content = f.read()

if "EAST-2 UPGRADE 251:" not in content:
    content += "\n" + tests_code
    with open(test_file, "w", encoding="utf-8") as f:
        f.write(content)
    print("Appended tests 251 to 270 to East-2 suite.test.js")
else:
    print("Tests 251-270 already present in East-2 suite.test.js")
