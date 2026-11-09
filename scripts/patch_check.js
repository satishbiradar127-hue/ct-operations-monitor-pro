const fs = require('fs');
const path = require('path');

function patchFile(relPath, fn) {
    const fullPath = path.resolve(__dirname, '..', relPath);
    const original = fs.readFileSync(fullPath, 'utf8');
    const modified = fn(original);
    if (original === modified) {
        console.warn(`[WARN] No changes made to ${relPath}`);
    } else {
        fs.writeFileSync(fullPath, modified, 'utf8');
        console.log(`[SUCCESS] Patched ${relPath}`);
    }
}

// 1. PATCH parser.js in root and East2
['src/parser.js', 'CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/parser.js'].forEach(filePath => {
    patchFile(filePath, (content) => {
        let updated = content.replace(/\r\n/g, '\n');

        const oldCheck = `        // If doc was not passed explicitly and we are in a real browser on a non-edit page, do not parse
        if (!doc && typeof window !== "undefined" && window.location && window.location.pathname) {
            const p = window.location.pathname;
            if (!p.includes("/campaigns/edit/")) return null;
        }`;

        const newCheck = `        // If on non-edit route without explicit edit form container, do not parse
        if (typeof window !== "undefined" && window.location && window.location.pathname) {
            const p = window.location.pathname;
            if (p === "/manager/campaigns" || (p.startsWith("/manager/campaigns") && !p.includes("/campaigns/edit/"))) {
                const hasEditContainer = Boolean(targetDoc.querySelector && targetDoc.querySelector("form, .campaign-edit-form, input[name='name']"));
                if (!hasEditContainer) return null;
            }
        }`;

        if (updated.includes(oldCheck)) {
            updated = updated.replace(oldCheck, newCheck);
        }

        return updated;
    });
});

console.log("Check updated.");

