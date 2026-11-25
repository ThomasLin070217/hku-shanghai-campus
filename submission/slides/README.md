# HKU: Barrier 2030 — submission deck

## Open

Double-click `deck.html`, or open it in Chrome from disk. It is a self-contained offline deck: inline CSS and JavaScript, no build step, no CDN, and no external fonts.

- `→`, `↓`, `Page Down`, or `Space`: next slide
- `←`, `↑`, or `Page Up`: previous slide
- `Home` / `End`: first / last slide
- `Print`: opens Chrome’s print dialog
- A hash such as `#slide-6` opens directly on slide 6

The five screenshot slots load local files from `shots/`. If a file is missing, the slide keeps a captioned CSS panel; no image is fabricated.

## Export to PDF in Chrome

1. Open `deck.html` in Chrome.
2. Press `Cmd+P` on macOS or `Ctrl+P` on Windows/Linux.
3. Destination: **Save as PDF**.
4. Layout: **Landscape**.
5. Paper size: **A4**. The deck requests A4 landscape in its `@page` rule.
6. Margins: **None**.
7. Scale: **100%**.
8. Options: turn **Background graphics** on.
9. Turn **Headers and footers** off.
10. Save as `hku-barrier-2030-deck.pdf` and confirm the result has **14 pages**.

`hku-barrier-2030-deck.pdf` in this folder is that export, produced with `tools/export-pdf.py` on 2026-11-26 and checked page by page with `pdftoppm`: 14 pages, A4 landscape, every screenshot present, nothing clipped.

The print stylesheet keeps each 16:9 slide centred on an A4 landscape page and forces a page break after slides 1–13. Dark ink fills the page around the 16:9 stage, so there are no white browser-default margins.

## Screenshot files expected

Place these files beside the deck, inside `shots/`:

- `shots/bus.png`
- `shots/dinner.png`
- `shots/lobby.png`
- `shots/laptop.png`
- `shots/finale.png`

The finale image is captioned as a prototype, not as shipped gameplay.

## Regenerate the shots and the PDF

Both scripts drive headless Chrome through Playwright; both take `CHROME_PATH` and `CAMPUS_URL`.

```bash
CAMPUS_URL=http://127.0.0.1:5294/ python3.13 tools/capture-shots.py   # needs the review build
python3.13 tools/export-pdf.py                                        # deck.html -> the PDF
```

`capture-shots.py` boots `?experience=opening&intro=0&checkpoint=b5|b6&shell=1` on the review build
and poses the camera from the source constants in `src/opening/spatialLayout.ts` and `b4Office.ts`.
The hole in the review build is pointer lock, which headless Chrome denies: the script presses a key
to claim the save and then calls `explorer.enterCompat()`. `?shell=1` is what hides the authoring
chrome; without it the slides would show staff furniture.

## Resolved conflict

The brief’s older visual framing — “HKU Shanghai at War” with “BARRIER 2030” as subtitle — conflicts with the approved outline and final provenance audit. The audit’s owner ruling wins: the title is **HKU: Barrier 2030** and the subtitle is **A CDS campus story**.

The audit also supersedes the earlier slide-11 payload status. This deck says the slow-load P1 is fixed by measurement: first click 4.23 MB instead of 19.33 MB, `dist` 30.8 MB, with `check:payload` enforcing both ceilings. It does not repeat the audit’s cut claim that asset load is still open.

## Six-line self-check

1. **Numbers:** every printed timing, distance, percentage, grid size and gate count matches the approved outline; locked values are verbatim and none were rounded.
2. **Slides:** all 14 `<section class="slide">` elements exist in the approved order, title through close.
3. **Offline:** CSS and JavaScript are inline; there are no external resource loads, web fonts, CDNs or required network calls.
4. **Print:** A4 landscape, zero page margins, one 16:9 stage per forced page break; the PDF was rendered (`pdftoppm`, 14 pages) and every page was looked at — the five shots appear in place and no slide is clipped.
5. **Notes:** every slide contains one `<aside class="notes">` paragraph, hidden on screen and in print.
6. **Claims:** no claim from the audit’s cut list remains; review routing is a rule, not a dispatched-review result, and unbuilt work is labelled.
