import AdmZip from 'adm-zip';
import { v4 as uuidv4 } from 'uuid';
import { join } from 'path';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';

import { LIMITS, PATHS, RUNTIME_CONFIG } from '../config/constants.js';
import { detectLanguage, getEntryPoint, detectVersion, getDependencyFile } from './language-detector.js';
import { installDependencies, getDependencySummary } from './dependency-installer.js';
import {
  isBannedExtension,
  hasPathTraversal,
  hasHiddenFile,
  detectZipBomb,
  validateFileCount,
  validateFilenameLength,
  validateExtractedSize,
  sanitizeEntryName,
} from '../utils/security.js';
import { ensureBotDir, writeExtractedFile, deleteBotFiles, ensureTempDir, getBotSize } from './storage.js';

export async function processZipUpload(fileBuffer, originalName, userId) {
  const botId = uuidv4();
  const timestamp = Date.now();
  const botDir = await ensureBotDir(botId);

  const pipeline = {
    botId,
    userId,
    originalName,
    timestamp,
    status: 'processing',
    steps: [],
    language: null,
    entryPoint: null,
    version: null,
    hasDependencies: false,
    fileCount: 0,
    extractedSize: 0,
    dependencies: { npm: 0, pip: 0 },
    errors: [],
    warnings: [],
  };

  async function addStep(name, status, detail) {
    const step = { name, status, timestamp: Date.now(), detail };
    pipeline.steps.push(step);
    return step;
  }

  try {
    await addStep('validate', 'running', 'Validating ZIP file');
    const zip = new AdmZip(fileBuffer);
    const entries = zip.getEntries();

    if (entries.length === 0) {
      throw new Error('ZIP file is empty');
    }

    validateFileCount(entries.length);
    pipeline.fileCount = entries.length;

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      detectZipBomb(entry, () => entry.header.size, () => entry.header.compressedSize);
    }

    await addStep('validate', 'passed', `ZIP contains ${entries.length} entries`);

    await addStep('scan', 'running', 'Scanning for security threats');
    const validEntries = [];

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const rawName = entry.entryName || entry.name || '';
      const name = sanitizeEntryName(rawName);
      if (!name) continue;

      if (hasPathTraversal(name)) {
        pipeline.warnings.push(`Skipped path traversal attempt: ${rawName}`);
        continue;
      }

      if (hasHiddenFile(name) && name !== '.env') {
        continue;
      }

      validateFilenameLength(name);

      const ext = name.includes('.') ? '.' + name.split('.').pop().toLowerCase() : '';
      if (isBannedExtension(name)) {
        pipeline.warnings.push(`Skipped banned file: ${name}`);
        continue;
      }

      validEntries.push({ ...entry, safeName: name });
    }

    await addStep('scan', 'passed', `${validEntries.length} valid files after security scan`);

    await addStep('detect', 'running', 'Detecting bot language');
    pipeline.language = detectLanguage(validEntries);

    if (!pipeline.language) {
      throw new Error(
        'Could not detect bot language. ' +
        'Include a package.json (Node.js) or requirements.txt (Python) in your ZIP root.'
      );
    }

    const config = RUNTIME_CONFIG[pipeline.language];
    pipeline.entryPoint = getEntryPoint(validEntries, pipeline.language);
    pipeline.version = detectVersion(validEntries, pipeline.language);
    pipeline.hasDependencies = !!getDependencyFile(validEntries, pipeline.language);

    if (!pipeline.entryPoint) {
      pipeline.errors.push(
        `No entry point detected. Expected one of: ${config.entryFiles.join(', ')}`
      );
    }

    await addStep('detect', 'passed',
      `${config.label} detected` +
      (pipeline.version ? ` (${pipeline.version})` : '') +
      (pipeline.entryPoint ? ` → entry: ${pipeline.entryPoint}` : '')
    );

    await addStep('extract', 'running', `Extracting ${validEntries.length} files`);
    let totalSize = 0;

    for (const entry of validEntries) {
      try {
        const data = entry.getData();
        totalSize += data.length;
        const filePath = join(botDir, entry.safeName);
        const fileDir = join(botDir, dirname(entry.safeName));
        if (fileDir && !existsSync(fileDir)) {
          await mkdir(fileDir, { recursive: true });
        }
        await writeExtractedFile(botDir, entry.safeName, data);
      } catch (err) {
        pipeline.warnings.push(`Failed to extract ${entry.safeName}: ${err.message}`);
      }
    }

    validateExtractedSize(totalSize);
    pipeline.extractedSize = totalSize;

    await addStep('extract', 'passed',
      `Extracted ${validEntries.length} files (${(totalSize / 1024 / 1024).toFixed(2)} MB)`
    );

    if (pipeline.hasDependencies) {
      await addStep('dependencies', 'running', `Installing ${config.label} dependencies`);
      const depResult = installDependencies(botDir, pipeline.language);

      if (depResult.success) {
        const summary = getDependencySummary(botDir, pipeline.language);
        if (pipeline.language === 'node') pipeline.dependencies.npm = summary.count;
        else pipeline.dependencies.pip = summary.count;
        await addStep('dependencies', 'passed',
          depResult.skipped
            ? 'No dependencies to install'
            : `${summary.count} packages installed (${(depResult.duration / 1000).toFixed(1)}s)`
        );
      } else {
        pipeline.errors.push(depResult.error || 'Dependency installation failed');
        await addStep('dependencies', 'failed', depResult.message);
      }
    } else {
      await addStep('dependencies', 'skipped', 'No dependency file found');
    }

    pipeline.status = 'ready';
    await addStep('complete', 'success', 'Bot is ready to run');
  } catch (err) {
    pipeline.status = 'failed';
    pipeline.errors.push(err.message);
    await addStep('error', 'failed', err.message);
    await deleteBotFiles(botId);
  }

  const botSize = pipeline.status === 'ready' ? await getBotSize(botId) : 0;

  return {
    ...pipeline,
    botDir: pipeline.status === 'ready' ? botDir : null,
    totalBytes: botSize,
  };
}

function dirname(path) {
  const parts = path.replace(/\\/g, '/').split('/');
  parts.pop();
  return parts.join('/');
}

export function validateZipBuffer(buffer) {
  if (!buffer || buffer.length === 0) {
    throw new Error('No file data provided');
  }
  if (buffer.length > LIMITS.MAX_FILE_SIZE) {
    throw new Error(
      `File too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB ` +
      `(max ${LIMITS.MAX_FILE_SIZE / 1024 / 1024}MB)`
    );
  }
  const header = buffer.slice(0, 4).toString('hex');
  if (header !== '504b0304' && header !== '504b0506' && header !== '504b0708') {
    throw new Error('Not a valid ZIP file (invalid header)');
  }
  return true;
}
