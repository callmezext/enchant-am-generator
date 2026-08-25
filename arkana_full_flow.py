import time
import json
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from DrissionPage import ChromiumPage, ChromiumOptions

def run_arkana_full():
    co = ChromiumOptions()
    co.set_argument('--headless=new')
    co.set_argument('--no-sandbox')
    co.set_argument('--disable-gpu')
    co.set_user_agent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36')
    
    page = ChromiumPage(co)
    try:
        page.listen.start('arkanastudio.xyz/api')
        
        print("1. Navigating to arkanastudio.xyz...")
        page.get("https://arkanastudio.xyz/")
        time.sleep(4)
        
        # Click manual
        for b in page.eles('tag:button'):
            if 'manual' in b.text.lower():
                b.click()
                time.sleep(2)
                break
        
        # Input email
        email_input = page.ele('#customEmailInput')
        email_input.input('admin@enchant.id')
        time.sleep(1)
        
        # Click send
        for b in page.eles('tag:button'):
            if 'kirim' in b.text.lower():
                b.click()
                break
        
        # Capture generate API call
        print("2. Capturing /api/generate response...")
        for i in range(10):
            packet = page.listen.wait(timeout=5)
            if packet and 'generate' in packet.url:
                resp = packet.response.body
                print(f"Generate response: {json.dumps(resp, indent=2)}")
                job_id = resp.get('id', '')
                print(f"Job ID: {job_id}")
                break
            elif packet:
                print(f"  (skipping: {packet.url})")
        
        time.sleep(3)
        
        # Now check page state - should show Step 2 (paste link)
        body_el = page.ele('tag:body')
        if body_el:
            raw = body_el.inner_text
            print(f"\n3. Page text after generate:\n{raw[:2000]}")
        
        # Check for new inputs (for pasting the link)
        print("\n4. Current inputs:")
        for inp in page.eles('tag:input'):
            print(f"  Input: {inp.attrs}")
        
        print("\n5. Current buttons:")
        for b in page.eles('tag:button'):
            print(f"  Button: '{b.text.strip()}'")
        
        # Also save HTML for analysis
        with open("arkana_step2.html", "w", encoding="utf-8") as f:
            f.write(page.html)
        print("\nSaved arkana_step2.html")
        
        # Now poll the job status
        print("\n6. Polling job via /api/jobs...")
        page.listen.start('arkanastudio.xyz/api/jobs')
        time.sleep(5)
        for i in range(5):
            packet = page.listen.wait(timeout=3)
            if packet:
                print(f"  Jobs response: {json.dumps(packet.response.body, indent=2) if packet.response and packet.response.body else 'no body'}")
                break
                
    finally:
        page.quit()

if __name__ == "__main__":
    run_arkana_full()
