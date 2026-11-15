const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../lib/jwtSecret');

function initializeFirebaseIfConfigured() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();

  if (!projectId || !privateKey || !clientEmail || !privateKey.includes('BEGIN PRIVATE KEY')) {
    return false;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        privateKey: privateKey.replace(/\\n/g, '\n'),
        clientEmail,
      }),
    });
    return true;
  } catch (error) {
    console.warn('Firebase initialization skipped:', error.message);
    return false;
  }
}

initializeFirebaseIfConfigured();

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    req.user = {
      id: payload.uid || payload.userId || 'demo-user',
      phone: payload.phone || null,
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { requireAuth, admin, initializeFirebaseIfConfigured };
