# CT OPERATIONS MONITOR PRO — FINAL RELEASE MANIFEST
## Production Package Verification, Cryptographic Checksums & Deployment Manifest

**Project:** CT Operations Monitor Pro — Dual Dialer  
**Release Version:** v11.3.4  
**Dialers Supported:** EAST-2 (`https://east-2.calltools.io`) and EAST-3 (`https://east-3.calltools.io`)  
**Build Status:** 100% Verified, Clean Syntax, 235/235 Unit Tests Passed, 20/20 Refresh Tests Passed  
**Release Date:** November 2026  

---

## 1. RELEASE PACKAGES & CRYPTOGRAPHIC CHECKSUMS

All release archives have been packaged directly from the verified distribution folders and hashed with SHA-256:

| Package File | Target Dialer | Package Size | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| **`CT_Operations_Monitor_East2_v11.3.4.zip`** | EAST-2 (`east-2.calltools.io`) | 124,554 bytes | `381295b003a1d7f60125d9a0ee9cf77dc1506f945d8f7857fe974cd67d95ec12` |
| **`CT_Operations_Monitor_East2.zip`** | EAST-2 (Latest Release Alias) | 124,554 bytes | `381295b003a1d7f60125d9a0ee9cf77dc1506f945d8f7857fe974cd67d95ec12` |
| **`CT_Operations_Monitor_East3_v11.3.4.zip`** | EAST-3 (`east-3.calltools.io`) | 124,556 bytes | `2dfd0230a73cfcf835c8c7493c9a57dbe961ca9ca10d8190c07c92fef3eed3a0` |
| **`CT_Operations_Monitor_East3.zip`** | EAST-3 (Latest Release Alias) | 124,556 bytes | `2dfd0230a73cfcf835c8c7493c9a57dbe961ca9ca10d8190c07c92fef3eed3a0` |

---

## 2. MANIFEST SPECIFICATIONS (MANIFEST V3)

### 2.1 EAST-2 Manifest Configuration
```json
{
  "manifest_version": 3,
  "name": "CT Operations Monitor — East-2",
  "version": "11.3.4",
  "description": "CallTools Operations Monitor Pro (East-2 Edition) — unified outbound Campaigns + inbound Queue command center with persistent Sales/Goals alerts, native Queue DOM bridge, and CT Data Change Intelligence Engine.",
  "permissions": [
    "storage"
  ],
  "host_permissions": [
    "https://east-2.calltools.io/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://east-2.calltools.io/manager/campaigns*",
        "https://east-2.calltools.io/manager/queues*",
        "https://east-2.calltools.io/manager/live-filters*"
      ],
      "js": [
        "src/helpers.js",
        "src/parser.js",
        "src/intelligence.js",
        "src/dashboard.js",
        "src/content.js"
      ],
      "css": [
        "src/dashboard.css"
      ],
      "all_frames": true
    }
  ]
}
```

### 2.2 EAST-3 Manifest Configuration
```json
{
  "manifest_version": 3,
  "name": "CT Operations Monitor — East-3",
  "version": "11.3.4",
  "description": "CallTools Operations Monitor Pro (East-3 Edition) — unified outbound Campaigns + inbound Queue command center with persistent Sales/Goals alerts, native Queue DOM bridge, and CT Data Change Intelligence Engine.",
  "permissions": [
    "storage"
  ],
  "host_permissions": [
    "https://east-3.calltools.io/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://east-3.calltools.io/manager/campaigns*",
        "https://east-3.calltools.io/manager/queues*",
        "https://east-3.calltools.io/manager/live-filters*"
      ],
      "js": [
        "src/helpers.js",
        "src/parser.js",
        "src/intelligence.js",
        "src/dashboard.js",
        "src/content.js"
      ],
      "css": [
        "src/dashboard.css"
      ],
      "all_frames": true
    }
  ]
}
```

---

## 3. FILE SYSTEM & PACKAGE DIRECTORY STRUCTURE

```
CT_OPERATIONS_DUAL_DIALER_RELEASE/
├── CT_Operations_Monitor_East2/
│   ├── manifest.json (v11.3.4)
│   ├── SHA256SUMS.txt
│   ├── CT_Operations_Monitor_East2_v11.3.4.zip
│   ├── src/
│   │   ├── helpers.js
│   │   ├── parser.js
│   │   ├── intelligence.js
│   │   ├── dashboard.js
│   │   ├── content.js
│   │   └── dashboard.css
│   ├── dist/ (Identical verified distribution mirror)
│   └── tests/
│       ├── mock_dom.js
│       └── suite.test.js (235 tests)
├── CT_Operations_Monitor_East3/
│   ├── manifest.json (v11.3.4)
│   ├── SHA256SUMS.txt
│   ├── CT_Operations_Monitor_East3_v11.3.4.zip
│   ├── src/
│   │   ├── helpers.js
│   │   ├── parser.js
│   │   ├── intelligence.js
│   │   ├── dashboard.js
│   │   ├── content.js
│   │   └── dashboard.css
│   ├── dist/
│   └── tests/
│       ├── mock_dom.js
│       └── suite.test.js (235 tests)
├── RELEASE_PACKAGES/
│   ├── CT_Operations_Monitor_East2.zip
│   ├── CT_Operations_Monitor_East2_v11.3.4.zip
│   ├── CT_Operations_Monitor_East3.zip
│   ├── CT_Operations_Monitor_East3_v11.3.4.zip
│   └── SHA256SUMS.txt
└── QA_REPORTS/
    ├── FINAL_DASHBOARD_FORENSIC_INVESTIGATION.md
    ├── LIVE_FILTER_INTELLIGENCE_DATA_ACCURACY_REPORT.md
    ├── REFRESH_AND_REALTIME_OBSERVATION_VALIDATION.md
    ├── DASHBOARD_METRIC_DICTIONARY.md
    ├── COMPLETE_DUAL_DIALER_ACCEPTANCE_REPORT.md
    ├── FINAL_RELEASE_MANIFEST.md
    ├── EAST2_TEST_RESULTS.txt (235 / 235 passed)
    ├── EAST3_TEST_RESULTS.txt (235 / 235 passed)
    └── REFRESH_CONSISTENCY_10X_REPORT.md (20 / 20 passed)
```

---

## 4. VERIFIED BROWSER DEPLOYMENT INSTRUCTIONS

The unpacked releases are directly mapped to the operator's active browser profiles:
1. **EAST-2 in Chrome Profile 20:**
   - Unpacked Path: `C:\Users\Orange Carrot\Downloads\CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL\CT_OPERATIONS_DUAL_DIALER_RELEASE\CT_Operations_Monitor_East2`
   - Reload Command: Open `chrome://extensions` in Profile 20 and click the circular **Reload** icon on "CT Operations Monitor — East-2".
2. **EAST-3 in Brave Profile 2:**
   - Unpacked Path: `C:\Users\Orange Carrot\Downloads\CT_Operations_Monitor_Pro_v11.1.53_BALANCED_FINAL\CT_OPERATIONS_DUAL_DIALER_RELEASE\CT_Operations_Monitor_East3`
   - Reload Command: Open `brave://extensions` in Profile 2 and click the circular **Reload** icon on "CT Operations Monitor — East-3".
