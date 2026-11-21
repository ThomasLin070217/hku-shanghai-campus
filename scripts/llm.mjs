#!/usr/bin/env node
// Minimal OpenAI-compatible client for the LiteLLM proxy used by this project.
// Zero dependencies: reads .env at the repo root, then process.env.
// The key is never printed, logged, or written anywhere.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv(file) {
  try {
    for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const value = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
      if (process.env[match[1]] === undefined) process.env[match[1]] = value;
    }
  } catch {
    // No .env file: fall through to the real environment.
  }
}

loadEnv(resolve(root, '.env'));

const base = (process.env.LITELLM_BASE_URL || '').replace(/\/+$/, '');
const key = process.env.LITELLM_API_KEY || process.env.LITELLM_KEY || '';
const defaultModel = process.env.LITELLM_MODEL || '';
const timeoutMs = Number(process.env.LITELLM_TIMEOUT_MS || 60000);
const loopback = (() => {try{return ['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname);}catch{return false;}})();

export function configured() {
  return Boolean(base && (key || loopback));
}

function requireConfig() {
  const missing = [!base && 'LITELLM_BASE_URL', !key && !loopback && 'LITELLM_API_KEY'].filter(Boolean);
  if (missing.length) throw new Error(`${missing.join(' and ')} missing. Copy .env.example to .env, fill it in privately, and never paste keys in chat or commit them.`);
}

function endpoint(path) {
  if (/\/chat\/completions$/.test(base) && path === '/chat/completions') return base;
  // LiteLLM serves both /chat/completions and /v1/chat/completions; the /v1 form
  // also works with plain OpenAI-compatible servers.
  return (base.endsWith('/v1') ? base : `${base}/v1`) + path;
}

async function request(path, init = {}) {
  requireConfig();
  const headers = { 'content-type': 'application/json', ...(key?{authorization:`Bearer ${key}`}:{}), ...(init.headers || {}) };
  const deadline = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal,deadline]) : deadline;
  const response = await fetch(endpoint(path), { ...init, headers, signal });
  const text = await response.text();
  if (!response.ok) {
    const hint = response.status === 401 ? ' (check that LITELLM_API_KEY is a valid virtual key)' : '';
    throw Object.assign(new Error(`HTTP ${response.status} ${response.statusText}${hint}`),{status:response.status});
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${path}, got: ${text.slice(0, 200)}`);
  }
}

/** List models the proxy exposes. */
export const models = () => request('/models').then(body => (body.data || []).map(model => model.id));

/**
 * Chat completion. `messages` is the OpenAI array form; returns the raw response body.
 */
export function chat(messages, options = {}) {
  const model = options.model || defaultModel;
  if (!model) throw new Error('No model selected. Set LITELLM_MODEL or pass --model <name> (see: npm run llm -- --models).');
  return request('/chat/completions', {
    method: 'POST',
    signal:options.signal,
    body: JSON.stringify({ model, messages, temperature: options.temperature, max_tokens: options.maxTokens, response_format:options.responseFormat })
  });
}

function parseArgs(argv) {
  const options = { text: [], system: '', model: '', json: false, ping: false, list: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--models' || arg === '--list') options.list = true;
    else if (arg === '--ping') options.ping = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--system') options.system = argv[++i] || '';
    else if (arg === '--model') options.model = argv[++i] || '';
    else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else options.text.push(arg);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.ping || options.list) {
    const ids = await models();
    const result = { ok: true, base: base.replace(/\/\/[^/@]+@/, '//'), models: ids.length, ids };
    if (options.ping) {
      const probe = await chat([{ role: 'user', content: 'Reply with the single word: pong' }], { model: options.model, maxTokens: 16 });
      result.reply = probe.choices?.[0]?.message?.content?.trim();
      result.model = probe.model;
    }
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const prompt = options.text.join(' ').trim();
  if (!prompt) {
    console.log(JSON.stringify({
      ok: false,
      usage: 'npm run llm -- "your prompt" [--system "..."] [--model name] [--json] | --models | --ping',
      configured: { baseUrl: Boolean(base), apiKey: Boolean(key), model: defaultModel || '(unset)' }
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const messages = [];
  if (options.system) messages.push({ role: 'system', content: options.system });
  messages.push({ role: 'user', content: prompt });

  const response = await chat(messages, { model: options.model });
  if (options.json) {
    console.log(JSON.stringify(response, null, 2));
    return;
  }
  const content = response.choices?.[0]?.message?.content ?? '';
  console.log(content);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(JSON.stringify({ ok: false, error: error.message }));
    process.exitCode = 1;
  });
}
