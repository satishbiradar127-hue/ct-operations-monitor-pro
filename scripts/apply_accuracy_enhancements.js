const fs = require('fs');

// 1. UPDATE PARSER.JS
let parser = fs.readFileSync('src/parser.js', 'utf8');

// A. ng-select input fallback
const ngSearch = `if (isValidFilterValue(valText)) {
                    liveFilter = valText;
                    filterSource = "NG_SELECT";
                    break;
                }
            }
        }`;

const ngRepl = `if (isValidFilterValue(valText)) {
                    liveFilter = valText;
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

if (parser.includes(ngSearch)) {
    parser = parser.replace(ngSearch, ngRepl);
    console.log('Parser: ng-select fallback patched');
} else {
    console.log('Parser: ngSearch not found');
}

// B. Section D targeting input fallback
const dSearch = `const sel = container.querySelector("select");
                        if (sel && sel.options && sel.options.length > 0) {
                            const opt = sel.options[sel.selectedIndex >= 0 ? sel.selectedIndex : 0];
                            const txt = opt ? String(opt.text || opt.innerText || opt.textContent || "").trim() : "";
                            if (isValidFilterValue(txt)) {
                                liveFilter = txt;
                                filterSource = "TARGETING_SECTION";
                                break;
                            }
                        }`;

const dRepl = `const sel = container.querySelector("select");
                        if (sel && sel.options && sel.options.length > 0) {
                            const opt = sel.options[sel.selectedIndex >= 0 ? sel.selectedIndex : 0];
                            const txt = opt ? String(opt.text || opt.innerText || opt.textContent || "").trim() : "";
                            if (isValidFilterValue(txt)) {
                                liveFilter = txt;
                                filterSource = "TARGETING_SECTION";
                                break;
                            }
                        }
                        const inp = container.querySelector("input:not([type='hidden']):not([type='checkbox']):not([type='radio'])");
                        if (inp) {
                            const inpVal = String(inp.getAttribute("title") || inp.value || inp.getAttribute("value") || inp.placeholder || "").trim();
                            if (isValidFilterValue(inpVal)) {
                                liveFilter = inpVal;
                                filterSource = "TARGETING_SECTION";
                                break;
                            }
                        }
                        const combo = container.querySelector("[role='combobox']");
                        if (combo) {
                            const comboVal = String(combo.getAttribute("title") || combo.getAttribute("aria-label") || combo.innerText || combo.textContent || combo.value || "").trim();
                            if (isValidFilterValue(comboVal)) {
                                liveFilter = comboVal;
                                filterSource = "TARGETING_SECTION";
                                break;
                            }
                        }`;

if (parser.includes(dSearch)) {
    parser = parser.replace(dSearch, dRepl);
    console.log('Parser: Section D input fallback patched');
} else {
    console.log('Parser: dSearch not found');
}

// C. Ellipsis resolution with title & dynamic dialer key
const ellSearch = `            // Cross-reference with inventory if filter name ends with ellipsis
            if (cleanFilterName && (cleanFilterName.endsWith("...") || cleanFilterName.endsWith("…"))) {
                const prefix = cleanFilterName.replace(/\\.{3}$|…$/, "").trim().toLowerCase();
                try {
                    const invKey = (typeof isEast3 !== "undefined" && isEast3) ? "ct_east3_live_filters_inventory_v1" : "ct_east2_live_filters_inventory_v1";
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
            }`;

const ellRepl = `            // Cross-reference with title attribute or inventory if filter name ends with ellipsis
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
            }`;

if (parser.includes(ellSearch)) {
    parser = parser.replace(ellSearch, ellRepl);
    console.log('Parser: Ellipsis resolution patched');
} else {
    console.log('Parser: ellSearch not found');
}
fs.writeFileSync('src/parser.js', parser, 'utf8');

// 2. UPDATE CONTENT.JS
let content = fs.readFileSync('src/content.js', 'utf8');
const obsCheck = 'if (editData && editData.campaignId && editData.campaignId !== "unknown") {';
const obsRepl = 'if (editData && editData.campaignId && editData.campaignId !== "unknown" && editData.liveFilter) {';
if (content.includes(obsCheck)) {
    content = content.replace(obsCheck, obsRepl);
    console.log('Content: observeCampaignEditForm guard patched');
}
const routeQueues = `// Queues page
            const queues = window.CTParser.readQueues`;
const routeQueuesRepl = `if (route === "campaign_edit") {
                observeCampaignEditForm();
                return;
            }
            if (route === "live_filters") {
                observeLiveFiltersPage();
                return;
            }

            // Queues page
            const queues = window.CTParser.readQueues`;
if (content.includes(routeQueues)) {
    content = content.replace(routeQueues, routeQueuesRepl);
    console.log('Content: readAndPublish route handling patched');
}
const initMount = `if (isCampaignsPage()) {
            lastInboundCoordinationAt = Date.now();
            ensureInboundFeedMonitor();
        } else if (isQueuesPage()) {
            teardownInboundIframe();
        }`;
const initMountRepl = `if (isCampaignsPage()) {
            lastInboundCoordinationAt = Date.now();
            ensureInboundFeedMonitor();
        } else if (isQueuesPage()) {
            teardownInboundIframe();
        } else if (isCampaignEditPage()) {
            observeCampaignEditForm();
        } else if (isLiveFiltersPage()) {
            observeLiveFiltersPage();
        }`;
if (content.includes(initMount)) {
    content = content.replace(initMount, initMountRepl);
    console.log('Content: init page check patched');
}
fs.writeFileSync('src/content.js', content, 'utf8');

// 3. UPDATE DASHBOARD.JS
let dashboard = fs.readFileSync('src/dashboard.js', 'utf8');
const dKeys = 'const INBOUND_SETTINGS_KEY = PREFIX + "inbound_settings_v1";';
const dKeysRepl = `const INBOUND_SETTINGS_KEY = PREFIX + "inbound_settings_v1";
    const VERIFIED_FILTERS_KEY = PREFIX + "verified_campaign_filters_v1";
    const LIVE_FILTERS_INVENTORY_KEY = PREFIX + "live_filters_inventory_v1";`;
if (dashboard.includes(dKeys)) {
    dashboard = dashboard.replace(dKeys, dKeysRepl);
    console.log('Dashboard: filter storage keys added');
}
const onStorInbound = 'if (event.key === INBOUND_DATA_KEY && event.newValue) {';
const onStorInboundRepl = `if (event.key === VERIFIED_FILTERS_KEY || event.key === LIVE_FILTERS_INVENTORY_KEY) {
            scheduleRender();
            return;
        }
        if (event.key === INBOUND_DATA_KEY && event.newValue) {`;
if (dashboard.includes(onStorInbound)) {
    dashboard = dashboard.replace(onStorInbound, onStorInboundRepl);
    console.log('Dashboard: onStorage cross-tab filter listener added');
}
const extStorChange = 'if (dataChange || statusChange) scheduleRender();';
const extStorChangeRepl = `if (changes && (changes[VERIFIED_FILTERS_KEY] || changes[LIVE_FILTERS_INVENTORY_KEY])) {
            scheduleRender();
        }
        if (dataChange || statusChange) scheduleRender();`;
if (dashboard.includes(extStorChange)) {
    dashboard = dashboard.replace(extStorChange, extStorChangeRepl);
    console.log('Dashboard: chrome.storage.onChanged filter listener added');
}
fs.writeFileSync('src/dashboard.js', dashboard, 'utf8');
console.log('SUCCESS: All patches applied cleanly to src/');
