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

const e2Dir = 'CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2';

// 1. PATCH East2 parser.js
patchFile(`${e2Dir}/src/parser.js`, (content) => {
    let updated = content.replace(/\r\n/g, '\n');

    // A. Fix overlay inspection in readRow
    const overlayTarget = `            // Check active CDK overlays or modals on page for campaign edit drawer
            if (!rawLiveFilter && typeof document !== "undefined" && id) {
                const overlay = document.querySelector(".cdk-overlay-container, mat-dialog-container, mat-drawer, mat-sidenav, [role='dialog']");
                if (overlay) {
                    const overlayEditForm = (overlay.querySelector && overlay.querySelector(\`[data-campaign-id='\${id}']\`)) || overlay;
                    const ms = overlayEditForm.querySelector("mat-select[formcontrolname*='filter' i], select[name*='filter' i], .mat-select-value-text");
                    if (ms) {
                        const txt = String(ms.innerText || ms.textContent || ms.value || "").trim();
                        if (txt && txt !== "None" && txt !== "Unassigned" && !txt.toLowerCase().includes("select")) {
                            rawLiveFilter = txt;
                            filterSource = "ACTIVE_OVERLAY";
                        }
                    }
                }
            }`;

    const overlayReplacement = `            // Check active CDK overlays or modals on page for campaign edit drawer (strictly scoped to this campaign)
            if (!rawLiveFilter && typeof document !== "undefined" && id) {
                const overlay = document.querySelector(".cdk-overlay-container, mat-dialog-container, mat-drawer, mat-sidenav, [role='dialog']");
                if (overlay && overlay.querySelector) {
                    const overlayEditForm = overlay.querySelector(\`[data-campaign-id='\${id}']\`) ||
                        (rawName ? overlay.querySelector(\`[data-campaign-name='\${rawName}']\`) : null);
                    if (overlayEditForm) {
                        const ms = overlayEditForm.querySelector("ng-select[formcontrolname*='filter' i], mat-select[formcontrolname*='filter' i], select[name*='filter' i], .ng-value-label, .mat-select-value-text");
                        if (ms) {
                            const txt = String(ms.getAttribute("title") || ms.innerText || ms.textContent || ms.value || "").trim();
                            if (txt && txt !== "None" && txt !== "Unassigned" && !txt.toLowerCase().includes("select")) {
                                rawLiveFilter = txt;
                                filterSource = "ACTIVE_OVERLAY";
                            }
                        }
                    }
                }
            }`;

    if (!updated.includes(overlayTarget)) {
        console.error("Failed to match overlayTarget in East2 parser.js");
    } else {
        updated = updated.replace(overlayTarget, overlayReplacement);
    }

    // B. Replace readCampaignEditForm
    const readFormRegex = /\/\*\*[\s\S]*?\*\/\s*readCampaignEditForm\(doc\)\s*\{[\s\S]*?timestamp:\s*Date\.now\(\)\s*\};\s*\}/;
    const newReadCampaignEditForm = `/**
     * Reads campaign edit form / Targeting section DOM.
     * Extracts campaignId, campaignName, and selected Live Filter.
     * Supports Angular ng-select, mat-select, native select, and combobox.
     */
    readCampaignEditForm(doc) {
        const targetDoc = doc || (typeof document !== "undefined" ? document : null);
        if (!targetDoc) return null;

        // Verify genuine Edit Campaign context if running in a real browser
        const isBrowser = typeof window !== "undefined" && window.location;
        const currentPath = isBrowser && window.location.pathname ? window.location.pathname : "";
        const isEditUrl = currentPath.includes("/campaigns/edit/");
        const hasEditHeader = Boolean(targetDoc.querySelector && targetDoc.querySelector("h1, h2, .page-title, .breadcrumb-item.active") &&
            /edit\\s+campaign/i.test(targetDoc.querySelector("h1, h2, .page-title, .breadcrumb-item.active").textContent || ""));
        const hasEditForm = Boolean(targetDoc.querySelector && targetDoc.querySelector("form[action*='/campaigns/edit'], [data-edit-form='campaign']"));

        // If in real browser on non-edit route without edit form, strictly return null
        if (isBrowser && currentPath && !isEditUrl && !hasEditHeader && !hasEditForm) {
            return null;
        }

        // 1. Identify Campaign ID
        let campaignId = "";
        if (currentPath) {
            const match = currentPath.match(/\\/campaigns\\/edit\\/([0-9a-zA-Z_\\-]+)/);
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
                    const invKey = "ct_east2_live_filters_inventory_v1";
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

    if (!readFormRegex.test(updated)) {
        console.error("Failed to match readCampaignEditForm regex in East2 parser.js");
    } else {
        updated = updated.replace(readFormRegex, newReadCampaignEditForm);
    }

    return updated;
});

// 2. PATCH East2 content.js
patchFile(`${e2Dir}/src/content.js`, (content) => {
    let updated = content.replace(/\r\n/g, '\n');

    // Remove observeCampaignEditForm() call on campaigns page
    const target = `        if (isCampaignsPage()) {
            observeCampaignEditForm();
            if (now - lastInboundCoordinationAt >= INBOUND_COORDINATION_MS) {`;

    const replacement = `        if (isCampaignsPage()) {
            if (now - lastInboundCoordinationAt >= INBOUND_COORDINATION_MS) {`;

    if (!updated.includes(target)) {
        console.error("Failed to match isCampaignsPage target in East2 content.js");
    } else {
        updated = updated.replace(target, replacement);
    }

    return updated;
});

// 3. PATCH East2 intelligence.js
patchFile(`${e2Dir}/src/intelligence.js`, (content) => {
    let updated = content.replace(/\r\n/g, '\n');

    const staleTarget = `                    const age = observationTime ? (now - observationTime) : 0;
                    isStale = age > SEVEN_DAYS_MS;
                    if (isStale) staleCount++;`;

    const staleReplacement = `                    const age = observationTime ? (now - observationTime) : 0;
                    const FRESHNESS_WINDOW_MS = 120 * 1000; // 120 seconds freshness window
                    isStale = age > FRESHNESS_WINDOW_MS;
                    if (isStale) staleCount++;`;

    if (!updated.includes(staleTarget)) {
        console.error("Failed to match staleTarget in East2 intelligence.js");
    } else {
        updated = updated.replace(staleTarget, staleReplacement);
    }

    const usageTarget = `                if (isStale) {
                    usageStatus = "STALE";
                } else if (!hasFilter) {`;

    const usageReplacement = `                if (isStale && hasFilter) {
                    usageStatus = isRunning ? "STALE (ACTIVE)" : "STALE";
                } else if (!hasFilter) {`;

    if (!updated.includes(usageTarget)) {
        console.error("Failed to match usageTarget in East2 intelligence.js");
    } else {
        updated = updated.replace(usageTarget, usageReplacement);
    }

    const freshTarget = `                if (observationTime) {
                    if (isStale || ageSec > 60) freshness = "STALE";
                    else if (ageSec <= 15) freshness = "LIVE";
                    else freshness = "RECENT";
                }`;

    const freshReplacement = `                if (observationTime) {
                    if (isStale || ageSec > 120) freshness = "STALE";
                    else if (ageSec <= 30) freshness = "LIVE";
                    else freshness = "RECENT";
                }`;

    if (!updated.includes(freshTarget)) {
        console.error("Failed to match freshTarget in East2 intelligence.js");
    } else {
        updated = updated.replace(freshTarget, freshReplacement);
    }

    return updated;
});

// 4. PATCH East2 dashboard.js
patchFile(`${e2Dir}/src/dashboard.js`, (content) => {
    let updated = content.replace(/\r\n/g, '\n');

    // Header badge
    const topVerifyTarget = `                // 1. Header elements
                if (refs.topFilterCampaign) setText(refs.topFilterCampaign, cName);
                if (refs.topFilterDialer) setText(refs.topFilterDialer, DIALER);
                if (refs.topFilterVerificationState) {
                    if (fName && fSource !== "DOM_UNAVAILABLE") {
                        setText(refs.topFilterVerificationState, "TARGETING: VERIFIED");
                        setClass(refs.topFilterVerificationState, "ct-lft-verify-badge is-verified");
                    } else if (fName) {
                        setText(refs.topFilterVerificationState, "TARGETING: UNVERIFIED");
                        setClass(refs.topFilterVerificationState, "ct-lft-verify-badge is-unverified");
                    } else {
                        setText(refs.topFilterVerificationState, "TARGETING: UNAVAILABLE");
                        setClass(refs.topFilterVerificationState, "ct-lft-verify-badge is-unavailable");
                    }
                }`;

    const topVerifyReplacement = `                // 1. Header elements
                const isTargetingCurrent = fName && fSource !== "DOM_UNAVAILABLE" && (!fTimeMs || (Date.now() - fTimeMs) <= 120000);
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

    if (!updated.includes(topVerifyTarget)) {
        console.error("Failed to match topVerifyTarget in East2 dashboard.js");
    } else {
        updated = updated.replace(topVerifyTarget, topVerifyReplacement);
    }

    // Card 5
    const card5Target = `                // 6. Card 5: Targeting Verification
                if (refs.topFilterConfidence) {
                    setText(refs.topFilterConfidence, (fName && fSource !== "DOM_UNAVAILABLE") ? "VERIFIED" : (fName ? "UNVERIFIED" : "UNAVAILABLE"));
                }`;

    const card5Replacement = `                // 6. Card 5: Targeting Verification
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

    if (!updated.includes(card5Target)) {
        console.error("Failed to match card5Target in East2 dashboard.js");
    } else {
        updated = updated.replace(card5Target, card5Replacement);
    }

    // Add 'All' button to menu head
    const menuHeadTarget = `<div class="ct-operating-menu-head"><strong>Select Operating Campaigns</strong><button type="button" data-operating-action="clear">Clear</button></div>`;
    const menuHeadReplacement = `<div class="ct-operating-menu-head"><strong>Select Operating Campaigns</strong><div class="ct-operating-menu-actions"><button type="button" class="ct-btn-sm" data-operating-action="all">All</button><button type="button" class="ct-btn-sm" data-operating-action="clear">Clear</button></div></div>`;
    if (updated.includes(menuHeadTarget)) {
        updated = updated.replace(menuHeadTarget, menuHeadReplacement);
    }

    // Operating menu listener: handle 'all'
    const clearActionTarget = `            const clear = event.target.closest('[data-operating-action="clear"]');
            if (clear) {
                event.preventDefault();
                writeOperatingCampaigns([]);
                addCurrentStateAlerts(state.campaigns);
                showActionNotice("Operating campaign selection cleared.");
                updateOperatingSelect(state.campaigns);
                scheduleRender();
                return;
            }`;

    const clearActionReplacement = `            const selectAll = event.target.closest('[data-operating-action="all"]');
            if (selectAll) {
                event.preventDefault();
                const all = state.campaigns || [];
                const allIds = all.map(function(c) {
                    return c.rawId ? String(c.rawId) : c.id ? String(c.id) : c.__id ? String(c.__id) : String(c.name || "").trim().toLowerCase();
                }).filter(Boolean);
                writeOperatingCampaigns(allIds);
                addCurrentStateAlerts(state.campaigns);
                showActionNotice("All visible campaigns selected.");
                updateOperatingSelect(state.campaigns);
                scheduleRender();
                return;
            }
            const clear = event.target.closest('[data-operating-action="clear"]');
            if (clear) {
                event.preventDefault();
                writeOperatingCampaigns([]);
                addCurrentStateAlerts(state.campaigns);
                showActionNotice("Operating campaign selection cleared.");
                updateOperatingSelect(state.campaigns);
                scheduleRender();
                return;
            }`;

    if (!updated.includes(clearActionTarget)) {
        console.error("Failed to match clearActionTarget in East2 dashboard.js");
    } else {
        updated = updated.replace(clearActionTarget, clearActionReplacement);
    }

    // focusCampaign deselect
    const focusCampaignTarget = `            if (!alreadySelected) {
                next.add(primaryId);
                showActionNotice(safeValue(match.name) + " selected as operating campaign.");
            } else if (next.size > 1) {
                if (match.rawId) next.delete(String(match.rawId));
                if (match.id) next.delete(String(match.id));
                if (match.__id) next.delete(String(match.__id));
                if (match.name) next.delete(String(match.name).trim().toLowerCase());
                next.delete(primaryId);
                showActionNotice(safeValue(match.name) + " removed from operating set.");
            } else {
                showActionNotice(safeValue(match.name) + " is operating.");
            }`;

    const focusCampaignReplacement = `            if (!alreadySelected) {
                next.add(primaryId);
                showActionNotice(safeValue(match.name) + " selected as operating campaign.");
            } else {
                if (match.rawId) next.delete(String(match.rawId));
                if (match.id) next.delete(String(match.id));
                if (match.__id) next.delete(String(match.__id));
                if (match.name) next.delete(String(match.name).trim().toLowerCase());
                next.delete(primaryId);
                showActionNotice(safeValue(match.name) + " removed from operating set.");
            }`;

    if (!updated.includes(focusCampaignTarget)) {
        console.error("Failed to match focusCampaignTarget in East2 dashboard.js");
    } else {
        updated = updated.replace(focusCampaignTarget, focusCampaignReplacement);
    }

    // isOperating check
    const isOperatingTarget = `                const isOperating = (state.operatingCampaigns || []).includes(c.__id);`;
    const isOperatingReplacement = `                const isOperating = isCampaignSelected(c, new Set((state.operatingCampaigns || []).map(function(id) { return String(id || "").trim(); }).filter(Boolean)));`;

    if (!updated.includes(isOperatingTarget)) {
        console.error("Failed to match isOperatingTarget in East2 dashboard.js");
    } else {
        updated = updated.replace(isOperatingTarget, isOperatingReplacement);
    }

    // Scroll preservation
    const scrollTarget = `        if (refs.operatingOptions.dataset.signature !== signature) {`;
    const scrollReplacement = `        if (refs.operatingOptions.dataset.signature !== signature) {
            const preservedScrollTop = refs.operatingOptions.scrollTop;`;

    if (updated.includes(scrollTarget) && !updated.includes(scrollReplacement)) {
        updated = updated.replace(scrollTarget, scrollReplacement);
        const sigEnd = `            refs.operatingOptions.dataset.signature = signature;
        }`;
        const sigEndReplacement = `            refs.operatingOptions.dataset.signature = signature;
            if (preservedScrollTop > 0) refs.operatingOptions.scrollTop = preservedScrollTop;
        }`;
        if (updated.includes(sigEnd)) {
            updated = updated.replace(sigEnd, sigEndReplacement);
        }
    }

    // Matrix table usage class
    const matrixUsageTarget = `                    const usageClass = m.usageStatus === "VERIFIED ACTIVE" ? "is-verified-active" :
                                       m.usageStatus === "UNASSIGNED" ? "is-unassigned" :
                                       m.usageStatus === "STALE" ? "is-stale" : "is-unknown";`;

    const matrixUsageReplacement = `                    const usageClass = m.usageStatus === "VERIFIED ACTIVE" ? "is-verified-active" :
                                       (m.usageStatus === "STALE" || m.usageStatus === "STALE (ACTIVE)") ? "is-stale" :
                                       m.usageStatus === "UNASSIGNED" ? "is-unassigned" : "is-unknown";`;

    if (updated.includes(matrixUsageTarget)) {
        updated = updated.replace(matrixUsageTarget, matrixUsageReplacement);
    }

    return updated;
});

// 5. PATCH East2 dashboard.css
patchFile(`${e2Dir}/src/dashboard.css`, (content) => {
    let updated = content.replace(/\r\n/g, '\n');

    if (!updated.includes('.ct-lft-verify-badge.is-stale')) {
        const extraCss = `
/* v11.3.8 Root-Cause Repair Styles */
.ct-lft-verify-badge.is-stale {
    background: rgba(245, 158, 11, 0.18) !important;
    color: #f59e0b !important;
    border: 1px solid rgba(245, 158, 11, 0.45) !important;
}
.ct-lfi-badge.is-stale {
    background: rgba(245, 158, 11, 0.16) !important;
    color: #fbbf24 !important;
    border: 1px solid rgba(245, 158, 11, 0.4) !important;
}
.ct-operating-menu-actions {
    display: flex;
    gap: 6px;
    align-items: center;
}
.ct-operating-menu-actions button {
    background: rgba(30, 41, 59, 0.8);
    border: 1px solid rgba(148, 163, 184, 0.25);
    color: #cbd5e1;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    cursor: pointer;
}
.ct-operating-menu-actions button:hover {
    background: rgba(51, 65, 85, 0.9);
    color: #fff;
}
`;
        updated += extraCss;
    }

    return updated;
});

console.log("East2 patch execution finished.");
