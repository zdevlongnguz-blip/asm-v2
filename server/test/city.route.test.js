import test from 'node:test';
import assert from 'node:assert/strict';
import cityData from '../data/cities.json' with { type: 'json' };
import app from '../src/app.js';

test('GET /api/city/list returns destinations from cities.json', async () => {
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/city/list`);
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(result, cityData.destinations);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test('GET /api/city/:id returns a destination or 404', async () => {
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const detailResponse = await fetch(`http://127.0.0.1:${port}/api/city/thanh-hoa`);
    const destination = await detailResponse.json();
    const missingResponse = await fetch(`http://127.0.0.1:${port}/api/city/missing-place`);
    const missing = await missingResponse.json();

    assert.equal(detailResponse.status, 200);
    assert.deepEqual(destination, cityData.destinations.find((item) => item.id === 'thanh-hoa'));
    assert.equal(missingResponse.status, 404);
    assert.equal(missing.error, 'Không tìm thấy điểm đến');
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});