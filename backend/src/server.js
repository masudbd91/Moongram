require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const { initializeDatabase } = require('./db/init');
const { connectRedis } = require('./db/redis');
const { getJwtSecret } = require('./lib/jwtSecret');
const { admin } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 20000,
  pingInterval: 10000,
});

app.set('io', io);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/feed', require('./routes/feed'));
app.use('/api/pings', require('./routes/pings'));
app.use('/api/safety', require('./routes/safety'));

app.get('/health', async (req, res) => {
  const { healthCheck } = require('./db/pg');
  const dbStatus = await healthCheck();
  const redisStatus = require('./db/redis').client.isReady ? 'ready' : 'disconnected';
  const ok = dbStatus.ok && redisStatus === 'ready';
  res.status(ok ? 200 : 503).json({ ok, time: new Date().toISOString(), db: dbStatus, redis: redisStatus });
});

require('./sockets')(io);
require('./jobs/geofenceMonitor')(io);

async function start() {
  if (process.env.NODE_ENV === 'production') {
    getJwtSecret();
    if (!admin?.apps?.length) throw new Error('Firebase Admin credentials are required in production');
    if (!process.env.DATABASE_URL || !process.env.REDIS_URL) {
      throw new Error('DATABASE_URL and REDIS_URL are required in production');
    }
  }

  const PORT = Number(process.env.PORT || 3001);
  server.listen(PORT, () => {
    console.log(`🚀 nearby. backend running on port ${PORT}`);
  });

  void initializeDatabase();
  void connectRedis();
}

start();

module.exports = { app, server, io };
