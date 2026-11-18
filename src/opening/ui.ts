import './opening.css';
import {OPENING_UI as T} from '../../content/opening/en';
import type {OpeningModal, OpeningUIActions, OpeningView} from './contracts';
import {DEFAULT_SETTINGS} from '../gameplay/save';
import {setHidden, setText} from '../ui/dom';

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

  // ---------------------------------------------------------------- HUD.
  const hud = node('section', 'opening-hud');
  hud.setAttribute('aria-label', T.hud.objectiveLabel);
  const objective = node('h2', 'opening-objective');
  const details = node('details', 'opening-details');
  const detailText = node('p', 'opening-detail-text');
  details.append(node('summary', '', T.hud.details), detailText);
  const saveLine = node('p', 'opening-save');
  hud.append(node('p', 'opening-eyebrow', T.hud.objectiveLabel), objective, details, saveLine);

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

  stage.append(hud, mapCard, promptEl, warningEl);

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
    const preferred = target.querySelector<HTMLElement>('[data-autofocus]');
    const first = preferred ?? target.querySelector<HTMLElement>(FOCUSABLE);
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
    if (!restore) return;
    if (restore.isConnected && restore.offsetParent !== null) restore.focus({preventScroll: true});
    else document.querySelector<HTMLElement>('.stage canvas')?.focus({preventScroll: true});
  }

  // ------------------------------------------------------------ Modals.
  function invitationDialog(): HTMLElement {
    const shell = dialogShell('invitation');
    shell.append(head(T.invitation.eyebrow, T.invitation.title, true));
    const body = node('div', 'opening-dialog-body opening-invite');
    const forLine = node('p', 'opening-invite-for');
    forLine.append(document.createTextNode(T.invitation.forLabel + ' '), node('strong', '', T.invitation.forValue));
    const facts = node('dl', 'opening-invite-facts');
    for (const [label, value] of [
      [T.invitation.venueLabel, T.invitation.venueValue],
      [T.invitation.directionsLabel, T.invitation.directionsValue],
      [T.invitation.yearLabel, T.invitation.yearValue],
    ] as [string, string][]) {
      const row = node('div', 'opening-invite-fact');
      row.append(node('dt', '', label), node('dd', '', value));
      facts.append(row);
    }
    body.append(forLine, facts, node('p', 'opening-copy', T.invitation.body), node('p', 'opening-muted', T.invitation.reread));
    shell.append(body);
    const continueButton = makeButton(T.invitation.continue, 'primary', () => actions.action('read_invitation'));
    continueButton.dataset.autofocus = 'true';
    shell.append(actionRow(makeButton(T.common.close, 'secondary', requestClose), continueButton));
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
    shell.append(head(T.computer.eyebrow, T.computer.title, true));
    const tabs = node('nav', 'opening-tabs');
    tabs.setAttribute('aria-label', 'MacBook pages');
    for (const page of ['map', 'tasks'] as const) {
      const tab = node('button', 'opening-tab', T.computer.tabs[page]);
      tab.type = 'button';
      tab.setAttribute('aria-current', view.computerPage === page ? 'page' : 'false');
      if (view.computerPage === page) tab.dataset.autofocus = 'true';
      tab.addEventListener('click', () => actions.action(page === 'map' ? 'map' : 'computer'));
      tabs.append(tab);
    }
    shell.append(tabs);
    const body = node('div', 'opening-dialog-body opening-computer');
    body.append(node('p', 'opening-device-line', T.computer.subtitle));
    body.append(view.computerPage === 'map' ? mapPage() : tasksPage(view));
    shell.append(body, actionRow(makeButton(T.common.close, 'secondary', requestClose)));
    if (view.computerPage === 'map') {
      const canvas = shell.querySelector<HTMLCanvasElement>('.opening-bigmap');
      if (canvas) {
        try {
          actions.drawMap(canvas, true);
        } catch {
          // A failed map preview must not take down the modal or the HUD.
        }
      }
    }
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

  function caughtDialog(): HTMLElement {
    const shell = dialogShell('caught');
    shell.append(head(T.caught.eyebrow, T.caught.title, false));
    const body = node('div', 'opening-dialog-body');
    body.append(
      node('p', 'opening-copy', T.caught.body),
      node('p', 'opening-caught-note', T.caught.note),
      node('p', 'opening-muted', T.caught.onlyWay),
    );
    shell.append(body);
    const retry = makeButton(T.caught.retry, 'primary', () => {
      if (retrySent) return;
      retrySent = true;
      actions.action('retry');
    });
    retry.dataset.autofocus = 'true';
    shell.append(actionRow(retry));
    return shell;
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
      ? invitationDialog()
      : view.modal === 'staff'
        ? staffDialog()
        : view.modal === 'alert'
          ? alertDialog()
          : view.modal === 'computer'
            ? computerDialog(view)
            : view.modal === 'caught'
              ? caughtDialog()
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

  function onKeyDown(event: KeyboardEvent): void {
    if (!dialog || modalRoot.hidden) return;
    if (event.key === 'Tab') {
      trapFocus(event);
      return;
    }
    if (event.repeat) return;
    if (event.key === 'Escape' || event.code === 'KeyC') {
      event.preventDefault();
      event.stopPropagation();
      if (kind === 'caught') return;
      requestClose();
    }
  }
  document.addEventListener('keydown', onKeyDown, {signal: events.signal});

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

  function update(view: OpeningView): void {
    // HUD text only: no modal rebuild on per-frame state such as elapsed time.
    setText(objective, view.objective);
    setText(detailText, view.detail);
    setHidden(details, !view.detail);
    setText(saveLine, view.saveStatus);
    setHidden(promptEl, !view.prompt);
    if (view.prompt) setText(promptEl, view.prompt);
    updateWarning(view);

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
    }
  }

  function dispose(): void {
    events.abort();
    hideDialog();
    modalRoot.remove();
    hud.remove();
    mapCard.remove();
    promptEl.remove();
    warningEl.remove();
  }

  return {update, dispose};
}
