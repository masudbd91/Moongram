const { randomUUID } = require('crypto');
const { haversineDistanceM } = require('./geo');

const activeUsers = new Map();
const statusUpdates = new Map();
const pings = new Map();
const sessions = new Map();
const messagesBySession = new Map();
const extendVotesBySession = new Map();

function buildUserProfile(userId, overrides = {}) {
  return {
    id: userId,
    firstName: overrides.firstName || 'Guest',
    vibeTags: overrides.vibeTags || ['coffee', 'music'],
    availability: overrides.availability || '1h',
    lastSeen: overrides.lastSeen || Date.now(),
  };
}

function setUserLocation(userId, payload) {
  const existing = activeUsers.get(userId) || buildUserProfile(userId);
  const next = {
    ...existing,
    ...payload,
    id: userId,
    lastSeen: Date.now(),
  };
  activeUsers.set(userId, next);
  return next;
}

function getUserLocation(userId) {
  return activeUsers.get(userId) || null;
}

function getNearbyUsers(selfUserId, lat, lng, radiusM = 100) {
  const list = [];
  for (const [userId, user] of activeUsers.entries()) {
    if (userId === selfUserId) continue;
    if (typeof user.lat !== 'number' || typeof user.lng !== 'number') continue;
    const distanceM = haversineDistanceM(lat, lng, user.lat, user.lng);
    if (distanceM <= radiusM) {
      list.push({
        ...buildUserProfile(userId, user),
        lat: user.lat,
        lng: user.lng,
        distanceM,
      });
    }
  }
  return list.sort((a, b) => a.distanceM - b.distanceM);
}

function createStatusUpdate(userId, text) {
  const user = activeUsers.get(userId) || buildUserProfile(userId);
  const createdAt = new Date();
  const update = {
    id: randomUUID(),
    userId,
    firstName: user.firstName,
    vibeTags: user.vibeTags,
    text,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
  statusUpdates.set(update.id, update);
  return update;
}

function deleteStatusUpdate(userId, statusId) {
  const update = statusUpdates.get(statusId);
  if (!update || update.userId !== userId) return false;
  return statusUpdates.delete(statusId);
}

function getNearbyStatusUpdates(selfUserId, lat, lng, radiusM = 100) {
  const now = Date.now();
  for (const [id, update] of statusUpdates) {
    if (Date.parse(update.expiresAt) <= now) statusUpdates.delete(id);
  }

  return Array.from(statusUpdates.values())
    .flatMap((update) => {
      const user = activeUsers.get(update.userId);
      if (!user || typeof user.lat !== 'number' || typeof user.lng !== 'number') return [];

      const distanceM = update.userId === selfUserId ? 0 : haversineDistanceM(lat, lng, user.lat, user.lng);
      if (distanceM > radiusM) return [];

      return [{
        ...update,
        firstName: user.firstName,
        vibeTags: user.vibeTags,
        availability: user.availability,
        distanceM: Math.round(distanceM),
      }];
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function createPing(senderId, receiverId) {
  const pingId = randomUUID();
  const ping = {
    id: pingId,
    senderId,
    receiverId,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  pings.set(pingId, ping);
  return ping;
}

function getPing(pingId) {
  return pings.get(pingId) || null;
}

function respondToPing(pingId, accepted, responderId) {
  const ping = pings.get(pingId);
  if (!ping) return null;
  if (ping.receiverId !== responderId) return null;

  ping.status = accepted ? 'accepted' : 'declined';
  ping.respondedAt = new Date().toISOString();

  if (!accepted) return ping;

  const sessionId = randomUUID();
  const session = {
    id: sessionId,
    pingId,
    userA: ping.senderId,
    userB: ping.receiverId,
    status: 'active',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    messageCount: 0,
  };
  sessions.set(sessionId, session);
  messagesBySession.set(sessionId, []);
  extendVotesBySession.set(sessionId, new Set());
  return { ping, session };
}

function getSessionById(sessionId) {
  return sessions.get(sessionId) || null;
}

function getSessionForUser(sessionId, userId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (session.userA !== userId && session.userB !== userId) return null;
  return session;
}

function getSessionMessages(sessionId) {
  return messagesBySession.get(sessionId) || [];
}

function addMessage(sessionId, senderId, text) {
  const session = sessions.get(sessionId);
  if (!session) return null;

  const record = {
    id: randomUUID(),
    sessionId,
    senderId,
    text,
    sentAt: new Date().toISOString(),
  };

  const list = messagesBySession.get(sessionId) || [];
  list.push(record);
  messagesBySession.set(sessionId, list.slice(-50));
  session.messageCount = list.length;
  return record;
}

function addExtendVote(sessionId, userId) {
  const set = extendVotesBySession.get(sessionId) || new Set();
  set.add(userId);
  extendVotesBySession.set(sessionId, set);
  return { votes: Array.from(set), bothVoted: set.size >= 2 };
}

function endSession(sessionId, reason = 'user_left') {
  const session = sessions.get(sessionId);
  if (!session) return null;
  session.status = 'ended';
  session.endedAt = new Date().toISOString();
  session.reason = reason;
  sessions.delete(sessionId);
  messagesBySession.delete(sessionId);
  extendVotesBySession.delete(sessionId);
  return session;
}

function getActiveSessions() {
  return Array.from(sessions.values());
}

module.exports = {
  activeUsers,
  pings,
  sessions,
  setUserLocation,
  getUserLocation,
  getNearbyUsers,
  createStatusUpdate,
  deleteStatusUpdate,
  getNearbyStatusUpdates,
  createPing,
  getPing,
  respondToPing,
  getSessionById,
  getSessionForUser,
  getSessionMessages,
  addMessage,
  addExtendVote,
  endSession,
  getActiveSessions,
};
