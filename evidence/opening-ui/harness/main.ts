import {createOpeningUI} from '../../../src/opening/ui.ts';
import {DEFAULT_SETTINGS} from './save-stub';

type Story = {
  schemaVersion: 1;
  stage: 'bus' | 'to_b5' | 'to_b6' | 'return_b5' | 'incident' | 'to_b4' | 'complete';
  invitation_read: boolean;
  laptop_acquired: boolean;
  campus_alert_triggered: boolean;
  alert_read: boolean;
  events: string[];
  elapsedSeconds: number;
};

const baseStory: Story = {
  schemaVersion: 1,
  stage: 'bus',
  invitation_read: false,
  laptop_acquired: false,
  campus_alert_triggered: false,
  alert_read: false,
  events: [],
  elapsedSeconds: 96,
};

const log: unknown[][] = [];

function mockMap(canvas: HTMLCanvasElement, large: boolean): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const w = canvas.width;
  const h = canvas.height;
  c.fillStyle = '#e6e9dc';
  c.fillRect(0, 0, w, h);
  c.strokeStyle = '#b0bbab';
  c.lineWidth = large ? 6 : 4;
  c.strokeRect(w * 0.06, h * 0.05, w * 0.88, h * 0.9);
  c.fillStyle = '#bcc4b7';
  for (const [x, y, bw, bh] of [
    [0.16, 0.2, 0.22, 0.18],
    [0.58, 0.15, 0.24, 0.22],
    [0.14, 0.56, 0.2, 0.2],
    [0.6, 0.56, 0.26, 0.22],
  ]) c.fillRect(w * x, h * y, w * bw, h * bh);
  c.strokeStyle = '#2e7962';
  c.lineWidth = large ? 4 : 2.5;
  c.setLineDash([6, 5]);
  c.beginPath();
  c.moveTo(w * 0.5, h * 0.9);
  c.lineTo(w * 0.5, h * 0.42);
  c.lineTo(w * 0.72, h * 0.3);
  c.stroke();
  c.setLineDash([]);
  c.fillStyle = '#ad7031';
  c.beginPath();
  c.arc(w * 0.72, h * 0.3, large ? 8 : 5, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#254b91';
  c.beginPath();
  c.moveTo(w * 0.32, h * 0.62);
  c.lineTo(w * 0.28, h * 0.7);
  c.lineTo(w * 0.36, h * 0.7);
  c.closePath();
  c.fill();
  c.fillStyle = '#173f32';
  c.font = `${large ? 16 : 11}px system-ui`;
  c.fillText('mock drawMap()', w * 0.08, h * 0.96);
}

function makeView(overrides: Record<string, unknown>) {
  const story = {...baseStory, ...(overrides.story as Record<string, unknown> | undefined)} as Story;
  return {
    story,
    modal: (overrides.modal ?? null) as null,
    objective: (overrides.objective ?? 'Your invitation awaits') as string,
    detail: (overrides.detail ?? 'Read your High Table Dinner invitation, then leave the shuttle.') as string,
    prompt: (overrides.prompt ?? '') as string,
    saveStatus: (overrides.saveStatus ?? 'Saved on this device.') as string,
    busReady: Boolean(overrides.busReady),
    computerPage: (overrides.computerPage ?? 'tasks') as 'map' | 'tasks',
    robotState: (overrides.robotState ?? 'patrol') as string,
    robotWarning: (overrides.robotWarning ?? 0) as number,
    settings: {...DEFAULT_SETTINGS, ...(overrides.settings as Record<string, unknown> | undefined)},
    handoffEvent: 'opening.building4_reached',
    player: [65, 0.54, 32.7] as [number, number, number],
    yaw: 0,
    target: [61.2, 0, 32.6] as [number, number, number],
  };
}

const presets: Record<string, Record<string, unknown>> = {
  hud: {
    objective: 'Attend High Table Dinner',
    detail: 'Building 5 · Ground floor. Turn right after entering.',
    prompt: 'F · Speak to the coordinator',
    saveStatus: 'Saved on this device.',
    robotState: 'scanning',
    robotWarning: 0.45,
    story: {stage: 'to_b5', invitation_read: true},
  },
  invitation: {
    modal: 'invitation',
    objective: 'Your invitation awaits',
    detail: 'Read your High Table Dinner invitation, then leave the shuttle.',
    story: {stage: 'bus'},
  },
  staff: {
    modal: 'staff',
    objective: 'Attend High Table Dinner',
    detail: 'Building 5 · Ground floor. Turn right after entering.',
    story: {stage: 'to_b5', invitation_read: true},
  },
  alert: {
    modal: 'alert',
    objective: 'Something is wrong',
    detail: 'Stay out of the robot’s scan. Press C to inspect the MacBook.',
    robotState: 'chase',
    robotWarning: 0.86,
    story: {stage: 'incident', invitation_read: true, laptop_acquired: true, campus_alert_triggered: true},
  },
  computer: {
    modal: 'computer',
    objective: 'Collect the presentation MacBook',
    detail: 'Building 6 · Pick up the laptop from the office table.',
    story: {stage: 'to_b6', invitation_read: true, laptop_acquired: true},
  },
  'scanning-zero': {
    objective: 'Attend High Table Dinner',
    detail: 'Building 5 · Ground floor. Turn right after entering.',
    robotState: 'scanning',
    robotWarning: 0,
    story: {stage: 'to_b5', invitation_read: true},
  },
  'robot-caught-state': {
    objective: 'Reach emergency control',
    detail: 'Go to the main entrance of Building 4. Avoid the security robot.',
    robotState: 'caught',
    robotWarning: 1,
    story: {stage: 'to_b4', invitation_read: true, laptop_acquired: true, campus_alert_triggered: true, alert_read: true},
  },
  'computer-emergency': {
    modal: 'computer',
    objective: 'Reach emergency control',
    detail: 'Go to the main entrance of Building 4. Avoid the security robot.',
    robotState: 'search',
    robotWarning: 0.3,
    story: {stage: 'to_b4', invitation_read: true, laptop_acquired: true, campus_alert_triggered: true, alert_read: true},
  },
  map: {
    modal: 'computer',
    computerPage: 'map',
    objective: 'Collect the presentation MacBook',
    detail: 'Building 6 · Pick up the laptop from the office table.',
    story: {stage: 'to_b6', invitation_read: true, laptop_acquired: true},
  },
  caught: {
    modal: 'caught',
    objective: 'Reach emergency control',
    detail: 'Go to the main entrance of Building 4. Avoid the security robot.',
    robotState: 'failed',
    robotWarning: 1,
    story: {stage: 'to_b4', invitation_read: true, laptop_acquired: true, campus_alert_triggered: true, alert_read: true},
  },
  complete: {
    modal: 'complete',
    objective: 'Building 4 reached',
    detail: 'Opening complete. Keep the MacBook for the next section.',
    story: {stage: 'complete', invitation_read: true, laptop_acquired: true, campus_alert_triggered: true, alert_read: true},
  },
  settings: {
    modal: 'settings',
    objective: 'Attend High Table Dinner',
    detail: 'Building 5 · Ground floor. Turn right after entering.',
    saveStatus: 'Saved on this device.',
    story: {stage: 'to_b5', invitation_read: true},
  },
};

const stage = document.querySelector<HTMLElement>('.stage')!;
const ui = createOpeningUI(stage, {
  action: (action) => log.push(['action', action]),
  close: () => log.push(['close']),
  setting: (key, value) => log.push(['setting', key, value]),
  drawMap: (canvas, large) => mockMap(canvas, large),
});

const target = window as unknown as Record<string, unknown>;
target.__ui = ui;
target.__log = log;
target.__presets = Object.keys(presets);
target.__setView = (overrides: Record<string, unknown>) => ui.update(makeView(overrides) as never);
target.__showScenario = (name: string) => {
  const preset = presets[name];
  if (!preset) throw new Error('Unknown scenario ' + name);
  ui.update(makeView(preset) as never);
};
target.__focusInfo = () => {
  const active = document.activeElement as HTMLElement | null;
  return {
    tag: active?.tagName ?? null,
    text: active?.textContent?.trim() ?? null,
    className: active?.className ?? null,
    inModal: !!active?.closest('.opening-dialog'),
    modalHidden: document.querySelector<HTMLElement>('.opening-modal-root')?.hidden ?? true,
  };
};

const scenario = new URLSearchParams(location.search).get('scenario') ?? 'hud';
(window as unknown as {__showScenario: (name: string) => void}).__showScenario(scenario);
