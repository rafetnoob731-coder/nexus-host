import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { apiLimiter } from '../middleware/rate-limit.js';
import { listBotFiles, readBotFile, saveEnvFile, readEnvFile, deleteBotFiles } from '../services/storage.js';
import { getDependencySummary } from '../services/dependency-installer.js';
import { existsSync } from 'fs';
import { join } from 'path';
import { PATHS } from '../config/constants.js';

const router = Router();

router.use(authenticate);
router.use(apiLimiter);

router.get('/', async (req, res) => {
  const { readdir, stat } = await import('fs/promises');
  try {
    if (!existsSync(PATHS.BOTS_ROOT)) {
      return res.json({ bots: [] });
    }
    const dirs = await readdir(PATHS.BOTS_ROOT);
    const bots = [];
    for (const dir of dirs) {
      try {
        const stats = await stat(join(PATHS.BOTS_ROOT, dir));
        if (stats.isDirectory()) {
          const env = await readEnvFile(dir).catch(() => ({}));
          bots.push({
            id: dir,
            createdAt: stats.birthtimeMs || stats.mtimeMs,
            size: stats.size,
            envCount: Object.keys(env).length,
          });
        }
      } catch {}
    }
    res.json({ bots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:botId', async (req, res) => {
  const { botId } = req.params;
  const botDir = join(PATHS.BOTS_ROOT, botId);
  if (!existsSync(botDir)) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  try {
    const { stat } = await import('fs/promises');
    const stats = await stat(botDir);
    const files = await listBotFiles(botId);
    const env = await readEnvFile(botId);
    const depSummary = getDependencySummary(botDir, 'node');
    const pySummary = getDependencySummary(botDir, 'python');
    res.json({
      id: botId,
      createdAt: stats.birthtimeMs || stats.mtimeMs,
      size: stats.size,
      fileCount: files.length,
      files,
      env,
      dependencies: {
        npm: depSummary.count,
        pip: pySummary.count,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:botId/files', async (req, res) => {
  const { botId } = req.params;
  const relativePath = req.query.path || '';
  if (!existsSync(join(PATHS.BOTS_ROOT, botId))) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  try {
    const files = await listBotFiles(botId, relativePath);
    res.json({ files, path: relativePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:botId/files/*', async (req, res) => {
  const { botId, 0: filePath } = req.params;
  const fullPath = join(PATHS.BOTS_ROOT, botId, filePath || '');
  if (!existsSync(fullPath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  try {
    const { stat } = await import('fs/promises');
    const stats = await stat(fullPath);
    if (stats.isDirectory()) {
      const files = await listBotFiles(botId, filePath);
      return res.json({ files, path: filePath });
    }
    const content = await readBotFile(botId, filePath);
    res.json({ path: filePath, size: stats.size, content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:botId/env', async (req, res) => {
  const { botId } = req.params;
  const { env } = req.body;
  if (!env || typeof env !== 'object') {
    return res.status(400).json({ error: 'env must be an object' });
  }
  if (!existsSync(join(PATHS.BOTS_ROOT, botId))) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  try {
    const sanitized = {};
    for (const [key, value] of Object.entries(env)) {
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        sanitized[key] = String(value);
      }
    }
    await saveEnvFile(botId, sanitized);
    res.json({ message: 'Environment saved', count: Object.keys(sanitized).length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:botId/env', async (req, res) => {
  const { botId } = req.params;
  if (!existsSync(join(PATHS.BOTS_ROOT, botId))) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  try {
    const env = await readEnvFile(botId);
    res.json({ env });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:botId', async (req, res) => {
  const { botId } = req.params;
  if (!existsSync(join(PATHS.BOTS_ROOT, botId))) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  try {
    await deleteBotFiles(botId);
    res.json({ message: 'Bot deleted', botId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
