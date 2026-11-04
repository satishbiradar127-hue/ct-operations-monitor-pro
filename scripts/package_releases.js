const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const workspace = "C:\\Users\\Orange Carrot\\Downloads\\CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL";
const releaseRoot = path.join(workspace, "CT_OPERATIONS_DUAL_DIALER_RELEASE");
const pkgDir = path.join(releaseRoot, "RELEASE_PACKAGES");

console.log("=== Packaging Dual-Dialer Release ZIPs ===");

const editions = [
    {
        folder: "CT_Operations_Monitor_East2",
        zipName: "CT_Operations_Monitor_East2.zip"
    },
    {
        folder: "CT_Operations_Monitor_East3",
        zipName: "CT_Operations_Monitor_East3.zip"
    }
];

editions.forEach(ed => {
    const srcFolder = path.join(releaseRoot, ed.folder);
    const destZip = path.join(pkgDir, ed.zipName);

    if (fs.existsSync(destZip)) {
        fs.unlinkSync(destZip);
    }

    console.log(`Zipping ${ed.folder} -> ${destZip}...`);
    // Use powershell Compress-Archive
    execSync(`powershell.exe -NoProfile -Command "Compress-Archive -Path '${srcFolder}\\*' -DestinationPath '${destZip}' -Force"`);
    console.log(`Created ${ed.zipName} (${fs.statSync(destZip).size} bytes)`);
});

// Compute SHA-256 Checksums
console.log("Generating SHA256SUMS.txt...");
const checksums = [];
const zipFiles = fs.readdirSync(pkgDir).filter(f => f.endsWith(".zip"));

zipFiles.forEach(f => {
    const filePath = path.join(pkgDir, f);
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash("sha256");
    hashSum.update(fileBuffer);
    const hex = hashSum.digest("hex");
    checksums.push(`${hex}  ${f}`);
    console.log(`  ${hex}  ${f}`);
});

fs.writeFileSync(path.join(pkgDir, "SHA256SUMS.txt"), checksums.join("\n") + "\n", "utf8");
console.log("SHA256SUMS.txt generated successfully.");

