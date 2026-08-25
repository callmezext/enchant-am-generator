import os
import sys
import io
import tarfile
import paramiko
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

HOST = "192.168.1.12"
PORT = 22
USER = "root"
PASS = "123"
REMOTE_DIR = "/root/amprem-web"

def create_archive(tar_path):
    print(f"[ARCHIVE] Creating project archive at {tar_path}...", flush=True)
    source_dir = os.path.dirname(os.path.abspath(__file__))
    
    exclude_dirs = {'node_modules', '.git', '.arkana_profile', '.wwebjs_cache', '.wabot_auth'}
    
    with tarfile.open(tar_path, "w:gz") as tar:
        for root, dirs, files in os.walk(source_dir):
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, source_dir)
                if file.endswith('.tar.gz') or file.endswith('.log'):
                    continue
                try:
                    tar.add(full_path, arcname=rel_path)
                except Exception as e:
                    print(f"Skipping locked file {full_path}: {e}", flush=True)
    print(f"[ARCHIVE] Archive created! Size: {os.path.getsize(tar_path) / 1024 / 1024:.2f} MB", flush=True)

def run_remote_cmd(ssh, cmd, ignore_error=False):
    print(f"\n[REMOTE EXEC] >>> {cmd.strip()[:100]}...", flush=True)
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
    for line in iter(stdout.readline, ""):
        print(line, end="", flush=True)
    exit_status = stdout.channel.recv_exit_status()
    if exit_status != 0 and not ignore_error:
        print(f"[REMOTE ERROR] Command exited with code {exit_status}", flush=True)
    return exit_status

def migrate():
    tar_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "amprem_bundle_local.tar.gz")
    create_archive(tar_file)

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"\n[SSH] Connecting to {HOST}:{PORT}...", flush=True)
    ssh.connect(HOST, port=PORT, username=USER, password=PASS, look_for_keys=False, allow_agent=False, timeout=30)
    print("[SSH] Connected successfully!", flush=True)

    # 1. Install prerequisites & packages
    setup_script = """
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y -f
    apt-get install -y wget curl gnupg ca-certificates python3 python3-pip python3-venv xvfb nodejs npm libnss3 libatk1.0-0t64 libatk1.0-0 libatk-bridge2.0-0t64 libatk-bridge2.0-0 libcups2t64 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2t64 libasound2 || true
    
    # Check / install google-chrome
    if ! which google-chrome && ! which google-chrome-stable; then
        echo "Installing Google Chrome..."
        wget -q -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
        apt-get install -y /tmp/chrome.deb || apt-get install -fy
        rm -f /tmp/chrome.deb
    fi

    # Check / install cloudflared
    if ! which cloudflared; then
        echo "Installing cloudflared..."
        wget -q -O /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
        dpkg -i /tmp/cloudflared.deb || apt-get install -fy
        rm -f /tmp/cloudflared.deb
    fi

    # Pip packages
    pip3 install --break-system-packages DrissionPage flask requests || pip3 install DrissionPage flask requests
    
    # PM2
    npm install -g pm2
    """
    run_remote_cmd(ssh, setup_script)

    # 2. Upload archive via SFTP
    print("\n[SFTP] Uploading bundle to server...", flush=True)
    sftp = ssh.open_sftp()
    remote_tar = f"/root/amprem_bundle.tar.gz"
    sftp.put(tar_file, remote_tar)
    print("[SFTP] Upload complete!", flush=True)

    # Upload cloudflared credentials
    local_cf_dir = os.path.expanduser("~/.cloudflared")
    if os.path.exists(local_cf_dir):
        run_remote_cmd(ssh, "mkdir -p /root/.cloudflared")
        for f in os.listdir(local_cf_dir):
            lp = os.path.join(local_cf_dir, f)
            if os.path.isfile(lp):
                rp = f"/root/.cloudflared/{f}"
                print(f"[SFTP] Uploading CF credential {f} -> {rp}", flush=True)
                sftp.put(lp, rp)

    sftp.close()

    # 3. Extract and setup project on server
    deploy_script = f"""
    mkdir -p {REMOTE_DIR}
    tar -xzf /root/amprem_bundle.tar.gz -C {REMOTE_DIR}
    cd {REMOTE_DIR}
    npm install --production=false
    """
    run_remote_cmd(ssh, deploy_script)

    # 4. Start PM2 services on server
    pm2_script = f"""
    cd {REMOTE_DIR}
    pm2 delete all || true

    # Start Main Node server (port 3000)
    pm2 start server.js --name "am-server"

    # Start Cloudflared tunnel
    pm2 start "cloudflared tunnel --url http://localhost:3000 run am-generator" --name "cf-tunnel"

    pm2 save
    pm2 startup || true
    sleep 3
    pm2 status
    """
    run_remote_cmd(ssh, pm2_script)

    # 5. Quick local curl test on server
    time.sleep(3)
    run_remote_cmd(ssh, "curl -sI http://localhost:3000/ || true")

    ssh.close()
    
    try:
        os.remove(tar_file)
    except:
        pass

    print("\n=======================================================")
    print("🚀 MIGRATION TO 192.168.1.12 COMPLETED SUCCESSFULLY!")
    print("=======================================================")

if __name__ == "__main__":
    migrate()
