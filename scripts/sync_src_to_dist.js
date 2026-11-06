const fs = require("fs");
const path = require("path");

["East2", "East3"].forEach(dialer => {
    const rootRelease = path.resolve(`CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_${dialer}`);
    const srcDir = path.join(rootRelease, "src");
    const distSrcDir = path.join(rootRelease, "dist", "src");
    if (!fs.existsSync(distSrcDir)) fs.mkdirSync(distSrcDir, { recursive: true });
    fs.readdirSync(srcDir).forEach(f => {
        fs.copyFileSync(path.join(srcDir, f), path.join(distSrcDir, f));
        console.log(`Copied ${dialer}/src/${f} -> dist/src/${f}`);
    });
    fs.copyFileSync(path.join(rootRelease, "manifest.json"), path.join(rootRelease, "dist", "manifest.json"));
    console.log(`Copied ${dialer}/manifest.json -> dist/manifest.json`);
});
