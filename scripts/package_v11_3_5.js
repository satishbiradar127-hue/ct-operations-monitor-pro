const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

function buildZip(sourceDir, zipPath) {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    // Use powershell Compress-Archive with single-quoted paths
    const cmd = `Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${zipPath}' -Force`;
    execSync(`powershell -Command "${cmd}"`);
    const buf = fs.readFileSync(zipPath);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    return { size: buf.length, sha256: hash };
}

const e2Dist = path.resolve('CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/dist');
const e3Dist = path.resolve('CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3/dist');

const pkgDir = path.resolve('CT_OPERATIONS_DUAL_DIALER_RELEASE/RELEASE_PACKAGES');
fs.mkdirSync(pkgDir, { recursive: true });

const e2Zip = path.join(pkgDir, 'CT_Operations_Monitor_East2.zip');
const e2vZip = path.join(pkgDir, 'CT_Operations_Monitor_East2_v11.3.5.zip');
const e3Zip = path.join(pkgDir, 'CT_Operations_Monitor_East3.zip');
const e3vZip = path.join(pkgDir, 'CT_Operations_Monitor_East3_v11.3.5.zip');

const rE2 = buildZip(e2Dist, e2Zip);
fs.copyFileSync(e2Zip, e2vZip);

const rE3 = buildZip(e3Dist, e3Zip);
fs.copyFileSync(e3Zip, e3vZip);

console.log('East-2:', rE2.size, 'bytes, SHA256:', rE2.sha256);
console.log('East-3:', rE3.size, 'bytes, SHA256:', rE3.sha256);

// Also copy to dialer directories
fs.copyFileSync(e2Zip, path.resolve('CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/CT_Operations_Monitor_East2.zip'));
fs.copyFileSync(e2vZip, path.resolve('CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/CT_Operations_Monitor_East2_v11.3.5.zip'));
fs.copyFileSync(e3Zip, path.resolve('CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3/CT_Operations_Monitor_East3.zip'));
fs.copyFileSync(e3vZip, path.resolve('CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3/CT_Operations_Monitor_East3_v11.3.5.zip'));

// Write SHA256SUMS.txt
const sums = [
    rE2.sha256 + ' *CT_Operations_Monitor_East2.zip',
    rE2.sha256 + ' *CT_Operations_Monitor_East2_v11.3.5.zip',
    rE3.sha256 + ' *CT_Operations_Monitor_East3.zip',
    rE3.sha256 + ' *CT_Operations_Monitor_East3_v11.3.5.zip'
].join('\n') + '\n';

fs.writeFileSync(path.join(pkgDir, 'SHA256SUMS.txt'), sums, 'utf8');
fs.writeFileSync('CT_OPERATIONS_DUAL_DIALER_RELEASE/QA_REPORTS/SHA256SUMS.txt', sums, 'utf8');
fs.writeFileSync('CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/SHA256SUMS.txt', sums, 'utf8');
fs.writeFileSync('CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3/SHA256SUMS.txt', sums, 'utf8');
console.log('SHA256SUMS.txt successfully updated in all directories.');
