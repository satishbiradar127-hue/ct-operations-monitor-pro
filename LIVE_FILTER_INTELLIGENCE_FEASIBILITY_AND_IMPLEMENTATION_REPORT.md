# LIVE FILTER INTELLIGENCE — FEASIBILITY, SAFE IMPLEMENTATION & ZERO-INTERFERENCE INVESTIGATION REPORT

**Project:** CT Operations Monitor Pro (Dual-Dialer)  
**Workspace:** `C:\Users\Orange Carrot\Downloads\CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL`  
**Dialer Instances:** EAST-2 (`https://east-2.calltools.io`) & EAST-3 (`https://east-3.calltools.io`)  
**Existing Release Packages:** `CT_Operations_Monitor_East2` & `CT_Operations_Monitor_East3`  
**Date of Investigation:** 2026-11-06  
**Document Status:** Complete Forensic Investigation & Architecture Blueprint  

---

## EXECUTIVE SUMMARY & DIRECT ANSWER TO THE FINAL QUESTION

> ### FINAL QUESTION:
> **"Can we reliably identify which Live Filter each campaign is using, which filters are actually being used by running campaigns, and detect changes made by other operators without touching or interfering with CallTools?"**

### DIRECT ANSWER:
**PARTIAL (Feasible with Safe Opportunistic & Dual-Page Monitoring; Fully Automatic Instant Remote Detection Without Opening Edit is NOT Technically Possible Under Strict Zero-Interference Rules).**

1. **Why Instant Remote Detection from `/manager/campaigns` Alone is Impossible:**  
   CallTools **never renders the assigned Live Filter anywhere in the visible DOM of the Campaigns list view (`/manager/campaigns`)**, nor does it render which campaign uses each filter on `/manager/live-filters`. Furthermore, CallTools does **not** broadcast campaign configuration mutations over WebSocket (which carries real-time dialer telemetry only: calls, agents, queues). Under the strict Zero-Interference Policy (0 button clicks, 0 form submits, 0 automated navigations, 0 hidden iframes, and 0 network requests via fetch/XHR), a read-only observer cannot read information that the host application does not render in the active viewport.

2. **The Safe, Practical & Proven Alternative (Option E — Best Available Monitoring):**  
   We can reliably build the **Live Filter Intelligence Command Center** by synthesizing three permitted passive observation surfaces:
   - **Surface 1 (`/manager/live-filters`):** Passively captures total Live Filter inventory, active/inactive states, available contact counts, and timezone counts.
   - **Surface 2 (`/manager/campaigns`):** Passively captures running campaigns, logged-in agents, live dialing metrics, and contact pool sizes.
   - **Surface 3 (Targeting Edit Form & CDK Overlays):** Passively captures verified Campaign-to-Filter assignments whenever an operator visits `/manager/campaigns/edit/:id` or opens a quick-edit overlay during normal work.
   - **Cross-Dialer Storage Isolation:** Persisted into dialer-specific registries (`ct_east2_*` and `ct_east3_*`) with strict ID-first matching and 7-day invalidation.

---

## 1. SOURCE FILES & RUNTIME ARTIFACTS INSPECTED

The following codebase files, Chrome session stores, and cached Angular bundles were forensically audited:

| File / Component | Location / Source | Role & Forensic Findings |
| :--- | :--- | :--- |
| [`content.js`](file:///C:/Users/Orange%20Carrot/Downloads/CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL/CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/content.js) | Extension Content Script | Manages routing (`campaigns`, `campaign_edit`, `queues`), passive edit form observation, and inbound hidden iframe coordination. |
| [`parser.js`](file:///C:/Users/Orange%20Carrot/Downloads/CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL/CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/parser.js) | DOM Parsing Engine | Extracts 23 campaign table columns, CDK overlays, edit form Targeting fields (`mat-select[formcontrolname="live_filter"]`), and hydrates verified registry. |
| [`intelligence.js`](file:///C:/Users/Orange%20Carrot/Downloads/CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL/CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/intelligence.js) | CT Data Intelligence Engine | Enforces 2-observation confirmation lifecycle (`confirmationsRequired: 2`) for filter transitions, baselines, and Action Center alert persistence. |
| [`dashboard.js`](file:///C:/Users/Orange%20Carrot/Downloads/CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL/CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/dashboard.js) | Operations Command Center UI | Renders top live filter strip (`.ct-top-live-filter-strip`), synchronized campaign row badges, and 15s live monitoring countdown. |
| `manifest.json` | Extension Manifest v3 | Matches `https://east-2.calltools.io/manager/campaigns*` and `https://east-2.calltools.io/manager/queues*` with `all_frames: true`. |
| Chrome History SQLite | Profile 20 (`History`) | Proven visits: `/manager/live-filters` (165 visits), `/manager/live-filter-performance` (116 visits), `/manager/campaigns/edit/59874` (208 visits). |
| Angular Bundle `f_008388` | Chrome Cache Data | Live Filters Angular component: Table columns `["name", "active", "count", "total-count", "logs", "controls"]`. Button `View Change Log`. |
| API Payload `f_008512` | Chrome Cache Data | Raw JSON payload from `/api/livefilters/`: Confirms 35 filters in account, fields `id`, `name`, `active`, `count`, `ignore_time_zone_count`, `condition_set`. Zero campaign keys. |
| Angular Bundle `f_0083d1` | Chrome Cache Data | Live Filter Performance component: Columns `["Live Filter Id", "Name", "Calls Outbound", "Human", "Connects", "Goals"]`. |

---

## 2. EXISTING INBOUND MONITORING ARCHITECTURE

To ensure non-interference, the existing inbound monitoring architecture was mapped:

```
[Main Browser Tab: /manager/campaigns]
       |
       |--- 1. Creates hidden iframe (<iframe id="ct-operations-hidden-queue-feed-east2">)
       |       pointing to /manager/queues?ct_inbound_monitor=1&ct_inbound_owner=ctompro_east2
       |
       v
[Inside Hidden Iframe: /manager/queues]
       |
       |--- 2. content.js detects isBackgroundInboundMonitor() === true
       |--- 3. CTParser.readQueues(document) parses native Angular Queue table
       |--- 4. Heartbeat (every 2.5s) writes payload to localStorage and chrome.storage.local:
       |       - Key: ct_east2_last_known_queues_v1
       |       - Key: ct_east2_inbound_feed_status_v1
       |
       v
[Main Window Dashboard: dashboard.js]
       |--- 5. Listens to window "storage" and chrome.storage.onChanged
       |--- 6. Updates Inbound Operations section in real time
```

### Critical Preservation Rule:
The existing inbound queue monitoring mechanism operates independently and **must remain 100% untouched**. Under the Zero-Interference Policy for the new **Live Filter Intelligence** feature, creating hidden iframes to `/manager/live-filters` or `/manager/campaigns/edit/*` is **prohibited**.

---

## 3. NATIVE DOM INVESTIGATION: VISIBLE CALLTOOLS PAGES

### 3.1 Live Filters Page (`https://<host>/manager/live-filters`)
Forensic analysis of the cached Angular bundle `f_008388` and API response `f_008512` revealed:

1. **Table Structure & Exposed Columns:**
   - Component: `liveFilterTable`
   - Columns:
     - `name`: Filter Name (e.g. `RES CRED MID`, `TS Fresh Leads Active`)
     - `active`: Toggle switch or indicator showing `Active` or `Inactive`
     - `count`: Available contact count (e.g. `28,550`)
     - `total-count`: Total contacts ignoring time zones (e.g. `29,079`)
     - `logs`: Button labeled `View Change Log` linking to `["change-logs", id]`
     - `controls`: Action buttons (`Preview`, `Edit`, `Duplicate`, `Delete`)
     - Pagination: `Show 25`, `Page 1 of 2` (Total count: 35 filters in account)
2. **Missing Information on `/manager/live-filters`:**
   - **Crucial Finding:** The Live Filters table does **NOT** expose which campaign is assigned to each filter.
   - The backend data model (`/api/livefilters/`) has zero foreign keys or lists pointing back to campaigns. In CallTools' relational schema, a Campaign has a `live_filter_id`, but a Live Filter does not store its assigned campaigns.
3. **Change Log Button Behavior:**
   - The Change Log column does not display text inline. It renders a button: `View Change Log`.
   - Clicking this button routes to `/manager/live-filters/change-logs/:id`. Under the Zero-Interference Policy, clicking CallTools controls is prohibited.
   - Furthermore, the Live Filter Change Log only records changes to the filter's targeting rules (e.g. tags, dispositions, conditions), **not** which campaign is using it.

### 3.2 Campaigns Page (`https://<host>/manager/campaigns`)
1. **Table Structure & Exposed Columns:**
   - Table: `table.mat-table` with 23 standard columns.
   - Visible fields: Campaign ID (in edit link `a[href*="/manager/campaigns/edit/:id"]`), Campaign Name, Operating Status (`active`/`inactive`), Logged-in Agents, Live Leads (`cdk-column-contact_count`), Outbound Attempts, Connects, Abandoned, Goals.
2. **Missing Information on `/manager/campaigns`:**
   - The native list table does **NOT** render the assigned Live Filter name or ID by default.

### 3.3 Campaign Edit Page (`https://<host>/manager/campaigns/edit/:id`)
1. **The Single Source of Association:**
   - The Campaign Edit page is the **only native CallTools page that correlates a Campaign with its assigned Live Filter**.
   - Under the Targeting section, it renders:
     - `mat-select[formcontrolname="live_filter"]`
     - `.mat-select-value-text` displaying the active filter name.
   - When an authorized operator naturally opens this page, `content.js` passively intercepts the rendered DOM and extracts the pairing with 100% confidence.

---

## 4. FEASIBILITY ANALYSIS & RANKING OF ZERO-INTERFERENCE OPTIONS

| Option | Architecture & Mechanism | Can Detect Remote Operator Changes? | Requires User Action? | Reliability | Feasibility Rank |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Option E (Best Available Monitoring — Composite)** | Synthesizes Live Filter Inventory (`/manager/live-filters`), Campaign Status (`/manager/campaigns`), and Verified Assignments (Edit Page / Overlays) into unified command center. | Yes, when operator opens Edit or Overlay; preserves prior verified baselines with honest provenance. | No forced action; captures data naturally as operator works. | **VERY HIGH** | **RANK 1 (RECOMMENDED)** |
| **Option B (Opportunistic Passive Observation)** | Observes Campaign Edit DOM (`/manager/campaigns/edit/:id`) or CDK overlays only when operator naturally navigates there. | Detects change immediately upon next edit visit (<350ms). | Dependent on operator visiting Edit page. | **HIGH** | **RANK 2** |
| **Option D (Human-Assisted Confirmation)** | Displays unobserved or changed filters as `Pending Verification`; operator clicks native pencil icon to verify. | Yes, verified upon operator inspection. | Operator clicks native pencil icon. | **HIGH** | **RANK 3** |
| **Option A (Passive Dual-Page Observation)** | Correlates `/manager/live-filters` with `/manager/campaigns` assuming both tabs are open. | Cannot reliably link campaign to filter because neither page lists the relationship. | Requires both pages open. | **LOW (Ambiguous)** | **RANK 4** |
| **Option C (Change-Log Observation)** | Attempts to read Live Filter change log from list view. | No. Change log is behind a button; tracks filter rule changes, not campaign targeting. | Prohibited (requires button clicks). | **ZERO** | **RANK 5 (UNFEASIBLE)** |

---

## 5. RECOMMENDED DASHBOARD ARCHITECTURE: LIVE FILTER INTELLIGENCE

The new feature will be integrated as a dedicated command center panel: `LIVE FILTER INTELLIGENCE`.

```
========================================================================================
                               LIVE FILTER INTELLIGENCE
========================================================================================
[SUMMARY KPIS]
+-------------------+-------------------+-------------------+-------------------+
| TOTAL FILTERS: 35 | ACTIVE FILTERS: 28| RUNNING CAMPAIGNS:| VERIFIED USAGE:   |
| 28 Active, 7 Off  | 358,420 Contacts  | 1 Active (13 Agt) | 1 Campaign        |
+-------------------+-------------------+-------------------+-------------------+

[A. LIVE FILTER INVENTORY] (Sourced from /manager/live-filters)
----------------------------------------------------------------------------------------
FILTER NAME         | STATUS   | CONTACTS | TIMEZONE CNT | DIALER | LAST OBSERVED
----------------------------------------------------------------------------------------
RES CRED MID        | ACTIVE   | 28,550   | 29,079       | EAST-2 | 10:45 AM (Just now)
RES CRED MAIN 67269 | ACTIVE   | 64,120   | 65,300       | EAST-2 | 10:45 AM (Just now)
TS Fresh Leads Active| ACTIVE  | 14,200   | 14,500       | EAST-3 | 10:46 AM (Just now)

[B. CAMPAIGN ASSIGNMENT MATRIX] (Cross-referenced with /manager/campaigns)
----------------------------------------------------------------------------------------
CAMPAIGN NAME | ID    | STATE   | ASSIGNED LIVE FILTER | VERIFICATION     | USAGE STATUS
----------------------------------------------------------------------------------------
TS FRESH DATA | 59874 | RUNNING | TS Fresh Leads Active| VERIFIED (Edit)  | VERIFIED ACTIVE
INBOUND SUPP  | 60327 | IDLE    | None Assigned        | VERIFIED (Edit)  | UNASSIGNED
OUTBOUND B    | 61210 | RUNNING | Filter Unavailable   | DOM_UNAVAILABLE  | UNKNOWN

[C. FILTER CHANGE HISTORY] (Action Center Persistent Alerts)
----------------------------------------------------------------------------------------
CAMPAIGN      | OLD FILTER      | NEW FILTER       | CONFIRMED AT | EVIDENCE SOURCE
----------------------------------------------------------------------------------------
TS FRESH DATA | RES CRED MAIN   | RES CRED MID     | 10:42:15 AM  | Edit Page DOM
```

### Status Definitions (Strict & Honest):
- **ACTIVE FILTER:** Filter toggle is enabled on `/manager/live-filters`.
- **ASSIGNED FILTER:** Campaign targeting explicitly paired with filter (via Edit DOM or overlay).
- **RUNNING CAMPAIGN:** Campaign operating on `/manager/campaigns` with active state and logged-in agents.
- **VERIFIED ACTIVE USAGE:** Running campaign has a confirmed, non-stale assigned filter.
- **UNKNOWN / UNAVAILABLE:** Campaign is running, but targeting filter has not yet been observed in the current session.
- **STALE:** Observation timestamp is older than 7 days.

---

## 6. DATA INTEGRITY & DUAL-DIALER ISOLATION

1. **100% Host and Storage Isolation:**
   - EAST-2: Storage namespace `ct_east2_*` (e.g. `ct_east2_live_filters_inventory_v1`, `ct_east2_verified_campaign_filters_v1`).
   - EAST-3: Storage namespace `ct_east3_*` (e.g. `ct_east3_live_filters_inventory_v1`, `ct_east3_verified_campaign_filters_v1`).
2. **Stable ID Matching:**
   - Campaigns: Matched strictly by numeric Campaign ID (e.g. `59874`). Never by name alone when an ID is known.
   - Live Filters: Matched strictly by integer Live Filter ID (e.g. `74151`, `67269`).
3. **Change Detection Confirmation:**
   - Every detected transition (Filter A → Filter B, Assigned, Removed) requires **2 consecutive observation cycles** (`confirmationsRequired: 2`) before an alert is dispatched.
   - Prevents transient false alerts from loading glitches or DOM pagination.

---

## 7. ZERO-INTERFERENCE SECURITY AUDIT

The proposed design satisfies 100% of the Zero-Interference Policy:
- **0 native CallTools button clicks** (No clicking Edit, Preview, Set Ready, Delete).
- **0 form submissions or setting changes**.
- **0 automated page navigations** (Only inspects pages the operator naturally opens).
- **0 hidden tabs or background iframes** for Live Filters.
- **0 network requests** (0 `fetch`, 0 `XMLHttpRequest`, 0 `WebSocket`, 0 private API calls).
- **0 reading hidden or internal private state**.
- AST Security Scanner (`scripts/security_reaudit.js`) will verify 100% read-only compliance before any release.

---

## 8. IMPLEMENTATION PLAN (STEP-BY-STEP)

### Phase 1: Live Filters Page Parser (`parser.js`)
1. Add `isLiveFiltersPage()`: matches route `/manager/live-filters`.
2. Implement `readLiveFilters(doc)`:
   - Finds table `table.mat-table` or rows `tr.mat-row`.
   - Extracts: Filter ID (from control links / edit URLs), Name (`.cdk-column-name`), Active state (`.cdk-column-active`), Count (`.cdk-column-count`), Total Count (`.cdk-column-total-count`).
   - Returns structured array of Live Filter inventory objects.

### Phase 2: Route Controller & Storage (`content.js`)
1. Extend `currentRoute()` to detect `"live_filters"`.
2. When on `/manager/live-filters`, passively invoke `readLiveFilters(document)` and store into `${prefix}live_filters_inventory_v1` in `localStorage` and `chrome.storage.local`.
3. Preserve existing `/manager/campaigns` and `/manager/campaigns/edit/*` logic.

### Phase 3: Live Filter Intelligence Engine (`intelligence.js`)
1. Add `evaluateLiveFilterIntelligence(stats)`:
   - Reads inventory from `${prefix}live_filters_inventory_v1`.
   - Reads verified campaign assignments from `${prefix}verified_campaign_filters_v1`.
   - Reads running campaign metrics from `stats.campaigns`.
   - Correlates datasets and calculates: Total filters, Active filters, Running campaigns, Verified active usage.
   - Evaluates filter change transitions with 2-observation confirmation lifecycle.

### Phase 4: UI Dashboard Section (`dashboard.js` & `dashboard.css`)
1. Render dedicated `LIVE FILTER INTELLIGENCE` panel:
   - Summary metric tiles.
   - Live Filter Inventory table.
   - Campaign Assignment Matrix.
   - Transition History & Data Health.
2. Maintain existing dashboard layout and dark theme design language.

### Phase 5: Verification & Acceptance Gates
1. Run complete East-2 and East-3 test suites (210/210 PASS).
2. Append Phase 14 test suite covering:
   - Live filter table parsing.
   - Inventory storage and hydration.
   - Campaign-to-filter matrix correlation.
   - 2-observation transition confirmation.
   - 7-day stale invalidation.
   - Strict read-only AST verification (0 fetch, 0 xhr, 0 clicks).
3. Package and verify checksums in `RELEASE_PACKAGES`.

---

## 9. FEASIBILITY DECISION

### DECISION: **PARTIAL**
- **Supported:** High-fidelity, zero-interference monitoring of Live Filter inventory, contact counts, active statuses, running campaigns, and verified assignments (via passive edit/overlay visits).
- **Not Supported Without Interaction:** Instant automatic detection of external filter changes while remaining exclusively on `/manager/campaigns` without opening Edit.
- **Recommended Action:** Proceed with implementation of the proposed **Option E (Best Available Monitoring)** blueprint upon operator authorization.

