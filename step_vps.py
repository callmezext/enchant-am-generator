import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(
    '66.33.22.222', port=11906,
    username='root', password='zyetest',
    look_for_keys=False, allow_agent=False,
    timeout=30, banner_timeout=60, auth_timeout=60
)
print("CONNECTED!")

# Run each command separately so we get instant output
commands = [
    "pm2 list",
    "pm2 delete all || true",
    "cd /root/amprem-web && pm2 start server.js --name am-server",
    "pm2 start cloudflared --name cf-tunnel -- tunnel --url http://localhost:3000 run am-generator",
    "pm2 save",
    "sleep 2",
    "pm2 status",
    "curl -sI http://localhost:3000/ | head -n 5"
]

for cmd in commands:
    print(f"\n>>> {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
    print(stdout.read().decode('utf-8', errors='replace').strip())
    err = stderr.read().decode('utf-8', errors='replace').strip()
    if err:
        print(f"[STDERR]: {err}")

ssh.close()
print("\nALL COMMANDS FINISHED!")
