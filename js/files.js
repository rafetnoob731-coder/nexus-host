/* ============================================================
   NEXUS HOSTING — File Manager v1.0
   Upload, edit, and manage bot source files in-browser
   ============================================================ */

let fmUser = null;
let fmCurrentPath = '/';
let fmFiles = {};
let fmSelected = new Set();
let fmSortBy = { field: 'name', dir: 'asc' };
let fmEditorPath = null;
let fmEditorUnsaved = false;
let fmUploadQueue = [];
let fmDiskUsed = 0;
let fmDiskLimit = 1048576000; // 1GB in bytes
let fmProtectedFiles = ['.env', '.env.example', 'config/bot.php', 'config/app.php'];

/* ======================== INIT ======================== */

(function initFM() {
  if (window.NEXUS_INITIALIZED && window.auth) {
    window.auth.onAuthStateChanged(function(user) {
      if (user) {
        fmUser = user;
        initFileManager();
      } else {
        window.location.href = 'login.html';
      }
    });
  } else {
    if (typeof waitForFirebase !== 'undefined') {
      setTimeout(initFM, 500);
    } else {
      setTimeout(initFM, 500);
    }
  }
})();

function initFileManager() {
  displayFMUser();
  loadFMData();
}

function displayFMUser() {
  if (!fmUser) return;
  var initial = (fmUser.displayName || fmUser.email || 'N').charAt(0).toUpperCase();
  document.getElementById('fmUserAvatar').textContent = initial;
  document.getElementById('fmUserName').textContent = fmUser.displayName || 'User';
  document.getElementById('fmUserEmail').textContent = fmUser.email || '';
}

function toggleFMUserMenu() {
  if (confirm('Sign out of NEXUS HOSTING?')) {
    auth.signOut().then(function() { window.location.href = 'login.html'; });
  }
}

function toggleFMSidebar() {
  document.getElementById('fmSidebar').classList.toggle('open');
}

/* ======================== DATA LAYER ======================== */

function loadFMData() {
  // Simulate a file system for the selected project
  fmFiles = getMockFileSystem();
  fmDiskUsed = 124 * 1024 * 1024; // 124 MB
  renderTree();
  renderFiles();
  renderBreadcrumb();
  updateDiskMeter();
}

function getMockFileSystem() {
  return {
    '': {
      'bot.php': { size: 12400, modified: Date.now() - 120000, content: '<?php\n\nrequire_once __DIR__ . \'/vendor/autoload.php\';\n\nuse Discord\\Discord;\nuse Discord\\Parts\\Channel\\Message;\n\n$discord = new Discord([\n    \'token\' => getenv(\'DISCORD_TOKEN\'),\n    \'prefix\' => getenv(\'BOT_PREFIX\') ?? \'!\'\n]);\n\n$discord->on(\'ready\', function ($discord) {\n    echo "Bot is ready!", PHP_EOL;\n    \n    $discord->on(\'message\', function (Message $message, Discord $discord) {\n        if ($message->author->id === $discord->id) return;\n        \n        $content = $message->content;\n        $prefix = getenv(\'BOT_PREFIX\') ?? \'!\';\n        \n        if (strpos($content, $prefix . \'ping\') === 0) {\n            $message->reply(\'Pong!\');\n        }\n        \n        if (strpos($content, $prefix . \'hello\') === 0) {\n            $message->reply(\'Hello there!\');\n        }\n    });\n});\n\n$discord->run();\n' },
      '.env': { size: 800, modified: Date.now() - 3600000, protected: true, content: 'DISCORD_TOKEN=your_token_here\nBOT_PREFIX=!\nOWNER_ID=123456789\nGUILD_ID=\nLOG_LEVEL=info\n' },
      'composer.json': { size: 512, modified: Date.now() - 7200000, content: '{\n    "name": "nexus/bot",\n    "require": {\n        "team-reflex/discord-php": "^7.0",\n        "vlucas/phpdotenv": "^5.5"\n    },\n    "autoload": {\n        "psr-4": {\n            "App\\\\": "app/"\n        }\n    }\n}' },
      'index.js': { size: 45000, modified: Date.now() - 86400000, content: 'const { Client, GatewayIntentBits } = require(\'discord.js\');\nrequire(\'dotenv\').config();\n\nconst client = new Client({\n    intents: [\n        GatewayIntentBits.Guilds,\n        GatewayIntentBits.GuildMessages,\n        GatewayIntentBits.MessageContent\n    ]\n});\n\nclient.once(\'ready\', () => {\n    console.log(`Logged in as ${client.user.tag}!`);\n});\n\nclient.on(\'messageCreate\', async (message) => {\n    if (message.author.bot) return;\n    \n    const prefix = process.env.PREFIX || \'!\';\n    \n    if (!message.content.startsWith(prefix)) return;\n    \n    const args = message.content.slice(prefix.length).trim().split(/ +/);\n    const command = args.shift().toLowerCase();\n    \n    if (command === \'ping\') {\n        await message.reply(\'Pong!\');\n    }\n    \n    if (command === \'say\') {\n        const text = args.join(\' \');\n        if (text) await message.channel.send(text);\n    }\n});\n\nclient.login(process.env.DISCORD_TOKEN);\n' }
    },
    'app': {
      '': {},
      'Commands': {
        '': {},
        'PingCommand.php': { size: 2800, modified: Date.now() - 1800000, content: '<?php\n\nnamespace App\\Commands;\n\nuse Discord\\Discord;\nuse Discord\\Parts\\Channel\\Message;\n\nclass PingCommand\n{\n    public function handle(Message $message, Discord $discord)\n    {\n        $message->reply(\'Pong! 🏓\');\n    }\n}' },
        'HelloCommand.php': { size: 2100, modified: Date.now() - 7200000, content: '<?php\n\nnamespace App\\Commands;\n\nuse Discord\\Discord;\nuse Discord\\Parts\\Channel\\Message;\n\nclass HelloCommand\n{\n    public function handle(Message $message, Discord $discord)\n    {\n        $name = $message->author->username;\n        $message->reply("Hello, {$name}! 👋");\n    }\n}' }
      },
      'Events': {
        '': {},
        'GuildMemberJoin.php': { size: 1500, modified: Date.now() - 3600000, content: '<?php\n\nnamespace App\\Events;\n\nuse Discord\\Discord;\nuse Discord\\Parts\\User\\Member;\n\nclass GuildMemberJoin\n{\n    public function handle(Member $member, Discord $discord)\n    {\n        $guild = $member->guild;\n        $channel = $guild->channels->get(\'name\', \'welcome\');\n        \n        if ($channel) {\n            $channel->send("Welcome to the server, {$member->display_name}!");\n        }\n    }\n}' }
      }
    },
    'config': {
      '': {},
      'bot.php': { size: 4300, modified: Date.now() - 10800000, protected: true, content: '<?php\n\nreturn [\n    \'token\' => env(\'DISCORD_TOKEN\'),\n    \'prefix\' => env(\'BOT_PREFIX\', \'!\'),\n    \'owner_id\' => env(\'OWNER_ID\'),\n    \'intents\' => [\n        \\Discord\\WebSockets\\Intents::GUILDS,\n        \\Discord\\WebSockets\\Intents::GUILD_MESSAGES,\n        \\Discord\\WebSockets\\Intents::MESSAGE_CONTENT,\n    ],\n    \'channels\' => [\n        \'welcome\' => \'welcome\',\n        \'logs\' => \'bot-logs\',\n    ],\n];\n' },
      'app.php': { size: 2100, modified: Date.now() - 14400000, content: '<?php\n\nreturn [\n    \'name\' => \'Nexus Bot\',\n    \'version\' => \'1.0.0\',\n    \'debug\' => env(\'APP_DEBUG\', false),\n    \'timezone\' => \'UTC\',\n    \'locale\' => \'en\',\n];\n' }
    },
    'resources': {
      '': {},
      'views': { '': {}, 'welcome.md': { size: 320, modified: Date.now() - 86400000, content: '# Welcome!\n\nHello and welcome to the server! We\'re glad to have you here.\n\nCheck out our rules in #rules and introduce yourself in #introductions.' } }
    },
    'storage': { '': {}, 'logs': { '': {}, 'bot.log': { size: 128000, modified: Date.now() - 600000, content: '[2026-05-26 10:32:05] INFO: Bot started\n[2026-05-26 10:32:10] INFO: Connected to Discord gateway\n[2026-05-26 10:32:15] INFO: Guild joined: "GameHub" (ID: 123)\n[2026-05-26 10:33:00] WARN: Rate limit hit, backing off\n[2026-05-26 10:35:00] ERROR: Failed to fetch API (retry in 5s)\n[2026-05-26 10:35:05] INFO: Retry successful\n' }, 'backups': { '': {} } }
  };
}

function getNodeAtPath(path) {
  if (path === '/') return fmFiles;
  var parts = path.split('/').filter(Boolean);
  var node = fmFiles;
  for (var i = 0; i < parts.length; i++) {
    if (node[parts[i]] && typeof node[parts[i]] === 'object' && !node[parts[i]].size) {
      node = node[parts[i]];
    } else {
      return null;
    }
  }
  return node;
}

function getParentPath(path) {
  if (path === '/' || path === '') return '/';
  var parts = path.split('/').filter(Boolean);
  parts.pop();
  return '/' + parts.join('/');
}

function getItemAtPath(path) {
  if (path === '/' || path === '') return null;
  var parts = path.split('/').filter(Boolean);
  var name = parts.pop();
  var parent = getNodeAtPath('/' + parts.join('/'));
  return parent ? parent[name] : null;
}

function isDir(item) {
  return item && typeof item === 'object' && !item.size;
}

function isProtected(path) {
  return fmProtectedFiles.indexOf(path.replace(/^\//, '')) > -1;
}

/* ======================== RENDER TREE ======================== */

function renderTree() {
  var container = document.getElementById('fmTreeInner');
  container.innerHTML = buildTreeHTML(fmFiles, '/', 0);
}

function buildTreeHTML(node, path, depth) {
  if (!node || typeof node !== 'object') return '';
  var entries = Object.entries(node).filter(function(e) {
    return typeof e[1] === 'object';
  });
  var html = '';
  entries.forEach(function(e) {
    var name = e[0];
    var child = e[1];
    var itemPath = (path === '/' ? '/' : path) + name;
    var isFolder = isDir(child);
    var active = fmCurrentPath === itemPath ? ' active' : '';
    var expanded = isPathInBranch(itemPath);
    if (isFolder) {
      html += '<div class="fm-tree-item folder' + (expanded ? '-open' : '') + active + '" onclick="fmNavigate(\'' + itemPath + '\')" data-path="' + itemPath + '">' +
        (expanded && depth < 3 ? '<svg class="tree-chevron expanded" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>' : '<svg class="tree-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>') +
        '<svg class="tree-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>' +
        '<span class="tree-label">' + escapeHtml(name) + '</span></div>';
      if (expanded && depth < 3) {
        html += '<div class="fm-tree-children">' + buildTreeHTML(child, itemPath + '/', depth + 1) + '</div>';
      }
    } else {
      html += '<div class="fm-tree-item file' + active + '" onclick="fmOpenFile(\'' + itemPath + '\')" data-path="' + itemPath + '">' +
        '<svg class="tree-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:18px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
        '<span class="tree-label">' + escapeHtml(name) + '</span></div>';
    }
  });
  return html;
}

function isPathInBranch(path) {
  if (path === fmCurrentPath) return true;
  var parts = fmCurrentPath.split('/').filter(Boolean);
  var check = '';
  for (var i = 0; i < parts.length; i++) {
    check += '/' + parts[i];
    if (check === path) return true;
  }
  return false;
}

/* ======================== RENDER FILES ======================== */

function renderFiles() {
  var body = document.getElementById('fmFileBody');
  var node = getNodeAtPath(fmCurrentPath);
  if (!node) {
    body.innerHTML = '<tr><td colspan="5"><div class="fm-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><h3>No files yet</h3><p>Your bot\'s home is empty. Upload code or start with a template.</p><button class="btn btn-primary" onclick="openFMUpload()">Upload Files</button><button class="btn btn-secondary" style="margin-left:0.5rem" onclick="openFMNewFile()">New File</button></div></td></tr>';
    return;
  }
  var entries = Object.entries(node).filter(function(e) {
    return e[0] !== '';
  });
  if (entries.length === 0) {
    body.innerHTML = '<tr><td colspan="5"><div class="fm-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><h3>This folder is empty</h3><p>Upload files or create new ones to get started.</p><button class="btn btn-primary" onclick="openFMUpload()">Upload Files</button></div></td></tr>';
    return;
  }
  // Sort
  var sorted = entries.sort(function(a, b) {
    var aIsDir = isDir(a[1]);
    var bIsDir = isDir(b[1]);
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    var valA = fmSortBy.field === 'size' ? (a[1].size || 0) : fmSortBy.field === 'modified' ? (a[1].modified || 0) : a[0].toLowerCase();
    var valB = fmSortBy.field === 'size' ? (b[1].size || 0) : fmSortBy.field === 'modified' ? (b[1].modified || 0) : b[0].toLowerCase();
    if (typeof valA === 'string') {
      return fmSortBy.dir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return fmSortBy.dir === 'asc' ? valA - valB : valB - valA;
  });
  var newPath = fmCurrentPath === '/' ? '/' : fmCurrentPath + '/';
  body.innerHTML = sorted.map(function(e) {
    var name = e[0];
    var item = e[1];
    var itemPath = newPath + name;
    var isFolder = isDir(item);
    var _protected = isProtected(itemPath);
    var selected = fmSelected.has(itemPath) ? ' selected' : '';
    var sizeStr = isFolder ? '—' : formatBytes(item.size || 0);
    var dateStr = isFolder ? '—' : (item.modified ? timeAgo(item.modified) : '—');
    var icon = isFolder ?
      '<svg class="fm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--warning-amber)"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>' :
      '<svg class="fm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    var nameClass = isFolder ? 'fm-name dir' : 'fm-name';
    var actions = isFolder ?
      '<button onclick="event.stopPropagation();fmNavigate(\'' + itemPath + '\')">📂 Open</button>' :
      '<button onclick="event.stopPropagation();fmOpenEditor(\'' + itemPath + '\')">✏️</button>' +
      '<button onclick="event.stopPropagation();fmDownloadFile(\'' + itemPath + '\')">⎘</button>' +
      '<button class="danger" onclick="event.stopPropagation();fmQuickDelete(\'' + itemPath + '\')">🗑️</button>';
    var protectedBadge = _protected ? '<span class="fm-protected">🔒 Protected</span>' : '';
    return '<tr class="' + selected + '">' +
      '<td><input type="checkbox" ' + (fmSelected.has(itemPath) ? 'checked' : '') + ' onchange="fmToggleSelect(\'' + itemPath + '\', this.checked)"></td>' +
      '<td><div class="' + nameClass + '" onclick="' + (isFolder ? 'fmNavigate(\'' + itemPath + '\')' : 'fmOpenEditor(\'' + itemPath + '\')') + '">' + icon + '<span class="fm-label">' + escapeHtml(name) + '</span>' + protectedBadge + '</div></td>' +
      '<td>' + sizeStr + '</td>' +
      '<td>' + dateStr + '</td>' +
      '<td><div class="fm-actions">' + actions + '</div></td></tr>';
  }).join('');
}

function renderBreadcrumb() {
  var container = document.getElementById('fmBreadcrumb');
  var parts = fmCurrentPath.split('/').filter(Boolean);
  var html = '<span class="crumb" onclick="fmNavigate(\'/\')">root</span>';
  var accum = '';
  parts.forEach(function(p) {
    accum += '/' + p;
    html += '<span> / </span><span class="crumb" onclick="fmNavigate(\'' + accum + '\')">' + escapeHtml(p) + '</span>';
  });
  container.innerHTML = html;
  // Update disk meter path
  document.getElementById('fmDiskMeter').querySelector('span:first-child').textContent = formatBytes(fmDiskUsed);
}

function updateDiskMeter() {
  var pct = Math.min(100, (fmDiskUsed / fmDiskLimit) * 100);
  document.getElementById('diskUsed').textContent = formatBytes(fmDiskUsed);
  document.getElementById('diskLimit').textContent = formatBytes(fmDiskLimit);
  document.getElementById('diskBarFill').style.width = pct + '%';
}

/* ======================== NAVIGATION ======================== */

function fmNavigate(path) {
  if (path === fmCurrentPath) return;
  fmCurrentPath = path;
  renderFiles();
  renderBreadcrumb();
  renderTree();
  fmClearSelection();
  document.getElementById('fmFileBody').parentElement.scrollTop = 0;
}

function fmOpenFile(path) {
  var item = getItemAtPath(path);
  if (!item || isDir(item)) return;
  fmOpenEditor(path);
}

/* ======================== SELECTION ======================== */

function fmToggleSelect(path, checked) {
  if (checked) fmSelected.add(path);
  else fmSelected.delete(path);
  updateFMBulkBar();
  renderFiles();
}

function fmToggleAll() {
  var all = document.getElementById('fmSelectAll').checked;
  var node = getNodeAtPath(fmCurrentPath);
  if (!node) return;
  fmSelected.clear();
  if (all) {
    Object.keys(node).forEach(function(name) {
      if (name === '') return;
      var itemPath = (fmCurrentPath === '/' ? '/' : fmCurrentPath + '/') + name;
      fmSelected.add(itemPath);
    });
  }
  updateFMBulkBar();
  renderFiles();
}

function updateFMBulkBar() {
  var bar = document.getElementById('fmBulkBar');
  var count = document.getElementById('fmBulkCount');
  count.textContent = fmSelected.size + ' selected';
  bar.style.display = fmSelected.size > 0 ? 'flex' : 'none';
}

function fmClearSelection() {
  fmSelected.clear();
  document.getElementById('fmSelectAll').checked = false;
  updateFMBulkBar();
  renderFiles();
}

/* ======================== SORT ======================== */

function fmSort(field) {
  if (fmSortBy.field === field) {
    fmSortBy.dir = fmSortBy.dir === 'asc' ? 'desc' : 'asc';
  } else {
    fmSortBy.field = field;
    fmSortBy.dir = 'asc';
  }
  document.querySelectorAll('.sort-icon').forEach(function(el) {
    el.textContent = '▾';
    el.style.opacity = '0.3';
  });
  var icon = document.getElementById('sort-' + field);
  if (icon) {
    icon.textContent = fmSortBy.dir === 'asc' ? '▴' : '▾';
    icon.style.opacity = '1';
  }
  renderFiles();
}

/* ======================== EDITOR ======================== */

function fmOpenEditor(path) {
  var item = getItemAtPath(path);
  if (!item || isDir(item)) return;
  fmEditorPath = path;
  fmEditorUnsaved = false;
  document.getElementById('editorFilename').textContent = path;
  document.getElementById('editorTextarea').value = item.content || '';
  document.getElementById('editorStatus').textContent = 'Loaded';
  document.getElementById('editorStatus').className = '';
  document.getElementById('editorSaveBtn').disabled = false;
  document.getElementById('fmEditor').classList.add('open');
  document.getElementById('editorTextarea').focus();
  updateEditorCursor();
}

function closeFMEditor() {
  if (fmEditorUnsaved) {
    if (!confirm('You have unsaved changes. Discard them?')) return;
  }
  document.getElementById('fmEditor').classList.remove('open');
  fmEditorPath = null;
}

function saveFMEditor() {
  if (!fmEditorPath) return;
  var content = document.getElementById('editorTextarea').value;
  var item = getItemAtPath(fmEditorPath);
  if (item) {
    item.content = content;
    item.modified = Date.now();
  }
  fmEditorUnsaved = false;
  document.getElementById('editorStatus').textContent = '✓ Saved';
  document.getElementById('editorStatus').className = 'saved';
  document.getElementById('editorSaveBtn').disabled = true;
  renderFiles();
  renderTree();
  updateDiskMeter();
  fmToast('success', 'File saved. ' + (isProtected(fmEditorPath) ? 'Bot restart required.' : 'Bot auto-reloads changed commands.'));
  setTimeout(function() {
    document.getElementById('editorSaveBtn').disabled = false;
    document.getElementById('editorStatus').textContent = 'Ready';
    document.getElementById('editorStatus').className = '';
  }, 2000);
}

function updateEditorCursor() {
  var ta = document.getElementById('editorTextarea');
  var text = ta.value.substring(0, ta.selectionStart);
  var lines = text.split('\n');
  document.getElementById('editorCursor').textContent = 'Ln ' + lines.length + ', Col ' + (lines[lines.length - 1].length + 1);
}

document.addEventListener('DOMContentLoaded', function() {
  var ta = document.getElementById('editorTextarea');
  if (ta) {
    ta.addEventListener('keydown', function(e) {
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveFMEditor();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        var start = ta.selectionStart;
        var end = ta.selectionEnd;
        ta.value = ta.value.substring(0, start) + '  ' + ta.value.substring(end);
        ta.selectionStart = ta.selectionEnd = start + 2;
      }
      if (!fmEditorUnsaved) {
        fmEditorUnsaved = true;
        document.getElementById('editorStatus').textContent = 'Unsaved changes';
        document.getElementById('editorStatus').className = 'unsaved';
      }
      setTimeout(updateEditorCursor, 10);
    });
    ta.addEventListener('click', updateEditorCursor);
    ta.addEventListener('keyup', updateEditorCursor);
  }
});

/* ======================== UPLOAD ======================== */

function openFMUpload() {
  document.getElementById('fmUploadZone').classList.add('open');
  document.getElementById('uzProgress').style.display = 'none';
  document.getElementById('uzDropZone').style.display = 'block';
  document.getElementById('uzUploadBtn').disabled = false;
  fmUploadQueue = [];
}

function closeFMUpload() {
  document.getElementById('fmUploadZone').classList.remove('open');
}

function fmHandleDrop(e) {
  e.preventDefault();
  document.getElementById('uzDropZone').classList.remove('dragover');
  fmHandleFiles(e.dataTransfer.files);
}

function fmHandleFiles(files) {
  if (!files.length) return;
  for (var i = 0; i < files.length; i++) {
    if (files[i].size > 100 * 1024 * 1024) {
      fmToast('error', files[i].name + ' exceeds 100MB limit');
      continue;
    }
    fmUploadQueue.push({
      name: files[i].name,
      size: files[i].size,
      file: files[i],
      status: 'pending',
      progress: 0
    });
  }
  renderUploadQueue();
}

function renderUploadQueue() {
  var container = document.getElementById('uzProgress');
  container.style.display = 'block';
  if (fmUploadQueue.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--titanium);padding:1rem">No files to upload</div>';
    return;
  }
  container.innerHTML = fmUploadQueue.map(function(f, i) {
    var pct = f.status === 'done' ? 100 : f.progress;
    return '<div class="uz-progress-item">' +
      '<span class="uz-name">' + escapeHtml(f.name) + '</span>' +
      '<span style="font-size:0.7rem;color:var(--titanium)">' + formatBytes(f.size) + '</span>' +
      '<div class="progress-inline" style="width:80px"><div class="fill fill-cyan" style="width:' + pct + '%"></div></div>' +
      '<span class="uz-status">' + (f.status === 'done' ? '✅' : f.status === 'error' ? '❌' : pct + '%') + '</span></div>';
  }).join('');
  var done = fmUploadQueue.filter(function(f) { return f.status === 'done'; }).length;
  var total = fmUploadQueue.length;
  container.innerHTML += '<div style="text-align:center;font-size:0.85rem;color:var(--titanium);padding-top:0.5rem;border-top:1px solid rgba(255,255,255,0.05)">Total: ' + done + '/' + total + ' files uploaded</div>';
}

function fmStartUpload() {
  if (fmUploadQueue.length === 0) return;
  document.getElementById('uzUploadBtn').disabled = true;
  fmUploadQueue.forEach(function(f, i) {
    setTimeout(function() {
      simulateUpload(f, i);
    }, i * 800);
  });
}

function simulateUpload(f, i) {
  var interval = setInterval(function() {
    f.progress += Math.floor(Math.random() * 25 + 5);
    if (f.progress >= 100) {
      f.progress = 100;
      f.status = 'done';
      clearInterval(interval);
      // Add file to filesystem
      var parts = f.name.split('/');
      var fileName = parts.pop();
      var folderPath = fmCurrentPath === '/' ? '' : fmCurrentPath.slice(1);
      var node = getNodeAtPath('/' + folderPath);
      if (node) {
        node[fileName] = { size: f.size, modified: Date.now(), content: '// Uploaded: ' + f.name + '\n// Size: ' + formatBytes(f.size) + '\n\n' };
      }
      fmDiskUsed += f.size;
      renderUploadQueue();
      renderFiles();
      renderTree();
      updateDiskMeter();
      // Check if all done
      if (fmUploadQueue.every(function(x) { return x.status === 'done'; })) {
        fmToast('success', fmUploadQueue.length + ' files uploaded successfully');
        document.getElementById('uzUploadBtn').disabled = false;
        setTimeout(closeFMUpload, 1500);
      }
    }
    renderUploadQueue();
  }, 200);
}

/* ======================== NEW FILE / FOLDER ======================== */

function openFMNewFile() {
  document.getElementById('fmNewFileName').value = '';
  document.getElementById('fmNewFileTemplate').value = 'empty';
  fmUpdateNewFilePreview();
  document.getElementById('fmNewFileModal').classList.add('open');
  setTimeout(function() { document.getElementById('fmNewFileName').focus(); }, 100);
}

function fmUpdateNewFilePreview() {
  var preview = document.getElementById('fmNewFilePreview');
  var tpl = document.getElementById('fmNewFileTemplate').value;
  var templates = {
    empty: '// Empty file\n\n',
    laravel: '<?php\n\nnamespace App\\Commands;\n\nuse Discord\\Discord;\nuse Discord\\Parts\\Channel\\Message;\n\nclass NewCommand\n{\n    public function handle(Message $message, Discord $discord)\n    {\n        $message->reply("Hello from Nexus!");\n    }\n}\n',
    discord: 'const { SlashCommandBuilder } = require(\'discord.js\');\n\nmodule.exports = {\n    data: new SlashCommandBuilder()\n        .setName(\'hello\')\n        .setDescription(\'Says hello!\'),\n    async execute(interaction) {\n        await interaction.reply(\'Hello from Nexus!\');\n    },\n};\n',
    telegraf: 'from telegram import Update\nfrom telegram.ext import Application, CommandHandler, ContextTypes\n\nasync def start(update: Update, context: ContextTypes.DEFAULT_TYPE):\n    await update.message.reply_text("Hello from Nexus!")\n\ndef main():\n    app = Application.builder().token("YOUR_TOKEN").build()\n    app.add_handler(CommandHandler("start", start))\n    app.run_polling()\n\nif __name__ == "__main__":\n    main()\n'
  };
  preview.textContent = templates[tpl] || templates.empty;
}

function fmCreateNewFile() {
  var name = document.getElementById('fmNewFileName').value.trim();
  if (!name) { fmToast('error', 'Please enter a file name'); return; }
  var tpl = document.getElementById('fmNewFileTemplate').value;
  var templates = {
    empty: '// Empty file\n\n',
    laravel: '<?php\n\nnamespace App\\Commands;\n\nuse Discord\\Discord;\nuse Discord\\Parts\\Channel\\Message;\n\nclass NewCommand\n{\n    public function handle(Message $message, Discord $discord)\n    {\n        $message->reply("Hello from Nexus!");\n    }\n}\n',
    discord: 'const { SlashCommandBuilder } = require(\'discord.js\');\n\nmodule.exports = {\n    data: new SlashCommandBuilder()\n        .setName(\'hello\')\n        .setDescription(\'Says hello!\'),\n    async execute(interaction) {\n        await interaction.reply(\'Hello from Nexus!\');\n    },\n};\n',
    telegraf: 'from telegram import Update\nfrom telegram.ext import Application, CommandHandler, ContextTypes\n\nasync def start(update: Update, context: ContextTypes.DEFAULT_TYPE):\n    await update.message.reply_text("Hello from Nexus!")\n\ndef main():\n    app = Application.builder().token("YOUR_TOKEN").build()\n    app.add_handler(CommandHandler("start", start))\n    app.run_polling()\n\nif __name__ == "__main__":\n    main()\n'
  };
  var content = templates[tpl] || templates.empty;
  // Create parent folders if needed
  createFilePath(name, content);
  closeModal('fmNewFileModal');
  fmToast('success', 'File "' + name + '" created');
  renderFiles();
  renderTree();
}

function createFilePath(path, content) {
  var parts = path.split('/').filter(Boolean);
  var fileName = parts.pop();
  var node = fmFiles;
  parts.forEach(function(p) {
    if (!node[p] || typeof node[p] !== 'object') {
      node[p] = { '': {} };
    }
    node = node[p];
  });
  node[fileName] = { size: (content || '').length, modified: Date.now(), content: content || '' };
  fmDiskUsed += node[fileName].size;
  updateDiskMeter();
}

function openFMNewFolder() {
  document.getElementById('fmNewFolderName').value = '';
  document.getElementById('fmNewFolderModal').classList.add('open');
  setTimeout(function() { document.getElementById('fmNewFolderName').focus(); }, 100);
}

function fmCreateNewFolder() {
  var name = document.getElementById('fmNewFolderName').value.trim();
  if (!name) { fmToast('error', 'Please enter a folder name'); return; }
  var node = getNodeAtPath(fmCurrentPath);
  if (node) {
    node[name] = { '': {} };
  }
  closeModal('fmNewFolderModal');
  fmToast('success', 'Folder "' + name + '" created');
  renderFiles();
  renderTree();
}

/* ======================== DELETE ======================== */

function openFMDelete() {
  var items = fmSelected.size > 0 ? Array.from(fmSelected) : [];
  if (items.length === 0) {
    fmToast('error', 'No items selected');
    return;
  }
  var hasProtected = items.some(function(p) { return isProtected(p); });
  var fileCount = items.filter(function(p) { return !isDir(getItemAtPath(p)); }).length;
  var folderCount = items.length - fileCount;
  var msg = 'Delete ' + items.length + ' item';
  if (fileCount > 0 && folderCount > 0) msg += ' (' + fileCount + ' files, ' + folderCount + ' folders)';
  msg += '? This cannot be undone.';
  document.getElementById('fmDeleteMsg').textContent = msg;
  document.getElementById('fmProtectedFiles').style.display = hasProtected ? 'block' : 'none';
  document.getElementById('fmDeleteConfirm').value = '';
  document.getElementById('fmDeleteBtn').disabled = true;
  document.getElementById('fmDeleteModal').classList.add('open');
  setTimeout(function() { document.getElementById('fmDeleteConfirm').focus(); }, 100);
}

function fmConfirmDelete() {
  var items = fmSelected.size > 0 ? Array.from(fmSelected) : [];
  items.forEach(function(path) {
    deleteItemAtPath(path);
  });
  fmSelected.clear();
  updateFMBulkBar();
  closeModal('fmDeleteModal');
  fmToast('success', items.length + ' items deleted');
  renderFiles();
  renderTree();
  updateDiskMeter();
}

function deleteItemAtPath(path) {
  if (path === '/' || !path) return;
  var parts = path.split('/').filter(Boolean);
  var name = parts.pop();
  var parent = getNodeAtPath('/' + parts.join('/'));
  if (parent && parent[name]) {
    var item = parent[name];
    if (isDir(item)) {
      fmDiskUsed -= calculateDirSize(item);
    } else {
      fmDiskUsed -= (item.size || 0);
    }
    delete parent[name];
  }
}

function calculateDirSize(node) {
  var size = 0;
  if (!node || typeof node !== 'object') return 0;
  Object.values(node).forEach(function(v) {
    if (typeof v === 'object' && !v.size) {
      size += calculateDirSize(v);
    } else if (v && v.size) {
      size += v.size;
    }
  });
  return size;
}

function fmQuickDelete(path) {
  fmSelected.clear();
  fmSelected.add(path);
  openFMDelete();
}

/* ======================== DOWNLOAD ======================== */

function fmDownloadFile(path) {
  var item = getItemAtPath(path);
  if (!item || isDir(item)) return;
  var content = item.content || '';
  var blob = new Blob([content], { type: 'text/plain' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  var parts = path.split('/').filter(Boolean);
  a.download = parts[parts.length - 1];
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
  fmToast('success', 'Downloaded: ' + a.download);
}

function fmDownloadSelected() {
  var items = Array.from(fmSelected);
  if (items.length === 0) { fmToast('error', 'No items selected'); return; }
  if (items.length === 1) {
    fmDownloadFile(items[0]);
    return;
  }
  // Simulate ZIP download for multiple
  fmToast('success', 'Downloading ' + items.length + ' items as nexus_bot_backup_' + new Date().toISOString().slice(0,10) + '.zip');
}

/* ======================== DEPLOY ======================== */

function openFMDeploy() {
  document.getElementById('fmDeployModal').classList.add('open');
  document.getElementById('fmDeployResult').style.display = 'none';
  document.getElementById('fmDeploySteps').style.display = 'block';
  document.getElementById('fmDeployFooter').querySelectorAll('button').forEach(function(b) { b.disabled = true; });
  // Reset steps
  document.querySelectorAll('#fmDeploySteps .fm-deploy-step').forEach(function(s) {
    s.querySelector('.step-indicator').className = 'step-indicator pending';
    s.querySelector('.step-time').textContent = '';
  });
  runDeploySteps();
}

function runDeploySteps() {
  var steps = [
    { el: document.querySelector('[data-step="zip"]'), label: 'Zipping 47 files...', time: 0 },
    { el: document.querySelector('[data-step="upload"]'), label: 'Uploading to Nexus worker...', time: 0 },
    { el: document.querySelector('[data-step="deps"]'), label: 'Installing dependencies...', time: 0 },
    { el: document.querySelector('[data-step="start"]'), label: 'Starting bot process...', time: 0 },
    { el: document.querySelector('[data-step="done"]'), label: 'Deployed successfully!', time: 0 }
  ];
  var totalTime = 0;
  steps.forEach(function(step, i) {
    var delay = (i + 1) * 2500 + Math.floor(Math.random() * 1000);
    setTimeout(function() {
      step.time = (delay / 1000).toFixed(1);
      var ind = step.el.querySelector('.step-indicator');
      if (i < steps.length - 1) {
        ind.className = 'step-indicator running';
        step.el.querySelector('.step-time').textContent = '...';
      } else {
        ind.className = 'step-indicator done';
        step.el.querySelector('.step-time').textContent = step.time + 's';
      }
      // Mark previous as done
      if (i > 0) {
        var prev = steps[i - 1];
        prev.el.querySelector('.step-indicator').className = 'step-indicator done';
        prev.el.querySelector('.step-time').textContent = prev.time + 's';
      }
      if (i === steps.length - 1) {
        // Done!
        setTimeout(function() {
          document.getElementById('fmDeploySteps').style.display = 'none';
          document.getElementById('fmDeployResult').style.display = 'block';
          document.getElementById('fmDeployTime').textContent = 'in ' + totalTime.toFixed(1) + ' seconds';
          document.getElementById('fmDeployFooter').querySelectorAll('button').forEach(function(b) { b.disabled = false; });
          fmToast('success', 'Bot deployed successfully!');
        }, 500);
      }
      totalTime += delay / 1000;
    }, delay);
  });
}

/* ======================== SEARCH ======================== */

function openFMSearch() {
  document.getElementById('fmSearchOverlay').classList.add('open');
  document.getElementById('fmSearchInput').value = '';
  document.getElementById('fmSearchResults').innerHTML = '<div style="padding:1rem;text-align:center;color:var(--titanium);font-size:0.85rem">Type to search files...</div>';
  setTimeout(function() { document.getElementById('fmSearchInput').focus(); }, 100);
}

function closeFMSearch() {
  document.getElementById('fmSearchOverlay').classList.remove('open');
}

function fmDoSearch(query) {
  if (!query || query.length < 1) {
    document.getElementById('fmSearchResults').innerHTML = '<div style="padding:1rem;text-align:center;color:var(--titanium);font-size:0.85rem">Type to search files...</div>';
    return;
  }
  var results = [];
  var q = query.toLowerCase();
  searchNode(fmFiles, '', results, q);
  var container = document.getElementById('fmSearchResults');
  if (results.length === 0) {
    container.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--titanium);font-size:0.85rem">No files match "' + escapeHtml(query) + '". Try a different keyword.</div>';
    return;
  }
  container.innerHTML = results.slice(0, 20).map(function(r) {
    return '<div class="fs-result-item" onclick="closeFMSearch();fmOpenEditor(\'' + r.path + '\')">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
      '<span>' + escapeHtml(r.name) + '</span>' +
      '<span class="fs-path">' + escapeHtml(r.path) + '</span></div>';
  }).join('');
}

function searchNode(node, basePath, results, query) {
  if (!node || typeof node !== 'object') return;
  Object.entries(node).forEach(function(e) {
    var name = e[0];
    if (name === '') return;
    var child = e[1];
    var path = basePath + '/' + name;
    if (name.toLowerCase().includes(query)) {
      if (!isDir(child)) {
        results.push({ name: name, path: path.replace(/^\//, '') });
      }
    }
    if (isDir(child)) {
      searchNode(child, path, results, query);
    }
  });
}

/* ======================== UTILITIES ======================== */

function fmToast(type, message) {
  var container = document.getElementById('fmToastContainer');
  var toast = document.createElement('div');
  toast.className = 'toast ' + type;
  var icons = { success: '✓', error: '✗', info: 'ℹ', warning: '⚠' };
  toast.innerHTML = '<span>' + (icons[type] || '•') + '</span> ' + message;
  container.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 5000);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  var k = 1024;
  var sizes = ['B', 'KB', 'MB', 'GB'];
  var i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function timeAgo(ts) {
  var diff = Date.now() - ts;
  var mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + 'm ago';
  var hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  var days = Math.floor(hrs / 24);
  if (days < 7) return days + 'd ago';
  return new Date(ts).toLocaleDateString();
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ======================== KEYBOARD SHORTCUTS ======================== */

document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
    e.preventDefault();
    openFMSearch();
  }
  if (e.key === 'Escape') {
    if (document.getElementById('fmEditor').classList.contains('open')) {
      closeFMEditor();
    } else if (document.getElementById('fmSearchOverlay').classList.contains('open')) {
      closeFMSearch();
    } else if (document.getElementById('fmUploadZone').classList.contains('open')) {
      closeFMUpload();
    }
  }
  if (e.ctrlKey && e.key === 's') {
    // Handled via editor listener
  }
});

window.addEventListener('resize', function() {
  if (window.innerWidth > 768) {
    document.getElementById('fmSidebar').classList.remove('open');
  }
});

console.log('[NEXUS FM] File Manager initialized');
