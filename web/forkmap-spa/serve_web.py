#!/usr/bin/env python3
"""T-39 dev helper: serve the built SPA's dist/ over plain HTTP.

The production build is self-contained: vite.config.ts mirrors the committed
bundle's runtime-fetched files (manifest, journal slice, per-release rows,
align index, column + payload buckets) into dist/forkmap/data, and the SPA
fetches that namespace document-relative — so the served root is the dist
directory itself, with no sibling web/forkmap tree consulted. Run:

    python3 web/forkmap-spa/serve_web.py   # then hit http://127.0.0.1:8765/
"""
import http.server
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, "dist")
if not os.path.isdir(DIST):
    raise SystemExit("dist/ not found — run `bun run build` in web/forkmap-spa first")
ROOT = DIST


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, *args):  # keep the smoke output clean
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), QuietHandler) as httpd:
        print(f"serving {ROOT} at http://127.0.0.1:{port}/", flush=True)
        httpd.serve_forever()
