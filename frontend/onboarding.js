const token = localStorage.getItem('atlas_token');
if (!token) {
  window.location.replace('/signin');
} else if (localStorage.getItem('atlas_onboarding_complete') === 'true') {
  window.location.replace('/chat');
}

const nameEl = document.getElementById('userName');
if (nameEl) {
  nameEl.textContent = localStorage.getItem('atlas_user_name') || 'there';
}

function showStep(n) {
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById(`dot-${i}`);
    const step = document.getElementById(`step-${i}`);
    dot.classList.remove('active', 'done');
    step.classList.remove('active');
    if (i < n) dot.classList.add('done');
    else if (i === n) dot.classList.add('active');
  }
  for (let i = 1; i <= 2; i++) {
    const line = document.getElementById(`line-${i}`);
    line.classList.toggle('done', i < n);
  }
  document.getElementById(`step-${n}`).classList.add('active');
}

document.getElementById('step1Next').addEventListener('click', () => showStep(2));
document.getElementById('step2Next').addEventListener('click', () => showStep(3));

const termsCheck = document.getElementById('termsCheck');
const startBtn = document.getElementById('startBtn');

termsCheck.addEventListener('change', () => {
  startBtn.disabled = !termsCheck.checked;
});

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  startBtn.textContent = 'Setting up…';
  try {
    await fetch('/api/auth/onboarding-complete', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (_) {
    // non-blocking — proceed regardless
  }
  localStorage.setItem('atlas_onboarding_complete', 'true');
  window.location.href = '/chat';
});

showStep(1);
