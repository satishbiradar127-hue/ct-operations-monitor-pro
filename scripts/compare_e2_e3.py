import os

for f in ["helpers.js", "parser.js", "intelligence.js", "content.js", "dashboard.js", "dashboard.css"]:
    p2 = f"CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/{f}"
    p3 = f"CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3/src/{f}"
    if os.path.exists(p2) and os.path.exists(p3):
        c2 = open(p2, encoding="utf-8").read()
        c3 = open(p3, encoding="utf-8").read()
        print(f"{f}: E2 len={len(c2)}, E3 len={len(c3)}, identical={c2 == c3}")
