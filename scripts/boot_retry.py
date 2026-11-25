"""Boot a page against the local review server, retrying one dropped module load.

The review build's entry chunk is tiny and dynamically imports the real app
chunk (`assets/main-<hash>.js`, ~260 KB). The local server used by these gates is
`python3 -m http.server` or a `ThreadingHTTPServer` in the same family, and under
load it has dropped that request, leaving the page a blank shell forever:

  2026-11-25  robot playtest                 Failed to fetch dynamically imported module
  2026-11-26  check-fullscreen 844x390, x2   net::ERR_SOCKET_NOT_CONNECTED
  2026-11-26  check-campaign-style, b4       240 s with no window.__CAMPUS

The same file fetched over curl five times out of five in about 1 ms while those
runs were failing, so the drop is a socket-level accident on a loaded machine,
not a broken bundle. A gate that reports it as a product defect is wrong.

So: one retry, only for that error family, and the retry is printed — a run that
needed it stays visible in the log. A real bundle failure (a 404 on a hashed
name, a syntax error, an exception thrown during boot) is not in the pattern and
propagates unchanged.
"""
import re

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError

DROP_PATTERN = re.compile(
    r'ERR_SOCKET_NOT_CONNECTED|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED'
    r'|ERR_CONNECTION_REFUSED|ERR_HTTP2_PROTOCOL_ERROR'
    # Vite's modulepreload helper phrases a dropped stylesheet this way; seen on
    # the b4 checkpoint, 2026-11-26, immediately before a successful reload.
    r'|Unable to preload CSS'
    r'|Failed to fetch dynamically imported module')


def boot_with_retry(page, url, ready_js, *, timeout=240000, settle=1500,
                    wait_until='domcontentloaded', label='boot'):
    """Navigate to `url` and wait for `ready_js` to be truthy.

    Returns the number of attempts used (1 = no retry). Raises
    PlaywrightTimeoutError if the page is still not ready and nothing looked like
    a dropped socket, and RuntimeError if the module load was dropped twice.
    """
    drops = []

    def on_failed(request):
        try:
            failure = request.failure
        except Exception:
            failure = None
        if failure:
            drops.append(str(failure))

    def on_error(error):
        drops.append(str(error))

    page.on('requestfailed', on_failed)
    page.on('pageerror', on_error)
    try:
        for attempt in (1, 2):
            drops.clear()
            page.goto(url, wait_until=wait_until, timeout=timeout)
            # A module that never loads fails within a second of the document
            # being ready, while a slow boot only takes longer. Sampling here
            # separates the two so the retry does not sit out the whole budget.
            if settle:
                page.wait_for_timeout(settle)
            if any(DROP_PATTERN.search(text) for text in drops):
                if attempt == 2:
                    raise RuntimeError('local server dropped a module load twice: ' + drops[-1])
                print(f'  {label}: local server dropped a module load ({drops[-1][:140]}); '
                      'reloading once', flush=True)
                continue
            try:
                page.wait_for_function(ready_js, timeout=timeout)
                return attempt
            except PlaywrightTimeoutError:
                if attempt == 2 or not any(DROP_PATTERN.search(text) for text in drops):
                    raise
                print(f'  {label}: local server dropped a module load ({drops[-1][:140]}); '
                      'reloading once', flush=True)
    finally:
        page.remove_listener('requestfailed', on_failed)
        page.remove_listener('pageerror', on_error)
