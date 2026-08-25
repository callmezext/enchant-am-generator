import time
import json
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import urllib.request

from DrissionPage import ChromiumPage, ChromiumOptions

def run():
    co = ChromiumOptions()
    co.set_argument('--no-sandbox')
    co.set_argument('--disable-gpu')
    co.set_user_agent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36')
    
    page = ChromiumPage(co)
    try:
        page.listen.start('api')
        
        print("1. Navigate to arkanastudio.xyz...")
        page.get("https://arkanastudio.xyz/")
        time.sleep(5)
        print(f"   Title: {page.title}")
        
        # Check current page state - is it Step 1 (email input) or Step 2 (magic link)?
        email_input = page.ele('#customEmailInput', timeout=2)
        magic_textarea = page.ele('#customMagicLinkInput', timeout=2)
        
        if email_input:
            print("\n2. Page is at STEP 1 (email input). Typing admin@enchant.id...")
            email_input.clear()
            email_input.input('admin@enchant.id')
            time.sleep(1)
            
            # Click send
            for b in page.eles('tag:button'):
                if 'kirim' in b.text.lower():
                    print(f"   Clicking: '{b.text.strip()}'")
                    b.click()
                    break
            
            # Capture /api/generate
            for _ in range(15):
                pkt = page.listen.wait(timeout=5)
                if pkt and 'generate' in pkt.url:
                    resp = pkt.response.body if pkt.response else None
                    print(f"   Generate response: {json.dumps(resp, indent=2)}")
                    break
            
            # Wait for page transition to Step 2
            time.sleep(5)
            
            # Wait for new email to arrive
            print("\n3. Waiting for verification email in inbox...")
            time.sleep(8)
            
            magic_textarea = page.ele('#customMagicLinkInput', timeout=5)
        
        elif magic_textarea:
            print("\n2. Page is already at STEP 2 (magic link input)!")
            # We may need to trigger a fresh generate first
            # Check if there's a "back" or "reset" button
            for b in page.eles('tag:button'):
                txt = b.text.strip().lower()
                if 'kembali' in txt or 'ulang' in txt or 'back' in txt or 'reset' in txt:
                    print(f"   Found reset button: '{b.text.strip()}', clicking...")
                    b.click()
                    time.sleep(3)
                    # Now try Step 1
                    email_input = page.ele('#customEmailInput', timeout=3)
                    if email_input:
                        email_input.clear()
                        email_input.input('admin@enchant.id')
                        time.sleep(1)
                        for b2 in page.eles('tag:button'):
                            if 'kirim' in b2.text.lower():
                                b2.click()
                                break
                        time.sleep(8)
                        magic_textarea = page.ele('#customMagicLinkInput', timeout=5)
                    break
        else:
            # Click manual first
            print("\n2. Clicking manual button first...")
            for b in page.eles('tag:button'):
                if 'manual' in b.text.lower():
                    b.click()
                    time.sleep(3)
                    break
            
            email_input = page.ele('#customEmailInput', timeout=3)
            magic_textarea = page.ele('#customMagicLinkInput', timeout=3)
            
            if email_input:
                print("   Now at Step 1, typing email...")
                email_input.clear()
                email_input.input('admin@enchant.id')
                time.sleep(1)
                for b in page.eles('tag:button'):
                    if 'kirim' in b.text.lower():
                        b.click()
                        break
                time.sleep(8)
                magic_textarea = page.ele('#customMagicLinkInput', timeout=5)
        
        # Now we should be at Step 2 with magic_textarea
        if not magic_textarea:
            print("ERROR: Could not reach Step 2!")
            return
        
        # Get latest verification link from our inbox
        print("\n4. Getting latest magic link from admin@enchant.id inbox...")
        inbox_resp = urllib.request.urlopen('http://localhost:3000/api/v1/mail/inbox?email=admin@enchant.id')
        inbox_data = json.loads(inbox_resp.read())
        msgs = inbox_data.get('messages', [])
        
        latest_link = None
        for msg in msgs:
            links = msg.get('links', [])
            if links and 'firebaseapp' in links[0]:
                latest_link = links[0]
                print(f"   From: {msg.get('from')}")
                print(f"   Subject: {msg.get('subject')}")
                print(f"   Received: {msg.get('receivedAt')}")
                print(f"   Link: {latest_link[:100]}...")
                break
        
        if not latest_link:
            print("   ERROR: No verification link in inbox!")
            return
        
        # Paste magic link into textarea
        print("\n5. Pasting magic link into textarea...")
        magic_textarea.clear()
        magic_textarea.input(latest_link)
        time.sleep(1)
        
        # Restart network listener
        page.listen.start('api')
        
        # Find and click verify/submit button
        print("\n6. Finding verify button...")
        buttons = page.eles('tag:button')
        for b in buttons:
            txt = b.text.strip()
            print(f"   Button: '{txt}'")
            lower = txt.lower()
            if 'verifikasi' in lower or 'aktifkan' in lower or 'konfirmasi' in lower or 'submit' in lower or 'lanjut' in lower or 'proses' in lower:
                print(f"   >>> CLICKING: '{txt}'")
                b.click()
                break
        
        # Capture ALL API responses
        print("\n7. Capturing API responses after submit...")
        for i in range(25):
            pkt = page.listen.wait(timeout=5)
            if pkt:
                url = pkt.url
                method = pkt.method
                status = pkt.response.status if pkt.response else '?'
                body = pkt.response.body if pkt.response else None
                print(f"\n   [{i}] {method} {url}")
                print(f"       Status: {status}")
                if body:
                    if isinstance(body, dict):
                        print(f"       Body: {json.dumps(body, indent=2)}")
                    else:
                        print(f"       Body: {str(body)[:500]}")
            else:
                break
        
        # Check final page state
        time.sleep(5)
        body_el = page.ele('tag:body')
        if body_el:
            txt = body_el.raw_text[:2000] if hasattr(body_el, 'raw_text') else str(body_el.texts())[:2000]
            print(f"\n8. Final page state:\n{txt}")
            
    finally:
        page.quit()

if __name__ == "__main__":
    run()
