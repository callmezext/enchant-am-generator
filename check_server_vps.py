import paramiko
import time

def connect_ssh():
    for attempt in range(5):
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect('66.33.22.222', port=11906, username='root', password='zyetest', timeout=20, banner_timeout=30)
            return ssh
        except Exception as e:
            print(f"Attempt {attempt+1} failed: {e}")
            time.sleep(2)
    raise Exception("Could not connect to SSH")

ssh = connect_ssh()
cmds = [
    'pm2 status',
    'pm2 logs am-server --lines 40 --nostream',
    'pm2 logs cf-tunnel --lines 30 --nostream',
    'curl -I http://127.0.0.1:3000/'
]
for c in cmds:
    print('=== ' + c + ' ===')
    stdin, stdout, stderr = ssh.exec_command(c)
    print(stdout.read().decode('utf-8'))
ssh.close()
