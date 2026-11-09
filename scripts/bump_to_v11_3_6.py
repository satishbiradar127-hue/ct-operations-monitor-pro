import os, re

old_v = "11.3.5"
new_v = "11.3.6"

files_to_bump = [
    "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/manifest.json",
    "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/parser.js",
    "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/dashboard.js",
    "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/content.js",
    "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/intelligence.js"
]

for p in files_to_bump:
    with open(p, "r", encoding="utf-8") as f:
        c = f.read()
    c = c.replace(old_v, new_v)
    with open(p, "w", encoding="utf-8") as f:
        f.write(c)
    print(f"Bumped {p} to {new_v}")

# Update build_root_dual_dialer.js
with open("scripts/build_root_dual_dialer.js", "r", encoding="utf-8") as f:
    b = f.read()
b = b.replace(old_v, new_v)
with open("scripts/build_root_dual_dialer.js", "w", encoding="utf-8") as f:
    f.write(b)
print(f"Updated scripts/build_root_dual_dialer.js to {new_v}")

print("Version bump to v11.3.6 complete!")
