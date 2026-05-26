let currentUser = null;
let tabs = [];
let activeTabId = 1;
let tabCounter = 1;
let splitMode = false;
let commandHistory = [];
let historyIndex = -1;
let startTime = Date.now();
let uptimeInterval = null;

const TERMINAL_PROMPT = 'root@nexus:~$';

const AI_SUGGESTIONS = [
  { cmd: 'help', desc: 'List available commands' },
  { cmd: 'deploy --list', desc: 'List active deployments' },
  { cmd: 'pm2 list', desc: 'Show all running processes' },
  { cmd: 'docker ps', desc: 'List running containers' },
  { cmd: 'node -v', desc: 'Check Node.js version' },
  { cmd: 'python --version', desc: 'Check Python version' },
  { cmd: 'php -v', desc: 'Check PHP version' },
  { cmd: 'composer install', desc: 'Install PHP dependencies' },
  { cmd: 'npm install', desc: 'Install Node dependencies' },
  { cmd: 'pip install -r requirements.txt', desc: 'Install Python dependencies' },
  { cmd: 'nginx restart', desc: 'Restart NGINX server' },
  { cmd: 'systemctl status', desc: 'Check system services' },
  { cmd: 'df -h', desc: 'Check disk usage' },
  { cmd: 'free -m', desc: 'Check memory usage' },
  { cmd: 'top -bn1', desc: 'Show running processes' },
  { cmd: 'git pull', desc: 'Pull latest code' },
  { cmd: 'git status', desc: 'Check git status' },
  { cmd: 'tail -f /var/log/nginx/error.log', desc: 'Watch error logs' },
  { cmd: 'journalctl -xe', desc: 'Check system logs' },
  { cmd: 'curl -I https://example.com', desc: 'Check HTTP headers' }
];

const COMMAND_RESPONSES = {
  help: () => [
    { text: 'Available commands:', type: 'system' },
    ...AI_SUGGESTIONS.map(s => ({ text: `  ${s.cmd.padEnd(40)} ${s.desc}`, type: 'output' })),
    { text: '', type: 'output' },
    { text: '  nexus:deploy          Deploy current project', type: 'output' },
    { text: '  nexus:status         Show deployment status', type: 'output' },
    { text: '  nexus:logs           Show application logs', type: 'output' },
    { text: '  nexus:restart        Restart application', type: 'output' },
    { text: '  nexus:scale <n>      Scale to N instances', type: 'output' },
    { text: '  nexus:env            List environment variables', type: 'output' },
    { text: '  clear                Clear terminal', type: 'output' },
    { text: '  exit                 Close terminal session', type: 'output' },
  ],
  clear: () => [],
  exit: () => [{ text: 'Session terminated. Press any key to reconnect.', type: 'warning' }],
  'nexus:status': () => [
    { text: '⚡ NEXUS HOSTING — Deployment Status', type: 'system' },
    { text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', type: 'output' },
    { text: '  Application:    nexus-bot-prod (v2.4.1)', type: 'output' },
    { text: '  Runtime:        Node.js 20.11.0', type: 'output' },
    { text: '  Region:         us-east-1', type: 'output' },
    { text: '  Status:         ● Running', type: 'success' },
    { text: '  Uptime:         14d 7h 32m', type: 'output' },
    { text: '  Memory:         128 MB / 256 MB', type: 'output' },
    { text: '  CPU:            23%', type: 'output' },
    { text: '  Requests:       14,892 (24h)', type: 'output' },
    { text: '  Errors:         23 (0.15%)', type: 'output' },
  ],
  'nexus:logs': () => {
    const logs = [
      '[2026-05-26 10:23:45] INFO  Server started on port 8080',
      '[2026-05-26 10:23:46] INFO  Connected to database postgresql://prod-slave-1',
      '[2026-05-26 10:23:47] WARN  Rate limit approaching threshold (980/1000)',
      '[2026-05-26 10:23:48] INFO  Health check passed (200 OK)',
      '[2026-05-26 10:23:50] INFO  Redis cache hit ratio: 94.2%',
      '[2026-05-26 10:23:52] ERROR Request timeout on /api/analytics/aggregate',
      '[2026-05-26 10:23:53] INFO  Retrying analytics query (attempt 2/3)',
      '[2026-05-26 10:23:54] INFO  Analytics query completed (1.2s)',
      '[2026-05-26 10:23:55] INFO  Webhook delivered to https://hooks.slack.com/nexus',
      '[2026-05-26 10:23:56] INFO  Schedule trigger: daily-backup starting',
    ];
    return logs.map(l => {
      if (l.includes('ERROR')) return { text: l, type: 'error' };
      if (l.includes('WARN')) return { text: l, type: 'warning' };
      return { text: l, type: 'output' };
    });
  },
  'nexus:restart': () => [
    { text: '♻ Restarting application...', type: 'system' },
    { text: '  Stopping process nexus-bot-prod...', type: 'output' },
    { text: '  Process stopped gracefully.', type: 'success' },
    { text: '  Starting process nexus-bot-prod...', type: 'output' },
    { text: '  Health check: OK (200)', type: 'success' },
    { text: '  Application restarted successfully in 2.3s', type: 'success' },
  ],
  'nexus:scale': (args) => [
    { text: `📦 Scaling to ${args[0] || 3} instances...`, type: 'system' },
    { text: '  Provisioning new container...', type: 'output' },
    { text: '  Load balancer updated.', type: 'output' },
    { text: `  Scale completed: ${args[0] || 3} instances running`, type: 'success' },
  ],
  'nexus:deploy': () => [
    { text: '🚀 NEXUS Deploy Engine v3.2', type: 'system' },
    { text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', type: 'output' },
    { text: '  [1/6] Cloning repository...', type: 'output' },
    { text: '  ✓ Repository cloned (main@2a4f8c1)', type: 'success' },
    { text: '  [2/6] Detecting runtime...', type: 'output' },
    { text: '  ✓ Runtime detected: Node.js 20.x', type: 'success' },
    { text: '  [3/6] Installing dependencies...', type: 'output' },
    { text: '  ✓ Dependencies installed (142 packages)', type: 'success' },
    { text: '  [4/6] Building application...', type: 'output' },
    { text: '  ✓ Build completed (4.2s)', type: 'success' },
    { text: '  [5/6] Running tests...', type: 'output' },
    { text: '  ✓ All 47 tests passed', type: 'success' },
    { text: '  [6/6] Deploying to edge...', type: 'output' },
    { text: '  ✓ Deployed to 12 edge locations', type: 'success' },
    { text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', type: 'output' },
    { text: '  URL: https://bot-42.nexus-host.app', type: 'info' },
    { text: '  SSL: Active (Let\'s Encrypt)', type: 'success' },
  ],
  'nexus:env': () => [
    { text: '📋 Environment Variables', type: 'system' },
    { text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', type: 'output' },
    { text: '  NODE_ENV=production', type: 'output' },
    { text: '  DATABASE_URL=postgresql://***@prod-slave-1:5432/nexus', type: 'output' },
    { text: '  REDIS_URL=redis://***@cache-1:6379', type: 'output' },
    { text: '  API_KEY=sk-nexus-***', type: 'output' },
    { text: '  SENTRY_DSN=https://***@sentry.io/nexus', type: 'output' },
    { text: '  LOG_LEVEL=info', type: 'output' },
    { text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', type: 'output' },
    { text: '  6 variables (4 encrypted)', type: 'output' },
  ],
  'pm2 list': () => [
    { text: '┌─────┬────────────────────┬──────────┬────────┬──────┐', type: 'output' },
    { text: '│ id  │ name               │ mode     │ status │ cpu   │', type: 'output' },
    { text: '├─────┼────────────────────┼──────────┼────────┼──────┤', type: 'output' },
    { text: '│ 0   │ nexus-bot-prod     │ fork     │ online │ 2.3%  │', type: 'output' },
    { text: '│ 1   │ nexus-bot-worker   │ fork     │ online │ 1.1%  │,', type: 'output' },
    { text: '│ 2   │ nexus-cron         │ fork     │ online │ 0.4%  │', type: 'output' },
    { text: '│ 3   │ nexus-api-gateway  │ cluster  │ online │ 5.7%  │', type: 'output' },
    { text: '└─────┴────────────────────┴──────────┴────────┴──────┘', type: 'output' },
  ],
  'docker ps': () => [
    { text: 'CONTAINER ID   IMAGE                  STATUS          PORTS                    NAMES', type: 'output' },
    { text: 'a1b2c3d4e5f6   nexus/app:latest        Up 14 days      0.0.0.0:8080->8080/tcp   nexus-bot-prod', type: 'output' },
    { text: 'b2c3d4e5f6a7   postgres:16             Up 14 days      0.0.0.0:5432->5432/tcp   nexus-db', type: 'output' },
    { text: 'c3d4e5f6a7b8   redis:7-alpine          Up 14 days      0.0.0.0:6379->6379/tcp   nexus-cache', type: 'output' },
    { text: 'd4e5f6a7b8c9   nexus/worker:latest     Up 14 days                                nexus-worker', type: 'output' },
  ],
  'free -m': () => [
    { text: '               total        used        free      shared  buff/cache   available', type: 'output' },
    { text: 'Mem:           1986         723         412          32         851        1024', type: 'output' },
    { text: 'Swap:          1024          12        1012', type: 'output' },
  ],
  'df -h': () => [
    { text: 'Filesystem      Size  Used Avail Use% Mounted on', type: 'output' },
    { text: '/dev/sda1        50G   18G   32G  36% /', type: 'output' },
    { text: 'overlay          50G   18G   32G  36% /app', type: 'output' },
  ],
  'systemctl status': () => [
    { text: '● nexus-bot.service - NEXUS Bot Application', type: 'success' },
    { text: '   Loaded: loaded (/etc/systemd/system/nexus-bot.service; enabled)', type: 'output' },
    { text: '   Active: active (running) since Mon 2026-05-12 03:14:15 UTC', type: 'output' },
    { text: '   Process: 1423 ExecStart=/usr/bin/node /app/server.js', type: 'output' },
    { text: '   Memory: 128.4M', type: 'output' },
    { text: '   CPU: 2h 14m 32s', type: 'output' },
  ],
};

function getDefaultCommands() { return COMMAND_RESPONSES; }

(function waitForFirebase(attempts) {
  if (window.NEXUS_INITIALIZED && window.auth) {
    window.auth.onAuthStateChanged(function(user) {
      if (user) { currentUser = user; initTerminal(); }
      else { window.location.href = 'login.html'; }
    });
    return;
  }
  if (attempts > 20) {
    currentUser = { uid: 'dev', displayName: 'Dev User', email: 'dev@nexus.host' };
    initTerminal();
    return;
  }
  setTimeout(function() { waitForFirebase(attempts + 1); }, 500);
})(0);

function initTerminal() {
  displayUserInfo();
  createTab('bash', true);
  renderTabs();
  setupInput();
  startUptime();
  renderAiSuggestions();
}

function displayUserInfo() {
  if (!currentUser) return;
  const names = ['termUserName', 'termUserAvatar'];
  const emails = ['termUserEmail'];
  document.getElementById('termUserName').textContent = currentUser.displayName || 'Dev User';
  document.getElementById('termUserEmail').textContent = currentUser.email || 'dev@nexus.host';
  document.getElementById('termUserAvatar').textContent = (currentUser.displayName || 'U')[0].toUpperCase();
}

function createTab(name, active) {
  const id = tabCounter++;
  const tab = { id, name, lines: [{ text: `NEXUS Terminal — ${name} session`, type: 'system' }, { text: `Type 'help' for available commands.`, type: 'output' }], input: '' };
  tabs.push(tab);
  if (active) activeTabId = id;
  return id;
}

function renderTabs() {
  const container = document.getElementById('terminalTabs');
  container.innerHTML = tabs.map(t => `
    <div class="terminal-tab ${t.id === activeTabId ? 'active' : ''}" onclick="switchTab(${t.id})">
      <span>${t.name}</span>
      <span class="close-tab" onclick="event.stopPropagation();closeTab(${t.id})">✕</span>
    </div>
  `).join('');
}

function switchTab(id) {
  activeTabId = id;
  renderTabs();
  renderOutput();
  syncInput();
}

function closeTab(id) {
  if (tabs.length <= 1) { addLine(activeTabId, { text: 'Cannot close last tab.', type: 'warning' }); return; }
  tabs = tabs.filter(t => t.id !== id);
  if (activeTabId === id) activeTabId = tabs[tabs.length - 1].id;
  renderTabs();
  renderOutput();
  syncInput();
}

function newTab() {
  const names = ['bash', 'zsh', 'sh', 'node', 'python', 'php'];
  const name = names[tabCounter % names.length];
  createTab(name, true);
  renderTabs();
  renderOutput();
  syncInput();
}

function renderOutput() {
  const tab = getActiveTab();
  if (!tab) return;
  const container = document.getElementById('termOutput');
  container.innerHTML = tab.lines.map(l => `<div class="line ${l.type}">${escapeHtml(l.text)}</div>`).join('');
  container.scrollTop = container.scrollHeight;
}

function getActiveTab() { return tabs.find(t => t.id === activeTabId); }

function addLine(tabId, line) {
  const tab = tabs.find(t => t.id === tabId);
  if (tab) tab.lines.push(line);
}

function syncInput() {
  const tab = getActiveTab();
  const input = document.getElementById('termInput');
  if (tab) input.value = tab.input || '';
  input.focus();
}

function setupInput() {
  const input = document.getElementById('termInput');
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      const cmd = this.value.trim();
      if (!cmd) return;
      executeCommand(cmd);
      this.value = '';
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      historyIndex = Math.max(0, historyIndex === -1 ? commandHistory.length - 1 : historyIndex - 1);
      this.value = commandHistory[historyIndex];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      historyIndex = Math.min(commandHistory.length - 1, historyIndex + 1);
      this.value = commandHistory[historyIndex] || '';
      if (historyIndex >= commandHistory.length - 1) { historyIndex = -1; this.value = ''; }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const partial = this.value.trim().toLowerCase();
      const match = AI_SUGGESTIONS.find(s => s.cmd.startsWith(partial) && s.cmd !== partial);
      if (match) this.value = match.cmd + ' ';
    }
  });
  document.addEventListener('click', function() { input.focus(); });
}

function executeCommand(cmd) {
  const tab = getActiveTab();
  if (!tab) return;

  commandHistory.push(cmd);
  historyIndex = -1;
  addLine(tab.id, { text: `${TERMINAL_PROMPT} ${cmd}`, type: 'input' });

  const lower = cmd.toLowerCase().trim();
  const parts = lower.split(/\s+/);
  const baseCmd = parts[0];
  const args = parts.slice(1);

  if (COMMAND_RESPONSES[lower]) {
    const lines = COMMAND_RESPONSES[lower]();
    lines.forEach(l => addLine(tab.id, l));
  } else if (COMMAND_RESPONSES[baseCmd]) {
    const lines = COMMAND_RESPONSES[baseCmd](args);
    lines.forEach(l => addLine(tab.id, l));
  } else if (baseCmd === 'cd') {
    addLine(tab.id, { text: `  ✓ Directory changed to ${args[0] || '/home'}`, type: 'success' });
  } else if (baseCmd === 'ls' || baseCmd === 'll' || baseCmd === 'la') {
    const files = ['package.json', 'src/', 'node_modules/', '.env', 'config/', 'public/', 'server.js', 'README.md'];
    addLine(tab.id, { text: files.join('  '), type: 'output' });
  } else if (baseCmd === 'cat' && args[0]) {
    addLine(tab.id, { text: `// ${args[0]} — file contents not available in terminal`, type: 'warning' });
  } else if (baseCmd === 'echo') {
    addLine(tab.id, { text: args.join(' '), type: 'output' });
  } else if (baseCmd === 'node' && args[0] === '-v') {
    addLine(tab.id, { text: 'v20.11.0', type: 'output' });
  } else if (baseCmd === 'python' && (args[0] === '--version' || args[0] === '-V')) {
    addLine(tab.id, { text: 'Python 3.12.2', type: 'output' });
  } else if (baseCmd === 'php' && args[0] === '-v') {
    addLine(tab.id, { text: 'PHP 8.3.6', type: 'output' });
  } else if (baseCmd === 'npm' && args[0] === '-v') {
    addLine(tab.id, { text: '10.5.0', type: 'output' });
  } else if (baseCmd === 'whoami') {
    addLine(tab.id, { text: currentUser ? (currentUser.displayName || 'root') : 'root', type: 'output' });
  } else if (baseCmd === 'pwd') {
    addLine(tab.id, { text: '/home/nexus/projects/current', type: 'output' });
  } else if (baseCmd === 'date') {
    addLine(tab.id, { text: new Date().toString(), type: 'output' });
  } else if (baseCmd === 'uname' || baseCmd === 'uname -a') {
    addLine(tab.id, { text: 'Linux nexus-bot-4a2f 6.2.0 #1 SMP PREEMPT x86_64 GNU/Linux', type: 'output' });
  } else if (baseCmd === 'uptime') {
    const seconds = Math.floor((Date.now() - startTime) / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    addLine(tab.id, { text: `  ${days}d ${hours}h ${mins}m`, type: 'output' });
  } else if (baseCmd === 'ping' && args[0]) {
    addLine(tab.id, { text: `PING ${args[0]} (142.250.80.46): 56 data bytes`, type: 'output' });
    for (let i = 0; i < 3; i++) {
      addLine(tab.id, { text: `  64 bytes from 142.250.80.46: icmp_seq=${i+1} ttl=118 time=${(12 + Math.random() * 8).toFixed(1)} ms`, type: 'output' });
    }
  } else if (baseCmd === 'curl' && args[0]) {
    addLine(tab.id, { text: `HTTP/1.1 200 OK`, type: 'output' });
    addLine(tab.id, { text: `Content-Type: application/json`, type: 'output' });
    addLine(tab.id, { text: `{"status":"ok","uptime":"14d","version":"2.4.1"}`, type: 'output' });
  } else if (lower === 'clear' || lower === 'cls') {
    tab.lines = [];
  } else if (lower === 'exit') {
    closeTab(activeTabId);
  } else if (!lower) {
    return;
  } else {
    addLine(tab.id, { text: `  Command not found: ${baseCmd}. Type 'help' for available commands.`, type: 'error' });
  }

  renderOutput();
}

function clearTerminal() {
  const tab = getActiveTab();
  if (tab) tab.lines = [];
  renderOutput();
}

function toggleSplit() {
  splitMode = !splitMode;
  const btn = document.getElementById('splitBtn');
  btn.classList.toggle('active', splitMode);
  const body = document.getElementById('termBody');
  const existing = document.querySelector('.term-split');
  if (splitMode && !existing) {
    const split = document.createElement('div');
    split.className = 'term-split';
    split.innerHTML = `<div class="term-output" id="termSplitOutput"><div class="line system">Split terminal — monitoring session</div></div>`;
    body.insertBefore(split, document.getElementById('termAiPanel'));
  } else if (!splitMode && existing) {
    existing.remove();
  }
}

function renderAiSuggestions() {
  const list = document.getElementById('termAiList');
  list.innerHTML = AI_SUGGESTIONS.slice(0, 8).map(s => `
    <div class="term-ai-item" onclick="insertCommand('${s.cmd}')">
      <div class="cmd">$ ${s.cmd}</div>
      <div class="desc">${s.desc}</div>
    </div>
  `).join('');
}

function insertCommand(cmd) {
  const input = document.getElementById('termInput');
  input.value = cmd;
  input.focus();
}

function startUptime() {
  uptimeInterval = setInterval(() => {
    const seconds = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    document.getElementById('termUptime').textContent = `Uptime: ${m}m ${s}s`;
  }, 1000);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function toggleTermUserMenu() {}
