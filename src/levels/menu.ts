import './menu.css';
import lawnPhoto from './lawn.webp';
import {getGraphicsQuality,setGraphicsQuality,type GraphicsQuality} from '../viewer/graphicsQuality';
import {OPENING_SAVE_KEY} from '../opening/persistence';
import {recordCorePowerCut,sportsRescueLink} from '../lionBoss/mission';

document.title = 'BARRIER 2030 · HKU Shanghai';

/** The MacBook already earned in Chapter 1, so later chapters keep the same device. */
function savedMacInstance(): string | null {
  try {
    const raw = localStorage.getItem(OPENING_SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw) as {slots?: Array<{itemId?: string; instanceId?: string} | null>};
    if (!Array.isArray(save.slots)) return null;
    const slot = save.slots.find(entry => entry?.itemId === 'macbook-air-13-silver' && typeof entry.instanceId === 'string');
    return slot?.instanceId ?? null;
  } catch {
    return null;
  }
}

const device = savedMacInstance() ?? 'chapter-select-demo';
const keyboardWall = `interiors.html?${new URLSearchParams({chapter: 'b4', device}).toString()}`;

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
              <a class="levels-checkpoint" href="${keyboardWall}"><b>B4 · The Keyboard Wall</b><span>The puzzle page that restores the backup relay.</span></a>
              <a class="levels-checkpoint" href="?experience=opening&checkpoint=b4"><b>B4 · Emergency control</b><span>Start on the last run of Chapter 1: cross the campus and reach Building 4.</span></a>
            </div>
          </div>
          <a href="?experience=lion-boss"><b>Chapter 2 · The Lawn Guardian (L001)</b><span>Write skills on the MacBook to counter the mechanical lion and repair the system.</span></a>
          <a id="sports-link" href="${sportsRescueLink(device)}"><b>Chapter 3 · Sports Hall Rescue</b><span>Solve the sudoku and combination lock at the east door, and rescue the students inside.</span></a>
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

// Chapter 3 reads the same core-power event the lion writes. Seed it through the
// real mission path for this device so the "restored" brief shows.
const sportsLink = document.querySelector<HTMLAnchorElement>('#sports-link')!;
sportsLink.addEventListener('click', event => {
  event.preventDefault();
  recordCorePowerCut(device, 3);
  location.href = sportsLink.getAttribute('href') ?? sportsRescueLink(device);
});

// Clear only this game's namespaces: the opening save (and its writer/backup
// slots), everything under hku.*, and the lion boss save.
document.querySelector<HTMLButtonElement>('#reset-progress')!.addEventListener('click', () => {
  if (!confirm('Reset all local progress for BARRIER 2030 on this device? The opening, chapter and mission saves are cleared.')) return;
  const exact = new Set([OPENING_SAVE_KEY, OPENING_SAVE_KEY + '.writer']);
  const prefixes = [OPENING_SAVE_KEY + '.', 'hku.', 'hku.lion-boss.v1.'];
  const doomed: string[] = [];
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (!key) continue;
    if (exact.has(key) || prefixes.some(prefix => key.startsWith(prefix))) doomed.push(key);
  }
  for (const key of doomed) localStorage.removeItem(key);
  location.reload();
});
