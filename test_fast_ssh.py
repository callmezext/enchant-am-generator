import paramiko
import time

print("[SSH] Connecting with look_for_keys=False...", flush=True)
t0 = time.time()
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(
    '66.33.22.222',
    port=11906,
    username='root',
    password='zyetest',
    look_for_keys=False,
    allow_agent=False,
    timeout=15
)
print(f"[SSH] Connected in {time.time()-t0:.2f}s!", flush=True)

stdin, stdout, stderr = ssh.exec_command("""
cd /root/amprem-web
pm2 start server.js --name "am-server" 2>/dev/null || pm2 restart am-server
pm2 start "cloudflared tunnel --url http://localhost:3000 run am-generator" --name "cf-tunnel" 2>/dev/null || pm2 restart cf-tunnel
pm2 save
sleep 2
pm2 status
""")

print("=== OUTPUT ===")
print(stdout.read().decode('utf-8'))
ssh.close()
print("[SSH] Done!")
