import paramiko
import time
import sys

# Wait for any rate limiting to expire
print("Waiting 5s for SSH cooldown...", flush=True)
time.sleep(5)

print("Connecting to VPS 66.33.22.222:11906...", flush=True)
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(
    '66.33.22.222', port=11906,
    username='root', password='zyetest',
    look_for_keys=False, allow_agent=False,
    timeout=30, banner_timeout=60, auth_timeout=60
)
print("CONNECTED!", flush=True)

cmd = """cd /root/amprem-web
pm2 delete all 2>/dev/null || true
pm2 start server.js --name am-server
pm2 start cloudflared --name cf-tunnel -- tunnel --url http://localhost:3000 run am-generator
pm2 save
sleep 4
pm2 status
curl -sI http://localhost:3000/ | head -3
"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='replace'), flush=True)
print(stderr.read().decode('utf-8', errors='replace'), flush=True)
ssh.close()
print("ALL DONE!", flush=True)
