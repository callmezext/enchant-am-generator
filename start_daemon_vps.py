import paramiko
import time

def run():
    for attempt in range(5):
        try:
            print(f"[SSH] Attempt {attempt+1} connecting to 66.33.22.222:11906...")
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect('66.33.22.222', port=11906, username='root', password='zyetest', timeout=30, banner_timeout=60, auth_timeout=60)
            print("[SSH] Connected successfully!")
            
            script = """
# 1. Kill old processes
killall -9 node cloudflared python3 2>/dev/null || true
sleep 1

# 2. Start server in background with nohup
cd /root/amprem-web
nohup node server.js > /root/server.log 2>&1 < /dev/null &
sleep 2

# 3. Start cloudflared in background with nohup
nohup /usr/local/bin/cloudflared tunnel --url http://127.0.0.1:3000 run am-generator > /root/cf.log 2>&1 < /dev/null &
sleep 3

# 4. Check status
ps aux | grep -E "node|cloudflared" | grep -v grep
echo "--- SERVER LOG ---"
cat /root/server.log | head -n 30
echo "--- CF TUNNEL LOG ---"
cat /root/cf.log | head -n 30
"""
            stdin, stdout, stderr = ssh.exec_command(script, get_pty=False)
            print(stdout.read().decode('utf-8', errors='replace'))
            ssh.close()
            return True
        except Exception as e:
            print(f"[SSH] Attempt {attempt+1} failed: {e}")
            time.sleep(3)
    return False

if __name__ == "__main__":
    run()
