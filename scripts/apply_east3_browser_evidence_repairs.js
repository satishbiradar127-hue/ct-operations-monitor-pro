const fs = require('fs');
const path = require('path');

const BASE_DIR = path.resolve(__dirname, '..');
const EAST3_DIR = path.join(BASE_DIR, 'CT_OPERATIONS_DUAL_DIALER_RELEASE', 'CT_Operations_Monitor_East3');
const SRC_DIR = path.join(EAST3_DIR, 'src');
const DIST_DIR = path.join(EAST3_DIR, 'dist', 'src');

console.log('=== Applying Comprehensive EAST-3 Browser-Evidence Repairs ===');

// =========================================================================
// 1. PATCH PARSER.JS
// =========================================================================
let parser = fs.readFileSync(path.join(SRC_DIR, 'parser.js'), 'utf8');

// A. Anchoring to pencil edit link and label in readCampaignEditForm
const oldParserTarget = `        // A. Angular ng-select (CallTools standard)
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
        }`;

const newParserSnippet = `        // 0. Extract Filter ID and anchor to Live Filter select from pencil edit link
        let extractedFilterId = null;
        let pencilAnchorSelect = null;
        try {
            const editLinks = Array.from(targetDoc.querySelectorAll("a[href*='live-filter'], a[href*='live_filter'], [data-filter-id]")).filter(notDashboard);
            for (const el of editLinks) {
                const href = el.getAttribute("href") || "";
                const m = href.match(/\\/live-filters\\/(?:edit\\/)?([0-9]+)/i);
                if (m && m[1]) {
                    extractedFilterId = m[1];
                }
                // The pencil edit link is placed directly adjacent to or in the same row/container as the Live Filter control
                const rowOrContainer = (el.closest && el.closest(".form-group, .row, .field, fieldset, section, form, div")) || el.parentElement;
                if (rowOrContainer && notDashboard(rowOrContainer)) {
                    pencilAnchorSelect = rowOrContainer.querySelector("ng-select, mat-select, select");
                    if (pencilAnchorSelect) break;
                }
            }
        } catch (e) {}

        // 0B. If pencilAnchorSelect found, extract directly from it!
        if (pencilAnchorSelect) {
            const valEl = pencilAnchorSelect.querySelector(".ng-value-label, span[title], span.ng-value, [class*='ng-value-label'], .mat-select-value-text, .mat-select-value") || pencilAnchorSelect.querySelector(".ng-value");
            if (valEl) {
                const targetEl = (valEl.querySelector && valEl.querySelector(".ng-value-label, span[title]")) || valEl;
                const fullTitle = String(targetEl.getAttribute("title") || targetEl.getAttribute("aria-label") || "").trim();
                const innerText = String(targetEl.innerText || targetEl.textContent || "").trim();
                const bestVal = (fullTitle && isValidFilterValue(fullTitle) && !fullTitle.endsWith("...") && !fullTitle.endsWith("…")) ? fullTitle : innerText;
                if (isValidFilterValue(bestVal)) {
                    liveFilter = bestVal;
                    filterSource = pencilAnchorSelect.tagName.toLowerCase().includes("mat") ? "MAT_SELECT" : "NG_SELECT";
                }
            }
            if (!liveFilter) {
                const inputEl = pencilAnchorSelect.querySelector("input:not([type='hidden'])");
                if (inputEl) {
                    const inpVal = String(inputEl.getAttribute("title") || inputEl.value || inputEl.getAttribute("value") || "").trim();
                    if (isValidFilterValue(inpVal)) {
                        liveFilter = inpVal;
                        filterSource = "NG_SELECT";
                    }
                }
            }
        }

        // 0C. Anchor from label "Live Filter"
        if (!liveFilter) {
            const labels = Array.from(targetDoc.querySelectorAll("label, mat-label, .form-label, strong, b, div, span")).filter(notDashboard);
            for (const lbl of labels) {
                const lblText = (lbl.innerText || lbl.textContent || "").trim().toLowerCase();
                if (lblText === "live filter" || lblText === "live filter:" || lblText.startsWith("live filter") || lblText.includes("select a live filter")) {
                    const rowOrContainer = (lbl.closest && lbl.closest(".form-group, .row, .field, fieldset, section, .form-row")) || lbl.parentElement;
                    if (rowOrContainer && notDashboard(rowOrContainer)) {
                        const sel = rowOrContainer.querySelector("ng-select, mat-select, select");
                        if (sel && notDashboard(sel)) {
                            const valEl = sel.querySelector(".ng-value-label, span[title], span.ng-value, [class*='ng-value-label'], .mat-select-value-text, .mat-select-value") || sel.querySelector(".ng-value");
                            if (valEl) {
                                const targetEl = (valEl.querySelector && valEl.querySelector(".ng-value-label, span[title]")) || valEl;
                                const fullTitle = String(targetEl.getAttribute("title") || targetEl.getAttribute("aria-label") || "").trim();
                                const innerText = String(targetEl.innerText || targetEl.textContent || "").trim();
                                const bestVal = (fullTitle && isValidFilterValue(fullTitle) && !fullTitle.endsWith("...") && !fullTitle.endsWith("…")) ? fullTitle : innerText;
                                if (isValidFilterValue(bestVal)) {
                                    liveFilter = bestVal;
                                    filterSource = sel.tagName.toLowerCase().includes("mat") ? "MAT_SELECT" : "NG_SELECT";
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }

        // A. Angular ng-select (CallTools standard)
        if (!liveFilter) {
            const ngSelects = Array.from(targetDoc.querySelectorAll("ng-select[formcontrolname*='filter' i], ng-select[name*='filter' i], ng-select[id*='filter' i], ng-select[aria-label*='filter' i], ng-select")).filter(notDashboard);
            for (const ng of ngSelects) {
                const container = ng.closest(".form-group, mat-form-field, .targeting-field, .field, fieldset, section, .row, div") || ng.parentElement;
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
        }`;

const normParser = parser.replace(/\r\n/g, '\n');
const normTargetParser = oldParserTarget.replace(/\r\n/g, '\n');
if (normParser.includes(normTargetParser)) {
    const updated = normParser.replace(normTargetParser, newParserSnippet.replace(/\r\n/g, '\n'));
    fs.writeFileSync(path.join(SRC_DIR, 'parser.js'), updated);
    fs.writeFileSync(path.join(DIST_DIR, 'parser.js'), updated);
    console.log('✓ Successfully patched parser.js');
} else {
    console.log('• parser.js already patched or snippet differs');
}

// =========================================================================
// 2. PATCH DASHBOARD.JS
// =========================================================================
let dashboard = fs.readFileSync(path.join(SRC_DIR, 'dashboard.js'), 'utf8');
let normDashboard = dashboard.replace(/\r\n/g, '\n');

// A. Add liveFilter fields to dataSignature
const oldDataSig = `    function dataSignature(campaigns) {
        return campaigns.map(function (campaign, index) {
            const c = campaign || {};
            return [
                campaignId(c, index),
                c.active, c.status, c.contacts, c.waitNow, c.waiting, c.onCall,
                c.loggedIn, c.outbound, c.abandoned, c.human, c.machine, c.agentConnect,
                c.noAnswer, c.busy, c.failed, c.postCall, c.goals
            ].map(function (value) { return String(value ?? ""); }).join("~");
        }).sort().join("||");
    }`;

const newDataSig = `    function dataSignature(campaigns) {
        return campaigns.map(function (campaign, index) {
            const c = campaign || {};
            return [
                campaignId(c, index),
                c.active, c.status, c.contacts, c.waitNow, c.waiting, c.onCall,
                c.loggedIn, c.outbound, c.abandoned, c.human, c.machine, c.agentConnect,
                c.noAnswer, c.busy, c.failed, c.postCall, c.goals,
                c.liveFilter, c.liveFilterTimestamp, c.liveFilterSource, c.liveFilterCount
            ].map(function (value) { return String(value ?? ""); }).join("~");
        }).sort().join("||");
    }`;

if (normDashboard.includes(oldDataSig.replace(/\r\n/g, '\n'))) {
    normDashboard = normDashboard.replace(oldDataSig.replace(/\r\n/g, '\n'), newDataSig.replace(/\r\n/g, '\n'));
    console.log('✓ Successfully updated dataSignature to include liveFilter fields');
}

// B. Add reconcileCampaignsWithVerifiedRegistry function right before onInboundExtensionStorageChanged
const reconcileFunc = `    function reconcileCampaignsWithVerifiedRegistry(customRegistry) {
        let registry = customRegistry || null;
        if (!registry) {
            try {
                registry = JSON.parse(localStorage.getItem(VERIFIED_FILTERS_KEY) || "{}");
            } catch (e) {
                registry = {};
            }
        }
        if (!registry || typeof registry !== "object") return false;

        let changed = false;
        if (Array.isArray(state.campaigns)) {
            state.campaigns.forEach(function (c) {
                const cid = String(c.rawId || c.id || c.__id || "").trim();
                let entry = (cid && registry[cid]) || null;
                if (!entry && c.name) {
                    const normName = String(c.name).trim().toLowerCase();
                    entry = Object.values(registry).find(function (e) {
                        return e && e.campaignName && String(e.campaignName).trim().toLowerCase() === normName;
                    }) || null;
                }
                if (entry && entry.liveFilter) {
                    if (c.liveFilter !== entry.liveFilter || c.liveFilterTimestamp !== entry.timestamp) {
                        const previousFilter = c.liveFilter || null;
                        c.liveFilter = entry.liveFilter;
                        c.liveFilterSource = entry.source || "CAMPAIGN_EDIT_DOM";
                        c.liveFilterTimestamp = entry.timestamp || Date.now();
                        c.liveFilterCount = entry.filterCount !== undefined ? entry.filterCount : null;
                        c.liveFilterId = entry.filterId || c.liveFilterId || null;
                        c.liveFilterStatus = entry.status || "ASSIGNED";
                        changed = true;

                        // If transition occurred on operating campaign, record in intelligence
                        if (previousFilter && previousFilter !== entry.liveFilter && intelligenceEngine && intelligenceEngine.recordTargetingTransition) {
                            intelligenceEngine.recordTargetingTransition(
                                entry.campaignId || cid,
                                c.name || entry.campaignName || "Campaign",
                                previousFilter,
                                entry.liveFilter,
                                entry.filterCount,
                                entry.source || "CAMPAIGN_EDIT_DOM"
                            );
                        }
                    }
                }
            });
        }
        return changed;
    }

`;

if (!normDashboard.includes('function reconcileCampaignsWithVerifiedRegistry(')) {
    normDashboard = normDashboard.replace('function onInboundExtensionStorageChanged(', reconcileFunc + '    function onInboundExtensionStorageChanged(');
    console.log('✓ Successfully added reconcileCampaignsWithVerifiedRegistry');
}

// C. Update onInboundExtensionStorageChanged to call reconcileCampaignsWithVerifiedRegistry
const oldOnInboundStorageChange = `        if (changes && (changes[VERIFIED_FILTERS_KEY] || changes[LIVE_FILTERS_INVENTORY_KEY])) {
            if (changes[VERIFIED_FILTERS_KEY] && changes[VERIFIED_FILTERS_KEY].newValue) {
                const reg = changes[VERIFIED_FILTERS_KEY].newValue;
                if (Array.isArray(state.campaigns)) {
                    state.campaigns.forEach(function (c) {
                        const cid = String(c.rawId || c.id || c.__id || "");
                        const entry = (cid && reg[cid]) || null;
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

const newOnInboundStorageChange = `        if (changes && (changes[VERIFIED_FILTERS_KEY] || changes[LIVE_FILTERS_INVENTORY_KEY])) {
            if (changes[VERIFIED_FILTERS_KEY] && changes[VERIFIED_FILTERS_KEY].newValue) {
                reconcileCampaignsWithVerifiedRegistry(changes[VERIFIED_FILTERS_KEY].newValue);
            }
            scheduleRender();
        }`;

if (normDashboard.includes(oldOnInboundStorageChange.replace(/\r\n/g, '\n'))) {
    normDashboard = normDashboard.replace(oldOnInboundStorageChange.replace(/\r\n/g, '\n'), newOnInboundStorageChange.replace(/\r\n/g, '\n'));
    console.log('✓ Successfully updated onInboundExtensionStorageChanged');
}

// D. Update onStorage to call reconcileCampaignsWithVerifiedRegistry
const oldOnStorage = `    const onStorage = function (event) {
        if (!event || !event.key) return;
        if (event.key === VERIFIED_FILTERS_KEY || event.key === LIVE_FILTERS_INVENTORY_KEY) {
            scheduleRender();
            return;
        }`;

const newOnStorage = `    const onStorage = function (event) {
        if (!event || !event.key) return;
        if (event.key === VERIFIED_FILTERS_KEY || event.key === LIVE_FILTERS_INVENTORY_KEY) {
            let parsed = null;
            if (event.key === VERIFIED_FILTERS_KEY && event.newValue) {
                try { parsed = JSON.parse(event.newValue); } catch (e) {}
            }
            reconcileCampaignsWithVerifiedRegistry(parsed);
            scheduleRender();
            return;
        }`;

if (normDashboard.includes(oldOnStorage.replace(/\r\n/g, '\n'))) {
    normDashboard = normDashboard.replace(oldOnStorage.replace(/\r\n/g, '\n'), newOnStorage.replace(/\r\n/g, '\n'));
    console.log('✓ Successfully updated onStorage');
}

// E. Update onVisibilityChange to call reconcileCampaignsWithVerifiedRegistry
const oldOnVis = `    const onVisibilityChange = function () {
        if (document.visibilityState === "visible") {
            secondsUntilNextMonitoring = 0;
            state.nextMonitoringCheckIn = 0;
            hydrateInboundFromExtensionStorage();
            trigger15sMonitoringRefresh("visibility-change-recovery");
            updateConnectionState(Date.now());
            scheduleRender();
        }
    };`;

const newOnVis = `    const onVisibilityChange = function () {
        if (document.visibilityState === "visible") {
            secondsUntilNextMonitoring = 0;
            state.nextMonitoringCheckIn = 0;
            reconcileCampaignsWithVerifiedRegistry();
            hydrateInboundFromExtensionStorage();
            trigger15sMonitoringRefresh("visibility-change-recovery");
            updateConnectionState(Date.now());
            scheduleRender();
        }
    };`;

if (normDashboard.includes(oldOnVis.replace(/\r\n/g, '\n'))) {
    normDashboard = normDashboard.replace(oldOnVis.replace(/\r\n/g, '\n'), newOnVis.replace(/\r\n/g, '\n'));
    console.log('✓ Successfully updated onVisibilityChange');
}

// F. In render(), reconcile targetCamp directly with localStorage[VERIFIED_FILTERS_KEY]
const oldRenderLft = `        // Update Live Filter Targeting Command Center Panel
        if (refs.topLiveFilterPanel || refs.topFilterCampaign) {
            const allCampList = stats.campaigns || state.campaigns || [];
            let targetCamp = operating;
            if (!targetCamp && state.operatingCampaigns && state.operatingCampaigns.length > 0) {
                const targetId = String(state.operatingCampaigns[0]).trim();
                targetCamp = allCampList.find(function(c) {
                    return String(c.rawId || c.id || c.__id || "") === targetId;
                }) || null;
            }

            if (targetCamp) {`;

const newRenderLft = `        // Update Live Filter Targeting Command Center Panel
        if (refs.topLiveFilterPanel || refs.topFilterCampaign) {
            const allCampList = stats.campaigns || state.campaigns || [];
            let targetCamp = operating;
            if (!targetCamp && state.operatingCampaigns && state.operatingCampaigns.length > 0) {
                const targetId = String(state.operatingCampaigns[0]).trim();
                targetCamp = allCampList.find(function(c) {
                    return String(c.rawId || c.id || c.__id || "") === targetId;
                }) || null;
            }

            if (targetCamp) {
                // Authoritative registry reconciliation directly in render
                try {
                    const reg = JSON.parse(localStorage.getItem(VERIFIED_FILTERS_KEY) || "{}");
                    const cid = String(targetCamp.rawId || targetCamp.id || targetCamp.__id || "").trim();
                    let vEntry = (cid && reg[cid]) || null;
                    if (!vEntry && targetCamp.name) {
                        const normName = String(targetCamp.name).trim().toLowerCase();
                        vEntry = Object.values(reg).find(function(e) {
                            return e && e.campaignName && String(e.campaignName).trim().toLowerCase() === normName;
                        }) || null;
                    }
                    if (vEntry && vEntry.liveFilter) {
                        targetCamp.liveFilter = vEntry.liveFilter;
                        targetCamp.liveFilterSource = vEntry.source || "CAMPAIGN_EDIT_DOM";
                        targetCamp.liveFilterTimestamp = vEntry.timestamp || Date.now();
                        if (vEntry.filterCount !== undefined && vEntry.filterCount !== null) {
                            targetCamp.liveFilterCount = vEntry.filterCount;
                        }
                        if (vEntry.filterId) {
                            targetCamp.liveFilterId = vEntry.filterId;
                        }
                    }
                } catch (e) {}`;

if (normDashboard.includes(oldRenderLft.replace(/\r\n/g, '\n'))) {
    normDashboard = normDashboard.replace(oldRenderLft.replace(/\r\n/g, '\n'), newRenderLft.replace(/\r\n/g, '\n'));
    console.log('✓ Successfully updated render() Live Filter Targeting authoritative reconciliation');
}

// G. In freshnessTimer: trigger scheduleRender() each second to keep freshness badge exact
const oldFreshnessTimer = `    const freshnessTimer = setInterval(function () {
        const now = Date.now();
        secondsUntilNextMonitoring--;
        state.nextMonitoringCheckIn = Math.max(0, secondsUntilNextMonitoring);

        if (secondsUntilNextMonitoring <= 0) {
            secondsUntilNextMonitoring = MONITORING_CYCLE_SECONDS;
            state.nextMonitoringCheckIn = MONITORING_CYCLE_SECONDS;
            trigger15sMonitoringRefresh("15s-scheduler-cycle");
        }

        updateConnectionState(now);
    }, 1000);`;

const newFreshnessTimer = `    const freshnessTimer = setInterval(function () {
        const now = Date.now();
        secondsUntilNextMonitoring--;
        state.nextMonitoringCheckIn = Math.max(0, secondsUntilNextMonitoring);

        if (secondsUntilNextMonitoring <= 0) {
            secondsUntilNextMonitoring = MONITORING_CYCLE_SECONDS;
            state.nextMonitoringCheckIn = MONITORING_CYCLE_SECONDS;
            trigger15sMonitoringRefresh("15s-scheduler-cycle");
        }

        updateConnectionState(now);
        scheduleRender();
    }, 1000);`;

if (normDashboard.includes(oldFreshnessTimer.replace(/\r\n/g, '\n'))) {
    normDashboard = normDashboard.replace(oldFreshnessTimer.replace(/\r\n/g, '\n'), newFreshnessTimer.replace(/\r\n/g, '\n'));
    console.log('✓ Successfully updated freshnessTimer to scheduleRender()');
}

// H. Listen for CT_EAST_3_VERIFIED_FILTER_CHANGED custom event
if (!normDashboard.includes('CT_EAST_3_VERIFIED_FILTER_CHANGED')) {
    const customListener = `    document.addEventListener("CT_EAST_3_VERIFIED_FILTER_CHANGED", function (e) {
        reconcileCampaignsWithVerifiedRegistry();
        scheduleRender();
    });
    window.addEventListener("CT_EAST_3_VERIFIED_FILTER_CHANGED", function (e) {
        reconcileCampaignsWithVerifiedRegistry();
        scheduleRender();
    });
`;
    normDashboard = normDashboard.replace('document.addEventListener(FEED_STATUS_EVENT, onCtFeedStatus);', 'document.addEventListener(FEED_STATUS_EVENT, onCtFeedStatus);\n' + customListener);
    console.log('✓ Successfully added CT_EAST_3_VERIFIED_FILTER_CHANGED listener');
}

fs.writeFileSync(path.join(SRC_DIR, 'dashboard.js'), normDashboard);
fs.writeFileSync(path.join(DIST_DIR, 'dashboard.js'), normDashboard);
console.log('✓ Successfully saved dashboard.js');

// =========================================================================
// 3. PATCH CONTENT.JS
// =========================================================================
let content = fs.readFileSync(path.join(SRC_DIR, 'content.js'), 'utf8');
let normContent = content.replace(/\r\n/g, '\n');

// A. In observeCampaignEditForm, dispatch custom event
const oldObservePublish = `                try {
                    localStorage.setItem(VERIFIED_FILTERS_KEY, JSON.stringify(registry));
                    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                        const obj = {};
                        obj[VERIFIED_FILTERS_KEY] = registry;
                        chrome.storage.local.set(obj);
                    }
                } catch (e) {}`;

const newObservePublish = `                try {
                    localStorage.setItem(VERIFIED_FILTERS_KEY, JSON.stringify(registry));
                    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                        const obj = {};
                        obj[VERIFIED_FILTERS_KEY] = registry;
                        chrome.storage.local.set(obj);
                    }
                    window.dispatchEvent(new CustomEvent("CT_EAST_3_VERIFIED_FILTER_CHANGED", { detail: entry }));
                    document.dispatchEvent(new CustomEvent("CT_EAST_3_VERIFIED_FILTER_CHANGED", { detail: entry }));
                } catch (e) {}`;

if (normContent.includes(oldObservePublish.replace(/\r\n/g, '\n'))) {
    normContent = normContent.replace(oldObservePublish.replace(/\r\n/g, '\n'), newObservePublish.replace(/\r\n/g, '\n'));
    console.log('✓ Successfully added CT_EAST_3_VERIFIED_FILTER_CHANGED dispatch in content.js');
}

// B. In init(), broaden interactive event listeners on edit page
const oldInteractiveEvents = `        // Proactive interactive edit form event tracking
        if (isCampaignEditPage()) {
            ['change', 'click', 'input', 'blur'].forEach(function(evType) {
                document.addEventListener(evType, function(e) {
                    if (e.target && e.target.closest && e.target.closest('ng-select, mat-select, select, input, [role="combobox"], [role="listbox"], a[href*="live-filter"]')) {
                        window.setTimeout(observeCampaignEditForm, 50);
                        window.setTimeout(observeCampaignEditForm, 250);
                    }
                }, true);
            });
        }`;

const newInteractiveEvents = `        // Proactive interactive edit form event tracking
        if (isCampaignEditPage()) {
            ['change', 'click', 'input', 'blur', 'mouseup', 'touchend'].forEach(function(evType) {
                document.addEventListener(evType, function(e) {
                    [20, 80, 200, 450, 900].forEach(function(delay) {
                        window.setTimeout(observeCampaignEditForm, delay);
                    });
                }, true);
            });
        }`;

if (normContent.includes(oldInteractiveEvents.replace(/\r\n/g, '\n'))) {
    normContent = normContent.replace(oldInteractiveEvents.replace(/\r\n/g, '\n'), newInteractiveEvents.replace(/\r\n/g, '\n'));
    console.log('✓ Successfully broadened edit form interactive event tracking in content.js');
}

fs.writeFileSync(path.join(SRC_DIR, 'content.js'), normContent);
fs.writeFileSync(path.join(DIST_DIR, 'content.js'), normContent);
console.log('✓ Successfully saved content.js');

console.log('=== All Browser-Evidence Repairs Applied Successfully ===');
