import paramiko
import sys
import os

HOST = "66.33.22.222"
PORT = 11906
USER = "root"
PASS = "zyetest"

def run_ssh():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {HOST}:{PORT} as {USER}...")
    ssh.connect(HOST, port=PORT, username=USER, password=PASS, timeout=15)
    print("Connected successfully!")
    
    commands = [
        "uname -a",
        "lsb_release -a || cat /etc/os-release",
        "free -h",
        "df -h /",
        "nproc",
        "which node npm python3 pip3 pm2 google-chrome chromium cloudflared || true"
    ]
    
    for cmd in commands:
        print(f"\n--- [CMD] {cmd} ---")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode('utf-8').strip()
        err = stderr.read().decode('utf-8').strip()
        if out:
            print(out)
        if err:
            print(f"[ERR] {err}")
            
    ssh.close()

if __name__ == "__main__":
    run_ssh()
