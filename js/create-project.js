let currentUser = null;
let currentStep = 1;
let selectedMethod = null;
let selectedRuntime = 'auto';
let selectedFile = null;
let selectedRepo = null;
let deploying = false;

(function waitForFirebase(attempts) {
  if (window.NEXUS_INITIALIZED && window.auth) {
    window.auth.onAuthStateChanged(function(user) {
      if (user) { currentUser = user; initCP(); }
      else { window.location.href = 'login.html'; }
    });
    return;
  }
  if (attempts > 20) {
    currentUser = { uid: 'dev', displayName: 'Dev User', email: 'dev@nexus.host' };
    initCP();
    return;
  }
  setTimeout(function() { waitForFirebase(attempts + 1); }, 500);
})(0);

function initCP() {
  displayUserInfo();
  document.getElementById('projectName').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') nextStep();
  });
}

function displayUserInfo() {
  if (!currentUser) return;
  document.getElementById('cpUserName').textContent = currentUser.displayName || 'Dev User';
  document.getElementById('cpUserEmail').textContent = currentUser.email || 'dev@nexus.host';
  document.getElementById('cpUserAvatar').textContent = (currentUser.displayName || 'U')[0].toUpperCase();
}

function selectMethod(method) {
  selectedMethod = method;
  document.querySelectorAll('.cp-method').forEach(e => e.classList.remove('selected'));
  document.getElementById('method' + method.charAt(0).toUpperCase() + method.slice(1)).classList.add('selected');
}

function selectRuntime(runtime) {
  selectedRuntime = runtime;
  document.querySelectorAll('.cp-runtime').forEach(e => e.classList.remove('selected'));
  const map = { python: 'runtimePython', node: 'runtimeNode', auto: 'runtimeAuto' };
  document.getElementById(map[runtime]).classList.add('selected');
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  selectedFile = file;
  document.getElementById('uploadFileName').textContent = file.name;
  document.getElementById('uploadFileSize').textContent = (file.size / 1024 / 1024).toFixed(1) + ' MB';
  document.getElementById('uploadedFile').style.display = 'block';
  if (!document.getElementById('projectName').value) {
    document.getElementById('projectName').value = file.name.replace(/\.(zip|py|js)$/i, '').toLowerCase().replace(/[^a-z0-9-]/g, '-');
    updateProjectName();
  }
}

function fetchGithubRepos() {
  const url = document.getElementById('githubUrl').value.trim();
  const list = document.getElementById('repoList');
  if (!url || !url.includes('github.com')) {
    list.innerHTML = '<div style="padding:0.5rem 0;font-size:0.78rem;color:rgba(255,255,255,0.2)">Enter a GitHub repository URL to import</div>';
    return;
  }
  const match = url.match(/github\.com\/([^\/]+)\/([^\/\s]+)/);
  if (!match) {
    list.innerHTML = '<div style="padding:0.5rem 0;font-size:0.78rem;color:rgba(255,255,255,0.2)">Invalid GitHub URL format</div>';
    return;
  }
  const [, user, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, '');
  selectedRepo = { user, repo: cleanRepo, url: `https://github.com/${user}/${cleanRepo}` };
  list.innerHTML = `
    <div class="repo-item selected">
      <div style="font-weight:600;color:var(--signal-white)">${user}/${cleanRepo}</div>
      <div style="font-size:0.72rem;color:rgba(255,255,255,0.2)">${url}</div>
    </div>
  `;
  if (!document.getElementById('projectName').value) {
    document.getElementById('projectName').value = cleanRepo.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    updateProjectName();
  }
}

function updateProjectName() {
  const name = document.getElementById('projectName').value || 'my-project';
  document.getElementById('projectUrlPreview').textContent = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

function goToStep(step) {
  if (step === 2 && !selectedMethod) return;
  if (step === 3 && !selectedMethod) return;
  if (step === 4 && !selectedMethod) return;
  currentStep = step;
  document.querySelectorAll('.cp-step').forEach(e => e.classList.remove('active'));
  document.querySelectorAll('.cp-panel').forEach(e => e.classList.remove('active'));
  document.querySelector(`.cp-step[data-step="${step}"]`).classList.add('active');
  document.getElementById(`cpStep${step}`).classList.add('active');
  updateNav();

  if (step === 3) {
    document.getElementById('cpUploadPanel').style.display = selectedMethod === 'upload' ? 'block' : 'none';
    document.getElementById('cpGithubPanel').style.display = selectedMethod === 'github' ? 'block' : 'none';
  }
}

function nextStep() {
  if (currentStep === 1 && !selectedMethod) return;
  if (currentStep === 4) return;
  if (currentStep === 3 && selectedMethod === 'upload' && !selectedFile) return;
  if (currentStep === 3 && selectedMethod === 'github' && !selectedRepo) return;
  document.querySelector(`.cp-step[data-step="${currentStep}"]`).classList.add('completed');
  goToStep(currentStep + 1);
}

function prevStep() {
  if (currentStep === 1) return;
  goToStep(currentStep - 1);
}

function updateNav() {
  const back = document.getElementById('cpBackBtn');
  const next = document.getElementById('cpNextBtn');
  back.style.display = currentStep === 1 ? 'none' : 'inline-block';
  if (currentStep === 4) {
    next.style.display = 'none';
  } else {
    next.style.display = 'inline-block';
    const labels = { 1: 'Select Runtime →', 2: 'Configure →', 3: 'Review & Deploy →' };
    next.textContent = labels[currentStep] || 'Continue →';
    next.disabled = (currentStep === 1 && !selectedMethod) || (currentStep === 3 && selectedMethod === 'upload' && !selectedFile) || (currentStep === 3 && selectedMethod === 'github' && !selectedRepo);
  }
}

async function startDeployment() {
  if (deploying) return;
  deploying = true;
  document.getElementById('cpDeployReady').style.display = 'none';
  document.getElementById('cpDeployProgress').style.display = 'block';
  document.getElementById('deployBtn').disabled = true;

  const name = document.getElementById('projectName').value || 'my-project';
  const project = window.NexusFS.createProject(name, selectedRuntime, selectedMethod, selectedFile ? [selectedFile.name] : []);

  const logsContainer = document.getElementById('deployLogs');
  const progressFill = document.getElementById('deployProgressFill');

  function addLog(type, text) {
    const div = document.createElement('div');
    div.className = `log-line ${type}`;
    div.textContent = text;
    logsContainer.appendChild(div);
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }

  function onProgress(pct) {
    progressFill.style.width = pct + '%';
  }

  try {
    const instance = await window.NexusDeployment.executeDeployment(project, {
      onLog: addLog,
      onProgress: onProgress,
      onComplete: function(inst) {
        document.getElementById('deployedUrl').textContent = `https://${inst.url}`;
        document.getElementById('cpDeployResult').style.display = 'block';
        window.NexusDeployment.startMetricsInterval(inst.id);
      }
    });
  } catch (err) {
    addLog('error', `Deployment failed: ${err.message}`);
  } finally {
    deploying = false;
  }
}

function toggleCpUserMenu() {}
