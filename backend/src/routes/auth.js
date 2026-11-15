const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { admin } = require('../middleware/auth');
const { query } = require('../db/pg');
const { getJwtSecret } = require('../lib/jwtSecret');

const router = express.Router();

function createAppToken(uid) {
  return jwt.sign({ uid, iat: Date.now() }, getJwtSecret(), { expiresIn: '7d' });
}

async function ensureUserRecord({ phoneNumber, firebaseUid }) {
  const seedPhone = phoneNumber || firebaseUid || 'demo-user';
  const phoneHash = await bcrypt.hash(seedPhone, 10);
  const fallbackName = 'Demo';
  const defaultTags = ['coffee', 'music', 'night'];

  try {
    const result = await query(
      `INSERT INTO users (phone_hash, firebase_uid, first_name, vibe_tags, availability, current_status)
       VALUES ($1, $2, $3, $4, $5, 'available')
       ON CONFLICT (firebase_uid)
       DO UPDATE SET
         phone_hash = EXCLUDED.phone_hash,
         first_name = COALESCE(users.first_name, EXCLUDED.first_name),
         vibe_tags = EXCLUDED.vibe_tags,
         availability = EXCLUDED.availability,
         updated_at = NOW()
       RETURNING id, first_name, vibe_tags, availability;`,
      [phoneHash, firebaseUid || seedPhone, fallbackName, defaultTags, '1h']
    );

    return result.rows[0];
  } catch (error) {
    return {
      id: firebaseUid || seedPhone,
      first_name: fallbackName,
      vibe_tags: defaultTags,
      availability: '1h',
    };
  }
}

router.post('/verify', async (req, res) => {
  const { firebaseToken, devCode, phoneNumber } = req.body || {};

  if (!firebaseToken && !phoneNumber) {
    return res.status(400).json({ error: 'firebaseToken or phoneNumber required' });
  }

  try {
    let firebaseUid = null;

    if (admin?.apps?.length) {
      if (!firebaseToken) {
        return res.status(401).json({ error: 'Firebase ID token required' });
      }
      const decoded = await admin.auth().verifyIdToken(firebaseToken);
      firebaseUid = decoded.uid;
    } else if (process.env.NODE_ENV === 'production' || devCode !== '123456') {
      return res.status(401).json({ error: 'Invalid verification code' });
    }

    const user = await ensureUserRecord({
      phoneNumber: phoneNumber || null,
      firebaseUid: firebaseUid || phoneNumber || 'demo-user',
    });

    const token = createAppToken(user.id);

    return res.json({
      token,
      user: {
        id: user.id,
        firstName: user.first_name || 'Demo',
        vibeTags: user.vibe_tags || ['coffee', 'night', 'music'],
        availability: user.availability || '1h',
      },
    });
  } catch (error) {
    return res.status(401).json({ error: 'Unable to verify identity', detail: error.message });
  }
});

router.get('/vibe-tags', (req, res) => {
  res.json({
    tags: ['coffee', 'music', 'reading', 'running', 'night', 'travel', 'city', 'outdoors'],
  });
});

module.exports = router;
