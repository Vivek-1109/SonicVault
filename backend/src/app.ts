import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generalLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import songRoutes from './routes/songs.js';
import playlistRoutes from './routes/playlists.js';
import favoriteRoutes from './routes/favorites.js';
import recentlyPlayedRoutes from './routes/recentlyPlayed.js';
import deviceRoutes from './routes/devices.js';
import syncRoutes from './routes/sync.js';
import adminRoutes from './routes/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ─── Security ───────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable for admin dashboard
    crossOriginEmbedderPolicy: false,
  })
);

// ─── CORS (allow all origins for mobile app) ────────────────────────
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Body Parsing ───────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Rate Limiting ──────────────────────────────────────────────────
app.use('/api/', generalLimiter);

// ─── Health Check ───────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── API Routes ─────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/recently-played', recentlyPlayedRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/admin', adminRoutes);

// ─── Serve Admin Dashboard ─────────────────────────────────────────
const adminDir = path.join(__dirname, '..', 'admin');
app.use('/admin', express.static(adminDir));
app.get('/admin/*', (_req, res) => {
  res.sendFile(path.join(adminDir, 'index.html'));
});

// ─── 404 Handler ────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ───────────────────────────────────────────
app.use(errorHandler);

export default app;
