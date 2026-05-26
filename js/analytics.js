let currentUser = null;
let timeRange = '24h';
let chartInterval = null;

(function waitForFirebase(attempts) {
  if (window.NEXUS_INITIALIZED && window.auth) {
    window.auth.onAuthStateChanged(function(user) {
      if (user) { currentUser = user; initAnalytics(); }
      else { window.location.href = 'login.html'; }
    });
    return;
  }
  if (attempts > 20) {
    currentUser = { uid: 'dev', displayName: 'Dev User', email: 'dev@nexus.host' };
    initAnalytics();
    return;
  }
  setTimeout(function() { waitForFirebase(attempts + 1); }, 500);
})(0);

function initAnalytics() {
  displayUserInfo();
  drawAllCharts();
  chartInterval = setInterval(() => {
    updateMetrics();
    drawAllCharts();
  }, 3000);
}

function displayUserInfo() {
  if (!currentUser) return;
  document.getElementById('anUserName').textContent = currentUser.displayName || 'Dev User';
  document.getElementById('anUserEmail').textContent = currentUser.email || 'dev@nexus.host';
  document.getElementById('anUserAvatar').textContent = (currentUser.displayName || 'U')[0].toUpperCase();
}

function switchTimeRange(range) {
  timeRange = range;
  document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.time-btn[onclick*="${range}"]`).classList.add('active');
  drawAllCharts();
}

function generateData(min, max, points, volatility) {
  const data = [];
  let val = min + Math.random() * (max - min);
  for (let i = 0; i < points; i++) {
    val += (Math.random() - 0.5) * volatility;
    val = Math.max(min, Math.min(max, val));
    data.push(val);
  }
  return data;
}

function drawChart(canvasId, data, color, fillColor, lineWidth) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const w = rect.width, h = rect.height;

  ctx.clearRect(0, 0, w, h);

  if (!data || data.length < 2) return;

  const padding = { top: 10, bottom: 16, left: 8, right: 8 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartW,
    y: padding.top + chartH - ((v - min) / range) * chartH
  }));

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const xc = (points[i].x + points[i - 1].x) / 2;
    const yc = (points[i].y + points[i - 1].y) / 2;
    ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth || 2;
  ctx.stroke();

  const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
  gradient.addColorStop(0, fillColor || color.replace('1)', '0.15)'));
  gradient.addColorStop(1, fillColor ? fillColor.replace(/[\d.]+\)$/, '0)') : color.replace('1)', '0)'));
  ctx.lineTo(points[points.length - 1].x, h - padding.bottom);
  ctx.lineTo(points[0].x, h - padding.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  const gridColor = 'rgba(255,255,255,0.03)';
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
  }
}

function drawAllCharts() {
  const points = timeRange === '1h' ? 60 : timeRange === '24h' ? 48 : 56;
  const volatility = timeRange === '1h' ? 5 : 8;

  drawChart('cpuChart', generateData(10, 45, points, volatility), 'rgba(0,240,255,0.8)', 'rgba(0,240,255,0.08)', 2);
  drawChart('memoryChart', generateData(80, 200, points, 15), 'rgba(123,97,255,0.8)', 'rgba(123,97,255,0.08)', 2);
  drawChart('trafficChart', generateData(200, 800, points, 80), 'rgba(16,185,129,0.8)', 'rgba(16,185,129,0.06)', 2);
}

function updateMetrics() {
  const req = 14892 + Math.floor(Math.random() * 20 - 10);
  document.getElementById('anRequests').textContent = req.toLocaleString();

  const errors = document.querySelectorAll('.an-error-item .count');
  errors.forEach(e => {
    const current = parseInt(e.textContent);
    e.textContent = Math.max(0, current + Math.floor(Math.random() * 3 - 1));
  });
}

window.addEventListener('resize', () => {
  drawAllCharts();
});

function toggleAnUserMenu() {}
