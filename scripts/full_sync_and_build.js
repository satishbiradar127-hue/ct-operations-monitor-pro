const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('--- STARTING FULL SYNC & BUILD FOR v11.3.8 ---');

const rootSrc = path.resolve(__dirname, '..', 'src');
const e2Src = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE', 'CT_Operations_Monitor_East2', 'src');
const e2Dist = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE', 'CT_Operations_Monitor_East2', 'dist', 'src');
const e3Src = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE', 'CT_Operations_Monitor_East3', 'src');
const e3Dist = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE', 'CT_Operations_Monitor_East3', 'dist', 'src');

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

// 2. Run sync_east2_to_east3.py
console.log('2. Running python scripts/sync_east2_to_east3.py ...');
try {
    const out = execSync('python scripts/sync_east2_to_east3.py', { encoding: 'utf8' });
    console.log(out.trim());
} catch (e) {
    console.error('Error running sync_east2_to_east3.py:', e.message);
    process.exit(1);
}

// 3. Sync src to dist for both East2 and East3
console.log('3. Syncing src/ to dist/ for East2 and East3 ...');
[
    { src: e2Src, dist: e2Dist, label: 'East2' },
    { src: e3Src, dist: e3Dist, label: 'East3' }
].forEach(({ src, dist, label }) => {
    if (!fs.existsSync(dist)) fs.mkdirSync(dist, { recursive: true });
    files.forEach(f => {
        const s = path.join(src, f);
        const d = path.join(dist, f);
        if (fs.existsSync(s)) {
            fs.copyFileSync(s, d);
            console.log(`  [${label}] Copied ${f} -> dist/src`);
        }
    });
});

// 4. Update manifests to 11.3.8
console.log('4. Verifying manifest versions ...');
const manifests = [
    path.resolve(__dirname, '..', 'manifest.json'),
    path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE', 'CT_Operations_Monitor_East2', 'manifest.json'),
    path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE', 'CT_Operations_Monitor_East3', 'manifest.json')
];
manifests.forEach(mPath => {
    if (fs.existsSync(mPath)) {
        const m = JSON.parse(fs.readFileSync(mPath, 'utf8'));
        m.version = '11.3.8';
        fs.writeFileSync(mPath, JSON.stringify(m, null, 2) + '\n', 'utf8');
        console.log(`  Updated ${path.basename(path.dirname(mPath))}/${path.basename(mPath)} to 11.3.8`);
    }
});

console.log('--- SYNC & BUILD COMPLETE ---');

