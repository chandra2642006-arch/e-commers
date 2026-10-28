"""
Automatic, persistent live public tunnel manager.
Reconnects automatically if connection resets and writes active URL to tunnel_url.txt.
"""
import subprocess
import re
import sys
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

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
            print("[Tunnel] Starting localhost.run SSH tunnel...", flush=True)
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1
            )
            for line in proc.stdout:
                try:
                    sys.stdout.write(line)
                    sys.stdout.flush()
                except Exception:
                    pass
                match = re.search(r"https://[a-zA-Z0-9-]+\.lhr\.life", line)
                if match:
                    url = match.group(0)
                    try:
                        with open("tunnel_url.txt", "w", encoding="utf-8") as f:
                            f.write(url)
                    except Exception:
                        pass
                    print(f"\n==========================================", flush=True)
                    print(f"[Tunnel] Active Public URL: {url}", flush=True)
                    print(f"==========================================\n", flush=True)
            proc.wait()
        except Exception as e:
            print(f"[Tunnel] Error: {e}", flush=True)
        time.sleep(3)

if __name__ == "__main__":
    run_tunnel()
