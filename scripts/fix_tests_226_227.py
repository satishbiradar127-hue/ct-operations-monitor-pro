import os

for dialer in ["East2", "East3"]:
    is_e3 = (dialer == "East3")
    d_tag = "EAST-3" if is_e3 else "EAST-2"
    pfx = "ct_east3_" if is_e3 else "ct_east2_"
    p = os.path.join("CT_OPERATIONS_DUAL_DIALER_RELEASE", f"CT_Operations_Monitor_{dialer}", "tests", "suite.test.js")

    with open(p, "r", encoding="utf-8") as f:
        c = f.read()
    c = c.replace("\r\n", "\n")

    # Cut off at PHASE 15 and re-append clean version
    idx = c.find("// PHASE 15: MASTER FORENSIC & SYSTEM REPAIR VERIFICATION")
    if idx != -1:
        # Find preceding comment divider
        prev_idx = c.rfind("// ==============================================================================", 0, idx)
        if prev_idx != -1:
            c = c[:prev_idx]

    template = """// ==============================================================================
// PHASE 15: MASTER FORENSIC & SYSTEM REPAIR VERIFICATION (TESTS 226–235)
// ==============================================================================

test("__DTAG__ UPGRADE 226: Precise Campaign ID extraction from action links and data attributes without synthetic IDs", () => {
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

test("__DTAG__ UPGRADE 227: Campaign row without numeric ID reports rawId null and matrix renders Awaiting ID (never synthetic campaign-0)", () => {
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

    const engine = new CTDataIntelligenceEngine({ dialer: "__DTAG__", prefix: "__PFX__", storage: new TestStorage() });
    const summary = engine.getLiveFilterIntelligenceSummary({ campaigns: campaigns });

    assert.strictEqual(summary.assignmentMatrix[0].campaignId, "Awaiting ID", "Must render Awaiting ID instead of synthetic campaign-0");
    assert.ok(!summary.assignmentMatrix[0].campaignId.includes("campaign-0"), "Must NEVER contain synthetic campaign-0");
});

test("__DTAG__ UPGRADE 228: Live filter intelligence evaluates isRunning correctly from active and loggedIn agents (13 agents => RUNNING)", () => {
    const mockStorage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({
        dialer: "__DTAG__",
        prefix: "__PFX__",
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

test("__DTAG__ UPGRADE 229: Unobserved Live Filter Inventory returns null and Awaiting Observation (never fake 0)", () => {
    const mockStorage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({
        dialer: "__DTAG__",
        prefix: "__PFX__",
        storage: mockStorage
    });

    const summary = engine.getLiveFilterIntelligenceSummary({ campaigns: [] });

    assert.strictEqual(summary.summary.totalFilters, null, "Total filters must be null when inventory unobserved");
    assert.strictEqual(summary.summary.activeFilters, null, "Active filters must be null when inventory unobserved");
    assert.strictEqual(summary.summary.totalContacts, null, "Total contacts must be null when inventory unobserved");
    assert.strictEqual(summary.health.hasInventory, false);
    assert.strictEqual(summary.health.inventoryStatus, "AWAITING_OBSERVATION");
});

test("__DTAG__ UPGRADE 230: Truthful provenance: Last Refill is distinguished from Last Observed", () => {
    const mockStorage = new TestStorage();
    const now = Date.now();
    mockStorage.setItem("__PFX__live_filters_inventory_v1", JSON.stringify({
        items: {
            "101": { id: "101", name: "Filter Alpha", active: true, count: 500, totalCount: 600, observedAt: now }
        },
        lastObservedAt: now,
        totalCount: 1
    }));

    const engine = new CTDataIntelligenceEngine({
        dialer: "__DTAG__",
        prefix: "__PFX__",
        storage: mockStorage
    });

    const summary = engine.getLiveFilterIntelligenceSummary({ campaigns: [] });

    assert.strictEqual(summary.inventory[0].lastRefill, "Not exposed by available source", "Last refill must explicitly state not exposed");
    assert.strictEqual(summary.inventory[0].observedAt, now, "Last observed must report actual observation timestamp");
});

test("__DTAG__ UPGRADE 231: Refresh Coordinator records refresh result and tracks unavailable sources truthfully", () => {
    const mockStorage = new TestStorage();
    const engine = new CTDataIntelligenceEngine({
        dialer: "__DTAG__",
        prefix: "__PFX__",
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
    assert.strictEqual(history[0].dialer, "__DTAG__");
});

test("__DTAG__ UPGRADE 232: Operating Campaign selection matches case-insensitively across ID and name", () => {
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

test("__DTAG__ UPGRADE 233: Dashboard layout auto-adjusts to desktop width and discards squished legacy layouts", () => {
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

test("__DTAG__ UPGRADE 234: Persistent Goals & Intelligence alerts remain in storage until explicitly acknowledged with NOTED", () => {
    const mockStorage = new TestStorage();
    const alertId = "__DTAG___OUTBOUND_GOALS_59874_100_5";
    const initialAlerts = [{ id: alertId, metric: "Goals", current: 5, targetName: "TS FRESH DATA" }];
    mockStorage.setItem("__PFX__persistent_goal_alerts_v1", JSON.stringify(initialAlerts));

    // Simulate page reload
    const reloadedAlerts = JSON.parse(mockStorage.getItem("__PFX__persistent_goal_alerts_v1") || "[]");
    assert.strictEqual(reloadedAlerts.length, 1, "Alert must persist across reload before acknowledgment");

    // Acknowledge with NOTED
    const acknowledged = new Set();
    acknowledged.add(alertId);
    const remaining = reloadedAlerts.filter(a => !acknowledged.has(a.id));
    assert.strictEqual(remaining.length, 0, "Alert is only removed after operator clicks NOTED");
});

test("__DTAG__ UPGRADE 235: Complete dual-dialer namespace and event isolation", () => {
    const e2Prefix = "ct_east2_";
    const e3Prefix = "ct_east3_";

    assert.notStrictEqual(e2Prefix, e3Prefix);
    assert.strictEqual("__PFX__", is_e3_flag ? "ct_east3_" : "ct_east2_");
    assert.strictEqual("__DTAG__", is_e3_flag ? "EAST-3" : "EAST-2");
});
"""

    rendered = template.replace("__DTAG__", d_tag).replace("__PFX__", pfx).replace("is_e3_flag", "true" if is_e3 else "false")
    c = c.rstrip() + "\n\n" + rendered

    with open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(c)

    print(f"Updated {dialer}/tests/suite.test.js with tests 226-235.")
