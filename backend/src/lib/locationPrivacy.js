const { createHmac } = require('crypto');
const { haversineDistanceM } = require('./geo');

const BLUR_WINDOW_MS = 15 * 60 * 1000;
const MIN_BLUR_METERS = 30;
const MAX_BLUR_METERS = 65;

function approximateMapCoordinate(userId, lat, lng, timestamp = Date.now()) {
  const window = Math.floor(timestamp / BLUR_WINDOW_MS);
  const key = process.env.JWT_SECRET || 'moongram-local-location-blur';
  const digest = createHmac('sha256', key).update(`${userId}:${window}`).digest();
  const angle = (digest.readUInt32BE(0) / 0xffffffff) * Math.PI * 2;
  const radius = MIN_BLUR_METERS + (digest.readUInt32BE(4) / 0xffffffff) * (MAX_BLUR_METERS - MIN_BLUR_METERS);
  const northMeters = Math.cos(angle) * radius;
  const eastMeters = Math.sin(angle) * radius;
  const metersPerLongitudeDegree = 111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180));

  return {
    latitude: lat + northMeters / 111320,
    longitude: lng + eastMeters / metersPerLongitudeDegree,
  };
}

module.exports = { approximateMapCoordinate, haversineDistanceM };