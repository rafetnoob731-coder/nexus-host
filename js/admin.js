/* ============================================================
   NEXUS HOSTING — Admin Panel v1.0
   All Credit Nexus | Full Admin Control Center
   ============================================================ */

let adminUser = null;
let adminRole = 'admin';
let adminData = {
  users: [],
  projects: [],
  bots: [],
  deployments: [],
  zipQueue: [],
  tickets: [],
  auditLog: [],
  billing: [],
  infraRegions: [],
  ipBlocks: [],
  activityLog: []
};
let bulkSelected = new Set();
let activityInterval = null;

/* ======================== INIT ======================== */

(function initAdmin() {
  if (window.NEXUS_INITIALIZED && window.auth) {
    window.auth.onAuthStateChanged(function(user) {
      if (user) {
        adminUser = user;
        checkAdminAccess();
      } else {
        window.location.href = 'login.html';
      }
    });
  } else {
    if (typeof waitForFirebase !== 'undefined') {
      var orig = window.location.href;
      window.location.href = 'dashboard.html';
    } else {
      setTimeout(initAdmin, 500);
    }
  }
})();

function checkAdminAccess() {
  // Check Firebase for admin role
  var userRef = (window.db || window.NEXUS_DB).ref('users/' + adminUser.uid + '/role');
  userRef.once('value').then(function(snap) {
    var role = snap.val();
    if (role === 'admin' || role === 'support' || role === 'infra' || role === 'security') {
      adminRole = role || 'admin';
      initAdminPanel();
    } else {
      // Fallback: allow admin access for demo (role stored in user node)
      adminRole = 'admin';
      initAdminPanel();
    }
  }).catch(function() {
    // If Firebase fails, still allow access for demo
    adminRole = 'admin';
    initAdminPanel();
  });
}

function initAdminPanel() {
  displayAdminUser();
  loadAllAdminData();
  startActivityStream();
  renderDashboard();
  renderAdminUsers();
  renderAdminProjects();
  renderAdminBots();
  renderAdminDeployments();
  renderAdminZipQueue();
  renderInfrastructure();
  renderBilling();
  renderPlans();
  renderTickets();
  renderAdminAudit();
  renderSecurityRules();
  renderIPBlocks();
  renderFeatureFlags();
  renderCapacityStats();
  drawRevenueChart();
  drawTopProjectsChart();
  loadAlerts();
}

/* ======================== UI UTILITIES ======================== */

function switchAdminSection(section) {
  document.querySelectorAll('.admin-section').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.admin-sidebar .nav-item').forEach(function(n) { n.classList.remove('active'); });
  document.querySelectorAll('.admin-nav-link').forEach(function(n) { n.classList.remove('active'); });
  var sec = document.getElementById('admin-section-' + section);
  if (sec) sec.classList.add('active');
  var nav = document.querySelector('.admin-sidebar .nav-item[data-adsection="' + section + '"]');
  if (nav) nav.classList.add('active');
  var topnav = document.querySelector('.admin-nav-link[data-topnav="' + section + '"]');
  if (topnav) topnav.classList.add('active');
  if (window.innerWidth <= 768) {
    document.getElementById('adminSidebar').classList.remove('open');
  }
}

function toggleAdminSidebar() {
  var sb = document.getElementById('adminSidebar');
  if (window.innerWidth <= 768) {
    sb.classList.toggle('open');
  } else {
    sb.classList.toggle('collapsed');
    document.getElementById('adminMain').style.marginLeft = sb.classList.contains('collapsed') ? '64px' : '240px';
  }
}

function closeMobileAdmin() {
  document.getElementById('adminSidebar').classList.remove('open');
}

function openAdminSlidePanel(title, html) {
  document.getElementById('slidePanelTitle').textContent = title;
  document.getElementById('slidePanelBody').innerHTML = html;
  document.getElementById('adminSlidePanel').classList.add('open');
}

function closeAdminSlidePanel() {
  document.getElementById('adminSlidePanel').classList.remove('open');
}

function showAdminToast(type, message) {
  var container = document.getElementById('adminToastContainer');
  var toast = document.createElement('div');
  toast.className = 'toast ' + type;
  var icons = { success: '✓', error: '✗', info: 'ℹ', warning: '⚠' };
  toast.innerHTML = '<span>' + (icons[type] || '•') + '</span> ' + message;
  container.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 5000);
}

function adminGlobalSearch() {
  var q = document.getElementById('adminGlobalSearch').value.trim().toLowerCase();
  if (!q) return;
  var results = [];
  adminData.users.forEach(function(u) {
    if ((u.email || '').toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q) || (u.id || '').toLowerCase().includes(q))
      results.push({ type: 'User', label: u.name || u.email, id: u.id });
  });
  adminData.projects.forEach(function(p) {
    if ((p.name || '').toLowerCase().includes(q) || (p.id || '').toLowerCase().includes(q))
      results.push({ type: 'Project', label: p.name, id: p.id });
  });
  adminData.bots.forEach(function(b) {
    if ((b.name || '').toLowerCase().includes(q) || (b.id || '').toLowerCase().includes(q))
      results.push({ type: 'Bot', label: b.name, id: b.id });
  });
  showAdminToast('info', 'Found ' + results.length + ' result(s) for "' + q + '"');
}

function displayAdminUser() {
  if (!adminUser) return;
  var avatar = document.getElementById('adminAvatar');
  var name = document.getElementById('adminName');
  var role = document.getElementById('adminRole');
  var initial = (adminUser.displayName || adminUser.email || 'A').charAt(0).toUpperCase();
  avatar.textContent = initial;
  name.textContent = adminUser.displayName || adminUser.email || 'Admin';
  role.textContent = adminRole.charAt(0).toUpperCase() + adminRole.slice(1);
}

function toggleAdminUserMenu() {
  if (confirm('Sign out of Admin Panel?')) {
    auth.signOut().then(function() { window.location.href = 'login.html'; });
  }
}

function toggleAllAdminChecks(master) {
  document.querySelectorAll('#usersTableBody input[type="checkbox"]').forEach(function(cb) {
    cb.checked = master.checked;
  });
}

function toggleAllBotChecks(master) {
  document.querySelectorAll('#botsTableBody input[type="checkbox"]').forEach(function(cb) {
    cb.checked = master.checked;
    if (master.checked) bulkSelected.add(cb.value);
    else bulkSelected.delete(cb.value);
  });
  updateBulkBar();
}

function updateBulkBar() {
  var bar = document.getElementById('adminBulkBar');
  var count = document.getElementById('bulkCount');
  count.textContent = bulkSelected.size + ' selected';
  bar.classList.toggle('show', bulkSelected.size > 0);
}

function clearBulkSelection() {
  bulkSelected.clear();
  document.querySelectorAll('#botsTableBody input[type="checkbox"]').forEach(function(cb) { cb.checked = false; });
  document.getElementById('adminBulkBar').classList.remove('show');
}

/* ======================== DATA LOADING ======================== */

function loadAllAdminData() {
  var db = window.db || window.NEXUS_DB;
  if (!db) {
    // Simulate data for demo
    generateSimulatedData();
    return;
  }
  // Load from Firebase
  db.ref('users').once('value').then(function(snap) {
    if (snap.exists()) {
      adminData.users = [];
      snap.forEach(function(child) {
        adminData.users.push({ id: child.key, ...child.val() });
      });
    }
    renderAdminUsers();
  }).catch(function() { generateSimulatedData(); });

  db.ref('projects').once('value').then(function(snap) {
    if (snap.exists()) {
      adminData.projects = [];
      snap.forEach(function(child) {
        adminData.projects.push({ id: child.key, ...child.val() });
      });
    }
    renderAdminProjects();
  }).catch(function() {});
}

function generateSimulatedData() {
  // Simulated Users
  adminData.users = [
    { id: 'u_8291', name: 'Alex Chen', email: 'alex@dev.co', plan: 'Pro', projects: 3, bots: 7, runtimeMix: { laravel: 3, python: 2, js: 2 }, status: 'active', joined: '2024-01-15' },
    { id: 'u_8292', name: 'Sarah Kim', email: 'sarah@bot.io', plan: 'Starter', projects: 1, bots: 2, runtimeMix: { laravel: 2 }, status: 'active', joined: '2024-01-16' },
    { id: 'u_8293', name: 'Mal User', email: 'bad@actor.com', plan: '—', projects: 0, bots: 0, runtimeMix: {}, status: 'banned', joined: '2024-01-10' },
    { id: 'u_8294', name: 'New Dev', email: 'new@hello.com', plan: '—', projects: 0, bots: 0, runtimeMix: {}, status: 'unverified', joined: '2024-01-17' },
    { id: 'u_8295', name: 'Jane Doe', email: 'jane@company.com', plan: 'Enterprise', projects: 8, bots: 24, runtimeMix: { laravel: 10, python: 8, js: 6 }, status: 'active', joined: '2023-11-20' },
    { id: 'u_8296', name: 'Bob Wilson', email: 'bob@startup.io', plan: 'Pro', projects: 2, bots: 4, runtimeMix: { python: 3, js: 1 }, status: 'suspended', joined: '2024-02-01' },
    { id: 'u_8297', name: 'Priya Sharma', email: 'priya@botfarm.com', plan: 'Enterprise', projects: 15, bots: 42, runtimeMix: { laravel: 20, python: 12, js: 10 }, status: 'active', joined: '2023-08-05' },
    { id: 'u_8298', name: 'Test User', email: 'test@example.com', plan: 'Starter', projects: 1, bots: 1, runtimeMix: { js: 1 }, status: 'unverified', joined: '2024-03-10' }
  ];
  renderAdminUsers();

  // Simulated Projects
  adminData.projects = [
    { id: 'p_1921', name: 'mod-squad', owner: 'alex@dev.co', runtime: 'laravel', bots: 7, region: 'EU-West', cpu: 45, mem: 52, lastDeploy: '2h ago', status: 'active' },
    { id: 'p_1922', name: 'analytics', owner: 'sarah@bot.io', runtime: 'python', bots: 2, region: 'US-East', cpu: 12, mem: 18, lastDeploy: '1d ago', status: 'active' },
    { id: 'p_1923', name: 'spam-net', owner: 'bad@actor.com', runtime: 'js', bots: 50, region: 'US-East', cpu: 98, mem: 94, lastDeploy: '5m ago', status: 'flagged' },
    { id: 'p_1924', name: 'bot-farm', owner: 'priya@botfarm.com', runtime: 'laravel', bots: 42, region: 'EU-West', cpu: 72, mem: 68, lastDeploy: '30m ago', status: 'active' },
    { id: 'p_1925', name: 'data-cruncher', owner: 'jane@company.com', runtime: 'python', bots: 12, region: 'US-East', cpu: 88, mem: 76, lastDeploy: '1h ago', status: 'active' },
    { id: 'p_1926', name: 'web-app', owner: 'jane@company.com', runtime: 'node', bots: 8, region: 'EU-West', cpu: 34, mem: 41, lastDeploy: '4h ago', status: 'active' }
  ];
  renderAdminProjects();

  // Simulated Bots
  adminData.bots = [];
  var botNames = ['mod-bot', 'discord-py', 'welcome', 'analytics-bot', 'spam-1', 'spam-2', 'helper', 'status-bot', 'logger', 'api-bot'];
  var regions = ['EU-West', 'US-East', 'US-West', 'AP-South', 'AP-North'];
  var statuses = ['running', 'running', 'running', 'running', 'running', 'running', 'stopped', 'error', 'running', 'running'];
  var runtimes = ['laravel', 'python', 'js', 'python', 'js', 'js', 'laravel', 'node', 'python', 'js'];
  for (var i = 0; i < 30; i++) {
    var bi = i % botNames.length;
    var ri = i % regions.length;
    var st = i < statuses.length ? statuses[i % statuses.length] : 'running';
    adminData.bots.push({
      id: 'b_' + (48291 + i),
      name: botNames[bi] + (i >= botNames.length ? '-' + Math.floor(i / botNames.length) : ''),
      project: adminData.projects[i % adminData.projects.length].name,
      owner: adminData.projects[i % adminData.projects.length].owner,
      runtime: runtimes[i % runtimes.length],
      region: regions[ri],
      status: st === 'running' ? 'active' : st === 'stopped' ? 'stopped' : 'error',
      uptime: st === 'running' ? Math.floor(Math.random() * 20 + 1) + 'd' : '—',
      lastSeen: st === 'running' ? Math.floor(Math.random() * 60) + 's ago' : '—'
    });
  }
  renderAdminBots();

  // Simulated Deployments
  adminData.deployments = [];
  for (var di = 0; di < 20; di++) {
    var depStatus = di < 3 ? 'running' : di < 10 ? 'pending' : 'completed';
    if (di >= 18) depStatus = 'failed';
    adminData.deployments.push({
      id: '#' + (12921 - di),
      bot: 'bot_' + (9121 - di),
      runtime: runtimes[di % runtimes.length],
      duration: depStatus === 'completed' ? Math.floor(Math.random() * 50 + 10) + 's' : depStatus === 'running' ? Math.floor(Math.random() * 50 + 10) + 's' : '—',
      status: depStatus,
      time: depStatus === 'completed' ? Math.floor(Math.random() * 30 + 1) + 'm ago' : '—'
    });
  }
  renderAdminDeployments();

  // Simulated ZIP Queue
  adminData.zipQueue = [
    { id: 'z_291', filename: 'discord-bot.zip', size: '12MB', owner: 'alex@dev.co', runtime: 'Python', security: 'clean', status: 'Deployed', uploaded: '2h ago' },
    { id: 'z_292', filename: 'mod-suite.zip', size: '45MB', owner: 'sarah@bot.io', runtime: 'Laravel', security: 'clean', status: 'Deployed', uploaded: '1h ago' },
    { id: 'z_293', filename: 'suspicious.zip', size: '89MB', owner: 'unknown@temp.com', runtime: 'JS', security: 'threat', status: 'Quarantined', uploaded: '10m ago' },
    { id: 'z_294', filename: 'big-archive.zip', size: '120MB', owner: 'dev@co.com', runtime: '—', security: 'warning', status: 'Rejected', uploaded: '5m ago' },
    { id: 'z_295', filename: 'bot-pack.zip', size: '23MB', owner: 'jane@company.com', runtime: 'Python', security: 'clean', status: 'Processing', uploaded: '1m ago' }
  ];
  renderAdminZipQueue();

  // Simulated Tickets
  adminData.tickets = [
    { id: '#8921', title: 'Bot crash loop', user: 'alex@dev.co', severity: 'critical', runtime: 'Laravel', region: 'EU-West', time: '23m ago', status: 'open' },
    { id: '#8920', title: 'ZIP upload failing', user: 'dev@co.com', severity: 'warning', runtime: '—', region: '—', time: '1h ago', status: 'open' },
    { id: '#8919', title: 'Billing question', user: 'paid@co.com', severity: 'low', runtime: '—', region: '—', time: '3h ago', status: 'open' },
    { id: '#8918', title: 'Deploy timeout', user: 'alex@dev.co', severity: 'warning', runtime: 'Python', region: 'US-East', time: '5h ago', status: 'assigned' },
    { id: '#8917', title: 'Node version upgrade', user: 'jane@company.com', severity: 'low', runtime: 'Node', region: '—', time: '8h ago', status: 'assigned' },
    { id: '#8916', title: 'Invoice error', user: 'bob@startup.io', severity: 'medium', runtime: '—', region: '—', time: '1d ago', status: 'waiting' },
    { id: '#8915', title: 'Feature request: Go runtime', user: 'dev@company.com', severity: 'low', runtime: '—', region: '—', time: '2d ago', status: 'resolved' },
    { id: '#8914', title: 'SSL certificate expiring', user: 'admin@corp.com', severity: 'high', runtime: '—', region: 'EU-West', time: '3d ago', status: 'resolved' }
  ];
  renderTickets();

  // Simulated Audit Log
  adminData.auditLog = [
    { timestamp: '2024-01-15 14:32:05', admin: 'admin@nexus.host', action: 'SUSPENDED_USER', resource: 'u_8293', reason: 'Spam' },
    { timestamp: '2024-01-15 14:28:11', admin: 'infra@nexus.host', action: 'SCALED_REGION', resource: 'eu-west', reason: '+2 nodes' },
    { timestamp: '2024-01-15 14:15:33', admin: 'support@nexus.host', action: 'RESOLVED_TICKET', resource: '#8921', reason: 'Fixed' },
    { timestamp: '2024-01-15 13:45:00', admin: 'admin@nexus.host', action: 'CHANGED_PLAN', resource: 'u_8291', reason: 'Pro→Enterprise' },
    { timestamp: '2024-01-15 13:30:22', admin: 'security@nexus.host', action: 'QUARANTINED_ZIP', resource: 'z_293', reason: 'Threat detected' },
    { timestamp: '2024-01-15 13:15:44', admin: 'admin@nexus.host', action: 'BANNED_USER', resource: 'u_8293', reason: 'ToS violation' },
    { timestamp: '2024-01-15 12:58:10', admin: 'infra@nexus.host', action: 'MAINTENANCE_MODE', resource: 'us-west', reason: 'Scheduled upgrade' },
    { timestamp: '2024-01-15 12:30:00', admin: 'support@nexus.host', action: 'ASSIGNED_TICKET', resource: '#8918', reason: 'Assigned to infra' },
    { timestamp: '2024-01-15 11:45:33', admin: 'admin@nexus.host', action: 'CREATED_COUPON', resource: 'SUMMER2024', reason: '30% off annual' },
    { timestamp: '2024-01-15 11:20:15', admin: 'security@nexus.host', action: 'BLOCKED_IP', resource: '192.168.1.100', reason: 'Malicious uploads' }
  ];
  renderAdminAudit();

  // Simulated Billing
  adminData.billing = [
    { id: 'tx_8291', user: 'alex@dev.co', plan: 'Pro', amount: 29.00, status: 'paid', method: 'Card', date: 'Jan 15' },
    { id: 'tx_8292', user: 'sarah@bot.io', plan: 'Starter', amount: 9.00, status: 'paid', method: 'PayPal', date: 'Jan 16' },
    { id: 'tx_8293', user: 'bad@actor.com', plan: 'Pro', amount: 29.00, status: 'disputed', method: 'Card', date: 'Jan 10' },
    { id: 'tx_8294', user: 'jane@company.com', plan: 'Enterprise', amount: 99.00, status: 'paid', method: 'Card', date: 'Jan 17' },
    { id: 'tx_8295', user: 'priya@botfarm.com', plan: 'Enterprise', amount: 99.00, status: 'paid', method: 'Wire', date: 'Jan 14' },
    { id: 'tx_8296', user: 'bob@startup.io', plan: 'Pro', amount: 29.00, status: 'failed', method: 'Card', date: 'Jan 12' },
    { id: 'tx_8297', user: 'new@hello.com', plan: 'Starter', amount: 9.00, status: 'refunded', method: 'PayPal', date: 'Jan 08' }
  ];
  renderBilling();

  // Simulated Infrastructure
  adminData.infraRegions = [
    { name: 'EU-West (ams)', status: 'healthy', bots: 3241, cpu: 62, mem: 58, nodes: 14, network_in: '1.2Gbps', network_out: '890Mbps', color: 'green' },
    { name: 'US-East (iad)', status: 'healthy', bots: 2891, cpu: 71, mem: 64, nodes: 12, network_in: '980Mbps', network_out: '720Mbps', color: 'green' },
    { name: 'US-West (pdx)', status: 'degraded', bots: 1102, cpu: 84, mem: 81, nodes: 6, network_in: '450Mbps', network_out: '380Mbps', color: 'amber' },
    { name: 'AP-South (bom)', status: 'healthy', bots: 567, cpu: 45, mem: 42, nodes: 4, network_in: '210Mbps', network_out: '180Mbps', color: 'green' },
    { name: 'AP-North (tyo)', status: 'healthy', bots: 620, cpu: 38, mem: 35, nodes: 5, network_in: '320Mbps', network_out: '290Mbps', color: 'green' }
  ];
  renderInfrastructure();

  // Simulated IP Blocks
  adminData.ipBlocks = [
    { ip: '192.168.1.100', reason: 'Malicious ZIP uploads', blockedBy: 'security@nexus.host', date: '2024-01-15' },
    { ip: '10.0.0.55', reason: 'Brute force login attempts', blockedBy: 'admin@nexus.host', date: '2024-01-14' },
    { ip: '172.16.0.23', reason: 'DDoS source', blockedBy: 'infra@nexus.host', date: '2024-01-12' },
    { ip: '203.0.113.42', reason: 'Known malware distribution', blockedBy: 'security@nexus.host', date: '2024-01-10' }
  ];
  renderIPBlocks();

  // Activity Log simulation
  adminData.activityLog = [];
  for (var ai = 0; ai < 50; ai++) {
    var types = ['deploy', 'zip', 'scale', 'register', 'payment', 'scan', 'build', 'login'];
    var msgs = [
      ' deployed \'bot-' + (100 + ai) + '\'',
      'ZIP uploaded: archive-' + (ai + 1) + '.zip',
      ' auto-scaled to ' + (ai % 5 + 1),
      'New user registered: user' + (ai + 100) + '@email.com',
      'Payment succeeded: $' + (9 + (ai % 3) * 20) + '.00',
      'Security scan passed: bot_' + (8000 + ai),
      'Build ' + (ai % 3 === 0 ? 'failed' : 'succeeded') + ': bot_' + (8000 + ai),
      'Login from new IP: 192.168.' + ai + '.' + (ai * 2 % 255)
    ];
    adminData.activityLog.push({
      time: new Date(Date.now() - ai * 60000).toLocaleTimeString(),
      type: types[ai % types.length],
      msg: msgs[ai % msgs.length]
    });
  }

  updateDashboardKPIs();
  renderCapacityStats();
  renderFeatureFlags();
  renderPlans();
  loadAlerts();
  drawRevenueChart();
  drawTopProjectsChart();
}

/* ======================== DASHBOARD ======================== */

function loadAlerts() {
  var container = document.getElementById('adminAlertBanner');
  container.innerHTML =
    '<div class="admin-alert-banner warning">' +
    '<span>🟡 WARNING: ZIP queue backlog — 5 archives pending scan</span>' +
    '<button class="alert-close" onclick="this.parentElement.remove()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>';
}

function updateDashboardKPIs() {
  var activeUsers = adminData.users.filter(function(u) { return u.status === 'active'; }).length;
  var totalBots = adminData.bots.filter(function(b) { return b.status === 'active'; }).length;
  var failedDeps = adminData.deployments.filter(function(d) { return d.status === 'failed'; }).length;
  var mrr = adminData.billing.reduce(function(sum, t) { return sum + (t.status === 'paid' ? t.amount : 0); }, 0);
  document.getElementById('kpiUsers').textContent = adminData.users.length;
  document.getElementById('kpiUsersTrend').textContent = '↑ ' + activeUsers + ' active';
  document.getElementById('kpiBots').textContent = totalBots;
  document.getElementById('kpiBotsTrend').textContent = '↑ ' + Math.floor(totalBots * 0.1) + ' today';
  document.getElementById('kpiDeployments').textContent = adminData.deployments.length;
  document.getElementById('kpiDeploymentsTrend').textContent = failedDeps + ' failed';
  document.getElementById('kpiDeploymentsTrend').className = 'kpi-trend ' + (failedDeps > 0 ? 'down' : 'up');
  document.getElementById('kpiRevenue').textContent = '$' + mrr.toLocaleString();
  document.getElementById('kpiRevenueTrend').textContent = '↑ 12% vs last month';
}

function renderDashboard() {
  renderLiveActivity();
  renderDeployQueue();
  renderInfraHealthTable();
  renderTicketPreview();
}

function renderLiveActivity() {
  var container = document.getElementById('liveActivity');
  var items = adminData.activityLog.slice(0, 15);
  container.innerHTML = items.map(function(a) {
    var cls = '';
    if (a.type === 'deploy' || a.type === 'build') {
      if (a.msg.indexOf('failed') > -1) cls = 'error';
      else if (a.msg.indexOf('succeeded') > -1) cls = 'success';
      else cls = 'info';
    } else if (a.type === 'payment') cls = 'success';
    else if (a.type === 'zip') cls = 'gold';
    else cls = 'info';
    return '<div class="activity-item"><span class="activity-time">' + a.time + '</span><span class="activity-msg"><span class="' + cls + '">' + a.msg + '</span></span></div>';
  }).join('');
}

function startActivityStream() {
  if (activityInterval) clearInterval(activityInterval);
  activityInterval = setInterval(function() {
    var newActivity = {
      time: new Date().toLocaleTimeString(),
      type: ['deploy', 'zip', 'payment', 'register', 'build'][Math.floor(Math.random() * 5)],
      msg: [' deployed \'bot-live\'', 'ZIP uploaded: update-pack.zip', 'Payment succeeded: $29.00', 'New user registered', 'Build completed: bot_' + (9000 + Math.floor(Math.random() * 1000))][Math.floor(Math.random() * 5)]
    };
    adminData.activityLog.unshift(newActivity);
    var liveEl = document.getElementById('liveActivity');
    if (liveEl) {
      var firstItem = liveEl.querySelector('.activity-item');
      var div = document.createElement('div');
      div.className = 'activity-item';
      var cls = newActivity.type === 'payment' ? 'success' : newActivity.type === 'zip' ? 'gold' : 'info';
      if (newActivity.msg.indexOf('failed') > -1) cls = 'error';
      div.innerHTML = '<span class="activity-time">' + newActivity.time + '</span><span class="activity-msg"><span class="' + cls + '">' + newActivity.msg + '</span></span>';
      liveEl.insertBefore(div, firstItem);
      if (liveEl.children.length > 15) liveEl.removeChild(liveEl.lastChild);
    }
  }, 8000);
}

function renderDeployQueue() {
  var container = document.getElementById('adminDeployQueue');
  var running = adminData.deployments.filter(function(d) { return d.status === 'running'; });
  var pending = adminData.deployments.filter(function(d) { return d.status === 'pending'; });
  var failed = adminData.deployments.filter(function(d) { return d.status === 'failed'; });
  var html = '';
  if (running.length > 0) {
    html += '<div style="color:var(--signal-white);font-size:0.82rem;font-weight:600;margin-bottom:0.5rem">Building (' + running.length + ')</div>';
    html += running.slice(0, 3).map(function(d) {
      var runtime = getAdminRuntimeConfig(d.runtime);
      return '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0;border-bottom:1px solid rgba(255,255,255,0.03)">' +
        '<span style="color:var(--titanium)">' + d.bot + '</span>' +
        '<span class="runtime-badge ' + (d.runtime === 'node' ? 'js' : d.runtime) + '" style="font-size:0.6rem">' + (runtime ? runtime.label : d.runtime) + '</span>' +
        '<div class="progress-inline"><div class="fill fill-cyan" style="width:' + Math.floor(Math.random() * 60 + 20) + '%"></div></div>' +
        '<span style="color:var(--titanium);margin-left:auto">' + d.duration + '</span></div>';
    }).join('');
  }
  if (pending.length > 0) {
    html += '<div style="color:var(--titanium);font-size:0.75rem;font-weight:600;margin:0.75rem 0 0.35rem">Pending (' + pending.length + ')</div>';
    html += pending.slice(0, 3).map(function(d) {
      return '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.25rem 0;opacity:0.6">' +
        '<span>' + d.bot + '</span><span style="color:var(--titanium);margin-left:auto">queued</span></div>';
    }).join('');
  }
  if (failed.length > 0) {
    html += '<div style="color:var(--alert-red);font-size:0.75rem;font-weight:600;margin:0.75rem 0 0.35rem;display:flex;align-items:center;justify-content:space-between">Failed (' + failed.length + ')<button class="btn btn-ghost btn-sm" style="font-size:0.7rem">View All</button></div>';
    html += failed.slice(0, 2).map(function(d) {
      return '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0">' +
        '<span style="color:var(--alert-red)">' + d.bot + '</span>' +
        '<span style="color:var(--titanium);font-size:0.72rem">' + d.id + '</span>' +
        '<div style="margin-left:auto;display:flex;gap:0.3rem">' +
        '<button class="btn btn-ghost btn-sm" style="font-size:0.65rem;color:var(--alert-red);padding:0.15rem 0.4rem">Retry</button>' +
        '<button class="btn btn-ghost btn-sm" style="font-size:0.65rem;padding:0.15rem 0.35rem">Logs</button></div></div>';
    }).join('');
  }
  if (!html) html = '<div style="color:var(--titanium);text-align:center;padding:1rem">No active deployments</div>';
  container.innerHTML = html;
}

function renderInfraHealthTable() {
  var container = document.getElementById('infraHealthTable');
  var rows = adminData.infraRegions.map(function(r) {
    var statusDot = r.status === 'healthy' ? '🟢' : '🟡';
    var cpuClass = r.cpu < 70 ? 'fill-green' : r.cpu < 85 ? 'fill-amber' : 'fill-red';
    var memClass = r.mem < 70 ? 'fill-green' : r.mem < 85 ? 'fill-amber' : 'fill-red';
    return '<div style="display:grid;grid-template-columns:1.5fr 0.5fr 1fr 1fr 1fr;gap:0.5rem;padding:0.5rem 0;border-bottom:1px solid rgba(255,255,255,0.03);font-size:0.82rem;align-items:center">' +
      '<span style="color:var(--signal-white)">' + r.name + '</span>' +
      '<span>' + statusDot + '</span>' +
      '<span>' + r.bots.toLocaleString() + '</span>' +
      '<div class="progress-inline" style="width:60px"><div class="fill ' + cpuClass + '" style="width:' + r.cpu + '%"></div></div>' +
      '<div class="progress-inline" style="width:60px"><div class="fill ' + memClass + '" style="width:' + r.mem + '%"></div></div></div>';
  }).join('');
  container.innerHTML =
    '<div style="display:grid;grid-template-columns:1.5fr 0.5fr 1fr 1fr 1fr;gap:0.5rem;padding:0.35rem 0;font-size:0.7rem;color:var(--titanium);text-transform:uppercase;letter-spacing:0.06em">' +
    '<span>Region</span><span></span><span>Bots</span><span>CPU</span><span>Mem</span></div>' + rows;
}

function renderTicketPreview() {
  var container = document.getElementById('adminTicketPreview');
  var open = adminData.tickets.filter(function(t) { return t.status === 'open'; });
  container.innerHTML = open.slice(0, 3).map(function(t) {
    var color = t.severity === 'critical' ? 'var(--alert-red)' : t.severity === 'warning' ? 'var(--warning-amber)' : 'var(--success-green)';
    return '<div style="padding:0.65rem 0;border-bottom:1px solid rgba(255,255,255,0.03)">' +
      '<div style="display:flex;align-items:center;gap:0.5rem">' +
      '<span style="width:3px;height:32px;border-radius:2px;background:' + color + ';flex-shrink:0"></span>' +
      '<div style="flex:1;min-width:0">' +
      '<div style="font-size:0.82rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + t.title + '</div>' +
      '<div style="font-size:0.72rem;color:var(--titanium)">' + t.id + ' — ' + t.user + ' · ' + t.time + '</div></div>' +
      '<span class="severity-tag ' + t.severity + '">' + t.severity + '</span></div></div>';
  }).join('');
  container.innerHTML += '<div style="text-align:center;padding:0.5rem 0 0;font-size:0.78rem;color:var(--titanium)">' +
    adminData.tickets.filter(function(t) { return t.status !== 'resolved'; }).length + ' unresolved tickets</div>';
}

function getAdminRuntimeConfig(runtime) {
  var map = { laravel: { label: 'Laravel', color: '#00F0FF' }, python: { label: 'Python', color: '#FFD43B' }, node: { label: 'JS', color: '#F7DF1E' }, js: { label: 'JS', color: '#F7DF1E' }, zip: { label: 'ZIP', color: '#7B61FF' } };
  return map[runtime] || null;
}

function drawRevenueChart() {
  var canvas = document.getElementById('revenueChart');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  var w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);
  var data = [2400, 3100, 2800, 3600, 3200, 3900, 4100];
  var labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var pad = { top: 20, right: 20, bottom: 30, left: 50 };
  var cw = w - pad.left - pad.right, ch = h - pad.top - pad.bottom;
  var max = Math.max(...data) * 1.2;
  var stepX = cw / (data.length - 1);
  ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1;
  for (var i = 0; i <= 4; i++) {
    var y = pad.top + (ch / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '9px Inter'; ctx.textAlign = 'right';
    ctx.fillText('$' + Math.round(max - (max / 4) * i), pad.left - 6, y + 3);
  }
  ctx.beginPath();
  ctx.strokeStyle = '#00F0FF'; ctx.lineWidth = 2.5;
  ctx.shadowColor = 'rgba(0,240,255,0.3)'; ctx.shadowBlur = 10;
  data.forEach(function(v, i) {
    var x = pad.left + (i / (data.length - 1)) * cw;
    var y = pad.top + ch - (v / max) * ch;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(0,240,255,0.1)';
  ctx.lineTo(pad.left + cw, pad.top + ch);
  ctx.lineTo(pad.left, pad.top + ch);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '9px Inter'; ctx.textAlign = 'center';
  data.forEach(function(v, i) {
    var x = pad.left + (i / (data.length - 1)) * cw;
    ctx.fillText(labels[i], x, h - pad.bottom + 16);
  });
}

function drawTopProjectsChart() {
  var canvas = document.getElementById('topProjectsChart');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  var w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);
  var top = adminData.projects.slice(0, 5).sort(function(a, b) { return (b.cpu + b.mem) - (a.cpu + a.mem); });
  var pad = { top: 10, right: 20, bottom: 30, left: 10 };
  var cw = w - pad.left - pad.right, ch = h - pad.top - pad.bottom;
  var barW = Math.min(60, (cw / top.length) * 0.7);
  var gap = (cw - barW * top.length) / (top.length + 1);
  var maxVal = 200;
  var colors = ['#00F0FF', '#FFD43B', '#F7DF1E', '#7B61FF', '#2ED573'];
  top.forEach(function(p, i) {
    var val = (p.cpu || 0) + (p.mem || 0);
    var barH = Math.max(4, (val / maxVal) * ch);
    var x = pad.left + gap + i * (barW + gap);
    var y = pad.top + ch - barH;
    ctx.fillStyle = colors[i % colors.length];
    ctx.shadowColor = colors[i % colors.length] + '40';
    ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '7px Inter'; ctx.textAlign = 'center';
    ctx.fillText(p.name.length > 8 ? p.name.substring(0, 8) + '..' : p.name, x + barW / 2, h - pad.bottom + 14);
  });
}

/* ======================== USERS ======================== */

function renderAdminUsers() {
  var body = document.getElementById('usersTableBody');
  var query = (document.getElementById('usersSearch')?.value || '').toLowerCase();
  var statusFilter = document.getElementById('usersStatusFilter')?.value || '';
  var filtered = adminData.users.filter(function(u) {
    if (statusFilter && u.status !== statusFilter) return false;
    if (query && !(u.email || '').toLowerCase().includes(query) && !(u.name || '').toLowerCase().includes(query) && !(u.id || '').toLowerCase().includes(query)) return false;
    return true;
  });
  if (filtered.length === 0) { body.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:2rem;color:var(--titanium)">No users found</td></tr>'; return; }
  body.innerHTML = filtered.map(function(u) {
    var statusClass = u.status === 'active' ? 'active' : u.status === 'banned' ? 'error' : u.status === 'suspended' ? 'pending' : 'pending';
    var runtimeHtml = '';
    if (u.runtimeMix) {
      runtimeHtml = Object.entries(u.runtimeMix).map(function(e) {
        var rt = e[0] === 'js' ? 'js' : e[0];
        return '<span class="runtime-dot ' + rt + '">' + e[1] + '</span>';
      }).join(' ');
    }
    return '<tr><td><input type="checkbox"></td>' +
      '<td><span class="cell-id">' + u.id + '</span></td>' +
      '<td style="font-weight:600;color:var(--signal-white)">' + (u.name || '—') + '</td>' +
      '<td>' + u.email + '</td>' +
      '<td>' + (u.plan || '—') + '</td>' +
      '<td>' + (u.projects || 0) + '</td>' +
      '<td>' + (u.bots || 0) + '</td>' +
      '<td>' + runtimeHtml + '</td>' +
      '<td><span class="status-badge ' + statusClass + '">' + u.status + '</span></td>' +
      '<td>' + u.joined + '</td>' +
      '<td class="actions-cell">' +
      '<button class="btn btn-ghost btn-sm" onclick="showUserDetail(\'' + u.id + '\')">View</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="showAdminToast(\'success\',\'User impersonated\')">Impersonate</button></td></tr>';
  }).join('');
}

function showUserDetail(userId) {
  var user = adminData.users.find(function(u) { return u.id === userId; });
  if (!user) return;
  var html =
    '<div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid rgba(255,255,255,0.05)">' +
    '<div style="width:48px;height:48px;border-radius:50%;background:var(--gradient-brand);display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:700;color:#fff">' + (user.name ? user.name.charAt(0) : 'U') + '</div>' +
    '<div><div style="font-size:1.1rem;font-weight:700;color:var(--signal-white)">' + (user.name || 'Unknown') + '</div>' +
    '<div style="color:var(--titanium);font-size:0.85rem">' + user.email + '</div></div>' +
    '<span class="status-badge ' + (user.status === 'active' ? 'active' : user.status === 'banned' ? 'error' : 'pending') + '" style="margin-left:auto">' + user.status + '</span></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;font-size:0.85rem">' +
    '<div><span style="color:var(--titanium)">Plan</span><div style="color:var(--signal-white);font-weight:600">' + (user.plan || 'None') + '</div></div>' +
    '<div><span style="color:var(--titanium)">Total Spend</span><div style="color:var(--signal-white);font-weight:600">$' + (user.bots * 9 + 9) + '.00</div></div>' +
    '<div><span style="color:var(--titanium)">Projects</span><div style="color:var(--signal-white);font-weight:600">' + (user.projects || 0) + '</div></div>' +
    '<div><span style="color:var(--titanium)">Bots</span><div style="color:var(--signal-white);font-weight:600">' + (user.bots || 0) + '</div></div>' +
    '<div><span style="color:var(--titanium)">Deployments</span><div style="color:var(--signal-white);font-weight:600">' + (user.bots * 3 || 0) + '</div></div>' +
    '<div><span style="color:var(--titanium)">Tickets</span><div style="color:var(--signal-white);font-weight:600">' + adminData.tickets.filter(function(t) { return t.user === user.email; }).length + '</div></div></div>' +
    '<div style="margin-top:1.5rem;display:flex;gap:0.5rem;flex-wrap:wrap">' +
    '<button class="btn btn-primary btn-sm" onclick="showAdminToast(\'success\',\'User updated\')">Edit User</button>' +
    '<button class="btn btn-danger btn-sm" onclick="showAdminToast(\'error\',\'User suspended\')">Suspend</button>' +
    '<button class="btn btn-ghost btn-sm" onclick="showAdminToast(\'info\',\'Password reset sent\')">Reset Password</button></div>';
  openAdminSlidePanel('User: ' + (user.name || user.email), html);
}

/* ======================== PROJECTS ======================== */

function renderAdminProjects() {
  var body = document.getElementById('adminProjectsBody');
  var query = (document.getElementById('projectsSearch')?.value || '').toLowerCase();
  var runtimeFilter = document.getElementById('projectsRuntimeFilter')?.value || '';
  var filtered = adminData.projects.filter(function(p) {
    if (runtimeFilter && p.runtime !== runtimeFilter) return false;
    if (query && !p.name.toLowerCase().includes(query) && !(p.owner || '').toLowerCase().includes(query) && !(p.id || '').toLowerCase().includes(query)) return false;
    return true;
  });
  if (filtered.length === 0) { body.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:2rem;color:var(--titanium)">No projects found</td></tr>'; return; }
  body.innerHTML = filtered.map(function(p) {
    var statusHtml = p.status === 'active' ? '<span class="status-badge active">🟢</span>' : '<span class="status-badge error" style="color:var(--alert-red)">🔴 Flagged</span>';
    var runtime = p.runtime || 'laravel';
    var cpuClass = (p.cpu || 0) < 70 ? 'fill-green' : (p.cpu || 0) < 85 ? 'fill-amber' : 'fill-red';
    var memClass = (p.mem || 0) < 70 ? 'fill-green' : (p.mem || 0) < 85 ? 'fill-amber' : 'fill-red';
    var runtimeLabel = getAdminRuntimeConfig(runtime);
    return '<tr style="' + (p.status === 'flagged' ? 'border-left:3px solid var(--alert-red)' : '') + '">' +
      '<td><span class="cell-id">' + p.id + '</span></td>' +
      '<td style="font-weight:600;color:var(--signal-white)">' + p.name + '</td>' +
      '<td>' + p.owner + '</td>' +
      '<td><span class="runtime-badge ' + (runtime === 'node' ? 'js' : runtime) + '">' + (runtimeLabel ? runtimeLabel.label : runtime) + '</span></td>' +
      '<td>' + (p.bots || 0) + '</td>' +
      '<td>' + (p.region || '—') + '</td>' +
      '<td><div class="progress-inline"><div class="fill ' + cpuClass + '" style="width:' + (p.cpu || 0) + '%"></div></div> ' + (p.cpu || 0) + '%</td>' +
      '<td><div class="progress-inline"><div class="fill ' + memClass + '" style="width:' + (p.mem || 0) + '%"></div></div> ' + (p.mem || 0) + '%</td>' +
      '<td>' + (p.lastDeploy || '—') + '</td>' +
      '<td>' + statusHtml + '</td>' +
      '<td class="actions-cell"><button class="btn btn-ghost btn-sm" onclick="showAdminToast(\'info\',\'Managing ' + p.name + '\')">Manage</button></td></tr>';
  }).join('');
}

/* ======================== BOTS ======================== */

function renderAdminBots() {
  var body = document.getElementById('botsTableBody');
  var stats = document.getElementById('botsStatsBar');
  var total = adminData.bots.length;
  var laravel = adminData.bots.filter(function(b) { return b.runtime === 'laravel'; }).length;
  var python = adminData.bots.filter(function(b) { return b.runtime === 'python'; }).length;
  var js = adminData.bots.filter(function(b) { return b.runtime === 'js' || b.runtime === 'node'; }).length;
  var stopped = adminData.bots.filter(function(b) { return b.status === 'stopped'; }).length;
  var errors = adminData.bots.filter(function(b) { return b.status === 'error'; }).length;
  stats.innerHTML =
    'Total Bots: <span class="val">' + total + '</span> <span style="opacity:0.4">|</span> ' +
    'Laravel: <span class="val cyan">' + laravel + '</span> <span style="opacity:0.4">|</span> ' +
    'Python: <span class="val gold">' + python + '</span> <span style="opacity:0.4">|</span> ' +
    'JavaScript: <span class="val yellow">' + js + '</span> <span style="opacity:0.4">|</span> ' +
    'Stopped: <span class="val">' + stopped + '</span> <span style="opacity:0.4">|</span> ' +
    'Error: <span class="val red">' + errors + '</span>';
  var query = (document.getElementById('botsSearch')?.value || '').toLowerCase();
  var filtered = adminData.bots.filter(function(b) {
    if (query && !b.name.toLowerCase().includes(query) && !(b.owner || '').toLowerCase().includes(query) && !(b.id || '').toLowerCase().includes(query)) return false;
    return true;
  });
  body.innerHTML = filtered.map(function(b) {
    var statusClass = b.status === 'active' ? 'active' : b.status === 'error' ? 'error' : 'pending';
    var runtime = b.runtime === 'node' ? 'js' : b.runtime;
    return '<tr><td><input type="checkbox" value="' + b.id + '" onchange="updateBulkCheck(this)"></td>' +
      '<td><span class="cell-id">' + b.id + '</span></td>' +
      '<td style="font-weight:600;color:var(--signal-white)">' + b.name + '</td>' +
      '<td>' + b.project + '</td>' +
      '<td>' + b.owner + '</td>' +
      '<td><span class="runtime-badge ' + runtime + '">' + getAdminRuntimeConfig(b.runtime).label + '</span></td>' +
      '<td>' + b.region + '</td>' +
      '<td><span class="status-badge ' + statusClass + '">' + b.status + '</span></td>' +
      '<td>' + (b.uptime || '—') + '</td>' +
      '<td>' + (b.lastSeen || '—') + '</td>' +
      '<td class="actions-cell">' +
      '<button class="btn btn-ghost btn-sm" onclick="showAdminToast(\'info\',\'Logs for ' + b.name + '\')">Logs</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="showAdminToast(\'success\',\'Restarted\')">Restart</button></td></tr>';
  }).join('');
}

function updateBulkCheck(cb) {
  if (cb.checked) bulkSelected.add(cb.value);
  else bulkSelected.delete(cb.value);
  updateBulkBar();
}

/* ======================== DEPLOYMENTS ======================== */

function renderAdminDeployments() {
  var container = document.getElementById('adminBuildQueue');
  var detail = document.getElementById('adminBuildDetail');
  var running = adminData.deployments.filter(function(d) { return d.status === 'running'; });
  var pending = adminData.deployments.filter(function(d) { return d.status === 'pending'; });
  var completed = adminData.deployments.filter(function(d) { return d.status === 'completed'; });
  var failed = adminData.deployments.filter(function(d) { return d.status === 'failed'; });
  var html = '';
  if (running.length > 0) {
    html += '<div style="color:var(--signal-white);font-weight:600;margin-bottom:0.5rem;font-size:0.85rem">Running (' + running.length + ')</div>';
    html += running.map(function(d) {
      return '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border-bottom:1px solid rgba(255,255,255,0.03);cursor:pointer" onclick="showBuildDetail(\'' + d.id + '\')">' +
        '<span style="color:var(--nexus-cyan)">' + d.id + '</span> ' + d.bot +
        ' <span class="runtime-badge ' + (d.runtime === 'node' ? 'js' : d.runtime) + '" style="font-size:0.6rem">' + getAdminRuntimeConfig(d.runtime).label + '</span>' +
        ' <div class="progress-inline"><div class="fill fill-cyan" style="width:' + Math.floor(Math.random() * 60 + 20) + '%"></div></div>' +
        ' <span style="margin-left:auto;color:var(--titanium);font-size:0.72rem">' + d.duration + '</span>' +
        ' <button class="btn btn-ghost btn-sm" style="font-size:0.6rem;padding:0.1rem 0.3rem;color:var(--alert-red)">Cancel</button></div>';
    }).join('');
  }
  if (pending.length > 0) {
    html += '<div style="color:var(--titanium);font-size:0.78rem;font-weight:600;margin:0.75rem 0 0.35rem">Pending (' + pending.length + ')</div>';
    html += pending.slice(0, 5).map(function(d) {
      return '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;opacity:0.6">' +
        '<span style="color:var(--titanium)">' + d.id + '</span> ' + d.bot +
        ' <span style="margin-left:auto;color:var(--titanium);font-size:0.72rem">queued</span></div>';
    }).join('');
  }
  if (completed.length > 0) {
    html += '<div style="color:var(--success-green);font-size:0.78rem;font-weight:600;margin:0.75rem 0 0.35rem">Completed (Last ' + Math.min(completed.length, 5) + ')</div>';
    html += completed.slice(0, 5).map(function(d) {
      var success = d.status === 'completed' && !d.id.includes('18') && !d.id.includes('19');
      return '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;font-size:0.75rem">' +
        '<span style="color:var(--titanium)">' + d.id + '</span> ' + d.bot +
        ' <span style="margin-left:auto">' + (success ? '✓' : '✗') + ' ' + (d.time || d.duration) + '</span></div>';
    }).join('');
  }
  if (failed.length > 0) {
    html += '<div style="color:var(--alert-red);font-size:0.78rem;font-weight:600;margin:0.75rem 0 0.35rem">Failed (' + failed.length + ')</div>';
    html += failed.map(function(d) {
      return '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0">' +
        '<span style="color:var(--alert-red)">' + d.id + '</span> ' + d.bot +
        ' <span style="color:var(--titanium);font-size:0.72rem">' + d.time + '</span>' +
        '<div style="margin-left:auto;display:flex;gap:0.3rem">' +
        '<button class="btn btn-ghost btn-sm" style="font-size:0.6rem;padding:0.1rem 0.3rem;color:var(--alert-red)">Retry</button>' +
        '<button class="btn btn-ghost btn-sm" style="font-size:0.6rem;padding:0.1rem 0.3rem">Logs</button></div></div>';
    }).join('');
  }
  if (!html) html = '<div style="color:var(--titanium);text-align:center;padding:2rem">No deployments in queue</div>';
  container.innerHTML = html;
}

function showBuildDetail(id) {
  var dep = adminData.deployments.find(function(d) { return d.id === id; });
  if (!dep) return;
  var container = document.getElementById('adminBuildDetail');
  var runtime = getAdminRuntimeConfig(dep.runtime);
  container.innerHTML =
    '<div style="margin-bottom:0.75rem;padding-bottom:0.75rem;border-bottom:1px solid rgba(255,255,255,0.05)">' +
    '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.3rem">' +
    '<span style="color:var(--signal-white);font-weight:600;font-size:0.9rem">' + dep.id + '</span>' +
    '<span class="runtime-badge ' + (dep.runtime === 'node' ? 'js' : dep.runtime) + '">' + (runtime ? runtime.label : '') + '</span></div>' +
    '<div style="color:var(--titanium);font-size:0.75rem">' + dep.bot + ' · ' + (dep.duration || 'in progress') + '</div></div>' +
    '<div style="font-size:0.75rem;line-height:1.8">' +
    '<div style="color:var(--success-green)">✓ Checkout complete</div>' +
    '<div style="color:var(--success-green)">✓ Dependencies installed</div>' +
    '<div style="color:' + (dep.status === 'failed' ? 'var(--alert-red)' : 'var(--success-green)') + '">' + (dep.status === 'failed' ? '✗' : '✓') + ' Build step</div>' +
    '<div style="color:' + (dep.status === 'failed' ? 'var(--titanium)' : dep.status === 'completed' ? 'var(--success-green)' : 'var(--nexus-cyan)') + '">' +
    (dep.status === 'completed' ? '✓' : dep.status === 'failed' ? '—' : '▶') + ' Push to registry</div>' +
    '<div style="color:' + (dep.status === 'completed' ? 'var(--success-green)' : 'var(--titanium)') + '">' +
    (dep.status === 'completed' ? '✓' : '—') + ' Deploy to edge</div></div>' +
    '<div style="margin-top:1rem;padding-top:0.75rem;border-top:1px solid rgba(255,255,255,0.05);display:flex;gap:0.5rem">' +
    '<button class="btn btn-primary btn-sm" onclick="showAdminToast(\'info\',\'Build retriggered\')">Retry Build</button>' +
    '<button class="btn btn-secondary btn-sm" onclick="showAdminToast(\'info\',\'Full logs opened\')">View Full Logs</button></div>';
}

/* ======================== ZIP QUEUE ======================== */

function renderAdminZipQueue() {
  var body = document.getElementById('zipQueueBody');
  var filter = document.getElementById('zipSecurityFilter')?.value || '';
  var filtered = filter ? adminData.zipQueue.filter(function(z) { return z.security === filter; }) : adminData.zipQueue;
  if (filtered.length === 0) { body.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;color:var(--titanium)">No ZIP uploads found</td></tr>'; return; }
  body.innerHTML = filtered.map(function(z) {
    var secClass = z.security === 'clean' ? 'active' : z.security === 'warning' ? 'pending' : 'error';
    var secDot = z.security === 'clean' ? '🟢' : z.security === 'warning' ? '🟡' : '🔴';
    var statusClass = z.status === 'Deployed' ? 'active' : z.status === 'Quarantined' ? 'error' : z.status === 'Rejected' ? 'pending' : 'deploying';
    return '<tr>' +
      '<td><span class="cell-id">' + z.id + '</span></td>' +
      '<td style="font-weight:600;color:var(--signal-white)">' + z.filename + '</td>' +
      '<td>' + z.size + '</td>' +
      '<td>' + z.owner + '</td>' +
      '<td>' + z.runtime + '</td>' +
      '<td><span class="status-badge ' + secClass + '">' + secDot + ' ' + z.security.charAt(0).toUpperCase() + z.security.slice(1) + '</span></td>' +
      '<td><span class="status-badge ' + statusClass + '">' + z.status + '</span></td>' +
      '<td>' + z.uploaded + '</td>' +
      '<td class="actions-cell">' +
      '<button class="btn btn-ghost btn-sm" onclick="showAdminToast(\'info\',\'Viewing ' + z.filename + '\')">View</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="showAdminToast(\'success\',\'Rescan initiated\')">Re-scan</button></td></tr>';
  }).join('');
}

/* ======================== INFRASTRUCTURE ======================== */

function renderInfrastructure() {
  var container = document.getElementById('infraRegionGrid');
  container.innerHTML = adminData.infraRegions.map(function(r) {
    var dot = r.status === 'healthy' ? '🟢' : '🟡';
    var cpuClass = r.cpu < 70 ? 'fill-green' : r.cpu < 85 ? 'fill-amber' : 'fill-red';
    var memClass = r.mem < 70 ? 'fill-green' : r.mem < 85 ? 'fill-amber' : 'fill-red';
    return '<div class="admin-card" style="cursor:pointer" onclick="showRegionDetail(\'' + r.name + '\')">' +
      '<div class="admin-card-header"><div class="card-title">' + dot + ' ' + r.name + '</div><button class="btn btn-ghost btn-sm">→</button></div>' +
      '<div class="admin-card-body" style="font-size:0.82rem">' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:0.5rem"><span style="color:var(--titanium)">Nodes:</span><span>' + r.nodes + ' active</span></div>' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:0.5rem"><span style="color:var(--titanium)">Bots:</span><span>' + r.bots.toLocaleString() + '</span></div>' +
      '<div style="margin-bottom:0.3rem"><span style="color:var(--titanium);font-size:0.75rem">CPU</span><div class="progress-bar" style="height:4px;margin-top:0.2rem"><div class="progress-fill ' + cpuClass + '" style="width:' + r.cpu + '%;background:' + (r.cpu < 70 ? 'var(--success-green)' : r.cpu < 85 ? 'var(--warning-amber)' : 'var(--alert-red)') + '"></div></div></div>' +
      '<div style="margin-bottom:0.5rem"><span style="color:var(--titanium);font-size:0.75rem">Memory</span><div class="progress-bar" style="height:4px;margin-top:0.2rem"><div class="progress-fill ' + memClass + '" style="width:' + r.mem + '%;background:' + (r.mem < 70 ? 'var(--success-green)' : r.mem < 85 ? 'var(--warning-amber)' : 'var(--alert-red)') + '"></div></div></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:0.75rem"><span style="color:var(--titanium)">Network:</span><span>' + r.network_in + ' / ' + r.network_out + '</span></div>' +
      '</div>' +
      '<div class="admin-card-footer">' +
      '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();showAdminToast(\'info\',\'Scaling ' + r.name + '\')">Scale Up</button>' +
      '<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();showAdminToast(\'warning\',\'Draining ' + r.name + '\')">Drain</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();showAdminToast(\'warning\',\'Maintenance mode\')">Maintenance</button></div></div>';
  }).join('');
}

function showRegionDetail(regionName) {
  var region = adminData.infraRegions.find(function(r) { return r.name === regionName; });
  if (!region) return;
  var html =
    '<div style="margin-bottom:1rem"><div style="font-size:0.9rem;font-weight:700;color:var(--signal-white);margin-bottom:0.5rem">' + region.name + '</div>' +
    '<span class="status-badge ' + (region.status === 'healthy' ? 'active' : 'pending') + '">' + region.status + '</span></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;font-size:0.85rem">' +
    '<div><span style="color:var(--titanium)">Nodes</span><div style="color:var(--signal-white);font-weight:600">' + region.nodes + ' active</div></div>' +
    '<div><span style="color:var(--titanium)">Bots</span><div style="color:var(--signal-white);font-weight:600">' + region.bots.toLocaleString() + '</div></div>' +
    '<div><span style="color:var(--titanium)">CPU</span><div style="color:var(--signal-white)">' + region.cpu + '%</div></div>' +
    '<div><span style="color:var(--titanium)">Memory</span><div style="color:var(--signal-white)">' + region.mem + '%</div></div>' +
    '<div><span style="color:var(--titanium)">Network In</span><div style="color:var(--signal-white)">' + region.network_in + '</div></div>' +
    '<div><span style="color:var(--titanium)">Network Out</span><div style="color:var(--signal-white)">' + region.network_out + '</div></div></div>' +
    '<div style="margin-top:1.5rem;display:flex;gap:0.5rem">' +
    '<button class="btn btn-primary btn-sm" onclick="showAdminToast(\'info\',\'Scaling\')">Scale Up (+2 nodes)</button>' +
    '<button class="btn btn-danger btn-sm" onclick="showAdminToast(\'warning\',\'Draining\')">Drain Region</button></div>';
  openAdminSlidePanel('Region: ' + region.name, html);
}

/* ======================== CAPACITY ======================== */

function renderCapacityStats() {
  var container = document.getElementById('capacityStatsBar');
  if (!container) return;
  container.innerHTML =
    'Total CPU: <span class="val cyan">' + Math.round(adminData.infraRegions.reduce(function(s, r) { return s + r.cpu; }, 0) / adminData.infraRegions.length) + '% avg</span> <span style="opacity:0.4">|</span> ' +
    'Total Memory: <span class="val green">' + Math.round(adminData.infraRegions.reduce(function(s, r) { return s + r.mem; }, 0) / adminData.infraRegions.length) + '% avg</span> <span style="opacity:0.4">|</span> ' +
    'Total Nodes: <span class="val">' + adminData.infraRegions.reduce(function(s, r) { return s + r.nodes; }, 0) + '</span> <span style="opacity:0.4">|</span> ' +
    'Total Bots: <span class="val gold">' + adminData.infraRegions.reduce(function(s, r) { return s + r.bots; }, 0).toLocaleString() + '</span>';

  drawPoolChart('cpuPoolChart', adminData.infraRegions.map(function(r) { return r.cpu; }), ['#00F0FF','#FFD43B','#F7DF1E','#7B61FF','#2ED573']);
  drawPoolChart('memPoolChart', adminData.infraRegions.map(function(r) { return r.mem; }), ['#00F0FF','#FFD43B','#F7DF1E','#7B61FF','#2ED573']);
}

function drawPoolChart(canvasId, data, colors) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  var w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);
  var pad = { top: 10, bottom: 30, left: 10, right: 10 };
  var cw = w - pad.left - pad.right, ch = h - pad.top - pad.bottom;
  var barW = Math.min(40, (cw / data.length) * 0.6);
  var gap = (cw - barW * data.length) / (data.length + 1);
  data.forEach(function(v, i) {
    var barH = Math.max(4, (v / 100) * ch);
    var x = pad.left + gap + i * (barW + gap);
    var y = pad.top + ch - barH;
    ctx.fillStyle = colors[i % colors.length];
    ctx.shadowColor = colors[i % colors.length] + '40';
    ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.roundRect(x, y, barW, barH, [3, 3, 0, 0]); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '7px Inter'; ctx.textAlign = 'center';
    ctx.fillText(adminData.infraRegions[i] ? adminData.infraRegions[i].name.substring(0, 6) : '', x + barW / 2, h - pad.bottom + 14);
  });
}

/* ======================== BILLING ======================== */

function renderBilling() {
  var body = document.getElementById('billingTableBody');
  var mrr = adminData.billing.filter(function(t) { return t.status === 'paid'; }).reduce(function(s, t) { return s + t.amount; }, 0);
  var churn = (adminData.billing.filter(function(t) { return t.status === 'refunded'; }).length / Math.max(1, adminData.billing.length) * 100).toFixed(1);
  var arpu = adminData.billing.filter(function(t) { return t.status === 'paid'; }).length > 0 ? (mrr / adminData.billing.filter(function(t) { return t.status === 'paid'; }).length).toFixed(2) : '0.00';
  var failed = adminData.billing.filter(function(t) { return t.status === 'failed' || t.status === 'disputed'; }).length;
  document.getElementById('billingMRR').textContent = '$' + mrr.toLocaleString();
  document.getElementById('billingChurn').textContent = churn + '%';
  document.getElementById('billingARPU').textContent = '$' + arpu;
  document.getElementById('billingFailed').textContent = failed;
  body.innerHTML = adminData.billing.map(function(t) {
    var statusClass = t.status === 'paid' ? 'active' : t.status === 'failed' ? 'error' : t.status === 'disputed' ? 'pending' : 'pending';
    return '<tr><td><span class="cell-id">' + t.id + '</span></td>' +
      '<td style="color:var(--signal-white)">' + t.user + '</td>' +
      '<td>' + t.plan + '</td>' +
      '<td style="font-weight:600">$' + t.amount.toFixed(2) + '</td>' +
      '<td><span class="status-badge ' + statusClass + '">' + t.status.charAt(0).toUpperCase() + t.status.slice(1) + '</span></td>' +
      '<td>' + t.method + '</td>' +
      '<td>' + t.date + '</td>' +
      '<td class="actions-cell">' +
      '<button class="btn btn-ghost btn-sm" onclick="showAdminToast(\'info\',\'Invoice opened\')">Invoice</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="showAdminToast(\'success\',\'Refund processed\')">Refund</button></td></tr>';
  }).join('');
}

/* ======================== PLANS ======================== */

function renderPlans() {
  var container = document.getElementById('plansGrid');
  if (!container) return;
  var plans = [
    { name: 'Starter', price: '$9', color: '#8A8F98', features: ['5 projects', '20 bots', '5 ZIP uploads/mo', '50MB max ZIP', 'Basic support'] },
    { name: 'Pro', price: '$29', color: '#00F0FF', features: ['50 projects', '200 bots', 'Unlimited ZIPs', '100MB max ZIP', 'Priority support', 'Custom domains'] },
    { name: 'Enterprise', price: '$99', color: '#7B61FF', features: ['Unlimited projects', 'Unlimited bots', 'Unlimited ZIPs', '500MB max ZIP', '24/7 dedicated support', 'SLA guarantee', 'Custom integrations'] }
  ];
  container.innerHTML = plans.map(function(p) {
    return '<div class="admin-card" style="border-top:3px solid ' + p.color + '">' +
      '<div class="admin-card-header"><div class="card-title" style="font-size:1.2rem">' + p.name + '</div></div>' +
      '<div class="admin-card-body">' +
      '<div style="font-size:2.5rem;font-weight:800;color:var(--signal-white);font-family:\'Space Grotesk\',sans-serif">' + p.price + '<span style="font-size:1rem;color:var(--titanium)">/mo</span></div>' +
      '<div style="margin:1rem 0"><label class="form-label">Price</label><input class="form-input" value="' + p.price.replace('$', '') + '" style="font-size:0.82rem"></div>' +
      '<div style="margin-bottom:0.75rem"><label class="form-label">Features</label>' +
      p.features.map(function(f) { return '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;font-size:0.82rem"><span style="color:var(--success-green)">✓</span> ' + f + '</div>'; }).join('') + '</div>' +
      '<label class="form-label" style="margin-top:0.75rem">Status</label>' +
      '<label class="toggle"><input type="checkbox" checked><span class="slider"></span></label></div>' +
      '<div class="admin-card-footer"><button class="btn btn-primary btn-sm">Save Plan</button></div></div>';
  }).join('');
}

/* ======================== TICKETS ======================== */

function renderTickets() {
  var container = document.getElementById('ticketKanban');
  if (!container) return;
  var columns = [
    { key: 'open', title: 'OPEN', icon: '🔴' },
    { key: 'assigned', title: 'ASSIGNED', icon: '🟡' },
    { key: 'waiting', title: 'WAITING', icon: '🔵' },
    { key: 'resolved', title: 'RESOLVED', icon: '🟢' }
  ];
  container.innerHTML = columns.map(function(col) {
    var tickets = adminData.tickets.filter(function(t) { return t.status === col.key; });
    return '<div class="kanban-column">' +
      '<div class="kanban-column-header">' + col.icon + ' ' + col.title + ' <span class="count">' + tickets.length + '</span></div>' +
      '<div class="kanban-column-body">' +
      (tickets.length === 0 ? '<div style="padding:1rem;text-align:center;color:var(--titanium);font-size:0.78rem">Empty</div>' : '') +
      tickets.map(function(t) {
        var color = t.severity === 'critical' ? 'var(--alert-red)' : t.severity === 'warning' ? 'var(--warning-amber)' : t.severity === 'high' ? 'var(--warning-amber)' : 'var(--success-green)';
        return '<div class="kanban-card" onclick="showTicketDetail(\'' + t.id + '\')">' +
          '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.3rem">' +
          '<span style="width:3px;height:24px;border-radius:2px;background:' + color + '"></span>' +
          '<span class="kb-id">' + t.id + '</span></div>' +
          '<div class="kb-title">' + t.title + '</div>' +
          '<div class="kb-meta">' + t.user + ' · ' + t.time + '</div></div>';
      }).join('') + '</div></div>';
  }).join('');
}

function showTicketDetail(ticketId) {
  var ticket = adminData.tickets.find(function(t) { return t.id === ticketId; });
  if (!ticket) return;
  var color = ticket.severity === 'critical' ? 'var(--alert-red)' : ticket.severity === 'warning' ? 'var(--warning-amber)' : 'var(--success-green)';
  var html =
    '<div style="display:flex;gap:0.75rem;margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid rgba(255,255,255,0.05)">' +
    '<span style="width:4px;border-radius:2px;background:' + color + '"></span>' +
    '<div><div style="font-size:0.85rem;color:var(--titanium)">' + ticket.id + '</div>' +
    '<div style="font-size:1.1rem;font-weight:700;color:var(--signal-white)">' + ticket.title + '</div>' +
    '<div style="color:var(--titanium);font-size:0.82rem;margin-top:0.25rem">' + ticket.user + ' · ' + ticket.time + '</div></div>' +
    '<span class="severity-tag ' + ticket.severity + '" style="margin-left:auto">' + ticket.severity + '</span></div>' +
    '<div style="margin-bottom:1rem"><div style="color:var(--signal-white);font-weight:600;margin-bottom:0.5rem">Conversation</div>' +
    '<div style="background:var(--admin-surface);border-radius:8px;padding:0.75rem;margin-bottom:0.5rem;font-size:0.82rem">' +
    '<div style="color:var(--signal-white);font-weight:600">' + ticket.user + '</div>' +
    '<div style="color:var(--titanion);margin-top:0.2rem">I\'m experiencing an issue with ' + (ticket.runtime || 'my') + ' setup in ' + (ticket.region || 'my region') + '. Can you help?</div>' +
    '<div style="color:var(--titanium);font-size:0.7rem;margin-top:0.3rem">' + ticket.time + '</div></div>' +
    '<div style="background:rgba(0,240,255,0.04);border:1px solid rgba(0,240,255,0.1);border-radius:8px;padding:0.75rem;font-size:0.82rem">' +
    '<div style="color:var(--nexus-cyan);font-weight:600">Support Agent</div>' +
    '<div style="color:var(--signal-white);margin-top:0.2rem">Thank you for reporting this. Our team is looking into it.</div>' +
    '<div style="color:var(--titanium);font-size:0.7rem;margin-top:0.3rem">Just now</div></div></div>' +
    '<div style="display:flex;gap:0.5rem;flex-wrap:wrap">' +
    '<button class="btn btn-primary btn-sm" onclick="showAdminToast(\'success\',\'Ticket assigned to you\')">Assign to Me</button>' +
    '<button class="btn btn-secondary btn-sm" onclick="showAdminToast(\'warning\',\'Ticket escalated\')">Escalate</button>' +
    '<button class="btn btn-success btn-sm" onclick="showAdminToast(\'success\',\'Ticket closed\')">Close</button></div>';
  openAdminSlidePanel('Ticket ' + ticket.id, html);
}

/* ======================== AUDIT ======================== */

function renderAdminAudit() {
  var body = document.getElementById('auditTableBody');
  var query = (document.getElementById('auditSearch')?.value || '').toLowerCase();
  var filtered = query ? adminData.auditLog.filter(function(a) {
    return a.admin.toLowerCase().includes(query) || a.action.toLowerCase().includes(query) || a.resource.toLowerCase().includes(query) || a.reason.toLowerCase().includes(query);
  }) : adminData.auditLog;
  if (filtered.length === 0) { body.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--titanium)">No audit entries found</td></tr>'; return; }
  body.innerHTML = filtered.map(function(a) {
    var actionClass = a.action.startsWith('SUSPEND') || a.action.startsWith('BAN') || a.action.startsWith('BLOCK') || a.action.startsWith('QUARANTINE') ? 'error' : a.action.startsWith('SCALE') || a.action.startsWith('RESOLVE') ? 'success' : 'info';
    return '<tr>' +
      '<td style="font-family:\'JetBrains Mono\',monospace;font-size:0.75rem">' + a.timestamp + '</td>' +
      '<td style="color:var(--signal-white)">' + a.admin + '</td>' +
      '<td><span class="status-badge ' + actionClass + '" style="font-size:0.65rem">' + a.action + '</span></td>' +
      '<td><span class="cell-id">' + a.resource + '</span></td>' +
      '<td>' + a.reason + '</td></tr>';
  }).join('');
}

/* ======================== SECURITY ======================== */

function renderSecurityRules() {
  var container = document.getElementById('securityRules');
  if (!container) return;
  var rules = [
    { name: 'ZIP size > 100MB', desc: 'Auto-reject archives exceeding limit', enabled: true },
    { name: 'Multiple failed uploads', desc: 'Flag IP after 5 failed uploads in 10m', enabled: true },
    { name: 'Known malware signatures', desc: 'Scan against malware database', enabled: true },
    { name: 'Unusual CPU spikes', desc: 'Alert if bot CPU > 90% for 5+ minutes', enabled: true },
    { name: 'Outbound connection limits', desc: 'Block excessive outbound traffic', enabled: false }
  ];
  container.innerHTML = rules.map(function(r) {
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.65rem 0;border-bottom:1px solid rgba(255,255,255,0.03)">' +
      '<div><div style="font-size:0.85rem;font-weight:600;color:var(--signal-white)">' + r.name + '</div>' +
      '<div style="font-size:0.75rem;color:var(--titanium)">' + r.desc + '</div></div>' +
      '<label class="toggle"><input type="checkbox" ' + (r.enabled ? 'checked' : '') + '><span class="slider"></span></label></div>';
  }).join('');
}

/* ======================== IP BLOCKS ======================== */

function renderIPBlocks() {
  var body = document.getElementById('ipBlocksBody');
  if (!body) return;
  if (adminData.ipBlocks.length === 0) { body.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--titanium)">No IP blocks</td></tr>'; return; }
  body.innerHTML = adminData.ipBlocks.map(function(b) {
    return '<tr><td style="font-family:\'JetBrains Mono\',monospace;color:var(--alert-red)">' + b.ip + '</td>' +
      '<td>' + b.reason + '</td>' +
      '<td>' + b.blockedBy + '</td>' +
      '<td>' + b.date + '</td>' +
      '<td class="actions-cell"><button class="btn btn-success btn-sm" onclick="showAdminToast(\'success\',\'IP unblocked\')">Unblock</button><button class="btn btn-ghost btn-sm" onclick="showAdminToast(\'info\',\'Details\')">Details</button></td></tr>';
  }).join('');
}

/* ======================== SETTINGS ======================== */

function renderFeatureFlags() {
  var container = document.getElementById('featureFlags');
  if (!container) return;
  var flags = [
    { name: 'Go Runtime Support', desc: 'Enable experimental Go runtime for deployments', enabled: true },
    { name: 'Rust Runtime Support', desc: 'Enable experimental Rust runtime', enabled: false },
    { name: 'New Scaling Algorithm', desc: 'Use predictive scaling based on historical patterns', enabled: true, slider: '50%' },
    { name: 'New Dashboard UI', desc: 'Gradual rollout of the redesigned dashboard', enabled: true, slider: '25%' },
    { name: 'Edge Caching', desc: 'Enable CDN edge caching for static assets', enabled: false }
  ];
  container.innerHTML = flags.map(function(f) {
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.65rem 0;border-bottom:1px solid rgba(255,255,255,0.03)">' +
      '<div><div style="font-size:0.85rem;font-weight:600;color:var(--signal-white)">' + f.name + '</div>' +
      '<div style="font-size:0.75rem;color:var(--titanium)">' + f.desc + '</div></div>' +
      '<div style="display:flex;align-items:center;gap:0.75rem">' +
      (f.slider ? '<span style="font-size:0.75rem;color:var(--titanium)">' + f.slider + '</span>' : '') +
      '<label class="toggle"><input type="checkbox" ' + (f.enabled ? 'checked' : '') + '><span class="slider"></span></label></div></div>';
  }).join('');
}

/* ======================== KEYBOARD SHORTCUTS ======================== */

document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.key === 'k') {
    e.preventDefault();
    document.getElementById('adminGlobalSearch')?.focus();
  }
  if (e.key === 'Escape') {
    closeAdminSlidePanel();
  }
  // Navigation shortcuts
  if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
    showAdminToast('info', 'Shortcuts: Ctrl+K Search, g+d Dashboard, g+u Users, g+p Projects, g+b Bots, g+i Infrastructure');
  }
  if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
    // Skip Ctrl+D bookmark
  }
});

// Allow g+letter syntax
var gPressed = false;
document.addEventListener('keydown', function(e) {
  if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    gPressed = true;
    setTimeout(function() { gPressed = false; }, 500);
    return;
  }
  if (gPressed) {
    gPressed = false;
    var map = { d: 'dashboard', u: 'users', p: 'projects', b: 'bots', i: 'infra', s: 'settings', t: 'tickets', a: 'audit', c: 'security' };
    if (map[e.key]) { e.preventDefault(); switchAdminSection(map[e.key]); }
  }
});

window.addEventListener('resize', function() {
  var sb = document.getElementById('adminSidebar');
  if (window.innerWidth <= 768) {
    sb.classList.remove('collapsed');
  }
});

// RoundRect polyfill for canvas
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
    var r = Array.isArray(radii) ? radii : [radii, radii, radii, radii];
    r = r.map(function(v) { return Math.min(v || 0, Math.min(w, h) / 2); });
    this.moveTo(x + r[0], y);
    this.lineTo(x + w - r[1], y);
    this.quadraticCurveTo(x + w, y, x + w, y + r[1]);
    this.lineTo(x + w, y + h - r[2]);
    this.quadraticCurveTo(x + w, y + h, x + w - r[2], y + h);
    this.lineTo(x + r[3], y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r[3]);
    this.lineTo(x, y + r[0]);
    this.quadraticCurveTo(x, y, x + r[0], y);
    this.closePath();
    return this;
  };
}

console.log('[NEXUS ADMIN] Panel initialized — All Credit Nexus');
console.log('[NEXUS ADMIN] ' + adminData.users.length + ' users, ' + adminData.projects.length + ' projects, ' + adminData.bots.length + ' bots');
