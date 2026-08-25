import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('66.33.22.222', port=11906, username='root', password='zyetest', timeout=20)

setup_cmd = """
# Start cloudflared as a systemd service or background daemon
pkill -f cloudflared || true
pkill -f server.js || true

# Test running server.js directly to see stdout/stderr
cd /root/amprem-web
node server.js > /root/server.log 2>&1 &
sleep 3
cat /root/server.log

# Run cloudflared
cloudflared tunnel --url http://localhost:3000 run am-generator > /root/cloudflared.log 2>&1 &
sleep 4
cat /root/cloudflared.log | head -n 25
"""

stdin, stdout, stderr = ssh.exec_command(setup_cmd)
print("=== OUTPUT ===")
print(stdout.read().decode('utf-8', errors='replace'))
print("=== ERROR ===")
print(stderr.read().decode('utf-8', errors='replace'))

ssh.close()
