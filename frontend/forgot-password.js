const form = document.getElementById('requestResetForm');
const statusEl = document.getElementById('requestStatus');
const btn = document.getElementById('requestBtn');
const tokenSection = document.getElementById('tokenSection');
const tokenValue = document.getElementById('tokenValue');

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
}

function setLoading(isLoading) {
  btn.disabled = isLoading;
  btn.innerHTML = isLoading ? '<span class="spinner"></span>Sending...' : 'Send reset link';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus('');
  setLoading(true);
  tokenSection.style.display = 'none';

  const email = form.email.value.trim().toLowerCase();

  try {
    const response = await fetch('/api/auth/request-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    if (data.token) {
      tokenValue.textContent = data.token;
      tokenSection.style.display = 'block';
      form.style.display = 'none';
    } else {
      setStatus(data.message || 'If that email is registered, a reset token has been generated.');
    }
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setLoading(false);
  }
});
