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

function setDelta(el, value, days = 7) {
  if (!el) return;
  if (!Number.isFinite(value)) {
    el.textContent = '--';
    el.className = 'delta';
    return;
  }

  const sign = value >= 0 ? '↑' : '↓';
  const amount = `${value >= 0 ? '+' : '-'}${Math.abs(value).toFixed(1)}`;
  el.textContent = `${sign} ${amount} vs previous ${days} days`;
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

async function fetchDashboard(days, startDate, endDate) {
  const token = requireToken();
  if (!token) throw new Error('Not authenticated');

  let url = `/api/dashboard?days=${days}`;
  if (startDate) url += `&startDate=${startDate}`;
  if (endDate) url += `&endDate=${endDate}`;

  const response = await fetch(url, {
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

// Selected month/year for the calendar (defaults to current month)
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-indexed
let weekAnchorDate = getStartOfWeek(new Date());
let twoWeekAnchorDate = getStartOfWeek(new Date());

function getStartOfWeek(date) {
  const base = new Date(date);
  const dow = base.getDay();
  const mondayOffset = dow === 0 ? 6 : dow - 1;
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() - mondayOffset);
  return base;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getRangeFromBounds(bounds) {
  return {
    startDate: toDateKey(bounds.startDate),
    endDate: toDateKey(bounds.endDate),
    days: bounds.days,
  };
}

function getCalendarDateBounds(days) {
  if (days === 7) {
    const monday = new Date(weekAnchorDate);
    const sunday = addDays(monday, 6);
    return {
      startDate: monday,
      endDate: sunday,
      days: 7,
    };
  }

  if (days === 14) {
    // Previous week + running/current week (14-day window)
    const startMonday = addDays(twoWeekAnchorDate, -7);
    const endSunday = addDays(twoWeekAnchorDate, 6);
    return {
      startDate: startMonday,
      endDate: endSunday,
      days: 14,
    };
  }

  // 30-day: whole selected month
  const firstOfMonth = new Date(calYear, calMonth, 1);
  const lastOfMonth = new Date(calYear, calMonth + 1, 0);
  return { startDate: firstOfMonth, endDate: lastOfMonth, days: lastOfMonth.getDate() };
}

function getMetricsDateBounds(days) {
  if (days === 30) {
    // Keep metrics on an exact 30-day window.
    const today = new Date();
    const isCurrentMonth = calYear === today.getFullYear() && calMonth === today.getMonth();
    const endDate = isCurrentMonth ? today : new Date(calYear, calMonth + 1, 0);
    const startDate = addDays(endDate, -29);
    return { startDate, endDate, days: 30 };
  }

  return getCalendarDateBounds(days);
}

function getCalendarDateRange(days) {
  return getRangeFromBounds(getCalendarDateBounds(days));
}

function getMetricsDateRange(days) {
  return getRangeFromBounds(getMetricsDateBounds(days));
}

async function loadDashboard(days = 7) {
  const metricRange = getMetricsDateRange(days);
  const calendarRange = getCalendarDateRange(days);

  const data = await fetchDashboard(metricRange.days, metricRange.startDate, metricRange.endDate);
  if (!data) return;

  const needsCalendarFetch =
    metricRange.startDate !== calendarRange.startDate ||
    metricRange.endDate !== calendarRange.endDate ||
    metricRange.days !== calendarRange.days;

  const calendarData = needsCalendarFetch
    ? await fetchDashboard(calendarRange.days, calendarRange.startDate, calendarRange.endDate)
    : data;
  if (!calendarData) return;

  const loggedDays = updateOverview(data);
  const hasData = loggedDays > 0;

  els.sleepAvg.textContent = hasData ? formatValue(data.averages.sleep) : '--';
  els.moodAvg.textContent = hasData ? formatValue(data.averages.mood) : '--';
  setDelta(els.sleepDelta, hasData ? data.deltas.sleep : null, days);
  setDelta(els.moodDelta, hasData ? data.deltas.mood : null, days);
  renderBars(els.sleepBars, data.series.sleep || []);
  renderBars(els.moodBars, data.series.mood || []);
  els.energyAvg.textContent = hasData ? formatValue(data.averages.energy) : '--';
  setDelta(els.energyDelta, hasData ? data.deltas.energy : null, days);
  renderBars(els.energyBars, data.series.energy || []);
  els.stressAvg.textContent = hasData ? formatValue(data.averages.stress) : '--';
  setDelta(els.stressDelta, hasData ? -data.deltas.stress : null, days);
  renderBars(els.stressBars, data.series.stress || []);
  els.hydrationAvg.textContent = hasData ? formatValue(data.averages.hydration) : '--';
  setDelta(els.hydrationDelta, hasData ? data.deltas.hydration : null, days);
  renderBars(els.hydrationBars, data.series.hydration || []);
  renderCheckinCalendar(calendarData.series.sleep || [], days);
  renderToday(els.todayList, data.todayScores || {});
  renderInsights(els.insightsList, data.insights || []);
}

function renderCheckinCalendar(series, days) {
  const grid = document.getElementById('checkinCalendar');
  const subEl = document.getElementById('checkinCalSub');
  const monthLabelEl = document.getElementById('checkinCalMonthLabel');
  if (!grid) return;
  grid.innerHTML = '';

  // Build a lookup map of date string → series item
  const dataMap = {};
  (series || []).forEach((item) => { dataMap[item.date] = item; });

  const today = new Date();
  const todayStr = toDateKey(today);

  const { startDate: rangeStart, endDate: rangeEnd } = getCalendarDateBounds(days);
  const cells = [];
  for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
    cells.push(new Date(d));
  }

  if (cells.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'cal-no-data';
    empty.textContent = 'No check-in data for this period.';
    grid.appendChild(empty);
    if (subEl) subEl.textContent = '';
    if (monthLabelEl) monthLabelEl.textContent = '';
    return;
  }

  const checkedCount = cells.filter((d) => {
    const ds = toDateKey(d);
    const item = dataMap[ds];
    return ds <= todayStr && item && item.value !== null && item.value !== undefined;
  }).length;
  const trackableDays = cells.filter((d) => toDateKey(d) <= todayStr).length;
  if (subEl) subEl.textContent = `${checkedCount} of ${trackableDays} days`;

  // Month/year label
  if (monthLabelEl) {
    if (days === 7 || days === 14) {
      const firstDate = cells[0];
      const lastDate = cells[cells.length - 1];
      const firstMonth = firstDate.toLocaleDateString('en-US', { month: 'long' });
      const lastMonth = lastDate.toLocaleDateString('en-US', { month: 'long' });

      if (firstDate.getMonth() === lastDate.getMonth() && firstDate.getFullYear() === lastDate.getFullYear()) {
        monthLabelEl.textContent = `${firstMonth} ${lastDate.getFullYear()}`;
      } else if (firstDate.getFullYear() === lastDate.getFullYear()) {
        monthLabelEl.textContent = `${firstMonth}-${lastMonth} ${lastDate.getFullYear()}`;
      } else {
        monthLabelEl.textContent = `${firstMonth} ${firstDate.getFullYear()}-${lastMonth} ${lastDate.getFullYear()}`;
      }
    } else {
      const selectedMonthDate = new Date(calYear, calMonth, 1);
      monthLabelEl.textContent = selectedMonthDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
    }
  }

  // Keep 14-day view to exactly 14 visible day cells (no leading pads).
  if (days !== 14) {
    const rawDay = cells[0].getDay();
    const mondayOffset = rawDay === 0 ? 6 : rawDay - 1;
    for (let i = 0; i < mondayOffset; i++) {
      const pad = document.createElement('div');
      pad.className = 'cal-cell cal-pad';
      pad.setAttribute('aria-hidden', 'true');
      grid.appendChild(pad);
    }
  }

  cells.forEach((d) => {
    const dateStr = toDateKey(d);
    const isToday = dateStr === todayStr;
    const isFuture = dateStr > todayStr;
    const item = dataMap[dateStr];
    const checked = !isFuture && item && item.value !== null && item.value !== undefined;

    const classes = ['cal-cell'];
    if (isFuture) classes.push('future');
    else if (checked) classes.push('checked');
    else classes.push('missed');
    if (isToday) classes.push('today');

    const cell = document.createElement('div');
    cell.className = classes.join(' ');
    cell.title = isFuture
      ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${checked ? 'Checked in ✓' : 'Missed'}`;
    cell.setAttribute('role', 'img');
    cell.setAttribute('aria-label', cell.title);

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
    const days = Number(button.dataset.days);
    if (days === 7) {
      weekAnchorDate = getStartOfWeek(new Date());
    } else if (days === 14) {
      twoWeekAnchorDate = getStartOfWeek(new Date());
    } else if (days === 30) {
      const today = new Date();
      calYear = today.getFullYear();
      calMonth = today.getMonth();
    }
    loadDashboard(days);
  });
});

function getActiveDays() {
  const active = document.querySelector('.range-btn.active');
  return active ? Number(active.dataset.days) : 7;
}

function navigateCalendar(direction) {
  const activeDays = getActiveDays();
  if (activeDays === 7) {
    weekAnchorDate = addDays(weekAnchorDate, direction * 7);
    calYear = weekAnchorDate.getFullYear();
    calMonth = weekAnchorDate.getMonth();
  } else if (activeDays === 14) {
    twoWeekAnchorDate = addDays(twoWeekAnchorDate, direction * 14);
    calYear = twoWeekAnchorDate.getFullYear();
    calMonth = twoWeekAnchorDate.getMonth();
  } else {
    calMonth += direction;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    if (calMonth < 0) { calMonth = 11; calYear--; }
  }
  loadDashboard(getActiveDays());
}

document.getElementById('calPrevMonth')?.addEventListener('click', () => navigateCalendar(-1));
document.getElementById('calNextMonth')?.addEventListener('click', () => navigateCalendar(1));

if (requireToken()) {
  setIdentity();
  loadDashboard(7);
}
