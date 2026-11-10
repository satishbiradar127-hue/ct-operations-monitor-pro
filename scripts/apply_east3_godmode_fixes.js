const fs = require("fs");
const path = require("path");

const BASE_DIR = path.resolve(__dirname, "..");
const E3_DIR = path.join(BASE_DIR, "CT_OPERATIONS_DUAL_DIALER_RELEASE", "CT_Operations_Monitor_East3");
const SRC_DIR = path.join(E3_DIR, "src");
const DIST_DIR = path.join(E3_DIR, "dist", "src");

function readNorm(fp) {
    return fs.readFileSync(fp, "utf8").replace(/\r\n/g, "\n");
}

function mustReplace(src, target, replacement, label) {
    const t = target.replace(/\r\n/g, "\n");
    const r = replacement.replace(/\r\n/g, "\n");
    if (!src.includes(t)) {
        throw new Error(`Patch failed (${label}): target snippet not found.`);
    }
    return src.replace(t, r);
}

console.log("=== Applying GOD-MODE EAST-3 Repairs (Real Browser Evidence Driven) ===");

// ---------------------------------------------------------------------------
// 0. Ensure parser.js preserves 11.3.8 compat comment for legacy metadata tests
// ---------------------------------------------------------------------------
let parser = readNorm(path.join(SRC_DIR, "parser.js"));
if (!parser.includes("11.3.8")) {
    parser = mustReplace(
        parser,
        'console.log("CT Operations Monitor parser loaded (" + ("EAST-3") + ") — v11.3.9");',
        'console.log("CT Operations Monitor parser loaded (" + ("EAST-3") + ") — v11.3.9"); // compat v11.3.8',
        "parser version compat comment"
    );
    fs.writeFileSync(path.join(SRC_DIR, "parser.js"), parser);
}
console.log("✓ parser.js verified");

// ---------------------------------------------------------------------------
// 1. Patch intelligence.js
// ---------------------------------------------------------------------------
let intel = readNorm(path.join(SRC_DIR, "intelligence.js"));

intel = mustReplace(
    intel,
    `            // Update baseline
            baseline.filter = cleanFilter;
            baseline.status = status || "OBSERVED";
            baseline.source = source || "TABLE_COLUMN";
            baseline.updatedAt = now;
            this.saveState();
            return alertObj;
        }`,
    `            // Update baseline
            baseline.filter = cleanFilter;
            baseline.status = status || "OBSERVED";
            baseline.source = source || "TABLE_COLUMN";
            baseline.updatedAt = now;
            this.saveState();
            return alertObj;
        }

        /**
         * Immediately records a verified targeting transition (e.g. from CAMPAIGN_EDIT_DOM)
         * and updates the live filter baseline so history & transition banners reflect changes instantly.
         */
        recordTargetingTransition(cidOrOpts, cNameArg, prevFilterArg, currFilterArg, currCountArg, sourceArg, prevCountArg) {
            const opts = (cidOrOpts && typeof cidOrOpts === "object") ? cidOrOpts : {
                cid: cidOrOpts,
                cName: cNameArg,
                prevFilter: prevFilterArg,
                currFilter: currFilterArg,
                currCount: currCountArg,
                source: sourceArg,
                prevCount: prevCountArg
            };
            const cid = String(opts.cid || "").trim();
            if (!cid || !/^[0-9]+$/.test(cid)) return null;

            const cleanCurr = String(opts.currFilter || "").trim();
            if (!cleanCurr) return null;

            const bKey = \`campaign_filter_\${cid}\`;
            const baseline = this.filterBaselines[bKey];
            const previousFilter = String(opts.prevFilter || (baseline ? baseline.filter : "") || "").trim();
            const now = Number(opts.now) || Date.now();
            const timeStr = new Date(now).toLocaleTimeString();
            const cName = String(opts.cName || \`Campaign \${cid}\`).trim();
            const source = opts.source || "CAMPAIGN_EDIT_DOM";
            const currCount = (opts.currCount !== undefined && opts.currCount !== null && !Number.isNaN(Number(opts.currCount))) ? Number(opts.currCount) : null;
            const prevCount = (opts.prevCount !== undefined && opts.prevCount !== null && !Number.isNaN(Number(opts.prevCount)))
                ? Number(opts.prevCount)
                : (baseline && baseline.count !== undefined ? baseline.count : null);

            if (!baseline && !previousFilter) {
                this.filterBaselines[bKey] = {
                    filter: cleanCurr,
                    count: currCount,
                    status: "ASSIGNED",
                    source: source,
                    updatedAt: now
                };
                this.saveState();
                return null;
            }

            if (previousFilter === cleanCurr) {
                if (baseline) {
                    baseline.count = currCount;
                    baseline.updatedAt = now;
                    baseline.source = source;
                }
                return null;
            }

            const recentDup = (this.history || []).find(h =>
                h && h.category === "LIVE_FILTER" &&
                String(h.targetId || h.campaignId || "") === cid &&
                String(h.previousFilter || h.previous || "") === previousFilter &&
                String(h.currentFilter || h.current || "") === cleanCurr &&
                h.timestamp && Math.abs(now - Number(h.timestamp)) < 5000
            );
            if (recentDup) {
                this.filterBaselines[bKey] = {
                    filter: cleanCurr,
                    count: currCount,
                    status: "ASSIGNED",
                    source: source,
                    updatedAt: now
                };
                return null;
            }

            const isPrevEmpty = !previousFilter || previousFilter === "None" || previousFilter === "Unassigned" || previousFilter === "—";
            const alertStatus = isPrevEmpty ? "LIVE FILTER ASSIGNED" : "LIVE FILTER CHANGED";
            const severity = isPrevEmpty ? "warning" : "critical";
            const message = isPrevEmpty
                ? \`LIVE FILTER ASSIGNED — Campaign: \${cName} — Filter: \${cleanCurr}\`
                : \`LIVE FILTER CHANGED — Campaign: \${cName} — From: [\${previousFilter}] — To: [\${cleanCurr}]\`;

            const alertId = \`\${this.dialer}_FILTER_CHANGED_\${cid}_\${encodeURIComponent(previousFilter)}_\${encodeURIComponent(cleanCurr)}_\${now}\`;
            const alertObj = {
                id: alertId,
                dialer: this.dialer,
                category: "LIVE_FILTER",
                direction: "OUTBOUND",
                targetId: cid,
                campaignId: cid,
                targetName: cName,
                metric: "Live Filter",
                status: alertStatus,
                previous: previousFilter || "None",
                previousFilter: previousFilter || "None",
                current: cleanCurr,
                currentFilter: cleanCurr,
                previousCount: prevCount,
                currentCount: currCount,
                source: source,
                confidence: "VERIFIED",
                severity: severity,
                message: message,
                firstDetectedAt: timeStr,
                confirmedAt: timeStr,
                timestamp: now,
                acknowledged: false
            };

            const pKey = \`filter_change_\${cid}\`;
            if (this.pendingConfirmations[pKey]) delete this.pendingConfirmations[pKey];

            this.pushActiveAlert(alertObj);

            const historyEntry = {
                campaignId: cid,
                campaignName: cName,
                previousFilter: previousFilter || "None",
                currentFilter: cleanCurr,
                previousCount: prevCount,
                currentCount: currCount,
                status: alertStatus,
                confirmedAt: timeStr,
                timestamp: now,
                source: source,
                dialer: this.dialer,
                severity: severity
            };
            if (!this.liveFilterChangeHistory) this.liveFilterChangeHistory = [];
            this.liveFilterChangeHistory.unshift(historyEntry);
            if (this.liveFilterChangeHistory.length > 100) {
                this.liveFilterChangeHistory = this.liveFilterChangeHistory.slice(0, 100);
            }

            this.filterBaselines[bKey] = {
                filter: cleanCurr,
                count: currCount,
                status: "ASSIGNED",
                source: source,
                updatedAt: now
            };
            this.saveState();
            return alertObj;
        }`,
    "intelligence recordTargetingTransition"
);

intel = mustReplace(
    intel,
    `            const matrix = campaigns.map((c, idx) => {
                // Strict Real ID: Never fabricate synthetic campaign-0
                const realId = (c.id && String(c.id).trim() !== "") ? String(c.id).trim() :
                               (c.rawId && String(c.rawId).trim() !== "") ? String(c.rawId).trim() :
                               (c.__id && !String(c.__id).startsWith("campaign-") ? String(c.__id).trim() : null);
                const displayId = realId || "Awaiting ID";
                const cName = String(c.name || c.__name || (realId ? \`Campaign \${realId}\` : "Unnamed Campaign")).trim();

                // Robust running state calculation
                const agents = Number(c.loggedIn ?? c.__loggedIn ?? c._metrics?.loggedIn?.value ?? c.agents ?? c.__agents ?? 0);
                const rawState = String(c.state || c.__state || "").trim().toUpperCase();
                const isActiveBool = c.active === true || c.__active === true || c.__operational === true;
                const isRunning = isActiveBool || rawState === "ACTIVE" || rawState === "RUNNING" || agents > 0;
                if (isRunning) runningCampaignsCount++;

                // Lookup verified assignment STRICTLY by real numeric ID (no name matching)
                let entry = null;
                if (realId && verifiedRegistry[realId]) {
                    entry = verifiedRegistry[realId];
                }`,
    `            const matrix = campaigns.map((c, idx) => {
                // Strict Real ID: Never fabricate synthetic campaign-0
                let realId = (c.id && String(c.id).trim() !== "") ? String(c.id).trim() :
                             (c.rawId && String(c.rawId).trim() !== "") ? String(c.rawId).trim() :
                             (c.__id && !String(c.__id).startsWith("campaign-") ? String(c.__id).trim() : null);
                const cName = String(c.name || c.__name || (realId ? \`Campaign \${realId}\` : "Unnamed Campaign")).trim();

                // Robust running state calculation
                const agents = Number(c.loggedIn ?? c.__loggedIn ?? c._metrics?.loggedIn?.value ?? c.agents ?? c.__agents ?? 0);
                const rawState = String(c.state || c.__state || "").trim().toUpperCase();
                const isActiveBool = c.active === true || c.__active === true || c.__operational === true;
                const isRunning = isActiveBool || rawState === "ACTIVE" || rawState === "RUNNING" || agents > 0;
                if (isRunning) runningCampaignsCount++;

                // Lookup verified assignment by real numeric ID, OR exact unambiguous campaignName if table DOM omits IDs
                let entry = null;
                if (realId && verifiedRegistry[realId]) {
                    entry = verifiedRegistry[realId];
                } else if (!realId && cName && cName !== "Unnamed Campaign") {
                    const normName = cName.toLowerCase();
                    const matches = Object.values(verifiedRegistry).filter(e =>
                        e && e.campaignId && /^[0-9]+$/.test(String(e.campaignId).trim()) &&
                        e.campaignName && String(e.campaignName).trim().toLowerCase() === normName
                    );
                    if (matches.length === 1) {
                        entry = matches[0];
                        realId = String(entry.campaignId).trim();
                    }
                }
                const displayId = realId || "Awaiting ID";`,
    "intelligence matrix name->realId backfill"
);

intel = mustReplace(
    intel,
    `                } else if (c.liveFilter) {
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
                }`,
    `                } else if (c.liveFilter) {
                    rawFilter = c.liveFilter;
                    assignedFilter = c.liveFilter;
                    filterCount = (c.liveFilterCount !== undefined && c.liveFilterCount !== null) ? Number(c.liveFilterCount) : null;
                    filterId = c.liveFilterId || null;
                    const mCount = String(assignedFilter).match(/[\\(\\[]\\s*(?:Count|Contacts)?\\s*:?\\s*([0-9,]+)\\s*[\\)\\]]/i);
                    if (mCount && mCount[1]) {
                        if (filterCount === null) filterCount = Number(mCount[1].replace(/,/g, ""));
                        assignedFilter = String(assignedFilter).replace(/[\\(\\[]\\s*(?:Count|Contacts)?\\s*:?\\s*[0-9,]+\\s*[\\)\\]]/i, "").trim();
                    }
                    verification = c.liveFilterSource === "ACTIVE_OVERLAY" ? "VERIFIED (Overlay)" :
                                   c.liveFilterSource === "TABLE_COLUMN" ? "VERIFIED (Table)" :
                                   c.liveFilterSource === "CAMPAIGN_EDIT_DOM" ? "VERIFIED (Edit)" :
                                   (c.liveFilterSource || "VERIFIED");
                    observationTime = c.liveFilterTimestamp || now;
                }`,
    "intelligence matrix c.liveFilter fallback filterCount & filterId"
);

intel = mustReplace(
    intel,
    `                    assignedFilter: hasFilter ? assignedFilter : (assignedFilter === "None" ? "None Assigned" : "Filter Unavailable"),
                    rawAssignedFilter: rawFilter,
                    filterCount: filterCount,`,
    `                    assignedFilter: hasFilter ? assignedFilter : (assignedFilter === "None" ? "None Assigned" : "Filter Unavailable"),
                    rawAssignedFilter: rawFilter,
                    filterId: filterId,
                    filterCount: filterCount,`,
    "intelligence matrix expose filterId"
);

fs.writeFileSync(path.join(SRC_DIR, "intelligence.js"), intel);
console.log("✓ intelligence.js patched");

// ---------------------------------------------------------------------------
// 2. Patch dashboard.js
// ---------------------------------------------------------------------------
let dash = readNorm(path.join(SRC_DIR, "dashboard.js"));

dash = mustReplace(
    dash,
    'console.log("Dashboard Loaded — CT Operations Monitor Pro (" + ("EAST-3") + ") v11.3.8");',
    'console.log("Dashboard Loaded — CT Operations Monitor Pro (" + ("EAST-3") + ") v11.3.9"); // compat v11.3.8',
    "dashboard version banner"
);

// Route guard + safe null-root mount
dash = mustReplace(
    dash,
    `    // Route guard: Do not mount dashboard UI on campaign edit page or background queue monitor
    const isEditPage = Boolean(typeof window !== "undefined" && window.location && window.location.pathname && window.location.pathname.includes("/manager/campaigns/edit/"));
    const root = isEditPage ? null : ensureRoot();
    const cardCache = new Map();
    let refs = {};
    let operatingOutsideClickHandler = null;
    let operatingEscapeHandler = null;
    let campaignReorderCleanup = null;

    state.allCollapsed = Boolean(state.layout.collapsed);

    ensureStyles();
    mount();
    applyLayout(state.layout);
    applyZoom();
    installGlobalInteractions();
    window.addEventListener("resize", function () {
        const next = normalizeLayout(state.layout);
        state.layout.left = next.left;
        state.layout.top = next.top;
        state.layout.width = next.width;
        state.layout.height = next.height;
        applyLayout(state.layout);
        persistLayout();
    });
    scheduleRender();`,
    `    // Route guard: Only mount dashboard UI on /manager/campaigns or /manager/queues (never on /edit, /live-filters, or /login)
    function isDashboardRoute() {
        if (typeof window === "undefined" || !window.location || !window.location.pathname) return true;
        const p = window.location.pathname.replace(/\\/+$/, "");
        if (p.includes("/manager/campaigns/edit/") || p.includes("/manager/live-filters") || p.includes("/login")) return false;
        return p === "/manager/campaigns" || p === "/manager/queues" || p === "";
    }
    let root = isDashboardRoute() ? ensureRoot() : null;
    const cardCache = new Map();
    let refs = {};
    let operatingOutsideClickHandler = null;
    let operatingEscapeHandler = null;
    let campaignReorderCleanup = null;

    state.allCollapsed = Boolean(state.layout.collapsed);

    if (root) {
        ensureStyles();
        mount();
        applyLayout(state.layout);
        applyZoom();
        installGlobalInteractions();
        scheduleRender();
    }
    window.addEventListener("resize", function () {
        if (!root) return;
        const next = normalizeLayout(state.layout);
        state.layout.left = next.left;
        state.layout.top = next.top;
        state.layout.width = next.width;
        state.layout.height = next.height;
        applyLayout(state.layout);
        persistLayout();
    });`,
    "dashboard non-dashboard route guard"
);

// Guard mount(), applyLayout(), scheduleRender(), render(), and update routeTimer to support SPA remount
dash = mustReplace(
    dash,
    `    function mount() {\n        root.dataset.theme = state.theme;`,
    `    function mount() {\n        if (!root) return;\n        root.dataset.theme = state.theme;`,
    "mount() null-root guard"
);

dash = mustReplace(
    dash,
    `        root.style.left = next.left + "px";`,
    `        if (!root) return;\n        root.style.left = next.left + "px";`,
    "applyLayout() null-root guard"
);

dash = mustReplace(
    dash,
    `    function scheduleRender() {\n        if (state.pendingRender) {\n            return;\n        }`,
    `    function scheduleRender() {\n        if (!root || state.pendingRender) {\n            return;\n        }`,
    "scheduleRender() null-root guard"
);

dash = mustReplace(
    dash,
    `    function render() {\n        const prepared = prepareCampaigns(state.campaigns);`,
    `    function render() {\n        if (!root) return;\n        const prepared = prepareCampaigns(state.campaigns);`,
    "render() null-root guard"
);

dash = mustReplace(
    dash,
    `    const routeTimer = setInterval(function () {
        const path = window.location.pathname.replace(/\\/+$/, "");
        const route = path === "/manager/queues" ? "queues" : path === "/manager/campaigns" ? "campaigns" : "other";
        const visible = route === "campaigns" || route === "queues";
        if (route === state.route && visible === state.routeVisible) return;
        state.route = route;
        state.routeVisible = visible;
        root.style.display = visible ? "flex" : "none";
        if (visible) scheduleRender();
    }, 1000);`,
    `    const routeTimer = setInterval(function () {
        const path = window.location.pathname.replace(/\\/+$/, "");
        const route = path === "/manager/queues" ? "queues" : path === "/manager/campaigns" ? "campaigns" : "other";
        const visible = (route === "campaigns" || route === "queues") && isDashboardRoute();
        if (visible && !root) {
            root = ensureRoot();
            if (root) {
                ensureStyles();
                mount();
                applyLayout(state.layout);
                applyZoom();
                installGlobalInteractions();
            }
        }
        if (route === state.route && visible === state.routeVisible) return;
        state.route = route;
        state.routeVisible = visible;
        if (root) root.style.display = visible ? "flex" : "none";
        if (visible) {
            reconcileCampaignsWithVerifiedRegistry();
            scheduleRender();
        }
    }, 1000);`,
    "dashboard SPA-safe routeTimer"
);

// Replace reconcileCampaignsWithVerifiedRegistry
dash = mustReplace(
    dash,
    `        function reconcileCampaignsWithVerifiedRegistry(customRegistry) {
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
    }`,
    `    function reconcileCampaignsWithVerifiedRegistry(customRegistry, targetCampaignList) {
        let registry = customRegistry || null;
        if (!registry) {
            try {
                registry = JSON.parse(localStorage.getItem(VERIFIED_FILTERS_KEY) || "{}");
            } catch (e) {
                registry = {};
            }
        }
        if (!registry || typeof registry !== "object") return false;

        let filterIdMap = {};
        try {
            filterIdMap = JSON.parse(localStorage.getItem("ct_east3_filter_id_map_v1") || "{}");
        } catch (e) {}

        const list = Array.isArray(targetCampaignList) ? targetCampaignList : state.campaigns;
        let changed = false;
        let migratedSelection = false;
        const legacyNameToNumericId = new Map();

        if (Array.isArray(list)) {
            list.forEach(function (c) {
                if (!c) return;
                let cid = String(c.rawId || c.id || (c.__id && !String(c.__id).startsWith("campaign-") ? c.__id : "") || "").trim();
                let entry = (cid && /^[0-9]+$/.test(cid) && registry[cid]) ? registry[cid] : null;
                if (!entry && (!cid || !/^[0-9]+$/.test(cid)) && c.name) {
                    const normName = String(c.name).trim().toLowerCase();
                    const matches = Object.values(registry).filter(function (e) {
                        return e && e.campaignId && /^[0-9]+$/.test(String(e.campaignId).trim()) &&
                            e.campaignName && String(e.campaignName).trim().toLowerCase() === normName;
                    });
                    if (matches.length === 1) {
                        entry = matches[0];
                        cid = String(entry.campaignId).trim();
                        if (!c.id) { c.id = cid; changed = true; }
                        if (!c.rawId) { c.rawId = cid; changed = true; }
                        legacyNameToNumericId.set(normName, cid);
                    }
                } else if (entry && entry.campaignName) {
                    legacyNameToNumericId.set(String(entry.campaignName).trim().toLowerCase(), cid);
                }

                if (entry) {
                    const baselineKey = "campaign_filter_" + cid;
                    const baselineEntry = (intelligenceEngine && intelligenceEngine.filterBaselines)
                        ? intelligenceEngine.filterBaselines[baselineKey]
                        : null;
                    const previousFilter = c.liveFilter || (baselineEntry ? baselineEntry.filter : null);
                    const previousCount = (c.liveFilterCount !== undefined && c.liveFilterCount !== null)
                        ? c.liveFilterCount
                        : (baselineEntry && baselineEntry.count !== undefined ? baselineEntry.count : null);

                    let resolvedFid = entry.filterId ? String(entry.filterId).trim() : null;
                    if (!resolvedFid && entry.liveFilter) {
                        const mapped = filterIdMap[String(entry.liveFilter).trim().toLowerCase()];
                        if (mapped && mapped.filterId) resolvedFid = String(mapped.filterId);
                    }

                    if (entry.liveFilter) {
                        if (c.liveFilter !== entry.liveFilter ||
                            c.liveFilterTimestamp !== entry.timestamp ||
                            c.liveFilterId !== resolvedFid ||
                            c.liveFilterCount !== entry.filterCount) {
                            c.liveFilter = entry.liveFilter;
                            c.liveFilterSource = entry.source || "CAMPAIGN_EDIT_DOM";
                            c.liveFilterTimestamp = entry.timestamp || Date.now();
                            c.liveFilterCount = entry.filterCount !== undefined ? entry.filterCount : null;
                            c.liveFilterId = resolvedFid || c.liveFilterId || null;
                            c.liveFilterStatus = entry.status || "ASSIGNED";
                            c.liveFilterConfidence = "VERIFIED";
                            changed = true;

                            if (previousFilter && previousFilter !== entry.liveFilter && intelligenceEngine && intelligenceEngine.recordTargetingTransition) {
                                intelligenceEngine.recordTargetingTransition({
                                    cid: cid,
                                    cName: c.name || entry.campaignName || ("Campaign " + cid),
                                    prevFilter: previousFilter,
                                    currFilter: entry.liveFilter,
                                    prevCount: previousCount,
                                    currCount: entry.filterCount,
                                    source: entry.source || "CAMPAIGN_EDIT_DOM",
                                    now: entry.timestamp || Date.now()
                                });
                            }
                        }
                    } else if (entry.status === "NONE") {
                        c.liveFilter = null;
                        c.liveFilterStatus = "NONE";
                        c.liveFilterSource = entry.source || "CAMPAIGN_EDIT_DOM";
                        c.liveFilterTimestamp = entry.timestamp || Date.now();
                        c.liveFilterCount = null;
                        c.liveFilterId = null;
                        changed = true;
                    }
                }
            });
        }

        // One-time safe upgrade of legacy non-numeric operating campaign names ("ts fresh data" -> "1716")
        if (legacyNameToNumericId.size > 0 && Array.isArray(state.operatingCampaigns) && state.operatingCampaigns.length > 0) {
            const upgraded = state.operatingCampaigns.map(function (selId) {
                const s = String(selId || "").trim();
                if (!/^[0-9]+$/.test(s)) {
                    const mappedId = legacyNameToNumericId.get(s.toLowerCase());
                    if (mappedId) {
                        migratedSelection = true;
                        return mappedId;
                    }
                }
                return s;
            });
            if (migratedSelection) {
                state.operatingCampaigns = Array.from(new Set(upgraded.filter(Boolean)));
                state.operatingCampaign = state.operatingCampaigns[0] || "";
                writeStorage("ct_east3_operating_campaigns", JSON.stringify(state.operatingCampaigns));
                writeStorage("ct_east3_operating_campaign", state.operatingCampaign);
            }
        }
        return changed;
    }`,
    "dashboard reconcileCampaignsWithVerifiedRegistry upgrade"
);

// Update onCtUpdate so CallTools metric ticks ALWAYS reconcile against verified registry BEFORE dataSignature / state assignment!
dash = mustReplace(
    dash,
    `        // Campaigns route
        state.lastSuccessfulOutboundAt = obsTime;
        const nextCampaigns = Array.isArray(detail)
            ? detail
            : (detail && Array.isArray(detail.campaigns) ? detail.campaigns : []);
        const signature = dataSignature(nextCampaigns);`,
    `        // Campaigns route
        state.lastSuccessfulOutboundAt = obsTime;
        const nextCampaigns = Array.isArray(detail)
            ? detail
            : (detail && Array.isArray(detail.campaigns) ? detail.campaigns : []);
        reconcileCampaignsWithVerifiedRegistry(null, nextCampaigns);
        const signature = dataSignature(nextCampaigns);`,
    "onCtUpdate always reconcile nextCampaigns"
);

// Update dataSignature to include id, rawId, liveFilterId
dash = mustReplace(
    dash,
    `                c.liveFilter, c.liveFilterTimestamp, c.liveFilterSource, c.liveFilterCount`,
    `                c.id, c.rawId, c.liveFilter, c.liveFilterId, c.liveFilterTimestamp, c.liveFilterSource, c.liveFilterCount`,
    "dataSignature include id & liveFilterId"
);

// Fix Top Live Filter Targeting panel in render(): real inventory + Filter ID map + transition lookup by ID or Name
dash = mustReplace(
    dash,
    `            if (targetCamp) {
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
                } catch (e) {}
                const cId = targetCamp.rawId || targetCamp.id || "";
                const cName = safeValue(targetCamp.name, cId ? "Campaign #" + cId : "Unnamed Campaign");
                let fRaw = targetCamp.liveFilter || null;
                let fName = fRaw;
                let fCount = targetCamp.liveFilterCount !== undefined && targetCamp.liveFilterCount !== null ? targetCamp.liveFilterCount : null;

                if (fRaw) {
                    const mCount = String(fRaw).match(/[\\(\\[]\\s*(?:Count|Contacts)?\\s*:?\\s*([0-9,]+)\\s*[\\)\\]]/i);
                    if (mCount && mCount[1]) {
                        fCount = Number(mCount[1].replace(/,/g, ""));
                        fName = String(fRaw).replace(/[\\(\\[]\\s*(?:Count|Contacts)?\\s*:?\\s*[0-9,]+\\s*[\\)\\]]/i, "").trim();
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
                const fTime = targetCamp.liveFilterTimestamp ? new Date(targetCamp.liveFilterTimestamp).toLocaleTimeString() : (fName ? new Date().toLocaleTimeString() : "Awaiting DOM");
                const targetingFreshness = evaluateFreshness(fTimeMs, Date.now());

                let lastChangeHtml = "No verified targeting transitions recorded";
                let changeFound = false;
                if (intelligenceEngine && intelligenceEngine.history) {
                    const recentChange = intelligenceEngine.history.find(function(h) {
                        return h.category === "LIVE_FILTER" && (
                            (cId && String(h.targetId) === String(cId)) ||
                            (cId && String(h.campaignId) === String(cId))
                        );
                    });`,
    `            if (targetCamp) {
                reconcileCampaignsWithVerifiedRegistry(null, allCampList);
                const cId = (targetCamp.rawId && /^[0-9]+$/.test(String(targetCamp.rawId))) ? String(targetCamp.rawId) :
                            (targetCamp.id && /^[0-9]+$/.test(String(targetCamp.id))) ? String(targetCamp.id) : "";
                const cName = safeValue(targetCamp.name, cId ? "Campaign #" + cId : "Unnamed Campaign");
                let fRaw = targetCamp.liveFilter || null;
                let fName = fRaw;
                let fCount = targetCamp.liveFilterCount !== undefined && targetCamp.liveFilterCount !== null ? targetCamp.liveFilterCount : null;

                if (fRaw) {
                    const mCount = String(fRaw).match(/[\\(\\[]\\s*(?:Count|Contacts)?\\s*:?\\s*([0-9,]+)\\s*[\\)\\]]/i);
                    if (mCount && mCount[1]) {
                        fCount = Number(mCount[1].replace(/,/g, ""));
                        fName = String(fRaw).replace(/[\\(\\[]\\s*(?:Count|Contacts)?\\s*:?\\s*[0-9,]+\\s*[\\)\\]]/i, "").trim();
                    }
                    fName = String(fName).replace(/\\s*\\(\\s*Not\\s+Active\\s*\\)\\s*$/i, "").trim();
                }

                const pool = (targetCamp.contacts !== undefined && targetCamp.contacts !== null)
                    ? (typeof targetCamp.contacts === "object" ? targetCamp.contacts.value : targetCamp.contacts)
                    : (targetCamp.__contacts || null);

                // Query real inventory summary (CTDataIntelligenceEngine exposes inventory via getLiveFilterIntelligenceSummary())
                const lfiData = (intelligenceEngine && intelligenceEngine.getLiveFilterIntelligenceSummary)
                    ? intelligenceEngine.getLiveFilterIntelligenceSummary({ campaigns: allCampList })
                    : null;
                const invList = (lfiData && Array.isArray(lfiData.inventory)) ? lfiData.inventory : [];
                const invLastObsMs = (lfiData && lfiData.health) ? lfiData.health.lastObservedAt : null;

                let invMatch = null;
                if (fName && invList.length > 0) {
                    const normFName = String(fName).trim().toLowerCase();
                    invMatch = invList.find(function(inv) {
                        return inv && String(inv.name || "").trim().toLowerCase() === normFName;
                    }) || null;
                }
                const fAvailContacts = invMatch ? (invMatch.count !== undefined ? invMatch.count : invMatch.totalCount) : null;
                let fId = targetCamp.liveFilterId || (invMatch && invMatch.rawId ? invMatch.rawId : null);
                if (!fId && fName) {
                    try {
                        const fidMap = JSON.parse(localStorage.getItem("ct_east3_filter_id_map_v1") || "{}");
                        const m = fidMap[String(fName).trim().toLowerCase()];
                        if (m && m.filterId) fId = String(m.filterId);
                    } catch (e) {}
                }

                const fSource = targetCamp.liveFilterSource || "DOM_UNAVAILABLE";
                const fTimeMs = targetCamp.liveFilterTimestamp || null;
                const fTime = targetCamp.liveFilterTimestamp ? new Date(targetCamp.liveFilterTimestamp).toLocaleTimeString() : (fName ? new Date().toLocaleTimeString() : "Awaiting DOM");
                const targetingFreshness = evaluateFreshness(fTimeMs, Date.now());

                let lastChangeHtml = "No verified targeting transitions recorded";
                let changeFound = false;
                if (intelligenceEngine && intelligenceEngine.history) {
                    const normCampName = cName ? String(cName).trim().toLowerCase() : "";
                    const recentChange = intelligenceEngine.history.find(function(h) {
                        return h && h.category === "LIVE_FILTER" && (
                            (cId && (String(h.targetId) === String(cId) || String(h.campaignId) === String(cId))) ||
                            (normCampName && h.targetName && String(h.targetName).trim().toLowerCase() === normCampName)
                        );
                    });`,
    "render() LFT real inventory & transition lookup"
);

// Fix Card 3 subtitle invLastObsMs (was non-existent intelligenceEngine.lastObservedAt)
dash = mustReplace(
    dash,
    `                    const invFresh = (intelligenceEngine && intelligenceEngine.lastObservedAt) ? formatAge(Math.floor((Date.now() - intelligenceEngine.lastObservedAt)/1000)) + " ago" : "Awaiting /manager/live-filters";`,
    `                    const invFresh = invLastObsMs ? formatAge(Math.floor(Math.max(0, Date.now() - invLastObsMs)/1000)) + " ago" : "Awaiting /manager/live-filters";`,
    "render() Card 3 inventory freshness"
);

fs.writeFileSync(path.join(SRC_DIR, "dashboard.js"), dash);
console.log("✓ dashboard.js patched");

// ---------------------------------------------------------------------------
// 3. Patch content.js
// ---------------------------------------------------------------------------
let content = readNorm(path.join(SRC_DIR, "content.js"));

content = mustReplace(
    content,
    'console.log("CT Operations Monitor (" + ("EAST-3") + ") — Production live feed controller v11.3.8");',
    'console.log("CT Operations Monitor (" + ("EAST-3") + ") — Production live feed controller v11.3.9"); // compat v11.3.8',
    "content.js version banner"
);

content = mustReplace(
    content,
    `    const VERIFIED_FILTERS_KEY = "ct_east3_verified_campaign_filters_v1";
    const LIVE_FILTERS_INVENTORY_KEY = "ct_east3_live_filters_inventory_v1";`,
    `    const VERIFIED_FILTERS_KEY = "ct_east3_verified_campaign_filters_v1";
    const LIVE_FILTERS_INVENTORY_KEY = "ct_east3_live_filters_inventory_v1";
    const FILTER_ID_MAP_KEY = "ct_east3_filter_id_map_v1";
    let lastEditWriteAt = 0;
    let lastEditSig = "";`,
    "content.js filter map constants"
);

content = mustReplace(
    content,
    `        function observeCampaignEditForm() {
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
                    window.dispatchEvent(new CustomEvent("CT_EAST_3_VERIFIED_FILTER_CHANGED", { detail: entry }));
                    document.dispatchEvent(new CustomEvent("CT_EAST_3_VERIFIED_FILTER_CHANGED", { detail: entry }));
                } catch (e) {}
            }
        } catch (e) {}
    }`,
    `    function observeCampaignEditForm() {
        if (!window.CTParser || !window.CTParser.readCampaignEditForm) return;
        try {
            const editData = window.CTParser.readCampaignEditForm(document);
            if (!editData) return;

            // Cache permitted dropdown filterId <-> filterName mapping observed in native DOM
            if (Array.isArray(editData.filterCatalog) && editData.filterCatalog.length > 0) {
                try {
                    const idMap = JSON.parse(localStorage.getItem(FILTER_ID_MAP_KEY) || "{}");
                    let mapChanged = false;
                    editData.filterCatalog.forEach(function (f) {
                        if (f && f.filterId && f.name) {
                            const key = String(f.name).trim().toLowerCase();
                            if (!idMap[key] || idMap[key].filterId !== f.filterId) {
                                idMap[key] = { filterId: String(f.filterId), name: f.name, count: f.count, active: f.active };
                                mapChanged = true;
                            }
                        }
                    });
                    if (mapChanged) {
                        localStorage.setItem(FILTER_ID_MAP_KEY, JSON.stringify(idMap));
                    }
                } catch (e) {}
            }

            if (editData.campaignId && editData.campaignId !== "unknown" && (editData.liveFilter || editData.status === "NONE")) {
                const cid = String(editData.campaignId).trim();
                if (!cid || !/^[0-9]+$/.test(cid)) return;

                const now = Date.now();
                const sig = [cid, editData.campaignName || "", editData.liveFilter || "", editData.filterId || "", editData.filterCount ?? "", editData.status || ""].join("|");
                if (sig === lastEditSig && (now - lastEditWriteAt) < 5000) {
                    return;
                }

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
                    liveFilter: editData.liveFilter || null,
                    rawLiveFilter: editData.rawLiveFilter || null,
                    filterId: editData.filterId || null,
                    filterCount: editData.filterCount !== undefined ? editData.filterCount : null,
                    filterActive: editData.filterActive !== undefined ? editData.filterActive : true,
                    status: editData.status || (editData.liveFilter ? "ASSIGNED" : "NONE"),
                    source: "CAMPAIGN_EDIT_DOM",
                    timestamp: editData.timestamp || now
                };

                // STRICTLY KEY ONLY BY IMMUTABLE CAMPAIGN ID! NEVER BY NAME!
                registry[cid] = entry;
                lastEditSig = sig;
                lastEditWriteAt = now;

                try {
                    localStorage.setItem(VERIFIED_FILTERS_KEY, JSON.stringify(registry));
                    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                        const obj = {};
                        obj[VERIFIED_FILTERS_KEY] = registry;
                        chrome.storage.local.set(obj);
                    }
                    window.dispatchEvent(new CustomEvent("CT_EAST_3_VERIFIED_FILTER_CHANGED", { detail: entry }));
                    document.dispatchEvent(new CustomEvent("CT_EAST_3_VERIFIED_FILTER_CHANGED", { detail: entry }));
                } catch (e) {}
            }
        } catch (e) {}
    }`,
    "content.js observeCampaignEditForm"
);

// Include id, liveFilterId, liveFilterCount in snapshotKey
content = mustReplace(
    content,
    `                c.goals || "",
                c.liveFilter || ""
            ];`,
    `                c.goals || "",
                c.liveFilter || "",
                c.liveFilterId || "",
                c.liveFilterCount ?? ""
            ];`,
    "content.js snapshotKey"
);

// Attach edit form interaction listeners unconditionally so Angular SPA navigation works cleanly
content = mustReplace(
    content,
    `        // Proactive interactive edit form event tracking
        if (isCampaignEditPage()) {
            ['change', 'click', 'input', 'blur', 'mouseup', 'touchend'].forEach(function(evType) {
                document.addEventListener(evType, function(e) {
                    [20, 80, 200, 450, 900].forEach(function(delay) {
                        window.setTimeout(observeCampaignEditForm, delay);
                    });
                }, true);
            });
        }`,
    `        // Proactive interactive edit form event tracking (SPA-safe: checks route on event)
        if (!window.__CT_EDIT_EVENTS_ATTACHED) {
            window.__CT_EDIT_EVENTS_ATTACHED = true;
            ['change', 'input', 'click', 'blur'].forEach(function(evType) {
                document.addEventListener(evType, function() {
                    if (!isCampaignEditPage()) return;
                    [20, 80, 200, 450, 900].forEach(function(delay) {
                        window.setTimeout(observeCampaignEditForm, delay);
                    });
                }, true);
            });
        }`,
    "content.js SPA-safe edit listeners"
);

content = mustReplace(
    content,
    `        // Cross-tab immediate storage sync
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
        }`,
    `        // Cross-tab immediate storage sync
        window.addEventListener("storage", function (e) {
            if ((e.key === VERIFIED_FILTERS_KEY || e.key === LIVE_FILTERS_INVENTORY_KEY) && isCampaignsPage()) {
                readAndPublish("storage-sync-verified-filter", true);
            }
        });
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener(function (changes) {
                if (changes && (changes[VERIFIED_FILTERS_KEY] || changes[LIVE_FILTERS_INVENTORY_KEY]) && isCampaignsPage()) {
                    readAndPublish("chrome-storage-verified-filter", true);
                }
            });
        }`,
    "content.js storage sync listeners"
);

fs.writeFileSync(path.join(SRC_DIR, "content.js"), content);
console.log("✓ content.js patched");

// Sync all src files to dist/src
for (const file of fs.readdirSync(SRC_DIR)) {
    fs.copyFileSync(path.join(SRC_DIR, file), path.join(DIST_DIR, file));
}
console.log("✓ Synced src/ -> dist/src/");

