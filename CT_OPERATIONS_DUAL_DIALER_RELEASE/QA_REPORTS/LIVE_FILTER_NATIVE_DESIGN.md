# CallTools Live Filter Intelligence Architecture & Native Integration Design
**Project:** CT Operations Monitor Dual-Dialer (EAST-2 & EAST-3)  
**Version:** v11.3.3  
**Date:** 2026-11-06  
**Document Status:** Production Baseline & Architecture Specification  

---

## 1. Executive Summary & Root Cause Analysis

### 1.1 The Production Defect
Operators observed the status message `FILTER SOURCE UNAVAILABLE` beside campaign `TS FRESH DATA` on the authenticated CallTools dashboard (`https://east-3.calltools.io/manager/campaigns`).

### 1.2 Root Cause Analysis
1. **Absence of Live Filter Column in List View:**  
   The native CallTools Campaigns table (`/manager/campaigns`) utilizes Angular Material CDK (`table.mat-table`, `mat-row.mat-row`). The default view renders only 23 standard columns (Select, Name, Status, Strategy, Channels, DIDs, Caller IDs, Call Time, Agents, Live Leads, Attempts, Connects, Abandoned, Goals, etc.). The native DOM on the list view does **not** include a Live Filter column by default.

2. **Native Rendering Location:**  
   CallTools stores the Live Filter assignment in the campaign targeting configuration. It renders this control strictly within the **Targeting section** of the Campaign Edit page (`/manager/campaigns/edit/:id`) using an Angular Material dropdown (`mat-select[formcontrolname="live_filter"]` or `select[name="live_filter"]`), or inside dynamic CDK overlay drawers/modals (`.cdk-overlay-container`).

3. **Strict Read-Only Constraint:**  
   In compliance with Stage 0 safety mandates, the extension operates in **strictly read-only mode** (0 automated clicks, 0 background form submissions, 0 automated tab navigations, and 0 network requests via fetch/XHR/WebSocket). Therefore, the extension cannot force-load or poll native backend endpoints.

4. **Honest Provenance vs Data Fabrication:**  
   Before an operator visits the Campaign Edit page in their browser session, the Live Filter value is genuinely absent from the list page DOM. The extension accurately and honestly reported `FILTER SOURCE UNAVAILABLE` with source `DOM Unavailable` rather than fabricating or guessing filter values.

---

## 2. Architectural Design & Multi-Tier Observation Strategy

To provide real-time Live Filter intelligence without violating the read-only contract, a multi-tier observation and verified registry architecture has been engineered:

```
+-----------------------------------------------------------------------------------+
|                            CALLTOOLS OPERATIONS MONITOR                           |
+-----------------------------------------------------------------------------------+
                                      |
         +----------------------------+----------------------------+
         |                                                         |
         v                                                         v
 [Tier 1: Table Column]                                   [Tier 3: Passive Route Capture]
 Look for:                                                Route: /manager/campaigns/edit/:id
 .cdk-column-live_filter                                  Extract: ID from pathname / edit form
 .cdk-column-filter                                       Extract: Name from input[name='name']
 (Used if operator customized table)                     Extract: mat-select in Targeting section
         |                                                         |
         v (If absent)                                             v
 [Tier 2: CDK Overlay / Modal]                            [Tier 4: Verified Storage Registry]
 Look for:                                                Key: ct_east{2|3}_verified_campaign_filters_v1
 .cdk-overlay-container                                   Indexed by: Campaign ID & Campaign Name
 mat-select[formcontrolname*='filter']                    Persists across page refreshes
         |                                                         |
         +----------------------------+----------------------------+
                                      |
                                      v
                    [Campaign Object Hydration in parser.js]
                    - liveFilter: "TS Fresh Leads Active"
                    - liveFilterStatus: "ASSIGNED"
                    - liveFilterSource: "CAMPAIGN_EDIT_DOM" | "VERIFIED_REGISTRY"
                    - liveFilterTimestamp: 1793976800000
                                      |
                                      v
                     [2-Cycle Confirmation Engine]
                     - confirmationsRequired: 2
                     - Transitions: ASSIGNED, CHANGED, REMOVED
                                      |
                                      v
                     [Top-Header Strip & Action Center]
                     - Top Header: Filter Badge + Source + Timestamp
                     - Action Center: Persistent alerts retained across refresh
```

### 2.1 Multi-Tier Discovery Pipeline
1. **Tier 1 (Table Column Inspection):**  
   If the native table row exposes a live filter column (via `.cdk-column-live_filter`, `.cdk-column-filter`, or `[data-column='live_filter']`), the value is parsed directly with source `TABLE_COLUMN`.
2. **Tier 2 (Active CDK Overlay Inspection):**  
   If an operator opens a campaign edit drawer or modal directly from the campaigns page, the CDK container (`.cdk-overlay-container`) is inspected for `mat-select` or `.mat-select-value-text`, extracting the value with source `ACTIVE_OVERLAY`.
3. **Tier 3 (Passive Edit Page Route Capture):**  
   When the operator navigates to `/manager/campaigns/edit/:id`, `content.js` matches the route via `currentRoute() === "campaign_edit"`. It passively invokes `CTParser.readCampaignEditForm(document)`, capturing:
   - Campaign ID (from URL pathname regex or form attribute)
   - Campaign Name (from `input[name='name']` or title)
   - Live Filter Value (from `mat-select` value text or `<select>` option)
   - Timestamp and Status
4. **Tier 4 (Verified Persistent Registry):**  
   The captured data is stored in browser local storage and Chrome storage under dialer-specific keys (`ct_east2_verified_campaign_filters_v1` and `ct_east3_verified_campaign_filters_v1`). It is indexed under **both** the numeric Campaign ID and the sanitized Campaign Name (e.g. `TS FRESH DATA`).
5. **Tier 5 (Honest Provenance Fallback):**  
   If no observation has been recorded in the current profile session, the campaign displays `FILTER SOURCE UNAVAILABLE` with source `DOM Unavailable`, badge state `is-unavailable`, and tooltip `Awaiting DOM source`. No false alerts or fabricated values are ever emitted.

---

## 3. Campaign Identity Association

### 3.1 Dual-Key Identification
To link records between `/manager/campaigns` and `/manager/campaigns/edit/:id`, the parser implements dual-key extraction:
- **Campaign ID Extraction:**
  1. Row attributes: `data-campaign-id`, `data-id`, `data-campaignid`.
  2. Action controls: Pencil edit link `a[href*="/manager/campaigns/edit/"]` or `button[data-id]`.
- **Campaign Name Extraction:**
  1. Table cell `.cdk-column-name` or `a.campaign-name-link`.
- **Registry Lookup Order:**
  1. Exact ID match (`regData[String(id)]`).
  2. Exact Name match (`regData[cleanName]`).
  3. Case-insensitive Name search (`entry.campaignName.toLowerCase() === cleanName.toLowerCase()`).

This guarantees that whether a row contains the numeric ID or only the campaign title, the verified filter is resolved immediately.

---

## 4. Change Detection & Two-Observation Confirmation Lifecycle

To eliminate transient noise and false positives caused by DOM re-rendering, `intelligence.js` enforces a strict two-cycle confirmation rule:

1. **Cycle 1 (Candidate Detection):**  
   When a change in Live Filter is detected (e.g., from `Filter A` to `Filter B`, or from unassigned to `Filter A`):
   - A candidate state is recorded with `confirmations: 1`.
   - No alert is dispatched to the operator.
2. **Cycle 2 (Confirmed Change):**  
   On the subsequent observation cycle (15-second monitoring tick or manual refresh):
   - If the candidate value persists, `confirmations` reaches 2.
   - The candidate is promoted to a confirmed transition.
   - Baseline state is updated.
   - Persistent alert is pushed to the Action Center:
     - `LIVE FILTER CHANGED`: Filter reassigned.
     - `LIVE FILTER ASSIGNED`: New filter applied to campaign.
     - `LIVE FILTER REMOVED`: Filter detached.
3. **Alert Persistence:**  
   The resulting alerts are stored in `${prefix}persistent_action_alerts` and persist across page refreshes until explicitly acknowledged via the operator "Noted" / "Clear" controls.

---

## 5. UI Integration & Visual Layout

### 5.1 Top-Header Integration
The top header includes a dedicated Live Filter intelligence strip (`.ct-top-live-filter-strip`) located directly beneath the summary controls:
- **Left Section:**
  - `LIVE FILTER` indicator pill.
  - Operating Campaign Name (e.g. `TS FRESH DATA`).
  - Filter Badge: `Filter: <Name>` (green badge `is-assigned`) or `FILTER SOURCE UNAVAILABLE` (subtle dark badge `is-unavailable`).
- **Right Section:**
  - Data Provenance Source: `Source: Edit Page DOM`, `Source: Verified Registry`, or `Source: DOM Unavailable`.
  - Observation Timestamp: `Last observed: <Time>` or `Last observed: Awaiting DOM`.
  - Transition History: `Last change: Filter A → Filter B (Timestamp)` or `Last change: None recorded`.

### 5.2 Command Summary Table Integration
In the Active Campaigns Command Summary table:
- Each campaign row displays a compact Live Filter badge beneath the campaign name.
- Colors and typography match CallTools dark theme standards.
- Tooltips provide full filter title and provenance details on hover.

---

## 6. Strict Read-Only Security Verification

The entire implementation adheres strictly to read-only guarantees:
- **Network Requests:** Exactly 0 `fetch()`, 0 `XMLHttpRequest`, and 0 `WebSocket` calls.
- **DOM Mutations:** Exactly 0 native CallTools button clicks, 0 form submits, 0 automated route changes.
- **Isolation:** Complete namespace separation between EAST-2 (`ct_east2_*`) and EAST-3 (`ct_east3_*`).
- **Audit Verification:** Confirmed by automated AST security scanner (`scripts/security_reaudit.js`) with 100% PASS across all 10 source modules.
