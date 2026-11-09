import re

file_path = "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/dashboard.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update ct-lfi-kpi-grid HTML in mount()
old_kpi_grid = """                            <div class="ct-lfi-kpi-grid" aria-label="Live Filter Summary KPIs">
                                <div class="ct-lfi-kpi-card">
                                    <div class="ct-lfi-kpi-label">TOTAL FILTERS</div>
                                    <div class="ct-lfi-kpi-value" data-ref="lfiTotalFilters">—</div>
                                    <div class="ct-lfi-kpi-sub" data-ref="lfiTotalFiltersSub">Known filter inventory</div>
                                </div>
                                <div class="ct-lfi-kpi-card">
                                    <div class="ct-lfi-kpi-label">ACTIVE FILTERS</div>
                                    <div class="ct-lfi-kpi-value" data-ref="lfiActiveFilters">—</div>
                                    <div class="ct-lfi-kpi-sub" data-ref="lfiActiveFiltersSub">Active targeting rules</div>
                                </div>
                                <div class="ct-lfi-kpi-card">
                                    <div class="ct-lfi-kpi-label">RUNNING CAMPAIGNS</div>
                                    <div class="ct-lfi-kpi-value" data-ref="lfiRunningCampaigns">—</div>
                                    <div class="ct-lfi-kpi-sub" data-ref="lfiRunningCampaignsSub">Active dialer campaigns</div>
                                </div>
                                <div class="ct-lfi-kpi-card is-highlight">
                                    <div class="ct-lfi-kpi-label">VERIFIED ACTIVE CONFIGURATIONS</div>
                                    <div class="ct-lfi-kpi-value" data-ref="lfiVerifiedConfigs">—</div>
                                    <div class="ct-lfi-kpi-sub" data-ref="lfiVerifiedConfigsSub">Confirmed filter in use</div>
                                </div>
                            </div>"""

new_kpi_grid = """                            <div class="ct-lfi-kpi-grid" aria-label="Live Filter Summary KPIs">
                                <div class="ct-lfi-kpi-card">
                                    <div class="ct-lfi-kpi-label">TOTAL FILTERS</div>
                                    <div class="ct-lfi-kpi-value" data-ref="lfiTotalFilters">—</div>
                                    <div class="ct-lfi-kpi-sub" data-ref="lfiTotalFiltersSub">Known filter inventory</div>
                                </div>
                                <div class="ct-lfi-kpi-card">
                                    <div class="ct-lfi-kpi-label">ACTIVE FILTERS</div>
                                    <div class="ct-lfi-kpi-value" data-ref="lfiActiveFilters">—</div>
                                    <div class="ct-lfi-kpi-sub" data-ref="lfiActiveFiltersSub">Active targeting rules</div>
                                </div>
                                <div class="ct-lfi-kpi-card">
                                    <div class="ct-lfi-kpi-label">INACTIVE FILTERS</div>
                                    <div class="ct-lfi-kpi-value" data-ref="lfiInactiveFilters">—</div>
                                    <div class="ct-lfi-kpi-sub" data-ref="lfiInactiveFiltersSub">Dormant / disabled rules</div>
                                </div>
                                <div class="ct-lfi-kpi-card">
                                    <div class="ct-lfi-kpi-label">AVAILABLE CONTACTS</div>
                                    <div class="ct-lfi-kpi-value" data-ref="lfiAvailableContacts">—</div>
                                    <div class="ct-lfi-kpi-sub" data-ref="lfiAvailableContactsSub">Contacts in matching filters</div>
                                </div>
                                <div class="ct-lfi-kpi-card">
                                    <div class="ct-lfi-kpi-label">RUNNING CAMPAIGNS</div>
                                    <div class="ct-lfi-kpi-value" data-ref="lfiRunningCampaigns">—</div>
                                    <div class="ct-lfi-kpi-sub" data-ref="lfiRunningCampaignsSub">Active dialer campaigns</div>
                                </div>
                                <div class="ct-lfi-kpi-card is-highlight">
                                    <div class="ct-lfi-kpi-label">VERIFIED ACTIVE CONFIGURATIONS</div>
                                    <div class="ct-lfi-kpi-value" data-ref="lfiVerifiedConfigs">—</div>
                                    <div class="ct-lfi-kpi-sub" data-ref="lfiVerifiedConfigsSub">Confirmed filter in use</div>
                                </div>
                            </div>"""

if old_kpi_grid in content:
    content = content.replace(old_kpi_grid, new_kpi_grid, 1)
    print("1. Successfully updated ct-lfi-kpi-grid with 6 cards")
else:
    print("1. ct-lfi-kpi-grid pattern not matched")

# 2. Update Table B headers in mount()
old_table_b_headers = """                                                <tr>
                                                    <th>FILTER NAME</th>
                                                    <th>STATUS</th>
                                                    <th>CONTACTS</th>
                                                    <th>TIMEZONE CNT</th>
                                                    <th>DIALER</th>
                                                    <th>LAST OBSERVED</th>
                                                </tr>"""

new_table_b_headers = """                                                <tr>
                                                    <th>FILTER NAME</th>
                                                    <th>ACTIVE STATUS</th>
                                                    <th>AVAILABLE CONTACTS</th>
                                                    <th>TOTAL MATCHING CONTACTS</th>
                                                    <th>DIALER</th>
                                                    <th>LAST OBSERVED</th>
                                                    <th>FRESHNESS</th>
                                                </tr>"""

if old_table_b_headers in content:
    content = content.replace(old_table_b_headers, new_table_b_headers, 1)
    print("2. Successfully updated Table B headers")
else:
    print("2. Table B headers pattern not matched")

old_table_b_empty = '<tr><td colspan="6" class="ct-lfi-empty">No inventory observed yet. Open /manager/live-filters in CallTools to discover filters.</td></tr>'
new_table_b_empty = '<tr><td colspan="7" class="ct-lfi-empty">No inventory observed yet. Open /manager/live-filters in CallTools to discover filters.</td></tr>'
content = content.replace(old_table_b_empty, new_table_b_empty)

# 3. Update Table C headers in mount()
old_table_c_headers = """                                                <tr>
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

new_table_c_headers = """                                                <tr>
                                                    <th>CAMPAIGN</th>
                                                    <th>CAMPAIGN ID</th>
                                                    <th>STATE</th>
                                                    <th>AGENTS</th>
                                                    <th>CAMPAIGN LEAD POOL</th>
                                                    <th>ASSIGNED LIVE FILTER</th>
                                                    <th>FILTER COUNT</th>
                                                    <th>VERIFICATION SOURCE</th>
                                                    <th>LAST VERIFIED</th>
                                                    <th>FRESHNESS</th>
                                                    <th>USAGE STATUS</th>
                                                </tr>"""

if old_table_c_headers in content:
    content = content.replace(old_table_c_headers, new_table_c_headers, 1)
    print("3. Successfully updated Table C headers")
else:
    print("3. Table C headers pattern not matched")

old_table_c_empty = '<tr><td colspan="6" class="ct-lfi-empty">Waiting for campaign data…</td></tr>'
new_table_c_empty = '<tr><td colspan="11" class="ct-lfi-empty">Waiting for campaign data…</td></tr>'
content = content.replace(old_table_c_empty, new_table_c_empty)
content = content.replace('<tr><td colspan="10" class="ct-lfi-empty">Waiting for campaign data…</td></tr>', new_table_c_empty)

# 4. Add refs in mount()
target_refs = "lfiActiveFiltersSub: root.querySelector('[data-ref=\"lfiActiveFiltersSub\"]'),"
replacement_refs = """lfiActiveFiltersSub: root.querySelector('[data-ref="lfiActiveFiltersSub"]'),
                lfiInactiveFilters: root.querySelector('[data-ref="lfiInactiveFilters"]'),
                lfiInactiveFiltersSub: root.querySelector('[data-ref="lfiInactiveFiltersSub"]'),
                lfiAvailableContacts: root.querySelector('[data-ref="lfiAvailableContacts"]'),
                lfiAvailableContactsSub: root.querySelector('[data-ref="lfiAvailableContactsSub"]'),"""

if target_refs in content and "lfiInactiveFilters:" not in content:
    content = content.replace(target_refs, replacement_refs, 1)
    print("4. Successfully added refs for inactiveFilters and availableContacts")

# 5. Update updateAlerts(): ONLY Goal alerts require NOTED! Routine alerts have AUTO-UPDATING tag and no NOTED button.
old_intel_actions = """                    '<div class="ct-goal-card-actions">' +
                        '<button type="button" class="ct-btn ct-btn-noted" data-intel-noted-id="' + escapeHtml(alert.id) + '" title="Acknowledge this change">✓ NOTED</button>' +
                    '</div>' +"""

new_intel_actions = """                    '<div class="ct-goal-card-actions">' +
                        '<span class="ct-intel-auto-tag" title="Updates automatically with live CallTools observations">AUTO-UPDATING</span>' +
                    '</div>' +"""

if old_intel_actions in content:
    content = content.replace(old_intel_actions, new_intel_actions, 1)
    print("5. Successfully removed NOTED button from routine operational intelligence cards")
else:
    print("5. Old intel actions button pattern not matched")

# 6. Format numbers with thousands separators in Goal alert cards
old_goal_stat = """                        '<div class="ct-goal-stat-row">' +
                            '<span class="ct-goal-metric-label">' + escapeHtml(alert.metric) + ':</span>' +
                            '<span class="ct-goal-count-prev">' + alert.previous + '</span>' +
                            '<span class="ct-goal-arrow">→</span>' +
                            '<span class="ct-goal-count-curr">' + alert.current + '</span>' +
                            '<span class="ct-goal-increase">(+' + alert.increase + ')</span>' +
                        '</div>' +"""

new_goal_stat = """                        '<div class="ct-goal-stat-row">' +
                            '<span class="ct-goal-metric-label">' + escapeHtml(alert.metric) + ':</span>' +
                            '<span class="ct-goal-count-prev">' + formatNumber(alert.previous) + '</span>' +
                            '<span class="ct-goal-arrow">→</span>' +
                            '<span class="ct-goal-count-curr">' + formatNumber(alert.current) + '</span>' +
                            '<span class="ct-goal-increase">(+' + formatNumber(alert.increase) + ')</span>' +
                        '</div>' +"""

if old_goal_stat in content:
    content = content.replace(old_goal_stat, new_goal_stat, 1)
    print("6. Successfully added formatNumber to Goal alert card values")

# 7. Update renderLiveFilterIntelligence() KPIs & Subtitles
old_lfi_render = """        // KPIs
        if (refs.lfiTotalFilters) setText(refs.lfiTotalFilters, formatNumber(summary.totalFilters));
        if (refs.lfiActiveFilters) setText(refs.lfiActiveFilters, formatNumber(summary.activeFilters));
        if (refs.lfiRunningCampaigns) setText(refs.lfiRunningCampaigns, formatNumber(summary.runningCampaignsCount));
        if (refs.lfiVerifiedConfigs) setText(refs.lfiVerifiedConfigs, formatNumber(summary.verifiedActiveConfigurations));

        // Subtitles
        if (refs.lfiTotalFiltersSub) setText(refs.lfiTotalFiltersSub, summary.totalContacts ? formatNumber(summary.totalContacts) + " contacts" : "Known filter inventory");
        if (refs.lfiActiveFiltersSub) setText(refs.lfiActiveFiltersSub, summary.totalFilters ? (summary.totalFilters - summary.activeFilters) + " inactive" : "Active targeting rules");
        if (refs.lfiRunningCampaignsSub) setText(refs.lfiRunningCampaignsSub, "Active dialer campaigns");
        if (refs.lfiVerifiedConfigsSub) setText(refs.lfiVerifiedConfigsSub, summary.verifiedActiveConfigurations > 0 ? "Targeting verified" : "Pending verification");"""

new_lfi_render = """        // KPIs (6 Separated Cards)
        if (refs.lfiTotalFilters) setText(refs.lfiTotalFilters, formatNumber(summary.totalFilters));
        if (refs.lfiActiveFilters) setText(refs.lfiActiveFilters, formatNumber(summary.activeFilters));
        const inactiveFilters = (summary.totalFilters !== null && summary.activeFilters !== null) ? Math.max(0, summary.totalFilters - summary.activeFilters) : null;
        if (refs.lfiInactiveFilters) setText(refs.lfiInactiveFilters, formatNumber(inactiveFilters));
        const availContacts = summary.availableContacts !== undefined && summary.availableContacts !== null ? summary.availableContacts : summary.totalContacts;
        if (refs.lfiAvailableContacts) setText(refs.lfiAvailableContacts, formatNumber(availContacts));
        if (refs.lfiRunningCampaigns) setText(refs.lfiRunningCampaigns, formatNumber(summary.runningCampaignsCount));
        if (refs.lfiVerifiedConfigs) setText(refs.lfiVerifiedConfigs, formatNumber(summary.verifiedActiveConfigurations));

        // Subtitles
        if (refs.lfiTotalFiltersSub) setText(refs.lfiTotalFiltersSub, "Known filter inventory");
        if (refs.lfiActiveFiltersSub) setText(refs.lfiActiveFiltersSub, "Active targeting rules");
        if (refs.lfiInactiveFiltersSub) setText(refs.lfiInactiveFiltersSub, "Dormant / disabled rules");
        if (refs.lfiAvailableContactsSub) setText(refs.lfiAvailableContactsSub, "Contacts in matching filters");
        if (refs.lfiRunningCampaignsSub) setText(refs.lfiRunningCampaignsSub, "Active dialer campaigns");
        if (refs.lfiVerifiedConfigsSub) setText(refs.lfiVerifiedConfigsSub, summary.verifiedActiveConfigurations > 0 ? "Targeting verified" : "Pending verification");"""

if old_lfi_render in content:
    content = content.replace(old_lfi_render, new_lfi_render, 1)
    print("7. Successfully updated renderLiveFilterIntelligence KPIs binding")
else:
    print("7. renderLiveFilterIntelligence KPIs binding pattern not matched")

# 8. Update Table B rendering (7 columns)
old_table_b_render = """                refs.lfiInventoryTableBody.innerHTML = inventory.map(function (f) {
                    const statusClass = f.status === "ACTIVE" ? "is-active" : "is-inactive";
                    const ageStr = f.observedAt ? formatAge(Math.floor((Date.now() - f.observedAt) / 1000)) + " ago" : "—";
                    return '<tr>' +
                        '<td><strong>' + escapeHtml(f.name) + '</strong></td>' +
                        '<td><span class="ct-lfi-badge ' + statusClass + '">' + escapeHtml(f.status) + '</span></td>' +
                        '<td>' + formatNumber(f.count) + '</td>' +
                        '<td>' + formatNumber(f.totalCount) + '</td>' +
                        '<td>' + escapeHtml(f.dialer) + '</td>' +
                        '<td>' + ageStr + '</td>' +
                    '</tr>';
                }).join("");"""

new_table_b_render = """                refs.lfiInventoryTableBody.innerHTML = inventory.map(function (f) {
                    const statusClass = f.status === "ACTIVE" ? "is-active" : "is-inactive";
                    const ageSec = f.observedAt ? Math.max(0, Math.floor((Date.now() - f.observedAt) / 1000)) : null;
                    const timeStr = f.observedAt ? new Date(f.observedAt).toLocaleTimeString() : "—";
                    const freshClass = ageSec !== null ? (ageSec < 15 ? "is-live" : ageSec <= 60 ? "is-recent" : "is-stale") : "is-waiting";
                    const freshLabel = ageSec !== null ? (ageSec < 15 ? "LIVE (" + ageSec + "s ago)" : ageSec <= 60 ? "RECENT (" + formatAge(ageSec) + " ago)" : "STALE (" + formatAge(ageSec) + " ago)") : "NOT OBSERVED";
                    return '<tr>' +
                        '<td title="' + escapeHtml(f.name) + '"><strong>' + escapeHtml(f.name) + '</strong></td>' +
                        '<td><span class="ct-lfi-badge ' + statusClass + '">' + escapeHtml(f.status) + '</span></td>' +
                        '<td style="text-align:right;">' + formatNumber(f.count) + '</td>' +
                        '<td style="text-align:right;">' + formatNumber(f.totalCount) + '</td>' +
                        '<td>' + escapeHtml(f.dialer) + '</td>' +
                        '<td>' + escapeHtml(timeStr) + '</td>' +
                        '<td><span class="ct-lfi-badge ' + freshClass + '">' + escapeHtml(freshLabel) + '</span></td>' +
                    '</tr>';
                }).join("");"""

if old_table_b_render in content:
    content = content.replace(old_table_b_render, new_table_b_render, 1)
    print("8. Successfully updated Table B row rendering with 7 columns")
else:
    print("8. Table B row rendering pattern not matched")

# 9. Update Table C rendering (11 columns with Usage Status)
old_table_c_render = """                    return '<tr>' +
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
                    '</tr>';"""

new_table_c_render = """                    return '<tr>' +
                        '<td title="' + escapeHtml(m.campaignName) + '"><strong>' + escapeHtml(m.campaignName) + '</strong></td>' +
                        '<td>' + (m.rawId ? escapeHtml(m.rawId) : '<span class="ct-campaign-id-badge is-unverified">Awaiting ID</span>') + '</td>' +
                        '<td><span class="ct-lfi-badge ' + stateClass + '">' + escapeHtml(m.state) + '</span></td>' +
                        '<td style="text-align:right;">' + formatNumber(m.agents) + '</td>' +
                        '<td style="text-align:right;"><span class="ct-lfi-lead-pool" title="Campaign callable lead pool in active dialer queue">' + (m.campaignLeadPool !== "UNAVAILABLE" ? formatNumber(m.campaignLeadPool) : "—") + '</span> <small class="ct-pool-tag">Callable</small></td>' +
                        '<td title="' + escapeHtml(m.assignedFilter || "None") + '"><strong>' + escapeHtml(m.assignedFilter || "None") + '</strong></td>' +
                        '<td style="text-align:right;">' + (m.filterCount !== null ? '<span class="ct-lfi-filter-count" title="Filter-matching contacts from targeting snapshot">' + formatNumber(m.filterCount) + '</span>' : '<span class="ct-lfi-empty-val">—</span>') + '</td>' +
                        '<td><span class="ct-lfi-source">' + escapeHtml(m.verification) + '</span></td>' +
                        '<td>' + escapeHtml(m.lastObservedTimeStr || "—") + '</td>' +
                        '<td><span class="ct-lfi-badge ' + freshClass + '">' + escapeHtml(freshLabel) + '</span></td>' +
                        '<td><span class="ct-lfi-badge ' + usageClass + '">' + escapeHtml(m.usageStatus) + '</span></td>' +
                    '</tr>';"""

if old_table_c_render in content:
    content = content.replace(old_table_c_render, new_table_c_render, 1)
    print("9. Successfully updated Table C row rendering with 11 columns")
else:
    print("9. Table C row rendering pattern not matched")

# 10. Update Verified Change History transition
old_history_render = """                refs.lfiHistoryList.innerHTML = history.slice(0, 10).map(function (item) {
                    return '<div class="ct-lfi-history-item">' +
                        '<div class="ct-lfi-history-meta">' +
                            '<span class="ct-lfi-badge is-history">' + escapeHtml(item.status || "CHANGE") + '</span>' +
                            '<strong>' + escapeHtml(item.campaignName || item.campaignId) + '</strong>' +
                            '<small>' + escapeHtml(item.confirmedAt || "") + '</small>' +
                        '</div>' +
                        '<div class="ct-lfi-history-body">' +
                            '<span class="ct-lfi-prev">' + escapeHtml(item.previousFilter || "None") + '</span>' +
                            '<span class="ct-lfi-arrow"> ➔ </span>' +
                            '<span class="ct-lfi-curr">' + escapeHtml(item.currentFilter || "None") + '</span>' +
                            ' <small class="ct-lfi-source">(' + escapeHtml(item.source || "DOM") + ')</small>' +
                        '</div>' +
                    '</div>';
                }).join("");"""

new_history_render = """                refs.lfiHistoryList.innerHTML = history.slice(0, 10).map(function (item) {
                    const prevCountStr = item.previousCount !== undefined && item.previousCount !== null ? ' (' + formatNumber(item.previousCount) + ')' : '';
                    const currCountStr = item.currentCount !== undefined && item.currentCount !== null ? ' (' + formatNumber(item.currentCount) + ')' : '';
                    return '<div class="ct-lfi-history-item">' +
                        '<div class="ct-lfi-history-meta">' +
                            '<span class="ct-lfi-badge is-history">' + escapeHtml(item.status || "VERIFIED CHANGE") + '</span>' +
                            '<strong>' + escapeHtml(item.campaignName || item.campaignId) + '</strong>' +
                            '<small class="ct-lfi-history-time">' + escapeHtml(item.confirmedAt || (item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : "")) + '</small>' +
                        '</div>' +
                        '<div class="ct-lfi-history-body">' +
                            '<div class="ct-lfi-transition">' +
                                '<span class="ct-lfi-prev">' + escapeHtml(item.previousFilter || "None") + prevCountStr + '</span>' +
                                '<span class="ct-lfi-arrow"> ➔ </span>' +
                                '<span class="ct-lfi-curr">' + escapeHtml(item.currentFilter || "None") + currCountStr + '</span>' +
                            '</div>' +
                            '<small class="ct-lfi-source">Evidence: ' + escapeHtml(item.source || "CONFIRMED OBSERVATION") + '</small>' +
                        '</div>' +
                    '</div>';
                }).join("");"""

if old_history_render in content:
    content = content.replace(old_history_render, new_history_render, 1)
    print("10. Successfully updated Verified Change History rendering with old-to-new transition")
else:
    print("10. History render pattern not matched")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("East-2 dashboard.js patch complete.")
