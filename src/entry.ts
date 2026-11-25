import './opening/game-shell.css';

const params = new URLSearchParams(location.search);
const entry = params.get('experience') ??
  (import.meta.env.MODE === 'playtest' ? 'levels' : 'opening');
// Player shell: the opening page also hosts the campus authoring chrome. Strip
// it for players; `?tools=1` and the review build keep the full tooling, and
// `?shell=1` gives a review build the real player shell for the mobile gate.
const gameShell = entry === 'opening' && params.get('tools') !== '1' &&
  (import.meta.env.MODE !== 'review' || params.get('shell') === '1');
if (gameShell) document.body.classList.add('game-shell');
if ((import.meta.env.DEV || import.meta.env.MODE === 'review') && entry === 'macbook-lab') {
  void import('./review/macbookLab');
} else if (entry === 'levels') {
  void import('./levels/menu');
} else if (entry === 'lion-boss') {
  void import('./lionBoss/play');
} else {
  void import('./main').then(async () => {
    if (!gameShell) return;
    const {applyOpeningShell} = await import('./opening/gameShell');
    applyOpeningShell();
  });
}
