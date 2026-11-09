import os, re

def update_parser(file_path, dialer_prefix):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Add recovered ID from verified registry if not present directly in table DOM
    old_snippet = """                    if (entry) {
                        const entryAge = entry.timestamp ? (Date.now() - entry.timestamp) : 0;
                        const isStale = entryAge > (7 * 24 * 60 * 60 * 1000);
                        if (!isStale) {
                            const fVal = entry.liveFilter || entry.filter;
                            if (fVal) {
                                rawLiveFilter = fVal;
                                filterSource = entry.source || "VERIFIED_REGISTRY";
                                verifiedTimestamp = entry.timestamp || null;
                            }
                        }
                    }"""

    new_snippet = """                    if (entry) {
                        if (!id && entry.campaignId && /^[0-9]+$/.test(String(entry.campaignId).trim())) {
                            id = String(entry.campaignId).trim();
                        }
                        const entryAge = entry.timestamp ? (Date.now() - entry.timestamp) : 0;
                        const isStale = entryAge > (7 * 24 * 60 * 60 * 1000);
                        if (!isStale) {
                            const fVal = entry.liveFilter || entry.filter;
                            if (fVal) {
                                rawLiveFilter = fVal;
                                filterSource = entry.source || "VERIFIED_REGISTRY";
                                verifiedTimestamp = entry.timestamp || null;
                            }
                        }
                    }"""

    if old_snippet in content:
        content = content.replace(old_snippet, new_snippet)
        print(f"Updated parser ID recovery in {file_path}")
    else:
        print(f"Target snippet not found in {file_path}")

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

def update_intelligence(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Add leadListDetails to return of getLiveFilterIntelligenceSummary
    old_ret = """                health: {
                    dialer: this.dialer,
                    inventoryFreshness,
                    lastObservedAt: inventory.lastObservedAt || null,
                    staleCount,
                    missingVerificationCount,
                    hasInventory: hasInventory,
                    inventoryStatus: hasInventory ? "OBSERVED" : "AWAITING_OBSERVATION",
                    missingPages: hasInventory ? [] : ["/manager/live-filters"]
                }
            };"""

    new_ret = """                leadListDetails: matrix.map(m => ({
                    campaignName: m.campaignName,
                    campaignId: m.campaignId,
                    leadList: m.leadList !== "UNAVAILABLE" ? m.leadList : "Not exposed by available source",
                    contactPool: m.leads,
                    nativeRefillStatus: "Native refill time: Not available from permitted source",
                    observationTime: m.lastObserved
                })),
                health: {
                    dialer: this.dialer,
                    inventoryFreshness,
                    lastObservedAt: inventory.lastObservedAt || null,
                    staleCount,
                    missingVerificationCount,
                    hasInventory: hasInventory,
                    inventoryStatus: hasInventory ? "OBSERVED" : "AWAITING_OBSERVATION",
                    missingPages: hasInventory ? [] : ["/manager/live-filters"]
                }
            };"""

    if old_ret in content:
        content = content.replace(old_ret, new_ret)
        print(f"Added leadListDetails to {file_path}")
    else:
        print(f"Target old_ret not found in {file_path}")

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

def update_dashboard(file_path, dialer_edition, dialer_prefix, update_event, refresh_result_event):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Add state.isRefreshing and state.lastRefreshedAt
    target_state = "state = {\n        allCollapsed: false,"
    repl_state = f"state = {{\n        isRefreshing: false,\n        lastRefreshedAt: null,\n        allCollapsed: false,"
    if target_state in content and "isRefreshing:" not in content:
        content = content.replace(target_state, repl_state, 1)
        print(f"Added isRefreshing to state in {file_path}")

    # 2. Wire REFRESH_RESULT_EVENT listener
    target_event_bind = 'document.addEventListener("keydown", operatingEscapeHandler);'
    repl_event_bind = f"""document.addEventListener("keydown", operatingEscapeHandler);

        document.addEventListener(REFRESH_RESULT_EVENT, function (event) {{
            state.isRefreshing = false;
            if (refs.refresh) {{
                refs.refresh.classList.remove("is-refreshing");
                refs.refresh.textContent = "↻ Refresh Data";
            }}
            if (refs.headerRefresh) {{
                refs.headerRefresh.classList.remove("is-refreshing");
            }}
            const detail = event.detail || {{}};
            if (intelligenceEngine && intelligenceEngine.recordRefreshResult) {{
                intelligenceEngine.recordRefreshResult(detail);
            }}
            state.lastRefreshedAt = detail.completedAt || Date.now();
            const recordsText = detail.recordsRead !== undefined ? detail.recordsRead + " records" : "data";
            let noticeMsg = "Refreshed " + recordsText + " from " + (detail.source || "CallTools");
            if (detail.unavailableSources && detail.unavailableSources.length > 0) {{
                noticeMsg += " (Unavailable: " + detail.unavailableSources.join(", ") + ")";
            }}
            showActionNotice(noticeMsg);
            updateConnectionState(Date.now());
            scheduleRender();
        }});"""

    if target_event_bind in content and "document.addEventListener(REFRESH_RESULT_EVENT" not in content:
        content = content.replace(target_event_bind, repl_event_bind, 1)
        print(f"Added REFRESH_RESULT_EVENT listener in {file_path}")

    # 3. Enhance requestRefresh with in-flight lock and button state
    old_req = """        const requestRefresh = function () {
            document.dispatchEvent(new CustomEvent(REQUEST_REFRESH_EVENT));
        };"""

    new_req = """        const requestRefresh = function () {
            if (state.isRefreshing) return;
            state.isRefreshing = true;
            if (refs.refresh) {
                refs.refresh.classList.add("is-refreshing");
                refs.refresh.textContent = "↻ Refreshing…";
            }
            if (refs.headerRefresh) {
                refs.headerRefresh.classList.add("is-refreshing");
            }
            document.dispatchEvent(new CustomEvent(REQUEST_REFRESH_EVENT));
            setTimeout(function () {
                if (state.isRefreshing) {
                    state.isRefreshing = false;
                    if (refs.refresh) {
                        refs.refresh.classList.remove("is-refreshing");
                        refs.refresh.textContent = "↻ Refresh Data";
                    }
                    if (refs.headerRefresh) {
                        refs.headerRefresh.classList.remove("is-refreshing");
                    }
                }
            }, 5000);
        };"""

    if old_req in content:
        content = content.replace(old_req, new_req, 1)
        print(f"Enhanced requestRefresh with in-flight lock in {file_path}")

    # 4. Enhance updateConnectionState to show LIVE OBSERVED
    old_live_badge = """        } else if (globalState === "LIVE") {
            badgeText = state.isMonitoringRefreshing ? "UPDATING" : "LIVE";
            badgeTone = state.isMonitoringRefreshing ? "is-warning" : "is-good";"""

    new_live_badge = """        } else if (globalState === "LIVE") {
            badgeText = state.isMonitoringRefreshing ? "UPDATING" : "LIVE OBSERVED";
            badgeTone = state.isMonitoringRefreshing ? "is-warning" : "is-good";"""

    if old_live_badge in content:
        content = content.replace(old_live_badge, new_live_badge, 1)
        print(f"Updated live badge to LIVE OBSERVED in {file_path}")

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

print("Running updates on East-2...")
update_parser("CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/parser.js", "ct_east2_")
update_intelligence("CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/intelligence.js")
update_dashboard("CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/dashboard.js", "EAST-2", "ct_east2_", "CT_EAST_2_UPDATE", "CT_EAST_2_REFRESH_RESULT")

print("Running updates on East-3...")
update_parser("CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3/src/parser.js", "ct_east3_")
update_intelligence("CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3/src/intelligence.js")
update_dashboard("CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3/src/dashboard.js", "EAST-3", "ct_east3_", "CT_EAST_3_UPDATE", "CT_EAST_3_REFRESH_RESULT")

print("Completed code updates.")

