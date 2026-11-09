# DUAL-DIALER REAL BROWSER ACCEPTANCE — CT OPERATIONS MONITOR PRO v11.3.8

## 1. SCOPE & DEPLOYMENT ARCHITECTURE
- **Dialer EAST-2:** Chrome Profile 20 (`https://east-2.calltools.io`)  
  Loaded from: `CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2`
- **Dialer EAST-3:** Brave Profile 2 (`https://east-3.calltools.io`)  
  Loaded from: `CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3`

## 2. REAL-BROWSER ACCEPTANCE PROTOCOL

### A. Operating Campaign Selection
1. Open `https://east-3.calltools.io/manager/campaigns` in Brave Profile 2.
2. Click the `OPERATING CAMPAIGNS` button in the header toolbar.
3. Click a campaign checkbox: verify it selects on the first click without closing the menu.
4. Click `All`: verify all visible campaigns are selected.
5. Click `Clear`: verify all campaigns are deselected, and aggregate metrics return to displaying all active operational campaigns.
6. Scroll the dropdown list down: verify background data polls do not reset scroll position.

### B. Live Filter Authoritative Observation
1. In Tab 2, keep `https://east-3.calltools.io/manager/campaigns` open.
2. In Tab 3, open `https://east-3.calltools.io/manager/campaigns/edit/1716` (`TS FRESH DATA`).
3. Verify the native CallTools Live Filter field displays `TS FRESH DATA - 4 ATT 5 or Less Consecutive No C...`.
4. Return to Tab 2:
   - The top panel immediately reflects `Filter: TS FRESH DATA - 4 ATT 5 or Less Consecutive No Contact Attempts`.
   - Card 5 shows `VERIFIED` (`Edit Page DOM`).
   - Header badge shows `TARGETING: VERIFIED` in green while within 120 seconds.
   - After 120 seconds, badge automatically switches to `TARGETING: STALE` in amber.

### C. Action Center Alerts & Clear All
1. Verify all alerts display high-contrast cards.
2. Click `FOCUS`: scrolls smoothly to the matching campaign in the table.
3. Click `DISMISS`: immediately removes the operational alert.
4. Click `NOTED` on a Sales Goal alert: records the milestone in persistent storage and dismisses the alert.
5. Click `Clear All`: dismisses all operational alerts while strictly preserving unacknowledged Goal Alerts.

### D. Visual Command Center Polish
1. Zoom to 90% and 100%: verify table columns, headers, and metric cards align without horizontal overflow or clipping.
2. Verify `Data Health & Provenance` is completely removed from the dashboard.
