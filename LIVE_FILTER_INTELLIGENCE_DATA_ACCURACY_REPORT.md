# CT OPERATIONS MONITOR PRO — LIVE FILTER INTELLIGENCE DATA ACCURACY REPORT
## Comprehensive Data Integrity, Native Provenance, and Operational Verification for EAST-2 and EAST-3

**Project:** CT Operations Monitor Pro — Dual Dialer  
**Release Version:** v11.3.4  
**Dialers:** EAST-2 (`https://east-2.calltools.io`) and EAST-3 (`https://east-3.calltools.io`)  
**Security Model:** 100% Strict Read-Only Boundary  
**Date of Report:** November 2026  

---

## 1. OBJECTIVE & DATA INTEGRITY PRINCIPLES

The Live Filter Intelligence module has been engineered as a dependable operational command center component. All speculative selectors, synthetic identifiers, and simulated values have been permanently removed.

### Core Non-Negotiable Rules:
1. **Zero Fabricated IDs:** Stable numeric IDs are parsed from native DOM or recovered from verified targeting registry. Unobserved IDs are displayed as `Awaiting ID` with badge `UNVERIFIED_DOM`. Synthetic tags like `campaign-0` are strictly banned.
2. **Zero False Zeroes:** When the account-wide filter catalog has not been visited, the system returns `null` and displays `Awaiting Observation (/manager/live-filters)`. It never reports "0 FILTERS".
3. **Strict Attribution Boundaries:** Campaign contact pools, lead list totals, and filter contact counts are maintained as distinct metrics and never summed together.
4. **Truthful Timestamping:** Observation timestamps are never substituted for native refill times. If native refill time is unexposed, the system explicitly reports: `Native refill time: Not available from permitted source`.

---

## 2. INVENTORY INTELLIGENCE (PHASE 3.1)

### 2.1 Passive Observation Architecture
- **Route:** `/manager/live-filters`
- **Method:** `CTParser.readLiveFilters(document)` in `parser.js`
- **Captured Fields:**
  - `Filter ID`: Extracted from row attributes, action links, or query params.
  - `Filter Name`: Text from `.cdk-column-name` or `.mat-column-name`.
  - `Status`: Checked via `.mat-slide-toggle` state (checking `.mat-checked`, `aria-checked="true"`, or `input.checked`).
  - `Available Contact Count`: Parsed from `.cdk-column-contact_count` via `CT.parseMetric()`.
  - `Total Count (Ignore Time Zones)`: Parsed from `.cdk-column-total_saved_contact_count` or `.cdk-column-total_contacts`.
  - `Dialer`: Tagged as `EAST-2` or `EAST-3` based on hostname isolation.
  - `Observation Timestamp`: Recorded via `Date.now()`.
  - `Pagination State`: Table footer pagination parsed (e.g. `1 - 25 of 142`) to verify inventory completeness.

### 2.2 Truthful Inventory States
The system explicitly distinguishes 5 discrete inventory states:
1. **OBSERVED (Complete):** Natural visit to `/manager/live-filters` observed; records stored in `ct_eastX_live_filters_inventory_v1`.
2. **AWAITING OBSERVATION:** Route `/manager/live-filters` has not yet been visited in this browser session. Returns `null` and displays `Awaiting observation (/manager/live-filters)`.
3. **INCOMPLETE / PAGINATED:** First page observed, with additional pages available in CallTools. Displays `Page 1 of N observed`.
4. **STALE:** Inventory records older than 7 days (`age > 7 * 24 * 60 * 60 * 1000`). Displayed with warning badge `STALE INVENTORY`.
5. **NO FILTERS EXIST:** Route visited, table confirmed empty (`0 filters rendered in DOM`).

---

## 3. CAMPAIGN ASSIGNMENT & TARGETING (PHASE 3.2)

### 3.1 ID-First Matching Engine
In `CTDataIntelligenceEngine.getLiveFilterIntelligenceSummary()`:
- **Primary Lookup:** Campaign verified ID (e.g. `59874`) directly matches registry key `verifiedRegistry[realId]`.
- **Secondary Lookup:** Normalized campaign name match (`String.trim().toLowerCase()`) across registry entries.
- **Verification Sources:**
  - `CAMPAIGN_EDIT_DOM`: Extracted directly from `/manager/campaigns/edit/:id` select element (`VERIFIED (Edit)`).
  - `TABLE_COLUMN`: Extracted from native Live Filter table column if exposed (`VERIFIED (Table)`).
  - `VERIFIED_REGISTRY`: Restored from previous verified operator observation (`VERIFIED (Registry)`).
  - `DOM_UNAVAILABLE`: Neither table column nor registry entry available (`Awaiting Verification`).

### 3.2 Usage Status Lifecycle
- **VERIFIED ACTIVE:** Campaign is running/active AND assigned a verified live filter.
- **STANDBY:** Campaign is idle/inactive, but has a verified live filter assigned.
- **UNASSIGNED:** Campaign is active, but explicitly confirmed to have no filter assigned (`None` or `Unassigned`).
- **STALE:** Assignment record exceeds 7-day threshold.
- **UNKNOWN:** Campaign is running, but targeting has not been observed. Flags `missingVerificationCount++`.

---

## 4. LEAD-LIST & INVENTORY DETAILS (PHASE 3.3)

### 4.1 Native Exposure Boundaries
A thorough DOM audit established what lead file and list information is genuinely exposed:
- **Exposed in Table:** Campaign rows frequently expose `.cdk-column-lead_file` or `.cdk-column-contact_list`.
- **Captured Data:**
  - `Lead List / File Name`: Captured when column exists in native Angular table.
  - `Campaign Contact Pool`: Captured from `.cdk-column-contact_count`.
- **Separation of Metrics:**
  - Campaign Contact Pool represents the active dialer queue for that campaign.
  - Filter Contact Count represents the filter query results in the catalog.
  - These two numbers measure different layers of the CallTools telephony engine and are NEVER added together or conflated.

---

## 5. LAST ACTIVITY, REFILL & ATTRIBUTION (PHASE 3.4 & 3.5)

### 5.1 Native Refill Time Disclosure
CallTools does NOT expose native filter refill timestamps on either `/manager/campaigns` or `/manager/live-filters`.
- **Strict Compliance:** In accordance with Phase 3.4, the system NEVER substitutes observation time for refill time.
- **Explicit Label:** Displays `Native refill time: Not available from permitted source` across all detail views.

### 5.2 Zero False Attribution
Campaign-level metrics (outbound calls, human connects, agent connects, goals) are attributed strictly to the CAMPAIGN entity, not the filter entity.
The dashboard makes it transparent that multiple campaigns may share a single filter, and filter contacts are not double-counted in global dialer totals.

---

## 6. DATA ACCURACY AUDIT VERIFICATION

| Verification Item | Test Reference | Expected Behavior | Actual Production Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **No Synthetic IDs** | Test 226, 227 | ID is numeric or `null` (`Awaiting ID`) | Passed 100%; no `campaign-0` generated | **PASS** |
| **No False Zeroes** | Test 229 | Unobserved inventory returns `null` | Returns `null` and `Awaiting observation` | **PASS** |
| **Running State** | Test 228 | Evaluates active + loggedIn agents | 13 agents on active campaign evaluates to `RUNNING` | **PASS** |
| **Provenance Integrity** | Test 230 | Refill is separated from observed | Returns `"Not exposed by available source"` | **PASS** |
| **Stale Invalidation** | Test 219 | Records > 7 days flag `STALE` | Flags `STALE` and increments stale counter | **PASS** |
| **Dual-Dialer Isolation**| Test 223 | East-2 and East-3 keys do not collide | Completely isolated storage namespaces | **PASS** |
