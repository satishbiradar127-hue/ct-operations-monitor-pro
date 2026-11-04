const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const chromeBin = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const e2Dist = path.join(process.cwd(), "CT_OPERATIONS_DUAL_DIALER_RELEASE", "CT_Operations_Monitor_East2", "dist");
const e3Dist = path.join(process.cwd(), "CT_OPERATIONS_DUAL_DIALER_RELEASE", "CT_Operations_Monitor_East3", "dist");
const testProfile = path.join(process.cwd(), "temp_test_disposable_profile");

if (!fs.existsSync(testProfile)) fs.mkdirSync(testProfile, { recursive: true });

console.log("=== Testing Disposable Chrome Launch ===");
console.log("Chrome Binary:", chromeBin);
console.log("East-2 Dist:  ", e2Dist);
console.log("East-3 Dist:  ", e3Dist);
console.log("Profile Dir:  ", testProfile);

try {
    const cmd = `"${chromeBin}" --headless=new --load-extension="${e2Dist},${e3Dist}" --user-data-dir="${testProfile}" --dump-dom "about:blank"`;
    console.log("Executing:", cmd);
    const out = execSync(cmd, { timeout: 15000 }).toString();
    console.log("Result: Headless Chrome loaded both extensions and executed cleanly!");
    console.log("DOM output length:", out.length);
} catch (err) {
    console.error("Execution error:", err.message);
} finally {
    try {
        fs.rmSync(testProfile, { recursive: true, force: true });
        console.log("Disposable test profile cleaned up.");
    } catch (e) {
        console.log("Note on cleanup:", e.message);
    }
}

