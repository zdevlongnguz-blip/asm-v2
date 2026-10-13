import test from 'node:test';
import assert from 'node:assert/strict';

process.env.CLIENT_ORIGINS = 'https://app.example.com, https://preview.example.com/';
const { default: app } = await import('../src/app.js');

test('CORS allows configured origins and handles preflight requests', async () => {
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const allowedResponse = await fetch(`http://127.0.0.1:${port}/api/health`, {
      headers: { Origin: 'https://app.example.com' },
    });
    const deniedResponse = await fetch(`http://127.0.0.1:${port}/api/health`, {
      headers: { Origin: 'https://unlisted.example.com' },
    });
    const preflightResponse = await fetch(`http://127.0.0.1:${port}/api/ai/stream`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://preview.example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });

    assert.equal(allowedResponse.headers.get('access-control-allow-origin'), 'https://app.example.com');
    assert.equal(deniedResponse.headers.get('access-control-allow-origin'), null);
    assert.equal(preflightResponse.headers.get('access-control-allow-origin'), 'https://preview.example.com');
    assert.match(preflightResponse.headers.get('access-control-allow-methods'), /POST/);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});