import time
import json
from DrissionPage import ChromiumPage, ChromiumOptions

def run_arkana_manual_flow():
    co = ChromiumOptions()
    co.set_argument('--headless=new')
    co.set_argument('--no-sandbox')
    co.set_argument('--disable-gpu')
    co.set_user_agent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36')
    
    page = ChromiumPage(co)
    try:
        # Listen to ALL network requests
        page.listen.start('arkanastudio.xyz/api')
        
        print("1. Navigating to https://arkanastudio.xyz/...")
        page.get("https://arkanastudio.xyz/")
        time.sleep(4)
        
        # Click "Email pribadi / manual"
        print("2. Clicking 'Email pribadi / manual'...")
        for b in page.eles('tag:button'):
            if 'manual' in b.text.lower():
                b.click()
                time.sleep(2)
                break
        
        # Type email into input
        email_input = page.ele('#customEmailInput')
        if email_input:
            print("3. Typing email: admin@enchant.id")
            email_input.input('admin@enchant.id')
            time.sleep(1)
        else:
            print("ERROR: Email input not found!")
            return
        
        # Click "Kirim link aktivasi"
        print("4. Clicking 'Kirim link aktivasi'...")
        for b in page.eles('tag:button'):
            if 'kirim' in b.text.lower() or 'aktivasi' in b.text.lower():
                b.click()
                break
        
        # Wait and capture network requests
        print("\n=== CAPTURING API REQUESTS ===")
        for i in range(15):
            packet = page.listen.wait(timeout=3)
            if packet:
                print(f"\n--- Request #{i+1} ---")
                print(f"URL: {packet.url}")
                print(f"Method: {packet.method}")
                if hasattr(packet, 'request') and packet.request:
                    req_body = packet.request.body
                    if req_body:
                        print(f"Request Body: {str(req_body)[:500]}")
                if hasattr(packet, 'response') and packet.response:
                    print(f"Status: {packet.response.status}")
                    resp_body = packet.response.body
                    if resp_body:
                        print(f"Response Body: {str(resp_body)[:500]}")
            else:
                break
        
        # Wait a bit for page update
        time.sleep(3)
        
        # Check page state after submit
        body = page.ele('tag:body')
        page_text = body.text if body else ''
        print("\n=== PAGE TEXT AFTER SUBMIT ===")
        print(page_text[:2000])
        
        # Check for new inputs / buttons
        print("\n=== CURRENT INPUTS ===")
        for inp in page.eles('tag:input'):
            print("Input:", inp.attrs)
        print("\n=== CURRENT BUTTONS ===")
        for b in page.eles('tag:button'):
            print("Button:", b.text.strip())
            
    finally:
        page.quit()

if __name__ == "__main__":
    run_arkana_manual_flow()
