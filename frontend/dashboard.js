const TOKEN_KEY = 'atlas_token';
const USER_EMAIL_KEY = 'atlas_user_email';
const USER_ROLE_KEY = 'atlas_user_role';

const METRIC_LABELS = Object.freeze({
  sleep: 'Sleep',
  mood: 'Mood',
  energy: 'Energy',
  stress: 'Stress',
  hydration: 'Hydration',
});

const els = {
  rangeButtons: Array.from(document.querySelectorAll('.range-btn')),
  dashboardUserEmail: document.getElementById('dashboardUserEmail'),
  dashboardUserRole: document.getElementById('dashboardUserRole'),
  overallScore: document.getElementById('overallScore'),
  overallNote: document.getElementById('overallNote'),
  coverageValue: document.getElementById('coverageValue'),
  coverageNote: document.getElementById('coverageNote'),
  trendFocus: document.getElementById('trendFocus'),
  trendNote: document.getElementById('trendNote'),
  sleepAvg: document.getElementById('sleepAvg'),
  moodAvg: document.getElementById('moodAvg'),
  sleepDelta: document.getElementById('sleepDelta'),
  moodDelta: document.getElementById('moodDelta'),
  sleepBars: document.getElementById('sleepBars'),
  moodBars: document.getElementById('moodBars'),
  energyAvg: document.getElementById('energyAvg'),
  energyDelta: document.getElementById('energyDelta'),
  energyBars: document.getElementById('energyBars'),
  stressAvg: document.getElementById('stressAvg'),
  stressDelta: document.getElementById('stressDelta'),
  stressBars: document.getElementById('stressBars'),
  hydrationAvg: document.getElementById('hydrationAvg'),
  hydrationDelta: document.getElementById('hydrationDelta'),
  hydrationBars: document.getElementById('hydrationBars'),
  todayList: document.getElementById('todayList'),
  insightsList: document.getElementById('insightsList'),
};

function requireToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.href = '/signin';
    return null;
  }
  return token;
}

function setIdentity() {
  const email = localStorage.getItem(USER_EMAIL_KEY) || 'Signed in';
  const role = (localStorage.getItem(USER_ROLE_KEY) || 'user').toUpperCase();

  if (els.dashboardUserEmail) {
    els.dashboardUserEmail.textContent = email;
  }

  if (els.dashboardUserRole) {
    els.dashboardUserRole.textContent = role;
  }
}

function formatValue(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '--';
}

function setText(el, value) {
  if (el) el.textContent = value;
}

function setDelta(el, value) {
  if (!el) return;
  if (!Number.isFinite(value)) {
    el.textContent = '--';
    el.className = 'delta';
    return;
  }

  const sign = value >= 0 ? '↑' : '↓';
  const amount = `${value >= 0 ? '+' : '-'}${Math.abs(value).toFixed(1)}`;
  el.textContent = `${sign} ${amount} vs last week`;
  el.className = value >= 0 ? 'delta up' : 'delta down';
}

function renderBars(el, series) {
  el.innerHTML = '';
  el.style.setProperty('--bar-count', String(series.length || 7));

  const max = Math.max(...series.map((item) => item.value || 0), 10) || 10;

  series.forEach((item) => {
    const col = document.createElement('div');
    col.className = 'mini-bar__col';

    const bar = document.createElement('div');
    bar.className = 'mini-bar__item';
    bar.style.height = `${((item.value || 0) / max) * 100}%`;
    bar.title = `${new Date(item.date).toLocaleDateString()} - ${
      Number.isFinite(item.value) ? item.value.toFixed(1) : '--'
    }`;
    col.appendChild(bar);

    const label = document.createElement('span');
    label.className = 'mini-bar__label';
    label.textContent = new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' });
    col.appendChild(label);

    el.appendChild(col);
  });
}

function renderToday(listEl, scores) {
  const entries = [
    ['Sleep', scores.sleep],
    ['Mood', scores.mood],
    ['Energy', scores.energy],
    ['Stress', scores.stress],
    ['Hydration', scores.hydration],
  ];

  listEl.innerHTML = '';

  entries.forEach(([label, value]) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="today-row-head">
        <span class="today-label">${label}</span>
        <span class="today-score">${value ?? '--'}/10</span>
      </div>
      <div class="today-track">
        <div class="today-track__fill" style="width:${(value ?? 0) * 10}%;"></div>
      </div>`;
    listEl.appendChild(li);
  });
}

function renderInsights(listEl, insights) {
  listEl.innerHTML = '';

  if (!insights || insights.length === 0) {
    const li = document.createElement('li');
    li.innerHTML =
      '<div class="insight-title">No insights yet</div><div class="insight-body">Keep checking in to unlock pattern-based guidance.</div>';
    listEl.appendChild(li);
    return;
  }

  insights.forEach((insight) => {
    const lowerTitle = (insight.title || '').toLowerCase();
    let emoji = '💡';
    if (lowerTitle.includes('sleep')) emoji = '😴';
    else if (lowerTitle.includes('energy')) emoji = '⚡';
    else if (lowerTitle.includes('hydration') || lowerTitle.includes('water')) emoji = '💧';
    else if (lowerTitle.includes('stress')) emoji = '🧘';

    const li = document.createElement('li');
    li.innerHTML = `
      <div class="insight-icon">${emoji}</div>
      <div class="insight-copy">
        <div class="insight-title">${insight.title}</div>
        <div class="insight-body">${insight.body}</div>
      </div>`;
    listEl.appendChild(li);
  });
}

function calculateOverallScore(averages) {
  const values = [
    averages.sleep,
    averages.mood,
    averages.energy,
    averages.hydration,
    Number.isFinite(averages.stress) ? 10 - averages.stress : null,
  ].filter((value) => Number.isFinite(value));

  if (values.length === 0) return null;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getLoggedDays(data) {
  const series = data.series?.sleep || [];
  return series.filter((item) => Number.isFinite(item.value)).length;
}

function buildCoverageSummary(data) {
  const loggedDays = getLoggedDays(data);
  const percent = data.days > 0 ? Math.round((loggedDays / data.days) * 100) : 0;

  return {
    loggedDays,
    value: `${loggedDays}/${data.days}`,
    note:
      loggedDays === 0
        ? 'No recent check-ins yet in this selected range.'
        : `${percent}% of days logged in this ${data.days}-day window.`,
  };
}

function buildTrendFocus(deltas) {
  const entries = Object.entries(deltas || {}).filter(([, value]) => Number.isFinite(value));

  if (entries.length === 0) {
    return {
      label: 'Stable',
      note: 'Not enough comparison data yet for a clear directional trend.',
    };
  }

  const [metric, value] = entries.reduce((best, current) =>
    Math.abs(current[1]) > Math.abs(best[1]) ? current : best
  );

  if (Math.abs(value) < 0.15) {
    return {
      label: 'Stable',
      note: 'Your main signals are moving within a fairly steady range.',
    };
  }

  if (metric === 'stress') {
    if (value < 0) {
      return {
        label: 'Stress easing',
        note: `Stress improved by ${Math.abs(value).toFixed(1)} points versus the previous window.`,
      };
    }

    return {
      label: 'Stress rising',
      note: `Stress increased by ${Math.abs(value).toFixed(1)} points versus the previous window.`,
    };
  }

  if (value > 0) {
    return {
      label: `${METRIC_LABELS[metric]} improving`,
      note: `${METRIC_LABELS[metric]} is up ${value.toFixed(1)} points versus the previous window.`,
    };
  }

  return {
    label: `${METRIC_LABELS[metric]} dipping`,
    note: `${METRIC_LABELS[metric]} is down ${Math.abs(value).toFixed(1)} points versus the previous window.`,
  };
}

function updateOverview(data) {
  const coverage = buildCoverageSummary(data);
  setText(els.coverageValue, coverage.value);
  setText(els.coverageNote, coverage.note);

  if (coverage.loggedDays === 0) {
    setText(els.overallScore, '--');
    setText(els.overallNote, 'Add a few check-ins to unlock a balanced period score.');
    setText(els.trendFocus, 'Start logging');
    setText(els.trendNote, 'Once you have recent entries, Atlas will surface your main trend here.');
    return coverage.loggedDays;
  }

  const overallScore = calculateOverallScore(data.averages || {});
  const trend = buildTrendFocus(data.deltas || {});
  setText(els.overallScore, formatValue(overallScore));
  setText(els.overallNote, `${data.days}-day balanced score. Lower stress improves this number.`);
  setText(els.trendFocus, trend.label);
  setText(els.trendNote, trend.note);
  return coverage.loggedDays;
}

async function fetchDashboard(days) {
  const token = requireToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`/api/dashboard?days=${days}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (response.status === 401) {
    localStorage.clear();
    window.location.href = '/signin';
    return null;
  }

  if (!response.ok) {
    throw new Error(data.error || 'Failed to load dashboard');
  }

  return data;
}

async function loadDashboard(days = 7) {
  const data = await fetchDashboard(days);
  if (!data) return;

  const loggedDays = updateOverview(data);
  const hasData = loggedDays > 0;

  els.sleepAvg.textContent = hasData ? formatValue(data.averages.sleep) : '--';
  els.moodAvg.textContent = hasData ? formatValue(data.averages.mood) : '--';
  setDelta(els.sleepDelta, hasData ? data.deltas.sleep : null);
  setDelta(els.moodDelta, hasData ? data.deltas.mood : null);
  renderBars(els.sleepBars, data.series.sleep || []);
  renderBars(els.moodBars, data.series.mood || []);
  els.energyAvg.textContent = hasData ? formatValue(data.averages.energy) : '--';
  setDelta(els.energyDelta, hasData ? data.deltas.energy : null);
  renderBars(els.energyBars, data.series.energy || []);
  els.stressAvg.textContent = hasData ? formatValue(data.averages.stress) : '--';
  setDelta(els.stressDelta, hasData ? -data.deltas.stress : null);
  renderBars(els.stressBars, data.series.stress || []);
  els.hydrationAvg.textContent = hasData ? formatValue(data.averages.hydration) : '--';
  setDelta(els.hydrationDelta, hasData ? data.deltas.hydration : null);
  renderBars(els.hydrationBars, data.series.hydration || []);
  renderCheckinCalendar(data.series.sleep || [], days);
  renderToday(els.todayList, data.todayScores || {});
  renderInsights(els.insightsList, data.insights || []);
}

function renderCheckinCalendar(series, days) {
  const grid = document.getElementById('checkinCalendar');
  const subEl = document.getElementById('checkinCalSub');
  if (!grid) return;
  grid.innerHTML = '';

  if (!series || series.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'cal-no-data';
    empty.textContent = 'No check-in data for this period.';
    grid.appendChild(empty);
    if (subEl) subEl.textContent = '';
    return;
  }

  const checkedCount = series.filter((item) => item.value !== null && item.value !== undefined).length;
  if (subEl) subEl.textContent = `${checkedCount} of ${series.length} days`;

  const todayStr = new Date().toLocaleDateString('en-CA');

  const firstDate = new Date(series[0].date);
  const rawDay = firstDate.getDay();
  const mondayOffset = rawDay === 0 ? 6 : rawDay - 1;

  for (let i = 0; i < mondayOffset; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-cell cal-pad';
    empty.setAttribute('aria-hidden', 'true');
    grid.appendChild(empty);
  }

  series.forEach((item) => {
    const d = new Date(item.date);
    const dateStr = d.toLocaleDateString('en-CA');
    const isToday = dateStr === todayStr;
    const checked = item.value !== null && item.value !== undefined;

    const classes = ['cal-cell', checked ? 'checked' : 'missed'];
    if (isToday) classes.push('today');

    const cell = document.createElement('div');
    cell.className = classes.join(' ');
    cell.title = `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${checked ? 'Checked in ✓' : 'Missed'}`;
    cell.setAttribute('role', 'img');
    cell.setAttribute('aria-label', cell.title);

    if (checked) {
      const emoji = document.createElement('span');
      emoji.className = 'cal-emoji';
      emoji.textContent = '🔥';
      cell.appendChild(emoji);
    }

    const num = document.createElement('span');
    num.className = 'cal-num';
    num.textContent = d.getDate();
    cell.appendChild(num);

    grid.appendChild(cell);
  });
}

els.rangeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    els.rangeButtons.forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    loadDashboard(Number(button.dataset.days));
  });
});

if (requireToken()) {
  setIdentity();
  loadDashboard(7);
}
