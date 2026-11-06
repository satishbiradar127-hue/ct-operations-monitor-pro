import os
import json

cache_file = r"C:\Users\Orange Carrot\AppData\Local\Google\Chrome\User Data\Profile 20\Cache\Cache_Data\f_008512"
with open(cache_file, "rb") as f:
    data = f.read()

idx = data.find(b'{"count":')
if idx != -1:
    j = json.loads(data[idx:].decode("latin1", errors="ignore"))
    first_item = j["results"][0]
    print("Keys of first live filter result:")
    for k in sorted(first_item.keys()):
        print(f"  {k}: {repr(first_item[k])[:80]}")
    
    print("\nTotal results in this page:", len(j["results"]))
    print("Total count in account:", j["count"])
