let currentUser = null;
let currentProjectId = null;
let currentProjects = {};
let allDeployments = {};
let allDatabases = {};
let allDomains = {};
let allTickets = {};
let apiTokens = [];
let autoScroll = true;
let monitorData = { cpu: [], memory: [], labels: [] };
let monitorInterval = null;

const BILLING_MOCK = {
  plan: 'Starter',
  price: 9,
  status: 'Active',
  monthlySpend: 9.00,
  invoices: [
    { id: 'INV-001', date: '2026-04-01', amount: 9.00, status: 'paid' },
    { id: 'INV-002', date: '2026-03-01', amount: 9.00, status: 'paid' },
    { id: 'INV-003', date: '2026-02-01', amount: 9.00, status: 'paid' },
  ]
};

const RUNTIME_CONFIG = {
  laravel: { color: '#00F0FF', glow: 'rgba(0,240,255,0.3)', label: 'Laravel', icon: 'L', versionLabel: 'PHP Version', versions: ['8.3','8.2','8.1'], depFile: 'composer.json', detectFile: 'artisan' },
  python:  { color: '#FFD43B', glow: 'rgba(255,212,59,0.3)', label: 'Python', icon: 'Py', versionLabel: 'Python Version', versions: ['3.12','3.11','3.10','3.9'], depFile: 'requirements.txt', detectFile: 'main.py' },
  node:    { color: '#F7DF1E', glow: 'rgba(247,223,30,0.3)', label: 'JavaScript', icon: 'JS', versionLabel: 'Node.js Version', versions: ['22','20','18'], depFile: 'package.json', detectFile: 'index.js' },
  zip:     { color: '#7B61FF', glow: 'rgba(123,97,255,0.3)', label: 'ZIP', icon: 'Z', versionLabel: '', versions: [], depFile: '', detectFile: '' }
};

(function waitForFirebase(attempts) {
  if (window.NEXUS_INITIALIZED && window.auth) {
    window.auth.onAuthStateChanged(function(user) {
      if (user) { currentUser = user; initApp(); }
      else { window.location.href = 'login.html'; }
    });
    return;
  }
  if (attempts > 20) {
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#050507;padding:2rem">' +
      '<div style="max-width:520px;text-align:center">' +
      '<div style="width:72px;height:72px;border-radius:20px;background:var(--gradient-brand);display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:900;color:#fff;margin:0 auto 1.5rem;box-shadow:0 0 60px rgba(0,240,255,0.3)">N</div>' +
      '<h1 style="font-size:1.8rem;font-weight:800;color:#fff;margin-bottom:0.5rem">NEXUS HOSTING</h1>' +
      '<p style="color:rgba(255,255,255,0.4);margin-bottom:2rem;font-size:0.95rem">Firebase not available</p>' +
      '<p style="color:rgba(255,255,255,0.3);font-size:0.85rem">Check console for errors (F12 Console)</p>' +
      '<p style="color:rgba(255,255,255,0.15);font-size:0.7rem;margin-top:2rem;letter-spacing:0.1em;text-transform:uppercase">NEXUS HOST — All Credit Nexus</p></div></div>';
    return;
  }
  setTimeout(function() { waitForFirebase(attempts + 1); }, 500);
})(0);

function getRuntimeConfig(runtime) { return RUNTIME_CONFIG[runtime] || RUNTIME_CONFIG.laravel; }

async function initApp() {
  displayUserInfo();
  await loadProjects();
  await loadDeployments();
  await loadDatabases();
  await loadDomains();
  loadBilling();
  loadTickets();
  loadAccount();
  updateStats();
  updateRuntimeComposition();
  startResourceMonitor();
  document.getElementById('greeting').textContent = `Welcome back${currentUser.displayName ? ', ' + currentUser.displayName.split(' ')[0] : ''} — manage your multi-runtime infrastructure`;
}

function displayUserInfo() {
  if (!currentUser) return;
  const initial = (currentUser.displayName || currentUser.email || 'N').charAt(0).toUpperCase();
  document.getElementById('userAvatar').textContent = initial;
  document.getElementById('userAvatar').innerHTML = currentUser.photoURL ? `<img src="${currentUser.photoURL}" alt="">` : initial;
  document.getElementById('userName').textContent = currentUser.displayName || 'User';
  document.getElementById('userEmail').textContent = currentUser.email || '';
  document.getElementById('settingsName').textContent = currentUser.displayName || 'User';
  document.getElementById('settingsEmail').textContent = currentUser.email || '';
  document.getElementById('settingsAvatar').textContent = initial;
  document.getElementById('settingsAvatar').innerHTML = currentUser.photoURL ? `<img src="${currentUser.photoURL}" alt="" style="width:100%;height:100%;object-fit:cover">` : initial;
}

function switchSection(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const target = document.getElementById('section-' + section);
  if (target) target.classList.add('active');
  const navItem = document.querySelector(`.nav-item[data-section="${section}"]`);
  if (navItem) navItem.classList.add('active');
  if (window.innerWidth <= 768) closeMobileSidebar();
}

function switchProjectTab(tab) {
  document.querySelectorAll('.project-tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
  const target = document.getElementById('projectTab-' + tab);
  if (target) target.classList.add('active');
  const btns = document.querySelectorAll('#section-project-detail .tabs .tab');
  const tabMap = { overview: 0, files: 1, terminal: 2, env: 3, deployments: 4, logs: 5 };
  if (btns[tabMap[tab]]) btns[tabMap[tab]].classList.add('active');
  if (tab === 'terminal') document.getElementById('terminalInput')?.focus();
}

function toggleMobileSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('mobileOverlay').style.display = document.getElementById('sidebar').classList.contains('open') ? 'block' : 'none';
}
function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('mobileOverlay').style.display = 'none';
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function toggleProjectMethod() {
  const method = document.getElementById('newProjectMethod').value;
  document.getElementById('githubUrlGroup').style.display = method === 'github' ? 'block' : 'none';
  document.getElementById('fileUploadGroup').style.display = method === 'upload' ? 'block' : 'none';
}

document.getElementById('newProjectRuntime')?.addEventListener('change', function() {
  const runtime = this.value;
  const config = getRuntimeConfig(runtime);
  const versionGroup = document.getElementById('newProjectVersionGroup');
  const versionLabel = document.getElementById('newProjectVersionLabel');
  const versionSelect = document.getElementById('newProjectVersion');
  if (config.versions.length > 0) {
    versionGroup.style.display = 'block';
    versionLabel.textContent = config.versionLabel;
    versionSelect.innerHTML = config.versions.map(v => `<option value="${v}">${v}</option>`).join('');
  } else {
    versionGroup.style.display = 'none';
  }
});

function openCreateProject() {
  document.getElementById('newProjectName').value = '';
  document.getElementById('newProjectRuntime').value = 'laravel';
  document.getElementById('newProjectRuntime').dispatchEvent(new Event('change'));
  document.getElementById('newProjectMethod').value = 'upload';
  document.getElementById('zipUpload').value = '';
  document.getElementById('selectedFile').style.display = 'none';
  document.getElementById('githubUrlGroup').style.display = 'none';
  document.getElementById('fileUploadGroup').style.display = 'block';
  document.getElementById('createProjectBtn').textContent = 'Create Project';
  document.getElementById('createProjectBtn').disabled = false;
  openModal('createProjectModal');
}

function openDeployModal() {
  if (!currentProjectId) { showToast('error', 'No project selected'); return; }
  document.getElementById('deployBranch').value = 'main';
  document.getElementById('deployNotes').value = '';
  document.getElementById('deployBtn').textContent = 'Deploy Now';
  document.getElementById('deployBtn').disabled = false;
  openModal('deployModal');
}

function openAddDomain() {
  const sel = document.getElementById('domainProject');
  sel.innerHTML = '';
  Object.values(currentProjects).forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id; opt.textContent = p.name;
    sel.appendChild(opt);
  });
  document.getElementById('newDomain').value = '';
  openModal('addDomainModal');
}

function openCreateDatabase() {
  const sel = document.getElementById('newDbProject');
  sel.innerHTML = '<option value="">No project</option>';
  Object.values(currentProjects).forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id; opt.textContent = p.name;
    sel.appendChild(opt);
  });
  document.getElementById('newDbName').value = '';
  openModal('createDatabaseModal');
}

function openEnvEditor() { switchProjectTab('env'); }

async function createProject() {
  const name = document.getElementById('newProjectName').value.trim();
  const runtime = document.getElementById('newProjectRuntime').value;
  const version = document.getElementById('newProjectVersion').value;
  const method = document.getElementById('newProjectMethod').value;
  if (!name) { showToast('error', 'Please enter a project name'); return; }
  const btn = document.getElementById('createProjectBtn');
  btn.textContent = 'Creating...';
  btn.disabled = true;
  var d = window.db || window.NEXUS_DB;
  if (!d) { showToast('error', 'Firebase database not connected'); btn.textContent = 'Create Project'; btn.disabled = false; return; }
  try {
    const config = getRuntimeConfig(runtime);
    const projectData = {
      name, slug: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      owner: currentUser.uid,
      runtime, version,
      framework: config.label,
      status: 'pending',
      method, env: 'production',
      createdAt: Date.now(), updatedAt: Date.now()
    };
    const ref = d.ref('projects').push();
    await ref.set(projectData);
    projectData.id = ref.key;
    currentProjects[ref.key] = projectData;
    document.getElementById('projectCount').textContent = Object.keys(currentProjects).length;
    showToast('success', 'Project "' + name + '" created');
    closeModal('createProjectModal');
    await loadProjects();
    updateStats();
    updateRuntimeComposition();
  } catch (err) {
    showToast('error', 'Create failed: ' + (err.message || 'Firebase DB not enabled'));
    console.error('[NEXUS] Create error:', err);
  } finally { btn.textContent = 'Create Project'; btn.disabled = false; }
}

async function loadProjects() {
  try {
    const snap = await db.ref('projects').orderByChild('owner').equalTo(currentUser.uid).once('value');
    currentProjects = {};
    if (snap.exists()) { snap.forEach(child => { currentProjects[child.key] = { id: child.key, ...child.val() }; }); }
    renderProjects();
    document.getElementById('projectCount').textContent = Object.keys(currentProjects).length;
    updateStats();
    updateRuntimeComposition();
  } catch (err) { console.error('Load projects error:', err); }
}

function getRuntimeColor(runtime) { const c = RUNTIME_CONFIG[runtime]; return c ? c.color : '#7B61FF'; }
function getRuntimeBadge(runtime) { const c = RUNTIME_CONFIG[runtime]; return c ? `<span class="runtime-badge ${runtime === 'node' ? 'js' : runtime}">${c.label}</span>` : ''; }

function renderProjects() {
  const container = document.getElementById('projectsList');
  const recentContainer = document.getElementById('recentProjectsList');
  const vals = Object.values(currentProjects).sort((a, b) => b.createdAt - a.createdAt);
  if (vals.length === 0) {
    container.innerHTML = '<div class="empty-state" style="grid-column:1/-1;padding:5rem 2rem">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" width="72" height="72" style="opacity:0.3;margin-bottom:1.5rem"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>' +
      '<h3 style="font-size:1.3rem;font-weight:700;margin-bottom:0.5rem">No projects yet</h3>' +
      '<p style="color:var(--titanium);margin-bottom:1.5rem">Create your first multi-runtime project to deploy bots</p>' +
      '<button class="btn btn-primary btn-lg" onclick="openCreateProject()">Create Your First Project</button></div>';
    recentContainer.innerHTML = '<div class="empty-state" style="padding:2rem"><p>No projects yet</p></div>';
    return;
  }
  container.innerHTML = vals.map(function(p) {
    const runtime = p.runtime || 'laravel';
    const config = getRuntimeConfig(runtime);
    const color = config.color;
    const statusClass = p.status === 'active' ? 'active' : p.status === 'deploying' ? 'deploying' : 'pending';
    const statusText = p.status === 'active' ? 'Live' : p.status === 'deploying' ? 'Deploying' : 'Pending';
    const icon = config.icon || p.name.charAt(0).toUpperCase();
    const badge = getRuntimeBadge(runtime);
    const date = new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return '<div class="project-card glass-card" onclick="openProject(\'' + p.id + '\')" style="cursor:pointer;overflow:hidden;position:relative">' +
      '<div style="position:absolute;top:0;left:0;width:4px;height:100%;background:' + color + ';box-shadow:0 0 16px ' + color + '40"></div>' +
      '<div style="padding:1.5rem 1.5rem 1.25rem 2rem">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:1rem">' +
      '<div style="display:flex;align-items:center;gap:1rem">' +
      '<div style="width:44px;height:44px;border-radius:12px;background:' + color + '15;color:' + color + ';display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.2rem;box-shadow:0 0 20px ' + color + '20">' + icon + '</div>' +
      '<div>' +
      '<div style="font-weight:700;font-size:1.05rem;color:var(--signal-white)">' + p.name + '</div>' +
      '<div style="font-size:0.8rem;color:var(--titanium);margin-top:0.15rem">' + p.framework + (p.version ? ' ' + p.version : '') + '</div></div></div>' +
      '<div style="display:flex;align-items:center;gap:0.5rem">' + badge + '<span class="status-badge ' + statusClass + '" style="font-size:0.7rem">' + statusText + '</span></div></div>' +
      '<div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap;padding-top:0.75rem;border-top:1px solid var(--border-glass)">' +
      '<div style="display:flex;align-items:center;gap:0.35rem;font-size:0.75rem;color:var(--titanium)">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>' +
      config.label + '</div>' +
      '<div style="display:flex;align-items:center;gap:0.35rem;font-size:0.75rem;color:var(--titanium)">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' + date + '</div>' +
      (p.deploymentUrl ? '<div style="display:flex;align-items:center;gap:0.35rem;font-size:0.75rem;color:var(--success)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Deployed</div>' : '') +
      '</div></div>' +
      '<div style="padding:0.75rem 1.5rem 0.75rem 2rem;background:var(--surface-glass);border-top:1px solid var(--border-glass);display:flex;gap:0.5rem;justify-content:flex-end">' +
      '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openDeployModalFor(\'' + p.id + '\')" style="font-size:0.75rem">Deploy</button>' +
      '</div></div>';
  }).join('');
  recentContainer.innerHTML = vals.slice(0, 3).map(function(p) {
    const config = getRuntimeConfig(p.runtime || 'laravel');
    const statusClass = p.status === 'active' ? 'active' : p.status === 'deploying' ? 'deploying' : 'pending';
    return '<div style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem 0;border-bottom:1px solid var(--border-glass);cursor:pointer" onclick="openProject(\'' + p.id + '\')">' +
      '<div style="width:32px;height:32px;border-radius:8px;background:' + config.color + '15;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem;color:' + config.color + ';flex-shrink:0">' + (config.icon || p.name.charAt(0)) + '</div>' +
      '<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:0.88rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + p.name + '</div>' +
      '<div style="font-size:0.75rem;color:var(--titanium)">' + config.label + '</div></div>' +
      '<span class="status-badge ' + statusClass + '" style="font-size:0.65rem">' + p.status + '</span></div>';
  }).join('');
}

async function openProject(projectId) {
  currentProjectId = projectId;
  const project = currentProjects[projectId];
  if (!project) { showToast('error', 'Project not found'); return; }
  const config = getRuntimeConfig(project.runtime || 'laravel');
  document.getElementById('projectDetailName').textContent = project.name;
  document.getElementById('projectDetailMeta').textContent = `${config.label} — ${project.status}`;
  document.getElementById('pdRuntime').textContent = config.label;
  document.getElementById('pdFramework').textContent = project.framework || config.label;
  document.getElementById('pdVersion').textContent = project.version || '—';
  document.getElementById('pdEntrypoint').textContent = config.detectFile || '—';
  const statusClass = project.status === 'active' ? 'active' : project.status === 'deploying' ? 'deploying' : 'pending';
  document.getElementById('pdStatus').innerHTML = `<span class="status-badge ${statusClass}">${project.status}</span>`;
  document.getElementById('pdCreated').textContent = new Date(project.createdAt).toLocaleDateString();
  document.getElementById('pdRuntimeBadge').outerHTML = getRuntimeBadge(project.runtime || 'laravel');
  switchSection('project-detail');
  switchProjectTab('overview');
  loadProjectFiles(projectId);
  loadEnvVars(projectId);
  loadProjectDeployments(projectId);
  document.querySelectorAll('.deployment-step').forEach((el, i) => { el.classList.remove('active', 'completed'); if (i === 0) el.classList.add('active'); });
}

async function deleteCurrentProject() {
  if (!currentProjectId || !confirm('Delete this project permanently?')) return;
  try {
    await db.ref('projects/' + currentProjectId).remove();
    delete currentProjects[currentProjectId];
    showToast('success', 'Project deleted');
    switchSection('projects');
    await loadProjects();
    updateStats();
    updateRuntimeComposition();
  } catch (err) { showToast('error', 'Delete failed: ' + err.message); }
}

function openDeployModalFor(projectId) { currentProjectId = projectId; openDeployModal(); }

async function restartProject() {
  if (!currentProjectId) return;
  showToast('info', 'Restarting instance...');
  await deploymentEngine.sleep(2000);
  showToast('success', 'Instance restarted successfully');
}

async function loadProjectFiles(projectId) {
  const tree = document.getElementById('fileTree');
  try {
    const snap = await db.ref('projects/' + projectId + '/files').once('value');
    tree.innerHTML = snap.exists() ? buildFileTree(snap.val()) : `<div class="tree-item folder" style="cursor:default;color:var(--titanium)">No files uploaded yet</div>`;
  } catch (err) { tree.innerHTML = `<div class="tree-item folder" style="cursor:default;color:var(--titanium)">Upload your project to see files</div>`; }
}

function buildFileTree(files, depth) {
  depth = depth || 0;
  if (typeof files === 'string' || typeof files === 'number')
    return `<div class="tree-item file" style="padding-left:${depth * 20}px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> ${files}</div>`;
  if (Array.isArray(files)) return files.map(f => buildFileTree(f, depth)).join('');
  if (typeof files === 'object' && files !== null) {
    return Object.entries(files).map(([key, val]) => {
      if (typeof val === 'object' && val !== null && !Array.isArray(val))
        return `<div class="tree-item folder" style="padding-left:${depth * 20}px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> ${key}/</div>${buildFileTree(val, depth + 1)}`;
      return `<div class="tree-item file" style="padding-left:${(depth + 1) * 20}px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> ${key}</div>`;
    }).join('');
  }
  return '';
}

function uploadFile() { showToast('info', 'Upload files via ZIP in project creation'); }
function createFile() { showToast('info', 'Create files in your local project and re-upload'); }

async function loadEnvVars(projectId) {
  const container = document.getElementById('envVarsList');
  try {
    const snap = await db.ref('projects/' + projectId + '/env').once('value');
    container.innerHTML = '';
    if (snap.exists()) { Object.entries(snap.val()).forEach(([k, v]) => addEnvRow(k, v)); }
    addEnvRow('', '', true);
  } catch (err) { container.innerHTML = '<p style="color:var(--titanium)">Error loading env vars</p>'; }
}

function addEnvRow(key, val, isNew) {
  const container = document.getElementById('envVarsList');
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:0.75rem;margin-bottom:0.75rem;align-items:center';
  row.innerHTML = `<input class="form-input env-key" placeholder="VARIABLE_NAME" value="${key}" style="font-family:var(--font-mono);font-size:0.82rem;flex:1">
    <input class="form-input env-val" placeholder="Value" value="${val}" style="font-family:var(--font-mono);font-size:0.82rem;flex:2">
    <button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()" style="color:var(--danger)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
  container.appendChild(row);
}

async function saveEnvVars() {
  if (!currentProjectId) return;
  try {
    const envData = {};
    document.querySelectorAll('#envVarsList .env-key').forEach((input, i) => {
      const key = input.value.trim();
      const val = document.querySelectorAll('#envVarsList .env-val')[i].value.trim();
      if (key) envData[key] = val;
    });
    await db.ref('projects/' + currentProjectId + '/env').set(envData);
    showToast('success', 'Environment variables saved');
  } catch (err) { showToast('error', 'Failed to save: ' + err.message); }
}

async function startDeployment() {
  if (!currentProjectId) { showToast('error', 'No project selected'); return; }
  const project = currentProjects[currentProjectId];
  const branch = document.getElementById('deployBranch').value || 'main';
  const notes = document.getElementById('deployNotes').value || '';
  const env = document.getElementById('deployEnv').value || 'production';
  const btn = document.getElementById('deployBtn');
  btn.textContent = 'Deploying...';
  btn.disabled = true;
  const deploymentId = db.ref('deployments').push().key;
  const timestamp = Date.now();
  const config = getRuntimeConfig(project.runtime || 'laravel');
  const deploymentData = {
    id: deploymentId, projectId: currentProjectId, projectName: project.name,
    version: 'v' + (Object.keys(allDeployments).length + 1), status: 'deploying',
    branch, commit: deploymentId.substring(0, 7), runtime: project.runtime,
    runtimeLabel: config.label, duration: null, env, notes,
    createdAt: timestamp, startedAt: timestamp, completedAt: null, log: []
  };
  allDeployments[deploymentId] = deploymentData;
  switchSection('project-detail');
  switchProjectTab('logs');
  const terminal = document.getElementById('logsTerminal');
  terminal.innerHTML = '<div class="line system">Initializing deployment...</div>';
  const deploymentUrl = deploymentEngine.generateDeploymentUrl(project.name, deploymentId);

  function addLog(type, message) {
    const line = document.createElement('div');
    line.className = 'line ' + type;
    const t = new Date().toLocaleTimeString();
    line.textContent = '[' + t + '] ' + message;
    terminal.appendChild(line);
    if (autoScroll) terminal.scrollTop = terminal.scrollHeight;
    deploymentData.log.push({ type, message, timestamp: t });
  }
  try {
    await db.ref('deployments/' + deploymentId).set(deploymentData);
    await db.ref('projects/' + currentProjectId + '/status').set('deploying');
    await deploymentEngine.executeDeploymentPipeline(
      { ...project, env, slug: project.slug || project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-') },
      deploymentId, addLog
    );
    deploymentData.status = 'active';
    deploymentData.completedAt = Date.now();
    deploymentData.duration = Math.round((Date.now() - timestamp) / 1000) + 's';
    deploymentData.deploymentUrl = deploymentUrl;
    await db.ref('deployments/' + deploymentId).update({ status: 'active', completedAt: deploymentData.completedAt, duration: deploymentData.duration, deploymentUrl });
    await db.ref('projects/' + currentProjectId).update({ status: 'active', deploymentUrl, updatedAt: Date.now() });
    if (currentProjects[currentProjectId]) { currentProjects[currentProjectId].status = 'active'; currentProjects[currentProjectId].deploymentUrl = deploymentUrl; }
    addLog('success', 'Deployment completed successfully!');
    addLog('highlight', 'Your bot is live at: ' + deploymentUrl);
    showToast('success', 'Deployed to ' + deploymentUrl);
    closeModal('deployModal');
    await loadDeployments();
    updateStats();
  } catch (err) {
    addLog('error', 'Deployment failed: ' + err.message);
    deploymentData.status = 'error';
    await db.ref('deployments/' + deploymentId + '/status').set('error');
    await db.ref('projects/' + currentProjectId + '/status').set('error');
    showToast('error', 'Deployment failed: ' + err.message);
  } finally { btn.textContent = 'Deploy Now'; btn.disabled = false; }
}

async function loadDeployments() {
  try {
    const snap = await db.ref('deployments').once('value');
    allDeployments = {};
    if (snap.exists()) { snap.forEach(child => { const val = child.val(); if (val.projectId && currentProjects[val.projectId]) { allDeployments[child.key] = { id: child.key, ...val }; } }); }
    renderAllDeployments();
    updateStats();
  } catch (err) { console.error('Load deployments error:', err); }
}

async function loadProjectDeployments(projectId) {
  const body = document.getElementById('deploymentHistoryBody');
  const projectDeps = Object.values(allDeployments).filter(d => d.projectId === projectId).sort((a, b) => b.createdAt - a.createdAt);
  if (projectDeps.length === 0) { body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--titanium)">No deployments yet</td></tr>'; return; }
  body.innerHTML = projectDeps.map(d => {
    const statusClass = d.status === 'active' ? 'active' : d.status === 'deploying' ? 'deploying' : 'error';
    return '<tr><td style="font-weight:600">' + (d.version || 'v1') + '</td>' +
      '<td><span class="status-badge ' + statusClass + '">' + d.status + '</span></td>' +
      '<td>' + (d.branch || 'main') + '</td>' +
      '<td><code style="font-size:0.8rem">' + (d.commit || '').substring(0, 7) + '</code></td>' +
      '<td>' + (d.runtimeLabel || d.runtime || '—') + '</td>' +
      '<td>' + (d.duration || '—') + '</td>' +
      '<td>' + new Date(d.createdAt).toLocaleDateString() + '</td>' +
      '<td><button class="btn btn-ghost btn-sm" onclick="showToast(\'info\',\'Viewing deployment\')">View</button></td></tr>';
  }).join('');
}

function renderAllDeployments() {
  const body = document.getElementById('allDeploymentsBody');
  const deps = Object.values(allDeployments).sort((a, b) => b.createdAt - a.createdAt);
  if (deps.length === 0) { body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:3rem;color:var(--titanium)">No deployments yet</td></tr>'; return; }
  body.innerHTML = deps.map(d => {
    const statusClass = d.status === 'active' ? 'active' : d.status === 'deploying' ? 'deploying' : 'error';
    return '<tr><td style="font-weight:600">' + (d.projectName || 'Project') + '</td>' +
      '<td>' + (d.version || 'v1') + '</td>' +
      '<td><span class="status-badge ' + statusClass + '">' + d.status + '</span></td>' +
      '<td>' + (d.branch || 'main') + '</td>' +
      '<td>' + (d.runtimeLabel || d.runtime || '—') + '</td>' +
      '<td>' + (d.duration || '—') + '</td>' +
      '<td>' + new Date(d.createdAt).toLocaleDateString() + '</td>' +
      '<td><button class="btn btn-ghost btn-sm">Logs</button></td></tr>';
  }).join('');
}

function handleTerminalKey(e) {
  if (e.key === 'Enter') {
    const input = document.getElementById('terminalInput');
    const cmd = input.value.trim();
    if (cmd) { executeCommand(cmd); input.value = ''; }
  }
}

async function executeCommand(cmd) {
  const body = document.getElementById('terminalBody');
  const line = document.createElement('div');
  line.className = 'line';
  line.innerHTML = '<span class="prompt" style="color:var(--nexus-cyan)">nexus@host:~$</span> ' + cmd;
  body.appendChild(line);
  const resultLine = document.createElement('div');
  if (cmd === 'help') {
    resultLine.className = 'line system';
    resultLine.textContent = 'Available: help, clear, pip [cmd], npm [cmd], node --version, python --version, php artisan [cmd], nexus:status, nexus:restart, nexus:logs';
  } else if (cmd === 'clear') { body.innerHTML = '<div class="line system">Terminal cleared</div>'; return; }
  else if (cmd === 'nexus:status') { resultLine.className = 'line info'; resultLine.textContent = 'NEXUS HOSTING — Active | Projects: ' + Object.keys(currentProjects).length + ' | Deployments: ' + Object.keys(allDeployments).length; }
  else if (cmd === 'nexus:restart') {
    resultLine.className = 'line warning'; resultLine.textContent = 'Restarting application instance...'; body.appendChild(resultLine);
    await deploymentEngine.sleep(1500);
    const doneLine = document.createElement('div'); doneLine.className = 'line success'; doneLine.textContent = 'Application restarted successfully'; body.appendChild(doneLine);
    body.scrollTop = body.scrollHeight; return;
  } else if (cmd.startsWith('pip ') || cmd.startsWith('python')) {
    resultLine.className = 'line system'; resultLine.textContent = '[PYTHON] Running...'; body.appendChild(resultLine);
    await deploymentEngine.sleep(1200);
    const outLine = document.createElement('div'); outLine.className = 'line success'; outLine.textContent = '[OK] Command completed'; body.appendChild(outLine);
    body.scrollTop = body.scrollHeight; return;
  } else if (cmd.startsWith('npm ') || cmd.startsWith('node ')) {
    resultLine.className = 'line system'; resultLine.textContent = '[NODE] Running...'; body.appendChild(resultLine);
    await deploymentEngine.sleep(1200);
    const outLine = document.createElement('div'); outLine.className = 'line success'; outLine.textContent = '[OK] Command completed'; body.appendChild(outLine);
    body.scrollTop = body.scrollHeight; return;
  } else if (cmd.startsWith('php artisan')) {
    resultLine.className = 'line system'; resultLine.textContent = '[ARTISAN] Executing: ' + cmd; body.appendChild(resultLine);
    await deploymentEngine.sleep(1200);
    const outLine = document.createElement('div'); outLine.className = 'line success'; outLine.textContent = '[OK] Command executed successfully'; body.appendChild(outLine);
    body.scrollTop = body.scrollHeight; return;
  } else { resultLine.className = 'line error'; resultLine.textContent = "Command not found: " + cmd + ". Type 'help' for available commands."; }
  body.appendChild(resultLine);
  body.scrollTop = body.scrollHeight;
}

function runQuickCommand(value) { if (!value) return; document.getElementById('terminalInput').value = value; executeCommand(value); document.getElementById('quickCommands').value = ''; }
function toggleAutoScroll() { autoScroll = !autoScroll; document.getElementById('autoScrollBtn').textContent = 'Auto-scroll: ' + (autoScroll ? 'ON' : 'OFF'); }
function clearLogs() { document.getElementById('logsTerminal').innerHTML = '<div class="line system">Logs cleared</div>'; }

async function loadDatabases() {
  try {
    const snap = await db.ref('instances').once('value');
    allDatabases = {};
    if (snap.exists()) { snap.forEach(child => { const val = child.val(); if (val.owner === currentUser.uid && val.type !== 'deployment') allDatabases[child.key] = { id: child.key, ...val }; }); }
    renderDatabases();
    updateStats();
  } catch (err) { console.error('Load databases error:', err); }
}

function renderDatabases() {
  const body = document.getElementById('databaseListBody');
  const dbs = Object.values(allDatabases);
  document.getElementById('dbTotal').textContent = dbs.length;
  document.getElementById('dbConnected').textContent = dbs.filter(d => d.status === 'active').length;
  document.getElementById('dbBackups').textContent = dbs.filter(d => d.backups).length || 0;
  if (dbs.length === 0) { body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--titanium)">No databases configured</td></tr>'; return; }
  body.innerHTML = dbs.map(db => '<tr><td style="font-weight:600">' + db.name + '</td><td>' + (db.type || 'MySQL') + '</td><td><span class="status-badge ' + (db.status === 'active' ? 'active' : 'pending') + '">' + (db.status || 'pending') + '</span></td><td>' + (db.size || '—') + '</td><td>' + (db.connections || 0) + '</td><td><button class="btn btn-ghost btn-sm">Manage</button></td></tr>').join('');
}

async function createDatabase() {
  const name = document.getElementById('newDbName').value.trim();
  const type = document.getElementById('newDbType').value;
  const projectId = document.getElementById('newDbProject').value;
  if (!name) { showToast('error', 'Please enter a database name'); return; }
  try {
    const data = { name, type, owner: currentUser.uid, projectId: projectId || null, status: 'active', size: '0 MB', connections: 0, backups: 0, createdAt: Date.now() };
    const ref = db.ref('instances').push();
    await ref.set(data);
    allDatabases[ref.key] = { id: ref.key, ...data };
    showToast('success', 'Database "' + name + '" created');
    closeModal('createDatabaseModal');
    renderDatabases();
    updateStats();
  } catch (err) { showToast('error', 'Failed: ' + err.message); }
}

async function loadDomains() {
  try {
    const snap = await db.ref('domains').once('value');
    allDomains = {};
    if (snap.exists()) { snap.forEach(child => { const val = child.val(); if (val.owner === currentUser.uid) allDomains[child.key] = { id: child.key, ...val }; }); }
    renderDomains();
    updateStats();
  } catch (err) { console.error('Load domains error:', err); }
}

function renderDomains() {
  const body = document.getElementById('domainsListBody');
  const domains = Object.values(allDomains);
  if (domains.length === 0) { body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--titanium)">No custom domains connected</td></tr>'; return; }
  body.innerHTML = domains.map(d => '<tr><td style="font-weight:600">' + d.domain + '</td><td>' + (d.projectName || '—') + '</td><td><span class="status-badge ' + (d.ssl ? 'active' : 'pending') + '">' + (d.ssl ? 'SSL Active' : 'Pending') + '</span></td><td><span class="status-badge ' + (d.verified ? 'active' : 'pending') + '">' + (d.verified ? 'Verified' : 'Pending') + '</span></td><td>' + new Date(d.createdAt).toLocaleDateString() + '</td><td><button class="btn btn-ghost btn-sm">Manage</button></td></tr>').join('');
  document.getElementById('statDomains').textContent = domains.length;
}

async function addDomain() {
  const domain = document.getElementById('newDomain').value.trim();
  const projectId = document.getElementById('domainProject').value;
  if (!domain) { showToast('error', 'Please enter a domain'); return; }
  try {
    const data = { domain, projectId, projectName: currentProjects[projectId]?.name || 'Unknown', owner: currentUser.uid, ssl: true, verified: false, createdAt: Date.now() };
    const ref = db.ref('domains').push();
    await ref.set(data);
    allDomains[ref.key] = { id: ref.key, ...data };
    showToast('success', 'Domain "' + domain + '" added. Configure your DNS now.');
    closeModal('addDomainModal');
    renderDomains();
    updateStats();
  } catch (err) { showToast('error', 'Failed: ' + err.message); }
}

async function restartQueue() { showToast('info', 'Restarting queue workers...'); await deploymentEngine.sleep(2000); showToast('success', 'All queue workers restarted'); }

function loadBilling() {
  document.getElementById('billingPlan').textContent = BILLING_MOCK.plan;
  document.getElementById('billingAmount').textContent = '$' + BILLING_MOCK.monthlySpend.toFixed(2);
  document.getElementById('billingInvoices').textContent = BILLING_MOCK.invoices.length;
  document.getElementById('billingStatus').textContent = BILLING_MOCK.status;
  const body = document.getElementById('invoicesBody');
  if (!body) return;
  if (BILLING_MOCK.invoices.length === 0) { body.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--titanium)">No invoices yet</td></tr>'; return; }
  body.innerHTML = BILLING_MOCK.invoices.map(inv => {
    const statusClass = inv.status === 'paid' ? 'active' : inv.status === 'pending' ? 'pending' : 'error';
    return '<tr><td style="font-weight:600">' + inv.id + '</td><td>' + inv.date + '</td><td>$' + inv.amount.toFixed(2) + '</td><td><span class="status-badge ' + statusClass + '">' + inv.status + '</span></td>' +
      '<td><button class="btn btn-ghost btn-sm" onclick="showToast(\'info\',\'Downloading ' + inv.id + '\')">Download</button></td></tr>';
  }).join('');
}

function loadTickets() {
  const vals = Object.values(allTickets);
  document.getElementById('ticketTotal').textContent = vals.length;
  document.getElementById('ticketResolved').textContent = vals.filter(t => t.status === 'resolved' || t.status === 'closed').length;
  document.getElementById('ticketOpen').textContent = vals.filter(t => t.status === 'open' || t.status === 'in-progress').length;
  document.getElementById('ticketHighPrio').textContent = vals.filter(t => t.priority === 'high' || t.priority === 'critical').length;
  renderTickets();
}

function renderTickets() {
  const body = document.getElementById('ticketsBody');
  if (!body) return;
  const filter = document.getElementById('ticketFilter')?.value || 'all';
  let vals = Object.values(allTickets).sort((a, b) => b.updatedAt - a.updatedAt);
  if (filter !== 'all') vals = vals.filter(t => t.status === filter);
  if (vals.length === 0) { body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--titanium)">No tickets found</td></tr>'; return; }
  body.innerHTML = vals.map(t => {
    const statusClass = t.status === 'open' ? 'deploying' : t.status === 'in-progress' ? 'pending' : t.status === 'resolved' ? 'active' : 'error';
    const prioColor = t.priority === 'critical' ? 'var(--alert-red)' : t.priority === 'high' ? 'var(--warning-amber)' : t.priority === 'medium' ? 'var(--js-yellow)' : 'var(--titanium)';
    return '<tr><td style="font-weight:600;font-family:var(--font-mono);font-size:0.8rem">#' + (t.id || t._id || '').substring(0, 8) + '</td>' +
      '<td style="font-weight:600">' + t.subject + '</td>' +
      '<td><span class="status-badge ' + statusClass + '">' + t.status + '</span></td>' +
      '<td><span style="color:' + prioColor + ';font-weight:600;font-size:0.78rem;text-transform:uppercase">' + t.priority + '</span></td>' +
      '<td>' + new Date(t.updatedAt).toLocaleDateString() + '</td>' +
      '<td><button class="btn btn-ghost btn-sm" onclick="showToast(\'info\',\'Opening ticket...\')">View</button></td></tr>';
  }).join('');
}

function openCreateTicket() {
  document.getElementById('ticketSubject').value = '';
  document.getElementById('ticketCategory').value = 'technical';
  document.getElementById('ticketPriority').value = 'medium';
  document.getElementById('ticketMessage').value = '';
  document.getElementById('createTicketBtn').textContent = 'Submit Ticket';
  document.getElementById('createTicketBtn').disabled = false;
  openModal('createTicketModal');
}

async function createTicket() {
  const subject = document.getElementById('ticketSubject').value.trim();
  const category = document.getElementById('ticketCategory').value;
  const priority = document.getElementById('ticketPriority').value;
  const message = document.getElementById('ticketMessage').value.trim();
  if (!subject) { showToast('error', 'Please enter a subject'); return; }
  if (!message) { showToast('error', 'Please describe your issue'); return; }
  const btn = document.getElementById('createTicketBtn');
  btn.textContent = 'Submitting...';
  btn.disabled = true;
  try {
    const id = 'ticket_' + Date.now();
    const ticketData = {
      id, subject, category, priority, message,
      status: 'open',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      owner: currentUser?.uid || 'anon'
    };
    if (window.db) {
      const ref = window.db.ref('tickets').push();
      await ref.set(ticketData);
      ticketData._id = ref.key;
    }
    allTickets[id] = ticketData;
    showToast('success', 'Ticket #' + id.substring(0, 8) + ' created');
    closeModal('createTicketModal');
    loadTickets();
  } catch (err) {
    showToast('error', 'Failed to create ticket: ' + (err.message || 'Unknown'));
  } finally {
    btn.textContent = 'Submit Ticket';
    btn.disabled = false;
  }
}

function loadAccount() {
  if (!currentUser) return;
  const nameInput = document.getElementById('accountName');
  const emailInput = document.getElementById('accountEmail');
  const avatar = document.getElementById('accountAvatar');
  if (nameInput) nameInput.value = currentUser.displayName || '';
  if (emailInput) emailInput.value = currentUser.email || '';
  if (avatar) {
    const initial = (currentUser.displayName || currentUser.email || 'N').charAt(0).toUpperCase();
    avatar.textContent = initial;
    avatar.innerHTML = currentUser.photoURL ? `<img src="${currentUser.photoURL}" alt="" style="width:100%;height:100%;object-fit:cover">` : initial;
  }
  renderApiTokens();
}

function renderApiTokens() {
  const container = document.getElementById('apiTokensList');
  if (!container) return;
  if (apiTokens.length === 0) {
    container.innerHTML = '<div style="padding:0.5rem 0;color:var(--titanium);font-size:0.85rem">No API tokens generated yet</div>';
    return;
  }
  container.innerHTML = apiTokens.map(t => {
    const lastChars = t.token.slice(-8);
    return '<div style="display:flex;align-items:center;gap:0.75rem;padding:0.65rem;background:var(--surface-glass);border-radius:8px;margin-bottom:0.5rem">' +
      '<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:0.85rem">' + t.label + '</div>' +
      '<code style="font-size:0.75rem;color:var(--titanium)">••••••••' + lastChars + '</code></div>' +
      '<button class="btn btn-ghost btn-sm" onclick="revokeApiToken(\'' + t.id + '\')" style="color:var(--alert-red)">Revoke</button></div>';
  }).join('');
}

function generateApiToken() {
  const label = document.getElementById('apiTokenLabel').value.trim();
  if (!label) { showToast('error', 'Please enter a token label'); return; }
  const token = 'nexus_' + Array.from({ length: 40 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 36))).join('');
  apiTokens.push({ id: 'tok_' + Date.now(), label, token, createdAt: Date.now() });
  document.getElementById('apiTokenLabel').value = '';
  renderApiTokens();
  showToast('success', 'Token "' + label + '" generated. Copy it now — you won\'t see it again.');
  navigator.clipboard.writeText(token).catch(() => {});
}

function revokeApiToken(id) {
  apiTokens = apiTokens.filter(t => t.id !== id);
  renderApiTokens();
  showToast('success', 'Token revoked');
}

function updateAccountProfile() {
  const name = document.getElementById('accountName')?.value.trim();
  if (!name) { showToast('error', 'Please enter a display name'); return; }
  if (currentUser) {
    currentUser.updateProfile({ displayName: name }).then(() => {
      displayUserInfo();
      loadAccount();
      showToast('success', 'Profile updated');
    }).catch(err => {
      showToast('error', 'Update failed: ' + err.message);
    });
  }
}

function updatePassword() {
  const current = document.getElementById('currentPassword')?.value;
  const newPw = document.getElementById('newPassword')?.value;
  const confirm = document.getElementById('confirmPassword')?.value;
  if (!current || !newPw || !confirm) { showToast('error', 'Please fill in all password fields'); return; }
  if (newPw.length < 6) { showToast('error', 'New password must be at least 6 characters'); return; }
  if (newPw !== confirm) { showToast('error', 'Passwords do not match'); return; }
  const user = window.auth?.currentUser || currentUser;
  if (!user) { showToast('error', 'Not authenticated'); return; }
  const credential = firebase.auth.EmailAuthProvider.credential(user.email, current);
  user.reauthenticateWithCredential(credential).then(() => {
    user.updatePassword(newPw).then(() => {
      showToast('success', 'Password updated successfully');
      document.getElementById('currentPassword').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('confirmPassword').value = '';
    }).catch(err => showToast('error', 'Password update failed: ' + err.message));
  }).catch(err => showToast('error', 'Current password is incorrect'));
}

function toggleTwoFactor(enabled) {
  const setup = document.getElementById('twoFactorSetup');
  if (!setup) return;
  setup.style.display = enabled ? 'block' : 'none';
  if (enabled) showToast('info', 'Follow the setup instructions to enable 2FA');
}

function confirmDeleteAccount() {
  if (confirm('Are you sure you want to delete your account? This action is irreversible.')) {
    const typed = prompt('Type "DELETE" to confirm account deletion:');
    if (typed === 'DELETE') {
      const user = window.auth?.currentUser || currentUser;
      if (user) {
        user.delete().then(() => {
          showToast('success', 'Account deleted');
          window.location.href = 'login.html';
        }).catch(err => showToast('error', 'Delete failed: ' + err.message));
      }
    } else {
      showToast('error', 'Account deletion cancelled');
    }
  }
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  document.getElementById('selectedFileName').textContent = '📦 ' + file.name + ' (' + (file.size / 1024 / 1024).toFixed(2) + ' MB)';
  document.getElementById('selectedFile').style.display = 'block';
}

function updateStats() {
  const projects = Object.keys(currentProjects).length;
  const activeDeps = Object.values(allDeployments).filter(d => d.status === 'active').length;
  const dbs = Object.values(allDatabases).length;
  const domains = Object.values(allDomains).length;
  document.getElementById('statProjects').textContent = projects;
  document.getElementById('statDeployments').textContent = activeDeps;
  document.getElementById('statDatabases').textContent = dbs;
  document.getElementById('statDomains').textContent = domains;
}

function updateRuntimeComposition() {
  const counts = { laravel: 0, python: 0, node: 0, zip: 0 };
  Object.values(currentProjects).forEach(p => { const r = p.runtime || 'laravel'; if (counts[r] !== undefined) counts[r]++; });
  document.getElementById('runtimeLaravelCount').textContent = counts.laravel;
  document.getElementById('runtimePythonCount').textContent = counts.python;
  document.getElementById('runtimeJsCount').textContent = counts.node;
  document.getElementById('runtimeZipCount').textContent = counts.zip;
}

function startResourceMonitor() {
  if (monitorInterval) clearInterval(monitorInterval);
  monitorInterval = setInterval(() => {
    const cpu = Math.round(Math.random() * 60 + 10);
    const mem = Math.round(Math.random() * 50 + 30);
    const storage = Math.round(Math.random() * 30 + 20);
    const bandwidth = Math.round(Math.random() * 500 + 100);
    document.getElementById('cpuUsage').textContent = cpu + '%';
    document.getElementById('cpuFill').style.width = cpu + '%';
    document.getElementById('memUsage').textContent = mem + '%';
    document.getElementById('memFill').style.width = mem + '%';
    document.getElementById('storageUsage').textContent = storage + '%';
    document.getElementById('storageFill').style.width = storage + '%';
    document.getElementById('bandwidthUsage').textContent = bandwidth + ' MB';
    document.getElementById('bandwidthFill').style.width = Math.min(100, (bandwidth / 1024) * 100) + '%';
    document.getElementById('monCpu').textContent = cpu + '%';
    document.getElementById('monMemory').textContent = Math.round(mem * 0.512) + ' MB';
    document.getElementById('monRequests').textContent = Math.round(Math.random() * 200 + 50);
    const total = Math.round(Math.random() * 1000 + 500);
    const _2xx = Math.round(total * 0.85); const _4xx = Math.round(total * 0.1); const _5xx = total - _2xx - _4xx;
    document.getElementById('http2xx').textContent = _2xx; document.getElementById('http2xxFill').style.width = (_2xx / total * 100) + '%';
    document.getElementById('http4xx').textContent = _4xx; document.getElementById('http4xxFill').style.width = (_4xx / total * 100) + '%';
    document.getElementById('http5xx').textContent = _5xx; document.getElementById('http5xxFill').style.width = (_5xx / total * 100) + '%';
    document.getElementById('avgResponse').textContent = Math.round(Math.random() * 150 + 50) + 'ms';
    document.getElementById('responseFill').style.width = Math.round(Math.random() * 40 + 10) + '%';
    const now = new Date().toLocaleTimeString();
    monitorData.cpu.push(cpu); monitorData.memory.push(mem); monitorData.labels.push(now);
    if (monitorData.cpu.length > 20) { monitorData.cpu.shift(); monitorData.memory.shift(); monitorData.labels.shift(); }
    drawMonitorChart();
  }, 3000);
}

function drawMonitorChart() {
  const canvas = document.getElementById('monitorCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);
  const pad = { top: 20, right: 20, bottom: 30, left: 40 };
  const cw = w - pad.left - pad.right, ch = h - pad.top - pad.bottom;
  const data = monitorData.cpu;
  if (data.length < 2) return;
  const maxVal = Math.max(100, ...data.map(v => v * 1.2));
  const step = cw / (data.length - 1);
  ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const y = pad.top + (ch / 4) * i; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '10px Inter'; ctx.textAlign = 'right'; ctx.fillText(Math.round(maxVal - (maxVal / 4) * i) + '%', pad.left - 8, y + 4); }
  ctx.beginPath(); ctx.strokeStyle = '#00F0FF'; ctx.lineWidth = 2; ctx.shadowColor = 'rgba(0,240,255,0.3)'; ctx.shadowBlur = 8;
  data.forEach((val, i) => { const x = pad.left + i * step; const y = pad.top + ch - (val / maxVal) * ch; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.strokeStyle = '#FFD43B'; ctx.lineWidth = 2; ctx.shadowColor = 'rgba(255,212,59,0.3)'; ctx.shadowBlur = 8;
  monitorData.memory.forEach((val, i) => { const x = pad.left + i * step; const y = pad.top + ch - (val / maxVal) * ch; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '9px Inter'; ctx.textAlign = 'center';
  for (let i = 0; i < data.length; i += Math.max(1, Math.floor(data.length / 5))) ctx.fillText(monitorData.labels[i] || '', pad.left + i * step, h - pad.bottom + 16);
  ctx.font = '10px Inter'; ctx.textAlign = 'left';
  ctx.fillStyle = '#00F0FF'; ctx.fillRect(w - pad.right - 100, 8, 12, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('CPU', w - pad.right - 84, 18);
  ctx.fillStyle = '#FFD43B'; ctx.fillRect(w - pad.right - 48, 8, 12, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('Memory', w - pad.right - 32, 18);
}

async function generateToken() {
  const token = deploymentEngine.generateDeploymentToken();
  const container = document.getElementById('tokensList');
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;align-items:center;gap:0.75rem;padding:0.75rem;background:var(--surface-glass);border-radius:8px;margin-top:0.5rem';
  div.innerHTML = '<code style="flex:1;font-family:var(--font-mono);font-size:0.8rem;color:var(--nexus-cyan)">' + token + '</code><button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText(\'' + token + '\');showToast(\'success\',\'Token copied\')">Copy</button>';
  container.prepend(div);
  showToast('success', 'Deployment token generated');
}

function showToast(type, message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  const icons = { success: '✓', error: '✗', info: 'ℹ', warning: '⚠' };
  toast.innerHTML = '<span>' + (icons[type] || '•') + '</span> ' + message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

function handleLogout() { auth.signOut().then(() => { window.location.href = 'login.html'; }); }
function toggleUserMenu() { if (confirm('Sign out of NEXUS HOSTING?')) handleLogout(); }

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('globalSearch')?.addEventListener('input', function(e) {
    const q = e.target.value.toLowerCase();
    if (q.length < 2) return;
    const results = Object.values(currentProjects).filter(p => p.name.toLowerCase().includes(q) || (p.framework || '').toLowerCase().includes(q));
    if (results.length > 0) showToast('info', 'Found ' + results.length + ' project(s) matching "' + q + '"');
  });
});

window.addEventListener('resize', () => { if (window.innerWidth > 768) closeMobileSidebar(); });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  if (e.ctrlKey && e.key === 'k') { e.preventDefault(); document.getElementById('globalSearch')?.focus(); }
});
