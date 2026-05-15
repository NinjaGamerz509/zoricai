require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const logger = require('./services/loggerService');
const { limiter } = require('./middleware/rateLimiter');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Connect DB and load tokens
connectDB().then(async () => {
  try {
    const User = require('./models/User');
    const users = await User.find();
    if (users.length > 0 && users[0].spotifyTokens?.access_token) {
      logger.info('Legacy Spotify tokens found (ignored)', 'INIT');
    }
    logger.success('ZORIC V2.0 initialized!', 'INIT');
  } catch (e) {
    logger.warn('Init error: ' + e.message, 'INIT');
  }
});

// Middleware
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000', /\.vercel\.app$/, /\.netlify\.app$/], credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(limiter);
app.set('io', io);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/voice', require('./routes/voice'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/youtube', require('./routes/youtube'));
app.use('/api/google', require('./routes/google'));
app.use('/api/browser', require('./routes/browser'));
app.use('/api/daily-summary', require('./routes/dailySummary'));
app.use('/api/sentinel', require('./routes/sentinel'));
app.use('/api/network', require('./routes/network'));
app.use('/api/playlist', require('./routes/playlist'));
app.use('/api/personal', require('./routes/personal'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'ZORIC V2.0 Online', version: 'V2.0' });
});

// Socket.io
io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`, 'SOCKET_CONNECT');
  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`, 'SOCKET_DISCONNECT');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`ZORIC Backend V2.0 started on port ${PORT}`, 'SERVER_START');
  logger.info('ZORIC V2.0 — DECODE. EXECUTE. COMMAND.', 'SERVER_START');
});

// 11:55 PM daily summary
const cron = require('node-cron');
const { generateDailySummary } = require('./controllers/dailySummaryController');
const User = require('./models/User');
cron.schedule('55 23 * * *', async () => {
  console.log('⏰ Generating daily summaries...');
  try {
    const users = await User.find({});
    for (const user of users) await generateDailySummary(user._id);
    console.log('✅ Daily summaries done!');
  } catch(e) { console.error(e.message); }
}, { timezone: 'Asia/Kolkata' });
