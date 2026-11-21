/**
 * Runtime half of the player shell (see game-shell.css).
 *
 * The opening page ships the campus authoring chrome in the same header as the
 * game. CSS removes it for players; this module folds the one action that lived
 * in that chrome — return to checkpoint — into the Esc menu, and adds the single
 * menu hint a player needs to find that menu.
 *
 * Called after `./main` has built the DOM, and only when the shell is active
 * (not `?tools=1`, not the review build).
 */

const MENU_HINT = 'Esc · menu';
const CHAPTERS_HREF = '?experience=levels';

export function applyOpeningShell(): void {
  const card = document.querySelector<HTMLElement>('#pause-panel .pause-card');
  const reset = document.getElementById('reset');
  const settings = document.getElementById('experience-settings');

  // The checkpoint button lives in the hidden atlas bar; move it into the menu
  // so the action survives without the authoring chrome.
  if (card && reset && settings && !card.contains(reset)) {
    reset.classList.add('pause-checkpoint');
    settings.before(reset);
  }

  const stage = document.querySelector<HTMLElement>('.stage');
  if (stage && !stage.querySelector('.shell-chapters')) {
    // A visible way out of the chapter: the authoring header (and its Chapters
    // link) is hidden by the player shell, so the chapter select gets its own
    // fixed button away from the top-left HUD.
    const chapters = document.createElement('a');
    chapters.className = 'shell-chapters';
    chapters.href = CHAPTERS_HREF;
    chapters.textContent = 'Chapters';
    stage.append(chapters);
  }
  if (stage && !stage.querySelector('.shell-hint')) {
    const hint = document.createElement('div');
    hint.className = 'shell-hint';
    hint.textContent = MENU_HINT;
    hint.setAttribute('aria-hidden', 'true');
    stage.append(hint);
  }
}
