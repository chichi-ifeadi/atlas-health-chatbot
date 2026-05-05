(function initSharedSidebar() {
  const SIDEBAR_HTML = `
    <div class="sidebar-top-row">
      <span id="topbarUserName" class="topbar-user-chip"></span>
      <button id="sidebarToggle" class="sidebar-toggle-btn" type="button" aria-label="Collapse sidebar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
    </div>

    <div class="sidebar-hero">
      <p class="chat-heading-kicker">Daily Wellness Companion</p>
      <a class="sidebar-logo" href="/landing" aria-label="Atlas home">
        <span class="sidebar-logo-text">Atlas</span>
      </a>
      <p class="chat-heading-sub">Your wellness companion for better routines, lower stress, and sustainable healthy habits.</p>
      <div id="sidebarStreakBadge" class="sidebar-streak-badge" hidden>
        <span class="sidebar-streak-emoji" id="sidebarStreakEmoji">🔥</span>
        <span id="sidebarStreakText">0 day streak</span>
      </div>
    </div>

    <div class="sidebar-settings">
      <p class="prev-sessions-label">Quick Access</p>
      <div class="settings-list">
        <a class="settings-item" href="/chat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          New chat
        </a>
        <a class="settings-item" href="/checkin">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          Daily Check-in
        </a>
        <a class="settings-item" href="/dashboard">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          Dashboard
        </a>
        <a class="settings-item" href="/history">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          History
        </a>
      </div>
    </div>

    <div class="prev-sessions">
      <p class="prev-sessions-label">Previous conversations</p>
      <div id="sessionList" class="session-list">
        <p class="session-empty">Your past conversations will appear here.</p>
      </div>
    </div>

    <div class="sidebar-settings">
      <p class="prev-sessions-label">Settings</p>
      <div class="settings-list">
        <a class="settings-item" href="/profile">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          Profile
        </a>
        <button class="settings-item" id="sidebarSignOut" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign out
        </button>
      </div>
    </div>
  `;

  const heroPanel = document.querySelector('.hero-panel');
  if (!heroPanel) return;
  heroPanel.innerHTML = SIDEBAR_HTML;

  // Populate username chip
  var nameEl = document.getElementById('topbarUserName');
  if (nameEl) {
    var rawName = localStorage.getItem('atlas_user_name') || localStorage.getItem('atlas_user_email') || '';
    var displayName = rawName.includes('@') ? rawName.split('@')[0] : rawName;
    nameEl.textContent = displayName ? displayName.charAt(0).toUpperCase() + displayName.slice(1) : '';
  }

  // Mark the active nav item
  const path = window.location.pathname;
  heroPanel.querySelectorAll('a.settings-item').forEach(function(el) {
    const href = el.getAttribute('href') || '';
    if (path === href || path.endsWith(href.replace(/^\//, ''))) {
      el.classList.add('active');
    }
  });

  const shell = document.querySelector('.app-shell');
  const toggle = document.getElementById('sidebarToggle');
  const expandBtn = document.getElementById('sidebarExpandBtn');
  const MIN_W = 180;
  const MAX_W = 560;

  // Restore saved width
  const savedW = parseInt(localStorage.getItem('atlas_sidebar_width'), 10);
  if (savedW >= MIN_W && savedW <= MAX_W) {
    heroPanel.style.flexBasis = savedW + 'px';
    heroPanel.style.width = savedW + 'px';
  }

  // Restore collapsed state
  if (localStorage.getItem('atlas_sidebar_collapsed') === 'true') {
    shell && shell.classList.add('sidebar-collapsed');
  }

  function toggleSidebar() {
    if (!shell) return;
    var collapsed = shell.classList.toggle('sidebar-collapsed');
    localStorage.setItem('atlas_sidebar_collapsed', String(collapsed));
  }

  if (toggle) toggle.addEventListener('click', toggleSidebar);
  if (expandBtn) expandBtn.addEventListener('click', toggleSidebar);

  // Drag-to-resize
  var handle = document.getElementById('resizeHandle');
  if (handle) {
    handle.addEventListener('mousedown', function(e) {
      e.preventDefault();
      var startX = e.clientX;
      var startW = heroPanel.getBoundingClientRect().width;
      handle.classList.add('is-dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      heroPanel.classList.add('no-transition');

      function onMove(e) {
        var w = Math.min(MAX_W, Math.max(MIN_W, startW + e.clientX - startX));
        heroPanel.style.flexBasis = w + 'px';
        heroPanel.style.width = w + 'px';
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
  }

  // Sign out
  function signOut() {
    ['atlas_token', 'atlas_user_email', 'atlas_user_role', 'atlas_user_id', 'atlas_user_name']
      .forEach(function(k) { localStorage.removeItem(k); });
    window.location.href = '/signin';
  }

  var signOutBtn = document.getElementById('sidebarSignOut');
  if (signOutBtn) signOutBtn.addEventListener('click', signOut);

  function getDateKey(dateValue) {
    var d = new Date(dateValue);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function getStreakEmoji(streakDays) {
    if (streakDays >= 30) return '🏆';
    if (streakDays >= 14) return '🚀';
    if (streakDays >= 7) return '🔥';
    if (streakDays >= 3) return '✨';
    if (streakDays >= 1) return '🌱';
    return '🫧';
  }

  function calcConsecutiveStreak(series) {
    if (!Array.isArray(series) || !series.length) return 0;
    var checkedSet = new Set();
    series.forEach(function(item) {
      if (item && item.value !== null && item.value !== undefined) {
        checkedSet.add(getDateKey(item.date));
      }
    });

    var streak = 0;
    var cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    while (checkedSet.has(getDateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function renderSidebarStreak(streakDays) {
    var badge = document.getElementById('sidebarStreakBadge');
    var emojiEl = document.getElementById('sidebarStreakEmoji');
    var textEl = document.getElementById('sidebarStreakText');
    if (!badge || !emojiEl || !textEl) return;
    emojiEl.textContent = getStreakEmoji(streakDays);
    textEl.textContent = streakDays === 1 ? '1 day streak' : streakDays + ' day streak';
    badge.hidden = false;
  }

  function loadSidebarStreak() {
    var token = localStorage.getItem('atlas_token');
    if (!token) return;
    fetch('/api/dashboard?days=30', {
      headers: { Authorization: 'Bearer ' + token },
    })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (!data || !data.series || !data.series.sleep) return;
        var streakDays = calcConsecutiveStreak(data.series.sleep);
        renderSidebarStreak(streakDays);
      })
      .catch(function() {});
  }
  loadSidebarStreak();

  // Load previous conversations (skip on chat page — app.js handles it there)
  var isChatPage = window.location.pathname === '/chat' || window.location.pathname.endsWith('/chat.html');
  if (!isChatPage) {
    var sessionList = document.getElementById('sessionList');
    if (sessionList) {
      var token = localStorage.getItem('atlas_token');
      if (token) {
        fetch('/api/sessions', { headers: { 'Authorization': 'Bearer ' + token } })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            var sessions = Array.isArray(data.sessions) ? data.sessions : [];
            if (!sessions.length) return;
            sessionList.innerHTML = '';
            var now = new Date();
            sessions.forEach(function(session) {
              var d = new Date(session.created_at);
              var dateStr = d.toLocaleDateString('en-US', {
                month: 'short', day: 'numeric',
                ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
              });
              var label = session.title || (session.first_message
                ? (session.first_message.length > 58 ? session.first_message.slice(0, 58) + '…' : session.first_message)
                : 'Untitled conversation');
              var btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'session-item';
              btn.innerHTML = '<span class="session-date">' + dateStr + '</span><span class="session-preview">' + label + '</span>';
              btn.addEventListener('click', function() {
                window.location.href = '/chat?session=' + encodeURIComponent(session.id);
              });
              var row = document.createElement('div');
              row.className = 'session-row';
              row.appendChild(btn);
              sessionList.appendChild(row);
            });
          })
          .catch(function() {});
      }
    }
  }
}());
