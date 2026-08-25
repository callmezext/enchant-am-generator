import paramiko
import time

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(
        '66.33.22.222', port=11906,
        username='root', password='zyetest',
        look_for_keys=False, allow_agent=False,
        timeout=15
    )
    print("SSH CONNECTED!")
    stdin, stdout, stderr = ssh.exec_command("cd /root/amprem-web && pm2 start server.js --name am-server; pm2 start cloudflared --name cf-tunnel -- tunnel --url http://localhost:3000 run am-generator; pm2 save; sleep 2; pm2 status")
    print(stdout.read().decode('utf-8', errors='replace'))
    ssh.close()
except Exception as e:
    print("ERR:", e)
