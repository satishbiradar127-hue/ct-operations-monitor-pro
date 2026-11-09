import os

def update_dashboard_file(p):
    with open(p, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Add evaluateFreshness helper before updateConnectionState if not present
    fresh_helper = """    function evaluateFreshness(observedAt, now) {
        now = now || Date.now();
        if (!observedAt) {
            return {
                status: "NOT_OBSERVED",
                label: "NOT OBSERVED",
                ageSec: null,
                ageStr: "never",
                timeStr: "—",
                className: "is-waiting"
            };
        }
        const ageSec = Math.max(0, Math.floor((now - observedAt) / 1000));
        const timeStr = new Date(observedAt).toLocaleTimeString();
        const ageStr = formatAge(ageSec);
        if (ageSec < 15) {
            return {
                status: "LIVE",
                label: "LIVE (" + ageStr + " ago)",
                ageSec: ageSec,
                ageStr: ageStr,
                timeStr: timeStr,
                className: "is-live"
            };
        }
        if (ageSec <= 60) {
            return {
                status: "RECENT",
                label: "RECENT (" + ageStr + " ago)",
                ageSec: ageSec,
                ageStr: ageStr,
                timeStr: timeStr,
                className: "is-recent"
            };
        }
        return {
            status: "STALE",
            label: "STALE (" + ageStr + " ago)",
            ageSec: ageSec,
            ageStr: ageStr,
            timeStr: timeStr,
            className: "is-stale"
        };
    }
"""
    if "function evaluateFreshness" not in content:
        content = content.replace("function updateConnectionState(now) {", fresh_helper + "\n    function updateConnectionState(now) {")
        print(f"Added evaluateFreshness in {p}")

    # 2. Update topLiveFilterStrip HTML
    old_tlf_html = """                    <div class="ct-top-live-filter-strip" data-ref="topLiveFilterStrip">
                        <div class="ct-tlf-left">
                            <span class="ct-tlf-tag">LIVE FILTER</span>
                            <span class="ct-tlf-campaign" data-ref="topFilterCampaign">—</span>
                            <span class="ct-tlf-badge is-unavailable" data-ref="topFilterBadge">FILTER SOURCE UNAVAILABLE</span>
                        </div>
                        <div class="ct-tlf-right">
                            <span class="ct-tlf-source" data-ref="topFilterSource">Source: DOM Unavailable</span>
                            <span class="ct-tlf-observed" data-ref="topFilterObserved">Last observed: Awaiting DOM</span>
                            <span class="ct-tlf-change" data-ref="topFilterChange">Last change: None recorded</span>
                        </div>
                    </div>"""

    new_tlf_html = """                    <div class="ct-top-live-filter-strip" data-ref="topLiveFilterStrip">
                        <div class="ct-tlf-left">
                            <span class="ct-tlf-tag">LIVE FILTER TARGETING</span>
                            <span class="ct-tlf-campaign" data-ref="topFilterCampaign">—</span>
                            <span class="ct-tlf-badge is-unavailable" data-ref="topFilterBadge">FILTER SOURCE UNAVAILABLE</span>
                            <span class="ct-tlf-metric ct-tlf-pool" data-ref="topFilterPool">Campaign Pool: —</span>
                            <span class="ct-tlf-metric ct-tlf-match" data-ref="topFilterMatch">Filter Count: —</span>
                        </div>
                        <div class="ct-tlf-right">
                            <span class="ct-tlf-source" data-ref="topFilterSource">Source: DOM Unavailable</span>
                            <span class="ct-tlf-observed" data-ref="topFilterObserved">Last observed: Awaiting DOM</span>
                            <span class="ct-tlf-freshness" data-ref="topFilterFreshness">Targeting: —</span>
                            <span class="ct-tlf-change" data-ref="topFilterChange">Last change: None recorded</span>
                        </div>
                    </div>"""

    if old_tlf_html in content:
        content = content.replace(old_tlf_html, new_tlf_html)
        print(f"Updated topLiveFilterStrip HTML in {p}")

    # 3. Update createRefs with new refs
    old_refs_block = """topFilterObserved: root.querySelector('[data-ref="topFilterObserved"]'),
            topFilterChange: root.querySelector('[data-ref="topFilterChange"]'),"""

    new_refs_block = """topFilterObserved: root.querySelector('[data-ref="topFilterObserved"]'),
            topFilterChange: root.querySelector('[data-ref="topFilterChange"]'),
            topFilterPool: root.querySelector('[data-ref="topFilterPool"]'),
            topFilterMatch: root.querySelector('[data-ref="topFilterMatch"]'),
            topFilterFreshness: root.querySelector('[data-ref="topFilterFreshness"]'),"""

    if old_refs_block in content and "topFilterPool:" not in content:
        content = content.replace(old_refs_block, new_refs_block)
        print(f"Updated createRefs in {p}")

    # 4. Update topLiveFilterStrip logic in updateSummary
    old_tlf_logic = """        // Update Top Live Filter Strip
        if (refs.topFilterCampaign && refs.topFilterBadge) {
            const allCampList = stats.campaigns || state.campaigns || [];
            let targetCamp = operating || (allCampList.find(function(c) { return c && c.active !== false; })) || allCampList[0] || null;

            if (targetCamp) {
                const cName = safeValue(targetCamp.name, "Campaign " + (targetCamp.id || ""));
                const fName = targetCamp.liveFilter || null;
                const fStatus = targetCamp.liveFilterStatus || (fName ? "ASSIGNED" : "FILTER SOURCE UNAVAILABLE");
                const fSource = targetCamp.liveFilterSource || "DOM_UNAVAILABLE";
                const fTime = targetCamp.liveFilterTimestamp ? new Date(targetCamp.liveFilterTimestamp).toLocaleTimeString() : (fName ? new Date().toLocaleTimeString() : "Awaiting DOM");

                let lastChangeText = "None recorded";
                if (intelligenceEngine && intelligenceEngine.history) {
                    const recentChange = intelligenceEngine.history.find(function(h) {
                        return h.category === "LIVE_FILTER" && (String(h.targetId) === String(targetCamp.id) || String(h.campaignId) === String(targetCamp.id));
                    });
                    if (recentChange) {
                        lastChangeText = (recentChange.previous || "None") + " → " + (recentChange.current || "None") + " (" + (recentChange.confirmedAt || recentChange.firstDetectedAt || "") + ")";
                    }
                }

                setText(refs.topFilterCampaign, cName);
                if (fName) {
                    setText(refs.topFilterBadge, "Filter: " + fName);
                    setClass(refs.topFilterBadge, "ct-tlf-badge is-assigned");
                    if (refs.topFilterSource) setText(refs.topFilterSource, "Source: " + (fSource === "TABLE_COLUMN" ? "Campaigns Table" : fSource === "CAMPAIGN_EDIT_DOM" ? "Edit Page DOM" : fSource === "VERIFIED_REGISTRY" ? "Verified Registry" : fSource));
                    if (refs.topFilterObserved) setText(refs.topFilterObserved, "Last observed: " + fTime);
                } else {
                    setText(refs.topFilterBadge, "FILTER SOURCE UNAVAILABLE");
                    setClass(refs.topFilterBadge, "ct-tlf-badge is-unavailable");
                    if (refs.topFilterSource) setText(refs.topFilterSource, "Source: DOM Unavailable");
                    if (refs.topFilterObserved) setText(refs.topFilterObserved, "Last observed: Awaiting DOM source");
                }
                if (refs.topFilterChange) setText(refs.topFilterChange, "Last change: " + lastChangeText);
            } else {
                setText(refs.topFilterCampaign, "—");
                setText(refs.topFilterBadge, "FILTER SOURCE UNAVAILABLE");
                setClass(refs.topFilterBadge, "ct-tlf-badge is-unavailable");
                if (refs.topFilterSource) setText(refs.topFilterSource, "Source: DOM Unavailable");
                if (refs.topFilterObserved) setText(refs.topFilterObserved, "Last observed: Awaiting DOM");
                if (refs.topFilterChange) setText(refs.topFilterChange, "Last change: None recorded");
            }
        }"""

    new_tlf_logic = """        // Update Top Live Filter Strip
        if (refs.topFilterCampaign && refs.topFilterBadge) {
            const allCampList = stats.campaigns || state.campaigns || [];
            let targetCamp = operating || (allCampList.find(function(c) { return c && c.active !== false; })) || allCampList[0] || null;

            if (targetCamp) {
                const cName = safeValue(targetCamp.name, "Campaign " + (targetCamp.id || ""));
                let fRaw = targetCamp.liveFilter || null;
                let fName = fRaw;
                let fCount = targetCamp.liveFilterCount !== undefined ? targetCamp.liveFilterCount : null;

                if (fRaw) {
                    const mCount = String(fRaw).match(/[\\(\\[]\\s*(?:Count|Contacts)?\\s*:?\\s*([0-9,]+)\\s*[\\)\\]]/i);
                    if (mCount && mCount[1]) {
                        fCount = Number(mCount[1].replace(/,/g, ""));
                        fName = String(fRaw).replace(/[\\(\\[]\\s*(?:Count|Contacts)?\\s*:?\\s*[0-9,]+\\s*[\\)\\]]/i, "").trim();
                    }
                }

                const pool = (targetCamp.contacts !== undefined && targetCamp.contacts !== null)
                    ? (typeof targetCamp.contacts === "object" ? targetCamp.contacts.value : targetCamp.contacts)
                    : (targetCamp.__contacts || null);

                const fSource = targetCamp.liveFilterSource || "DOM_UNAVAILABLE";
                const fTimeMs = targetCamp.liveFilterTimestamp || null;
                const fTime = fTimeMs ? new Date(fTimeMs).toLocaleTimeString() : (fName ? new Date().toLocaleTimeString() : "Awaiting DOM");
                const targetingFreshness = evaluateFreshness(fTimeMs, Date.now());

                let lastChangeText = "None recorded";
                if (intelligenceEngine && intelligenceEngine.history) {
                    const recentChange = intelligenceEngine.history.find(function(h) {
                        return h.category === "LIVE_FILTER" && (String(h.targetId) === String(targetCamp.id) || String(h.campaignId) === String(targetCamp.id));
                    });
                    if (recentChange) {
                        lastChangeText = (recentChange.previous || "None") + " → " + (recentChange.current || "None") + " (" + (recentChange.confirmedAt || recentChange.firstDetectedAt || "") + ")";
                    }
                }

                setText(refs.topFilterCampaign, cName);
                if (fName) {
                    setText(refs.topFilterBadge, "Filter: " + fName);
                    setClass(refs.topFilterBadge, "ct-tlf-badge is-assigned");
                    if (refs.topFilterPool) setText(refs.topFilterPool, pool !== null ? "Campaign Pool: " + formatNumber(pool) + " (Live Queue)" : "Campaign Pool: —");
                    if (refs.topFilterMatch) setText(refs.topFilterMatch, fCount !== null ? "Filter Matches: " + formatNumber(fCount) + " (Targeting Snapshot)" : "Filter Matches: —");
                    if (refs.topFilterSource) setText(refs.topFilterSource, "Source: " + (fSource === "TABLE_COLUMN" ? "Campaigns Table" : fSource === "CAMPAIGN_EDIT_DOM" ? "Edit Page DOM" : fSource === "VERIFIED_REGISTRY" ? "Verified Registry" : fSource));
                    if (refs.topFilterObserved) setText(refs.topFilterObserved, "Targeting verified: " + fTime);
                    if (refs.topFilterFreshness) {
                        setText(refs.topFilterFreshness, "Targeting: " + targetingFreshness.label);
                        setClass(refs.topFilterFreshness, "ct-tlf-freshness " + targetingFreshness.className);
                    }
                } else {
                    setText(refs.topFilterBadge, "FILTER SOURCE UNAVAILABLE");
                    setClass(refs.topFilterBadge, "ct-tlf-badge is-unavailable");
                    if (refs.topFilterPool) setText(refs.topFilterPool, pool !== null ? "Campaign Pool: " + formatNumber(pool) + " (Live Queue)" : "Campaign Pool: —");
                    if (refs.topFilterMatch) setText(refs.topFilterMatch, "Filter Matches: —");
                    if (refs.topFilterSource) setText(refs.topFilterSource, "Source: DOM Unavailable");
                    if (refs.topFilterObserved) setText(refs.topFilterObserved, "Last observed: Awaiting DOM source");
                    if (refs.topFilterFreshness) {
                        setText(refs.topFilterFreshness, "Targeting: NOT OBSERVED");
                        setClass(refs.topFilterFreshness, "ct-tlf-freshness is-waiting");
                    }
                }
                if (refs.topFilterChange) setText(refs.topFilterChange, "Last change: " + lastChangeText);
            } else {
                setText(refs.topFilterCampaign, "—");
                setText(refs.topFilterBadge, "FILTER SOURCE UNAVAILABLE");
                setClass(refs.topFilterBadge, "ct-tlf-badge is-unavailable");
                if (refs.topFilterPool) setText(refs.topFilterPool, "Campaign Pool: —");
                if (refs.topFilterMatch) setText(refs.topFilterMatch, "Filter Matches: —");
                if (refs.topFilterSource) setText(refs.topFilterSource, "Source: DOM Unavailable");
                if (refs.topFilterObserved) setText(refs.topFilterObserved, "Last observed: Awaiting DOM");
                if (refs.topFilterFreshness) {
                    setText(refs.topFilterFreshness, "Targeting: NOT OBSERVED");
                    setClass(refs.topFilterFreshness, "ct-tlf-freshness is-waiting");
                }
                if (refs.topFilterChange) setText(refs.topFilterChange, "Last change: None recorded");
            }
        }"""

    if old_tlf_logic in content:
        content = content.replace(old_tlf_logic, new_tlf_logic)
        print(f"Updated topLiveFilterStrip logic in {p}")

    # 5. Update Matrix table thead
    old_matrix_th = """                                                <tr>
                                                    <th>CAMPAIGN NAME</th>
                                                    <th>ID</th>
                                                    <th>STATE</th>
                                                    <th>ASSIGNED LIVE FILTER</th>
                                                    <th>VERIFICATION</th>
                                                    <th>USAGE STATUS</th>
                                                </tr>"""

    new_matrix_th = """                                                <tr>
                                                    <th>CAMPAIGN</th>
                                                    <th>CAMPAIGN ID</th>
                                                    <th>STATE</th>
                                                    <th>AGENTS</th>
                                                    <th>CAMPAIGN LEAD POOL</th>
                                                    <th>ASSIGNED FILTER</th>
                                                    <th>FILTER COUNT</th>
                                                    <th>VERIFICATION</th>
                                                    <th>LAST VERIFIED</th>
                                                    <th>FRESHNESS</th>
                                                </tr>"""

    if old_matrix_th in content:
        content = content.replace(old_matrix_th, new_matrix_th)
        print(f"Updated Matrix table thead in {p}")

    # 6. Update Matrix table row rendering in updateLiveFilterIntelligence
    old_matrix_render = """        // Matrix Table
        if (refs.lfiMatrixTableBody) {
            if (matrix.length === 0) {
                refs.lfiMatrixTableBody.innerHTML = '<tr><td colspan="6" class="ct-lfi-empty">Waiting for campaign data…</td></tr>';
            } else {
                refs.lfiMatrixTableBody.innerHTML = matrix.map(function (m) {
                    const stateClass = m.state === "RUNNING" ? "is-running" : "is-idle";
                    const usageClass = m.usageStatus === "VERIFIED ACTIVE" ? "is-verified-active" :
                                       m.usageStatus === "UNASSIGNED" ? "is-unassigned" :
                                       m.usageStatus === "STALE" ? "is-stale" : "is-unknown";
                    return '<tr>' +
                        '<td><strong>' + escapeHtml(m.campaignName) + '</strong></td>' +
                        '<td>' + escapeHtml(m.campaignId) + '</td>' +
                        '<td><span class="ct-lfi-badge ' + stateClass + '">' + escapeHtml(m.state) + '</span></td>' +
                        '<td><strong>' + escapeHtml(m.assignedFilter) + '</strong></td>' +
                        '<td><span class="ct-lfi-source">' + escapeHtml(m.verification) + '</span></td>' +
                        '<td><span class="ct-lfi-badge ' + usageClass + '">' + escapeHtml(m.usageStatus) + '</span></td>' +
                    '</tr>';
                }).join("");
            }
        }"""

    new_matrix_render = """        // Matrix Table
        if (refs.lfiMatrixTableBody) {
            if (matrix.length === 0) {
                refs.lfiMatrixTableBody.innerHTML = '<tr><td colspan="10" class="ct-lfi-empty">Waiting for campaign data…</td></tr>';
            } else {
                refs.lfiMatrixTableBody.innerHTML = matrix.map(function (m) {
                    const stateClass = m.state === "RUNNING" ? "is-running" : "is-idle";
                    const usageClass = m.usageStatus === "VERIFIED ACTIVE" ? "is-verified-active" :
                                       m.usageStatus === "UNASSIGNED" ? "is-unassigned" :
                                       m.usageStatus === "STALE" ? "is-stale" : "is-unknown";
                    const freshClass = m.freshness === "LIVE" ? "is-live" : m.freshness === "RECENT" ? "is-recent" : m.freshness === "STALE" ? "is-stale" : "is-waiting";
                    const freshLabel = m.freshness === "LIVE" ? "LIVE (" + (m.ageSec || 0) + "s ago)" :
                                       m.freshness === "RECENT" ? "RECENT (" + formatAge(m.ageSec) + " ago)" :
                                       m.freshness === "STALE" ? "STALE (" + formatAge(m.ageSec) + " ago)" : "NOT OBSERVED";

                    return '<tr>' +
                        '<td><strong>' + escapeHtml(m.campaignName) + '</strong></td>' +
                        '<td>' + (m.rawId ? escapeHtml(m.rawId) : '<span class="ct-campaign-id-badge is-unverified">Awaiting ID</span>') + '</td>' +
                        '<td><span class="ct-lfi-badge ' + stateClass + '">' + escapeHtml(m.state) + '</span></td>' +
                        '<td>' + formatNumber(m.agents) + '</td>' +
                        '<td><span class="ct-lfi-lead-pool" title="Campaign callable lead pool in active dialer queue">' + (m.campaignLeadPool !== "UNAVAILABLE" ? formatNumber(m.campaignLeadPool) : "—") + '</span> <small class="ct-pool-tag">Callable</small></td>' +
                        '<td><strong>' + escapeHtml(m.assignedFilter) + '</strong></td>' +
                        '<td>' + (m.filterCount !== null ? '<span class="ct-lfi-filter-count" title="Filter-matching contacts from targeting snapshot">' + formatNumber(m.filterCount) + '</span>' : '<span class="ct-lfi-empty-val">—</span>') + '</td>' +
                        '<td><span class="ct-lfi-source">' + escapeHtml(m.verification) + '</span></td>' +
                        '<td>' + escapeHtml(m.lastObservedTimeStr || "—") + '</td>' +
                        '<td><span class="ct-lfi-badge ' + freshClass + '">' + escapeHtml(freshLabel) + '</span></td>' +
                    '</tr>';
                }).join("");
            }
        }"""

    if old_matrix_render in content:
        content = content.replace(old_matrix_render, new_matrix_render)
        print(f"Updated Matrix table rendering in {p}")

    with open(p, "w", encoding="utf-8") as f:
        f.write(content)

for dialer in ["East2", "East3"]:
    p = f"CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_{dialer}/src/dashboard.js"
    update_dashboard_file(p)

print("Dashboard patches applied.")

