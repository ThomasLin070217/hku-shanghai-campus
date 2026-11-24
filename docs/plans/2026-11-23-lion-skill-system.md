# Lion skill system — function composition design delta (owner direction, 2026-11-23)

Owner, verbatim:
> 给狮子的一些技能也有必要改进一下。我们可以一开始先 define 一些内容：狮子可能可以
> 收到什么样的技能，对吧？也就是一些 function。然后我们有一些自由组合方式，把它们
> 组合起来。大概就这样去攻击一个狮子，我们就可以用到 Vibe Coding 的一些方式，因为
> 可以把那个 function 定义得复杂一些。
> 然后我们用 MacBook Air 上面的模型去 Vibe Coding 一下，组合那些 function，制作一些
> 技能。当然，要设置一些限制，不然不能让王佳变成超人，对不对？比如单个技能可能就有
> 一些限制。
> 然后，你接模型是可以接真正的模型的。我们这个 HKU campus 的模型就可以，是不是在
> Magpie 里面的？但是不要把我这个 key 放到远端去，而是可能我们再中转一层。

## What exists today (evidence)

- `src/lionBoss/skillCatalog.ts`: exactly three fixed skills —
  `SYSTEM_FREEZE` (3 s / 18 s / 60), `ROBOT_HIJACK` (8 s / 25 s / 50),
  `GHOST_SIGNAL` (6 s / 15 s / 35). Budget 110, two slots, range 4–16 m.
- `src/lionBoss/skillCompiler.ts`: the model classifies one natural-language
  request into **one** of the three types plus side/range; everything else is
  rejected (`UNSUPPORTED`, unknown fields, out-of-spec durations).
- `src/lionBoss/consoleService.ts`: preview → test → install; HUD reads the
  installed pair; the combat FSM (`createCombat`) implements the three effects.
- `src/opening/modelTransport.ts`: browser → loopback bridge
  `scripts/llm-bridge.mjs` (127.0.0.1:8790) → `scripts/llm.mjs` →
  DeepSeek / Gemini / LiteLLM. **The browser never holds a key.** Provider
  override: `HKU_LLM_PROVIDER`; fallback provider supported. The MacBook Air
  local model can be used today by pointing the agent endpoint at Ollama
  (`/11434/` or `ollama` in the name), but that path is a per-device override,
  not a first-class provider.
- No “campus” model alias exists in Magpie's config; Magpie exposes routes like
  `magpie/auto/deepseek-v4.1-flash`. The game's default is `deepseek-flash`
  through the loopback bridge, which is the intended “relay layer”: key stays
  on the machine.

## The change

Replace “one of three skills” with **primitive functions + free composition**,
bounded by a hard budget and per-function limits.

### 1. Function catalog (the vocabulary the lion can receive)

Each function is a typed, bounded effect the combat FSM already understands or
can understand cheaply. Proposed first set (names indicative):

| Id | Target | Effect | Duration | Cost/s | Notes |
|---|---|---|---|---:|---|
| `LOCOMOTION_STOP` | LION | movement = 0 | 1–3 s | 20 | attacks continue |
| `ATTACK_STOP` | LION | cancel wind-up, no new attacks | 1–3 s | 25 | movement continues |
| `SLOW` | LION | speed × 0.5 | 2–4 s | 10 | |
| `TARGET_LURE` | SIGNAL/ROBOT | lion pursues the decoy | 4–8 s | 15 | needs a point in range |
| `ROBOT_HIJACK` | ROBOT | robot becomes a lurable decoy | 4–8 s | 12 | requires a robot in range |
| `VISION_BREAK` | LION | lose sight / stop tracking | 1–3 s | 20 | |
| `ALERT_DOWN` | LION | alert level −1 | instant | 15 | floor is patrol |
| `PING` | — | reveal patrol/lock status | instant | 5 | information only |

Hard caps: per-effect duration ≤ 8 s, range 4–16 m, total skill cost ≤ 110,
≤ 3 functions per skill, ≤ 2 equipped skills, one *control channel* per target
(a skill cannot stack two locomotion stops; duplicates take the max, not the
sum). No damage, no health, no permanent state, no skipping lock A/B or the
core sequence.

### 2. Composition schema

The model returns one object:

```json
{"name":"三秒断腿 + 左侧假信号","description":"…",
 "parts":[{"effect":"LOCOMOTION_STOP","duration":3},
          {"effect":"TARGET_LURE","target":"SIGNAL","side":"left","range":9,"duration":6}]}
```

`skillCompiler.ts` validates every part against the catalog, clamps only within
declared ranges, sums cost, rejects unknown fields/effects, and rejects when the
budget or slot count is exceeded. The result is deterministic and replayable:
the catalog supplies cooldown from total cost (e.g. `cooldown = 8 + 0.18 ×
cost`), so the same composition always costs the same.

### 3. Combat FSM

`createCombat` gains effect slots: locomotion lock, attack lock, speed factor,
pursuit target override (robot/signal), vision state. Each part sets a timer;
the FSM reads the strongest active effect per channel. The lion's existing
wind-up/telegraph/cancel logic stays; no new animation assets required for the
first pass.

### 4. Vibe console

The right-hand panel shows each recognized part, its duration/range/cost, the
total, and the rejection reason. “Test skill” casts the exact composition on a
dummy state; “install” re-validates budget/slots. Offline presets remain.

### 5. Model wiring (real model, one relay)

- Keep the browser → `127.0.0.1:8790/api/chat` bridge → `scripts/llm.mjs`
  chain. This is the “再中转一层”: the key stays in the server-side process.
- Add `litellm`/Magpie parity: `LITELLM_BASE_URL` can point at the local Magpie
  route; `LITELLM_MODEL` selects `magpie/auto/deepseek-v4.1-flash` (or the HKU
  hackathon model). No key in the page, no key in the build.
- Add a first-class Ollama provider for the MacBook Air local model
  (`HKU_LLM_PROVIDER=ollama`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`), so the demo
  can run fully local without a cloud key.
- The compiler's structured-JSON request already falls back to plain text when
  a provider rejects `response_format`; keep that.

## Open decisions for the owner

1. Which effect set is “the lion's” for the hackathon demo — the table above,
   or a smaller four (stop legs, stop attacks, lure, hijack)?
2. Is “王佳” the lion's controller/opponent (so the cap is on the player's
   ability to puppeteer the lion), or a player character (cap on the player)?
   The budget currently caps the player's loadout; the design assumes the
   former.
3. Which endpoint is the “HKU campus model”: the local MacBook Air Ollama, the
   Magpie `auto/deepseek-v4.1-flash` route, or the HKU hackathon LiteLLM?
   The relay supports all three; the demo should name one.

## Plan

### Task 1 — function catalog and composition types

Files: `src/lionBoss/skillCatalog.ts`, new `src/lionBoss/skillParts.ts`,
`src/lionBoss/rules.ts` (type exports).

- `skillParts.ts`: `SKILL_PARTS` with the table above
  (`effect`, `target`, `durationMin/Max`, `rangeMin/Max`, `costPerSecond` or
  `costFlat`, `channels`, `requires`), `COMPOSITION_LIMITS`
  (`maxParts:3`, `maxDuration:8`, `maxCost:110`, `slots:2`, `range:4..16`),
  `cooldownOf(cost)` and `validateComposition(parts)` returning
  `{ok, cost, cooldown, parts}|{ok:false, reason}`. Pure data + functions, no
  DOM.
- Keep the three legacy ids (`stun`/`lure`/`ghost`) as named compositions in
  `SKILL_SPECS` for saves and the HUD; they become canonical one-part or
  two-part examples and keep their existing cost/cooldown numbers.

### Task 2 — compiler schema and model prompt

Files: `src/lionBoss/skillCompiler.ts`, `src/lionBoss/consoleService.ts`,
`src/lionBoss/workbench.ts`.

- Output schema: `{name, description, parts:[{effect,target?,side?,range?,
  duration?}]}`, `additionalProperties:false`, effect enum from the catalog.
- Instruction text teaches the composition rules (max 3 parts, budget, one
  channel per target, no damage/permanent/lock-skip). Keep the three legacy
  examples and add one two-part example.
- `validateSkillDefinition` validates each part, clamps only within declared
  ranges, sums cost, computes cooldown, rejects unknown fields, duplicate
  control channels, budget overflow, missing robot for `ROBOT_HIJACK`,
  missing point for lure, and any permanent/damage intent (`UNSUPPORTED`).
- Preserve the existing structured-output fallback to plain text and the
  model-name propagation (`result.value.model`).

### Task 3 — combat FSM effect channels

Files: `src/lionBoss/combat.ts` (or the current `createCombat` module),
`src/lionBoss/rules.ts`.

- Add effect state per channel: `locomotion` (locked until t), `attack`
  (locked; cancel wind-up), `speed` (factor until t), `target` (override to a
  signal/robot until t), `vision` (blind until t), `alert` (one-shot level
  change). Each part writes to its channel; active uses the strongest/nearest
  expiry. Re-casting refreshes without stacking.
- Preserve the existing telegraph → wind-up → hit → recover behaviour and the
  three legacy semantics exactly (their tests must pass unchanged).
- Casting rules: only in the maintenance area, only a composed skill, only one
  active skill at a time per channel; cooldown from the composition.

### Task 4 — Vibe Console composition UI

Files: `src/lionBoss/workbench.ts`, `src/lionBoss/consoleService.ts`,
`src/lionBoss/macbook.ts`, `src/style.css` or the module CSS.

- Show each recognized part with effect/target/duration/range/cost, the total
  cost and cooldown, and the exact rejection reason under the input.
- “Test skill” casts the composition on the training state; “Compile and
  deploy” re-validates budget/slots. Offline presets become two or three
  recommended compositions (e.g., freeze+lure, hijack+ghost).
- Update the installed-slot HUD to list parts, not just the legacy name.

### Task 5 — model relay (real model, key local)

Files: `scripts/llm-bridge.mjs`, `scripts/llm.mjs`, `src/opening/modelTransport.ts`,
`docs/LLM-ENDPOINT.md`, `.env.example`.

- Add an `ollama` provider (`OLLAMA_BASE_URL`, `OLLAMA_MODEL`) to the bridge
  and the settings UI; keep the loopback bridge as the only browser-facing
  endpoint.
- Document `LITELLM_BASE_URL` + `LITELLM_MODEL` for the lab LiteLLM / Magpie
  route (`magpie/auto/deepseek-v4.1-flash`); no key ever enters the page or
  the build.
- Show the actual model name returned by the provider in the console; if the
  provider is unreachable, offer the offline preset.

### Task 6 — gates and evidence

- `check:lion-boss`: catalog/composition validation, budget/channel rejection
  cases, cooldown formula, FSM channel effects, the three legacy skills, and a
  combination matrix of every one- and two-part composition (max 3 parts).
- Browser: compose a two-part skill from natural language, see parts/cost,
  test, install, cast; ask for a permanent/damage skill and see the exact
  rejection; run fully offline with Ollama if configured.
- No new keys in the repo; `git grep -nE 'sk-[A-Za-z0-9]'` clean; build has no
  provider secrets.

## Test surface

- `check:lion-boss`: catalog validation, composition budget/channel rules,
  rejection cases (permanent, damage, lock-skip, >3 parts, >110), FSM effects
  per part, combination matrix.
- Browser: type a composition, see parts/cost, test, install, cast; a
  rejection path (ask for a superman skill) shows the exact rule.
- No new keys in the repo; `git grep` for `sk-` stays clean.
