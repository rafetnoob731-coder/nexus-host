import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5000;

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const PATHS = {
  BOTS_ROOT: join(__dirname, 'bots'),
  TEMP_ROOT: join(__dirname, 'tmp'),
};
for (const dir of [PATHS.BOTS_ROOT, PATHS.TEMP_ROOT]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const MIME_MAP = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4',
  '.gif': 'image/gif', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.map': 'application/json',
};
app.use(express.static(__dirname, {
  setHeaders: (res, path) => {
    const ext = path.match(/\.\w+$/)?.[0];
    if (ext && MIME_MAP[ext]) res.setHeader('Content-Type', MIME_MAP[ext]);
    if (path.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  }
}));

// API routes
import { apiLimiter } from './api/middleware/rate-limit.js';
import uploadRoutes from './api/routes/upload.js';
import botRoutes from './api/routes/bots.js';

app.use('/api', apiLimiter);
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'nexus-cloud', version: '2.0.0', timestamp: Date.now() });
});
app.use('/api/upload', uploadRoutes);
app.use('/api/bots', botRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const HTML_ROUTES = [
  '', 'login', 'register', 'dashboard',
  'create-project', 'instances', 'deployment-console',
  'terminal', 'files', 'ai-assistant', 'analytics', 'admin', 'notifications',
  'forgot-password', 'docs', 'status',
];
HTML_ROUTES.forEach(route => {
  const filePath = route === '' ? '/index.html' : `/${route.split('/').pop()}.html`;
  app.get(`/${route}`, (req, res) => res.sendFile(join(__dirname, filePath)));
});
app.get('/admin/*', (req, res) => res.sendFile(join(__dirname, 'admin.html')));

app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
  res.sendFile(join(__dirname, 'dashboard.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[NEXUS CLOUD] Running on port ${PORT}`);
  console.log(`[NEXUS CLOUD] Frontend: http://localhost:${PORT}`);
  console.log(`[NEXUS CLOUD] API: http://localhost:${PORT}/api/health`);
});
