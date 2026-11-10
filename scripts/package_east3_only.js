const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

console.log('--- PACKAGING EAST-3 ONLY (EAST-2 STRICTLY UNTOUCHED) ---');

const e3Dir = path.resolve('CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3');
const e3Dist = path.join(e3Dir, 'dist');

function buildZip(sourceDir, zipPath) {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    const cmd = `Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${zipPath}' -Force`;
    execSync(`powershell -Command "${cmd}"`);
    const buf = fs.readFileSync(zipPath);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    return { size: buf.length, sha256: hash };
}

const pkgDir = path.resolve('CT_OPERATIONS_DUAL_DIALER_RELEASE/RELEASE_PACKAGES');
fs.mkdirSync(pkgDir, { recursive: true });

const e3Zip = path.join(pkgDir, 'CT_Operations_Monitor_East3.zip');
const e3vZip = path.join(pkgDir, 'CT_Operations_Monitor_East3_v11.3.9.zip');

console.log('Building East-3 ZIPs ...');
const rE3 = buildZip(e3Dist, e3Zip);
fs.copyFileSync(e3Zip, e3vZip);

console.log('East-3 size:', rE3.size, 'bytes, SHA256:', rE3.sha256);

// Copy to East-3 dialer directory
fs.copyFileSync(e3Zip, path.join(e3Dir, 'CT_Operations_Monitor_East3.zip'));
fs.copyFileSync(e3vZip, path.join(e3Dir, 'CT_Operations_Monitor_East3_v11.3.9.zip'));

// Read existing SHA256SUMS to preserve East-2 checksum
let e2Hash = '4b1dc71a2ecce20fbfba99806374f1b51900d11f6c7c250c22faeb3b60f1bc83';
const curSumsPath = path.join(pkgDir, 'SHA256SUMS.txt');
if (fs.existsSync(curSumsPath)) {
    const lines = fs.readFileSync(curSumsPath, 'utf8').split('\n');
    const e2Line = lines.find(l => l.includes('CT_Operations_Monitor_East2.zip'));
    if (e2Line) {
        e2Hash = e2Line.split(' ')[0].trim();
    }
}

const sums = [
    e2Hash + ' *CT_Operations_Monitor_East2.zip',
    e2Hash + ' *CT_Operations_Monitor_East2_v11.3.9.zip',
    rE3.sha256 + ' *CT_Operations_Monitor_East3.zip',
    rE3.sha256 + ' *CT_Operations_Monitor_East3_v11.3.9.zip'
].join('\n') + '\n';

fs.writeFileSync(path.join(pkgDir, 'SHA256SUMS.txt'), sums, 'utf8');
fs.writeFileSync('CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3/SHA256SUMS.txt', sums, 'utf8');
console.log('✔ East-3 packages and checksums updated successfully.');

