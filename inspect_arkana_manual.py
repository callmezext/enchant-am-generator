import time
import json
from DrissionPage import ChromiumPage, ChromiumOptions

def inspect_arkana_flow():
    co = ChromiumOptions()
    co.set_argument('--headless=new')
    co.set_argument('--no-sandbox')
    co.set_argument('--disable-gpu')
    co.set_user_agent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36')
    
    page = ChromiumPage(co)
    try:
        # Start listening to network requests
        page.listen.start('api')
        
        print("Navigating to https://arkanastudio.xyz/...")
        page.get("https://arkanastudio.xyz/")
        time.sleep(4)
        
        print("Title:", page.title)
        
        # Click manual button
        buttons = page.eles('tag:button')
        for b in buttons:
            txt = b.text.strip()
            print(f"Button found: '{txt}'")
            if 'manual' in txt.lower() or 'pribadi' in txt.lower():
                print(f"Clicking: '{txt}'")
                b.click()
                time.sleep(3)
                break
        
        # Get page content after click
        body = page.ele('tag:body')
        page_text = body.text if body else ''
        print("\n=== PAGE TEXT AFTER MANUAL CLICK ===")
        print(page_text[:3000])
        
        # Find all inputs
        print("\n=== INPUTS ===")
        inputs = page.eles('tag:input')
        for inp in inputs:
            print("Input:", inp.attrs)
            
        # Find all buttons
        print("\n=== BUTTONS ===")
        buttons2 = page.eles('tag:button')
        for b in buttons2:
            print("Button:", b.text.strip())

        # Find all links
        print("\n=== LINKS ===")
        links = page.eles('tag:a')
        for l in links:
            href = l.attr('href') or ''
            if href and not href.startswith('#') and not href.startswith('javascript'):
                print(f"Link: {l.text.strip()} -> {href}")
        
        # Save HTML
        with open("arkana_manual_page.html", "w", encoding="utf-8") as f:
            f.write(page.html)
        print("\nSaved arkana_manual_page.html")
        
        # Check network requests captured
        print("\n=== NETWORK REQUESTS ===")
        for _ in range(5):
            packet = page.listen.wait(timeout=1)
            if packet:
                print(f"URL: {packet.url}")
                print(f"Method: {packet.method}")
                if hasattr(packet, 'response') and packet.response:
                    print(f"Status: {packet.response.status}")
                    body_text = packet.response.body
                    if body_text:
                        print(f"Body: {str(body_text)[:300]}")
                print("---")
            
    finally:
        page.quit()

if __name__ == "__main__":
    inspect_arkana_flow()
