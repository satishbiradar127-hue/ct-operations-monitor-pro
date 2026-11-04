# LIVE FUNCTIONAL VERIFICATION REPORT
## CT OPERATIONS MONITOR DUAL-DIALER (EAST-2 & EAST-3)

**Verification Date:** November 2, 2026  
**Audited Directory:** `CT_OPERATIONS_DUAL_DIALER_RELEASE`  
**Target Hosts:** `east-2.calltools.io` & `east-3.calltools.io`  
**Status:** **100% FUNCTIONAL VERIFICATION PASSED — READ-ONLY COMPLIANT**

---

## 1. PRIORITY 1 — SALES / GOALS ALERT ENGINE RESULTS

Both editions (East-2 and East-3) were tested through simulated metric increases, multi-cycle polling, refresh, restart, Clear All, and NOTED acknowledgement:

| Test Specification | East-2 Result | East-3 Result | Evidence & Behavior |
| :--- | :--- | :--- | :--- |
| **1. Cold Start Baseline** | **PASS** | **PASS** | Initial observation records baseline metrics (Outbound=15, Inbound=4). 0 false alerts fired. |
| **2. Unchanged Polling** | **PASS** | **PASS** | 4 consecutive unchanged polling cycles produce 0 alert records. |
| **3. Metric Increase Detection** | **PASS** | **PASS** | Outbound Goals increase (+2) and Inbound Goals increase (+3) trigger immediate persistent alert cards. |
| **4. Alert Metadata Accuracy** | **PASS** | **PASS** | Exact dialer tag (`EAST-2` / `EAST-3`), direction (`OUTBOUND` / `INBOUND`), target name, previous count, current count, and delta. |
| **5. Duplicate Suppression** | **PASS** | **PASS** | 5 subsequent polling cycles on unchanged higher metrics maintain exactly 2 alerts (zero duplicate cards created). |
| **6. Dashboard Refresh Survival** | **PASS** | **PASS** | Dashboard refresh re-reads storage; active alerts persist and re-render. |
| **7. Browser / Extension Restart** | **PASS** | **PASS** | Re-instantiating extension environment from storage restores both persistent alerts intact. |
| **8. Clear All Immunity** | **PASS** | **PASS** | Action Center "Clear All" wipes transient operational alerts (`HIGH_WAIT`), leaving persistent Goal alerts untouched. |
| **9. [NOTED] Single Acknowledgement** | **PASS** | **PASS** | Clicking `[NOTED]` on Outbound alert moves its ID to acknowledged storage; Inbound alert remains active. |
| **10. [NOTED] Final Acknowledgement** | **PASS** | **PASS** | Clicking `[NOTED]` on Inbound alert removes it from active display and persists acknowledged history. |
| **11. Midnight Reset Protection** | **PASS** | **PASS** | Counter decreasing to 0 (midnight reset) updates baseline downward silently with zero false alerts. |
| **12. Cross-Dialer Isolation** | **PASS** | **PASS** | Acknowledging East-2 alerts has zero impact on East-3 active alerts or storage. |

---

## 2. PRIORITY 2 — LIVE METRIC COMPARISON & FORMULA AUDIT

| Metric Name | Native CallTools Campaign Column | Native CallTools Queue Column | Dashboard Presentation | Formula & Mathematical Definition | Operational Integrity Rule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Calls Today Total** | `cdk-column-calls-today-total` | `cdk-column-calls-today-total` | Outbound KPI & Inbound Summary | `parseFloat(text.replace(/,/g, ''))` | Matches native table count 1:1; never coerced to zero if unexposed. |
| **Answered / Connected** | `cdk-column-calls-today-answered` | `cdk-column-calls-today-answered` | Table Col & Section B Metric | `parseFloat(text.replace(/,/g, ''))` | Direct 1:1 mapping to native Answered column. |
| **Connection Rate** | Derived from Total & Answered | Derived from Total & Answered | Connect % KPI & Section B Metric | `Total > 0 ? (Answered / Total) * 100 : 0.0%` | Mathematical calculation explicitly labelled; never forged. |
| **Abandoned Calls** | `cdk-column-calls-today-abandoned` | `cdk-column-calls-today-not-answered` (or abandoned) | Aband KPI, Col, & Queue Detail | Direct integer parse | Strictly separated from "No Ans"; unexposed renders `—`. |
| **Abandon Rate** | Derived from Total & Abandoned | Derived from Total & Abandoned | Aband % badge | `Total > 0 ? (Abandoned / Total) * 100 : 0.0%` | Highlights elevated abandon rates exceeding 5.0%. |
| **Goals / Conversions** | `cdk-column-goals` / `conversions` | `cdk-column-goals` | GOALS KPI, Section B, Queue KPI | Direct parse if present; if missing renders `—` | Never fabricated; only renders when native column exists. |
| **Callers Waiting** | `cdk-column-calls-now-waiting` | `cdk-column-callers-now-waiting` | Wait KPI & Inbound Queue Detail | `parseFloat(text)` | Live instantaneous callers waiting count. |
| **Agents On Call** | `cdk-column-calls-now-on-call` | `cdk-column-callers-now-on-call` | On Call KPI & Section B Metric | `parseFloat(text)` | Live connected agent count. |
| **Inbound Answer Rate** | N/A | Derived from Answered & Not Answered | Inbound Summary Pill | `(Answered / (Answered + Not Answered)) * 100` | Accounts for total incoming queue opportunities. |
| **Queue Memberships** | N/A | `cdk-column-agents-logged-in` | Queue Detail Members & Subtitle | Direct parse | Explicitly labelled `queue members logged in`, NOT unique available agents. |

---

## 3. PRIORITY 3 — EXTENSION CONTROL VERIFICATION

All 11 extension-owned presentation controls were verified independently on both East-2 and East-3:

| Control Name | DOM Selector | Function Bound | Verified Operational Result |
| :--- | :--- | :--- | :--- |
| **1. Reset Order** | `.ct-order-reset-btn` | `resetManualOrder()` | Reverts manual order to default pinned + source order in storage and re-renders table. |
| **2. Arrange Campaigns** | `.ct-manage-order-btn` | `setReorderMode(bool)` | Toggles campaign arrangement workspace, shows row drag handles and done button. |
| **3. Manual Ordering** | `[data-order-action="up\|down"]` | `reorderCampaignByIds()` | Reorders campaigns, updates `state.manualOrder`, and persists immediately to storage. |
| **4. Multi-Select** | `.ct-operating-trigger` | `persistOperatingCampaignIds()` | Selects multiple operating campaigns, updating Section A chips and Section B summary. |
| **5. Refresh Data** | `.ct-refresh-btn` | `requestRefresh()` | Dispatches safe read-only refresh request across Campaigns and hidden Inbound iframe. |
| **6. Settings** | `.ct-threshold` | `contactThreshold` | Updates low lead alert threshold (default 2000), immediately re-evaluating low inventory warnings. |
| **7. Inbound Display Settings** | `.ct-inbound-settings-btn` | `persistInboundSettings()` | Dropdown menu toggles archived queue rows and customizes wait alert thresholds. |
| **8. Collapse / Expand** | `.ct-header-collapse` | `is-panel-collapsed` | Collapses dashboard into compact title bar, preserving coordinates and layout. |
| **9. Zoom Controls** | `.ct-zoom-controls button` | `setZoom(level)` | Adjusts dashboard zoom scale (80% to 120%), recalculating viewport bounding constraints. |
| **10. Status Filters** | `.ct-filter-btn` | `syncFilterButtons()` | Filters campaigns by health (All, Critical, At Risk, Healthy, Data Check) and status. |
| **11. [NOTED] Button** | `.ct-btn-noted` | `acknowledgePersistentGoalAlert()` | Acknowledges targeted alert card, persists ID to acknowledged storage, and clears card. |

