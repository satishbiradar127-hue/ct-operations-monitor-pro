with open('CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/intelligence.js', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'loadstate' in l.lower():
        for j in range(i, i+30):
            print(f'{j+1}: {lines[j]}', end='')
        break
