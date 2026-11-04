const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE');

function analyzeFile(filePath) {
    const code = fs.readFileSync(filePath, 'utf8');
    const lines = code.split('\n');
    console.log(`=== ${filePath} (${lines.length} lines) ===`);
    lines.forEach((line, idx) => {
        if (
            line.includes('findNativeRefreshButton') ||
            line.includes('.click(') ||
            line.includes('refreshButton') ||
            line.includes('requestNativeRefresh') ||
            line.includes('CT_EAST_') ||
            line.includes('publish(') ||
            line.includes('feedStatus') ||
            line.includes('FEED_STATUS') ||
            line.includes('poll(')
        ) {
            console.log(`${idx + 1}: ${line.trim()}`);
        }
    });
}

analyzeFile(path.join(root, 'CT_Operations_Monitor_East2', 'src', 'content.js'));
analyzeFile(path.join(root, 'CT_Operations_Monitor_East3', 'src', 'content.js'));

