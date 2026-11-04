/**
 * security_reaudit.js
 * 
 * Verifies 0 fetch, 0 XHR, 0 WebSocket, 0 native .click(), 0 form submissions,
 * and host permission boundary compliance.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE');

const results = {
    timestamp: new Date().toISOString(),
    dialers: {}
};

['East2', 'East3'].forEach(d => {
    const isEast2 = d === 'East2';
    const targetHost = isEast2 ? 'east-2.calltools.io' : 'east-3.calltools.io';
    const forbiddenHost = isEast2 ? 'east-3.calltools.io' : 'east-2.calltools.io';
    const dir = path.join(root, 'CT_Operations_Monitor_' + d);

    const findings = {
        fetchCalls: 0,
        xhrCalls: 0,
        websocketCalls: 0,
        nativeClicks: 0,
        formSubmits: 0,
        forbiddenHostMentions: 0,
        allowedHostVerified: false,
        filesAudited: 0,
        status: 'PASS'
    };

    // Check manifest.json
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    const distManifest = JSON.parse(fs.readFileSync(path.join(dir, 'dist', 'manifest.json'), 'utf8'));

    const hostPerms = manifest.host_permissions || [];
    if (hostPerms.includes(`https://${targetHost}/*`) && !hostPerms.includes(`https://${forbiddenHost}/*`)) {
        findings.allowedHostVerified = true;
    } else {
        findings.status = 'FAIL';
        findings.hostPermError = `Invalid host permissions: ${JSON.stringify(hostPerms)}`;
    }

    // Inspect all JS files in src and dist/src
    ['src', 'dist/src'].forEach(sub => {
        const fullDir = path.join(dir, sub);
        fs.readdirSync(fullDir).forEach(f => {
            if (f.endsWith('.js')) {
                findings.filesAudited++;
                const code = fs.readFileSync(path.join(fullDir, f), 'utf8');

                // Check for network calls
                const fetchMatches = code.match(/\bfetch\s*\(/g);
                if (fetchMatches) findings.fetchCalls += fetchMatches.length;

                const xhrMatches = code.match(/new\s+XMLHttpRequest/g);
                if (xhrMatches) findings.xhrCalls += xhrMatches.length;

                const wsMatches = code.match(/new\s+WebSocket/g);
                if (wsMatches) findings.websocketCalls += wsMatches.length;

                // Check for clicks (excluding synthetic dispatchEvent)
                const clickMatches = code.match(/\.click\s*\(/g);
                if (clickMatches) findings.nativeClicks += clickMatches.length;

                // Check for form submit
                const submitMatches = code.match(/\.submit\s*\(/g);
                if (submitMatches) findings.formSubmits += submitMatches.length;

                // Check for cross-dialer host
                if (code.includes(forbiddenHost)) {
                    findings.forbiddenHostMentions++;
                }
            }
        });
    });

    if (
        findings.fetchCalls > 0 ||
        findings.xhrCalls > 0 ||
        findings.websocketCalls > 0 ||
        findings.nativeClicks > 0 ||
        findings.formSubmits > 0 ||
        findings.forbiddenHostMentions > 0 ||
        !findings.allowedHostVerified
    ) {
        findings.status = 'FAIL';
    }

    results.dialers[d] = findings;
    console.log(`Security Audit for ${d}:`, findings);
});

console.log("\nFINAL STATUS:", Object.values(results.dialers).every(f => f.status === 'PASS') ? 'ALL PASSED (100% READ-ONLY COMPLIANT)' : 'FAIL');

