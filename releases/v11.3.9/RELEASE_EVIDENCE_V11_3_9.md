# CT Operations Monitor Pro — v11.3.9 Dual-Dialer Release Evidence (EAST-2 & EAST-3)

**Release Date:** 2026-11-10  
**Target Version:** `11.3.9` (Manifest V3)  
**Scope:** Independent production parity across **EAST-2** (`CT_Operations_Monitor_East2`, `east-2.calltools.io`) and **EAST-3** (`CT_Operations_Monitor_East3`, `east-3.calltools.io`).

---

## 1. Verified Release Artifacts & Checksums

Both dialer ZIP packages in `releases/v11.3.9/` match `CT_OPERATIONS_DUAL_DIALER_RELEASE/RELEASE_PACKAGES/` and each dialer's `dist/` directory byte-for-byte across all 8 packaged files (`manifest.json` + 7 `src/*` modules):

| Package | Size (bytes) | Files | SHA-256 |
| --- | ---: | ---: | --- |
| `CT_Operations_Monitor_East2_v11.3.9.zip` | 158,870 | 8 | `f53ae41ad824edb78e6cd70d4f6ba408e33fd91b0ffa6ed5f6ec8ffeeb4c6ff0` |
| `CT_Operations_Monitor_East3_v11.3.9.zip` | 158,876 | 8 | `079eaf5bab85348bef2a07a6cce71c3f91833b6303fb0cabe9d71417ef7b3bfe` |

Canonical `SHA256SUMS.txt` is stored alongside the ZIPs in `releases/v11.3.9/SHA256SUMS.txt` and `CT_OPERATIONS_DUAL_DIALER_RELEASE/RELEASE_PACKAGES/SHA256SUMS.txt`.

---

## 2. Read-Only & Strict Site/Dialer Isolation Guarantees

- Strictly passive/read-only toward CallTools DOM and Angular state (`0` `.click(`, `0` `fetch(`, `0` `new XMLHttpRequest`, `0` `new WebSocket` inside `src/content.js` and `src/ng_bridge.js` for both dialers).
- Zero cross-dialer literal leakage (`0` `east-3`/`east3` tokens in `East2/src/*`; `0` `east-2`/`east2` tokens in `East3/src/*`) across all 7 packaged modules per dialer (`ng_bridge.js`, `parser.js`, `content.js`, `intelligence.js`, `dashboard.js`, `dashboard.css`, `helpers.js`).
- Strict host, DOM, global, CSS, storage, and messaging isolation:
  - **EAST-2:** `manifest.host_permissions` = `*://east-2.calltools.io/*`, runtime host check in `ng_bridge.js`/`parser.js`/`intelligence.js`/`content.js`, globals `__CT_NG_BRIDGE_EAST2__` / `__CTOperationsFeedCleanup_EAST2` / `__CTOperationsDashboardCleanup_EAST2` / `__CT_EDIT_EVENTS_ATTACHED_EAST2` / `__CT_SPA_INTERCEPTED_EAST2`, attributes `data-ct-east2-campaign-id`/`name`/`index`, origin+dialer-checked `postMessage`, storage `ct_east2_*`, events `CT_EAST_2_*`, CSS scoped to `#ct-operations-dashboard-east2`.
  - **EAST-3:** `manifest.host_permissions` = `*://east-3.calltools.io/*`, runtime host check in `ng_bridge.js`/`parser.js`/`intelligence.js`/`content.js`, globals `__CT_NG_BRIDGE_EAST3__` / `__CTOperationsFeedCleanup_EAST3` / `__CTOperationsDashboardCleanup_EAST3` / `__CT_EDIT_EVENTS_ATTACHED_EAST3` / `__CT_SPA_INTERCEPTED_EAST3`, attributes `data-ct-east3-campaign-id`/`name`/`index`, origin+dialer-checked `postMessage`, storage `ct_east3_*`, events `CT_EAST_3_*`, CSS scoped to `#ct-operations-dashboard-east3`.

---

## 3. Summary of Fixes Implemented Across Both Dialers

1. **Realtime Accuracy & Plan B Synchronization:**
   - Normalized `/manager/live-filters` active/inactive detection using `cancel-icon.svg` vs `check-icon.svg` alongside slide-toggle attributes (`readLiveFilters`).
   - Eliminated blind fallbacks (`nonDash[0]` / bare `tbody tr`) in `parser.js:findCampaignTable()`, added 3-poll `tableMissingStreak >= 3` debouncing in `content.js`, and added empty-snapshot guards in `intelligence.js` (`evaluateOutbound`/`evaluateInbound`).
   - Added unpaginated `<select formcontrolname="live_filter">` option catalog harvesting from `/manager/campaigns/edit/:cid` with numeric filter ID extraction, dormant-filter tagging, and stale/deleted ghost pruning in `content.js` & `intelligence.js`.
   - Stabilized Plan B sequential hidden-iframe SPA observation (`/manager/live-filters` ↔ `/manager/campaigns/edit/:cid`) using route-epoch guards and timeout recovery so background filter updates continue smoothly without starving inbound `/manager/queues` polling.
2. **Operating Campaign Controls & Filter Responsiveness:**
   - Restored unclipped toolbar `.ct-operating-menu` layering, enlarged `.ct-operating-menu-head button` (`All` / `Clear`) clickable hit targets, preserved in-place `[data-campaign-focus]` rows and closed-drawer scroll stability, and synced card `[data-row-action="operate"]` (`aria-pressed`) across reloads.
   - Updated filter pill handlers (`stateFilterButtons`, `healthFilterButtons`, `filterButtons`) to render synchronously (`cancelAnimationFrame` + immediate `render()`).
3. **Genuine Asynchronous `Refresh Data`:**
   - Wired `CT_EAST_X_REQUEST_REFRESH` → multi-source collection (`/manager/queues`, `/manager/campaigns`, `/manager/live-filters`, `/manager/campaigns/edit/:cid`) → correlated `CT_EAST_X_REFRESH_RESULT` with explicit `refreshId`, elapsed timing, per-source status, and failure reporting (`0` fake synchronous completions).
4. **Alert Center Audit, Noise Elimination & Enterprise Redesign:**
   - Restricted `UNEXPECTED RESET` (`isCumulativeCounter: true`) strictly to true cumulative counters (`outbound_abandoned`, `inbound_not_answered`), preventing false reset alerts on live gauges (`Total Agents Logged In`, `Callers Waiting`, `Worst Wait Time`, `Active Campaigns Count`).
   - Required combined absolute + percentage thresholds (`requireBothAbsAndPct: true`) and baseline gates (`minBaseline: 3` on active campaigns) to eliminate minor variance noise (`24->36` wait, `27->23` agents) and transient `18 -> 1` campaign-count spikes.
   - Added automatic cleanup of legacy gauge reset / foreign-dialer alerts in `loadState()`, auto-resolution for `AUTH_LOST`/`INBOUND_AUTH_LOST`/`FEED_STALE`/`TABLE_MISSING`/`CONTRADICTORY`/`MISSING`, and added `OUTBOUND_NO_AGENT_WAITING`, `INBOUND_AUTH_LOST`, `INACTIVE FILTER ASSIGNED`, and `FILTER POOL EXHAUSTED`.
   - Redesigned Action Center cards (`dashboard.js` + deduplicated/scoped `dashboard.css`) with accurate `CRITICAL`/`AT RISK`/`ACTIVE SIGNALS` counters, false `ALL CLEAR` suppression, dialer pills (`EAST-2` / `EAST-3`), numeric stat transition bars, working `FOCUS`/`REFRESH`/`VIEW QUEUE`/`DISMISS`/`NOTED` actions, and explicit **What happened / Dialer / `WHY IT MATTERS` / `ACTION REQUIRED`** sections.

---

## 4. Automated Verification Results (Final Build)

| Check | Result | Scope |
| --- | --- | --- |
| `node --check` (`src/*.js` & `dist/src/*.js`) | `24/24` passed | All JS modules in EAST-2 and EAST-3 |
| Cross-dialer & CSS/network security scan | `0` violations | Zero cross-dialer strings, zero `.click(`/fetch/XHR/WS in `content.js`/`ng_bridge.js` |
| Root regression suite (`tests/suite.test.js`) | `47/47` passed (`fail 0`) | Core shared modules & security invariants |
| EAST-2 suite (`tests/suite.test.js`) | `340/340` passed (`fail 0`) | Parser, intelligence, dashboard, content, `dist/` parity, simulation (`UPGRADE 338`), alert accuracy & isolation (`UPGRADE 339-340`) |
| EAST-3 suite (`tests/suite.test.js`) | `340/340` passed (`fail 0`) | Parser, intelligence, dashboard, content, `dist/` parity, simulation (`UPGRADE 338`), alert accuracy & isolation (`UPGRADE 339-340`) |
| ZIP ↔ `dist/` SHA-256 verification | `8/8` files exact match per dialer | Both `releases/v11.3.9/` and `RELEASE_PACKAGES/` ZIPs |

**Total Automated Tests Passed:** `727 / 727` (`0` failed, `0` skipped).

---

## 5. Git & Legacy Repository Reconciliation

- Reconciled legacy clone `C:\Users\Orange Carrot\Documents\GitHub\ct-operations-monitor-pro` against canonical upstream `https://github.com/satishbiradar127-hue/ct-operations-monitor-pro.git` without discarding work or force-pushing:
  - Archived the 6 legacy uncommitted/untracked working-tree items (legacy v9 `content.js`/`dashboard.css`/`dashboard.js` edits, `Risk Monitor v2`, `helpers.zip`, `ct-operations-monitor-pro-BACKUP-2026-08-20/`) to `C:\Users\Orange Carrot\Documents\GitHub\ct-operations-monitor-pro-LEGACY-PENDING-ARCHIVE-2026-08-20\` and committed the tracked legacy edits onto branch `archive/legacy-pending-aug-2026` (`7427caf`).
  - Synchronized `main` cleanly (`working tree clean`) with canonical repository commits and pushed updates via standard fast-forward push.

---

## 6. Live Browser Verification & Honest Blockers

### A. EAST-3 Live Authenticated Production Verification (Brave Profile 2, CDP `127.0.0.1:9222`)
- **Extension:** `mmbceflgijbjeepkphiplhmclidhmhjn` v`11.3.9`, `state: "ENABLED"`, `runtimeErrors: []`, `manifestErrors: []`, `PAGE_ERRORS: []`.
- **Realtime & Live Transition:** Verified `36` filters (`20` active / `16` inactive / `168,072` available at audit, `0` deleted ghosts), `22s` Plan B rotation with inbound queue continuously `LIVE`. Observed live campaign `#1716` (`TS FRESH DATA`) filter transition `TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts` -> `TS JAN 4 Hilton 2nd attempt 11/09` (`#4619`) rendered automatically in both Live Filter Targeting cards and redesigned Action Center (`1 CRITICAL`, `EAST-3`, `WHY IT MATTERS`, `ACTION REQUIRED`, `FOCUS`/`DISMISS`).
- **Action Center Steady State:** Verified `historyFalseGaugeResetsLeft === 0` after `loadState()` legacy purge, accurate `[0 CRITICAL] [0 AT RISK]` counters when clear, and `[Clear All]` transition into `EAST-3 · ALL CLEAR`.
- **Operating Controls:** Real CDP mouse clicks verified toolbar dropdown (`All`, `Clear`, `#1717`, `#1629`, `#1716`), table-row focus button (`[data-campaign-focus="1717"]`, exact scroll `310 === 310`), drawer card `[data-row-action="operate"]` (`aria-pressed="true"`/`"false"`), and full `Page.reload` persistence (`["1716"]`, `"TS FRESH DATA 1"`).
- **Refresh Data:** Verified real async refresh (`refreshId: "ref-1794340645958-1"`, `elapsedMs: 4705`, `recordsRead: 7`: `campaigns: 3`, `liveFilters: 3`, `campaignEdit: 1716`, `inboundQueues: 1`, `unavailableSources: []`), advancing real timestamps and syncing `33,780 === 33,780`.

### B. Simultaneous Dual-Site Isolation & Live EAST-2 Authentication Boundary
- **Isolated Simultaneous Browser Verification (Brave CDP `127.0.0.1:9225`):** Loaded unpacked `CT_Operations_Monitor_East2\dist` (`odbhfepdmhhngjcmbidojcbnmobhjhcc`) and `CT_Operations_Monitor_East3\dist` (`jjbpgdmpippgffhhabjckehpgdabfknb`) side-by-side (`v11.3.9`, both `ENABLED`, `runtimeErrors: []`, `manifestErrors: []`), opened `https://east-2.calltools.io/manager/campaigns` and `https://east-3.calltools.io/manager/campaigns` simultaneously, and confirmed `0` cross-dialer DOM/attribute/global/storage leakage and `0` runtime/manifest errors.
- **Live Authenticated EAST-2 Blocker:** Live authenticated CallTools UI testing on `east-2.calltools.io` could **not** be executed directly by automation because:
  1. Brave Profile 2 (`127.0.0.1:9222`) holds no authenticated `east-2.calltools.io` session, and
  2. Google Chrome `Profile 20` (`PID 12552`, which holds `east-2` cookies and `CT_Operations_Monitor_East2` id `cimaihkehebfcejdkkinilegdlmpaejm`) is running without `--remote-debugging-port`.
  - Per strict read-only and non-bypass security constraints, no credential extraction or process bypass was performed. All `340/340` EAST-2 automated tests, static/runtime isolation checks, and simultaneous isolated extension-load checks pass on the identical v11.3.9 package build.
