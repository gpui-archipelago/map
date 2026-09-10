#!/usr/bin/env python3
"""T-33 measurement: served first-visit bytes per route over plain HTTP.

The before/after numbers every T-33 increment records (and the T-32
real-host re-measurement) follow this method: load each route in a FRESH
headless-Chrome profile over plain HTTP on a counting server, and sum the
response body bytes per route (plus a per-file breakdown of anything over
100 KB). A fresh profile per route means no cross-route cache, so every data
fetch is a full 200 — the "first visit" byte count. Report totals per route:

    python3 web/forkmap-spa/measure-routes.py [dist-origin-path] [route ...]

Default dist-origin-path is / (a built `bun run build` in web/forkmap-spa/dist/,
served by serve_web.py at the origin root — the artifact is self-contained,
its forkmap/data mirror included). An explicit dist-origin-path measures the
same artifact under another hosted path, e.g. a real host's URL prefix.

Prereqs: a prior `bun run build` and google-chrome on PATH. Headless Chrome
needs sockets + ptrace, so sandboxed shells must run this unsandboxed (same
as smoke.py).
"""
import os
import subprocess
import sys
import threading
import time
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import serve_web  # noqa: E402  (same directory — QuietHandler over web/)

PORT = 8771


class CountingHandler(serve_web.QuietHandler):
    tally = None  # dict[(method, path)] -> body bytes

    def copyfile(self, source, outputfile):
        total = 0
        while True:
            buf = source.read(65536)
            if not buf:
                break
            outputfile.write(buf)
            total += len(buf)
        if self.tally is not None:
            key = (self.command, self.path)
            self.tally[key] = self.tally.get(key, 0) + total
        return total


def wait_port(port, timeout=10.0):
    import socket

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=1):
                return True
        except OSError:
            time.sleep(0.1)
    return False


def measure(dist_prefix: str, frag: str) -> dict:
    tally: dict = {}
    CountingHandler.tally = tally
    profile = f"/tmp/gocar-measure-profile-{os.getpid()}-{abs(hash(frag))}"
    env = os.environ.copy()
    env["HOME"] = "/tmp/gocar-measure-home"
    os.makedirs(env["HOME"], exist_ok=True)
    url = f"http://127.0.0.1:{PORT}{dist_prefix}{frag}"
    subprocess.run(
        [
            "google-chrome-stable",
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--disable-crash-reporter",
            f"--user-data-dir={profile}",
            "--virtual-time-budget=30000",
            "--dump-dom",
            url,
        ],
        capture_output=True,
        text=True,
        timeout=150,
        env=env,
    )
    CountingHandler.tally = None
    return tally


def main() -> int:
    args = sys.argv[1:]
    dist_prefix = args[0] if args else "/"
    frags = args[1:] or ["#/alignment?item=fn:Window::blur"]
    server = ThreadingHTTPServer(("127.0.0.1", PORT), CountingHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        if not wait_port(PORT):
            print("server did not start")
            return 1
        for frag in frags:
            tally = measure(dist_prefix, frag)
            total = sum(tally.values())
            print(f"route {frag}")
            print(f"  total served bytes: {total}")
            for (method, path), n in sorted(tally.items(), key=lambda kv: -kv[1]):
                if n >= 100_000:
                    print(f"    {n:>12,}  {method} {path}")
            print(f"    requests: {len(tally)}")
    finally:
        server.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
