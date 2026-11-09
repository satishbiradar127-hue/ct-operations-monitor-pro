const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

console.log('=== STARTING SYNC & BUILD FOR v11.3.9 ===');

const rootDir = path.resolve(__dirname, '..');
const rootSrc = path.join(rootDir, 'src');
const e2Dir = path.join(rootDir, 'CT_OPERATIONS_DUAL_DIALER_RELEASE', 'CT_Operations_Monitor_East2');
const e2Src = path.join(e2Dir, 'src');
const e2Dist = path.join(e2Dir, 'dist');
const e3Dir = path.join(rootDir, 'CT_OPERATIONS_DUAL_DIALER_RELEASE', 'CT_Operations_Monitor_East3');
const e3Src = path.join(e3Dir, 'src');
const e3Dist = path.join(e3Dir, 'dist');

const files = ['helpers.js', 'parser.js', 'intelligence.js', 'dashboard.js', 'dashboard.css', 'content.js'];

// 1. Copy src/ to East2/src/
console.log('1. Copying src/ to East2/src/ ...');
files.forEach(f => {
    const srcFile = path.join(rootSrc, f);
    const destFile = path.join(e2Src, f);
    if (fs.existsSync(srcFile)) {
        fs.copyFileSync(srcFile, destFile);
        console.log(`  Copied ${f} -> East2/src`);
    }
});

// 2. Make East-2 Pure
console.log('2. Purifying East-2 source ...');
['dashboard.js', 'content.js', 'parser.js', 'intelligence.js'].forEach(file => {
    const fPath = path.join(e2Src, file);
    if (!fs.existsSync(fPath)) return;
    let code = fs.readFileSync(fPath, 'utf8');

    // Remove isEast3 header if present
    code = code.replace(/const isEast3 = [^\n]+;\n/, '');
    
    // Replace isEast3 ternaries: isEast3 ? A : B -> B
    code = code.replace(/isEast3 \? [^:]+ : ("[^"]+")/g, '$1');
    code = code.replace(/isEast3 \? [^:]+ : ('[^']+')/g, '$1');

    // Specific replacements for dashboard.js
    if (file === 'dashboard.js') {
        code = code.replace(/console\.log\("Dashboard Loaded — CT Operations Monitor Pro \([^)]+\) v11\.[0-9]+\.[0-9]+"\);/, 'console.log("Dashboard Loaded — CT Operations Monitor Pro (EAST-2) v11.3.9");');
        code = code.replace(/const TARGET_HOST = [^\n]+;/, 'const TARGET_HOST = "east-2.calltools.io";');
        code = code.replace(/const EDITION = [^\n]+;/, 'const EDITION = "EAST-2";');
        code = code.replace(/const DIALER = [^\n]+;/, 'const DIALER = "EAST-2";');
        code = code.replace(/const PREFIX = [^\n]+;/, 'const PREFIX = "ct_east2_";');
        code = code.replace(/const DASHBOARD_ID = [^\n]+;/, 'const DASHBOARD_ID = "ct-operations-dashboard-east2";');
        code = code.replace(/const STYLE_ID = [^\n]+;/, 'const STYLE_ID = "ct-operations-dashboard-styles-east2-v11-3-3";');
        code = code.replace(/const THEME_KEY = [^\n]+;/, 'const THEME_KEY = "ct_east2_dashboard_theme";');
        code = code.replace(/const CONTACT_THRESHOLD_KEY = [^\n]+;/, 'const CONTACT_THRESHOLD_KEY = "ct_east2_contact_threshold";');
        code = code.replace(/const ZOOM_KEY = [^\n]+;/, 'const ZOOM_KEY = "ct_east2_dashboard_zoom";');
        code = code.replace(/const LAYOUT_KEY = [^\n]+;/, 'const LAYOUT_KEY = "ct_east2_dashboard_layout_v20";');
        code = code.replace(/const LAYOUT_VERSION_KEY = [^\n]+;/, 'const LAYOUT_VERSION_KEY = "ct_east2_dashboard_layout_version";');
        code = code.replace(/const SELECTED_CAMPAIGNS_KEY = [^\n]+;/, 'const SELECTED_CAMPAIGNS_KEY = "ct_east2_selected_campaign_ids_v1";');
        code = code.replace(/const FILTER_STATE_KEY = [^\n]+;/, 'const FILTER_STATE_KEY = "ct_east2_campaign_state_filter_v1";');
        code = code.replace(/const FILTER_HEALTH_KEY = [^\n]+;/, 'const FILTER_HEALTH_KEY = "ct_east2_campaign_health_filter_v1";');
        code = code.replace(/const SEARCH_QUERY_KEY = [^\n]+;/, 'const SEARCH_QUERY_KEY = "ct_east2_campaign_query_v1";');
        code = code.replace(/const ORDER_KEY = [^\n]+;/, 'const ORDER_KEY = "ct_east2_dashboard_campaign_order";');
        code = code.replace(/const ORDER_META_KEY = [^\n]+;/, 'const ORDER_META_KEY = "ct_east2_dashboard_campaign_order-meta";');
        code = code.replace(/const DISMISSED_ALERTS_KEY = [^\n]+;/, 'const DISMISSED_ALERTS_KEY = "ct_east2_dismissed_alerts_v3";');
        code = code.replace(/const INBOUND_DATA_KEY = [^\n]+;/, 'const INBOUND_DATA_KEY = "ct_east2_last_known_queues_v1";');
        code = code.replace(/const INBOUND_STATUS_KEY = [^\n]+;/, 'const INBOUND_STATUS_KEY = "ct_east2_inbound_feed_status_v1";');
        code = code.replace(/const INBOUND_STORAGE_DATA_KEY = [^\n]+;/, 'const INBOUND_STORAGE_DATA_KEY = "ct_east2_inbound_data_v2";');
        code = code.replace(/const INBOUND_STORAGE_STATUS_KEY = [^\n]+;/, 'const INBOUND_STORAGE_STATUS_KEY = "ct_east2_inbound_status_v2";');
        code = code.replace(/const DIALER_ID = [^\n]+;/, 'const DIALER_ID = "east-2";');
        code = code.replace(/const DIALER_NAME = [^\n]+;/, 'const DIALER_NAME = "East-2";');
        code = code.replace(/const DIALER_TAG = [^\n]+;/, 'const DIALER_TAG = "EAST-2";');
        code = code.replace(/const UPDATE_EVENT = [^\n]+;/, 'const UPDATE_EVENT = "CT_EAST_2_UPDATE";');
        code = code.replace(/const FEED_STATUS_EVENT = [^\n]+;/, 'const FEED_STATUS_EVENT = "CT_EAST_2_FEED_STATUS";');
        code = code.replace(/const REQUEST_REFRESH_EVENT = [^\n]+;/, 'const REQUEST_REFRESH_EVENT = "CT_EAST_2_REQUEST_REFRESH";');
        code = code.replace(/const REFRESH_RESULT_EVENT = [^\n]+;/, 'const REFRESH_RESULT_EVENT = "CT_EAST_2_REFRESH_RESULT";');
        code = code.replace(/const REQUEST_INBOUND_REFRESH_EVENT = [^\n]+;/, 'const REQUEST_INBOUND_REFRESH_EVENT = "CT_EAST_2_REQUEST_INBOUND_REFRESH";');
        code = code.replace(/const OPERATING_BASELINE_KEY = [^\n]+;/, 'const OPERATING_BASELINE_KEY = "ct_east2_operating_baseline_v1";');
        code = code.replace(/const VERIFIED_FILTERS_KEY = [^\n]+;/, 'const VERIFIED_FILTERS_KEY = "ct_east2_verified_campaign_filters_v1";');
        code = code.replace(/const LIVE_FILTERS_INVENTORY_KEY = [^\n]+;/, 'const LIVE_FILTERS_INVENTORY_KEY = "ct_east2_live_filters_inventory_v1";');
    }

    // Specific replacements for content.js
    if (file === 'content.js') {
        code = code.replace(/console\.log\("CT Operations Monitor feed observer loaded \([^)]+\) — v11\.[0-9]+\.[0-9]+"\);/, 'console.log("CT Operations Monitor feed observer loaded (EAST-2) — v11.3.9");');
        code = code.replace(/const EDITION = [^\n]+;/, 'const EDITION = "EAST-2";');
        code = code.replace(/const DIALER = [^\n]+;/, 'const DIALER = "EAST-2";');
        code = code.replace(/const TARGET_HOST = [^\n]+;/, 'const TARGET_HOST = "east-2.calltools.io";');
        code = code.replace(/const INBOUND_DATA_KEY = [^\n]+;/, 'const INBOUND_DATA_KEY = "ct_east2_last_known_queues_v1";');
        code = code.replace(/const INBOUND_STATUS_KEY = [^\n]+;/, 'const INBOUND_STATUS_KEY = "ct_east2_inbound_feed_status_v1";');
        code = code.replace(/const INBOUND_STORAGE_DATA_KEY = [^\n]+;/, 'const INBOUND_STORAGE_DATA_KEY = "ct_east2_inbound_data_v2";');
        code = code.replace(/const INBOUND_STORAGE_STATUS_KEY = [^\n]+;/, 'const INBOUND_STORAGE_STATUS_KEY = "ct_east2_inbound_status_v2";');
        code = code.replace(/const FEED_STATUS_KEY = [^\n]+;/, 'const FEED_STATUS_KEY = "ct_east2_feed_status_v1";');
        code = code.replace(/const VERIFIED_FILTERS_KEY = [^\n]+;/, 'const VERIFIED_FILTERS_KEY = "ct_east2_verified_campaign_filters_v1";');
        code = code.replace(/const LIVE_FILTERS_INVENTORY_KEY = [^\n]+;/, 'const LIVE_FILTERS_INVENTORY_KEY = "ct_east2_live_filters_inventory_v1";');
        code = code.replace(/const INBOUND_IFRAME_ID = [^\n]+;/, 'const INBOUND_IFRAME_ID = "ct-operations-hidden-queue-feed-east2";');
        code = code.replace(/const INBOUND_IFRAME_URL = [^\n]+;/, 'const INBOUND_IFRAME_URL = "https://east-2.calltools.io/manager/queues?ct_inbound_monitor=1&ct_inbound_owner=ctompro_east2";');
        code = code.replace(/CT_EAST_3_/g, 'CT_EAST_2_');
        code = code.replace(/ct_east3_/g, 'ct_east2_');
    }

    // Specific replacements for parser.js
    if (file === 'parser.js') {
        code = code.replace(/console\.log\("CT Operations Monitor parser loaded \([^)]+\) — v11\.[0-9]+\.[0-9]+"\);/, 'console.log("CT Operations Monitor parser loaded (EAST-2) — v11.3.9");');
        code = code.replace(/isEast3Env \? "ct_east3_live_filters_inventory_v1" : "ct_east2_live_filters_inventory_v1"/g, '"ct_east2_live_filters_inventory_v1"');
        code = code.replace(/const regKey = isEast3 \? "ct_east3_verified_campaign_filters_v1" : "ct_east2_verified_campaign_filters_v1";/g, 'const regKey = "ct_east2_verified_campaign_filters_v1";');
    }

    fs.writeFileSync(fPath, code, 'utf8');
    console.log(`  Purified East-2: ${file}`);
});

// 3. Run sync_east2_to_east3.py
console.log('3. Running python scripts/sync_east2_to_east3.py ...');
try {
    const out = execSync('python scripts/sync_east2_to_east3.py', { encoding: 'utf8' });
    console.log('  ' + out.trim());
} catch (e) {
    console.error('Error running sync_east2_to_east3.py:', e.message);
    process.exit(1);
}

// 4. Sync src to dist for both East2 and East3
console.log('4. Syncing src/ to dist/ for East2 and East3 ...');
[
    { src: e2Src, dist: path.join(e2Dist, 'src'), distRoot: e2Dist, label: 'East2' },
    { src: e3Src, dist: path.join(e3Dist, 'src'), distRoot: e3Dist, label: 'East3' }
].forEach(({ src, dist, distRoot, label }) => {
    if (!fs.existsSync(dist)) fs.mkdirSync(dist, { recursive: true });
    files.forEach(f => {
        const s = path.join(src, f);
        const d = path.join(dist, f);
        if (fs.existsSync(s)) {
            fs.copyFileSync(s, d);
        }
    });
    // Also copy manifest to dist
    const mSrc = path.join(path.dirname(src), 'manifest.json');
    const mDist = path.join(distRoot, 'manifest.json');
    if (fs.existsSync(mSrc)) {
        fs.copyFileSync(mSrc, mDist);
    }
    console.log(`  [${label}] Synced src -> dist/src and manifest.json`);
});

// 5. Update manifests and package.json to 11.3.9
console.log('5. Bumping versions to 11.3.9 across all manifests and package.json ...');
const manifests = [
    path.join(rootDir, 'manifest.json'),
    path.join(e2Dir, 'manifest.json'),
    path.join(e2Dist, 'manifest.json'),
    path.join(e3Dir, 'manifest.json'),
    path.join(e3Dist, 'manifest.json')
];
manifests.forEach(mPath => {
    if (fs.existsSync(mPath)) {
        const m = JSON.parse(fs.readFileSync(mPath, 'utf8'));
        m.version = '11.3.9';
        fs.writeFileSync(mPath, JSON.stringify(m, null, 2) + '\n', 'utf8');
        console.log(`  Updated ${path.relative(rootDir, mPath)} to 11.3.9`);
    }
});

const pkgPath = path.join(rootDir, 'package.json');
if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.version = '11.3.9';
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log('  Updated package.json to 11.3.9');
}

console.log('=== SYNC & BUILD COMPLETED SUCCESSFULLY ===');
