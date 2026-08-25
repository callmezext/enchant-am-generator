import os
import sys
import time
from DrissionPage import ChromiumPage, ChromiumOptions

co = ChromiumOptions()
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

page = ChromiumPage(co)
try:
    print("Opening ArkanStudio in browser...", flush=True)
    page.get("https://arkanastudio.xyz/")
    time.sleep(3)
    print(f"Title: {page.title}", flush=True)
    print(f"URL: {page.url}", flush=True)
    
    # Check if there is an iframe or checkbox
    iframes = page.eles('tag:iframe')
    print(f"Found {len(iframes)} iframes", flush=True)
    for idx, iframe in enumerate(iframes):
        print(f"  Iframe {idx}: src={iframe.attr('src')}", flush=True)
        
    # Wait up to 10s to see if challenge solves automatically
    for i in range(10):
        ei = page.ele('#customEmailInput', timeout=1)
        if ei:
            print(f"[OK] Reached main page after {i+1}s!", flush=True)
            break
        print(f"Waiting for challenge... ({i+1}s) Title: {page.title}", flush=True)
        time.sleep(1)
finally:
    page.quit()
