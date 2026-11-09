const fs = require("fs");
const path = require("path");

const releaseDir = path.resolve(__dirname, "..", "CT_OPERATIONS_DUAL_DIALER_RELEASE");

["East2", "East3"].forEach(dialer => {
    const isE3 = dialer === "East3";
    const srcDir = path.join(releaseDir, `CT_Operations_Monitor_${dialer}`, "src");
    const dTag = isE3 ? "EAST-3" : "EAST-2";
    const pfx = isE3 ? "ct_east3_" : "ct_east2_";
    const host = isE3 ? "east-3.calltools.io" : "east-2.calltools.io";

    console.log(`\n==================================================`);
    console.log(`APPLYING MASTER SYSTEM REPAIR TO ${dTag}`);
    console.log(`==================================================`);

    // ----------------------------------------------------
    // 1. REPAIR PARSER.JS
    // ----------------------------------------------------
    const parserPath = path.join(srcDir, "parser.js");
    let parser = fs.readFileSync(parserPath, "utf8");

    // Version update
    parser = parser.replace(
        /console\.log\("CT Operations Monitor parser loaded \([^\)]+\) — v[0-9\.]+"\);/,
        `console.log("CT Operations Monitor parser loaded (${dTag}) — v11.3.4");`
    );

    // Precise campaign ID extraction and leadList in parseCampaignRow
    const targetCampaignIdBlock = `            const idNode = row.querySelector(
                '[data-campaign-id], [data-id], [data-campaignid], [data-campaign-id]'
            );
            let id = idNode
                ? (idNode.getAttribute("data-campaign-id") || idNode.getAttribute("data-id") || idNode.getAttribute("data-campaignid"))
                : (row.getAttribute("data-campaign-id") || row.getAttribute("data-id") || "");
            if (!id) {
                const editLink = row.querySelector("a[href*='/manager/campaigns/edit/'], a[href*='/campaigns/edit/'], button[data-id]");
                if (editLink) {
                    const href = editLink.getAttribute("href") || "";
                    const m = href.match(/\\/campaigns\\/edit\\/([a-zA-Z0-9_\\-]+)/);
                    if (m) id = m[1];
                    else if (editLink.getAttribute("data-id")) id = editLink.getAttribute("data-id");
                }
            }`;

    const replacementCampaignIdBlock = `            // 1. Precise Campaign ID Extraction (Stable Numeric ID)
            let id = null;
            const idNode = row.querySelector('[data-campaign-id], [data-id], [data-campaignid]');
            if (idNode) {
                const rawAttr = (idNode.getAttribute("data-campaign-id") || idNode.getAttribute("data-id") || idNode.getAttribute("data-campaignid") || "").trim();
                if (/^[0-9]+$/.test(rawAttr)) id = rawAttr;
            }
            if (!id) {
                const rowAttr = (row.getAttribute("data-campaign-id") || row.getAttribute("data-id") || "").trim();
                if (/^[0-9]+$/.test(rowAttr)) id = rowAttr;
            }
            if (!id) {
                const candidates = Array.from(row.querySelectorAll("a[href], button[data-id], [data-campaign-id], [data-id]"));
                for (const el of candidates) {
                    const did = (el.getAttribute("data-campaign-id") || el.getAttribute("data-id") || el.getAttribute("data-campaignid") || "").trim();
                    if (/^[0-9]+$/.test(did)) {
                        id = did;
                        break;
                    }
                    const href = el.getAttribute("href") || "";
                    const m = href.match(/\\/(?:campaigns\\/(?:edit|members|agent-dashboard-settings|change-logs|preview|overview)|campaign)\\/([0-9]+)/i) ||
                              href.match(/[?&](?:campaign|campaign_id|campaignId|logged_in_agents_for_campaign)=([0-9]+)/i);
                    if (m && m[1]) {
                        id = m[1];
                        break;
                    }
                }
            }

            // Detect lead list/file if visibly exposed in native DOM
            let leadList = null;
            const leadListCell = row.querySelector(".cdk-column-lead_file, .cdk-column-contact_list, .cdk-column-lead_pool, [data-column='lead_file'], [data-column='contact_list']");
            if (leadListCell) {
                const txt = String(leadListCell.innerText || leadListCell.textContent || "").trim();
                if (txt) leadList = txt;
            }`;

    if (parser.includes(targetCampaignIdBlock)) {
        parser = parser.replace(targetCampaignIdBlock, replacementCampaignIdBlock);
        console.log(`[PASS] Repaired campaign ID and leadList extraction in ${dialer}/parser.js`);
    } else {
        console.warn(`[WARN] Target campaign ID block not found in ${dialer}/parser.js`);
    }

    // Include rawId and leadList in returned campaign record
    const targetCampaignReturn = `            return {
                id: id || "",
                rowIndex: index,`;
    const replacementCampaignReturn = `            return {
                id: id || "",
                rawId: id || null,
                leadList: leadList || null,
                rowIndex: index,`;
    if (parser.includes(targetCampaignReturn)) {
        parser = parser.replace(targetCampaignReturn, replacementCampaignReturn);
        console.log(`[PASS] Added rawId and leadList to campaign return in ${dialer}/parser.js`);
    }

    // Repair readLiveFilters to eliminate synthetic filter-0 IDs
    const targetLiveFilterId = `            let filterId = row.getAttribute("data-id") || row.getAttribute("data-live-filter-id") || "";
            if (!filterId) {
                const actionLink = row.querySelector("a[href*='/manager/live-filters/'], a[href*='/live-filters/'], button[data-id]");
                if (actionLink) {
                    const href = actionLink.getAttribute("href") || "";
                    const m = href.match(/\\/live-filters\\/(?:edit|preview|change-logs)\\/([0-9a-zA-Z_-]+)/);
                    if (m) filterId = m[1];
                    else if (actionLink.getAttribute("data-id")) filterId = actionLink.getAttribute("data-id");
                }
            }`;

    const replacementLiveFilterId = `            let filterId = null;
            const rawIdAttr = (row.getAttribute("data-id") || row.getAttribute("data-live-filter-id") || "").trim();
            if (/^[0-9]+$/.test(rawIdAttr)) filterId = rawIdAttr;

            if (!filterId) {
                const actionLinks = Array.from(row.querySelectorAll("a[href], button[data-id]"));
                for (const el of actionLinks) {
                    const did = (el.getAttribute("data-id") || el.getAttribute("data-live-filter-id") || "").trim();
                    if (/^[0-9]+$/.test(did)) {
                        filterId = did;
                        break;
                    }
                    const href = el.getAttribute("href") || "";
                    const m = href.match(/\\/live-filters\\/(?:edit|preview|change-logs)\\/([0-9]+)/i) ||
                              href.match(/[?&](?:filter|filter_id|live_filter)=([0-9]+)/i);
                    if (m && m[1]) {
                        filterId = m[1];
                        break;
                    }
                }
            }`;

    if (parser.includes(targetLiveFilterId)) {
        parser = parser.replace(targetLiveFilterId, replacementLiveFilterId);
        console.log(`[PASS] Repaired live filter ID extraction in ${dialer}/parser.js`);
    }

    const targetFilterReturn = `            return {
                id: filterId || \`filter-\${index}\`,
                name: name || (filterId ? \`Filter \${filterId}\` : \`Filter \${index + 1}\`),`;
    const replacementFilterReturn = `            const stableId = filterId || (name ? name.toLowerCase().replace(/[^a-z0-9_-]/g, "_") : \`filter-\${index}\`);
            return {
                id: stableId,
                rawId: filterId || null,
                name: name || (filterId ? \`Filter \${filterId}\` : \`Filter \${index + 1}\`),`;
    if (parser.includes(targetFilterReturn)) {
        parser = parser.replace(targetFilterReturn, replacementFilterReturn);
        console.log(`[PASS] Repaired live filter return record in ${dialer}/parser.js`);
    }

    fs.writeFileSync(parserPath, parser, "utf8");

    // ----------------------------------------------------
    // 2. REPAIR INTELLIGENCE.JS
    // ----------------------------------------------------
    const intelPath = path.join(srcDir, "intelligence.js");
    let intel = fs.readFileSync(intelPath, "utf8");

    // Version update
    intel = intel.replace(
        /version: "11\.3\.[0-9]+"/g,
        `version: "11.3.4"`
    );

    // Replace getLiveFilterIntelligenceSummary implementation
    const targetLfiSummaryStart = `            const items = inventory.items || {};
            const filterList = Object.values(items);
            const totalFilters = filterList.length;
            const activeFilters = filterList.filter(f => f.active === true || f.active === "true" || String(f.active).toLowerCase() === "true").length;
            const totalContacts = filterList.reduce((sum, f) => sum + (Number(f.count) || 0), 0);

            // Campaign evaluation
            const campaigns = (stats && Array.isArray(stats.campaigns)) ? stats.campaigns : [];
            let runningCampaignsCount = 0;
            let verifiedActiveConfigs = 0;
            let staleCount = 0;
            let missingVerificationCount = 0;

            const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

            const matrix = campaigns.map((c, idx) => {
                const cid = String(c.id || c.__id || \`campaign-\${idx}\`);
                const cName = String(c.name || c.__name || \`Campaign \${cid}\`).trim();
                const agents = Number(c.agents ?? c.__agents ?? 0);
                const rawState = String(c.state || c.__state || "").trim().toUpperCase();
                const isRunning = rawState === "ACTIVE" || rawState === "RUNNING" || agents > 0;
                if (isRunning) runningCampaignsCount++;`;

    const replacementLfiSummaryStart = `            const items = inventory.items || {};
            const filterList = Object.values(items);
            const hasInventory = filterList.length > 0 && Boolean(inventory.lastObservedAt);
            const totalFilters = hasInventory ? filterList.length : null;
            const activeFilters = hasInventory ? filterList.filter(f => f.active === true || f.active === "true" || String(f.active).toLowerCase() === "true").length : null;
            const totalContacts = hasInventory ? filterList.reduce((sum, f) => sum + (Number(f.count) || 0), 0) : null;

            // Campaign evaluation
            const campaigns = (stats && Array.isArray(stats.campaigns)) ? stats.campaigns : [];
            let runningCampaignsCount = 0;
            let verifiedActiveConfigs = 0;
            let staleCount = 0;
            let missingVerificationCount = 0;

            const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

            const matrix = campaigns.map((c, idx) => {
                // Strict Real ID: Never fabricate synthetic campaign-0
                const realId = (c.id && String(c.id).trim() !== "") ? String(c.id).trim() :
                               (c.rawId && String(c.rawId).trim() !== "") ? String(c.rawId).trim() :
                               (c.__id && !String(c.__id).startsWith("campaign-") ? String(c.__id).trim() : null);
                const displayId = realId || "Awaiting ID";
                const cName = String(c.name || c.__name || (realId ? \`Campaign \${realId}\` : "Unnamed Campaign")).trim();

                // Robust running state calculation
                const agents = Number(c.loggedIn ?? c.__loggedIn ?? c._metrics?.loggedIn?.value ?? c.agents ?? c.__agents ?? 0);
                const rawState = String(c.state || c.__state || "").trim().toUpperCase();
                const isActiveBool = c.active === true || c.__active === true || c.__operational === true;
                const isRunning = isActiveBool || rawState === "ACTIVE" || rawState === "RUNNING" || agents > 0;
                if (isRunning) runningCampaignsCount++;`;

    if (intel.includes(targetLfiSummaryStart)) {
        intel = intel.replace(targetLfiSummaryStart, replacementLfiSummaryStart);
        console.log(`[PASS] Repaired LFI summary initialization and running count in ${dialer}/intelligence.js`);
    } else {
        console.warn(`[WARN] Target LFI summary start not found in ${dialer}/intelligence.js`);
    }

    // Replace cid registry lookup
    intel = intel.replace(
        `                // Lookup verified assignment by ID first, then name
                let entry = null;
                if (cid && verifiedRegistry[cid]) {
                    entry = verifiedRegistry[cid];`,
        `                // Lookup verified assignment by real ID first, then name
                let entry = null;
                if (realId && verifiedRegistry[realId]) {
                    entry = verifiedRegistry[realId];`
    );

    // Replace matrix return record in intelligence.js
    const targetMatrixReturn = `                return {
                    campaignId: cid,
                    campaignName: cName,
                    state: isRunning ? "RUNNING" : (rawState || "IDLE"),
                    assignedFilter: hasFilter ? assignedFilter : (assignedFilter === "None" ? "None Assigned" : "Filter Unavailable"),
                    filterId: filterId,
                    verification: verification,
                    usageStatus: usageStatus,
                    lastObserved: observationTime,
                    agents: agents,
                    leads: c.contactCount || c.liveLeads || 0
                };`;

    const replacementMatrixReturn = `                const leadsVal = (c.contacts && typeof c.contacts === "object" && c.contacts.value !== undefined) ? c.contacts.value :
                                 (c._metrics && c._metrics.contacts && c._metrics.contacts.value !== undefined) ? c._metrics.contacts.value :
                                 (c.contacts !== undefined && c.contacts !== null && c.contacts !== "" && !isNaN(Number(c.contacts))) ? Number(c.contacts) :
                                 (c.contactCount !== undefined ? c.contactCount : null);

                return {
                    campaignId: displayId,
                    rawId: realId,
                    campaignName: cName,
                    state: isRunning ? (agents > 0 ? "RUNNING" : "ACTIVE") : (isActiveBool ? "ACTIVE" : (rawState || "IDLE")),
                    assignedFilter: hasFilter ? assignedFilter : (assignedFilter === "None" ? "None Assigned" : "Filter Unavailable"),
                    filterId: filterId,
                    leadList: c.leadList || "UNAVAILABLE",
                    verification: !realId && verification.startsWith("DOM_UNAVAILABLE") ? "UNVERIFIED_DOM (Awaiting ID)" : verification,
                    usageStatus: usageStatus,
                    lastObserved: observationTime,
                    lastRefill: "Not exposed by available source",
                    agents: agents,
                    leads: leadsVal !== null ? leadsVal : "UNAVAILABLE",
                    dialer: this.dialer
                };`;

    if (intel.includes(targetMatrixReturn)) {
        intel = intel.replace(targetMatrixReturn, replacementMatrixReturn);
        console.log(`[PASS] Repaired matrix return in ${dialer}/intelligence.js`);
    }

    // Replace returned summary structure
    const targetReturnedSummary = `            let inventoryFreshness = "No inventory recorded";
            if (inventory.lastObservedAt) {
                const diffSec = Math.floor((now - inventory.lastObservedAt) / 1000);
                if (diffSec < 60) inventoryFreshness = \`Fresh (\${diffSec}s ago)\`;
                else if (diffSec < 3600) inventoryFreshness = \`\${Math.floor(diffSec / 60)}m ago\`;
                else inventoryFreshness = \`\${Math.floor(diffSec / 3600)}h ago\`;
            }

            return {
                summary: {
                    totalFilters,
                    activeFilters,
                    totalContacts,
                    runningCampaignsCount,
                    verifiedActiveConfigurations: verifiedActiveConfigs
                },
                inventory: filterList.map(f => ({
                    id: f.id,
                    name: f.name,
                    status: (f.active === true || f.active === "true" || String(f.active).toLowerCase() === "true") ? "ACTIVE" : "INACTIVE",
                    count: Number(f.count) || 0,
                    totalCount: Number(f.totalCount) || Number(f.count) || 0,
                    dialer: this.dialer,
                    observedAt: f.observedAt
                })),
                assignmentMatrix: matrix,
                changeHistory: (this.liveFilterChangeHistory || []).slice(0, 20),
                health: {
                    dialer: this.dialer,
                    inventoryFreshness,
                    lastObservedAt: inventory.lastObservedAt,
                    staleCount,
                    missingVerificationCount,
                    hasInventory: totalFilters > 0
                }
            };`;

    const replacementReturnedSummary = `            let inventoryFreshness = "Awaiting observation (/manager/live-filters)";
            if (inventory.lastObservedAt) {
                const diffSec = Math.floor((now - inventory.lastObservedAt) / 1000);
                if (diffSec < 60) inventoryFreshness = \`Fresh (\${diffSec}s ago)\`;
                else if (diffSec < 3600) inventoryFreshness = \`\${Math.floor(diffSec / 60)}m ago\`;
                else inventoryFreshness = \`\${Math.floor(diffSec / 3600)}h ago\`;
            }

            return {
                summary: {
                    totalFilters,
                    activeFilters,
                    totalContacts,
                    runningCampaignsCount,
                    verifiedActiveConfigurations: verifiedActiveConfigs
                },
                inventory: filterList.map(f => ({
                    id: f.id,
                    rawId: f.rawId || null,
                    name: f.name,
                    status: (f.active === true || f.active === "true" || String(f.active).toLowerCase() === "true") ? "ACTIVE" : "INACTIVE",
                    count: Number(f.count) || 0,
                    totalCount: Number(f.totalCount) || Number(f.count) || 0,
                    dialer: this.dialer,
                    observedAt: f.observedAt,
                    lastRefill: "Not exposed by available source"
                })),
                assignmentMatrix: matrix,
                changeHistory: (this.liveFilterChangeHistory || []).slice(0, 20),
                health: {
                    dialer: this.dialer,
                    inventoryFreshness,
                    lastObservedAt: inventory.lastObservedAt || null,
                    staleCount,
                    missingVerificationCount,
                    hasInventory: hasInventory,
                    inventoryStatus: hasInventory ? "OBSERVED" : "AWAITING_OBSERVATION",
                    missingPages: hasInventory ? [] : ["/manager/live-filters"]
                }
            };`;

    if (intel.includes(targetReturnedSummary)) {
        intel = intel.replace(targetReturnedSummary, replacementReturnedSummary);
        console.log(`[PASS] Repaired inventory and health returned summary in ${dialer}/intelligence.js`);
    }

    // Add refresh history methods before end of CTDataIntelligenceEngine class
    if (!intel.includes("getRefreshHistory()")) {
        const targetClassEnd = `        }\n    }\n\n    return {`;
        const replacementClassEnd = `        }

        getRefreshHistory() {
            try {
                const raw = this.storage ? this.storage.getItem(this.prefix + "refresh_history_v1") : null;
                return raw ? JSON.parse(raw) : [];
            } catch (e) {
                return [];
            }
        }

        recordRefreshResult(record) {
            try {
                const history = this.getRefreshHistory();
                history.unshift(Object.assign({
                    timestamp: Date.now(),
                    dialer: this.dialer
                }, record));
                const trimmed = history.slice(0, 30);
                if (this.storage) {
                    this.storage.setItem(this.prefix + "refresh_history_v1", JSON.stringify(trimmed));
                }
                return trimmed;
            } catch (e) {
                return [];
            }
        }
    }

    return {`;
        intel = intel.replace(targetClassEnd, replacementClassEnd);
        console.log(`[PASS] Added refresh history methods to ${dialer}/intelligence.js`);
    }

    fs.writeFileSync(intelPath, intel, "utf8");

    // ----------------------------------------------------
    // 3. REPAIR CONTENT.JS
    // ----------------------------------------------------
    const contentPath = path.join(srcDir, "content.js");
    let content = fs.readFileSync(contentPath, "utf8");

    // Version update
    content = content.replace(
        /console\.log\("CT Operations Monitor \([^\)]+\) — Production live feed controller v[0-9\.]+"\);/,
        `console.log("CT Operations Monitor (${dTag}) — Production live feed controller v11.3.4");`
    );

    // Source-aware Refresh Coordinator in content.js
    const targetRefreshEventListener = `    document.addEventListener("${dTag === "EAST-3" ? "CT_EAST_3_REQUEST_REFRESH" : "CT_EAST_2_REQUEST_REFRESH"}", function () {
        lastSourceRefreshAt = Date.now();
        if (isQueuesPage()) {
            publishFeedStatus("VERIFYING", { reason: "Manual queue feed re-check requested", route: "queues" });
            readAndPublish("manual-queue-refresh-check", true);
            return;
        }
        publishFeedStatus("VERIFYING", { reason: "Manual campaign feed re-check requested", route: "campaigns" });
        readAndPublish("manual-campaign-refresh", true);
    });`;

    const replacementRefreshEventListener = `    document.addEventListener("${dTag === "EAST-3" ? "CT_EAST_3_REQUEST_REFRESH" : "CT_EAST_2_REQUEST_REFRESH"}", function () {
        const now = Date.now();
        lastSourceRefreshAt = now;
        const route = currentRoute();
        let recordsRead = 0;
        let result = "SUCCESS";
        let failureReason = null;
        let unavailableSources = [];

        if (route === "campaigns") {
            publishFeedStatus("VERIFYING", { reason: "Manual campaign feed re-check requested", route: "campaigns" });
            readAndPublish("manual-campaign-refresh", true);
            const campaigns = window.CTParser && window.CTParser.readCampaigns ? window.CTParser.readCampaigns() : [];
            recordsRead = campaigns.length;
            unavailableSources = ["/manager/live-filters"];
        } else if (route === "live_filters") {
            observeLiveFiltersPage();
            const filters = window.CTParser && window.CTParser.readLiveFilters ? window.CTParser.readLiveFilters(document) : [];
            recordsRead = filters.length;
            unavailableSources = ["/manager/campaigns"];
        } else if (route === "queues") {
            publishFeedStatus("VERIFYING", { reason: "Manual queue feed re-check requested", route: "queues" });
            readAndPublish("manual-queue-refresh-check", true);
            const queues = window.CTParser && window.CTParser.readQueues ? window.CTParser.readQueues() : [];
            recordsRead = queues.length;
            unavailableSources = ["/manager/campaigns", "/manager/live-filters"];
        } else {
            result = "PARTIAL";
            failureReason = "Current page (" + route + ") does not contain primary operational tables";
            unavailableSources = ["/manager/campaigns", "/manager/live-filters", "/manager/queues"];
        }

        const detail = {
            requestAt: now,
            completedAt: Date.now(),
            source: route,
            result: result,
            recordsRead: recordsRead,
            failureReason: failureReason,
            unavailableSources: unavailableSources
        };

        document.dispatchEvent(new CustomEvent("${dTag === "EAST-3" ? "CT_EAST_3_REFRESH_RESULT" : "CT_EAST_2_REFRESH_RESULT"}", { detail: detail }));
    });`;

    if (content.includes(targetRefreshEventListener)) {
        content = content.replace(targetRefreshEventListener, replacementRefreshEventListener);
        console.log(`[PASS] Replaced refresh event listener with coordinator in ${dialer}/content.js`);
    } else {
        console.warn(`[WARN] Target refresh event listener not found in ${dialer}/content.js`);
    }

    fs.writeFileSync(contentPath, content, "utf8");

    // ----------------------------------------------------
    // 4. REPAIR DASHBOARD.JS
    // ----------------------------------------------------
    const dashPath = path.join(srcDir, "dashboard.js");
    let dash = fs.readFileSync(dashPath, "utf8");

    // Version update
    dash = dash.replace(
        /console\.log\("Dashboard Loaded — CT Operations Monitor Pro \([^\)]+\) v[0-9\.]+"\);/,
        `console.log("Dashboard Loaded — CT Operations Monitor Pro (${dTag}) v11.3.4");`
    );

    // Bump layout version to 20 & fix keys to use PREFIX
    dash = dash.replace(
        /const LAYOUT_KEY = "[^"]+";/,
        `const LAYOUT_KEY = "${pfx}dashboard_layout_v20";`
    );
    dash = dash.replace(
        /const LAYOUT_VERSION = [0-9]+;/,
        `const LAYOUT_VERSION = 20;`
    );
    dash = dash.replace(
        'const SELECTED_CAMPAIGNS_KEY = "ct_east2_selected_campaign_ids_v1";',
        `const SELECTED_CAMPAIGNS_KEY = "${pfx}selected_campaign_ids_v1";`
    );
    dash = dash.replace(
        'const FILTER_STATE_KEY = "ct_east2_campaign_state_filter_v1";',
        `const FILTER_STATE_KEY = "${pfx}campaign_state_filter_v1";`
    );
    dash = dash.replace(
        'const FILTER_HEALTH_KEY = "ct_east2_campaign_health_filter_v1";',
        `const FILTER_HEALTH_KEY = "${pfx}campaign_health_filter_v1";`
    );

    // Define REFRESH_RESULT_EVENT constant
    if (!dash.includes("REFRESH_RESULT_EVENT")) {
        dash = dash.replace(
            `    const REQUEST_REFRESH_EVENT = "${dTag === "EAST-3" ? "CT_EAST_3_REQUEST_REFRESH" : "CT_EAST_2_REQUEST_REFRESH"}";`,
            `    const REQUEST_REFRESH_EVENT = "${dTag === "EAST-3" ? "CT_EAST_3_REQUEST_REFRESH" : "CT_EAST_2_REQUEST_REFRESH"}";\n    const REFRESH_RESULT_EVENT = "${dTag === "EAST-3" ? "CT_EAST_3_REFRESH_RESULT" : "CT_EAST_2_REFRESH_RESULT"}";`
        );
        console.log(`[PASS] Added REFRESH_RESULT_EVENT constant in ${dialer}/dashboard.js`);
    }

    // Repair Operating Campaign menu toggle: remove getBoundingClientRect fixed positioning
    const targetOperatingToggle = `        refs.operatingTrigger.addEventListener("click", function (event) {
            event.stopPropagation();
            const willOpen = refs.operatingMenu.hidden;
            if (willOpen) {
                const rect = refs.operatingTrigger.getBoundingClientRect();
                refs.operatingMenu.style.position = "fixed";
                refs.operatingMenu.style.top = Math.round(rect.bottom + 4) + "px";
                refs.operatingMenu.style.left = Math.max(10, Math.min(window.innerWidth - 360, Math.round(rect.left))) + "px";
                refs.operatingMenu.style.width = "340px";
                refs.operatingMenu.style.maxHeight = "min(420px, 80vh)";
                refs.operatingMenu.style.zIndex = "1000000";
                refs.operatingMenu.hidden = false;
                refs.operatingTrigger.setAttribute("aria-expanded", "true");
            } else {
                refs.operatingMenu.hidden = true;
                refs.operatingTrigger.setAttribute("aria-expanded", "false");
            }
        });`;

    const replacementOperatingToggle = `        refs.operatingTrigger.addEventListener("click", function (event) {
            event.stopPropagation();
            const willOpen = refs.operatingMenu.hidden;
            refs.operatingMenu.hidden = !willOpen;
            refs.operatingTrigger.setAttribute("aria-expanded", String(willOpen));
        });`;

    if (dash.includes(targetOperatingToggle)) {
        dash = dash.replace(targetOperatingToggle, replacementOperatingToggle);
        console.log(`[PASS] Repaired operating menu toggle positioning in ${dialer}/dashboard.js`);
    } else {
        console.warn(`[WARN] Target operating toggle not found in ${dialer}/dashboard.js`);
    }

    // Repair selectedOperatingCampaigns to match case-insensitively and handle real IDs
    const targetSelectedOperating = `    function selectedOperatingCampaigns(campaigns) {
        if (!Array.isArray(campaigns) || !campaigns.length) return [];
        const ids = new Set((state.operatingCampaigns || []).map(function (id) { return String(id || "").trim(); }).filter(Boolean));
        // Keep the user's operating selection visible even if a selected campaign
        // becomes inactive. Metrics remain source-backed and the status shows it.
        return campaigns.filter(function (c, i) {
            return ids.has(c.__id || campaignId(c, i));
        });
    }`;

    const replacementSelectedOperating = `    function selectedOperatingCampaigns(campaigns) {
        if (!Array.isArray(campaigns) || !campaigns.length) return [];
        const ids = new Set((state.operatingCampaigns || []).map(function (id) { return String(id || "").trim().toLowerCase(); }).filter(Boolean));
        return campaigns.filter(function (c, i) {
            const cId = String(c.id || "").trim().toLowerCase();
            const cRawId = String(c.rawId || "").trim().toLowerCase();
            const cUnderscoreId = String(c.__id || "").trim().toLowerCase();
            const cName = String(c.name || "").trim().toLowerCase();
            const cidGen = String(campaignId(c, i) || "").trim().toLowerCase();
            return (cId && ids.has(cId)) ||
                   (cRawId && ids.has(cRawId)) ||
                   (cUnderscoreId && ids.has(cUnderscoreId)) ||
                   (cName && ids.has(cName)) ||
                   (cidGen && ids.has(cidGen));
        });
    }`;

    if (dash.includes(targetSelectedOperating)) {
        dash = dash.replace(targetSelectedOperating, replacementSelectedOperating);
        console.log(`[PASS] Repaired selectedOperatingCampaigns in ${dialer}/dashboard.js`);
    }

    // Repair Refresh Data Button & Coordinator in dashboard.js
    const targetRequestRefresh = `        const requestRefresh = function () {
            document.dispatchEvent(new CustomEvent(REQUEST_REFRESH_EVENT));
        };`;

    const replacementRequestRefresh = `        let refreshFallbackTimer = null;
        const requestRefresh = function () {
            if (state.isRefreshing) return;
            state.isRefreshing = true;
            if (refs.refresh) {
                refs.refresh.classList.add("is-refreshing");
                refs.refresh.disabled = true;
            }
            if (refs.headerRefresh) refs.headerRefresh.classList.add("is-refreshing");
            showActionNotice("Refreshing live " + DIALER + " CallTools data…");

            try {
                document.dispatchEvent(new CustomEvent(REQUEST_REFRESH_EVENT));
                document.dispatchEvent(new CustomEvent(REQUEST_INBOUND_REFRESH_EVENT));
            } catch (e) {}

            clearTimeout(refreshFallbackTimer);
            refreshFallbackTimer = setTimeout(function () {
                if (state.isRefreshing) {
                    state.isRefreshing = false;
                    if (refs.refresh) {
                        refs.refresh.classList.remove("is-refreshing");
                        refs.refresh.disabled = false;
                    }
                    if (refs.headerRefresh) refs.headerRefresh.classList.remove("is-refreshing");
                    scheduleRender();
                }
            }, 3000);
        };

        document.addEventListener(REFRESH_RESULT_EVENT, function (event) {
            clearTimeout(refreshFallbackTimer);
            state.isRefreshing = false;
            if (refs.refresh) {
                refs.refresh.classList.remove("is-refreshing");
                refs.refresh.disabled = false;
            }
            if (refs.headerRefresh) refs.headerRefresh.classList.remove("is-refreshing");

            const detail = event.detail || {};
            if (intelligenceEngine && intelligenceEngine.recordRefreshResult) {
                intelligenceEngine.recordRefreshResult(detail);
            }

            const unavMsg = (detail.unavailableSources && detail.unavailableSources.length)
                ? " (Stored records preserved; " + detail.unavailableSources.join(", ") + " not currently open)"
                : "";
            showActionNotice("Refresh completed: " + detail.recordsRead + " " + detail.source + " records read." + unavMsg);
            scheduleRender();
        });`;

    if (dash.includes(targetRequestRefresh)) {
        dash = dash.replace(targetRequestRefresh, replacementRequestRefresh);
        console.log(`[PASS] Repaired requestRefresh and added result listener in ${dialer}/dashboard.js`);
    }

    // Repair updateAlerts to NOT filter out SALES_GOAL
    dash = dash.replace(
        `            const activeIntelCards = (intelligenceEngine ? intelligenceEngine.activeAlerts : []).filter(function (a) {
                return !a.acknowledged && a.category !== "SALES_GOAL";
            }).map(function (alert) {`,
        `            const activeIntelCards = (intelligenceEngine ? intelligenceEngine.activeAlerts : []).filter(function (a) {
                return !a.acknowledged;
            }).map(function (alert) {`
    );

    // Repair updateLiveFilterIntelligence in dashboard.js
    const targetUpdateLfi = `        // KPIs
        if (refs.lfiTotalFilters) setText(refs.lfiTotalFilters, formatNumber(summary.totalFilters));
        if (refs.lfiActiveFilters) setText(refs.lfiActiveFilters, formatNumber(summary.activeFilters));
        if (refs.lfiRunningCampaigns) setText(refs.lfiRunningCampaigns, formatNumber(summary.runningCampaignsCount));
        if (refs.lfiVerifiedConfigs) setText(refs.lfiVerifiedConfigs, formatNumber(summary.verifiedActiveConfigurations));

        // Subtitles
        if (refs.lfiTotalFiltersSub) setText(refs.lfiTotalFiltersSub, summary.totalContacts ? formatNumber(summary.totalContacts) + " contacts" : "Known filter inventory");
        if (refs.lfiActiveFiltersSub) setText(refs.lfiActiveFiltersSub, summary.totalFilters ? (summary.totalFilters - summary.activeFilters) + " inactive" : "Active targeting rules");
        if (refs.lfiRunningCampaignsSub) setText(refs.lfiRunningCampaignsSub, "Active dialer campaigns");
        if (refs.lfiVerifiedConfigsSub) setText(refs.lfiVerifiedConfigsSub, summary.verifiedActiveConfigurations > 0 ? "Targeting verified" : "Pending verification");`;

    const replacementUpdateLfi = `        // KPIs (Zero-Interference Truthful Reporting: Never Fake 0)
        const hasInventory = health.hasInventory === true;
        if (refs.lfiTotalFilters) setText(refs.lfiTotalFilters, hasInventory ? formatNumber(summary.totalFilters) : "—");
        if (refs.lfiActiveFilters) setText(refs.lfiActiveFilters, hasInventory ? formatNumber(summary.activeFilters) : "—");
        if (refs.lfiRunningCampaigns) setText(refs.lfiRunningCampaigns, formatNumber(summary.runningCampaignsCount, "0"));
        if (refs.lfiVerifiedConfigs) setText(refs.lfiVerifiedConfigs, formatNumber(summary.verifiedActiveConfigurations, "0"));

        // Subtitles
        if (refs.lfiTotalFiltersSub) setText(refs.lfiTotalFiltersSub, hasInventory ? formatNumber(summary.totalContacts) + " contacts" : "Awaiting observation (/manager/live-filters)");
        if (refs.lfiActiveFiltersSub) setText(refs.lfiActiveFiltersSub, hasInventory ? (summary.totalFilters - summary.activeFilters) + " inactive" : "Awaiting observation");
        if (refs.lfiRunningCampaignsSub) setText(refs.lfiRunningCampaignsSub, summary.runningCampaignsCount + " active dialer campaigns");
        if (refs.lfiVerifiedConfigsSub) setText(refs.lfiVerifiedConfigsSub, summary.verifiedActiveConfigurations > 0 ? "Targeting verified" : "Pending verification");`;

    if (dash.includes(targetUpdateLfi)) {
        dash = dash.replace(targetUpdateLfi, replacementUpdateLfi);
        console.log(`[PASS] Repaired LFI KPIs in ${dialer}/dashboard.js`);
    }

    // Repair Matrix Table rendering in dashboard.js to include all operational columns
    const targetMatrixRender = `                    return '<tr>' +
                        '<td><strong>' + escapeHtml(m.campaignName) + '</strong></td>' +
                        '<td>' + escapeHtml(m.campaignId) + '</td>' +
                        '<td><span class="ct-lfi-badge ' + stateClass + '">' + escapeHtml(m.state) + '</span></td>' +
                        '<td><strong>' + escapeHtml(m.assignedFilter) + '</strong></td>' +
                        '<td><span class="ct-lfi-source">' + escapeHtml(m.verification) + '</span></td>' +
                        '<td><span class="ct-lfi-badge ' + usageClass + '">' + escapeHtml(m.usageStatus) + '</span></td>' +
                    '</tr>';`;

    const replacementMatrixRender = `                    const idBadge = m.rawId ? escapeHtml(m.campaignId) : '<span class="ct-lfi-badge is-waiting" title="Numeric campaign ID not exposed in current row DOM">Awaiting ID</span>';
                    const leadBadge = m.leadList && m.leadList !== "UNAVAILABLE" ? escapeHtml(m.leadList) : '<span class="ct-lfi-badge is-neutral" title="Source lead list not exposed on campaign table; open Edit/Members to observe">UNAVAILABLE</span>';
                    const ageStr = m.lastObserved ? formatAge(Math.floor((Date.now() - m.lastObserved) / 1000)) + " ago" : "—";
                    return '<tr>' +
                        '<td><strong>' + escapeHtml(m.campaignName) + '</strong></td>' +
                        '<td>' + idBadge + '</td>' +
                        '<td><span class="ct-lfi-badge ' + stateClass + '">' + escapeHtml(m.state) + '</span></td>' +
                        '<td><strong>' + escapeHtml(m.assignedFilter) + '</strong></td>' +
                        '<td>' + leadBadge + '</td>' +
                        '<td><span class="ct-lfi-source">' + escapeHtml(m.verification) + '</span></td>' +
                        '<td><span class="ct-lfi-badge ' + usageClass + '">' + escapeHtml(m.usageStatus) + '</span></td>' +
                    '</tr>';`;

    if (dash.includes(targetMatrixRender)) {
        dash = dash.replace(targetMatrixRender, replacementMatrixRender);
        console.log(`[PASS] Repaired matrix table row rendering in ${dialer}/dashboard.js`);
    }

    // Update Matrix Table headers in dashboard template
    const targetMatrixThead = `                                            <thead>
                                                <tr>
                                                    <th>CAMPAIGN NAME</th>
                                                    <th>ID</th>
                                                    <th>STATE</th>
                                                    <th>ASSIGNED LIVE FILTER</th>
                                                    <th>VERIFICATION</th>
                                                    <th>USAGE STATUS</th>
                                                </tr>
                                            </thead>`;
    const replacementMatrixThead = `                                            <thead>
                                                <tr>
                                                    <th>CAMPAIGN NAME</th>
                                                    <th>ID</th>
                                                    <th>STATE</th>
                                                    <th>ASSIGNED LIVE FILTER</th>
                                                    <th>LEAD LIST / FILE</th>
                                                    <th>VERIFICATION</th>
                                                    <th>USAGE STATUS</th>
                                                </tr>
                                            </thead>`;
    if (dash.includes(targetMatrixThead)) {
        dash = dash.replace(targetMatrixThead, replacementMatrixThead);
        console.log(`[PASS] Updated matrix table headers in ${dialer}/dashboard.js`);
    }

    // Auto-adjust default layout & normalizeLayout
    const targetDefaultLayout = `    function defaultLayout() {
        const padding = 14;
        const maxWidth = Math.max(980, window.innerWidth - (padding * 2));
        const targetWidth = window.innerWidth >= 1680 ? 1560 : window.innerWidth >= 1400 ? 1420 : window.innerWidth >= 1200 ? 1280 : Math.min(DEFAULT_LAYOUT.width, maxWidth);
        // Automatically adjust to fill the available desktop viewport (matching Image 2)
        const autoWidth = Math.max(targetWidth, window.innerWidth - (padding * 2));
        const width = Math.min(autoWidth, maxWidth);
        const autoHeight = Math.max(720, window.innerHeight - (padding * 2));
        const height = Math.min(autoHeight, Math.max(540, window.innerHeight - (padding * 2)));

        return {
            left: padding,
            top: padding,
            width: width,
            height: height,
            collapsed: DEFAULT_LAYOUT.collapsed,
            isAutoAdjusted: true,
            isCustom: false
        };
    }`;

    const replacementDefaultLayout = `    function defaultLayout() {
        const padding = 14;
        const availWidth = Math.max(980, window.innerWidth - (padding * 2));
        const availHeight = Math.max(680, window.innerHeight - (padding * 2));
        const width = Math.min(1560, availWidth);
        const height = Math.min(960, availHeight);

        return {
            left: padding,
            top: padding,
            width: width,
            height: height,
            collapsed: false,
            isAutoAdjusted: true,
            isCustom: false
        };
    }`;

    if (dash.includes(targetDefaultLayout)) {
        dash = dash.replace(targetDefaultLayout, replacementDefaultLayout);
        console.log(`[PASS] Updated defaultLayout in ${dialer}/dashboard.js`);
    }

    // In normalizeLayout, discard squished layouts (< 1100px on desktop)
    const targetNormalizeLayoutCheck = `        if (layout.isAutoAdjusted || !layout.isCustom) {
            return def;
        }`;
    const replacementNormalizeLayoutCheck = `        if (layout.isAutoAdjusted || !layout.isCustom || (layout.width < 1100 && window.innerWidth >= 1200)) {
            return def;
        }`;
    if (dash.includes(targetNormalizeLayoutCheck)) {
        dash = dash.replace(targetNormalizeLayoutCheck, replacementNormalizeLayoutCheck);
        console.log(`[PASS] Updated normalizeLayout squished view discard in ${dialer}/dashboard.js`);
    }

    fs.writeFileSync(dashPath, dash, "utf8");

    // ----------------------------------------------------
    // 5. REPAIR DASHBOARD.CSS
    // ----------------------------------------------------
    const cssPath = path.join(srcDir, "dashboard.css");
    let css = fs.readFileSync(cssPath, "utf8");

    // Ensure .ct-operating-wrap is position: relative
    if (!css.includes(".ct-operating-wrap {")) {
        css += `\n/* Operating campaign absolute dropdown */\n.ct-operating-wrap {\n    position: relative !important;\n    display: inline-flex;\n    align-items: center;\n}\n`;
    }
    css += `\n.ct-operating-menu {\n    position: absolute !important;\n    top: calc(100% + 4px) !important;\n    left: 0 !important;\n    min-width: 340px !important;\n    max-width: 420px !important;\n    max-height: min(420px, 70vh) !important;\n    overflow-y: auto !important;\n    z-index: 100000 !important;\n}\n`;

    // Refresh button spinner animation
    css += `\n/* Refresh Button State */\n.ct-refresh-btn.is-refreshing {\n    opacity: 0.7;\n    cursor: wait;\n    pointer-events: none;\n}\n@keyframes ct-spin {\n    from { transform: rotate(0deg); }\n    to { transform: rotate(360deg); }\n}\n.ct-refresh-btn.is-refreshing::before {\n    animation: ct-spin 1s linear infinite !important;\n}\n`;

    fs.writeFileSync(cssPath, css, "utf8");
    console.log(`[PASS] Updated dashboard.css for ${dialer}`);
});

console.log("\nMaster system repair applied successfully to East2 and East3 source files.");
