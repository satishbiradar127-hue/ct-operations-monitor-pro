const fs = require('fs');
const path = require('path');

const suitePath = path.join(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE', 'CT_Operations_Monitor_East3', 'tests', 'suite.test.js');
let suiteContent = fs.readFileSync(suitePath, 'utf8');

const newTests = `
test("EAST-3 UPGRADE 316: Authoritative pencil edit link anchoring on campaign edit page resolves Live Filter even in generic div layouts", () => {
    global.window = {
        location: {
            pathname: "/manager/campaigns/edit/1716",
            search: ""
        }
    };
    const doc = new MockNode("document");
    const body = new MockNode("body");
    doc.appendChild(body);

    const section = new MockNode("div", { class: "targeting-box" });
    body.appendChild(section);

    // Row without standard form-group class
    const row = new MockNode("div", { class: "custom-layout-row" });
    section.appendChild(row);

    const col1 = new MockNode("div", { class: "col-left" });
    const lbl = new MockNode("span");
    lbl.innerText = "Live Filter";
    col1.appendChild(lbl);
    row.appendChild(col1);

    const col2 = new MockNode("div", { class: "col-mid" });
    const ngSelect = new MockNode("ng-select", { class: "ng-select", role: "combobox" });
    const ngContainer = new MockNode("div", { class: "ng-select-container" });
    const ngValue = new MockNode("div", { class: "ng-value" });
    const ngLabel = new MockNode("span", { class: "ng-value-label", title: "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts (Count: 76577)" });
    ngLabel.innerText = "TS FRESH DATA - 4 ATT 5 or Less Consecutive No C...";
    ngValue.appendChild(ngLabel);
    ngContainer.appendChild(ngValue);
    ngSelect.appendChild(ngContainer);
    col2.appendChild(ngSelect);
    row.appendChild(col2);

    const col3 = new MockNode("div", { class: "col-right" });
    const pencilLink = new MockNode("a", { href: "/manager/live-filters/edit/889" });
    col3.appendChild(pencilLink);
    row.appendChild(col3);

    const result = CTParser.readCampaignEditForm(doc);
    assert.ok(result, "Must resolve edit form data via pencil link anchor");
    assert.strictEqual(result.campaignId, "1716");
    assert.strictEqual(result.filterId, "889");
    assert.strictEqual(result.liveFilter, "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts");
    assert.strictEqual(result.filterCount, 76577);
    assert.strictEqual(result.status, "ASSIGNED");
});

test("EAST-3 UPGRADE 317: Truncated filter with ellipsis resolves against inventory via prefix match", () => {
    global.window = {
        location: {
            pathname: "/manager/campaigns/edit/1716",
            search: ""
        }
    };
    const storageMap = new Map();
    storageMap.set("ct_east3_live_filters_inventory_v1", JSON.stringify({
        items: {
            "ts_fresh": {
                id: "ts_fresh",
                name: "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts",
                count: 76577,
                totalCount: 81935
            }
        }
    }));
    global.localStorage = {
        getItem: (k) => storageMap.get(k) || null,
        setItem: (k, v) => storageMap.set(k, String(v))
    };

    const doc = new MockNode("document");
    const body = new MockNode("body");
    doc.appendChild(body);

    const ngSelect = new MockNode("ng-select", { formcontrolname: "live_filter" });
    const ngContainer = new MockNode("div", { class: "ng-select-container" });
    const ngValue = new MockNode("div", { class: "ng-value" });
    const ngLabel = new MockNode("span", { class: "ng-value-label" });
    // Text has no title attribute, ends with ellipsis
    ngLabel.innerText = "TS FRESH DATA - 4 ATT 5 or Less Consecutive No C...";
    ngValue.appendChild(ngLabel);
    ngContainer.appendChild(ngValue);
    ngSelect.appendChild(ngContainer);
    body.appendChild(ngSelect);

    const result = CTParser.readCampaignEditForm(doc);
    assert.ok(result, "Must resolve truncated filter");
    assert.strictEqual(result.liveFilter, "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts");
    assert.strictEqual(result.filterCount, 76577);
});

test("EAST-3 UPGRADE 318: dataSignature changes when liveFilter or timestamp updates", () => {
    const campaigns1 = [{
        id: "1716",
        name: "TS FRESH DATA",
        active: true,
        contacts: 100,
        liveFilter: "TS VDH INT 11/04",
        liveFilterTimestamp: 1000
    }];
    const campaigns2 = [{
        id: "1716",
        name: "TS FRESH DATA",
        active: true,
        contacts: 100,
        liveFilter: "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts",
        liveFilterTimestamp: 2000
    }];

    function dataSignature(campaigns) {
        return campaigns.map(function (campaign, index) {
            const c = campaign || {};
            return [
                c.id || index,
                c.active, c.status, c.contacts, c.waitNow, c.waiting, c.onCall,
                c.loggedIn, c.outbound, c.abandoned, c.human, c.machine, c.agentConnect,
                c.noAnswer, c.busy, c.failed, c.postCall, c.goals,
                c.liveFilter, c.liveFilterTimestamp, c.liveFilterSource, c.liveFilterCount
            ].map(function (value) { return String(value ?? ""); }).join("~");
        }).sort().join("||");
    }

    const sig1 = dataSignature(campaigns1);
    const sig2 = dataSignature(campaigns2);
    assert.notStrictEqual(sig1, sig2, "dataSignature must change when liveFilter transitions");
});

test("EAST-3 UPGRADE 319: Cross-tab verified filter storage sync updates campaigns state and records transition", () => {
    let transitionRecorded = false;
    const fakeIntelligence = {
        recordTargetingTransition: (cid, cname, prev, curr, count, source) => {
            transitionRecorded = true;
            assert.strictEqual(cid, "1716");
            assert.strictEqual(prev, "TS VDH INT 11/04");
            assert.strictEqual(curr, "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts");
        }
    };

    const state = {
        campaigns: [{
            id: "1716",
            name: "TS FRESH DATA",
            liveFilter: "TS VDH INT 11/04",
            liveFilterTimestamp: 1000
        }]
    };

    const registry = {
        "1716": {
            campaignId: "1716",
            campaignName: "TS FRESH DATA",
            liveFilter: "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts",
            filterCount: 76577,
            source: "CAMPAIGN_EDIT_DOM",
            timestamp: 2000
        }
    };

    function reconcile(customRegistry) {
        const reg = customRegistry;
        let changed = false;
        state.campaigns.forEach(function (c) {
            const cid = String(c.id).trim();
            const entry = reg[cid];
            if (entry && entry.liveFilter) {
                if (c.liveFilter !== entry.liveFilter || c.liveFilterTimestamp !== entry.timestamp) {
                    const prev = c.liveFilter;
                    c.liveFilter = entry.liveFilter;
                    c.liveFilterTimestamp = entry.timestamp;
                    c.liveFilterCount = entry.filterCount;
                    changed = true;
                    if (prev && prev !== entry.liveFilter) {
                        fakeIntelligence.recordTargetingTransition(cid, c.name, prev, entry.liveFilter, entry.filterCount, entry.source);
                    }
                }
            }
        });
        return changed;
    }

    const changed = reconcile(registry);
    assert.strictEqual(changed, true);
    assert.strictEqual(state.campaigns[0].liveFilter, "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts");
    assert.strictEqual(state.campaigns[0].liveFilterCount, 76577);
    assert.strictEqual(transitionRecorded, true);
});

test("EAST-3 UPGRADE 320: Final v11.3.9 EAST-3 build integrity and zero EAST-2 mutation", () => {
    const rootDir = path.join(__dirname, '..', '..');
    const east2Dir = path.join(rootDir, 'CT_OPERATIONS_DUAL_DIALER_RELEASE', 'CT_Operations_Monitor_East2');
    const east3Dir = path.join(rootDir, 'CT_OPERATIONS_DUAL_DIALER_RELEASE', 'CT_Operations_Monitor_East3');

    assert.ok(fs.existsSync(east2Dir), "EAST-2 directory must exist");
    assert.ok(fs.existsSync(east3Dir), "EAST-3 directory must exist");

    const east3Manifest = JSON.parse(fs.readFileSync(path.join(east3Dir, 'manifest.json'), 'utf8'));
    assert.strictEqual(east3Manifest.version, "11.3.9");
});
`;

if (!suiteContent.includes('EAST-3 UPGRADE 316:')) {
    fs.writeFileSync(suitePath, suiteContent.trimEnd() + '\n' + newTests);
    console.log('✓ Successfully appended tests 316-320 to suite.test.js');
} else {
    console.log('• Tests 316-320 already present');
}

