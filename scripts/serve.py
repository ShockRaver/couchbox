#!/usr/bin/env python3
# Lokale testserver voor de browser (http://127.0.0.1:8765/), zonder caching:
# zo laadt de browser na elke wijziging altijd alle nieuwe bestanden (geen mix van oud en nieuw).
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, *args):
        pass


os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
print('Couchbox testserver: http://127.0.0.1:%d/' % PORT)
http.server.ThreadingHTTPServer(('127.0.0.1', PORT), NoCache).serve_forever()
