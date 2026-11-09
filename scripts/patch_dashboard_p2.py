import re

dashboard_js_path = "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/dashboard.js"
with open(dashboard_js_path, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Replace topLiveFilterStrip with topLiveFilterPanel in HTML template
old_strip = """                    <div class="ct-top-live-filter-strip" data-ref="topLiveFilterStrip">
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

new_panel = """                    <!-- LIVE FILTER TARGETING (HIGH-VISIBILITY 6-CARD COMMAND CENTER) -->
                    <section class="ct-lft-panel" data-ref="topLiveFilterPanel" aria-label="Live Filter Targeting Command Center">
                        <div class="ct-lft-header">
                            <div class="ct-lft-header-left">
                                <span class="ct-lft-title-tag">LIVE FILTER TARGETING</span>
                                <span class="ct-lft-dialer-pill" data-ref="topFilterDialer">${DIALER}</span>
                                <span class="ct-lft-campaign-title" data-ref="topFilterCampaign">—</span>
                            </div>
                            <div class="ct-lft-header-right">
                                <span class="ct-lft-verify-badge is-unavailable" data-ref="topFilterVerificationState">TARGETING: UNAVAILABLE</span>
                                <span class="ct-lft-source-pill" data-ref="topFilterSource">Source: Awaiting DOM</span>
                                <span class="ct-tlf-badge is-unavailable" data-ref="topFilterBadge" hidden>FILTER SOURCE UNAVAILABLE</span>
                            </div>
                        </div>
                        <div class="ct-lft-cards-grid">
                            <!-- Card 1: Assigned Live Filter -->
                            <div class="ct-lft-card ct-lft-card-filter">
                                <div class="ct-lft-card-eyebrow">ASSIGNED LIVE FILTER</div>
                                <div class="ct-lft-card-primary" data-ref="topFilterName">—</div>
                                <div class="ct-lft-card-meta">
                                    <span class="ct-lft-status-pill is-unavailable" data-ref="topFilterStatus">UNAVAILABLE</span>
                                    <span class="ct-lft-card-id" data-ref="topFilterId">ID: —</span>
                                </div>
                            </div>
                            <!-- Card 2: Campaign Callable Pool -->
                            <div class="ct-lft-card ct-lft-card-pool">
                                <div class="ct-lft-card-eyebrow">CAMPAIGN CALLABLE POOL</div>
                                <div class="ct-lft-card-primary ct-lft-pool-val" data-ref="topFilterPool">—</div>
                                <div class="ct-lft-card-meta">
                                    <span class="ct-lft-source-tag">Campaigns Page</span>
                                    <span class="ct-lft-card-time" data-ref="topFilterPoolTime">Live Queue</span>
                                </div>
                            </div>
                            <!-- Card 3: Filter Available Contacts -->
                            <div class="ct-lft-card ct-lft-card-avail">
                                <div class="ct-lft-card-eyebrow">FILTER AVAILABLE CONTACTS</div>
                                <div class="ct-lft-card-primary ct-lft-avail-val" data-ref="topFilterAvailableContacts">—</div>
                                <div class="ct-lft-card-meta">
                                    <span class="ct-lft-source-tag">Live Filter Inventory</span>
                                    <span class="ct-lft-card-time" data-ref="topFilterAvailableTime">Awaiting /manager/live-filters</span>
                                </div>
                            </div>
                            <!-- Card 4: Filter Total Matches -->
                            <div class="ct-lft-card ct-lft-card-match">
                                <div class="ct-lft-card-eyebrow">FILTER TOTAL MATCHES</div>
                                <div class="ct-lft-card-primary ct-lft-match-val" data-ref="topFilterMatch">—</div>
                                <div class="ct-lft-card-meta">
                                    <span class="ct-lft-source-tag">Demographic Matches</span>
                                    <small class="ct-lft-match-note">All timezones</small>
                                </div>
                            </div>
                            <!-- Card 5: Targeting Verification -->
                            <div class="ct-lft-card ct-lft-card-verify">
                                <div class="ct-lft-card-eyebrow">TARGETING VERIFICATION</div>
                                <div class="ct-lft-card-primary" data-ref="topFilterConfidence">UNVERIFIED</div>
                                <div class="ct-lft-card-meta">
                                    <span class="ct-lft-source-tag" data-ref="topFilterVerifySource">Awaiting Source</span>
                                    <span class="ct-lft-card-time" data-ref="topFilterObserved">—</span>
                                </div>
                            </div>
                            <!-- Card 6: Data Freshness -->
                            <div class="ct-lft-card ct-lft-card-fresh">
                                <div class="ct-lft-card-eyebrow">DATA FRESHNESS</div>
                                <div class="ct-lft-card-primary ct-lft-freshness-val is-waiting" data-ref="topFilterFreshness">NOT OBSERVED</div>
                                <div class="ct-lft-card-meta">
                                    <span class="ct-lft-card-age" data-ref="topFilterAge">—</span>
                                </div>
                            </div>
                        </div>
                        <!-- Latest Verified Targeting Transition -->
                        <div class="ct-lft-transition-bar" data-ref="topFilterTransitionBar">
                            <span class="ct-lft-transition-label">LATEST TARGETING TRANSITION:</span>
                            <div class="ct-lft-transition-content" data-ref="topFilterChange">No verified targeting changes recorded</div>
                        </div>
                    </section>"""

assert old_strip in code, "old_strip not found"
code = code.replace(old_strip, new_panel)
print("Replaced topLiveFilterStrip with high-visibility 6-card topLiveFilterPanel")

# 2. Remove Verified Change History from the template
old_footer_grid = """                            <!-- D & E: History & Data Health -->
                            <div class="ct-lfi-footer-grid">
                                <!-- D. Verified Change History -->
                                <div class="ct-lfi-card">
                                    <div class="ct-lfi-card-head">
                                        <strong>Verified Change History</strong>
                                        <small>Confirmed via 2-cycle observation lifecycle</small>
                                    </div>
                                    <div class="ct-lfi-history-list" data-ref="lfiHistoryList">
                                        <div class="ct-lfi-empty">No filter transitions detected yet.</div>
                                    </div>
                                </div>

                                <!-- E. Data Health -->
                                <div class="ct-lfi-card ct-lfi-health-card">
                                    <div class="ct-lfi-card-head">
                                        <strong>Data Health & Provenance</strong>
                                        <span class="ct-lfi-status-pill is-neutral" data-ref="lfiDataHealthPill">OPTIMAL</span>
                                    </div>
                                    <div class="ct-lfi-health-details" data-ref="lfiHealthDetails">
                                        <div class="ct-lfi-health-row"><span>Dialer Host:</span><strong data-ref="lfiHealthDialer">EAST-2</strong></div>
                                        <div class="ct-lfi-health-row"><span>Inventory Freshness:</span><strong data-ref="lfiHealthFreshness">Waiting…</strong></div>
                                        <div class="ct-lfi-health-row"><span>Stale Records (>7d):</span><strong data-ref="lfiHealthStale">0</strong></div>
                                        <div class="ct-lfi-health-row"><span>Missing Verification:</span><strong data-ref="lfiHealthMissing">0</strong></div>
                                        <div class="ct-lfi-health-row"><span>Strict Boundary:</span><strong class="ct-text-good">READ-ONLY (0 clicks, 0 fetch)</strong></div>
                                    </div>
                                </div>
                            </div>"""

new_footer_grid = """                            <!-- Data Health & Provenance (Reflowed Full-Width) -->
                            <div class="ct-lfi-footer-grid ct-lfi-health-only">
                                <div class="ct-lfi-card ct-lfi-health-card">
                                    <div class="ct-lfi-card-head">
                                        <strong>Data Health & Provenance</strong>
                                        <span class="ct-lfi-status-pill is-neutral" data-ref="lfiDataHealthPill">OPTIMAL</span>
                                    </div>
                                    <div class="ct-lfi-health-details" data-ref="lfiHealthDetails">
                                        <div class="ct-lfi-health-row"><span>Dialer Host:</span><strong data-ref="lfiHealthDialer">EAST-2</strong></div>
                                        <div class="ct-lfi-health-row"><span>Inventory Freshness:</span><strong data-ref="lfiHealthFreshness">Waiting…</strong></div>
                                        <div class="ct-lfi-health-row"><span>Stale Records (>7d):</span><strong data-ref="lfiHealthStale">0</strong></div>
                                        <div class="ct-lfi-health-row"><span>Missing Verification:</span><strong data-ref="lfiHealthMissing">0</strong></div>
                                        <div class="ct-lfi-health-row"><span>Strict Boundary:</span><strong class="ct-text-good">READ-ONLY (0 clicks, 0 fetch)</strong></div>
                                    </div>
                                </div>
                            </div>"""

assert old_footer_grid in code, "old_footer_grid not found"
code = code.replace(old_footer_grid, new_footer_grid)
print("Removed Verified Change History from the template and reflowed Data Health")

# 3. Update refs binding in mount()
old_refs = """            topLiveFilterStrip: root.querySelector('[data-ref="topLiveFilterStrip"]'),
            topFilterCampaign: root.querySelector('[data-ref="topFilterCampaign"]'),
            topFilterBadge: root.querySelector('[data-ref="topFilterBadge"]'),
            topFilterSource: root.querySelector('[data-ref="topFilterSource"]'),
            topFilterObserved: root.querySelector('[data-ref="topFilterObserved"]'),
            topFilterChange: root.querySelector('[data-ref="topFilterChange"]'),
            topFilterPool: root.querySelector('[data-ref="topFilterPool"]'),
            topFilterMatch: root.querySelector('[data-ref="topFilterMatch"]'),
            topFilterFreshness: root.querySelector('[data-ref="topFilterFreshness"]'),"""

new_refs = """            topLiveFilterStrip: root.querySelector('[data-ref="topLiveFilterStrip"]') || root.querySelector('[data-ref="topLiveFilterPanel"]'),
            topLiveFilterPanel: root.querySelector('[data-ref="topLiveFilterPanel"]'),
            topFilterDialer: root.querySelector('[data-ref="topFilterDialer"]'),
            topFilterCampaign: root.querySelector('[data-ref="topFilterCampaign"]'),
            topFilterVerificationState: root.querySelector('[data-ref="topFilterVerificationState"]'),
            topFilterBadge: root.querySelector('[data-ref="topFilterBadge"]'),
            topFilterSource: root.querySelector('[data-ref="topFilterSource"]'),
            topFilterObserved: root.querySelector('[data-ref="topFilterObserved"]'),
            topFilterChange: root.querySelector('[data-ref="topFilterChange"]'),
            topFilterPool: root.querySelector('[data-ref="topFilterPool"]'),
            topFilterPoolTime: root.querySelector('[data-ref="topFilterPoolTime"]'),
            topFilterAvailableContacts: root.querySelector('[data-ref="topFilterAvailableContacts"]'),
            topFilterAvailableTime: root.querySelector('[data-ref="topFilterAvailableTime"]'),
            topFilterMatch: root.querySelector('[data-ref="topFilterMatch"]'),
            topFilterFreshness: root.querySelector('[data-ref="topFilterFreshness"]'),
            topFilterName: root.querySelector('[data-ref="topFilterName"]'),
            topFilterStatus: root.querySelector('[data-ref="topFilterStatus"]'),
            topFilterId: root.querySelector('[data-ref="topFilterId"]'),
            topFilterConfidence: root.querySelector('[data-ref="topFilterConfidence"]'),
            topFilterVerifySource: root.querySelector('[data-ref="topFilterVerifySource"]'),
            topFilterAge: root.querySelector('[data-ref="topFilterAge"]'),"""

assert old_refs in code, "old_refs not found"
code = code.replace(old_refs, new_refs)
print("Updated refs binding in mount()")

# 4. Update top Live Filter Targeting population logic in updateSummary
old_tlf_logic = """        // Update Top Live Filter Strip
        if (refs.topFilterCampaign && refs.topFilterBadge) {
            const allCampList = stats.campaigns || state.campaigns || [];
            let targetCamp = operating || (allCampList.find(function(c) { return c && c.active !== false; })) || allCampList[0] || null;

            if (targetCamp) {
                const cName = safeValue(targetCamp.name, "Campaign " + (targetCamp.id || ""));
                let fRaw = targetCamp.liveFilter || null;
                let fName = fRaw;
                let fCount = targetCamp.liveFilterCount !== undefined ? targetCamp.liveFilterCount : null;

                if (fRaw) {
                    const mCount = String(fRaw).match(/[\(\[]\s*(?:Count|Contacts)?\s*:?\s*([0-9,]+)\s*[\)\]]/i);
                    if (mCount && mCount[1]) {
                        fCount = Number(mCount[1].replace(/,/g, ""));
                        fName = String(fRaw).replace(/[\(\[]\s*(?:Count|Contacts)?\s*:?\s*[0-9,]+\s*[\)\]]/i, "").trim();
                    }
                }

                const pool = (targetCamp.contacts !== undefined && targetCamp.contacts !== null)
                    ? (typeof targetCamp.contacts === "object" ? targetCamp.contacts.value : targetCamp.contacts)
                    : (targetCamp.__contacts || null);

                const fSource = targetCamp.liveFilterSource || "DOM_UNAVAILABLE";
                const fTime = targetCamp.liveFilterTimestamp ? new Date(targetCamp.liveFilterTimestamp).toLocaleTimeString() : (fName ? new Date().toLocaleTimeString() : "Awaiting DOM");
                const fTimeMs = targetCamp.liveFilterTimestamp || null;
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

new_tlf_logic = """        // Update Live Filter Targeting Command Center Panel
        if (refs.topLiveFilterPanel || refs.topFilterCampaign) {
            const allCampList = stats.campaigns || state.campaigns || [];
            let targetCamp = operating || (allCampList.find(function(c) { return c && c.active !== false; })) || allCampList[0] || null;

            if (targetCamp) {
                const cId = targetCamp.rawId || targetCamp.id || "";
                const cName = safeValue(targetCamp.name, cId ? "Campaign #" + cId : "Unnamed Campaign");
                let fRaw = targetCamp.liveFilter || null;
                let fName = fRaw;
                let fCount = targetCamp.liveFilterCount !== undefined && targetCamp.liveFilterCount !== null ? targetCamp.liveFilterCount : null;

                if (fRaw) {
                    const mCount = String(fRaw).match(/[\(\[]\s*(?:Count|Contacts)?\s*:?\s*([0-9,]+)\s*[\)\]]/i);
                    if (mCount && mCount[1]) {
                        fCount = Number(mCount[1].replace(/,/g, ""));
                        fName = String(fRaw).replace(/[\(\[]\s*(?:Count|Contacts)?\s*:?\s*[0-9,]+\s*[\)\]]/i, "").trim();
                    }
                }

                const pool = (targetCamp.contacts !== undefined && targetCamp.contacts !== null)
                    ? (typeof targetCamp.contacts === "object" ? targetCamp.contacts.value : targetCamp.contacts)
                    : (targetCamp.__contacts || null);

                let invMatch = null;
                if (fName && intelligenceEngine && intelligenceEngine.inventory) {
                    const normFName = String(fName).trim().toLowerCase();
                    invMatch = intelligenceEngine.inventory.find(function(inv) {
                        return inv && String(inv.name || "").trim().toLowerCase() === normFName;
                    });
                }
                const fAvailContacts = invMatch ? (invMatch.count !== undefined ? invMatch.count : invMatch.totalCount) : null;
                const fId = targetCamp.liveFilterId || (invMatch ? invMatch.id : null);

                const fSource = targetCamp.liveFilterSource || "DOM_UNAVAILABLE";
                const fTimeMs = targetCamp.liveFilterTimestamp || null;
                const fTime = fTimeMs ? new Date(fTimeMs).toLocaleTimeString() : (fName ? new Date().toLocaleTimeString() : "Awaiting DOM");
                const targetingFreshness = evaluateFreshness(fTimeMs, Date.now());

                let lastChangeHtml = "No verified targeting transitions recorded";
                let changeFound = false;
                if (intelligenceEngine && intelligenceEngine.history) {
                    const recentChange = intelligenceEngine.history.find(function(h) {
                        return h.category === "LIVE_FILTER" && (
                            (cId && String(h.targetId) === String(cId)) ||
                            (cId && String(h.campaignId) === String(cId)) ||
                            String(h.targetName || "").trim().toLowerCase() === String(targetCamp.name || "").trim().toLowerCase()
                        );
                    });
                    if (recentChange) {
                        changeFound = true;
                        const prevCountStr = recentChange.previousCount !== undefined && recentChange.previousCount !== null ? ' (' + formatNumber(recentChange.previousCount) + ')' : '';
                        const currCountStr = recentChange.currentCount !== undefined && recentChange.currentCount !== null ? ' (' + formatNumber(recentChange.currentCount) + ')' : '';
                        lastChangeHtml = '<span class="ct-lft-change-campaign">' + escapeHtml(cName) + ': </span>' +
                            '<span class="ct-lfi-prev">' + escapeHtml(recentChange.previousFilter || recentChange.previous || "None") + prevCountStr + '</span>' +
                            '<span class="ct-lfi-arrow"> ➔ </span>' +
                            '<span class="ct-lfi-curr">' + escapeHtml(recentChange.currentFilter || recentChange.current || "None") + currCountStr + '</span>' +
                            ' <span class="ct-lft-change-time">(' + escapeHtml(recentChange.confirmedAt || (recentChange.timestamp ? new Date(recentChange.timestamp).toLocaleTimeString() : "")) + ')</span>' +
                            ' <span class="ct-lfi-source">Evidence: ' + escapeHtml(recentChange.source || "CONFIRMED OBSERVATION") + '</span>';
                    }
                }

                // 1. Header elements
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
                }
                if (refs.topFilterSource) {
                    const sourceLabel = fSource === "TABLE_COLUMN" ? "Campaigns Table" :
                                        fSource === "CAMPAIGN_EDIT_DOM" ? "Edit Page DOM" :
                                        fSource === "VERIFIED_REGISTRY" ? "Verified Registry" : "DOM Unavailable";
                    setText(refs.topFilterSource, "Source: " + sourceLabel);
                }

                // 2. Card 1: Assigned Live Filter
                if (refs.topFilterName) {
                    setText(refs.topFilterName, fName || "No filter assigned");
                    refs.topFilterName.title = fName || "";
                }
                if (refs.topFilterStatus) {
                    const st = fName ? (targetCamp.active !== false ? "ASSIGNED & ACTIVE" : "ASSIGNED (IDLE)") : "UNASSIGNED / NONE";
                    setText(refs.topFilterStatus, st);
                    setClass(refs.topFilterStatus, "ct-lft-status-pill " + (fName ? "is-assigned" : "is-unassigned"));
                }
                if (refs.topFilterId) {
                    setText(refs.topFilterId, fId ? "ID: " + fId : "ID: Unavailable");
                }
                if (refs.topFilterBadge) {
                    setText(refs.topFilterBadge, fName ? "Filter: " + fName : "FILTER SOURCE UNAVAILABLE");
                    setClass(refs.topFilterBadge, "ct-tlf-badge " + (fName ? "is-assigned" : "is-unavailable"));
                }

                // 3. Card 2: Campaign Callable Pool
                if (refs.topFilterPool) {
                    setText(refs.topFilterPool, pool !== null ? formatNumber(pool) : "—");
                }
                if (refs.topFilterPoolTime) {
                    setText(refs.topFilterPoolTime, state.lastDataChangeAt ? formatAge(Math.floor((Date.now() - state.lastDataChangeAt)/1000)) + " ago" : "Live Queue");
                }

                // 4. Card 3: Filter Available Contacts
                if (refs.topFilterAvailableContacts) {
                    setText(refs.topFilterAvailableContacts, fAvailContacts !== null ? formatNumber(fAvailContacts) : (fName ? "Nav required" : "—"));
                }
                if (refs.topFilterAvailableTime) {
                    const invFresh = (intelligenceEngine && intelligenceEngine.lastObservedAt) ? formatAge(Math.floor((Date.now() - intelligenceEngine.lastObservedAt)/1000)) + " ago" : "Awaiting /manager/live-filters";
                    setText(refs.topFilterAvailableTime, invFresh);
                }

                // 5. Card 4: Filter Total Matches
                if (refs.topFilterMatch) {
                    setText(refs.topFilterMatch, fCount !== null ? formatNumber(fCount) : "—");
                }

                // 6. Card 5: Targeting Verification
                if (refs.topFilterConfidence) {
                    setText(refs.topFilterConfidence, (fName && fSource !== "DOM_UNAVAILABLE") ? "VERIFIED" : (fName ? "UNVERIFIED" : "UNAVAILABLE"));
                }
                if (refs.topFilterVerifySource) {
                    setText(refs.topFilterVerifySource, fSource === "TABLE_COLUMN" ? "Campaigns Table" : fSource === "CAMPAIGN_EDIT_DOM" ? "Edit Page DOM" : fSource === "VERIFIED_REGISTRY" ? "Verified Registry" : "DOM Unavailable");
                }
                if (refs.topFilterObserved) {
                    setText(refs.topFilterObserved, fTime);
                }

                // 7. Card 6: Data Freshness
                if (refs.topFilterFreshness) {
                    setText(refs.topFilterFreshness, targetingFreshness.label.toUpperCase());
                    setClass(refs.topFilterFreshness, "ct-lft-card-primary ct-lft-freshness-val " + targetingFreshness.className);
                }
                if (refs.topFilterAge) {
                    setText(refs.topFilterAge, fTimeMs ? formatAge(Math.floor((Date.now() - fTimeMs)/1000)) + " old" : "Never observed");
                }

                // 8. Transition Bar
                if (refs.topFilterChange) {
                    if (changeFound) {
                        refs.topFilterChange.innerHTML = lastChangeHtml;
                    } else {
                        setText(refs.topFilterChange, "No verified targeting transitions recorded for " + cName);
                    }
                }
            } else {
                if (refs.topFilterCampaign) setText(refs.topFilterCampaign, "—");
                if (refs.topFilterName) setText(refs.topFilterName, "—");
                if (refs.topFilterStatus) {
                    setText(refs.topFilterStatus, "UNAVAILABLE");
                    setClass(refs.topFilterStatus, "ct-lft-status-pill is-unavailable");
                }
                if (refs.topFilterId) setText(refs.topFilterId, "ID: —");
                if (refs.topFilterPool) setText(refs.topFilterPool, "—");
                if (refs.topFilterAvailableContacts) setText(refs.topFilterAvailableContacts, "—");
                if (refs.topFilterMatch) setText(refs.topFilterMatch, "—");
                if (refs.topFilterConfidence) setText(refs.topFilterConfidence, "UNAVAILABLE");
                if (refs.topFilterVerifySource) setText(refs.topFilterVerifySource, "DOM Unavailable");
                if (refs.topFilterObserved) setText(refs.topFilterObserved, "Awaiting DOM");
                if (refs.topFilterFreshness) {
                    setText(refs.topFilterFreshness, "NOT OBSERVED");
                    setClass(refs.topFilterFreshness, "ct-lft-card-primary ct-lft-freshness-val is-waiting");
                }
                if (refs.topFilterAge) setText(refs.topFilterAge, "—");
                if (refs.topFilterChange) setText(refs.topFilterChange, "No verified targeting changes recorded");
                if (refs.topFilterBadge) {
                    setText(refs.topFilterBadge, "FILTER SOURCE UNAVAILABLE");
                    setClass(refs.topFilterBadge, "ct-tlf-badge is-unavailable");
                }
            }
        }"""

assert old_tlf_logic in code, "old_tlf_logic not found"
code = code.replace(old_tlf_logic, new_tlf_logic)
print("Updated top Live Filter Targeting population logic")

# 5. Remove refs.lfiHistoryList populator in updateLiveFilterIntelligence
old_history_pop = """        // History List
        if (refs.lfiHistoryList) {
            if (history.length === 0) {
                refs.lfiHistoryList.innerHTML = '<div class="ct-lfi-empty">No filter transitions detected yet.</div>';
            } else {
                refs.lfiHistoryList.innerHTML = history.slice(0, 10).map(function (item) {
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
                }).join("");
            }
        }"""

code = code.replace(old_history_pop, "// Verified Change History removed from dashboard per directive")
print("Removed refs.lfiHistoryList populator")

# 6. Add Focus & Dismiss buttons to activeIntelCards in updateAlerts
old_intel_cards = """                    '<div class="ct-goal-card-actions">' +
                        '<span class="ct-intel-auto-tag" title="Updates automatically with live CallTools observations">AUTO-UPDATING</span>' +
                    '</div>' +
                '</div>';"""

new_intel_cards = """                    '<div class="ct-goal-card-actions">' +
                        (alert.severity === "critical" || alert.severity === "warning" || alert.direction === "INCREASE" || alert.direction === "DECREASE"
                            ? '<button type="button" class="ct-alert-btn ct-alert-btn-primary" data-intel-action="focus" data-target="' + escapeHtml(alert.targetId || alert.campaignId || alert.targetName || "") + '">FOCUS</button>' +
                              '<button type="button" class="ct-alert-btn ct-alert-btn-dismiss" data-intel-action="dismiss" data-intel-id="' + escapeHtml(alert.id) + '">DISMISS</button>'
                            : '<span class="ct-intel-auto-tag" title="Updates automatically with live CallTools observations">AUTO-UPDATING</span>') +
                    '</div>' +
                '</div>';"""

assert old_intel_cards in code, "old_intel_cards not found"
code = code.replace(old_intel_cards, new_intel_cards)
print("Added FOCUS and DISMISS controls to activeIntelCards")

# 7. Add event handler for data-intel-action in persistentGoalsContainer
old_pgc_handler = """        if (refs.persistentGoalsContainer) {
            refs.persistentGoalsContainer.addEventListener("click", function(event) {
                const btn = event.target.closest("[data-noted-id]");
                if (btn) {
                    event.preventDefault();
                    event.stopPropagation();
                    acknowledgePersistentGoalAlert(btn.getAttribute("data-noted-id"));
                    return;
                }
                const intelBtn = event.target.closest("[data-intel-noted-id]");
                if (intelBtn && intelligenceEngine) {
                    event.preventDefault();
                    event.stopPropagation();
                    intelligenceEngine.acknowledgeAlert(intelBtn.getAttribute("data-intel-noted-id"));
                    scheduleRender();
                    showActionNotice("Change intelligence alert acknowledged [NOTED].");
                    return;
                }
            });
        }"""

new_pgc_handler = """        if (refs.persistentGoalsContainer) {
            refs.persistentGoalsContainer.addEventListener("click", function(event) {
                const btn = event.target.closest("[data-noted-id]");
                if (btn) {
                    event.preventDefault();
                    event.stopPropagation();
                    acknowledgePersistentGoalAlert(btn.getAttribute("data-noted-id"));
                    return;
                }
                const intelActionBtn = event.target.closest("[data-intel-action]");
                if (intelActionBtn) {
                    event.preventDefault();
                    event.stopPropagation();
                    const action = intelActionBtn.dataset.intelAction;
                    if (action === "dismiss") {
                        const intelId = intelActionBtn.dataset.intelId;
                        if (intelligenceEngine && intelId) {
                            intelligenceEngine.acknowledgeAlert(intelId);
                            scheduleRender();
                            showActionNotice("Alert dismissed until condition changes.");
                        }
                    } else if (action === "focus") {
                        const target = intelActionBtn.dataset.target;
                        if (target) {
                            focusCampaign(target, false);
                        }
                    }
                    return;
                }
                const intelBtn = event.target.closest("[data-intel-noted-id]");
                if (intelBtn && intelligenceEngine) {
                    event.preventDefault();
                    event.stopPropagation();
                    intelligenceEngine.acknowledgeAlert(intelBtn.getAttribute("data-intel-noted-id"));
                    scheduleRender();
                    showActionNotice("Change intelligence alert acknowledged [NOTED].");
                    return;
                }
            });
        }"""

assert old_pgc_handler in code, "old_pgc_handler not found"
code = code.replace(old_pgc_handler, new_pgc_handler)
print("Added data-intel-action listener in persistentGoalsContainer")

with open(dashboard_js_path, "w", encoding="utf-8") as f:
    f.write(code)
print("Phase 2 patch of dashboard.js applied successfully!")

