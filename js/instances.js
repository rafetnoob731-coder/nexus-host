let currentUser = null;
let refreshInterval = null;

(function waitForFirebase(attempts) {
  if (window.NEXUS_INITIALIZED && window.auth) {
    window.auth.onAuthStateChanged(function(user) {
      if (user) { currentUser = user; initInstances(); }
      else { window.location.href = 'login.html'; }
    });
    return;
  }
  if (attempts > 20) {
    currentUser = { uid: 'dev', displayName: 'Dev User', email: 'dev@nexus.host' };
    initInstances();
    return;
  }
  setTimeout(function() { waitForFirebase(attempts + 1); }, 500);
})(0);

function initInstances() {
  displayUserInfo();

  if (window.NexusDeployment.getAllInstances().length === 0) {
    const sample = [
      { name: 'nexus-api-gateway', runtime: 'node', method: 'github', env: 'production', plan: 'pro' },
      { name: 'bot-worker', runtime: 'python', method: 'github', env: 'production', plan: 'pro' },
    ];
    sample.forEach(p => {
      const inst = window.NexusDeployment.createInstance(p);
      inst.status = 'running';
      inst.startedAt = Date.now() - Math.random() * 86400000;
      inst.healthStatus = 'healthy';
      inst.healthChecks = 3;
      inst.cpu = 5 + Math.random() * 20;
      inst.memory = 64 + Math.random() * 96;
      inst.ssl = true;
      inst.sslStatus = 'active';
      inst.builds = Math.floor(Math.random() * 5 + 1);
      inst.domains = [{ id: 'dom-1', domain: `${inst.url}`, status: 'active', verified: true, sslStatus: 'active' }];
      window.NexusDeployment.startMetricsInterval(inst.id);
    });
  }

  renderInstances();
  refreshInterval = setInterval(() => {
    window.NexusDeployment.getAllInstances().forEach(i => renderInstanceCard(i));
    updateStats();
  }, 3000);
}

function displayUserInfo() {
  if (!currentUser) return;
  document.getElementById('inUserName').textContent = currentUser.displayName || 'Dev User';
  document.getElementById('inUserEmail').textContent = currentUser.email || 'dev@nexus.host';
  document.getElementById('inUserAvatar').textContent = (currentUser.displayName || 'U')[0].toUpperCase();
}

function renderInstances() {
  const instances = window.NexusDeployment.getAllInstances();
  const container = document.getElementById('inGrid');
  const empty = document.getElementById('inEmpty');

  if (instances.length === 0) {
    container.innerHTML = '';
    container.appendChild(empty);
    empty.style.display = 'block';
    updateStats();
    return;
  }

  empty.style.display = 'none';
  container.innerHTML = '';
  instances.forEach(i => {
    const card = createInstanceCard(i);
    container.appendChild(card);
  });
  updateStats();
}

function createInstanceCard(inst) {
  const div = document.createElement('div');
  div.className = 'in-card';
  div.id = `instance-${inst.id}`;
  const runtimeColor = { python: '#FFD43B', node: '#F7DF1E', laravel: '#00F0FF', zip: '#7B61FF' };
  const color = runtimeColor[inst.runtime] || 'var(--nexus-cyan)';
  const uptime = inst.startedAt ? formatUptime(Math.floor((Date.now() - inst.startedAt) / 1000)) : '-';
  const cpuPct = Math.min(100, Math.round((inst.cpu || 0) / 100 * 100));
  const memPct = Math.min(100, Math.round((inst.memory || 0) / 256 * 100));

  div.innerHTML = `
    <div class="in-card-header">
      <div>
        <div class="in-card-name">${escHtml(inst.name)}</div>
        <div class="in-card-url">${inst.url}</div>
      </div>
      <span class="in-status ${inst.status}">${inst.status}</span>
    </div>
    <div class="in-card-body">
      <div class="in-metrics">
        <div class="in-metric">
          <div class="metric-label">CPU <span class="metric-val" id="cpu-${inst.id}">${(inst.cpu || 0).toFixed(1)}%</span></div>
          <div class="metric-bar"><div class="fill cyan" style="width:${cpuPct}%" id="cpuBar-${inst.id}"></div></div>
        </div>
        <div class="in-metric">
          <div class="metric-label">Memory <span class="metric-val" id="mem-${inst.id}">${Math.round(inst.memory || 0)} MB</span></div>
          <div class="metric-bar"><div class="fill purple" style="width:${memPct}%" id="memBar-${inst.id}"></div></div>
        </div>
      </div>
      <div class="in-details">
        <div class="det-row"><span class="det-label">Runtime</span><span class="det-val" style="color:${color}">${inst.framework || inst.runtime}</span></div>
        <div class="det-row"><span class="det-label">Container</span><span class="det-val">${inst.containerId.substring(0, 16)}</span></div>
        <div class="det-row"><span class="det-label">Region</span><span class="det-val">${inst.region}</span></div>
        <div class="det-row"><span class="det-label">Port</span><span class="det-val">${inst.port}</span></div>
        <div class="det-row"><span class="det-label">SSL</span><span class="det-val" style="color:${inst.ssl ? '#10B981' : '#ffab00'}">${inst.ssl ? 'Active' : 'Pending'}</span></div>
        <div class="det-row"><span class="det-label">Uptime</span><span class="det-val">${uptime}</span></div>
        <div class="det-row"><span class="det-label">Health</span><span class="det-val" style="color:${inst.healthStatus === 'healthy' ? '#10B981' : '#ffab00'}">${inst.healthStatus}</span></div>
        <div class="det-row"><span class="det-label">Builds</span><span class="det-val">${inst.builds || 0}</span></div>
      </div>
    </div>
    <div class="in-card-actions">
      <button class="in-action primary" onclick="window.open('https://${inst.url}', '_blank')">🌐 Visit</button>
      ${inst.status === 'running' ? `<button class="in-action" onclick="restartInstance('${inst.id}')">↻ Restart</button>` : ''}
      ${inst.status === 'stopped' ? `<button class="in-action success" onclick="startInstance('${inst.id}')">▶ Start</button>` : ''}
      ${inst.status === 'running' ? `<button class="in-action" onclick="stopInstance('${inst.id}')">⏹ Stop</button>` : ''}
      <button class="in-action" onclick="scaleInstance('${inst.id}')">📈 Scale</button>
      <button class="in-action" onclick="viewLogs('${inst.id}')">📋 Logs</button>
      <button class="in-action danger" onclick="confirmDelete('${inst.id}')">✕ Delete</button>
    </div>
  `;
  return div;
}

function renderInstanceCard(inst) {
  const existing = document.getElementById(`instance-${inst.id}`);
  if (!existing) return;
  const cpuPct = Math.min(100, Math.round((inst.cpu || 0) / 100 * 100));
  const memPct = Math.min(100, Math.round((inst.memory || 0) / 256 * 100));

  const cpuEl = document.getElementById(`cpu-${inst.id}`);
  const cpuBar = document.getElementById(`cpuBar-${inst.id}`);
  const memEl = document.getElementById(`mem-${inst.id}`);
  const memBar = document.getElementById(`memBar-${inst.id}`);
  if (cpuEl) cpuEl.textContent = (inst.cpu || 0).toFixed(1) + '%';
  if (cpuBar) cpuBar.style.width = cpuPct + '%';
  if (memEl) memEl.textContent = Math.round(inst.memory || 0) + ' MB';
  if (memBar) memBar.style.width = memPct + '%';

  const statusEl = existing.querySelector('.in-status');
  if (statusEl) {
    statusEl.className = `in-status ${inst.status}`;
    statusEl.textContent = inst.status;
  }

  const uptime = inst.startedAt ? formatUptime(Math.floor((Date.now() - inst.startedAt) / 1000)) : '-';
  const details = existing.querySelectorAll('.det-val');
  if (details.length >= 6) details[5].textContent = uptime;
}

function updateStats() {
  const all = window.NexusDeployment.getAllInstances();
  const running = all.filter(i => i.status === 'running');
  const stopped = all.filter(i => i.status === 'stopped');
  const domains = all.reduce((s, i) => s + (i.domains ? i.domains.length : 0), 0);
  document.getElementById('statTotal').textContent = all.length;
  document.getElementById('statRunning').textContent = running.length;
  document.getElementById('statStopped').textContent = stopped.length;
  document.getElementById('statDomains').textContent = domains;
}

async function restartInstance(id) {
  const btn = event.target;
  btn.textContent = '↻ Restarting...';
  btn.disabled = true;
  await window.NexusDeployment.restartInstance(id);
  const inst = window.NexusDeployment.getInstance(id);
  renderInstanceCard(inst);
  btn.textContent = '↻ Restart';
  btn.disabled = false;
  showToast('success', `Instance ${inst.name} restarted`);
}

async function stopInstance(id) {
  const inst = window.NexusDeployment.getInstance(id);
  inst.status = 'stopped';
  renderInstanceCard(inst);
  updateStats();
  window.NexusDeployment.stopMetricsInterval(id);
  showToast('info', `Instance ${inst.name} stopped`);
}

async function startInstance(id) {
  await window.NexusDeployment.startInstance(id);
  const inst = window.NexusDeployment.getInstance(id);
  renderInstanceCard(inst);
  updateStats();
  window.NexusDeployment.startMetricsInterval(id);
  showToast('success', `Instance ${inst.name} started`);
}

async function scaleInstance(id) {
  const inst = window.NexusDeployment.getInstance(id);
  showToast('info', `Scaling ${inst.name}...`);
  inst.status = 'scaling';
  renderInstanceCard(inst);
  await window.NexusDeployment.scaleInstance(id);
  renderInstanceCard(inst);
  updateStats();
  showToast('success', `${inst.name} scaled to ${(inst.builds || 1) + 1} instances`);
}

function confirmDelete(id) {
  const inst = window.NexusDeployment.getInstance(id);
  document.getElementById('confirmTitle').textContent = `Delete "${inst.name}"?`;
  document.getElementById('confirmText').textContent = `This will permanently delete the instance and all associated data. This action cannot be undone.`;
  const btn = document.getElementById('confirmActionBtn');
  btn.onclick = async function() {
    document.getElementById('confirmModal').style.display = 'none';
    showToast('info', `Deleting ${inst.name}...`);
    await window.NexusDeployment.deleteInstance(id);
    renderInstances();
    showToast('success', 'Instance deleted permanently');
  };
  btn.className = 'btn btn-danger btn-sm';
  btn.textContent = 'Delete Permanently';
  document.getElementById('confirmModal').style.display = 'flex';
}

function viewLogs(id) {
  const inst = window.NexusDeployment.getInstance(id);
  if (!inst) return;
  document.getElementById('logModalTitle').textContent = `Logs: ${inst.name}`;
  const content = document.getElementById('logModalContent');
  const logs = window.NexusDeployment.getLogStream(id);
  content.innerHTML = logs.map(l => {
    const ts = new Date(l.timestamp).toLocaleTimeString();
    return `<div class="log-entry"><span class="ts">[${ts}]</span><span class="msg ${l.type}">${escHtml(l.message)}</span></div>`;
  }).join('') || '<div style="color:rgba(255,255,255,0.2)">No logs available</div>';
  document.getElementById('logModal').style.display = 'flex';
}

function formatUptime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${seconds % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function showToast(type, msg) {
  const container = document.getElementById('inToastContainer');
  if (!container) {
    const c = document.createElement('div');
    c.id = 'inToastContainer';
    c.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:999;display:flex;flex-direction:column;gap:0.5rem';
    document.body.appendChild(c);
  }
  const toast = document.createElement('div');
  toast.style.cssText = `padding:0.75rem 1.25rem;border-radius:10px;font-size:0.82rem;font-weight:500;background:rgba(0,0,0,0.85);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.06);color:${type === 'success' ? '#10B981' : type === 'info' ? '#00F0FF' : '#ffab00'};animation:toastIn 0.3s ease;box-shadow:0 8px 32px rgba(0,0,0,0.5)`;
  toast.textContent = msg;
  document.getElementById('inToastContainer').appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function toggleInUserMenu() {}
