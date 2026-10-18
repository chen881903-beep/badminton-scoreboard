"""Localhost PWA preview matching the GitHub Pages project path. No dependencies."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse

ROOT = Path(__file__).resolve().parent.parent
PREFIX = '/badminton-scoreboard/'

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if not self.path.split('?', 1)[0].startswith(PREFIX):
            self.send_error(404)
            return
        self.path = '/' + self.path[len(PREFIX):]
        # Preview serves app resources only, never local Git metadata or tools.
        name = self.path.split('?', 1)[0].lstrip('/')
        allowed = {'', 'index.html', 'app.js', 'scoring.js', 'style.css',
                   'pwa.js', 'sw.js', 'manifest.webmanifest',
                   'icons/icon-192.png', 'icons/icon-512.png'}
        if name not in allowed:
            self.send_error(404)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8001)
    args = parser.parse_args()
    print(f'PWA preview: http://localhost:{args.port}{PREFIX}', flush=True)
    # Loopback only: no changes to the existing phone server on port 8000.
    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
