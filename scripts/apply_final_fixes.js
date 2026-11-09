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

        // Target: valEl extraction in ng-select
        const ngValTarget = `            const valEl = ng.querySelector(".ng-value-label, span.ng-value, [class*='ng-value'], span[title]");
            if (valEl) {
                const valText = String(valEl.getAttribute("title") || valEl.innerText || valEl.textContent || "").trim();`;

        const ngValReplacement = `            const valEl = ng.querySelector(".ng-value-label, span[title], span.ng-value, [class*='ng-value-label']") || ng.querySelector(".ng-value");
            if (valEl) {
                const targetEl = (valEl.querySelector && valEl.querySelector(".ng-value-label, span[title]")) || valEl;
                const valText = String(targetEl.getAttribute("title") || targetEl.getAttribute("aria-label") || targetEl.innerText || targetEl.textContent || "").trim();`;

        if (updated.includes(ngValTarget)) {
            updated = updated.replace(ngValTarget, ngValReplacement);
        }

        // Target: invKey reference (fix filePath bug)
        const invTarget = `const invKey = filePath.includes("East3") ? "ct_east3_live_filters_inventory_v1" : "ct_east2_live_filters_inventory_v1";`;
        const invReplacement = `const invKey = (typeof isEast3 !== "undefined" && isEast3) ? "ct_east3_live_filters_inventory_v1" : "ct_east2_live_filters_inventory_v1";`;
        if (updated.includes(invTarget)) {
            updated = updated.replace(invTarget, invReplacement);
        }

        // TargetDoc fallback for { document } object
        const docTarget = `        const targetDoc = doc || (typeof document !== "undefined" ? document : null);
        if (!targetDoc) return null;`;

        const docReplacement = `        const targetDoc = (doc && doc.document) ? doc.document : (doc || (typeof document !== "undefined" ? document : null));
        if (!targetDoc || !targetDoc.querySelector) return null;`;

        if (updated.includes(docTarget)) {
            updated = updated.replace(docTarget, docReplacement);
        }

        return updated;
    });
});

// 2. PATCH East2 suite.test.js for Test 295
patchFile('CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/tests/suite.test.js', (content) => {
    let updated = content.replace(/\r\n/g, '\n');

    const t295Target = `        const listDoc = createCallToolsCampaignsDOM([
            { id: "1716", name: "TS FRESH DATA", state: "Active", contacts: 21835 }
        ]);
        const parsed = global.CTParser.readCampaignEditForm(listDoc);`;

    const t295Replacement = `        const listDoc = createCallToolsCampaignsDOM([
            { id: "1716", name: "TS FRESH DATA", state: "Active", contacts: 21835 }
        ]);
        const parsed = global.CTParser.readCampaignEditForm(listDoc.document);`;

    if (updated.includes(t295Target)) {
        updated = updated.replace(t295Target, t295Replacement);
    }

    return updated;
});

console.log("Corrections applied.");

