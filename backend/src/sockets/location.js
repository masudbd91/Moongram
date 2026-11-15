const { setUserLocation, getUserLocation } = require('../lib/sessionStore');

module.exports = function registerLocationHandlers(io, socket) {
  socket.on('location:update', ({ lat, lng }) => {
    if (typeof lat !== 'number' || typeof lng !== 'number') return;

    const location = { lat, lng, updatedAt: Date.now(), firstName: socket.user.first_name };
    setUserLocation(socket.user.id, location);

    socket.emit('location:ok', { ...location });
    io.to(`user:${socket.user.id}`).emit('location:presence', {
      userId: socket.user.id,
      lat,
      lng,
      updatedAt: Date.now(),
    });
  });

  socket.on('location:background', () => {
    socket.emit('location:backgrounded', { ok: true });
  });

  socket.on('location:foreground', () => {
    socket.emit('location:foregrounded', { ok: true });
  });

  socket.on('presence:request', () => {
    const location = getUserLocation(socket.user.id);
    socket.emit('presence:response', location || null);
  });
};
