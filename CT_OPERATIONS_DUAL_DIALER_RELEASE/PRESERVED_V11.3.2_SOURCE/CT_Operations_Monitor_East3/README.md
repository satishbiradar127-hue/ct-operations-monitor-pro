# CT Operations Monitor — East-3
**Version:** 11.2.0  
**Dialer Context:** EAST-3  
**Allowed Host:** `https://east-3.calltools.io/*`  
**Storage Namespace:** `ct_east3_*`

## Architecture & Operational Safety
CallTools is strictly **READ-ONLY**.
- The extension exclusively observes and reads native CallTools DOM data.
- Never mutates campaigns, queues, dispositions, agents, or settings.
- Never triggers calls, clicks native operational controls, or calls undocumented APIs.
- Dashboard controls affect presentation and extension storage only.

## Key Features & Verified Repairs
1. **Persistent Sales / Goals Alerts**:
   - Detects increases in actual Sales or Goals on Outbound Campaigns and Inbound Queues.
   - Immediate prominent notification displaying Dialer (EAST-3), Direction, Target Name, Metric, Previous, Current, Increase, and Detection Timestamp.
   - **NEVER AUTO-DISMISSED**: Persists across refreshes, tab changes, restarts, and Action Center "Clear All". Only dismissed when the operator clicks **NOTED**.
2. **Inbound Queue Detail Native Order**:
   - Strictly preserves native CallTools Queue table row order without artificial re-sorting.
3. **Inbound Stale Feed Flapping Resolved**:
   - 15-second heartbeat stale threshold tolerates 5-second background feed throttle with complete stability.
4. **Outbound Focus Section B Integrity**:
   - Missing campaign agent metrics remain safely unexposed (`—`) rather than coerced to `0`.
5. **Compact Inbound Settings Panel**:
   - Inbound header includes a compact settings menu to toggle archived queue visibility and customize wait alert thresholds.
6. **Strict Host & Storage Isolation**:
   - Bound specifically to `east-3.calltools.io` with complete namespace isolation (`ct_east3_`).

## Installation
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the upper right.
3. Click **Load unpacked** and select this directory (or the `dist/` subfolder).
4. Navigate to `https://east-3.calltools.io/manager/campaigns` or `https://east-3.calltools.io/manager/queues`.
