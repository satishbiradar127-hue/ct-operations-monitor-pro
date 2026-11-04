const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE');
const e2SrcPath = path.join(root, 'CT_Operations_Monitor_East2', 'src', 'intelligence.js');
const e2DistPath = path.join(root, 'CT_Operations_Monitor_East2', 'dist', 'src', 'intelligence.js');
const e3SrcPath = path.join(root, 'CT_Operations_Monitor_East3', 'src', 'intelligence.js');
const e3DistPath = path.join(root, 'CT_Operations_Monitor_East3', 'dist', 'src', 'intelligence.js');

const e2Content = fs.readFileSync(e2SrcPath, 'utf8');
fs.writeFileSync(e2DistPath, e2Content, 'utf8');

const e3Content = e2Content
    .replace('this.dialer = options.dialer || "EAST-2";', 'this.dialer = options.dialer || "EAST-3";')
    .replace('this.prefix = options.prefix || "ct_east2_";', 'this.prefix = options.prefix || "ct_east3_";');

fs.writeFileSync(e3SrcPath, e3Content, 'utf8');
fs.writeFileSync(e3DistPath, e3Content, 'utf8');

console.log('Successfully synchronized intelligence.js across all East-2 and East-3 src and dist targets.');

