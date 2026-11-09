file_path = "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/dashboard.css"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update ct-lfi-kpi-grid columns to 6
old_kpi_grid_css = """.ct-lfi-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 14px;
}"""

new_kpi_grid_css = """.ct-lfi-kpi-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 14px;
}"""

if old_kpi_grid_css in content:
    content = content.replace(old_kpi_grid_css, new_kpi_grid_css, 1)
    print("1. Updated .ct-lfi-kpi-grid to repeat(6, minmax(0, 1fr))")

# 2. Append ultra-premium command center styling & transitions
additions = """
/* === ULTRA-PREMIUM COMMAND CENTER REFINEMENTS === */
.ct-intel-auto-tag {
    display: inline-block;
    font-size: 8.5px;
    font-weight: 800;
    color: #64748b;
    background: rgba(148, 163, 184, 0.12);
    border: 1px solid rgba(148, 163, 184, 0.2);
    padding: 2px 7px;
    border-radius: 4px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
}

.ct-lfi-transition {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
}
.ct-lfi-prev {
    color: #94a3b8;
}
.ct-lfi-curr {
    color: #38bdf8;
    font-weight: 750;
}
.ct-lfi-arrow {
    color: #34d399;
    font-weight: 800;
}

.ct-lfi-table-wrap {
    max-height: 290px;
    overflow-y: auto;
    overflow-x: auto;
    border-radius: 6px;
    border: 1px solid rgba(148, 163, 184, 0.14);
    background: rgba(11, 17, 32, 0.6);
}
.ct-lfi-table thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    background: #0f172a !important;
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.05em;
    color: #94a3b8;
    border-bottom: 1px solid rgba(148, 163, 184, 0.2) !important;
    padding: 8px 10px;
    white-space: nowrap;
}
.ct-lfi-table tbody tr {
    border-bottom: 1px solid rgba(148, 163, 184, 0.08);
    transition: background 0.15s ease;
}
.ct-lfi-table tbody tr:nth-child(even) {
    background: rgba(30, 41, 59, 0.25);
}
.ct-lfi-table tbody tr:hover {
    background: rgba(59, 130, 246, 0.08);
}
.ct-lfi-table tbody td {
    padding: 6px 10px;
    font-size: 11px;
    vertical-align: middle;
    color: #e2e8f0;
}

.ct-lfi-badge.is-verified-active {
    background: rgba(34, 197, 94, 0.15) !important;
    color: #4ade80 !important;
    border: 1px solid rgba(34, 197, 94, 0.3) !important;
}
.ct-lfi-badge.is-unassigned {
    background: rgba(148, 163, 184, 0.12) !important;
    color: #94a3b8 !important;
    border: 1px solid rgba(148, 163, 184, 0.25) !important;
}
.ct-lfi-badge.is-unknown {
    background: rgba(245, 158, 11, 0.12) !important;
    color: #fbbf24 !important;
    border: 1px solid rgba(245, 158, 11, 0.3) !important;
}

@media (max-width: 1300px) {
    .ct-lfi-kpi-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    }
}
@media (max-width: 800px) {
    .ct-lfi-kpi-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
}
"""

if "=== ULTRA-PREMIUM COMMAND CENTER REFINEMENTS ===" not in content:
    content += additions
    print("2. Appended ultra-premium command center styling & transitions")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("East-2 dashboard.css patch complete.")
