import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { existsSync, mkdirSync } from 'fs';
import { PATHS } from './config/constants.js';
import { apiLimiter } from './middleware/rate-limit.js';
import uploadRoutes from './routes/upload.js';
import botRoutes from './routes/bots.js';

const app = express();
const PORT = process.env.PORT || 3001;

for (const dir of [PATHS.BOTS_ROOT, PATHS.TEMP_ROOT]) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'nexus-bot-api', version: '1.0.0', timestamp: Date.now() });
});

app.use('/api/upload', uploadRoutes);
app.use('/api/bots', botRoutes);

app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`[NEXUS API] Running on port ${PORT}`);
  console.log(`[NEXUS API] Bots root: ${PATHS.BOTS_ROOT}`);
  console.log(`[NEXUS API] Temp root: ${PATHS.TEMP_ROOT}`);
});

export default app;
