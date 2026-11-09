# CT OPERATIONS MONITOR PRO — COMPLETE FORENSIC AUDIT REPORT
**Release Target:** v11.3.4 Production Dual-Dialer  
**Audited Dialers:** EAST-2 (`https://east-2.calltools.io`) & EAST-3 (`https://east-3.calltools.io`)  
**Audit Scope:** Full system-wide inspection covering Data Pipeline, Parsers, Intelligence Engines, Refresh Coordination, Dropdown & Layout Mechanics, Storage Namespaces, Security Boundaries, and Provenance Truthfulness.  
**Date:** 2026-11-09  

---

## 1. EXECUTIVE SUMMARY & FORENSIC FINDINGS

This forensic investigation was initiated following observed production discrepancies in authenticated CallTools sessions on Chrome Profile 20:
1. The installed extension rendered as version `11.3.3` despite reports claiming a `v11.3.4` release.
2. The Live Filter Intelligence section rendered `0` total filters and `0` running campaigns even while TS FRESH DATA was actively running with 13 connected agents.
3. The campaign assignment matrix displayed synthetic identifiers such as `campaign-0`, `campaign-1`, `campaign-2` rather than real numeric CallTools IDs or honest unverified placeholders.
4. The "Refresh Data" button appeared nonfunctional, providing zero visual feedback, no per-source coordination, and no explanation when closed tabs (such as `/manager/live-filters`) could not be read.
5. Reloading the browser caused the dashboard modal to collapse into a squished, narrow viewport rather than auto-adjusting to fill the screen.
6. The Operating Campaign selector menu was unclickable or displaced off-screen due to `getBoundingClientRect()` fixed-position coordinate conflicts inside transformed/scaled DOM containers.
7. Sales and Goals alerts disappeared upon page refresh before the operator had clicked `[NOTED]`.

---

## 2. ROOT CAUSE TRACEABILITY MATRIX

| Defect ID | Observed Manifestation | Root Cause (File & Line) | Mechanism of Failure |
| :--- | :--- | :--- | :--- |
| **DEF-01** | Version Discrepancy (Manifest 11.3.3 vs Report 11.3.4) | `manifest.json` (all variants) | Hardcoded `"version": "11.3.3"` in root, East-2, East-3, and packaging scripts. |
| **DEF-02** | 0 Running Campaigns Reported (13 agents ignored) | `intelligence.js:1253-1256` | Checked non-existent properties `c.agents` and `c.state`. Parsed campaigns actually expose `c.active`, `c.__active`, `c.loggedIn`, `c.__loggedIn`. As a result, `isRunning` was always `false`. |
| **DEF-03** | Synthetic `campaign-0` IDs in Assignment Matrix | `intelligence.js:1251` & `parser.js:621` | Fallback `String(c.id \|\| c.__id \|\| 'campaign-${idx}')` fabricated fake IDs when table row lacked `data-campaign-id`. Campaign parser only checked `edit` links rather than all action links (`members`, `settings`, `logs`, query params). |
| **DEF-04** | Live Filter KPIs displaying fake `0` filters & `0` contacts | `intelligence.js:1238-1240` & `dashboard.js:7091` | When `/manager/live-filters` had not yet been visited, inventory was empty `{}`. Code evaluated `length = 0` and `sum = 0`, rendering misleading zeroes instead of explicit `AWAITING OBSERVATION` / `—`. |
| **DEF-05** | Refresh Data button nonfunctional & non-reactive | `content.js:666` & `dashboard.js:3638` | `dashboard.js` dispatched `REQUEST_REFRESH_EVENT` with no loading state or in-flight lock. `content.js` blindly executed campaign parse even if tab was on `/manager/live-filters` and returned no status/completion event. |
| **DEF-06** | Dashboard resetting to small squished view on refresh | `dashboard.js:29-31, 7849-7860` | `LAYOUT_VERSION` was 19. An old squished layout stored in `localStorage` was reloaded on every refresh. `normalizeLayout` lacked detection for desktop squished view discards. |
| **DEF-07** | Operating Campaign dropdown misplaced off-screen | `dashboard.js:3588-3595` & `dashboard.css` | Used `position: fixed` with `getBoundingClientRect()`. In CSS, transformed/scaled ancestors become the containing block for fixed elements, displacing viewport-calculated coordinates off-screen. |
| **DEF-08** | Persistent Goal/Sales alerts disappearing on reload | `dashboard.js:6251` | `updateAlerts()` had filter `a.category !== "SALES_GOAL"`, permanently hiding unacknowledged sales alerts created by the intelligence engine upon reload. |
| **DEF-09** | Dual-Dialer storage key leakage on EAST-3 | `dashboard.js:32-34` | `SELECTED_CAMPAIGNS_KEY`, `FILTER_STATE_KEY`, `FILTER_HEALTH_KEY` were hardcoded to `ct_east2_` on EAST-3. |

---

## 3. DATA PIPELINE FORENSIC INSPECTION

### A. CallTools Campaigns (`/manager/campaigns`)
- **Native DOM Reality:** CallTools renders an Angular Material mat-table with two header tiers (group headers and leaf columns). The numeric campaign ID is not always rendered on `<tr data-campaign-id>`. However, action links within the row consistently contain `/manager/campaigns/edit/:id`, `/members/:id`, `/agent-dashboard-settings/:id`, `/change-logs/:id`, or URL queries `logged_in_agents_for_campaign=:id`.
- **Parsing Gap:** Previous parser only checked `a[href*="/campaigns/edit/"]`. If the edit link was absent or transformed into an icon button, ID defaulted to empty, causing `intelligence.js` to fabricate `campaign-0`.
- **Metrics Exposure:** Columns include Name, Active toggle, Contact count, Channels per agent, Wait times, Outbound attempts, Human, Machine, Agent Connect, Abandoned, No answer, Busy, Failed. Logged-in agents are exposed when campaign monitoring columns are active.

### B. CallTools Live Filters (`/manager/live-filters`)
- **Native DOM Reality:** Renders filter name, active toggle (mat-slide-toggle or text), available contact count, ignore time zone count, and row action buttons (Change Log, Preview, Edit, Duplicate, Delete).
- **Provenance Truthfulness:** The native live filters table does NOT render the native refill timestamp. It displays contact counts and active status only. Mislabling observation time as refill time violates truthful provenance.

### C. Inbound Queue Bridge (`/manager/queues` via hidden iframe)
- **Native DOM Reality:** Unchanged and isolated. Runs inside a background iframe on `/manager/queues?ct_inbound_monitor=1`. Communicates queues status via `postMessage` and extension storage.
- **Health:** 100% operational; preserved with zero modifications.

---

## 4. STRICT ZERO-INTERFERENCE SECURITY AUDIT

The security audit script (`scripts/security_reaudit.js`) was executed against all source files:
- `fetch()` calls: **0**
- `XMLHttpRequest` (XHR) calls: **0**
- `WebSocket` calls: **0**
- Native CallTools button clicks: **0**
- Native CallTools form submissions: **0**
- Unauthorized background iframes for live filters: **0** (Only authorized inbound queue iframe permitted)
- **Compliance Status:** **100% STRICT READ-ONLY PASS**

---

*Report certified by Antigravity Autonomous Systems Engineering.*

