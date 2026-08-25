"""
Arkana Worker - High-Performance browser automation for arkanastudio.xyz
Modes:
  auto <email>       - Full automatic (send + intercept from mail API + verify)
  send <email>       - Send only (returns job info, for manual mode step 1)
  verify <link>      - Verify only (pastes magic link, for manual mode step 2)
"""

import time
import json
import sys
import os
import io
import urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from DrissionPage import ChromiumPage, ChromiumOptions

PROFILE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.arkana_profile')
PORT = os.environ.get('PORT', '3001')
MAIL_API = f'http://127.0.0.1:{PORT}/api/v1/mail/inbox'

def get_page():
    co = ChromiumOptions()
    co.set_argument('--no-sandbox')
    co.set_argument('--disable-gpu')
    co.set_argument('--disable-dev-shm-usage')
    co.set_argument('--blink-settings=imagesEnabled=false') # Don't waste time rendering images
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
    co.set_argument(f'--user-data-dir={PROFILE_DIR}')
    co.set_user_agent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36')
    return ChromiumPage(co)

def get_latest_link(email):
    try:
        req = urllib.request.Request(f'{MAIL_API}?email={urllib.request.quote(email)}')
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            for msg in data.get('messages', []):
                for link in msg.get('links', []):
                    if 'firebaseapp' in link or 'alightcreative' in link:
                        return link
    except:
        pass
    return None

def navigate_and_wait(page):
    current_url = page.url or ''
    if not current_url.startswith('https://arkanastudio.xyz'):
        page.get("https://arkanastudio.xyz/")
    
    # Fast check for Cloudflare
    for _ in range(20):
        title = page.title or ''
        if 'Security' not in title and 'Checkpoint' not in title and 'Just a moment' not in title:
            break
        time.sleep(0.5)

def reset_to_step1(page):
    """Fast force reset ArkanStudio back to Step 1 (email input)."""
    ei = page.ele('#customEmailInput', timeout=0.5)
    if ei:
        return 'step1'

    # Try clicking cancel/reset buttons
    for b in page.eles('tag:button'):
        txt = b.text.strip().lower()
        if 'batal' in txt or 'ganti email' in txt or 'mulai dari awal' in txt or 'salah' in txt or 'kembali' in txt:
            b.click()
            break
    
    # Quick reactive wait for email input
    for _ in range(15):
        ei = page.ele('#customEmailInput', timeout=0.3)
        if ei:
            return 'step1'
        time.sleep(0.2)

    return 'unknown'

def ensure_manual_mode(page):
    """Ensure we are in manual mode at Step 1."""
    ei = page.ele('#customEmailInput', timeout=0.5)
    if ei:
        return 'step1'

    ta = page.ele('#customMagicLinkInput', timeout=0.5)
    if ta:
        return reset_to_step1(page)

    # Click manual button
    for b in page.eles('tag:button'):
        txt = b.text.strip().lower()
        if 'manual' in txt or 'pribadi' in txt:
            b.click()
            break

    # Wait for either input to show up
    for _ in range(15):
        ei = page.ele('#customEmailInput', timeout=0.3)
        if ei:
            return 'step1'
        ta = page.ele('#customMagicLinkInput', timeout=0.3)
        if ta:
            return reset_to_step1(page)
        time.sleep(0.2)

    return 'unknown'

def do_send(page, email):
    """Submit email to ArkanStudio -> triggers verification email."""
    navigate_and_wait(page)

    # Click manual mode if button visible
    for b in page.eles('tag:button'):
        txt = b.text.strip().lower()
        if 'manual' in txt or 'pribadi' in txt:
            b.click()
            break

    state = ensure_manual_mode(page)
    if state != 'step1':
        return {"success": False, "error": f"Cannot reach Step 1 (state: {state})"}

    page.listen.start('api')

    ei = page.ele('#customEmailInput', timeout=1.5)
    if not ei:
        return {"success": False, "error": "Cannot find #customEmailInput"}

    ei.clear()
    ei.input(email)

    # Click send
    send_clicked = False
    for b in page.eles('tag:button'):
        txt = b.text.strip().lower()
        if 'kirim' in txt and 'ulang' not in txt:
            b.click()
            send_clicked = True
            break

    if not send_clicked:
        return {"success": False, "error": "Cannot find Kirim button"}

    # Fast packet wait
    job_data = None
    for _ in range(25):
        pkt = page.listen.wait(timeout=1.5)
        if pkt:
            url = pkt.url or ''
            if 'generate' in url and pkt.method == 'POST':
                job_data = pkt.response.body if pkt.response else None
                break
        else:
            # Fallback: check if page jumped to Step 2
            ta = page.ele('#customMagicLinkInput', timeout=0.3)
            if ta:
                return {
                    "success": True,
                    "jobId": "",
                    "state": "AWAITING_AM_VERIFICATION",
                    "email": email
                }

    if not job_data:
        ta = page.ele('#customMagicLinkInput', timeout=1.0)
        if ta:
            return {
                "success": True,
                "jobId": "",
                "state": "AWAITING_AM_VERIFICATION",
                "email": email
            }
        return {"success": False, "error": "No response from ArkanStudio generate API"}

    return {
        "success": True,
        "jobId": job_data.get('id', ''),
        "state": job_data.get('state', ''),
        "email": job_data.get('amEmail', email)
    }

def do_verify(page, magic_link):
    """Paste magic link and activate premium."""
    ta = page.ele('#customMagicLinkInput', timeout=2.0)
    if not ta:
        navigate_and_wait(page)
        for b in page.eles('tag:button'):
            txt = b.text.strip().lower()
            if 'manual' in txt or 'pribadi' in txt:
                b.click()
                break
        ta = page.ele('#customMagicLinkInput', timeout=2.5)

    if not ta:
        return {"success": False, "error": "Cannot find #customMagicLinkInput"}

    ta.clear()
    ta.input(magic_link)

    page.listen.start('api')

    verify_clicked = False
    for b in page.eles('tag:button'):
        txt = b.text.strip().lower()
        if 'verifikasi' in txt or 'aktifkan' in txt:
            b.click()
            verify_clicked = True
            break

    if not verify_clicked:
        return {"success": False, "error": "Cannot find Verifikasi button"}

    # Fast packet wait
    result = None
    for _ in range(30):
        pkt = page.listen.wait(timeout=1.5)
        if pkt:
            url = pkt.url or ''
            if 'verify' in url or 'activate' in url:
                resp = pkt.response.body if pkt.response else None
                if resp:
                    result = {
                        "success": resp.get('state') == 'SUCCESS',
                        "email": resp.get('amEmail', ''),
                        "state": resp.get('state', 'UNKNOWN'),
                        "activatedAt": resp.get('activatedAt'),
                        "expiresAt": resp.get('expiresAt'),
                        "activationDetail": resp.get('activationDetail', ''),
                    }
                break

    if not result:
        # Check text on page
        body_text = page.run_js('return document.body.innerText') or ''
        if 'berhasil' in body_text.lower() or 'aktif' in body_text.lower():
            return {
                "success": True,
                "email": "",
                "state": "SUCCESS",
                "activationDetail": "Fitur berhasil diaktifkan",
            }
        return {"success": False, "error": "No verification response from ArkanStudio"}

    return result

def do_auto(page, email):
    """Full automatic: send + intercept from mail API + verify"""
    # Clear inbox first
    try:
        urllib.request.urlopen(urllib.request.Request(
            f'http://localhost:3000/api/v1/mail/inbox?email={urllib.request.quote(email)}',
            method='DELETE'
        ), timeout=2)
    except:
        pass

    # Step 1: Send
    t0 = time.time()
    print("[1/3] Mengirim email verifikasi...")
    send_result = do_send(page, email)
    if not send_result.get('success'):
        return send_result
    print(f"[1/3] OK dalam {time.time()-t0:.1f}s")

    # Step 2: High-frequency polling for email in inbox (every 0.35s)
    t1 = time.time()
    print("[2/3] Menyergap link verifikasi dari inbox...")
    magic_link = None
    for _ in range(40):
        time.sleep(0.35)
        link = get_latest_link(email)
        if link:
            magic_link = link
            print(f"[2/3] Link tertangkap dalam {time.time()-t1:.1f}s!")
            break

    if not magic_link:
        return {"success": False, "error": "Timeout: email verifikasi tidak masuk ke inbox"}

    # Step 3: Fast Verify
    t2 = time.time()
    print("[3/3] Memverifikasi lisensi...")
    result = do_verify(page, magic_link)
    if result.get('success'):
        print(f"[3/3] BERHASIL dalam {time.time()-t2:.1f}s! Total waktu: {time.time()-t0:.1f}s")
    else:
        print(f"[3/3] Gagal: {result.get('error', '')}")

    return result

def main():
    if len(sys.argv) < 2:
        print("Usage: arkana_worker.py <auto|send|verify> <email_or_link>")
        sys.exit(1)

    mode = sys.argv[1]
    arg = sys.argv[2] if len(sys.argv) > 2 else ''

    page = get_page()
    try:
        if mode == 'auto':
            result = do_auto(page, arg)
        elif mode == 'send':
            result = do_send(page, arg)
        elif mode == 'verify':
            result = do_verify(page, arg)
        else:
            result = {"success": False, "error": f"Unknown mode: {mode}"}

        print(f"RESULT_JSON:{json.dumps(result)}")
    finally:
        page.quit()

if __name__ == "__main__":
    main()
