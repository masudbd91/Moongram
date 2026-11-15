const redis = require('redis');

const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

client.on('error', (err) => console.error('Redis client error:', err.message));

async function connectRedis() {
  try {
    await client.connect();
    console.log('✅ Redis connected');
    return true;
  } catch (err) {
    console.error('Redis connection failed:', err.message);
    return false;
  }
}

async function setUserLocation(userId, { lat, lng, lastSeen = Date.now() }) {
  if (!client.isReady) return null;
  await client.hSet(`user:${userId}:location`, {
    lat: String(lat),
    lng: String(lng),
    lastSeen: String(lastSeen),
  });
  await client.expire(`user:${userId}:location`, 30);
  return { lat, lng, lastSeen };
}

async function getUserLocation(userId) {
  if (!client.isOpen) return null;
  const data = await client.hGetAll(`user:${userId}:location`);
  if (!data || !data.lat || !data.lng) return null;
  return {
    lat: Number(data.lat),
    lng: Number(data.lng),
    lastSeen: Number(data.lastSeen || Date.now()),
  };
}

async function setExtendVote(sessionId, userId) {
  if (!client.isOpen) return false;
  await client.hSet(`chat:${sessionId}:extendVotes`, userId, '1');
  return true;
}

async function getExtendVotes(sessionId, userA, userB) {
  if (!client.isOpen) return { votes: {}, bothVoted: false };
  const votes = await client.hGetAll(`chat:${sessionId}:extendVotes`);
  const bothVoted = Boolean(votes[userA] && votes[userB]);
  return { votes, bothVoted };
}

async function removeActiveChat(sessionId) {
  if (!client.isOpen) return false;
  await client.del(`chat:${sessionId}:extendVotes`);
  return true;
}

module.exports = {
  client,
  connectRedis,
  setUserLocation,
  getUserLocation,
  setExtendVote,
  getExtendVotes,
  removeActiveChat,
};
