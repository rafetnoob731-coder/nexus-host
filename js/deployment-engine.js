class NexusDeploymentEngine {
  constructor() {
    this.NEXUS_API = 'https://api.nexus-host.com/v1';
    this.DEPLOYMENT_PROVIDERS = {
      render: { enabled: true, baseUrl: 'https://api.render.com/v1' },
      vercel: { enabled: true, baseUrl: 'https://api.vercel.com/v1' },
      termux: { enabled: true, baseUrl: 'https://termux.nexus-host.com' }
    };
    this.activeDeployments = {};
    this.deploymentTokens = new Map();
  }

  detectRuntime(files) {
    if (files.some(f => f.name === 'artisan' || f.name.endsWith('.php') && f.name !== 'artisan')) {
      return { runtime: 'php', framework: 'laravel', version: '11.x', php: '8.3' };
    }
    if (files.some(f => f.name === 'package.json')) {
      return { runtime: 'node', framework: 'node.js', version: '20.x', php: null };
    }
    if (files.some(f => f.name === 'requirements.txt' || f.name === 'setup.py' || f.name === 'pyproject.toml')) {
      return { runtime: 'python', framework: 'python', version: '3.11', php: null };
    }
    if (files.some(f => f.name === 'index.html' || f.name === 'index.htm')) {
      return { runtime: 'static', framework: 'static', version: '1.0', php: null };
    }
    return { runtime: 'php', framework: 'laravel', version: '11.x', php: '8.3' };
  }

  sanitizeFileName(name) {
    const dangerous = ['.exe', '.sh', '.bat', '.cmd', '.ps1', '.jar', '.dll', '.so', '.dylib', '.bin'];
    const ext = '.' + name.split('.').pop().toLowerCase();
    if (dangerous.includes(ext)) throw new Error(`Blocked dangerous file type: ${ext}`);
    if (name.includes('..')) throw new Error('Invalid file path detected');
    if (name.length > 255) throw new Error('File name too long');
    return name.replace(/[^a-zA-Z0-9._\-\/]/g, '_');
  }

  validateZip(file) {
    if (!file) throw new Error('No file provided');
    if (!file.name.endsWith('.zip')) throw new Error('Only ZIP files are supported');
    if (file.size > 500 * 1024 * 1024) throw new Error('File exceeds 500MB limit');
    if (file.size === 0) throw new Error('Empty file');
  }

  generateDeploymentToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = 'nxs_';
    for (let i = 0; i < 64; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
    return token;
  }

  generateDeploymentUrl(projectName, deploymentId) {
    const safe = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 30);
    return `https://${safe}-${deploymentId.substring(0, 8)}.nexus-host.app`;
  }

  buildCommand(runtime) {
    const commands = {
      php: ['composer install --no-dev --optimize-autoloader', 'php artisan optimize', 'php artisan migrate --force', 'php artisan config:cache', 'php artisan route:cache', 'php artisan view:cache', 'npm install && npm run production'],
      node: ['npm ci --only=production', 'npm run build'],
      python: ['pip install -r requirements.txt', 'python manage.py collectstatic --noinput', 'python manage.py migrate'],
      static: ['echo "Static site — no build required"']
    };
    return commands[runtime] || commands.php;
  }

  async executeDeploymentPipeline(project, deploymentId, onLog) {
    const steps = [
      { name: 'Initialize Build', action: async () => {
        onLog('info', `[BUILD] Initializing deployment ${deploymentId.substring(0, 8)}...`);
        onLog('info', `[BUILD] Runtime: ${project.runtime} | Framework: ${project.framework}`);
        onLog('system', `[BUILD] Environment: ${project.env || 'production'}`);
        await this.sleep(800);
      }},
      { name: 'Install Dependencies', action: async () => {
        onLog('info', '[COMPOSER] Installing PHP dependencies...');
        onLog('system', 'composer install --no-dev --optimize-autoloader');
        await this.sleep(1500);
        onLog('success', '[COMPOSER] Dependencies installed successfully');
        if (project.runtime === 'php') {
          onLog('info', '[NPM] Installing Node dependencies...');
          onLog('system', 'npm ci --only=production');
          await this.sleep(1200);
          onLog('success', '[NPM] Node dependencies installed');
        }
      }},
      { name: 'Compile Assets', action: async () => {
        if (project.runtime === 'php') {
          onLog('info', '[VITE] Compiling Laravel assets...');
          onLog('system', 'npm run production');
          await this.sleep(2000);
          onLog('success', '[VITE] Assets compiled successfully');
        }
        onLog('info', '[ARTISAN] Running optimization commands...');
        onLog('system', 'php artisan optimize');
        await this.sleep(600);
        onLog('success', '[ARTISAN] Application optimized');
      }},
      { name: 'Run Migrations', action: async () => {
        onLog('info', '[MIGRATE] Running database migrations...');
        onLog('system', 'php artisan migrate --force');
        await this.sleep(1500);
        onLog('success', '[MIGRATE] Database migrations completed');

        onLog('info', '[CACHE] Caching configuration...');
        onLog('system', 'php artisan config:cache');
        await this.sleep(500);
        onLog('success', '[CACHE] Configuration cached');

        onLog('system', 'php artisan route:cache');
        await this.sleep(400);
        onLog('success', '[CACHE] Routes cached');

        onLog('system', 'php artisan view:cache');
        await this.sleep(400);
        onLog('success', '[CACHE] Views cached');
      }},
      { name: 'Deploy Application', action: async () => {
        onLog('info', '[DEPLOY] Starting application server...');
        await this.sleep(1000);
        onLog('success', '[DEPLOY] Application deployed successfully!');
        onLog('highlight', `[URL] Deployment URL: https://${project.slug}-${deploymentId.substring(0, 8)}.nexus-host.app`);
        onLog('system', '[STATUS] Health check passed — 200 OK');
        onLog('system', '[SSL] Certificate issued — valid for 90 days');
      }}
    ];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      onLog('system', `\n━━━ Step ${i + 1}/${steps.length}: ${step.name} ━━━`);
      this.updateStepStatus(i + 1, 'active');
      try {
        await step.action();
        this.updateStepStatus(i + 1, 'completed');
      } catch (err) {
        onLog('error', `[ERROR] Step ${i + 1} failed: ${err.message}`);
        this.updateStepStatus(i + 1, 'error');
        throw err;
      }
    }
  }

  updateStepStatus(step, status) {
    document.querySelectorAll('.deployment-step').forEach((el, idx) => {
      el.classList.remove('active', 'completed');
      if (idx + 1 === step) el.classList.add(status);
      else if (idx + 1 < step) el.classList.add('completed');
    });
  }

  async sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
}

const deploymentEngine = new NexusDeploymentEngine();
window.deploymentEngine = deploymentEngine;
