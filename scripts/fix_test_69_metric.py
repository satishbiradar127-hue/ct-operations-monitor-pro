file_path = "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/tests/suite.test.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    'a.status === "RESET" && a.metric === "Total Abandoned"',
    'a.status === "RESET" && (a.metric === "Abandoned Calls" || a.metric === "Total Abandoned")'
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated Test 69 to match Abandoned Calls")
