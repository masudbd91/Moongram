const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.post('/block', requireAuth, (req, res) => {
  const { targetUserId } = req.body || {};
  if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });
  res.json({ ok: true, blockedUserId: targetUserId });
});

router.post('/report', requireAuth, (req, res) => {
  const { targetUserId, reason, sessionId } = req.body || {};
  if (!targetUserId || !reason) {
    return res.status(400).json({ error: 'targetUserId and reason are required' });
  }
  res.json({ ok: true, reportedUserId: targetUserId, sessionId: sessionId || null });
});

module.exports = router;
