import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('66.33.22.222', port=11906, username='root', password='zyetest')

setup_tunnel = """
cat << 'EOF' > /root/run_tunnel.sh
#!/bin/bash
exec /usr/local/bin/cloudflared tunnel --url http://localhost:3000 run am-generator
EOF
chmod +x /root/run_tunnel.sh

pm2 delete all || true
cd /root/amprem-web
pm2 start server.js --name "am-server"
pm2 start /root/run_tunnel.sh --name "cf-tunnel"
pm2 save
sleep 3
pm2 status
"""

stdin, stdout, stderr = ssh.exec_command(setup_tunnel)
print(stdout.read().decode('utf-8'))
print(stderr.read().decode('utf-8'))

time.sleep(3)
stdin, stdout, stderr = ssh.exec_command("curl -I http://localhost:3000/; pm2 logs cf-tunnel --lines 15 --nostream")
print(stdout.read().decode('utf-8'))
ssh.close()
