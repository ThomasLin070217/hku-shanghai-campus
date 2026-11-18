# Thomas opening integration

**Development snapshot, 2026-11-18:** the interfaces below describe target integration behavior. The opening is not yet runnable: world/robot/UI modules and their tests are outstanding, and typecheck currently fails. For the exact current state and external-agent file ownership, read `agent-manual/00-START-HERE.md` first.

2030 opening scope: Building 4 shuttle → Building 5 ground-floor dinner reception (turn right) → Building 6 presentation MacBook → Building 5 incident → Building 4 main entrance **outside**.

The application selects the opening by default. `?experience=survey` retains the previous survey experience and its original save. Gameplay-facing building names are English; source B04/B05/B06 IDs remain stable.

## Ownership and event contract

`src/opening/state.ts` owns ordered story facts. UI submits intents; world/NPC state is derived. `CampusGame.interact/computer` is the shared human/RPC route, using the original `/act` fields. Opening modal content reuses the existing panel pause/epoch gate. Closing a modal does not resume movement or authorize AI.

Stable public facts: `invitation_read`, `laptop_acquired`, `campus_alert_triggered`. Opening completion emits the browser `campus-opening-handoff` event with event key `opening.building4_reached`, the three facts, the existing laptop instance ID and `opening-building4-entrance` anchor. The same completion is persisted and available through the read-only opening observation, so a later loaded module can recover it without relying on a transient DOM event.

`opening.building4_reached` is the provisional adapter name until Harry's incoming contract is available. It must map to his agreed entry event without emitting `chapter_01_completed`. Building 4 puzzles, supercomputer, power and later chapters are outside this implementation.

## Saves and safety

Opening save: `hku.opening.v1`. Original survey save: `hku.digital-survey.v1`. Pre-laptop opening saves are legal. A laptop flag requires exactly one existing MacBook item; there is no second inventory or held-object system. Unknown data is protected until an explicit restart backs it up. Writer ownership prevents simultaneous tabs from silently saving over each other.

Robot capture restores the encounter checkpoint and keeps the laptop and earlier story. The robot scans, pursues only a visible/last-seen target, searches and returns to patrol. Opening a panel, pausing or losing focus stops the encounter. Retry remains paused until the player continues.

## Spatial evidence boundary

`spatialLayout.ts` is the shared source for gameplay anchors, portal bounds, support and map routes. Building 5's ground-floor right turn is user-confirmed; room dimensions and Building 6's simplified office are provisional 2030 gameplay scenery. Building 6's 5.1 m provisional entry is distinct from the existing upper glass doors near 9 m. See THOMAS-CAPTURE.md for missing field reference.

Original static building keys are retained where geometry is clipped. Fully removed opening-only parts are listed in the generated scene ID migration report. Animated bus/dinner/laptop props are marked dynamicGameplay and excluded from the static scene revision; they retain source metadata and stable interaction IDs. Separate opening catalog uses `npm run scene:opening`.
