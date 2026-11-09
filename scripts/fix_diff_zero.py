file_path = "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/intelligence.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Revert diff === 0 to safe pendingConfirmation deletion only
bad_diff_zero = """            // Check if there was a pending anomaly that has now reverted back to normal
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

clean_diff_zero = """            // Check if there was a pending anomaly that has now reverted back to normal
            if (diff === 0) {
                if (this.pendingConfirmations[pKeyIncrease]) delete this.pendingConfirmations[pKeyIncrease];
                if (this.pendingConfirmations[pKeyDecrease]) delete this.pendingConfirmations[pKeyDecrease];
                return;
            }"""

if bad_diff_zero in content:
    content = content.replace(bad_diff_zero, clean_diff_zero, 1)
    print("Reverted diff === 0 auto-resolve to clean pending confirmation clearing.")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
