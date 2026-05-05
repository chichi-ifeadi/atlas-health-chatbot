const form = document.getElementById('resetForm');
const statusEl = document.getElementById('resetStatus');
const btn = document.getElementById('resetBtn');
const tokenInput = document.getElementById('token');

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
}

function setLoading(isLoading) {
  btn.disabled = isLoading;
  btn.innerHTML = isLoading ? '<span class="spinner"></span>Resetting...' : 'Reset password';
}

const params = new URLSearchParams(window.location.search);
const urlToken = params.get('token');
if (urlToken) {
  tokenInput.value = urlToken;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus('');

  const token = form.token.value.trim();
  const password = form.password.value;
  const confirmPassword = form.confirmPassword.value;

  if (password !== confirmPassword) {
    setStatus('Passwords do not match.', true);
    return;
  }

  if (password.length < 8) {
    setStatus('Password must be at least 8 characters.', true);
    return;
  }

  setLoading(true);

  try {
    const response = await fetch('/api/auth/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Reset failed');
    }

    setStatus('Password reset successfully. Redirecting to sign in...');
    form.querySelectorAll('input, button').forEach((el) => { el.disabled = true; });
    setTimeout(() => { window.location.href = '/signin'; }, 2000);
  } catch (error) {
    setStatus(error.message, true);
    setLoading(false);
  }
});
