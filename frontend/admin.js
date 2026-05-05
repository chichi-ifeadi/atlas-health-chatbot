const tokenKey = 'atlas_token';
const roleKey = 'atlas_user_role';

const elements = {
  metricUsers: document.getElementById('metricUsers'),
  metricSessions: document.getElementById('metricSessions'),
  metricMessages: document.getElementById('metricMessages'),
  metricToday: document.getElementById('metricToday'),
  metricBlocks: document.getElementById('metricBlocks'),
  logsBody: document.getElementById('logsBody'),
  refreshBtn: document.getElementById('refreshBtn'),
  logoutBtn: document.getElementById('logoutAdminBtn'),
  settingsForm: document.getElementById('settingsForm'),
  temperatureInput: document.getElementById('temperatureInput'),
  maxTokensInput: document.getElementById('maxTokensInput'),
  maxContextInput: document.getElementById('maxContextInput'),
  settingsStatus: document.getElementById('settingsStatus'),
  sessionsBody: document.getElementById('sessionsBody'),
};

function requireToken() {
  const token = localStorage.getItem(tokenKey);
  const role = localStorage.getItem(roleKey);
  if (!token || role !== 'admin') {
    window.location.href = '/signin';
    return null;
  }
  return token;
}

async function requestJson(url, options = {}) {
  const token = requireToken();
  if (!token) return null;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const data = await response.json();
  if (response.status === 401) {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(roleKey);
    localStorage.removeItem('atlas_user_email');
    localStorage.removeItem('atlas_user_id');
    window.location.href = '/signin';
    throw new Error('Unauthorized');
  }
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function formatDate(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleString();
}

function truncate(text, max = 120) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

async function loadMetrics() {
  const data = await requestJson('/api/admin/metrics');
  if (!data) return;

  elements.metricUsers.textContent = data.totalUsers ?? '--';
  elements.metricSessions.textContent = data.totalSessions ?? '--';
  elements.metricMessages.textContent = data.totalMessages ?? '--';
  elements.metricToday.textContent = data.messagesToday ?? '--';
  elements.metricBlocks.textContent = data.safetyBlocks ?? '--';
}

async function loadLogs() {
  const data = await requestJson('/api/admin/logs?limit=50');
  if (!data) return;

  elements.logsBody.innerHTML = '';
  data.logs.forEach((log) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatDate(log.created_at)}</td>
      <td>${log.role}</td>
      <td class="mono">${truncate(log.session_id, 12)}</td>
      <td>${truncate(log.content, 160)}</td>
    `;
    elements.logsBody.appendChild(row);
  });
}

async function loadSessions() {
  const data = await requestJson('/api/admin/sessions?limit=50');
  if (!data) return;

  elements.sessionsBody.innerHTML = '';
  data.sessions.forEach((session) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatDate(session.created_at)}</td>
      <td class="mono">${truncate(session.user_id, 12)}</td>
      <td class="mono">${truncate(session.id, 12)}</td>
    `;
    elements.sessionsBody.appendChild(row);
  });
}

async function loadSettings() {
  const data = await requestJson('/api/admin/settings');
  if (!data) return;

  elements.temperatureInput.value = data.settings.temperature;
  elements.maxTokensInput.value = data.settings.maxTokens;
  elements.maxContextInput.value = data.settings.maxContextMessages;
}

async function saveSettings(event) {
  event.preventDefault();
  elements.settingsStatus.textContent = '';

  const payload = {
    temperature: Number(elements.temperatureInput.value),
    maxTokens: Number(elements.maxTokensInput.value),
    maxContextMessages: Number(elements.maxContextInput.value),
  };

  try {
    await requestJson('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    elements.settingsStatus.textContent = 'Saved';
  } catch (error) {
    elements.settingsStatus.textContent = error.message;
    elements.settingsStatus.classList.add('error');
  }
}

async function bootstrap() {
  const token = requireToken();
  if (!token) return;

  try {
    await requestJson('/api/auth/me');
  } catch {
    window.location.href = '/signin';
    return;
  }

  await loadMetrics();
  await loadLogs();
  await loadSettings();
  await loadSessions();
}

elements.refreshBtn.addEventListener('click', async () => {
  await Promise.all([loadMetrics(), loadLogs(), loadSessions()]);
});

elements.settingsForm.addEventListener('submit', (event) => {
  elements.settingsStatus.classList.remove('error');
  saveSettings(event);
});

if (elements.logoutBtn) {
  elements.logoutBtn.addEventListener('click', () => {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(roleKey);
    localStorage.removeItem('atlas_user_email');
    localStorage.removeItem('atlas_user_id');
    window.location.href = '/signin';
  });
}

bootstrap();
