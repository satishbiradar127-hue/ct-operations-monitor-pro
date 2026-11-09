css_additions = """
/* === FORENSIC COUNT SEPARATION & FRESHNESS BADGES === */
.ct-tlf-metric {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    margin-left: 6px;
    font-variant-numeric: tabular-nums;
}
.ct-tlf-pool {
    background: rgba(37, 99, 235, 0.15) !important;
    color: #60a5fa !important;
    border: 1px solid rgba(59, 130, 246, 0.35) !important;
}
.ct-tlf-match {
    background: rgba(168, 85, 247, 0.15) !important;
    color: #c084fc !important;
    border: 1px solid rgba(168, 85, 247, 0.35) !important;
}
.ct-tlf-freshness {
    display: inline-flex;
    align-items: center;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 3px;
    letter-spacing: 0.03em;
    margin-left: 4px;
}
.ct-tlf-freshness.is-live {
    background: rgba(34, 197, 94, 0.15) !important;
    color: #4ade80 !important;
    border: 1px solid rgba(34, 197, 94, 0.3) !important;
}
.ct-tlf-freshness.is-recent {
    background: rgba(245, 158, 11, 0.15) !important;
    color: #fbbf24 !important;
    border: 1px solid rgba(245, 158, 11, 0.3) !important;
}
.ct-tlf-freshness.is-stale {
    background: rgba(239, 68, 68, 0.15) !important;
    color: #f87171 !important;
    border: 1px solid rgba(239, 68, 68, 0.3) !important;
}
.ct-tlf-freshness.is-waiting {
    background: rgba(148, 163, 184, 0.15) !important;
    color: #94a3b8 !important;
    border: 1px solid rgba(148, 163, 184, 0.25) !important;
}
.ct-lfi-lead-pool {
    font-weight: 700;
    color: #60a5fa;
    font-variant-numeric: tabular-nums;
}
.ct-pool-tag {
    font-size: 9px;
    text-transform: uppercase;
    opacity: 0.8;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 2px;
    background: rgba(96, 165, 250, 0.15);
    color: #93c5fd;
    margin-left: 3px;
}
.ct-lfi-filter-count {
    font-weight: 700;
    color: #c084fc;
    font-variant-numeric: tabular-nums;
}
.ct-lfi-empty-val {
    color: var(--ct-muted);
}
"""

for dialer in ["East2", "East3"]:
    p = f"CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_{dialer}/src/dashboard.css"
    with open(p, "r", encoding="utf-8") as f:
        content = f.read()
    if "/* === FORENSIC COUNT SEPARATION & FRESHNESS BADGES === */" not in content:
        content += "\n" + css_additions.strip() + "\n"
        with open(p, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Appended freshness CSS to {p}")
    else:
        print(f"CSS already present in {p}")

