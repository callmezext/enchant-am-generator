import subprocess
import time
import requests
from DrissionPage import ChromiumPage

cmd = [
    "/usr/bin/google-chrome-stable",
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--remote-debugging-port=9222",
    "--user-data-dir=/tmp/am_chrome_profile",
    "--blink-settings=imagesEnabled=false"
]

print("1. Launching Chrome...", flush=True)
p = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)

try:
    print("2. Connecting DrissionPage to port 9222...", flush=True)
    page = ChromiumPage(9222)
    print("3. Navigating to https://arkanastudio.xyz/ ...", flush=True)
    page.get("https://arkanastudio.xyz/")
    time.sleep(2)
    print(f"4. SUCCESS! Title: {page.title}", flush=True)
    print(f"5. URL: {page.url}", flush=True)
    
    ei = page.ele('#customEmailInput', timeout=5)
    if ei:
        print("[SUCCESS] Found #customEmailInput!", flush=True)
        ei.input("speedtest_test99@enchant.id")
        print("Filled email into input!", flush=True)
    else:
        print("[FAIL] #customEmailInput not found. Page HTML snippet:", flush=True)
        print(page.html[:400], flush=True)
finally:
    try:
        page.quit()
    except:
        pass
    p.kill()

print("ALL DONE!", flush=True)
