# CT OPERATIONS MONITOR PRO — DATA FRESHNESS & TIMESTAMP AUDIT
## Independent 5-Timestamp Architecture, Anti-Contamination Rules & SLA Classification
**Project:** CT Operations Monitor Pro — Dual Dialer  
**Release:** v11.3.4 (Production Final)  
**Dialers:** EAST-2 (`https://east-2.calltools.io`) and EAST-3 (`https://east-3.calltools.io`)  
**Audit Date:** November 9, 2026

---

## 1. ARCHITECTURAL PURPOSE & PROBLEM DEFINITION

A major failure mode in legacy monitoring extensions was the reliance on a single global "Last Updated" timestamp. When the extension refreshed the page or executed a heartbeat timer, that single timestamp was updated to the current time, creating the misleading illusion that all visible data was real-time and fresh, even when:
- Targeting configuration had not been verified for 30 minutes, several hours, or days.
- Live Filter catalog inventory had not been observed since yesterday.
- The refresh attempt failed due to an Angular route transition or network hiccup.

In v11.3.4, the system implements an **Independent 5-Timestamp Architecture** where every discrete data domain maintains its own immutable wall-clock timestamp and freshness SLA.

---

## 2. THE 5 INDEPENDENT TIMESTAMPS

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        INDEPENDENT 5-TIMESTAMP ARCHITECTURE                            │
├────┬─────────────────────────────┬─────────────────────────────────────────────────────┤
│ #  │ Timestamp Identifier        │ Storage Location & Provenance                       │
├────┼─────────────────────────────┼─────────────────────────────────────────────────────┤
│ T1 │ Campaign Metrics Observed   │ ct_eastX_last_known_campaigns_v1.updatedAt          │
│    │                             │ Source: /manager/campaigns Angular Table            │
├────┼─────────────────────────────┼─────────────────────────────────────────────────────┤
│ T2 │ Targeting Last Verified     │ ct_eastX_verified_campaign_filters_v1[cid].timestamp│
│    │                             │ Source: /manager/campaigns/edit/:id Native Select   │
├────┼─────────────────────────────┼─────────────────────────────────────────────────────┤
│ T3 │ Filter Snapshot Observed    │ ct_eastX_verified_campaign_filters_v1[cid].timestamp│
│    │                             │ Source: (Count: N) inside Live Filter Dropdown Option│
├────┼─────────────────────────────┼─────────────────────────────────────────────────────┤
│ T4 │ Filter Inventory Observed   │ ct_eastX_live_filters_inventory_v1.lastObservedAt   │
│    │                             │ Source: /manager/live-filters Catalog Table         │
├────┼─────────────────────────────┼─────────────────────────────────────────────────────┤
│ T5 │ Dashboard Rendered          │ In-memory state.lastRenderedAt                      │
│    │                             │ Source: Date.now() evaluated on UI re-draw          │
└────┴─────────────────────────────┴─────────────────────────────────────────────────────┘
```

### Detailed Breakdown of Each Timestamp:

#### T1: Campaign Metrics Last Observed (`campaignsUpdatedAt`)
- **Meaning:** Exact millisecond when active campaign queues, callable leads (`69,194`), logged-in agents (`13`), and daily calls were scraped from the native Campaigns table.
- **Update Frequency:** Approximately every 15 seconds while on `/manager/campaigns`.
- **UI Label:** `Refreshed: 10:16:03 AM` (in header and campaign grid).

#### T2: Campaign Targeting Last Verified (`targetingTimestamp`)
- **Meaning:** Exact millisecond when an operator naturally loaded the campaign edit form and the native live filter dropdown was parsed.
- **Update Frequency:** Event-driven; occurs only when `/manager/campaigns/edit/:id` is visited.
- **UI Label:** `Targeting verified: 9:47:57 AM` (in Top Live Filter strip and matrix table).

#### T3: Filter Count Snapshot Last Observed (`filterCountTimestamp`)
- **Meaning:** Exact millisecond when the `(Count: 43948)` string was extracted from the dropdown option text.
- **Update Frequency:** Tied to T2.
- **UI Label:** `Filter Matches: 43,948 (Targeting Snapshot)`.

#### T4: Filter Catalog Inventory Last Observed (`catalogObservedAt`)
- **Meaning:** Exact millisecond when the operator visited `/manager/live-filters` and the full catalog table was parsed.
- **Update Frequency:** Event-driven; occurs only when `/manager/live-filters` is visited.
- **UI Label:** `Catalog inventory last observed: 9:30:15 AM (46m ago)`.

#### T5: Dashboard Last Rendered (`dashboardRenderTime`)
- **Meaning:** Exact millisecond when the DOM nodes of the extension panel were redrawn.
- **Update Frequency:** Every 15-second tick, tab visibility return, or user interaction.
- **UI Label:** `Feed: LIVE (rendered 10:16:04 AM)`.

---

## 3. STRICT NON-CONTAMINATION RULES

To guarantee data truthfulness, the extension enforces 5 non-negotiable architectural barriers:

1. **Rule 1 (Failed Refresh Isolation):**  
   If a refresh attempt returns `0 records`, encounters a DOM loading spinner, or fails due to a route change, **NO observation timestamp is updated**. T1, T2, T3, and T4 remain unchanged. The Refresh Coordinator logs a `FAILED` or `WAITING` event in `ct_eastX_refresh_history_v1`.

2. **Rule 2 (Campaigns Table Cannot Advance Targeting):**  
   Periodic 15-second scraping of `/manager/campaigns` updates T1 (campaign callable lead pool), but **NEVER touches T2 (targeting timestamp) or T3 (filter snapshot count)**.

3. **Rule 3 (Targeting Verification Cannot Modify Active Queue):**  
   Observing `/manager/campaigns/edit/:id` updates T2 and T3, but **NEVER touches T1 (callable contacts `69,194`)**. The active lead pool is only updated from the live campaigns table.

4. **Rule 4 (Tab Switch & Heartbeat Isolation):**  
   Returning to the browser tab or firing an internal 1-second UI clock tick updates T5 (Dashboard Rendered) and recalculates elapsed relative times (e.g. changing `27m ago` to `28m ago`), but **NEVER resets or advances T1, T2, T3, or T4**.

5. **Rule 5 (Dual-Dialer Storage Isolation):**  
   EAST-2 content script writes only to `ct_east2_*`. EAST-3 content script writes only to `ct_east3_*`. Neither dialer can read, overwrite, or mutate the other's timestamps.

---

## 4. FRESHNESS SLA CLASSIFICATION TIERS

The dashboard evaluates each timestamp against current wall-clock time using the helper function `evaluateFreshness(observedAt, now)`:

```javascript
function evaluateFreshness(observedAt, now = Date.now()) {
    if (!observedAt || Number(observedAt) <= 0) {
        return { tier: "UNVERIFIED", label: "UNVERIFIED", ageSec: Infinity, className: "freshness-unverified" };
    }
    const ageSec = Math.floor((now - Number(observedAt)) / 1000);
    if (ageSec < 60) {
        return { tier: "LIVE", label: "LIVE (<1m)", ageSec, className: "freshness-live" };
    } else if (ageSec < 300) {
        return { tier: "RECENT", label: `RECENT (${Math.floor(ageSec / 60)}m ago)`, ageSec, className: "freshness-recent" };
    } else if (ageSec < 3600) {
        return { tier: "MONITORING", label: `MONITORING (${Math.floor(ageSec / 60)}m ago)`, ageSec, className: "freshness-monitoring" };
    } else if (ageSec < 86400 * 7) {
        const hours = Math.floor(ageSec / 3600);
        return { tier: "STALE", label: `STALE (${hours}h ago)`, ageSec, className: "freshness-stale" };
    } else {
        const days = Math.floor(ageSec / 86400);
        return { tier: "EXPIRED", label: `EXPIRED (${days}d ago)`, ageSec, className: "freshness-expired" };
    }
}
```

### Visual Tier Styling:
- **`LIVE` (<60s):** Vibrant Green badge (`#00E676`). Used for active dialer campaign and queue streams.
- **`RECENT` (1m - 5m):** Vibrant Teal badge (`#00B0FF`). Normal operating targeting state.
- **`MONITORING` (5m - 60m):** Warm Amber badge (`#FFD600`). Operator alerted that targeting was verified earlier in the shift.
- **`STALE` (1h - 7d):** Warning Orange badge (`#FF9100`). Operator encouraged to verify campaign targeting.
- **`EXPIRED` (>7d) / `UNVERIFIED`:** Critical Red/Gray badge (`#FF5252`). System alerts that configuration may be outdated.

---

## 5. TIMEZONE & RELATIVE TIME RENDERING STANDARDS

Every displayed timestamp is formatted using a dual representation:
1. **Absolute Local Clock Time:** e.g. `9:47:57 AM` (using client locale).
2. **Relative Elapsed Duration:** e.g. `(28m ago)`.

This ensures operators working across Eastern Time, Central Time, or Pacific Time immediately understand the exact age of the observation without mental timezone conversion errors.

---

## 6. REGRESSION TEST VERIFICATION PROOF

The non-contamination and independent timestamp model was verified through automated tests in `tests/suite.test.js`:
- **EAST-2/EAST-3 UPGRADE 237:** Verified that when campaign metrics update at `t2 = t1 + 30000`, the targeting timestamp remains locked at `t1` and targeting freshness correctly computes `30s age`.
- **EAST-2/EAST-3 UPGRADE 238:** Verified that fresh targeting with unobserved catalog inventory displays `Targeting: LIVE` alongside `Catalog: Awaiting Observation` without cross-pollination.
- **EAST-2/EAST-3 UPGRADE 241:** Verified that a failed refresh cycle preserves previous valid timestamps and records `result: FAILED` in refresh history.
- **Status:** 100% Passed.

