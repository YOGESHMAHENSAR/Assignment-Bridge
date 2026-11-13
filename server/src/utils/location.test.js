import assert from 'node:assert/strict';
import test from 'node:test';
import { isWithinTaskRadius, normalizeLocation, taskRadiusQuery } from './location.js';

const location = (latitude, longitude, name = 'Campus') =>
  normalizeLocation({ name, latitude, longitude });

test('normalizes campus input into a GeoJSON point', () => {
  assert.deepEqual(location('12.97', '77.59'), {
    name: 'Campus',
    point: { type: 'Point', coordinates: [77.59, 12.97] },
  });
  assert.throws(() => normalizeLocation({ name: 'Campus', latitude: '', longitude: '77.59' }));
  assert.throws(() => normalizeLocation({ name: 'Campus', latitude: ' ', longitude: '77.59' }));
  assert.throws(() => normalizeLocation({ name: 'Campus', latitude: '91', longitude: '77.59' }));
});

test('uses the 2 km radius consistently for nearby matching', () => {
  const campus = location(0, 0);
  assert.equal(isWithinTaskRadius(campus, location(0, 0.017)), true);
  assert.equal(isWithinTaskRadius(campus, location(0, 0.018)), false);
  assert.deepEqual(taskRadiusQuery(campus), {
    'workLocation.point': {
      $geoWithin: { $centerSphere: [[0, 0], 2000 / 6378100] },
    },
  });
  assert.throws(() => taskRadiusQuery(undefined), /campus location/);
});
