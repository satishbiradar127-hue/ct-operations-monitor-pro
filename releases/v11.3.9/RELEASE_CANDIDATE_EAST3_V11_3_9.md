# CT Operations Monitor Pro — v11.3.9 EAST-3 Release Candidate Evidence

**Date:** 2026-11-10  
**Scope:** Independent EAST-3 Release Candidate (`CT_Operations_Monitor_East3`, `https://east-3.calltools.io/*`)  
**Extension ID (Brave Profile 2):** `mmbceflgijbjeepkphiplhmclidhmhjn` (`v11.3.9`, `ENABLED`)

---

## 1. Release Candidate Artifact & Checksum

| Package | Size (bytes) | Files | SHA-256 |
| --- | ---: | ---: | --- |
| `CT_Operations_Monitor_East3_v11.3.9.zip` | 169,182 | 8 | `a0a61d55fd83d560b5c1afa5057e81ae7adac329ed062642be6354d68428d729` |

- Byte-for-byte parity verified (`8/8` files: `manifest.json` + 7 `src/*` modules) across `src/`, `dist/`, `CT_Operations_Monitor_East3*.zip`, `RELEASE_PACKAGES/`, and `releases/v11.3.9/`.
- `manifest.json`: `manifest_version: 3`, `permissions: ["storage"]`, `host_permissions: ["https://east-3.calltools.io/*"]`, `0` runtime errors, `0` manifest errors.

---

## 2. EAST-3 Changes Implemented

1. **Live Filter Inventory (`ACTIVE` / `ALL` / `INACTIVE`) & Persistence (`helpers.js`, `dashboard.js`, `dashboard.css`):**
   - Added `CT.normalizeLfiInventoryFilter` and persisted user view under `ct_east3_lfi_inventory_filter_v1`.
   - First-use default `ACTIVE`; valid selections (`ACTIVE`, `ALL`, `INACTIVE`) persist across full page reloads, dashboard reopening, browser SPA navigation, and concurrent tabs (`onStorage`); invalid/corrupted stored values fall back cleanly to `ACTIVE`.
   - Presentation-only filtering preserves Summary KPI metrics and CallTools data untouched.
2. **Summary Cards Layout & Overlap Removal (`dashboard.js`, `dashboard.css`):**
   - Removed sticky `.ct-summary` overlap that covered scrolled Action Center & Live Filter Intelligence sections.
   - Replaced `1fr 1fr` LFI table blowout with `minmax(0, 1fr)` containment (`shellOverflowX: 0` at both `2304px` wide and `1257px` narrow viewports).
   - Aligned all 6 Summary Cards (`Total Filters`, `Active Filters`, `Inactive Filters`, `Available Contacts`, `Running Campaigns`, `Verified Active Configurations`) to uniform `107px` height (`6`-col desktop, `3`-col medium, `2`-col tablet, `1`-col mobile) with distinct operational tone borders and zero clipping.
3. **Intelligent Live Filter Inventory Ordering (`intelligence.js`, `dashboard.js`):**
   - Priority 1: Authoritatively assigned to currently `RUNNING` campaign(s) via numeric Campaign ID / Filter ID correlation (highest available contact count first; badged `RUNNING`).
   - Priority 2: Other `ACTIVE` filters sorted by available contact count descending.
   - Priority 3: Other filters sorted by status/data availability.
   - Priority 4: `INACTIVE` filters sorted descending in `INACTIVE` and tail of `ALL` views.
   - Deterministic tie-breakers guarantee stable ordering and honest `LAST OBSERVED` labeling.
4. **One-Click WhatsApp Copy Controls (`helpers.js`, `dashboard.js`):**
   - Assigned Live Filter button copies exact single-line format: `Live Filter: [Exact Full Filter Name] | Available Leads: [Verified Count]`.
   - Latest Targeting Transition button copies exact arrow format: `[Previous Filter] → [New Filter]` (zero counts/timestamps/labels), and disables with explicit unavailable explanation when no verified swap exists.
5. **Action Center Polish & Stability (`intelligence.js`, `dashboard.js`, `dashboard.css`):**
   - Preserved `WHAT HAPPENED`, `WHY IT MATTERS`, and `ACTION REQUIRED` (`14px` headlines, `12px` explanation rows, `132px` action rail with `34px` controls).
   - Surfaced explicit `CRITICAL`, `AT RISK`, `ACTIVE SIGNAL`, and `ALL CLEAR` status pills.
   - Superseded duplicate unacknowledged surge/drop gauge alerts cleanly and auto-resolved wait/caller-waiting surges below baseline (`<15s`).
6. **Non-Destructive 15s Background Heartbeat (`content.js`, `dashboard.js`):**
   - Tagged 15s background scheduler cycles (`background: true`) separately from explicit user `Refresh Data` clicks (`manual: true`), preserving continuous `LIVE` Inbound Queue polling across 15s scheduler ticks.

---

## 3. Verification Summary

- **Automated Checks:** `12/12` EAST-3 JS `node --check` passed; `344/344` EAST-3 unit/integration tests passed; `47/47` Root tests passed (`0` failed, `0` skipped); `0` EAST-2 leakage; `0` `.click(`/fetch/XHR/WebSocket in `content.js`/`ng_bridge.js`.
- **Live Brave Profile 2 Verification (`127.0.0.1:9222`):**
  - Default `ACTIVE` (`20`/`36`), `INACTIVE` (`16`/`36`) reload persistence, `ALL` (`36`/`36`) Priority 1–4 ordering + SPA navigation persistence (`/manager/queues` → `/manager/campaigns`), corrupted preference fallback -> `ACTIVE`.
  - Geometry verified (`2304x1102` and `1257x862`): `shellOverflowX: 0`, `stickyOverlap: false`, `kpiOverlaps: []`, `kpiClipped: []`, uniform `107px` card height.
  - Real CDP clipboard readback verified:
    - Assigned: `Live Filter: TS BLEND Hilton 2nd + 3 small lists 11/10 | Available Leads: 30,156`
    - Transition: `TS ALL agent connects NP NP burst 11/10 → TS BLEND Hilton 2nd + 3 small lists 11/10`
    - Denied permission cleanly surfaced `COPY FAILED`.
  - Live campaigns verified: `#1716 TS FRESH DATA` (`#4721`, `30,156` avail / `30,323` total / `30,156` pool), `#1717 TS FIRE DATA` (`#3682`, `0`/`0`), `#1629 RES CRED MAIN` (`#3480 All Contacts 0 Dials`, `0`/`0`), plus `0`-selected (`—`).
  - Operating controls (Toolbar, Table Row `[data-campaign-focus="1716"]`, Card `[data-row-action="operate"]`), Action Center trigger/recovery (`0 CRITICAL · 1 AT RISK · 1 ACTIVE SIGNAL` → `ALL CLEAR`), async `Refresh Data` (`6379ms`, `SUCCESS`), continuous 21s Plan B + Inbound trace (`inbStatus: "LIVE"`, `inbAge: 0-1s`), cross-tab LFI filter sync, reload persistence, and `runtimeErrors: []`, `manifestErrors: []`, `pageErrors: []`.

**EAST-3 Promotion Gate Status:** **PASSED** — Approved to proceed to **Phase 5 (Conditional EAST-2 Deployment)**.

