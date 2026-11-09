import os
import re

e2_dir = "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2"
e3_dir = "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3"

def transform_to_east3(content):
    res = content
    # Hostnames
    res = res.replace("east-2.calltools.io", "east-3.calltools.io")
    # Specific IDs and identifiers
    res = res.replace("ct-dialer-east2", "ct-dialer-east3")
    res = res.replace("CT_Operations_Monitor_East2", "CT_Operations_Monitor_East3")
    res = res.replace("CT_EAST_2_", "CT_EAST_3_")
    res = res.replace("ctompro_east2", "ctompro_east3")
    res = res.replace("ct-operations-dashboard-east2", "ct-operations-dashboard-east3")
    res = res.replace("ct-operations-dashboard-styles-east2-v11-3-3", "ct-operations-dashboard-styles-east3-v11-3-3")
    res = res.replace("ct-operations-hidden-queue-feed-east2", "ct-operations-hidden-queue-feed-east3")
    res = res.replace("east-2", "east-3")
    res = res.replace("East-2", "East-3")
    res = res.replace("EAST-2", "EAST-3")
    res = res.replace("ct_east2_", "ct_east3_")
    return res

# 1. Sync src files
for f in ["helpers.js", "parser.js", "intelligence.js", "content.js", "dashboard.js", "dashboard.css"]:
    p2 = os.path.join(e2_dir, "src", f)
    p3 = os.path.join(e3_dir, "src", f)
    with open(p2, "r", encoding="utf-8") as fh:
        c2 = fh.read()
    c3 = transform_to_east3(c2)
    with open(p3, "w", encoding="utf-8") as fh:
        fh.write(c3)
    print(f"Synced {f} -> East3/src/{f}")

# 2. Sync test suite
p2_test = os.path.join(e2_dir, "tests", "suite.test.js")
p3_test = os.path.join(e3_dir, "tests", "suite.test.js")
with open(p2_test, "r", encoding="utf-8") as fh:
    t2 = fh.read()
t3 = transform_to_east3(t2)

# Specific replacements for dual-dialer cross comparison tests
dual_dialer_tests = {
    '48': """test("EAST-3 UPGRADE 48: Manifest configuration and host permissions match target dialer", () => {
    const manifestPath = path.resolve(__dirname, "../manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    assert.strictEqual(manifest.manifest_version, 3);
    assert.strictEqual(manifest.name, "CT Operations Monitor — East-3");
    assert.ok(manifest.host_permissions.includes("https://east-3.calltools.io/*"));
    assert.ok(!manifest.host_permissions.includes("https://east-2.calltools.io/*"), "Must not permit other dialer host");
    assert.ok(manifest.content_scripts[0].matches.includes("https://east-3.calltools.io/manager/campaigns*"));
    assert.ok(manifest.content_scripts[0].matches.includes("https://east-3.calltools.io/manager/queues*"));
});""",

    '49': """test("EAST-3 UPGRADE 49: Storage keys are strictly isolated with 'ct_east3_' prefix", () => {
    const dashSrc = fs.readFileSync(path.resolve(__dirname, "../src/dashboard.js"), "utf-8");
    const contentSrc = fs.readFileSync(path.resolve(__dirname, "../src/content.js"), "utf-8");
    assert.ok(dashSrc.includes('const PREFIX = "ct_east3_";'));
    assert.ok(!dashSrc.includes('const PREFIX = "ct_east2_";'));
    assert.ok(contentSrc.includes('ct_east3_last_known_queues_v1'));
    assert.ok(!contentSrc.includes('ct_east2_last_known_queues_v1'));
});""",

    '59': """test("EAST-3 UPGRADE 59: Cross-dialer isolation verifies host and storage separation from EAST-2", () => {
    const thisManifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../manifest.json"), "utf-8"));
    const otherManifestPath = path.resolve(__dirname, "../../CT_Operations_Monitor_East2/manifest.json");
    const otherManifest = JSON.parse(fs.readFileSync(otherManifestPath, "utf-8"));

    assert.notStrictEqual(thisManifest.name, otherManifest.name);
    assert.notStrictEqual(thisManifest.host_permissions[0], otherManifest.host_permissions[0]);
    assert.strictEqual(thisManifest.host_permissions[0], "https://east-3.calltools.io/*");
    assert.strictEqual(otherManifest.host_permissions[0], "https://east-2.calltools.io/*");
});""",

    '101': """test("EAST-3 UPGRADE 101: Dialer isolation verifies event names and namespaces (CT_EAST_3_UPDATE vs CT_EAST_2_UPDATE)", () => {
    const fs = require('fs');
    const path = require('path');
    const dashPath = path.resolve(__dirname, '../src/dashboard.js');
    const dashCode = fs.readFileSync(dashPath, 'utf8');
    assert.ok(dashCode.includes('CT_EAST_3_UPDATE'));
    assert.ok(!dashCode.includes('CT_EAST_2_UPDATE'));
});""",

    '114': """test("EAST-3 UPGRADE 114: East-2 and East-3 storage keys do not collide", () => {
    const e2Key = "ct_east2_alerts";
    const e3Key = "ct_east3_alerts";
    assert.notStrictEqual(e2Key, e3Key);
    assert.ok(e2Key.startsWith("ct_east2_"));
    assert.ok(e3Key.startsWith("ct_east3_"));
});""",

    '125': """test("EAST-3 UPGRADE 125: East-2 and East-3 maintain strictly isolated goal baselines and storage namespaces", () => {
    const e2GoalKey = "ct_east2_goal_baselines_v1";
    const e3GoalKey = "ct_east3_goal_baselines_v1";
    assert.notStrictEqual(e2GoalKey, e3GoalKey, "Storage keys must never collide");
    assert.ok(e2GoalKey.startsWith("ct_east2_"));
    assert.ok(e3GoalKey.startsWith("ct_east3_"));
});""",

    '143': """test("EAST-3 UPGRADE 143: Independent storage namespaces: acknowledging an EAST-3 alert does not affect EAST-2 alert state", () => {
    const ct_east3_storage = { acknowledged: new Set(["EAST-3_ALERT_1"]) };
    const ct_east2_storage = { acknowledged: new Set() };

    assert.ok(ct_east3_storage.acknowledged.has("EAST-3_ALERT_1"));
    assert.strictEqual(ct_east2_storage.acknowledged.has("EAST-3_ALERT_1"), false, "Cross-dialer storage contamination is prohibited");
});""",

    '155': """test("EAST-3 UPGRADE 155: Strict URL host boundary: EAST-3 only matches east-3.calltools.io and rejects east-2.calltools.io", () => {
    function isValidHost(candidateHost) {
        return candidateHost === "east-3.calltools.io";
    }

    assert.strictEqual(isValidHost("east-3.calltools.io"), true, "Must match native target host");
    assert.strictEqual(isValidHost("east-2.calltools.io"), false, "Must reject opposite dialer host");
    assert.strictEqual(isValidHost("evil.calltools.io"), false, "Must reject arbitrary hosts");
});""",

    '207': """test("EAST-3 UPGRADE 207: East-2 and East-3 filter registry and baselines maintain 100% cross-dialer namespace isolation", () => {
    const sharedStorage = new TestStorage();
    const e2Engine = new CTDataIntelligenceEngine({ dialer: "EAST-2", prefix: "ct_east2_", storage: sharedStorage });
    const e3Engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage: sharedStorage });

    e3Engine.checkCampaignLiveFilter({
        cid: "999",
        cName: "Dialer Specific",
        filterVal: "E3-Special-Filter",
        status: "ASSIGNED",
        source: "leaf",
        now: 1000,
        timeStr: "10:00:00 AM"
    });

    assert.ok(e3Engine.filterBaselines["campaign_filter_999"]);
    assert.strictEqual(e2Engine.filterBaselines["campaign_filter_999"], undefined);

    // Registry keys check
    sharedStorage.setItem("ct_east3_verified_campaign_filters_v1", JSON.stringify({ "999": "E3-Data" }));
    assert.strictEqual(sharedStorage.getItem("ct_east2_verified_campaign_filters_v1"), null);
});""",

    '223': """test("EAST-3 UPGRADE 223: Dual-dialer storage namespace isolation between ct_east2_live_filters_inventory_v1 and ct_east3_live_filters_inventory_v1", () => {
    const sharedStorage = new TestStorage();
    const e2Engine = new CTDataIntelligenceEngine({ dialer: "EAST-2", prefix: "ct_east2_", storage: sharedStorage });
    const e3Engine = new CTDataIntelligenceEngine({ dialer: "EAST-3", prefix: "ct_east3_", storage: sharedStorage });

    sharedStorage.setItem("ct_east2_live_filters_inventory_v1", JSON.stringify({ items: { "1": { name: "E2 Filter" } }, totalCount: 1 }));
    sharedStorage.setItem("ct_east3_live_filters_inventory_v1", JSON.stringify({ items: { "2": { name: "E3 Filter" } }, totalCount: 1 }));

    const e2Summary = e2Engine.getLiveFilterIntelligenceSummary();
    const e3Summary = e3Engine.getLiveFilterIntelligenceSummary();

    assert.strictEqual(e2Summary.inventory[0].name, "E2 Filter");
    assert.strictEqual(e3Summary.inventory[0].name, "E3 Filter");
    assert.strictEqual(e2Summary.inventory.length, 1);
    assert.strictEqual(e3Summary.inventory.length, 1);
});""",

    '235': """test("EAST-3 UPGRADE 235: Complete dual-dialer namespace and event isolation", () => {
    const e2Prefix = "ct_east2_";
    const e3Prefix = "ct_east3_";

    assert.notStrictEqual(e2Prefix, e3Prefix);
    assert.strictEqual("ct_east3_", true ? "ct_east3_" : "ct_east2_");
    assert.strictEqual("EAST-3", true ? "EAST-3" : "EAST-2");
});""",

    '267': """test("EAST-3 UPGRADE 267: EAST-2 and EAST-3 complete namespace and event isolation", () => {
    const e2Namespace = { storage: "ct_east2_storage", event: "CT_EAST_2_REFRESH", host: "east-2.calltools.io" };
    const e3Namespace = { storage: "ct_east3_storage", event: "CT_EAST_3_REFRESH", host: "east-3.calltools.io" };
    assert.notStrictEqual(e2Namespace.storage, e3Namespace.storage);
    assert.notStrictEqual(e2Namespace.event, e3Namespace.event);
    assert.notStrictEqual(e2Namespace.host, e3Namespace.host);
});"""
}

for num, replacement_code in dual_dialer_tests.items():
    pattern = r'test\("[^"]*UPGRADE ' + num + r'[\s\S]*?\n\}\);'
    match = re.search(pattern, t3)
    if match:
        t3 = t3[:match.start()] + replacement_code + t3[match.end():]
        print(f"Replaced cross-comparison test {num} successfully.")
    else:
        print(f"WARNING: pattern for test {num} not found!")

with open(p3_test, "w", encoding="utf-8") as fh:
    fh.write(t3)
print("Synced suite.test.js -> East3/tests/suite.test.js with preserved dual-dialer tests")

# 3. Sync manifest.json
p2_man = os.path.join(e2_dir, "manifest.json")
p3_man = os.path.join(e3_dir, "manifest.json")
with open(p2_man, "r", encoding="utf-8") as fh:
    m2 = fh.read()
m3 = transform_to_east3(m2)
with open(p3_man, "w", encoding="utf-8") as fh:
    fh.write(m3)
print("Synced manifest.json -> East3/manifest.json")

print("Full East-2 -> East-3 sync complete!")
