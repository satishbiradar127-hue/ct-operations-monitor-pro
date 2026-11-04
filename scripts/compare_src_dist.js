const fs = require("fs");
const path = require("path");

["East2", "East3"].forEach(dialer => {
    const srcDir = path.resolve(`CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_${dialer}/src`);
    const distDir = path.resolve(`CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_${dialer}/dist/src`);
    const files = fs.readdirSync(srcDir);
    files.forEach(f => {
        const srcFile = path.join(srcDir, f);
        const distFile = path.join(distDir, f);
        if (fs.existsSync(distFile)) {
            const srcBuf = fs.readFileSync(srcFile);
            const distBuf = fs.readFileSync(distFile);
            if (!srcBuf.equals(distBuf)) {
                console.log(`DIFF in ${dialer}: ${f} (src: ${srcBuf.length} bytes, dist: ${distBuf.length} bytes)`);
            } else {
                console.log(`MATCH in ${dialer}: ${f}`);
            }
        } else {
            console.log(`MISSING in dist ${dialer}: ${f}`);
        }
    });
});

