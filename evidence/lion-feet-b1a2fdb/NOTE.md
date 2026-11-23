# Lion feet + leg skeleton — evidence (b1a2fdb)

Before: `before-close*.png` (the defect: dark Trouser_leg ovals stayed on the hips, gold paws
swung with the forearms, and a thin humanoid leg with a gold human foot grew below the gown).
`before-seated.png` is the correct authored statue.

After: captured from the review build (`?experience=lion-boss&quality=low`, 127.0.0.1:5252)
with a fixed portrait camera, front and side per phase: seated, awaken, idle, walk, run,
chargeWarn, shutdown. The authored gold paws (with three toes, HKU lettering and the crest) are
now the feet on `footL/R`; `Trouser_leg` follows `thighL/R`; the added human foot/toes and the
thin straight legs are gone. The six added trouser stocks are hidden inside the seated statue
(0 px difference with them toggled off — see `DIFF.txt`).

Gates at b1a2fdb: `check:lion-rig` 81 ok / 0 failed; `check:lion-boss` 4/4 scripts pass;
`typecheck` clean; `build` succeeds. Browser capture had 0 page errors; the only console errors
are the local agent WebSocket (ws://127.0.0.1:8788) refusing the standalone page.
