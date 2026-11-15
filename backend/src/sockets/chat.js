const { getSessionForUser, getSessionMessages, addMessage, addExtendVote, endSession } = require('../lib/sessionStore');

async function moderateText(text) {
  const apiKey = process.env.PERSPECTIVE_API_KEY;
  if (!apiKey) return { flagged: false };

  try {
    const res = await fetch(
      'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=' + apiKey,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comment: { text }, requestedAttributes: { TOXICITY: {} } }) }
    );
    const data = await res.json();
    const score = data.attributeScores?.TOXICITY?.summaryScore?.value ?? 0;
    return { flagged: score > 0.85, score };
  } catch (err) {
    return { flagged: false };
  }
}

module.exports = function registerChatHandlers(io, socket) {
  const userId = socket.user.id;

  socket.on('chat:join', ({ sessionId }) => {
    if (!sessionId) return;
    const session = getSessionForUser(sessionId, userId);
    if (!session) return socket.emit('chat:error', { message: 'Session not found or not active' });

    socket.join(`chat:${sessionId}`);
    socket.currentSessionId = sessionId;
    socket.emit('chat:history', { messages: getSessionMessages(sessionId) });
  });

  socket.on('chat:message', async ({ sessionId, text }) => {
    if (!sessionId || !String(text || '').trim()) return;

    const session = getSessionForUser(sessionId, userId);
    if (!session) return;

    const safeText = String(text).trim();
    const { flagged } = await moderateText(safeText);

    if (flagged) {
      return socket.emit('chat:warning', {
        message: 'Your message was flagged and not sent.',
      });
    }

    const payload = addMessage(sessionId, userId, safeText);
    if (!payload) return;

    io.to(`chat:${sessionId}`).emit('chat:message', payload);
  });

  socket.on('chat:extend_vote', ({ sessionId }) => {
    if (!sessionId) return;
    const session = getSessionForUser(sessionId, userId);
    if (!session) return;

    const result = addExtendVote(sessionId, userId);
    socket.to(`chat:${sessionId}`).emit('chat:extend_requested', {
      byUserId: userId,
      byUserName: socket.user.first_name,
    });

    if (result.bothVoted) {
      io.to(`chat:${sessionId}`).emit('chat:extended', {
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
    }
  });

  socket.on('chat:leave', ({ sessionId }) => {
    if (!sessionId) return;
    const session = getSessionForUser(sessionId, userId);
    if (!session) return;

    io.to(`chat:${sessionId}`).emit('chat:ended', { reason: 'user_left' });
    endSession(sessionId, 'user_left');
  });
};
