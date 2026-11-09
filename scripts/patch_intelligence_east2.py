import re

file_path = "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/intelligence.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Remove outbound_failed_calls from DEFAULT_THRESHOLDS
pattern_threshold = r'(\s*outbound_failed_calls:\s*\{[\s\S]*?description:\s*"Telephony carrier or trunk failure anomalies"\s*\},?)'
m = re.search(pattern_threshold, content)
if m:
    content = content[:m.start()] + "\n        // outbound_failed_calls disabled at rule-generation level per alert policy\n" + content[m.end():]
    print("1. Successfully disabled outbound_failed_calls in DEFAULT_THRESHOLDS")
else:
    print("1. Pattern not found for outbound_failed_calls in DEFAULT_THRESHOLDS")

# 2. Remove evaluateOperationalMetric call for outbound_failed_calls
old_eval = 'this.evaluateOperationalMetric("outbound_failed_calls", totalFailed, "OUTBOUND", "ALL", "Failed Call Volume", now, timeStr);'
if old_eval in content:
    content = content.replace(old_eval, '// Failed-call volume alert disabled per alert policy\n            // this.evaluateOperationalMetric("outbound_failed_calls", totalFailed, "OUTBOUND", "ALL", "Failed Call Volume", now, timeStr);')
    print("2. Successfully commented out evaluateOperationalMetric for outbound_failed_calls")
else:
    print("2. outbound_failed_calls evaluation line not found")

# 3. Add safety guard in evaluateOperationalMetric
target_eval_start = "evaluateOperationalMetric(profileKey, currentValue, direction, targetId, targetName, now, timeStr) {"
replacement_eval_start = """evaluateOperationalMetric(profileKey, currentValue, direction, targetId, targetName, now, timeStr) {
            // Rule-level disablement: failed-call volume alerts are strictly disabled
            if (profileKey === "outbound_failed_calls" || profileKey === "failed_calls") return;"""
if target_eval_start in content and "Rule-level disablement: failed-call volume alerts are strictly disabled" not in content:
    content = content.replace(target_eval_start, replacement_eval_start, 1)
    print("3. Successfully added safety guard in evaluateOperationalMetric")

# 4. Auto-resolve non-goal alerts when diff === 0 in evaluateOperationalMetric
old_diff_zero = """            // Check if there was a pending anomaly that has now reverted back to normal
            if (diff === 0) {
                if (this.pendingConfirmations[pKeyIncrease]) delete this.pendingConfirmations[pKeyIncrease];
                if (this.pendingConfirmations[pKeyDecrease]) delete this.pendingConfirmations[pKeyDecrease];
                return;
            }"""

new_diff_zero = """            // Check if there was a pending anomaly that has now reverted back to normal
            if (diff === 0) {
                if (this.pendingConfirmations[pKeyIncrease]) delete this.pendingConfirmations[pKeyIncrease];
                if (this.pendingConfirmations[pKeyDecrease]) delete this.pendingConfirmations[pKeyDecrease];
                // Auto-resolve routine operational alert when metric condition normalizes
                const activeIdx = this.activeAlerts.findIndex(a => a.targetId === targetId && a.metric === profile.metric && a.category !== "SALES_GOAL");
                if (activeIdx !== -1) {
                    const resolvedAlert = this.activeAlerts.splice(activeIdx, 1)[0];
                    resolvedAlert.resolved = true;
                    resolvedAlert.resolvedAt = timeStr;
                    this.saveState();
                }
                return;
            }"""

if old_diff_zero in content:
    content = content.replace(old_diff_zero, new_diff_zero, 1)
    print("4. Successfully added auto-resolution on diff === 0")

# 5. In pushActiveAlert, reject failed-call alerts
target_push = "pushActiveAlert(alertObj) {"
replacement_push = """pushActiveAlert(alertObj) {
            if (!alertObj || alertObj.metric === "Failed Call Volume" || alertObj.profileKey === "outbound_failed_calls") {
                return; // Suppressed at rule generation level
            }"""
if target_push in content and "Suppressed at rule generation level" not in content:
    content = content.replace(target_push, replacement_push, 1)
    print("5. Successfully added suppression in pushActiveAlert")

# 6. Sanitize activeAlerts in loadState
old_load = 'this.activeAlerts = JSON.parse(this.storage.getItem(this.ALERTS_KEY) || "[]");'
new_load = 'this.activeAlerts = (JSON.parse(this.storage.getItem(this.ALERTS_KEY) || "[]") || []).filter(a => a && a.metric !== "Failed Call Volume" && a.profileKey !== "outbound_failed_calls");'
if old_load in content:
    content = content.replace(old_load, new_load, 1)
    print("6. Successfully sanitized storage load in loadState")

# 7. In getLiveFilterIntelligenceSummary, provide inactiveFilters & availableContacts in summary
old_summary_return = """            return {
                summary: {
                    totalFilters,
                    activeFilters,
                    totalContacts,
                    runningCampaignsCount,
                    verifiedActiveConfigurations: verifiedActiveConfigs
                },"""

new_summary_return = """            const inactiveFilters = (totalFilters !== null && activeFilters !== null) ? Math.max(0, totalFilters - activeFilters) : null;
            return {
                summary: {
                    totalFilters,
                    activeFilters,
                    inactiveFilters,
                    availableContacts: totalContacts,
                    totalContacts,
                    runningCampaignsCount,
                    verifiedActiveConfigurations: verifiedActiveConfigs
                },"""

if old_summary_return in content:
    content = content.replace(old_summary_return, new_summary_return, 1)
    print("7. Successfully enhanced summary KPIs in getLiveFilterIntelligenceSummary")
else:
    print("7. Summary return snippet not matched directly")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("East-2 intelligence.js patch complete.")
