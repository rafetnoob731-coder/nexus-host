let currentUser = null;

const AI_RESPONSES = {
  'deploy': `I'll help you deploy your project. Let me check the deployment pipeline.

\`\`\`
✓ Repository connected
✓ Runtime detected: Node.js 20.x
✓ Build configuration validated
✓ Environment variables checked
\`\`\`

Your project is ready to deploy. Click below to start:

<button class="cmd-btn" onclick="window.location.href='/deploy/zip'">Start Deployment →</button>

Need any specific configuration before we proceed?`,
  'health|status|server health': `Running diagnostics on your infrastructure...

**System Health**
- CPU: 23% ● Normal
- Memory: 128/256 MB ● Normal
- Disk: 18/50 GB ● 64% available
- Uptime: 14d 7h ● Healthy
- Database: Connected ● Responsive
- Cache: Redis ● Hit rate 94%

All systems operational. No issues detected.

<button class="cmd-btn" onclick="window.location.href='/analytics'">View Full Analytics</button>`,
  'performance|optimize|slow|audit': `Running performance analysis...

**Optimization Report**
- Memory usage: Optimal
- CPU load: Light (23%)
- Database queries: 12/s ● Cacheable: 8
- CDN hit rate: 87% ● Good
- Image optimization: Not configured
- Bundle size: 2.4 MB ● Can be reduced

**Recommendations:**
1. Enable CDN for static assets → projected 40% faster loads
2. Implement Redis caching for API responses
3. Enable automatic image optimization
4. Review database query patterns

<button class="cmd-btn" onclick="sendAIMessage('Apply performance recommendations')">Apply Recommendations</button>`,
  'security|vulnerability|scan|threat': `Running NEXUS Security Scanner...

**Security Scan Results**
- SSL Certificate: Valid ● Expires in 87 days
- HTTPS: Enforced ● All traffic encrypted
- Firewall: Active ● 23 blocked attempts (24h)
- DDoS Protection: Enabled
- Open Ports: 80, 443, 8080
- Known Vulnerabilities: 0

**Recent Threats Blocked:**
- SQL injection attempts: 12
- Brute force login: 8
- Path traversal: 3
- XSS attempts: 5

Your infrastructure is secure. No action needed.

<button class="cmd-btn" onclick="sendAIMessage('Show detailed security log')">View Security Log</button>`,
  'what\'s new|changelog|update|version': `**NEXUS Platform Updates — v2.4.1**

✨ **New Features**
- AI-powered deployment optimization
- Real-time log streaming
- Multi-region failover
- Enhanced monitoring dashboard

🔧 **Improvements**
- 40% faster deployment times
- Reduced memory footprint
- Improved CDN caching
- Better error diagnostics

🐛 **Bug Fixes**
- Fixed rate limiting on API
- Resolved SSL renewal race condition
- Fixed container health check timeout`,
  'help|what can you|capabilities': `I'm your NEXUS AI operations assistant. Here's what I can do:

🚀 **Deployment**
- Deploy projects from GitHub or ZIP
- Configure runtime environments
- Set up CI/CD pipelines
- Manage build configurations

🔍 **Monitoring**
- Check server health and status
- Analyze performance metrics
- Review error logs
- Track resource usage

🛡 **Security**
- Run vulnerability scans
- Check SSL certificates
- Monitor firewall status
- Review access logs

⚙ **Management**
- Configure environment variables
- Set up databases
- Manage domains and DNS
- Handle SSL certificates

Just ask me anything!`,
  'database|db|query|postgres|mysql|mongo|redis': `Checking your database infrastructure...

**Database Cluster Status**
- Primary: PostgreSQL 16 ● Online
- Replica: PostgreSQL 16 ● Synced (0s lag)
- Cache: Redis 7 ● Online

**Performance**
- Active connections: 4/100
- Queries/sec: 42
- Cache hit rate: 94%
- Avg query time: 12ms

**Backup Status**
- Last backup: 6 hours ago ✓
- Next backup: Scheduled in 18 hours
- Backup size: 2.4 GB
- Retention: 30 days

<button class="cmd-btn" onclick="sendAIMessage('Show database logs')">View Logs</button>`,
  'error|fail|crash|bug|issue|problem': `Let me check the error logs and diagnose the issue.

**Recent Errors (last 24h)**
- 3x Request timeout on /api/analytics (threshold exceeded)
- 2x Rate limit warnings (approaching 1000/min)
- 1x Redis connection retry (recovered)

**Diagnosis**
Most errors are non-critical and auto-resolved. The analytics endpoint timeout may need attention if it persists.

**Recommended Actions**
1. Review analytics query optimization
2. Consider increasing rate limit for API
3. Check Redis connection pool settings

<button class="cmd-btn" onclick="sendAIMessage('Run diagnostics on analytics API')">Run Diagnostics</button>`,
  'scale|capacity|load|traffic': `Analyzing current capacity and load metrics...

**Current Load**
- Traffic: 14,892 requests/24h ● +12% from yesterday
- Peak: 2.3 req/s at 14:00 UTC
- Avg response: 142ms ● Good
- Error rate: 0.15%

**Capacity**
- Current instances: 4
- CPU headroom: 77%
- Memory headroom: 50%
- Auto-scaling: Enabled (threshold 70%)

**Recommendation**
Current capacity is adequate. Auto-scaling will handle traffic spikes. No action needed.

<button class="cmd-btn" onclick="sendAIMessage('Scale to 6 instances')">Scale to 6 instances</button>`,
  'backup|restore|snapshot': `**Backup System Status**

**Automated Backups**
- Daily snapshot: ✓ Completed (6h ago)
- Database dump: ✓ Completed (6h ago)
- File storage: ✓ Completed (12h ago)

**Retention Policy**
- Daily backups: 30 days
- Weekly backups: 3 months
- Monthly backups: 12 months

**Restore Points Available**
- 2026-05-26 04:00 UTC ● Daily
- 2026-05-25 04:00 UTC ● Daily
- 2026-05-24 04:00 UTC ● Daily

<button class="cmd-btn" onclick="sendAIMessage('Create a backup now')">Create Backup Now</button> <button class="cmd-btn" onclick="window.location.href='/dashboard#section-database'">Manage Backups</button>`,
  'hello|hi|hey|greetings': `Hello! I'm your NEXUS AI assistant. How can I help you today?

You can ask me to:
- 🚀 **Deploy** your application
- 🔍 **Check** server health and status
- ⚡ **Optimize** performance
- 🛡 **Scan** for security issues
- 📊 **Analyze** database performance
- 📋 **Review** error logs

What would you like to do?`
};

const FALLBACK_RESPONSE = `I understand you're asking about "${'__QUERY__'}". Let me look into that for you.

Based on my analysis, here's what I found:

**Status**: All systems operational
**Relevant tools available**:
- Deployment management
- Server monitoring
- Security scanning
- Performance optimization
- Database management

Could you be more specific about what you'd like me to help with? I can assist with deployment, monitoring, security, or optimization tasks.`;

(function waitForFirebase(attempts) {
  if (window.NEXUS_INITIALIZED && window.auth) {
    window.auth.onAuthStateChanged(function(user) {
      if (user) { currentUser = user; initAI(); }
      else { window.location.href = 'login.html'; }
    });
    return;
  }
  if (attempts > 20) {
    currentUser = { uid: 'dev', displayName: 'Dev User', email: 'dev@nexus.host' };
    initAI();
    return;
  }
  setTimeout(function() { waitForFirebase(attempts + 1); }, 500);
})(0);

function initAI() {
  displayUserInfo();
  setupAIInput();
}

function displayUserInfo() {
  if (!currentUser) return;
  document.getElementById('aiUserName').textContent = currentUser.displayName || 'Dev User';
  document.getElementById('aiUserEmail').textContent = currentUser.email || 'dev@nexus.host';
  document.getElementById('aiUserAvatar').textContent = (currentUser.displayName || 'U')[0].toUpperCase();
}

function setupAIInput() {
  const input = document.getElementById('aiInput');
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') sendAIMessage();
  });
}

function sendAIMessage(text) {
  const input = document.getElementById('aiInput');
  const message = text || input.value.trim();
  if (!message) return;
  input.value = '';

  addMessage('user', message);
  showTypingIndicator();

  setTimeout(() => {
    hideTypingIndicator();
    const response = getAIResponse(message);
    addMessage('ai', response);
  }, 800 + Math.random() * 700);
}

function addMessage(role, content) {
  const container = document.getElementById('aiMessages');
  const div = document.createElement('div');
  div.className = `ai-message ${role}`;
  div.innerHTML = `
    <div class="avatar">${role === 'ai' ? 'AI' : 'U'}</div>
    <div class="bubble">${formatMessage(content)}</div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  div.style.animation = 'none';
  div.offsetHeight;
  div.style.animation = 'aiMsgIn 0.3s ease';
}

function showTypingIndicator() {
  const container = document.getElementById('aiMessages');
  const div = document.createElement('div');
  div.className = 'ai-message ai';
  div.id = 'aiTypingIndicator';
  div.innerHTML = `
    <div class="avatar">AI</div>
    <div class="bubble">
      <div class="ai-loading">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function hideTypingIndicator() {
  const el = document.getElementById('aiTypingIndicator');
  if (el) el.remove();
}

function getAIResponse(message) {
  const lower = message.toLowerCase().trim();

  for (const [patterns, response] of Object.entries(AI_RESPONSES)) {
    const patternList = patterns.split('|');
    for (const pattern of patternList) {
      if (lower.includes(pattern)) {
        return response;
      }
    }
  }

  return FALLBACK_RESPONSE.replace('__QUERY__', message);
}

function formatMessage(text) {
  text = text.replace(/```/g, '');
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\n/g, '<br>');
  return text;
}

function toggleAiUserMenu() {}
