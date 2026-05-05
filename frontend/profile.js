const tokenKey = 'atlas_token';
const roleKey = 'atlas_user_role';

const els = {
  profileSubtitle: document.getElementById('profileSubtitle'),
  profileDisplayName: document.getElementById('profileDisplayName'),
  profileDisplayEmail: document.getElementById('profileDisplayEmail'),
  profileAvatarInitial: document.getElementById('profileAvatarInitial'),
  nameForm: document.getElementById('nameForm'),
  nameInput: document.getElementById('nameInput'),
  nameStatus: document.getElementById('nameStatus'),
  currentEmail: document.getElementById('currentEmail'),
  newEmail: document.getElementById('newEmail'),
  emailForm: document.getElementById('emailForm'),
  emailStatus: document.getElementById('emailStatus'),
  passwordForm: document.getElementById('passwordForm'),
  currentPassword: document.getElementById('currentPassword'),
  newPassword: document.getElementById('newPassword'),
  confirmPassword: document.getElementById('confirmPassword'),
  passwordStatus: document.getElementById('passwordStatus'),
  requestResetForm: document.getElementById('requestResetForm'),
  resetEmail: document.getElementById('resetEmail'),
  requestResetStatus: document.getElementById('requestResetStatus'),
  completeResetForm: document.getElementById('completeResetForm'),
  resetToken: document.getElementById('resetToken'),
  resetPassword: document.getElementById('resetPassword'),
  completeResetStatus: document.getElementById('completeResetStatus'),
  logoutAllBtn: document.getElementById('logoutAllBtn'),
  logoutAllStatus: document.getElementById('logoutAllStatus'),
  logoutBtn: document.getElementById('logoutBtn'),
  notificationsForm: document.getElementById('notificationsForm'),
  dailyReminder: document.getElementById('dailyReminder'),
  weeklySummary: document.getElementById('weeklySummary'),
  reminderTime: document.getElementById('reminderTime'),
  reminderTimezone: document.getElementById('reminderTimezone'),
  pushNotifications: document.getElementById('pushNotifications'),
  emailNotifications: document.getElementById('emailNotifications'),
  notificationsStatus: document.getElementById('notificationsStatus'),
  sendTestEmailBtn: document.getElementById('sendTestEmailBtn'),
};

function detectBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function getTimezoneOptions() {
  if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
    try {
      const values = Intl.supportedValuesOf('timeZone');
      if (Array.isArray(values) && values.length > 0) {
        return values;
      }
    } catch {
      // Fall through to UTC.
    }
  }
  return ['UTC'];
}

function populateTimezoneSelect(selectedValue) {
  if (!els.reminderTimezone) return;
  const browserZone = detectBrowserTimezone();
  const options = getTimezoneOptions();
  els.reminderTimezone.innerHTML = '';

  options.forEach((zone) => {
    const option = document.createElement('option');
    option.value = zone;
    option.textContent = zone;
    els.reminderTimezone.appendChild(option);
  });

  const preferred = selectedValue || browserZone || 'UTC';
  els.reminderTimezone.value = options.includes(preferred) ? preferred : 'UTC';
}

function getSelectedCadence(prefs = {}) {
  if (prefs.cadence === 'weekly') return 'weekly';
  if (prefs.weeklySummary && !prefs.dailyReminder) return 'weekly';
  return 'daily';
}

function syncCadenceControls(prefs) {
  const cadence = getSelectedCadence(prefs);
  if (els.dailyReminder) els.dailyReminder.checked = cadence === 'daily';
  if (els.weeklySummary) els.weeklySummary.checked = cadence === 'weekly';
}

let notificationTimer = null;

function scheduleLocalNotification(prefs) {
  if (notificationTimer) clearTimeout(notificationTimer);
  notificationTimer = null;

  const wantsNotifications = prefs.dailyReminder || prefs.weeklySummary;
  if (!wantsNotifications || !prefs.push || !('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const [hour, minute] = (prefs.reminderTime || '20:00').split(':').map(Number);
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);

  if (prefs.weeklySummary && !prefs.dailyReminder) {
    const daysUntilSunday = (7 - next.getDay()) % 7;
    next.setDate(next.getDate() + daysUntilSunday);
    next.setHours(hour, minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 7);
  } else {
    next.setHours(hour, minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
  }

  notificationTimer = setTimeout(() => {
    const title = prefs.weeklySummary && !prefs.dailyReminder
      ? 'Atlas weekly summary'
      : 'Atlas wellness check-in';
    const body = prefs.weeklySummary && !prefs.dailyReminder
      ? 'Your weekly summary is ready. Open Atlas to review it.'
      : 'Take a minute to check in with your sleep, stress, energy, and hydration.';

    new Notification(title, { body });
    scheduleLocalNotification(prefs);
  }, next.getTime() - now.getTime());
}

function requireToken() {
  const token = localStorage.getItem(tokenKey);
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
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function setStatus(el, text, isError = false) {
  el.textContent = text;
  el.classList.toggle('error', isError);
}

function applyValidationMessages() {
  const requiredInputs = [
    els.nameInput,
    els.newEmail,
    els.currentPassword,
    els.newPassword,
    els.resetEmail,
    els.resetToken,
    els.resetPassword,
  ];
  requiredInputs.forEach((field) => {
    if (!field) return;
    field.addEventListener('invalid', () => field.setCustomValidity('Please complete this field.'));
    field.addEventListener('input', () => field.setCustomValidity(''));
  });
}

async function loadNotifications() {
  if (!els.notificationsForm) return;

  try {
    const data = await requestJson('/api/notifications');
    const prefs = data.preferences || {};
    syncCadenceControls(prefs);
    populateTimezoneSelect(prefs.timezone || detectBrowserTimezone());
    if (els.reminderTime) els.reminderTime.value = prefs.reminderTime || '20:00';
    if (els.pushNotifications) els.pushNotifications.checked = !!prefs.push;
    if (els.emailNotifications) els.emailNotifications.checked = prefs.email !== false;
    scheduleLocalNotification(prefs);
  } catch (error) {
    setStatus(els.notificationsStatus, error.message || 'Could not load notification settings.', true);
  }
}

async function loadProfile() {
  try {
    const { user } = await requestJson('/api/auth/me', { headers: { 'Content-Type': 'application/json' } });
    if (els.nameInput) {
      els.nameInput.value = user.fullName || localStorage.getItem('atlas_user_name') || '';
    }
    if (els.currentEmail) {
      els.currentEmail.value = user.email || '';
    }
    if (user.fullName) {
      localStorage.setItem('atlas_user_name', user.fullName);
    }
    const displayName = user.fullName || localStorage.getItem('atlas_user_name') || 'Atlas User';
    if (els.profileDisplayName) els.profileDisplayName.textContent = displayName;
    if (els.profileDisplayEmail) els.profileDisplayEmail.textContent = user.email || '';
    if (els.profileAvatarInitial) {
      els.profileAvatarInitial.textContent = (displayName[0] || 'A').toUpperCase();
    }
    if (els.profileSubtitle) {
      els.profileSubtitle.textContent = `Signed in as ${user.email || user.userId || ''}`;
    }

    return user;
  } catch {
    window.location.href = '/signin';
    return null;
  }
}

if (els.nameForm) els.nameForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus(els.nameStatus, '');
  const nameToSave = els.nameInput.value.trim();
  if (!nameToSave) {
    setStatus(els.nameStatus, 'Please enter a name.', true);
    return;
  }
  try {
    await requestJson('/api/auth/profile', {
      method: 'POST',
      body: JSON.stringify({ fullName: nameToSave }),
    });
    els.nameInput.value = nameToSave;
    localStorage.setItem('atlas_user_name', nameToSave);
    if (els.profileDisplayName) els.profileDisplayName.textContent = nameToSave;
    if (els.profileAvatarInitial) els.profileAvatarInitial.textContent = (nameToSave[0] || 'A').toUpperCase();
    setStatus(els.nameStatus, 'Name saved.');
  } catch (error) {
    setStatus(els.nameStatus, error.message, true);
  }
});

if (els.emailForm) els.emailForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus(els.emailStatus, '');
  try {
    await requestJson('/api/auth/profile', {
      method: 'POST',
      body: JSON.stringify({ email: els.newEmail.value.trim() || undefined }),
    });
    const newEmail = els.newEmail.value.trim();
    setStatus(els.emailStatus, 'Email updated');
    localStorage.setItem('atlas_user_email', newEmail);
    if (els.currentEmail) els.currentEmail.value = newEmail;
    els.newEmail.value = '';
    await loadProfile();
  } catch (error) {
    setStatus(els.emailStatus, error.message, true);
  }
});

els.passwordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus(els.passwordStatus, '');
  if (els.confirmPassword && els.newPassword.value !== els.confirmPassword.value) {
    setStatus(els.passwordStatus, 'New password and confirmation must match.', true);
    return;
  }
  try {
    await requestJson('/api/auth/profile', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: els.currentPassword.value,
        newPassword: els.newPassword.value,
      }),
    });
    setStatus(els.passwordStatus, 'Password updated. Redirecting to sign in...');
    els.currentPassword.value = '';
    els.newPassword.value = '';
    if (els.confirmPassword) els.confirmPassword.value = '';
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(roleKey);
    localStorage.removeItem('atlas_user_email');
    localStorage.removeItem('atlas_user_id');
    setTimeout(() => {
      window.location.href = '/signin';
    }, 900);
  } catch (error) {
    setStatus(els.passwordStatus, error.message, true);
  }
});

if (els.requestResetForm) els.requestResetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus(els.requestResetStatus, '');
  try {
    const data = await requestJson('/api/auth/request-reset', {
      method: 'POST',
      body: JSON.stringify({ email: els.resetEmail.value.trim() }),
    });
    setStatus(els.requestResetStatus, data.token ? `Reset token (demo): ${data.token}` : data.message);
  } catch (error) {
    setStatus(els.requestResetStatus, error.message, true);
  }
});

if (els.completeResetForm) els.completeResetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus(els.completeResetStatus, '');
  try {
    await requestJson('/api/auth/reset', {
      method: 'POST',
      body: JSON.stringify({ token: els.resetToken.value.trim(), password: els.resetPassword.value }),
    });
    setStatus(els.completeResetStatus, 'Password reset. Please sign in again.');
    els.resetToken.value = '';
    els.resetPassword.value = '';
  } catch (error) {
    setStatus(els.completeResetStatus, error.message, true);
  }
});

els.logoutAllBtn.addEventListener('click', async () => {
  setStatus(els.logoutAllStatus, '');
  try {
    await requestJson('/api/auth/logout-all', { method: 'POST' });
    setStatus(els.logoutAllStatus, 'All sessions logged out. Redirecting...');
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(roleKey);
    localStorage.removeItem('atlas_user_email');
    localStorage.removeItem('atlas_user_id');
    setTimeout(() => {
      window.location.href = '/signin';
    }, 900);
  } catch (error) {
    setStatus(els.logoutAllStatus, error.message, true);
  }
});

const deleteAccountBtn = document.getElementById('deleteAccountBtn');
if (deleteAccountBtn) {
  deleteAccountBtn.addEventListener('click', async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This will permanently remove all your data and cannot be undone.'
    );
    if (!confirmed) return;

    deleteAccountBtn.disabled = true;
    deleteAccountBtn.textContent = 'Deleting...';
    setStatus(els.logoutAllStatus, '');

    try {
      await requestJson('/api/auth/account', { method: 'DELETE' });
      ['atlas_token', 'atlas_user_email', 'atlas_user_role', 'atlas_user_id', 'atlas_user_name',
        'atlas_onboarding_complete', 'atlas_sidebar_collapsed', 'atlas_sidebar_width']
        .forEach((k) => localStorage.removeItem(k));
      window.location.href = '/signin';
    } catch (error) {
      setStatus(els.logoutAllStatus, error.message, true);
      deleteAccountBtn.disabled = false;
      deleteAccountBtn.textContent = 'Delete Account';
    }
  });
}

if (els.logoutBtn) {
  els.logoutBtn.addEventListener('click', () => {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(roleKey);
    localStorage.removeItem('atlas_user_email');
    localStorage.removeItem('atlas_user_id');
    window.location.href = '/signin';
  });
}

if (els.notificationsForm) els.notificationsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus(els.notificationsStatus, '');

  const cadence = els.weeklySummary && els.weeklySummary.checked ? 'weekly' : 'daily';
  let pushEnabled = !!els.pushNotifications?.checked;
  if (pushEnabled && 'Notification' in window && Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    pushEnabled = permission === 'granted';
    els.pushNotifications.checked = pushEnabled;
  }

  const prefs = {
    cadence,
    dailyReminder: cadence === 'daily',
    weeklySummary: cadence === 'weekly',
    reminderTime: els.reminderTime?.value || '20:00',
    timezone: els.reminderTimezone ? (els.reminderTimezone.value || detectBrowserTimezone()) : detectBrowserTimezone(),
    push: pushEnabled,
    email: !!els.emailNotifications?.checked,
  };

  try {
    const data = await requestJson('/api/notifications', {
      method: 'POST',
      body: JSON.stringify(prefs),
    });
    syncCadenceControls(data.preferences || prefs);
    scheduleLocalNotification(data.preferences || prefs);
    setStatus(els.notificationsStatus, 'Notification settings saved.');
  } catch (error) {
    setStatus(els.notificationsStatus, error.message || 'Could not save notification settings.', true);
  }
});

if (els.sendTestEmailBtn) {
  els.sendTestEmailBtn.addEventListener('click', async () => {
    setStatus(els.notificationsStatus, '');

    const prefs = {
      cadence: els.weeklySummary && els.weeklySummary.checked ? 'weekly' : 'daily',
      dailyReminder: !els.weeklySummary?.checked,
      weeklySummary: !!els.weeklySummary?.checked,
      reminderTime: els.reminderTime?.value || '20:00',
      timezone: els.reminderTimezone ? (els.reminderTimezone.value || detectBrowserTimezone()) : detectBrowserTimezone(),
      push: !!els.pushNotifications?.checked,
      email: true,
    };

    try {
      const data = await requestJson('/api/notifications/welcome', {
        method: 'POST',
        body: JSON.stringify(prefs),
      });
      if (els.emailNotifications) els.emailNotifications.checked = true;
      setStatus(els.notificationsStatus, data.message || 'You are signed up for Atlas emails.');
    } catch (error) {
      setStatus(els.notificationsStatus, error.message || 'Could not sign up for email notifications.', true);
    }
  });
}

applyValidationMessages();

// Decode email from the JWT payload immediately — synchronous, no API call needed
function getEmailFromToken() {
  try {
    const token = localStorage.getItem('atlas_token');
    if (!token) return '';
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.email || '';
  } catch {
    return '';
  }
}

if (els.currentEmail) {
  els.currentEmail.value =
    getEmailFromToken() ||
    localStorage.getItem('atlas_user_email') ||
    '';
}

loadProfile();
loadNotifications();
