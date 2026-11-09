import os, re

def update_parser(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update readCampaignEditForm to extract filterCount and cleanFilterName
    old_code = """        if (!campaignId && !liveFilter && !campaignName) return null;

        const isAssigned = Boolean(liveFilter && liveFilter !== "None" && liveFilter !== "Unassigned");
        return {
            campaignId: campaignId || "unknown",
            campaignName: campaignName || (campaignId ? `Campaign ${campaignId}` : ""),
            liveFilter: isAssigned ? liveFilter : null,
            status: isAssigned ? "ASSIGNED" : "NONE",
            source: filterSource,
            timestamp: Date.now()
        };"""

    new_code = """        if (!campaignId && !liveFilter && !campaignName) return null;

        let filterCount = null;
        let cleanFilterName = liveFilter;
        if (liveFilter) {
            const mCount = liveFilter.match(/[\\(\\[]\\s*(?:Count|Contacts)?\\s*:?\\s*([0-9,]+)\\s*[\\)\\]]/i);
            if (mCount && mCount[1]) {
                filterCount = Number(mCount[1].replace(/,/g, ""));
                cleanFilterName = liveFilter.replace(/[\\(\\[]\\s*(?:Count|Contacts)?\\s*:?\\s*[0-9,]+\\s*[\\)\\]]/i, "").trim();
            }
        }

        const isAssigned = Boolean(cleanFilterName && cleanFilterName !== "None" && cleanFilterName !== "Unassigned");
        return {
            campaignId: campaignId || "unknown",
            campaignName: campaignName || (campaignId ? `Campaign ${campaignId}` : ""),
            liveFilter: isAssigned ? cleanFilterName : null,
            rawLiveFilter: liveFilter,
            filterCount: filterCount,
            status: isAssigned ? "ASSIGNED" : "NONE",
            source: filterSource,
            timestamp: Date.now()
        };"""

    if old_code in content:
        content = content.replace(old_code, new_code)
        print(f"Updated readCampaignEditForm in {file_path}")
    else:
        print(f"Warning: old_code not found in {file_path}")

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

def update_content(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    old_code = """                const entry = {
                    campaignId: String(editData.campaignId),
                    campaignName: editData.campaignName,
                    liveFilter: editData.liveFilter,
                    status: editData.status,
                    source: "CAMPAIGN_EDIT_DOM",
                    timestamp: editData.timestamp
                };"""

    new_code = """                const entry = {
                    campaignId: String(editData.campaignId),
                    campaignName: editData.campaignName,
                    liveFilter: editData.liveFilter,
                    rawLiveFilter: editData.rawLiveFilter,
                    filterCount: editData.filterCount,
                    status: editData.status,
                    source: "CAMPAIGN_EDIT_DOM",
                    timestamp: editData.timestamp
                };"""

    if old_code in content:
        content = content.replace(old_code, new_code)
        print(f"Updated observeCampaignEditForm in {file_path}")
    else:
        print(f"Warning: old_code not found in {file_path}")

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

def update_intelligence(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # In getLiveFilterIntelligenceSummary: parse cleanFilterName, filterCount, campaignLeadPool, and freshness
    old_matrix_code = """                let assignedFilter = null;
                let filterId = null;
                let verification = "DOM_UNAVAILABLE";
                let usageStatus = "UNKNOWN";
                let observationTime = null;
                let isStale = false;

                if (entry) {
                    observationTime = entry.timestamp || entry.observedAt || null;
                    const age = observationTime ? (now - observationTime) : 0;
                    isStale = age > SEVEN_DAYS_MS;
                    if (isStale) staleCount++;

                    assignedFilter = entry.liveFilter || entry.filter || null;
                    filterId = entry.liveFilterId || entry.filterId || null;
                    verification = entry.source === "CAMPAIGN_EDIT_FORM" ? "VERIFIED (Edit)" :
                                   entry.source === "CAMPAIGN_EDIT_DOM" ? "VERIFIED (Edit)" :
                                   entry.source === "TABLE_COLUMN" ? "VERIFIED (Table)" : "VERIFIED (Registry)";
                } else if (c.liveFilter) {
                    assignedFilter = c.liveFilter;
                    verification = c.liveFilterSource ? `VERIFIED (${c.liveFilterSource})` : "VERIFIED (Table)";
                    observationTime = c.liveFilterTimestamp || now;
                }

                const hasFilter = Boolean(assignedFilter && assignedFilter !== "None" && assignedFilter !== "Unassigned" && assignedFilter !== "—" && assignedFilter !== "FILTER SOURCE UNAVAILABLE");"""

    new_matrix_code = """                let assignedFilter = null;
                let rawFilter = null;
                let filterCount = null;
                let filterId = null;
                let verification = "DOM_UNAVAILABLE";
                let usageStatus = "UNKNOWN";
                let observationTime = null;
                let isStale = false;

                if (entry) {
                    observationTime = entry.timestamp || entry.observedAt || null;
                    const age = observationTime ? (now - observationTime) : 0;
                    isStale = age > SEVEN_DAYS_MS;
                    if (isStale) staleCount++;

                    rawFilter = entry.rawLiveFilter || entry.liveFilter || entry.filter || null;
                    assignedFilter = entry.liveFilter || entry.filter || null;
                    filterCount = entry.filterCount !== undefined ? entry.filterCount : null;

                    if (filterCount === null && rawFilter) {
                        const mCount = String(rawFilter).match(/[\\(\\[]\\s*(?:Count|Contacts)?\\s*:?\\s*([0-9,]+)\\s*[\\)\\]]/i);
                        if (mCount && mCount[1]) {
                            filterCount = Number(mCount[1].replace(/,/g, ""));
                            assignedFilter = String(rawFilter).replace(/[\\(\\[]\\s*(?:Count|Contacts)?\\s*:?\\s*[0-9,]+\\s*[\\)\\]]/i, "").trim();
                        }
                    }

                    filterId = entry.liveFilterId || entry.filterId || null;
                    verification = entry.source === "CAMPAIGN_EDIT_FORM" ? "VERIFIED (Edit)" :
                                   entry.source === "CAMPAIGN_EDIT_DOM" ? "VERIFIED (Edit)" :
                                   entry.source === "TABLE_COLUMN" ? "VERIFIED (Table)" : "VERIFIED (Registry)";
                } else if (c.liveFilter) {
                    rawFilter = c.liveFilter;
                    assignedFilter = c.liveFilter;
                    const mCount = String(assignedFilter).match(/[\\(\\[]\\s*(?:Count|Contacts)?\\s*:?\\s*([0-9,]+)\\s*[\\)\\]]/i);
                    if (mCount && mCount[1]) {
                        filterCount = Number(mCount[1].replace(/,/g, ""));
                        assignedFilter = String(assignedFilter).replace(/[\\(\\[]\\s*(?:Count|Contacts)?\\s*:?\\s*[0-9,]+\\s*[\\)\\]]/i, "").trim();
                    }
                    verification = c.liveFilterSource ? `VERIFIED (${c.liveFilterSource})` : "VERIFIED (Table)";
                    observationTime = c.liveFilterTimestamp || now;
                }

                const hasFilter = Boolean(assignedFilter && assignedFilter !== "None" && assignedFilter !== "Unassigned" && assignedFilter !== "—" && assignedFilter !== "FILTER SOURCE UNAVAILABLE");"""

    if old_matrix_code in content:
        content = content.replace(old_matrix_code, new_matrix_code)
        print(f"Updated matrix count extraction in {file_path}")
    else:
        print(f"Warning: old_matrix_code not found in {file_path}")

    # Also update matrix return structure
    old_item_ret = """                return {
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

    new_item_ret = """                const ageSec = observationTime ? Math.max(0, Math.floor((now - observationTime) / 1000)) : null;
                let freshness = "UNOBSERVED";
                if (observationTime) {
                    if (isStale || ageSec > 60) freshness = "STALE";
                    else if (ageSec <= 15) freshness = "LIVE";
                    else freshness = "RECENT";
                }

                return {
                    campaignId: displayId,
                    rawId: realId,
                    campaignName: cName,
                    state: isRunning ? (agents > 0 ? "RUNNING" : "ACTIVE") : (isActiveBool ? "ACTIVE" : (rawState || "IDLE")),
                    agents: agents,
                    campaignLeadPool: leadsVal !== null ? leadsVal : "UNAVAILABLE",
                    assignedFilter: hasFilter ? assignedFilter : (assignedFilter === "None" ? "None Assigned" : "Filter Unavailable"),
                    rawAssignedFilter: rawFilter,
                    filterCount: filterCount,
                    filterCountSource: filterCount !== null ? "TARGETING_SNAPSHOT" : "UNAVAILABLE",
                    leadList: c.leadList || "UNAVAILABLE",
                    verification: !realId && verification.startsWith("DOM_UNAVAILABLE") ? "UNVERIFIED_DOM (Awaiting ID)" : verification,
                    usageStatus: usageStatus,
                    lastObserved: observationTime,
                    lastObservedTimeStr: observationTime ? new Date(observationTime).toLocaleTimeString() : "—",
                    freshness: freshness,
                    ageSec: ageSec,
                    lastRefill: "Not exposed by available source",
                    leads: leadsVal !== null ? leadsVal : "UNAVAILABLE",
                    dialer: this.dialer
                };"""

    if old_item_ret in content:
        content = content.replace(old_item_ret, new_item_ret)
        print(f"Updated matrix return object in {file_path}")
    else:
        print(f"Warning: old_item_ret not found in {file_path}")

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

for dialer in ["East2", "East3"]:
    p_parser = f"CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_{dialer}/src/parser.js"
    p_content = f"CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_{dialer}/src/content.js"
    p_intel = f"CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_{dialer}/src/intelligence.js"

    update_parser(p_parser)
    update_content(p_content)
    update_intelligence(p_intel)

print("Parser, content, and intelligence updates complete.")
