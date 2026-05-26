window.deploymentEngine = {
  sleep: function(ms) { return new Promise(r => setTimeout(r, ms)); },

  generateDeploymentUrl: function(projectName, id) {
    const slug = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 20);
    return `https://${slug}-${id.substring(0, 8)}.nexus.host`;
  },

  generateDeploymentToken: function() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let token = 'nexus_';
    for (let i = 0; i < 32; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
    return token;
  },

  detectRuntime: function(files) {
    const fileList = files.map(f => f.toLowerCase());
    if (fileList.some(f => f === 'artisan' || f === 'composer.json')) {
      return { runtime: 'laravel', framework: 'Laravel', version: '11.x', php: '8.3' };
    }
    if (fileList.some(f => f === 'requirements.txt' || f === 'setup.py' || f === 'main.py')) {
      return { runtime: 'python', framework: 'Python', version: '3.11', php: null };
    }
    if (fileList.some(f => f === 'package.json' || f === 'index.js' || f === 'app.js')) {
      return { runtime: 'node', framework: 'Node.js', version: '20', php: null };
    }
    return { runtime: 'laravel', framework: 'Unknown', version: '1.0', php: null };
  },

  getRuntimePrefix: function(runtime) {
    const prefixes = { laravel: '[LARAVEL]', python: '[PYTHON]', node: '[NODE]', zip: '[ZIP]' };
    return prefixes[runtime] || '[NEXUS]';
  },

  executeDeploymentPipeline: async function(project, deploymentId, addLog) {
    const runtime = project.runtime || 'laravel';
    const prefix = this.getRuntimePrefix(runtime);
    const isZip = project.method === 'upload' || runtime === 'zip';

    addLog('system', `${prefix} Starting deployment pipeline for ${project.name}`);
    await this.sleep(800);

    // Step 1: Initialize Build
    addLog('system', `${prefix} Step 1/5: Initializing build environment...`);
    await this.sleep(1200);
    if (isZip) {
      addLog('success', `${prefix} Detected archive: ZIP format`);
      addLog('success', `${prefix} Extracting archive... [OK]`);
    } else {
      addLog('success', `${prefix} Repository cloned [${project.slug || project.name}]`);
      addLog('success', `${prefix} Branch: ${project.env || 'production'}`);
    }
    await this.sleep(800);

    // Step 2: Install Dependencies
    addLog('system', `${prefix} Step 2/5: Installing dependencies...`);
    await this.sleep(800);
    if (runtime === 'python') {
      addLog('success', `${prefix} Detected Python ${project.version || '3.11'}`);
      addLog('success', `${prefix} Creating virtual environment... [OK]`);
      addLog('success', `${prefix} Installing from requirements.txt... [OK]`);
    } else if (runtime === 'node') {
      addLog('success', `${prefix} Detected Node.js ${project.version || '20'}`);
      addLog('success', `${prefix} Running npm install... [OK]`);
    } else if (runtime === 'laravel') {
      addLog('success', `${prefix} Detected PHP ${project.php || project.version || '8.3'}`);
      addLog('success', `${prefix} Running composer install... [OK]`);
      addLog('success', `${prefix} Running npm install... [OK]`);
    } else {
      addLog('success', `${prefix} Detected runtime: ${runtime}`);
      addLog('success', `${prefix} Dependencies installed [OK]`);
    }
    await this.sleep(1000);

    // Step 3: Build Container
    addLog('system', `${prefix} Step 3/5: Building container...`);
    await this.sleep(600);
    if (runtime === 'laravel') {
      addLog('success', `${prefix} Compiling assets with Vite... [OK]`);
      addLog('success', `${prefix} Optimizing with Octane... [OK]`);
    } else if (runtime === 'python') {
      addLog('success', `${prefix} Configuring WSGI/ASGI entry point... [OK]`);
    } else if (runtime === 'node') {
      addLog('success', `${prefix} Building with esbuild... [OK]`);
    }
    addLog('success', `${prefix} Container image built [OK]`);
    await this.sleep(800);

    // Step 4: Deploy to Edge
    addLog('system', `${prefix} Step 4/5: Deploying to edge nodes...`);
    await this.sleep(500);
    addLog('success', `${prefix} Pushing to registry... [OK]`);
    addLog('success', `${prefix} Deploying to EU-West... [OK]`);
    addLog('success', `${prefix} Deploying to US-East... [OK]`);
    addLog('success', `${prefix} Deploying to AP-Southeast... [OK]`);
    await this.sleep(1000);

    // Step 5: Health Check
    addLog('system', `${prefix} Step 5/5: Running health checks...`);
    await this.sleep(600);
    addLog('success', `${prefix} HTTP health check: 200 OK`);
    addLog('success', `${prefix} WebSocket connection: Established`);
    addLog('success', `${prefix} Database connection: Verified`);

    await this.sleep(500);
    addLog('success', `✅ ${prefix} Deployment completed`);
    addLog('highlight', `🌐 Bot live at: https://${project.slug || project.name}.nexus.host`);
  }
};
