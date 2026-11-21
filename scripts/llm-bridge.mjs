#!/usr/bin/env node
// Local LLM bridge for the MacBook assistant.
//
// The browser must never hold DEEPSEEK_API_KEY / GEMINI_API_KEY / LITELLM_API_KEY.
// This loopback server accepts the same OpenAI-style {messages} body the
// in-game agent already sends, forwards it through scripts/llm.mjs, and
// returns an OpenAI-shaped reply. It listens on 127.0.0.1 only and rejects
// foreign origins. `npm run play` starts it next to Vite; without it the game
// falls back to the built-in campus guidance.
//
// Provider choice: HKU_LLM_PROVIDER, else deepseek when DEEPSEEK_API_KEY is
// present, else scripts/llm.mjs's default. If the primary provider fails, one
// configured fallback provider is tried before reporting the error.
//
// The lawn skill compiler sends the same body plus an optional OpenAI
// `response_format` (structured skill JSON) and `temperature`. If a provider
// rejects response_format (HTTP 400/415/422) the request is retried once as
// plain text; the game validates the JSON either way.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { chat, activeProvider, configured, proxyUrl } from './llm.mjs';

const PROVIDERS = ['deepseek', 'gemini', 'litellm'];
const PORT = Number(process.env.HKU_LLM_PORT || 8790);
const HOST = '127.0.0.1';
const ORIGINS = new Set([
  'http://localhost:5184', 'http://127.0.0.1:5184',
  'http://localhost:5174', 'http://127.0.0.1:5174',
  'http://localhost:4174', 'http://127.0.0.1:4174',
]);
const MAX_BODY = 64 * 1024;
const MAX_MESSAGES = 24;
const MAX_CONTENT = 8000;
const MAX_IN_FLIGHT = 2;

function proxyApplied() {
  return ['1', 'true'].includes(String(process.env.NODE_USE_ENV_PROXY || '').toLowerCase());
}
function restartForProxy() {
  const proxy = proxyUrl();
  if (!proxy || proxyApplied()) return false;
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 24) {
    console.error(`[llm] LLM_PROXY needs Node.js 24+ (found ${process.versions.node}).`);
    return false;
  }
  const child = spawn(process.execPath, [...process.execArgv, process.argv[1], ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1', HTTPS_PROXY: proxy, https_proxy: proxy },
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('exit', code => { process.exitCode = code ?? 0; });
  return true;
}

function providerModel(provider) {
  if (provider === 'deepseek') return (process.env.DEEPSEEK_MODEL || '').trim() || 'deepseek-chat';
  if (provider === 'gemini') return (process.env.GEMINI_MODEL || '').trim() || 'gemini';
  return (process.env.LITELLM_MODEL || '').trim() || 'litellm';
}
/** Provider the assistant should use: explicit override, then DeepSeek, then llm.mjs's default. */
function primaryProvider() {
  const forced = (process.env.HKU_LLM_PROVIDER || '').trim().toLowerCase();
  if (PROVIDERS.includes(forced)) return forced;
  if ((process.env.DEEPSEEK_API_KEY || '').trim()) return 'deepseek';
  return activeProvider();
}
function fallbackProvider(primary) {
  try {
    const auto = activeProvider();
    return auto !== primary && configured(auto) ? auto : null;
  } catch {
    return null;
  }
}
function cors(origin) {
  const headers = {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  };
  if (origin && ORIGINS.has(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-methods'] = 'GET, POST, OPTIONS';
    headers['access-control-allow-headers'] = 'content-type';
    headers['access-control-max-age'] = '600';
    headers.vary = 'origin';
  }
  return headers;
}
function send(res, status, data, origin) {
  res.writeHead(status, { ...cors(origin), 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}
function validMessages(input) {
  if (!Array.isArray(input) || !input.length || input.length > MAX_MESSAGES) return null;
  const messages = [];
  for (const row of input) {
    if (!row || typeof row !== 'object') return null;
    const { role, content } = row;
    if (!['system', 'user', 'assistant'].includes(role) || typeof content !== 'string' || !content.trim()) return null;
    if (content.length > MAX_CONTENT) return null;
    messages.push({ role, content });
  }
  return messages.some(row => row.role === 'user') ? messages : null;
}
const RESPONSE_FORMATS = ['json_schema', 'json_object', 'text'];
function validResponseFormat(input) {
  if (input === undefined || input === null) return null;
  if (typeof input !== 'object' || Array.isArray(input) || !RESPONSE_FORMATS.includes(input.type)) return undefined;
  return input;
}
function validTemperature(input) {
  return typeof input === 'number' && Number.isFinite(input) && input >= 0 && input <= 1 ? input : 0.4;
}
function readableError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, ' ').slice(0, 400);
}

let inFlight = 0;
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  if (origin && !ORIGINS.has(origin)) return send(res, 403, { ok: false, error: 'origin_rejected' }, origin);
  const host = (req.headers.host || '').split(':')[0];
  if (!['127.0.0.1', 'localhost'].includes(host)) return send(res, 403, { ok: false, error: 'host_rejected' }, origin);

  let url;
  try { url = new URL(req.url || '/', `http://${HOST}`); } catch { return send(res, 400, { ok: false, error: 'invalid_url' }, origin); }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors(origin));
    return res.end();
  }
  if (req.method === 'GET' && url.pathname === '/health') {
    let primary = 'unknown';
    try { primary = primaryProvider(); } catch { primary = 'gemini'; }
    return send(res, 200, {
      ok: true,
      provider: primary,
      model: providerModel(primary),
      configured: configured(primary),
      fallback: fallbackProvider(primary),
      proxy: Boolean(proxyUrl()),
      listen: `${HOST}:${PORT}`,
    }, origin);
  }
  if (req.method !== 'POST' || url.pathname !== '/api/chat') {
    return send(res, 404, { ok: false, error: 'not_found' }, origin);
  }
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
    return send(res, 415, { ok: false, error: 'json_required' }, origin);
  }
  let raw = '';
  try {
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > MAX_BODY) return send(res, 413, { ok: false, error: 'body_too_large' }, origin);
    }
  } catch {
    return send(res, 400, { ok: false, error: 'bad_request' }, origin);
  }
  let body;
  try { body = JSON.parse(raw || '{}'); } catch { return send(res, 400, { ok: false, error: 'invalid_json' }, origin); }
  const messages = validMessages(body?.messages);
  if (!messages) return send(res, 400, { ok: false, error: 'invalid_messages' }, origin);
  const responseFormat = validResponseFormat(body?.response_format);
  if (responseFormat === undefined) return send(res, 400, { ok: false, error: 'invalid_response_format' }, origin);
  const temperature = validTemperature(body?.temperature);
  if (inFlight >= MAX_IN_FLIGHT) return send(res, 429, { ok: false, error: 'busy' }, origin);

  inFlight += 1;
  const started = Date.now();
  let primary = 'gemini';
  try { primary = primaryProvider(); } catch { /* fall back below */ }
  const fallback = fallbackProvider(primary);
  // Stop the upstream call when the page gives up (closed MacBook, new draft).
  const cancel = new AbortController();
  res.on('close', () => cancel.abort());
  async function ask(provider) {
    const options = { temperature, maxTokens: 700, provider, signal: cancel.signal };
    if (!responseFormat) return chat(messages, options);
    try {
      return await chat(messages, { ...options, responseFormat });
    } catch (error) {
      if (![400, 415, 422].includes(error?.status)) throw error;
      return chat(messages, options);
    }
  }
  try {
    let result;
    let used = primary;
    if (!configured(primary)) throw new Error(`${primary} is not configured (missing API key); add it to .env`);
    try {
      result = await ask(primary);
    } catch (error) {
      if (!fallback || cancel.signal.aborted) throw error;
      console.warn(`[llm] ${primary} failed: ${readableError(error)}; trying ${fallback}`);
      result = await ask(fallback);
      used = fallback;
    }
    send(res, 200, {
      ok: true,
      provider: used,
      model: result.model || providerModel(used),
      choices: result.choices,
      usage: result.usage,
      fallback: used !== primary,
    }, origin);
    console.log(`[llm] ${used} ${result.model || ''} ok ${Date.now() - started}ms${used !== primary ? ' (fallback)' : ''}`);
  } catch (error) {
    const message = readableError(error);
    const status = /missing|not configured|no model|api key/i.test(message) ? 503 : /timed? ?out|abort/i.test(message) ? 504 : 502;
    send(res, status, { ok: false, error: 'llm_failed', message }, origin);
    console.error(`[llm] ${primary} failed ${Date.now() - started}ms: ${message}`);
  } finally {
    inFlight -= 1;
  }
});

if (!restartForProxy()) {
  server.listen(PORT, HOST, () => {
    let primary = 'gemini';
    try { primary = primaryProvider(); } catch { /* report gemini by default */ }
    const ready = configured(primary);
    const fallback = fallbackProvider(primary);
    console.log(`[llm] bridge http://${HOST}:${PORT}/api/chat · ${primary} ${providerModel(primary)}${fallback ? ` (fallback: ${fallback})` : ''}${ready ? '' : ' (no key; chat returns 503)'}`);
  });
  server.on('error', error => {
    console.error(`[llm] bridge could not start: ${error.message}`);
    process.exitCode = 1;
  });
  const close = () => { server.close(() => process.exit()); setTimeout(() => process.exit(), 500).unref(); };
  process.on('SIGTERM', close);
  process.on('SIGINT', close);
}
