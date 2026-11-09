import os

paths = [
    "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2",
    "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3",
    "."
]

# 1. Update intelligence.js with updateVerifiedCampaignFilter
for p in paths:
    intel_file = os.path.join(p, "src", "intelligence.js")
    if not os.path.exists(intel_file):
        continue
    with open(intel_file, "r", encoding="utf-8") as f:
        content = f.read()

    method_def = '''        updateVerifiedCampaignFilter(campaignId, campaignName, filterName, source = "CAMPAIGN_EDIT_DOM", timestamp = Date.now(), filterCount = null) {
            if (!campaignId) return;
            try {
                let registry = {};
                if (this.storage) {
                    const raw = this.storage.getItem(this.VERIFIED_FILTERS_KEY);
                    if (raw) registry = JSON.parse(raw);
                }
                registry[String(campaignId)] = {
                    campaignId: String(campaignId),
                    campaignName: campaignName || "",
                    liveFilter: filterName || "",
                    cleanFilterName: filterName ? String(filterName).replace(/\\s*\\(Count:\\s*[\\d,]+\\)/i, "").trim() : "",
                    filterCount: filterCount,
                    status: filterName ? "ASSIGNED" : "NO_FILTER",
                    source: source,
                    timestamp: timestamp
                };
                if (this.storage) {
                    this.storage.setItem(this.VERIFIED_FILTERS_KEY, JSON.stringify(registry));
                }
                if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.set({ [this.VERIFIED_FILTERS_KEY]: registry });
                }
            } catch (e) {
                console.error("Failed to update verified campaign filter:", e);
            }
        }
'''
    if "updateVerifiedCampaignFilter" not in content:
        target = "saveState() {"
        idx = content.find(target)
        if idx != -1:
            end_save_idx = content.find("        /**\n         * Checks whether the current time", idx)
            if end_save_idx != -1:
                content = content[:end_save_idx] + method_def + "\n" + content[end_save_idx:]
                with open(intel_file, "w", encoding="utf-8") as f:
                    f.write(content)
                print(f"Added updateVerifiedCampaignFilter to {intel_file}")

# 2. Update dashboard.js in East-2, East-3, and root
for p in paths:
    dash_file = os.path.join(p, "src", "dashboard.js")
    if not os.path.exists(dash_file):
        continue
    with open(dash_file, "r", encoding="utf-8") as f:
        content = f.read()

    old_snippet = """                const fSource = targetCamp.liveFilterSource || "DOM_UNAVAILABLE";
                const fTimeMs = targetCamp.liveFilterTimestamp || null;
                const fTime = fTimeMs ? new Date(fTimeMs).toLocaleTimeString() : (fName ? new Date().toLocaleTimeString() : "Awaiting DOM");"""

    new_snippet = """                const fSource = targetCamp.liveFilterSource || "DOM_UNAVAILABLE";
                const fTime = targetCamp.liveFilterTimestamp ? new Date(targetCamp.liveFilterTimestamp).toLocaleTimeString() : (fName ? new Date().toLocaleTimeString() : "Awaiting DOM");
                const fTimeMs = targetCamp.liveFilterTimestamp || null;"""

    if old_snippet in content:
        content = content.replace(old_snippet, new_snippet)
        with open(dash_file, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated fTime/fTimeMs in {dash_file}")
    else:
        print(f"old_snippet not found in {dash_file}")

# 3. Update tests/suite.test.js for UPGRADE 243
test_paths = [
    "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/tests/suite.test.js",
    "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3/tests/suite.test.js"
]
for tp in test_paths:
    if not os.path.exists(tp):
        continue
    with open(tp, "r", encoding="utf-8") as f:
        tcontent = f.read()

    old_test = """test("EAST-2 UPGRADE 243: Existing Inbound monitoring remains 100% functional and regress-free", () => {
    assert.ok(dashSrc.includes('ct-inbound-panel'), "Inbound operations panel must be present");"""

    new_test = """test("EAST-2 UPGRADE 243: Existing Inbound monitoring remains 100% functional and regress-free", () => {
    const dashSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf8");
    assert.ok(dashSrc.includes('ct-inbound-panel'), "Inbound operations panel must be present");"""

    old_test3 = """test("EAST-3 UPGRADE 243: Existing Inbound monitoring remains 100% functional and regress-free", () => {
    assert.ok(dashSrc.includes('ct-inbound-panel'), "Inbound operations panel must be present");"""

    new_test3 = """test("EAST-3 UPGRADE 243: Existing Inbound monitoring remains 100% functional and regress-free", () => {
    const dashSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf8");
    assert.ok(dashSrc.includes('ct-inbound-panel'), "Inbound operations panel must be present");"""

    if old_test in tcontent:
        tcontent = tcontent.replace(old_test, new_test)
        with open(tp, "w", encoding="utf-8") as f:
            f.write(tcontent)
        print(f"Updated UPGRADE 243 in {tp}")
    elif old_test3 in tcontent:
        tcontent = tcontent.replace(old_test3, new_test3)
        with open(tp, "w", encoding="utf-8") as f:
            f.write(tcontent)
        print(f"Updated UPGRADE 243 in {tp}")

print("Done patching.")

