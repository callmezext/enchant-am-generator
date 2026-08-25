import paramiko
import time

for attempt in range(1, 6):
    try:
        print(f"[{attempt}] Connecting to VPS...", flush=True)
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(
            '66.33.22.222', port=11906,
            username='root', password='zyetest',
            look_for_keys=False, allow_agent=False,
            timeout=25, banner_timeout=45
        )
        print("CONNECTED TO VPS!", flush=True)

        # 1. Start cloudflared as background systemd service or nohup
        # 2. Start PM2 server.js
        cmd = """
cd /root/amprem-web
pm2 delete all || true
pm2 start server.js --name am-server
killall -9 cloudflared 2>/dev/null || true
nohup /usr/local/bin/cloudflared tunnel --url http://127.0.0.1:3000 run am-generator > /root/cf.log 2>&1 &
sleep 4
ps aux | grep cloudflared | grep -v grep
curl -sI http://127.0.0.1:3000/ | head -n 4
"""
        stdin, stdout, stderr = ssh.exec_command(cmd)
        print(stdout.read().decode('utf-8', errors='replace'), flush=True)
        ssh.close()
        print("SUCCESSFULLY STARTED ON VPS!", flush=True)
        break
    except Exception as e:
        print(f"[{attempt}] Error: {e}", flush=True)
        time.sleep(5)
