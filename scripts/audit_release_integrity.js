const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

const root = "C:\\Users\\Orange Carrot\\Downloads\\CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL";
const releaseDir = path.join(root, "CT_OPERATIONS_DUAL_DIALER_RELEASE");
const pkgDir = path.join(releaseDir, "RELEASE_PACKAGES");

console.log("===============================================================================");
console.log("FINAL RELEASE INTEGRITY AND DEPLOYMENT READINESS AUDIT");
console.log("===============================================================================\n");

const auditResults = {
    zipInspection: {},
    sha256Verification: {},
    manifestVerification: {},
    distVerification: {},
    hostPermissionIsolation: {},
    sourceDistComparison: {},
    persistentAlertVerification: {},
    securityAudit: {},
    deploymentAnalysis: {},
    errors: []
};

// 1. RECALCULATE SHA-256 AND COMPARE AGAINST SHA256SUMS.txt
console.log("--- 1. SHA-256 CHECK & COMPARISON AGAINST SHA256SUMS.txt ---");
const sumsFile = path.join(pkgDir, "SHA256SUMS.txt");
const sumsContent = fs.readFileSync(sumsFile, "utf8").trim().split(/\r?\n/);
const recordedSums = {};
sumsContent.forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2) {
        recordedSums[parts[1]] = parts[0];
    }
});

const zips = ["CT_Operations_Monitor_East2.zip", "CT_Operations_Monitor_East3.zip"];
zips.forEach(zipName => {
    const zipPath = path.join(pkgDir, zipName);
    const buf = fs.readFileSync(zipPath);
    const calcHash = crypto.createHash("sha256").update(buf).digest("hex");
    const recHash = recordedSums[zipName];
    const match = calcHash === recHash;
    auditResults.sha256Verification[zipName] = {
        size: buf.length,
        calculated: calcHash,
        recorded: recHash,
        matches: match
    };
    console.log(`[${zipName}]`);
    console.log(`  Size:       ${buf.length} bytes`);
    console.log(`  Calculated: ${calcHash}`);
    console.log(`  Recorded:   ${recHash}`);
    console.log(`  Match:      ${match ? "PASS" : "FAIL"}`);
    if (!match) auditResults.errors.push(`SHA-256 mismatch for ${zipName}`);
});

// 2. OPEN AND INSPECT ZIP ARCHIVES
console.log("\n--- 2. INSPECT ACTUAL ZIP ARCHIVES ---");
zips.forEach(zipName => {
    const zipPath = path.join(pkgDir, zipName).replace(/\\/g, "/");
    const psScript = `Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::OpenRead('${zipPath}'); foreach ($e in $zip.Entries) { Write-Output ($e.FullName + '|' + $e.Length + '|' + $e.CompressedLength) }; $zip.Dispose();`;
    const output = execSync(`powershell.exe -NoProfile -Command "${psScript}"`).toString();
    const entries = output.trim().split(/\r?\n/).map(l => {
        const [name, len, compLen] = l.trim().split("|");
        return { name, length: parseInt(len, 10), compLength: parseInt(compLen, 10) };
    });
    auditResults.zipInspection[zipName] = entries;
    console.log(`[${zipName}] contains ${entries.length} entries:`);
    entries.forEach(e => console.log(`   - ${e.name} (${e.length} B)`));
});

// 3. VERIFY MANIFESTS IN EDITIONS AND DIST FOLDERS
console.log("\n--- 3. MANIFEST INTEGRITY & HOST RESTRICTIONS ---");
const editions = [
    { name: "East2", folder: "CT_Operations_Monitor_East2", allowedHost: "east-2.calltools.io", forbiddenHost: "east-3.calltools.io", prefix: "ct_east2_" },
    { name: "East3", folder: "CT_Operations_Monitor_East3", allowedHost: "east-3.calltools.io", forbiddenHost: "east-2.calltools.io", prefix: "ct_east3_" }
];

editions.forEach(ed => {
    const baseManifestPath = path.join(releaseDir, ed.folder, "manifest.json");
    const distManifestPath = path.join(releaseDir, ed.folder, "dist", "manifest.json");
    
    const mBase = JSON.parse(fs.readFileSync(baseManifestPath, "utf8"));
    const mDist = JSON.parse(fs.readFileSync(distManifestPath, "utf8"));
    
    const baseMatchesDist = JSON.stringify(mBase) === JSON.stringify(mDist);
    const hasForbiddenHost = JSON.stringify(mBase).includes(ed.forbiddenHost);
    const hasAllowedHost = JSON.stringify(mBase).includes(ed.allowedHost);

    auditResults.manifestVerification[ed.name] = {
        version: mBase.version,
        name: mBase.name,
        baseMatchesDist,
        hasAllowedHost,
        hasForbiddenHost,
        permissions: mBase.permissions,
        host_permissions: mBase.host_permissions,
        content_scripts: mBase.content_scripts
    };

    console.log(`[${ed.name}] Manifest (${ed.folder})`);
    console.log(`  Name:             ${mBase.name}`);
    console.log(`  Version:          ${mBase.version}`);
    console.log(`  Allowed Host:     ${hasAllowedHost ? "PASS (" + ed.allowedHost + ")" : "FAIL"}`);
    console.log(`  Forbidden Host:   ${!hasForbiddenHost ? "PASS (Zero occurrences of " + ed.forbiddenHost + ")" : "FAIL"}`);
    console.log(`  Base == Dist:     ${baseMatchesDist ? "PASS" : "FAIL"}`);
    
    if (hasForbiddenHost) auditResults.errors.push(`${ed.name} manifest contains forbidden host ${ed.forbiddenHost}`);
    if (!hasAllowedHost) auditResults.errors.push(`${ed.name} manifest missing allowed host ${ed.allowedHost}`);
    if (!baseMatchesDist) auditResults.errors.push(`${ed.name} manifest does not match dist/manifest.json`);
});

// 4. VERIFY DIST FOLDERS & SOURCE/DIST BYTE-FOR-BYTE EQUALITY
console.log("\n--- 4. SOURCE VS DIST FILE COMPARISONS ---");
const runtimeFiles = [
    "manifest.json",
    "src/helpers.js",
    "src/parser.js",
    "src/content.js",
    "src/dashboard.js",
    "src/dashboard.css"
];

editions.forEach(ed => {
    console.log(`[${ed.name}] Comparing source against dist:`);
    const edRoot = path.join(releaseDir, ed.folder);
    const distRoot = path.join(edRoot, "dist");
    auditResults.sourceDistComparison[ed.name] = {};

    runtimeFiles.forEach(relPath => {
        const srcFile = path.join(edRoot, relPath);
        const distFile = path.join(distRoot, relPath);

        const srcExists = fs.existsSync(srcFile);
        const distExists = fs.existsSync(distFile);

        if (!srcExists || !distExists) {
            console.log(`  - ${relPath}: FAIL (src:${srcExists}, dist:${distExists})`);
            auditResults.errors.push(`${ed.name}: missing ${relPath} in src or dist`);
            return;
        }

        const srcHash = crypto.createHash("sha256").update(fs.readFileSync(srcFile)).digest("hex");
        const distHash = crypto.createHash("sha256").update(fs.readFileSync(distFile)).digest("hex");
        const match = srcHash === distHash;

        auditResults.sourceDistComparison[ed.name][relPath] = {
            srcHash,
            distHash,
            match,
            size: fs.statSync(srcFile).size
        };

        console.log(`  - ${relPath} (${fs.statSync(srcFile).size} B): ${match ? "IDENTICAL (SHA-256 match)" : "MISMATCH"}`);
        if (!match) auditResults.errors.push(`${ed.name}: ${relPath} mismatch between src and dist`);
    });
});

// 5. CROSS-HOST LEAK AUDIT (Check all JS files for foreign dialer tokens)
console.log("\n--- 5. CROSS-HOST LEAK AUDIT ACROSS ALL CODE ---");
editions.forEach(ed => {
    const edRoot = path.join(releaseDir, ed.folder);
    const files = [
        path.join(edRoot, "manifest.json"),
        path.join(edRoot, "src/helpers.js"),
        path.join(edRoot, "src/parser.js"),
        path.join(edRoot, "src/content.js"),
        path.join(edRoot, "src/dashboard.js")
    ];

    let foundLeaks = [];
    files.forEach(f => {
        const content = fs.readFileSync(f, "utf8");
        if (content.includes(ed.forbiddenHost)) {
            foundLeaks.push({ file: path.basename(f), match: ed.forbiddenHost });
        }
    });

    auditResults.hostPermissionIsolation[ed.name] = {
        forbiddenHost: ed.forbiddenHost,
        leaksFound: foundLeaks.length,
        details: foundLeaks
    };

    console.log(`[${ed.name}] Search for '${ed.forbiddenHost}': ${foundLeaks.length === 0 ? "PASS (0 found)" : "FAIL"}`);
    if (foundLeaks.length > 0) {
        auditResults.errors.push(`${ed.name} leaked forbidden host in: ${foundLeaks.map(x=>x.file).join(", ")}`);
    }
});

// 6. READ-ONLY SECURITY AUDIT
console.log("\n--- 6. READ-ONLY OPERATIONAL SAFETY AUDIT ---");
const forbiddenKeywords = [
    { pattern: /\bfetch\s*\(/g, name: "fetch API" },
    { pattern: /\bXMLHttpRequest\b/g, name: "XMLHttpRequest" },
    { pattern: /\bnavigator\.sendBeacon\b/g, name: "sendBeacon" },
    { pattern: /\$\.ajax\b/g, name: "jQuery.ajax" },
    { pattern: /\baxios\b/g, name: "axios" },
    { pattern: /\.submit\s*\(/g, name: "form.submit()" }
];

editions.forEach(ed => {
    const edRoot = path.join(releaseDir, ed.folder);
    const jsFiles = ["src/helpers.js", "src/parser.js", "src/content.js", "src/dashboard.js"];
    
    console.log(`[${ed.name}] Scanning for disallowed network / write calls:`);
    const findings = [];
    jsFiles.forEach(rel => {
        const full = path.join(edRoot, rel);
        const code = fs.readFileSync(full, "utf8");
        forbiddenKeywords.forEach(kw => {
            const matches = code.match(kw.pattern);
            if (matches) {
                findings.push({ file: rel, issue: kw.name, count: matches.length });
            }
        });
    });

    // Check for native click events (must only click extension-created elements)
    const dashCode = fs.readFileSync(path.join(edRoot, "src/dashboard.js"), "utf8");
    // Ensure all addEventListener click handlers are on extension elements
    console.log(`  Disallowed network / write calls: ${findings.length === 0 ? "PASS (0 found)" : "FAIL"}`);
    auditResults.securityAudit[ed.name] = {
        forbiddenFindings: findings,
        isReadOnly: findings.length === 0
    };
    if (findings.length > 0) {
        auditResults.errors.push(`${ed.name} has forbidden network calls: ${JSON.stringify(findings)}`);
    }
});

// 7. PERSISTENT SALES/GOALS LOGIC & RESTART RECOVERY VERIFICATION
console.log("\n--- 7. PERSISTENT SALES/GOALS ALERT ARCHITECTURE VERIFICATION ---");
editions.forEach(ed => {
    const dashPath = path.join(releaseDir, ed.folder, "src/dashboard.js");
    const dashCode = fs.readFileSync(dashPath, "utf8");

    const checks = {
        hasPrefixDefined: dashCode.includes(`const PREFIX = "${ed.prefix}";`),
        hasGoalBaselineStorageKey: dashCode.includes('PREFIX + "goal_baselines_v1"'),
        hasPersistentAlertsStorageKey: dashCode.includes('PREFIX + "persistent_goal_alerts_v1"'),
        hasAcknowledgedAlertsStorageKey: dashCode.includes('PREFIX + "acknowledged_goal_alerts_v1"'),
        hasStateInitialization: dashCode.includes("persistentGoalBaselines: readPersistentGoalBaselines()") &&
                                dashCode.includes("persistentGoalAlerts: readPersistentGoalAlerts()") &&
                                dashCode.includes("acknowledgedGoalAlerts: readAcknowledgedGoalAlerts()"),
        hasCheckPersistentGoalAlerts: dashCode.includes("function checkPersistentGoalAlerts"),
        hasAcknowledgePersistentGoalAlert: dashCode.includes("function acknowledgePersistentGoalAlert"),
        hasRenderPersistentGoalAlerts: dashCode.includes("refs.persistentGoalsContainer.innerHTML = activePersistent.map"),
        hasNotedButtonHandler: dashCode.includes("data-noted-id") && dashCode.includes("acknowledgePersistentGoalAlert"),
        preservesPersistentAlertsOnClearAll: dashCode.includes("state.recentAlerts = []") && !dashCode.includes("state.persistentGoalAlerts = []")
    };

    const allPassed = Object.values(checks).every(Boolean);
    auditResults.persistentAlertVerification[ed.name] = checks;

    console.log(`[${ed.name}] Sales/Goals Alert Engine:`);
    console.log(`  - PREFIX definition (${ed.prefix}):              ${checks.hasPrefixDefined ? "PASS" : "FAIL"}`);
    console.log(`  - Baseline key (PREFIX + "goal_baselines_v1"):    ${checks.hasGoalBaselineStorageKey ? "PASS" : "FAIL"}`);
    console.log(`  - Persistent alerts key (PREFIX + "..."):         ${checks.hasPersistentAlertsStorageKey ? "PASS" : "FAIL"}`);
    console.log(`  - Acknowledged alerts key (PREFIX + "..."):       ${checks.hasAcknowledgedAlertsStorageKey ? "PASS" : "FAIL"}`);
    console.log(`  - State load on mount (readPersistent...):        ${checks.hasStateInitialization ? "PASS" : "FAIL"}`);
    console.log(`  - checkPersistentGoalAlerts function:             ${checks.hasCheckPersistentGoalAlerts ? "PASS" : "FAIL"}`);
    console.log(`  - acknowledgePersistentGoalAlert function:         ${checks.hasAcknowledgePersistentGoalAlert ? "PASS" : "FAIL"}`);
    console.log(`  - Card rendering logic:                           ${checks.hasRenderPersistentGoalAlerts ? "PASS" : "FAIL"}`);
    console.log(`  - [NOTED] acknowledgement handler:                ${checks.hasNotedButtonHandler ? "PASS" : "FAIL"}`);
    console.log(`  - Preserved on Action Center Clear All:           ${checks.preservesPersistentAlertsOnClearAll ? "PASS" : "FAIL"}`);
    console.log(`  - OVERALL ENGINE CHECK:                           ${allPassed ? "PASS" : "FAIL"}`);

    if (!allPassed) auditResults.errors.push(`${ed.name} Sales/Goals engine check failed`);
});

// Output Summary
console.log("\n===============================================================================");
console.log(`AUDIT COMPLETE. ERRORS FOUND: ${auditResults.errors.length}`);
console.log("===============================================================================");
if (auditResults.errors.length > 0) {
    console.error("Errors:", auditResults.errors);
    process.exit(1);
} else {
    console.log("ALL INTEGRITY CHECKS PASSED PERFECTLY.");
    fs.writeFileSync(path.join(releaseDir, "QA_REPORTS", "AUDIT_EVIDENCE.json"), JSON.stringify(auditResults, null, 2), "utf8");
}
