from DrissionPage import ChromiumPage, ChromiumOptions
import time

co = ChromiumOptions()
co.headless(False)
co.set_argument('--no-sandbox')
co.set_argument('--disable-gpu')

page = ChromiumPage(co)
try:
    print("Navigating to https://amprem.irfanjawa.com/auth...")
    page.get("https://amprem.irfanjawa.com/auth")
    time.sleep(3)

    # Find Turnstile iframe
    print("Looking for Turnstile iframe...")
    iframe = page.get_frame('css:iframe[src*="challenges.cloudflare.com"]')
    if iframe:
        print("Found iframe! Locating checkbox...")
        # Check elements inside iframe
        box = iframe.ele('css:label.ctp-checkbox-label') or iframe.ele('css:#challenge-stage') or iframe.ele('tag:input')
        if box:
            print("Found checkbox element, clicking...")
            box.click()
            print("Clicked!")

    # Poll for token
    for i in range(25):
        time.sleep(1)
        inp = page.ele('css:input[name="cf-turnstile-response"]')
        if inp and inp.value and len(inp.value) > 30:
            print(f"✓ TOKEN OBTAINED: {inp.value[:50]}... (Length: {len(inp.value)})")
            break
        print(f"Waiting for token... ({i+1}/25)")
finally:
    page.quit()
