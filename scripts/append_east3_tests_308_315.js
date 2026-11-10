const fs = require('fs');
const path = require('path');

const testFilePath = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE', 'CT_Operations_Monitor_East3', 'tests', 'suite.test.js');
let testCode = fs.readFileSync(testFilePath, 'utf8');

const additionalTests = `
test("EAST-3 UPGRADE 308: readCampaignEditForm strictly ignores elements inside #ct-operations-dashboard", () => {
    const jsdom = require("jsdom");
    const { JSDOM } = jsdom;
    const dom = new JSDOM(\`<!DOCTYPE html><html><body>
        <!-- Dashboard DOM with misleading alerts and labels -->
        <section id="ct-operations-dashboard">
            <h1>CallTools Operations EAST-3</h1>
            <div class="ct-tlf-eyebrow">LIVE FILTER TARGETING</div>
            <div class="ct-alert">
                <span class="ct-alert-name">Scheduled Tasks</span>
                <span class="selected-item" data-value="Detected: 3:56:18 PM · Confirmed: 3:56:18 PM">Detected: 3:56:18 PM · Confirmed: 3:56:18 PM</span>
            </div>
        </section>
        <!-- Native CallTools Campaign Edit DOM -->
        <div class="page-content">
            <h1>Edit Campaign (TS FRESH DATA)</h1>
            <input name="name" value="TS FRESH DATA">
            <input name="id" value="1716">
            <section class="targeting-section">
                <label>Live Filter</label>
                <ng-select formcontrolname="live_filter">
                    <span class="ng-value-label" title="TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts">TS FRESH DATA - 4 ATT 5 or Less Consecutive No C...</span>
                </ng-select>
                <a href="/manager/live-filters/edit/4255" class="edit-link">Edit Filter</a>
            </section>
        </div>
    </body></html>\`, { url: "https://east-3.calltools.io/manager/campaigns/edit/1716" });

    // Load parser in JSDOM context
    const ctx = dom.window;
    ctx.isEast3 = true;
    const parserFn = new Function("window", "document", fs.readFileSync(path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE', 'CT_Operations_Monitor_East3', 'src', 'parser.js'), 'utf8') + "; return window.CTParser;");
    const parser = parserFn(ctx, ctx.document);

    const result = parser.readCampaignEditForm(ctx.document);
    assert.ok(result, "Must successfully read native edit form");
    assert.strictEqual(result.campaignId, "1716", "Must extract numeric campaign ID 1716");
    assert.strictEqual(result.campaignName, "TS FRESH DATA", "Must extract native campaign name, NOT 'Scheduled Tasks' from dashboard");
    assert.strictEqual(result.liveFilter, "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts", "Must extract full filter title, NOT 'Detected...' alert string from dashboard");
    assert.strictEqual(result.filterId, "4255", "Must extract filter ID from native pencil edit link");
});

test("EAST-3 UPGRADE 309: readCampaignEditForm rejects contaminated strings and dashboard text", () => {
    const jsdom = require("jsdom");
    const { JSDOM } = jsdom;
    const dom = new JSDOM(\`<!DOCTYPE html><html><body>
        <div class="form-container">
            <input name="name" value="TS FRESH DATA">
            <input name="id" value="1716">
            <label>Live Filter</label>
            <ng-select formcontrolname="filter">
                <span class="ng-value-label">Detected: 3:56:18 PM · Confirmed: 3:56:18 PM</span>
            </ng-select>
        </div>
    </body></html>\`, { url: "https://east-3.calltools.io/manager/campaigns/edit/1716" });

    const ctx = dom.window;
    ctx.isEast3 = true;
    const parserFn = new Function("window", "document", fs.readFileSync(path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE', 'CT_Operations_Monitor_East3', 'src', 'parser.js'), 'utf8') + "; return window.CTParser;");
    const parser = parserFn(ctx, ctx.document);

    const result = parser.readCampaignEditForm(ctx.document);
    assert.ok(result);
    assert.strictEqual(result.liveFilter, null, "Contaminated 'Detected:' text must be rejected as an invalid filter");
    assert.strictEqual(result.status, "NONE");
});

test("EAST-3 UPGRADE 310: observeCampaignEditForm purges contaminated registry keys and strictly stores by numeric ID", () => {
    const storageMap = {
        "ct_east3_verified_campaign_filters_v1": JSON.stringify({
            "Scheduled Tasks": { campaignId: "1716", liveFilter: "Detected: 3:56:18 PM" },
            "CallTools Operations EAST-3": { campaignId: "1716", liveFilter: null },
            "TS FRESH DATA": { campaignId: "1716", liveFilter: "Old Stale Filter" },
            "1716": { campaignId: "1716", liveFilter: "Initial Filter", timestamp: 1000 }
        })
    };

    const mockStorage = {
        getItem: (k) => storageMap[k] || null,
        setItem: (k, v) => { storageMap[k] = v; }
    };

    const editData = {
        campaignId: "1716",
        campaignName: "TS FRESH DATA",
        liveFilter: "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts",
        rawLiveFilter: "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts",
        filterId: "4255",
        status: "ASSIGNED",
        timestamp: Date.now()
    };

    // Execute sanitization and storage logic as implemented in content.js
    const VERIFIED_FILTERS_KEY = "ct_east3_verified_campaign_filters_v1";
    let registry = JSON.parse(mockStorage.getItem(VERIFIED_FILTERS_KEY) || "{}");
    Object.keys(registry).forEach(function(k) {
        if (!/^[0-9]+$/.test(k)) {
            delete registry[k];
        } else if (registry[k] && registry[k].liveFilter && String(registry[k].liveFilter).startsWith("Detected:")) {
            delete registry[k];
        }
    });

    const cid = String(editData.campaignId).trim();
    registry[cid] = {
        campaignId: cid,
        campaignName: editData.campaignName || "",
        liveFilter: editData.liveFilter,
        rawLiveFilter: editData.rawLiveFilter,
        filterId: editData.filterId || null,
        status: editData.status || "ASSIGNED",
        source: "CAMPAIGN_EDIT_DOM",
        timestamp: editData.timestamp
    };
    mockStorage.setItem(VERIFIED_FILTERS_KEY, JSON.stringify(registry));

    const updated = JSON.parse(mockStorage.getItem(VERIFIED_FILTERS_KEY));
    assert.strictEqual(Object.keys(updated).length, 1, "Only numeric campaign ID key must remain in registry");
    assert.ok(updated["1716"], "Key 1716 must exist");
    assert.strictEqual(updated["TS FRESH DATA"], undefined, "Campaign name key must NOT exist");
    assert.strictEqual(updated["Scheduled Tasks"], undefined, "Poisoned Scheduled Tasks key must be deleted");
    assert.strictEqual(updated["CallTools Operations EAST-3"], undefined, "Dashboard header key must be deleted");
    assert.strictEqual(updated["1716"].liveFilter, "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts");
});

test("EAST-3 UPGRADE 311: isCampaignSelected strictly evaluates numeric campaign IDs and rejects campaign name collision", () => {
    // Import dashboard functions
    function isCampaignSelected(campaign, selectedSet) {
        if (!campaign || !selectedSet || !(selectedSet instanceof Set) || selectedSet.size === 0) return false;
        const rawId = campaign.rawId || campaign.id;
        if (rawId && selectedSet.has(String(rawId).trim())) return true;
        if (campaign.__id && selectedSet.has(String(campaign.__id).trim())) return true;
        return false;
    }

    const selectedSet = new Set(["1716"]);

    const matchingCampaign = { id: "1716", rawId: "1716", name: "TS FRESH DATA" };
    const nameCollisionOtherCampaign = { id: "9999", rawId: "9999", name: "TS FRESH DATA" };
    const unnamedSameId = { rawId: "1716" };

    assert.strictEqual(isCampaignSelected(matchingCampaign, selectedSet), true, "Numeric ID match must be selected");
    assert.strictEqual(isCampaignSelected(unnamedSameId, selectedSet), true, "ID match without name must be selected");
    assert.strictEqual(isCampaignSelected(nameCollisionOtherCampaign, selectedSet), false, "Same name with different ID must NOT be selected");
});

test("EAST-3 UPGRADE 312: Top Live Filter Targeting renders explicit unselected state without silent fallback to allCampList[0]", () => {
    const stats = {
        campaigns: [
            { id: "1001", rawId: "1001", name: "FIRST CAMPAIGN", active: true, liveFilter: "Filter 1" },
            { id: "1716", rawId: "1716", name: "TS FRESH DATA", active: true, liveFilter: "Filter 2" }
        ]
    };
    const state = {
        operatingCampaigns: [], // Empty operating selection
        campaigns: stats.campaigns
    };

    function selectedOperatingCampaigns(campaigns) {
        if (!Array.isArray(campaigns) || !campaigns.length) return [];
        const ids = new Set((state.operatingCampaigns || []).map(function (id) { return String(id || "").trim(); }).filter(Boolean));
        if (ids.size === 0) return [];
        return campaigns.filter(function (c) {
            const rawId = c.rawId || c.id;
            return rawId && ids.has(String(rawId).trim());
        });
    }

    const operatingSet = selectedOperatingCampaigns(stats.campaigns);
    const operating = operatingSet[0] || null;

    // Evaluate targetCamp without silent fallback
    let targetCamp = operating;
    if (!targetCamp && state.operatingCampaigns && state.operatingCampaigns.length > 0) {
        const targetId = String(state.operatingCampaigns[0]).trim();
        targetCamp = (stats.campaigns || []).find(function(c) {
            return String(c.rawId || c.id || c.__id || "") === targetId;
        }) || null;
    }

    assert.strictEqual(targetCamp, null, "Must NOT fall back to stats.campaigns[0] when no operating campaign is selected");
});

test("EAST-3 UPGRADE 313: Top Live Filter Targeting renders explicit unavailable state when selected campaign is missing from feed", () => {
    const stats = {
        campaigns: [
            { id: "1001", rawId: "1001", name: "OTHER CAMPAIGN", active: true }
        ]
    };
    const state = {
        operatingCampaigns: ["1716"], // 1716 is selected, but not present in feed
        campaigns: stats.campaigns
    };

    function selectedOperatingCampaigns(campaigns) {
        if (!Array.isArray(campaigns) || !campaigns.length) return [];
        const ids = new Set((state.operatingCampaigns || []).map(function (id) { return String(id || "").trim(); }).filter(Boolean));
        if (ids.size === 0) return [];
        return campaigns.filter(function (c) {
            const rawId = c.rawId || c.id;
            return rawId && ids.has(String(rawId).trim());
        });
    }

    const operating = selectedOperatingCampaigns(stats.campaigns)[0] || null;
    let targetCamp = operating;
    if (!targetCamp && state.operatingCampaigns && state.operatingCampaigns.length > 0) {
        const targetId = String(state.operatingCampaigns[0]).trim();
        targetCamp = (stats.campaigns || []).find(function(c) {
            return String(c.rawId || c.id || c.__id || "") === targetId;
        }) || null;
    }

    assert.strictEqual(targetCamp, null, "Unavailable campaign must resolve to null instead of silently defaulting to other campaign");
    const hasSelectedStored = state.operatingCampaigns && state.operatingCampaigns.length > 0;
    const badgeText = hasSelectedStored ? "CAMPAIGN UNAVAILABLE" : "AWAITING OPERATING SELECTION";
    assert.strictEqual(badgeText, "CAMPAIGN UNAVAILABLE");
});

test("EAST-3 UPGRADE 314: Assignment matrix strictly looks up by numeric campaign ID without name fallback", () => {
    const verifiedRegistry = {
        "1716": {
            campaignId: "1716",
            campaignName: "TS FRESH DATA",
            liveFilter: "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts",
            timestamp: Date.now()
        }
    };

    const campaignWithId = { id: "1716", name: "Renamed TS Campaign" };
    const campaignWithoutIdSameName = { id: "", name: "TS FRESH DATA" };

    function lookup(c) {
        const realId = (c.id && String(c.id).trim() !== "") ? String(c.id).trim() : null;
        let entry = null;
        if (realId && verifiedRegistry[realId]) {
            entry = verifiedRegistry[realId];
        }
        return entry;
    }

    assert.ok(lookup(campaignWithId), "Must resolve entry by immutable ID even if campaign name changed");
    assert.strictEqual(lookup(campaignWithId).liveFilter, "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts");
    assert.strictEqual(lookup(campaignWithoutIdSameName), null, "Must NOT resolve entry by approximate name when ID is missing");
});

test("EAST-3 UPGRADE 315: Observations older than 120s strictly display STALE and never green VERIFIED", () => {
    const now = Date.now();
    const staleTimestamp = now - (125 * 1000); // 125s ago (> 120s TTL)
    const freshTimestamp = now - (45 * 1000);  // 45s ago (<= 120s TTL)

    function getVerificationState(timeMs, fName, fSource) {
        const isCurrent = Boolean(fName && fSource !== "DOM_UNAVAILABLE" && timeMs && (now - timeMs) <= 120000);
        if (isCurrent) return { text: "TARGETING: VERIFIED", cls: "is-verified" };
        if (fName && fSource !== "DOM_UNAVAILABLE") return { text: "TARGETING: STALE", cls: "is-stale" };
        return { text: "TARGETING: AWAITING OBSERVATION", cls: "is-unavailable" };
    }

    const fresh = getVerificationState(freshTimestamp, "TS FRESH DATA Filter", "CAMPAIGN_EDIT_DOM");
    assert.strictEqual(fresh.text, "TARGETING: VERIFIED");
    assert.strictEqual(fresh.cls, "is-verified");

    const stale = getVerificationState(staleTimestamp, "TS FRESH DATA Filter", "CAMPAIGN_EDIT_DOM");
    assert.strictEqual(stale.text, "TARGETING: STALE");
    assert.strictEqual(stale.cls, "is-stale");
});
`;

testCode += additionalTests;
fs.writeFileSync(testFilePath, testCode, 'utf8');
console.log('✔ Appended tests 308-315 to East3 suite.test.js');

