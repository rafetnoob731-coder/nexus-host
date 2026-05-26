import { mkdir, writeFile, readFile, unlink, rm, readdir, stat, copyFile } from 'fs/promises';
import { join, basename, dirname } from 'path';
import { existsSync } from 'fs';
import { PATHS } from '../config/constants.js';

export async function ensureBotDir(botId) {
  const dir = join(PATHS.BOTS_ROOT, botId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function ensureTempDir() {
  const dir = PATHS.TEMP_ROOT;
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function writeExtractedFile(botDir, entryName, data) {
  const safePath = join(botDir, entryName);
  const dir = dirname(safePath);
  await mkdir(dir, { recursive: true });
  await writeFile(safePath, data);
  return safePath;
}

export async function readBotFile(botId, filePath) {
  const fullPath = join(PATHS.BOTS_ROOT, botId, filePath);
  const resolved = resolvePath(PATHS.BOTS_ROOT, fullPath);
  if (!resolved.startsWith(join(PATHS.BOTS_ROOT, botId))) {
    throw new Error('Path traversal detected');
  }
  if (!existsSync(resolved)) return null;
  return await readFile(resolved, 'utf8');
}

export async function listBotFiles(botId, relativePath = '') {
  const dirPath = join(PATHS.BOTS_ROOT, botId, relativePath);
  if (!existsSync(dirPath)) return [];
  const entries = await readdir(dirPath, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.env') continue;
    if (entry.name === 'node_modules' || entry.name === '__pycache__') continue;
    results.push({
      name: entry.name,
      path: join(relativePath, entry.name),
      type: entry.isDirectory() ? 'directory' : 'file',
      size: entry.isFile() ? (await stat(join(dirPath, entry.name))).size : 0,
    });
  }
  return results;
}

export async function deleteBotFiles(botId) {
  const dir = join(PATHS.BOTS_ROOT, botId);
  if (existsSync(dir)) {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function saveEnvFile(botId, envVars) {
  const dir = await ensureBotDir(botId);
  const content = Object.entries(envVars)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  await writeFile(join(dir, '.env'), content, 'utf8');
}

export async function readEnvFile(botId) {
  const content = await readBotFile(botId, '.env');
  if (!content) return {};
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      vars[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
  }
  return vars;
}

export async function getBotSize(botId) {
  const dir = join(PATHS.BOTS_ROOT, botId);
  if (!existsSync(dir)) return 0;
  let totalSize = 0;
  async function walk(dirPath) {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '__pycache__') {
          await walk(fullPath);
        }
      } else {
        totalSize += (await stat(fullPath)).size;
      }
    }
  }
  await walk(dir);
  return totalSize;
}

function resolvePath(root, candidate) {
  const resolved = join(root, candidate);
  return resolved;
}
