# CT Operations Monitor Pro — v11.3.9 Dual-Dialer Release Evidence (EAST-2 & EAST-3)

**Release Status:** **LOCKED — PRODUCTION VERIFIED ACROSS BOTH DIALERS**  
**Release Date:** 2026-11-10  
**Target Version:** `11.3.9` (Manifest V3)  
**Scope:** Independent production validation across **EAST-3** (`CT_Operations_Monitor_East3`, `https://east-3.calltools.io/*`, accepted RC commit `58c738090104c249f7bcb7ea63318f59e8d644f3`) and **EAST-2** (`CT_Operations_Monitor_East2`, `https://east-2.calltools.io/*`).  
**Repository:** `satishbiradar127-hue/ct-operations-monitor-pro` ONLY (`The Last Gurukul` untouched).

---

## 1. Verified Release Artifacts & Checksums

Both dialer ZIP packages in `releases/v11.3.9/` match `CT_OPERATIONS_DUAL_DIALER_RELEASE/RELEASE_PACKAGES/`, each dialer directory's `.zip` / `_v11.3.9.zip`, and each dialer's `dist/` & `src/` directories byte-for-byte across all 8 packaged files (`manifest.json` + 7 `src/*` modules):

| Package | Size (bytes) | Files | SHA-256 |
| --- | ---: | ---: | --- |
| `CT_Operations_Monitor_East2_v11.3.9.zip` | 169,600 | 8 | `f35bd1446e4beb26aa901cb102505a7bdd6a356f28a3af22d3f24c908286eccc` |
| `CT_Operations_Monitor_East3_v11.3.9.zip` | 169,182 | 8 | `a0a61d55fd83d560b5c1afa5057e81ae7adac329ed062642be6354d68428d729` |

Canonical `SHA256SUMS.txt` is synchronized across `releases/v11.3.9/`, `CT_OPERATIONS_DUAL_DIALER_RELEASE/RELEASE_PACKAGES/`, `CT_OPERATIONS_DUAL_DIALER_RELEASE/QA_REPORTS/`, `CT_Operations_Monitor_East2/`, and `CT_Operations_Monitor_East3/`.

---

## 2. Read-Only & Strict Site/Dialer Isolation Guarantees

- Strictly passive/read-only toward CallTools DOM and Angular state (`0` `.click(`, `0` `fetch(`, `0` `XMLHttpRequest`, `0` `WebSocket` inside `src/content.js` and `src/ng_bridge.js` for both dialers).
- Zero cross-dialer literal leakage (`0` `east-3`/`east3` tokens in `East2/src/*` & `East2/manifest.json`; `0` `east-2`/`east2` tokens in `East3/src/*` & `East3/manifest.json`).
- Independent scoping verified per dialer:
  - **EAST-2:** `manifest.host_permissions` = `["https://east-2.calltools.io/*"]`, `permissions: ["storage"]`, runtime host guard (`east-2.calltools.io`), DOM root `#ct-operations-dashboard-east2`, storage keys `ct_east2_*` (`ct_east2_lfi_inventory_filter_v1`), events `CT_EAST_2_*`, iframe IDs `ct-operations-hidden-*-east2`.
  - **EAST-3:** `manifest.host_permissions` = `["https://east-3.calltools.io/*"]`, `permissions: ["storage"]`, runtime host guard (`east-3.calltools.io`), DOM root `#ct-operations-dashboard-east3`, storage keys `ct_east3_*` (`ct_east3_lfi_inventory_filter_v1`), events `CT_EAST_3_*`, iframe IDs `ct-operations-hidden-*-east3`.

---

## 3. Summary of Verified Production Improvements (EAST-3 & EAST-2)

1. **Live Filter Inventory Controls, Persistence & Priority 1–4 Ordering (`helpers.js`, `intelligence.js`, `dashboard.js`, `dashboard.css`):**
   - Added `CT.normalizeLfiInventoryFilter` and `ACTIVE` / `ALL` / `INACTIVE` filter buttons persisted under dialer-scoped `PREFIX + "lfi_inventory_filter_v1"` (first-use default `ACTIVE`; corrupted storage falls back cleanly to `ACTIVE`; syncs across reloads, SPA navigation, and concurrent tabs via `onStorage`; preserves KPI totals and CallTools state untouched).
   - Sorted `getLiveFilterIntelligenceSummary().inventory` deterministically: Priority 1 `RUNNING` assigned filter(s) (badged `RUNNING`) -> Priority 2 remaining `ACTIVE` DESC -> Priority 3 other -> Priority 4 `INACTIVE` DESC -> deterministic tie-breakers.
2. **Summary Cards Overlap Removal & Responsive Layout (`dashboard.js`, `dashboard.css`):**
   - Removed sticky `.ct-summary` overlap (`position: relative; top: auto; z-index: 20`) and fixed `1fr 1fr` grid blowout via `minmax(0, 1fr)` containment (`shellOverflowX: 0`).
   - Standardized the 6 LFI Summary KPI cards with tonal borders, uniform card height (`107px` observed live on both dialers), and clean `6 -> 3 -> 2 -> 1` responsive media breakpoints (`0` card overlaps/clipping).
3. **One-Click WhatsApp Copy Controls (`helpers.js`, `dashboard.js`):**
   - Assigned Live Filter button copies single-line format: `Live Filter: [Full Live Filter Name] | Available Leads: [Verified Count]` using authoritative Live Filter Inventory counts only.
   - Latest Targeting Transition button copies exact arrow format `[Previous Filter] → [New Filter]` with zero counts/timestamps/prefixed labels, or disables honestly with `NO VERIFIED TRANSITION` when no verified prior swap exists.
   - Explicit clipboard permission denial cleanly reports `COPY FAILED` without false success feedback.
4. **Action Center Clarity & Live-Gauge Deduplication (`intelligence.js`, `dashboard.js`, `dashboard.css`):**
   - Surfaced explicit `CRITICAL`, `AT RISK`, `ACTIVE SIGNAL`, and `ALL CLEAR` status pills alongside separated `WHAT HAPPENED`, `WHY IT MATTERS`, and `ACTION REQUIRED` rows (`14px` headlines, `12px` rows, `132px` action rail, `34px` buttons).
   - Deduplicated unacknowledged `SUDDEN_INCREASE`/`SUDDEN_DECREASE` live-gauge alerts on load/push, added `_${params.current}` disambiguation on alert IDs (catching sub-millisecond collision in `East2`), and auto-resolved transient wait/caller-waiting spikes once below baseline (`< 15s` wait / `0` waiting).
5. **Non-Destructive 15s Background Heartbeat & Dialer-Tuned EAST-2 Plan B/Refresh Stability (`content.js`, `dashboard.js`):**
   - Distinguished explicit manual `Refresh Data` (`manual: true`) from 15s background scheduler heartbeats (`background: true`) so Inbound queue polling stays continuously `LIVE`.
   - Adapted EAST-2 Plan B (`LF_ACTIVE_PROBE_MS = 12000`, `LF_IDLE_PROBE_MS = 90000`, `MANUAL_REFRESH_TIMEOUT_MS = 20000`, `LF_PROBE_TIMEOUT_MS = 10500`) with a 45s anti-starvation rotation window in `pickNextCampaignToProbe` so all 4 active EAST-2 campaigns (`59874`, `60327`, `61210`, `64392`) stay verified `< 120s` and manual 3-route `Refresh Data` completes cleanly on CallTools EAST-2.

---

## 4. Automated Verification Results (Final Build)

| Check | Result | Scope |
| --- | --- | --- |
| `node --check` (`src/*.js` & `dist/src/*.js`) | `24/24` passed | All JS modules in EAST-2 (`12`) and EAST-3 (`12`) |
| Cross-dialer & CSS/network security scan | `0` violations | Zero cross-dialer leaks, zero `.click(`/fetch/XHR/WS in `content.js`/`ng_bridge.js`, MV3 `["storage"]` |
| ZIP ↔ `dist/` ↔ `src/` SHA-256 parity | `8/8` files exact match per dialer | Both `CT_Operations_Monitor_East2_v11.3.9.zip` (`169,600` bytes) and `CT_Operations_Monitor_East3_v11.3.9.zip` (`169,182` bytes) |
| EAST-3 regression suite (`tests/suite.test.js`) | `344/344` passed (`fail 0`, `skipped 0`) | Includes `UPGRADE 341`–`UPGRADE 344` |
| EAST-2 regression suite (`tests/suite.test.js`) | `345/345` passed (`fail 0`, `skipped 0`) | Includes `UPGRADE 341`–`UPGRADE 345` |
| Root regression suite (`tests/suite.test.js`) | `47/47` passed (`fail 0`, `skipped 0`) | Core shared modules & security invariants |

**Total Automated Tests Passed:** `736 / 736` (`0` failed, `0` skipped, `0` cancelled).

---

## 5. Live Authenticated Browser Verification

### A. EAST-3 Authenticated Production Verification (Brave Profile 2, CDP `127.0.0.1:9222`, Accepted RC `58c7380`)
- **Extension:** `mmbceflgijbjeepkphiplhmclidhmhjn` v`11.3.9` (`ENABLED`, `runtimeErrors: []`, `manifestErrors: []`, `pageErrors: []`).
- **Live Controls & Inventory:** Default `ACTIVE` (`20/36`, Priority 1 `RUNNING` row 1), `INACTIVE` (`16/36`) reload persistence, `ALL` (`36/36`) Priority 1–4 ordering + SPA `/manager/queues` → `/manager/campaigns` persistence, corrupted preference fallback → `ACTIVE`.
- **Layout & Geometry (`2304x1102` wide & `1257x862` narrow):** `shellOverflowX: 0`, `stickyOverlap: false`, `kpiOverlaps: []`, `kpiClipped: []`, uniform `107px` Summary Card height.
- **WhatsApp Clipboard & Action Center:** Real CDP clicks verified `Live Filter: TS BLEND Hilton 2nd + 3 small lists 11/10 | Available Leads: 30,156`, `TS ALL agent connects NP NP burst 11/10 → TS BLEND Hilton 2nd + 3 small lists 11/10`, `COPY FAILED` on denied permission, `#1716`/`#1717`/`#1629` + `0`-selected (`—`), Operating buttons across Toolbar/Table/Card, Alert trigger/recovery (`0 CRITICAL · 1 AT RISK · 1 ACTIVE SIGNAL` → `ALL CLEAR`), async `Refresh Data` (`6379ms`, `SUCCESS`), continuous 21s Plan B + Inbound trace (`inbStatus: "LIVE"`, `inbAge: 0-1s`), and cross-tab storage sync without reload.

### B. EAST-2 Authenticated Production Verification (Google Chrome Profile 20, `PID 12552`, CDP `127.0.0.1:53196`)
- **Extension:** `cimaihkehebfcejdkkinilegdlmpaejm` v`11.3.9` (`ENABLED`, loaded from `CT_Operations_Monitor_East2`, `runtimeErrors: []`, `manifestErrors: []`, `pageErrors: []`).
- **Live Controls & Inventory:** First-use default `ACTIVE` (`12/41` filters, Priority 1 `RUNNING` filters `#59874 RES CRED MAIN`, `#60327 VDH UPGRADE`, `#61210 REALTIME`, `#64392 IR REALTIME` at rows 1–4), `INACTIVE` (`29/41`, `total: 41` preserved, persisted across reload), `ALL` (`41/41`, `firstInactiveIdx: 12`, `anyActiveAfterInactive: false`, persisted across SPA `/manager/queues` → `/manager/campaigns`), corrupted fallback → `ACTIVE`.
- **Layout & Geometry (`2304x958` & `1839x1047` & `1800x1350`):** `shellOverflowX: 0`, `stickyOverlap: false`, `kpiOverlaps: []`, `lftOverlaps: []`, `kpiClipped: []`, `lftClipped: []`, uniform `107px` Summary Card height; responsive `<1480px` `3x2` / `2x3` / `1x6` CSS rules verified by `EAST-2 UPGRADE 345`.
- **WhatsApp Clipboard & Multi-Campaign Isolation:** Real CDP clicks verified `Live Filter: RES CRED MAIN | Available Leads: 32,516` (`#67269`), transition `RES CRED ANSWERERS → RES CRED MAIN`, `COPY FAILED` on denied clipboard permission, switches across `#61210 REALTIME MAIN` (`8,809`), `#60327 WEB UPGRADE` (`21,179`), `#64392 IR REALTIME` (`1,424`), and `0`-selected (`—`), plus Toolbar/Table Row/Card Operating buttons.
- **Refresh Data, Plan B & Action Center:** Async `Refresh Data` completed in `8,298ms` (`result: "SUCCESS"`, `52` records across `campaigns: 19`, `liveFilters: 19`, `campaignEdit: "59874"`, `inboundQueues: 14`); Plan B anti-starvation rotation refreshed all 4 active campaigns (`59874`, `60327`, `64392`, `61210`) under `26s` while holding Inbound continuous `LIVE` (`qfRows: 16`, `inbAge: 0-1s`) and keeping `61210`/`60327`/`64392` copy-enabled; Action Center verified `1 CRITICAL · 3 AT RISK · 4 ACTIVE SIGNALS` (`14px` headlines, `12px` rows, `34px` controls) and threshold recovery back to `ALL CLEAR`; cross-tab storage sync updated Tab A without reload (`originA` unchanged); `east3Dash: false`, `east3Keys: []`, `hasEast3Strings: false`.

### C. Simultaneous Isolated Dual-Install Verification (Brave CDP `127.0.0.1:9225`)
- Loaded rebuilt `CT_Operations_Monitor_East2\dist` (`odbhfepdmhhngjcmbidojcbnmobhjhcc`) and `CT_Operations_Monitor_East3\dist` (`jjbpgdmpippgffhhabjckehpgdabfknb`) simultaneously against `https://east-2.calltools.io/manager/campaigns` and `https://east-3.calltools.io/manager/campaigns`: `v11.3.9` `ENABLED`, `0` cross-dialer bleed, `0` runtime/manifest errors.
- Note: A final post-sleep passive ping against Brave `9222` (`timeout Runtime.enable`) and Chrome `53196` (`ws open timeout`) timed out after OS sleep while both browsers remained running (`PID 12552` Chrome & Brave processes intact, untouched without termination).

---

## 6. Version Lock Decision

- **Decision:** **LOCKED (`v11.3.9`)**
- **Commit History:**
  - EAST-3 Accepted RC: `58c738090104c249f7bcb7ea63318f59e8d644f3`
  - Final Dual-Dialer Release Lock: recorded on `main` & pushed to `satishbiradar127-hue/ct-operations-monitor-pro`.
