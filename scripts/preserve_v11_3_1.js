const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE');
const pkgBackup = path.join(root, 'PRESERVED_V11.3.1_PACKAGES');
const srcBackup = path.join(root, 'PRESERVED_V11.3.1_SOURCE');

if (!fs.existsSync(pkgBackup)) fs.mkdirSync(pkgBackup, { recursive: true });
if (!fs.existsSync(srcBackup)) fs.mkdirSync(srcBackup, { recursive: true });

function copyRecursive(src, dest) {
    if (fs.statSync(src).isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(child => copyRecursive(path.join(src, child), path.join(dest, child)));
    } else {
        fs.copyFileSync(src, dest);
    }
}

function sha256(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// 1. Preserve v11.3.1 release zips
const zips = ['CT_Operations_Monitor_East2.zip', 'CT_Operations_Monitor_East3.zip'];
const hashes = [];

zips.forEach(z => {
    const srcZip = path.join(root, 'RELEASE_PACKAGES', z);
    const destZip = path.join(pkgBackup, z);
    fs.copyFileSync(srcZip, destZip);
    const h = sha256(destZip);
    hashes.push(`${h}  ${z}`);
    console.log(`Preserved ${z} -> ${pkgBackup} (${h})`);
});

fs.writeFileSync(path.join(pkgBackup, 'SHA256SUMS.txt'), hashes.join('\n') + '\n', 'utf8');

// 2. Preserve v11.3.1 source trees
['CT_Operations_Monitor_East2', 'CT_Operations_Monitor_East3'].forEach(d => {
    const srcTree = path.join(root, d);
    const destTree = path.join(srcBackup, d);
    copyRecursive(srcTree, destTree);
    console.log(`Preserved full source tree: ${d} -> ${destTree}`);
});

console.log("Phase 0: Preservation of v11.3.1 packages and sources completed successfully.");

