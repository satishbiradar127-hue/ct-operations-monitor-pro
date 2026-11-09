import os

for dialer in ["East2", "East3"]:
    p = f"CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_{dialer}/src/intelligence.js"
    with open(p, "r", encoding="utf-8") as f:
        content = f.read()

    old_target = """                let assignedFilter = null;
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
                                   entry.source === "ACTIVE_OVERLAY" ? "VERIFIED (Overlay)" :
                                   (entry.source || "VERIFIED (Registry)");
                } else if (c.liveFilter) {
                    assignedFilter = c.liveFilter;
                    verification = c.liveFilterSource === "ACTIVE_OVERLAY" ? "VERIFIED (Overlay)" :
                                   c.liveFilterSource === "TABLE_COLUMN" ? "VERIFIED (Table)" :
                                   (c.liveFilterSource || "VERIFIED");
                    observationTime = c.liveFilterTimestamp || now;
                }"""

    new_target = """                let assignedFilter = null;
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
                                   entry.source === "ACTIVE_OVERLAY" ? "VERIFIED (Overlay)" :
                                   (entry.source || "VERIFIED (Registry)");
                } else if (c.liveFilter) {
                    rawFilter = c.liveFilter;
                    assignedFilter = c.liveFilter;
                    const mCount = String(assignedFilter).match(/[\\(\\[]\\s*(?:Count|Contacts)?\\s*:?\\s*([0-9,]+)\\s*[\\)\\]]/i);
                    if (mCount && mCount[1]) {
                        filterCount = Number(mCount[1].replace(/,/g, ""));
                        assignedFilter = String(assignedFilter).replace(/[\\(\\[]\\s*(?:Count|Contacts)?\\s*:?\\s*[0-9,]+\\s*[\\)\\]]/i, "").trim();
                    }
                    verification = c.liveFilterSource === "ACTIVE_OVERLAY" ? "VERIFIED (Overlay)" :
                                   c.liveFilterSource === "TABLE_COLUMN" ? "VERIFIED (Table)" :
                                   (c.liveFilterSource || "VERIFIED");
                    observationTime = c.liveFilterTimestamp || now;
                }"""

    if old_target in content:
        content = content.replace(old_target, new_target)
        with open(p, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Successfully updated matrix code in {p}")
    else:
        print(f"Failed to find old_target in {p}")

