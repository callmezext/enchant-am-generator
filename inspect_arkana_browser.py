import time
from DrissionPage import ChromiumPage, ChromiumOptions

def inspect_arkana():
    co = ChromiumOptions()
    co.set_argument('--headless=new')
    co.set_argument('--no-sandbox')
    co.set_argument('--disable-gpu')
    co.set_user_agent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36')
    
    page = ChromiumPage(co)
    try:
        print("Navigating to https://arkanastudio.xyz/...")
        page.get("https://arkanastudio.xyz/")
        time.sleep(5)
        
        print("Current URL:", page.url)
        print("Title:", page.title)
        
        # Check if there is challenge/turnstile
        for _ in range(10):
            if "Security Checkpoint" in page.title or "Just a moment" in page.title:
                print("Solving challenge/waiting...")
                time.sleep(2)
            else:
                break
                
        print("Final Title:", page.title)
        print("HTML snippet (first 1500 chars):")
        html = page.html
        print(html[:1500])
        
        with open("arkana_page.html", "w", encoding="utf-8") as f:
            f.write(html)
            
        print("Saved arkana_page.html")
        
        # Find all inputs, buttons, and forms
        inputs = page.eles('tag:input')
        print("Found inputs:", [i.attrs for i in inputs])
        
        buttons = page.eles('tag:button')
        print("Found buttons:", [b.text for b in buttons])
        
    finally:
        page.quit()

if __name__ == "__main__":
    inspect_arkana()
