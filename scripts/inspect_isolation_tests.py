import re

with open('CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/tests/suite.test.js', 'r', encoding='utf-8') as f:
    text = f.read()

for num in ['114', '125', '143', '155', '207', '223', '235', '267']:
    m = re.search(r'test\("[^"]*UPGRADE ' + num + r'[\s\S]*?\n\}\);', text)
    if m:
        print(f'=== TEST {num} IN E2 ===')
        print(m.group(0))
        print()
