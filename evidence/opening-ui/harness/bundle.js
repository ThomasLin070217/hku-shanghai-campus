// content/opening/en.ts
var OPENING_UI = {
  hud: {
    objectiveLabel: "Current objective",
    details: "Details",
    mapLabel: "Map",
    mapAria: "Open the campus map in the presentation MacBook",
    minimapAria: "Campus minimap. North is up."
  },
  robot: {
    label: "Security robot",
    unknown: "Active",
    /** Keys match OpeningRobotState: patrol | scanning | chase | search | caught. */
    states: {
      patrol: "Patrolling nearby",
      scanning: "Scanning the area",
      chase: "Pursuit detected \u2014 run",
      search: "Searching your last position",
      caught: "Detected"
    }
  },
  common: {
    close: "Close",
    notNow: "Not now"
  },
  invitation: {
    eyebrow: "HKU Shanghai \xB7 2030",
    title: "High Table Dinner",
    forLabel: "For",
    forValue: "Student Ambassador",
    venueLabel: "Venue",
    venueValue: "Building 5 \xB7 Ground Floor",
    directionsLabel: "Directions",
    directionsValue: "Turn right after entering",
    yearLabel: "Year",
    yearValue: "2030",
    body: "You are invited to High Table Dinner. Present this invitation at the ground-floor entrance of Building 5, then turn right after entering.",
    continue: "Continue",
    reread: "You can read your invitation again from the main interaction prompt."
  },
  staff: {
    eyebrow: "Building 5 \xB7 Dining hall",
    title: "Dinner coordinator",
    speaker: "Staff \xB7 Dinner coordinator",
    line1: "You're one of our Student Ambassadors, right?",
    line2: "We need the presentation MacBook from Building 6 for tonight\u2019s dinner. Could you collect it and bring it back here?",
    line3: "The device is waiting on the office table in Building 6.",
    accept: "I'll collect it",
    later: "Not now"
  },
  alert: {
    eyebrow: "Local AI \xB7 Emergency mode",
    title: "Campus network alert",
    intro: "The local AI on this MacBook detected an attack on the campus network. This alert was generated on the device itself.",
    items: [
      ["Robots compromised", "Campus security robots are no longer responding to campus control."],
      ["Perimeter barrier active", "External connections are blocked. No messages can leave campus."],
      ["Students and staff may have been detained", "This is unconfirmed. Treat the campus as unsafe."],
      ["Building 4 emergency control is available", "Reach the main entrance of Building 4 to hand over the MacBook."]
    ],
    note: "Detected locally \xB7 no outside connection used",
    confirm: "Enable emergency assistance",
    later: "Not now"
  },
  computer: {
    eyebrow: "Device",
    title: "MacBook Air",
    subtitle: "Presentation device \xB7 Student Ambassador",
    tabs: {
      map: "Map",
      tasks: "Tasks"
    },
    objectiveLabel: "Current objective",
    normalTitle: "Prepared for High Table Dinner",
    normalLines: [
      "Presentation files are stored locally on this device.",
      "No presentations are open."
    ],
    emergencyTitle: "Emergency assistance enabled",
    emergencyBody: "Head to the main entrance of Building 4. Keep the MacBook in your backpack.",
    stepsTitle: "Opening steps",
    steps: [
      { label: "Read the High Table Dinner invitation" },
      { label: "Collect the MacBook from Building 6" },
      { label: "Read the local AI alert" },
      { label: "Reach the Building 4 main entrance" }
    ],
    stepDone: "Done",
    stepNext: "Next",
    stepPending: "Later"
  },
  map: {
    title: "Campus map",
    legend: "North is up. Blue arrow: you. Orange marker: current target.",
    note: "The route shows the main walking surface, not indoor navigation.",
    back: "Back to tasks",
    aria: "Campus map with the current opening route."
  },
  caught: {
    eyebrow: "Opening paused",
    title: "Caught by campus security",
    body: "A security robot caught you before you reached Building 4.",
    note: "Retry restores the last safe checkpoint. Your MacBook and earlier progress are kept.",
    retry: "Retry",
    onlyWay: "Retry is the only way to continue."
  },
  complete: {
    eyebrow: "Opening handoff",
    title: "Building 4 reached",
    body: "You reached the main entrance of Building 4 with the presentation MacBook.",
    facts: [
      ["MacBook", "Kept in your backpack"],
      ["Handoff point", "Building 4 main entrance"],
      ["Progress", "Opening complete"]
    ],
    note: "The opening ends here. Later chapters continue inside Building 4.",
    close: "Close"
  },
  settings: {
    eyebrow: "Preferences",
    title: "Settings",
    sensitivity: "Mouse sensitivity",
    fov: "Field of view",
    ambient: "Ambient volume",
    steps: "Footstep volume",
    ui: "Interface volume",
    muted: "Mute all sound",
    bob: "Head bob while walking",
    save: "Save progress",
    safe: "Safe checkpoint",
    restart: "Restart opening\u2026",
    restartTitle: "Restart the opening?",
    restartBody: "The current save is backed up first, then the shuttle sequence begins again. Your settings are kept.",
    restartConfirm: "Restart opening",
    restartCancel: "Keep current progress",
    done: "Done",
    note: "Changes apply immediately. Closing this screen returns you to the pause menu."
  }
};

// evidence/opening-ui/harness/save-stub.ts
var DEFAULT_SETTINGS = { sensitivity: 22e-4, fov: 72, bob: false, muted: false, ambient: 0.2, steps: 0.6, ui: 0.45, music: 0 };

// src/ui/dom.ts
function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}
function setHidden(el, value) {
  if (el.hidden !== value) el.hidden = value;
}

// src/opening/ui.ts
var FOCUSABLE = 'button:not([disabled]), input:not([disabled]), summary, a[href], [tabindex]:not([tabindex="-1"])';
var SLIDERS = [
  ["sensitivity", 4e-4, 6e-3, 1e-4],
  ["fov", 60, 90, 1],
  ["ambient", 0, 1, 0.05],
  ["steps", 0, 1, 0.05],
  ["ui", 0, 1, 0.05]
];
function node(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function formatSetting(key, value) {
  if (key === "sensitivity") return (value / DEFAULT_SETTINGS.sensitivity).toFixed(2) + "\xD7";
  if (key === "fov") return Math.round(value) + "\xB0";
  return Math.round(value * 100) + "%";
}
function createOpeningUI(stage2, actions) {
  const events = new AbortController();
  const hud = node("section", "opening-hud");
  hud.setAttribute("aria-label", OPENING_UI.hud.objectiveLabel);
  const objective = node("h2", "opening-objective");
  const details = node("details", "opening-details");
  const detailText = node("p", "opening-detail-text");
  details.append(node("summary", "", OPENING_UI.hud.details), detailText);
  const saveLine = node("p", "opening-save");
  hud.append(node("p", "opening-eyebrow", OPENING_UI.hud.objectiveLabel), objective, details, saveLine);
  const mapCard = node("button", "opening-mapcard");
  mapCard.type = "button";
  mapCard.setAttribute("aria-label", OPENING_UI.hud.mapAria);
  const miniCanvas = node("canvas", "opening-minimap-canvas");
  miniCanvas.width = 220;
  miniCanvas.height = 270;
  miniCanvas.setAttribute("aria-hidden", "true");
  mapCard.append(miniCanvas, node("span", "opening-mapcard-label", OPENING_UI.hud.mapLabel));
  mapCard.addEventListener("click", () => actions.action("map"));
  const promptEl = node("p", "opening-prompt");
  promptEl.hidden = true;
  promptEl.setAttribute("role", "status");
  const warningEl = node("div", "opening-warning");
  warningEl.hidden = true;
  warningEl.setAttribute("role", "status");
  warningEl.setAttribute("aria-live", "polite");
  const warningStateEl = node("span", "opening-warning-state");
  const warningFillEl = node("b", "");
  const warningBarEl = node("i", "opening-warning-bar");
  warningBarEl.setAttribute("aria-hidden", "true");
  warningBarEl.append(warningFillEl);
  warningEl.append(node("span", "opening-warning-label", OPENING_UI.robot.label), warningStateEl, warningBarEl);
  stage2.append(hud, mapCard, promptEl, warningEl);
  const modalRoot = node("div", "opening-modal-root");
  modalRoot.hidden = true;
  document.body.append(modalRoot);
  let dialog = null;
  let kind = null;
  let previousFocus = null;
  let closeSent = null;
  let retrySent = false;
  let lastSignature = null;
  let lastMiniDraw = 0;
  let lastWarningText = "";
  function dialogShell(sectionKind) {
    const shell = node("section", "opening-dialog opening-dialog--" + sectionKind);
    shell.tabIndex = -1;
    shell.setAttribute("role", "dialog");
    shell.setAttribute("aria-modal", "true");
    shell.setAttribute("aria-labelledby", "opening-modal-title");
    return shell;
  }
  function head(eyebrow, title, closable) {
    const header = node("header", "opening-dialog-head");
    const heading = node("div", "opening-dialog-heading");
    const titleEl = node("h2", "opening-dialog-title", title);
    titleEl.id = "opening-modal-title";
    heading.append(node("p", "opening-eyebrow", eyebrow), titleEl);
    header.append(heading);
    if (closable) {
      const close = node("button", "opening-dialog-close", OPENING_UI.common.close);
      close.type = "button";
      close.setAttribute("aria-label", OPENING_UI.common.close);
      close.addEventListener("click", () => requestClose());
      header.append(close);
    }
    return header;
  }
  function makeButton(label, variant, onClick) {
    const button = node("button", "opening-button opening-button--" + variant, label);
    button.type = "button";
    button.addEventListener("click", onClick);
    return button;
  }
  function actionRow(...buttons) {
    const footer = node("footer", "opening-dialog-actions");
    footer.append(...buttons);
    return footer;
  }
  function focusFirst(target2) {
    const preferred = target2.querySelector("[data-autofocus]");
    const first = preferred ?? target2.querySelector(FOCUSABLE);
    (first ?? target2).focus({ preventScroll: true });
  }
  function requestClose() {
    if (!dialog || kind === null || kind === "caught" || closeSent === kind) return;
    closeSent = kind;
    actions.close();
  }
  function showDialog(next, nextKind) {
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
  function hideDialog() {
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
    if (restore.isConnected && restore.offsetParent !== null) restore.focus({ preventScroll: true });
    else document.querySelector(".stage canvas")?.focus({ preventScroll: true });
  }
  function invitationDialog() {
    const shell = dialogShell("invitation");
    shell.append(head(OPENING_UI.invitation.eyebrow, OPENING_UI.invitation.title, true));
    const body = node("div", "opening-dialog-body opening-invite");
    const forLine = node("p", "opening-invite-for");
    forLine.append(document.createTextNode(OPENING_UI.invitation.forLabel + " "), node("strong", "", OPENING_UI.invitation.forValue));
    const facts = node("dl", "opening-invite-facts");
    for (const [label, value] of [
      [OPENING_UI.invitation.venueLabel, OPENING_UI.invitation.venueValue],
      [OPENING_UI.invitation.directionsLabel, OPENING_UI.invitation.directionsValue],
      [OPENING_UI.invitation.yearLabel, OPENING_UI.invitation.yearValue]
    ]) {
      const row = node("div", "opening-invite-fact");
      row.append(node("dt", "", label), node("dd", "", value));
      facts.append(row);
    }
    body.append(forLine, facts, node("p", "opening-copy", OPENING_UI.invitation.body), node("p", "opening-muted", OPENING_UI.invitation.reread));
    shell.append(body);
    const continueButton = makeButton(OPENING_UI.invitation.continue, "primary", () => actions.action("read_invitation"));
    continueButton.dataset.autofocus = "true";
    shell.append(actionRow(makeButton(OPENING_UI.common.close, "secondary", requestClose), continueButton));
    return shell;
  }
  function staffDialog() {
    const shell = dialogShell("staff");
    shell.append(head(OPENING_UI.staff.eyebrow, OPENING_UI.staff.title, true));
    const body = node("div", "opening-dialog-body opening-dialogue");
    body.append(
      node("p", "opening-speaker", OPENING_UI.staff.speaker),
      node("p", "opening-line", OPENING_UI.staff.line1),
      node("p", "opening-line", OPENING_UI.staff.line2),
      node("p", "opening-muted", OPENING_UI.staff.line3)
    );
    shell.append(body);
    const accept = makeButton(OPENING_UI.staff.accept, "primary", () => actions.action("accept_errand"));
    accept.dataset.autofocus = "true";
    shell.append(actionRow(makeButton(OPENING_UI.staff.later, "secondary", requestClose), accept));
    return shell;
  }
  function alertDialog() {
    const shell = dialogShell("alert");
    shell.append(head(OPENING_UI.alert.eyebrow, OPENING_UI.alert.title, true));
    const body = node("div", "opening-dialog-body opening-alert");
    body.append(node("p", "opening-alert-intro", OPENING_UI.alert.intro));
    const list = node("ol", "opening-alert-list");
    for (const [title, text] of OPENING_UI.alert.items) {
      const item = node("li", "");
      item.append(node("b", "", title), document.createTextNode(text));
      list.append(item);
    }
    body.append(list, node("p", "opening-alert-note", OPENING_UI.alert.note));
    shell.append(body);
    const confirm = makeButton(OPENING_UI.alert.confirm, "primary", () => actions.action("read_alert"));
    confirm.dataset.autofocus = "true";
    shell.append(actionRow(makeButton(OPENING_UI.alert.later, "secondary", requestClose), confirm));
    return shell;
  }
  function computerDialog(view) {
    const shell = dialogShell("computer");
    shell.append(head(OPENING_UI.computer.eyebrow, OPENING_UI.computer.title, true));
    const tabs = node("nav", "opening-tabs");
    tabs.setAttribute("aria-label", "MacBook pages");
    for (const page of ["map", "tasks"]) {
      const tab = node("button", "opening-tab", OPENING_UI.computer.tabs[page]);
      tab.type = "button";
      tab.setAttribute("aria-current", view.computerPage === page ? "page" : "false");
      if (view.computerPage === page) tab.dataset.autofocus = "true";
      tab.addEventListener("click", () => actions.action(page === "map" ? "map" : "computer"));
      tabs.append(tab);
    }
    shell.append(tabs);
    const body = node("div", "opening-dialog-body opening-computer");
    body.append(node("p", "opening-device-line", OPENING_UI.computer.subtitle));
    body.append(view.computerPage === "map" ? mapPage() : tasksPage(view));
    shell.append(body, actionRow(makeButton(OPENING_UI.common.close, "secondary", requestClose)));
    if (view.computerPage === "map") {
      const canvas = shell.querySelector(".opening-bigmap");
      if (canvas) {
        try {
          actions.drawMap(canvas, true);
        } catch {
        }
      }
    }
    return shell;
  }
  function tasksPage(view) {
    const wrap = node("section", "opening-tasks");
    const objectiveBox = node("div", "opening-objective-box");
    objectiveBox.append(
      node("p", "opening-eyebrow", OPENING_UI.computer.objectiveLabel),
      node("h3", "opening-computer-objective", view.objective),
      node("p", "opening-computer-detail", view.detail)
    );
    wrap.append(objectiveBox);
    if (view.story.campus_alert_triggered && view.story.alert_read) {
      const emergency = node("div", "opening-emergency");
      emergency.append(
        node("p", "opening-emergency-title", OPENING_UI.computer.emergencyTitle),
        node("p", "opening-emergency-body", OPENING_UI.computer.emergencyBody)
      );
      wrap.append(emergency);
    } else {
      const info = node("div", "opening-info");
      info.append(node("p", "opening-info-title", OPENING_UI.computer.normalTitle));
      for (const line of OPENING_UI.computer.normalLines) info.append(node("p", "opening-info-line", line));
      wrap.append(info);
    }
    const statuses = [
      view.story.invitation_read,
      view.story.laptop_acquired,
      view.story.alert_read,
      view.story.stage === "complete"
    ];
    const nextIndex = statuses.findIndex((done) => !done);
    const list = node("ol", "opening-steps");
    OPENING_UI.computer.steps.forEach((step, index) => {
      const done = statuses[index];
      const next = !done && index === nextIndex;
      const item = node("li", "opening-step" + (done ? " is-done" : next ? " is-next" : ""));
      const mark = node("span", "opening-step-mark", done ? "\u2713" : String(index + 1));
      mark.setAttribute("aria-hidden", "true");
      item.append(
        mark,
        node("span", "opening-step-label", step.label),
        node("span", "opening-step-status", done ? OPENING_UI.computer.stepDone : next ? OPENING_UI.computer.stepNext : OPENING_UI.computer.stepPending)
      );
      list.append(item);
    });
    wrap.append(node("h4", "opening-steps-title", OPENING_UI.computer.stepsTitle), list);
    return wrap;
  }
  function mapPage() {
    const wrap = node("div", "opening-map-page");
    const canvas = node("canvas", "opening-bigmap");
    canvas.width = 620;
    canvas.height = 670;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", OPENING_UI.map.aria);
    const info = node("div", "opening-map-info");
    info.append(
      node("h3", "opening-map-title", OPENING_UI.map.title),
      node("p", "opening-map-legend", OPENING_UI.map.legend),
      node("p", "opening-muted", OPENING_UI.map.note),
      makeButton(OPENING_UI.map.back, "secondary", () => actions.action("computer"))
    );
    wrap.append(canvas, info);
    return wrap;
  }
  function caughtDialog() {
    const shell = dialogShell("caught");
    shell.append(head(OPENING_UI.caught.eyebrow, OPENING_UI.caught.title, false));
    const body = node("div", "opening-dialog-body");
    body.append(
      node("p", "opening-copy", OPENING_UI.caught.body),
      node("p", "opening-caught-note", OPENING_UI.caught.note),
      node("p", "opening-muted", OPENING_UI.caught.onlyWay)
    );
    shell.append(body);
    const retry = makeButton(OPENING_UI.caught.retry, "primary", () => {
      if (retrySent) return;
      retrySent = true;
      actions.action("retry");
    });
    retry.dataset.autofocus = "true";
    shell.append(actionRow(retry));
    return shell;
  }
  function completeDialog() {
    const shell = dialogShell("complete");
    shell.append(head(OPENING_UI.complete.eyebrow, OPENING_UI.complete.title, true));
    const body = node("div", "opening-dialog-body");
    body.append(node("p", "opening-copy", OPENING_UI.complete.body));
    const facts = node("dl", "opening-complete-facts");
    for (const [label, value] of OPENING_UI.complete.facts) {
      const row = node("div", "opening-complete-fact");
      row.append(node("dt", "", label), node("dd", "", value));
      facts.append(row);
    }
    body.append(facts, node("p", "opening-muted", OPENING_UI.complete.note));
    shell.append(body);
    const close = makeButton(OPENING_UI.complete.close, "primary", requestClose);
    close.dataset.autofocus = "true";
    shell.append(actionRow(close));
    return shell;
  }
  function settingsActionRow(region) {
    const row = node("div", "opening-settings-actions");
    row.append(
      makeButton(OPENING_UI.settings.save, "primary", () => actions.action("save")),
      makeButton(OPENING_UI.settings.safe, "secondary", () => actions.action("safe")),
      makeButton(OPENING_UI.settings.restart, "danger", () => showRestartConfirm(region))
    );
    return row;
  }
  function showRestartConfirm(region) {
    region.replaceChildren();
    const box = node("div", "opening-confirm");
    box.setAttribute("role", "alert");
    box.append(
      node("p", "opening-confirm-title", OPENING_UI.settings.restartTitle),
      node("p", "opening-confirm-body", OPENING_UI.settings.restartBody)
    );
    const row = node("div", "opening-confirm-actions");
    const cancel = makeButton(OPENING_UI.settings.restartCancel, "secondary", () => {
      region.replaceChildren();
      const restored = settingsActionRow(region);
      region.append(restored);
      restored.querySelector("button")?.focus({ preventScroll: true });
    });
    const confirm = makeButton(OPENING_UI.settings.restartConfirm, "danger", () => actions.action("restart"));
    row.append(confirm, cancel);
    box.append(row);
    region.append(box);
    cancel.focus({ preventScroll: true });
  }
  function settingsDialog(view) {
    const shell = dialogShell("settings");
    shell.append(head(OPENING_UI.settings.eyebrow, OPENING_UI.settings.title, true));
    const body = node("div", "opening-dialog-body opening-settings");
    const fields = node("div", "opening-settings-fields");
    for (const [key, min, max, step] of SLIDERS) {
      const value = Number(view.settings[key]);
      const text = formatSetting(key, value);
      const field = node("label", "opening-setting");
      const headRow = node("span", "opening-setting-head");
      const output = node("output", "opening-setting-value", text);
      headRow.append(node("span", "", OPENING_UI.settings[key]), output);
      const input = node("input", "opening-setting-input");
      input.type = "range";
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(value);
      input.setAttribute("aria-label", OPENING_UI.settings[key]);
      input.setAttribute("aria-valuetext", text);
      if (key === "sensitivity") input.dataset.autofocus = "true";
      input.addEventListener("input", () => {
        const nextValue = Number(input.value);
        const nextText = formatSetting(key, nextValue);
        output.textContent = nextText;
        input.setAttribute("aria-valuetext", nextText);
        actions.setting(key, nextValue);
      });
      field.append(headRow, input);
      fields.append(field);
    }
    body.append(fields);
    const toggles = node("div", "opening-toggles");
    for (const key of ["muted", "bob"]) {
      const label = node("label", "opening-toggle");
      const input = node("input", "");
      input.type = "checkbox";
      input.checked = Boolean(view.settings[key]);
      input.addEventListener("change", () => actions.setting(key, input.checked));
      label.append(input, node("span", "", OPENING_UI.settings[key]));
      toggles.append(label);
    }
    body.append(toggles);
    const region = node("div", "opening-settings-region");
    region.append(settingsActionRow(region));
    body.append(region, node("p", "opening-modal-save", view.saveStatus), node("p", "opening-muted", OPENING_UI.settings.note));
    shell.append(body);
    shell.append(actionRow(makeButton(OPENING_UI.settings.done, "primary", requestClose)));
    return shell;
  }
  function modalSignature(view) {
    if (!view.modal) return "none";
    if (view.modal === "computer") {
      return [
        "computer",
        view.computerPage,
        view.story.stage,
        view.story.invitation_read,
        view.story.laptop_acquired,
        view.story.campus_alert_triggered,
        view.story.alert_read
      ].map(String).join("|");
    }
    return view.modal;
  }
  function renderModal(view) {
    if (!view.modal) {
      hideDialog();
      return;
    }
    const next = view.modal === "invitation" ? invitationDialog() : view.modal === "staff" ? staffDialog() : view.modal === "alert" ? alertDialog() : view.modal === "computer" ? computerDialog(view) : view.modal === "caught" ? caughtDialog() : view.modal === "settings" ? settingsDialog(view) : completeDialog();
    showDialog(next, view.modal);
  }
  function trapFocus(event) {
    if (!dialog) return;
    const items = Array.from(dialog.querySelectorAll(FOCUSABLE)).filter(
      (element) => element.offsetParent !== null || element === document.activeElement
    );
    if (items.length === 0) {
      event.preventDefault();
      dialog.focus({ preventScroll: true });
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    const inside = active instanceof HTMLElement && dialog.contains(active);
    if (!event.shiftKey && (!inside || active === last)) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    } else if (event.shiftKey && (!inside || active === first)) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    }
  }
  function onKeyDown(event) {
    if (!dialog || modalRoot.hidden) return;
    if (event.key === "Tab") {
      trapFocus(event);
      return;
    }
    if (event.repeat) return;
    if (event.key === "Escape" || event.code === "KeyC") {
      event.preventDefault();
      event.stopPropagation();
      if (kind === "caught") return;
      requestClose();
    }
  }
  document.addEventListener("keydown", onKeyDown, { signal: events.signal });
  function updateWarning(view) {
    const state = view.robotState;
    const level = clamp(Number(view.robotWarning) || 0, 0, 1);
    const active = level > 0.01 || state === "scanning" || state === "chase" || state === "search" || state === "caught";
    setHidden(warningEl, !active);
    if (!active) {
      lastWarningText = "";
      return;
    }
    warningEl.dataset.state = state;
    const text = OPENING_UI.robot.states[state] ?? OPENING_UI.robot.unknown;
    if (text !== lastWarningText) {
      lastWarningText = text;
      setText(warningStateEl, text);
    }
    warningFillEl.style.width = Math.max(6, Math.round(level * 100)) + "%";
  }
  function update(view) {
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
      }
    }
    const signature = modalSignature(view);
    if (signature !== lastSignature) {
      lastSignature = signature;
      renderModal(view);
    } else if (view.modal === "settings" && dialog) {
      const line = dialog.querySelector(".opening-modal-save");
      if (line) setText(line, view.saveStatus);
    }
  }
  function dispose() {
    events.abort();
    hideDialog();
    modalRoot.remove();
    hud.remove();
    mapCard.remove();
    promptEl.remove();
    warningEl.remove();
  }
  return { update, dispose };
}

// evidence/opening-ui/harness/main.ts
var baseStory = {
  schemaVersion: 1,
  stage: "bus",
  invitation_read: false,
  laptop_acquired: false,
  campus_alert_triggered: false,
  alert_read: false,
  events: [],
  elapsedSeconds: 96
};
var log = [];
function mockMap(canvas, large) {
  const c = canvas.getContext("2d");
  if (!c) return;
  const w = canvas.width;
  const h = canvas.height;
  c.fillStyle = "#e6e9dc";
  c.fillRect(0, 0, w, h);
  c.strokeStyle = "#b0bbab";
  c.lineWidth = large ? 6 : 4;
  c.strokeRect(w * 0.06, h * 0.05, w * 0.88, h * 0.9);
  c.fillStyle = "#bcc4b7";
  for (const [x, y, bw, bh] of [
    [0.16, 0.2, 0.22, 0.18],
    [0.58, 0.15, 0.24, 0.22],
    [0.14, 0.56, 0.2, 0.2],
    [0.6, 0.56, 0.26, 0.22]
  ]) c.fillRect(w * x, h * y, w * bw, h * bh);
  c.strokeStyle = "#2e7962";
  c.lineWidth = large ? 4 : 2.5;
  c.setLineDash([6, 5]);
  c.beginPath();
  c.moveTo(w * 0.5, h * 0.9);
  c.lineTo(w * 0.5, h * 0.42);
  c.lineTo(w * 0.72, h * 0.3);
  c.stroke();
  c.setLineDash([]);
  c.fillStyle = "#ad7031";
  c.beginPath();
  c.arc(w * 0.72, h * 0.3, large ? 8 : 5, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#254b91";
  c.beginPath();
  c.moveTo(w * 0.32, h * 0.62);
  c.lineTo(w * 0.28, h * 0.7);
  c.lineTo(w * 0.36, h * 0.7);
  c.closePath();
  c.fill();
  c.fillStyle = "#173f32";
  c.font = `${large ? 16 : 11}px system-ui`;
  c.fillText("mock drawMap()", w * 0.08, h * 0.96);
}
function makeView(overrides) {
  const story = { ...baseStory, ...overrides.story };
  return {
    story,
    modal: overrides.modal ?? null,
    objective: overrides.objective ?? "Your invitation awaits",
    detail: overrides.detail ?? "Read your High Table Dinner invitation, then leave the shuttle.",
    prompt: overrides.prompt ?? "",
    saveStatus: overrides.saveStatus ?? "Saved on this device.",
    busReady: Boolean(overrides.busReady),
    computerPage: overrides.computerPage ?? "tasks",
    robotState: overrides.robotState ?? "patrol",
    robotWarning: overrides.robotWarning ?? 0,
    settings: { ...DEFAULT_SETTINGS, ...overrides.settings },
    handoffEvent: "opening.building4_reached",
    player: [65, 0.54, 32.7],
    yaw: 0,
    target: [61.2, 0, 32.6]
  };
}
var presets = {
  hud: {
    objective: "Attend High Table Dinner",
    detail: "Building 5 \xB7 Ground floor. Turn right after entering.",
    prompt: "F \xB7 Speak to the coordinator",
    saveStatus: "Saved on this device.",
    robotState: "scanning",
    robotWarning: 0.45,
    story: { stage: "to_b5", invitation_read: true }
  },
  invitation: {
    modal: "invitation",
    objective: "Your invitation awaits",
    detail: "Read your High Table Dinner invitation, then leave the shuttle.",
    story: { stage: "bus" }
  },
  staff: {
    modal: "staff",
    objective: "Attend High Table Dinner",
    detail: "Building 5 \xB7 Ground floor. Turn right after entering.",
    story: { stage: "to_b5", invitation_read: true }
  },
  alert: {
    modal: "alert",
    objective: "Something is wrong",
    detail: "Stay out of the robot\u2019s scan. Press C to inspect the MacBook.",
    robotState: "chase",
    robotWarning: 0.86,
    story: { stage: "incident", invitation_read: true, laptop_acquired: true, campus_alert_triggered: true }
  },
  computer: {
    modal: "computer",
    objective: "Collect the presentation MacBook",
    detail: "Building 6 \xB7 Pick up the laptop from the office table.",
    story: { stage: "to_b6", invitation_read: true, laptop_acquired: true }
  },
  "scanning-zero": {
    objective: "Attend High Table Dinner",
    detail: "Building 5 \xB7 Ground floor. Turn right after entering.",
    robotState: "scanning",
    robotWarning: 0,
    story: { stage: "to_b5", invitation_read: true }
  },
  "robot-caught-state": {
    objective: "Reach emergency control",
    detail: "Go to the main entrance of Building 4. Avoid the security robot.",
    robotState: "caught",
    robotWarning: 1,
    story: { stage: "to_b4", invitation_read: true, laptop_acquired: true, campus_alert_triggered: true, alert_read: true }
  },
  "computer-emergency": {
    modal: "computer",
    objective: "Reach emergency control",
    detail: "Go to the main entrance of Building 4. Avoid the security robot.",
    robotState: "search",
    robotWarning: 0.3,
    story: { stage: "to_b4", invitation_read: true, laptop_acquired: true, campus_alert_triggered: true, alert_read: true }
  },
  map: {
    modal: "computer",
    computerPage: "map",
    objective: "Collect the presentation MacBook",
    detail: "Building 6 \xB7 Pick up the laptop from the office table.",
    story: { stage: "to_b6", invitation_read: true, laptop_acquired: true }
  },
  caught: {
    modal: "caught",
    objective: "Reach emergency control",
    detail: "Go to the main entrance of Building 4. Avoid the security robot.",
    robotState: "failed",
    robotWarning: 1,
    story: { stage: "to_b4", invitation_read: true, laptop_acquired: true, campus_alert_triggered: true, alert_read: true }
  },
  complete: {
    modal: "complete",
    objective: "Building 4 reached",
    detail: "Opening complete. Keep the MacBook for the next section.",
    story: { stage: "complete", invitation_read: true, laptop_acquired: true, campus_alert_triggered: true, alert_read: true }
  },
  settings: {
    modal: "settings",
    objective: "Attend High Table Dinner",
    detail: "Building 5 \xB7 Ground floor. Turn right after entering.",
    saveStatus: "Saved on this device.",
    story: { stage: "to_b5", invitation_read: true }
  }
};
var stage = document.querySelector(".stage");
var ui = createOpeningUI(stage, {
  action: (action) => log.push(["action", action]),
  close: () => log.push(["close"]),
  setting: (key, value) => log.push(["setting", key, value]),
  drawMap: (canvas, large) => mockMap(canvas, large)
});
var target = window;
target.__ui = ui;
target.__log = log;
target.__presets = Object.keys(presets);
target.__setView = (overrides) => ui.update(makeView(overrides));
target.__showScenario = (name) => {
  const preset = presets[name];
  if (!preset) throw new Error("Unknown scenario " + name);
  ui.update(makeView(preset));
};
target.__focusInfo = () => {
  const active = document.activeElement;
  return {
    tag: active?.tagName ?? null,
    text: active?.textContent?.trim() ?? null,
    className: active?.className ?? null,
    inModal: !!active?.closest(".opening-dialog"),
    modalHidden: document.querySelector(".opening-modal-root")?.hidden ?? true
  };
};
var scenario = new URLSearchParams(location.search).get("scenario") ?? "hud";
window.__showScenario(scenario);
