"""Serve the review build for the browser gates, with a backlog that survives a boot.

`python3 -m http.server` is a `ThreadingHTTPServer` with the socketserver default
listen backlog of 5. A game boot opens far more connections than that in one
burst (the entry chunk, the app chunk, ~200 assets, fonts, audio), and when the
backlog overflows the kernel drops the waiting connections. Chromium reports
those as:

  net::ERR_SOCKET_NOT_CONNECTED
  Failed to fetch dynamically imported module: …/assets/main-<hash>.js
  Unable to preload CSS for …/assets/style-<hash>.css

Measured 2026-11-26: five failures across four gates in one afternoon, each
looking like a product defect (a 240 s boot timeout, or a prologue that started
silent because a voice file never arrived) while the same files fetched over curl
in ~1 ms. This server raises the backlog to 256 and enables keep-alive so a boot
reuses its connections instead of opening one per asset.

    python3.13 scripts/serve-review.py [--dir dist-review] [--port 5294]
"""
from __future__ import annotations

import argparse
import functools
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'  # keep-alive: one connection carries many assets

    def log_message(self, fmt, *args):  # a boot is ~200 requests; log only failures
        status = args[1] if len(args) > 1 else ''
        if str(status).startswith(('4', '5')):
            super().log_message(fmt, *args)


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 256  # socketserver default is 5; a boot overflows it


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--dir', default='dist-review')
    parser.add_argument('--port', type=int, default=int(os.environ.get('PORT', '5294')))
    args = parser.parse_args()
    handler = functools.partial(Handler, directory=args.dir)
    server = Server(('127.0.0.1', args.port), handler)
    print(f'serving {args.dir} on http://127.0.0.1:{args.port}/ '
          f'(backlog {server.request_queue_size}, HTTP/1.1 keep-alive)', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
