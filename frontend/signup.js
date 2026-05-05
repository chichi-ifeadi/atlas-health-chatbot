const form = document.getElementById('signupForm');
const statusEl = document.getElementById('signupStatus');
const btn = document.getElementById('signupBtn');
const guestLink = document.getElementById('guestLink');

function applyValidationMessages() {
  [form.fullName, form.email, form.password].forEach((field) => {
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
  btn.innerHTML = isLoading ? '<span class="spinner"></span>Creating...' : 'Create account';
}

async function signup(email, password, fullName) {
  const response = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, fullName }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Sign up failed');
  }

  return data;
}

async function guestLogin() {
  const response = await fetch('/api/auth/guest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Guest access failed');
  }
  return data;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('');
  setLoading(true);

  const fullName = form.fullName.value.trim();
  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value.trim();

  try {
    const { token, user } = await signup(email, password, fullName);
    localStorage.setItem('atlas_token', token);
    localStorage.setItem('atlas_user_email', user.email || '');
    localStorage.setItem('atlas_user_role', user.role || 'user');
    localStorage.setItem('atlas_user_id', user.id || '');
    localStorage.setItem('atlas_user_name', user.fullName || fullName || '');
    localStorage.removeItem('atlas_onboarding_complete');
    setStatus('Account created. Redirecting...');
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
        localStorage.setItem('atlas_token', token);
        localStorage.setItem('atlas_user_email', user.email || '');
        localStorage.setItem('atlas_user_role', user.role || 'user');
        localStorage.setItem('atlas_user_id', user.id || '');
        setStatus('Continuing as guest...');
        window.location.href = '/chat';
      })
      .catch((error) => setStatus(error.message, true))
      .finally(() => setLoading(false));
  });
}

applyValidationMessages();
