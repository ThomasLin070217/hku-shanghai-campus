"""Print the deck to an A4-landscape PDF with headless Chrome.

Same settings the README asks for in Chrome's dialog: A4 landscape, no
margins, 100 % scale, background graphics on. The print CSS (deck.html
@media print) already fixes the page box, so prefer_css_page_size is enough.
"""
import os

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
DECK = os.path.join(HERE, 'deck.html')
OUT = os.path.join(HERE, 'hku-barrier-2030-deck.pdf')
CHROME = os.environ.get('CHROME_PATH', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=CHROME, headless=True,
                                     args=['--allow-file-access-from-files'])
        page = browser.new_page(viewport={'width': 1123, 'height': 794})
        page.goto('file://' + DECK, wait_until='load', timeout=120000)
        page.wait_for_timeout(1200)
        # Every <img> must have decoded before printing, or a slot prints empty.
        page.wait_for_function(
            '() => [...document.images].every(i => i.complete) && document.fonts.status === "loaded"',
            timeout=60000)
        page.pdf(path=OUT, width='297mm', height='210mm', print_background=True,
                 margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'},
                 prefer_css_page_size=True)
        print('wrote', OUT, os.path.getsize(OUT), flush=True)
        browser.close()


main()
