const fs = require("fs");
const path = require("path");

const secPath = "C:\\Users\\Orange Carrot\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 20\\Secure Preferences";
if (fs.existsSync(secPath)) {
    const sec = JSON.parse(fs.readFileSync(secPath, "utf8"));
    const ext = (sec.extensions && sec.extensions.settings) || {};
    console.log("=== Profile 20 Secure Preferences Extensions ===");
    for (const [k, v] of Object.entries(ext)) {
        if (v.manifest) {
            console.log(`ID: ${k} | Name: ${v.manifest.name} | Ver: ${v.manifest.version} | Path: ${v.path}`);
        }
    }
} else {
    console.log("Secure Preferences not found");
}
