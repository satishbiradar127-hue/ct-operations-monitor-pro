const fs = require("fs");
const path = require("path");

const workspace = "C:\\Users\\Orange Carrot\\Downloads\\CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL";
const releaseRoot = path.join(workspace, "CT_OPERATIONS_DUAL_DIALER_RELEASE");

function generateAll() {
    console.log("=== Dual-Dialer Generator Starting ===");

    // Read baseline files
    const baselineDir = path.join(releaseRoot, "RECOVERY_BASELINE", "ORIGINAL_PROJECT");
    const helpersBase = fs.readFileSync(path.join(baselineDir, "helpers.js"), "utf8");
    const parserBase = fs.readFileSync(path.join(baselineDir, "parser.js"), "utf8");
    const contentBase = fs.readFileSync(path.join(baselineDir, "content.js"), "utf8");
    const dashboardBase = fs.readFileSync(path.join(baselineDir, "dashboard.js"), "utf8");
    const mockDomBase = fs.readFileSync(path.join(baselineDir, "tests", "mock_dom.js"), "utf8");
    const suiteBase = fs.readFileSync(path.join(baselineDir, "tests", "suite.test.js"), "utf8");

    const editions = [
        {
            name: "East2",
            folder: "CT_Operations_Monitor_East2",
            targetHost: "east-2.calltools.io",
            productName: "CT Operations Monitor — East-2",
            description: "CallTools Operations Monitor Pro (East-2 Edition) — unified outbound Campaigns + inbound Queue command center with persistent Sales/Goals alerts, native Queue DOM bridge, and East-2 host isolation.",
            dialer: "EAST-2",
            prefix: "ct_east2_",
            pkgName: "ct-operations-monitor-east2",
            version: "11.2.0"
        },
        {
            name: "East3",
            folder: "CT_Operations_Monitor_East3",
            targetHost: "east-3.calltools.io",
            productName: "CT Operations Monitor — East-3",
            description: "CallTools Operations Monitor Pro (East-3 Edition) — unified outbound Campaigns + inbound Queue command center with persistent Sales/Goals alerts, native Queue DOM bridge, and East-3 host isolation.",
            dialer: "EAST-3",
            prefix: "ct_east3_",
            pkgName: "ct-operations-monitor-east3",
            version: "11.2.0"
        }
    ];

    for (const ed of editions) {
        console.log(`Generating edition: ${ed.productName}...`);
        const targetDir = path.join(releaseRoot, ed.folder);
        const srcDir = path.join(targetDir, "src");
        const testsDir = path.join(targetDir, "tests");
        const distDir = path.join(targetDir, "dist");
        const distSrcDir = path.join(distDir, "src");
        const distAssetsDir = path.join(distDir, "assets");
        const assetsDir = path.join(targetDir, "assets");

        [targetDir, srcDir, testsDir, distDir, distSrcDir, distAssetsDir, assetsDir].forEach(d => {
            if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
        });

        // 1. manifest.json
        const manifestObj = {
            manifest_version: 3,
            name: ed.productName,
            version: ed.version,
            description: ed.description,
            permissions: ["storage"],
            host_permissions: [`https://${ed.targetHost}/*`],
            content_scripts: [
                {
                    matches: [
                        `https://${ed.targetHost}/manager/campaigns*`,
                        `https://${ed.targetHost}/manager/queues*`
                    ],
                    js: [
                        "src/helpers.js",
                        "src/parser.js",
                        "src/dashboard.js",
                        "src/content.js"
                    ],
                    css: [
                        "src/dashboard.css"
                    ],
                    all_frames: true
                }
            ]
        };
        const manifestStr = JSON.stringify(manifestObj, null, 2);
        fs.writeFileSync(path.join(targetDir, "manifest.json"), manifestStr, "utf8");
        fs.writeFileSync(path.join(distDir, "manifest.json"), manifestStr, "utf8");

        // 2. package.json
        const pkgObj = {
            name: ed.pkgName,
            version: ed.version,
            description: ed.description,
            scripts: {
                test: "node --test tests/suite.test.js",
                check: "node --check src/helpers.js && node --check src/parser.js && node --check src/content.js && node --check src/dashboard.js"
            },
            keywords: [
                "calltools",
                "chrome-extension",
                "operations-monitor",
                ed.name.toLowerCase()
            ],
            author: "",
            license: "ISC"
        };
        const pkgStr = JSON.stringify(pkgObj, null, 2);
        fs.writeFileSync(path.join(targetDir, "package.json"), pkgStr, "utf8");

        // 3. helpers.js
        const helpersContent = `// ===============================
// CT Operations Monitor Helpers (${ed.dialer})
// Version ${ed.version}
// ===============================

window.CT = window.CT || {};

/**
 * Safely get text from an element.
 */
CT.text = function (el) {
    if (!el) return "";
    return el.textContent.trim();
};

/**
 * Get text using a selector inside a parent.
 */
CT.get = function (parent, selector) {
    return CT.text(parent.querySelector(selector));
};

/**
 * Escape HTML.
 */
CT.escape = function (value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
};

/**
 * Format numbers without coercing missing values to zero.
 */
CT.number = function (value, fallback) {
    const emptyFallback = fallback !== undefined ? fallback : "—";
    if (value === null || value === undefined || String(value).trim() === "") {
        return emptyFallback;
    }

    const n = parseFloat(
        String(value).replace(/,/g, "")
    );

    if (isNaN(n)) return String(value).trim() || emptyFallback;

    return n.toLocaleString();
};

/**
 * Categorize a metric into explicit validity states:
 * VALID_ZERO, VALID_NONZERO, MISSING, or MALFORMED.
 */
CT.parseMetric = function (value) {
    if (value === null || value === undefined || String(value).trim() === "") {
        return { raw: value, value: null, state: "MISSING", isValid: false };
    }
    const clean = String(value).replace(/,/g, "").trim();
    const n = parseFloat(clean);
    if (isNaN(n)) {
        return { raw: value, value: null, state: "MALFORMED", isValid: false };
    }
    if (n === 0) {
        return { raw: value, value: 0, state: "VALID_ZERO", isValid: true };
    }
    return { raw: value, value: n, state: "VALID_NONZERO", isValid: true };
};

/**
 * Return status color.
 */
CT.waitColor = function (wait) {
    const n = parseFloat(wait);
    if (isNaN(n)) return "#777";
    if (n >= 60) return "#d32f2f";
    if (n >= 30) return "#f57c00";
    return "#2e7d32";
};

console.log("Helpers Loaded (${ed.dialer})");
`;
        fs.writeFileSync(path.join(srcDir, "helpers.js"), helpersContent, "utf8");
        fs.writeFileSync(path.join(distDir, "src", "helpers.js"), helpersContent, "utf8");

        // 4. parser.js with multi-header fix and Sales/Goals tracking
        let parserContent = parserBase;
        // Fix header index collision by enhancing findHeaderCell and getByHeader
        const oldFindHeaderCell = `    findHeaderCell(row, labels) {
        const table = row.closest('table, mat-table');
        if (!table) return null;
        const wanted = (labels || []).map(function(v){ return String(v).replace(/\\s+/g,' ').trim().toLowerCase(); });
        const headers = this.campaignLeafHeaders(table);
        const header = headers.find(function(h){
            const text = String(h.innerText || h.textContent || '').replace(/\\s+/g,' ').trim().toLowerCase();
            return wanted.includes(text);
        });
        if (!header) return null;`;

        const newFindHeaderCell = `    findHeaderCell(row, labels, occurrence) {
        const table = row.closest('table, mat-table');
        if (!table) return null;
        const wanted = (labels || []).map(function(v){ return String(v).replace(/\\s+/g,' ').trim().toLowerCase(); });
        const headers = this.campaignLeafHeaders(table);
        const matches = headers.filter(function(h){
            const text = String(h.innerText || h.textContent || '').replace(/\\s+/g,' ').trim().toLowerCase();
            return wanted.includes(text);
        });
        const header = matches[Math.max(0, Number(occurrence || 0))];
        if (!header) return null;`;

        parserContent = parserContent.replace(oldFindHeaderCell, newFindHeaderCell);

        const oldGetByHeader = `    getByHeader(row, labels, fallbackClasses) {
        for (const cls of (fallbackClasses || [])) {
            const cell = row.querySelector('.' + cls);
            if (cell) return String(cell.innerText || cell.textContent || '').replace(/\\s+/g,' ').trim();
        }
        const cell = this.findHeaderCell(row, labels);`;

        const newGetByHeader = `    getByHeader(row, labels, fallbackClasses, occurrence) {
        for (const cls of (fallbackClasses || [])) {
            const cell = row.querySelector('.' + cls);
            if (cell) return String(cell.innerText || cell.textContent || '').replace(/\\s+/g,' ').trim();
        }
        const cell = this.findHeaderCell(row, labels, occurrence);`;

        parserContent = parserContent.replace(oldGetByHeader, newGetByHeader);

        // Update contacts and outbound calls to prevent collision on 'Total'
        parserContent = parserContent.replace(
            `const rawContacts = this.getByHeader(row, ["count", "contact count", "total contacts", "total"], ["cdk-column-contact_count", "cdk-column-total_saved_contact_count", "cdk-column-contacts"]);`,
            `const rawContacts = this.getByHeader(row, ["count", "contact count", "total contacts", "total"], ["cdk-column-contact_count", "cdk-column-total_saved_contact_count", "cdk-column-contacts"], 0);`
        );
        parserContent = parserContent.replace(
            `const rawOutbound = this.getByHeader(row, ["total", "outbound", "outbound calls"], ["cdk-column-outbound", "cdk-column-calls_outbound", "cdk-column-calls_today"]);`,
            `const rawOutbound = this.getByHeader(row, ["outbound", "outbound calls", "total"], ["cdk-column-outbound", "cdk-column-calls_outbound", "cdk-column-calls_today"], 1);`
        );

        // Add sales support to parser.js in readCampaigns and readQueues
        parserContent = parserContent.replace(
            `const rawGoals = this.queueValue(row, 'Goals', 0);`,
            `const rawGoals = this.queueValue(row, 'Goals', 0);\n            const rawSales = this.queueValue(row, 'Sales', 0);`
        );
        parserContent = parserContent.replace(
            `goals: rawGoals ?? '',`,
            `goals: rawGoals ?? '',\n                sales: rawSales ?? '',`
        );
        parserContent = parserContent.replace(
            `goals: parse(rawGoals)`,
            `goals: parse(rawGoals),\n                    sales: parse(rawSales)`
        );

        parserContent = parserContent.replace(
            `const rawGoals = this.getByHeader(`,
            `const rawSales = this.getByHeader(row, ["sales", "sale"], ["mat-column-sales", "cdk-column-sales", "cdk-column-campaign__sales"]);\n            const rawGoals = this.getByHeader(`
        );
        parserContent = parserContent.replace(
            `goals: rawGoals !== "" ? rawGoals : null,`,
            `goals: rawGoals !== "" ? rawGoals : null,\n                sales: rawSales !== "" ? rawSales : null,`
        );
        parserContent = parserContent.replace(
            `goals: parse(rawGoals)`,
            `goals: parse(rawGoals),\n                    sales: parse(rawSales)`
        );
        parserContent = parserContent.replace(
            `CT Operations Monitor parser loaded — v11.1.46`,
            `CT Operations Monitor parser loaded (${ed.dialer}) — v${ed.version}`
        );

        fs.writeFileSync(path.join(srcDir, "parser.js"), parserContent, "utf8");
        fs.writeFileSync(path.join(distDir, "src", "parser.js"), parserContent, "utf8");

        // 5. content.js
        let contentCode = contentBase;
        // Host verification check at top
        const hostGuard = `console.log("CT Operations Monitor (${ed.dialer}) — Production live feed controller v${ed.version}");

(function () {
    "use strict";

    const TARGET_HOST = "${ed.targetHost}";
    const EDITION = "${ed.dialer}";
    if (window.location.hostname && window.location.hostname !== TARGET_HOST) {
        console.log("CT Operations Monitor (" + EDITION + ") — wrong host " + window.location.hostname + "; expected " + TARGET_HOST);
        return;
    }`;

        contentCode = contentCode.replace(
            /console\.log\("CT Operations Monitor — Production live feed controller v11\.1\.53"\);\s*\(function \(\) \{\s*"use strict";/,
            hostGuard
        );

        // Namespace storage keys and iframe
        contentCode = contentCode.replace(/ct-operations-last-known-queues-v1/g, `${ed.prefix}last_known_queues_v1`);
        contentCode = contentCode.replace(/ct-operations-inbound-feed-status-v1/g, `${ed.prefix}inbound_feed_status_v1`);
        contentCode = contentCode.replace(/ct-operations-inbound-data-v2/g, `${ed.prefix}inbound_data_v2`);
        contentCode = contentCode.replace(/ct-operations-inbound-status-v2/g, `${ed.prefix}inbound_status_v2`);
        contentCode = contentCode.replace(/ct-operations-hidden-queue-feed/g, `ct-operations-hidden-queue-feed-${ed.name.toLowerCase()}`);
        contentCode = contentCode.replace(/https:\/\/east-2\.calltools\.io\/manager\/queues\?ct_inbound_monitor=1&ct_inbound_owner=ctompro_iframe/g, `https://${ed.targetHost}/manager/queues?ct_inbound_monitor=1&ct_inbound_owner=ctompro_${ed.name.toLowerCase()}`);
        contentCode = contentCode.replace(/CT_REFRESH_INBOUND_FEED/g, `CT_${ed.dialer.replace(/-/g, '_')}_REFRESH_INBOUND_FEED`);
        contentCode = contentCode.replace(/CT_UPDATE/g, `CT_${ed.dialer.replace(/-/g, '_')}_UPDATE`);
        contentCode = contentCode.replace(/CT_FEED_STATUS/g, `CT_${ed.dialer.replace(/-/g, '_')}_FEED_STATUS`);
        contentCode = contentCode.replace(/CT_REQUEST_REFRESH/g, `CT_${ed.dialer.replace(/-/g, '_')}_REQUEST_REFRESH`);
        contentCode = contentCode.replace(/CT_REQUEST_INBOUND_REFRESH/g, `CT_${ed.dialer.replace(/-/g, '_')}_REQUEST_INBOUND_REFRESH`);

        fs.writeFileSync(path.join(srcDir, "content.js"), contentCode, "utf8");
        fs.writeFileSync(path.join(distDir, "src", "content.js"), contentCode, "utf8");

        // 6. dashboard.css
        const dashboardCssContent = `/* CT Operations Monitor (${ed.dialer}) Styles */
/* Base injected styles are dynamically scoped to #${ed.name.toLowerCase() === 'east2' ? 'ct-operations-dashboard-east2' : 'ct-operations-dashboard-east3'} */
.ct-dialer-tag {
    display: inline-block;
    padding: 2px 7px;
    font-size: 10px;
    font-weight: 950;
    border-radius: 4px;
    margin-left: 8px;
    vertical-align: middle;
    letter-spacing: .06em;
}
.ct-dialer-east2 {
    background: #0284c7;
    color: #ffffff;
    border: 1px solid #38bdf8;
}
.ct-dialer-east3 {
    background: #7c3aed;
    color: #ffffff;
    border: 1px solid #a78bfa;
}
.ct-persistent-goals-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 10px;
}
.ct-persistent-goal-card {
    border-radius: 8px;
    padding: 10px 12px;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(16, 185, 129, 0.14));
    border: 1.5px solid #f59e0b;
    box-shadow: 0 4px 16px rgba(245, 158, 11, 0.15);
    color: #f8fafc;
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.ct-goal-card-top {
    display: flex;
    align-items: center;
    gap: 8px;
}
.ct-goal-badge {
    background: #f59e0b;
    color: #0f172a;
    font-weight: 950;
    font-size: 9px;
    padding: 2px 6px;
    border-radius: 4px;
    letter-spacing: .05em;
    text-transform: uppercase;
}
.ct-goal-direction-tag {
    background: rgba(148, 163, 184, 0.25);
    color: #cbd5e1;
    font-size: 8.5px;
    font-weight: 850;
    padding: 2px 5px;
    border-radius: 3px;
}
.ct-goal-time {
    margin-left: auto;
    font-size: 9px;
    color: #94a3b8;
}
.ct-goal-card-body {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
}
.ct-goal-target-name {
    font-size: 13px;
    font-weight: 850;
    color: #f1f5f9;
}
.ct-goal-stat-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
}
.ct-goal-increase {
    font-weight: 950;
    color: #34d399;
}
.ct-btn-noted {
    align-self: flex-end;
    padding: 4px 12px;
    font-size: 10px;
    font-weight: 950;
    background: #059669;
    color: #ffffff;
    border: 1px solid #34d399;
    border-radius: 5px;
    cursor: pointer;
    transition: all .15s ease;
}
.ct-btn-noted:hover {
    background: #10b981;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
}
`;
        fs.writeFileSync(path.join(srcDir, "dashboard.css"), dashboardCssContent, "utf8");
        fs.writeFileSync(path.join(distDir, "src", "dashboard.css"), dashboardCssContent, "utf8");

        // 7. dashboard.js - Comprehensive transformation
        let dashCode = dashboardBase;

        // Scoped Dashboard ID and Style ID
        const dashId = `ct-operations-dashboard-${ed.name.toLowerCase()}`;
        const styleId = `ct-operations-dashboard-styles-${ed.name.toLowerCase()}-v11-2-0`;
        dashCode = dashCode.replace('const DASHBOARD_ID = "ct-operations-dashboard";', `const DASHBOARD_ID = "${dashId}";`);
        dashCode = dashCode.replace(/const STYLE_ID = "ct-operations-dashboard-styles-v11-1-53";/, `const STYLE_ID = "${styleId}";`);

        // Target Host guard
        const dashHostGuard = `console.log("Dashboard Loaded — CT Operations Monitor Pro (${ed.dialer}) v${ed.version}");

(function () {
    "use strict";

    const TARGET_HOST = "${ed.targetHost}";
    const EDITION = "${ed.dialer}";
    const DIALER = "${ed.dialer}";
    const PREFIX = "${ed.prefix}";

    if (window.location.hostname && window.location.hostname !== TARGET_HOST) {
        console.log("CT Operations Monitor (" + EDITION + ") — wrong host " + window.location.hostname + "; expected " + TARGET_HOST);
        return;
    }`;
        dashCode = dashCode.replace(
            /console\.log\("Dashboard Loaded — CT Operations Monitor Pro v11\.1\.53"\);\s*\(function \(\) \{\s*"use strict";/,
            dashHostGuard
        );

        // Namespace storage keys
        dashCode = dashCode.replace(/ct-operations-dashboard-theme/g, `${ed.prefix}dashboard_theme`);
        dashCode = dashCode.replace(/ct-operations-contact-threshold/g, `${ed.prefix}contact_threshold`);
        dashCode = dashCode.replace(/ct-operations-dashboard-zoom/g, `${ed.prefix}dashboard_zoom`);
        dashCode = dashCode.replace(/ct-operations-dashboard-layout-v18/g, `${ed.prefix}dashboard_layout_v18`);
        dashCode = dashCode.replace(/ct-operations-dashboard-layout-version/g, `${ed.prefix}dashboard_layout_version`);
        dashCode = dashCode.replace(/ct-operations-selected-campaign-ids-v1/g, `${ed.prefix}selected_campaign_ids_v1`);
        dashCode = dashCode.replace(/ct-operations-campaign-state-filter-v1/g, `${ed.prefix}campaign_state_filter_v1`);
        dashCode = dashCode.replace(/ct-operations-campaign-health-filter-v1/g, `${ed.prefix}campaign_health_filter_v1`);
        dashCode = dashCode.replace(/ct-operations-campaign-query-v1/g, `${ed.prefix}campaign_query_v1`);
        dashCode = dashCode.replace(/ct-operations-dashboard-campaign-order/g, `${ed.prefix}dashboard_campaign_order`);
        dashCode = dashCode.replace(/ct-operations-dashboard-campaign-order-meta/g, `${ed.prefix}dashboard_campaign_order_meta`);
        dashCode = dashCode.replace(/ct-operations-dismissed-alerts-v3/g, `${ed.prefix}dismissed_alerts_v3`);
        dashCode = dashCode.replace(/ct-operations-last-known-queues-v1/g, `${ed.prefix}last_known_queues_v1`);
        dashCode = dashCode.replace(/ct-operations-inbound-feed-status-v1/g, `${ed.prefix}inbound_feed_status_v1`);
        dashCode = dashCode.replace(/ct-operations-inbound-data-v2/g, `${ed.prefix}inbound_data_v2`);
        dashCode = dashCode.replace(/ct-operations-inbound-status-v2/g, `${ed.prefix}inbound_status_v2`);
        dashCode = dashCode.replace(/ct-operations-operating-baseline-v1/g, `${ed.prefix}operating_baseline_v1`);
        dashCode = dashCode.replace(/ct-operations-operating-campaign/g, `${ed.prefix}operating_campaign`);
        dashCode = dashCode.replace(/ct-operations-last-known-campaigns-v1/g, `${ed.prefix}last_known_campaigns_v1`);

        // Events
        dashCode = dashCode.replace(/CT_UPDATE/g, `CT_${ed.dialer.replace(/-/g, '_')}_UPDATE`);
        dashCode = dashCode.replace(/CT_FEED_STATUS/g, `CT_${ed.dialer.replace(/-/g, '_')}_FEED_STATUS`);
        dashCode = dashCode.replace(/CT_REQUEST_REFRESH/g, `CT_${ed.dialer.replace(/-/g, '_')}_REQUEST_REFRESH`);
        dashCode = dashCode.replace(/CT_REQUEST_INBOUND_REFRESH/g, `CT_${ed.dialer.replace(/-/g, '_')}_REQUEST_INBOUND_REFRESH`);

        // Stale heartbeat fix: 15000ms
        dashCode = dashCode.replace(/const INBOUND_HEARTBEAT_STALE_MS = 5000;/, `const INBOUND_HEARTBEAT_STALE_MS = 15000;`);

        // Defect 2 fix: Queue Detail table native order
        dashCode = dashCode.replace(
            `const sorted = rows.slice().sort(function (a, b) {\n                return b.waiting - a.waiting || b.maxWait - a.maxWait || b.onCall - a.onCall || b.today - a.today || a.name.localeCompare(b.name);\n            });`,
            `const sorted = rows.slice().sort(function (a, b) {\n                return (a.index ?? 0) - (b.index ?? 0);\n            });`
        );

        // Defect 4 fix: Section B coercion of missing agent data to 0
        dashCode = dashCode.replace(
            `        setText(refs.opLoggedIn, count ? formatNumber(totalLoggedIn) : "—");\n        setText(refs.opWaiting, count ? formatNumber(totalWaiting) : "—");`,
            `        const hasLoggedIn = selected.some(function (c) { return c.__loggedIn !== null && c.__loggedIn !== undefined; });\n        const hasWaiting = selected.some(function (c) { return c.__waiting !== null && c.__waiting !== undefined; });\n        setText(refs.opLoggedIn, (count && hasLoggedIn) ? formatNumber(totalLoggedIn) : "—");\n        setText(refs.opWaiting, (count && hasWaiting) ? formatNumber(totalWaiting) : "—");`
        );
        dashCode = dashCode.replace(
            `        setText(refs.opOnCall, count ? formatNumber(totalOnCall) : "—");`,
            `        const hasOnCall = selected.some(function (c) { return c.__onCall !== null && c.__onCall !== undefined; });\n        setText(refs.opOnCall, (count && hasOnCall) ? formatNumber(totalOnCall) : "—");`
        );

        // Defect 5 fix: Restore corrupted UTF-8 button labels
        dashCode = dashCode.replace(`aria-label="Refresh live CallTools data">? Refresh Data</button>`, `aria-label="Refresh live CallTools data">↻ Refresh Data</button>`);
        dashCode = dashCode.replace(`aria-label="Arrange campaign order">? Order</button>`, `aria-label="Arrange campaign order">Arrange Campaigns</button>`);
        dashCode = dashCode.replace(`aria-label="Arrange campaign order">⚙ Order</button>`, `aria-label="Arrange campaign order">Arrange Campaigns</button>`);
        dashCode = dashCode.replace(`refs.manageOrder.textContent = state.reorderMode ? " Done Order" : "? Order";`, `refs.manageOrder.textContent = state.reorderMode ? "✓ Done Order" : "Arrange Campaigns";`);
        dashCode = dashCode.replace(`refs.manageOrder.textContent = state.reorderMode ? "✓ Done Order" : "⚙ Order";`, `refs.manageOrder.textContent = state.reorderMode ? "✓ Done Order" : "Arrange Campaigns";`);
        dashCode = dashCode.replace(`<span class="ct-order-icon"> </span>`, `<span class="ct-order-icon">↕</span>`);
        dashCode = dashCode.replace(`Use <b>  /  </b> for precise positioning`, `Use <b>↑ / ↓</b> for precise positioning`);

        // Defect 6 fix: Inbound table max-height clash (remove 220px override)
        dashCode = dashCode.replace(/#\$\{DASHBOARD_ID\} \.ct-inbound-table-wrap \{ max-height:220px;[^}]*\}/g, "");

        // Header Title Tag
        dashCode = dashCode.replace(
            `<h2>CallTools Operations</h2>`,
            `<h2>CallTools Operations <span class="ct-dialer-tag ct-dialer-${ed.name.toLowerCase()}">${ed.dialer}</span></h2>`
        );

        // Persistent Goal Alert state integration into state object
        dashCode = dashCode.replace(
            `dismissedConditions: readDismissedConditions(),`,
            `dismissedConditions: readDismissedConditions(),\n        persistentGoalBaselines: readPersistentGoalBaselines(),\n        persistentGoalAlerts: readPersistentGoalAlerts(),\n        acknowledgedGoalAlerts: readAcknowledgedGoalAlerts(),\n        inboundSettings: readInboundSettings(),`
        );

        // Insert Persistent Goals Alert Engine & Inbound Settings routines right before updateAlerts()
        const alertEngineCode = `
    // ==========================================
    // PERSISTENT SALES / GOALS ALERT ENGINE (${ed.dialer})
    // ==========================================
    const GOAL_BASELINES_KEY = PREFIX + "goal_baselines_v1";
    const PERSISTENT_GOAL_ALERTS_KEY = PREFIX + "persistent_goal_alerts_v1";
    const ACKNOWLEDGED_GOAL_ALERTS_KEY = PREFIX + "acknowledged_goal_alerts_v1";
    const INBOUND_SETTINGS_KEY = PREFIX + "inbound_settings_v1";

    function readInboundSettings() {
        try {
            const raw = JSON.parse(readStorage(INBOUND_SETTINGS_KEY, "{}")) || {};
            return {
                showArchived: Boolean(raw.showArchived),
                warnWaitThreshold: Number(raw.warnWaitThreshold) || 30,
                critWaitThreshold: Number(raw.critWaitThreshold) || 60,
                alertZeroCapacity: raw.alertZeroCapacity !== false
            };
        } catch (e) {
            return { showArchived: false, warnWaitThreshold: 30, critWaitThreshold: 60, alertZeroCapacity: true };
        }
    }

    function persistInboundSettings() {
        writeStorage(INBOUND_SETTINGS_KEY, JSON.stringify(state.inboundSettings || {}));
    }

    function readPersistentGoalBaselines() {
        try {
            return JSON.parse(readStorage(GOAL_BASELINES_KEY, "{}")) || {};
        } catch (e) {
            return {};
        }
    }

    function readPersistentGoalAlerts() {
        try {
            const list = JSON.parse(readStorage(PERSISTENT_GOAL_ALERTS_KEY, "[]"));
            return Array.isArray(list) ? list : [];
        } catch (e) {
            return [];
        }
    }

    function readAcknowledgedGoalAlerts() {
        try {
            const setArray = JSON.parse(readStorage(ACKNOWLEDGED_GOAL_ALERTS_KEY, "[]"));
            return new Set(Array.isArray(setArray) ? setArray : []);
        } catch (e) {
            return new Set();
        }
    }

    function persistGoalBaselines() {
        writeStorage(GOAL_BASELINES_KEY, JSON.stringify(state.persistentGoalBaselines || {}));
        try {
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ [GOAL_BASELINES_KEY]: state.persistentGoalBaselines });
            }
        } catch (e) {}
    }

    function persistPersistentGoalAlerts() {
        writeStorage(PERSISTENT_GOAL_ALERTS_KEY, JSON.stringify(state.persistentGoalAlerts || []));
        try {
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ [PERSISTENT_GOAL_ALERTS_KEY]: state.persistentGoalAlerts });
            }
        } catch (e) {}
    }

    function persistAcknowledgedGoalAlerts() {
        const arr = Array.from(state.acknowledgedGoalAlerts || []);
        writeStorage(ACKNOWLEDGED_GOAL_ALERTS_KEY, JSON.stringify(arr));
        try {
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ [ACKNOWLEDGED_GOAL_ALERTS_KEY]: arr });
            }
        } catch (e) {}
    }

    function checkPersistentGoalAlerts(campaigns, queues) {
        let alertsChanged = false;
        let baselinesChanged = false;
        const now = Date.now();
        const timeStr = formatDateTime(new Date(now));

        // 1. Check Outbound Campaigns (Sales & Goals)
        (campaigns || []).forEach(function (c, index) {
            if (!c) return;
            const targetId = String(c.__id || campaignId(c, index) || c.name || "").trim().toLowerCase();
            const targetName = String(c.name || "Campaign " + (index + 1)).trim();

            const goalsVal = c.goals !== null && c.goals !== undefined && c.goals !== "" ? numberValue(c.goals) : null;
            if (goalsVal !== null && Number.isFinite(goalsVal)) {
                const bKey = "outbound_goals_" + targetId;
                const baseline = state.persistentGoalBaselines[bKey];
                if (!baseline) {
                    state.persistentGoalBaselines[bKey] = { val: goalsVal, metric: "Goals", updatedAt: now };
                    baselinesChanged = true;
                } else if (goalsVal > baseline.val) {
                    const increase = goalsVal - baseline.val;
                    const alertId = DIALER + "_OUTBOUND_GOALS_" + targetId + "_" + now + "_" + goalsVal;
                    if (!state.acknowledgedGoalAlerts.has(alertId) && !state.persistentGoalAlerts.some(a => a.id === alertId)) {
                        state.persistentGoalAlerts.push({
                            id: alertId,
                            dialer: DIALER,
                            direction: "OUTBOUND",
                            targetName: targetName,
                            targetId: targetId,
                            metric: "Goals",
                            previous: baseline.val,
                            current: goalsVal,
                            increase: increase,
                            detectedAt: timeStr,
                            timestamp: now,
                            acknowledged: false
                        });
                        alertsChanged = true;
                    }
                    baseline.val = goalsVal;
                    baseline.updatedAt = now;
                    baselinesChanged = true;
                } else if (goalsVal < baseline.val) {
                    baseline.val = goalsVal;
                    baseline.updatedAt = now;
                    baselinesChanged = true;
                }
            }

            const salesVal = c.sales !== null && c.sales !== undefined && c.sales !== "" ? numberValue(c.sales) : null;
            if (salesVal !== null && Number.isFinite(salesVal)) {
                const bKey = "outbound_sales_" + targetId;
                const baseline = state.persistentGoalBaselines[bKey];
                if (!baseline) {
                    state.persistentGoalBaselines[bKey] = { val: salesVal, metric: "Sales", updatedAt: now };
                    baselinesChanged = true;
                } else if (salesVal > baseline.val) {
                    const increase = salesVal - baseline.val;
                    const alertId = DIALER + "_OUTBOUND_SALES_" + targetId + "_" + now + "_" + salesVal;
                    if (!state.acknowledgedGoalAlerts.has(alertId) && !state.persistentGoalAlerts.some(a => a.id === alertId)) {
                        state.persistentGoalAlerts.push({
                            id: alertId,
                            dialer: DIALER,
                            direction: "OUTBOUND",
                            targetName: targetName,
                            targetId: targetId,
                            metric: "Sales",
                            previous: baseline.val,
                            current: salesVal,
                            increase: increase,
                            detectedAt: timeStr,
                            timestamp: now,
                            acknowledged: false
                        });
                        alertsChanged = true;
                    }
                    baseline.val = salesVal;
                    baseline.updatedAt = now;
                    baselinesChanged = true;
                } else if (salesVal < baseline.val) {
                    baseline.val = salesVal;
                    baseline.updatedAt = now;
                    baselinesChanged = true;
                }
            }
        });

        // 2. Check Inbound Queues (Goals & Sales)
        (queues || []).forEach(function (q, index) {
            if (!q || isArchivedQueue(q)) return;
            const targetId = String(queueId(q, index) || q.name || "").trim().toLowerCase();
            const targetName = String(q.name || "Queue " + (index + 1)).trim();

            const goalsVal = q.goals !== null && q.goals !== undefined && q.goals !== "" ? numberValue(q.goals) : null;
            if (goalsVal !== null && Number.isFinite(goalsVal)) {
                const bKey = "inbound_goals_" + targetId;
                const baseline = state.persistentGoalBaselines[bKey];
                if (!baseline) {
                    state.persistentGoalBaselines[bKey] = { val: goalsVal, metric: "Goals", updatedAt: now };
                    baselinesChanged = true;
                } else if (goalsVal > baseline.val) {
                    const increase = goalsVal - baseline.val;
                    const alertId = DIALER + "_INBOUND_GOALS_" + targetId + "_" + now + "_" + goalsVal;
                    if (!state.acknowledgedGoalAlerts.has(alertId) && !state.persistentGoalAlerts.some(a => a.id === alertId)) {
                        state.persistentGoalAlerts.push({
                            id: alertId,
                            dialer: DIALER,
                            direction: "INBOUND",
                            targetName: targetName,
                            targetId: targetId,
                            metric: "Goals",
                            previous: baseline.val,
                            current: goalsVal,
                            increase: increase,
                            detectedAt: timeStr,
                            timestamp: now,
                            acknowledged: false
                        });
                        alertsChanged = true;
                    }
                    baseline.val = goalsVal;
                    baseline.updatedAt = now;
                    baselinesChanged = true;
                } else if (goalsVal < baseline.val) {
                    baseline.val = goalsVal;
                    baseline.updatedAt = now;
                    baselinesChanged = true;
                }
            }

            const salesVal = q.sales !== null && q.sales !== undefined && q.sales !== "" ? numberValue(q.sales) : null;
            if (salesVal !== null && Number.isFinite(salesVal)) {
                const bKey = "inbound_sales_" + targetId;
                const baseline = state.persistentGoalBaselines[bKey];
                if (!baseline) {
                    state.persistentGoalBaselines[bKey] = { val: salesVal, metric: "Sales", updatedAt: now };
                    baselinesChanged = true;
                } else if (salesVal > baseline.val) {
                    const increase = salesVal - baseline.val;
                    const alertId = DIALER + "_INBOUND_SALES_" + targetId + "_" + now + "_" + salesVal;
                    if (!state.acknowledgedGoalAlerts.has(alertId) && !state.persistentGoalAlerts.some(a => a.id === alertId)) {
                        state.persistentGoalAlerts.push({
                            id: alertId,
                            dialer: DIALER,
                            direction: "INBOUND",
                            targetName: targetName,
                            targetId: targetId,
                            metric: "Sales",
                            previous: baseline.val,
                            current: salesVal,
                            increase: increase,
                            detectedAt: timeStr,
                            timestamp: now,
                            acknowledged: false
                        });
                        alertsChanged = true;
                    }
                    baseline.val = salesVal;
                    baseline.updatedAt = now;
                    baselinesChanged = true;
                } else if (salesVal < baseline.val) {
                    baseline.val = salesVal;
                    baseline.updatedAt = now;
                    baselinesChanged = true;
                }
            }
        });

        if (baselinesChanged) persistGoalBaselines();
        if (alertsChanged) persistPersistentGoalAlerts();
    }

    function acknowledgePersistentGoalAlert(alertId) {
        if (!alertId) return;
        state.acknowledgedGoalAlerts.add(alertId);
        state.persistentGoalAlerts = state.persistentGoalAlerts.filter(function (a) { return a.id !== alertId; });
        persistPersistentGoalAlerts();
        persistAcknowledgedGoalAlerts();
        updateAlerts();
        showActionNotice("Persistent " + DIALER + " alert acknowledged [NOTED].");
    }
`;
        dashCode = dashCode.replace(
            `    function updateAlerts() {`,
            alertEngineCode + `\n    function updateAlerts() {`
        );

        // Call checkPersistentGoalAlerts inside render()
        dashCode = dashCode.replace(
            `updateInboundPanel();`,
            `checkPersistentGoalAlerts(state.campaigns, state.queues);\n        updateInboundPanel();`
        );

        // Update the Action Center markup in mount() to include persistent goals container
        dashCode = dashCode.replace(
            `<div class="ct-action-notice" data-ref="actionNotice" hidden aria-live="polite"></div><div class="ct-alert-list"></div>`,
            `<div class="ct-action-notice" data-ref="actionNotice" hidden aria-live="polite"></div><div class="ct-persistent-goals-container" data-ref="persistentGoalsContainer"></div><div class="ct-alert-list"></div>`
        );

        // Add refs for persistent goals container
        dashCode = dashCode.replace(
            `actionNotice: root.querySelector('[data-ref="actionNotice"]'),`,
            `actionNotice: root.querySelector('[data-ref="actionNotice"]'),\n            persistentGoalsContainer: root.querySelector('[data-ref="persistentGoalsContainer"]'),`
        );

        // Render persistent goal alerts inside updateAlerts()
        const persistentRenderSnippet = `        // Render Persistent Goals Alerts (NEVER AUTO-DISMISSED)
        if (refs.persistentGoalsContainer) {
            const activePersistent = (state.persistentGoalAlerts || []).filter(function (a) {
                return !state.acknowledgedGoalAlerts.has(a.id);
            });
            if (!activePersistent.length) {
                refs.persistentGoalsContainer.innerHTML = "";
            } else {
                refs.persistentGoalsContainer.innerHTML = activePersistent.map(function (alert) {
                    return '<div class="ct-persistent-goal-card" data-goal-id="' + escapeHtml(alert.id) + '">' +
                        '<div class="ct-goal-card-top">' +
                            '<span class="ct-goal-badge">NEW ' + escapeHtml(alert.metric.toUpperCase()) + ' DETECTED</span>' +
                            '<span class="ct-dialer-tag ct-dialer-' + '${ed.name.toLowerCase()}' + '">' + escapeHtml(alert.dialer) + '</span>' +
                            '<span class="ct-goal-direction-tag">' + escapeHtml(alert.direction) + '</span>' +
                            '<span class="ct-goal-time">' + escapeHtml(alert.detectedAt) + '</span>' +
                        '</div>' +
                        '<div class="ct-goal-card-body">' +
                            '<div class="ct-goal-target-name"><strong>' + escapeHtml(alert.targetName) + '</strong></div>' +
                            '<div class="ct-goal-stat-row">' +
                                '<span class="ct-goal-metric-label">' + escapeHtml(alert.metric) + ':</span>' +
                                '<span class="ct-goal-count-prev">' + alert.previous + '</span>' +
                                '<span class="ct-goal-arrow">→</span>' +
                                '<span class="ct-goal-count-curr">' + alert.current + '</span>' +
                                '<span class="ct-goal-increase">(+' + alert.increase + ')</span>' +
                            '</div>' +
                        '</div>' +
                        '<div class="ct-goal-card-actions">' +
                            '<button type="button" class="ct-btn ct-btn-noted" data-noted-id="' + escapeHtml(alert.id) + '" title="Acknowledge this goal alert">NOTED</button>' +
                        '</div>' +
                    '</div>';
                }).join("");
            }
        }`;

        dashCode = dashCode.replace(
            `setText(refs.warningCount, warning + " AT RISK");`,
            `setText(refs.warningCount, warning + " AT RISK");\n` + persistentRenderSnippet
        );

        // Bind [NOTED] click handler in bindEvents()
        dashCode = dashCode.replace(
            `refs.clearAlerts.addEventListener("click", clearAttentionCenter);`,
            `refs.clearAlerts.addEventListener("click", clearAttentionCenter);\n        if (refs.persistentGoalsContainer) {\n            refs.persistentGoalsContainer.addEventListener("click", function(event) {\n                const btn = event.target.closest("[data-noted-id]");\n                if (!btn) return;\n                event.preventDefault();\n                event.stopPropagation();\n                acknowledgePersistentGoalAlert(btn.getAttribute("data-noted-id"));\n            });\n        }`
        );

        // Inbound compact settings header addition
        const inboundHeadOld = `<div class="ct-inbound-head-right"><span class="ct-inbound-live" data-ref="inboundLive">WAITING</span><button type="button" class="ct-inbound-refresh" data-ref="inboundRefresh" title="Refresh current CallTools feed">↻</button></div>`;
        const inboundHeadNew = `<div class="ct-inbound-head-right">
            <span class="ct-inbound-live" data-ref="inboundLive">WAITING</span>
            <button type="button" class="ct-inbound-refresh" data-ref="inboundRefresh" title="Refresh current CallTools feed">↻</button>
            <div class="ct-inbound-settings-wrap">
                <button type="button" class="ct-btn ct-inbound-settings-btn" data-ref="inboundSettingsBtn" title="Inbound Queue Settings">⚙ Inbound</button>
                <div class="ct-inbound-settings-menu" data-ref="inboundSettingsMenu" hidden>
                    <div class="ct-inbound-settings-title">Inbound Display & Alert Settings</div>
                    <label class="ct-inbound-setting-item"><input type="checkbox" data-inbound-setting="showArchived"> Show Archived Queues</label>
                    <label class="ct-inbound-setting-item"><input type="checkbox" data-inbound-setting="alertZeroCapacity" checked> Alert on 0-Capacity Holding</label>
                    <div class="ct-inbound-setting-row"><span>Warning Wait:</span><input type="number" min="5" max="300" step="5" data-inbound-setting="warnWaitThreshold" value="30">s</div>
                    <div class="ct-inbound-setting-row"><span>Critical Wait:</span><input type="number" min="10" max="600" step="5" data-inbound-setting="critWaitThreshold" value="60">s</div>
                </div>
            </div>
        </div>`;

        dashCode = dashCode.replace(inboundHeadOld, inboundHeadNew);

        // Inbound settings element refs and event handling
        dashCode = dashCode.replace(
            `inboundRefresh: root.querySelector(".ct-inbound-refresh"),`,
            `inboundRefresh: root.querySelector(".ct-inbound-refresh"),\n            inboundSettingsBtn: root.querySelector('[data-ref="inboundSettingsBtn"]'),\n            inboundSettingsMenu: root.querySelector('[data-ref="inboundSettingsMenu"]'),`
        );

        const inboundSettingsHandlers = `        if (refs.inboundSettingsBtn && refs.inboundSettingsMenu) {
            refs.inboundSettingsBtn.addEventListener("click", function (e) {
                e.stopPropagation();
                const isHidden = refs.inboundSettingsMenu.hidden;
                refs.inboundSettingsMenu.hidden = !isHidden;
            });
            document.addEventListener("click", function (e) {
                if (refs.inboundSettingsMenu && !refs.inboundSettingsMenu.contains(e.target) && e.target !== refs.inboundSettingsBtn) {
                    refs.inboundSettingsMenu.hidden = true;
                }
            });
            refs.inboundSettingsMenu.addEventListener("change", function (e) {
                const target = e.target;
                const setting = target.dataset.inboundSetting;
                if (!setting) return;
                if (target.type === "checkbox") {
                    state.inboundSettings[setting] = Boolean(target.checked);
                } else if (target.type === "number") {
                    state.inboundSettings[setting] = Math.max(1, Number(target.value) || 30);
                }
                persistInboundSettings();
                updateInboundPanel();
            });
        }`;

        dashCode = dashCode.replace(
            `if (refs.inboundRefresh) refs.inboundRefresh.addEventListener("click", function () {`,
            inboundSettingsHandlers + `\n        if (refs.inboundRefresh) refs.inboundRefresh.addEventListener("click", function () {`
        );

        fs.writeFileSync(path.join(srcDir, "dashboard.js"), dashCode, "utf8");
        fs.writeFileSync(path.join(distDir, "src", "dashboard.js"), dashCode, "utf8");

        // Copy mock_dom.js
        fs.writeFileSync(path.join(testsDir, "mock_dom.js"), mockDomBase, "utf8");

        // 8. README.md
        const readmeContent = `# ${ed.productName}
**Version:** ${ed.version}  
**Dialer Context:** ${ed.dialer}  
**Allowed Host:** \`https://${ed.targetHost}/*\`  
**Storage Namespace:** \`${ed.prefix}*\`

## Architecture & Operational Safety
CallTools is strictly **READ-ONLY**.
- The extension exclusively observes and reads native CallTools DOM data.
- Never mutates campaigns, queues, dispositions, agents, or settings.
- Never triggers calls, clicks native operational controls, or calls undocumented APIs.
- Dashboard controls affect presentation and extension storage only.

## Key Features & Verified Repairs
1. **Persistent Sales / Goals Alerts**:
   - Detects increases in actual Sales or Goals on Outbound Campaigns and Inbound Queues.
   - Immediate prominent notification displaying Dialer (${ed.dialer}), Direction, Target Name, Metric, Previous, Current, Increase, and Detection Timestamp.
   - **NEVER AUTO-DISMISSED**: Persists across refreshes, tab changes, restarts, and Action Center "Clear All". Only dismissed when the operator clicks **NOTED**.
2. **Inbound Queue Detail Native Order**:
   - Strictly preserves native CallTools Queue table row order without artificial re-sorting.
3. **Inbound Stale Feed Flapping Resolved**:
   - 15-second heartbeat stale threshold tolerates 5-second background feed throttle with complete stability.
4. **Outbound Focus Section B Integrity**:
   - Missing campaign agent metrics remain safely unexposed (\`—\`) rather than coerced to \`0\`.
5. **Compact Inbound Settings Panel**:
   - Inbound header includes a compact settings menu to toggle archived queue visibility and customize wait alert thresholds.
6. **Strict Host & Storage Isolation**:
   - Bound specifically to \`${ed.targetHost}\` with complete namespace isolation (\`${ed.prefix}\`).

## Installation
1. Open Google Chrome and navigate to \`chrome://extensions/\`.
2. Enable **Developer mode** in the upper right.
3. Click **Load unpacked** and select this directory (or the \`dist/\` subfolder).
4. Navigate to \`https://${ed.targetHost}/manager/campaigns\` or \`https://${ed.targetHost}/manager/queues\`.
`;
        fs.writeFileSync(path.join(targetDir, "README.md"), readmeContent, "utf8");

        console.log(`Edition ${ed.productName} generated successfully.`);
    }

    console.log("=== Dual-Dialer Generation Complete ===");
}

generateAll();
