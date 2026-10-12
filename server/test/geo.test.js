import test from 'node:test';
import assert from 'node:assert/strict';

import { getCoordinatesByName } from '../src/services/geo.js';

test('getCoordinatesByName finds offline fallback for Ha Noi', async () => {
  const result = await getCoordinatesByName('Hà Nội');
  assert.ok(result);
  assert.equal(result.lat, 21.0285);
  assert.equal(result.lon, 105.8542);
});

test('getCoordinatesByName normalizes alias names', async () => {
  const result = await getCoordinatesByName('TP. Hồ Chí Minh');
  assert.ok(result);
  assert.equal(result.lat, 10.8231);
  assert.equal(result.lon, 106.6297);
});
