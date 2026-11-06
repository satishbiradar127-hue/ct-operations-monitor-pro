const fs = require("fs");
const path = require("path");

const releaseDir = path.resolve(__dirname, "..", "CT_OPERATIONS_DUAL_DIALER_RELEASE");
const e2Dir = path.join(releaseDir, "CT_Operations_Monitor_East2", "src");
const e3Dir = path.join(releaseDir, "CT_Operations_Monitor_East3", "src");
const rootSrc = path.resolve(__dirname, "..", "src");
const rootDir = path.resolve(__dirname, "..");

if (!fs.existsSync(rootSrc)) {
    fs.mkdirSync(rootSrc, { recursive: true });
}

// 1. Helpers
fs.copyFileSync(path.join(e2Dir, "helpers.js"), path.join(rootSrc, "helpers.js"));
fs.copyFileSync(path.join(e2Dir, "helpers.js"), path.join(rootDir, "helpers.js"));

// 2. Parser
let parserCode = fs.readFileSync(path.join(e2Dir, "parser.js"), "utf8");
parserCode = parserCode.replace(
    'console.log("CT Operations Monitor parser loaded (EAST-2) — v11.3.3");',
    'const isEast3 = typeof window !== "undefined" && window.location && window.location.hostname.includes("east-3");\nconsole.log("CT Operations Monitor parser loaded (" + (isEast3 ? "EAST-3" : "EAST-2") + ") — v11.3.3");'
);
parserCode = parserCode.replace(
    'const regKey = "ct_east2_verified_campaign_filters_v1";',
    'const regKey = isEast3 ? "ct_east3_verified_campaign_filters_v1" : "ct_east2_verified_campaign_filters_v1";'
);
fs.writeFileSync(path.join(rootSrc, "parser.js"), parserCode, "utf8");
fs.writeFileSync(path.join(rootDir, "parser.js"), parserCode, "utf8");

// 3. Intelligence
let intelCode = fs.readFileSync(path.join(e2Dir, "intelligence.js"), "utf8");
intelCode = intelCode.replace(
    'this.dialer = options.dialer || "EAST-2";',
    'const isEast3 = typeof window !== "undefined" && window.location && window.location.hostname.includes("east-3");\n        this.dialer = options.dialer || (isEast3 ? "EAST-3" : "EAST-2");'
);
intelCode = intelCode.replace(
    'this.prefix = options.prefix || "ct_east2_";',
    'this.prefix = options.prefix || (isEast3 ? "ct_east3_" : "ct_east2_");'
);
fs.writeFileSync(path.join(rootSrc, "intelligence.js"), intelCode, "utf8");

// 4. CSS: combined
const css2 = fs.readFileSync(path.join(e2Dir, "dashboard.css"), "utf8");
const css3 = fs.readFileSync(path.join(e3Dir, "dashboard.css"), "utf8");
const combinedCss = css2 + "\n\n" + css3;
fs.writeFileSync(path.join(rootSrc, "dashboard.css"), combinedCss, "utf8");
fs.writeFileSync(path.join(rootDir, "dashboard.css"), combinedCss, "utf8");

// 5. Content.js: Dynamic host & event resolution
let contentCode = fs.readFileSync(path.join(e2Dir, "content.js"), "utf8");
contentCode = contentCode.replace(
    'console.log("CT Operations Monitor (EAST-2) — Production live feed controller v11.3.3");',
    'const isEast3 = typeof window !== "undefined" && window.location && window.location.hostname.includes("east-3");\nconsole.log("CT Operations Monitor (" + (isEast3 ? "EAST-3" : "EAST-2") + ") — Production live feed controller v11.3.3");'
);
contentCode = contentCode.replace('const TARGET_HOST = "east-2.calltools.io";', 'const TARGET_HOST = isEast3 ? "east-3.calltools.io" : "east-2.calltools.io";');
contentCode = contentCode.replace('const EDITION = "EAST-2";', 'const EDITION = isEast3 ? "EAST-3" : "EAST-2";');
contentCode = contentCode.replace('const VERIFIED_FILTERS_KEY = "ct_east2_verified_campaign_filters_v1";', 'const VERIFIED_FILTERS_KEY = isEast3 ? "ct_east3_verified_campaign_filters_v1" : "ct_east2_verified_campaign_filters_v1";');
contentCode = contentCode.replace('const LIVE_FILTERS_INVENTORY_KEY = "ct_east2_live_filters_inventory_v1";', 'const LIVE_FILTERS_INVENTORY_KEY = isEast3 ? "ct_east3_live_filters_inventory_v1" : "ct_east2_live_filters_inventory_v1";');
contentCode = contentCode.replace('const INBOUND_DATA_KEY = "ct_east2_last_known_queues_v1";', 'const INBOUND_DATA_KEY = isEast3 ? "ct_east3_last_known_queues_v1" : "ct_east2_last_known_queues_v1";');
contentCode = contentCode.replace('const INBOUND_STATUS_KEY = "ct_east2_inbound_feed_status_v1";', 'const INBOUND_STATUS_KEY = isEast3 ? "ct_east3_inbound_feed_status_v1" : "ct_east2_inbound_feed_status_v1";');
contentCode = contentCode.replace('const INBOUND_STORAGE_DATA_KEY = "ct_east2_inbound_data_v2";', 'const INBOUND_STORAGE_DATA_KEY = isEast3 ? "ct_east3_inbound_data_v2" : "ct_east2_inbound_data_v2";');
contentCode = contentCode.replace('const INBOUND_STORAGE_STATUS_KEY = "ct_east2_inbound_status_v2";', 'const INBOUND_STORAGE_STATUS_KEY = isEast3 ? "ct_east3_inbound_status_v2" : "ct_east2_inbound_status_v2";');
contentCode = contentCode.replace('const INBOUND_IFRAME_ID = "ct-operations-hidden-queue-feed-east2";', 'const INBOUND_IFRAME_ID = isEast3 ? "ct-operations-hidden-queue-feed-east3" : "ct-operations-hidden-queue-feed-east2";');
contentCode = contentCode.replace(
    'const INBOUND_IFRAME_URL = "https://east-2.calltools.io/manager/queues?ct_inbound_monitor=1&ct_inbound_owner=ctompro_east2";',
    'const INBOUND_IFRAME_URL = isEast3 ? "https://east-3.calltools.io/manager/queues?ct_inbound_monitor=1&ct_inbound_owner=ctompro_east3" : "https://east-2.calltools.io/manager/queues?ct_inbound_monitor=1&ct_inbound_owner=ctompro_east2";'
);
contentCode = contentCode.replaceAll('"CT_EAST_2_UPDATE"', 'isEast3 ? "CT_EAST_3_UPDATE" : "CT_EAST_2_UPDATE"');
contentCode = contentCode.replaceAll('"CT_EAST_2_FEED_STATUS"', 'isEast3 ? "CT_EAST_3_FEED_STATUS" : "CT_EAST_2_FEED_STATUS"');
contentCode = contentCode.replaceAll('"CT_EAST_2_REFRESH_INBOUND_FEED"', 'isEast3 ? "CT_EAST_3_REFRESH_INBOUND_FEED" : "CT_EAST_2_REFRESH_INBOUND_FEED"');
contentCode = contentCode.replaceAll('"CT_EAST_2_REQUEST_INBOUND_REFRESH"', 'isEast3 ? "CT_EAST_3_REQUEST_INBOUND_REFRESH" : "CT_EAST_2_REQUEST_INBOUND_REFRESH"');
contentCode = contentCode.replaceAll('"CT_EAST_2_REQUEST_REFRESH"', 'isEast3 ? "CT_EAST_3_REQUEST_REFRESH" : "CT_EAST_2_REQUEST_REFRESH"');

fs.writeFileSync(path.join(rootSrc, "content.js"), contentCode, "utf8");
fs.writeFileSync(path.join(rootDir, "content.js"), contentCode, "utf8");

// 6. Dashboard.js: Dynamic host, namespace & event resolution
let dashCode = fs.readFileSync(path.join(e2Dir, "dashboard.js"), "utf8");
dashCode = dashCode.replace(
    'console.log("Dashboard Loaded — CT Operations Monitor Pro (EAST-2) v11.3.3");',
    'const isEast3 = typeof window !== "undefined" && window.location && window.location.hostname.includes("east-3");\nconsole.log("Dashboard Loaded — CT Operations Monitor Pro (" + (isEast3 ? "EAST-3" : "EAST-2") + ") v11.3.3");'
);
dashCode = dashCode.replace('const TARGET_HOST = "east-2.calltools.io";', 'const TARGET_HOST = isEast3 ? "east-3.calltools.io" : "east-2.calltools.io";');
dashCode = dashCode.replace('const EDITION = "EAST-2";', 'const EDITION = isEast3 ? "EAST-3" : "EAST-2";');
dashCode = dashCode.replace('const DIALER = "EAST-2";', 'const DIALER = isEast3 ? "EAST-3" : "EAST-2";');
dashCode = dashCode.replace('const PREFIX = "ct_east2_";', 'const PREFIX = isEast3 ? "ct_east3_" : "ct_east2_";');
dashCode = dashCode.replace('const DASHBOARD_ID = "ct-operations-dashboard-east2";', 'const DASHBOARD_ID = isEast3 ? "ct-operations-dashboard-east3" : "ct-operations-dashboard-east2";');
dashCode = dashCode.replace('const STYLE_ID = "ct-operations-dashboard-styles-east2-v11-3-3";', 'const STYLE_ID = isEast3 ? "ct-operations-dashboard-styles-east3-v11-3-3" : "ct-operations-dashboard-styles-east2-v11-3-3";');
dashCode = dashCode.replace('const THEME_KEY = "ct_east2_dashboard_theme";', 'const THEME_KEY = isEast3 ? "ct_east3_dashboard_theme" : "ct_east2_dashboard_theme";');
dashCode = dashCode.replace('const CONTACT_THRESHOLD_KEY = "ct_east2_contact_threshold";', 'const CONTACT_THRESHOLD_KEY = isEast3 ? "ct_east3_contact_threshold" : "ct_east2_contact_threshold";');
dashCode = dashCode.replace('const ZOOM_KEY = "ct_east2_dashboard_zoom";', 'const ZOOM_KEY = isEast3 ? "ct_east3_dashboard_zoom" : "ct_east2_dashboard_zoom";');
dashCode = dashCode.replace('const LAYOUT_KEY = "ct_east2_dashboard_layout_v19";', 'const LAYOUT_KEY = isEast3 ? "ct_east3_dashboard_layout_v19" : "ct_east2_dashboard_layout_v19";');
dashCode = dashCode.replace('const LAYOUT_VERSION_KEY = "ct_east2_dashboard_layout_version";', 'const LAYOUT_VERSION_KEY = isEast3 ? "ct_east3_dashboard_layout_version" : "ct_east2_dashboard_layout_version";');
dashCode = dashCode.replace('const POS_X_KEY = "ct_east2_dashboard_pos_x";', 'const POS_X_KEY = isEast3 ? "ct_east3_dashboard_pos_x" : "ct_east2_dashboard_pos_x";');
dashCode = dashCode.replace('const POS_Y_KEY = "ct_east2_dashboard_pos_y";', 'const POS_Y_KEY = isEast3 ? "ct_east3_dashboard_pos_y" : "ct_east2_dashboard_pos_y";');
dashCode = dashCode.replace('const SIZE_W_KEY = "ct_east2_dashboard_size_w";', 'const SIZE_W_KEY = isEast3 ? "ct_east3_dashboard_size_w" : "ct_east2_dashboard_size_w";');
dashCode = dashCode.replace('const SIZE_H_KEY = "ct_east2_dashboard_size_h";', 'const SIZE_H_KEY = isEast3 ? "ct_east3_dashboard_size_h" : "ct_east2_dashboard_size_h";');
dashCode = dashCode.replace('const SEARCH_QUERY_KEY = "ct_east2_campaign_query_v1";', 'const SEARCH_QUERY_KEY = isEast3 ? "ct_east3_campaign_query_v1" : "ct_east2_campaign_query_v1";');
dashCode = dashCode.replace('const ORDER_KEY = "ct_east2_dashboard_campaign_order";', 'const ORDER_KEY = isEast3 ? "ct_east3_dashboard_campaign_order" : "ct_east2_dashboard_campaign_order";');
dashCode = dashCode.replace('const ORDER_META_KEY = "ct_east2_dashboard_campaign_order-meta";', 'const ORDER_META_KEY = isEast3 ? "ct_east3_dashboard_campaign_order-meta" : "ct_east2_dashboard_campaign_order-meta";');
dashCode = dashCode.replace('const DISMISSED_ALERTS_KEY = "ct_east2_dismissed_alerts_v3";', 'const DISMISSED_ALERTS_KEY = isEast3 ? "ct_east3_dismissed_alerts_v3" : "ct_east2_dismissed_alerts_v3";');
dashCode = dashCode.replace('const INBOUND_DATA_KEY = "ct_east2_last_known_queues_v1";', 'const INBOUND_DATA_KEY = isEast3 ? "ct_east3_last_known_queues_v1" : "ct_east2_last_known_queues_v1";');
dashCode = dashCode.replace('const INBOUND_STATUS_KEY = "ct_east2_inbound_feed_status_v1";', 'const INBOUND_STATUS_KEY = isEast3 ? "ct_east3_inbound_feed_status_v1" : "ct_east2_inbound_feed_status_v1";');
dashCode = dashCode.replace('const INBOUND_STORAGE_DATA_KEY = "ct_east2_inbound_data_v2";', 'const INBOUND_STORAGE_DATA_KEY = isEast3 ? "ct_east3_inbound_data_v2" : "ct_east2_inbound_data_v2";');
dashCode = dashCode.replace('const INBOUND_STORAGE_STATUS_KEY = "ct_east2_inbound_status_v2";', 'const INBOUND_STORAGE_STATUS_KEY = isEast3 ? "ct_east3_inbound_status_v2" : "ct_east2_inbound_status_v2";');
dashCode = dashCode.replace('const DIALER_ID = "east-2";', 'const DIALER_ID = isEast3 ? "east-3" : "east-2";');
dashCode = dashCode.replace('const DIALER_NAME = "East-2";', 'const DIALER_NAME = isEast3 ? "East-3" : "East-2";');
dashCode = dashCode.replace('const DIALER_TAG = "EAST-2";', 'const DIALER_TAG = isEast3 ? "EAST-3" : "EAST-2";');
dashCode = dashCode.replace('const UPDATE_EVENT = "CT_EAST_2_UPDATE";', 'const UPDATE_EVENT = isEast3 ? "CT_EAST_3_UPDATE" : "CT_EAST_2_UPDATE";');
dashCode = dashCode.replace('const FEED_STATUS_EVENT = "CT_EAST_2_FEED_STATUS";', 'const FEED_STATUS_EVENT = isEast3 ? "CT_EAST_3_FEED_STATUS" : "CT_EAST_2_FEED_STATUS";');
dashCode = dashCode.replace('const REQUEST_REFRESH_EVENT = "CT_EAST_2_REQUEST_REFRESH";', 'const REQUEST_REFRESH_EVENT = isEast3 ? "CT_EAST_3_REQUEST_REFRESH" : "CT_EAST_2_REQUEST_REFRESH";');
dashCode = dashCode.replace('const REQUEST_INBOUND_REFRESH_EVENT = "CT_EAST_2_REQUEST_INBOUND_REFRESH";', 'const REQUEST_INBOUND_REFRESH_EVENT = isEast3 ? "CT_EAST_3_REQUEST_INBOUND_REFRESH" : "CT_EAST_2_REQUEST_INBOUND_REFRESH";');
dashCode = dashCode.replace('const OPERATING_BASELINE_KEY = "ct_east2_operating_baseline_v1";', 'const OPERATING_BASELINE_KEY = isEast3 ? "ct_east3_operating_baseline_v1" : "ct_east2_operating_baseline_v1";');

dashCode = dashCode.replaceAll('"ct_east2_operating_campaign"', 'isEast3 ? "ct_east3_operating_campaign" : "ct_east2_operating_campaign"');
dashCode = dashCode.replaceAll('"ct_east2_last_known_queues_v1"', 'isEast3 ? "ct_east3_last_known_queues_v1" : "ct_east2_last_known_queues_v1"');
dashCode = dashCode.replaceAll('"ct_east2_last_known_campaigns_v1"', 'isEast3 ? "ct_east3_last_known_campaigns_v1" : "ct_east2_last_known_campaigns_v1"');
dashCode = dashCode.replaceAll('"ct_east2_operating_campaigns"', 'isEast3 ? "ct_east3_operating_campaigns" : "ct_east2_operating_campaigns"');

dashCode = dashCode.replace(
    '<h2>CallTools Operations <span class="ct-dialer-tag ct-dialer-east2">EAST-2</span></h2>',
    '<h2>CallTools Operations <span class="ct-dialer-tag " + (isEast3 ? "ct-dialer-east3" : "ct-dialer-east2") + "\">" + (isEast3 ? "EAST-3" : "EAST-2") + "</span></h2>'
);
dashCode = dashCode.replace(
    '<strong data-ref="lfiHealthDialer">EAST-2</strong>',
    '<strong data-ref="lfiHealthDialer">" + (isEast3 ? "EAST-3" : "EAST-2") + "</strong>'
);

fs.writeFileSync(path.join(rootSrc, "dashboard.js"), dashCode, "utf8");
fs.writeFileSync(path.join(rootDir, "dashboard.js"), dashCode, "utf8");

// 7. Update root manifest.json
const rootManifest = {
    "manifest_version": 3,
    "name": "CT Operations Monitor — Dual-Dialer (East-2 / East-3)",
    "version": "11.3.3",
    "description": "CallTools Operations Monitor Pro — unified outbound Campaigns + inbound Queue command center with persistent Sales/Goals alerts, native Queue DOM bridge, and CT Data Change Intelligence Engine.",
    "permissions": [
        "storage"
    ],
    "host_permissions": [
        "https://east-2.calltools.io/*",
        "https://east-3.calltools.io/*"
    ],
    "content_scripts": [
        {
            "matches": [
                "https://east-2.calltools.io/manager/campaigns*",
                "https://east-2.calltools.io/manager/queues*",
                "https://east-2.calltools.io/manager/live-filters*",
                "https://east-3.calltools.io/manager/campaigns*",
                "https://east-3.calltools.io/manager/queues*",
                "https://east-3.calltools.io/manager/live-filters*"
            ],
            "js": [
                "src/helpers.js",
                "src/parser.js",
                "src/intelligence.js",
                "src/dashboard.js",
                "src/content.js"
            ],
            "css": [
                "src/dashboard.css"
            ],
            "all_frames": true
        }
    ]
};
fs.writeFileSync(path.join(rootDir, "manifest.json"), JSON.stringify(rootManifest, null, 2), "utf8");

console.log("Root workspace successfully built with v11.3.3 Dual-Dialer support!");
