import subprocess
import time
import requests
import json

cmd = [
    "/usr/bin/google-chrome-stable",
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--remote-debugging-port=9222",
    "--user-data-dir=/tmp/test_chrome_profile"
]

print("Launching Chrome directly via subprocess...", flush=True)
p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
time.sleep(3)

try:
    r = requests.get("http://127.0.0.1:9222/json/version", timeout=5)
    print("Chrome /json/version response:", r.status_code)
    print(r.text)
    
    r_list = requests.get("http://127.0.0.1:9222/json/list", timeout=5)
    print("Chrome /json/list response:", r_list.status_code)
    print(r_list.text)
except Exception as e:
    print("Error querying Chrome:", e)
finally:
    p.kill()
