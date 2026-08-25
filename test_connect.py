import paramiko
import time

for attempt in range(5):
    try:
        print(f"Connecting attempt {attempt+1}...", flush=True)
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect('66.33.22.222', port=11906, username='root', password='zyetest', timeout=15)
        print("Connected!", flush=True)
        
        stdin, stdout, stderr = ssh.exec_command("pm2 list; systemctl status pm2-root || true")
        print(stdout.read().decode('utf-8'))
        ssh.close()
        break
    except Exception as e:
        print(f"Error: {e}", flush=True)
        time.sleep(3)
