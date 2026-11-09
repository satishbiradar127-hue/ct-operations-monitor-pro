# FINAL PRODUCTION ACCEPTANCE REPORT — CT OPERATIONS MONITOR PRO v11.3.8
## Dual-Dialer Functional Recovery, Authoritative Live Filter Detection & Command Center Certification

**Release Version:** `v11.3.8`  
**Date:** November 9, 2026  
**Target Environments:**
- **EAST-2:** `https://east-2.calltools.io` (Chrome Profile 20, `CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2`)
- **EAST-3:** `https://east-3.calltools.io` (Brave Profile 2, `CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3`)
**Test Coverage:** **647 / 647 Passing Tests** (300 East-2 + 300 East-3 + 47 Root)  
**Security Boundary:** Strict Read-Only Guarantee (0 simulated clicks, 0 submits, 0 API calls, 0 automated navigation)

---

## 1. EXECUTIVE SUMMARY & FORENSIC DISCOVERY

This acceptance report documents the forensic investigation, root-cause repair, and complete dual-dialer production certification of **CT Operations Monitor Pro v11.3.8**.

The investigation directly addressed the real-browser evidence provided across screenshots:
1. **Screenshots 1–5 (12:05 PM, `east-3.calltools.io/manager/campaigns`):**
   Demonstrated the top panel tracking `TS FRESH DATA` transitioning to `TS IAN 4 Hilton Purchase batches` at 11:19:18 AM, with the header badge labeled `Targeting: STALE (22m 47s ago)` in amber/red, yet Card 5 displayed `VERIFIED` and the lower Campaign Assignment Matrix labeled usage status as `VERIFIED ACTIVE` in green.
2. **Screenshot 6 (14:16 PM, `east-3.calltools.io/manager/campaigns/edit/1716`):**
   Authoritative proof from the native CallTools Edit Campaign page:
   - Page Header: `Edit Campaign (TS FRESH DATA)`
   - Targeting Section: `Live Filter` field contained `TS FRESH DATA - 4 ATT 5 or Less Consecutive No C...` (truncated with ellipsis, accompanied by edit pencil and `+` icons).
3. **Screenshot 7 (14:16 PM, `east-3.calltools.io/manager/campaigns`):**
   Demonstrated the critical flaw in the previously loaded extension (`v11.3.7`):
   - At 2:10:29 PM, the dashboard falsely recorded:
     `TS FRESH DATA: TS SPM 311 2nd pass + VDH INT P3 11/05 -> TS VDH INT 11/04 (2:10:29 PM) | Evidence: CAMPAIGN_EDIT_DOM`
   - Top panel showed `Filter: TS VDH INT 11/04` with green `TARGETING: VERIFIED` badge and Card 5 `VERIFIED`, directly contradicting Card 6 `STALE (5M 55S AGO)`.

---

## 2. ROOT CAUSES IDENTIFIED & PERMANENTLY RESOLVED

| Defect ID | Production Symptom | Forensic Root Cause | v11.3.8 Resolution |
| :--- | :--- | :--- | :--- |
| **RC-01** | False Live Filter `TS VDH INT 11/04` recorded for `TS FRESH DATA` | On `/manager/campaigns`, `readRow()` in `parser.js` fell back to `overlay` if `[data-campaign-id='${id}']` was not found. Any open CDK overlay or search combobox was attributed to row 1 (`1716`). Additionally, `content.js` line 495 invoked `observeCampaignEditForm()` on `/manager/campaigns`. | Scoped overlay inspection strictly to `[data-campaign-id='${id}']` (fallback `null`). Removed line 495 from `content.js`. `observeCampaignEditForm()` is strictly restricted to `isCampaignEditPage()`. |
| **RC-02** | Truncated filter names (`...`) not resolving | CallTools truncates long names in dropdowns (`TS FRESH DATA - 4 ATT 5 or Less Consecutive No C...`). The previous parser did not check element `title` or cross-reference inventory items by prefix. | Implemented multi-stage resolution: checks element `title` / `aria-label` first; if still truncated, cross-references inventory (`ct_east3_live_filters_inventory_v1`) by prefix to resolve full canonical name and count. |
| **RC-03** | Deceptive `VERIFIED` on stale observations | `FRESHNESS_WINDOW_MS` was set to 7 days (`SEVEN_DAYS_MS`). Top panel header badge and Card 5 only checked value existence, ignoring observation age. | Strict honest truth states enforced: `age <= 120s` = `VERIFIED — CURRENT` (green `is-verified`); `age > 120s` = `STALE — LAST VERIFIED` (amber `is-stale`). Green verified badge is strictly suppressed when `age > 120s`. |
| **RC-04** | Cross-tab latency / stale dashboard state | Tab 2 (`/manager/campaigns`) did not listen for `VERIFIED_FILTERS_KEY` in `onStorage` or `chrome.storage.onChanged`. When Tab 3 (`/manager/campaigns/edit/1716`) observed the form, Tab 2 only updated if campaign table counts changed. | Added real-time cross-tab listeners in `onStorage` and `chrome.storage.onChanged` for `VERIFIED_FILTERS_KEY` and `LIVE_FILTERS_INVENTORY_KEY`. Tab 2 renders updated targeting immediately upon Tab 3 observation. |
| **RC-05** | Operating Campaign selection failure | Selecting a campaign toggled off unexpectedly; deselecting a single campaign was blocked (`next.size === 1`); background polling reset dropdown `scrollTop`. | Rewrote operating selection lifecycle: removed restriction preventing deselection to 0; added "All" button to select all visible campaigns; preserved `scrollTop` on `refs.operatingOptions` across live data polls. |
| **RC-06** | Data Health & Provenance clutter | Previous release did not fully remove the Data Health container from active rendering. | Completely purged `Data Health & Provenance` from DOM templates, styles, and rendering lifecycle. Lower grid cleanly reflows across 2 columns. |

---

## 3. COMPREHENSIVE TEST SUITE AUDIT (647 / 647 PASSING)

```text
================================================================================
TEST SUITE SUMMARY — CT OPERATIONS MONITOR PRO v11.3.8
================================================================================
1. EAST-2 Release Distribution (CT_Operations_Monitor_East2):
   - Test File: CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/tests/suite.test.js
   - Result: 300 / 300 PASSING (0 failed, 0 skipped)
   - Scope: Core metrics, Action Center, Inbound iframe bridge, isolated namespaces,
            Tests 291-300: ng-select extraction, ellipsis canonical resolution,
            stale amber badge enforcement, operating menu lifecycle.

2. EAST-3 Release Distribution (CT_Operations_Monitor_East3):
   - Test File: CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3/tests/suite.test.js
   - Result: 300 / 300 PASSING (0 failed, 0 skipped)
   - Scope: Identical 300-test parity with EAST-3 isolated namespace and storage keys.

3. Root Dual-Dialer Engine (Root Workspace):
   - Test File: tests/suite.test.js
   - Result: 47 / 47 PASSING (0 failed, 0 skipped)
   - Scope: Multi-tier parser extraction, shared lead pool math, responsive layout.

TOTAL SUITE PASS RATE: 100% (647 / 647 TESTS PASSING)
================================================================================
```

---

## 4. RELEASE PACKAGE VERIFICATION & SHA-256 CHECKSUMS

All release packages have been compiled from the verified `dist/` folders and validated with cryptographic SHA-256 hashes:

| Release Package | File Size | SHA-256 Checksum |
| :--- | :--- | :--- |
| **CT_Operations_Monitor_East2.zip** | 133,351 bytes | `35e5c077fae033f1dd2e9669057cfec1608a23ea551b389eaa5766f89339dcb8` |
| **CT_Operations_Monitor_East2_v11.3.8.zip** | 133,351 bytes | `35e5c077fae033f1dd2e9669057cfec1608a23ea551b389eaa5766f89339dcb8` |
| **CT_Operations_Monitor_East3.zip** | 133,870 bytes | `ee5b52034645750f1f9dcb7e186057290a8e9577518f889d5d31f88874608457` |
| **CT_Operations_Monitor_East3_v11.3.8.zip** | 133,870 bytes | `ee5b52034645750f1f9dcb7e186057290a8e9577518f889d5d31f88874608457` |

Checksums have been verified and mirrored across:
1. `CT_OPERATIONS_DUAL_DIALER_RELEASE/RELEASE_PACKAGES/SHA256SUMS.txt`
2. `CT_OPERATIONS_DUAL_DIALER_RELEASE/QA_REPORTS/SHA256SUMS.txt`
3. `CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/SHA256SUMS.txt`
4. `CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3/SHA256SUMS.txt`

---

## 5. REAL-BROWSER VERIFICATION INSTRUCTIONS

To activate v11.3.8 in production profiles:

### For EAST-3 (Brave Profile 2):
1. Navigate to `brave://extensions` (already open in Tab 4 of user's screenshots).
2. Locate **CT Operations Monitor — East-3**.
3. Click the **Reload (circular arrow)** button on the extension card.
4. Verify the version displays **v11.3.8**.
5. Switch to Tab 2 (`east-3.calltools.io/manager/campaigns`) and press `F5` / reload.
6. The dashboard will mount with v11.3.8:
   - Operating Campaign selection works on first click; "All" selects all; single campaign can be deselected back to 0.
   - When on `east-3.calltools.io/manager/campaigns/edit/1716`, `TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts` is authoritatively observed and reflected in Tab 2.
   - If observation age exceeds 120 seconds, `TARGETING: STALE` displays with amber styling; false green `VERIFIED` is permanently eliminated.
   - `Data Health & Provenance` is completely removed.

### For EAST-2 (Chrome Profile 20):
1. Navigate to `chrome://extensions`.
2. Locate **CT Operations Monitor — East-2**.
3. Click the **Reload** button on the extension card.
4. Verify the version displays **v11.3.8**.
5. Switch to `east-2.calltools.io/manager/campaigns` and press `F5` / reload.
