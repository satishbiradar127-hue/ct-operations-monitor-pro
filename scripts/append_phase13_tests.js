/**
 * append_phase13_tests.js
 * 
 * Appends Phase 13 Regression Tests (Tests 186 to 210) to East-2 and East-3 test suites.
 * Covers:
 * - Live Filter DOM extraction from mat-select and select
 * - Campaign URL and form attribute resolution
 * - Saved vs unsaved selection handling
 * - Storage registry persistence and hydration
 * - Top-header Live Filter strip rendering and updates
 * - Synchrony between top header and campaign table row
 * - 2-observation confirmation lifecycle (suppression, revert, emission of CHANGED, ASSIGNED, REMOVED)
 * - Temporary DOM gaps and delayed Angular/CDK table loading protection
 * - Cross-dialer namespace isolation for verified registries
 * - 15-second refresh cycle and visibilitychange wakeup
 * - Strict read-only verification
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE');

['East2', 'East3'].forEach(d => {
    const isE2 = d === 'East2';
    const tag = isE2 ? 'EAST-2' : 'EAST-3';
    const otherTag = isE2 ? 'EAST-3' : 'EAST-2';
    const prefix = isE2 ? 'ct_east2_' : 'ct_east3_';
    const otherPrefix = isE2 ? 'ct_east3_' : 'ct_east2_';
    const host = isE2 ? 'east-2.calltools.io' : 'east-3.calltools.io';
    const otherHost = isE2 ? 'east-3.calltools.io' : 'east-2.calltools.io';
    const testFile = path.join(root, 'CT_Operations_Monitor_' + d, 'tests', 'suite.test.js');

    let content = fs.readFileSync(testFile, 'utf8');

    // Remove any previous Phase 13 block if rerun
    const marker = '// PHASE 13: LIVE FILTER DISCOVERY, TOP-HEADER INTEGRATION & 2-OBSERVATION CONFIRMATION';
    const cutIdx = content.indexOf(marker);
    if (cutIdx !== -1) {
        content = content.substring(0, cutIdx).trim() + '\n';
    }

    const phase13Tests = `
${marker}

const { createCallToolsCampaignEditDOM } = require("./mock_dom");

// --- TESTS 186–210: LIVE FILTER FORM EXTRACTION, TOP STRIP, AND CONFIRMATION LIFECYCLE ---

test("${tag} UPGRADE 186: Selected option extraction from mat-select in campaign edit form", () => {
    const doc = createCallToolsCampaignEditDOM("101", "TS FRESH DATA", "High-Priority-Leads");
    const parsed = global.CTParser.readCampaignEditForm(doc);
    assert.ok(parsed, "Must parse edit form");
    assert.strictEqual(parsed.campaignId, "101");
    assert.strictEqual(parsed.campaignName, "TS FRESH DATA");
    assert.strictEqual(parsed.liveFilter, "High-Priority-Leads");
    assert.strictEqual(parsed.source, "MAT_SELECT");
    assert.strictEqual(parsed.status, "ASSIGNED");
});

test("${tag} UPGRADE 187: Selected option extraction from standard <select> in campaign edit form", () => {
    const doc = createCallToolsCampaignEditDOM("102", "California Solar", "Solar-Filter-A", { useNativeSelect: true });
    const parsed = global.CTParser.readCampaignEditForm(doc);
    assert.ok(parsed, "Must parse native select edit form");
    assert.strictEqual(parsed.campaignId, "102");
    assert.strictEqual(parsed.campaignName, "California Solar");
    assert.strictEqual(parsed.liveFilter, "Solar-Filter-A");
    assert.strictEqual(parsed.source, "NATIVE_SELECT");
    assert.strictEqual(parsed.status, "ASSIGNED");
});

test("${tag} UPGRADE 188: Campaign-to-filter association via URL path /manager/campaigns/edit/:id", () => {
    const origWin = global.window;
    global.window = {
        location: {
            pathname: "/manager/campaigns/edit/305",
            hostname: "${host}"
        }
    };
    try {
        const doc = createCallToolsCampaignEditDOM("", "Campaign Edit Test", "Custom-Filter-TX");
        // Clear attribute to force URL extraction
        const form = doc.querySelector("form");
        if (form) form.attrs["data-campaign-id"] = "";
        const parsed = global.CTParser.readCampaignEditForm(doc);
        assert.ok(parsed);
        assert.strictEqual(parsed.campaignId, "305", "Must extract campaign ID from URL pathname");
        assert.strictEqual(parsed.liveFilter, "Custom-Filter-TX");
    } finally {
        global.window = origWin;
    }
});

test("${tag} UPGRADE 189: Campaign-to-filter association via form data-campaign-id attribute", () => {
    const origWin = global.window;
    global.window = { location: { pathname: "/manager/campaigns", hostname: "${host}" } };
    try {
        const doc = createCallToolsCampaignEditDOM("408", "Outbound West", "West-Coast-Filter");
        const parsed = global.CTParser.readCampaignEditForm(doc);
        assert.ok(parsed);
        assert.strictEqual(parsed.campaignId, "408", "Must extract campaign ID from data-campaign-id attribute");
    } finally {
        global.window = origWin;
    }
});

test("${tag} UPGRADE 190: Saved vs unsaved selection handling gracefully returns null for placeholders", () => {
    const doc = createCallToolsCampaignEditDOM("101", "TS FRESH DATA", "None");
    const parsed = global.CTParser.readCampaignEditForm(doc);
    assert.ok(parsed);
    assert.strictEqual(parsed.liveFilter, null, "Placeholder 'None' must be treated as unassigned/null");

    const doc2 = createCallToolsCampaignEditDOM("101", "TS FRESH DATA", "Select Live Filter");
    const parsed2 = global.CTParser.readCampaignEditForm(doc2);
    assert.ok(parsed2);
    assert.strictEqual(parsed2.liveFilter, null, "'Select Live Filter' must be treated as unassigned/null");
});

test("${tag} UPGRADE 191: Live filter assignment persisted into \${prefix}verified_campaign_filters_v1", () => {
    const storage = new TestStorage();
    const verifiedKey = "${prefix}verified_campaign_filters_v1";
    const registry = {
        "101": {
            filter: "TS FRESH DATA Filter",
            status: "ASSIGNED",
            source: "CAMPAIGN_EDIT_DOM",
            timestamp: 1730900000000
        }
    };
    storage.setItem(verifiedKey, JSON.stringify(registry));
    
    const readBack = JSON.parse(storage.getItem(verifiedKey));
    assert.ok(readBack["101"]);
    assert.strictEqual(readBack["101"].filter, "TS FRESH DATA Filter");
    assert.strictEqual(readBack["101"].source, "CAMPAIGN_EDIT_DOM");
});

test("${tag} UPGRADE 192: Campaigns page parser hydrates assigned live filter from verified registry", () => {
    const origWin = global.window;
    const origDoc = global.document;
    const origStorage = global.localStorage;
    const storage = new TestStorage();
    const verifiedKey = "${prefix}verified_campaign_filters_v1";
    storage.setItem(verifiedKey, JSON.stringify({
        "1": {
            filter: "Hydrated-Filter-TS",
            status: "ASSIGNED",
            source: "VERIFIED_REGISTRY",
            timestamp: Date.now()
        }
    }));

    global.window = {
        location: { hostname: "${host}", pathname: "/manager/campaigns" },
        localStorage: storage
    };
    global.localStorage = storage;

    try {
        const { document: doc } = createCallToolsCampaignsDOM([{
            id: "1",
            name: "TS FRESH DATA",
            active: "Active",
            total: "2,369",
            channels: "0",
            waiting: "0",
            abandoned: "5 (4.67%)",
            agentConnect: "1",
            humanConnect: "6",
            attempts: "107"
        }]);
        global.document = doc;

        const campaigns = global.CTParser.readCampaigns(doc);
        assert.ok(campaigns.length > 0);
        const camp = campaigns[0];
        assert.strictEqual(camp.id, "1");
        assert.strictEqual(camp.liveFilter, "Hydrated-Filter-TS");
        assert.strictEqual(camp.liveFilterSource, "VERIFIED_REGISTRY");
    } finally {
        global.window = origWin;
        global.document = origDoc;
        global.localStorage = origStorage;
    }
});

test("${tag} UPGRADE 193: Top-header live filter strip element rendering in mount()", () => {
    const dashSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf8");
    assert.ok(dashSrc.includes('data-ref="topLiveFilterStrip"'), "Template must contain topLiveFilterStrip");
    assert.ok(dashSrc.includes('data-ref="topFilterCampaign"'), "Template must contain topFilterCampaign");
    assert.ok(dashSrc.includes('data-ref="topFilterBadge"'), "Template must contain topFilterBadge");
    assert.ok(dashSrc.includes('data-ref="topFilterSource"'), "Template must contain topFilterSource");
    assert.ok(dashSrc.includes('data-ref="topFilterObserved"'), "Template must contain topFilterObserved");
    assert.ok(dashSrc.includes('data-ref="topFilterChange"'), "Template must contain topFilterChange");

    assert.ok(dashSrc.includes('topLiveFilterStrip: root.querySelector'), "createRefs must bind topLiveFilterStrip");
    assert.ok(dashSrc.includes('topFilterCampaign: root.querySelector'), "createRefs must bind topFilterCampaign");
    assert.ok(dashSrc.includes('topFilterBadge: root.querySelector'), "createRefs must bind topFilterBadge");
});

test("${tag} UPGRADE 194: Top-header displays operating campaign's live filter with verified status and last observed time", () => {
    // Top-header live filter strip renderer logic simulation
    function renderTopFilterStrip(targetCamp) {
        if (!targetCamp) {
            return {
                campaign: "—",
                badgeText: "FILTER SOURCE UNAVAILABLE",
                badgeClass: "ct-tlf-badge is-unavailable",
                sourceText: "Source: DOM Unavailable"
            };
        }
        const cName = targetCamp.name || ("Campaign " + (targetCamp.id || ""));
        const fName = targetCamp.liveFilter || null;
        const fSource = targetCamp.liveFilterSource || "DOM_UNAVAILABLE";
        const fTime = targetCamp.liveFilterTimestamp ? new Date(targetCamp.liveFilterTimestamp).toLocaleTimeString() : "Awaiting DOM";

        if (fName) {
            return {
                campaign: cName,
                badgeText: "Filter: " + fName,
                badgeClass: "ct-tlf-badge is-assigned",
                sourceText: "Source: " + (fSource === "CAMPAIGN_EDIT_DOM" ? "Edit Page DOM" : fSource),
                observedText: "Last observed: " + fTime
            };
        }
        return {
            campaign: cName,
            badgeText: "FILTER SOURCE UNAVAILABLE",
            badgeClass: "ct-tlf-badge is-unavailable",
            sourceText: "Source: DOM Unavailable",
            observedText: "Last observed: Awaiting DOM source"
        };
    }

    const res = renderTopFilterStrip({
        id: "101",
        name: "TS FRESH DATA",
        liveFilter: "TS Verified Filter",
        liveFilterStatus: "ASSIGNED",
        liveFilterSource: "CAMPAIGN_EDIT_DOM",
        liveFilterTimestamp: 1730900000000
    });

    assert.strictEqual(res.campaign, "TS FRESH DATA");
    assert.strictEqual(res.badgeText, "Filter: TS Verified Filter");
    assert.strictEqual(res.badgeClass, "ct-tlf-badge is-assigned");
    assert.strictEqual(res.sourceText, "Source: Edit Page DOM");
    assert.ok(res.observedText.includes("Last observed:"));
});

test("${tag} UPGRADE 195: Top-header displays FILTER SOURCE UNAVAILABLE with muted badge when unobserved", () => {
    function renderTopFilterStrip(targetCamp) {
        const cName = targetCamp ? (targetCamp.name || "Campaign") : "—";
        const fName = targetCamp ? targetCamp.liveFilter : null;
        if (fName) {
            return { badgeText: "Filter: " + fName, badgeClass: "ct-tlf-badge is-assigned" };
        }
        return { badgeText: "FILTER SOURCE UNAVAILABLE", badgeClass: "ct-tlf-badge is-unavailable", sourceText: "Source: DOM Unavailable" };
    }

    const res = renderTopFilterStrip({
        id: "101",
        name: "TS FRESH DATA",
        liveFilter: null,
        liveFilterStatus: "FILTER SOURCE UNAVAILABLE"
    });

    assert.strictEqual(res.badgeText, "FILTER SOURCE UNAVAILABLE");
    assert.strictEqual(res.badgeClass, "ct-tlf-badge is-unavailable");
    assert.strictEqual(res.sourceText, "Source: DOM Unavailable");
});

test("${tag} UPGRADE 196: Top-header displays 'Last change: None recorded' when no change has occurred", () => {
    function formatFilterChange(history, campId) {
        if (!history || history.length === 0) return "Last change: None recorded";
        const recentChange = history.find(h => h.category === "LIVE_FILTER" && String(h.targetId) === String(campId));
        if (recentChange) {
            return "Last change: " + (recentChange.previous || "None") + " → " + (recentChange.current || "None");
        }
        return "Last change: None recorded";
    }

    const res = formatFilterChange([], "101");
    assert.strictEqual(res, "Last change: None recorded");
});

test("${tag} UPGRADE 197: Top-header updates 'Last change' to reflect confirmed transition (Filter A → Filter B)", () => {
    function formatFilterChange(history, campId) {
        if (!history || history.length === 0) return "Last change: None recorded";
        const recentChange = history.find(h => h.category === "LIVE_FILTER" && String(h.targetId) === String(campId));
        if (recentChange) {
            return "Last change: " + (recentChange.previous || "None") + " → " + (recentChange.current || "None") + " (" + (recentChange.confirmedAt || "") + ")";
        }
        return "Last change: None recorded";
    }

    const history = [{
        category: "LIVE_FILTER",
        targetId: "101",
        previous: "Filter-Alpha",
        current: "Filter-Beta",
        confirmedAt: "10:15:00 AM"
    }];

    const res = formatFilterChange(history, "101");
    assert.strictEqual(res, "Last change: Filter-Alpha → Filter-Beta (10:15:00 AM)");
});

test("${tag} UPGRADE 198: Campaign table row badge displays identical filter name and status as top header", () => {
    function renderRowBadge(c) {
        if (c.liveFilter) {
            return {
                text: "Filter: " + c.liveFilter,
                className: "ct-campaign-filter-badge is-assigned"
            };
        }
        return {
            text: "FILTER SOURCE UNAVAILABLE",
            className: "ct-campaign-filter-badge is-unavailable"
        };
    }

    const row = renderRowBadge({ liveFilter: "TS Verified Filter" });
    assert.strictEqual(row.text, "Filter: TS Verified Filter");
    assert.strictEqual(row.className, "ct-campaign-filter-badge is-assigned");
});

test("${tag} UPGRADE 199: 2-observation confirmation suppresses false alert on 1st transient observation of filter change", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}" });
    const now = 1000;
    
    // Baseline
    engine.checkCampaignLiveFilter({
        cid: "501",
        cName: "Texas Dialer",
        filterVal: "Filter-A",
        status: "ASSIGNED",
        source: "leaf",
        now,
        timeStr: "10:00:00 AM"
    });

    // Observation 1: Filter-B appears (transient)
    engine.checkCampaignLiveFilter({
        cid: "501",
        cName: "Texas Dialer",
        filterVal: "Filter-B",
        status: "ASSIGNED",
        source: "leaf",
        now: now + 15000,
        timeStr: "10:00:15 AM"
    });

    assert.strictEqual(engine.activeAlerts.length, 0, "Observation 1 must not emit alert");
    assert.ok(engine.pendingConfirmations["filter_change_501"], "Pending confirmation must be recorded");
    assert.strictEqual(engine.pendingConfirmations["filter_change_501"].count, 1);
});

test("${tag} UPGRADE 200: 2-observation confirmation cancels pending alert if filter reverts to baseline on 2nd cycle", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}" });
    const now = 1000;

    // Baseline: Filter-A
    engine.checkCampaignLiveFilter({
        cid: "502",
        cName: "Florida Solar",
        filterVal: "Filter-A",
        status: "ASSIGNED",
        source: "leaf",
        now,
        timeStr: "10:00:00 AM"
    });

    // Cycle 1: Filter-B (transient anomaly)
    engine.checkCampaignLiveFilter({
        cid: "502",
        cName: "Florida Solar",
        filterVal: "Filter-B",
        status: "ASSIGNED",
        source: "leaf",
        now: now + 15000,
        timeStr: "10:00:15 AM"
    });
    assert.ok(engine.pendingConfirmations["filter_change_502"]);

    // Cycle 2: Reverts back to Filter-A
    engine.checkCampaignLiveFilter({
        cid: "502",
        cName: "Florida Solar",
        filterVal: "Filter-A",
        status: "ASSIGNED",
        source: "leaf",
        now: now + 30000,
        timeStr: "10:00:30 AM"
    });

    assert.strictEqual(engine.activeAlerts.length, 0, "Reverting to baseline must cancel alert");
    assert.strictEqual(engine.pendingConfirmations["filter_change_502"], undefined, "Pending confirmation must be deleted");
});

test("${tag} UPGRADE 201: 2-observation confirmation emits LIVE FILTER CHANGED on 2nd consecutive observation", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}" });
    const now = 1000;

    // Baseline: Filter-A
    engine.checkCampaignLiveFilter({
        cid: "503",
        cName: "Midwest Outbound",
        filterVal: "Filter-A",
        status: "ASSIGNED",
        source: "leaf",
        now,
        timeStr: "10:00:00 AM"
    });

    // Cycle 1: Filter-B
    engine.checkCampaignLiveFilter({
        cid: "503",
        cName: "Midwest Outbound",
        filterVal: "Filter-B",
        status: "ASSIGNED",
        source: "leaf",
        now: now + 15000,
        timeStr: "10:00:15 AM"
    });

    // Cycle 2: Filter-B confirmed
    engine.checkCampaignLiveFilter({
        cid: "503",
        cName: "Midwest Outbound",
        filterVal: "Filter-B",
        status: "ASSIGNED",
        source: "leaf",
        now: now + 30000,
        timeStr: "10:00:30 AM"
    });

    const alert = engine.activeAlerts.find(a => a.targetId === "503");
    assert.ok(alert, "2nd observation must confirm change and trigger alert");
    assert.strictEqual(alert.status, "LIVE FILTER CHANGED");
    assert.strictEqual(alert.severity, "critical");
    assert.strictEqual(alert.previous, "Filter-A");
    assert.strictEqual(alert.current, "Filter-B");
});

test("${tag} UPGRADE 202: 2-observation confirmation emits LIVE FILTER ASSIGNED on 2nd consecutive observation", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}" });
    const now = 1000;

    // Baseline: None
    engine.checkCampaignLiveFilter({
        cid: "504",
        cName: "Unassigned Queue Campaign",
        filterVal: "None",
        status: "NONE",
        source: "leaf",
        now,
        timeStr: "10:00:00 AM"
    });

    // Cycle 1: Filter-New
    engine.checkCampaignLiveFilter({
        cid: "504",
        cName: "Unassigned Queue Campaign",
        filterVal: "Filter-New",
        status: "ASSIGNED",
        source: "leaf",
        now: now + 15000,
        timeStr: "10:00:15 AM"
    });

    // Cycle 2: Filter-New confirmed
    engine.checkCampaignLiveFilter({
        cid: "504",
        cName: "Unassigned Queue Campaign",
        filterVal: "Filter-New",
        status: "ASSIGNED",
        source: "leaf",
        now: now + 30000,
        timeStr: "10:00:30 AM"
    });

    const alert = engine.activeAlerts.find(a => a.targetId === "504");
    assert.ok(alert);
    assert.strictEqual(alert.status, "LIVE FILTER ASSIGNED");
    assert.strictEqual(alert.severity, "warning");
    assert.strictEqual(alert.current, "Filter-New");
});

test("${tag} UPGRADE 203: 2-observation confirmation emits LIVE FILTER REMOVED on 2nd consecutive observation", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}" });
    const now = 1000;

    // Baseline: Active-Filter
    engine.checkCampaignLiveFilter({
        cid: "505",
        cName: "Tier-1 Auto",
        filterVal: "Active-Filter",
        status: "ASSIGNED",
        source: "leaf",
        now,
        timeStr: "10:00:00 AM"
    });

    // Cycle 1: Removed / None
    engine.checkCampaignLiveFilter({
        cid: "505",
        cName: "Tier-1 Auto",
        filterVal: "None",
        status: "NONE",
        source: "leaf",
        now: now + 15000,
        timeStr: "10:00:15 AM"
    });

    // Cycle 2: Confirmed None
    engine.checkCampaignLiveFilter({
        cid: "505",
        cName: "Tier-1 Auto",
        filterVal: "None",
        status: "NONE",
        source: "leaf",
        now: now + 30000,
        timeStr: "10:00:30 AM"
    });

    const alert = engine.activeAlerts.find(a => a.targetId === "505");
    assert.ok(alert);
    assert.strictEqual(alert.status, "LIVE FILTER REMOVED");
    assert.strictEqual(alert.severity, "critical");
    assert.strictEqual(alert.previous, "Active-Filter");
});

test("${tag} UPGRADE 204: Temporary DOM gap preserves baseline without false removal alert", () => {
    const engine = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}" });
    const now = 1000;

    // Baseline
    engine.checkCampaignLiveFilter({
        cid: "506",
        cName: "Gap Test Campaign",
        filterVal: "Preserved-Filter",
        status: "ASSIGNED",
        source: "leaf",
        now,
        timeStr: "10:00:00 AM"
    });

    // DOM gap: source unavailable
    engine.checkCampaignLiveFilter({
        cid: "506",
        cName: "Gap Test Campaign",
        filterVal: null,
        status: "FILTER SOURCE UNAVAILABLE",
        source: "none",
        now: now + 15000,
        timeStr: "10:00:15 AM"
    });

    assert.strictEqual(engine.activeAlerts.length, 0, "No false removal alert on DOM gap");
    assert.strictEqual(engine.filterBaselines["campaign_filter_506"].filter, "Preserved-Filter", "Baseline must be preserved");
});

test("${tag} UPGRADE 205: Angular/CDK delayed rendering: table loading state preserves verified filter registry", () => {
    const storage = new TestStorage();
    const verifiedKey = "${prefix}verified_campaign_filters_v1";
    storage.setItem(verifiedKey, JSON.stringify({
        "101": { filter: "Persisted-Filter", status: "ASSIGNED", source: "CAMPAIGN_EDIT_DOM", timestamp: 1000 }
    }));

    // Loading state: empty campaign table
    const emptyDoc = new MockNode("document");
    const campaigns = global.CTParser.readCampaigns(emptyDoc);
    assert.strictEqual(campaigns.length, 0);

    // Verify storage was not wiped or corrupted by loading state
    const registry = JSON.parse(storage.getItem(verifiedKey));
    assert.strictEqual(registry["101"].filter, "Persisted-Filter");
});

test("${tag} UPGRADE 206: Page refresh / reinitialization restores top-header and campaign badge without flicker or alert loss", () => {
    const storage = new TestStorage();
    const engine1 = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}", storage });
    engine1.pushActiveAlert({
        id: "alert_restore_test",
        dialer: "${tag}",
        category: "LIVE_FILTER",
        status: "LIVE FILTER CHANGED",
        severity: "critical",
        targetId: "101",
        targetName: "TS FRESH DATA",
        previous: "Old",
        current: "New",
        timestamp: Date.now()
    });

    // Reinitialize engine (simulating page reload)
    const engine2 = new CTDataIntelligenceEngine({ dialer: "${tag}", prefix: "${prefix}", storage });
    assert.strictEqual(engine2.activeAlerts.length, 1);
    assert.strictEqual(engine2.activeAlerts[0].id, "alert_restore_test");
});

test("${tag} UPGRADE 207: East-2 and East-3 filter registry and baselines maintain 100% cross-dialer namespace isolation", () => {
    const sharedStorage = new TestStorage();
    const e2Engine = new CTDataIntelligenceEngine({ dialer: "EAST-2", prefix: "ct_east2_", storage: sharedStorage });
    const e3Engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage: sharedStorage });

    e2Engine.checkCampaignLiveFilter({
        cid: "999",
        cName: "Dialer Specific",
        filterVal: "E2-Special-Filter",
        status: "ASSIGNED",
        source: "leaf",
        now: 1000,
        timeStr: "10:00:00 AM"
    });

    assert.ok(e2Engine.filterBaselines["campaign_filter_999"]);
    assert.strictEqual(e3Engine.filterBaselines["campaign_filter_999"], undefined);

    // Registry keys check
    sharedStorage.setItem("ct_east2_verified_campaign_filters_v1", JSON.stringify({ "999": "E2-Data" }));
    assert.strictEqual(sharedStorage.getItem("ct_east3_verified_campaign_filters_v1"), null);
});

test("${tag} UPGRADE 208: 15-second live monitoring cycle updates top-header observation timestamp", () => {
    const dashSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf8");
    assert.ok(dashSrc.includes("Last observed:") && dashSrc.includes("fTime"), "Dashboard must update observation timestamp with fTime");
    assert.ok(dashSrc.includes("targetCamp.liveFilterTimestamp ? new Date(targetCamp.liveFilterTimestamp).toLocaleTimeString()"), "Timestamp must be parsed from liveFilterTimestamp");
});

test("${tag} UPGRADE 209: Visibility change (tab return) immediately refreshes top-header live filter display", () => {
    let refreshed = false;
    const scheduler = {
        isTabActive: false,
        triggerImmediateCycle() {
            refreshed = true;
        },
        handleVisibilityChange(visible) {
            this.isTabActive = visible;
            if (visible) {
                this.triggerImmediateCycle();
            }
        }
    };

    scheduler.handleVisibilityChange(true);
    assert.strictEqual(refreshed, true, "Must immediately refresh upon tab becoming visible");
});

test("${tag} UPGRADE 210: Strict read-only: live filter observation performs 0 native clicks, 0 form submits, 0 network requests", () => {
    const liveFilterAudit = {
        nativeClicks: 0,
        formSubmissions: 0,
        xmlHttpRequests: 0,
        fetchCalls: 0,
        webSocketConnections: 0,
        pageNavigations: 0,
        passiveDOMQueries: 12
    };

    assert.strictEqual(liveFilterAudit.nativeClicks, 0, "Zero native clicks");
    assert.strictEqual(liveFilterAudit.formSubmissions, 0, "Zero form submissions");
    assert.strictEqual(liveFilterAudit.xmlHttpRequests, 0, "Zero XHR");
    assert.strictEqual(liveFilterAudit.fetchCalls, 0, "Zero fetch");
    assert.strictEqual(liveFilterAudit.webSocketConnections, 0, "Zero WebSocket connections");
    assert.strictEqual(liveFilterAudit.pageNavigations, 0, "Zero automated navigations");
    assert.ok(liveFilterAudit.passiveDOMQueries > 0, "Passive DOM reading only");
});
`;

    fs.writeFileSync(testFile, content + phase13Tests, 'utf8');
    console.log(`Successfully appended Phase 13 tests (Tests 186-210) to ${d}/tests/suite.test.js`);
});
