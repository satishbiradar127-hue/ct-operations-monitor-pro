const fs = require('fs');
const content = fs.readFileSync('CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3/src/dashboard.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('Waiting for verified') || line.includes('WAITING') || line.includes('feed-pill') || line.includes('feed-status') || line.includes('feedStatus')) {
    console.log(`${idx+1}: ${line.trim()}`);
  }
});

