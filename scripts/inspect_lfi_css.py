with open('CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/dashboard.css', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'ct-lfi-kpi' in l:
        print(f'{i+1}: {l.strip()[:100]}')
