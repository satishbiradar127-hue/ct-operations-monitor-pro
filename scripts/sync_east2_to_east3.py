import os

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

# Fix test 143 in East-3
t3 = t3.replace(
    'test("EAST-3 UPGRADE 143: Independent storage namespaces: acknowledging an EAST-3 alert does not affect EAST-3 alert state", () => {\n    const ct_east3_storage = { acknowledged: new Set(["EAST-3_ALERT_1"]) };\n    const ct_east3_storage = { acknowledged: new Set() };',
    'test("EAST-3 UPGRADE 143: Independent storage namespaces: acknowledging an EAST-3 alert does not affect EAST-2 alert state", () => {\n    const ct_east3_storage = { acknowledged: new Set(["EAST-3_ALERT_1"]) };\n    const ct_east2_storage = { acknowledged: new Set() };'
)
t3 = t3.replace(
    'assert.strictEqual(ct_east3_storage.acknowledged.has("EAST-3_ALERT_1"), false, "Cross-dialer storage contamination is prohibited");',
    'assert.strictEqual(ct_east2_storage.acknowledged.has("EAST-3_ALERT_1"), false, "Cross-dialer storage contamination is prohibited");'
)

# Fix test 235 in East-3
t3 = t3.replace(
    'test("EAST-3 UPGRADE 235: Complete dual-dialer namespace and event isolation", () => {\n    const e2Prefix = "ct_east3_";\n    const e3Prefix = "ct_east3_";\n\n    assert.notStrictEqual(e2Prefix, e3Prefix);\n    assert.strictEqual("ct_east3_", false ? "ct_east3_" : "ct_east3_");\n    assert.strictEqual("EAST-3", false ? "EAST-3" : "EAST-3");\n});',
    'test("EAST-3 UPGRADE 235: Complete dual-dialer namespace and event isolation", () => {\n    const e2Prefix = "ct_east2_";\n    const e3Prefix = "ct_east3_";\n\n    assert.notStrictEqual(e2Prefix, e3Prefix);\n    assert.strictEqual("ct_east3_", true ? "ct_east3_" : "ct_east2_");\n    assert.strictEqual("EAST-3", true ? "EAST-3" : "EAST-2");\n});'
)

with open(p3_test, "w", encoding="utf-8") as fh:
    fh.write(t3)
print("Synced suite.test.js -> East3/tests/suite.test.js")

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
