"""Private loopback worker. The Node gateway is the only public listener."""
import json
import os
from http.server import ThreadingHTTPServer
from urllib.parse import urlsplit
import server
import upstox_feed

class Handler(server.Handler):
    def do_GET(self):
        path = urlsplit(self.path).path
        if not upstox_feed.authorized(self.headers.get('X-HAL-Viewer-Key', '')):
            return self._send(403, b'{"error":"unauthorized"}', 'application/json')
        if path not in ('/health', '/api/data', '/api/agents', '/api/upstox/hal', '/api/upstox/research'):
            return self._send(404, b'{"error":"not_found"}', 'application/json')
        super().do_GET()

if __name__ == '__main__':
    httpd = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    print(json.dumps({'port': httpd.server_port}), flush=True)
    httpd.serve_forever()
