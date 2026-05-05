// Cached DOM references
const elements = {
  chatWindow: document.getElementById('chatWindow'),
  chatForm: document.getElementById('chatForm'),
  chatInput: document.getElementById('chatInput'),
  sendBtn: document.getElementById('sendBtn'),
  resetBtn: document.getElementById('resetBtn'),
  statusText: document.getElementById('statusText'),
  suggestions: document.getElementById('suggestions'),
  suggestionsLabel: document.getElementById('suggestionsLabel'),
  appTitle: document.getElementById('appTitle'),
  footerText: document.getElementById('footerText'),
  logoutBtn: document.getElementById('logoutBtn'),
  topbarUserName: document.getElementById('topbarUserName'),
  sidebarToggle: document.getElementById('sidebarToggle'),
  sidebarExpandBtn: document.getElementById('sidebarExpandBtn'),
  sessionList: document.getElementById('sessionList'),
  newChatBtn: document.getElementById('newChatBtn'),
  sidebarSignOut: document.getElementById('sidebarSignOut'),
  responseStyle: document.getElementById('responseStyle'),
};

// Sidebar collapse/expand + drag resize
(function initSidebar() {
  const shell = document.querySelector('.app-shell');
  const heroPanel = document.querySelector('.hero-panel');
  const handle = document.getElementById('resizeHandle');
  if (!shell || !elements.sidebarToggle || !heroPanel) return;

  const MIN_W = 180;
  const MAX_W = 560;

  function applyWidth(w) {
    heroPanel.style.flexBasis = w + 'px';
    heroPanel.style.width = w + 'px';
  }

  // Restore saved width
  const savedW = parseInt(localStorage.getItem('atlas_sidebar_width'), 10);
  if (savedW >= MIN_W && savedW <= MAX_W) applyWidth(savedW);

  // Restore collapsed state
  if (localStorage.getItem('atlas_sidebar_collapsed') === 'true') {
    shell.classList.add('sidebar-collapsed');
  }

  function toggleSidebar() {
    const collapsed = shell.classList.toggle('sidebar-collapsed');
    localStorage.setItem('atlas_sidebar_collapsed', collapsed);
  }

  elements.sidebarToggle.addEventListener('click', toggleSidebar);
  if (elements.sidebarExpandBtn) {
    elements.sidebarExpandBtn.addEventListener('click', toggleSidebar);
  }

  // Drag to resize
  if (!handle) return;
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = heroPanel.getBoundingClientRect().width;
    handle.classList.add('is-dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    heroPanel.classList.add('no-transition');

    function onMove(e) {
      const w = Math.min(MAX_W, Math.max(MIN_W, startW + e.clientX - startX));
      applyWidth(w);
    }

    function onUp() {
      heroPanel.classList.remove('no-transition');
      handle.classList.remove('is-dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('atlas_sidebar_width', parseInt(heroPanel.style.width, 10));
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}());

const USER_ID_STORAGE_KEY = 'atlas_user_id';
const RESPONSE_DELAY_MS = 350;
const TOKEN_KEY = 'atlas_token';

const ui = {
  documentTitle: 'Atlas',
  title: 'Atlas',
  subtitle: 'Your wellness companion for better routines, lower stress, and sustainable healthy habits.',
  placeholder: 'Ask about sleep, stress, energy, focus, or healthy routines...',
  send: 'Send',
  sending: 'Sending...',
  reset: 'New Chat',
  typing: 'Atlas is typing',
  welcome: "Hi there! I'm Atlas, your personal wellness companion. I can help you with sleep, stress, energy, nutrition, fitness, hydration, and building daily routines. What's on your mind today?",
  resetMessage: "Hi there! I'm Atlas, your personal wellness companion. I can help you with sleep, stress, energy, nutrition, fitness, hydration, and building daily routines. What's on your mind today?",
  quickPromptsTitle: 'Quick starts',
  quickPromptReady: 'Suggestion added. Edit it or send it as is.',
  quickPrompts: [
    { label: 'Sleep routine', message: 'Help me build a simple evening routine to sleep better.' },
    { label: 'Lower stress', message: 'Give me a short plan to lower stress today.' },
    { label: 'More energy', message: 'My energy drops in the afternoon. What habits should I change?' },
    { label: 'Healthy routine', message: 'Help me create a realistic wellness routine for the week.' },
    { label: 'Stay hydrated', message: 'Help me build a hydration routine I can stick to every day.' },
    { label: 'Focus tips', message: 'Give me practical focus tips for my workday.' },
    { label: 'Exercise tips', message: 'Give me beginner-friendly exercise guidance for this week.' },
    { label: 'Nutrition basics', message: 'What basic nutrition habits should I prioritize first?' },
  ],
  footer: 'Atlas provides wellness support only and does not offer medical diagnoses or treatments.',
  statusReady: 'Ask about sleep, stress, energy, focus, or routines.',
  statusSending: 'Sending your message to Atlas...',
  statusAnswered: 'Atlas replied. Continue whenever you are ready.',
  statusHistory: 'Your recent conversation was restored.',
  statusHistoryError: 'Previous messages could not be restored, but you can start a new conversation here.',
  statusResetting: 'Resetting your session...',
  statusReset: 'Session reset complete.',
  statusResetError: 'The chat could not be reset. Please try again.',
  statusConnectionError: 'Atlas could not be reached. Check your connection and try again.',
  statusCopied: 'Response copied to clipboard.',
  statusEdited: 'Prompt loaded into composer. Edit and send when ready.',
  statusDeleteConfirm: 'Delete this conversation?',
  statusDeleted: 'Conversation deleted.',
  noResponse: 'No response from assistant.',
  errorPrefix: 'Error: ',
};

const state = {
  isLoading: false,
  userId: getUserId(),
  userEmail: localStorage.getItem('atlas_user_email') || '',
  userName: localStorage.getItem('atlas_user_name') || '',
  userRole: localStorage.getItem('atlas_user_role') || 'user',
  activeSessionId: null,
};

function requireAuthToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.href = '/signin';
    return null;
  }
  return token;
}

// Persistence helpers
function getUserId() {
  try {
    let userId = localStorage.getItem(USER_ID_STORAGE_KEY);

    if (!userId) {
      userId = window.crypto && typeof window.crypto.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `atlas-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(USER_ID_STORAGE_KEY, userId);
    }

    return userId;
  } catch (error) {
    return 'anonymous';
  }
}

// UI helpers
function applyUiCopy() {
  document.title = ui.documentTitle;
  if (elements.appTitle) elements.appTitle.textContent = ui.title;
  if (elements.chatInput) elements.chatInput.placeholder = ui.placeholder;
  if (elements.sendBtn) elements.sendBtn.textContent = ui.send;
  if (elements.resetBtn) elements.resetBtn.textContent = ui.reset;
  if (elements.suggestionsLabel) elements.suggestionsLabel.textContent = ui.quickPromptsTitle;
  if (elements.footerText) elements.footerText.textContent = ui.footer;
  if (elements.topbarUserName) {
    const displayName = state.userName
      || (state.userEmail ? state.userEmail.split('@')[0] : '')
      || 'You';
    elements.topbarUserName.textContent = displayName;
  }
}

function setStatus(message) {
  if (elements.statusText) elements.statusText.textContent = message;
}

function focusInput() {
  elements.chatInput.focus();
}

function updateSendButton() {
  elements.sendBtn.disabled =
    state.isLoading || elements.chatInput.disabled || !elements.chatInput.value.trim();
}

function setControlsDisabled(disabled) {
  elements.chatInput.disabled = disabled;
  if (elements.resetBtn) elements.resetBtn.disabled = disabled;
  updateSendButton();
}

function setLoadingState(isLoading) {
  state.isLoading = isLoading;
  setControlsDisabled(isLoading);
  elements.sendBtn.innerHTML = isLoading
    ? `<span class="spinner"></span>${ui.sending}`
    : ui.send;
}

// Message rendering
function scrollChatToBottom() {
  elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight;
}

function clearChat() {
  elements.chatWindow.innerHTML = '';
}

function renderMessageContent(text) {
  if (typeof text !== 'string') return '';
  const escapeHtml = (s) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function addMessage(text, role) {
  const messageNode = document.createElement('div');
  messageNode.className = `message ${role}`;
  const contentNode = document.createElement('span');
  contentNode.className = 'message-content';
  if (role === 'assistant') {
    contentNode.innerHTML = renderMessageContent(text);
  } else {
    contentNode.textContent = text;
  }
  messageNode.appendChild(contentNode);

  if (role === 'assistant' || role === 'user') {
    const actions = document.createElement('div');
    actions.className = 'message-actions';

    if (role === 'assistant') {
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'message-action-btn';
      copyBtn.setAttribute('aria-label', 'Copy response');
      copyBtn.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="9" y="9" width="10" height="10" rx="2"></rect>
          <rect x="5" y="5" width="10" height="10" rx="2"></rect>
        </svg>
      `;
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(text);
          setStatus(ui.statusCopied);
        } catch {
          setStatus('Unable to copy this response.');
        }
      });
      actions.appendChild(copyBtn);
    }

    if (role === 'user') {
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'user-copy-btn';
      copyBtn.setAttribute('aria-label', 'Copy message');
      copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="10" height="10" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(text);
          setStatus(ui.statusCopied);
        } catch {
          setStatus('Unable to copy this message.');
        }
      });
      actions.appendChild(copyBtn);

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'message-action-btn user-edit-btn';
      editBtn.setAttribute('aria-label', 'Edit message');
      editBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`;
      editBtn.addEventListener('click', () => {
        elements.chatInput.value = text;
        focusInput();
        updateSendButton();
        setStatus(ui.statusEdited);
      });
      actions.appendChild(editBtn);

      // Wrap user bubble + actions together so hover covers both
      const wrapper = document.createElement('div');
      wrapper.className = 'user-message-wrapper';
      wrapper.appendChild(messageNode);
      wrapper.appendChild(actions);
      elements.chatWindow.appendChild(wrapper);
      requestAnimationFrame(() => messageNode.classList.add('visible'));
      scrollChatToBottom();
      return;
    }

    messageNode.appendChild(actions);
  }

  elements.chatWindow.appendChild(messageNode);
  requestAnimationFrame(() => messageNode.classList.add('visible'));
  scrollChatToBottom();
}

function removeTypingIndicator() {
  const typingNode = elements.chatWindow.querySelector('.typing-indicator');
  if (typingNode) typingNode.remove();
}

function setTyping(isTyping) {
  removeTypingIndicator();

  if (!isTyping) return;

  const typingNode = document.createElement('div');
  typingNode.className = 'typing-indicator typing-dots';
  typingNode.textContent = ui.typing;
  elements.chatWindow.appendChild(typingNode);
  scrollChatToBottom();
}

function renderConversation(messages) {
  clearChat();
  messages.forEach((message) => addMessage(message.content, message.role));
}

function renderSuggestions() {
  elements.suggestions.innerHTML = '';

  ui.quickPrompts.forEach((prompt) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'suggestion-chip';
    button.textContent = prompt.label;
    button.addEventListener('click', () => {
      elements.chatInput.value = prompt.message;
      focusInput();
      updateSendButton();
      setStatus(ui.quickPromptReady);
    });
    elements.suggestions.appendChild(button);
  });
}

// API helpers
async function requestJson(url, options) {
  const token = requireAuthToken();
  if (!token) throw new Error('Not authenticated');

  const merged = {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options && options.headers ? options.headers : {}),
    },
  };

  const response = await fetch(url, merged);
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('atlas_user_email');
    localStorage.removeItem('atlas_user_role');
    localStorage.removeItem('atlas_user_id');
    window.location.href = '/signin';
    return Promise.reject(new Error('Unauthorized'));
  }
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Server error');
  }

  return data;
}

async function loadHistory() {
  try {
    const data = await requestJson(`/api/history`);
    const messages = Array.isArray(data.messages) ? data.messages : [];
    if (data.sessionId) state.activeSessionId = data.sessionId;

    if (messages.length > 0) {
      renderConversation(messages);
      setStatus(ui.statusHistory);
      return;
    }
  } catch (error) {
    setStatus(ui.statusHistoryError);
  }

  clearChat();
  addMessage(ui.welcome, 'assistant');

  if (!elements.statusText || elements.statusText.textContent !== ui.statusHistoryError) {
    setStatus('');
  }
}

async function loadRequestedSessionFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const requestedSessionId = params.get('sessionId');
  if (!requestedSessionId) return false;
  try {
    const data = await requestJson(`/api/history?sessionId=${encodeURIComponent(requestedSessionId)}`);
    state.activeSessionId = requestedSessionId;
    renderConversation(Array.isArray(data.messages) ? data.messages : []);
    setStatus(ui.statusHistory);
    window.history.replaceState({}, '', '/chat');
    return true;
  } catch {
    setStatus('That conversation could not be loaded. Showing your latest session instead.');
    return false;
  }
}

function renderSessionList(sessions) {
  if (!elements.sessionList) return;

  if (!sessions.length) {
    elements.sessionList.innerHTML = '<p class="session-empty">Your past conversations will appear here.</p>';
    return;
  }

  elements.sessionList.innerHTML = '';
  const now = new Date();

  sessions.forEach((session) => {
    const row = document.createElement('div');
    row.className = 'session-row';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'session-item';
    btn.dataset.sessionId = session.id;
    if (session.id === state.activeSessionId) btn.classList.add('active');

    const d = new Date(session.created_at);
    const dateStr = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
    });
    const safeFirstMessage = typeof session.first_message === 'string' ? session.first_message : '';
    const label = session.title || (
      safeFirstMessage.length > 58
        ? safeFirstMessage.slice(0, 58) + '…'
        : (safeFirstMessage || 'Untitled conversation')
    );

    const dateNode = document.createElement('span');
    dateNode.className = 'session-date';
    dateNode.textContent = dateStr;
    const previewNode = document.createElement('span');
    previewNode.className = 'session-preview';
    previewNode.textContent = label;
    btn.appendChild(dateNode);
    btn.appendChild(previewNode);
    btn.addEventListener('click', () => loadSession(session.id, btn));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'session-delete-btn';
    deleteBtn.setAttribute('aria-label', 'Delete conversation');
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async (event) => {
      event.stopPropagation();
      const confirmed = window.confirm(ui.statusDeleteConfirm);
      if (!confirmed) return;
      await deleteSession(session.id);
    });

    row.appendChild(btn);
    row.appendChild(deleteBtn);
    elements.sessionList.appendChild(row);
  });
}

async function loadSession(sessionId, btnEl) {
  document.querySelectorAll('.session-item').forEach(el => el.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  state.activeSessionId = sessionId;

  try {
    const data = await requestJson(`/api/history?sessionId=${encodeURIComponent(sessionId)}`);
    renderConversation(Array.isArray(data.messages) ? data.messages : []);
  } catch {
    setStatus('Could not load that conversation.');
  }
}

async function loadPreviousSessions() {
  try {
    const data = await requestJson('/api/sessions');
    renderSessionList(Array.isArray(data.sessions) ? data.sessions : []);
  } catch {
    // non-fatal — sessions list is supplementary
  }
}

async function deleteSession(sessionId) {
  try {
    await requestJson(`/api/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
    if (state.activeSessionId === sessionId) {
      state.activeSessionId = null;
      await loadHistory();
    }
    await loadPreviousSessions();
    setStatus(ui.statusDeleted);
  } catch (error) {
    setStatus(error.message || 'Could not delete that conversation.');
  }
}

async function sendMessage(content, responseStyle = 'balanced') {
  addMessage(content, 'user');
  elements.chatInput.value = '';
  setLoadingState(true);
  setStatus(ui.statusSending);
  setTyping(true);

  try {
    const data = await requestJson('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: content, responseStyle }),
    });

    setTyping(false);
    await new Promise((resolve) => setTimeout(resolve, RESPONSE_DELAY_MS));
    addMessage(data.message || ui.noResponse, 'assistant');
    setStatus(ui.statusAnswered);
  } catch (error) {
    setTyping(false);
    addMessage(ui.errorPrefix + error.message, 'assistant');
    setStatus(ui.statusConnectionError);
  } finally {
    setLoadingState(false);
    focusInput();
  }
}

async function resetConversation() {
  if (state.isLoading) return;

  setControlsDisabled(true);
  setStatus(ui.statusResetting);

  try {
    await requestJson('/api/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    clearChat();
    addMessage(ui.resetMessage, 'assistant');
    setStatus(ui.statusReset);
    state.activeSessionId = null;
    loadPreviousSessions();
  } catch (error) {
    setStatus(ui.statusResetError);
  } finally {
    setControlsDisabled(false);
    focusInput();
  }
}

// Event wiring
function handleFormSubmit(event) {
  event.preventDefault();

  const message = elements.chatInput.value.trim();
  if (!message) return;

  sendMessage(message, elements.responseStyle ? elements.responseStyle.value : 'balanced');
}

function bindEvents() {
  elements.chatForm.addEventListener('submit', handleFormSubmit);
  elements.chatInput.addEventListener('input', updateSendButton);
  if (elements.resetBtn) elements.resetBtn.addEventListener('click', resetConversation);
  if (elements.newChatBtn) elements.newChatBtn.addEventListener('click', resetConversation);
  function signOut() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('atlas_user_email');
    localStorage.removeItem('atlas_user_role');
    localStorage.removeItem('atlas_user_id');
    localStorage.removeItem('atlas_user_name');
    window.location.href = '/signin';
  }

  if (elements.logoutBtn) elements.logoutBtn.addEventListener('click', signOut);
  if (elements.sidebarSignOut) elements.sidebarSignOut.addEventListener('click', signOut);
}

async function refreshDisplayName() {
  try {
    const data = await requestJson('/api/auth/me');
    const name = data.user?.fullName || '';
    if (name) {
      state.userName = name;
      localStorage.setItem('atlas_user_name', name);
    }
    if (elements.topbarUserName) {
      const displayName = state.userName
        || (state.userEmail ? state.userEmail.split('@')[0] : '')
        || 'You';
      elements.topbarUserName.textContent = displayName;
    }
  } catch {
    // non-fatal
  }
}

// App bootstrap
function initializeApp() {
  if (!requireAuthToken()) return;
  elements.chatInput.addEventListener('invalid', () => {
    elements.chatInput.setCustomValidity('Please enter a message.');
  });
  elements.chatInput.addEventListener('input', () => elements.chatInput.setCustomValidity(''));
  applyUiCopy();
  renderSuggestions();
  bindEvents();
  updateSendButton();

  refreshDisplayName();
  loadRequestedSessionFromUrl()
    .then((loadedRequested) => (loadedRequested ? null : loadHistory()))
    .finally(() => {
    updateSendButton();
    focusInput();
    loadPreviousSessions();
  });
}

initializeApp();
