import os
import sys
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
    print("Navigating to https://arkanastudio.xyz/ ...", flush=True)
    page.get("https://arkanastudio.xyz/")
    print(f"Title: {page.title}", flush=True)
    print(f"URL: {page.url}", flush=True)
    print(f"HTML snippet: {page.html[:1000]}", flush=True)
    
    inputs = page.eles('tag:input')
    print(f"Found {len(inputs)} inputs:")
    for inp in inputs:
        print(f"  - ID: {inp.attr('id')}, name: {inp.attr('name')}, type: {inp.attr('type')}, placeholder: {inp.attr('placeholder')}")
        
    buttons = page.eles('tag:button')
    print(f"Found {len(buttons)} buttons:")
    for b in buttons:
        print(f"  - Text: '{b.text.strip()}', ID: {b.attr('id')}, class: {b.attr('class')}")
finally:
    page.quit()
