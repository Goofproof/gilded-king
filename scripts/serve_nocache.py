# Dev server with caching disabled (Claude, 2026-07-15).
#
# python -m http.server sends no Cache-Control, so Chrome HEURISTICALLY caches the
# JS for minutes at a time - live-verification kept testing stale code until a manual
# hard refresh landed. This clone of the stdlib server adds no-store to every response
# so a plain reload always runs what is on disk.
#
#     python scripts/serve_nocache.py [port]    (default 8471, serves the repo root)
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8471
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, *args):  # keep the console quiet
        pass


if __name__ == '__main__':
    http.server.ThreadingHTTPServer(('', PORT), NoCacheHandler).serve_forever()
