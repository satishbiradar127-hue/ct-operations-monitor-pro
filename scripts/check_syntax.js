const { execSync } = require("child_process");
const files = [
    "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/helpers.js",
    "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/parser.js",
    "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/intelligence.js",
    "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/dashboard.js",
    "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/content.js",
    "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3/src/helpers.js",
    "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3/src/parser.js",
    "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3/src/intelligence.js",
    "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3/src/dashboard.js",
    "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3/src/content.js"
];
files.forEach(f => {
    execSync(`node --check "${f}"`);
    console.log("CHECK OK:", f);
});
console.log("ALL 10 JAVASCRIPT SOURCE FILES PASSED SYNTAX CHECK.");

