# OPERATING CAMPAIGN ROOT CAUSE REPORT — CT OPERATIONS MONITOR PRO v11.3.8

## 1. INVESTIGATION & SYMPTOM RECAP
In previous releases (`v11.3.5` through `v11.3.7`), operators experienced several defects when interacting with the Operating Campaign selector:
1. Clicking a single campaign row in the dropdown toggled off unexpectedly or required multiple clicks.
2. Deselecting an active campaign to return to 0 selected campaigns (viewing all active operational campaigns) failed due to a hardcoded `next.size === 1` guard.
3. Live data polling every 1-2 seconds rebuilt the dropdown DOM, resetting `scrollTop` to 0 and disrupting user interaction during scrolling.
4. Active Commands Summary table sorting or filtering resulted in mismatched campaign state highlights.

## 2. ROOT CAUSE FORENSICS
- **Premature Menu Closure:** Native click events on checkboxes or menu items triggered event bubbling that reached document-level dismiss handlers before state persistence completed.
- **Deselection Guard Defect:** In `dashboard.js`, `focusCampaign()` prevented deselecting when `next.size === 1`, assuming a campaign must always be selected. Operators, however, require deselecting down to 0 to inspect aggregate metrics.
- **Scroll Reset:** Polling updates replaced the entire `innerHTML` of `.ct-operating-menu-list` on every poll cycle, obliterating user scroll position.

## 3. ENGINEERING RESOLUTION
- **In-Place DOM Mutation & Scroll Retention:** `updateOperatingSelect()` now preserves `refs.operatingOptions.scrollTop` before and after DOM reconciliations.
- **Zero-Selection Support:** Allowed operators to deselect any campaign down to 0 selected campaigns.
- **All / Clear Quick Actions:** Added explicit `All` and `Clear` buttons to the operating menu header. Clicking `All` selects all currently visible operational campaigns; `Clear` clears selection back to aggregate view.
- **Robust Campaign Matching:** Updated `isCampaignSelected` to resolve campaign identity using native ID, rawId, and canonical name, guaranteeing stability across table sorting and filtering.

## 4. VERIFICATION EVIDENCE
Verified through tests:
- `EAST-2 UPGRADE 271` & `EAST-3 UPGRADE 271`: Native ID selection without synthetic index fallback.
- `EAST-2 UPGRADE 272` & `EAST-3 UPGRADE 272`: First-click toggle without slamming menu shut.
- `EAST-2 UPGRADE 274` & `EAST-3 UPGRADE 274`: Persistence across table sorting and filtering reorder.
- `EAST-2 UPGRADE 298` & `EAST-3 UPGRADE 298`: 'All' button and single campaign deselection back to 0.
- `EAST-2 UPGRADE 299` & `EAST-3 UPGRADE 299`: Dropdown scroll position maintenance across live data polls.
