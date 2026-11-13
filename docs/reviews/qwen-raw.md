# Qwen3.8-Flash 原始审阅（未经核实）

审阅对象为改动前的控制器，经 TypeScript printer 格式化，语义未改。以 OPEN-SOURCE-V6.md 的裁定为准。

1. **Input Stuck on Blur/Unlock**
   *Trigger*: Press `W` then click the browser UI (triggering `blur`). Release `W`.
   *Problem*: `pause()` calls `clear()`, which empties the `keys` set. However, if the user releases the key while the window is unfocused or pointer-locked is lost, the `keyup` event might not fire or is ignored because `enabled` checks pass but `controlled()` fails in some paths, or simply the state desyncs. More critically, `keyup` deletes from `keys` regardless of `enabled` or focus status, but `keydown` gates strictly. If `pointerlockchange` fires after a blur that didn't clear keys properly due to race conditions, movement can persist. The main bug is that `keyup` doesn't check `enabled`. If `enabled` becomes false via `setEnabled(false)`, subsequent `keyup`s still mutate the internal `keys` set, potentially causing stale input states if re-enabled.
   *Fix*: In `window.addEventListener('keyup', ...)`, add a guard: `if (!enabled || editable(e.target)) return;` before deleting.

2. **Pointer Lock State Desync in `compat` Mode**
   *Trigger*: Switch to `compat` mode (`enterCompat()`), then trigger a `pointerlockchange` event (e.g., via browser extension or system action).
   *Problem*: The `pointerlockchange` listener unconditionally calls `clear()`. In `compat` mode, `clear()` resets `game.human` inputs to zero. Since `compat` mode relies on drag/mousemove rather than locked state for yaw/pitch, clearing inputs here is correct for movement keys, but it also sets `dragging = false`. If the user is currently dragging, this interrupts the interaction unexpectedly. Furthermore, `pause` is not called, so `game.paused` remains false, but inputs are wiped.
   *Fix*: Modify `clear()` to only reset keys and game human state, not `dragging`. Move `dragging = false` into the specific pause/exit logic where full reset is intended, or ensure `pointerlockchange` does not disrupt active `compat` dragging unless explicitly pausing. Minimal fix: In `pointerlockchange`, do not call `clear()` if `compat` is true; instead, just exit lock. Or, split `clear()`: `clearKeys()` vs `resetInteraction()`.

3. **Disposal Leaks Event Listeners**
   *Trigger*: Call `dispose()`.
   *Problem*: `dispose()` removes Three.js objects but never removes the `window` and `document` event listeners added at initialization (`blur`, `visibilitychange`, `focusin`, `pointerlockchange`, `pointerlockerror`, `keydown`, `keyup`, `mousemove`). These closures capture `canvas`, `game`, `world`, etc., preventing garbage collection of the entire controller instance and its associated resources.
   *Fix*: Store references to all handler functions and remove them in `dispose()`. For example:
   ```typescript
   const onKeydown = e => { ... }; // define named functions
   window.addEventListener('keydown', onKeydown);
   // ... in dispose():
   window.removeEventListener('keydown', onKeydown);
   document.removeEventListener('pointerlockchange', onPointerLockChange);
   // ... repeat for all listeners.
   ```