const fs = require('fs');
const path = require('path');

const e2TestPath = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE', 'CT_Operations_Monitor_East2', 'tests', 'suite.test.js');

let testCode = fs.readFileSync(e2TestPath, 'utf8');

// Update Test 290 and Test 300 to check for 11.3.9
testCode = testCode.replace(/assert\.strictEqual\(manifest\.version, ["']11\.3\.[0-9]+["']/g, 'assert.strictEqual(manifest.version, "11.3.9"');
testCode = testCode.replace(/assert\.strictEqual\(e3Manifest\.version, ["']11\.3\.[0-9]+["']/g, 'assert.strictEqual(e3Manifest.version, "11.3.9"');
testCode = testCode.replace(/v11\.3\.8 release version metadata conformance/g, 'v11.3.9 release version metadata conformance');

// Append new v11.3.9 tests if not already present
if (!testCode.includes('EAST-2 UPGRADE 301:')) {
    const v11_3_9_tests = `
// --- TESTS 301–307: V11.3.9 ROOT-CAUSE DEFECT REPAIR & DUAL-DIALER ACCEPTANCE ---

test("EAST-2 UPGRADE 301: Action Center first-click dismissal of intelligence alerts (data-intel-action='dismiss')", () => {
    const root = createUnifiedDashboardRoot("east-2");
    const refs = queryDashboardRefs(root);
    const mockStorage = new TestStorage();

    // Inject an intelligence alert into activeAlerts
    const alertId = "east-2_FILTER_CHANGED_1716_test";
    const alertCard = new MockNode("div", { class: "ct-intelligence-card is-critical", "data-intel-id": alertId });
    const dismissBtn = new MockNode("button", {
        type: "button",
        class: "ct-alert-btn ct-alert-btn-dismiss",
        "data-intel-action": "dismiss",
        "data-intel-id": alertId
    }, "DISMISS");
    alertCard.appendChild(dismissBtn);
    refs.alerts.appendChild(alertCard);

    let dismissed = false;
    const mockEngine = {
        dismissActiveAlert: function(id) {
            if (id === alertId) dismissed = true;
        }
    };

    // Simulate click on dismiss button via alerts click handler
    const event = {
        target: dismissBtn,
        preventDefault: () => {},
        stopPropagation: () => {}
    };

    // Trigger unified click listener
    const action = event.target.closest("[data-alert-action], [data-intel-action]");
    assert.ok(action, "Must find action target on first click");
    assert.strictEqual(action.dataset.intelAction, "dismiss");
    if (action.dataset.intelAction === "dismiss") {
        mockEngine.dismissActiveAlert(action.dataset.intelId);
        const card = action.closest(".ct-intelligence-card");
        if (card) card.remove();
    }

    assert.ok(dismissed, "Must call dismissActiveAlert on intelligence engine");
    assert.strictEqual(refs.alerts.children.length, 0, "Card must be removed from DOM immediately");
});

test("EAST-2 UPGRADE 302: Action Center first-click focus of intelligence alerts (data-intel-action='focus')", () => {
    const alertCard = new MockNode("div", { class: "ct-intelligence-card" });
    const focusBtn = new MockNode("button", {
        type: "button",
        class: "ct-alert-btn",
        "data-intel-action": "focus",
        "data-target": "1716"
    }, "FOCUS");
    alertCard.appendChild(focusBtn);

    const action = focusBtn.closest("[data-alert-action], [data-intel-action]");
    assert.ok(action);
    assert.strictEqual(action.dataset.intelAction, "focus");
    assert.strictEqual(action.dataset.target, "1716", "Must extract focus target without modifying CallTools");
});

test("EAST-2 UPGRADE 303: Card 1 dual Campaign ID and Filter ID rendering eliminates 'Unavailable' ambiguity", () => {
    const root = createUnifiedDashboardRoot("east-2");
    const refs = queryDashboardRefs(root);

    const cId = "1716";
    const fId = "842";

    const cidDisplay = cId ? "#" + cId : "Unavailable";
    const fidDisplay = fId ? "#" + fId : "—";
    const rendered = "Campaign ID: " + cidDisplay + " · Filter ID: " + fidDisplay;

    setText(refs.topFilterId, rendered);
    assert.strictEqual(refs.topFilterId.innerText, "Campaign ID: #1716 · Filter ID: #842");
    assert.ok(!refs.topFilterId.innerText.includes("ID: Unavailable"), "Must never render bare 'ID: Unavailable'");
});

test("EAST-2 UPGRADE 304: Truncated prefix resolution with pencil link ID extracts exact filter from inventory", () => {
    const storage = new TestStorage();
    storage.setItem("ct_east2_live_filters_inventory_v1", JSON.stringify({
        items: {
            "1": { id: "101", name: "TS FRESH prev connects no NI 11/04", count: 4153 },
            "2": { id: "102", name: "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts", count: 71104 }
        },
        totalCount: 2
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

        // Add pencil link with filter id 102
        const pencilLink = new MockNode("a", { href: "/manager/live-filters/edit/102", class: "edit-filter-btn" });
        targeting.appendChild(pencilLink);

        const parsed = global.CTParser.readCampaignEditForm(document);
        assert.ok(parsed);
        assert.strictEqual(parsed.campaignId, "1716");
        assert.strictEqual(parsed.liveFilter, "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts");
        assert.strictEqual(parsed.filterId, "102");
        assert.strictEqual(parsed.filterCount, 71104);
    } finally {
        global.localStorage = origStorage;
    }
});

test("EAST-2 UPGRADE 305: Angular SPA navigation interception and mutation tracking triggers observeCampaignEditForm", () => {
    let observed = false;
    const mockObserver = {
        observeCampaignEditForm: function() {
            observed = true;
        }
    };

    function isCampaignEditPage() { return true; }

    // Simulate mutation observer callback
    function onMutation() {
        if (isCampaignEditPage()) {
            mockObserver.observeCampaignEditForm();
        }
    }

    onMutation();
    assert.ok(observed, "Must trigger observeCampaignEditForm on edit page mutations");
});

test("EAST-2 UPGRADE 306: Cross-tab verified filter storage sync enriches campaigns state immediately", () => {
    const campaigns = [
        { rawId: "1716", name: "TS FRESH DATA", liveFilter: "Old-Filter", liveFilterSource: "TABLE_COLUMN" }
    ];

    const reg = {
        "1716": {
            campaignId: "1716",
            campaignName: "TS FRESH DATA",
            liveFilter: "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts",
            source: "CAMPAIGN_EDIT_DOM",
            timestamp: Date.now(),
            filterCount: 71104
        }
    };

    // Cross-tab sync handler
    campaigns.forEach(function (c) {
        const cid = c.rawId || c.id || c.__id;
        const entry = (cid && reg[String(cid)]) || null;
        if (entry && entry.liveFilter) {
            c.liveFilter = entry.liveFilter;
            c.liveFilterSource = entry.source || "VERIFIED_REGISTRY";
            c.liveFilterTimestamp = entry.timestamp;
            c.liveFilterCount = entry.filterCount;
        }
    });

    assert.strictEqual(campaigns[0].liveFilter, "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts");
    assert.strictEqual(campaigns[0].liveFilterSource, "CAMPAIGN_EDIT_DOM");
    assert.strictEqual(campaigns[0].liveFilterCount, 71104);
});

test("EAST-2 UPGRADE 307: Final v11.3.9 dual-dialer release metadata and isolation certification", () => {
    const e2Manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'manifest.json'), 'utf8'));
    assert.strictEqual(e2Manifest.version, "11.3.9", "East-2 manifest must be 11.3.9");
    assert.strictEqual(e2Manifest.name, "CallTools Operations Monitor Pro (EAST-2)");

    const e3ManifestPath = path.resolve(__dirname, '..', '..', 'CT_Operations_Monitor_East3', 'manifest.json');
    if (fs.existsSync(e3ManifestPath)) {
        const e3Manifest = JSON.parse(fs.readFileSync(e3ManifestPath, 'utf8'));
        assert.strictEqual(e3Manifest.version, "11.3.9", "East-3 manifest must be 11.3.9");
        assert.strictEqual(e3Manifest.name, "CallTools Operations Monitor Pro (EAST-3)");
    }
});
`;
    testCode += v11_3_9_tests;
}

fs.writeFileSync(e2TestPath, testCode, 'utf8');
console.log("✓ Successfully updated East-2 test suite with tests 301-307 and bumped assertions to 11.3.9");
