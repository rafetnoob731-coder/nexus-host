window.NexusDeployment = {
  _instances: {},
  _containers: {},
  _deploymentLogs: {},
  _listeners: {},

  sleep: function(ms) { return new Promise(r => setTimeout(r, ms)); },

  generateId: function() {
    return 'nx-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8);
  },

  generateUrl: function(name) {
    const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').substring(0, 24);
    return `${slug}-${Math.random().toString(36).substring(2, 6)}.nexus.app`;
  },

  generateToken: function() {
    return 'nx_' + Array.from({length: 40}, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
  },

  detectRuntime: function(files) {
    const f = files.map(x => x.toLowerCase());
    if (f.some(x => x === 'artisan' || x === 'composer.json')) return { runtime: 'laravel', framework: 'Laravel', version: '11.x', build: 'composer install --no-dev && npm install && npm run build', start: 'php artisan serve --host=0.0.0.0 --port=$PORT', env: { APP_ENV: 'production', APP_DEBUG: 'false' } };
    if (f.some(x => x === 'requirements.txt' || x === 'setup.py')) {
      if (f.some(x => x.includes('django'))) return { runtime: 'python', framework: 'Django', version: '5.0', build: 'pip install -r requirements.txt', start: 'gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 4', env: { DJANGO_SETTINGS_MODULE: 'config.settings', PYTHONUNBUFFERED: '1' } };
      if (f.some(x => x.includes('flask'))) return { runtime: 'python', framework: 'Flask', version: '3.0', build: 'pip install -r requirements.txt', start: 'gunicorn app:app --bind 0.0.0.0:$PORT --workers 2', env: { FLASK_ENV: 'production' } };
      if (f.some(x => x.includes('fastapi'))) return { runtime: 'python', framework: 'FastAPI', version: '0.110', build: 'pip install -r requirements.txt', start: 'uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2', env: {} };
      return { runtime: 'python', framework: 'Python', version: '3.12', build: 'pip install -r requirements.txt', start: 'gunicorn app:app --bind 0.0.0.0:$PORT --workers 2', env: { PYTHONUNBUFFERED: '1' } };
    }
    if (f.some(x => x === 'package.json' || x === 'index.js')) {
      if (f.some(x => x === 'next.config.js' || x === 'next.config.mjs')) return { runtime: 'node', framework: 'Next.js', version: '20', build: 'npm install && npm run build', start: 'npm start', env: { NODE_ENV: 'production' } };
      if (f.some(x => x === 'vite.config.js' || x === 'vite.config.ts')) return { runtime: 'node', framework: 'Vite + React', version: '20', build: 'npm install && npm run build', start: 'npx serve -s dist -l $PORT', env: { NODE_ENV: 'production' } };
      if (f.some(x => x === 'socket.io' || x.includes('socket'))) return { runtime: 'node', framework: 'Socket.io', version: '20', build: 'npm install', start: 'node index.js', env: { NODE_ENV: 'production' } };
      return { runtime: 'node', framework: 'Node.js/Express', version: '20', build: 'npm install --production', start: 'npm start', env: { NODE_ENV: 'production' } };
    }
    return { runtime: 'zip', framework: 'Archive', version: '1.0', build: 'chmod +x entrypoint.sh 2>/dev/null || true', start: './entrypoint.sh 2>/dev/null || echo "No entrypoint found"', env: {} };
  },

  createInstance: function(project) {
    const id = this.generateId();
    const url = this.generateUrl(project.name);
    const runtimeConfig = this.detectRuntime(project.files || ['package.json']);
    const instance = {
      id, projectId: project.id || id, name: project.name,
      runtime: runtimeConfig.runtime, framework: runtimeConfig.framework,
      version: runtimeConfig.version,
      url, containerId: 'container-' + id.substring(0, 12),
      status: 'creating', port: Math.floor(Math.random() * 50000 + 10000),
      region: ['us-east-1', 'eu-west-1', 'ap-southeast-1'][Math.floor(Math.random() * 3)],
      ssl: false, sslStatus: 'pending',
      cpu: 0, memory: 0, disk: 0,
      healthStatus: 'unknown', healthChecks: 0,
      createdAt: Date.now(), startedAt: null,
      buildLogs: [], deploymentLogs: [],
      envVars: { ...runtimeConfig.env, PORT: String(Math.floor(Math.random() * 50000 + 10000)) },
      domains: [], builds: 0, restarts: 0,
      plan: project.plan || 'starter',
    };
    this._instances[id] = instance;
    this._containers[id] = { id: instance.containerId, status: 'booting', cpu: [], mem: [], logs: [] };
    return instance;
  },

  getInstance: function(id) { return this._instances[id]; },
  getAllInstances: function() { return Object.values(this._instances); },
  getInstancesByProject: function(projectId) { return Object.values(this._instances).filter(i => i.projectId === projectId); },

  executeDeployment: async function(project, callbacks) {
    const addLog = callbacks.onLog || function(){};
    const onProgress = callbacks.onProgress || function(){};
    const onComplete = callbacks.onComplete || function(){};

    const instance = this.createInstance(project);
    const { id } = instance;
    const prefix = `[${instance.runtime.toUpperCase()}]`;

    addLog('system', `🚀 ${prefix} NEXUS Deployment Engine v4.0`);
    addLog('system', `${prefix} Initializing deployment for ${project.name}...`);
    await this.sleep(500);
    addLog('success', `${prefix} Instance ID: ${id}`);
    addLog('success', `${prefix} Region: ${instance.region}`);
    onProgress(5);

    addLog('system', `${prefix} Step 1/8: Detecting runtime environment...`);
    await this.sleep(600);
    addLog('success', `${prefix} Runtime: ${instance.runtime} (${instance.framework} ${instance.version})`);
    addLog('success', `${prefix} Build command: ${instance.build}`);
    addLog('success', `${prefix} Start command: ${instance.start}`);
    onProgress(15);

    addLog('system', `${prefix} Step 2/8: Creating isolated container...`);
    await this.sleep(700);
    addLog('success', `${prefix} Container ${instance.containerId} created`);
    addLog('success', `${prefix} Port mapping: ${instance.port} → 8080`);
    addLog('success', `${prefix} Memory limit: 256 MB`);
    addLog('success', `${prefix} CPU limit: 0.5 cores`);
    onProgress(25);

    addLog('system', `${prefix} Step 3/8: Cloning source code...`);
    await this.sleep(600);
    if (project.method === 'upload') {
      addLog('success', `${prefix} Extracting archive... ${project.files ? project.files.length + ' files' : 'OK'}`);
      addLog('success', `${prefix} Validating project structure... OK`);
    } else if (project.method === 'github') {
      addLog('success', `${prefix} Cloning ${project.repo || project.name}... OK`);
      addLog('success', `${prefix} Branch: ${project.branch || 'main'}`);
    } else {
      addLog('success', `${prefix} Source files prepared`);
    }
    onProgress(35);

    addLog('system', `${prefix} Step 4/8: Installing dependencies...`);
    await this.sleep(400);
    if (instance.runtime === 'python') {
      addLog('output', `${prefix} $ pip install -r requirements.txt`);
      await this.sleep(1200);
      addLog('output', `${prefix} Collecting packages...`);
      addLog('output', `${prefix}   Flask==3.0.0`);
      addLog('output', `${prefix}   gunicorn==21.2.0`);
      addLog('output', `${prefix}   requests==2.31.0`);
      addLog('output', `${prefix}   python-dotenv==1.0.0`);
      addLog('output', `${prefix} Installing collected packages... done`);
      addLog('success', `${prefix} 42 packages installed in 1.2s`);
    } else if (instance.runtime === 'node') {
      addLog('output', `${prefix} $ npm install --production`);
      await this.sleep(1000);
      addLog('output', `${prefix} added 284 packages in 3.2s`);
      addLog('success', `${prefix} 284 packages installed`);
      if (instance.framework === 'Next.js') {
        addLog('output', `${prefix} $ npm run build`);
        await this.sleep(800);
        addLog('output', `${prefix} ✓ Compiled successfully in 2.4s`);
        addLog('success', `${prefix} Build completed`);
      }
    } else if (instance.runtime === 'laravel') {
      addLog('output', `${prefix} $ composer install --no-dev`);
      await this.sleep(800);
      addLog('success', `${prefix} Composer packages installed`);
      addLog('output', `${prefix} $ npm install && npm run build`);
      await this.sleep(600);
      addLog('success', `${prefix} Assets compiled with Vite`);
    }
    onProgress(55);

    addLog('system', `${prefix} Step 5/8: Configuring environment...`);
    await this.sleep(400);
    const envKeys = Object.keys(instance.envVars);
    envKeys.forEach(k => {
      addLog('success', `${prefix} Setting ${k}=${instance.envVars[k].substring(0, 8)}${instance.envVars[k].length > 8 ? '...' : ''}`);
    });
    addLog('success', `${prefix} ${envKeys.length} environment variables configured`);
    onProgress(65);

    addLog('system', `${prefix} Step 6/8: Deploying to edge network...`);
    await this.sleep(500);
    addLog('success', `${prefix} Load balancer: lb-${instance.region}.nexus.internal`);
    addLog('success', `${prefix} Routing traffic to ${instance.url}`);
    addLog('success', `${prefix} CDN cache warming... initiated`);
    onProgress(75);

    addLog('system', `${prefix} Step 7/8: Generating SSL certificate...`);
    await this.sleep(600);
    addLog('output', `${prefix} [Let's Encrypt] Certificate issued for ${instance.url}`);
    addLog('success', `${prefix} SSL: Active (Auto-renew enabled)`);
    instance.ssl = true;
    instance.sslStatus = 'active';
    onProgress(85);

    addLog('system', `${prefix} Step 8/8: Running health checks...`);
    await this.sleep(400);
    addLog('output', `${prefix} Health check 1/3: HTTP GET /health → 200 OK`);
    await this.sleep(300);
    addLog('output', `${prefix} Health check 2/3: WebSocket ping → pong (12ms)`);
    await this.sleep(300);
    addLog('output', `${prefix} Health check 3/3: Database → connected (4ms)`);
    addLog('success', `${prefix} All health checks passed`);
    onProgress(100);

    instance.status = 'running';
    instance.startedAt = Date.now();
    instance.healthStatus = 'healthy';
    instance.healthChecks = 3;
    instance.cpu = 2 + Math.random() * 8;
    instance.memory = 64 + Math.random() * 64;

    addLog('success', `✅ ${prefix} Deployment completed successfully!`);
    addLog('highlight', `🌐 ${instance.url}`);
    addLog('info', `${prefix} Deployment time: ${((Date.now() - instance.createdAt) / 1000).toFixed(1)}s`);

    this._containers[id].status = 'running';
    onComplete(instance);
    return instance;
  },

  restartInstance: async function(id) {
    const inst = this._instances[id];
    if (!inst) return null;
    inst.status = 'restarting';
    inst.restarts++;
    inst.startedAt = null;
    await this.sleep(1500);
    inst.status = 'running';
    inst.startedAt = Date.now();
    inst.healthStatus = 'healthy';
    inst.cpu = 1 + Math.random() * 5;
    return inst;
  },

  stopInstance: async function(id) {
    const inst = this._instances[id];
    if (!inst) return null;
    inst.status = 'stopped';
    inst.healthStatus = 'unknown';
    this._containers[id].status = 'stopped';
    return inst;
  },

  startInstance: async function(id) {
    const inst = this._instances[id];
    if (!inst) return null;
    await this.sleep(1000);
    inst.status = 'running';
    inst.startedAt = Date.now();
    inst.healthStatus = 'healthy';
    this._containers[id].status = 'running';
    return inst;
  },

  deleteInstance: async function(id) {
    const inst = this._instances[id];
    if (!inst) return;
    delete this._instances[id];
    delete this._containers[id];
  },

  scaleInstance: async function(id, factor) {
    const inst = this._instances[id];
    if (!inst) return null;
    inst.status = 'scaling';
    await this.sleep(2000);
    inst.builds = (inst.builds || 1) + 1;
    inst.status = 'running';
    return inst;
  },

  getLogStream: function(id) {
    const container = this._containers[id];
    if (!container) return [];
    const logs = [];
    const lines = Math.floor(Math.random() * 3 + 1);
    for (let i = 0; i < lines; i++) {
      const types = ['info', 'debug', 'request', 'error', 'warn'];
      const msgs = [
        `GET /api/health 200 ${Math.floor(Math.random() * 50 + 2)}ms`,
        `Memory usage: ${Math.floor(64 + Math.random() * 64)} MB / 256 MB`,
        `CPU load: ${(Math.random() * 30 + 1).toFixed(1)}%`,
        `Request served: /api/users`,
        `DB query executed (${Math.floor(Math.random() * 20 + 2)}ms)`,
        `Cache hit rate: ${(87 + Math.random() * 10).toFixed(1)}%`,
        `WebSocket connection established`,
        `Rate limit check: OK (${Math.floor(Math.random() * 500 + 100)} req/min)`,
      ];
      logs.push({
        type: types[Math.floor(Math.random() * types.length)],
        message: msgs[Math.floor(Math.random() * msgs.length)],
        timestamp: new Date().toISOString()
      });
    }
    const prev = container.logs || [];
    container.logs = [...prev, ...logs].slice(-100);
    return logs;
  },

  simulateMetrics: function(id) {
    const inst = this._instances[id];
    if (!inst || inst.status !== 'running') return;
    inst.cpu = Math.max(0.5, Math.min(95, inst.cpu + (Math.random() - 0.5) * 10));
    inst.memory = Math.max(16, Math.min(256, inst.memory + (Math.random() - 0.5) * 16));
    const container = this._containers[id];
    if (container) {
      container.cpu.push(inst.cpu);
      container.mem.push(inst.memory);
      if (container.cpu.length > 60) container.cpu.shift();
      if (container.mem.length > 60) container.mem.shift();
    }
  },

  startMetricsInterval: function(id) {
    if (this._listeners[id]) clearInterval(this._listeners[id]);
    this._listeners[id] = setInterval(() => this.simulateMetrics(id), 3000);
  },

  stopMetricsInterval: function(id) {
    if (this._listeners[id]) { clearInterval(this._listeners[id]); delete this._listeners[id]; }
  },

  // Domain management
  addDomain: function(instanceId, domain) {
    const inst = this._instances[instanceId];
    if (!inst) return null;
    if (!inst.domains) inst.domains = [];
    const d = { id: 'dom-' + this.generateId().substring(0, 12), domain, status: 'pending', verified: false, createdAt: Date.now(), sslStatus: 'pending' };
    inst.domains.push(d);
    setTimeout(() => { d.verified = true; d.status = 'active'; d.sslStatus = 'active'; }, 3000);
    return d;
  },

  removeDomain: function(instanceId, domainId) {
    const inst = this._instances[instanceId];
    if (!inst || !inst.domains) return;
    inst.domains = inst.domains.filter(d => d.id !== domainId);
  },

  verifyDomain: function(instanceId, domainId) {
    return { success: true, records: [{ type: 'CNAME', name: '@', value: `${instanceId}.nexus.internal`, ttl: 300 }] };
  },

  getDeploymentStatus: function(id) {
    const inst = this._instances[id];
    if (!inst) return null;
    const uptime = inst.startedAt ? Math.floor((Date.now() - inst.startedAt) / 1000) : 0;
    return {
      id: inst.id, name: inst.name, url: inst.url,
      status: inst.status, runtime: inst.runtime, framework: inst.framework,
      region: inst.region, containerId: inst.containerId, port: inst.port,
      ssl: inst.ssl, sslStatus: inst.sslStatus,
      cpu: Math.round(inst.cpu * 10) / 10,
      memory: Math.round(inst.memory),
      healthStatus: inst.healthStatus,
      uptime, restarts: inst.restarts, builds: inst.builds || 0,
      createdAt: inst.createdAt, startedAt: inst.startedAt,
    };
  }
};

window.NexusFS = {
  createProject: function(name, runtime, method, files, repo) {
    const id = 'proj-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    return { id, name, runtime, method, files: files || [], repo, createdAt: Date.now(), deployments: 0, status: 'ready' };
  }
};
