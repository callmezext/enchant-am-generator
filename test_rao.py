import os
import sys
import time
import tempfile
import shutil
from DrissionPage import ChromiumPage, ChromiumOptions

user_data = tempfile.mkdtemp(prefix="drission_rao_")
co = ChromiumOptions()
co.auto_port()
co.set_argument(f'--user-data-dir={user_data}')
co.set_argument('--no-sandbox')
co.set_argument('--disable-gpu')
co.set_argument('--disable-dev-shm-usage')
co.set_argument('--remote-allow-origins=*')
co.set_argument('--blink-settings=imagesEnabled=false')
if sys.platform != 'win32':
    co.set_argument('--headless=new')
    linux_chromes = [
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
    ]
    for p in linux_chromes:
        if os.path.exists(p):
            co.set_browser_path(p)
            break

print("Launching DrissionPage with --remote-allow-origins=* ...", flush=True)
page = ChromiumPage(co)
try:
    print("Navigating to https://arkanastudio.xyz/ ...", flush=True)
    page.get("https://arkanastudio.xyz/")
    time.sleep(2)
    print(f"SUCCESS! Page title: {page.title}", flush=True)
    print(f"Page URL: {page.url}", flush=True)
    
    ei = page.ele('#customEmailInput', timeout=5)
    if ei:
        print("[SUCCESS] Found #customEmailInput!", flush=True)
    else:
        print("[FAIL] #customEmailInput not found!", flush=True)
finally:
    page.quit()
    try:
        shutil.rmtree(user_data, ignore_errors=True)
    except:
        pass
print("ALL DONE!", flush=True)
