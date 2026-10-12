import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_FORECAST_DAYS,
  getCurrentWeatherByCityName,
  getWeatherForecastByCityName,
} from '../src/services/weather.js';

test('getCurrentWeatherByCityName returns current weather for a city', async () => {
  const result = await getCurrentWeatherByCityName('Thanh Hóa');

  assert.ok(result);
  assert.ok(typeof result.temperature === 'number');
  assert.ok(typeof result.cityName === 'string');
});

test('getWeatherForecastByCityName returns daily forecast array', async () => {
  const result = await getWeatherForecastByCityName('Hà Nội');

  assert.ok(result);
  assert.ok(Array.isArray(result.days));
  assert.equal(result.days.length, DEFAULT_FORECAST_DAYS);
  assert.ok(typeof result.days[0].date === 'string');
  assert.ok(result.days.every((day) => typeof day.icon === 'string' && day.icon.startsWith('bi bi-')));
});

test('getWeatherForecastByCityName respects an explicit day count', async () => {
  const result = await getWeatherForecastByCityName('Hà Nội', 3);

  assert.ok(result);
  assert.equal(result.days.length, 3);
});
