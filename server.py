#!/usr/bin/env python3
"""Serve Starlink Globe on 127.0.0.1:4277 (stdlib only)."""
import http.server, json, os, pathlib, urllib.parse

HERE = pathlib.Path(__file__).resolve().parent
WEB = HERE / "web"
DATA = HERE / "data"
PORT = int(os.environ.get("STARLINK_GLOBE_PORT", "4277"))
HOST = os.environ.get("STARLINK_GLOBE_HOST", "127.0.0.1")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(WEB), **k)

    def log_message(self, fmt, *args):
        pass

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path in ("/api/globe.json", "/api/health", "/healthz"):
            if parsed.path.endswith("globe.json"):
                body = (DATA / "globe.json").read_bytes() if (DATA / "globe.json").exists() else b"{}"
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            body = json.dumps({"ok": True, "service": "starlink-globe", "port": PORT}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

if __name__ == "__main__":
    http.server.ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
