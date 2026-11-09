with open('CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/tests/suite.test.js', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'failed' in l.lower() and ('test(' in l or 'assert' in l or 'engine.' in l):
        print(f'{i+1}: {l.strip()[:100]}')
