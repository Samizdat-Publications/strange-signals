#!/usr/bin/env python3
"""
STRANGE SIGNALS + GardenSync — API Proxy Server
Handles CORS for browser-to-API requests (Gemini + Claude).
Run: python3 proxy.py
Serves the app on http://localhost:8080 and proxies /api/gemini/* and /api/claude/*.

API keys can be provided via:
  1. Request headers (x-goog-api-key, x-api-key) — existing browser-side flow
  2. .env file (GEMINI_API_KEY, CLAUDE_API_KEY) — server-side fallback
"""

import http.server
import json
import os
import ssl
import urllib.request
import urllib.error
from urllib.parse import urlparse, parse_qs

# Load .env file if python-dotenv is available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # python-dotenv not installed — keys must come from headers or OS env
    pass

PORT = int(os.environ.get('PROXY_PORT', 8080))
GEMINI_API_BASE = "https://generativelanguage.googleapis.com"

class GardenSyncHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # CORS headers for all responses
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, x-goog-api-key, x-api-key, anthropic-version')
        # Disable caching for dev
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        """Proxy POST requests to Gemini or Claude API"""
        if self.path.startswith('/api/gemini/'):
            self.proxy_to_gemini()
        elif self.path.startswith('/api/claude/'):
            self.proxy_to_claude()
        else:
            self.send_response(404)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Not found"}).encode())

    def proxy_to_gemini(self):
        try:
            # Build the target URL
            # /api/gemini/v1beta/models/gemini-2.5-flash-image:generateContent
            # -> https://generativelanguage.googleapis.com/v1beta/models/...
            gemini_path = self.path.replace('/api/gemini/', '/')
            target_url = GEMINI_API_BASE + gemini_path

            # Read the request body
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)

            # Get API key: header first, then .env fallback
            api_key = self.headers.get('x-goog-api-key', '') or os.environ.get('GEMINI_API_KEY', '')

            # Build the proxied request
            req = urllib.request.Request(
                target_url,
                data=body,
                headers={
                    'Content-Type': 'application/json',
                    'x-goog-api-key': api_key,
                },
                method='POST'
            )

            # Disable SSL verification for simplicity (dev only)
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE

            # Make the request to Gemini
            with urllib.request.urlopen(req, context=ctx, timeout=120) as resp:
                response_data = resp.read()
                self.send_response(resp.status)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(response_data)

        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8', errors='replace')
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(error_body.encode())

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_msg = json.dumps({"error": {"message": str(e)}})
            self.wfile.write(error_msg.encode())

    def proxy_to_claude(self):
        """Proxy POST requests to Anthropic Claude API"""
        try:
            # /api/claude/v1/messages -> https://api.anthropic.com/v1/messages
            claude_path = self.path.replace('/api/claude/', '/')
            target_url = "https://api.anthropic.com" + claude_path

            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)

            # Get API key: header first, then .env fallback
            api_key = self.headers.get('x-api-key', '') or os.environ.get('CLAUDE_API_KEY', '')
            anthropic_version = self.headers.get('anthropic-version', '2023-06-01')

            req = urllib.request.Request(
                target_url,
                data=body,
                headers={
                    'Content-Type': 'application/json',
                    'x-api-key': api_key,
                    'anthropic-version': anthropic_version,
                },
                method='POST'
            )

            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE

            with urllib.request.urlopen(req, context=ctx, timeout=120) as resp:
                response_data = resp.read()
                self.send_response(resp.status)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(response_data)

        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8', errors='replace')
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(error_body.encode())

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_msg = json.dumps({"error": {"message": str(e)}})
            self.wfile.write(error_msg.encode())

    def log_message(self, format, *args):
        """Custom log with color"""
        if '/api/gemini/' in str(args[0]):
            print(f"\033[32m[GEMINI]\033[0m {args[0]}")
        elif '/api/claude/' in str(args[0]):
            print(f"\033[35m[CLAUDE]\033[0m {args[0]}")
        elif '404' in str(args[1]) if len(args) > 1 else False:
            print(f"\033[31m[404]\033[0m {args[0]}")
        else:
            # Suppress normal static file logs to reduce noise
            pass


if __name__ == '__main__':
    import subprocess
    import signal
    import sys

    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    # Force UTF-8 output on Windows
    if sys.platform == 'win32':
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')

    # Auto-kill anything already on the port
    try:
        if sys.platform == 'win32':
            result = subprocess.run(
                ['netstat', '-ano'], capture_output=True, text=True
            )
            for line in result.stdout.splitlines():
                if f':{PORT}' in line and 'LISTENING' in line:
                    pid = line.strip().split()[-1]
                    subprocess.run(['taskkill', '/F', '/PID', pid],
                                   capture_output=True)
                    print(f"Killed old process on port {PORT} (PID {pid})")
                    import time
                    time.sleep(1)
        else:
            result = subprocess.run(['lsof', '-ti', f':{PORT}'], capture_output=True, text=True)
            if result.stdout.strip():
                for pid in result.stdout.strip().split('\n'):
                    try:
                        os.kill(int(pid), signal.SIGKILL)
                        print(f"Killed old process on port {PORT} (PID {pid})")
                    except:
                        pass
                import time
                time.sleep(1)
    except:
        pass

    gemini_loaded = '***SET***' if os.environ.get('GEMINI_API_KEY') else 'not set (use header or .env)'
    claude_loaded = '***SET***' if os.environ.get('CLAUDE_API_KEY') else 'not set (use header or .env)'
    print(f"""
  STRANGE SIGNALS + GARDENSYNC // API Proxy
  Server running on http://localhost:{PORT}
  Gemini API proxy: /api/gemini/*  [key: {gemini_loaded}]
  Claude API proxy: /api/claude/*  [key: {claude_loaded}]
  Press Ctrl+C to stop
""")

    import socketserver
    socketserver.TCPServer.allow_reuse_address = True
    server = http.server.HTTPServer(('', PORT), GardenSyncHandler)
    server.allow_reuse_address = True
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.server_close()
