import paramiko
import time
import sys

print("[SSH] Connecting to 66.33.22.222:11906...", flush=True)
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('66.33.22.222', port=11906, username='root', password='zyetest', timeout=20)
print("[SSH] Connected!", flush=True)

stdin, stdout, stderr = ssh.exec_command("cd /root/amprem-web && pm2 restart all && sleep 2 && pm2 list")
print(stdout.read().decode('utf-8', errors='replace'), flush=True)

stdin, stdout, stderr = ssh.exec_command("curl -s http://127.0.0.1:3000/api/v1/stats || curl -I http://127.0.0.1:3000/")
print("=== LOCAL CURL TEST ===", flush=True)
print(stdout.read().decode('utf-8', errors='replace'), flush=True)

ssh.close()
print("[SSH] Done!", flush=True)
