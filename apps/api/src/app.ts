import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import path from 'path';
import authRouter from './routes/auth';
import tournamentRouter from './routes/tournament';
import squadRouter from './routes/squad';
import matchRouter from './routes/match';
import uploadRouter from './routes/upload';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

const app = express();

// ─── Security middleware ──────────────────────────────────────────────────────

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limit — 1000 req / 15 min per IP
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests — please slow down' },
  })
);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/auth', authRouter);
app.use('/tournament', tournamentRouter);
app.use('/squad', squadRouter);
app.use('/matches', matchRouter);
app.use('/upload', uploadRouter);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// 404 catch-all
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

export default app;
