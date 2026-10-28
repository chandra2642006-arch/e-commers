"""
Automatic, persistent live public tunnel manager.
Reconnects automatically if connection resets and writes active URL to tunnel_url.txt.
"""
import subprocess
import re
import sys
import time

def run_tunnel():
    cmd = [
        "ssh",
        "-o", "StrictHostKeyChecking=no",
        "-o", "UserKnownHostsFile=/dev/null",
        "-o", "ExitOnForwardFailure=yes",
        "-R", "80:127.0.0.1:5000",
        "nokey@localhost.run"
    ]
    while True:
        try:
            print("[Tunnel] Starting localhost.run SSH tunnel...")
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
            for line in proc.stdout:
                print(line, end="")
                match = re.search(r"https://[a-zA-Z0-9-]+\.lhr\.life", line)
                if match:
                    url = match.group(0)
                    with open("tunnel_url.txt", "w") as f:
                        f.write(url)
                    print(f"\n==========================================")
                    print(f"🌟 ACTIVE PUBLIC LIVE LINK: {url}")
                    print(f"==========================================\n")
            proc.wait()
        except Exception as e:
            print(f"[Tunnel] Error: {e}")
        time.sleep(2)

if __name__ == "__main__":
    run_tunnel()
