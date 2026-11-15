const db = require('../db/pg');
const { setExtendVote, getExtendVotes, removeActiveChat } = require('../db/redis');
const { endChatSession } = require('./index');

// Perspective API moderation (optional — gracefully degrades if key missing)
async function moderateText(text) {
  const key = process.env.PERSPECTIVE_API_KEY;
  if (!key) return { flagged: false };
  try {
    const res = await fetch(
      `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: { text },
          requestedAttributes: { TOXICITY: {} },
        }),
      }
    );
    const data = await res.json();
    const score = data.attributeScores?.TOXICITY?.summaryScore?.value ?? 0;
    return { flagged: score > 0.85, score };
  } catch {
    return { flagged: false };
  }
}

module.exports = function registerChatHandlers(io, socket) {
  const userId = socket.user.id;

  /**
   * Join a chat room after ping is accepted.
   * Client must call this once with the sessionId returned from ping accept.
   */
  socket.on('chat:join', async ({ sessionId }) => {
    try {
      const { rows } = await db.query(
        `SELECT * FROM chat_sessions
         WHERE id = $1 AND status = 'active'
           AND (user_a = $2 OR user_b = $2)`,
        [sessionId, userId]
      );
      if (!rows.length) {
        return socket.emit('chat:error', { message: 'Session not found or not active' });
      }

      socket.join(`chat:${sessionId}`);
      socket.currentSessionId = sessionId;

      // Send last 50 messages (if reconnecting mid-session)
      const { rows: msgs } = await db.query(
        `SELECT sender_id, text, sent_at FROM messages
         WHERE session_id = $1 ORDER BY sent_at ASC LIMIT 50`,
        [sessionId]
      );
      socket.emit('chat:history', { messages: msgs });
    } catch (err) {
      console.error('chat:join error:', err.message);
    }
  });

  /**
   * Send a message within an active session.
   */
  socket.on('chat:message', async ({ sessionId, text }) => {
    if (!text?.trim() || text.length > 1000) return;

    try {
      // Verify session is active and user belongs to it
      const { rows } = await db.query(
        `SELECT user_a, user_b FROM chat_sessions
         WHERE id = $1 AND status = 'active'
           AND (user_a = $2 OR user_b = $2)`,
        [sessionId, userId]
      );
      if (!rows.length) return;

      // Moderate content
      const { flagged } = await moderateText(text.trim());

      // Persist message
      const { rows: msgRows } = await db.query(
        `INSERT INTO messages (session_id, sender_id, text, is_flagged)
         VALUES ($1, $2, $3, $4)
         RETURNING id, sent_at`,
        [sessionId, userId, text.trim(), flagged]
      );

      if (flagged) {
        // Send private warning to sender only, don't relay message
        socket.emit('chat:warning', {
          message: 'Your message was flagged and not sent. Please keep it respectful.',
        });
        return;
      }

      // Relay to room (both participants)
      io.to(`chat:${sessionId}`).emit('chat:message', {
        id: msgRows[0].id,
        senderId: userId,
        text: text.trim(),
        sentAt: msgRows[0].sent_at,
      });
    } catch (err) {
      console.error('chat:message error:', err.message);
    }
  });

  /**
   * User votes to extend the chat (both must vote within 15s).
   */
  socket.on('chat:extend_vote', async ({ sessionId }) => {
    try {
      const { rows } = await db.query(
        `SELECT user_a, user_b, is_extended FROM chat_sessions
         WHERE id = $1 AND status = 'active'
           AND (user_a = $2 OR user_b = $2)`,
        [sessionId, userId]
      );
      if (!rows.length) return;
      const session = rows[0];

      if (session.is_extended) {
        return socket.emit('chat:error', { message: 'Chat can only be extended once' });
      }

      await setExtendVote(sessionId, userId);

      // Notify partner that this user wants to extend
      socket.to(`chat:${sessionId}`).emit('chat:extend_requested', {
        byUserId: userId,
        byUserName: socket.user.first_name,
      });

      // Check if both have voted
      const { bothVoted } = await getExtendVotes(sessionId, session.user_a, session.user_b);
      if (bothVoted) {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // +10 min
        await db.query(
          `UPDATE chat_sessions
           SET is_extended = TRUE,
               extend_expires_at = $1,
               status = 'extended'
           WHERE id = $2`,
          [expiresAt, sessionId]
        );

        io.to(`chat:${sessionId}`).emit('chat:extended', {
          expiresAt,
          message: 'Both agreed to extend. 10 more minutes.',
        });

        // Schedule end after extension
        setTimeout(async () => {
          const { rows: check } = await db.query(
            `SELECT status FROM chat_sessions WHERE id = $1`,
            [sessionId]
          );
          if (check[0]?.status === 'extended') {
            await endChatSession(io, { id: sessionId, ...session }, 'extension_expired');
          }
        }, 10 * 60 * 1000);
      }
    } catch (err) {
      console.error('chat:extend_vote error:', err.message);
    }
  });

  /**
   * User manually leaves the chat.
   */
  socket.on('chat:leave', async ({ sessionId }) => {
    try {
      const { rows } = await db.query(
        `SELECT user_a, user_b FROM chat_sessions
         WHERE id = $1 AND (user_a = $2 OR user_b = $2)`,
        [sessionId, userId]
      );
      if (!rows.length) return;
      await endChatSession(io, { id: sessionId, ...rows[0] }, 'user_left');
    } catch (err) {
      console.error('chat:leave error:', err.message);
    }
  });
};
