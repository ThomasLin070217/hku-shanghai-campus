import './opening.css';
import {OPENING_UI as T} from '../../content/opening/en';
import type {OpeningModal, OpeningUIActions, OpeningView} from './contracts';
import {DEFAULT_SETTINGS} from '../gameplay/save';
import {setHidden, setText} from '../ui/dom';
import {createLocalAgent} from './agent';
import {createMacBookExperience} from './macbook';
import {OPENING_CAPTURE_DAMAGE, OPENING_MAX_HEARTS} from './runtime';

/**
 * English opening UI renderer. It only renders opening state and submits
 * `OpeningUIActions` intents: story flags, items, pause state and player
 * movement stay owned by `experience.ts` / `CampusGame`.
 */

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), summary, a[href], [tabindex]:not([tabindex="-1"])';
const SLIDERS = [
  ['sensitivity', 0.0004, 0.006, 0.0001],
  ['fov', 60, 90, 1],
  ['ambient', 0, 1, 0.05],
  ['steps', 0, 1, 0.05],
  ['ui', 0, 1, 0.05],
  ['sfx', 0, 1, 0.05],
  ['music', 0, 1, 0.05],
] as const;
type SliderKey = (typeof SLIDERS)[number][0];
type DialogKind = Exclude<OpeningModal, null>;

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatSetting(key: SliderKey, value: number): string {
  if (key === 'sensitivity') return (value / DEFAULT_SETTINGS.sensitivity).toFixed(2) + '×';
  if (key === 'fov') return Math.round(value) + '°';
  return Math.round(value * 100) + '%';
}

export function createOpeningUI(
  stage: HTMLElement,
  actions: OpeningUIActions,
): {update(view: OpeningView): void; dispose(): void} {
  const events = new AbortController();
  let currentView:OpeningView|null=null;

  // ---------------------------------------------------------------- HUD.
  const hud = node('section', 'opening-hud');
  hud.setAttribute('aria-label', T.hud.objectiveLabel);
  const objective = node('h2', 'opening-objective');
  const details = node('details', 'opening-details');
  const detailText = node('p', 'opening-detail-text');
  details.append(node('summary', '', T.hud.details), detailText);
  const saveLine = node('p', 'opening-save');
  const distanceEl = node('p', 'opening-distance');
  const distanceArrow = node('i', 'opening-distance-arrow', '↑');
  distanceArrow.setAttribute('aria-hidden', 'true');
  const distanceText = node('span', 'opening-distance-text', '');
  distanceEl.append(distanceArrow, distanceText);
  hud.append(node('p', 'opening-eyebrow', T.hud.objectiveLabel), objective, details, distanceEl, saveLine);

  const mapCard = node('button', 'opening-mapcard');
  mapCard.type = 'button';
  mapCard.setAttribute('aria-label', T.hud.mapAria);
  const miniCanvas = node('canvas', 'opening-minimap-canvas');
  miniCanvas.width = 220;
  miniCanvas.height = 270;
  miniCanvas.setAttribute('aria-hidden', 'true');
  mapCard.append(miniCanvas, node('span', 'opening-mapcard-label', T.hud.mapLabel));
  mapCard.addEventListener('click', () => actions.action('map'));

  const promptEl = node('p', 'opening-prompt');
  promptEl.hidden = true;
  promptEl.setAttribute('role', 'status');

  const warningEl = node('div', 'opening-warning');
  warningEl.hidden = true;
  warningEl.setAttribute('role', 'status');
  warningEl.setAttribute('aria-live', 'polite');
  const warningStateEl = node('span', 'opening-warning-state');
  const warningFillEl = node('b', '');
  const warningBarEl = node('i', 'opening-warning-bar');
  warningBarEl.setAttribute('aria-hidden', 'true');
  warningBarEl.append(warningFillEl);
  warningEl.append(node('span', 'opening-warning-label', T.robot.label), warningStateEl, warningBarEl);

  // -------------------------------------------------------------- Hearts.
  const heartSvg = () => {
    // A deliberately blocky pixel heart: 11 rows of crisp rects, not an emoji.
    const left = [1, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3];
    const right = [2, 3, 7, 7, 7, 6, 6, 5, 5, 4, 4];
    let rects = '';
    for (let y = 0; y < left.length; y++) {
      rects += `<rect x="${left[y]}" y="${y}" width="${right[y] - left[y] + 1}" height="1"/>`;
    }
    return `<svg viewBox="0 0 8 11" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;
  };
  const heartsCard = node('section', 'opening-hearts');
  heartsCard.setAttribute('aria-label', 'Vital hearts');
  const heartsHead = node('div', 'opening-hearts-head');
  const heartsLabel = node('p', 'opening-hearts-label', 'Vitals');
  const heartsCount = node('span', 'opening-hearts-count', '10 / 10');
  heartsHead.append(heartsLabel, heartsCount);
  const heartsRow = node('div', 'opening-hearts-row');
  const heartEls: HTMLElement[] = [];
  for (let i = 0; i < OPENING_MAX_HEARTS; i++) {
    const heart = node('span', 'opening-heart is-full');
    heart.innerHTML = heartSvg();
    heart.setAttribute('aria-hidden', 'true');
    heartsRow.append(heart);
    heartEls.push(heart);
  }
  heartsCard.append(heartsHead, heartsRow);
  heartsCard.setAttribute('role', 'img');
  heartsCard.setAttribute('aria-label', '10 of 10 hearts');

  const dangerVignette = node('div', 'opening-danger-vignette');
  dangerVignette.setAttribute('aria-hidden', 'true');

  stage.append(heartsCard, hud, mapCard, promptEl, warningEl, dangerVignette);

  // ---------------------------------------------------------- Cinematic.
  const cinema = node('section', 'opening-cinema');
  cinema.hidden = true;
  cinema.setAttribute('aria-live', 'polite');
  const cinemaBlack = node('div', 'opening-cinema-black');
  const cinemaBarTop = node('i', 'opening-cinema-bar top');
  const cinemaBarBottom = node('i', 'opening-cinema-bar bottom');
  const cinemaCopy = node('div', 'opening-cinema-copy');
  const cinemaTitle = node('h2', 'opening-cinema-title');
  const cinemaSubtitle = node('p', 'opening-cinema-subtitle-line');
  const cinemaHint = node('p', 'opening-cinema-hint');
  cinemaCopy.append(cinemaTitle, cinemaSubtitle, cinemaHint);
  const cinemaSpeech = node('p', 'opening-cinema-speech');
  cinema.append(cinemaBlack, cinemaBarTop, cinemaBarBottom, cinemaCopy, cinemaSpeech);
  stage.append(cinema);

  // -------------------------------------------------------------- Modal.
  const modalRoot = node('div', 'opening-modal-root');
  modalRoot.hidden = true;
  document.body.append(modalRoot);

  let dialog: HTMLElement | null = null;
  let kind: DialogKind | null = null;
  let previousFocus: HTMLElement | null = null;
  let closeSent: DialogKind | null = null;
  let retrySent = false;
  let lastSignature: string | null = null;
  let lastMiniDraw = 0;
  let lastWarningText = '';

  function dialogShell(sectionKind: DialogKind): HTMLElement {
    const shell = node('section', 'opening-dialog opening-dialog--' + sectionKind);
    shell.tabIndex = -1;
    shell.setAttribute('role', 'dialog');
    shell.setAttribute('aria-modal', 'true');
    shell.setAttribute('aria-labelledby', 'opening-modal-title');
    return shell;
  }

  function head(eyebrow: string, title: string, closable: boolean): HTMLElement {
    const header = node('header', 'opening-dialog-head');
    const heading = node('div', 'opening-dialog-heading');
    const titleEl = node('h2', 'opening-dialog-title', title);
    titleEl.id = 'opening-modal-title';
    heading.append(node('p', 'opening-eyebrow', eyebrow), titleEl);
    header.append(heading);
    if (closable) {
      const close = node('button', 'opening-dialog-close', T.common.close);
      close.type = 'button';
      close.setAttribute('aria-label', T.common.close);
      close.addEventListener('click', () => requestClose());
      header.append(close);
    }
    return header;
  }

  function makeButton(label: string, variant: 'primary' | 'secondary' | 'danger', onClick: () => void): HTMLButtonElement {
    const button = node('button', 'opening-button opening-button--' + variant, label);
    button.type = 'button';
    button.addEventListener('click', onClick);
    return button;
  }

  function actionRow(...buttons: HTMLElement[]): HTMLElement {
    const footer = node('footer', 'opening-dialog-actions');
    footer.append(...buttons);
    return footer;
  }

  function focusFirst(target: HTMLElement): void {
    const usable = (element: HTMLElement | null): element is HTMLElement =>
      !!element && element.offsetParent !== null && !(element as HTMLButtonElement).disabled;
    const preferred = Array.from(target.querySelectorAll<HTMLElement>('[data-autofocus]')).find(usable);
    const first = preferred ?? Array.from(target.querySelectorAll<HTMLElement>(FOCUSABLE)).find(usable);
    (first ?? target).focus({preventScroll: true});
  }

  function requestClose(): void {
    if (!dialog || kind === null || kind === 'caught' || closeSent === kind) return;
    closeSent = kind;
    actions.close();
  }

  function showDialog(next: HTMLElement, nextKind: DialogKind): void {
    const entering = kind === null;
    if (entering) previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.remove();
    dialog = next;
    kind = nextKind;
    closeSent = null;
    retrySent = false;
    modalRoot.append(next);
    modalRoot.dataset.kind = nextKind;
    modalRoot.hidden = false;
    focusFirst(next);
  }

  function hideDialog(): void {
    if (!dialog) return;
    const restore = previousFocus;
    dialog.remove();
    dialog = null;
    kind = null;
    previousFocus = null;
    closeSent = null;
    retrySent = false;
    modalRoot.hidden = true;
    delete modalRoot.dataset.kind;
    if (!restore) return;
    if (restore.isConnected && restore.offsetParent !== null) restore.focus({preventScroll: true});
    else document.querySelector<HTMLElement>('.stage canvas')?.focus({preventScroll: true});
  }

  // ------------------------------------------------------ MacBook + Agent.
  const localAgent = createLocalAgent();
  const mac = createMacBookExperience({
    actions,
    drawMap: (canvas, large) => actions.drawMap(canvas, large),
    onClose: () => requestClose(),
    agent: localAgent,
  });

  // ------------------------------------------------------------ Modals.
  function invitationDialog(view: OpeningView): HTMLElement {
    const shell = dialogShell('invitation');
    shell.classList.add('opening-invite-shell');
    const card = node('div', 'opening-invite-card');
    const crest = node('div', 'opening-invite-crest');
    crest.innerHTML =
      '<svg viewBox="0 0 84 100" aria-hidden="true" focusable="false">' +
      '<path d="M42 3 78 15v33c0 24-15 39-36 49C21 87 6 72 6 48V15z" fill="none" stroke="currentColor" stroke-width="2.4"/>' +
      '<path d="M42 12 69 21v27c0 18-11 31-27 40-16-9-27-22-27-40V21z" fill="none" stroke="currentColor" stroke-width="1" opacity=".55"/>' +
      '<path d="M27 40h30v4H27zM30 48h24v3H30zM30 55h24v3H30z" fill="currentColor" opacity=".85"/>' +
      '<path d="M34 70c4-5 12-5 16 0" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
      '<text x="42" y="34" text-anchor="middle" font-family="Georgia,serif" font-size="13" font-weight="700" fill="currentColor" letter-spacing="1">HKU</text>' +
      '</svg>';
    const top = node('p', 'opening-invite-top', T.invitation.eyebrow);
    const host = node('p', 'opening-invite-host', T.invitation.host);
    const name = node('p', 'opening-invite-name', T.invitation.name);
    const rule = node('div', 'opening-invite-rule');
    rule.setAttribute('aria-hidden', 'true');
    rule.innerHTML = '<i></i><b>◆</b><i></i>';
    const title = node('h2', 'opening-invite-title', T.invitation.title);
    title.id = 'opening-modal-title';
    const subtitle = node('p', 'opening-invite-subtitle', T.invitation.subtitle);
    const facts = node('dl', 'opening-invite-facts');
    for (const [label, value] of [
      [T.invitation.dateLabel, T.invitation.dateValue],
      [T.invitation.timeLabel, T.invitation.timeValue],
      [T.invitation.venueLabel, T.invitation.venueValue],
      [T.invitation.dressLabel, T.invitation.dressValue],
    ] as [string, string][]) {
      const row = node('div', 'opening-invite-fact');
      row.append(node('dt', '', label), node('dd', '', value));
      facts.append(row);
    }
    const body = node('p', 'opening-invite-body', T.invitation.body);
    const note = node('p', 'opening-invite-note', T.invitation.note);
    const seal = node('div', 'opening-invite-seal', T.invitation.seal);
    seal.setAttribute('aria-hidden', 'true');
    card.append(top, crest, host, name, rule, title, subtitle, facts, body, note, seal);
    shell.append(card);
    const continueButton = view.story.invitation_read
      ? makeButton(T.invitation.alreadyRead, 'primary', () => requestClose())
      : makeButton(T.invitation.continue, 'primary', () => actions.action('read_invitation'));
    continueButton.dataset.autofocus = 'true';
    const footer = actionRow(makeButton(T.invitation.close, 'secondary', requestClose), continueButton);
    footer.classList.add('opening-invite-actions');
    shell.append(footer);
    return shell;
  }

  function staffDialog(): HTMLElement {
    const shell = dialogShell('staff');
    shell.append(head(T.staff.eyebrow, T.staff.title, true));
    const body = node('div', 'opening-dialog-body opening-dialogue');
    body.append(
      node('p', 'opening-speaker', T.staff.speaker),
      node('p', 'opening-line', T.staff.line1),
      node('p', 'opening-line', T.staff.line2),
      node('p', 'opening-muted', T.staff.line3),
      node('p', 'opening-muted', 'English voice · synthesized'),
      makeButton('Replay voice', 'secondary', () => actions.action('replay_voice')),
    );
    shell.append(body);
    const accept = makeButton(T.staff.accept, 'primary', () => actions.action('accept_errand'));
    accept.dataset.autofocus = 'true';
    shell.append(actionRow(makeButton(T.staff.later, 'secondary', requestClose), accept));
    return shell;
  }

  function alertDialog(): HTMLElement {
    const shell = dialogShell('alert');
    shell.append(head(T.alert.eyebrow, T.alert.title, true));
    const body = node('div', 'opening-dialog-body opening-alert');
    body.append(node('p', 'opening-alert-intro', T.alert.intro));
    const list = node('ol', 'opening-alert-list');
    for (const [title, text] of T.alert.items) {
      const item = node('li', '');
      item.append(node('b', '', title), document.createTextNode(text));
      list.append(item);
    }
    body.append(list, node('p', 'opening-alert-note', T.alert.note));
    shell.append(body);
    const confirm = makeButton(T.alert.confirm, 'primary', () => actions.action('read_alert'));
    confirm.dataset.autofocus = 'true';
    shell.append(actionRow(makeButton(T.alert.later, 'secondary', requestClose), confirm));
    return shell;
  }

  function computerDialog(view: OpeningView): HTMLElement {
    const shell = dialogShell('computer');
    shell.classList.add('opening-mac-shell');
    const closeHint = node('button', 'opening-mac-closehint', 'Put to sleep · C');
    closeHint.type = 'button';
    closeHint.addEventListener('click', () => requestClose());
    shell.append(mac.root, closeHint);
    mac.open(view);
    return shell;
  }

  function tasksPage(view: OpeningView): HTMLElement {
    const wrap = node('section', 'opening-tasks');
    const objectiveBox = node('div', 'opening-objective-box');
    objectiveBox.append(
      node('p', 'opening-eyebrow', T.computer.objectiveLabel),
      node('h3', 'opening-computer-objective', view.objective),
      node('p', 'opening-computer-detail', view.detail),
    );
    wrap.append(objectiveBox);
    if (view.story.campus_alert_triggered && view.story.alert_read) {
      const emergency = node('div', 'opening-emergency');
      emergency.append(
        node('p', 'opening-emergency-title', T.computer.emergencyTitle),
        node('p', 'opening-emergency-body', T.computer.emergencyBody),
      );
      wrap.append(emergency);
    } else {
      const info = node('div', 'opening-info');
      info.append(node('p', 'opening-info-title', T.computer.normalTitle));
      for (const line of T.computer.normalLines) info.append(node('p', 'opening-info-line', line));
      wrap.append(info);
    }
    const statuses = [
      view.story.invitation_read,
      view.story.laptop_acquired,
      view.story.alert_read,
      view.story.stage === 'complete',
    ];
    const nextIndex = statuses.findIndex((done) => !done);
    const list = node('ol', 'opening-steps');
    T.computer.steps.forEach((step, index) => {
      const done = statuses[index];
      const next = !done && index === nextIndex;
      const item = node('li', 'opening-step' + (done ? ' is-done' : next ? ' is-next' : ''));
      const mark = node('span', 'opening-step-mark', done ? '✓' : String(index + 1));
      mark.setAttribute('aria-hidden', 'true');
      item.append(
        mark,
        node('span', 'opening-step-label', step.label),
        node('span', 'opening-step-status', done ? T.computer.stepDone : next ? T.computer.stepNext : T.computer.stepPending),
      );
      list.append(item);
    });
    wrap.append(node('h4', 'opening-steps-title', T.computer.stepsTitle), list);
    return wrap;
  }

  function mapPage(): HTMLElement {
    const wrap = node('div', 'opening-map-page');
    const canvas = node('canvas', 'opening-bigmap');
    canvas.width = 620;
    canvas.height = 670;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', T.map.aria);
    const info = node('div', 'opening-map-info');
    info.append(
      node('h3', 'opening-map-title', T.map.title),
      node('p', 'opening-map-legend', T.map.legend),
      node('p', 'opening-muted', T.map.note),
      makeButton(T.map.back, 'secondary', () => actions.action('computer')),
    );
    wrap.append(canvas, info);
    return wrap;
  }

  function caughtDialog(view: OpeningView): HTMLElement {
    const shell = dialogShell('caught');
    const card = node('div', 'opening-caught-card');
    const eye = node('div', 'opening-caught-eye');
    eye.setAttribute('aria-hidden', 'true');
    const eyebrow = node('p', 'opening-caught-eyebrow', view.runtime.hearts > 0 ? 'PERIMETER UNIT CONTACT' : 'CRITICAL CONDITION');
    const title = node('h2', 'opening-caught-title', view.runtime.hearts > 0 ? 'Caught' : 'Signal lost');
    title.id = 'opening-modal-title';
    const hearts = node('div', 'opening-caught-hearts');
    for (let i = 0; i < view.runtime.maxHearts; i++) {
      const heart = node('span', 'opening-heart ' + (i < view.runtime.hearts ? 'is-full' : 'is-empty'));
      heart.innerHTML = '<svg viewBox="0 0 8 11" shape-rendering="crispEdges" aria-hidden="true"><rect x="1" y="0" width="2" height="1"/><rect x="5" y="0" width="2" height="1"/><rect x="0" y="1" width="8" height="4"/><rect x="1" y="5" width="6" height="2"/><rect x="2" y="7" width="4" height="2"/><rect x="3" y="9" width="2" height="2"/></svg>';
      hearts.append(heart);
    }
    const lost = node('p', 'opening-caught-loss', view.runtime.hearts > 0
      ? `−${OPENING_CAPTURE_DAMAGE} hearts · ${view.runtime.hearts} / ${view.runtime.maxHearts} remaining`
      : 'All hearts lost');
    const copy = node('p', 'opening-caught-copy', view.runtime.hearts > 0
      ? 'A campus security unit reached you. The screen cuts to black; the checkpoint will restore your body, but not your hearts.'
      : 'The perimeter closed in. Your run has failed, but the opening can be recovered from the last checkpoint without deleting the story.');
    const note = node('p', 'opening-caught-note', view.runtime.hearts > 0
      ? 'Your MacBook, invitation and story progress are kept.'
      : 'Recover at the checkpoint to restore all 10 hearts; restarting returns to the shuttle.');
    card.append(eye, eyebrow, title, hearts, lost, copy, note);
    shell.append(card);
    const region = node('div', 'opening-caught-actions');
    if (view.runtime.hearts > 0) {
      const retry = makeButton('Recover at checkpoint', 'primary', () => {
        if (retrySent) return;
        retrySent = true;
        actions.action('retry');
      });
      retry.dataset.autofocus = 'true';
      region.append(retry);
    } else {
      const recover = makeButton('Recover at checkpoint', 'primary', () => {
        if (retrySent) return;
        retrySent = true;
        actions.action('recover');
      });
      recover.dataset.autofocus = 'true';
      const restart = makeButton('Restart opening', 'danger', () => showCaughtRestart(region));
      region.append(recover, restart);
    }
    shell.append(region);
    return shell;
  }

  function showCaughtRestart(region: HTMLElement): void {
    region.replaceChildren();
    const box = node('div', 'opening-caught-confirm');
    box.append(node('p', '', 'Restart from the shuttle? The current opening save is backed up first.'));
    const row = node('div', 'opening-caught-confirm-row');
    const yes = makeButton('Restart from shuttle', 'danger', () => actions.action('restart'));
    const no = makeButton('Keep progress', 'secondary', () => {
      region.replaceChildren();
      const recover = makeButton('Recover at checkpoint', 'primary', () => {
        if (retrySent) return;
        retrySent = true;
        actions.action('recover');
      });
      recover.dataset.autofocus = 'true';
      const restart = makeButton('Restart opening', 'danger', () => showCaughtRestart(region));
      region.append(recover, restart);
      recover.focus({ preventScroll: true });
    });
    no.dataset.autofocus = 'true';
    row.append(yes, no);
    box.append(row);
    region.append(box);
    no.focus({ preventScroll: true });
  }

  function completeDialog(): HTMLElement {
    const shell = dialogShell('complete');
    shell.append(head(T.complete.eyebrow, T.complete.title, true));
    const body = node('div', 'opening-dialog-body');
    body.append(node('p', 'opening-copy', T.complete.body));
    const facts = node('dl', 'opening-complete-facts');
    for (const [label, value] of T.complete.facts) {
      const row = node('div', 'opening-complete-fact');
      row.append(node('dt', '', label), node('dd', '', value));
      facts.append(row);
    }
    body.append(facts, node('p', 'opening-muted', T.complete.note));
    shell.append(body);
    const close = makeButton(T.complete.close, 'primary', requestClose);
    close.dataset.autofocus = 'true';
    shell.append(actionRow(close));
    return shell;
  }

  function settingsActionRow(region: HTMLElement): HTMLElement {
    const row = node('div', 'opening-settings-actions');
    row.append(
      makeButton(T.settings.save, 'primary', () => actions.action('save')),
      makeButton(T.settings.safe, 'secondary', () => actions.action('safe')),
      makeButton(T.settings.restart, 'danger', () => showRestartConfirm(region)),
    );
    return row;
  }

  function showRestartConfirm(region: HTMLElement): void {
    region.replaceChildren();
    const box = node('div', 'opening-confirm');
    box.setAttribute('role', 'alert');
    box.append(
      node('p', 'opening-confirm-title', T.settings.restartTitle),
      node('p', 'opening-confirm-body', T.settings.restartBody),
    );
    const row = node('div', 'opening-confirm-actions');
    const cancel = makeButton(T.settings.restartCancel, 'secondary', () => {
      region.replaceChildren();
      const restored = settingsActionRow(region);
      region.append(restored);
      restored.querySelector<HTMLElement>('button')?.focus({preventScroll: true});
    });
    const confirm = makeButton(T.settings.restartConfirm, 'danger', () => actions.action('restart'));
    row.append(confirm, cancel);
    box.append(row);
    region.append(box);
    cancel.focus({preventScroll: true});
  }

  function settingsDialog(view: OpeningView): HTMLElement {
    const shell = dialogShell('settings');
    shell.append(head(T.settings.eyebrow, T.settings.title, true));
    const body = node('div', 'opening-dialog-body opening-settings');
    const fields = node('div', 'opening-settings-fields');
    for (const [key, min, max, step] of SLIDERS) {
      const value = Number(view.settings[key]);
      const text = formatSetting(key, value);
      const field = node('label', 'opening-setting');
      const headRow = node('span', 'opening-setting-head');
      const output = node('output', 'opening-setting-value', text);
      headRow.append(node('span', '', T.settings[key]), output);
      const input = node('input', 'opening-setting-input');
      input.type = 'range';
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(value);
      input.setAttribute('aria-label', T.settings[key]);
      input.setAttribute('aria-valuetext', text);
      if (key === 'sensitivity') input.dataset.autofocus = 'true';
      input.addEventListener('input', () => {
        const nextValue = Number(input.value);
        const nextText = formatSetting(key, nextValue);
        output.textContent = nextText;
        input.setAttribute('aria-valuetext', nextText);
        actions.setting(key as SliderKey, nextValue);
      });
      field.append(headRow, input);
      fields.append(field);
    }
    body.append(fields);
    const toggles = node('div', 'opening-toggles');
    for (const key of ['muted', 'bob'] as const) {
      const label = node('label', 'opening-toggle');
      const input = node('input', '');
      input.type = 'checkbox';
      input.checked = Boolean(view.settings[key]);
      input.addEventListener('change', () => actions.setting(key, input.checked));
      label.append(input, node('span', '', T.settings[key]));
      toggles.append(label);
    }
    body.append(toggles);
    const previews=node('div','opening-settings-actions');
    previews.append(
      makeButton('Preview ambience','secondary',()=>actions.action('preview_ambient')),
      makeButton('Preview footsteps','secondary',()=>actions.action('preview_steps')),
      makeButton('Preview effects','secondary',()=>actions.action('preview_sfx')),
      makeButton('Preview music','secondary',()=>actions.action('preview_music')),
      makeButton('Retry audio','secondary',()=>actions.action('retry_audio')),
    );
    const audioStatus=node('p','opening-audio-status opening-muted',view.audioStatus);
    audioStatus.setAttribute('role','status');body.append(previews,audioStatus);
    const region = node('div', 'opening-settings-region');
    region.append(settingsActionRow(region));
    body.append(region, node('p', 'opening-modal-save', view.saveStatus), node('p', 'opening-muted', T.settings.note));
    shell.append(body);
    shell.append(actionRow(makeButton(T.settings.done, 'primary', requestClose)));
    return shell;
  }

  // ---------------------------------------------------------- Modal sync.
  function modalSignature(view: OpeningView): string {
    if (!view.modal) return 'none';
    if (view.modal === 'computer') {
      return [
        'computer',
        view.computerPage,
        view.story.stage,
        view.story.invitation_read,
        view.story.laptop_acquired,
        view.story.campus_alert_triggered,
        view.story.alert_read,
      ]
        .map(String)
        .join('|');
    }
    return view.modal;
  }

  function renderModal(view: OpeningView): void {
    if (!view.modal) {
      hideDialog();
      return;
    }
    const next = view.modal === 'invitation'
      ? invitationDialog(view)
      : view.modal === 'staff'
        ? staffDialog()
        : view.modal === 'alert'
          ? alertDialog()
          : view.modal === 'computer'
            ? computerDialog(view)
            : view.modal === 'caught'
              ? caughtDialog(view)
              : view.modal === 'settings'
                ? settingsDialog(view)
                : completeDialog();
    showDialog(next, view.modal);
  }

  // ------------------------------------------------------ Keyboard/focus.
  function trapFocus(event: KeyboardEvent): void {
    if (!dialog) return;
    const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (element) => element.offsetParent !== null || element === document.activeElement,
    );
    if (items.length === 0) {
      event.preventDefault();
      dialog.focus({preventScroll: true});
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    const inside = active instanceof HTMLElement && dialog.contains(active);
    if (!event.shiftKey && (!inside || active === last)) {
      event.preventDefault();
      first.focus({preventScroll: true});
    } else if (event.shiftKey && (!inside || active === first)) {
      event.preventDefault();
      last.focus({preventScroll: true});
    }
  }

  let dismissedKey:string|null=null;
  window.addEventListener('blur',()=>{dismissedKey=null;},{signal:events.signal});
  document.addEventListener('keyup',event=>{if(event.code===dismissedKey){dismissedKey=null;event.stopImmediatePropagation();}},{capture:true,signal:events.signal});
  function onKeyDown(event: KeyboardEvent): void {
    if(event.code===dismissedKey){event.preventDefault();event.stopImmediatePropagation();return;}
    if (!dialog || modalRoot.hidden) return;
    if(kind==='invitation'){
      event.preventDefault();event.stopImmediatePropagation();
      if(event.repeat||event.isComposing)return;
      dismissedKey=event.code;
      if(currentView?.story.invitation_read)requestClose();else actions.action('read_invitation');
      hideDialog();lastSignature=null;
      return;
    }
    if (event.key === 'Tab') {
      trapFocus(event);
      return;
    }
    if (event.repeat) return;
    const target = event.target;
    const editable = target instanceof HTMLElement &&
      (target.matches('input, textarea, select') || target.isContentEditable);
    if (event.key === 'Escape' || (event.code === 'KeyC' && !editable)) {
      event.preventDefault();
      event.stopPropagation();
      if (kind === 'caught') return;
      requestClose();
    }
  }
  document.addEventListener('keydown', onKeyDown, {capture:true,signal: events.signal});

  // ------------------------------------------------------------- Update.
  function updateWarning(view: OpeningView): void {
    const state = view.robotState;
    const level = clamp(Number(view.robotWarning) || 0, 0, 1);
    // Robot states mirror OpeningRobotState: patrol | scanning | chase | search | caught.
    const active = level > 0.01 || state === 'scanning' || state === 'chase' || state === 'search' || state === 'caught';
    setHidden(warningEl, !active);
    if (!active) {
      lastWarningText = '';
      return;
    }
    warningEl.dataset.state = state;
    const text = (T.robot.states as Record<string, string>)[state] ?? T.robot.unknown;
    if (text !== lastWarningText) {
      lastWarningText = text;
      setText(warningStateEl, text);
    }
    warningFillEl.style.width = Math.max(6, Math.round(level * 100)) + '%';
  }

  let lastHearts = OPENING_MAX_HEARTS;
  function updateHearts(view: OpeningView): void {
    const hearts = Math.max(0, Math.min(view.runtime.maxHearts, Math.round(view.runtime.hearts)));
    if (hearts !== lastHearts) {
      for (let i = hearts; i < lastHearts; i++) {
        const heart = heartEls[i];
        if (!heart) continue;
        heart.classList.add('is-hit');
        setTimeout(() => heart.classList.remove('is-hit'), 720);
      }
      lastHearts = hearts;
    }
    heartEls.forEach((heart, index) => {
      heart.classList.toggle('is-full', index < hearts);
      heart.classList.toggle('is-empty', index >= hearts);
    });
    setText(heartsCount, `${hearts} / ${view.runtime.maxHearts}`);
    heartsCard.classList.toggle('is-low', hearts > 0 && hearts <= 4);
    heartsCard.classList.toggle('is-empty', hearts <= 0);
    heartsCard.setAttribute('aria-label', `${hearts} of ${view.runtime.maxHearts} hearts`);
  }

  function updateCinema(view: OpeningView): void {
    const c = view.cinema;
    if (!c || c.mode === 'off') {
      cinema.hidden = true;
      stage.classList.remove('opening-cinema-active');
      document.body.classList.remove('opening-cinema-active');
      document.body.classList.remove('opening-cinema-letter');
      return;
    }
    cinema.hidden = false;
    cinema.dataset.mode = c.mode;
    cinemaBlack.style.opacity = String(clamp(c.opacity, 0, 1));
    cinema.classList.toggle('has-letterbox', c.letterbox);
    const isLetter = view.modal === 'invitation' && !c.subtitle;
    cinema.classList.toggle('is-letter', isLetter);
    document.body.classList.toggle('opening-cinema-letter', isLetter);
    setText(cinemaTitle, c.title);
    setText(cinemaSubtitle, c.subtitle);
    setText(cinemaHint, c.hint);
    const speak = c.mode === 'subtitle';
    cinemaCopy.hidden = speak;
    cinemaSpeech.hidden = !speak;
    if (speak) setText(cinemaSpeech, c.subtitle);
    stage.classList.add('opening-cinema-active');
    document.body.classList.add('opening-cinema-active');
  }

  function update(view: OpeningView): void {
    currentView=view;
    // HUD text only: no modal rebuild on per-frame state such as elapsed time.
    setText(objective, view.objective);
    setText(detailText, view.detail);
    setHidden(details, !view.detail);
    setText(saveLine, view.saveStatus);
    setHidden(promptEl, !view.prompt);
    if (view.prompt) setText(promptEl, view.prompt);
    updateWarning(view);
    updateHearts(view);
    const target = view.target;
    if (target) {
      const dx = target[0] - view.player[0];
      const dz = target[2] - view.player[2];
      const dist = Math.hypot(dx, dz);
      const targetYaw = Math.atan2(-dx, -dz);
      let rel = targetYaw - view.yaw;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      distanceArrow.style.transform = `rotate(${rel}rad)`;
      setText(distanceText, `${dist < 10 ? dist.toFixed(1) : Math.round(dist)} m to objective`);
      distanceEl.hidden = false;
    } else {
      distanceEl.hidden = true;
    }
    const danger = clamp(Number(view.robotWarning) || 0, 0, 1);
    dangerVignette.style.opacity = String(view.runtime.curtain_deployed ? Math.min(.72, .10 + danger * .62) : 0);
    if (view.modal === 'computer') mac.update(view);
    updateCinema(view);

    const now = performance.now();
    if (!document.hidden && now - lastMiniDraw >= 200) {
      lastMiniDraw = now;
      try {
        actions.drawMap(miniCanvas, false);
      } catch {
        // Keep the HUD alive if a minimap frame fails.
      }
    }

    const signature = modalSignature(view);
    if (signature !== lastSignature) {
      lastSignature = signature;
      renderModal(view);
    } else if (view.modal === 'settings' && dialog) {
      const line = dialog.querySelector<HTMLElement>('.opening-modal-save');
      if (line) setText(line, view.saveStatus);
      const sound=dialog.querySelector<HTMLElement>('.opening-audio-status');
      if(sound)setText(sound,view.audioStatus??'');
    }
  }

  function dispose(): void {
    events.abort();
    mac.dispose();
    localAgent.dispose();
    hideDialog();
    modalRoot.remove();
    hud.remove();
    mapCard.remove();
    promptEl.remove();
    warningEl.remove();
    cinema.remove();
    stage.classList.remove('opening-cinema-active');
  }

  return {update, dispose};
}
