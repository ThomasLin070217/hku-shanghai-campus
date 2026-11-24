# Submission — HKU: Barrier 2030

**Version:** `9.1.0` (see `../VERSION`)
**Status:** tag-based release. There is no frozen archive, no checksum file and no upload from this repo. The owner pushes the tag to a private GitHub repo, deploys it and sends the link.

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
| Slides | `submission/slides/` |
| Known issues | `submission/KNOWN-ISSUES.md` |
| Licences | `submission/LICENSES.md` |

Every later playable version gets its own tag (`v9.1.1`, `v9.2.0`, …). The video always names the tag it was recorded from.

## Pre-push checklist (run before the owner pushes)

- [ ] `VERSION`, `package.json` and `package-lock.json` agree on `9.1.0`.
- [ ] `node_modules/.bin/tsc --noEmit` and `node_modules/.bin/vite build` are green.
- [ ] The pause card/credits show `v9.1.0`, the git SHA and the build date.
- [ ] `scripts/pre-push-secret-scan.sh` is clean (no `sk-`, `ntn_`, `ghp_`, `Bearer `, no `.env`, no keychain dumps).
- [ ] The two exposed `sk-` keys have been rotated.
- [ ] `git tag -a v9.1.0` points at the playable commit.
- [ ] The tagged build boots from a static server and the version label matches.
- [ ] The demo video was recorded from that tagged build, after the playtest.
- [ ] The local fallback (`dist/` + a local static server) works with the network off.

## What is deliberately absent

- No `SHA256SUMS`, no source/build zip, no freeze script, no `check-submission-package`.
- No upload step: the owner deploys and shares the link himself.
