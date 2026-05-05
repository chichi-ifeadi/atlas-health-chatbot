const TOKEN_KEY = 'atlas_token';
const roleKey = 'atlas_user_role';
const DAILY_LIMIT = 10;

const els = {
  form: document.getElementById('checkinForm'),
  status: document.getElementById('checkinStatus'),
  submitBtn: document.getElementById('submitCheckin'),
  sliders: [
    { id: 'sleep', label: 'sleep', valueEl: document.getElementById('sleepValue') },
    { id: 'mood', label: 'mood', valueEl: document.getElementById('moodValue') },
    { id: 'energy', label: 'energy', valueEl: document.getElementById('energyValue') },
    { id: 'stress', label: 'stress', valueEl: document.getElementById('stressValue') },
    { id: 'hydration', label: 'hydration', valueEl: document.getElementById('hydrationValue') },
  ],
};

const descriptors = {
  sleep: ['Poor', 'Poor', 'Poor', 'Poor', 'Okay', 'Okay', 'Okay', 'Great', 'Great', 'Great', 'Great'],
  mood: ['Low', 'Low', 'Low', 'Low', 'Neutral', 'Neutral', 'Neutral', 'Positive', 'Positive', 'Positive', 'Positive'],
  energy: ['Drained', 'Drained', 'Drained', 'Drained', 'Moderate', 'Moderate', 'Moderate', 'High', 'High', 'High', 'High'],
  stress: ['Calm', 'Calm', 'Calm', 'Calm', 'Moderate', 'Moderate', 'Moderate', 'High', 'High', 'High', 'High'],
  hydration: ['Dehydrated', 'Dehydrated', 'Dehydrated', 'Low', 'Decent', 'Decent', 'Decent', 'Well hydrated', 'Well hydrated', 'Well hydrated', 'Well hydrated'],
};

function requireToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.href = '/signin';
    return null;
  }
  return token;
}

function setStatus(text, isError = false) {
  els.status.textContent = text;
  els.status.classList.toggle('error', isError);
}

function setLoading(isLoading) {
  els.submitBtn.disabled = isLoading;
  els.submitBtn.innerHTML = isLoading ? '<span class="spinner"></span>Submitting...' : 'Submit Check-in';
}

function updateSliderLabel(id, value, valueEl) {
  const descriptor = descriptors[id]?.[value] || '';
  valueEl.textContent = `${value} / 10${descriptor ? ` — ${descriptor}` : ''}`;
}

function attachSliderLabels() {
  els.sliders.forEach(({ id, valueEl }) => {
    const input = document.getElementById(id);
    input.addEventListener('input', () => {
      updateSliderLabel(id, Number(input.value), valueEl);
    });
    updateSliderLabel(id, Number(input.value), valueEl);
  });
}

function populateSliders(checkin) {
  els.sliders.forEach(({ id, valueEl }) => {
    const val = checkin[id];
    if (val !== null && val !== undefined) {
      const input = document.getElementById(id);
      input.value = val;
      updateSliderLabel(id, Number(val), valueEl);
    }
  });
}

function lockForm(message) {
  els.sliders.forEach(({ id }) => {
    document.getElementById(id).disabled = true;
  });
  els.submitBtn.disabled = true;
  els.submitBtn.textContent = 'Daily limit reached';
  setStatus(message || 'Daily check-in limit reached. Come back tomorrow!');
}

async function fetchTodayCheckin() {
  const token = requireToken();
  if (!token) return null;

  const response = await fetch('/api/checkin/today', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  return response.json();
}

async function submitCheckin(payload) {
  const token = requireToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch('/api/checkin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(roleKey);
    localStorage.removeItem('atlas_user_email');
    localStorage.removeItem('atlas_user_id');
    window.location.href = '/signin';
    return;
  }

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Check-in failed');
  return data;
}

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus('');
  setLoading(true);

  const payload = {
    sleep: Number(document.getElementById('sleep').value),
    mood: Number(document.getElementById('mood').value),
    energy: Number(document.getElementById('energy').value),
    stress: Number(document.getElementById('stress').value),
    hydration: Number(document.getElementById('hydration').value),
  };

  try {
    const data = await submitCheckin(payload);
    if (data?.checkin) populateSliders(data.checkin);
    if ((data?.count || 1) >= DAILY_LIMIT) {
      lockForm('Daily check-in limit reached. Come back tomorrow!');
    } else {
      setStatus('Check-in submitted. Thanks!');
      setLoading(false);
    }
  } catch (error) {
    setStatus(error.message, true);
    setLoading(false);
  }
});

async function init() {
  attachSliderLabels();

  try {
    const data = await fetchTodayCheckin();
    if (!data) return;

    if (data.checkin) populateSliders(data.checkin);

    if (data.count >= DAILY_LIMIT) {
      lockForm('Daily check-in limit reached. Come back tomorrow!');
    }
  } catch {
    // non-critical — page still works with defaults
  }
}

init();
