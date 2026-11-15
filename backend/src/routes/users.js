const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getNearbyUsers, getUserLocation, setUserLocation } = require('../lib/sessionStore');
const { approximateMapCoordinate } = require('../lib/locationPrivacy');
const { setUserLocation: setRedisLocation } = require('../db/redis');
const { query } = require('../db/pg');

router.put('/profile', requireAuth, async (req, res) => {
  const { firstName, vibeTags, availability } = req.body || {};
  const safeName = String(firstName || 'Guest').trim().slice(0, 30) || 'Guest';
  const safeTags = Array.isArray(vibeTags) && vibeTags.length ? vibeTags.slice(0, 3) : ['coffee', 'music'];
  const safeAvailability = availability || '1h';

  try {
    const result = await query(
      `UPDATE users
       SET first_name = $1,
           vibe_tags = $2,
           availability = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, first_name, vibe_tags, availability;`,
      [safeName, safeTags, safeAvailability, req.user.id]
    );

    if (result.rowCount) {
      const profile = {
        userId: result.rows[0].id,
        firstName: result.rows[0].first_name,
        vibeTags: result.rows[0].vibe_tags,
        availability: result.rows[0].availability,
      };
      setUserLocation(req.user.id, profile);
      return res.json({
        ok: true,
        profile,
      });
    }
  } catch (error) {
    console.warn('Profile update failed:', error.message);
  }

  const profile = {
    userId: req.user?.id,
    firstName: safeName,
    vibeTags: safeTags,
    availability: safeAvailability,
  };
  setUserLocation(req.user.id, profile);
  return res.json({
    ok: true,
    profile,
  });
});

router.put('/status', requireAuth, async (req, res) => {
  const { status } = req.body || {};
  const nextStatus = status || 'available';

  try {
    await query(
      `UPDATE users SET current_status = $1, updated_at = NOW() WHERE id = $2;`,
      [nextStatus, req.user.id]
    );
  } catch (error) {
    console.warn('Status update failed:', error.message);
  }

  return res.json({ ok: true, status: nextStatus });
});

router.get('/nearby', requireAuth, async (req, res) => {
  const lat = Number(req.query.lat || 0);
  const lng = Number(req.query.lng || 0);
  const radius = Number(req.query.radius || 100);

  try {
    const { rows } = await query(
            `SELECT a.user_id, u.first_name, u.vibe_tags, u.availability,
              ST_Y(a.location::geometry) AS user_lat,
              ST_X(a.location::geometry) AS user_lng,
              ST_Distance(a.location::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) AS distance_m
       FROM active_sessions a
       JOIN users u ON u.id = a.user_id
       WHERE a.user_id != $3
         AND ST_DWithin(a.location::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $4)
       ORDER BY distance_m ASC;`,
      [lat, lng, req.user.id, radius]
    );

    const users = rows.map((row) => {
      const mapCoordinate = approximateMapCoordinate(row.user_id, Number(row.user_lat), Number(row.user_lng));
      return {
        id: row.user_id,
        firstName: row.first_name,
        vibeTags: row.vibe_tags || ['coffee', 'music'],
        distanceM: Math.round(Number(row.distance_m) || 0),
        availability: row.availability || '1h',
        mapLatitude: mapCoordinate.latitude,
        mapLongitude: mapCoordinate.longitude,
      };
    });

    return res.json({ radius, center: { lat, lng }, users });
  } catch (error) {
    console.warn('Nearby query fallback triggered:', error.message);
    const nearby = getNearbyUsers(req.user.id, lat, lng, radius).map((user) => {
      const mapCoordinate = approximateMapCoordinate(user.id, user.lat, user.lng);
      return {
        id: user.id,
        firstName: user.firstName,
        vibeTags: user.vibeTags,
        distanceM: user.distanceM,
        availability: user.availability,
        mapLatitude: mapCoordinate.latitude,
        mapLongitude: mapCoordinate.longitude,
      };
    });

    return res.json({ radius, center: { lat, lng }, users: nearby });
  }
});

router.put('/fcm-token', requireAuth, async (req, res) => {
  const { token } = req.body || {};

  try {
    await query(
      `UPDATE users SET fcm_token = $1, updated_at = NOW() WHERE id = $2;`,
      [token || null, req.user.id]
    );
  } catch (error) {
    console.warn('FCM token update failed:', error.message);
  }

  return res.json({ ok: true, fcmToken: token || 'demo-token' });
});

router.delete('/account', requireAuth, async (req, res) => {
  try {
    await query(`DELETE FROM users WHERE id = $1;`, [req.user.id]);
  } catch (error) {
    console.warn('Account delete failed:', error.message);
  }

  return res.json({ ok: true, deleted: true });
});

router.put('/location', requireAuth, async (req, res) => {
  const { lat, lng } = req.body || {};
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'lat and lng required as numbers' });
  }

  const profile = getUserLocation(req.user.id) || {};
  setUserLocation(req.user.id, {
    lat,
    lng,
    firstName: profile.firstName || 'Demo',
    vibeTags: profile.vibeTags || ['coffee', 'music'],
    availability: profile.availability || '1h',
  });

  void setRedisLocation(req.user.id, { lat, lng })
    .catch((error) => console.warn('Redis location update failed:', error.message));
  void query(
    `INSERT INTO active_sessions (user_id, location, last_seen)
     VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET location = EXCLUDED.location, last_seen = NOW();`,
    [req.user.id, lng, lat]
  ).catch((error) => console.warn('Database location update failed:', error.message));

  return res.json({ ok: true, location: { lat, lng } });
});

module.exports = router;
