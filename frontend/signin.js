const form = document.getElementById('signinForm');
const statusEl = document.getElementById('signinStatus');
const btn = document.getElementById('signinBtn');
const guestLink = document.getElementById('guestLink');
const modeToggleBtn = document.getElementById('modeToggleBtn');
const fullNameField = document.getElementById('fullNameField');
const authTitle = document.getElementById('authTitle');
const authSubtitle = document.getElementById('authSubtitle');

let mode = 'signin';

function applyValidationMessages() {
  const fields = [form.fullName, form.email, form.password].filter(Boolean);
  fields.forEach((field) => {
    field.addEventListener('invalid', () => field.setCustomValidity('Please complete this field.'));
    field.addEventListener('input', () => field.setCustomValidity(''));
  });
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
}

function setLoading(isLoading) {
  btn.disabled = isLoading;
  if (isLoading) {
    btn.innerHTML = mode === 'signup'
      ? '<span class="spinner"></span>Creating...'
      : '<span class="spinner"></span>Signing in...';
    return;
  }
  btn.textContent = mode === 'signup' ? 'Create account' : 'Sign in';
}

function persistSession(token, user) {
  localStorage.setItem('atlas_token', token);
  localStorage.setItem('atlas_user_email', user.email || '');
  localStorage.setItem('atlas_user_role', user.role || 'user');
  localStorage.setItem('atlas_user_id', user.id || '');
  if (user.fullName) {
    localStorage.setItem('atlas_user_name', user.fullName);
  }
}

function setMode(nextMode) {
  mode = nextMode;
  const isSignup = mode === 'signup';
  if (fullNameField) fullNameField.style.display = isSignup ? '' : 'none';
  if (form.fullName) {
    form.fullName.required = isSignup;
    if (!isSignup) form.fullName.value = '';
  }
  if (authTitle) authTitle.textContent = isSignup ? 'Create your Atlas account' : 'Sign in to Atlas';
  if (authSubtitle) {
    authSubtitle.textContent = isSignup
      ? 'Create an account to save your wellness activity.'
      : 'Continue your personal wellness journey.';
  }
  if (modeToggleBtn) modeToggleBtn.textContent = isSignup ? 'Sign in instead' : 'Create account';
  setStatus('');
  setLoading(false);
}

async function signin(email, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Sign in failed');
  return data;
}

async function signup(email, password, fullName) {
  const response = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, fullName }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Sign up failed');
  return data;
}

async function guestLogin() {
  const response = await fetch('/api/auth/guest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Guest access failed');
  return data;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('');
  setLoading(true);

  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value.trim();
  const fullName = form.fullName ? form.fullName.value.trim() : '';

  try {
    const { token, user } = mode === 'signup'
      ? await signup(email, password, fullName)
      : await signin(email, password);
    persistSession(token, user);
    // Sync localStorage with server's ground truth for onboarding state.
    if (user.onboardingComplete) {
      localStorage.setItem('atlas_onboarding_complete', 'true');
    } else {
      localStorage.removeItem('atlas_onboarding_complete');
    }
    setStatus(mode === 'signup' ? 'Account created. Redirecting...' : 'Signed in. Redirecting...');

    if (user.role === 'admin') {
      window.location.href = '/admin';
    } else if (!user.onboardingComplete) {
      window.location.href = '/onboarding';
    } else {
      window.location.href = '/chat';
    }
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setLoading(false);
  }
});

if (guestLink) {
  guestLink.addEventListener('click', (e) => {
    e.preventDefault();
    setStatus('');
    setLoading(true);
    guestLogin()
      .then(({ token, user }) => {
        persistSession(token, user);
        setStatus('Continuing as guest...');
        window.location.href = '/chat';
      })
      .catch((error) => setStatus(error.message, true))
      .finally(() => setLoading(false));
  });
}

if (modeToggleBtn) {
  modeToggleBtn.addEventListener('click', () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
  });
}

applyValidationMessages();
const urlMode = new URLSearchParams(window.location.search).get('mode');
setMode(urlMode === 'signup' ? 'signup' : 'signin');
