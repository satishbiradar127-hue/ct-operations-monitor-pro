const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE');
const dashPath = path.join(root, 'CT_Operations_Monitor_East2', 'src', 'dashboard.js');
const code = fs.readFileSync(dashPath, 'utf8');

console.log("=== CHECKING INBOUND PANEL STATUS LOGIC IN DASHBOARD.JS ===");
const lines = code.split('\n');
lines.forEach((l, i) => {
    if (
        l.includes('lastSuccessfulInboundAt') ||
        l.includes('queueFeedStatus') ||
        l.includes('hasLiveQueueFeed') ||
        l.includes('inboundAgeStr') ||
        l.includes('inboundAgeSec') ||
        l.includes('refs.inboundLive') ||
        l.includes('refs.inboundStatus')
    ) {
        console.log(`${i + 1}: ${l.trim()}`);
    }
});

