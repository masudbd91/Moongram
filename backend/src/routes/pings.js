const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { createPing, getPing, respondToPing } = require('../lib/sessionStore');
const { query } = require('../db/pg');

router.post('/', requireAuth, async (req, res) => {
  const { targetUserId } = req.body || {};

  if (!targetUserId) {
    return res.status(400).json({ error: 'targetUserId required' });
  }

  try {
    const result = await query(
      `INSERT INTO pings (sender_id, receiver_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING id, sender_id, receiver_id, status, created_at;`,
      [req.user.id, targetUserId]
    );

    const ping = result.rows[0];
    const io = req.app.get('io');
    io.to(`user:${targetUserId}`).emit('ping:incoming', {
      pingId: ping.id,
      senderId: req.user.id,
      senderName: 'Demo',
      senderTags: ['coffee', 'music'],
    });

    return res.status(202).json({
      ok: true,
      pingId: ping.id,
      targetUserId,
      status: ping.status,
    });
  } catch (error) {
    console.warn('Ping insert failed:', error.message);
    const ping = createPing(req.user.id, targetUserId);
    const io = req.app.get('io');
    io.to(`user:${targetUserId}`).emit('ping:incoming', {
      pingId: ping.id,
      senderId: req.user.id,
      senderName: 'Demo',
      senderTags: ['coffee', 'music'],
    });

    return res.status(202).json({
      ok: true,
      pingId: ping.id,
      targetUserId,
      status: 'pending',
    });
  }
});

router.post('/:id/respond', requireAuth, async (req, res) => {
  const { accepted } = req.body || {};
  const acceptedFlag = Boolean(accepted);

  try {
    const result = await query(
      `SELECT * FROM pings WHERE id = $1 AND receiver_id = $2;`,
      [req.params.id, req.user.id]
    );
    const ping = result.rows[0];

    if (!ping) {
      return res.status(404).json({ error: 'Ping not found' });
    }

    await query(
      `UPDATE pings SET status = $1, responded_at = NOW() WHERE id = $2;`,
      [acceptedFlag ? 'accepted' : 'declined', ping.id]
    );

    let sessionId = null;
    if (acceptedFlag) {
      const sessionRow = await query(
        `INSERT INTO chat_sessions (ping_id, user_a, user_b, status)
         VALUES ($1, $2, $3, 'active')
         RETURNING id;`,
        [ping.id, ping.sender_id, ping.receiver_id]
      );
      sessionId = sessionRow.rows[0]?.id || null;
    }

    const io = req.app.get('io');
    io.to(`user:${ping.sender_id}`).emit('ping:accepted', {
      sessionId,
      partnerId: ping.receiver_id,
      partnerName: 'Demo',
    });

    return res.json({
      ok: true,
      pingId: ping.id,
      accepted: acceptedFlag,
      sessionId,
    });
  } catch (error) {
    console.warn('Ping respond failed:', error.message);
    const ping = getPing(req.params.id);
    if (!ping || ping.receiverId !== req.user.id) {
      return res.status(404).json({ error: 'Ping not found' });
    }

    const result = respondToPing(ping.id, acceptedFlag, req.user.id);
    if (!result) {
      return res.status(403).json({ error: 'You cannot respond to this ping' });
    }

    const io = req.app.get('io');
    io.to(`user:${ping.senderId}`).emit('ping:accepted', {
      sessionId: result.session?.id || null,
      partnerId: ping.receiverId,
      partnerName: 'Demo',
    });

    return res.json({
      ok: true,
      pingId: ping.id,
      accepted: acceptedFlag,
      sessionId: result.session?.id || null,
    });
  }
});

module.exports = router;
