/**
 * Runtime half of the player shell (see game-shell.css).
 *
 * The opening page ships the campus authoring chrome in the same header as the
 * game. CSS removes it for players; this module adds the one menu hint a player
 * needs to find the Esc menu.
 *
 * The checkpoint action used to be moved into the pause card from the hidden
 * atlas bar. The card now ships its own "Return to checkpoint" button (it
 * delegates to #reset), so this module no longer moves DOM: the chapter select
 * and Replay intro live in the card too (owner, 2026-11-25).
 *
 * Called after `./main` has built the DOM, and only when the shell is active
 * (not `?tools=1`, not the review build).
 */

const MENU_HINT = 'Esc · menu';
const CHAPTERS_HREF = '?experience=levels';

export function applyOpeningShell(): void {
  const stage = document.querySelector<HTMLElement>('.stage');
  if (stage && !stage.querySelector('.shell-chapters')) {
    // A visible way out of the chapter while walking (touch, drag controls): the
    // authoring header is hidden by the player shell. While paused the card's own
    // chapter select takes over, and CSS hides this link so it never looks
    // clickable under the pause overlay.
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
