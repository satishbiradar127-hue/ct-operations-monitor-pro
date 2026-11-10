const fs = require('fs');
const path = require('path');

const east3Dir = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE', 'CT_Operations_Monitor_East3');

console.log('=== APPLYING EAST-3 FINAL ROOT CAUSE REPAIRS ===');
console.log('Target Directory:', east3Dir);

// -------------------------------------------------------------------------------------
// 1. PATCH PARSER.JS
// -------------------------------------------------------------------------------------
const parserPath = path.join(east3Dir, 'src', 'parser.js');
let parserCode = fs.readFileSync(parserPath, 'utf8');

// In parser.js, update readCampaigns: lookup verified registry strictly by numeric id
parserCode = parserCode.replace(
    /\/\/ Check verified registry if not found directly in current table row[\s\S]*?const hasLiveFilter = Boolean\(rawLiveFilter/,
    `// Check verified registry if not found directly in current table row
            let verifiedTimestamp = null;
            const storageObj = (typeof localStorage !== "undefined" ? localStorage : null) || (typeof window !== "undefined" && window.localStorage ? window.localStorage : null);
            if (!rawLiveFilter && storageObj) {
                try {
                    const regKey = "ct_east3_verified_campaign_filters_v1";
                    const regData = JSON.parse(storageObj.getItem(regKey) || "{}");
                    let entry = null;
                    if (id && regData[String(id)]) {
                        entry = regData[String(id)];
                    }
                    if (entry) {
                        const entryAge = entry.timestamp ? (Date.now() - entry.timestamp) : 0;
                        const isStale = entryAge > 120000;
                        const fVal = entry.liveFilter || entry.filter;
                        if (fVal) {
                            rawLiveFilter = fVal;
                            filterSource = isStale ? "STALE_REGISTRY" : (entry.source || "VERIFIED_REGISTRY");
                            verifiedTimestamp = entry.timestamp || null;
                        }
                    }
                } catch (e) {}
            }

            const hasLiveFilter = Boolean(rawLiveFilter`
);

// In parser.js, replace readCampaignEditForm with bulletproof version that ignores dashboard DOM
const newReadCampaignEditForm = `    readCampaignEditForm(doc) {
        const targetDoc = (doc && doc.document) ? doc.document : (doc || (typeof document !== "undefined" ? document : null));
        if (!targetDoc || !targetDoc.querySelector) return null;

        // Helper: Ensure element is NOT inside CT Operations Monitor dashboard
        function notDashboard(el) {
            if (!el) return false;
            return !el.closest || !el.closest("#ct-operations-dashboard, [id^='ct-operations-dashboard']");
        }

        // If on non-edit route without explicit edit form container, do not parse
        if (typeof window !== "undefined" && window.location && window.location.pathname) {
            const p = window.location.pathname;
            if (p === "/manager/campaigns" || (p.startsWith("/manager/campaigns") && !p.includes("/campaigns/edit/"))) {
                const hasEditContainer = Boolean(targetDoc.querySelector && Array.from(targetDoc.querySelectorAll("form, .campaign-edit-form, input[name='name']")).some(notDashboard));
                if (!hasEditContainer) return null;
            }
        }

        // 1. Identify Campaign ID
        let campaignId = "";
        if (typeof window !== "undefined" && window.location && window.location.pathname) {
            const match = window.location.pathname.match(/\\/campaigns\\/edit\\/([0-9a-zA-Z_\\-]+)/);
            if (match && /^[0-9]+$/.test(match[1])) campaignId = match[1];
        }
        if (!campaignId) {
            const formElements = Array.from(targetDoc.querySelectorAll("[data-campaign-id], [data-id]")).filter(notDashboard);
            for (const el of formElements) {
                const did = (el.getAttribute("data-campaign-id") || el.getAttribute("data-id") || "").trim();
                if (/^[0-9]+$/.test(did)) {
                    campaignId = did;
                    break;
                }
            }
        }
        if (!campaignId) {
            const idInputs = Array.from(targetDoc.querySelectorAll("input[name='id'], input[formcontrolname='id']")).filter(notDashboard);
            for (const el of idInputs) {
                const val = (el.value || el.getAttribute("value") || "").trim();
                if (/^[0-9]+$/.test(val)) {
                    campaignId = val;
                    break;
                }
            }
        }

        // 2. Identify Campaign Name
        let campaignName = "";
        const nameInputs = Array.from(targetDoc.querySelectorAll("input[name='name'], input[formcontrolname='name'], input[id='name']")).filter(notDashboard);
        for (const inp of nameInputs) {
            const val = String(inp.value || inp.getAttribute("value") || "").trim();
            if (val) {
                campaignName = val;
                break;
            }
        }
        if (!campaignName) {
            const headers = Array.from(targetDoc.querySelectorAll("h1, h2, .page-title, .breadcrumb-item.active")).filter(notDashboard);
            for (const headerEl of headers) {
                const txt = (headerEl.innerText || headerEl.textContent || "").trim();
                const m = txt.match(/^Edit\\s+Campaign\\s*\\((.*?)\\)$/i) || txt.match(/^Edit\\s+(?:Campaign\\s+)?\\(?(.*?)\\)?$/i);
                if (m && (m[1] || m[2])) {
                    campaignName = String(m[1] || m[2] || "").trim();
                    break;
                }
            }
        }

        // 3. Identify Live Filter
        let liveFilter = null;
        let filterSource = "NONE";

        function isValidFilterValue(val) {
            if (!val) return false;
            const s = String(val).trim();
            if (!s || s === "—" || s === "-" || s === "None" || s === "Unassigned") return false;
            const lower = s.toLowerCase();
            if (lower.startsWith("select") || lower === "choose..." || lower === "please select a live filter or bucket") return false;
            if (lower.startsWith("detected:") || lower.includes("calltools operations") || lower.includes("scheduled tasks") || lower.includes("live filter targeting")) return false;
            return true;
        }

        // A. Angular ng-select (CallTools standard)
        const ngSelects = Array.from(targetDoc.querySelectorAll("ng-select[formcontrolname*='filter' i], ng-select[name*='filter' i], ng-select[id*='filter' i], ng-select[aria-label*='filter' i], ng-select")).filter(notDashboard);
        for (const ng of ngSelects) {
            const container = ng.closest(".form-group, mat-form-field, .targeting-field, .field, fieldset, section") || ng.parentElement;
            const containerText = container ? (container.textContent || "") : "";
            const isFilterSelect = (ng.getAttribute("formcontrolname") && ng.getAttribute("formcontrolname").toLowerCase().includes("filter")) ||
                                   (ng.getAttribute("name") && ng.getAttribute("name").toLowerCase().includes("filter")) ||
                                   /live\\s*filter/i.test(containerText) ||
                                   /targeting/i.test(containerText);
            if (!isFilterSelect && ngSelects.length > 1) continue;

            const valEl = ng.querySelector(".ng-value-label, span[title], span.ng-value, [class*='ng-value-label']") || ng.querySelector(".ng-value");
            if (valEl) {
                const targetEl = (valEl.querySelector && valEl.querySelector(".ng-value-label, span[title]")) || valEl;
                // Check title or aria-label first (CallTools stores full untruncated name here)
                const fullTitle = String(targetEl.getAttribute("title") || targetEl.getAttribute("aria-label") || "").trim();
                const innerText = String(targetEl.innerText || targetEl.textContent || "").trim();
                const bestVal = (fullTitle && isValidFilterValue(fullTitle) && !fullTitle.endsWith("...") && !fullTitle.endsWith("…")) ? fullTitle : innerText;
                if (isValidFilterValue(bestVal)) {
                    liveFilter = bestVal;
                    filterSource = "NG_SELECT";
                    break;
                }
            }
            if (!liveFilter) {
                const inputEl = ng.querySelector("input:not([type='hidden'])");
                if (inputEl) {
                    const inpVal = String(inputEl.getAttribute("title") || inputEl.value || inputEl.getAttribute("value") || "").trim();
                    if (isValidFilterValue(inpVal)) {
                        liveFilter = inpVal;
                        filterSource = "NG_SELECT";
                        break;
                    }
                }
            }
        }

        // B. Angular Material mat-select
        if (!liveFilter) {
            const matSelects = Array.from(targetDoc.querySelectorAll("mat-select[formcontrolname*='filter' i], mat-select[name*='filter' i], mat-select[aria-label*='filter' i], mat-select[placeholder*='filter' i]")).filter(notDashboard);
            for (const ms of matSelects) {
                const valEl = ms.querySelector(".mat-select-value, .mat-select-value-text, .mat-mdc-select-value-text, .mat-select-min-line");
                const valText = valEl ? String(valEl.innerText || valEl.textContent || "").trim() : "";
                if (isValidFilterValue(valText)) {
                    liveFilter = valText;
                    filterSource = "MAT_SELECT";
                    break;
                }
            }
        }

        // C. Standard HTML select
        if (!liveFilter) {
            const nativeSelects = Array.from(targetDoc.querySelectorAll("select[name*='filter' i], select[id*='filter' i], select[formcontrolname*='filter' i]")).filter(notDashboard);
            for (const sel of nativeSelects) {
                if (sel.options && sel.options.length > 0) {
                    const idx = sel.selectedIndex >= 0 ? sel.selectedIndex : 0;
                    const opt = sel.options[idx];
                    const text = opt ? String(opt.text || opt.innerText || opt.textContent || opt.value || "").trim() : "";
                    if (isValidFilterValue(text)) {
                        liveFilter = text;
                        filterSource = "NATIVE_SELECT";
                        break;
                    }
                } else if (sel.value) {
                    const text = String(sel.value).trim();
                    if (isValidFilterValue(text)) {
                        liveFilter = text;
                        filterSource = "NATIVE_SELECT";
                        break;
                    }
                }
            }
        }

        // D. Targeting section traversal from label
        if (!liveFilter) {
            const labels = Array.from(targetDoc.querySelectorAll("label, mat-label, .form-label, strong, b")).filter(notDashboard);
            for (const lbl of labels) {
                const lblText = (lbl.innerText || lbl.textContent || "").trim().toLowerCase();
                if (lblText === "live filter" || lblText === "live filter:" || lblText.includes("select a live filter")) {
                    const container = (lbl.closest && lbl.closest(".form-group, mat-form-field, .targeting-field, .field, .form-row, .row, fieldset, section")) || lbl.parentElement;
                    if (container && notDashboard(container)) {
                        const valEl = container.querySelector(".ng-value-label, span[title], .mat-select-value-text, .mat-select-value, .selected-item, [role='combobox'] span, [data-value]");
                        if (valEl) {
                            const titleAttr = String(valEl.getAttribute("title") || valEl.getAttribute("aria-label") || "").trim();
                            const txt = String(valEl.innerText || valEl.textContent || "").trim();
                            const chosen = (titleAttr && isValidFilterValue(titleAttr) && !titleAttr.endsWith("...") && !titleAttr.endsWith("…")) ? titleAttr : txt;
                            if (isValidFilterValue(chosen)) {
                                liveFilter = chosen;
                                filterSource = "TARGETING_SECTION";
                                break;
                            }
                        }
                    }
                }
            }
        }

        // Extract Filter ID from pencil edit link if present
        let extractedFilterId = null;
        try {
            const editLinks = Array.from(targetDoc.querySelectorAll("a[href*='live-filter'], a[href*='live_filter'], [data-filter-id]")).filter(notDashboard);
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
            const mCount = liveFilter.match(/[\\(\\[]\\s*(?:Count|Contacts)?\\s*:?\\s*([0-9,]+)\\s*[\\)\\]]/i);
            if (mCount && mCount[1]) {
                filterCount = Number(mCount[1].replace(/,/g, ""));
                cleanFilterName = liveFilter.replace(/[\\(\\[]\\s*(?:Count|Contacts)?\\s*:?\\s*[0-9,]+\\s*[\\)\\]]/i, "").trim();
            }

            // Cross-reference with title attribute or inventory if filter name ends with ellipsis
            if (cleanFilterName && (cleanFilterName.endsWith("...") || cleanFilterName.endsWith("…") || cleanFilterName.includes("..."))) {
                const prefix = cleanFilterName.replace(/\\.{3}$|…$/, "").replace(/\\.\\.\\..*$/, "").trim().toLowerCase();
                const titleMatch = targetDoc.querySelector && Array.from(targetDoc.querySelectorAll(\`[title^="\${prefix}" i], [aria-label^="\${prefix}" i]\`)).filter(notDashboard)[0];
                if (titleMatch) {
                    const full = String(titleMatch.getAttribute("title") || titleMatch.getAttribute("aria-label") || "").trim();
                    if (full && !full.endsWith("...") && !full.endsWith("…") && isValidFilterValue(full)) {
                        cleanFilterName = full.replace(/[\\(\\[]\\s*(?:Count|Contacts)?\\s*:?\\s*[0-9,]+\\s*[\\)\\]]/i, "").trim();
                    }
                }
                if (cleanFilterName.endsWith("...") || cleanFilterName.endsWith("…") || cleanFilterName.includes("...")) {
                    try {
                        const invKey = "ct_east3_live_filters_inventory_v1";
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
                                    candidates.sort((a, b) => (b.name || "").length - (a.name || "").length);
                                    match = candidates[0];
                                }
                            }
                            if (match) {
                                cleanFilterName = match.name.replace(/[\\(\\[]\\s*(?:Count|Contacts)?\\s*:?\\s*[0-9,]+\\s*[\\)\\]]/i, "").trim();
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
        };
    },`;

parserCode = parserCode.replace(/readCampaignEditForm\(doc\) \{[\s\S]*?\n    \},\n\n    readLiveFilters/, newReadCampaignEditForm + '\n\n    readLiveFilters');
fs.writeFileSync(parserPath, parserCode, 'utf8');
console.log('✔ Patched parser.js');

// -------------------------------------------------------------------------------------
// 2. PATCH CONTENT.JS
// -------------------------------------------------------------------------------------
const contentPath = path.join(east3Dir, 'src', 'content.js');
let contentCode = fs.readFileSync(contentPath, 'utf8');

const newObserveCampaignEditForm = `    function observeCampaignEditForm() {
        if (!window.CTParser || !window.CTParser.readCampaignEditForm) return;
        try {
            const editData = window.CTParser.readCampaignEditForm(document);
            if (editData && editData.campaignId && editData.campaignId !== "unknown" && editData.liveFilter) {
                const cid = String(editData.campaignId).trim();
                if (!cid || !/^[0-9]+$/.test(cid)) return;

                let registry = {};
                try {
                    registry = JSON.parse(localStorage.getItem(VERIFIED_FILTERS_KEY) || "{}");
                } catch (e) {}

                // Clean registry of non-numeric or contaminated keys
                Object.keys(registry).forEach(function(k) {
                    if (!/^[0-9]+$/.test(k)) {
                        delete registry[k];
                    } else if (registry[k] && registry[k].liveFilter && (
                        String(registry[k].liveFilter).startsWith("Detected:") ||
                        String(registry[k].liveFilter).toLowerCase().includes("calltools operations") ||
                        String(registry[k].liveFilter).toLowerCase().includes("scheduled tasks")
                    )) {
                        delete registry[k];
                    }
                });

                const entry = {
                    campaignId: cid,
                    campaignName: editData.campaignName || "",
                    liveFilter: editData.liveFilter,
                    rawLiveFilter: editData.rawLiveFilter,
                    filterId: editData.filterId || null,
                    filterCount: editData.filterCount !== undefined ? editData.filterCount : null,
                    status: editData.status || "ASSIGNED",
                    source: "CAMPAIGN_EDIT_DOM",
                    timestamp: editData.timestamp || Date.now()
                };

                // STRICTLY KEY ONLY BY IMMUTABLE CAMPAIGN ID! NEVER BY NAME!
                registry[cid] = entry;

                try {
                    localStorage.setItem(VERIFIED_FILTERS_KEY, JSON.stringify(registry));
                    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                        const obj = {};
                        obj[VERIFIED_FILTERS_KEY] = registry;
                        chrome.storage.local.set(obj);
                    }
                } catch (e) {}
            }
        } catch (e) {}
    }`;

contentCode = contentCode.replace(/function observeCampaignEditForm\(\) \{[\s\S]*?\n    \}/, newObserveCampaignEditForm);

// Add proactive interactive event listener on campaign edit page in content.js init()
if (!contentCode.includes('// Proactive interactive edit form event tracking')) {
    contentCode = contentCode.replace(
        'window.__CTOperationsFeedCleanup = cleanup;',
        `window.__CTOperationsFeedCleanup = cleanup;
        // Proactive interactive edit form event tracking
        if (isCampaignEditPage()) {
            ['change', 'click', 'input', 'blur'].forEach(function(evType) {
                document.addEventListener(evType, function(e) {
                    if (e.target && e.target.closest && e.target.closest('ng-select, mat-select, select, input, [role="combobox"], [role="listbox"], a[href*="live-filter"]')) {
                        window.setTimeout(observeCampaignEditForm, 50);
                        window.setTimeout(observeCampaignEditForm, 250);
                    }
                }, true);
            });
        }`
    );
}

fs.writeFileSync(contentPath, contentCode, 'utf8');
console.log('✔ Patched content.js');

// -------------------------------------------------------------------------------------
// 3. PATCH INTELLIGENCE.JS
// -------------------------------------------------------------------------------------
const intelPath = path.join(east3Dir, 'src', 'intelligence.js');
let intelCode = fs.readFileSync(intelPath, 'utf8');

// In intelligence.js getAssignmentMatrix: Lookup verified assignment STRICTLY by real numeric ID
intelCode = intelCode.replace(
    /\/\/ Lookup verified assignment by real ID first, then name[\s\S]*?let entry = null;[\s\S]*?let assignedFilter = null;/,
    `// Lookup verified assignment STRICTLY by real numeric ID (no name matching)
                let entry = null;
                if (realId && verifiedRegistry[realId]) {
                    entry = verifiedRegistry[realId];
                }

                let assignedFilter = null;`
);

// In intelligence.js updateVerifiedCampaignFilter: Key strictly by numeric ID
intelCode = intelCode.replace(
    /updateVerifiedCampaignFilter\(campaignId, campaignName, filterName,[\s\S]*?registry\[String\(campaignId\)\] = \{[\s\S]*?timestamp: timestamp\s*\};/,
    `updateVerifiedCampaignFilter(campaignId, campaignName, filterName, source = "CAMPAIGN_EDIT_DOM", timestamp = Date.now(), filterCount = null) {
            if (!campaignId || !/^[0-9]+$/.test(String(campaignId).trim())) return;
            const cid = String(campaignId).trim();
            try {
                let registry = {};
                if (this.storage) {
                    const raw = this.storage.getItem(this.VERIFIED_FILTERS_KEY);
                    if (raw) registry = JSON.parse(raw);
                }
                // Purge non-numeric keys
                Object.keys(registry).forEach(function(k) {
                    if (!/^[0-9]+$/.test(k)) delete registry[k];
                });
                registry[cid] = {
                    campaignId: cid,
                    campaignName: campaignName || "",
                    liveFilter: filterName || "",
                    cleanFilterName: filterName ? String(filterName).replace(/\\s*\\(Count:\\s*[\\d,]+\\)/i, "").trim() : "",
                    filterCount: filterCount,
                    status: filterName ? "ASSIGNED" : "NO_FILTER",
                    source: source,
                    timestamp: timestamp
                };`
);

fs.writeFileSync(intelPath, intelCode, 'utf8');
console.log('✔ Patched intelligence.js');

// -------------------------------------------------------------------------------------
// 4. PATCH DASHBOARD.JS
// -------------------------------------------------------------------------------------
const dashPath = path.join(east3Dir, 'src', 'dashboard.js');
let dashCode = fs.readFileSync(dashPath, 'utf8');

// 4a. Update isCampaignSelected: Strict numeric ID matching only!
dashCode = dashCode.replace(
    /function isCampaignSelected\(campaign, selectedSet\) \{[\s\S]*?\n    \}/,
    `function isCampaignSelected(campaign, selectedSet) {
        if (!campaign || !selectedSet || !(selectedSet instanceof Set) || selectedSet.size === 0) return false;
        const rawId = campaign.rawId || campaign.id;
        if (rawId && selectedSet.has(String(rawId).trim())) return true;
        if (campaign.__id && selectedSet.has(String(campaign.__id).trim())) return true;
        return false;
    }`
);

// 4b. Update selectedOperatingCampaigns: strictly by numeric ID
dashCode = dashCode.replace(
    /function selectedOperatingCampaigns\(campaigns\) \{[\s\S]*?return campaigns\.filter\(function \(c, i\) \{[\s\S]*?return isCampaignSelected\(c, ids, i\);[\s\S]*?\}\);[\s\S]*?\}/,
    `function selectedOperatingCampaigns(campaigns) {
        if (!Array.isArray(campaigns) || !campaigns.length) return [];
        const ids = new Set((state.operatingCampaigns || []).map(function (id) { return String(id || "").trim(); }).filter(Boolean));
        if (ids.size === 0) return [];
        return campaigns.filter(function (c) {
            return isCampaignSelected(c, ids);
        });
    }`
);

// 4c. Update refs.operatingMenu click handler: strictly add/remove numeric ID, no name fallbacks
dashCode = dashCode.replace(
    /const option = event\.target\.closest\('\[data-operating-id\]'\);[\s\S]*?writeOperatingCampaigns\(Array\.from\(next\)\);/,
    `const option = event.target.closest('[data-operating-id]');
            if (!option) return;
            event.preventDefault();
            const id = option.getAttribute('data-operating-id');
            const next = new Set((state.operatingCampaigns || []).map(function(v) { return String(v || "").trim(); }).filter(Boolean));
            let adding = true;
            const all = state.campaigns || [];
            const targetCampaign = all.find(function(c) {
                const cid = String(c.rawId || c.id || c.__id || "");
                return cid && cid === id;
            });
            const canonicalId = targetCampaign ? String(targetCampaign.rawId || targetCampaign.id || targetCampaign.__id || id) : id;
            if (targetCampaign) {
                if (isCampaignSelected(targetCampaign, next)) {
                    if (targetCampaign.rawId) next.delete(String(targetCampaign.rawId).trim());
                    if (targetCampaign.id) next.delete(String(targetCampaign.id).trim());
                    if (targetCampaign.__id) next.delete(String(targetCampaign.__id).trim());
                    next.delete(canonicalId);
                    next.delete(id);
                    adding = false;
                } else {
                    next.add(canonicalId);
                    adding = true;
                }
            } else {
                if (next.has(id)) {
                    next.delete(id);
                    adding = false;
                } else {
                    next.add(id);
                    adding = true;
                }
            }
            option.classList.toggle("is-selected", adding);
            option.setAttribute("aria-selected", String(adding));
            const check = option.querySelector(".ct-operating-check");
            if (check) check.textContent = adding ? "✓" : "";
            writeOperatingCampaigns(Array.from(next));`
);

// 4d. In onInboundExtensionStorageChanged for VERIFIED_FILTERS_KEY: lookup strictly by cid, never by name
dashCode = dashCode.replace(
    /const cid = c\.rawId \|\| c\.id \|\| c\.__id;[\s\S]*?const entry = \(cid && reg\[String\(cid\)\]\) \|\| \(c\.name && reg\[String\(c\.name\)\.trim\(\)\]\) \|\| null;/,
    `const cid = String(c.rawId || c.id || c.__id || "");
                        const entry = (cid && reg[cid]) || null;`
);

// 4e. In dashboard.js top Live Filter Targeting: remove silent fallback to allCampList[0]
dashCode = dashCode.replace(
    /if \(refs\.topLiveFilterPanel \|\| refs\.topFilterCampaign\) \{[\s\S]*?let targetCamp = operating \|\| \(allCampList\.find\(function\(c\) \{ return c && c\.active !== false; \}\)\) \|\| allCampList\[0\] \|\| null;/,
    `if (refs.topLiveFilterPanel || refs.topFilterCampaign) {
            const allCampList = stats.campaigns || state.campaigns || [];
            let targetCamp = operating;
            if (!targetCamp && state.operatingCampaigns && state.operatingCampaigns.length > 0) {
                const targetId = String(state.operatingCampaigns[0]).trim();
                targetCamp = allCampList.find(function(c) {
                    return String(c.rawId || c.id || c.__id || "") === targetId;
                }) || null;
            }`
);

// 4f. In recentChange lookup in dashboard.js: match strictly by numeric campaignId
dashCode = dashCode.replace(
    /\(cId && String\(h\.campaignId\) === String\(cId\)\) \|\|\s*String\(h\.targetName \|\| ""\)\.trim\(\)\.toLowerCase\(\) === String\(targetCamp\.name \|\| ""\)\.trim\(\)\.toLowerCase\(\)/,
    `(cId && String(h.campaignId) === String(cId))`
);

// 4g. When targetCamp is null in dashboard.js: explicit unavailable/unselected state rendering
if (!dashCode.includes('// Render explicit unavailable or awaiting operating selection state')) {
    dashCode = dashCode.replace(
        `            if (refs.topFilterChange && !changeFound) {
                setText(refs.topFilterChange, "No verified targeting changes recorded");
            }
        }`,
        `            if (refs.topFilterChange && !changeFound) {
                setText(refs.topFilterChange, "No verified targeting changes recorded");
            }
        } else {
            // Render explicit unavailable or awaiting operating selection state
            const hasSelectedStored = state.operatingCampaigns && state.operatingCampaigns.length > 0;
            const unavailId = hasSelectedStored ? state.operatingCampaigns[0] : "";
            if (refs.topFilterCampaign) setText(refs.topFilterCampaign, hasSelectedStored ? "Campaign #" + unavailId + " (Unavailable)" : "No campaign selected");
            if (refs.topFilterDialer) setText(refs.topFilterDialer, DIALER);
            if (refs.topFilterVerificationState) {
                setText(refs.topFilterVerificationState, hasSelectedStored ? "CAMPAIGN UNAVAILABLE" : "AWAITING OPERATING SELECTION");
                setClass(refs.topFilterVerificationState, "ct-lft-verify-badge is-unavailable");
            }
            if (refs.topFilterSource) setText(refs.topFilterSource, "Source: DOM Unavailable");
            if (refs.topFilterName) setText(refs.topFilterName, hasSelectedStored ? "Campaign unavailable in current feed" : "No operating campaign selected");
            if (refs.topFilterStatus) {
                setText(refs.topFilterStatus, hasSelectedStored ? "CAMPAIGN UNAVAILABLE" : "UNASSIGNED / NONE");
                setClass(refs.topFilterStatus, "ct-lft-status-pill is-unassigned");
            }
            if (refs.topFilterId) setText(refs.topFilterId, hasSelectedStored ? "Campaign ID: #" + unavailId + " · Filter ID: —" : "Campaign ID: Unavailable · Filter ID: —");
            if (refs.topFilterBadge) {
                setText(refs.topFilterBadge, hasSelectedStored ? "CAMPAIGN UNAVAILABLE" : "NO CAMPAIGN SELECTED");
                setClass(refs.topFilterBadge, "ct-tlf-badge is-unavailable");
            }
            if (refs.topFilterPool) setText(refs.topFilterPool, "—");
            if (refs.topFilterPoolNote) setText(refs.topFilterPoolNote, "Callable Contacts");
            if (refs.topFilterMatches) setText(refs.topFilterMatches, "—");
            if (refs.topFilterMatchesNote) setText(refs.topFilterMatchesNote, "Live Filter Inventory");
            if (refs.topFilterTotal) setText(refs.topFilterTotal, "—");
            if (refs.topFilterVerify) setText(refs.topFilterVerify, hasSelectedStored ? "UNAVAILABLE" : "UNVERIFIED");
            if (refs.topFilterVerifyNote) setText(refs.topFilterVerifyNote, "Feed disconnected");
            if (refs.topFilterFreshness) {
                setText(refs.topFilterFreshness, "NOT OBSERVED");
                setClass(refs.topFilterFreshness, "ct-lft-freshness-val is-waiting");
            }
            if (refs.topFilterAge) setText(refs.topFilterAge, "—");
            if (refs.topFilterChange) setText(refs.topFilterChange, hasSelectedStored ? "Selected campaign unavailable in current table feed" : "No operating campaign selected");
        }`
    );
}

// 4h. Guard dashboard mount: do not mount on /manager/campaigns/edit/*
if (!dashCode.includes('// Route guard: Do not mount dashboard UI on campaign edit page')) {
    dashCode = dashCode.replace(
        'const root = ensureRoot();',
        `// Route guard: Do not mount dashboard UI on campaign edit page or background queue monitor
    const isEditPage = Boolean(typeof window !== "undefined" && window.location && window.location.pathname && window.location.pathname.includes("/manager/campaigns/edit/"));
    const root = isEditPage ? null : ensureRoot();`
    );
    dashCode = dashCode.replace(
        'ensureStyles();\n    mount();',
        `if (!isEditPage) { ensureStyles(); mount(); }`
    );
    dashCode = dashCode.replace(
        'applyLayout(state.layout);\n    applyZoom();\n    installGlobalInteractions();',
        `if (!isEditPage) { applyLayout(state.layout); applyZoom(); installGlobalInteractions(); }`
    );
}

fs.writeFileSync(dashPath, dashCode, 'utf8');
console.log('✔ Patched dashboard.js');

console.log('=== ALL EAST-3 REPAIRS SUCCESSFULLY APPLIED ===');

