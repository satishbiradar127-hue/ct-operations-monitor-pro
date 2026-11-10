// Passive read-only Angular row ID & name bridge for CallTools Operations Monitor (EAST-2)
// Executes in MV3 MAIN world ONLY on top-level /manager/campaigns to mirror rendered row IDs onto DOM attributes.
// Strictly 0 network calls, 0 clicks, 0 mutations to CallTools application state.
(function () {
    "use strict";

    if (window !== window.top) return;
    if (window.location.hostname !== "east-2.calltools.io") return;
    if (window.__CT_NG_BRIDGE_EAST2__) return;
    window.__CT_NG_BRIDGE_EAST2__ = true;

    let lastIndexSig = "";

    function extractCampaignObjFromRow(row) {
        if (!row) return null;
        const ctx = row.__ngContext__;
        if (!Array.isArray(ctx)) return null;
        for (let i = 0; i < ctx.length; i++) {
            const v = ctx[i];
            if (!v || typeof v !== "object" || v.nodeType) continue;
            const cand = (typeof v.id === "number" && typeof v.name === "string")
                ? v
                : (v.$implicit && typeof v.$implicit === "object" && typeof v.$implicit.id === "number" && typeof v.$implicit.name === "string" ? v.$implicit : null);
            if (cand && Number.isFinite(cand.id) && cand.id > 0 && String(cand.name || "").trim()) {
                return {
                    id: String(cand.id),
                    name: String(cand.name).trim(),
                    active: cand.active === true,
                    dialer: "EAST-2"
                };
            }
        }
        return null;
    }

    function syncCampaignRowIds() {
        if (window.location.hostname !== "east-2.calltools.io") return;
        const path = (window.location.pathname || "").replace(/\/+$/, "");
        if (path !== "/manager/campaigns") return;

        const dash = document.getElementById("ct-operations-dashboard-east2");
        const rows = Array.from(document.querySelectorAll("table tr.mat-row, table tr.mat-mdc-row, table tbody tr"))
            .filter(function (r) { return !dash || !dash.contains(r); });

        const indexList = [];
        const seenIds = new Set();

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const obj = extractCampaignObjFromRow(row);
            if (!obj) continue;
            if (row.getAttribute("data-ct-east2-campaign-id") !== obj.id) {
                row.setAttribute("data-ct-east2-campaign-id", obj.id);
            }
            if (row.getAttribute("data-ct-east2-campaign-name") !== obj.name) {
                row.setAttribute("data-ct-east2-campaign-name", obj.name);
            }
            if (!seenIds.has(obj.id)) {
                seenIds.add(obj.id);
                indexList.push(obj);
            }
        }

        if (indexList.length > 0) {
            const sig = JSON.stringify(indexList);
            if (sig !== lastIndexSig) {
                lastIndexSig = sig;
                document.documentElement.setAttribute("data-ct-east2-campaign-index", sig);
            }
        }
    }

    syncCampaignRowIds();
    window.setInterval(syncCampaignRowIds, 1000);
})();

