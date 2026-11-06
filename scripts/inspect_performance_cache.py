import os

cache_file = r"C:\Users\Orange Carrot\AppData\Local\Google\Chrome\User Data\Profile 20\Cache\Cache_Data\f_0083d1"
with open(cache_file, "rb") as f:
    data = f.read()

s = data.decode("latin1", errors="ignore")
print("=== f_0083d1 (Live Filter Performance) ===")
# find table columns
import re
for m in re.finditer(r'\[(?:\"[a-zA-Z0-9_\- ]+\"(?:,\s*)?)+\]', s[:10000]):
    print("Array:", m.group(0))

idx = s.find("displayedColumns")
if idx != -1:
    print("displayedColumns snippet:", s[idx:idx+300])

