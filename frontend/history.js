const TOKEN_KEY = 'atlas_token';

const els = {
  search: document.getElementById('historySearch'),
  sessionList: document.getElementById('historySessionList'),
  sessionTitle: document.getElementById('historySessionTitle'),
  preview: document.getElementById('historyPreview'),
  resumeBtn: document.getElementById('resumeSessionBtn'),
};

const state = {
  sessions: [],
  selectedSessionId: null,
};

function requireToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.href = '/signin';
    return null;
  }
  return token;
}

async function requestJson(url, options = {}) {
  const token = requireToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('atlas_user_email');
    localStorage.removeItem('atlas_user_role');
    localStorage.removeItem('atlas_user_id');
    window.location.href = '/signin';
    throw new Error('Unauthorized');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function renderPreview(messages = []) {
  els.preview.innerHTML = '';
  if (!messages.length) {
    els.preview.innerHTML = '<p class="session-empty">No messages in this conversation yet.</p>';
    return;
  }

  messages.forEach((message) => {
    const row = document.createElement('div');
    row.className = `history-msg ${message.role === 'user' ? 'user' : 'assistant'}`;
    row.textContent = message.content;
    els.preview.appendChild(row);
  });
}

async function selectSession(sessionId) {
  state.selectedSessionId = sessionId;
  const selected = state.sessions.find((session) => session.id === sessionId);
  els.sessionTitle.textContent = selected?.title || selected?.first_message || 'Conversation';
  els.resumeBtn.disabled = false;
  document.querySelectorAll('.history-session-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.sessionId === sessionId);
  });
  const data = await requestJson(`/api/history?sessionId=${encodeURIComponent(sessionId)}`);
  renderPreview(Array.isArray(data.messages) ? data.messages : []);
}

function renderSessions(list) {
  els.sessionList.innerHTML = '';
  if (!list.length) {
    els.sessionList.innerHTML = '<p class="session-empty">No conversations yet.</p>';
    return;
  }

  list.forEach((session) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'history-session-item';
    item.dataset.sessionId = session.id;
    const dateNode = document.createElement('div');
    dateNode.className = 'history-session-date';
    dateNode.textContent = new Date(session.created_at).toLocaleDateString();
    const titleNode = document.createElement('div');
    titleNode.className = 'history-session-title';
    titleNode.textContent = session.title || session.first_message || 'Untitled conversation';
    item.appendChild(dateNode);
    item.appendChild(titleNode);
    item.addEventListener('click', () => {
      selectSession(session.id).catch(() => {
        els.preview.innerHTML = '<p class="session-empty">Could not load this conversation.</p>';
      });
    });
    els.sessionList.appendChild(item);
  });
}

function applySearch() {
  const q = els.search.value.trim().toLowerCase();
  if (!q) {
    renderSessions(state.sessions);
    return;
  }
  const filtered = state.sessions.filter((session) => {
    const hay = `${session.title || ''} ${session.first_message || ''}`.toLowerCase();
    return hay.includes(q);
  });
  renderSessions(filtered);
}

async function init() {
  if (!requireToken()) return;
  const data = await requestJson('/api/sessions');
  state.sessions = Array.isArray(data.sessions) ? data.sessions : [];
  renderSessions(state.sessions);
}

els.search.addEventListener('input', applySearch);
els.resumeBtn.addEventListener('click', () => {
  if (!state.selectedSessionId) return;
  window.location.href = `/chat?sessionId=${encodeURIComponent(state.selectedSessionId)}`;
});

init().catch(() => {
  els.sessionList.innerHTML = '<p class="session-empty">Unable to load conversations.</p>';
});
