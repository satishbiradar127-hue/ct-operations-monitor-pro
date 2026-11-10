# CT Operations Monitor Pro — v11.3.9 Dual-Dialer Release Evidence (EAST-2 & EAST-3)

**Release Date:** 2026-11-10  
**Target Version:** `11.3.9` (Manifest V3)  
**Scope:** Independent production parity across **EAST-2** (`CT_Operations_Monitor_East2`, `east-2.calltools.io`) and **EAST-3** (`CT_Operations_Monitor_East3`, `east-3.calltools.io`).

---

## 1. Verified Release Artifacts & Checksums

Both dialer ZIP packages in `releases/v11.3.9/` match `CT_OPERATIONS_DUAL_DIALER_RELEASE/RELEASE_PACKAGES/` and each dialer's `dist/` directory byte-for-byte across all 8 packaged files (`manifest.json` + 7 `src/*` modules):

| Package | Size (bytes) | Files | SHA-256 |
| --- | ---: | ---: | --- |
| `CT_Operations_Monitor_East2_v11.3.9.zip` | 166,003 | 8 | `6ea48718bac1f3b72ca2af181cfb9a9a8e12c2097778698e836e5c5b08c61321` |
| `CT_Operations_Monitor_East3_v11.3.9.zip` | 166,013 | 8 | `ae817d81a89d9f1e83962d57ef23e8a4a2d4f2c6018adf85ea030ceb3ebee33c` |

Canonical `SHA256SUMS.txt` is stored alongside the ZIPs in `releases/v11.3.9/SHA256SUMS.txt` and `CT_OPERATIONS_DUAL_DIALER_RELEASE/RELEASE_PACKAGES/SHA256SUMS.txt`.

---

## 2. Read-Only & Strict Site/Dialer Isolation Guarantees

- Strictly passive/read-only toward CallTools DOM and Angular state (`0` `.click(`, `0` `fetch(`, `0` `new XMLHttpRequest`, `0` `new WebSocket` inside `src/content.js` and `src/ng_bridge.js` for both dialers).
- Zero cross-dialer literal leakage (`0` `east-3`/`east3` tokens in `East2/src/*`; `0` `east-2`/`east2` tokens in `East3/src/*`) across all 7 packaged modules per dialer (`ng_bridge.js`, `parser.js`, `content.js`, `intelligence.js`, `dashboard.js`, `dashboard.css`, `helpers.js`).
- Strict host, DOM, global, CSS, storage, and messaging isolation:
  - **EAST-2:** `manifest.host_permissions` = `https://east-2.calltools.io/*`, runtime host check in `ng_bridge.js`/`parser.js`/`intelligence.js`/`content.js`, globals `__CT_NG_BRIDGE_EAST2__` / `__CTOperationsFeedCleanup_EAST2` / `__CTOperationsDashboardCleanup_EAST2` / `__CT_EDIT_EVENTS_ATTACHED_EAST2` / `__CT_SPA_INTERCEPTED_EAST2`, attributes `data-ct-east2-campaign-id`/`name`/`index`, origin+dialer-checked `postMessage`, storage `ct_east2_*`, events `CT_EAST_2_*`, CSS scoped to `#ct-operations-dashboard-east2`.
  - **EAST-3:** `manifest.host_permissions` = `https://east-3.calltools.io/*`, runtime host check in `ng_bridge.js`/`parser.js`/`intelligence.js`/`content.js`, globals `__CT_NG_BRIDGE_EAST3__` / `__CTOperationsFeedCleanup_EAST3` / `__CTOperationsDashboardCleanup_EAST3` / `__CT_EDIT_EVENTS_ATTACHED_EAST3` / `__CT_SPA_INTERCEPTED_EAST3`, attributes `data-ct-east3-campaign-id`/`name`/`index`, origin+dialer-checked `postMessage`, storage `ct_east3_*`, events `CT_EAST_3_*`, CSS scoped to `#ct-operations-dashboard-east3`.

---

## 3. Summary of Fixes Implemented Across Both Dialers

1. **Realtime Accuracy & Plan B Synchronization:**
   - Normalized `/manager/live-filters` active/inactive detection using `cancel-icon.svg` vs `check-icon.svg` alongside slide-toggle attributes (`readLiveFilters`).
   - Eliminated blind fallbacks (`nonDash[0]` / bare `tbody tr`) in `parser.js:findCampaignTable()`, added 6-poll `tableMissingStreak >= 6` debouncing in `content.js`, and added empty-snapshot guards in `intelligence.js` (`evaluateOutbound`/`evaluateInbound`).
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
   - Redesigned Action Center (`dashboard.js` + scoped `dashboard.css`) with full header hierarchy (`CRITICAL`, `AT RISK`, `ACTIVE SIGNALS`, `Clear All`), `ALL CLEAR` only when zero signals are active, comfortable desktop typography (`13.5px` headlines, `11.8px` rows, `32px` controls), campaign pills, explicit **`WHAT HAPPENED` / `WHY IT MATTERS` / `ACTION REQUIRED`** separation, and consistent icons (`🎯 FOCUS`, `↻ REFRESH`, `📋 VIEW QUEUE`, `✓ NOTED`, `✕ DISMISS`).
5. **Dynamic One-Click WhatsApp Copy Controls & Stale-Overwrite Protection (`helpers.js` + `dashboard.js` + `content.js` + `intelligence.js`):**
   - Added `CT.resolveAuthoritativeAssignedFilterCopy`, `CT.resolveAuthoritativeTransitionCopy`, and `CT.writeTextToClipboard` in `helpers.js` (`East2` & `East3`), plus stale timestamp overwrite guards across `content.js` (`verified_campaign_filters_v1`, `live_filters_inventory_v1`), `intelligence.js` (`filterBaselines`), and `dashboard.js` (`reconcileCampaignsWithVerifiedRegistry`).
   - Added `[data-ref="copyAssignedFilterBtn"]` inside Assigned Live Filter Card 1 resolving live at click time strictly via immutable numeric Campaign ID → numeric Filter ID → Live Filter Inventory `items[filterId].count` (never substituting Campaign Lead Pool, Total Matching Contacts, or truncated names) in exact format `LIVE FILTER\n[Full Live Filter Name]\nAVAILABLE LEADS: [Verified Available Contacts]`.
   - Added separate `[data-ref="copyTransitionBtn"]` beside Latest Targeting Transition resolving strictly `FROM: [Previous Live Filter Name]\nTO: [New Live Filter Name]` (no counts/timestamps/metrics) and disabling with `NO VERIFIED TRANSITION` whenever no verified prior filter swap exists.
6. **Cross-Tab Storage Synchronization (`dashboard.js` `onStorage` & `content.js`):**
   - Synchronized `ct_east*_operating_campaigns`, `ct_east*_operating_campaign`, `CONTACT_THRESHOLD_KEY`, `DISMISSED_ALERTS_KEY`, `PERSISTENT_GOAL_ALERTS_KEY`, `ACKNOWLEDGED_GOAL_ALERTS_KEY`, `VERIFIED_FILTERS_KEY`, `LIVE_FILTERS_INVENTORY_KEY`, and `PREFIX + "live_filter_change_history_v1"` across concurrent CallTools tabs without manual refresh.

---

## 4. Automated Verification Results (Final Build)

| Check | Result | Scope |
| --- | --- | --- |
| `node --check` (`src/*.js` & `dist/src/*.js`) | `24/24` passed | All JS modules in EAST-2 and EAST-3 |
| Cross-dialer & CSS/network security scan | `0` violations | Zero cross-dialer strings, zero `.click(`/fetch/XHR/WS in `content.js`/`ng_bridge.js` |
| Root regression suite (`tests/suite.test.js`) | `47/47` passed (`fail 0`) | Core shared modules & security invariants |
| EAST-2 suite (`tests/suite.test.js`) | `343/343` passed (`fail 0`) | Parser, intelligence, dashboard, content, `dist/` parity, simulation (`UPGRADE 338`), alerts & isolation (`UPGRADE 339-340`), WhatsApp copy & stale guards (`UPGRADE 341-342`), cross-tab storage sync & Alert Center rule audit (`UPGRADE 343`) |
| EAST-3 suite (`tests/suite.test.js`) | `343/343` passed (`fail 0`) | Parser, intelligence, dashboard, content, `dist/` parity, simulation (`UPGRADE 338`), alerts & isolation (`UPGRADE 339-340`), WhatsApp copy & stale guards (`UPGRADE 341-342`), cross-tab storage sync & Alert Center rule audit (`UPGRADE 343`) |
| ZIP ↔ `dist/` SHA-256 verification | `8/8` files exact match per dialer | Both `releases/v11.3.9/` and `RELEASE_PACKAGES/` ZIPs |

**Total Automated Tests Passed:** `733 / 733` (`0` failed, `0` skipped).

---

## 5. Git & Legacy Repository Reconciliation

- Reconciled legacy clone `C:\Users\Orange Carrot\Documents\GitHub\ct-operations-monitor-pro` against canonical upstream `https://github.com/satishbiradar127-hue/ct-operations-monitor-pro.git` without discarding work or force-pushing:
  - Archived the 6 legacy uncommitted/untracked working-tree items (legacy v9 `content.js`/`dashboard.css`/`dashboard.js` edits, `Risk Monitor v2`, `helpers.zip`, `ct-operations-monitor-pro-BACKUP-2026-08-20/`) to `C:\Users\Orange Carrot\Documents\GitHub\ct-operations-monitor-pro-LEGACY-PENDING-ARCHIVE-2026-08-20\` and committed the tracked legacy edits onto branch `archive/legacy-pending-aug-2026` (`7427caf`).
  - Synchronized `main` cleanly (`working tree clean`) with canonical repository commits and pushed updates via standard fast-forward push.

---

## 6. Live Browser Verification & Honest Blockers

### A. EAST-3 Live Authenticated Production Verification (Brave Profile 2, CDP `127.0.0.1:9222` — Re-verified on Final Package `ae817d81a89d9f1e83962d57ef23e8a4a2d4f2c6018adf85ea030ceb3ebee33c`)
- **Extension:** `mmbceflgijbjeepkphiplhmclidhmhjn` v`11.3.9`, `state: "ENABLED"`, `runtimeErrors: []`, `manifestErrors: []`, `PAGE_ERRORS: []`.
- **Live Production Filter Swap & Alert Center:** Automatically detected genuine production targeting swap on `TS FRESH DATA` (`#1716`) at `4:29:12 PM` from `#4721` (`TS BLEND Hilton 2nd + 3 small lists 11/10`) → `#4677` (`TS ALL agent connects NP NP burst 11/10`), rendering `1 CRITICAL · 0 AT RISK · 1 ACTIVE SIGNAL` (`LIVE FILTER CHANGED on TS FRESH DATA (#1716)`) with `13.5px` headline, `11.8px` separated `WHAT HAPPENED` / `WHY IT MATTERS` / `ACTION REQUIRED` rows, `32px` controls, and working `🎯 FOCUS` / `✕ DISMISS` buttons. Steady state prior to the production swap verified `EAST-3 · ALL CLEAR` (`0 CRITICAL · 0 AT RISK · 0 ACTIVE SIGNALS`).
- **One-Click Assigned Filter WhatsApp Copy (`#1716` → Filter `#4677`):** Real CDP mouse click on `[data-ref="copyAssignedFilterBtn"]` wrote to system clipboard cleanly (`"LIVE FILTER\r\nTS ALL agent connects NP NP burst 11/10\r\nAVAILABLE LEADS: 5,052"`, resolving Live Filter Inventory `5,052` distinctly from Campaign Pool `5,029` and Total Matching Contacts `5,053`) with `✓ COPIED` UI feedback.
- **One-Click Transition WhatsApp Copy:** Real CDP mouse click on `[data-ref="copyTransitionBtn"]` wrote `"FROM: TS BLEND Hilton 2nd + 3 small lists 11/10\r\nTO: TS ALL agent connects NP NP burst 11/10"` with `✓ COPIED` feedback (zero counts/timestamps).
- **Unavailable / Clipboard Failure / No-Transition / Multi-Campaign Edge Cases:** Verified CDP `clipboard-write` denied (`COPY FAILED`), temporary cleared inventory `count` (`UNAVAILABLE` without inventing a count), `#1629` (`RES CRED MAIN`, 0 transitions -> disabled `NO VERIFIED TRANSITION`), `0` selected (`headerCamp: "—"`, `Unavailable`), `#1717` (`TS FIRE DATA`), and unavailable ID `"999999"` (`headerCamp: "—"`).
- **Cross-Tab Synchronization Without Reload (`verify_crosstab_sync.js`):** With two simultaneous `/manager/campaigns` tabs open on `east-3.calltools.io`, toggling `#1717` ON/OFF and raising/restoring Lead Alert threshold (`2000` → `999999` → `2000`) in Tab B updated Tab A immediately (`navTimeOrigin` unchanged across checks).
- **Realtime, Plan B, Operating, Refresh Data & Persistence (`verify_all_three_closure.js`):** Verified live dialing sync (`36` filters: `21` active / `15` inactive, `hasDeletedGhost: false`), 22s Plan B route rotation (`/manager/live-filters` ↔ `/manager/campaigns/edit/1716` ↔ `/edit/1717`) with `inboundLive: true` across all 11 ticks, all 3 Operating button surfaces, async `Refresh Data` (`4729ms`, `29` records across `campaigns: 3`, `liveFilters: 25`, `campaignEdit: "1716"`, `inboundQueues: 1`), and full `Page.reload` persistence (`["1716"]`, `LIVE (14S AGO)` -> `0s`, `4,612` callable/available vs `4,718` total matches, inbound `LIVE · automatic native Queue feed`).

### B. Simultaneous Dual-Site Isolation & Live EAST-2 Authentication Boundary
- **Isolated Simultaneous Browser Verification (Brave CDP `127.0.0.1:9225` — Final Rebuilt Packages):** Loaded unpacked `CT_Operations_Monitor_East2\dist` (`odbhfepdmhhngjcmbidojcbnmobhjhcc`) and `CT_Operations_Monitor_East3\dist` (`jjbpgdmpippgffhhabjckehpgdabfknb`) side-by-side (`v11.3.9`, both `ENABLED`, `runtimeErrors: []`, `manifestErrors: []`), navigated simultaneously to `https://east-2.calltools.io/manager/campaigns` and `https://east-3.calltools.io/manager/campaigns`, and confirmed `0` cross-dialer DOM/attribute/global/storage leakage and `0` runtime/manifest errors.
- **Live Authenticated EAST-2 Blocker:** Verified live in Brave Profile 2 (`127.0.0.1:9222`) that `https://east-2.calltools.io/manager/campaigns` redirects to `/login` (`hasPassword: true`), and verified via Win32 process & listening TCP port checks that Google Chrome `Profile 20` (`PID 12552`, unpacked extension `cimaihkehebfcejdkkinilegdlmpaejm` pointing directly to `CT_Operations_Monitor_East2`) runs without `--remote-debugging-port` (`DevToolsActivePort` absent). Per strict non-bypass constraints, no credential extraction or browser process termination was attempted.

---

## 7. Conditional Version Lock Status

- **Release Lock Decision:** **NOT LOCKED (HELD ON CONDITIONAL GATE)**
- **Reason:** All **EAST-2 + EAST-3** automated checks (`733 / 733`), JS syntax (`24 / 24`), package/ZIP byte-for-byte parity (`8/8` per dialer), isolated simultaneous dual-install verification (`127.0.0.1:9225`), and full **EAST-3** live authenticated browser acceptance (`127.0.0.1:9222`) **PASS** on the final build (`East2` SHA-256 `6ea48718bac1f3b72ca2af181cfb9a9a8e12c2097778698e836e5c5b08c61321`; `East3` SHA-256 `ae817d81a89d9f1e83962d57ef23e8a4a2d4f2c6018adf85ea030ceb3ebee33c`). However, **live authenticated `east-2.calltools.io` browser acceptance in Chrome Profile 20** could not be directly executed due to the missing CDP debugging port on `PID 12552`, so `v11.3.9` is held unlocked pending live EAST-2 browser sign-off.
- **Unlock Condition:** Launch Chrome Profile 20 with remote debugging enabled (`--remote-debugging-port=9223`) or open an authenticated `east-2.calltools.io` session and confirm EAST-2 live realtime polling, Operating controls, Refresh Data, Alert Center, WhatsApp Copy, and zero EAST-3 overlap.
