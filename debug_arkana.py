"""
Debug script to check what arkanastudio.xyz actually shows
and whether our automation is working correctly.
"""
import os, time, sys, io, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from DrissionPage import ChromiumPage, ChromiumOptions

profile_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.arkana_profile')
co = ChromiumOptions()
co.set_argument('--no-sandbox')
co.set_argument('--disable-gpu')
co.set_argument(f'--user-data-dir={profile_dir}')
co.set_user_agent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36')

page = ChromiumPage(co)

# Intercept ALL network calls
page.listen.start('')
page.get('https://arkanastudio.xyz/')

# Wait for Cloudflare
for i in range(15):
    title = page.title
    print(f'[NAV] Title: {title}')
    if 'Security' not in title and 'Checkpoint' not in title:
        break
    time.sleep(2)
time.sleep(4)

print('=== PAGE LOADED ===')
print('[INFO] Current URL:', page.url)
print('[INFO] Title:', page.title)

# List buttons
btns = page.eles('tag:button')
for i, b in enumerate(btns):
    bid = b.attr('id') or ''
    bcls = b.attr('class') or ''
    btxt = b.text.strip()
    print(f'[BTN {i}] text="{btxt}" id="{bid}"')

# Click Email pribadi / manual button
clicked = False
for b in btns:
    txt = b.text.strip().lower()
    if 'pribadi' in txt or 'manual' in txt:
        print(f'[CLICK] Clicking button: "{b.text.strip()}"')
        b.click()
        clicked = True
        break
if not clicked:
    print('[ERROR] Could not find manual/pribadi button!')

time.sleep(3)

# Check for customEmailInput
ei = page.ele('#customEmailInput', timeout=3)
print(f'[CHECK] #customEmailInput found: {bool(ei)}')

# Also check customMagicLinkInput
ta = page.ele('#customMagicLinkInput', timeout=2)
print(f'[CHECK] #customMagicLinkInput found: {bool(ta)}')

# List ALL input elements
all_inputs = page.eles('tag:input')
print(f'[DOM] Found {len(all_inputs)} input elements:')
for inp in all_inputs:
    iid = inp.attr('id') or ''
    itype = inp.attr('type') or ''
    iph = inp.attr('placeholder') or ''
    print(f'  id="{iid}" type="{itype}" placeholder="{iph}"')

# List ALL textarea elements
all_ta = page.eles('tag:textarea')
print(f'[DOM] Found {len(all_ta)} textarea elements:')
for t in all_ta:
    tid = t.attr('id') or ''
    tph = t.attr('placeholder') or ''
    print(f'  id="{tid}" placeholder="{tph}"')

# Dump visible body text (first 2000 chars)
visible = page.run_js('return document.body.innerText.substring(0, 2000)')
print('[BODY TEXT]:')
print(visible[:2000])

# Now if email input found, try to fill and submit
if ei:
    ei.clear()
    ei.input('nakano@enchant.id')
    print('[INPUT] Filled email: nakano@enchant.id')
    time.sleep(1)

    # Find and click send button
    new_btns = page.eles('tag:button')
    for b in new_btns:
        txt = b.text.strip().lower()
        if 'kirim' in txt or 'send' in txt:
            print(f'[CLICK] Clicking send: "{b.text.strip()}"')
            b.click()
            break

    # Wait for generate API call
    print('[NET] Waiting for API calls...')
    for attempt in range(15):
        pkt = page.listen.wait(timeout=3)
        if pkt:
            print(f'[NET] {pkt.method} {pkt.url}')
            if pkt.response and pkt.response.body:
                body = pkt.response.body
                if isinstance(body, dict):
                    print(f'[NET] Response body: {json.dumps(body, indent=2)}')
                else:
                    print(f'[NET] Response body: {str(body)[:500]}')
            if 'generate' in pkt.url or 'api' in pkt.url:
                print('[NET] ^^^ API call detected!')
                break

page.quit()
print('=== DONE ===')
