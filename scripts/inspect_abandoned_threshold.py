with open('CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/intelligence.js', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines[:120]):
    if 'outbound_abandoned' in l:
        for j in range(i, i+15):
            print(f'{j+1}: {lines[j]}', end='')
        break
