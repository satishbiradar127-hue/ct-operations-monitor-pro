import sqlite3
import shutil
import os

src = r"C:\Users\Orange Carrot\AppData\Local\Google\Chrome\User Data\Profile 20\History"
dst = r"C:\Users\Orange Carrot\AppData\Local\Google\Chrome\User Data\Profile 20\History_temp"
try:
    shutil.copy2(src, dst)
    conn = sqlite3.connect(dst)
    cursor = conn.cursor()
    cursor.execute("SELECT url, title, visit_count, last_visit_time FROM urls WHERE url LIKE '%live-filter%' OR url LIKE '%campaign%' ORDER BY last_visit_time DESC LIMIT 40")
    rows = cursor.fetchall()
    for r in rows:
        print(f"{r[0]} | Title: {r[1]} | Visits: {r[2]}")
    conn.close()
    if os.path.exists(dst):
        os.remove(dst)
except Exception as e:
    print("Error:", e)

