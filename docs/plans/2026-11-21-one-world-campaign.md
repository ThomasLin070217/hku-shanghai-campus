# One-world campaign: the whole game in one first-person run

Branch `feat/one-world`, worktree `~/Projects/hku-shanghai-campus-wt/one-world`, base `integration/final @ 4d8d222`.

## Spec (binding)

Owner's decision, 2026-11-21, verbatim:

> 我觉得狮子还是不要用他的那一版、线上那一版，而是用我的这个，带骨骼版本。
> A. 一个程序跑到底。所有关卡放进同一个 main.ts 世界、同一个校园模型、同一套 HUD，全程第一人称，不刷新页面。键盘墙房间要搬进校园模型的 B4 楼里，狮子关要从独立程序搬回主世界。……这样，就这样
> 然后你可以先用 thomas 那个，做一个能玩的版本。然后后续再增加复杂度。就是 vibe code 的那个。
> 然后我还是需要完全连续的，是这样的，A
> also please unify the aesthetics and gameplay and like make it a continuous first person game
> subagent driven dev and test driven dev still

What that means here:

1. One page, one document: `?experience=opening` runs Chapter 1 → B4 Keyboard Wall → Chapter 2 lawn → Chapter 3 sports hall → ending without `location.assign`, `location.href=` or a reload anywhere in the player path.
2. One campus model (the opening-mode `buildSite(specs,site,true)`), one explorer/physics, one HUD (the opening HUD: objective line, minimap, hearts, MacBook).
3. First person the whole way. The view toggle is disabled in story mode.
4. The Keyboard Wall, flip wall, aux power closet and supercomputer are rooms inside the campus model's B04 (CDS-1) ground floor, entered on foot through the B04 entrance by the Chapter 1 handoff point.
5. The lawn guardian is the rigged lion (`src/lionBoss/lionRig.ts` via `createBossScene` in `src/lionBoss/scene.ts`). Gameplay for now is Thomas's simplified version (`src/lionBoss/combat.ts`: press Q to interrupt the charge, hold F in the ring). Vibe Code skill writing comes back later and is out of scope.
6. Story order and meaning follow `doc/11` §2 and `doc/12` §6–7 in the docs repo: B4 restores the supercomputer → lawn shuts the guardian down and cuts core power → sports hall door frees the students → the ending lifts the dome.

## Global constraints (every task)

- Repo rules (AGENTS.md, HANDOFF §四): geometry goes "source parameters → regenerate → visual/collision check". Render and collision for anything new come from ONE shared parameter object. Keep `authorParts` / `sceneId` / existing `authorKey`; if an old scene ID disappears, record it in the scene-migration evidence (the `check:opening` migration check reports removed parts). No teleport or coordinate writes through the AI `/act` path, no arbitrary-JS / remote-shell / file-write interfaces, no secrets in code. Debug hooks live only under `import.meta.env.DEV||import.meta.env.MODE==='review'`, like `window.__CAMPUS.openingDebug`.
- TDD: write the failing check first, run it and see it fail for the right reason, then implement, then see it pass. Checks are `tsx` scripts under `scripts/` registered in `package.json` (pattern: `scripts/check-opening-integration.ts`, headless `new CampusGame(createNavigation(BUILDINGS,SITE,true),BUILDINGS,SITE)` + `g.step(1/120)`).
- Never regress: `node_modules/.bin/tsc --noEmit`, `npm run -s check:opening`, `check:exploration`, `check:chapter-select`, `check:experience`, `check:lion-boss`, `check:ai-runtime`, `check:nov14`, `check:nov13`, `check:door`. After running checks, `git checkout -- assets/exploration/navigation-checks.json` if only its `date` changed.
- Legacy standalone pages (`interiors.html?chapter=b4`, `?experience=lion-boss`, `?experience=sports-hall`) keep working for dev and existing checks (`check:lawn-browser` drives `?experience=lion-boss`), but nothing in the player path links or redirects to them any more.
- UI text in English. Keep IDs untranslated. Visual tokens are the opening dark HUD: ink `#e8f4ee`, paper `rgba(8,18,15,.92)`, green `#74e6b4`, gold `#ffb648`, mono `ui-monospace, SFMono-Regular, "SF Mono"`, body font = the opening body stack (`Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`), display headings = `Georgia, "Times New Roman", serif` (as the opening h1). Reuse `src/opening/opening.css` variables (`--opening-*`, dark variant around line 2323) instead of new colours.
- Don't touch port 5233 (owner preview), 18789 (OpenClaw), 8790 (Qoder). Use your own vite port given in the dispatch: `node_modules/.bin/vite --host 127.0.0.1 --port <PORT> --strictPort`, stop it when done.
- Browser checks: Python Playwright `/Users/onezion12344/miniforge3/bin/python3.13`, Chromium at `/Users/onezion12344/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing` with `['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']`. Headless cannot pointer-lock; use the compat path (`#enter-compat` / `explorer.enterCompat()`) or debug hooks. Press a real key (`page.keyboard.press('Shift')`) before relying on saves (`claimSave` needs a trusted input).

## Shared contract (Task 1 creates it; Tasks 2–6 consume it)

`src/campaign/state.ts` — pure, no DOM:

```ts
export const CAMPAIGN_STAGES=['b4_enter','b4_keyboard','b4_flip','b4_breaker','b4_connect','to_lawn','lawn','to_sports','sports','ending','done'] as const;
export type CampaignStage=typeof CAMPAIGN_STAGES[number];
export type CampaignEvent='enter_b4'|'keyboard_solved'|'flip_solved'|'breaker_pulled'|'macbook_connected'|'reach_lawn'|'guardian_shutdown'|'reach_sports'|'door_opened'|'ending_finished';
export const CAMPAIGN_TRANSITIONS:Record<CampaignEvent,{from:CampaignStage;to:CampaignStage}>={
 enter_b4:{from:'b4_enter',to:'b4_keyboard'},keyboard_solved:{from:'b4_keyboard',to:'b4_flip'},flip_solved:{from:'b4_flip',to:'b4_breaker'},
 breaker_pulled:{from:'b4_breaker',to:'b4_connect'},macbook_connected:{from:'b4_connect',to:'to_lawn'},reach_lawn:{from:'to_lawn',to:'lawn'},
 guardian_shutdown:{from:'lawn',to:'to_sports'},reach_sports:{from:'to_sports',to:'sports'},door_opened:{from:'sports',to:'ending'},ending_finished:{from:'ending',to:'done'},
};
export interface CampaignState{schemaVersion:1;stage:CampaignStage;deviceId:string;updatedAt:number}
export const CAMPAIGN_SAVE_KEY='hku.campaign.v1';   // under 'hku.' so the menu's Reset progress clears it
export function createCampaignState(deviceId:string,now?:number):CampaignState;      // stage 'b4_enter'
export function reduceCampaign(s:CampaignState,e:CampaignEvent,now?:number):{state:CampaignState;changed:boolean}; // wrong-stage events: changed:false, same object
export function parseCampaignState(raw:unknown):CampaignState|null;                   // strict: unknown version/stage/empty deviceId → null
export function stageIndex(stage:CampaignStage):number;
export function campaignChapterOf(stage:CampaignStage):'b4'|'lawn'|'sports'|'ending'|null; // b4_* → 'b4'; lawn → 'lawn'; sports → 'sports'; ending|done → 'ending'; to_* → null (walking legs)
```

`src/campaign/types.ts`:

```ts
import type * as T from 'three';
import type {createExplorer} from '../exploration/controller';
import type {OpeningAtmosphere} from '../opening/atmosphere';
import type {CampaignEvent,CampaignStage} from './state';
export type Explorer=ReturnType<typeof createExplorer>;
export type Vec3=[number,number,number];
export interface Objective{text:string;target:Vec3|null;route?:[number,number][]}
export interface ChapterContext{
 scene:T.Scene; root:()=>T.Object3D; explorer:Explorer; deviceId:()=>string;
 stage:()=>CampaignStage; emit:(event:CampaignEvent)=>boolean;
 notify:(text:string)=>void; atmosphere:()=>OpeningAtmosphere|undefined;
 openPanel:(id:string)=>void; closePanel:()=>void; resume:()=>void;   // modal panels pause the game and release pointer lock; resume re-enters play
 card:(kicker:string,title:string,ms?:number)=>Promise<void>;          // shared full-screen chapter card (Task 1)
}
export interface Chapter{
 id:'b4'|'lawn'|'sports'|'ending';
 /** Where the walking leg that leads into this chapter ends (host emits the entry event inside `radius`). */
 entry:{point:Vec3;radius:number;event:CampaignEvent};
 /** Route drawn on the minimap for the walking leg into this chapter, x/z pairs, last point = entry.point. */
 approach:[number,number][];
 attach(ctx:ChapterContext):void;   // once, when the campaign first needs this chapter (build scenery, HUD)
 update(dt:number):void;            // every frame while attached
 interact():boolean;                // E key; true if consumed
 objective(stage:CampaignStage):Objective|null;
 detach():void;
 debug?:Record<string,(...args:never[])=>unknown>;
}
```

`src/campaign/chapters.ts` maps ids to factories: `{b4:createB4Chapter,lawn:createLawnChapter,sports:createSportsChapter,ending:createEndingChapter}`. Task 1 ships each factory as a minimal working stub in its own file (`b4Chapter.ts`, `lawnChapter.ts`, `sportsChapter.ts`, `endingChapter.ts`) whose `interact()` returns false, `objective()` returns a placeholder text, and `debug.complete()` emits the chapter's events in order. Tasks 2–4 replace the body of their own file; they never edit `chapters.ts`, `host.ts` or `main.ts`.

Entry points (Task 1 puts them in the stubs; owners may refine inside their file):
- b4: `entry.point` just inside the B04 entrance door, `[58,0.02,18]`, radius 1.6, event `enter_b4`; approach `[[58,25],[58,18]]`.
- lawn: `entry.point` = the lawn guardian trigger area used by `src/lionBoss/play.ts` (read `BOSS`/`SAFE`/trigger from `combat.ts`), radius 3, event `reach_lawn`.
- sports: the sports-hall east door outside point from `sportsDoorWorld(SITE.sportsZ)` (+2.6 m east, as `createSportsRescueExperience.relocate`), radius 2.5, event `reach_sports`.
- ending: no walking leg (entry radius 0; host never emits for it).

## Tasks

### Task 1: Campaign core — state, host, chapter card, no-reload handoff, first-person lock, checkpoints, menu

Model: architecture task. Files you own: `src/campaign/state.ts`, `src/campaign/types.ts`, `src/campaign/chapters.ts`, `src/campaign/host.ts`, `src/campaign/chapterCard.ts` (+ css), the four stub chapter files, `scripts/check-campaign-state.ts`, `scripts/check-campaign-host.ts`, `package.json` (scripts), and the integration edits in `src/main.ts`, `src/opening/experience.ts`, `src/opening/ui.ts`, `src/opening/checkpoint.ts`, `src/levels/menu.ts`, `src/exploration/controller.ts`, `src/opening/map.ts`.

Steps (TDD):
1. Write `scripts/check-campaign-state.ts` (register `check:campaign` = `tsx scripts/check-campaign-state.ts && tsx scripts/check-campaign-host.ts`). Assert: full linear walk of all ten events reaches `done`; every out-of-order event returns `changed:false` with the same object; `parseCampaignState` rejects wrong `schemaVersion`, unknown stage, empty `deviceId`, non-object; round-trip of `JSON.stringify(state)` parses; `campaignChapterOf` mapping as in the contract; `CAMPAIGN_SAVE_KEY.startsWith('hku.')` (so the menu's Reset progress, which clears the `'hku.'` prefix, clears the campaign). Run → fails (module missing). Implement `state.ts` exactly per the contract. Run → passes.
2. Write `scripts/check-campaign-host.ts` against `createCampaignHost` (pure enough to run headless with a stub ctx): given a `CampusGame`-backed explorer stub or a minimal object with `game.body.position`, the host (a) attaches the chapter for the current stage, (b) on walking stages emits the next chapter's `entry.event` only when the body is within `entry.radius` of `entry.point` (test both outside and inside), (c) persists to an injected storage under `CAMPAIGN_SAVE_KEY` on every change, (d) `objective()` returns the active chapter's objective, or for walking stages `{text:'Go to …', target:entry.point, route:approach}`, (e) routes `interact()` to the active chapter only, (f) campaign `active` becomes true only after `start(deviceId)` or a valid save. Run → fails. Implement `host.ts`. Run → passes.
3. Integration (not headless; verify in the browser):
   - `src/opening/ui.ts`: `enterB4Puzzle()` no longer calls `location.assign`. When the Chapter 1 completion would show and the relay is not restored, hide the dialog and start the campaign (`host.start(deviceId)`), which shows the shared card `CHAPTER 1 · BUILDING 4` / `The Keyboard Wall`. Remove the "Go to the Keyboard Wall (B4)" page link and the "Play L001 lawn encounter" page link from the completion dialog in the player path (keep "Replay chapter").
   - `src/main.ts`: create the host in opening mode, `viewer.beforeRender.add(dt=>host.update(dt))`, add a host interaction handler to `explorer.interactions`, expose `window.__CAMPUS.campaign` (DEV/review only) with `state()`, `emit(event)`, `start(deviceId)`, `chapter()` (active chapter id) and `debug` passthrough.
   - Objective line + minimap: when the opening story stage is `complete` and the campaign is active, `objectiveFor()` / `drawOpeningMap` use `host.objective()` (text, target marker, route).
   - Robots: once the campaign stage index ≥ `to_lawn`, the opening fleet stops hunting (standby, no catches). Story reason: the restored supercomputer gives the MacBook robot control (doc/11 §3). Add a check in `check-campaign-host.ts` or the opening fleet check that a stage-gated predicate returns false from `to_lawn` on.
   - First person: in story mode (`openingMode`) force `game.view='first'` and ignore `KEYS.view` (add a `lockView(view|null)` to the explorer controller; default unlocked so survey/legacy modes keep the toggle).
   - Checkpoints: `src/opening/checkpoint.ts` gains `b4-inside` (campaign `b4_keyboard`, player inside the B04 door), `lawn` (campaign `to_lawn`, relay restored, player at the B04 entrance outside), `sports` (campaign `to_sports`, relay restored + `recordCorePowerCut(device,3)`, player at the lawn entry) and `ending` (campaign `ending`). Each starts with the opening state at `complete` and the MacBook in inventory, like the existing `b4` checkpoint. Extend `scripts/check-chapter-select.ts` with these four.
   - `src/levels/menu.ts`: Chapter 1/2/3 links and all checkpoints point at `?experience=opening&checkpoint=…`; no player link to `interiors.html`, `?experience=lion-boss` or `?experience=sports-hall`.
4. `chapterCard.ts`: one full-screen card (kicker + display title, dark paper, opening tokens, fade in 300 ms, hold, fade out), used at every chapter boundary by the host: entering B4 (`CHAPTER 1 · BUILDING 4` / `The Keyboard Wall`), `to_lawn` (`CHAPTER 2` / `The Lawn Guardian`), `to_sports` (`CHAPTER 3` / `Sports Hall Rescue`), `ending` (`EPILOGUE` / `Barrier Down`).
5. Verify: tsc; `check:campaign`; all global checks; then a Playwright run on your port: `?experience=opening&checkpoint=b4`, press Shift, set `window.__doc=1`, call `__CAMPUS.openingDebug.arriveB4()`, assert the card appears, URL unchanged, `__doc===1`, `__CAMPUS.campaign.state().stage==='b4_enter'`; call `__CAMPUS.campaign.debug` stubs to run through to `done` and assert `__doc===1` at the end and 0 pageerrors. Screenshots of the card and HUD objective into `/tmp/one-world/t1/`.

### Task 2: B4 (CDS-1) ground-floor rooms in the campus model and the first-person B4 puzzle

Files you own: `src/campaign/b4Chapter.ts`, `src/campaign/b4Puzzle.ts`, `src/campaign/b4Layout.ts`, `scripts/check-campaign-b4.ts`, and edits to `src/opening/spatialLayout.ts` (add `OPENING.b4` only), `src/opening/geometry.ts` and `src/opening/navigation.ts` (add B04 to the existing room-cut loops), `src/model/buildSite.ts` only if the B04 interior props must be added there (prefer adding them from `b4Chapter.attach` into the opening world group with matching nav obstacles from `b4Layout.ts`).

Facts: B04 spans x 28.15–87.85, z −24.5…20.5; the entrance faces +z at z≈20.5 (entrance canopy `local('entrance-canopy',0,b.depth/2+1.5,…)` in `src/exploration/navigation.ts:32`); the Chapter 1 handoff is `OPENING.handoff=[58,.08,25]` just outside it. In opening mode B04 is one `B04/closed-exterior` obstacle. B05/B06 rooms are opened by `openingObstacles` (`src/opening/navigation.ts`) and `cutOpeningBuildings` (`src/opening/geometry.ts`) from `OPENING.b5`/`b6` parameters (`{id,x0,x1,z0,z1,door,doorWidth,floor,clearHeight,doorHeight}`, door on the z1 face). Room builders: `buildObservedFeatureRoom('keyboard'|'flipWall')`, `buildAuxPowerCloset()` in `src/model/observedFeatureRooms.ts`. The current puzzle logic and the four steps (`keyboard → flip → breaker → connect`, objectives, `I LOVE CDS` caps + Enter, all 561 flip tiles past π/2, red lever `Aux_breaker_lever`, aux cabinet port `Aux_power_closet`, `supercomputer_hum`, red emergency light → green racks) live in `src/interiorsPreview.ts` chapter mode; the relay is written only through `markRelayRestored(id)` (`src/opening/backupRelay.ts`); keyboard progress through `src/opening/keyboardProgress.ts`.

Steps (TDD):
1. `scripts/check-campaign-b4.ts` (add to `check:campaign`): (a) `b4Puzzle` pure logic — keyboard accepts exactly the `I LOVE CDS` sequence then Enter, rejects others and resets on a wrong cap; flip completes only when every tile is flipped; breaker before connect; connect calls the relay writer with the device id (inject it); (b) physics — from `OPENING.handoff` the player walks through the B04 door to `b4Chapter.entry.point`, then to each station's stand point (keyboard wall, flip wall, breaker, port) using `CampusGame` steering like `check-opening-integration.ts` `route()`; (c) each station stand point is ≤ 2.2 m from its interactable and has a clear ray from eye height (1.6 m) to it, like the B6 laptop sightline check; (d) render and nav for the room come from `b4Layout.ts` (assert the nav boxes equal the layout rects). Run → fails. Implement. Run → passes.
2. First-person interaction: E at a station enters a focus view of that station (movement paused, mouse/keys go to the puzzle, `Esc`/`E` leaves). Keyboard: type letters or click caps under the cursor. Flip wall: the same sweep/click flipping as in `interiorsPreview.ts`, completable by a human in under a minute. Breaker: E pulls. Port: E connects the MacBook. Each solved station emits its campaign event. The room is lit red (emergency) until the breaker, then the racks go green — reuse the lighting idea from `interiorsPreview.ts` but on lights you add to the room, not the global sun.
3. `objective(stage)` texts come from the actual conditions, like the current chapter-mode objectives.
4. Verify: tsc; `check:campaign`; `check:opening` (scene-migration count may change: update the evidence the check regenerates, keep explicit migrations for removed B04 parts); all global checks. Playwright on your port: `?experience=opening&checkpoint=b4-inside`, compat mode, walk with real keys to the keyboard wall if possible, solve with the debug/focus path, screenshots of each station into `/tmp/one-world/t2/`.

### Task 3: The lawn guardian in the main world (rigged lion, Thomas's Q/F gameplay)

Files you own: `src/campaign/lawnChapter.ts`, `scripts/check-campaign-lawn.ts`, and refactors inside `src/lionBoss/*` that let both the legacy page (`play.ts`) and the campaign chapter share combat/scene/HUD code. Legacy `?experience=lion-boss` must keep passing `check:lion-boss` and `check:lawn-browser`.

Facts: `src/lionBoss/play.ts` already uses the same `createExplorer`, `buildSite`, `createSiteViewer`; the boss scene is `createBossScene(campus.root, explorer.world, viewer.scene)` (rig via `createLionRig`, eyes on the head bone), combat `createCombat(restored)` with `BOSS`, `NODES`, `SAFE`, `canSubmit`, `SUBMIT_RADIUS`; completion `finishMission()` → `recordCorePowerCut(mac.instanceId)`, `markLionDefeated()`, `markPowerCut()`. Hearts via `createVitalsHud`. The lion statue is found by `getObjectByName(NOV13.lion.id)` / `'Lion_body_uniform_scale'` — confirm it exists in the opening-mode model (`buildSite(specs,site,true)`); if not, make it present in opening mode from its existing parameters.

Steps (TDD):
1. `scripts/check-campaign-lawn.ts` (add to `check:campaign`): headless opening-mode world + chapter with a stub ctx: attach builds the boss on the opening campus root (rig present: the body has a `SkinnedMesh` and the rig's `idle/walk/charge/shutdown` clips); entry point is reachable on foot from the B04 entrance outside point (`[58,0,25]`) along `approach`; driving combat with the same inputs as `scripts/check-lion-boss.ts` (Q interrupt during `chargeWarn`, hold F in the ring) reaches `complete`, then the chapter emits `guardian_shutdown`, `hasCorePowerCut(device)` is true and the world threat has `lionDefeated` and `powerCut`. Run → fails. Implement. Run → passes.
2. In-world HUD uses the shared opening HUD: objective line text from `objective()`, hearts from the opening vitals, the Q/F key prompts restyled to the opening tokens. No separate title panel ("The Lawn Guardian" comes from the chapter card). First person only.
3. Capture by the lion costs a heart and returns the player to the lawn safe point as in `play.ts`; zero hearts → heal and retry at the safe point (no game over screen, no reload).
4. Verify: tsc; `check:campaign`; `check:lion-boss`; global checks; legacy `check:lawn-browser` against your port (copy `scripts/check-lawn-browser.mjs` and `scripts/lawn-recording.mjs` into `/tmp/lawn-check/` which has `node_modules/playwright-core`, run with `CAMPUS_URL=http://127.0.0.1:<PORT>/`). Playwright `?experience=opening&checkpoint=lawn`: screenshots in first person of the rigged lion and the HUD into `/tmp/one-world/t3/`.

### Task 4: Sports hall rescue and the ending in the main world

Files you own: `src/campaign/sportsChapter.ts`, `src/campaign/endingChapter.ts`, `scripts/check-campaign-sports.ts`, and edits to `src/gameplay/sportsDoor.ts` / `sportsDoor.css` needed to host the door in opening mode (keep the survey and `?experience=sports-hall` behaviour).

Facts: in `src/main.ts` the sports door is created only when `!openingMode` via `createSportsDoor({root,game,notify,openPanel,closePanel,resume,persist,standalone})`; the lock answers live in `content/puzzles/sports-hall-lock.json` via `SPORTS_HALL_PUZZLE`; `sportsDoorWorld(game.site.sportsZ)` gives the door; the door is open when `game.doors[SPORTS_DOOR.id]`. World threat: `markLocalModelCleared()`, `tryPurgeWorld()`, `allEndgameConditionsMet()` in `src/gameplay/worldThreat.ts`; the dome is `OpeningAtmosphere` (`release()`, `restoreSealed()`). Ending storyboard: `doc/12` §7 (Mac screen `HKU SUPERCOMPUTER / CPU 01–04 … OFFLINE` → each ONLINE → `SYNCHRONIZATION STARTED…` → `ALL PROCESSING UNITS ONLINE / ADMINISTRATOR ACCESS RESTORED` → dome dissolves → credits).

Steps (TDD):
1. `scripts/check-campaign-sports.ts` (add to `check:campaign`): sports chapter attaches the door in opening mode with collision; the door's closed collision blocks and opens after `checkCode`/`checkPassword` succeed (use the puzzle's own answers from the content file); on open the chapter emits `door_opened`; the walking leg from the lawn entry to `entry.point` is walkable on foot along `approach`; ending chapter: on attach it calls `markLocalModelCleared()` then `tryPurgeWorld()`; with `lionDefeated`+`powerCut` already set the threat becomes `purged`; `ending_finished` is emitted when the sequence ends (inject a fast clock). Run → fails. Implement. Run → passes.
2. The rescue banner in campaign mode says the students are free and does not say "The End" (the ending chapter does). Lock panel styled with the opening tokens.
3. Ending sequence: a full-screen MacBook-style overlay running the §7 lines with timing (~12 s total), the atmosphere `release()` during it, then a credits card: `BARRIER 2030`, team `Thomas · Harry · Frost · WHL`, `HKU Shanghai · CDS`, buttons `Play again` (clears the same keys as the menu's Reset progress in `src/levels/menu.ts:88-99` plus `resetWorldThreat()`, then reloads — an explicit player click, so a reload is allowed here) and `Chapters`.
4. Verify: tsc; `check:campaign`; `check:door`; global checks. Playwright `?experience=opening&checkpoint=sports`: solve the lock through the panel UI (real clicks/typing), watch the ending to credits, screenshots into `/tmp/one-world/t4/`.

### Task 5: One look — unify every overlay on the opening dark HUD

Files: CSS and markup of overlays in `src/campaign/*`, `src/lionBoss/play.css` (campaign path only), `src/gameplay/sportsDoor.css`, `src/levels/menu.css`, `src/ui/vitals.css`, `src/opening/game-shell.css`; `scripts/check-campaign-style.py` (Playwright).

Steps (TDD):
1. Write `scripts/check-campaign-style.py`: for checkpoints `b4`, `b4-inside`, `lawn`, `sports`, `ending` and `?experience=levels`, read computed styles of the visible HUD/panel/card elements (objective line, chapter card, hearts, focus panels, lock panel, rescue banner, credits, menu). Assert body/panel font family starts with `Inter`, display headings with `Georgia`, panel backgrounds use the opening paper colour, accent colour is the opening green or gold, and no visible element still uses `Segoe UI` or `system-ui` as its first family. Run → fails on the current state. Fix styles. Run → passes.
2. Screenshot each checkpoint into `/tmp/one-world/t5/` for owner review.

### Task 6: Continuous playthrough check and fixes

Files: `scripts/check-campaign-walk.ts` (headless full-chain physics), `scripts/check-campaign-browser.py` (Playwright one-document run), fixes anywhere the checks expose (each fix minimal and named in the report).

Steps (TDD):
1. `check-campaign-walk.ts`: one headless body walks the whole chain on foot with the authored routes: bus → … → handoff (existing opening routes) → B04 door → each B4 station → B04 exit → lawn entry → sports entry, asserting each leg completes and printing seconds per leg. Register in `check:campaign`.
2. `check-campaign-browser.py`: fresh `?experience=opening` (clear storage), press Shift, set `window.__doc=1`; drive Chapter 1 with `__CAMPUS.openingDebug` (as `/tmp/e2e-final/handoff.py` does), then the campaign through each chapter using each chapter's `debug` hooks and at least one real-input interaction per chapter (a keycap click, the Q press, a lock-panel entry). Assert at each boundary: the chapter card appeared, `location.href` unchanged, `__doc===1`, stage advanced, first person (`__CAMPUS.explorer.game.view==='first'`). At the end: relay online for the device, core power cut, world threat `purged`, dome released, credits visible, 0 pageerrors.
3. Fix what fails. Verify all global checks + `check:campaign`.
