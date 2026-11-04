const fs = require("fs");
const path = require("path");

const root = "C:\\Users\\Orange Carrot\\Downloads\\CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL\\CT_OPERATIONS_DUAL_DIALER_RELEASE";

console.log("=== Integrating CT Data Change Intelligence Engine into Dashboards ===");

const editions = [
    { name: "East2", dialer: "EAST-2", prefix: "ct_east2_" },
    { name: "East3", dialer: "EAST-3", prefix: "ct_east3_" }
];

editions.forEach(ed => {
    const srcDir = path.join(root, `CT_Operations_Monitor_${ed.name}`, "src");
    const distDir = path.join(root, `CT_Operations_Monitor_${ed.name}`, "dist", "src");

    // 1. UPDATE DASHBOARD.JS
    let dashCode = fs.readFileSync(path.join(srcDir, "dashboard.js"), "utf8");

    // Add intelligence engine initialization if not present
    if (!dashCode.includes("const intelligenceEngine =")) {
        const initSnippet = `
    // =========================================================================
    // CT DATA CHANGE INTELLIGENCE ENGINE INTEGRATION (${ed.dialer})
    // =========================================================================
    const intelligenceEngine = (typeof CTDataIntelligence !== "undefined" && CTDataIntelligence.CTDataIntelligenceEngine) ?
        new CTDataIntelligence.CTDataIntelligenceEngine({
            dialer: DIALER,
            prefix: PREFIX,
            storage: typeof localStorage !== "undefined" ? localStorage : null
        }) : null;
`;
        dashCode = dashCode.replace(
            `const GOAL_BASELINES_KEY = PREFIX + "goal_baselines_v1";`,
            initSnippet + `\n    const GOAL_BASELINES_KEY = PREFIX + "goal_baselines_v1";`
        );
    }

    // Call intelligenceEngine.processSnapshot in update()
    if (!dashCode.includes("intelligenceEngine.processSnapshot(")) {
        dashCode = dashCode.replace(
            `checkPersistentGoalAlerts(state.campaigns, state.queues);`,
            `checkPersistentGoalAlerts(state.campaigns, state.queues);\n            if (intelligenceEngine) {\n                intelligenceEngine.processSnapshot({\n                    campaigns: state.campaigns,\n                    queues: state.queues,\n                    isCampaignsRoute: Boolean(window.location && window.location.pathname && window.location.pathname.includes("/manager/campaigns")),\n                    campaignTableFound: Boolean(document.querySelector("table.mat-table, table.mat-mdc-table")),\n                    isStale: state.feedHeartbeatStale,\n                    authLost: state.authRequired\n                });\n            }`
        );
    }

    // Render intelligence cards in updateActionCenter()
    if (!dashCode.includes("data-intel-noted-id")) {
        const renderCardsSnippet = `
            // Render CT Data Change Intelligence Cards (Engines B, C, D)
            const activeIntelCards = (intelligenceEngine ? intelligenceEngine.activeAlerts : []).filter(function (a) {
                return !a.acknowledged && a.category !== "SALES_GOAL";
            }).map(function (alert) {
                const sevClass = alert.severity === "critical" ? "is-critical" : alert.severity === "warning" ? "is-warning" : "is-info";
                const badgeClass = alert.status === "INCREASE" ? "is-increase" : alert.status === "DECREASE" ? "is-decrease" : "is-integrity";
                return '<div class="ct-intelligence-card ' + sevClass + '" data-intel-id="' + escapeHtml(alert.id) + '">' +
                    '<div class="ct-intel-card-top">' +
                        '<span class="ct-intel-badge ' + badgeClass + '">' + escapeHtml(alert.status) + '</span>' +
                        '<span class="ct-dialer-tag">[' + escapeHtml(alert.dialer) + ']</span>' +
                        '<span class="ct-goal-direction-tag">[' + escapeHtml(alert.direction) + ']</span>' +
                        '<span class="ct-goal-time" title="Detected: ' + escapeHtml(alert.firstDetectedAt) + ' · Confirmed: ' + escapeHtml(alert.confirmedAt) + '">' + escapeHtml(alert.confirmedAt || alert.firstDetectedAt) + '</span>' +
                    '</div>' +
                    '<div class="ct-intel-card-body">' +
                        '<div class="ct-intel-target-row">' +
                            '<strong>' + escapeHtml(alert.targetName) + '</strong> · <span class="ct-intel-metric-title">' + escapeHtml(alert.metric) + '</span>' +
                        '</div>' +
                        '<div class="ct-goal-stat-row">' +
                            '<span class="ct-goal-count-prev">' + alert.previous + '</span>' +
                            '<span class="ct-goal-arrow">→</span>' +
                            '<span class="ct-goal-count-curr">' + alert.current + '</span>' +
                            '<span class="ct-intel-delta">(' + (alert.absoluteDiff > 0 ? '+' : '') + alert.absoluteDiff + ' / ' + alert.percentDiff + ')</span>' +
                        '</div>' +
                        (alert.message ? '<div class="ct-intel-msg-row">' + escapeHtml(alert.message) + '</div>' : '') +
                    '</div>' +
                    '<div class="ct-goal-card-actions">' +
                        '<button type="button" class="ct-btn ct-btn-noted" data-intel-noted-id="' + escapeHtml(alert.id) + '" title="Acknowledge this change">✓ NOTED</button>' +
                    '</div>' +
                '</div>';
            }).join("");
`;
        dashCode = dashCode.replace(
            `refs.persistentGoalsContainer.innerHTML = activePersistent.map(function (alert) {`,
            renderCardsSnippet + `\n            refs.persistentGoalsContainer.innerHTML = activeIntelCards + activePersistent.map(function (alert) {`
        );
    }

    // Add [data-intel-noted-id] click handler
    dashCode = dashCode.replace(
        `acknowledgePersistentGoalAlert(btn.getAttribute("data-noted-id"));\n            }\n            const intelBtn = event.target.closest("[data-intel-noted-id]");\n            if (intelBtn && intelligenceEngine) {\n                event.preventDefault();\n                event.stopPropagation();\n                intelligenceEngine.acknowledgeAlert(intelBtn.getAttribute("data-intel-noted-id"));\n                scheduleRender();\n                showActionNotice("Change intelligence alert acknowledged [NOTED].");`,
        `event.preventDefault();\n                event.stopPropagation();\n                acknowledgePersistentGoalAlert(btn.getAttribute("data-noted-id"));\n                return;\n            }\n            const intelBtn = event.target.closest("[data-intel-noted-id]");\n            if (intelBtn && intelligenceEngine) {\n                event.preventDefault();\n                event.stopPropagation();\n                intelligenceEngine.acknowledgeAlert(intelBtn.getAttribute("data-intel-noted-id"));\n                scheduleRender();\n                showActionNotice("Change intelligence alert acknowledged [NOTED].");\n                return;`
    );

    // Expose intelligenceEngine on CTOM_DASHBOARD
    if (!dashCode.includes("getIntelligenceEngine: function")) {
        dashCode = dashCode.replace(
            `acknowledgeGoalAlert: acknowledgePersistentGoalAlert`,
            `acknowledgeGoalAlert: acknowledgePersistentGoalAlert,\n        getIntelligenceEngine: function () { return intelligenceEngine; }`
        );
    }

    // Save dashboard.js in src and dist
    fs.writeFileSync(path.join(srcDir, "dashboard.js"), dashCode, "utf8");
    fs.writeFileSync(path.join(distDir, "dashboard.js"), dashCode, "utf8");
    console.log(`Updated dashboard.js in ${ed.name} src & dist.`);

    // 2. UPDATE DASHBOARD.CSS WITH INTELLIGENCE STYLES
    let cssCode = fs.readFileSync(path.join(srcDir, "dashboard.css"), "utf8");
    if (!cssCode.includes(".ct-intelligence-card")) {
        const intelCss = `
/* ==========================================================================
   CT DATA CHANGE INTELLIGENCE ENGINE STYLES (v11.3.0)
   ========================================================================== */
.ct-intelligence-card {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    padding: 8px 10px;
    margin-bottom: 8px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.ct-intelligence-card.is-critical {
    border-left: 4px solid #ef4444;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(30, 41, 59, 0.95) 100%);
}
.ct-intelligence-card.is-warning {
    border-left: 4px solid #f59e0b;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(30, 41, 59, 0.95) 100%);
}
.ct-intelligence-card.is-info {
    border-left: 4px solid #3b82f6;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(30, 41, 59, 0.95) 100%);
}
.ct-intel-card-top {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
}
.ct-intel-badge {
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 9px;
    text-transform: uppercase;
    font-weight: 800;
    letter-spacing: 0.5px;
}
.ct-intel-badge.is-increase {
    background: #b91c1c;
    color: #fee2e2;
}
.ct-intel-badge.is-decrease {
    background: #c2410c;
    color: #ffedd5;
}
.ct-intel-badge.is-integrity {
    background: #7c2d12;
    color: #ffedd5;
}
.ct-intel-target-row {
    font-size: 11px;
    color: #f1f5f9;
}
.ct-intel-metric-title {
    color: #94a3b8;
    font-size: 10px;
}
.ct-intel-delta {
    font-size: 10px;
    color: #38bdf8;
    font-weight: 700;
}
.ct-intel-msg-row {
    font-size: 10px;
    color: #cbd5e1;
    background: rgba(0, 0, 0, 0.2);
    padding: 3px 6px;
    border-radius: 4px;
    margin-top: 2px;
}
`;
        cssCode += intelCss;
        fs.writeFileSync(path.join(srcDir, "dashboard.css"), cssCode, "utf8");
        fs.writeFileSync(path.join(distDir, "dashboard.css"), cssCode, "utf8");
        console.log(`Updated dashboard.css in ${ed.name} src & dist.`);
    }
});

console.log("=== Intelligence Engine Integration Complete ===");
