let currentUser = null;
let currentProjectId = null;
let currentProjects = {};
let allDeployments = {};
let allDatabases = {};
let allDomains = {};
let autoScroll = true;
let monitorData = { cpu: [], memory: [], labels: [] };
let monitorInterval = null;
let envMonitorInterval = null;

// ==================== AUTH ====================
(function waitForFirebase(attempts) {
  if (window.NEXUS_INITIALIZED && window.auth) {
    window.auth.onAuthStateChanged(function(user) {
      if (user) {
        currentUser = user;
        initApp();
      } else {
        window.location.href = 'login.html';
      }
    });
    return;
  }
  if (attempts > 20) {
    document.body.innerHTML = '' +
      '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a0a0f;padding:2rem">' +
      '<div style="max-width:520px;text-align:center">' +
      '<div style="width:72px;height:72px;border-radius:20px;background:linear-gradient(135deg,#F9322C,#ff6a33);display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:900;color:#fff;margin:0 auto 1.5rem;box-shadow:0 0 60px rgba(249,50,44,0.3)">N</div>' +
      '<h1 style="font-size:1.8rem;font-weight:800;color:#fff;margin-bottom:0.5rem">NEXUS HOST</h1>' +
      '<p style="color:rgba(255,255,255,0.4);margin-bottom:2rem;font-size:0.95rem">Firebase not available</p>' +
      '<p style="color:rgba(255,255,255,0.3);font-size:0.85rem">Check console for errors (F12 → Console)</p>' +
      '<p style="color:rgba(255,255,255,0.15);font-size:0.7rem;margin-top:2rem;letter-spacing:0.1em;text-transform:uppercase">Powered by NEXUS HOST — All Credit Nexus</p>' +
      '</div></div>';
    return;
  }
  setTimeout(function() { waitForFirebase(attempts + 1); }, 500);
})(0);

async function initApp() {
  displayUserInfo();
  await loadProjects();
  await loadDeployments();
  await loadDatabases();
  await loadDomains();
  updateStats();
  startResourceMonitor();
  startEnvMonitor();
  document.getElementById('greeting').textContent = `Welcome back${currentUser.displayName ? ', ' + currentUser.displayName.split(' ')[0] : ''} — manage your Laravel infrastructure`;
}

function displayUserInfo() {
  if (!currentUser) return;
  const initial = (currentUser.displayName || currentUser.email || 'N').charAt(0).toUpperCase();
  document.getElementById('userAvatar').textContent = initial;
  document.getElementById('userAvatar').innerHTML = currentUser.photoURL
    ? `<img src="${currentUser.photoURL}" alt="">` : initial;
  document.getElementById('userName').textContent = currentUser.displayName || 'User';
  document.getElementById('userEmail').textContent = currentUser.email || '';
  document.getElementById('settingsName').textContent = currentUser.displayName || 'User';
  document.getElementById('settingsEmail').textContent = currentUser.email || '';
  document.getElementById('settingsAvatar').textContent = initial;
  document.getElementById('settingsAvatar').innerHTML = currentUser.photoURL
    ? `<img src="${currentUser.photoURL}" alt="" style="width:100%;height:100%;object-fit:cover">` : initial;
}

// ==================== NAVIGATION ====================
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

function switchOverviewTab(tab) {
  showToast('info', `Switched to ${tab} view`);
}

function toggleMobileSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('mobileOverlay').style.display = document.getElementById('sidebar').classList.contains('open') ? 'block' : 'none';
}

function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('mobileOverlay').style.display = 'none';
}

// ==================== MODALS ====================
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function openCreateProject() {
  document.getElementById('newProjectName').value = '';
  document.getElementById('newProjectRuntime').value = 'php';
  document.getElementById('newProjectPhp').value = '8.3';
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

function openEnvEditor() {
  switchProjectTab('env');
}

// ==================== PROJECTS ====================
async function createProject() {
  const name = document.getElementById('newProjectName').value.trim();
  const runtime = document.getElementById('newProjectRuntime').value;
  const php = document.getElementById('newProjectPhp').value;
  const method = document.getElementById('newProjectMethod').value;

  if (!name) { showToast('error', 'Please enter a project name'); return; }

  const btn = document.getElementById('createProjectBtn');
  btn.textContent = 'Creating...';
  btn.disabled = true;

  try {
    // Detect runtime from uploaded files if any
    let detectedRuntime = deploymentEngine.detectRuntime([]);
    if (runtime !== 'php') detectedRuntime = { runtime, framework: runtime, version: '1.0', php: null };
    if (runtime === 'php') detectedRuntime.php = php;

    const projectData = {
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      owner: currentUser.uid,
      runtime: detectedRuntime.runtime,
      framework: detectedRuntime.framework,
      version: detectedRuntime.version,
      php: detectedRuntime.php,
      status: 'pending',
      method,
      env: 'production',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const ref = db.ref('projects').push();
    await ref.set(projectData);
    projectData.id = ref.key;

    currentProjects[ref.key] = projectData;
    document.getElementById('projectCount').textContent = Object.keys(currentProjects).length;

    showToast('success', `Project "${name}" created successfully`);
    closeModal('createProjectModal');
    await loadProjects();
    updateStats();
  } catch (err) {
    showToast('error', 'Failed to create project: ' + err.message);
  } finally {
    btn.textContent = 'Create Project';
    btn.disabled = false;
  }
}

async function loadProjects() {
  try {
    const snap = await db.ref('projects').orderByChild('owner').equalTo(currentUser.uid).once('value');
    currentProjects = {};
    if (snap.exists()) {
      snap.forEach(child => {
        currentProjects[child.key] = { id: child.key, ...child.val() };
      });
    }
    renderProjects();
    document.getElementById('projectCount').textContent = Object.keys(currentProjects).length;
    updateStats();
  } catch (err) { console.error('Load projects error:', err); }
}

function renderProjects() {
  const container = document.getElementById('projectsList');
  const recentContainer = document.getElementById('recentProjectsList');
  const vals = Object.values(currentProjects).sort((a, b) => b.createdAt - a.createdAt);

  if (vals.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <h3>No projects yet</h3>
      <p>Create your first project to get started</p>
      <button class="btn btn-primary" onclick="openCreateProject()">Create Project</button>
    </div>`;
    recentContainer.innerHTML = `<div class="empty-state" style="padding:2rem"><p>No projects yet</p></div>`;
    return;
  }

  container.innerHTML = vals.map(p => {
    const colors = { php: '#ff4500', node: '#00e676', python: '#448aff', static: '#ffab00' };
    const color = colors[p.runtime] || '#ff4500';
    const statusClass = p.status === 'active' ? 'active' : p.status === 'deploying' ? 'deploying' : 'pending';
    return `<div class="glass-card project-card animate-in" onclick="openProject('${p.id}')">
      <div class="project-icon" style="background:${color}20;color:${color}">${p.name.charAt(0).toUpperCase()}</div>
      <div class="project-info">
        <h3>${p.name}</h3>
        <p>${p.framework || p.runtime} ${p.version || ''}</p>
      </div>
      <div class="project-meta">
        <span class="status-badge ${statusClass}">${p.status}</span>
        <span style="font-size:0.8rem;color:var(--text-tertiary)">${new Date(p.createdAt).toLocaleDateString()}</span>
      </div>
      <div class="project-actions">
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openDeployModalFor('${p.id}')">Deploy</button>
      </div>
    </div>`;
  }).join('');

  // Recent projects (top 3)
  recentContainer.innerHTML = vals.slice(0, 3).map(p => {
    const statusClass = p.status === 'active' ? 'active' : p.status === 'deploying' ? 'deploying' : 'pending';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid var(--glass-border);cursor:pointer" onclick="openProject('${p.id}')">
      <div>
        <div style="font-weight:600">${p.name}</div>
        <div style="font-size:0.8rem;color:var(--text-tertiary)">${p.framework || p.runtime}</div>
      </div>
      <span class="status-badge ${statusClass}">${p.status}</span>
    </div>`;
  }).join('');
}

async function openProject(projectId) {
  currentProjectId = projectId;
  const project = currentProjects[projectId];
  if (!project) { showToast('error', 'Project not found'); return; }

  document.getElementById('projectDetailName').textContent = project.name;
  document.getElementById('projectDetailMeta').textContent = `${project.framework || project.runtime} — ${project.status}`;
  document.getElementById('pdRuntime').textContent = project.runtime;
  document.getElementById('pdFramework').textContent = project.framework || project.runtime;
  document.getElementById('pdPhp').textContent = project.php || 'N/A';
  const statusClass = project.status === 'active' ? 'active' : project.status === 'deploying' ? 'deploying' : 'pending';
  document.getElementById('pdStatus').innerHTML = `<span class="status-badge ${statusClass}">${project.status}</span>`;
  document.getElementById('pdCreated').textContent = new Date(project.createdAt).toLocaleDateString();
  document.getElementById('pdUrl').textContent = project.deploymentUrl || 'Not deployed';

  switchSection('project-detail');
  switchProjectTab('overview');
  loadProjectFiles(projectId);
  loadEnvVars(projectId);
  loadProjectDeployments(projectId);

  // Reset deployment steps
  document.querySelectorAll('.deployment-step').forEach((el, i) => {
    el.classList.remove('active', 'completed');
    if (i === 0) el.classList.add('active');
  });
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
  } catch (err) { showToast('error', 'Delete failed: ' + err.message); }
}

function openDeployModalFor(projectId) {
  currentProjectId = projectId;
  openDeployModal();
}

async function restartProject() {
  if (!currentProjectId) return;
  showToast('info', 'Restarting instance...');
  await deploymentEngine.sleep(2000);
  showToast('success', 'Instance restarted successfully');
}

// ==================== FILE MANAGER ====================
async function loadProjectFiles(projectId) {
  const tree = document.getElementById('fileTree');
  try {
    const snap = await db.ref('projects/' + projectId + '/files').once('value');
    if (snap.exists()) {
      const files = snap.val();
      tree.innerHTML = buildFileTree(files);
    } else {
      tree.innerHTML = `<div class="tree-item folder" style="cursor:default;color:var(--text-tertiary)">No files uploaded yet</div>`;
    }
  } catch (err) {
    tree.innerHTML = `<div class="tree-item folder" style="cursor:default;color:var(--text-tertiary)">Upload your project to see files</div>`;
  }
}

function buildFileTree(files, depth = 0) {
  if (typeof files === 'string' || typeof files === 'number') {
    return `<div class="tree-item file" style="padding-left:${depth * 20}px">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      ${files}
    </div>`;
  }
  if (Array.isArray(files)) {
    return files.map(f => buildFileTree(f, depth)).join('');
  }
  if (typeof files === 'object' && files !== null) {
    return Object.entries(files).map(([key, val]) => {
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        return `<div class="tree-item folder" style="padding-left:${depth * 20}px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          ${key}/
        </div>${buildFileTree(val, depth + 1)}`;
      }
      return `<div class="tree-item file" style="padding-left:${(depth + 1) * 20}px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        ${key}
      </div>`;
    }).join('');
  }
  return '';
}

function uploadFile() {
  showToast('info', 'File upload via ZIP in project creation');
}

function createFile() {
  showToast('info', 'Create files in your local project and re-upload');
}

// ==================== ENVIRONMENT VARIABLES ====================
async function loadEnvVars(projectId) {
  const container = document.getElementById('envVarsList');
  try {
    const snap = await db.ref('projects/' + projectId + '/env').once('value');
    container.innerHTML = '';
    if (snap.exists()) {
      const env = snap.val();
      Object.entries(env).forEach(([key, val]) => {
        addEnvRow(key, val);
      });
    }
    addEnvRow('', '', true);
  } catch (err) {
    container.innerHTML = '<p style="color:var(--text-tertiary)">Error loading env vars</p>';
  }
}

function addEnvRow(key = '', val = '', isNew = false) {
  const container = document.getElementById('envVarsList');
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:0.75rem;margin-bottom:0.75rem;align-items:center';
  row.innerHTML = `
    <input class="form-input env-key" placeholder="VARIABLE_NAME" value="${key}" style="font-family:var(--font-mono);font-size:0.82rem;flex:1">
    <input class="form-input env-val" placeholder="Value" value="${val}" style="font-family:var(--font-mono);font-size:0.82rem;flex:2">
    <button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()" style="color:var(--danger)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;
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

// ==================== DEPLOYMENTS ====================
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
  const deploymentData = {
    id: deploymentId,
    projectId: currentProjectId,
    projectName: project.name,
    version: `v${Object.keys(allDeployments).length + 1}`,
    status: 'deploying',
    branch,
    commit: deploymentId.substring(0, 7),
    runtime: project.runtime,
    framework: project.framework,
    duration: null,
    env,
    notes,
    createdAt: timestamp,
    startedAt: timestamp,
    completedAt: null,
    log: []
  };

  allDeployments[deploymentId] = deploymentData;

  // Switch to project detail logs tab if not already there
  switchSection('project-detail');
  switchProjectTab('logs');

  const terminal = document.getElementById('logsTerminal');
  terminal.innerHTML = '<div class="line system">Initializing deployment...</div>';

  const deploymentUrl = deploymentEngine.generateDeploymentUrl(project.name, deploymentId);

  function addLog(type, message) {
    const line = document.createElement('div');
    line.className = `line ${type}`;
    const timestamp = new Date().toLocaleTimeString();
    line.textContent = `[${timestamp}] ${message}`;
    terminal.appendChild(line);
    if (autoScroll) terminal.scrollTop = terminal.scrollHeight;
    deploymentData.log.push({ type, message, timestamp });
  }

  try {
    await db.ref('deployments/' + deploymentId).set(deploymentData);
    await db.ref('projects/' + currentProjectId + '/status').set('deploying');

    await deploymentEngine.executeDeploymentPipeline(
      { ...project, env, slug: project.slug || project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-') },
      deploymentId,
      addLog
    );

    deploymentData.status = 'active';
    deploymentData.completedAt = Date.now();
    deploymentData.duration = Math.round((Date.now() - timestamp) / 1000) + 's';
    deploymentData.deploymentUrl = deploymentUrl;

    await db.ref('deployments/' + deploymentId).update({
      status: 'active',
      completedAt: deploymentData.completedAt,
      duration: deploymentData.duration,
      deploymentUrl
    });
    await db.ref('projects/' + currentProjectId).update({
      status: 'active',
      deploymentUrl,
      updatedAt: Date.now()
    });

    if (currentProjects[currentProjectId]) {
      currentProjects[currentProjectId].status = 'active';
      currentProjects[currentProjectId].deploymentUrl = deploymentUrl;
    }

    addLog('success', `Deployment completed successfully!`);
    addLog('highlight', `Your app is live at: ${deploymentUrl}`);

    showToast('success', `Deployed to ${deploymentUrl}`);
    closeModal('deployModal');
    await loadDeployments();
    updateStats();
  } catch (err) {
    addLog('error', `Deployment failed: ${err.message}`);
    deploymentData.status = 'error';
    await db.ref('deployments/' + deploymentId + '/status').set('error');
    await db.ref('projects/' + currentProjectId + '/status').set('error');
    showToast('error', 'Deployment failed: ' + err.message);
  } finally {
    btn.textContent = 'Deploy Now';
    btn.disabled = false;
  }
}

async function loadDeployments() {
  try {
    const snap = await db.ref('deployments').once('value');
    allDeployments = {};
    if (snap.exists()) {
      snap.forEach(child => {
        const val = child.val();
        if (val.projectId && currentProjects[val.projectId]) {
          allDeployments[child.key] = { id: child.key, ...val };
        }
      });
    }
    renderAllDeployments();
    updateStats();
  } catch (err) { console.error('Load deployments error:', err); }
}

async function loadProjectDeployments(projectId) {
  const body = document.getElementById('deploymentHistoryBody');
  const projectDeps = Object.values(allDeployments).filter(d => d.projectId === projectId).sort((a, b) => b.createdAt - a.createdAt);

  if (projectDeps.length === 0) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-tertiary)">No deployments yet</td></tr>';
    return;
  }

  body.innerHTML = projectDeps.map(d => {
    const statusClass = d.status === 'active' ? 'active' : d.status === 'deploying' ? 'deploying' : 'error';
    return `<tr>
      <td style="font-weight:600">${d.version || 'v1'}</td>
      <td><span class="status-badge ${statusClass}">${d.status}</span></td>
      <td>${d.branch || 'main'}</td>
      <td><code style="font-family:var(--font-mono);font-size:0.8rem">${(d.commit || d.id || '').substring(0, 7)}</code></td>
      <td>${d.duration || '—'}</td>
      <td>${new Date(d.createdAt).toLocaleDateString()}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="showToast('info','Viewing deployment ${(d.id || '').substring(0, 8)}')">View</button></td>
    </tr>`;
  }).join('');
}

function renderAllDeployments() {
  const body = document.getElementById('allDeploymentsBody');
  const deps = Object.values(allDeployments).sort((a, b) => b.createdAt - a.createdAt);

  if (deps.length === 0) {
    body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:3rem;color:var(--text-tertiary)">No deployments yet</td></tr>';
    return;
  }

  body.innerHTML = deps.map(d => {
    const statusClass = d.status === 'active' ? 'active' : d.status === 'deploying' ? 'deploying' : 'error';
    return `<tr>
      <td style="font-weight:600">${d.projectName || 'Project'}</td>
      <td>${d.version || 'v1'}</td>
      <td><span class="status-badge ${statusClass}">${d.status}</span></td>
      <td>${d.branch || 'main'}</td>
      <td>${d.runtime || '—'}</td>
      <td>${d.duration || '—'}</td>
      <td>${new Date(d.createdAt).toLocaleDateString()}</td>
      <td><button class="btn btn-ghost btn-sm">Logs</button></td>
    </tr>`;
  }).join('');
}

// ==================== TERMINAL ====================
function handleTerminalKey(e) {
  if (e.key === 'Enter') {
    const input = document.getElementById('terminalInput');
    const cmd = input.value.trim();
    if (cmd) {
      executeCommand(cmd);
      input.value = '';
    }
  }
}

async function executeCommand(cmd) {
  const body = document.getElementById('terminalBody');
  const line = document.createElement('div');
  line.className = 'line';
  line.innerHTML = `<span class="prompt" style="color:var(--primary-light)">nexus@host:~$</span> ${cmd}`;
  body.appendChild(line);

  const resultLine = document.createElement('div');

  const isPhpArtisan = cmd.startsWith('php artisan');
  const isComposer = cmd.startsWith('composer');
  const isNpm = cmd.startsWith('npm');
  const isGit = cmd.startsWith('git');

  if (cmd === 'help') {
    resultLine.className = 'line system';
    resultLine.textContent = `Available commands: help, clear, php artisan [cmd], composer [cmd], npm [cmd], git [cmd], nexus:status, nexus:restart, nexus:deploy, nexus:logs`;
  } else if (cmd === 'clear') {
    body.innerHTML = `<div class="line system">Terminal cleared</div>`;
    return;
  } else if (cmd === 'nexus:status') {
    resultLine.className = 'line info';
    resultLine.textContent = `NEXUS HOST — Active | Projects: ${Object.keys(currentProjects).length} | Deployments: ${Object.keys(allDeployments).length}`;
  } else if (cmd === 'nexus:restart') {
    resultLine.className = 'line warning';
    resultLine.textContent = `Restarting application instance...`;
    body.appendChild(resultLine);
    await deploymentEngine.sleep(1500);
    const doneLine = document.createElement('div');
    doneLine.className = 'line success';
    doneLine.textContent = 'Application restarted successfully';
    body.appendChild(doneLine);
    body.scrollTop = body.scrollHeight;
    return;
  } else if (isPhpArtisan) {
    resultLine.className = 'line system';
    resultLine.textContent = `[ARTISAN] Executing: ${cmd}`;
    body.appendChild(resultLine);
    await deploymentEngine.sleep(1200);
    const outLine = document.createElement('div');
    outLine.className = 'line success';
    outLine.textContent = `[OK] Command executed successfully`;
    body.appendChild(outLine);
    body.scrollTop = body.scrollHeight;
    return;
  } else if (isComposer) {
    resultLine.className = 'line system';
    resultLine.textContent = `[COMPOSER] Running package operation...`;
    body.appendChild(resultLine);
    await deploymentEngine.sleep(2000);
    const outLine = document.createElement('div');
    outLine.className = 'line success';
    outLine.textContent = `[OK] Composer operation completed`;
    body.appendChild(outLine);
    body.scrollTop = body.scrollHeight;
    return;
  } else if (cmd === 'php artisan migrate') {
    resultLine.className = 'line system';
    resultLine.textContent = `[MIGRATE] Running database migrations...`;
    body.appendChild(resultLine);
    await deploymentEngine.sleep(2000);
    ['Migrating: 2014_10_12_000000_create_users_table', 'Migrating: 2014_10_12_100000_create_password_resets_table', 'Migrating: 2019_08_19_000000_create_failed_jobs_table', '[OK] All migrations completed successfully'].forEach(msg => {
      const l = document.createElement('div');
      l.className = 'line success';
      l.textContent = msg;
      body.appendChild(l);
    });
    body.scrollTop = body.scrollHeight;
    return;
  } else {
    resultLine.className = 'line error';
    resultLine.textContent = `Command not found: ${cmd}. Type 'help' for available commands.`;
  }

  body.appendChild(resultLine);
  body.scrollTop = body.scrollHeight;
}

function runQuickCommand(value) {
  if (!value) return;
  document.getElementById('terminalInput').value = value;
  executeCommand(value);
  document.getElementById('quickCommands').value = '';
}

function toggleAutoScroll() {
  autoScroll = !autoScroll;
  document.getElementById('autoScrollBtn').textContent = `Auto-scroll: ${autoScroll ? 'ON' : 'OFF'}`;
}

function clearLogs() {
  document.getElementById('logsTerminal').innerHTML = '<div class="line system">Logs cleared</div>';
}

// ==================== DATABASES ====================
async function loadDatabases() {
  try {
    const snap = await db.ref('instances').once('value');
    allDatabases = {};
    if (snap.exists()) {
      snap.forEach(child => {
        const val = child.val();
        if (val.owner === currentUser.uid && val.type !== 'deployment') {
          allDatabases[child.key] = { id: child.key, ...val };
        }
      });
    }
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

  if (dbs.length === 0) {
    body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-tertiary)">No databases configured</td></tr>';
    return;
  }

  body.innerHTML = dbs.map(db => {
    const statusClass = db.status === 'active' ? 'active' : 'pending';
    return `<tr>
      <td style="font-weight:600">${db.name}</td>
      <td>${db.type || 'MySQL'}</td>
      <td><span class="status-badge ${statusClass}">${db.status || 'pending'}</span></td>
      <td>${db.size || '—'}</td>
      <td>${db.connections || 0}</td>
      <td><button class="btn btn-ghost btn-sm">Manage</button></td>
    </tr>`;
  }).join('');
}

async function createDatabase() {
  const name = document.getElementById('newDbName').value.trim();
  const type = document.getElementById('newDbType').value;
  const projectId = document.getElementById('newDbProject').value;

  if (!name) { showToast('error', 'Please enter a database name'); return; }

  try {
    const data = {
      name,
      type,
      owner: currentUser.uid,
      projectId: projectId || null,
      status: 'active',
      size: '0 MB',
      connections: 0,
      backups: 0,
      createdAt: Date.now()
    };
    const ref = db.ref('instances').push();
    await ref.set(data);
    allDatabases[ref.key] = { id: ref.key, ...data };
    showToast('success', `Database "${name}" created`);
    closeModal('createDatabaseModal');
    renderDatabases();
    updateStats();
  } catch (err) { showToast('error', 'Failed: ' + err.message); }
}

// ==================== DOMAINS ====================
async function loadDomains() {
  try {
    const snap = await db.ref('domains').once('value');
    allDomains = {};
    if (snap.exists()) {
      snap.forEach(child => {
        const val = child.val();
        if (val.owner === currentUser.uid) {
          allDomains[child.key] = { id: child.key, ...val };
        }
      });
    }
    renderDomains();
    updateStats();
  } catch (err) { console.error('Load domains error:', err); }
}

function renderDomains() {
  const body = document.getElementById('domainsListBody');
  const domains = Object.values(allDomains);

  if (domains.length === 0) {
    body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-tertiary)">No custom domains connected</td></tr>';
    return;
  }

  body.innerHTML = domains.map(d => {
    const sslClass = d.ssl ? 'active' : 'pending';
    return `<tr>
      <td style="font-weight:600">${d.domain}</td>
      <td>${d.projectName || '—'}</td>
      <td><span class="status-badge ${sslClass}">${d.ssl ? 'SSL Active' : 'Pending'}</span></td>
      <td><span class="status-badge ${d.verified ? 'active' : 'pending'}">${d.verified ? 'Verified' : 'Pending'}</span></td>
      <td>${new Date(d.createdAt).toLocaleDateString()}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="showToast('info','Domain management')">Manage</button></td>
    </tr>`;
  }).join('');

  document.getElementById('statDomains').textContent = domains.length;
}

async function addDomain() {
  const domain = document.getElementById('newDomain').value.trim();
  const projectId = document.getElementById('domainProject').value;

  if (!domain) { showToast('error', 'Please enter a domain'); return; }

  try {
    const data = {
      domain,
      projectId,
      projectName: currentProjects[projectId]?.name || 'Unknown',
      owner: currentUser.uid,
      ssl: true,
      verified: false,
      createdAt: Date.now()
    };
    const ref = db.ref('domains').push();
    await ref.set(data);
    allDomains[ref.key] = { id: ref.key, ...data };
    showToast('success', `Domain "${domain}" added. Configure your DNS now.`);
    closeModal('addDomainModal');
    renderDomains();
    updateStats();
  } catch (err) { showToast('error', 'Failed: ' + err.message); }
}

// ==================== QUEUE ====================
async function restartQueue() {
  showToast('info', 'Restarting queue workers...');
  await deploymentEngine.sleep(2000);
  showToast('success', 'All queue workers restarted');
}

// ==================== FILE UPLOAD ====================
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  document.getElementById('selectedFileName').textContent = `📦 ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
  document.getElementById('selectedFile').style.display = 'block';
}

// ==================== STATS ====================
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

// ==================== RESOURCE MONITOR ====================
function startResourceMonitor() {
  if (monitorInterval) clearInterval(monitorInterval);
  // Simulate resource metrics
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

    // Monitoring section metrics
    document.getElementById('monCpu').textContent = cpu + '%';
    document.getElementById('monMemory').textContent = Math.round(mem * 0.512) + ' MB';
    document.getElementById('monRequests').textContent = Math.round(Math.random() * 200 + 50);

    // HTTP stats
    const total = Math.round(Math.random() * 1000 + 500);
    const _2xx = Math.round(total * 0.85);
    const _4xx = Math.round(total * 0.1);
    const _5xx = total - _2xx - _4xx;
    document.getElementById('http2xx').textContent = _2xx;
    document.getElementById('http2xxFill').style.width = (_2xx / total * 100) + '%';
    document.getElementById('http4xx').textContent = _4xx;
    document.getElementById('http4xxFill').style.width = (_4xx / total * 100) + '%';
    document.getElementById('http5xx').textContent = _5xx;
    document.getElementById('http5xxFill').style.width = (_5xx / total * 100) + '%';
    document.getElementById('avgResponse').textContent = Math.round(Math.random() * 150 + 50) + 'ms';
    document.getElementById('responseFill').style.width = Math.round(Math.random() * 40 + 10) + '%';

    // CPU Chart
    const now = new Date().toLocaleTimeString();
    monitorData.cpu.push(cpu);
    monitorData.memory.push(mem);
    monitorData.labels.push(now);
    if (monitorData.cpu.length > 20) {
      monitorData.cpu.shift();
      monitorData.memory.shift();
      monitorData.labels.shift();
    }
    drawMonitorChart();
  }, 3000);
}

function drawMonitorChart() {
  const canvas = document.getElementById('monitorCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0, 0, w, h);

  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  const data = monitorData.cpu;
  if (data.length < 2) return;

  const maxVal = Math.max(100, ...data.map(v => v * 1.2));
  const stepX = chartW / (data.length - 1);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '10px Inter';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxVal - (maxVal / 4) * i) + '%', padding.left - 8, y + 4);
  }

  // CPU line
  ctx.beginPath();
  ctx.strokeStyle = '#ff4500';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(255,69,0,0.3)';
  ctx.shadowBlur = 8;
  data.forEach((val, i) => {
    const x = padding.left + i * stepX;
    const y = padding.top + chartH - (val / maxVal) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Memory line
  ctx.beginPath();
  ctx.strokeStyle = '#448aff';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(68,138,255,0.3)';
  ctx.shadowBlur = 8;
  monitorData.memory.forEach((val, i) => {
    const x = padding.left + i * stepX;
    const y = padding.top + chartH - (val / maxVal) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.shadowBlur = 0;

  // X-axis labels
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '9px Inter';
  ctx.textAlign = 'center';
  for (let i = 0; i < data.length; i += Math.max(1, Math.floor(data.length / 5))) {
    const x = padding.left + i * stepX;
    ctx.fillText(monitorData.labels[i] || '', x, h - padding.bottom + 16);
  }

  // Legend
  ctx.font = '10px Inter';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ff4500';
  ctx.fillRect(w - padding.right - 100, 8, 12, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('CPU', w - padding.right - 84, 18);
  ctx.fillStyle = '#448aff';
  ctx.fillRect(w - padding.right - 48, 8, 12, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('Memory', w - padding.right - 32, 18);
}

function startEnvMonitor() {
  // Simulate environment monitoring
}

// ==================== TOKENS ====================
async function generateToken() {
  const token = deploymentEngine.generateDeploymentToken();
  const container = document.getElementById('tokensList');
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;align-items:center;gap:0.75rem;padding:0.75rem;background:var(--surface);border-radius:8px;margin-top:0.5rem';
  div.innerHTML = `
    <code style="flex:1;font-family:var(--font-mono);font-size:0.8rem;color:var(--primary-light)">${token}</code>
    <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText('${token}');showToast('success','Token copied')">Copy</button>
  `;
  container.prepend(div);
  showToast('success', 'Deployment token generated');
}

// ==================== TOAST ====================
function showToast(type, message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✓', error: '✗', info: 'ℹ', warning: '⚠' };
  toast.innerHTML = `<span>${icons[type] || '•'}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// ==================== LOGOUT ====================
function handleLogout() {
  auth.signOut().then(() => {
    window.location.href = 'login.html';
  });
}

function toggleUserMenu() {
  if (confirm('Sign out of NEXUS HOST?')) handleLogout();
}

// ==================== SEARCH ====================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('globalSearch')?.addEventListener('input', function(e) {
    const q = e.target.value.toLowerCase();
    if (q.length < 2) return;
    const results = Object.values(currentProjects).filter(p =>
      p.name.toLowerCase().includes(q) || (p.framework || '').toLowerCase().includes(q)
    );
    if (results.length > 0) {
      showToast('info', `Found ${results.length} project(s) matching "${q}"`);
    }
  });
});

// ==================== RESIZE HANDLER ====================
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) closeMobileSidebar();
});

// ==================== KEYBOARD SHORTCUTS ====================
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
  if (e.ctrlKey && e.key === 'k') {
    e.preventDefault();
    document.getElementById('globalSearch')?.focus();
  }
});
