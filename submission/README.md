# Submission — HKU: Barrier 2030

**Version:** `9.1.1` (see `../VERSION`). The submission is `v9.1.0` — the tag the video and the slides quote. `v9.1.1` is a post-tag console-hygiene fix on the same game content (below), deployed to the same link.
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
| Source of that build | the `v9.1.0` git tag |
| Demo video | `demo/` (recorded from the `v9.1.0` build after a full playtest) |
| Slides | `submission/slides/` — `deck.html` (self-contained, offline) and `hku-barrier-2030-deck.pdf` (14 pages, A4 landscape). Built after the video was recorded, so the deck and the film show the same `v9.1.0` build |
| Known issues | `submission/KNOWN-ISSUES.md` |
| Licences | `submission/LICENSES.md` |

Every later playable version gets its own tag (`v9.1.1`, `v9.2.0`, …). The video always names the tag it was recorded from.

## Pre-push checklist (every push to `main` deploys the link)

- [ ] `VERSION`, `package.json` and `package-lock.json` agree on `9.1.0`.
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

## What is deliberately absent

- No `SHA256SUMS`, no source/build zip, no freeze script, no `check-submission-package`.
- No manual deploy step: GitHub Actions builds `main` and publishes Pages on every push.
