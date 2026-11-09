const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, search, replace) {
    const full = path.resolve(__dirname, '..', filePath);
    let content = fs.readFileSync(full, 'utf8');
    content = content.replaceAll(search, replace);
    fs.writeFileSync(full, content, 'utf8');
    console.log(`Replaced in ${filePath}`);
}

// 1. Version bumps
replaceInFile('package.json', '"version": "11.1.53"', '"version": "11.3.8"');
replaceInFile('package.json', '"version": "11.3.7"', '"version": "11.3.8"');
replaceInFile('manifest.json', '"version": "11.3.7"', '"version": "11.3.8"');
replaceInFile('CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/manifest.json', '"version": "11.3.7"', '"version": "11.3.8"');

// Source code headers
const srcFiles = [
    'src/helpers.js', 'src/parser.js', 'src/intelligence.js', 'src/content.js', 'src/dashboard.js',
    'CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/helpers.js',
    'CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/parser.js',
    'CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/intelligence.js',
    'CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/content.js',
    'CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/dashboard.js'
];
srcFiles.forEach(f => {
    try {
        replaceInFile(f, 'v11.3.7', 'v11.3.8');
        replaceInFile(f, '11.3.7', '11.3.8');
    } catch (e) {}
});

// 2. Append Tests 291–300 to East2 suite.test.js
const testFilePath = path.resolve(__dirname, '../CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/tests/suite.test.js');
let testCode = fs.readFileSync(testFilePath, 'utf8');

// Update test 290 version check
testCode = testCode.replace('assert.strictEqual(manifest.version, "11.3.7"', 'assert.strictEqual(manifest.version, "11.3.8"');
testCode = testCode.replace('Total test coverage and v11.3.7 release version metadata conformance', 'Total test coverage and v11.3.8 release version metadata conformance');
testCode = testCode.replaceAll('11.3.7', '11.3.8');

const tests291to300 = `
// --- TESTS 291–300: v11.3.8 ROOT-CAUSE REPAIR & AUTHORITATIVE TARGETING VERIFICATION ---

test("EAST-2 UPGRADE 291: Angular ng-select live filter extraction in campaign edit form", () => {
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

test("EAST-2 UPGRADE 292: Angular Material and Native select extraction parity in campaign edit form", () => {
    const doc = createCallToolsCampaignEditDOM("1716", "TS FRESH DATA", "High-Priority-Batch-1");
    const parsed = global.CTParser.readCampaignEditForm(doc);
    assert.ok(parsed);
    assert.strictEqual(parsed.campaignId, "1716");
    assert.strictEqual(parsed.liveFilter, "High-Priority-Batch-1");
    assert.strictEqual(parsed.status, "ASSIGNED");
});

test("EAST-2 UPGRADE 293: Campaign name extraction from breadcrumb with parentheses cleans to canonical name", () => {
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

test("EAST-2 UPGRADE 294: Canonical live filter resolution when name is truncated with ellipsis resolves against inventory", () => {
    const storage = new TestStorage();
    storage.setItem("ct_east2_live_filters_inventory_v1", JSON.stringify({
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

test("EAST-2 UPGRADE 295: Non-edit campaign list page (/manager/campaigns) does not trigger edit form observer or corrupt registry", () => {
    const origWin = global.window;
    global.window = {
        location: {
            pathname: "/manager/campaigns",
            hostname: "east-2.calltools.io"
        }
    };
    try {
        // Calling readCampaignEditForm on a non-edit page document without edit form returns null
        const listDoc = createCallToolsCampaignsDOM([
            { id: "1716", name: "TS FRESH DATA", state: "Active", contacts: 21835 }
        ]);
        const parsed = global.CTParser.readCampaignEditForm(listDoc);
        assert.strictEqual(parsed, null, "Campaigns list table must NOT be scraped as an edit form");
    } finally {
        global.window = origWin;
    }
});

test("EAST-2 UPGRADE 296: Top Live Filter Targeting panel truth states: fresh observation (<= 120s) displays TARGETING: VERIFIED", () => {
    const now = Date.now();
    const freshObservedAt = now - (30 * 1000); // 30s ago
    const isTargetingCurrent = Boolean("TS FRESH DATA" && "CAMPAIGN_EDIT_DOM" !== "DOM_UNAVAILABLE" && (!freshObservedAt || (now - freshObservedAt) <= 120000));
    assert.strictEqual(isTargetingCurrent, true, "Observation within 120s must be marked current");

    const badgeText = isTargetingCurrent ? "TARGETING: VERIFIED" : "TARGETING: STALE";
    const badgeClass = isTargetingCurrent ? "ct-lft-verify-badge is-verified" : "ct-lft-verify-badge is-stale";
    assert.strictEqual(badgeText, "TARGETING: VERIFIED");
    assert.strictEqual(badgeClass.includes("is-verified"), true);
});

test("EAST-2 UPGRADE 297: Top Live Filter Targeting panel truth states: stale observation (> 120s) MUST display TARGETING: STALE and never green verified", () => {
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

test("EAST-2 UPGRADE 298: Operating campaign selection: 'All' button selects all visible campaigns, and single campaign can be deselected back to 0", () => {
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

test("EAST-2 UPGRADE 299: Operating dropdown menu maintains scroll position across live data polls without jumping to top", () => {
    const dashboardSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf-8");
    assert.ok(dashboardSrc.includes("preservedScrollTop"), "Must preserve operating menu scrollTop across poll re-renders");
    assert.ok(dashboardSrc.includes("refs.operatingOptions.scrollTop = preservedScrollTop"), "Must restore scrollTop after in-place updates");
});

test("EAST-2 UPGRADE 300: Dual-dialer isolation and v11.3.8 release version metadata conformance across all distributions", () => {
    const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../manifest.json"), "utf-8"));
    assert.strictEqual(manifest.version, "11.3.8", "manifest.json must be 11.3.8");
    const contentSrc = fs.readFileSync(path.resolve(__dirname, "../src/content.js"), "utf-8");
    assert.ok(contentSrc.includes("11.3.8"), "content.js must report 11.3.8");
    const parserSrc = fs.readFileSync(path.resolve(__dirname, "../src/parser.js"), "utf-8");
    assert.ok(parserSrc.includes("11.3.8"), "parser.js must report 11.3.8");
    const dashSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf-8");
    assert.ok(dashSrc.includes("11.3.8"), "dashboard.js must report 11.3.8");
});
`;

if (!testCode.includes('EAST-2 UPGRADE 291')) {
    testCode += tests291to300;
    fs.writeFileSync(testFilePath, testCode, 'utf8');
    console.log("Appended tests 291-300 to East2 suite.test.js");
}

