const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { once } = require('node:events');
const jwt = require('jsonwebtoken');

const {
  setUserLocation,
  createStatusUpdate,
  getNearbyStatusUpdates,
  createPing,
  respondToPing,
  getNearbyUsers,
} = require('../src/lib/sessionStore');
const { initializeFirebaseIfConfigured } = require('../src/middleware/auth');
const { approximateMapCoordinate, haversineDistanceM } = require('../src/lib/locationPrivacy');
const { haversineDistanceM: measureDistance } = require('../src/lib/geo');
const { getJwtSecret } = require('../src/lib/jwtSecret');

test('invalid Firebase placeholders are ignored instead of crashing startup', () => {
  process.env.FIREBASE_PROJECT_ID = 'your-project-id';
  process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n';
  process.env.FIREBASE_CLIENT_EMAIL = 'firebase-adminsdk@your-project.iam.gserviceaccount.com';

  assert.equal(initializeFirebaseIfConfigured(), false);
});

test('production refuses a missing or weak JWT secret', () => {
  const previousEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    JWT_SECRET: process.env.JWT_SECRET,
  };
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'nearby-dev-secret';
  assert.throws(getJwtSecret, /at least 32 characters/);
  process.env.JWT_SECRET = 'a'.repeat(40);
  assert.equal(getJwtSecret(), 'a'.repeat(40));

  for (const [key, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('local phone verification accepts the demo code and rejects other codes', async () => {
  const previousEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
  };
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://invalid:invalid@127.0.0.1:1/test';
  process.env.FIREBASE_PROJECT_ID = '';
  process.env.FIREBASE_PRIVATE_KEY = '';
  process.env.FIREBASE_CLIENT_EMAIL = '';

  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../src/routes/auth'));
  const server = app.listen(0);
  await once(server, 'listening');

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/auth/verify`;
    const validResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+15551234567', devCode: '123456' }),
    });
    const invalidResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+15551234567', devCode: '000000' }),
    });

    assert.equal(validResponse.status, 200);
    assert.equal(invalidResponse.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('accepting a ping creates an active session', () => {
  setUserLocation('user-a', { lat: 0, lng: 0, firstName: 'Alice', vibeTags: ['coffee'] });
  setUserLocation('user-b', { lat: 0.0001, lng: 0.0001, firstName: 'Bob', vibeTags: ['music'] });

  const ping = createPing('user-a', 'user-b');
  const result = respondToPing(ping.id, true, 'user-b');

  assert.equal(result.ping.status, 'accepted');
  assert.ok(result.session);
  assert.equal(result.session.userA, 'user-a');
  assert.equal(result.session.userB, 'user-b');
});

test('nearby users are returned when within radius', () => {
  setUserLocation('me', { lat: 0, lng: 0, firstName: 'Me', vibeTags: ['coffee'] });
  setUserLocation('near-1', { lat: 0.0005, lng: 0.0005, firstName: 'Near One', vibeTags: ['music'] });
  setUserLocation('far-1', { lat: 0.02, lng: 0.02, firstName: 'Far One', vibeTags: ['reading'] });

  const nearby = getNearbyUsers('me', 0, 0, 100);
  const ids = nearby.map((user) => user.id);

  assert.ok(ids.includes('near-1'));
  assert.ok(!ids.includes('far-1'));
});

test('map coordinates are blurred within a stable short-lived window', () => {
  const exact = { lat: 37.7749, lng: -122.4194 };
  const timestamp = 1_800_000_000_000;
  const first = approximateMapCoordinate('map-user', exact.lat, exact.lng, timestamp);
  const repeated = approximateMapCoordinate('map-user', exact.lat, exact.lng, timestamp + 60_000);
  const rotated = approximateMapCoordinate('map-user', exact.lat, exact.lng, timestamp + 16 * 60_000);
  const offset = haversineDistanceM(exact.lat, exact.lng, first.latitude, first.longitude);

  assert.ok(offset >= 29 && offset <= 66);
  assert.deepEqual(repeated, first);
  assert.notDeepEqual(rotated, first);
});

test('nearby API returns approximate map pins without exact coordinates', async () => {
  const readerId = `map-reader-${Date.now()}`;
  const nearbyId = `map-nearby-${Date.now()}`;
  const center = { lat: 37.7749, lng: -122.4194 };
  setUserLocation(readerId, { ...center, firstName: 'Reader' });
  setUserLocation(nearbyId, { lat: 37.775, lng: -122.4194, firstName: 'Nearby' });

  const app = express();
  app.use(express.json());
  app.use('/api/users', require('../src/routes/users'));
  const server = app.listen(0);
  await once(server, 'listening');

  try {
    const token = jwt.sign({ uid: readerId }, process.env.JWT_SECRET || 'dev-secret');
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/users/nearby?lat=${center.lat}&lng=${center.lng}&radius=500`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const body = await response.json();
    const person = body.users.find((user) => user.id === nearbyId);

    assert.equal(response.status, 200);
    assert.ok(person);
    assert.equal(typeof person.mapLatitude, 'number');
    assert.equal(typeof person.mapLongitude, 'number');
    assert.equal(Object.hasOwn(person, 'lat'), false);
    assert.equal(Object.hasOwn(person, 'lng'), false);
    assert.ok(measureDistance(37.775, -122.4194, person.mapLatitude, person.mapLongitude) <= 66);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('text status updates appear only within the nearby radius', () => {
  setUserLocation('status-author', {
    lat: 40,
    lng: -74,
    firstName: 'Rae',
    vibeTags: ['coffee'],
  });
  setUserLocation('status-reader', { lat: 40.0001, lng: -74 });
  setUserLocation('status-outsider', { lat: 40.01, lng: -74 });

  createStatusUpdate('status-author', 'Found a quiet coffee spot nearby.');

  const nearby = getNearbyStatusUpdates('status-reader', 40.0001, -74, 100);
  const outside = getNearbyStatusUpdates('status-outsider', 40.01, -74, 100);

  assert.equal(nearby.length, 1);
  assert.equal(nearby[0].firstName, 'Rae');
  assert.equal(nearby[0].text, 'Found a quiet coffee spot nearby.');
  assert.equal(outside.length, 0);
});

test('feed API creates and returns a nearby text status', async () => {
  const userId = 'feed-status-user';
  setUserLocation(userId, {
    lat: 37.7749,
    lng: -122.4194,
    firstName: 'Sam',
    vibeTags: ['music'],
    availability: '1h',
  });

  const app = express();
  app.use(express.json());
  app.use('/api/feed', require('../src/routes/feed'));
  const server = app.listen(0);
  await once(server, 'listening');

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/feed`;
    const headers = {
      Authorization: `Bearer ${jwt.sign({ uid: userId }, process.env.JWT_SECRET || 'dev-secret')}`,
      'Content-Type': 'application/json',
    };
    const createResponse = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: 'Listening to a new album nearby.' }),
    });
    const created = await createResponse.json();
    const feedResponse = await fetch(`${baseUrl}?lat=37.7749&lng=-122.4194&radius=100`, { headers });
    const feed = await feedResponse.json();

    assert.equal(createResponse.status, 201);
    assert.equal(created.status.firstName, 'Sam');
    assert.equal(feedResponse.status, 200);
    assert.ok(feed.statuses.some((status) => status.text === 'Listening to a new album nearby.'));

    const otherHeaders = {
      Authorization: `Bearer ${jwt.sign({ uid: 'another-feed-user' }, process.env.JWT_SECRET || 'dev-secret')}`,
    };
    const otherDeleteResponse = await fetch(`${baseUrl}/${created.status.id}`, {
      method: 'DELETE',
      headers: otherHeaders,
    });
    const deleteResponse = await fetch(`${baseUrl}/${created.status.id}`, {
      method: 'DELETE',
      headers,
    });
    const feedAfterDeleteResponse = await fetch(`${baseUrl}?lat=37.7749&lng=-122.4194&radius=100`, { headers });
    const feedAfterDelete = await feedAfterDeleteResponse.json();

    assert.equal(otherDeleteResponse.status, 404);
    assert.equal(deleteResponse.status, 200);
    assert.ok(!feedAfterDelete.statuses.some((status) => status.id === created.status.id));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
