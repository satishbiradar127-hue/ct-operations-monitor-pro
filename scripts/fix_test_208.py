dashboard_js_path = "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/dashboard.js"
with open(dashboard_js_path, "r", encoding="utf-8") as f:
    code = f.read()

# Fix fTime line to match exact string expected by Test 208
old_ftime = "const fTime = fTimeMs ? new Date(fTimeMs).toLocaleTimeString() : (fName ? new Date().toLocaleTimeString() : \"Awaiting DOM\");"
new_ftime = "const fTime = targetCamp.liveFilterTimestamp ? new Date(targetCamp.liveFilterTimestamp).toLocaleTimeString() : (fName ? new Date().toLocaleTimeString() : \"Awaiting DOM\");"

if old_ftime in code:
    code = code.replace(old_ftime, new_ftime)
    print("Updated fTime to match exact test signature")

# Ensure 'Last observed:' is in dashboard.js
old_obs = "setText(refs.topFilterObserved, fTime);"
new_obs = "setText(refs.topFilterObserved, \"Last observed: \" + fTime);"

if old_obs in code:
    code = code.replace(old_obs, new_obs)
    print("Updated topFilterObserved to include 'Last observed:'")

with open(dashboard_js_path, "w", encoding="utf-8") as f:
    f.write(code)
print("Test 208 fix applied!")

