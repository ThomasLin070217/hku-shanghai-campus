/**
 * Chapter select for the pause card (owner, 2026-11-25).
 *
 * The floating "Chapters" link is unreachable in play: while the game runs the
 * pointer is locked, and while it is paused the full-screen pause overlay
 * (z-index 12) sits on top of the link (z-index 11). It looks clickable and is
 * not — "chapter 根本点不到". The pause card is the one surface a player can
 * always click, so the chapter list lives there, beside Replay intro.
 *
 * Labels come from `CHECKPOINT_LABELS`, the table the levels page and the
 * checkpoint poses already share, so a renamed checkpoint cannot drift between
 * the two menus. The hints are pause-card copy and stay here.
 */
import {CHECKPOINT_LABELS, type OpeningCheckpoint} from './checkpoint';
import {OPENING_SAVE_KEY} from './persistence';

/**
 * The hints name where the checkpoint *puts the player*, not where the chapter ends.
 * `lawn` and `sports` deliberately spawn at the start of the walking leg into the
 * chapter (the chapter card and the leg objective are part of the beat; the pose and
 * the resume stage are locked by `scripts/check-chapter-select.ts`), so their hints
 * describe that walk instead of naming the destination (S-34).
 */
const HINTS: Record<OpeningCheckpoint, string> = {
  b5: 'Start at Building 5, after the plaza gathering.',
  b6: 'Start with the errand accepted, at the B6 ground hall doors.',
  incident: 'The empty dining hall, security robots active.',
  b4: 'Cross the campus to the B4 control room.',
  'b4-inside': 'Inside B4, restore the backup supercomputer.',
  lawn: 'Start at Building 4, on the walk to the lawn guardian.',
  sports: 'Start on the lawn, on the walk to the sports hall east door.',
  ending: 'The students are free. Watch the barrier come down.',
};

interface ChapterGroup {
  title: string;
  /** The chapter's own start link, when the chapter opens with a cinematic beat. */
  start?: {label: string};
  checkpoints: readonly OpeningCheckpoint[];
}

const GROUPS: readonly ChapterGroup[] = [
  {
    title: 'Chapter 1 · High Table',
    start: {label: 'Start · the plaza gathering'},
    checkpoints: ['b5', 'b6', 'incident', 'b4', 'b4-inside'],
  },
  {title: 'Chapter 2 · The Lawn Guardian', checkpoints: ['lawn']},
  {title: 'Chapter 3 · Sports Hall Rescue', checkpoints: ['sports']},
  {title: 'Epilogue · Barrier Down', checkpoints: ['ending']},
];

/**
 * A chapter link is a boot of this same page, so it must carry the parameters the
 * boot reads — `shell=1` (a review build only shows the player shell with it),
 * `quality`, `intro`, anything else already on the URL — not a hand-built
 * `?experience=opening&checkpoint=` that drops them all. Dropping them booted a
 * chosen chapter without the player shell (D-01). The chosen checkpoint replaces
 * any current one; the start link asks for a new run (`fresh=1`) instead of silently
 * reloading the save the tab already holds (S-09), and clears any checkpoint.
 */
function entryHref(checkpoint?: OpeningCheckpoint): string {
  const params = new URLSearchParams(location.search);
  params.set('experience', 'opening');
  params.delete('fresh');
  if (checkpoint) params.set('checkpoint', checkpoint);
  else {
    params.delete('checkpoint');
    params.set('fresh', '1');
  }
  return `?${params.toString()}`;
}

/**
 * A chapter link is a page load, and the load discards the run in this tab: a campaign
 * checkpoint overwrites the campaign save and a Chapter 1 checkpoint deletes it
 * (`host.reset()`), before the player has played anything (S-37). The Reset button
 * beside this list already asks first; these links must too. No save yet = nothing to lose.
 */
function confirmBeforeReplacing(link: HTMLAnchorElement, label: string): void {
  link.addEventListener('click', (event) => {
    let hasRun = false;
    try {
      hasRun = localStorage.getItem(OPENING_SAVE_KEY) !== null;
    } catch {
      hasRun = false;
    }
    if (!hasRun) return;
    if (confirm(`Leave this run and start ${label}? The current run is replaced.`)) return;
    event.preventDefault();
  });
}

export function createChapterList(): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'pause-chapter-list';
  nav.setAttribute('aria-label', 'Chapters and checkpoints');
  for (const group of GROUPS) {
    const heading = document.createElement('p');
    heading.className = 'pause-chapter-group';
    heading.textContent = group.title;
    nav.append(heading);
    if (group.start) {
      const start = document.createElement('a');
      start.className = 'pause-chapter-start';
      start.href = entryHref();
      start.textContent = group.start.label;
      confirmBeforeReplacing(start, 'Chapter 1 from the plaza gathering');
      nav.append(start);
    }
    for (const id of group.checkpoints) {
      const link = document.createElement('a');
      link.className = 'pause-chapter-link';
      link.href = entryHref(id);
      link.dataset.checkpoint = id;
      const title = document.createElement('b');
      title.textContent = CHECKPOINT_LABELS[id];
      const hint = document.createElement('span');
      hint.textContent = HINTS[id];
      link.append(title, hint);
      confirmBeforeReplacing(link, CHECKPOINT_LABELS[id]);
      nav.append(link);
    }
  }
  return nav;
}
