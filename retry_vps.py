import paramiko
import time

for attempt in range(1, 10):
    try:
        print(f"[{attempt}] Connecting to VPS...", flush=True)
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(
            '66.33.22.222', port=11906,
            username='root', password='zyetest',
            look_for_keys=False, allow_agent=False,
            timeout=15, banner_timeout=30, auth_timeout=30
        )
        print("CONNECTED SUCCESSFULLY!", flush=True)
        
        stdin, stdout, stderr = ssh.exec_command("""
cd /root/amprem-web
pm2 start server.js --name am-server || pm2 restart am-server
pm2 start cloudflared --name cf-tunnel -- tunnel --url http://localhost:3000 run am-generator || pm2 restart cf-tunnel
pm2 save
sleep 3
pm2 status
""")
        print(stdout.read().decode('utf-8', errors='replace'))
        ssh.close()
        print("DONE!")
        break
    except Exception as e:
        print(f"[{attempt}] Failed: {e}", flush=True)
        time.sleep(3)
