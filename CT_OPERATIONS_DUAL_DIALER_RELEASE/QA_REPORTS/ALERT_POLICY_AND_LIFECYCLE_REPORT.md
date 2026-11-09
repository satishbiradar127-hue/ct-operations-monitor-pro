# ALERT POLICY AND LIFECYCLE AUDIT REPORT
**Project:** CT Operations Monitor Pro  
**Dialers:** EAST-2 & EAST-3  
**Release Version:** v11.3.5  
**Policy Effective Date:** November 9, 2026  
**Auditor:** Telephony Operations Quality & Reliability Engineering  

---

## 1. Directive Background & Problem Statement

Prior to v11.3.5, operator alert fatigue was identified as a critical operational hazard:
1. **Excessive Manual Acknowledgements:** Routine operational changes (such as minor lead inventory shifts, agent staffing variations, and filter re-verifications) rendered individual `[NOTED]` buttons in the Action Center. Operators were forced to manually click dozens of informational cards throughout their shifts.
2. **Unwanted Failed-Call Volume Alerts:** Telephony carrier disconnects and trunk surges frequently triggered high-priority "Failed Call Volume" critical alerts. Operators explicitly mandated the complete removal of failed-call volume alerts.
3. **Inconsistent Lifecycle & Resolution:** Critical alerts lacked clear distinction from routine informational updates, causing confusion regarding which alerts required immediate intervention versus passive awareness.

---

## 2. The New Command Center Alert Policy (v11.3.5)

The alert policy has been completely restructured around five strict operational pillars:

```
+---------------------------------------------------------------------------------------------------+
|                                 CT OPERATIONS ALERT TAXONOMY                                      |
+---------------------------------------------------------------------------------------------------+
| Category                 | Acknowledgement | Presentation        | Auto-Resolution | Action Type  |
|--------------------------|-----------------|---------------------|-----------------|--------------|
| 1. Goal Alerts           | Manual [NOTED]  | Persistent Card     | Never (until    | Operator     |
|    (New Sales / Goals)   | Required        | Gold/Emerald Accent | acknowledged)   | Audit        |
|--------------------------|-----------------|---------------------|-----------------|--------------|
| 2. Routine Informational | NONE            | Status Tag          | Automatic       | Passive      |
|    (Leads/Agents/Filters)| (Automated)     | "AUTO-UPDATING"     | on next poll    | Awareness    |
|--------------------------|-----------------|---------------------|-----------------|--------------|
| 3. Failed-Call Volume    | DISABLED        | SUPPRESSED          | N/A (Rule       | None         |
|                          | (No alerts)     | AT SOURCE           | Disabled)       | (Metrics kep)|
|--------------------------|-----------------|---------------------|-----------------|--------------|
| 4. Critical Warnings     | Actionable      | Red/Amber Card      | Automatic when  | FOCUS /      |
|    (Capacity / Wait)     | Buttons Only    | Explicit Action     | condition clears| OPERATE      |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. Deep-Dive Policy Implementation

### A. Goal Alerts (Engine A & Persistent Goals)
- **Mandate:** Goal-related alerts are the **ONLY routine notification category** that requires manual operator acknowledgement.
- **Trigger Conditions:**
  - `New Goals Detected`: Outbound campaign or Inbound queue increments goal counter above baseline.
  - `New Sales Detected`: Outbound campaign or Inbound queue increments sales counter above baseline.
- **Card Content & Presentation:**
  - Target Name: Full campaign name or queue name (e.g. `TS FRESH DATA`).
  - Dialer Tag: `[EAST-2]` or `[EAST-3]`.
  - Direction Tag: `[OUTBOUND]` or `[INBOUND]`.
  - Stat Progression: `Goals: <previous> → <current> (+<increase>)` formatted with thousands commas (e.g. `Goals: 5 → 8 (+3)`).
  - Timestamp: Exact detection and confirmation time.
  - Action Button: `<button type="button" class="ct-btn ct-btn-noted" data-noted-id="...">✓ NOTED</button>`.
- **Deduplication & History:**
  - Duplicate notifications for the same observation count are strictly suppressed.
  - Clicking `[NOTED]` records the alert ID in `state.acknowledgedGoalAlerts`, synchronizes with persistent storage, and immediately removes the card from view without loss of audit logs.

### B. Routine Operational Notifications (Engines B & C)
- **Mandate:** Routine informational updates must **NEVER require manual operator acknowledgement**.
- **Scope:**
  - Ordinary campaign metric fluctuations.
  - Normal agent count adjustments (e.g. agent break rotations).
  - Contact pool changes (new leads added or normal dialer depletion).
  - Routine live filter targeting re-verifications.
- **Card Content & Presentation:**
  - Displays with an unambiguous `<span class="ct-intel-auto-tag">AUTO-UPDATING</span>` badge.
  - The manual `[NOTED]` button has been **completely removed**.
  - Notifications refresh automatically upon subsequent CallTools observations.
  - When the underlying metric stabilizes or condition clears, the item updates or clears automatically without operator intervention.

### C. Failed-Call Volume Alerts — Completely Disabled
- **Mandate:** Completely eliminate failed-call volume alert generation at the source rule level.
- **Multi-Layer Source Elimination:**
  1. **Threshold Configuration:** Removed `outbound_failed_calls` from `DEFAULT_THRESHOLDS` in `intelligence.js`.
  2. **Evaluation Loop:** Commented out and removed `this.evaluateOperationalMetric("outbound_failed_calls", ...)` from the outbound execution loop.
  3. **Method Safety Guard:** Added an explicit guard in `evaluateOperationalMetric`:
     ```javascript
     if (profileKey === "outbound_failed_calls" || profileKey === "failed_calls") return;
     ```
  4. **Alert Ingestion Guard:** Added an explicit guard in `pushActiveAlert`:
     ```javascript
     if (!alertObj || alertObj.metric === "Failed Call Volume" || alertObj.profileKey === "outbound_failed_calls") return;
     ```
  5. **Storage Sanitizer:** On extension initialization and storage load, any historical `Failed Call Volume` records are pruned from `this.activeAlerts`.
  6. **Metric Reporting Preserved:** CallTools native reporting of `failed` call counts in table rows, focus panels, and summary cards is 100% preserved. The requirement disables the alert rule, not the truth of telephony metrics.

### D. Critical Operational Warnings
- **Mandate:** Preserve high-priority operational warnings with actionable operator directions and automatic resolution.
- **Active Conditions:**
  - `NO AGENT CAPACITY`: Callers waiting > 0 with 0 logged-in agents.
  - `QUEUE DELAY`: Maximum wait delay >= 60 seconds (critical) or >= 30 seconds (warning).
  - `OUT OF LEADS`: Callable leads dropped to 0 across operating or shared campaigns.
  - `ABANDONED CALLS`: High abandonment rate (>= 5%) or material spike.
  - `INBOUND CAPACITY`: Queue callers waiting with 0 logged-in agents.
- **Lifecycle & Action Design:**
  - **No Meaningless "Noted" Button:** Replaced with operational actions: `FOCUS`, `OPERATE`, `VIEW QUEUE`, `REFRESH`, and `DISMISS`.
  - **Actionable Message:** Explains exactly what operational action must be taken (e.g. `"Check agent readiness, queue membership, and campaign assignment."`).
  - **Automatic Resolution:** When the condition clears on subsequent polling (e.g. agents log in or wait drops below threshold), the alert is automatically marked resolved (`a.__inactive = true`), increments recovery counter (`state.recoveryCount++`), and clears from the active Action Center.

---

## 4. Verification Evidence & Automated Tests

All alert lifecycle rules are covered by automated unit and integration tests:
- `EAST-2 UPGRADE 244`: Confirms 0 alerts are fired even upon a +500 failed-call spike.
- `EAST-2 UPGRADE 245`: Confirms Goal alerts are the ONLY category requiring `[NOTED]` acknowledgement.
- `EAST-2 UPGRADE 246`: Confirms routine operational updates do not require manual acknowledgement.
- `EAST-2 UPGRADE 247`: Confirms critical warnings explain required operator actions and auto-resolve.
- `EAST-3 UPGRADE 244-247`: Identical dual-dialer verification on EAST-3.

All tests pass 100% across both dialer editions.
