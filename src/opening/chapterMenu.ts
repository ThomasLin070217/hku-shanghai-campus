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

const HINTS: Record<OpeningCheckpoint, string> = {
  b5: 'Skip the shuttle and start at Building 5.',
  b6: 'Start with the errand accepted, at the B4 side door.',
  incident: 'The empty dining hall, security robots active.',
  b4: 'Cross the campus to the B4 control room.',
  'b4-inside': 'Inside B4, restore the backup supercomputer.',
  lawn: 'The lawn guardian L001, after Chapter 1.',
  sports: 'The sports hall east door, after the lawn.',
  ending: 'The students are free. Watch the barrier come down.',
};

interface ChapterGroup {
  title: string;
  /** The chapter's own start link, when the chapter opens with a cinematic beat. */
  start?: {href: string; label: string};
  checkpoints: readonly OpeningCheckpoint[];
}

const GROUPS: readonly ChapterGroup[] = [
  {
    title: 'Chapter 1 · High Table',
    start: {href: '?experience=opening', label: 'Start · the campus shuttle'},
    checkpoints: ['b5', 'b6', 'incident', 'b4', 'b4-inside'],
  },
  {title: 'Chapter 2 · The Lawn Guardian', checkpoints: ['lawn']},
  {title: 'Chapter 3 · Sports Hall Rescue', checkpoints: ['sports']},
  {title: 'Epilogue · Barrier Down', checkpoints: ['ending']},
];

const href = (id: OpeningCheckpoint) => `?experience=opening&checkpoint=${id}`;

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
      start.href = group.start.href;
      start.textContent = group.start.label;
      nav.append(start);
    }
    for (const id of group.checkpoints) {
      const link = document.createElement('a');
      link.className = 'pause-chapter-link';
      link.href = href(id);
      link.dataset.checkpoint = id;
      const title = document.createElement('b');
      title.textContent = CHECKPOINT_LABELS[id];
      const hint = document.createElement('span');
      hint.textContent = HINTS[id];
      link.append(title, hint);
      nav.append(link);
    }
  }
  return nav;
}
