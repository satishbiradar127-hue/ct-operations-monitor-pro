const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

console.log('--- PACKAGING v11.3.9 RELEASES ---');

const e2Dir = path.resolve('CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2');
const e3Dir = path.resolve('CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3');
const e2Dist = path.join(e2Dir, 'dist');
const e3Dist = path.join(e3Dir, 'dist');

// Sync manifest.json and all src/* files to dist/ for both East2 and East3
[e2Dir, e3Dir].forEach((d) => {
    const dist = path.join(d, 'dist');
    const distSrc = path.join(dist, 'src');
    const src = path.join(d, 'src');
    fs.mkdirSync(distSrc, { recursive: true });
    fs.copyFileSync(path.join(d, 'manifest.json'), path.join(dist, 'manifest.json'));
    fs.readdirSync(src).forEach((f) => {
        fs.copyFileSync(path.join(src, f), path.join(distSrc, f));
    });
});
console.log('Synchronized manifest.json and src/* to dist/ for East2 and East3 (11.3.9)');

function buildZip(sourceDir, zipPath) {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    const cmd = `Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${zipPath}' -Force`;
    execSync(`powershell -Command "${cmd}"`);
    const buf = fs.readFileSync(zipPath);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    return { size: buf.length, sha256: hash };
}

const pkgDir = path.resolve('CT_OPERATIONS_DUAL_DIALER_RELEASE/RELEASE_PACKAGES');
const permRelDir = path.resolve('releases/v11.3.9');
fs.mkdirSync(pkgDir, { recursive: true });
fs.mkdirSync(permRelDir, { recursive: true });

const e2Zip = path.join(pkgDir, 'CT_Operations_Monitor_East2.zip');
const e2vZip = path.join(pkgDir, 'CT_Operations_Monitor_East2_v11.3.9.zip');
const e3Zip = path.join(pkgDir, 'CT_Operations_Monitor_East3.zip');
const e3vZip = path.join(pkgDir, 'CT_Operations_Monitor_East3_v11.3.9.zip');

console.log('Building East-2 ZIPs ...');
const rE2 = buildZip(e2Dist, e2Zip);
fs.copyFileSync(e2Zip, e2vZip);

console.log('Building East-3 ZIPs ...');
const rE3 = buildZip(e3Dist, e3Zip);
fs.copyFileSync(e3Zip, e3vZip);

console.log('East-2:', rE2.size, 'bytes, SHA256:', rE2.sha256);
console.log('East-3:', rE3.size, 'bytes, SHA256:', rE3.sha256);

// Copy to dialer directories and permanent releases/v11.3.9 directory
fs.copyFileSync(e2Zip, path.join(e2Dir, 'CT_Operations_Monitor_East2.zip'));
fs.copyFileSync(e2vZip, path.join(e2Dir, 'CT_Operations_Monitor_East2_v11.3.9.zip'));
fs.copyFileSync(e3Zip, path.join(e3Dir, 'CT_Operations_Monitor_East3.zip'));
fs.copyFileSync(e3vZip, path.join(e3Dir, 'CT_Operations_Monitor_East3_v11.3.9.zip'));

fs.copyFileSync(e2vZip, path.join(permRelDir, 'CT_Operations_Monitor_East2_v11.3.9.zip'));
fs.copyFileSync(e3vZip, path.join(permRelDir, 'CT_Operations_Monitor_East3_v11.3.9.zip'));

// Write SHA256SUMS.txt
const sums = [
    rE2.sha256 + ' *CT_Operations_Monitor_East2.zip',
    rE2.sha256 + ' *CT_Operations_Monitor_East2_v11.3.9.zip',
    rE3.sha256 + ' *CT_Operations_Monitor_East3.zip',
    rE3.sha256 + ' *CT_Operations_Monitor_East3_v11.3.9.zip'
].join('\n') + '\n';

const permSums = [
    rE2.sha256 + ' *CT_Operations_Monitor_East2_v11.3.9.zip',
    rE3.sha256 + ' *CT_Operations_Monitor_East3_v11.3.9.zip'
].join('\n') + '\n';

fs.writeFileSync(path.join(pkgDir, 'SHA256SUMS.txt'), sums, 'utf8');
fs.writeFileSync(path.join(permRelDir, 'SHA256SUMS.txt'), permSums, 'utf8');
fs.writeFileSync('CT_OPERATIONS_DUAL_DIALER_RELEASE/QA_REPORTS/SHA256SUMS.txt', sums, 'utf8');
fs.writeFileSync('CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/SHA256SUMS.txt', sums, 'utf8');
fs.writeFileSync('CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3/SHA256SUMS.txt', sums, 'utf8');
console.log('SHA256SUMS.txt successfully updated in all directories including releases/v11.3.9.');
