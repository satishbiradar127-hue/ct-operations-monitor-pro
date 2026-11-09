# CT OPERATIONS MONITOR PRO — FORENSIC DISCREPANCY REPORT
## Root Cause Analysis & Forensic Reconstruction: `43,948` vs `69,194`
**Project:** CT Operations Monitor Pro — Dual Dialer  
**Release:** v11.3.4 (Production Final)  
**Investigation Date:** November 9, 2026  
**Dialers Audited:** EAST-2 (`https://east-2.calltools.io`) and EAST-3 (`https://east-3.calltools.io`)  
**Security Classification:** Strict Read-Only / Zero-Interference Architectural Audit

---

## 1. EXECUTIVE SUMMARY & FORENSIC PROBLEM STATEMENT

During live runtime verification of the EAST-3 production dialer dashboard, an apparent metric conflict was observed on campaign **`TS FRESH DATA`**:
1. The **Assigned Live Filter Badge** displayed: `TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts (Count: 43948)`
2. The **Campaign Callable Contact Pool** (rendered under Live Leads / Pool) displayed: `69,194`
3. The native targeting source was reported as `CAMPAIGN_EDIT_DOM` with observation time `9:47:57 AM`
4. The dashboard observation timestamp was `10:16:03 AM` (a 28-minute delta)

The primary forensic objective was to determine whether one or both numbers were fabricated, miscalculated, corrupted, or stale, and to trace the exact byte-level DOM and storage provenance of each figure.

### Forensic Finding:
Neither number was fabricated or incorrect. Rather, **`43,948` and `69,194` measure two fundamentally distinct operational entities captured from two completely different native CallTools views at two different times**:
- **`43,948`** is the **Filter-Matching Contact Count Snapshot** of the specific targeting query assigned to the campaign, observed inside the `<select name="live_filter">` dropdown on the native Campaign Edit page (`/manager/campaigns/edit/1716`) at **9:47:57 AM**.
- **`69,194`** is the **Live Callable Contact Pool** (the active queue of callable contacts assigned to the campaign), observed in the native Angular table cell `<td class="cdk-column-contact_count">` on the Campaigns summary page (`/manager/campaigns`) at **10:16:03 AM**.

The defect in earlier dashboard builds was **conflation and lack of semantic separation**: the dropdown option's literal text string `(Count: 43948)` was displayed unparsed inside the filter name badge, placing two conflicting numbers in close visual proximity without explanatory labels or distinct timestamps.

---

## 2. PHYSICAL ARTIFACT & LEVELDB FORENSIC PROVENANCE

Direct forensic extraction from the local browser profile storage verified the exact timestamps, keys, and values recorded by the extension:

**Profile Inspected:** Brave Profile 2 (`%LOCALAPPDATA%\BraveSoftware\Brave-Browser\User Data\Profile 2\Local Storage\leveldb`)  
**Target Storage Namespace:** `ct_east3_*`  
**Inspected LevelDB Files:** `012455.ldb`, `012457.log`

### LevelDB Record A: Verified Targeting Entry
- **Storage Key:** `ct_east3_verified_campaign_filters_v1`
- **JSON Payload Record for Campaign ID `1716`:**
```json
{
  "1716": {
    "campaignId": "1716",
    "campaignName": "TS FRESH DATA",
    "liveFilter": "TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts (Count: 43948)",
    "status": "ASSIGNED",
    "source": "CAMPAIGN_EDIT_DOM",
    "timestamp": 1794235677634
  }
}
```
- **Epoch Timestamp:** `1794235677634` ms
- **Exact Human-Readable Time:** **2026-11-09 09:47:57.634 EST**
- **Native DOM Origin:** `<option selected value="...">TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts (Count: 43948)</option>` inside `<select name="live_filter">` at URL `/manager/campaigns/edit/1716`.

### LevelDB Record B: Active Campaign State Entry
- **Storage Key:** `ct_east3_last_known_campaigns_v1`
- **JSON Payload Record for Campaign ID `1716`:**
```json
{
  "id": "1716",
  "name": "TS FRESH DATA",
  "contacts": "69,194",
  "active": true,
  "loggedIn": 13,
  "updatedAt": 1794237363840
}
```
- **Epoch Timestamp:** `1794237363840` ms
- **Exact Human-Readable Time:** **2026-11-09 10:16:03.840 EST**
- **Native DOM Origin:** `<td class="cdk-column-contact_count">69,194</td>` inside table `<table mat-table class="mat-table cdk-table">` at URL `/manager/campaigns`.

---

## 3. STEP-BY-STEP DATA PIPELINE & ARCHITECTURAL TRACE

```
                                      CALLTOOLS NATIVE DOM
                                                │
          ┌─────────────────────────────────────┴─────────────────────────────────────┐
          ▼                                                                           ▼
/manager/campaigns/edit/1716                                                /manager/campaigns
<select name="live_filter">                                                 <td class="cdk-column-contact_count">
"TS FRESH DATA - 4 ATT... (Count: 43948)"                                   "69,194"
          │                                                                           │
          │ [Passively Read by parser.js:readCampaignEditForm]                        │ [Passively Read by parser.js:readCampaigns]
          ▼                                                                           ▼
content.js:observeCampaignEditForm                                          content.js:observeCampaigns
- Extracts filterCount: 43948                                               - Extracts contacts: 69,194
- Extracts cleanFilterName: "TS FRESH DATA - 4 ATT..."                      - Extracts agents loggedIn: 13
- Timestamp: 1794235677634 (09:47:57 AM)                                    - Timestamp: 1794237363840 (10:16:03 AM)
          │                                                                           │
          ▼                                                                           ▼
localStorage["ct_east3_verified_campaign_filters_v1"]                       localStorage["ct_east3_last_known_campaigns_v1"]
          │                                                                           │
          └─────────────────────────────────────┬─────────────────────────────────────┘
                                                ▼
                             CTDataIntelligenceEngine.getLiveFilterIntelligenceSummary()
                             - campaignLeadPool: 69194 (Live Callable Queue)
                             - filterCount: 43948 (Historical Targeting Snapshot)
                             - targetingTimestamp: 1794235677634
                             - campaignMetricsTimestamp: 1794237363840
                                                │
                                                ▼
                                         DASHBOARD RENDERING
                             - Top Strip: Clean Filter Name (zero count in name)
                             - Campaign Pool Tag: "Campaign Pool: 69,194 (Live Queue)"
                             - Filter Match Tag: "Filter Matches: 43,948 (Targeting Snapshot)"
                             - Freshness Tag: Evaluated independently per timestamp
```

---

## 4. DETAILED SEMANTIC RECONCILIATION

| Metric Feature | Metric A: `43,948` | Metric B: `69,194` |
|---|---|---|
| **Canonical Name** | **Filter-Matching Contact Snapshot** | **Campaign Callable Lead Pool** |
| **CallTools Entity** | Single targeting query constraint | Total active callable queue |
| **Observation Page** | `/manager/campaigns/edit/1716` | `/manager/campaigns` |
| **DOM Element** | `<option>` in `<select name="live_filter">` | `<td class="cdk-column-contact_count">` |
| **Parser Function** | `CTParser.readCampaignEditForm()` | `CTParser.readCampaigns()` |
| **Storage Key** | `ct_eastX_verified_campaign_filters_v1` | `ct_eastX_last_known_campaigns_v1` |
| **Sample Timestamp** | `1794235677634` (9:47:57 AM) | `1794237363840` (10:16:03 AM) |
| **Update Mechanism** | Natural operator visit to Edit page | Periodic 15s refresh on Campaigns page |
| **Operational Meaning**| Total leads in the CallTools system that matched the live filter criteria when edit was queried. | Total leads remaining callable in this campaign's dialer hopper at 10:16 AM. |

### Why The Numbers Are Not Expected To Be Equal:
1. **DNC, Timezones & Deduplication:** Even when a filter matches 43,948 records, campaign operating rules (time zone filters, daily call frequency rules, DNC lists, and multi-list buckets) calculate callable leads differently.
2. **Multi-List Campaigns:** A campaign may draw from multiple lead lists or bucket allocations, giving an active callable queue larger than or distinct from any individual filter query.
3. **Temporal Skew:** The filter query snapshot was generated at 9:47:57 AM; 28 minutes of inbound and outbound dialing had occurred before the campaign summary metrics were polled at 10:16:03 AM.

---

## 5. CODE REMEDIATIONS IMPLEMENTED

### 1. `parser.js` (`CTParser.readCampaignEditForm`):
- Added regular expression extraction for `(Count: \d+)` inside live filter option text.
- Extracts `filterCount` as a distinct numeric integer (`43948`).
- Cleans `cleanFilterName` to strip the count string: `"TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts"`.
- Preserves raw string for audit verification.

### 2. `content.js` (`observeCampaignEditForm`):
- Stores `filterCount`, `cleanFilterName`, `liveFilter`, `status`, `source`, and exact observation `timestamp` into `ct_eastX_verified_campaign_filters_v1`.

### 3. `intelligence.js` (`getLiveFilterIntelligenceSummary`):
- Explicitly binds `campaignLeadPool: 69194` (from campaign stats) and `filterCount: 43948` (from verified targeting).
- Emits `filterCountSource: "TARGETING_SNAPSHOT"`.
- Computes independent `freshness` and `ageSec` for targeting observation.

### 4. `dashboard.js`:
- Expanded Top Live Filter strip into a structured 3-part layout:
  - `refs.topFilterPool`: `"Campaign Pool: 69,194 (Live Queue)"`
  - `refs.topFilterMatch`: `"Filter Matches: 43,948 (Targeting Snapshot)"`
  - `refs.topFilterFreshness`: `"Targeting: RECENT (28m ago)"`
- Matrix Table column structure updated to 10 distinct columns:
  `Campaign | Campaign ID | State | Agents | Campaign Lead Pool | Assigned Filter | Filter Count | Verification | Last Verified | Freshness`
- Zero count is never injected for unobserved targeting; displays `—` (Awaiting Snapshot).

### 5. `dashboard.css`:
- Added styled tag classes `.ct-tlf-pool`, `.ct-tlf-match`, `.ct-tlf-freshness`, `.ct-pool-tag`, and `.ct-match-tag` to ensure immediate visual clarity between queue pools and query snapshots.

---

## 6. VERIFICATION TEST SUITE CONFIRMATION

The implementation was validated against dual-dialer test suites:
- **Test UPGRADE 236:** Verified distinct extraction of `43,948` and `69,194` from native fixtures without count string contamination in filter name.
- **Test UPGRADE 237:** Stale targeting timestamp (`t1`) preserved when campaign metrics update at a newer time (`t2`).
- **Test UPGRADE 239:** Missing filter count handled gracefully without fabricating zero.
- **Test UPGRADE 240:** Valid zero contact pool preserved without converting to "unavailable".
- **Result:** 243/243 tests passed on EAST-2 and 243/243 tests passed on EAST-3.
