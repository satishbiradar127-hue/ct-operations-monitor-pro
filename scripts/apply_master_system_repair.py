import os
import re

release_dir = os.path.abspath("CT_OPERATIONS_DUAL_DIALER_RELEASE")

for dialer in ["East2", "East3"]:
    is_e3 = (dialer == "East3")
    src_dir = os.path.join(release_dir, f"CT_Operations_Monitor_{dialer}", "src")
    d_tag = "EAST-3" if is_e3 else "EAST-2"
    pfx = "ct_east3_" if is_e3 else "ct_east2_"
    host = "east-3.calltools.io" if is_e3 else "east-2.calltools.io"

    print(f"\n==================================================")
    print(f"APPLYING PYTHON MASTER SYSTEM REPAIR TO {d_tag}")
    print(f"==================================================")

    # ----------------------------------------------------
    # 1. PARSER.JS
    # ----------------------------------------------------
    parser_path = os.path.join(src_dir, "parser.js")
    with open(parser_path, "r", encoding="utf-8") as f:
        parser = f.read()

    # Normalize line endings for replacement
    parser = parser.replace("\r\n", "\n")

    # Version header
    parser = re.sub(
        r'console\.log\("CT Operations Monitor parser loaded \([^\)]+\) — v[0-9\.]+"\);',
        f'console.log("CT Operations Monitor parser loaded ({d_tag}) — v11.3.4");',
        parser
    )

    # Campaign ID extraction & lead list
    target_camp_id = """            const idNode = row.querySelector(
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
            }"""

    replacement_camp_id = """            // 1. Precise Campaign ID Extraction (Stable Numeric ID)
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
            }"""

    if target_camp_id in parser:
        parser = parser.replace(target_camp_id, replacement_camp_id)
        print(f"[PASS] Repaired campaign ID extraction in {dialer}/parser.js")
    else:
        print(f"[WARN] target_camp_id not found in {dialer}/parser.js")

    # Campaign return
    target_camp_ret = """            return {
                id: id || "",
                rowIndex: index,"""
    replacement_camp_ret = """            return {
                id: id || "",
                rawId: id || null,
                leadList: leadList || null,
                rowIndex: index,"""
    if target_camp_ret in parser:
        parser = parser.replace(target_camp_ret, replacement_camp_ret)
        print(f"[PASS] Added rawId and leadList to campaign return in {dialer}/parser.js")

    # Live filter ID extraction
    target_lf_id = """            let filterId = row.getAttribute("data-id") || row.getAttribute("data-live-filter-id") || "";
            if (!filterId) {
                const actionLink = row.querySelector("a[href*='/manager/live-filters/'], a[href*='/live-filters/'], button[data-id]");
                if (actionLink) {
                    const href = actionLink.getAttribute("href") || "";
                    const m = href.match(/\\/live-filters\\/(?:edit|preview|change-logs)\\/([0-9a-zA-Z_-]+)/);
                    if (m) filterId = m[1];
                    else if (actionLink.getAttribute("data-id")) filterId = actionLink.getAttribute("data-id");
                }
            }"""

    replacement_lf_id = """            let filterId = null;
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
            }"""

    if target_lf_id in parser:
        parser = parser.replace(target_lf_id, replacement_lf_id)
        print(f"[PASS] Repaired live filter ID extraction in {dialer}/parser.js")

    target_lf_ret = """            return {
                id: filterId || `filter-${index}`,
                name: name || (filterId ? `Filter ${filterId}` : `Filter ${index + 1}`),"""
    replacement_lf_ret = """            const stableId = filterId || (name ? name.toLowerCase().replace(/[^a-z0-9_-]/g, "_") : `filter-${index}`);
            return {
                id: stableId,
                rawId: filterId || null,
                name: name || (filterId ? `Filter ${filterId}` : `Filter ${index + 1}`),"""
    if target_lf_ret in parser:
        parser = parser.replace(target_lf_ret, replacement_lf_ret)
        print(f"[PASS] Repaired live filter return record in {dialer}/parser.js")

    with open(parser_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(parser)

    # ----------------------------------------------------
    # 2. INTELLIGENCE.JS
    # ----------------------------------------------------
    intel_path = os.path.join(src_dir, "intelligence.js")
    with open(intel_path, "r", encoding="utf-8") as f:
        intel = f.read()

    intel = intel.replace("\r\n", "\n")

    # Version
    intel = re.sub(r'version:\s*"11\.3\.[0-9]+"', 'version: "11.3.4"', intel)

    target_lfi_start = """            const items = inventory.items || {};
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
                const cid = String(c.id || c.__id || `campaign-${idx}`);
                const cName = String(c.name || c.__name || `Campaign ${cid}`).trim();
                const agents = Number(c.agents ?? c.__agents ?? 0);
                const rawState = String(c.state || c.__state || "").trim().toUpperCase();
                const isRunning = rawState === "ACTIVE" || rawState === "RUNNING" || agents > 0;
                if (isRunning) runningCampaignsCount++;"""

    replacement_lfi_start = """            const items = inventory.items || {};
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
                const cName = String(c.name || c.__name || (realId ? `Campaign ${realId}` : "Unnamed Campaign")).trim();

                // Robust running state calculation
                const agents = Number(c.loggedIn ?? c.__loggedIn ?? c._metrics?.loggedIn?.value ?? c.agents ?? c.__agents ?? 0);
                const rawState = String(c.state || c.__state || "").trim().toUpperCase();
                const isActiveBool = c.active === true || c.__active === true || c.__operational === true;
                const isRunning = isActiveBool || rawState === "ACTIVE" || rawState === "RUNNING" || agents > 0;
                if (isRunning) runningCampaignsCount++;"""

    if target_lfi_start in intel:
        intel = intel.replace(target_lfi_start, replacement_lfi_start)
        print(f"[PASS] Repaired LFI summary initialization in {dialer}/intelligence.js")
    else:
        print(f"[WARN] target_lfi_start not found in {dialer}/intelligence.js")

    # Replace cid registry lookup
    intel = intel.replace(
        "                // Lookup verified assignment by ID first, then name\n                let entry = null;\n                if (cid && verifiedRegistry[cid]) {\n                    entry = verifiedRegistry[cid];",
        "                // Lookup verified assignment by real ID first, then name\n                let entry = null;\n                if (realId && verifiedRegistry[realId]) {\n                    entry = verifiedRegistry[realId];"
    )

    target_matrix_ret = """                return {
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
                };"""

    replacement_matrix_ret = """                const leadsVal = (c.contacts && typeof c.contacts === "object" && c.contacts.value !== undefined) ? c.contacts.value :
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
                };"""

    if target_matrix_ret in intel:
        intel = intel.replace(target_matrix_ret, replacement_matrix_ret)
        print(f"[PASS] Repaired matrix return in {dialer}/intelligence.js")

    target_returned_summary = """            let inventoryFreshness = "No inventory recorded";
            if (inventory.lastObservedAt) {
                const diffSec = Math.floor((now - inventory.lastObservedAt) / 1000);
                if (diffSec < 60) inventoryFreshness = `Fresh (${diffSec}s ago)`;
                else if (diffSec < 3600) inventoryFreshness = `${Math.floor(diffSec / 60)}m ago`;
                else inventoryFreshness = `${Math.floor(diffSec / 3600)}h ago`;
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
            };"""

    replacement_returned_summary = """            let inventoryFreshness = "Awaiting observation (/manager/live-filters)";
            if (inventory.lastObservedAt) {
                const diffSec = Math.floor((now - inventory.lastObservedAt) / 1000);
                if (diffSec < 60) inventoryFreshness = `Fresh (${diffSec}s ago)`;
                else if (diffSec < 3600) inventoryFreshness = `${Math.floor(diffSec / 60)}m ago`;
                else inventoryFreshness = `${Math.floor(diffSec / 3600)}h ago`;
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
            };"""

    if target_returned_summary in intel:
        intel = intel.replace(target_returned_summary, replacement_returned_summary)
        print(f"[PASS] Repaired returned inventory summary in {dialer}/intelligence.js")

    with open(intel_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(intel)

    # ----------------------------------------------------
    # 3. CONTENT.JS
    # ----------------------------------------------------
    content_path = os.path.join(src_dir, "content.js")
    with open(content_path, "r", encoding="utf-8") as f:
        content = f.read()

    content = content.replace("\r\n", "\n")

    # Version
    content = re.sub(
        r'console\.log\("CT Operations Monitor \([^\)]+\) — Production live feed controller v[0-9\.]+"\);',
        f'console.log("CT Operations Monitor ({d_tag}) — Production live feed controller v11.3.4");',
        content
    )

    ev_name = "CT_EAST_3_REQUEST_REFRESH" if is_e3 else "CT_EAST_2_REQUEST_REFRESH"
    res_ev_name = "CT_EAST_3_REFRESH_RESULT" if is_e3 else "CT_EAST_2_REFRESH_RESULT"

    target_refresh_listener = f"""    document.addEventListener("{ev_name}", function () {{
        lastSourceRefreshAt = Date.now();
        if (isQueuesPage()) {{
            publishFeedStatus("VERIFYING", {{ reason: "Manual queue feed re-check requested", route: "queues" }});
            readAndPublish("manual-queue-refresh-check", true);
            return;
        }}
        publishFeedStatus("VERIFYING", {{ reason: "Manual campaign feed re-check requested", route: "campaigns" }});
        readAndPublish("manual-campaign-refresh", true);
    }});"""

    replacement_refresh_listener = f"""    document.addEventListener("{ev_name}", function () {{
        const now = Date.now();
        lastSourceRefreshAt = now;
        const route = currentRoute();
        let recordsRead = 0;
        let result = "SUCCESS";
        let failureReason = null;
        let unavailableSources = [];

        if (route === "campaigns") {{
            publishFeedStatus("VERIFYING", {{ reason: "Manual campaign feed re-check requested", route: "campaigns" }});
            readAndPublish("manual-campaign-refresh", true);
            const campaigns = window.CTParser && window.CTParser.readCampaigns ? window.CTParser.readCampaigns() : [];
            recordsRead = campaigns.length;
            unavailableSources = ["/manager/live-filters"];
        }} else if (route === "live_filters") {{
            observeLiveFiltersPage();
            const filters = window.CTParser && window.CTParser.readLiveFilters ? window.CTParser.readLiveFilters(document) : [];
            recordsRead = filters.length;
            unavailableSources = ["/manager/campaigns"];
        }} else if (route === "queues") {{
            publishFeedStatus("VERIFYING", {{ reason: "Manual queue feed re-check requested", route: "queues" }});
            readAndPublish("manual-queue-refresh-check", true);
            const queues = window.CTParser && window.CTParser.readQueues ? window.CTParser.readQueues() : [];
            recordsRead = queues.length;
            unavailableSources = ["/manager/campaigns", "/manager/live-filters"];
        }} else {{
            result = "PARTIAL";
            failureReason = "Current page (" + route + ") does not contain primary operational tables";
            unavailableSources = ["/manager/campaigns", "/manager/live-filters", "/manager/queues"];
        }}

        const detail = {{
            requestAt: now,
            completedAt: Date.now(),
            source: route,
            result: result,
            recordsRead: recordsRead,
            failureReason: failureReason,
            unavailableSources: unavailableSources
        }};

        document.dispatchEvent(new CustomEvent("{res_ev_name}", {{ detail: detail }}));
    }});"""

    if target_refresh_listener in content:
        content = content.replace(target_refresh_listener, replacement_refresh_listener)
        print(f"[PASS] Repaired refresh coordinator in {dialer}/content.js")
    else:
        print(f"[WARN] target_refresh_listener not found in {dialer}/content.js")

    with open(content_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)

    # ----------------------------------------------------
    # 4. DASHBOARD.JS
    # ----------------------------------------------------
    dash_path = os.path.join(src_dir, "dashboard.js")
    with open(dash_path, "r", encoding="utf-8") as f:
        dash = f.read()

    dash = dash.replace("\r\n", "\n")

    # Version
    dash = re.sub(
        r'console\.log\("Dashboard Loaded — CT Operations Monitor Pro \([^\)]+\) v[0-9\.]+"\);',
        f'console.log("Dashboard Loaded — CT Operations Monitor Pro ({d_tag}) v11.3.4");',
        dash
    )

    # Operating toggle
    target_operating_toggle = """        refs.operatingTrigger.addEventListener("click", function (event) {
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
        });"""

    replacement_operating_toggle = """        refs.operatingTrigger.addEventListener("click", function (event) {
            event.stopPropagation();
            const willOpen = refs.operatingMenu.hidden;
            refs.operatingMenu.hidden = !willOpen;
            refs.operatingTrigger.setAttribute("aria-expanded", String(willOpen));
        });"""

    if target_operating_toggle in dash:
        dash = dash.replace(target_operating_toggle, replacement_operating_toggle)
        print(f"[PASS] Repaired operating toggle in {dialer}/dashboard.js")
    else:
        print(f"[WARN] target_operating_toggle not found in {dialer}/dashboard.js")

    with open(dash_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(dash)

print("\nDone applying python master repair script.")

