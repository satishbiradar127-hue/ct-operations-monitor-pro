css_path = "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/dashboard.css"
with open(css_path, "r", encoding="utf-8") as f:
    css = f.read()

# 1. Ensure .ct-actions has overflow: visible !important
if ".ct-actions {" in css:
    css = re.sub(
        r'(\.ct-actions\s*\{[^}]*overflow-x:\s*auto\s*!important;[^}]*\})',
        r'.ct-actions {\n    display: flex !important;\n    flex-wrap: nowrap !important;\n    overflow: visible !important;\n    white-space: nowrap !important;\n    align-items: center !important;\n    gap: 6px !important;\n}',
        css
    )

# 2. Add styles for .ct-lft-panel and alert focus/dismiss buttons
lft_css = """
/* ==========================================================================
   LIVE FILTER TARGETING COMMAND CENTER (HIGH-VISIBILITY 6-CARD PANEL)
   ========================================================================== */
.ct-lft-panel {
    background: #0b1120 !important;
    border: 1px solid rgba(56, 189, 248, 0.35) !important;
    border-radius: 8px !important;
    margin: 8px 0 14px 0 !important;
    padding: 12px 14px !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
}

.ct-lft-header {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    flex-wrap: wrap !important;
    gap: 10px !important;
    padding-bottom: 10px !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07) !important;
    margin-bottom: 10px !important;
}

.ct-lft-header-left, .ct-lft-header-right {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    flex-wrap: wrap !important;
}

.ct-lft-title-tag {
    font-size: 10.5px !important;
    font-weight: 900 !important;
    letter-spacing: 0.6px !important;
    color: #38bdf8 !important;
    background: rgba(56, 189, 248, 0.14) !important;
    border: 1px solid rgba(56, 189, 248, 0.35) !important;
    padding: 3px 8px !important;
    border-radius: 4px !important;
    text-transform: uppercase !important;
}

.ct-lft-dialer-pill {
    font-size: 9.5px !important;
    font-weight: 800 !important;
    color: #94a3b8 !important;
    background: rgba(255, 255, 255, 0.06) !important;
    border: 1px solid rgba(255, 255, 255, 0.12) !important;
    padding: 2px 7px !important;
    border-radius: 4px !important;
}

.ct-lft-campaign-title {
    font-size: 13px !important;
    font-weight: 850 !important;
    color: #f8fafc !important;
    letter-spacing: -0.2px !important;
}

.ct-lft-verify-badge {
    font-size: 10px !important;
    font-weight: 800 !important;
    padding: 3px 9px !important;
    border-radius: 4px !important;
    letter-spacing: 0.4px !important;
    text-transform: uppercase !important;
}
.ct-lft-verify-badge.is-verified {
    background: rgba(34, 197, 94, 0.16) !important;
    color: #4ade80 !important;
    border: 1px solid rgba(34, 197, 94, 0.4) !important;
}
.ct-lft-verify-badge.is-unverified {
    background: rgba(245, 158, 11, 0.16) !important;
    color: #fbbf24 !important;
    border: 1px solid rgba(245, 158, 11, 0.4) !important;
}
.ct-lft-verify-badge.is-unavailable {
    background: rgba(148, 163, 184, 0.12) !important;
    color: #94a3b8 !important;
    border: 1px solid rgba(148, 163, 184, 0.25) !important;
}

.ct-lft-source-pill {
    font-size: 10px !important;
    font-weight: 700 !important;
    color: #94a3b8 !important;
    background: rgba(15, 23, 42, 0.6) !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    padding: 2px 8px !important;
    border-radius: 4px !important;
}

/* 6-Card Grid */
.ct-lft-cards-grid {
    display: grid !important;
    grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
    gap: 10px !important;
    margin-bottom: 10px !important;
}

@media (max-width: 1300px) {
    .ct-lft-cards-grid {
        grid-template-columns: repeat(3, 1fr) !important;
    }
}

@media (max-width: 800px) {
    .ct-lft-cards-grid {
        grid-template-columns: repeat(2, 1fr) !important;
    }
}

.ct-lft-card {
    background: rgba(15, 23, 42, 0.7) !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    border-radius: 6px !important;
    padding: 10px 12px !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: space-between !important;
    min-height: 82px !important;
    transition: border-color 0.15s ease, background-color 0.15s ease !important;
}
.ct-lft-card:hover {
    border-color: rgba(56, 189, 248, 0.3) !important;
    background: rgba(15, 23, 42, 0.9) !important;
}

.ct-lft-card-eyebrow {
    font-size: 8.5px !important;
    font-weight: 850 !important;
    letter-spacing: 0.6px !important;
    color: #94a3b8 !important;
    text-transform: uppercase !important;
    margin-bottom: 4px !important;
}

.ct-lft-card-primary {
    font-size: 15px !important;
    font-weight: 850 !important;
    color: #f8fafc !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
    line-height: 1.2 !important;
    word-break: break-word !important;
}

.ct-lft-card-meta {
    font-size: 10px !important;
    color: #64748b !important;
    margin-top: 6px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 4px !important;
}

.ct-lft-card-filter .ct-lft-card-primary {
    color: #34d399 !important;
    font-size: 13.5px !important;
}

.ct-lft-pool-val {
    color: #38bdf8 !important;
}

.ct-lft-avail-val {
    color: #60a5fa !important;
}

.ct-lft-match-val {
    color: #c084fc !important;
}

.ct-lft-status-pill {
    font-size: 9px !important;
    font-weight: 800 !important;
    padding: 1px 5px !important;
    border-radius: 3px !important;
    text-transform: uppercase !important;
}
.ct-lft-status-pill.is-assigned {
    background: rgba(34, 197, 94, 0.15) !important;
    color: #4ade80 !important;
    border: 1px solid rgba(34, 197, 94, 0.3) !important;
}
.ct-lft-status-pill.is-unassigned, .ct-lft-status-pill.is-unavailable {
    background: rgba(148, 163, 184, 0.12) !important;
    color: #94a3b8 !important;
    border: 1px solid rgba(148, 163, 184, 0.25) !important;
}

.ct-lft-card-id {
    font-size: 9.5px !important;
    color: #94a3b8 !important;
    font-family: ui-monospace, Consolas, monospace !important;
}

.ct-lft-source-tag {
    font-size: 9.5px !important;
    color: #94a3b8 !important;
}

.ct-lft-card-time, .ct-lft-card-age {
    font-size: 9.5px !important;
    color: #64748b !important;
    font-family: ui-monospace, Consolas, monospace !important;
}

.ct-lft-match-note {
    font-size: 9px !important;
    color: #64748b !important;
}

.ct-lft-freshness-val.is-live {
    color: #4ade80 !important;
}
.ct-lft-freshness-val.is-recent {
    color: #38bdf8 !important;
}
.ct-lft-freshness-val.is-stale {
    color: #f87171 !important;
}
.ct-lft-freshness-val.is-waiting {
    color: #94a3b8 !important;
}

/* Latest Verified Targeting Transition Bar */
.ct-lft-transition-bar {
    background: rgba(15, 23, 42, 0.85) !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    border-radius: 6px !important;
    padding: 7px 12px !important;
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
    flex-wrap: wrap !important;
    font-size: 11px !important;
}

.ct-lft-transition-label {
    font-size: 9px !important;
    font-weight: 850 !important;
    letter-spacing: 0.6px !important;
    color: #94a3b8 !important;
    text-transform: uppercase !important;
    white-space: nowrap !important;
}

.ct-lft-transition-content {
    font-size: 11px !important;
    color: #e2e8f0 !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    flex-wrap: wrap !important;
}

.ct-lft-change-campaign {
    font-weight: 750 !important;
    color: #38bdf8 !important;
}

.ct-lft-change-time {
    color: #94a3b8 !important;
    font-size: 10px !important;
}

.ct-lfi-footer-grid.ct-lfi-health-only {
    grid-template-columns: 1fr !important;
}

.ct-operating-option-id {
    display: inline-block !important;
    font-size: 9px !important;
    font-weight: 800 !important;
    color: #38bdf8 !important;
    background: rgba(56, 189, 248, 0.15) !important;
    border: 1px solid rgba(56, 189, 248, 0.3) !important;
    border-radius: 3px !important;
    padding: 1px 4px !important;
    margin-left: 4px !important;
    font-family: ui-monospace, Consolas, monospace !important;
}

.ct-actions {
    overflow: visible !important;
}

.ct-operating-wrap {
    position: relative !important;
    z-index: 500 !important;
}

.ct-operating-menu {
    position: absolute !important;
    top: calc(100% + 6px) !important;
    left: 0 !important;
    min-width: 380px !important;
    max-width: 500px !important;
    max-height: min(440px, 75vh) !important;
    background: #0b1120 !important;
    border: 1px solid rgba(56, 189, 248, 0.4) !important;
    border-radius: 8px !important;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.08) !important;
    padding: 10px !important;
    z-index: 100000 !important;
}
"""

if ".ct-lft-panel" not in css:
    css += "\n" + lft_css
    print("Appended .ct-lft-panel and command center styles")

with open(css_path, "w", encoding="utf-8") as f:
    f.write(css)
print("Updated dashboard.css successfully!")
