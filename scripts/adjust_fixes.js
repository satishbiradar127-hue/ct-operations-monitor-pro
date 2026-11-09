const fs = require('fs');
const path = require('path');

function patchFile(relPath, fn) {
    const fullPath = path.resolve(__dirname, '..', relPath);
    const original = fs.readFileSync(fullPath, 'utf8');
    const modified = fn(original);
    if (original === modified) {
        console.warn(`[WARN] No changes made to ${relPath}`);
    } else {
        fs.writeFileSync(fullPath, modified, 'utf8');
        console.log(`[SUCCESS] Patched ${relPath}`);
    }
}

// 1. PATCH src/parser.js and East2 parser.js
['src/parser.js', 'CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/parser.js'].forEach(filePath => {
    patchFile(filePath, (content) => {
        let updated = content.replace(/\r\n/g, '\n');

        const readFormRegex = /\/\*\*[\s\S]*?\*\/\s*readCampaignEditForm\(doc\)\s*\{[\s\S]*?timestamp:\s*Date\.now\(\)\s*\};\s*\}/;
        const newReadCampaignEditForm = `/**
     * Reads campaign edit form / Targeting section DOM.
     * Extracts campaignId, campaignName, and selected Live Filter.
     * Supports Angular ng-select, mat-select, native select, and combobox.
     */
    readCampaignEditForm(doc) {
        const targetDoc = doc || (typeof document !== "undefined" ? document : null);
        if (!targetDoc) return null;

        // If doc was not passed explicitly and we are in a real browser on a non-edit page, do not parse
        if (!doc && typeof window !== "undefined" && window.location && window.location.pathname) {
            const p = window.location.pathname;
            if (!p.includes("/campaigns/edit/")) return null;
        }

        // 1. Identify Campaign ID
        let campaignId = "";
        if (typeof window !== "undefined" && window.location && window.location.pathname) {
            const match = window.location.pathname.match(/\\/campaigns\\/edit\\/([0-9a-zA-Z_\\-]+)/);
            if (match) campaignId = match[1];
        }
        if (!campaignId) {
            const formWithId = targetDoc.querySelector("[data-campaign-id], [data-id]");
            if (formWithId) {
                campaignId = formWithId.getAttribute("data-campaign-id") || formWithId.getAttribute("data-id") || "";
            }
        }
        if (!campaignId) {
            const idInput = targetDoc.querySelector("input[name='id'], input[formcontrolname='id']");
            if (idInput && (idInput.value || idInput.getAttribute("value"))) {
                campaignId = idInput.value || idInput.getAttribute("value") || "";
            }
        }

        // 2. Identify Campaign Name
        let campaignName = "";
        const nameInput = targetDoc.querySelector("input[name='name'], input[formcontrolname='name'], input[id='name']");
        if (nameInput && (nameInput.value || nameInput.getAttribute("value"))) {
            campaignName = String(nameInput.value || nameInput.getAttribute("value") || "").trim();
        } else {
            const headerEl = targetDoc.querySelector("h1, h2, .page-title, .breadcrumb-item.active");
            if (headerEl) {
                const txt = (headerEl.innerText || headerEl.textContent || "").trim();
                const m = txt.match(/^Edit\\s+Campaign\\s*\\((.*?)\\)$/i) || txt.match(/^Edit\\s+(?:Campaign\\s+)?\\(?(.*?)\\)?$/i);
                if (m && (m[1] || m[2])) {
                    campaignName = String(m[1] || m[2] || "").trim();
                } else {
                    const clean = txt.replace(/^Edit\\s+(?:Campaign\\s+)?/i, "").replace(/[()]/g, "").trim();
                    if (clean) campaignName = clean;
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
            return true;
        }

        // A. Angular ng-select (Standard CallTools 2.0 dropdown)
        const ngSelects = Array.from(targetDoc.querySelectorAll("ng-select[formcontrolname*='filter' i], ng-select[name*='filter' i], ng-select[id*='filter' i], ng-select[aria-label*='filter' i], ng-select"));
        for (const ng of ngSelects) {
            const containerText = ((ng.closest && ng.closest(".form-group, .targeting-field, section, div")) ? ng.closest(".form-group, .targeting-field, section, div").textContent : "") || "";
            const isFilterSelect = (ng.getAttribute("formcontrolname") && ng.getAttribute("formcontrolname").toLowerCase().includes("filter")) ||
                                   (ng.getAttribute("name") && ng.getAttribute("name").toLowerCase().includes("filter")) ||
                                   /live\\s*filter/i.test(containerText) ||
                                   /targeting/i.test(containerText);
            if (!isFilterSelect && ngSelects.length > 1) continue;

            const valEl = ng.querySelector(".ng-value-label, span.ng-value, [class*='ng-value'], span[title]");
            if (valEl) {
                const valText = String(valEl.getAttribute("title") || valEl.innerText || valEl.textContent || "").trim();
                if (isValidFilterValue(valText)) {
                    liveFilter = valText;
                    filterSource = "NG_SELECT";
                    break;
                }
            }
        }

        // B. Angular Material mat-select
        if (!liveFilter) {
            const matSelects = Array.from(targetDoc.querySelectorAll("mat-select[formcontrolname*='filter' i], mat-select[name*='filter' i], mat-select[aria-label*='filter' i], mat-select[placeholder*='filter' i]"));
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
            const nativeSelects = Array.from(targetDoc.querySelectorAll("select[name*='filter' i], select[id*='filter' i], select[formcontrolname*='filter' i]"));
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
            const labels = Array.from(targetDoc.querySelectorAll("label, mat-label, .form-label, strong, b, div, span"));
            for (const lbl of labels) {
                const lblText = (lbl.innerText || lbl.textContent || "").trim().toLowerCase();
                if (lblText === "live filter" || lblText === "live filter:" || lblText.includes("select a live filter")) {
                    const container = (lbl.closest && lbl.closest(".form-group, mat-form-field, .targeting-field, .field, .form-row, .row, fieldset, section")) || lbl.parentElement;
                    if (container) {
                        const valEl = container.querySelector(".ng-value-label, span[title], .mat-select-value-text, .mat-select-value, .selected-item, [role='combobox'] span, [data-value]");
                        if (valEl) {
                            const txt = String(valEl.getAttribute("title") || valEl.innerText || valEl.textContent || "").trim();
                            if (isValidFilterValue(txt)) {
                                liveFilter = txt;
                                filterSource = "TARGETING_SECTION";
                                break;
                            }
                        }
                        const sel = container.querySelector("select");
                        if (sel && sel.options && sel.options.length > 0) {
                            const opt = sel.options[sel.selectedIndex >= 0 ? sel.selectedIndex : 0];
                            const txt = opt ? String(opt.text || opt.innerText || opt.textContent || "").trim() : "";
                            if (isValidFilterValue(txt)) {
                                liveFilter = txt;
                                filterSource = "TARGETING_SECTION";
                                break;
                            }
                        }
                    }
                }
            }
        }

        if (!campaignId && !liveFilter && !campaignName) return null;

        let filterCount = null;
        let cleanFilterName = liveFilter;
        if (liveFilter) {
            const mCount = liveFilter.match(/[\\(\\[]\\s*(?:Count|Contacts)?\\s*:?\\s*([0-9,]+)\\s*[\\)\\]]/i);
            if (mCount && mCount[1]) {
                filterCount = Number(mCount[1].replace(/,/g, ""));
                cleanFilterName = liveFilter.replace(/[\\(\\[]\\s*(?:Count|Contacts)?\\s*:?\\s*[0-9,]+\\s*[\\)\\]]/i, "").trim();
            }

            // Cross-reference with inventory if filter name ends with ellipsis
            if (cleanFilterName && (cleanFilterName.endsWith("...") || cleanFilterName.endsWith("…"))) {
                const prefix = cleanFilterName.replace(/\\.{3}$|…$/, "").trim().toLowerCase();
                try {
                    const invKey = filePath.includes("East3") ? "ct_east3_live_filters_inventory_v1" : "ct_east2_live_filters_inventory_v1";
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
        };
    }`;

        if (readFormRegex.test(updated)) {
            updated = updated.replace(readFormRegex, newReadCampaignEditForm);
        }

        return updated;
    });
});

// 2. PATCH intelligence.js and East2 intelligence.js
['src/intelligence.js', 'CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/intelligence.js'].forEach(filePath => {
    patchFile(filePath, (content) => {
        let updated = content.replace(/\r\n/g, '\n');

        // UsageStatus when stale should be "STALE"
        const usageTarget = `                if (isStale && hasFilter) {
                    usageStatus = isRunning ? "STALE (ACTIVE)" : "STALE";
                } else if (!hasFilter) {`;

        const usageReplacement = `                if (isStale) {
                    usageStatus = "STALE";
                } else if (!hasFilter) {`;

        if (updated.includes(usageTarget)) {
            updated = updated.replace(usageTarget, usageReplacement);
        }

        return updated;
    });
});

console.log("Adjustments applied.");

