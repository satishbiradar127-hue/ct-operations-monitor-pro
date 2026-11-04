const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE', 'RELEASE_PACKAGES');

['East2', 'East3'].forEach(d => {
    const zipPath = path.join(root, 'CT_Operations_Monitor_' + d + '.zip');
    console.log(`=== ZIP INSPECTION: ${d} ===`);
    const fileList = execSync(`tar -tf "${zipPath}"`, { encoding: 'utf8' }).trim().split('\n').map(s => s.trim());
    console.log(`File Count: ${fileList.length}`);
    console.log(`Included Files:\n  ${fileList.join('\n  ')}`);
    
    // Extract manifest to inspect
    const manifestContent = execSync(`tar -xOf "${zipPath}" manifest.json`, { encoding: 'utf8' });
    const manifest = JSON.parse(manifestContent);
    console.log(`Name: ${manifest.name}`);
    console.log(`Version: ${manifest.version}`);
    console.log(`Permissions: ${JSON.stringify(manifest.permissions)}`);
    console.log(`Host Permissions: ${JSON.stringify(manifest.host_permissions)}`);
    console.log(`Content Scripts Matches: ${JSON.stringify(manifest.content_scripts[0].matches)}`);
    console.log(`Content Scripts JS: ${JSON.stringify(manifest.content_scripts[0].js)}`);
    console.log(`Content Scripts CSS: ${JSON.stringify(manifest.content_scripts[0].css)}`);
    const otherHost = d === 'East2' ? 'east-3' : 'east-2';
    const leaked = manifest.host_permissions.some(h => h.includes(otherHost)) ||
                   manifest.content_scripts[0].matches.some(m => m.includes(otherHost));
    console.log(`Has Leaked Other Dialer Host? ${leaked ? 'YES (FAIL)' : 'NO (STRICT PASS)'}`);
    console.log('-------------------------------------------\n');
});
