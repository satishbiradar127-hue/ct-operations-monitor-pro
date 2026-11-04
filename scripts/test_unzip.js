const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const tempDir = path.join(process.cwd(), "temp_unzip_verify");
if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
fs.mkdirSync(tempDir);

const zip2 = path.join(process.cwd(), "CT_OPERATIONS_DUAL_DIALER_RELEASE", "RELEASE_PACKAGES", "CT_Operations_Monitor_East2.zip");
const zip3 = path.join(process.cwd(), "CT_OPERATIONS_DUAL_DIALER_RELEASE", "RELEASE_PACKAGES", "CT_Operations_Monitor_East3.zip");

execSync(`powershell.exe -NoProfile -Command "Expand-Archive -Path '${zip2}' -DestinationPath '${path.join(tempDir, "east2")}' -Force"`);
execSync(`powershell.exe -NoProfile -Command "Expand-Archive -Path '${zip3}' -DestinationPath '${path.join(tempDir, "east3")}' -Force"`);

console.log("Unpacked East-2 top-level entries:");
console.log(fs.readdirSync(path.join(tempDir, "east2")));
console.log("Unpacked East-3 top-level entries:");
console.log(fs.readdirSync(path.join(tempDir, "east3")));

// Verify manifest in unpacked
const m2 = JSON.parse(fs.readFileSync(path.join(tempDir, "east2", "manifest.json")));
const m3 = JSON.parse(fs.readFileSync(path.join(tempDir, "east3", "manifest.json")));
console.log("East-2 Manifest Name:", m2.name, "| host_permissions:", m2.host_permissions);
console.log("East-3 Manifest Name:", m3.name, "| host_permissions:", m3.host_permissions);

// Verify all content script files exist in unpacked
const files2 = m2.content_scripts[0].js.concat(m2.content_scripts[0].css);
const missing2 = files2.filter(f => !fs.existsSync(path.join(tempDir, "east2", f)));
console.log("East-2 missing manifest referenced files:", missing2);

const files3 = m3.content_scripts[0].js.concat(m3.content_scripts[0].css);
const missing3 = files3.filter(f => !fs.existsSync(path.join(tempDir, "east3", f)));
console.log("East-3 missing manifest referenced files:", missing3);

// Clean up temp dir
fs.rmSync(tempDir, { recursive: true, force: true });
console.log("Temp unzip verification clean and complete.");

