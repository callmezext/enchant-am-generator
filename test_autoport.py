import os
import sys
import time
from DrissionPage import ChromiumPage, ChromiumOptions

co = ChromiumOptions()
co.auto_port()
co.set_argument('--no-sandbox')
co.set_argument('--disable-gpu')
co.set_argument('--disable-dev-shm-usage')
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

print("Launching browser with auto_port()...", flush=True)
page = ChromiumPage(co)
try:
    print("Navigating to https://arkanastudio.xyz/ ...", flush=True)
    page.get("https://arkanastudio.xyz/")
    time.sleep(2)
    print(f"SUCCESS! Title: {page.title}", flush=True)
    print(f"URL: {page.url}", flush=True)
    
    # Check for email input
    ei = page.ele('#customEmailInput', timeout=3)
    if ei:
        print("FOUND #customEmailInput! ArkanStudio is ready!", flush=True)
    else:
        print("Looking for inputs/buttons...", flush=True)
        for b in page.eles('tag:button'):
            print("  Button:", b.text.strip())
finally:
    page.quit()
