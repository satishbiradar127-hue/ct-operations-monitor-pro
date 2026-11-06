# Installation & Quick Start Guide — CT Operations Monitor Pro (EAST-3)
**Edition:** EAST-3 Dedicated Production Build  
**Version:** 11.3.3  
**Target Host:** `https://east-3.calltools.io/manager/campaigns`  
**Storage Namespace:** `ct_east3_*`  
**Event Channel:** `CT_EAST_3_*`

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
   C:\Users\Orange Carrot\Downloads\CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL\CT_OPERATIONS_DUAL_DIALER_RELEASE\CT_Operations_Monitor_East3\dist
   ```
6. Confirm the extension is loaded as:
   - **Name:** `CT Operations Monitor Pro — East-3`
   - **Version:** `11.3.3`
   - **Host Permission:** `https://east-3.calltools.io/*`

---

## 3. Operational Verification

1. Navigate to: `https://east-3.calltools.io/manager/campaigns`
2. The dashboard will mount automatically above the CallTools campaigns table.
3. Observe:
   - **Two-Column Balance:** Outbound KPI & table on LEFT (50%), Inbound Queues on RIGHT (50%).
   - **Toolbar:** All controls fit on a single horizontal row without wrapping (Reset button is on the single row).
   - **Feed Status:** Displays `CONNECTING` briefly on mount, then transitions immediately to `LIVE` upon native row detection.
   - **Action Center:** Real-time intelligence monitoring for Sales, Goals, New Leads Added, Large Inventory Reductions, and Out of Leads alerts.
   - **Alert Acknowledgement:** Unacknowledged alerts persist across page reloads. Dismissing an alert requires clicking individual `[NOTED]`. "Clear All" does not erase active alerts.

---

## 4. Package Integrity

- **Zip File:** `CT_Operations_Monitor_East3_v11.3.3.zip`
- **SHA-256:** `2453da584d619aad2fb26e761b35905c65dbce0ba72d6b41e01e479f6334172c`
