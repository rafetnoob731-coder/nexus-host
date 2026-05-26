import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { RUNTIME_CONFIG } from '../config/constants.js';

export function installDependencies(botDir, language) {
  const config = RUNTIME_CONFIG[language];
  if (!config || !config.depCommand) {
    return { success: true, skipped: true, message: `No dependencies required for ${language}` };
  }

  const depFilePath = join(botDir, config.depFile);
  if (!existsSync(depFilePath)) {
    return { success: true, skipped: true, message: `No ${config.depFile} found, skipping dependency install` };
  }

  try {
    const startTime = Date.now();
    const output = execSync(config.depCommand, {
      cwd: botDir,
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, NODE_ENV: 'production', PIP_NO_CACHE_DIR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const duration = Date.now() - startTime;
    return {
      success: true,
      skipped: false,
      duration,
      message: `Dependencies installed in ${(duration / 1000).toFixed(1)}s`,
      output: output.toString().split('\n').filter(l => l.trim()).slice(-10),
    };
  } catch (err) {
    const stderr = err.stderr?.toString() || err.message || 'Unknown error';
    return {
      success: false,
      skipped: false,
      error: stderr.split('\n').filter(l => l.trim()).slice(-5).join('\n'),
      message: `Dependency installation failed for ${language}`,
    };
  }
}

export function getDependencySummary(botDir, language) {
  const config = RUNTIME_CONFIG[language];
  if (!config) return { count: 0, packages: [] };

  if (language === 'node') {
    try {
      const pkgPath = join(botDir, 'package.json');
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        return { count: Object.keys(deps).length, packages: Object.keys(deps).slice(0, 50) };
      }
    } catch {}
  }

  if (language === 'python') {
    try {
      const reqPath = join(botDir, 'requirements.txt');
      if (existsSync(reqPath)) {
        const content = readFileSync(reqPath, 'utf8');
        const packages = content.split('\n')
          .map(l => l.trim())
          .filter(l => l && !l.startsWith('#') && !l.startsWith('-'))
          .map(l => l.split(/[=<>~!]/)[0].trim())
          .filter(Boolean);
        return { count: packages.length, packages: packages.slice(0, 50) };
      }
    } catch {}
  }

  return { count: 0, packages: [] };
}
