# Installation & Quick Start Guide — CT Operations Monitor Pro (EAST-2)
**Edition:** EAST-2 Dedicated Production Build  
**Version:** 11.3.3  
**Target Host:** `https://east-2.calltools.io/manager/campaigns`  
**Storage Namespace:** `ct_east2_*`  
**Event Channel:** `CT_EAST_2_*`

---

## 1. Quick Launch (Automated)

You can launch both dialer sessions simultaneously with the included launcher script located in the parent directory:

```cmd
..\launch_dual_dialer_dev.bat
```
Or using PowerShell:
```powershell
..\launch_dual_dialer_dev.ps1
```

---

## 2. Manual Loading in Google Chrome (Developer Mode)

1. Open Google Chrome.
2. Navigate to `chrome://extensions/`.
3. Toggle the **Developer mode** switch in the top right corner to **ON**.
4. Click the **Load unpacked** button.
5. Select the `dist/` folder inside this directory:
   ```
   C:\Users\Orange Carrot\Downloads\CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL\CT_OPERATIONS_DUAL_DIALER_RELEASE\CT_Operations_Monitor_East2\dist
   ```
6. Confirm the extension is loaded as:
   - **Name:** `CT Operations Monitor Pro — East-2`
   - **Version:** `11.3.3`
   - **Host Permission:** `https://east-2.calltools.io/*`

---

## 3. Operational Verification

1. Navigate to: `https://east-2.calltools.io/manager/campaigns`
2. The dashboard will mount automatically above the CallTools campaigns table.
3. Observe:
   - **Two-Column Balance:** Outbound KPI & table on LEFT (50%), Inbound Queues on RIGHT (50%).
   - **Toolbar:** All controls fit on a single horizontal row without wrapping (Reset button is on the single row).
   - **Feed Status:** Displays `CONNECTING` briefly on mount, then transitions immediately to `LIVE` upon native row detection.
   - **Action Center:** Real-time intelligence monitoring for Sales, Goals, New Leads Added, Large Inventory Reductions, and Out of Leads alerts.
   - **Alert Acknowledgement:** Unacknowledged alerts persist across page reloads. Dismissing an alert requires clicking individual `[NOTED]`. "Clear All" does not erase active alerts.

---

## 4. Package Integrity

- **Zip File:** `CT_Operations_Monitor_East2_v11.3.3.zip`
- **SHA-256:** `cb496fdc07327e6c766fe1cb15702f9a33acb241433abd8b517a5dc6097616af`
