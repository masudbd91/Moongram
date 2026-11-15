const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../lib/jwtSecret');
const { getUserLocation } = require('../lib/sessionStore');

module.exports = function registerSocketServer(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const payload = jwt.verify(token, getJwtSecret());
      socket.user = { id: payload.uid || payload.userId };
      if (!socket.user.id) return next(new Error('Invalid auth token'));
      return next();
    } catch (error) {
      return next(new Error('Invalid auth token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    const profile = getUserLocation(userId) || {};
    socket.user = {
      id: userId,
      first_name: profile.firstName || 'Demo',
      vibe_tags: profile.vibeTags || ['coffee', 'music'],
    };

    socket.join(`user:${userId}`);
    console.log(`Socket connected: ${socket.id} for ${userId}`);

    require('./location')(io, socket);
    require('./chat')(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${socket.id} (${reason})`);
    });
  });
};
