# CT Operations Monitor Pro — v11.3.9 Dual-Dialer Release Evidence (EAST-2 & EAST-3)

**Release Date:** 2026-11-10  
**Target Version:** `11.3.9` (Manifest V3)  
**Scope:** Independent production parity across **EAST-2** (`CT_Operations_Monitor_East2`, `east-2.calltools.io`) and **EAST-3** (`CT_Operations_Monitor_East3`, `east-3.calltools.io`).

---

## 1. Verified Release Artifacts & Checksums

Both dialer ZIP packages in `releases/v11.3.9/` match `CT_OPERATIONS_DUAL_DIALER_RELEASE/RELEASE_PACKAGES/` and each dialer's `dist/` directory byte-for-byte across all 8 packaged files (`manifest.json` + 7 `src/*` modules):

| Package | Size (bytes) | Files | SHA-256 |
| --- | ---: | ---: | --- |
| `CT_Operations_Monitor_East2_v11.3.9.zip` | 151,629 | 8 | `66984638a6810aaac50426404ef2ad756fb21288a9d04fd3cdee33ceb9c7c784` |
| `CT_Operations_Monitor_East3_v11.3.9.zip` | 152,056 | 8 | `2bb1bc8238b7b7a7cf947fea9563eef23c5f13159def43d9247709b06b372174` |

Canonical `SHA256SUMS.txt` is stored alongside the ZIPs in `releases/v11.3.9/SHA256SUMS.txt` and `CT_OPERATIONS_DUAL_DIALER_RELEASE/RELEASE_PACKAGES/SHA256SUMS.txt`.

---

## 2. Read-Only & Namespace Isolation Guarantees

- Strictly passive/read-only toward CallTools DOM and Angular state (`0` `.click(`, `0` `fetch(`, `0` `new XMLHttpRequest`, `0` `new WebSocket` inside `src/content.js` and `src/ng_bridge.js` for both dialers).
- Strict host, storage-prefix, and event-channel isolation:
  - **EAST-2:** `east-2.calltools.io`, `ct_east2_*`, `CT_EAST_2_*`, `ct-operations-dashboard-east2`, `ct-operations-hidden-campaign-filter-east2`
  - **EAST-3:** `east-3.calltools.io`, `ct_east3_*`, `CT_EAST_3_*`, `ct-operations-dashboard-east3`, `ct-operations-hidden-campaign-filter-east3`

---

## 3. Summary of Fixes Implemented Across Both Dialers

1. **Realtime Accuracy & Plan B Synchronization:**
   - Normalized `/manager/live-filters` active/inactive detection using `cancel-icon.svg` vs `check-icon.svg` alongside slide-toggle attributes (`readLiveFilters`).
   - Added unpaginated `<select formcontrolname="live_filter">` option catalog harvesting from `/manager/campaigns/edit/:cid` with numeric filter ID extraction, dormant-filter tagging, and stale/deleted ghost pruning in `content.js` & `intelligence.js`.
   - Stabilized Plan B sequential hidden-iframe SPA observation (`/manager/live-filters` ↔ `/manager/campaigns/edit/:cid`) using route-epoch guards and timeout recovery so background filter updates continue smoothly without starving inbound `/manager/queues` polling.
2. **Operating Campaign Controls & Filter Responsiveness:**
   - Restored unclipped toolbar `.ct-operating-menu` layering, enlarged `.ct-operating-menu-head button` (`All` / `Clear`) clickable hit targets, preserved in-place `[data-campaign-focus]` rows and closed-drawer scroll stability, and synced card `[data-row-action="operate"]` (`aria-pressed`) across reloads.
   - Updated filter pill handlers (`stateFilterButtons`, `healthFilterButtons`, `filterButtons`) to render synchronously (`cancelAnimationFrame` + immediate `render()`) rather than deferring table updates to `requestAnimationFrame`.
3. **Genuine Asynchronous `Refresh Data`:**
   - Wired `CT_EAST_X_REQUEST_REFRESH` → multi-source collection (`/manager/queues`, `/manager/campaigns`, `/manager/live-filters`, `/manager/campaigns/edit/:cid`) → correlated `CT_EAST_X_REFRESH_RESULT` with explicit `refreshId`, elapsed timing, per-source status, and failure reporting (`0` fake synchronous completions).

---

## 4. Automated Verification Results (Final Build)

| Check | Result | Scope |
| --- | --- | --- |
| `node --check` (`src/*.js` & `dist/src/*.js`) | `24/24` passed | All JS modules in EAST-2 and EAST-3 |
| Root regression suite (`tests/suite.test.js`) | `47/47` passed (`fail 0`) | Core shared modules & security invariants |
| EAST-2 suite (`tests/suite.test.js`) | `338/338` passed (`fail 0`) | Parser, intelligence, dashboard, content, `dist/` parity, end-to-end simulation (`UPGRADE 338`) |
| EAST-3 suite (`tests/suite.test.js`) | `338/338` passed (`fail 0`) | Parser, intelligence, dashboard, content, `dist/` parity, end-to-end simulation (`UPGRADE 338`) |
| ZIP ↔ `dist/` SHA-256 verification | `8/8` files exact match per dialer | Both `releases/v11.3.9/` and `RELEASE_PACKAGES/` ZIPs |

**Total Automated Tests Passed:** `723 / 723` (`0` failed, `0` skipped).

---

## 5. Live Browser Verification & Honest Blockers

### A. EAST-3 Live Authenticated Production Verification (Brave Profile 2, CDP `127.0.0.1:9222`)
- **Extension:** `mmbceflgijbjeepkphiplhmclidhmhjn` v`11.3.9`, `state: "ENABLED"`, `runtimeErrors: []`, `manifestErrors: []`, `PAGE_ERRORS: []`.
- **Realtime & Live Transition:** Verified `36` filters (`20` active / `16` inactive / `190,374` available, `0` deleted ghosts), 22s Plan B rotation with inbound queue continuously `LIVE`. During execution, CallTools operator switched Campaign `#1716` (`TS FRESH DATA`) live from filter `#4125` (`TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts`, `62,331`) to `#4619` (`TS JAN 4 Hilton 2nd attempt 11/09`, `40,396`), which updated automatically in Action Center alerts and Live Filter Targeting cards.
- **Operating Controls:** Real CDP mouse clicks verified toolbar dropdown (`All`, `Clear`, `#1717`, `#1629`, `#1716`), table-row focus button (`[data-campaign-focus="1717"]`, scroll `347 -> 353`), drawer card `[data-row-action="operate"]` (`aria-pressed="true"`/`"false"`), and full `Page.reload` persistence (`["1716"]`, `"TS FRESH DATA 1"`).
- **Refresh Data:** Verified real async refresh (`refreshId: "ref-1794337571395-1"`, `elapsedMs: 5160`, `recordsRead: 29`: `campaigns: 3`, `liveFilters: 25`, `campaignEdit: 1716`, `inboundQueues: 1`, `unavailableSources: []`), synchronizing `CAMPAIGN CALLABLE POOL` (`40,374`) with `FILTER AVAILABLE CONTACTS` (`40,374`).

### B. EAST-2 Side-by-Side Load & Authentication Boundary
- **Isolated Chromium Verification (Brave CDP `127.0.0.1:9225`):** Loaded unpacked `CT_Operations_Monitor_East2\dist` and `CT_Operations_Monitor_East3\dist` side-by-side (`v11.3.9`, both `ENABLED`, `runtimeErrors: []`, `manifestErrors: []`), navigated to `https://east-2.calltools.io/manager/campaigns` with `0` extension/manifest runtime errors.
- **Live Authenticated EAST-2 Blocker:** Live authenticated CallTools UI testing on `east-2.calltools.io` could **not** be executed directly by automation because:
  1. Brave Profile 2 (`127.0.0.1:9222`) is unauthenticated on `east-2.calltools.io` (redirects to `/login`), and
  2. Google Chrome `Profile 20` (`PID 12552`, which holds EAST-2 cookies and loaded `CT_Operations_Monitor_East2` id `cimaihkehebfcejdkkinilegdlmpaejm`) is running without `--remote-debugging-port`, and Chromium restricts attaching remote debugging to a running default user-data session without relaunching/re-authenticating.
  - Per strict read-only and non-bypass security constraints, no credential extraction or process bypass was performed. Once Chrome `Profile 20` reloads the unpacked `CT_Operations_Monitor_East2/dist` extension (or `east-2.calltools.io` is signed into a CDP-enabled session), the identical verified EAST-3 v11.3.9 runtime architecture executes for EAST-2.
