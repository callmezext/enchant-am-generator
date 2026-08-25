import paramiko
import time

def start_and_verify():
    for attempt in range(5):
        try:
            print(f"[SSH] Connecting to 66.33.22.222:11906 (attempt {attempt+1})...", flush=True)
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect('66.33.22.222', port=11906, username='root', password='zyetest', timeout=20, banner_timeout=45)
            print("[SSH] Connected!", flush=True)
            
            # Setup PM2 ecosystem properly
            setup_cmd = """
cd /root/amprem-web
pm2 delete all || true

# Start Node Server
pm2 start server.js --name "am-server"

# Start Cloudflared Tunnel
pm2 start cloudflared --name "cf-tunnel" -- tunnel --url http://localhost:3000 run am-generator

pm2 save
sleep 3
pm2 status
"""
            stdin, stdout, stderr = ssh.exec_command(setup_cmd)
            print(stdout.read().decode('utf-8', errors='replace'))
            
            # Check cloudflared log
            stdin, stdout, stderr = ssh.exec_command("tail -n 25 /root/.pm2/logs/cf-tunnel-out.log /root/.pm2/logs/cf-tunnel-error.log || true")
            print("=== CF LOGS ===")
            print(stdout.read().decode('utf-8', errors='replace'))
            
            ssh.close()
            return True
        except Exception as e:
            print(f"Error: {e}", flush=True)
            time.sleep(3)
    return False

if __name__ == "__main__":
    start_and_verify()
