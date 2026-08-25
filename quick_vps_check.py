import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('66.33.22.222', port=11906, username='root', password='zyetest', timeout=15)

commands = [
    "pm2 list",
    "tail -n 25 /root/.pm2/logs/am-server-error.log || true",
    "tail -n 25 /root/.pm2/logs/am-server-out.log || true",
    "tail -n 25 /root/.pm2/logs/cf-tunnel-error.log || true",
    "tail -n 25 /root/.pm2/logs/cf-tunnel-out.log || true",
    "curl -I http://127.0.0.1:3000/ || true"
]

for cmd in commands:
    print(f"\n=== [CMD] {cmd} ===")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=10)
    print(stdout.read().decode('utf-8', errors='replace').strip())

ssh.close()
