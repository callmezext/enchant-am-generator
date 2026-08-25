import socket
import time
import paramiko

print("Waiting 10s for SSH rate limit to cool down...", flush=True)
time.sleep(10)

print("Connecting to 66.33.22.222:11906...", flush=True)
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('66.33.22.222', port=11906, username='root', password='zyetest', timeout=30, banner_timeout=45)
print("CONNECTED SUCCESSFULLY!", flush=True)

stdin, stdout, stderr = ssh.exec_command("pm2 list; curl -s http://127.0.0.1:3000/api/v1/stats")
print(stdout.read().decode('utf-8'))
ssh.close()
