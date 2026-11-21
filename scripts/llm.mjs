#!/usr/bin/env node
// Minimal zero-dependency LLM client for this project.
//
// Providers:
//   gemini  - Google Gemini API directly (GEMINI_API_KEY)
//   litellm - OpenAI-compatible LiteLLM proxy (LITELLM_*)
//
// Reads .env at the repo root, then process.env (existing variables win).
// The key is never printed, logged, or written anywhere.
//
// Network proxy: set LLM_PROXY (or HTTPS_PROXY) to an http(s) proxy. The CLI
// restarts itself once with NODE_USE_ENV_PROXY=1 so Node's built-in fetch uses
// it; this needs Node.js 24+. Library importers must set that flag themselves.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROVIDERS = ['gemini', 'litellm'];
const DEFAULT_GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

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

const trim = name => (process.env[name] || '').trim();

function timeoutMs(provider) {
  const shared = Number(trim('LLM_TIMEOUT_MS')) || 0;
  if (shared > 0) return shared;
  const specific = Number(trim(provider === 'gemini' ? 'GEMINI_TIMEOUT_MS' : 'LITELLM_TIMEOUT_MS')) || 0;
  return specific > 0 ? specific : 60000;
}

function litellmConfig() {
  return {
    name: 'litellm',
    base: trim('LITELLM_BASE_URL').replace(/\/+$/, ''),
    key: trim('LITELLM_API_KEY') || trim('LITELLM_KEY'),
    model: trim('LITELLM_MODEL'),
    timeoutMs: timeoutMs('litellm')
  };
}

function geminiConfig() {
  return {
    name: 'gemini',
    base: (trim('GEMINI_BASE_URL') || DEFAULT_GEMINI_BASE).replace(/\/+$/, ''),
    key: trim('GEMINI_API_KEY'),
    model: trim('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL,
    transport: (trim('GEMINI_TRANSPORT') || 'native').toLowerCase(),
    timeoutMs: timeoutMs('gemini')
  };
}

function configFor(provider) {
  return provider === 'gemini' ? geminiConfig() : litellmConfig();
}

/**
 * Provider used when the caller does not pass one: LLM_PROVIDER if set, else
 * gemini when a Gemini key exists, else litellm.
 */
export function activeProvider() {
  const forced = trim('LLM_PROVIDER').toLowerCase();
  if (forced) {
    if (!PROVIDERS.includes(forced)) {
      throw new Error(`Unknown LLM_PROVIDER "${forced}". Use one of: ${PROVIDERS.join(', ')}.`);
    }
    return forced;
  }
  return geminiConfig().key ? 'gemini' : 'litellm';
}

export function configured(provider = activeProvider()) {
  const config = configFor(provider);
  if (provider === 'gemini') return Boolean(config.key);
  return Boolean(config.base && config.key);
}

function requireConfig(provider) {
  const config = configFor(provider);
  if (provider === 'gemini') {
    if (!config.key) {
      throw new Error('GEMINI_API_KEY missing. Copy .env.example to .env, fill it in privately, and never paste keys in chat or commit them.');
    }
    return config;
  }
  const missing = [!config.base && 'LITELLM_BASE_URL', !config.key && 'LITELLM_API_KEY'].filter(Boolean);
  if (missing.length) {
    throw new Error(`${missing.join(' and ')} missing. Copy .env.example to .env, fill it in privately, and never paste keys in chat or commit them.`);
  }
  return config;
}

function errorDetail(text) {
  try {
    const body = JSON.parse(text);
    // Gemini native: {error:{message}}; OpenAI-compatible: [{error:{message}}].
    return body?.error?.message || body?.[0]?.error?.message || text.slice(0, 300);
  } catch {
    return text.slice(0, 300);
  }
}

function describeHttpError(provider, response, text) {
  const detail = errorDetail(text);
  const hints = [];
  if (response.status === 401 || response.status === 403) hints.push('check that the API key is valid');
  if (/location is not supported/i.test(detail)) {
    hints.push('the Gemini API is not available from this network location (for example mainland China or Hong Kong); run from a supported region or point GEMINI_BASE_URL at your own gateway');
  }
  if (/no longer available to new users/i.test(detail)) {
    hints.push('pick a current model with `npm run llm -- --models` and set GEMINI_MODEL');
  }
  const suffix = hints.length ? ` (${hints.join('; ')})` : '';
  return `${provider} HTTP ${response.status} ${response.statusText}: ${detail}${suffix}`;
}

async function requestJson(provider, url, init, config) {
  let response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(config.timeoutMs) });
  } catch (error) {
    throw new Error(`${provider} request failed: ${error.message}`);
  }
  const text = await response.text();
  if (!response.ok) throw new Error(describeHttpError(provider, response, text));
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${provider} returned non-JSON (HTTP ${response.status}): ${text.slice(0, 200)}`);
  }
}

function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(part => (typeof part === 'string' ? part : part?.text || '')).filter(Boolean).join('\n');
  }
  return '';
}

/** Convert OpenAI-style messages to Gemini contents + systemInstruction. */
function toGeminiContents(messages) {
  const system = [];
  const contents = [];
  for (const message of messages) {
    const text = textOf(message.content);
    if (!text) continue;
    if (message.role === 'system' || message.role === 'developer') system.push(text);
    else contents.push({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text }] });
  }
  return { system: system.join('\n\n'), contents };
}

/** Convert a Gemini generateContent response into the OpenAI response shape. */
function fromGeminiResponse(body, model, config) {
  const candidate = body?.candidates?.[0] || {};
  const content = (candidate.content?.parts || []).map(part => part?.text || '').filter(Boolean).join('');
  const usage = body?.usageMetadata;
  return {
    provider: 'gemini',
    model: body?.modelVersion || model,
    choices: [{
      index: 0,
      message: { role: 'assistant', content },
      finish_reason: String(candidate.finishReason || 'stop').toLowerCase()
    }],
    usage: usage ? {
      prompt_tokens: usage.promptTokenCount,
      completion_tokens: usage.candidatesTokenCount,
      total_tokens: usage.totalTokenCount
    } : undefined,
    endpoint: `${config.base}/models/${model}:generateContent`,
    raw: body
  };
}

async function geminiRequest(path, init, config) {
  const body = await requestJson('gemini', `${config.base}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': config.key,
      ...(init?.headers || {})
    }
  }, config);
  return body;
}

/** List models for a provider. */
export async function models(provider = activeProvider()) {
  const config = requireConfig(provider);
  if (provider === 'gemini') {
    const body = await requestJson('gemini', `${config.base}/models?pageSize=100`, {
      headers: { 'x-goog-api-key': config.key }
    }, config);
    return (body.models || [])
      .map(model => String(model.name || '').replace(/^models\//, ''))
      .filter(Boolean);
  }
  const body = await requestJson('litellm', endpointForLitellm(config, '/models'), {
    headers: { authorization: `Bearer ${config.key}` }
  }, config);
  return (body.data || []).map(model => model.id);
}

function endpointForLitellm(config, path) {
  if (/\/chat\/completions$/.test(config.base) && path === '/chat/completions') return config.base;
  // LiteLLM serves both /chat/completions and /v1/chat/completions; the /v1 form
  // also works with plain OpenAI-compatible servers.
  return (config.base.endsWith('/v1') ? config.base : `${config.base}/v1`) + path;
}

async function litellmChat(config, messages, options, model) {
  return requestJson('litellm', endpointForLitellm(config, '/chat/completions'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.key}` },
    body: JSON.stringify({ model, messages, temperature: options.temperature, max_tokens: options.maxTokens })
  }, config);
}

async function geminiChat(config, messages, options, model) {
  const { system, contents } = toGeminiContents(messages);
  if (!contents.length) throw new Error('Gemini needs at least one user or assistant message.');

  if (config.transport === 'openai') {
    const base = config.base.endsWith('/openai') ? config.base : `${config.base}/openai`;
    const body = await requestJson('gemini', `${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.key}` },
      body: JSON.stringify({ model, messages, temperature: options.temperature, max_tokens: options.maxTokens })
    }, config);
    return { ...body, provider: 'gemini', transport: 'openai' };
  }

  const payload = {
    contents,
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    generationConfig: {
      ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
      ...(options.maxTokens === undefined ? {} : { maxOutputTokens: options.maxTokens })
    }
  };
  const body = await geminiRequest(`/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }, config);
  return fromGeminiResponse(body, model, config);
}

/**
 * Chat completion. `messages` is the OpenAI array form; resolves to an
 * OpenAI-shaped response regardless of provider.
 */
export async function chat(messages, options = {}) {
  const provider = options.provider || activeProvider();
  if (!PROVIDERS.includes(provider)) throw new Error(`Unknown provider "${provider}". Use one of: ${PROVIDERS.join(', ')}.`);
  const config = requireConfig(provider);
  const model = options.model || config.model;
  if (!model) {
    throw new Error('No model selected. Set the provider model variable or pass --model <name> (see: npm run llm -- --models).');
  }
  if (provider === 'gemini') return geminiChat(config, messages, options, model);
  return litellmChat(config, messages, options, model);
}

function parseArgs(argv) {
  const options = { text: [], system: '', model: '', provider: '', json: false, ping: false, list: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--models' || arg === '--list') options.list = true;
    else if (arg === '--ping') options.ping = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--system') options.system = argv[++i] || '';
    else if (arg === '--model') options.model = argv[++i] || '';
    else if (arg === '--provider') options.provider = argv[++i] || '';
    else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else options.text.push(arg);
  }
  if (options.provider && !PROVIDERS.includes(options.provider)) {
    throw new Error(`Unknown provider "${options.provider}". Use one of: ${PROVIDERS.join(', ')}.`);
  }
  return options;
}

function usage(provider) {
  const gemini = geminiConfig();
  const litellm = litellmConfig();
  return {
    ok: false,
    usage: 'npm run llm -- "your prompt" [--system "..."] [--model name] [--provider gemini|litellm] [--json] | --models | --ping',
    defaultProvider: provider,
    configured: {
      gemini: { apiKey: Boolean(gemini.key), model: gemini.model, baseUrl: gemini.base, transport: gemini.transport },
      litellm: { baseUrl: Boolean(litellm.base), apiKey: Boolean(litellm.key), model: litellm.model || '(unset)' }
    }
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const provider = options.provider || activeProvider();

  if (options.list) {
    const ids = await models(provider);
    console.log(JSON.stringify({ ok: true, provider, models: ids.length, ids }, null, 2));
    return;
  }

  if (options.ping) {
    const result = { ok: true, provider };
    try {
      const ids = await models(provider);
      result.models = ids.length;
      result.ids = ids;
    } catch (error) {
      // Listing needs extra permissions on some gateways; the chat probe decides.
      result.modelsError = error.message;
    }
    const probe = await chat([{ role: 'user', content: 'Reply with the single word: pong' }], {
      model: options.model,
      maxTokens: 16,
      provider
    });
    result.reply = probe.choices?.[0]?.message?.content?.trim();
    result.model = probe.model;
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const prompt = options.text.join(' ').trim();
  if (!prompt) {
    console.log(JSON.stringify(usage(provider), null, 2));
    process.exitCode = 1;
    return;
  }

  const messages = [];
  if (options.system) messages.push({ role: 'system', content: options.system });
  messages.push({ role: 'user', content: prompt });

  const response = await chat(messages, { model: options.model, provider });
  if (options.json) {
    console.log(JSON.stringify(response, null, 2));
    return;
  }
  console.log(response.choices?.[0]?.message?.content ?? '');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(JSON.stringify({ ok: false, error: error.message }));
    process.exitCode = 1;
  });
}
