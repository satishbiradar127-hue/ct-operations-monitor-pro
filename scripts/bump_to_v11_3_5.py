import os, json

old_v = "11.3.4"
new_v = "11.3.5"

# 1. East-2 and East-3 manifests
for d in ["East2", "East3"]:
    man_path = f"CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_{d}/manifest.json"
    with open(man_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    data["version"] = new_v
    with open(man_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"Updated {man_path} to {new_v}")

# 2. Update version strings in code
for d in ["East2", "East3"]:
    src_dir = f"CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_{d}/src"
    for fn in ["parser.js", "content.js", "dashboard.js"]:
        fp = os.path.join(src_dir, fn)
        with open(fp, "r", encoding="utf-8") as f:
            c = f.read()
        c = c.replace(old_v, new_v)
        with open(fp, "w", encoding="utf-8") as f:
            f.write(c)
        print(f"Updated {fp} to {new_v}")

# 3. Update build_root_dual_dialer.js
with open("scripts/build_root_dual_dialer.js", "r", encoding="utf-8") as f:
    b = f.read()
b = b.replace(old_v, new_v)
with open("scripts/build_root_dual_dialer.js", "w", encoding="utf-8") as f:
    f.write(b)
print(f"Updated scripts/build_root_dual_dialer.js to {new_v}")

print("Version bump to v11.3.5 complete!")
