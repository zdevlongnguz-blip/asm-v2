import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import app from '../src/app.js';

test('GET /api/weather/current/:city returns current weather', async () => {
  mock.method(axios, 'get', async () => ({
    data: {
      current: {
        temperature_2m: 27,
        apparent_temperature: 29,
        relative_humidity_2m: 70,
        weather_code: 0,
        wind_speed_10m: 8,
        precipitation: 0,
      },
      daily: {},
    },
  }));

  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/weather/current/Thanh%20Hóa`);
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.cityName, 'Thanh Hóa');
    assert.equal(result.temperature, 27);
    assert.equal(typeof result.condition, 'string');
    assert.equal(result.humidity, 70);
  } finally {
    mock.restoreAll();
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});