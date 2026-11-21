#!/usr/bin/env node
// Offline check for scripts/llm.mjs. Stubs global fetch: no network, no real key.
import assert from 'node:assert/strict';

const realFetch = globalThis.fetch;
const calls = [];
let reply = null;

function stubFetch(handler) {
  calls.length = 0;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const result = await handler(String(url), init);
    return new Response(JSON.stringify(result.body), {
      status: result.status ?? 200,
      statusText: result.statusText ?? 'OK',
      headers: { 'content-type': 'application/json' }
    });
  };
}

const json = body => ({ body });

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('PASS ' + name);
  } catch (error) {
    failed += 1;
    console.log('FAIL ' + name + ' :: ' + (error instanceof Error ? error.message : String(error)));
  }
}

function resetEnv(overrides = {}) {
  for (const key of [
    'LLM_PROVIDER', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_BASE_URL', 'GEMINI_TRANSPORT',
    'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'DEEPSEEK_BASE_URL', 'DEEPSEEK_TIMEOUT_MS',
    'LITELLM_BASE_URL', 'LITELLM_API_KEY', 'LITELLM_MODEL', 'LLM_TIMEOUT_MS',
    'LLM_PROXY', 'HTTPS_PROXY', 'https_proxy', 'NODE_USE_ENV_PROXY'
  ]) delete process.env[key];
  Object.assign(process.env, {
    GEMINI_API_KEY: 'test-gemini-key-do-not-log',
    GEMINI_MODEL: 'gemini-test',
    ...overrides
  });
}

resetEnv();
const llm = await import(new URL('./llm.mjs', import.meta.url).href);

const GEMINI_OK = {
  candidates: [{
    content: { parts: [{ text: 'pong' }], role: 'model' },
    finishReason: 'STOP'
  }],
  usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 1, totalTokenCount: 8 },
  modelVersion: 'gemini-test-001'
};

await test('gemini native: url, header, body mapping, OpenAI-shaped reply', async () => {
  stubFetch(() => json(GEMINI_OK));
  const response = await llm.chat([
    { role: 'system', content: 'be brief' },
    { role: 'user', content: 'ping' }
  ], { maxTokens: 16, temperature: 0.2 });

  assert.equal(calls.length, 1);
  const { url, init } = calls[0];
  assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['x-goog-api-key'], 'test-gemini-key-do-not-log');
  assert.equal(init.headers.authorization, undefined);

  const body = JSON.parse(init.body);
  assert.deepEqual(body.systemInstruction.parts, [{ text: 'be brief' }]);
  assert.deepEqual(body.contents, [{ role: 'user', parts: [{ text: 'ping' }] }]);
  assert.deepEqual(body.generationConfig, { temperature: 0.2, maxOutputTokens: 16 });

  assert.equal(response.provider, 'gemini');
  assert.equal(response.choices[0].message.content, 'pong');
  assert.equal(response.choices[0].finish_reason, 'stop');
  assert.deepEqual(response.usage, { prompt_tokens: 7, completion_tokens: 1, total_tokens: 8 });
});

await test('gemini native: assistant turns become model role, empty generationConfig', async () => {
  stubFetch(() => json(GEMINI_OK));
  await llm.chat([
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: [{ text: 'hello' }] },
    { role: 'user', content: 'bye' }
  ]);
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body.contents.map(item => item.role), ['user', 'model', 'user']);
  assert.deepEqual(body.generationConfig, {});
  assert.equal(body.systemInstruction, undefined);
});

await test('gemini openai transport: gateway URL and bearer auth', async () => {
  resetEnv({ GEMINI_TRANSPORT: 'openai', GEMINI_BASE_URL: 'https://gw.example/v1beta' });
  stubFetch(() => json({ choices: [{ index: 0, message: { role: 'assistant', content: 'pong' }, finish_reason: 'stop' }], model: 'gemini-test' }));
  const response = await llm.chat([{ role: 'user', content: 'ping' }], { maxTokens: 16 });
  assert.equal(calls[0].url, 'https://gw.example/v1beta/openai/chat/completions');
  assert.equal(calls[0].init.headers.authorization, 'Bearer test-gemini-key-do-not-log');
  assert.equal(JSON.parse(calls[0].init.body).max_tokens, 16);
  assert.equal(response.provider, 'gemini');
  assert.equal(response.transport, 'openai');
  assert.equal(response.choices[0].message.content, 'pong');
});

await test('gemini: /models listing strips the models/ prefix', async () => {
  resetEnv();
  stubFetch(() => json({ models: [{ name: 'models/gemini-test' }, { name: 'models/gemini-other' }] }));
  const ids = await llm.models();
  assert.deepEqual(ids, ['gemini-test', 'gemini-other']);
  assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=100');
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'test-gemini-key-do-not-log');
});

await test('gemini: location block becomes an actionable error without the key', async () => {
  resetEnv();
  stubFetch(() => ({
    status: 400,
    statusText: 'Bad Request',
    body: { error: { code: 400, message: 'User location is not supported for the API use.', status: 'FAILED_PRECONDITION' } }
  }));
  await assert.rejects(
    () => llm.chat([{ role: 'user', content: 'ping' }]),
    error => {
      assert.match(error.message, /location is not supported/);
      assert.match(error.message, /network location/);
      assert.ok(!error.message.includes('test-gemini-key-do-not-log'), 'key leaked into error');
      return true;
    }
  );
});

await test('gemini: retired model error suggests --models', async () => {
  resetEnv();
  stubFetch(() => ({
    status: 404,
    statusText: 'Not Found',
    body: { error: { message: 'This model models/gemini-test is no longer available to new users.' } }
  }));
  await assert.rejects(
    () => llm.chat([{ role: 'user', content: 'ping' }]),
    error => {
      assert.match(error.message, /no longer available/);
      assert.match(error.message, /--models/);
      return true;
    }
  );
});

await test('deepseek: default base, bearer auth, OpenAI-shaped reply', async () => {
  resetEnv({ LLM_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'sk-test-deepseek', DEEPSEEK_MODEL: 'deepseek-flash' });
  stubFetch(() => json({ model: 'deepseek-flash', choices: [{ index: 0, message: { role: 'assistant', content: 'pong' }, finish_reason: 'stop' }] }));
  const response = await llm.chat([{ role: 'user', content: 'ping' }], { temperature: 0.3, maxTokens: 32 });
  assert.equal(calls[0].url, 'https://api.deepseek.com/chat/completions');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.authorization, 'Bearer sk-test-deepseek');
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body.messages, [{ role: 'user', content: 'ping' }]);
  assert.equal(body.model, 'deepseek-flash');
  assert.equal(body.temperature, 0.3);
  assert.equal(body.max_tokens, 32);
  assert.equal(response.choices[0].message.content, 'pong');
});

await test('deepseek: default model, /v1 base and full chat URL', async () => {
  resetEnv({ LLM_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'sk-test-deepseek' });
  stubFetch(() => json({ choices: [{ index: 0, message: { role: 'assistant', content: 'pong' } }] }));
  await llm.chat([{ role: 'user', content: 'ping' }]);
  assert.equal(calls[0].url, 'https://api.deepseek.com/chat/completions');
  assert.equal(JSON.parse(calls[0].init.body).model, 'deepseek-chat');

  resetEnv({ LLM_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'sk-test-deepseek', DEEPSEEK_BASE_URL: 'https://gw.example/v1' });
  stubFetch(() => json({ choices: [{ index: 0, message: { role: 'assistant', content: 'pong' } }] }));
  await llm.chat([{ role: 'user', content: 'ping' }]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://gw.example/v1/chat/completions');

  resetEnv({ LLM_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'sk-test-deepseek', DEEPSEEK_BASE_URL: 'https://gw.example/v1/chat/completions' });
  stubFetch(() => json({ choices: [{ index: 0, message: { role: 'assistant', content: 'pong' } }] }));
  await llm.chat([{ role: 'user', content: 'ping' }]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://gw.example/v1/chat/completions');
});

await test('deepseek: /models listing and missing key error', async () => {
  resetEnv({ LLM_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'sk-test-deepseek' });
  stubFetch(() => json({ data: [{ id: 'deepseek-flash' }, { id: 'deepseek-v4-pro' }] }));
  assert.deepEqual(await llm.models(), ['deepseek-flash', 'deepseek-v4-pro']);
  assert.equal(calls[0].url, 'https://api.deepseek.com/models');
  assert.equal(calls[0].init.headers.authorization, 'Bearer sk-test-deepseek');

  resetEnv({ LLM_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: '' });
  await assert.rejects(
    () => llm.chat([{ role: 'user', content: 'ping' }]),
    error => {
      assert.match(error.message, /DEEPSEEK_API_KEY missing/);
      assert.ok(!error.message.includes('sk-test-deepseek'));
      return true;
    }
  );
  assert.equal(llm.configured('deepseek'), false);
});

await test('litellm: unchanged OpenAI-compatible path', async () => {
  resetEnv({
    LLM_PROVIDER: 'litellm',
    LITELLM_BASE_URL: 'https://proxy.example/v1',
    LITELLM_API_KEY: 'sk-test-litellm',
    LITELLM_MODEL: 'model-test'
  });
  stubFetch(() => json({ choices: [{ index: 0, message: { role: 'assistant', content: 'pong' } }], model: 'model-test' }));
  const response = await llm.chat([{ role: 'user', content: 'ping' }]);
  assert.equal(calls[0].url, 'https://proxy.example/v1/chat/completions');
  assert.equal(calls[0].init.headers.authorization, 'Bearer sk-test-litellm');
  assert.equal(JSON.parse(calls[0].init.body).model, 'model-test');
  assert.equal(response.choices[0].message.content, 'pong');
});

await test('provider selection: forced, then deepseek, then gemini, then litellm', async () => {
  resetEnv({ LLM_PROVIDER: 'litellm' });
  assert.equal(llm.activeProvider(), 'litellm');
  resetEnv({ DEEPSEEK_API_KEY: 'sk-test-deepseek' });
  assert.equal(llm.activeProvider(), 'deepseek');
  resetEnv();
  assert.equal(llm.activeProvider(), 'gemini');
  resetEnv({ GEMINI_API_KEY: '' });
  assert.equal(llm.activeProvider(), 'litellm');
  resetEnv({ LLM_PROVIDER: 'nope' });
  assert.throws(() => llm.activeProvider(), /Unknown LLM_PROVIDER/);
});

await test('proxy: LLM_PROXY wins over HTTPS_PROXY, both optional', async () => {
  resetEnv();
  assert.equal(llm.proxyUrl(), '');
  resetEnv({ HTTPS_PROXY: 'http://env-proxy:8080' });
  assert.equal(llm.proxyUrl(), 'http://env-proxy:8080');
  resetEnv({ HTTPS_PROXY: 'http://env-proxy:8080', LLM_PROXY: 'http://llm-proxy:7897' });
  assert.equal(llm.proxyUrl(), 'http://llm-proxy:7897');
});

await test('missing key fails with a clear message and never echoes a value', async () => {
  resetEnv({ LLM_PROVIDER: 'gemini', GEMINI_API_KEY: '' });
  await assert.rejects(
    () => llm.chat([{ role: 'user', content: 'ping' }]),
    error => {
      assert.match(error.message, /GEMINI_API_KEY missing/);
      assert.ok(!error.message.includes('test-gemini-key-do-not-log'));
      return true;
    }
  );
  assert.equal(llm.configured('gemini'), false);
});

await test('unknown provider is rejected before any request', async () => {
  resetEnv();
  stubFetch(() => json(GEMINI_OK));
  await assert.rejects(() => llm.chat([{ role: 'user', content: 'ping' }], { provider: 'openai' }), /Unknown provider/);
  assert.equal(calls.length, 0);
});

globalThis.fetch = realFetch;

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
