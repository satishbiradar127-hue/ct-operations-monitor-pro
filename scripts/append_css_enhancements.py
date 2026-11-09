css_additions = """
/* === ULTRA-LEVEL COMMAND CENTER ENHANCEMENTS === */
@keyframes ct-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
.ct-header-refresh.is-refreshing, .ct-refresh-btn.is-refreshing {
    opacity: 0.75;
    pointer-events: none;
    cursor: wait;
}
.ct-header-refresh.is-refreshing {
    animation: ct-spin 0.75s linear infinite;
    display: inline-block;
}
.ct-dialer-tag.ct-dialer-east2 {
    background: #1d4ed8 !important;
    color: #eff6ff !important;
    border: 1px solid #3b82f6 !important;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 800;
    letter-spacing: 0.05em;
}
.ct-dialer-tag.ct-dialer-east3 {
    background: #047857 !important;
    color: #ecfdf5 !important;
    border: 1px solid #10b981 !important;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 800;
    letter-spacing: 0.05em;
}
.ct-live.is-live {
    background: #15803d !important;
    color: #f0fdf4 !important;
    border: 1px solid #22c55e !important;
}
.ct-live.is-recent {
    background: #b45309 !important;
    color: #fffbeb !important;
    border: 1px solid #f59e0b !important;
}
.ct-live.is-stale {
    background: #b91c1c !important;
    color: #fef2f2 !important;
    border: 1px solid #ef4444 !important;
}
.ct-live.is-waiting {
    background: #475569 !important;
    color: #f8fafc !important;
    border: 1px solid #64748b !important;
}
.ct-campaign-id-badge {
    display: inline-block;
    padding: 1px 6px;
    font-size: 10px;
    font-weight: 700;
    border-radius: 3px;
    background: rgba(148, 163, 184, 0.15);
    color: var(--ct-muted);
    border: 1px solid rgba(148, 163, 184, 0.25);
}
.ct-campaign-id-badge.is-unverified {
    background: rgba(239, 68, 68, 0.1);
    color: #f87171;
    border: 1px dashed rgba(239, 68, 68, 0.4);
}
"""

for dialer in ["East2", "East3"]:
    p = f"CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_{dialer}/src/dashboard.css"
    with open(p, "r", encoding="utf-8") as f:
        content = f.read()
    if "/* === ULTRA-LEVEL COMMAND CENTER ENHANCEMENTS === */" not in content:
        content += "\n" + css_additions.strip() + "\n"
        with open(p, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Appended CSS enhancements to {p}")
    else:
        print(f"CSS enhancements already present in {p}")

