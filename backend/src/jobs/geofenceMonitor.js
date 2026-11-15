const { getActiveSessions, getUserLocation, endSession } = require('../lib/sessionStore');
const { haversineDistanceM } = require('../lib/geo');

module.exports = function registerGeofenceMonitor(io) {
  setInterval(() => {
    for (const session of getActiveSessions()) {
      const a = getUserLocation(session.userA);
      const b = getUserLocation(session.userB);

      if (!a || !b) continue;

      const distanceM = haversineDistanceM(a.lat, a.lng, b.lat, b.lng);
      if (distanceM > 120) {
        io.to(`chat:${session.id}`).emit('chat:distance_warning', {
          distanceM,
          gracePeriodMs: 30000,
        });
      } else {
        io.to(`chat:${session.id}`).emit('chat:distance_ok', {});
      }

      if (distanceM > 180) {
        io.to(`chat:${session.id}`).emit('chat:ended', { reason: 'moved_apart' });
        endSession(session.id, 'moved_apart');
      }
    }
  }, 5000);
};
