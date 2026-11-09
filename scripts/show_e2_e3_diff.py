import os, difflib

for f in ["helpers.js", "parser.js", "intelligence.js", "content.js", "dashboard.css"]:
    p2 = f"CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/{f}"
    p3 = f"CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3/src/{f}"
    l2 = open(p2, encoding="utf-8").readlines()
    l3 = open(p3, encoding="utf-8").readlines()
    diff = list(difflib.unified_diff(l2, l3, fromfile="E2", tofile="E3"))
    print(f"=== {f} diff lines: {len(diff)} ===")
    for d in diff[:10]:
        print(d, end="")
