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

test('GET /api/weather/by-name/:city returns current weather and seven forecast days', async () => {
  mock.method(axios, 'get', async (url, config) => {
    assert.equal(config.params.forecast_days, 7);
    return {
      data: {
        current: {
          temperature_2m: 27,
          apparent_temperature: 29,
          relative_humidity_2m: 70,
          weather_code: 0,
          wind_speed_10m: 8,
          precipitation: 0,
        },
        daily: {
          time: Array.from({ length: 7 }, (_, index) => `2026-10-${13 + index}`),
          weather_code: Array(7).fill(0),
          temperature_2m_max: Array(7).fill(30),
          temperature_2m_min: Array(7).fill(22),
        },
      },
    };
  });

  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/weather/by-name/Thanh%20Hóa`);
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.cityName, 'Thanh Hóa');
    assert.equal(result.current.temperature, 27);
    assert.equal(result.days.length, 7);
  } finally {
    mock.restoreAll();
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test('GET /api/weather/by-coordinates uses supplied coordinates and defaults to seven days', async () => {
  mock.method(axios, 'get', async (url, config) => {
    assert.equal(config.params.latitude, 19.8067);
    assert.equal(config.params.longitude, 105.7852);
    assert.equal(config.params.forecast_days, 7);
    return {
      data: {
        current: { temperature_2m: 27, weather_code: 0 },
        daily: {
          time: Array.from({ length: 7 }, (_, index) => `2026-10-${13 + index}`),
          weather_code: Array(7).fill(0),
          temperature_2m_max: Array(7).fill(30),
          temperature_2m_min: Array(7).fill(22),
        },
      },
    };
  });

  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/weather/by-coordinates?lat=19.8067&lon=105.7852`);
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.latitude, 19.8067);
    assert.equal(result.longitude, 105.7852);
    assert.equal(result.days.length, 7);
  } finally {
    mock.restoreAll();
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});