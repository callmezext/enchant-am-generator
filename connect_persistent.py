import paramiko
import time
import socket

print("[1] Testing raw socket connection...")
s = socket.socket()
s.settimeout(10)
s.connect(('66.33.22.222', 11906))
print("[1] Socket connected! Reading banner...")
banner = s.recv(1024)
print(f"[1] Banner received: {banner}")
s.close()

print("\n[2] Connecting with Paramiko with 60s timeout...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('66.33.22.222', port=11906, username='root', password='zyetest', timeout=30, banner_timeout=60, auth_timeout=60)
print("[2] Paramiko connected successfully!")

stdin, stdout, stderr = ssh.exec_command("pm2 list; ps aux | grep node")
print("=== PM2 STATUS ===")
print(stdout.read().decode('utf-8'))
ssh.close()
