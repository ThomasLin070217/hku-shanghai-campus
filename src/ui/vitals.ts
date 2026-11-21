import {OPENING_MAX_HEARTS} from '../opening/runtime';
import './vitals.css';

// Original eleven-row pixel artwork from the opening HUD.
const left = [1, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3];
const right = [2, 3, 7, 7, 7, 6, 6, 5, 5, 4, 4];
const pixels = left.map((x, y) => `<rect x="${x}" y="${y}" width="${right[y] - x + 1}" height="1"/>`).join('');
const heartSvg = `<svg viewBox="0 0 8 11" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${pixels}</svg>`;

export function createVitalsHud(label = 'Vitals') {
  const element = document.createElement('section');
  element.className = 'opening-hearts';
  element.setAttribute('role', 'img');
  element.innerHTML = '<div class="opening-hearts-head"><p class="opening-hearts-label"></p><span class="opening-hearts-count"></span></div><div class="opening-hearts-row"></div>';
  element.querySelector('.opening-hearts-label')!.textContent = label;
  const count = element.querySelector('.opening-hearts-count')!;
  const row = element.querySelector('.opening-hearts-row')!;
  const hearts = Array.from({length:OPENING_MAX_HEARTS}, () => {
    const icon = document.createElement('span');
    icon.className = 'opening-heart is-full';
    icon.innerHTML = heartSvg;
    icon.setAttribute('aria-hidden', 'true');
    icon.addEventListener('animationend', () => icon.classList.remove('is-hit'));
    row.append(icon);
    return icon;
  });
  let previous:number|undefined;
  function update(current:number) {
    const hp = Math.max(0, Math.min(OPENING_MAX_HEARTS, Math.round(current)));
    if (previous === hp) return;
    hearts.forEach((icon, i) => {
      icon.classList.toggle('is-full', i < hp);
      icon.classList.toggle('is-empty', i >= hp);
      if (previous !== undefined && i >= hp && i < previous) icon.classList.add('is-hit');
      if (i < hp) icon.classList.remove('is-hit');
    });
    count.textContent = `${hp} / ${OPENING_MAX_HEARTS}`;
    element.setAttribute('aria-label', `${hp} of ${OPENING_MAX_HEARTS} hearts`);
    element.classList.toggle('is-low', hp > 0 && hp <= 4);
    element.classList.toggle('is-empty', hp === 0);
    previous = hp;
  }
  return {element, update, dispose:() => element.remove()};
}
