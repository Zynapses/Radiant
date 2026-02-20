#!/usr/bin/env python3
"""Lightweight web UI server for OMEGA Labs + McDonald's Test Site."""
import http.server
import json
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 58023
WEB_DIR = os.path.dirname(os.path.abspath(__file__))
DATASETS_DIR = os.path.join(os.path.dirname(WEB_DIR), 'apps', 'mcdonalds-drive-thru', 'datasets')
MENU_JSON = os.path.join(DATASETS_DIR, 'mcdonalds-knowledge.json')

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def do_GET(self):
        if self.path == '/data/menu':
            self._serve_json(MENU_JSON)
        else:
            super().do_GET()

    def _serve_json(self, path):
        try:
            with open(path, 'r') as f:
                data = f.read()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(data.encode())
        except FileNotFoundError:
            self.send_error(404, f'File not found: {path}')

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

class DualStackHTTPServer(http.server.HTTPServer):
    """HTTPServer that listens on both IPv4 and IPv6 (fixes macOS localhost)."""
    address_family = __import__('socket').AF_INET6

    def server_bind(self):
        import socket
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()

if __name__ == '__main__':
    try:
        httpd = DualStackHTTPServer(('::', PORT), Handler)
    except OSError:
        httpd = http.server.HTTPServer(('0.0.0.0', PORT), Handler)
    print(f"\n  OMEGA Web UI     → http://localhost:{PORT}")
    print(f"  Backend API      → http://localhost:11435")
    print(f"  Menu data        → {MENU_JSON}\n")
    httpd.serve_forever()
