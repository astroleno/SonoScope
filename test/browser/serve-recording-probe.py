"""Local-only probe result collector; no app routes or user audio are exposed."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import pathlib
import re
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parents[2]
RESULTS = ROOT / 'test/artifacts/private/recording-20261024'

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, *_args): pass
    def do_POST(self):
        if self.headers.get('Origin') != 'http://127.0.0.1:3111': self.send_error(403); return
        size = int(self.headers.get('Content-Length', 0))
        path = urlparse(self.path).path
        if path == '/__recording-probe' and 0 < size <= 1024 * 1024:
            payload = json.loads(self.rfile.read(size))
            name = payload.get('name', '')
            if not re.fullmatch(r'[a-zA-Z0-9_-]{1,90}', name): self.send_error(400); return
            (RESULTS / (name + '.json')).write_text(json.dumps(payload['report'], ensure_ascii=False, indent=2) + '\n')
        elif path.startswith('/__recording-audio/') and 0 < size <= 8 * 1024 * 1024:
            name = path.removeprefix('/__recording-audio/')
            if not re.fullmatch(r'qa-[a-zA-Z0-9_-]{1,90}\.mp4', name): self.send_error(400); return
            (RESULTS / name).write_bytes(self.rfile.read(size))
        else: self.send_error(400); return
        self.send_response(204); self.end_headers()

ThreadingHTTPServer(('127.0.0.1', 3111), Handler).serve_forever()
