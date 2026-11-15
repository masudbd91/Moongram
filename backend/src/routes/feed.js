const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  createStatusUpdate,
  deleteStatusUpdate,
  getNearbyStatusUpdates,
  getUserLocation,
} = require('../lib/sessionStore');
const { query } = require('../db/pg');

const router = express.Router();
const DEFAULT_RADIUS_M = 100;
const MAX_RADIUS_M = 1000;
const MAX_STATUS_LENGTH = 280;

router.get('/', requireAuth, async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const requestedRadius = Number(req.query.radius || DEFAULT_RADIUS_M);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Valid latitude and longitude are required' });
  }

  const radius = Number.isFinite(requestedRadius)
    ? Math.max(0, Math.min(requestedRadius, MAX_RADIUS_M))
    : DEFAULT_RADIUS_M;

  try {
    const { rows } = await query(
      `SELECT s.id, s.user_id, s.text, s.created_at, s.expires_at,
              u.first_name, u.vibe_tags, u.availability,
              ST_Distance(a.location::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) AS distance_m
       FROM status_updates s
       JOIN users u ON u.id = s.user_id
       JOIN active_sessions a ON a.user_id = s.user_id
       WHERE s.expires_at > NOW()
         AND a.last_seen > NOW() - INTERVAL '30 seconds'
         AND ST_DWithin(a.location::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
       ORDER BY s.created_at DESC
       LIMIT 50;`,
      [lat, lng, radius]
    );

    return res.json({
      radius,
      statuses: rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        firstName: row.first_name,
        vibeTags: row.vibe_tags || [],
        availability: row.availability || '1h',
        text: row.text,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        distanceM: Math.round(Number(row.distance_m) || 0),
      })),
    });
  } catch (error) {
    const statuses = getNearbyStatusUpdates(req.user.id, lat, lng, radius);
    return res.json({ radius, statuses });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) return res.status(400).json({ error: 'Status text is required' });
  if (text.length > MAX_STATUS_LENGTH) {
    return res.status(400).json({ error: `Status must be ${MAX_STATUS_LENGTH} characters or fewer` });
  }

  try {
    const result = await query(
      `INSERT INTO status_updates (user_id, text)
       VALUES ($1, $2)
       RETURNING id, user_id, text, created_at, expires_at;`,
      [req.user.id, text]
    );

    if (result.rowCount) {
      const user = getUserLocation(req.user.id) || {};
      return res.status(201).json({
        status: {
          ...result.rows[0],
          userId: result.rows[0].user_id,
          firstName: user.firstName || 'Guest',
          vibeTags: user.vibeTags || [],
          availability: user.availability || '1h',
          distanceM: 0,
        },
      });
    }
  } catch (error) {
    console.warn('Status post fallback triggered:', error.message);
  }

  const status = createStatusUpdate(req.user.id, text);
  return res.status(201).json({ status: { ...status, distanceM: 0 } });
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM status_updates WHERE id = $1 AND user_id = $2 RETURNING id;`,
      [req.params.id, req.user.id]
    );

    if (result.rowCount) return res.json({ ok: true, id: result.rows[0].id });
  } catch (error) {
    console.warn('Status delete fallback triggered:', error.message);
  }

  if (deleteStatusUpdate(req.user.id, req.params.id)) {
    return res.json({ ok: true, id: req.params.id });
  }
  return res.status(404).json({ error: 'Status not found or not yours to delete' });
});

module.exports = router;