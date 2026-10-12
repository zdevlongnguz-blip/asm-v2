import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

test('POST /api/ai validates prompt and returns a stable fallback without Gemini', async () => {
  const previousApiKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    const url = `http://localhost:${address.port}/api/ai`;

    const invalidResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: '   ' }),
    });
    assert.equal(invalidResponse.status, 400);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Xin chào' }),
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(typeof result.answer, 'string');
    assert.deepEqual(result.usedTools, []);
    assert.deepEqual(result.toolResults, []);
    assert.deepEqual(result.toolErrors, []);

    const streamResponse = await fetch(`${url}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Xin chào' }),
    });
    const streamBody = await streamResponse.text();

    assert.equal(streamResponse.status, 200);
    assert.match(streamResponse.headers.get('content-type'), /text\/event-stream/);
    assert.ok(streamBody.indexOf('event: status') < streamBody.indexOf('event: error'));
    assert.ok(streamBody.indexOf('event: error') < streamBody.indexOf('event: done'));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (previousApiKey) {
      process.env.GEMINI_API_KEY = previousApiKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  }
});