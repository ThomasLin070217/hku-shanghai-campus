# Submission — HKU: Barrier 2030

**Version:** `9.1.0` (see `../VERSION`)
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
| Slides | `submission/slides/` — built from the audited outline (`.scratch/slides-2026-11-24/outline.md`) after the video is recorded, so the deck and the film show the same build |
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
- [ ] The local fallback (`dist/` + a local static server) works with the network off.

## What is deliberately absent

- No `SHA256SUMS`, no source/build zip, no freeze script, no `check-submission-package`.
- No manual deploy step: GitHub Actions builds `main` and publishes Pages on every push.
