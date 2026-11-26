# Submission — HKU: Barrier 2030

**Version:** `9.2.0` (see `../VERSION`). The submission is `v9.1.0` — the tag the video and the slides quote. `v9.1.1` is a post-tag console-hygiene fix on the same game content, and `v9.2.0` adds the three scenes that line left as architecture (seated dinner, four-tower finale, CDS-1 gate bank); all three deploy to the same link.
**Status:** tag-based release, deployed continuously. Every push to `main` builds and publishes the playable link from that commit; the tag is what the video and the slides quote. There is no frozen archive and no checksum file.
**Live:** https://thomaslin070217.github.io/hku-shanghai-campus/ — the URL is stable, the build behind it changes with each push (ruling of 2026-11-25, superseding "the owner pushes and deploys").

## What the lab asked for

- A playable link.
- The source code at a fixed version.
- The demo video.
- The slide deck.

## How this repo delivers it

| Deliverable | Where it lives |
|---|---|
| Playable build | `git checkout v9.1.0 && npm ci && npm run build` → `dist/` |
| Current playable build (post-submission) | `git checkout v9.2.0` — the same route with the seated dinner, the four-tower finale and the CDS-1 gate bank; deployed to the same link |
| Source of that build | the `v9.1.0` git tag |
| Demo video | `demo/` (recorded from the `v9.1.0` build after a full playtest) |
| Slides | `submission/slides/` — `deck.html` (self-contained, offline) and `hku-barrier-2030-deck.pdf` (14 pages, A4 landscape). Built after the video was recorded, so the deck and the film show the same `v9.1.0` build |
| Known issues | `submission/KNOWN-ISSUES.md` |
| Licences | `submission/LICENSES.md` |

Every later playable version gets its own tag (`v9.1.1`, `v9.2.0`, …). The video always names the tag it was recorded from.

## Pre-push checklist (every push to `main` deploys the link)

- [ ] `VERSION`, `package.json` and `package-lock.json` agree on `9.2.0`.
- [ ] `node_modules/.bin/tsc --noEmit` and `node_modules/.bin/vite build` are green.
- [ ] The pause card/credits show `v9.1.0 · <12-char commit>` with no `-dirty` suffix. The suffix is real provenance: a build over uncommitted work says so, and the filmed build must come from the tag, not a dirty tree.
- [ ] `scripts/pre-push-secret-scan.sh` is clean (no `sk-`, `ntn_`, `ghp_`, `Bearer `, no `.env`, no keychain dumps). The GitHub repo is **public**, so a leak is a publication.
- [ ] The two exposed `sk-` keys have been rotated.
- [ ] `git tag -a v9.1.0` points at the playable commit, once the build is the one to film.
- [ ] The tagged build boots from a static server and the version label matches.
- [ ] The demo video was recorded from that tagged build, after the playtest.
- [x] The local fallback (`dist/` + a local static server) works with the network off — measured 2026-11-26: an opening run served from `dist/` made 82 requests, every one to `127.0.0.1`, and the missing assistant bridge (`127.0.0.1:8790`) did not stop the opening. No third-party host is contacted, so losing the venue network removes nothing.

## Post-tag fix, 2026-11-26

`v9.1.1` puts the local AI bridge and the assistant's loopback probe behind a `LOCAL_TOOLS` gate, so a shipped build no longer retries `ws://127.0.0.1:8788` forever: a 17-second opening run on the release build went from 8 WebSocket errors and 2 assistant-bridge errors to 0 and 0, and the pause card hides Enable AI when no bridge can exist. Game content, the video and the slides are unchanged and still quote `v9.1.0`.

On the local fallback (`dist/` + a static server), append `?agent=1` to the URL to use the local control bridge and the LLM-backed assistant; without it the assistant answers from its built-in core.

## Uploaded to the lab, 2026-11-26

The Group-E submission folder in the lab's SharePoint (`hkuhk-my.sharepoint.com/personal/linkc10_hku_hk/…/Hackathon/Student-Project/Group-E`) now holds:

- `hku-barrier-2030-deck.pdf` — 3.62 MB, the 14-page A4 landscape deck.
- `hku-barrier-2030-v9.1.0.mp4` — 29.9 MB, the demo recorded from the `v9.1.0` build.

The folder was empty before the upload; both files now list with those sizes and a timestamp of "a few seconds ago", uploaded through ego lite, whose browser profile already held a signed-in HKU Microsoft session. The source and the playable link remain the deliverables in this repo.

## What is deliberately absent

- No `SHA256SUMS`, no source/build zip, no freeze script, no `check-submission-package`.
- No manual deploy step: GitHub Actions builds `main` and publishes Pages on every push.
