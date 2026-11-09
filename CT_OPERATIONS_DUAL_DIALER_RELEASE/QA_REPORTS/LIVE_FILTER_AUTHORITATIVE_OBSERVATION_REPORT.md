# LIVE FILTER AUTHORITATIVE OBSERVATION REPORT — CT OPERATIONS MONITOR PRO v11.3.8

## 1. INVESTIGATION & SYMPTOM RECAP
Real-browser screenshots on `east-3.calltools.io` revealed:
- On `/manager/campaigns`, the top panel displayed `Filter: TS VDH INT 11/04` with transition log:
  `TS FRESH DATA: TS SPM 311 2nd pass + VDH INT P3 11/05 -> TS VDH INT 11/04 (2:10:29 PM) | Evidence: CAMPAIGN_EDIT_DOM`
- However, native CallTools on `/manager/campaigns/edit/1716` showed:
  Live Filter: `TS FRESH DATA - 4 ATT 5 or Less Consecutive No C...`
- Furthermore, when observation age was 5m 55s or 22m 47s, the dashboard displayed green `TARGETING: VERIFIED` and `VERIFIED ACTIVE` despite Card 6 acknowledging `STALE`.

## 2. ROOT CAUSE FORENSICS
1. **Unscoped CDK Overlay Attribution:** In `src/parser.js`, `readRow()` inspected `.cdk-overlay-container` and fell back to `overlay` if `[data-campaign-id='${id}']` was absent. Any open filter dropdown, modal, or search popup on `/manager/campaigns` was falsely attributed to whichever campaign was currently being parsed.
2. **List Page Invocation of Edit Observer:** In `src/content.js`, line 495 invoked `observeCampaignEditForm()` while on `isCampaignsPage()`. This parsed the list page as if it were an edit form.
3. **Angular `ng-select` Typeahead Extraction:** In `@ng-select/ng-select`, the input field inside `.ng-value-container` has an empty value or typeahead query. Reading this input before `.ng-value-label` caused edit page observations to miss the selected filter value.
4. **Ellipsis Truncation:** Long filter names (`TS FRESH DATA - 4 ATT 5 or Less Consecutive No C...`) were not resolved to their canonical inventory names.
5. **Freshness Window Defect:** `FRESHNESS_WINDOW_MS` was set to 7 days, causing observations minutes or hours old to be presented as currently verified.

## 3. ENGINEERING RESOLUTION
1. **Strict Route Scoping:**
   - Removed list-page invocation of `observeCampaignEditForm()` in `content.js`.
   - In `parser.js`, overlay inspection is strictly bounded to `[data-campaign-id='${id}']` or matching campaign name.
   - Non-edit pages return `null` immediately unless an explicit edit form container exists.
2. **Multi-Framework Deep Extraction:**
   - Added prioritized extraction for Angular `ng-select` (`.ng-value-label`, `title`, `aria-label`, child inputs), Angular Material `mat-select`, native `select`, targeting container traversal, and input fields.
3. **Canonical Name Resolution:**
   - Evaluates `title` and `aria-label` attributes for full untruncated names.
   - Cross-references truncated prefixes against inventory (`ct_east3_live_filters_inventory_v1` or `ct_east2_live_filters_inventory_v1`) to restore canonical name and match counts.
4. **Strict Honest Truth States:**
   - `FRESHNESS_WINDOW_MS` aligned to 120 seconds (2 minutes).
   - `<= 120s`: `VERIFIED — CURRENT` (green `is-verified`).
   - `> 120s`: `STALE — LAST VERIFIED` (amber `is-stale`). Green verified badges are strictly suppressed.
5. **Real-Time Cross-Tab Propagation:**
   - `onStorage` and `chrome.storage.onChanged` in `dashboard.js` listen to `VERIFIED_FILTERS_KEY` and trigger immediate rendering when an edit form is observed in another tab.

## 4. VERIFICATION EVIDENCE
Verified through tests:
- `EAST-2 UPGRADE 291` & `EAST-3 UPGRADE 291`: Angular `ng-select` live filter extraction.
- `EAST-2 UPGRADE 292` & `EAST-3 UPGRADE 292`: Angular Material and native select parity.
- `EAST-2 UPGRADE 293` & `EAST-3 UPGRADE 293`: Breadcrumb header cleanup to canonical name.
- `EAST-2 UPGRADE 294` & `EAST-3 UPGRADE 294`: Truncated ellipsis resolution against inventory.
- `EAST-2 UPGRADE 295` & `EAST-3 UPGRADE 295`: Non-edit campaign list page rejection.
- `EAST-2 UPGRADE 296` & `EAST-3 UPGRADE 296`: Fresh observation `<= 120s` truth state.
- `EAST-2 UPGRADE 297` & `EAST-3 UPGRADE 297`: Stale observation `> 120s` amber badge enforcement.
