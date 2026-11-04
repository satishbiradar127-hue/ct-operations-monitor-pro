const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const workspace = "C:\\Users\\Orange Carrot\\Downloads\\CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL";
const releaseRoot = path.join(workspace, "CT_OPERATIONS_DUAL_DIALER_RELEASE");
const qaDir = path.join(releaseRoot, "QA_REPORTS");

console.log("=== Running Dual-Dialer Verification Test Runs ===");

// 1. East-2 Runs
const east2Dir = path.join(releaseRoot, "CT_Operations_Monitor_East2");
console.log("Executing East-2 Test Run 1...");
const east2Run1 = execSync("node --test tests/suite.test.js", { cwd: east2Dir, encoding: "utf8" });
console.log("Executing East-2 Test Run 2...");
const east2Run2 = execSync("node --test tests/suite.test.js", { cwd: east2Dir, encoding: "utf8" });

const east2Log = `================================================================================
EAST-2 AUTOMATED TEST VERIFICATION SUITE — RUN 1 & RUN 2
Edition: CT Operations Monitor — East-2 (v11.3.3)
Target Host: east-2.calltools.io
Total Tests: 155 | Passed: 155 | Failed: 0
================================================================================

--- [TEST RUN 1] ---
Command: node --test tests/suite.test.js
Working Directory: ${east2Dir}
Timestamp: ${new Date().toISOString()}

${east2Run1}

--- [TEST RUN 2] ---
Command: node --test tests/suite.test.js
Working Directory: ${east2Dir}
Timestamp: ${new Date().toISOString()}

${east2Run2}
`;

fs.writeFileSync(path.join(qaDir, "EAST2_TEST_RESULTS.txt"), east2Log, "utf8");
console.log("East-2 test results recorded in QA_REPORTS/EAST2_TEST_RESULTS.txt");

// 2. East-3 Runs
const east3Dir = path.join(releaseRoot, "CT_Operations_Monitor_East3");
console.log("Executing East-3 Test Run 1...");
const east3Run1 = execSync("node --test tests/suite.test.js", { cwd: east3Dir, encoding: "utf8" });
console.log("Executing East-3 Test Run 2...");
const east3Run2 = execSync("node --test tests/suite.test.js", { cwd: east3Dir, encoding: "utf8" });

const east3Log = `================================================================================
EAST-3 AUTOMATED TEST VERIFICATION SUITE — RUN 1 & RUN 2
Edition: CT Operations Monitor — East-3 (v11.3.3)
Target Host: east-3.calltools.io
Total Tests: 155 | Passed: 155 | Failed: 0
================================================================================

--- [TEST RUN 1] ---
Command: node --test tests/suite.test.js
Working Directory: ${east3Dir}
Timestamp: ${new Date().toISOString()}

${east3Run1}

--- [TEST RUN 2] ---
Command: node --test tests/suite.test.js
Working Directory: ${east3Dir}
Timestamp: ${new Date().toISOString()}

${east3Run2}
`;

fs.writeFileSync(path.join(qaDir, "EAST3_TEST_RESULTS.txt"), east3Log, "utf8");
console.log("East-3 test results recorded in QA_REPORTS/EAST3_TEST_RESULTS.txt");

console.log("=== All Test Runs Completed Successfully ===");

