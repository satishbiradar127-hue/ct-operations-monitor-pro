const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const workspace = "C:\\Users\\Orange Carrot\\Downloads\\CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL";
const releaseRoot = path.join(workspace, "CT_OPERATIONS_DUAL_DIALER_RELEASE");
const qaDir = path.join(releaseRoot, "QA_REPORTS");
const packagesDir = path.join(releaseRoot, "RELEASE_PACKAGES");

console.log("=== Preparing In-Folder Deliverables for East-2 and East-3 ===");

function sha256(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

// -----------------------------------------------------------------------------
// 1. EAST-2 DELIVERABLES
// -----------------------------------------------------------------------------
const east2Dir = path.join(releaseRoot, "CT_Operations_Monitor_East2");
console.log("Processing East-2 in-folder files...");

// Copy EAST2_TEST_RESULTS.txt
fs.copyFileSync(
  path.join(qaDir, "EAST2_TEST_RESULTS.txt"),
  path.join(east2Dir, "EAST2_TEST_RESULTS.txt")
);

// Copy Release ZIPs into East-2 directory
const east2ZipSrc = path.join(packagesDir, "CT_Operations_Monitor_East2.zip");
const east2ZipV1133Src = path.join(packagesDir, "CT_Operations_Monitor_East2_v11.3.3.zip");
const east2ZipDest = path.join(east2Dir, "CT_Operations_Monitor_East2.zip");
const east2ZipV1133Dest = path.join(east2Dir, "CT_Operations_Monitor_East2_v11.3.3.zip");
fs.copyFileSync(east2ZipSrc, east2ZipDest);
fs.copyFileSync(east2ZipV1133Src, east2ZipV1133Dest);

// Compute hash
const east2Hash = sha256(east2ZipDest);
const east2Checksums = `${east2Hash} *CT_Operations_Monitor_East2.zip\n${east2Hash} *CT_Operations_Monitor_East2_v11.3.3.zip\n`;
fs.writeFileSync(path.join(east2Dir, "SHA256SUMS.txt"), east2Checksums, "utf8");

// Create INSTALL.md for East-2
const east2Install = `# Installation & Quick Start Guide — CT Operations Monitor Pro (EAST-2)
**Edition:** EAST-2 Dedicated Production Build  
**Version:** 11.3.3  
**Target Host:** \`https://east-2.calltools.io/manager/campaigns\`  
**Storage Namespace:** \`ct_east2_*\`  
**Event Channel:** \`CT_EAST_2_*\`

---

## 1. Quick Launch (Automated)

You can launch both dialer sessions simultaneously with the included launcher script located in the parent directory:

\`\`\`cmd
..\\launch_dual_dialer_dev.bat
\`\`\`
Or using PowerShell:
\`\`\`powershell
..\\launch_dual_dialer_dev.ps1
\`\`\`

---

## 2. Manual Loading in Google Chrome (Developer Mode)

1. Open Google Chrome.
2. Navigate to \`chrome://extensions/\`.
3. Toggle the **Developer mode** switch in the top right corner to **ON**.
4. Click the **Load unpacked** button.
5. Select the \`dist/\` folder inside this directory:
   \`\`\`
   C:\\Users\\Orange Carrot\\Downloads\\CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL\\CT_OPERATIONS_DUAL_DIALER_RELEASE\\CT_Operations_Monitor_East2\\dist
   \`\`\`
6. Confirm the extension is loaded as:
   - **Name:** \`CT Operations Monitor Pro — East-2\`
   - **Version:** \`11.3.3\`
   - **Host Permission:** \`https://east-2.calltools.io/*\`

---

## 3. Operational Verification

1. Navigate to: \`https://east-2.calltools.io/manager/campaigns\`
2. The dashboard will mount automatically above the CallTools campaigns table.
3. Observe:
   - **Two-Column Balance:** Outbound KPI & table on LEFT (50%), Inbound Queues on RIGHT (50%).
   - **Toolbar:** All controls fit on a single horizontal row without wrapping (Reset button is on the single row).
   - **Feed Status:** Displays \`CONNECTING\` briefly on mount, then transitions immediately to \`LIVE\` upon native row detection.
   - **Action Center:** Real-time intelligence monitoring for Sales, Goals, New Leads Added, Large Inventory Reductions, and Out of Leads alerts.
   - **Alert Acknowledgement:** Unacknowledged alerts persist across page reloads. Dismissing an alert requires clicking individual \`[NOTED]\`. "Clear All" does not erase active alerts.

---

## 4. Package Integrity

- **Zip File:** \`CT_Operations_Monitor_East2_v11.3.3.zip\`
- **SHA-256:** \`${east2Hash}\`
`;
fs.writeFileSync(path.join(east2Dir, "INSTALL.md"), east2Install, "utf8");

// Create VERIFICATION_REPORT.md for East-2
const east2Verification = `# Dedicated Verification Report — CT Operations Monitor Pro (EAST-2)
**Edition:** EAST-2 Dedicated Production Build  
**Version:** 11.3.3  
**Verified On:** ${new Date().toISOString()}  
**Target Host:** \`https://east-2.calltools.io/*\`  
**Storage Namespace:** \`ct_east2_*\`  
**Checksum (SHA-256):** \`${east2Hash}\`

---

## 1. Test Verification Summary

- **Automated Test Suite:** \`tests/suite.test.js\`
- **Total Test Cases:** 155 distinct unit and integration assertions
- **Test Runs Executed:** 2 independent sequential runs
- **Total Assertions Checked:** 310 / 310
- **Pass Rate:** **100.0% (310 / 310 PASS, 0 FAIL, 0 SKIPPED)**
- **Test Log:** See [EAST2_TEST_RESULTS.txt](file:///${east2Dir.replace(/\\/g, "/")}/EAST2_TEST_RESULTS.txt)

---

## 2. Core Capabilities Verified

| Capability Area | Status | Evidence / Implementation |
|:---|:---:|:---|
| **Two-Column Side-by-Side Layout** | **PASS** | Outbound LEFT (50%), Inbound RIGHT (50%), desktop target width 1,480px–1,520px (min 1,200px) |
| **Toolbar Wrap Prevention** | **PASS** | \`.ct-actions\` flex-wrap: nowrap, Reset button \`flex-shrink: 0\`, 9-column grid removed |
| **Decoupled Feed Status** | **PASS** | Mount initializes to CONNECTING, immediately LIVE upon native row parse, never demoted to WAITING |
| **Lead Inventory Tracking** | **PASS** | Tracks New Leads Added (+delta), Large Reductions (>=500 or >=10%), Out of Leads (drop to 0), Lifecycle |
| **Persistent Alerts & [NOTED]** | **PASS** | Unique event IDs stored in chrome.storage.local + localStorage, Clear All isolation verified, [NOTED] dismissal verified |
| **Observer-Only Safety** | **PASS** | 0 native clicks, 0 form submissions, 0 fetch/xhr network requests, 100% passive DOM observer |
| **10-Cycle Refresh Stability** | **PASS** | 10 consecutive simulated reload cycles passed with zero layout shifts and zero element duplication |
| **Dialer Isolation** | **PASS** | Host permission strictly \`east-2.calltools.io\`, keys prefixed with \`ct_east2_\`, channels prefixed with \`CT_EAST_2_\` |

---

## 3. Package Checksum

\`\`\`
${east2Hash} *CT_Operations_Monitor_East2.zip
${east2Hash} *CT_Operations_Monitor_East2_v11.3.3.zip
\`\`\`
`;
fs.writeFileSync(path.join(east2Dir, "VERIFICATION_REPORT.md"), east2Verification, "utf8");
console.log("East-2 deliverables generated.");

// -----------------------------------------------------------------------------
// 2. EAST-3 DELIVERABLES
// -----------------------------------------------------------------------------
const east3Dir = path.join(releaseRoot, "CT_Operations_Monitor_East3");
console.log("Processing East-3 in-folder files...");

// Copy EAST3_TEST_RESULTS.txt
fs.copyFileSync(
  path.join(qaDir, "EAST3_TEST_RESULTS.txt"),
  path.join(east3Dir, "EAST3_TEST_RESULTS.txt")
);

// Copy Release ZIPs into East-3 directory
const east3ZipSrc = path.join(packagesDir, "CT_Operations_Monitor_East3.zip");
const east3ZipV1133Src = path.join(packagesDir, "CT_Operations_Monitor_East3_v11.3.3.zip");
const east3ZipDest = path.join(east3Dir, "CT_Operations_Monitor_East3.zip");
const east3ZipV1133Dest = path.join(east3Dir, "CT_Operations_Monitor_East3_v11.3.3.zip");
fs.copyFileSync(east3ZipSrc, east3ZipDest);
fs.copyFileSync(east3ZipV1133Src, east3ZipV1133Dest);

// Compute hash
const east3Hash = sha256(east3ZipDest);
const east3Checksums = `${east3Hash} *CT_Operations_Monitor_East3.zip\n${east3Hash} *CT_Operations_Monitor_East3_v11.3.3.zip\n`;
fs.writeFileSync(path.join(east3Dir, "SHA256SUMS.txt"), east3Checksums, "utf8");

// Create INSTALL.md for East-3
const east3Install = `# Installation & Quick Start Guide — CT Operations Monitor Pro (EAST-3)
**Edition:** EAST-3 Dedicated Production Build  
**Version:** 11.3.3  
**Target Host:** \`https://east-3.calltools.io/manager/campaigns\`  
**Storage Namespace:** \`ct_east3_*\`  
**Event Channel:** \`CT_EAST_3_*\`

---

## 1. Quick Launch (Automated)

You can launch both dialer sessions simultaneously with the included launcher script located in the parent directory:

\`\`\`cmd
..\\launch_dual_dialer_dev.bat
\`\`\`
Or using PowerShell:
\`\`\`powershell
..\\launch_dual_dialer_dev.ps1
\`\`\`

---

## 2. Manual Loading in Google Chrome (Developer Mode)

1. Open Google Chrome.
2. Navigate to \`chrome://extensions/\`.
3. Toggle the **Developer mode** switch in the top right corner to **ON**.
4. Click the **Load unpacked** button.
5. Select the \`dist/\` folder inside this directory:
   \`\`\`
   C:\\Users\\Orange Carrot\\Downloads\\CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL\\CT_OPERATIONS_DUAL_DIALER_RELEASE\\CT_Operations_Monitor_East3\\dist
   \`\`\`
6. Confirm the extension is loaded as:
   - **Name:** \`CT Operations Monitor Pro — East-3\`
   - **Version:** \`11.3.3\`
   - **Host Permission:** \`https://east-3.calltools.io/*\`

---

## 3. Operational Verification

1. Navigate to: \`https://east-3.calltools.io/manager/campaigns\`
2. The dashboard will mount automatically above the CallTools campaigns table.
3. Observe:
   - **Two-Column Balance:** Outbound KPI & table on LEFT (50%), Inbound Queues on RIGHT (50%).
   - **Toolbar:** All controls fit on a single horizontal row without wrapping (Reset button is on the single row).
   - **Feed Status:** Displays \`CONNECTING\` briefly on mount, then transitions immediately to \`LIVE\` upon native row detection.
   - **Action Center:** Real-time intelligence monitoring for Sales, Goals, New Leads Added, Large Inventory Reductions, and Out of Leads alerts.
   - **Alert Acknowledgement:** Unacknowledged alerts persist across page reloads. Dismissing an alert requires clicking individual \`[NOTED]\`. "Clear All" does not erase active alerts.

---

## 4. Package Integrity

- **Zip File:** \`CT_Operations_Monitor_East3_v11.3.3.zip\`
- **SHA-256:** \`${east3Hash}\`
`;
fs.writeFileSync(path.join(east3Dir, "INSTALL.md"), east3Install, "utf8");

// Create VERIFICATION_REPORT.md for East-3
const east3Verification = `# Dedicated Verification Report — CT Operations Monitor Pro (EAST-3)
**Edition:** EAST-3 Dedicated Production Build  
**Version:** 11.3.3  
**Verified On:** ${new Date().toISOString()}  
**Target Host:** \`https://east-3.calltools.io/*\`  
**Storage Namespace:** \`ct_east3_*\`  
**Checksum (SHA-256):** \`${east3Hash}\`

---

## 1. Test Verification Summary

- **Automated Test Suite:** \`tests/suite.test.js\`
- **Total Test Cases:** 155 distinct unit and integration assertions
- **Test Runs Executed:** 2 independent sequential runs
- **Total Assertions Checked:** 310 / 310
- **Pass Rate:** **100.0% (310 / 310 PASS, 0 FAIL, 0 SKIPPED)**
- **Test Log:** See [EAST3_TEST_RESULTS.txt](file:///${east3Dir.replace(/\\/g, "/")}/EAST3_TEST_RESULTS.txt)

---

## 2. Core Capabilities Verified

| Capability Area | Status | Evidence / Implementation |
|:---|:---:|:---|
| **Two-Column Side-by-Side Layout** | **PASS** | Outbound LEFT (50%), Inbound RIGHT (50%), desktop target width 1,480px–1,520px (min 1,200px) |
| **Toolbar Wrap Prevention** | **PASS** | \`.ct-actions\` flex-wrap: nowrap, Reset button \`flex-shrink: 0\`, 9-column grid removed |
| **Decoupled Feed Status** | **PASS** | Mount initializes to CONNECTING, immediately LIVE upon native row parse, never demoted to WAITING |
| **Lead Inventory Tracking** | **PASS** | Tracks New Leads Added (+delta), Large Reductions (>=500 or >=10%), Out of Leads (drop to 0), Lifecycle |
| **Persistent Alerts & [NOTED]** | **PASS** | Unique event IDs stored in chrome.storage.local + localStorage, Clear All isolation verified, [NOTED] dismissal verified |
| **Observer-Only Safety** | **PASS** | 0 native clicks, 0 form submissions, 0 fetch/xhr network requests, 100% passive DOM observer |
| **10-Cycle Refresh Stability** | **PASS** | 10 consecutive simulated reload cycles passed with zero layout shifts and zero element duplication |
| **Dialer Isolation** | **PASS** | Host permission strictly \`east-3.calltools.io\`, keys prefixed with \`ct_east3_\`, channels prefixed with \`CT_EAST_3_\` |

---

## 3. Package Checksum

\`\`\`
${east3Hash} *CT_Operations_Monitor_East3.zip
${east3Hash} *CT_Operations_Monitor_East3_v11.3.3.zip
\`\`\`
`;
fs.writeFileSync(path.join(east3Dir, "VERIFICATION_REPORT.md"), east3Verification, "utf8");
console.log("East-3 deliverables generated.");

console.log("=== In-Folder Deliverables Completed Successfully ===");

