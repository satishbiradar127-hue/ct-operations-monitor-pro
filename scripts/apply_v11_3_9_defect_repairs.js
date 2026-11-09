const fs = require('fs');
const path = require('path');

console.log("=== APPLYING V11.3.9 DEFECT REPAIRS TO ROOT SRC ===");

// 1. UPDATE src/dashboard.js
let dash = fs.readFileSync('src/dashboard.js', 'utf8');

// A. Action Center button click listener
const oldAlertsListener = `refs.alerts.addEventListener("click", function (event) {
            const action = event.target.closest("[data-alert-action]");
            if (!action) return;`;

const newAlertsListener = `refs.alerts.addEventListener("click", function (event) {
            const action = event.target.closest("[data-alert-action], [data-intel-action], [data-noted-id], [data-intel-noted-id]");
            if (!action) return;
            event.preventDefault();
            event.stopPropagation();

            // Intelligence Alert DISMISS or FOCUS
            if (action.dataset && action.dataset.intelAction) {
                const intelAct = action.dataset.intelAction;
                if (intelAct === "dismiss") {
                    const intelId = action.dataset.intelId;
                    const card = action.closest(".ct-intelligence-card, .ct-alert");
                    if (card) card.remove();
                    if (refs.alerts) refs.alerts.dataset.signature = "";
                    if (refs.persistentGoalsContainer) refs.persistentGoalsContainer.dataset.signature = "";
                    if (intelligenceEngine && intelId) {
                        intelligenceEngine.dismissActiveAlert(intelId);
                    }
                    updateAlerts();
                    showActionNotice("Alert dismissed until condition changes.");
                    scheduleRender();
                    return;
                }
                if (intelAct === "focus") {
                    const target = action.dataset.target;
                    if (target) {
                        focusCampaign(target, false);
                    }
                    return;
                }
            }

            // Persistent Goal NOTED
            if (action.getAttribute && action.getAttribute("data-noted-id")) {
                const notedId = action.getAttribute("data-noted-id");
                const card = action.closest(".ct-persistent-goal-card, .ct-intelligence-card, .ct-alert");
                if (card) card.remove();
                if (refs.alerts) refs.alerts.dataset.signature = "";
                if (refs.persistentGoalsContainer) refs.persistentGoalsContainer.dataset.signature = "";
                acknowledgePersistentGoalAlert(notedId);
                updateAlerts();
                showActionNotice("Persistent goal alert acknowledged [NOTED].");
                scheduleRender();
                return;
            }

            // Intelligence Card NOTED
            if (action.getAttribute && action.getAttribute("data-intel-noted-id")) {
                const intelId = action.getAttribute("data-intel-noted-id");
                const card = action.closest(".ct-intelligence-card, .ct-alert");
                if (card) card.remove();
                if (refs.alerts) refs.alerts.dataset.signature = "";
                if (refs.persistentGoalsContainer) refs.persistentGoalsContainer.dataset.signature = "";
                if (intelligenceEngine) {
                    intelligenceEngine.acknowledgeAlert(intelId);
                }
                updateAlerts();
                showActionNotice("Change intelligence alert acknowledged [NOTED].");
                scheduleRender();
                return;
            }`;

if (dash.includes(oldAlertsListener)) {
    dash = dash.replace(oldAlertsListener, newAlertsListener);
    console.log("✓ Updated refs.alerts click listener to handle data-intel-action and noted IDs on first click");
} else {
    console.log("! Notice: oldAlertsListener pattern not matched exactly in dashboard.js");
}

// B. clearAttentionCenter
const oldClearCenter = `function clearAttentionCenter() {
        const now = Date.now();
        state.recentAlerts.forEach(function (alertItem) {
            if (alertItem && alertItem.conditionKey) {
                state.dismissedConditions.set(alertItem.conditionKey, alertItem.signature || alertItem.message || "");
            }
        });
        persistDismissedConditions();
        state.recentAlerts = [];
        if (intelligenceEngine && typeof intelligenceEngine.clearAllDismissibleAlerts === "function") {
            intelligenceEngine.clearAllDismissibleAlerts();
        }
        if (refs.alerts) refs.alerts.dataset.signature = "";
        if (refs.persistentGoalsContainer) refs.persistentGoalsContainer.dataset.signature = "";
        updateAlerts();
        showActionNotice("Current Action Center signals cleared until their conditions change.");
        scheduleRender();
    }`;

const newClearCenter = `function clearAttentionCenter() {
        state.recentAlerts.forEach(function (alertItem) {
            if (alertItem && alertItem.conditionKey) {
                state.dismissedConditions.set(alertItem.conditionKey, alertItem.signature || alertItem.message || "");
            }
        });
        persistDismissedConditions();
        state.recentAlerts = [];
        if (intelligenceEngine && typeof intelligenceEngine.clearAllDismissibleAlerts === "function") {
            intelligenceEngine.clearAllDismissibleAlerts();
        }
        if (refs.alerts) {
            refs.alerts.dataset.signature = "";
            refs.alerts.textContent = "";
        }
        if (refs.persistentGoalsContainer) {
            refs.persistentGoalsContainer.dataset.signature = "";
            refs.persistentGoalsContainer.textContent = "";
        }
        updateAlerts();
        showActionNotice("Current Action Center signals cleared until conditions change.");
        scheduleRender();
    }`;

if (dash.includes(oldClearCenter)) {
    dash = dash.replace(oldClearCenter, newClearCenter);
    console.log("✓ Updated clearAttentionCenter to immediately blank DOM containers");
}

// C. Card 1 ID display: Campaign ID + Filter ID
const oldCard1Id = `if (refs.topFilterId) {
                    setText(refs.topFilterId, fId ? "ID: " + fId : "ID: Unavailable");
                }`;

const newCard1Id = `if (refs.topFilterId) {
                    const cidDisplay = cId ? "#" + cId : "Unavailable";
                    const fidDisplay = fId ? "#" + fId : "—";
                    setText(refs.topFilterId, "Campaign ID: " + cidDisplay + " · Filter ID: " + fidDisplay);
                }`;

if (dash.includes(oldCard1Id)) {
    dash = dash.replace(oldCard1Id, newCard1Id);
    console.log("✓ Updated Card 1 to display Campaign ID and Filter ID explicitly");
} else {
    console.log("! Notice: oldCard1Id pattern not matched exactly in dashboard.js");
}

// D. Header Badge & Card 5 Honest Truth States (Strict 120s Expiration)
const oldTruthBadge = `const isTargetingCurrent = fName && fSource !== "DOM_UNAVAILABLE" && (!fTimeMs || (Date.now() - fTimeMs) <= 120000);
                if (refs.topFilterCampaign) setText(refs.topFilterCampaign, cName);
                if (refs.topFilterDialer) setText(refs.topFilterDialer, DIALER);
                if (refs.topFilterVerificationState) {
                    if (isTargetingCurrent) {
                        setText(refs.topFilterVerificationState, "TARGETING: VERIFIED");
                        setClass(refs.topFilterVerificationState, "ct-lft-verify-badge is-verified");
                    } else if (fName && fSource !== "DOM_UNAVAILABLE") {
                        setText(refs.topFilterVerificationState, "TARGETING: STALE");
                        setClass(refs.topFilterVerificationState, "ct-lft-verify-badge is-stale");
                    } else if (fName) {
                        setText(refs.topFilterVerificationState, "TARGETING: UNVERIFIED");
                        setClass(refs.topFilterVerificationState, "ct-lft-verify-badge is-unverified");
                    } else {
                        setText(refs.topFilterVerificationState, "TARGETING: AWAITING OBSERVATION");
                        setClass(refs.topFilterVerificationState, "ct-lft-verify-badge is-unavailable");
                    }
                }`;

const newTruthBadge = `const isTargetingCurrent = Boolean(fName && fSource !== "DOM_UNAVAILABLE" && fTimeMs && (Date.now() - fTimeMs) <= 120000);
                if (refs.topFilterCampaign) setText(refs.topFilterCampaign, cName);
                if (refs.topFilterDialer) setText(refs.topFilterDialer, DIALER);
                if (refs.topFilterVerificationState) {
                    if (isTargetingCurrent) {
                        setText(refs.topFilterVerificationState, "TARGETING: VERIFIED");
                        setClass(refs.topFilterVerificationState, "ct-lft-verify-badge is-verified");
                    } else if (fName && fSource !== "DOM_UNAVAILABLE") {
                        const ageStr = fTimeMs ? formatAge(Math.floor((Date.now() - fTimeMs)/1000)) + " ago" : "STALE";
                        setText(refs.topFilterVerificationState, "TARGETING: STALE (" + ageStr + ")");
                        setClass(refs.topFilterVerificationState, "ct-lft-verify-badge is-stale");
                    } else if (fName) {
                        setText(refs.topFilterVerificationState, "TARGETING: UNVERIFIED");
                        setClass(refs.topFilterVerificationState, "ct-lft-verify-badge is-unverified");
                    } else {
                        setText(refs.topFilterVerificationState, "TARGETING: AWAITING OBSERVATION");
                        setClass(refs.topFilterVerificationState, "ct-lft-verify-badge is-unavailable");
                    }
                }`;

if (dash.includes(oldTruthBadge)) {
    dash = dash.replace(oldTruthBadge, newTruthBadge);
    console.log("✓ Updated topFilterVerificationState to strictly enforce 120s TTL and display age");
} else {
    console.log("! Notice: oldTruthBadge pattern not matched in dashboard.js");
}

// Card 5 Confidence
const oldCard5Confidence = `// 6. Card 5: Targeting Verification
                if (refs.topFilterConfidence) {
                    if (isTargetingCurrent) {
                        setText(refs.topFilterConfidence, "VERIFIED");
                    } else if (fName && fSource !== "DOM_UNAVAILABLE") {
                        setText(refs.topFilterConfidence, "STALE (LAST VERIFIED)");
                    } else if (fName) {
                        setText(refs.topFilterConfidence, "UNVERIFIED");
                    } else {
                        setText(refs.topFilterConfidence, "AWAITING OBSERVATION");
                    }
                }`;

const newCard5Confidence = `// 6. Card 5: Targeting Verification
                if (refs.topFilterConfidence) {
                    if (isTargetingCurrent) {
                        setText(refs.topFilterConfidence, "VERIFIED");
                        setClass(refs.topFilterConfidence, "ct-lft-card-primary is-verified");
                    } else if (fName && fSource !== "DOM_UNAVAILABLE") {
                        setText(refs.topFilterConfidence, "STALE (LAST OBSERVED)");
                        setClass(refs.topFilterConfidence, "ct-lft-card-primary is-stale");
                    } else if (fName) {
                        setText(refs.topFilterConfidence, "UNVERIFIED");
                        setClass(refs.topFilterConfidence, "ct-lft-card-primary is-unverified");
                    } else {
                        setText(refs.topFilterConfidence, "AWAITING OBSERVATION");
                        setClass(refs.topFilterConfidence, "ct-lft-card-primary is-unavailable");
                    }
                }`;

if (dash.includes(oldCard5Confidence)) {
    dash = dash.replace(oldCard5Confidence, newCard5Confidence);
    console.log("✓ Updated Card 5 topFilterConfidence to honest truth STALE (LAST OBSERVED)");
} else {
    console.log("! Notice: oldCard5Confidence pattern not matched in dashboard.js");
}

// E. Cross-tab storage sync in onInboundExtensionStorageChanged
const oldStorageChanged = `if (changes && (changes[VERIFIED_FILTERS_KEY] || changes[LIVE_FILTERS_INVENTORY_KEY])) {
            scheduleRender();
        }`;

const newStorageChanged = `if (changes && (changes[VERIFIED_FILTERS_KEY] || changes[LIVE_FILTERS_INVENTORY_KEY])) {
            if (changes[VERIFIED_FILTERS_KEY] && changes[VERIFIED_FILTERS_KEY].newValue) {
                const reg = changes[VERIFIED_FILTERS_KEY].newValue;
                if (Array.isArray(state.campaigns)) {
                    state.campaigns.forEach(function (c) {
                        const cid = c.rawId || c.id || c.__id;
                        const entry = (cid && reg[String(cid)]) || (c.name && reg[String(c.name).trim()]) || null;
                        if (entry && entry.liveFilter) {
                            c.liveFilter = entry.liveFilter;
                            c.liveFilterSource = entry.source || "VERIFIED_REGISTRY";
                            c.liveFilterTimestamp = entry.timestamp || null;
                            c.liveFilterCount = entry.filterCount !== undefined ? entry.filterCount : null;
                        }
                    });
                }
            }
            scheduleRender();
        }`;

if (dash.includes(oldStorageChanged)) {
    dash = dash.replace(oldStorageChanged, newStorageChanged);
    console.log("✓ Updated storage listener to enrich state.campaigns immediately on cross-tab verified filter changes");
} else {
    console.log("! Notice: oldStorageChanged pattern not matched in dashboard.js");
}

// F. In updateOperatingSelect: ensure prepareCampaigns is always used and menu stability
const oldUpdateOperating = `function updateOperatingSelect(campaigns) {
        if (!refs.operatingOptions || !refs.operatingTrigger) return;
        const current = new Set((state.operatingCampaigns || []).map(function(id) { return String(id || "").trim(); }).filter(Boolean));
        const all = Array.isArray(campaigns) && campaigns.length ? campaigns : (Array.isArray(state.campaigns) && state.campaigns.length ? state.campaigns : []);`;

const newUpdateOperating = `function updateOperatingSelect(campaigns) {
        if (!refs.operatingOptions || !refs.operatingTrigger) return;
        const rawList = Array.isArray(campaigns) && campaigns.length ? campaigns : (Array.isArray(state.campaigns) && state.campaigns.length ? state.campaigns : []);
        const all = prepareCampaigns(rawList);
        const current = new Set((state.operatingCampaigns || []).map(function(id) { return String(id || "").trim(); }).filter(Boolean));`;

if (dash.includes(oldUpdateOperating)) {
    dash = dash.replace(oldUpdateOperating, newUpdateOperating);
    console.log("✓ Updated updateOperatingSelect to ensure uniform prepareCampaigns input");
} else {
    console.log("! Notice: oldUpdateOperating pattern not matched in dashboard.js");
}

fs.writeFileSync('src/dashboard.js', dash, 'utf8');
console.log("✓ Successfully updated src/dashboard.js");

// 2. UPDATE src/parser.js
let parser = fs.readFileSync('src/parser.js', 'utf8');

// A. In readRow: add checkbox and Angular router attribute extraction
const oldIdExtraction = `            // 1. Precise Campaign ID Extraction (Stable Numeric ID)
            let id = null;
            const idNode = row.querySelector('[data-campaign-id], [data-id], [data-campaignid]');
            if (idNode) {
                const rawAttr = (idNode.getAttribute("data-campaign-id") || idNode.getAttribute("data-id") || idNode.getAttribute("data-campaignid") || "").trim();
                if (/^[0-9]+$/.test(rawAttr)) id = rawAttr;
            }
            if (!id) {
                const rowAttr = (row.getAttribute("data-campaign-id") || row.getAttribute("data-id") || "").trim();
                if (/^[0-9]+$/.test(rowAttr)) id = rowAttr;
            }`;

const newIdExtraction = `            // 1. Precise Campaign ID Extraction (Stable Numeric ID)
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
                const cb = row.querySelector("input[type='checkbox'], mat-checkbox");
                if (cb) {
                    const cbVal = (cb.value || cb.getAttribute("value") || cb.getAttribute("data-id") || cb.getAttribute("data-campaign-id") || "").trim();
                    if (/^[0-9]+$/.test(cbVal) && cbVal !== "on" && cbVal !== "true") id = cbVal;
                }
            }
            if (!id) {
                const ngEls = Array.from(row.querySelectorAll("[ng-reflect-router-link], [ng-reflect-href], [ng-reflect-id]"));
                for (const ng of ngEls) {
                    const rLink = ng.getAttribute("ng-reflect-router-link") || ng.getAttribute("ng-reflect-href") || ng.getAttribute("ng-reflect-id") || "";
                    const m = rLink.match(/(?:^|[,\/\\s])([0-9]{2,10})(?:$|[,\/\\s])/);
                    if (m && m[1]) { id = m[1]; break; }
                }
            }`;

if (parser.includes(oldIdExtraction)) {
    parser = parser.replace(oldIdExtraction, newIdExtraction);
    console.log("✓ Updated readRow campaign ID extraction with checkbox and router link detection");
}

// B. In readRow: liveFilterTimestamp must preserve verifiedTimestamp and NEVER default to Date.now()
const oldTimestampCode = `const liveFilterTimestamp = verifiedTimestamp || (hasLiveFilter ? Date.now() : null);`;
const newTimestampCode = `const liveFilterTimestamp = verifiedTimestamp || null;`;

if (parser.includes(oldTimestampCode)) {
    parser = parser.replace(oldTimestampCode, newTimestampCode);
    console.log("✓ Fixed liveFilterTimestamp in readRow to preserve verifiedTimestamp (never reset to Date.now())");
}

// C. In readRow: Registry freshness TTL 120s
const oldRegistryTTL = `                        const entryAge = entry.timestamp ? (Date.now() - entry.timestamp) : 0;
                        const isStale = entryAge > (7 * 24 * 60 * 60 * 1000);
                        if (!isStale) {
                            const fVal = entry.liveFilter || entry.filter;
                            if (fVal) {
                                rawLiveFilter = fVal;
                                filterSource = entry.source || "VERIFIED_REGISTRY";
                                verifiedTimestamp = entry.timestamp || null;
                            }
                        }`;

const newRegistryTTL = `                        const entryAge = entry.timestamp ? (Date.now() - entry.timestamp) : 0;
                        const isStale = entryAge > 120000;
                        const fVal = entry.liveFilter || entry.filter;
                        if (fVal) {
                            rawLiveFilter = fVal;
                            filterSource = isStale ? "STALE_REGISTRY" : (entry.source || "VERIFIED_REGISTRY");
                            verifiedTimestamp = entry.timestamp || null;
                        }`;

if (parser.includes(oldRegistryTTL)) {
    parser = parser.replace(oldRegistryTTL, newRegistryTTL);
    console.log("✓ Updated registry TTL in readRow to 120s honest truth");
}

// D. In readCampaignEditForm: extract filter ID from pencil link and improve prefix matching
const oldEditFormEnding = `        if (!campaignId && !liveFilter && !campaignName) return null;

        let filterCount = null;
        let cleanFilterName = liveFilter;
        if (liveFilter) {
            const mCount = liveFilter.match(/[\(\[]\s*(?:Count|Contacts)?\s*:?\s*([0-9,]+)\s*[\)\]]/i);
            if (mCount && mCount[1]) {
                filterCount = Number(mCount[1].replace(/,/g, ""));
                cleanFilterName = liveFilter.replace(/[\(\[]\s*(?:Count|Contacts)?\s*:?\s*[0-9,]+\s*[\)\]]/i, "").trim();
            }

            // Cross-reference with title attribute or inventory if filter name ends with ellipsis
            if (cleanFilterName && (cleanFilterName.endsWith("...") || cleanFilterName.endsWith("…") || cleanFilterName.includes("..."))) {
                const prefix = cleanFilterName.replace(/\\.{3}$|…$/, "").replace(/\\.\\.\\..*$/, "").trim().toLowerCase();
                const titleMatch = targetDoc.querySelector && targetDoc.querySelector(\`[title^="\${prefix}" i], [aria-label^="\${prefix}" i]\`);
                if (titleMatch) {
                    const full = String(titleMatch.getAttribute("title") || titleMatch.getAttribute("aria-label") || "").trim();
                    if (full && !full.endsWith("...") && !full.endsWith("…") && isValidFilterValue(full)) {
                        cleanFilterName = full;
                    }
                }
                if (cleanFilterName.endsWith("...") || cleanFilterName.endsWith("…") || cleanFilterName.includes("...")) {
                    try {
                        const isEast3Env = (typeof window !== "undefined" && window.location && window.location.hostname.includes("east-3")) || (typeof isEast3 !== "undefined" && isEast3);
                        const invKey = isEast3Env ? "ct_east3_live_filters_inventory_v1" : "ct_east2_live_filters_inventory_v1";
                        const invStorage = typeof localStorage !== "undefined" ? localStorage : (typeof window !== "undefined" ? window.localStorage : null);
                        if (invStorage) {
                            const invData = JSON.parse(invStorage.getItem(invKey) || "{}");
                            const items = invData.items ? Object.values(invData.items) : (Array.isArray(invData) ? invData : []);
                            const match = items.find(f => f && f.name && f.name.toLowerCase().startsWith(prefix));
                            if (match) {
                                cleanFilterName = match.name;
                                if (filterCount === null && match.count !== undefined) {
                                    filterCount = Number(match.count);
                                }
                            }
                        }
                    } catch (e) {}
                }
            }
        }

        const isAssigned = Boolean(cleanFilterName && isValidFilterValue(cleanFilterName));
        return {
            campaignId: campaignId || "unknown",
            campaignName: campaignName || (campaignId ? \`Campaign \${campaignId}\` : ""),
            liveFilter: isAssigned ? cleanFilterName : null,
            rawLiveFilter: liveFilter,
            filterCount: filterCount,
            status: isAssigned ? "ASSIGNED" : "NONE",
            source: filterSource,
            timestamp: Date.now()
        };`;

const newEditFormEnding = `        // Extract Filter ID from pencil edit link if present
        let extractedFilterId = null;
        try {
            const editLinks = Array.from(targetDoc.querySelectorAll("a[href*='live-filter'], a[href*='live_filter'], [data-filter-id]"));
            for (const el of editLinks) {
                const href = el.getAttribute("href") || "";
                const m = href.match(/\\/live-filters?\\/(?:edit\\/)?([0-9]+)/i);
                if (m && m[1]) {
                    extractedFilterId = m[1];
                    break;
                }
                const dfid = el.getAttribute("data-filter-id");
                if (dfid && /^[0-9]+$/.test(dfid)) {
                    extractedFilterId = dfid;
                    break;
                }
            }
        } catch (e) {}

        if (!campaignId && !liveFilter && !campaignName) return null;

        let filterCount = null;
        let cleanFilterName = liveFilter;
        if (liveFilter) {
            const mCount = liveFilter.match(/[\(\[]\s*(?:Count|Contacts)?\s*:?\s*([0-9,]+)\s*[\)\]]/i);
            if (mCount && mCount[1]) {
                filterCount = Number(mCount[1].replace(/,/g, ""));
                cleanFilterName = liveFilter.replace(/[\(\[]\s*(?:Count|Contacts)?\s*:?\s*[0-9,]+\s*[\)\]]/i, "").trim();
            }

            // Cross-reference with title attribute or inventory if filter name ends with ellipsis
            if (cleanFilterName && (cleanFilterName.endsWith("...") || cleanFilterName.endsWith("…") || cleanFilterName.includes("..."))) {
                const prefix = cleanFilterName.replace(/\\.{3}$|…$/, "").replace(/\\.\\.\\..*$/, "").trim().toLowerCase();
                const titleMatch = targetDoc.querySelector && targetDoc.querySelector(\`[title^="\${prefix}" i], [aria-label^="\${prefix}" i]\`);
                if (titleMatch) {
                    const full = String(titleMatch.getAttribute("title") || titleMatch.getAttribute("aria-label") || "").trim();
                    if (full && !full.endsWith("...") && !full.endsWith("…") && isValidFilterValue(full)) {
                        cleanFilterName = full.replace(/[\(\[]\s*(?:Count|Contacts)?\s*:?\s*[0-9,]+\s*[\)\]]/i, "").trim();
                    }
                }
                if (cleanFilterName.endsWith("...") || cleanFilterName.endsWith("…") || cleanFilterName.includes("...")) {
                    try {
                        const isEast3Env = (typeof window !== "undefined" && window.location && window.location.hostname.includes("east-3")) || (typeof isEast3 !== "undefined" && isEast3);
                        const invKey = isEast3Env ? "ct_east3_live_filters_inventory_v1" : "ct_east2_live_filters_inventory_v1";
                        const invStorage = typeof localStorage !== "undefined" ? localStorage : (typeof window !== "undefined" ? window.localStorage : null);
                        if (invStorage) {
                            const invData = JSON.parse(invStorage.getItem(invKey) || "{}");
                            const items = invData.items ? Object.values(invData.items) : (Array.isArray(invData) ? invData : []);

                            // 1. If filterId was extracted from edit pencil link, match exact ID
                            let match = null;
                            if (extractedFilterId) {
                                match = items.find(f => f && String(f.id) === String(extractedFilterId));
                            }
                            // 2. Score candidates by longest prefix match
                            if (!match) {
                                const candidates = items.filter(f => f && f.name && f.name.toLowerCase().startsWith(prefix));
                                if (candidates.length === 1) {
                                    match = candidates[0];
                                } else if (candidates.length > 1) {
                                    // Pick candidate with best match to prefix length
                                    candidates.sort((a, b) => (b.name || "").length - (a.name || "").length);
                                    match = candidates[0];
                                }
                            }
                            if (match) {
                                cleanFilterName = match.name.replace(/[\(\[]\s*(?:Count|Contacts)?\s*:?\s*[0-9,]+\s*[\)\]]/i, "").trim();
                                if (filterCount === null && match.count !== undefined) {
                                    filterCount = Number(match.count);
                                }
                                if (!extractedFilterId && match.id) {
                                    extractedFilterId = String(match.id);
                                }
                            }
                        }
                    } catch (e) {}
                }
            }
        }

        const isAssigned = Boolean(cleanFilterName && isValidFilterValue(cleanFilterName));
        return {
            campaignId: campaignId || "unknown",
            campaignName: campaignName || (campaignId ? \`Campaign \${campaignId}\` : ""),
            liveFilter: isAssigned ? cleanFilterName : null,
            rawLiveFilter: liveFilter,
            filterId: extractedFilterId || null,
            filterCount: filterCount,
            status: isAssigned ? "ASSIGNED" : "NONE",
            source: filterSource,
            timestamp: Date.now()
        };`;

if (parser.includes(oldEditFormEnding)) {
    parser = parser.replace(oldEditFormEnding, newEditFormEnding);
    console.log("✓ Updated readCampaignEditForm with pencil link filterId and robust inventory resolution");
}

fs.writeFileSync('src/parser.js', parser, 'utf8');
console.log("✓ Successfully updated src/parser.js");

// 3. UPDATE src/content.js
let content = fs.readFileSync('src/content.js', 'utf8');

// A. Add SPA navigation interception and cross-tab storage sync
const oldObserver = `    function installObserver() {
        if (observer) observer.disconnect();
        const target = document.body;
        observer = new MutationObserver(function (mutations) {
            if (!isMonitorPage()) return;
            if (isLiveFiltersPage()) {
                observeLiveFiltersPage();
                return;
            }
            if (isQueuesPage()) {
                if (mutations.some(mutationTouchesQueueTable)) scheduleDomRead();
                return;
            }
            if (mutations.some(mutationTouchesCampaignTable)) scheduleDomRead();
        });`;

const newObserver = `    function installObserver() {
        if (observer) observer.disconnect();
        const target = document.body;
        observer = new MutationObserver(function (mutations) {
            if (!isMonitorPage()) return;
            if (isCampaignEditPage()) {
                observeCampaignEditForm();
                return;
            }
            if (isLiveFiltersPage()) {
                observeLiveFiltersPage();
                return;
            }
            if (isQueuesPage()) {
                if (mutations.some(mutationTouchesQueueTable)) scheduleDomRead();
                return;
            }
            if (mutations.some(mutationTouchesCampaignTable)) scheduleDomRead();
        });`;

if (content.includes(oldObserver)) {
    content = content.replace(oldObserver, newObserver);
    console.log("✓ Updated installObserver to handle isCampaignEditPage()");
}

// B. Intercept SPA Navigation & Storage listeners in init()
const oldInitListeners = `        document.addEventListener("visibilitychange", function () {
            if (document.visibilityState === "visible") {
                readAndPublish("tab-visibility-recovery", true);
            }
        });`;

const newInitListeners = `        document.addEventListener("visibilitychange", function () {
            if (document.visibilityState === "visible") {
                if (isCampaignEditPage()) {
                    observeCampaignEditForm();
                } else if (isCampaignsPage()) {
                    readAndPublish("tab-visibility-recovery", true);
                }
            }
        });

        // Intercept Angular SPA Navigation
        (function interceptSpa() {
            if (window.__CT_SPA_INTERCEPTED) return;
            window.__CT_SPA_INTERCEPTED = true;
            const pushStateOrig = history.pushState;
            const replaceStateOrig = history.replaceState;
            function onRouteTransition() {
                window.setTimeout(function () {
                    if (isCampaignEditPage()) {
                        observeCampaignEditForm();
                    } else if (isLiveFiltersPage()) {
                        observeLiveFiltersPage();
                    } else if (isCampaignsPage()) {
                        readAndPublish("spa-navigation");
                    }
                }, 120);
            }
            history.pushState = function () {
                const res = pushStateOrig.apply(this, arguments);
                onRouteTransition();
                return res;
            };
            history.replaceState = function () {
                const res = replaceStateOrig.apply(this, arguments);
                onRouteTransition();
                return res;
            };
            window.addEventListener("popstate", onRouteTransition);
        })();

        // Cross-tab immediate storage sync
        window.addEventListener("storage", function (e) {
            if (e.key === VERIFIED_FILTERS_KEY && isCampaignsPage()) {
                readAndPublish("storage-sync-verified-filter");
            }
        });
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener(function (changes) {
                if (changes && changes[VERIFIED_FILTERS_KEY] && isCampaignsPage()) {
                    readAndPublish("chrome-storage-verified-filter");
                }
            });
        }`;

if (content.includes(oldInitListeners)) {
    content = content.replace(oldInitListeners, newInitListeners);
    console.log("✓ Added Angular SPA navigation interception and cross-tab storage sync to content.js");
}

fs.writeFileSync('src/content.js', content, 'utf8');
console.log("✓ Successfully updated src/content.js");
