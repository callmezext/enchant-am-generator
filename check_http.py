import urllib.request
import urllib.error

url = 'https://am.enchant.id/'
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as response:
        print(f"SUCCESS: HTTP {response.status}")
except urllib.error.HTTPError as e:
    print(f"HTTP ERROR: {e.code} - {e.reason}")
except Exception as e:
    print(f"ERROR: {e}")
