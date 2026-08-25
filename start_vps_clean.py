import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(
    '66.33.22.222', port=11906,
    username='root', password='zyetest',
    look_for_keys=False, allow_agent=False,
    timeout=20
)
print("Connected to VPS via SSH!")

transport = ssh.get_transport()
channel = transport.open_session()
# Run pm2 start and cloudflared in detached background mode so connection doesn't block or drop
channel.exec_command("cd /root/amprem-web && pm2 start server.js --name am-server; nohup /usr/local/bin/cloudflared tunnel --url http://127.0.0.1:3000 run am-generator > /root/cf.log 2>&1 &")
time.sleep(4)

stdin, stdout, stderr = ssh.exec_command("pm2 status; ps aux | grep cloudflared | grep -v grep; tail -n 15 /root/cf.log")
print(stdout.read().decode('utf-8', errors='replace'))

ssh.close()
