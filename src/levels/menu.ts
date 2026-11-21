import './menu.css';
import lawnPhoto from './lawn.webp';
import {getGraphicsQuality,setGraphicsQuality,type GraphicsQuality} from '../viewer/graphicsQuality';

document.title = 'BARRIER 2030 · HKU Shanghai';
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
          <a href="?experience=opening"><b>Chapter 1 · High Table</b><span>Start on the campus shuttle, recover the MacBook, and reach Building 4. The keyboard wall is inside this chapter, at B4.</span></a>
          <a href="?experience=lion-boss"><b>Chapter 2 · The Lawn Guardian (L001)</b><span>Write skills on the MacBook to counter the mechanical lion and repair the system.</span></a>
          <a href="?experience=sports-hall"><b>Chapter 3 · Sports Hall Rescue</b><span>Solve the sudoku and combination lock at the east door, and rescue the students inside.</span></a>
          <a href="?experience=survey"><b>Side mission · Campus Survey</b><span>Visit three outdoor landmarks and sync the campus records on the computer.</span></a>
        </nav>
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
