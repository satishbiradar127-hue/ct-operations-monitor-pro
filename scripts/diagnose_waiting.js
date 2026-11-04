const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE');

['East2', 'East3'].forEach(d => {
    const dashPath = path.join(root, 'CT_Operations_Monitor_' + d, 'src', 'dashboard.js');
    const contentPath = path.join(root, 'CT_Operations_Monitor_' + d, 'src', 'content.js');
    const dashCode = fs.readFileSync(dashPath, 'utf8');
    const contentCode = fs.readFileSync(contentPath, 'utf8');

    console.log(`=== DIAGNOSING ${d} ===`);

    // Check dispatched events in content.js
    const dispatched = contentCode.match(/new CustomEvent\(\"[^\"]+\"/g) || [];
    console.log('Dispatched events in content.js:', dispatched);

    // Check listened events in dashboard.js
    const listened = dashCode.match(/document\.addEventListener\(\"[^\"]+\"/g) || [];
    console.log('Listened events in dashboard.js:', listened);
});

