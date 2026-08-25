"""
Theyka Turnstile-Solver API Server (Python)
Compatible with https://github.com/Theyka/Turnstile-Solver
Listens on http://localhost:5000/turnstile
"""

import time
import os
import sys
from flask import Flask, request, jsonify
from DrissionPage import ChromiumPage, ChromiumOptions

app = Flask(__name__)

def solve_turnstile(url="https://amprem.irfanjawa.com/auth", sitekey=None, max_timeout=35):
    co = ChromiumOptions()
    co.auto_port()
    if sys.platform != 'win32':
        co.headless(True)
        co.set_argument('--headless=new')
    else:
        co.headless(False)
    co.set_argument('--no-sandbox')
    co.set_argument('--disable-gpu')
    co.set_argument('--disable-dev-shm-usage')
    co.set_argument('--window-size=700,600')

    page = ChromiumPage(co)
    try:
        print(f"[Theyka-Solver] Navigating to {url}...", flush=True)
        page.get(url)
        time.sleep(2.5)

        # Look for Turnstile iframe
        try:
            iframe = page.get_frame('css:iframe[src*="challenges.cloudflare.com"]')
            if iframe:
                box = iframe.ele('css:label.ctp-checkbox-label') or iframe.ele('css:#challenge-stage') or iframe.ele('tag:input')
                if box:
                    print("[Theyka-Solver] Clicking Turnstile checkbox...", flush=True)
                    box.click()
        except Exception as ex:
            print(f"[Theyka-Solver] Note during click: {ex}", flush=True)

        start_time = time.time()
        token = None

        while time.time() - start_time < max_timeout:
            inp = page.ele('css:input[name="cf-turnstile-response"]')
            if inp and inp.value and len(inp.value) > 30:
                token = inp.value
                break
            time.sleep(0.8)

        if not token:
            raise Exception("Timeout: Turnstile token was not received.")

        print(f"[Theyka-Solver] [OK] Token successfully obtained! Length: {len(token)}", flush=True)
        return token
    finally:
        try:
            page.quit()
        except Exception:
            pass

@app.route('/turnstile', methods=['POST', 'GET'])
def turnstile_handler():
    if request.method == 'GET':
        return jsonify({
            "status": "ready",
            "service": "Theyka Turnstile-Solver API",
            "usage": "POST JSON { 'url': '...', 'sitekey': '...' }"
        })

    data = request.get_json(force=True, silent=True) or {}
    target_url = data.get('url', 'https://amprem.irfanjawa.com/auth')
    sitekey = data.get('sitekey', '0x4AAAAAADsWLA16vNVNqTCH')

    try:
        token = solve_turnstile(target_url, sitekey)
        return jsonify({
            "status": "success",
            "token": token,
            "turnstile_value": token,
            "url": target_url,
            "timestamp": time.time()
        })
    except Exception as e:
        print(f"[Theyka-Solver Error]: {str(e)}", flush=True)
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "solver": "Theyka Turnstile-Solver"})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Theyka Turnstile-Solver API Server running on http://localhost:{port}/turnstile", flush=True)
    app.run(host='0.0.0.0', port=port, threaded=True)
