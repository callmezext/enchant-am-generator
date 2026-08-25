import paramiko
import time
import sys

def main():
    print("[1] Connecting to VPS...", flush=True)
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('66.33.22.222', port=11906, username='root', password='zyetest', timeout=30)
    print("[1] Connected successfully!", flush=True)

    cmd = """
cd /root/amprem-web
pm2 delete all || true

# Start server
pm2 start server.js --name "am-server"

# Start cloudflared tunnel
pm2 start "cloudflared tunnel --url http://localhost:3000 run am-generator" --name "cf-tunnel"

pm2 save
sleep 3
pm2 status
"""
    print("[2] Executing PM2 start...", flush=True)
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    print("=== PM2 STATUS ===")
    print(out)
    if err:
        print("=== STDERR ===")
        print(err)

    ssh.close()
    print("[3] Done!", flush=True)

if __name__ == '__main__':
    main()
