/**
 * build_v11_3_3_packages.js
 * 
 * Packages the v11.3.3 extensions into RELEASE_PACKAGES/
 * Preserves mirrors in PRESERVED_V11.3.3_PACKAGES and PRESERVED_V11.3.3_SOURCE
 * and generates SHA256SUMS.txt.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE');
const releaseDir = path.join(root, 'RELEASE_PACKAGES');
const p1133Pkg = path.join(root, 'PRESERVED_V11.3.3_PACKAGES');
const p1133Src = path.join(root, 'PRESERVED_V11.3.3_SOURCE');

if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });
if (!fs.existsSync(p1133Pkg)) fs.mkdirSync(p1133Pkg, { recursive: true });
if (!fs.existsSync(p1133Src)) fs.mkdirSync(p1133Src, { recursive: true });

function sha256File(filePath) {
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

const dialers = ['East2', 'East3'];
const hashes = [];

dialers.forEach(d => {
    const projDir = path.join(root, 'CT_Operations_Monitor_' + d);
    const zipName = `CT_Operations_Monitor_${d}.zip`;
    const versionedZipName = `CT_Operations_Monitor_${d}_v11.3.3.zip`;
    const zipPath = path.join(releaseDir, zipName);
    const versionedZipPath = path.join(releaseDir, versionedZipName);

    // Remove existing zip if present in RELEASE_PACKAGES
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    if (fs.existsSync(versionedZipPath)) fs.unlinkSync(versionedZipPath);

    console.log(`Packaging ${d} into ${zipName}...`);

    // Ensure README.md exists in project root
    const readmePath = path.join(projDir, 'README.md');
    fs.writeFileSync(readmePath, `# CT Operations Monitor — ${d}\nVersion 11.3.3\nObserver-only monitor for CallTools ${d.toLowerCase()}.\nTotal Goals Reconciliation & Precision.\n`, 'utf8');

    // Include: manifest.json, package.json, README.md, src, dist, tests, assets
    const itemsToCompress = ['manifest.json', 'package.json', 'README.md', 'src', 'dist', 'tests', 'assets']
        .map(item => `'${path.join(projDir, item)}'`)
        .filter(p => fs.existsSync(p.replace(/'/g, '')))
        .join(', ');

    const psCmd = `powershell -NoProfile -Command "Compress-Archive -Path ${itemsToCompress} -DestinationPath '${zipPath}' -Force"`;
    execSync(psCmd, { stdio: 'inherit' });

    // Copy to versioned ZIP name
    fs.copyFileSync(zipPath, versionedZipPath);

    // Also mirror to PRESERVED_V11.3.3_PACKAGES
    fs.copyFileSync(zipPath, path.join(p1133Pkg, zipName));
    fs.copyFileSync(versionedZipPath, path.join(p1133Pkg, versionedZipName));

    // Mirror source to PRESERVED_V11.3.3_SOURCE
    const srcDest = path.join(p1133Src, 'CT_Operations_Monitor_' + d);
    if (!fs.existsSync(srcDest)) {
        fs.cpSync(projDir, srcDest, { recursive: true });
    }

    const hash = sha256File(zipPath);
    const vHash = sha256File(versionedZipPath);

    hashes.push(`${hash}  ${zipName}`);
    hashes.push(`${vHash}  ${versionedZipName}`);

    console.log(`Created ${zipName}: ${hash} (${fs.statSync(zipPath).size} bytes)`);
});

const shaSumsContent = hashes.join('\n') + '\n';
fs.writeFileSync(path.join(releaseDir, 'SHA256SUMS.txt'), shaSumsContent, 'utf8');

// Also save in QA_REPORTS/
const qaDir = path.join(root, 'QA_REPORTS');
if (!fs.existsSync(qaDir)) fs.mkdirSync(qaDir, { recursive: true });
fs.writeFileSync(path.join(qaDir, 'SHA256SUMS.txt'), shaSumsContent, 'utf8');

console.log("SHA256SUMS.txt written successfully.");
console.log(shaSumsContent);

