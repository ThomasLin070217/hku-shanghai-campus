import './menu.css';
import lawnPhoto from './lawn.webp';
import {getGraphicsQuality,setGraphicsQuality,type GraphicsQuality} from '../viewer/graphicsQuality';
import {clearProgress} from './resetProgress';
import {OPENING_SAVE_KEY} from '../opening/persistence';

document.title = 'HKU: Barrier 2030';

/**
 * Every chapter and checkpoint is the same one-world page: `?experience=opening`. The
 * link keeps the caller's parameters (`shell=1`, `intro`, `tools`, …); a hand-built
 * `?experience=…` dropped them and booted the chapter without the player shell (D-01).
 * Chapter 1 asks for a new run (`fresh=1`) instead of reloading the tab's save (S-09).
 */
function page(experience: 'opening' | 'survey', options: {checkpoint?: string; fresh?: boolean} = {}): string {
  const next = new URLSearchParams(location.search);
  next.set('experience', experience);
  next.delete('fresh');
  if (options.checkpoint) next.set('checkpoint', options.checkpoint);
  else next.delete('checkpoint');
  if (options.fresh) next.set('fresh', '1');
  return `?${next.toString()}`;
}
const at = (checkpoint: string) => page('opening', {checkpoint});

document.querySelector('#app')!.innerHTML = `
  <main class="levels">
    <header class="levels-heading"><span>HKU: Barrier 2030</span><span>Chapters</span></header>
    <div class="levels-layout">
      <section aria-labelledby="levels-title">
        <h1 id="levels-title">HKU: Barrier 2030</h1>
        <p class="levels-hint">HKU Shanghai · a CDS campus story</p>
        <p class="levels-hint">Play with a keyboard and mouse. Press Esc to pause.</p>
        <label class="levels-quality"><input type="checkbox" id="low-graphics"> Low graphics mode (lower 3D resolution, shadows off)</label>
        <nav class="levels-list" aria-label="Playable chapters">
          <div class="levels-chapter">
            <a href="${page('opening', {fresh: true})}"><b>Chapter 1 · High Table</b><span>Start in the plaza crowd after the light show, recover the MacBook, and reach Building 4. The Keyboard Wall is inside this chapter, at B4.</span></a>
            <div class="levels-checkpoints" role="group" aria-label="Chapter 1 checkpoints">
              <span class="levels-checkpoints-label">Checkpoints</span>
              <a class="levels-checkpoint" href="${at('b5')}"><b>B5 · High Table dinner</b><span>Start at Building 5, after the plaza gathering.</span></a>
              <a class="levels-checkpoint" href="${at('b6')}"><b>B6 · Fetch the MacBook</b><span>Start with the errand accepted, at the B6 ground hall doors. The office is on 5F.</span></a>
              <a class="levels-checkpoint" href="${at('incident')}"><b>The incident</b><span>Start in the empty dining hall with the MacBook and the security robots active.</span></a>
              <a class="levels-checkpoint" href="${at('b4')}"><b>B4 · Emergency control</b><span>Start on the last run of Chapter 1: cross the campus and reach Building 4.</span></a>
              <a class="levels-checkpoint" href="${at('b4-inside')}"><b>B4 · The Keyboard Wall</b><span>Start inside Building 4 and restore the backup supercomputer.</span></a>
            </div>
          </div>
          <a href="${at('lawn')}"><b>Chapter 2 · The Lawn Guardian (L001)</b><span>Walk from Building 4 to the lawn. Press Q to interrupt the lion's charge, then hold F at the glowing shutdown ring.</span></a>
          <a href="${at('sports')}"><b>Chapter 3 · Sports Hall Rescue</b><span>Walk from the lawn to the sports hall east door, then solve the sudoku and combination lock and rescue the students inside.</span></a>
          <a href="${at('ending')}"><b>Epilogue · Barrier Down</b><span>The students are free. Watch the dome lift.</span></a>
          <a href="${page('survey')}"><b>Side mission · Campus Survey</b><span>Visit three outdoor landmarks and sync the campus records on the computer.</span></a>
        </nav>
        <div class="levels-reset">
          <button id="reset-progress" type="button">Reset progress</button>
          <span>Clears this game's saved chapters and checkpoints on this device.</span>
        </div>
      </section>
      <figure><img src="${lawnPhoto}" alt="The campus lawn and the Guardian lion L001 in game"><figcaption>Campus lawn / L001</figcaption></figure>
    </div>
  </main>`;

/**
 * A chapter link loads the page, and the load replaces the run in this tab (a campaign
 * checkpoint overwrites the campaign save; a Chapter 1 checkpoint makes `host.reset()`
 * delete it), so it asks first — the same rule as the pause card's chapter list (S-37).
 * No save yet = nothing to lose.
 */
document.querySelectorAll<HTMLAnchorElement>('.levels-list a').forEach(link => {
  if (new URLSearchParams(link.search).get('experience') !== 'opening') return;
  link.addEventListener('click', event => {
    let hasRun = false;
    try { hasRun = localStorage.getItem(OPENING_SAVE_KEY) !== null; } catch { hasRun = false; }
    if (!hasRun) return;
    const label = link.querySelector('b')?.textContent ?? 'this chapter';
    if (!confirm(`Leave this run and start ${label}? The current run is replaced.`)) event.preventDefault();
  });
});

const lowGraphics = document.querySelector<HTMLInputElement>('#low-graphics')!;
function showQuality(quality:GraphicsQuality) {
  lowGraphics.checked = quality === 'low';
  document.querySelectorAll<HTMLAnchorElement>('.levels-list a').forEach(link => {
    const params = new URLSearchParams(link.search);
    if (quality === 'low' || new URLSearchParams(location.search).has('quality')) params.set('quality',quality);
    else params.delete('quality');
    link.search = params.toString();
  });
}
showQuality(getGraphicsQuality());
lowGraphics.addEventListener('change', () => {
  const quality = lowGraphics.checked ? 'low' : 'auto';
  setGraphicsQuality(quality);
  showQuality(quality);
});

// Clear only this game's namespaces (the one list lives in resetProgress.ts):
// the opening save and its slots, everything under hku.*, the lion boss save
// and the campaign save.
document.querySelector<HTMLButtonElement>('#reset-progress')!.addEventListener('click', () => {
  if (!confirm('Reset all local progress for HKU: Barrier 2030 on this device? The opening, chapter and mission saves are cleared.')) return;
  clearProgress(localStorage);
  location.reload();
});
