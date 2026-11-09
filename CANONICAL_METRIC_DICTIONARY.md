# CT OPERATIONS MONITOR PRO — CANONICAL METRIC DICTIONARY
## Authoritative Metric Semantics, Provenance, Selectors & Display Standards
**Project:** CT Operations Monitor Pro — Dual Dialer  
**Release:** v11.3.4 (Production Final)  
**Dialers:** EAST-2 (`https://east-2.calltools.io`) and EAST-3 (`https://east-3.calltools.io`)  
**Status:** Canonical Reference Specification

---

## 1. PURPOSE & ARCHITECTURAL PRINCIPLES

This Canonical Metric Dictionary provides unambiguous, authoritative definitions for every metric, counter, state, and timestamp tracked by the CT Operations Monitor Dual-Dialer extension.

### Core Non-Negotiables:
1. **Zero Conflation:** A query count from a filter snapshot must never be conflated with an active campaign callable lead pool.
2. **Zero Fabrication:** If a metric is unobserved, it must render as `—` (Awaiting Observation) or `DOM Unavailable`. It must never display synthetic `campaign-0` or fake `0`.
3. **Strict Separation of Timestamps:** The timestamp of one page observation (e.g. Campaign Edit) must never be updated by an observation of a different page (e.g. Campaigns table or Live Filter table).
4. **Read-Only Provenance:** All metrics are captured via passive DOM observation without clicking native buttons, triggering form submissions, or executing hidden network requests.

---

## 2. SECTION A: LIVE FILTER INVENTORY METRICS
**Native Page:** `/manager/live-filters`  
**Storage Key:** `ct_eastX_live_filters_inventory_v1`  
**Observer Function:** `observeLiveFilters()` in [content.js](file:///c:/Users/Orange%20Carrot/Downloads/CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL/CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/content.js#L780)  
**Parser Function:** `readLiveFilters()` in [parser.js](file:///c:/Users/Orange%20Carrot/Downloads/CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL/CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/parser.js#L810)

| Metric Name | Native DOM Selector | Data Type | Semantic Meaning | Permitted UI Labels |
|---|---|---|---|---|
| **Filter ID** | `a[href*="/manager/live-filters/edit/"]` (extracts numeric ID) or `tr[data-id]` | String / Number | Unique CallTools database identifier for the Live Filter rule. | `ID`, `Filter ID` |
| **Filter Name** | `td.cdk-column-name`, `.mat-column-name` | String | Human-readable title assigned by dialer administrator. | `Filter Name`, `Catalog Filter` |
| **Active Status** | `mat-slide-toggle` (checked class or `aria-checked="true"`) | Boolean (`true`/`false`) | Whether the live filter rule is currently enabled for automatic contact selection. | `ACTIVE`, `INACTIVE` |
| **Filter Contact Count** | `td.cdk-column-contact_count`, `.mat-column-contact_count` | Number | Number of contacts in CallTools currently satisfying this filter's SQL targeting rules. | `Contacts`, `Matching Contacts` |
| **Ignore Time Zone Count**| `td.cdk-column-ignore_time_zone_contact_count` | Number | Subset of matching contacts that are dialable outside strict local calling window constraints. | `Ignore TZ Count` |
| **Total Filters Count** | Derived: `Object.keys(inventory.items).length` | Number | Total count of cataloged Live Filters in the dialer account. | `Total Filters`, `Catalog Size` |
| **Active Filters Count**| Derived: items where `active === true` | Number | Number of enabled filter rules in catalog. | `Active Filters` |
| **Total Filter Contacts**| Derived: sum of `contact_count` across all catalog items | Number | Aggregate sum of all leads covered under defined live filter criteria. | `Total Contacts (Live Filters)` |
| **Inventory Observed At**| Content script timestamp at parse time | Epoch Timestamp (ms) | Wall-clock time when `/manager/live-filters` DOM table was last read. | `Last Observed: [Time] ([Age] ago)` |

---

## 3. SECTION B: CAMPAIGN OPERATIONS & QUEUE METRICS
**Native Page:** `/manager/campaigns`  
**Storage Key:** `ct_eastX_last_known_campaigns_v1`  
**Observer Function:** `observeCampaigns()` in [content.js](file:///c:/Users/Orange%20Carrot/Downloads/CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL/CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/content.js#L680)  
**Parser Function:** `readCampaigns()` in [parser.js](file:///c:/Users/Orange%20Carrot/Downloads/CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL/CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/parser.js#L610)

| Metric Name | Native DOM Selector | Data Type | Semantic Meaning | Permitted UI Labels |
|---|---|---|---|---|
| **Campaign ID** | `a[href*="/manager/campaigns/edit/"]`, `a[href*="/manager/campaigns/"]` | String | Unique CallTools database identifier for the dialer campaign. | `Campaign ID`, `CID` |
| **Campaign Name** | `td.cdk-column-name`, `.mat-column-name` | String | Administrator-defined label for the outbound/inbound campaign. | `Campaign`, `Campaign Name` |
| **Campaign State** | `td.cdk-column-is_active`, `td.cdk-column-status` | Enum (`ACTIVE`, `PAUSED`, `COMPLETED`) | Administrative activation switch of the campaign in CallTools. | `ACTIVE`, `PAUSED`, `COMPLETED` |
| **Agents Logged In** | `td.cdk-column-logged_in_agent_count`, `.cdk-column-agents` | Number | Number of human agents currently joined to this campaign queue. | `Agents`, `Agents Logged In` |
| **Operational Running State**| Derived: `isActive === true && agentsLoggedIn > 0` | Enum (`RUNNING`, `STANDBY`, `OFFLINE`) | Realtime dialing execution status. A campaign is RUNNING only if active and agents are actively logged in. | `RUNNING`, `STANDBY`, `OFFLINE` |
| **Campaign Lead Pool** | `td.cdk-column-contact_count`, `.mat-column-contact_count` | Number | **Total callable contacts remaining in this campaign's active dialer queue.** | `Campaign Lead Pool`, `Campaign Pool: [N] (Live Queue)` |
| **Campaign Daily Calls**| `td.cdk-column-calls_today`, `.cdk-column-daily_calls` | Number | Cumulative calls placed by this campaign since midnight local dialer reset. | `Calls Today`, `Daily Calls` |
| **Campaign Dispositions**| Aggregate rows or disposition sub-columns | Object (`transfers`, `sales`, `dnc`) | Breakdown of call outcomes logged by agents today. | `Transfers`, `Completed Goals` |
| **Campaigns Last Observed**| Content script timestamp at parse time | Epoch Timestamp (ms) | Wall-clock time when `/manager/campaigns` table was last parsed. | `Campaigns refreshed: [Time]` |

---

## 4. SECTION C: CAMPAIGN TARGETING CONFIGURATION
**Native Page:** `/manager/campaigns/edit/:id`  
**Storage Key:** `ct_eastX_verified_campaign_filters_v1`  
**Observer Function:** `observeCampaignEditForm()` in [content.js](file:///c:/Users/Orange%20Carrot/Downloads/CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL/CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/content.js#L730)  
**Parser Function:** `readCampaignEditForm()` in [parser.js](file:///c:/Users/Orange%20Carrot/Downloads/CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL/CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/parser.js#L740)

| Metric Name | Native DOM Selector | Data Type | Semantic Meaning | Permitted UI Labels |
|---|---|---|---|---|
| **Assigned Filter Name** | `<select name="live_filter"> option[selected]` (with `(Count: ...)` stripped) | String | The clean, human-readable name of the live filter rule bound to this campaign's targeting. | `Assigned Filter`, `Live Filter: [Name]` |
| **Filter-Matching Count Snapshot** | Extracted from `<select name="live_filter">` regex `(Count: (\d+))` | Number | **The number of contacts satisfying this filter query when the Edit page was queried.** Historical snapshot. | `Filter Matches: [N] (Targeting Snapshot)` |
| **Targeting Source** | Provenance flag (`CAMPAIGN_EDIT_DOM`, `TABLE_COLUMN`, `VERIFIED_REGISTRY`) | Enum | The architectural origin of the campaign-to-filter association. | `Source: Edit Page DOM`, `Source: Table Column` |
| **Targeting Last Verified**| Content script timestamp at parse time | Epoch Timestamp (ms) | The exact wall-clock time when an operator naturally loaded `/manager/campaigns/edit/:id`. | `Targeting verified: [Time]` |
| **Targeting Freshness** | Computed from `Date.now() - targetingTimestamp` | Enum (`LIVE`, `RECENT`, `MONITORING`, `STALE`, `UNVERIFIED`) | Operational trust tier based on elapsed age since targeting was confirmed in DOM. | `LIVE (<60s)`, `RECENT (<5m)`, `MONITORING (<1h)`, `STALE (>1h)` |

---

## 5. SECTION D: INBOUND OPERATIONS & QUEUE METRICS
**Native Page:** `/manager/inbound-queues`  
**Storage Key:** `ct_eastX_last_known_queues_v1`  
**Observer Function:** `observeInboundQueues()` in [content.js](file:///c:/Users/Orange%20Carrot/Downloads/CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL/CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/content.js#L640)  
**Parser Function:** `readQueues()` in [parser.js](file:///c:/Users/Orange%20Carrot/Downloads/CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL/CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/parser.js#L540)

| Metric Name | Native DOM Selector | Data Type | Semantic Meaning | Permitted UI Labels |
|---|---|---|---|---|
| **Queue ID** | `tr[data-queue-id]`, `a[href*="/manager/inbound-queues/edit/"]` | String | Unique identifier for inbound destination routing queue. | `Queue ID` |
| **Queue Name** | `td.cdk-column-name`, `.mat-column-name` | String | Descriptive name of inbound department (e.g. "Customer Support"). | `Queue Name` |
| **Calls Waiting** | `td.cdk-column-waiting_calls`, `.cdk-column-calls_waiting` | Number | Inbound callers currently holding in queue for an available agent. | `Waiting`, `Calls Waiting` |
| **Active Inbound Agents**| `td.cdk-column-logged_in_agent_count`, `.cdk-column-agents` | Number | Human agents currently assigned to receive inbound calls from this queue. | `Queue Agents` |
| **Max Wait Time** | `td.cdk-column-longest_wait_time`, `.cdk-column-max_wait` | String / Seconds | Longest duration an active caller has remained in holding queue. | `Max Wait`, `Wait Duration` |
| **Queue Freshness** | Content script timestamp at parse time | Epoch Timestamp (ms) | Time when `/manager/inbound-queues` table was last read. | `Inbound refreshed: [Time]` |

---

## 6. SECTION E: LEAD-LIST & BUCKET METRICS
**Native Page:** `/manager/contact-lists`  
**Storage Key:** `ct_eastX_last_known_lead_lists_v1`  
**Observer Function:** `observeLeadLists()` in [content.js](file:///c:/Users/Orange%20Carrot/Downloads/CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL/CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/content.js#L840)  
**Parser Function:** `readLeadLists()` in [parser.js](file:///c:/Users/Orange%20Carrot/Downloads/CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL/CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/parser.js#L890)

| Metric Name | Native DOM Selector | Data Type | Semantic Meaning | Permitted UI Labels |
|---|---|---|---|---|
| **List ID** | `a[href*="/manager/contact-lists/edit/"]` | String | CallTools identifier for uploaded contact list. | `List ID` |
| **List Name** | `td.cdk-column-name` | String | Name assigned to uploaded CSV / bucket list. | `List Name` |
| **Total Leads** | `td.cdk-column-total_contacts` | Number | Total records originally imported into this list. | `Total Leads` |
| **Callable Leads** | `td.cdk-column-callable_contacts` | Number | Leads remaining callable after DNC and timezone rules. | `Callable Leads` |
| **DNC Leads** | `td.cdk-column-dnc_contacts` | Number | Leads suppressed due to Do-Not-Call rules. | `DNC Suppressed` |

---

## 7. SUMMARY MATRIX & IMPLEMENTATION GUIDELINES

```
┌─────────────────────────────────┬─────────────────────────────────┬─────────────────────────────────┐
│ CATEGORY                        │ METRIC                          │ CANONICAL UI STRING             │
├─────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ Active Campaign Queue           │ Callable contacts in campaign   │ "Campaign Pool: 69,194 (Live)" │
│ Targeting Snapshot              │ Query match count in edit page  │ "Filter Matches: 43,948 (Snap)" │
│ Live Filter Catalog             │ Filter inventory contact count  │ "Contacts: 43,948"              │
│ Targeting Age                   │ Elapsed time since verification │ "Targeting: RECENT (28m ago)"   │
│ Refresh Result                  │ Status of last DOM refresh cycle│ "Refreshed: 10:16:03 AM"        │
└─────────────────────────────────┴─────────────────────────────────┴─────────────────────────────────┘
```

This dictionary is the definitive design authority for all versions and builds of CT Operations Monitor Pro.
