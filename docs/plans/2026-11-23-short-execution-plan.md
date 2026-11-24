# HKU Shanghai at War — short execution plan

**Date:** 2026-11-23
**Goal:** finish the game, tag `v9.1.0`, play it end to end, then record the submission video. Owner approves the plan before execution.

## What is already moving (do not interrupt)

- Master roadmap: `docs/plans/2026-11-23-master-roadmap.md` (13 workstreams, 60+ tasks).
- Four music composer agents are running (families A–D) in `.scratch/music-2026-11-23/`.
- The ElevenLabs key is present in Keychain; the voice audition cast is ready to generate. No shipped voice asset has been overwritten.
- The opening MVP agent is still working; it will be reviewed when it reports.
- Teaser v1 exists (`demo/teaser/`, 35.5 s); the final lab video comes later from a real playtest.

## Execution order

### Phase 0 — Lock the route (today)

1. Review and land the opening MVP; reconcile the `bus → crowd` typecheck break.
2. Pause chapter select and drag-look fixes.
3. Opening: one continuous take, phone with only **Yes**, crowd → B5 dinner.

**Gate:** `check:opening`, `check:opening-state`, `check:chapter-select`, `tsc --noEmit`.

### Phase 1 — B4 is the errand, B6 is the auditorium

4. **B4 side-door pre-flight:** find the real exterior face; fit the flip room inside the shell with a 0.2 m bound; resolve racks 1–3.
5. **MacBook errand:** B4 side door → lift → 5F principal’s office. The approach is **~30–45 s**, and conveys the abduction in three beats: lobby CCTV shows robots leading students/staff away → the feed cuts → 5F servo/shout/door. No fixed stopwatch, no teleport.
6. Retire the old B6 errand; dress B6 as the auditorium/architectural core.
7. Look-left security-camera beat at MacBook pickup.
8. Flip-wall puzzle at the B4 side entrance, turn right.
9. Migrate saves/checkpoints (`to_b6 → to_b4_office`, `b6 → b4-office`), keep old aliases.

**Gate:** browser route B5 → B4 side → 5F → B5 → B4 main; no page reload; measured approach time and all three abduction beats recorded.

### Phase 2 — Experience

10. B5 High Table Dinner: tables, green cloth, lamps, seated guests, toast.
11. **Score:** 18-cue map, four parallel composer families, two takes per cue, owner audition, then integration with crossfades and dialogue ducking.
12. **Voice:** ElevenLabs cast — narrator, staff, player, local AI, invader. Two or three takes per principal line; owner audition; then integrate with matching subtitles. Key stays in Keychain/.env, never in the repo or archive.
13. Finale: four-tower **mesh** light show, no central core.
14. NPC hover/lore/voice; robot dog credibility; eight humanoid robots; robot vision/coordination; abduction SFX; general SFX pass.

**Gate:** the owner hears the cues and voices; dinner, finale, robot and dialogue checks green.

### Phase 3 — Systems and scope

15. Keyboard Wall, exterior lighting, lion skills/rescue/encounter pass.
16. Zone streaming, draw-call/triangle/memory budgets. Measure first, then optimize.

**Gate:** `check:perf`, `check:memory`, lion gates, full route still green.

### Phase 4 — Release (tag-based)

17. Version label `v9.1.0` visible in the pause card, credits and `__CAMPUS.version`.
18. Group bug triage; P0/P1 fixed, P2 listed in `KNOWN-ISSUES.md`.
19. Run `scripts/pre-push-secret-scan.sh` (fails on `sk-`, `ntn_`, `ghp_`, `Bearer `); rotate the two exposed `sk-` keys before any push.
20. `git tag -a v9.1.0` on the playable commit. No freeze package, no SHA256SUMS, no upload from this repo.

### Phase 5 — Owner-ordered finish (last)

21. **Play the tagged build end to end yourself** — fresh boot to credits, no chapter jumps. Record the run and every bug.
22. Fix only P0/P1; if the build changes, cut a new patch tag.
23. **Re-play the fixed build** on the same route.
24. **Record the video from that run.** The teaser and the 60–90 s lab demo are cut from this footage. No “video done” before the playtest.
25. Owner pushes the tag to the private repo, deploys, and sends the link. This repo uploads nothing.

## Music and voice — the owner’s two asks

**Music**
- One cue for every part: title, prologue, invitation, dinner, toast, office/lift, abduction, alert, patrol, chase, puzzle, lawn, lion boss, victory, sports rescue, finale, credits, invader march alternate.
- **Greensleeves** (public domain) as the campus-memory theme: prologue, dinner, office, credits. Original arrangements only; **never** the 1981 Decca/UMG master.
- **Original HKU-2030 motif** for title, sports and finale. **Invader motif** for abduction, alert, patrol, chase, boss.
- Soviet-march *texture* for the invader; no real march quoted.
- Four composer subagents, two takes per cue, owner audition page at `.scratch/music-2026-11-23/audition.html`.

**Voice**
- Cast: narrator (cinematic, expressive), staff (warm, flurried), player (young, direct), local AI (calm, precise), invader (cold, processed).
- Generate 2–3 takes per principal line; owner A/Bs old vs new.
- Regenerate the staff lines with the **B4 5F** errand text, not Building 6.
- No key, no provider credential, and no unlicensed voice clone in the package.

## Owner decisions — settled

1. Game name: **HKU Shanghai at War**, subtitle “BARRIER 2030”.
2. Audition scope: I choose takes and hand the owner a veto list; no per-item questions.
3. Upload: none from this repo. Owner pushes the tag, deploys, sends the link.
4. Voice provider: ElevenLabs, quota free; main-story lines first.

## Definition of done

- One page, one first-person run, no reload: opening → dinner → B4 5F → incident → Keyboard Wall → B4 side flip wall → MacBook → lawn/lion → sports hall → finale → credits.
- Full score and expressive voice cast integrated; owner has heard the takes and holds the veto list.
- `v9.1.0` consistent across `VERSION`, `package.json`, build and UI; `v9.1.0` tag cut.
- Secret scan clean; two exposed `sk-` keys rotated; no upload from this repo.
- **A full playtest happened, then the video was recorded from the replay** — in that order.
- Local fallback tested with the network off.
