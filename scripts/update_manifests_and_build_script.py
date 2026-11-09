import os
import json

# 1. Update manifests for East2, East3, root
manifest_paths = [
    os.path.join("CT_OPERATIONS_DUAL_DIALER_RELEASE", "CT_Operations_Monitor_East2", "manifest.json"),
    os.path.join("CT_OPERATIONS_DUAL_DIALER_RELEASE", "CT_Operations_Monitor_East2", "dist", "manifest.json"),
    os.path.join("CT_OPERATIONS_DUAL_DIALER_RELEASE", "CT_Operations_Monitor_East3", "manifest.json"),
    os.path.join("CT_OPERATIONS_DUAL_DIALER_RELEASE", "CT_Operations_Monitor_East3", "dist", "manifest.json"),
    "manifest.json"
]

for p in manifest_paths:
    if os.path.exists(p):
        with open(p, "r", encoding="utf-8") as f:
            d = json.load(f)
        d["version"] = "11.3.4"
        with open(p, "w", encoding="utf-8", newline="\n") as f:
            json.dump(d, f, indent=2)
            f.write("\n")
        print(f"Updated {p} version to 11.3.4")

# 2. Update scripts/build_root_dual_dialer.js
with open("scripts/build_root_dual_dialer.js", "r", encoding="utf-8") as f:
    code = f.read()
code = code.replace("\r\n", "\n")

# Replace v11.3.3 references
code = code.replace("v11.3.3", "v11.3.4")
code = code.replace("dashboard_layout_v19", "dashboard_layout_v20")
code = code.replace('"version": "11.3.3"', '"version": "11.3.4"')

# Add REFRESH_RESULT_EVENT replacements if not present
if "REFRESH_RESULT_EVENT" not in code:
    code = code.replace(
        'dashCode = dashCode.replace(\'const REQUEST_REFRESH_EVENT = "CT_EAST_2_REQUEST_REFRESH";\', \'const REQUEST_REFRESH_EVENT = isEast3 ? "CT_EAST_3_REQUEST_REFRESH" : "CT_EAST_2_REQUEST_REFRESH";\');',
        'dashCode = dashCode.replace(\'const REQUEST_REFRESH_EVENT = "CT_EAST_2_REQUEST_REFRESH";\', \'const REQUEST_REFRESH_EVENT = isEast3 ? "CT_EAST_3_REQUEST_REFRESH" : "CT_EAST_2_REQUEST_REFRESH";\');\n' +
        'dashCode = dashCode.replace(\'const REFRESH_RESULT_EVENT = "CT_EAST_2_REFRESH_RESULT";\', \'const REFRESH_RESULT_EVENT = isEast3 ? "CT_EAST_3_REFRESH_RESULT" : "CT_EAST_2_REFRESH_RESULT";\');'
    )
    code = code.replace(
        'contentCode = contentCode.replaceAll(\'"CT_EAST_2_REQUEST_REFRESH"\', \'isEast3 ? "CT_EAST_3_REQUEST_REFRESH" : "CT_EAST_2_REQUEST_REFRESH"\');',
        'contentCode = contentCode.replaceAll(\'"CT_EAST_2_REQUEST_REFRESH"\', \'isEast3 ? "CT_EAST_3_REQUEST_REFRESH" : "CT_EAST_2_REQUEST_REFRESH"\');\n' +
        'contentCode = contentCode.replaceAll(\'"CT_EAST_2_REFRESH_RESULT"\', \'isEast3 ? "CT_EAST_3_REFRESH_RESULT" : "CT_EAST_2_REFRESH_RESULT"\');'
    )

with open("scripts/build_root_dual_dialer.js", "w", encoding="utf-8", newline="\n") as f:
    f.write(code)

print("Updated scripts/build_root_dual_dialer.js successfully.")

