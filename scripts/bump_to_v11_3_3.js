const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE');

['East2', 'East3'].forEach(d => {
    const dir = path.join(root, 'CT_Operations_Monitor_' + d);

    // Update manifest.json
    const manifestPath = path.join(dir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.version = '11.3.3';
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

    // Update dist/manifest.json
    const distManifestPath = path.join(dir, 'dist', 'manifest.json');
    const distManifest = JSON.parse(fs.readFileSync(distManifestPath, 'utf8'));
    distManifest.version = '11.3.3';
    fs.writeFileSync(distManifestPath, JSON.stringify(distManifest, null, 2) + '\n', 'utf8');

    // Update package.json
    const pkgPath = path.join(dir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.version = '11.3.3';
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

    console.log(`Bumped ${d} to v11.3.3 in manifest.json, dist/manifest.json, and package.json.`);
});

