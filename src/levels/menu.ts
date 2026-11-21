import './menu.css';
import lawnPhoto from './lawn.webp';
import {getGraphicsQuality,setGraphicsQuality,type GraphicsQuality} from '../viewer/graphicsQuality';
import {clearProgress} from './resetProgress';

document.title = 'BARRIER 2030 · HKU Shanghai';

/** Every chapter and checkpoint is the same one-world page: `?experience=opening`. */
const at = (checkpoint: string) => `?experience=opening&checkpoint=${checkpoint}`;

document.querySelector('#app')!.innerHTML = `
  <main class="levels">
    <header class="levels-heading"><span>HKU Shanghai</span><span>Chapters</span></header>
    <div class="levels-layout">
      <section aria-labelledby="levels-title">
        <h1 id="levels-title">BARRIER 2030</h1>
        <p class="levels-hint">HKU Shanghai</p>
        <p class="levels-hint">Play with a keyboard and mouse. Press Esc to pause.</p>
        <label class="levels-quality"><input type="checkbox" id="low-graphics"> Low graphics mode (lower 3D resolution, shadows off)</label>
        <nav class="levels-list" aria-label="Playable chapters">
          <div class="levels-chapter">
            <a href="?experience=opening"><b>Chapter 1 · High Table</b><span>Start on the campus shuttle, recover the MacBook, and reach Building 4. The Keyboard Wall is inside this chapter, at B4.</span></a>
            <div class="levels-checkpoints" role="group" aria-label="Chapter 1 checkpoints">
              <span class="levels-checkpoints-label">Checkpoints</span>
              <a class="levels-checkpoint" href="?experience=opening&checkpoint=b5"><b>B5 · High Table dinner</b><span>Skip the shuttle and start at Building 5.</span></a>
              <a class="levels-checkpoint" href="?experience=opening&checkpoint=b6"><b>B6 · Fetch the MacBook</b><span>Start with the errand accepted, at Building 6.</span></a>
              <a class="levels-checkpoint" href="?experience=opening&checkpoint=incident"><b>The incident</b><span>Start in the empty dining hall with the MacBook and the security robots active.</span></a>
              <a class="levels-checkpoint" href="${at('b4')}"><b>B4 · Emergency control</b><span>Start on the last run of Chapter 1: cross the campus and reach Building 4.</span></a>
              <a class="levels-checkpoint" href="${at('b4-inside')}"><b>B4 · The Keyboard Wall</b><span>Start inside Building 4 and restore the backup supercomputer.</span></a>
            </div>
          </div>
          <a href="${at('lawn')}"><b>Chapter 2 · The Lawn Guardian (L001)</b><span>Walk from Building 4 to the lawn. Press Q to interrupt the lion's charge, then hold F at the glowing shutdown ring.</span></a>
          <a href="${at('sports')}"><b>Chapter 3 · Sports Hall Rescue</b><span>Solve the sudoku and combination lock at the east door, and rescue the students inside.</span></a>
          <a href="${at('ending')}"><b>Epilogue · Barrier Down</b><span>The students are free. Watch the dome lift.</span></a>
          <a href="?experience=survey"><b>Side mission · Campus Survey</b><span>Visit three outdoor landmarks and sync the campus records on the computer.</span></a>
        </nav>
        <div class="levels-reset">
          <button id="reset-progress" type="button">Reset progress</button>
          <span>Clears this game's saved chapters and checkpoints on this device.</span>
        </div>
      </section>
      <figure><img src="${lawnPhoto}" alt="The campus lawn and the Guardian lion L001 in game"><figcaption>Campus lawn / L001</figcaption></figure>
    </div>
  </main>`;

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
  if (!confirm('Reset all local progress for BARRIER 2030 on this device? The opening, chapter and mission saves are cleared.')) return;
  clearProgress(localStorage);
  location.reload();
});
