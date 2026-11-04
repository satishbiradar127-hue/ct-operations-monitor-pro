const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE');
const parserPath = path.join(root, 'CT_Operations_Monitor_East2', 'src', 'parser.js');
const dashPath = path.join(root, 'CT_Operations_Monitor_East2', 'src', 'dashboard.js');

console.log("=== PARSER.JS: HUMAN & AGENT CONNECT MAPPINGS ===");
const pLines = fs.readFileSync(parserPath, 'utf8').split('\n');
pLines.forEach((l, i) => {
    if (l.includes('human') || l.includes('agentConnect') || l.includes('Human Connect') || l.includes('Agent Connect')) {
        console.log(`parser.js:${i + 1}: ${l.trim()}`);
    }
});

console.log("\n=== DASHBOARD.JS: HUMAN & AGENT CONNECT DISPLAY ===");
const dLines = fs.readFileSync(dashPath, 'utf8').split('\n');
dLines.forEach((l, i) => {
    if (l.includes('Human Connect') || l.includes('Agent Connect') || l.includes('agentConnect') || l.includes('__human') || l.includes('opConnected')) {
        console.log(`dashboard.js:${i + 1}: ${l.trim()}`);
    }
});

