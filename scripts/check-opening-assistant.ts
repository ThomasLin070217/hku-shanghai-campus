/**
 * MacBook assistant: persona wiring + offline fallback.
 * Pure module check: no browser, no network, no real API key.
 *
 * The bridge is stubbed so this runs anywhere; it asserts that
 *  - the shipped defaults point at the loopback bridge and the DeepSeek model,
 *  - the system prompt carries 岚's character sheet and the live state,
 *  - a missing bridge degrades to the in-character built-in answers,
 *  - after a connection failure the next question does not wait for another
 *    timeout (short cooldown), and
 *  - no credential-looking string is baked into the persona.
 */
import assert from 'node:assert/strict';
import {ASSISTANT, personaGreeting, personaIdentity, personaPrompt} from '../src/opening/persona';
import {ASSISTANT_DEFAULT_ENDPOINT, ASSISTANT_DEFAULT_MODEL, createLocalAgent} from '../src/opening/agent';
import {createOpeningState} from '../src/opening/state';
import {createOpeningRuntime} from '../src/opening/runtime';
import type {AgentContext} from '../src/opening/agent';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

assert.equal(ASSISTANT_DEFAULT_ENDPOINT, 'http://127.0.0.1:8790/api/chat', 'the assistant talks to the loopback bridge, never a public API');
assert.equal(ASSISTANT_DEFAULT_MODEL, 'deepseek-flash', 'default model label matches the DeepSeek deployment');

const prompt = personaPrompt();
assert.match(prompt, /You are 岚 \(LAN/, 'the model is told who it is');
assert.match(prompt, /2030/, 'the year and setting are part of the character');
assert.match(prompt, /five short sentences/, 'answer-length rule is part of the built-in settings');
assert.match(prompt, /cannot move the player/, 'capability boundaries are explicit');
assert.match(prompt, /Building 4/, 'the emergency route fact is present');
assert.ok(!/sk-[A-Za-z0-9_-]{8,}/.test(prompt), 'no credential-looking string in the prompt');

assert.match(personaIdentity(true), /岚/);
assert.match(personaIdentity(true), /不能移动你/);
assert.match(personaIdentity(false), /LAN/);
assert.match(personaIdentity(false), /cannot move you/);

for (const [state, expected] of [
  [{laptopAcquired: false, curtainDeployed: false, alertTriggered: false, alertRead: false}, /岚/],
  [{laptopAcquired: true, curtainDeployed: false, alertTriggered: false, alertRead: false}, /岚/],
  [{laptopAcquired: true, curtainDeployed: true, alertTriggered: false, alertRead: false}, /curtain/],
  [{laptopAcquired: true, curtainDeployed: true, alertTriggered: true, alertRead: true}, /Building 4/],
] as const) assert.match(personaGreeting(state), expected, 'greetings stay in character for every stage');

assert.match(personaGreeting({laptopAcquired: true, curtainDeployed: true, alertTriggered: true, alertRead: true}, true), /我是岚/, 'Chinese browsers get a Chinese greeting');
assert.match(personaGreeting({laptopAcquired: true, curtainDeployed: true, alertTriggered: true, alertRead: true}, true), /4 号楼/);

// A live incident state: laptop in the pack, alert read, curtain down.
const story = {...createOpeningState(), stage: 'incident', laptop_acquired: true, campus_alert_triggered: true, alert_read: true};
const runtime = {...createOpeningRuntime(), hearts: 8, catches: 1, curtain_deployed: true, agent_chat_unlocked: true};
const ctx = {story, runtime, player: [0, 0, 0], objective: 'go_to_building4', detail: '', computeStatus: 'unavailable'} as unknown as AgentContext;

const realFetch = globalThis.fetch;
const sleepTight = () => sleep(25);

// 1. Bridge up: the real system prompt is sent and the model reply wins.
const prompts: string[] = [];
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  if (String(url).includes('/health')) {
    return new Response(JSON.stringify({ok: true, configured: true, provider: 'deepseek', model: 'deepseek-flash'}), {status: 200});
  }
  const body = JSON.parse(String(init?.body));
  prompts.push(body.messages[0].content);
  assert.equal(body.model, 'deepseek-flash');
  return new Response(JSON.stringify({model: 'deepseek-flash', choices: [{index: 0, message: {role: 'assistant', content: '我在，先往 4 号楼走。'}}]}), {status: 200});
}) as typeof fetch;

const agent = createLocalAgent();
await sleepTight();
const answer = await agent.ask('你是谁？', ctx);
assert.equal(answer.source, 'local-model', 'a reachable bridge is used');
assert.equal(answer.text, '我在，先往 4 号楼走。');
assert.equal(prompts.length, 1);
assert.match(prompts[0], /You are 岚 \(LAN/, 'persona reaches the model');
assert.match(prompts[0], /Story stage: incident/, 'live story state is appended');
assert.match(prompts[0], /Hearts: 8\/10/, 'live hearts are appended');
assert.equal(agent.status().mode, 'local-model');
assert.equal(agent.status().model, 'deepseek-flash');
agent.dispose();

// 2. Bridge down: in-character built-in answer, then a cooldown that skips the bridge.
let attempts = 0;
globalThis.fetch = (async () => {
  attempts += 1;
  throw new TypeError('fetch failed');
}) as typeof fetch;

const offline = createLocalAgent();
await sleepTight();
const started = performance.now();
const fallback = await offline.ask('你是谁？', ctx);
const elapsed = performance.now() - started;
assert.equal(fallback.source, 'builtin', 'no bridge means the built-in core answers');
assert.match(fallback.text, /岚/, 'the fallback still knows who it is');
assert.match(fallback.text, /不能移动你|cannot move you/);
assert.ok(elapsed < 1000, `a dead bridge must not hang for the request timeout (took ${Math.round(elapsed)}ms)`);

attempts = 0;
const quick = await offline.ask('怎么去 4 号楼？', ctx);
assert.equal(attempts, 0, 'the cooldown skips another doomed bridge request');
assert.equal(quick.source, 'builtin');
assert.match(quick.text, /4 号楼/);
offline.dispose();

globalThis.fetch = realFetch;
console.log('opening assistant: persona wired, offline fallback and cooldown verified');
