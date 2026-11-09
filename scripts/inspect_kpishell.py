with open('CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/dashboard.js', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'function kpishell' in l.lower() or 'kpishell(' in l.lower():
        print(f'{i+1}: {l.strip()[:100]}')
