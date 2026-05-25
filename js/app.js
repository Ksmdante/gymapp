import { sessions } from './workouts.js';
import * as store from './storage.js';
import * as sheets from './sheets.js';

// Mutable copy of sessions — replaced/augmented on startup if a Sheet
// workout is fetched successfully. Always falls back to the hardcoded list.
let liveSessions = sessions.map((s) => ({ ...s }));

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

const app = document.getElementById('app');
let state = { screen: 'home' };
let activeSession = null;
let activeExercises = [];
let exerciseIndex = 0;
let setIndex = 0;
let sessionLog = [];
let sessionStart = null;
let sessionTimer = null;
let restTimer = null;
let restRemaining = 0;
let restDuration = 0;
let restAdvanceAfter = false;

function render() {
  switch (state.screen) {
    case 'home': renderHome(); break;
    case 'stats': renderStats(); break;
    case 'finisher': renderFinisherPicker(); break;
    case 'warmup': renderWarmup(); break;
    case 'exercise': renderExercise(); break;
    case 'rest': renderRest(); break;
    case 'complete': renderComplete(); break;
  }
}

function go(screen) {
  state.screen = screen;
  render();
}

function elapsed() {
  if (!sessionStart) return '0:00';
  const s = Math.floor((Date.now() - sessionStart) / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function startSessionTimer() {
  sessionStart = Date.now();
  if (sessionTimer) clearInterval(sessionTimer);
  sessionTimer = setInterval(() => {
    const el = document.getElementById('session-timer');
    if (el) el.textContent = elapsed();
  }, 1000);
}

function stopSessionTimer() {
  if (sessionTimer) { clearInterval(sessionTimer); sessionTimer = null; }
}

function currentExercise() {
  return activeExercises[exerciseIndex];
}

function currentWeight() {
  const ex = currentExercise();
  return store.getWeight(ex.id, ex.startWeight);
}

function beginSession(session) {
  activeSession = session;
  activeExercises = [...session.exercises];
  exerciseIndex = 0;
  setIndex = 0;
  sessionLog = [];
  for (const ex of activeExercises) {
    sessionLog.push({
      id: ex.id,
      name: ex.name,
      weight: store.getWeight(ex.id, ex.startWeight),
      progressionKg: ex.progressionKg,
      targetRepsMin: ex.repsMin,
      targetRepsMax: ex.repsMax,
      sets: [],
      skipped: false,
      allHitMax: false
    });
  }
  go('warmup');
}

function addFinisherExercises(selected) {
  for (const ex of selected) {
    activeExercises.push(ex);
    sessionLog.push({
      id: ex.id,
      name: ex.name,
      weight: store.getWeight(ex.id, ex.startWeight),
      progressionKg: ex.progressionKg,
      targetRepsMin: ex.repsMin,
      targetRepsMax: ex.repsMax,
      sets: [],
      skipped: false,
      allHitMax: false
    });
  }
}

// HOME
function renderHome() {
  stopSessionTimer();
  const total = store.getTotalSessions();
  const history = store.getHistory();
  const thisWeek = history.filter((s) => {
    const d = new Date(s.date);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    return d >= weekAgo;
  }).length;
  const lastSession = history[history.length - 1];
  const daysSinceLast = lastSession
    ? Math.floor((Date.now() - new Date(lastSession.date).getTime()) / 86400000)
    : null;

  app.innerHTML = `
    <div class="screen fadeUp">
      <header class="home-header">
        <div class="home-brand">
          <div class="logo-mark">G</div>
          <div>
            <h1 class="home-title">GymApp</h1>
            <p class="home-subtitle">Push / Pull / Legs</p>
          </div>
        </div>
        <button class="icon-btn" id="stats-btn" aria-label="Stats">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg>
        </button>
      </header>
      <div class="stats-bar">
        <div class="stat-pill"><span class="stat-num">${total}</span> sessions</div>
        <div class="stat-pill"><span class="stat-num">${thisWeek}</span> this week</div>
        <div class="stat-pill"><span class="stat-num">${daysSinceLast !== null ? daysSinceLast : '-'}</span> days rest</div>
      </div>
      <div class="session-cards">
        ${liveSessions.map((s) => {
          const past = store.getSessionsForType(s.id);
          const lastTrained = past.length ? new Date(past[past.length - 1].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;
          const exCount = s.exercises.length;
          let badge = '';
          if (s.fromSheet) badge = '<span class="badge badge-today">Today</span>';
          else if (!lastTrained) badge = '<span class="badge">New</span>';
          return `
          <button class="session-card" data-session="${s.id}">
            <div class="session-card-top">
              <div>
                <h2 class="session-card-name">${s.name}</h2>
                <p class="session-card-sub">${s.subtitle}</p>
              </div>
              ${badge}
            </div>
            <div class="session-card-meta">
              <span>${s.day}</span>
              <span>&middot;</span>
              <span>${exCount} exercises${s.finisher ? ` + ${s.finisher.exercises.length} optional` : ''}</span>
              ${lastTrained ? `<span>&middot;</span><span>Last: ${lastTrained}</span>` : ''}
            </div>
          </button>`;
        }).join('')}
      </div>
      ${lastSession ? `
      <div class="last-session-card">
        <p class="last-session-label">Last session</p>
        <p class="last-session-info">${lastSession.sessionType.charAt(0).toUpperCase() + lastSession.sessionType.slice(1)} &middot; ${lastSession.duration} &middot; ${lastSession.exercises.reduce((a, e) => a + e.sets.length, 0)} sets</p>
      </div>` : ''}
    </div>`;

  app.querySelectorAll('.session-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const s = liveSessions.find((x) => x.id === btn.dataset.session);
      beginSession(s);
    });
  });
  document.getElementById('stats-btn').addEventListener('click', () => go('stats'));
}

// STATS — multi-section: overview, volume chart, PRs, per-exercise progression, history
let statsState = { selectedExerciseId: null, expandedSessions: new Set(), source: 'local' };

function shellStats(body) {
  return `
    <div class="screen fadeUp">
      <header class="sub-header">
        <button class="icon-btn" id="back-btn" aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h1 class="sub-title">Stats</h1>
        <div style="width:40px"></div>
      </header>
      ${body}
    </div>`;
}

async function renderStats() {
  // Show loading shell first
  app.innerHTML = shellStats(`<p class="coming-soon">Loading…</p>`);
  document.getElementById('back-btn').addEventListener('click', () => go('home'));

  // Fetch sheet history, fall back to local on failure
  let history = null;
  if (sheets.isConfigured()) history = await sheets.fetchHistory();
  if (Array.isArray(history)) {
    statsState.source = 'sheet';
  } else {
    history = store.getHistory();
    statsState.source = 'local';
  }

  // Bail if user navigated away while fetching
  if (state.screen !== 'stats') return;

  paintStats(history);
}

function paintStats(history) {
  const allExercises = sessions.flatMap((s) => [...s.exercises, ...(s.finisher ? s.finisher.exercises : [])]);
  const exerciseMeta = {};
  for (const ex of allExercises) exerciseMeta[ex.id] = ex;
  // Also pull names from history so new IDs invented by the Sheet workout
  // get a friendly label in the progression dropdown / PR rows.
  for (const s of history) {
    for (const ex of s.exercises) {
      if (!exerciseMeta[ex.id]) exerciseMeta[ex.id] = { id: ex.id, name: ex.name };
    }
  }

  // Top-line stats
  const total = history.length;
  const thisWeek = history.filter((s) => new Date(s.date) >= new Date(Date.now() - 7 * 86400000)).length;
  const pushCount = history.filter((s) => s.sessionType === 'push').length;
  const pullCount = history.filter((s) => s.sessionType === 'pull').length;
  const legsCount = history.filter((s) => s.sessionType === 'legs').length;
  const totalKg = history.reduce((sum, s) =>
    sum + (s.totalVolume ?? s.exercises.reduce((e2, ex) =>
      e2 + (ex.sets || []).reduce((s2, set) => s2 + set.weight * set.reps, 0), 0)), 0);

  // Personal records: heaviest single set per exercise
  const prs = {};
  for (const s of history) {
    for (const ex of s.exercises) {
      for (const set of (ex.sets || [])) {
        const w = set.weight || 0;
        if (!prs[ex.id] || w > prs[ex.id].weight) {
          prs[ex.id] = { name: ex.name, weight: w, reps: set.reps, date: s.date };
        }
      }
    }
  }
  const prList = Object.entries(prs)
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => b.weight - a.weight);

  // Weekly volume — last 8 weeks
  const weeks = [];
  const now = new Date();
  const startOfWeek = (d) => {
    const dt = new Date(d);
    const day = dt.getDay() || 7;
    dt.setHours(0, 0, 0, 0);
    dt.setDate(dt.getDate() - (day - 1));
    return dt;
  };
  const thisMonday = startOfWeek(now);
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(thisMonday);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const vol = history
      .filter((s) => { const d = new Date(s.date); return d >= weekStart && d < weekEnd; })
      .reduce((a, s) => a + (s.totalVolume ?? s.exercises.reduce((e2, ex) =>
        e2 + (ex.sets || []).reduce((s2, set) => s2 + set.weight * set.reps, 0), 0)), 0);
    weeks.push({ label: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`, volume: Math.round(vol) });
  }

  // Per-exercise progression
  const exerciseIdsInHistory = [...new Set(history.flatMap((s) => s.exercises.map((e) => e.id)))];
  if (!statsState.selectedExerciseId && exerciseIdsInHistory.length > 0) {
    statsState.selectedExerciseId = exerciseIdsInHistory[0];
  }
  const progSel = statsState.selectedExerciseId;
  const progPoints = [];
  if (progSel) {
    for (const s of history) {
      const ex = s.exercises.find((e) => e.id === progSel);
      if (ex && ex.sets && ex.sets.length > 0) {
        progPoints.push({ date: new Date(s.date), weight: ex.sets[0].weight });
      }
    }
    progPoints.sort((a, b) => a.date - b.date);
  }

  // History list — newest first
  const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));

  app.innerHTML = shellStats(`
    <div class="stats-source-pill ${statsState.source === 'sheet' ? 'pill-info' : 'pill-warn'}">
      ${statsState.source === 'sheet' ? 'Live from Google Sheet' : 'Local only — sheet unreachable'}
    </div>

    <div class="stats-grid">
      <div class="stats-tile"><span class="stats-tile-num">${total}</span><span class="stats-tile-label">Total Sessions</span></div>
      <div class="stats-tile"><span class="stats-tile-num">${thisWeek}</span><span class="stats-tile-label">This Week</span></div>
      <div class="stats-tile"><span class="stats-tile-num">${pushCount}</span><span class="stats-tile-label">Push</span></div>
      <div class="stats-tile"><span class="stats-tile-num">${pullCount}</span><span class="stats-tile-label">Pull</span></div>
      <div class="stats-tile"><span class="stats-tile-num">${legsCount}</span><span class="stats-tile-label">Legs</span></div>
      <div class="stats-tile"><span class="stats-tile-num">${Math.round(totalKg).toLocaleString()}</span><span class="stats-tile-label">Total kg</span></div>
    </div>

    <h2 class="section-heading">Weekly Volume (last 8 weeks)</h2>
    ${renderVolumeChart(weeks)}

    <h2 class="section-heading">Personal Records</h2>
    ${prList.length === 0 ? '<p class="empty-note">No PRs yet — finish a session to start tracking.</p>' : `
    <div class="pr-list">
      ${prList.slice(0, 10).map((pr) => `
        <div class="pr-row">
          <div class="pr-info">
            <span class="pr-name">${pr.name}</span>
            <span class="pr-detail">${pr.reps} reps · ${new Date(pr.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
          </div>
          <span class="pr-weight">${pr.weight} kg</span>
        </div>
      `).join('')}
    </div>`}

    <h2 class="section-heading">Exercise Progression</h2>
    ${exerciseIdsInHistory.length === 0 ? '<p class="empty-note">No exercises logged yet.</p>' : `
    <select id="prog-select" class="prog-select">
      ${exerciseIdsInHistory.map((id) => {
        const name = (exerciseMeta[id] && exerciseMeta[id].name) || id;
        return `<option value="${id}" ${id === progSel ? 'selected' : ''}>${name}</option>`;
      }).join('')}
    </select>
    ${renderProgressionChart(progPoints)}`}

    <h2 class="section-heading">Session History</h2>
    ${sortedHistory.length === 0 ? '<p class="empty-note">No sessions yet.</p>' : `
    <div class="history-list">
      ${sortedHistory.map((s) => {
        const isOpen = statsState.expandedSessions.has(s.id);
        const vol = Math.round(s.totalVolume ?? s.exercises.reduce((a, ex) =>
          a + (ex.sets || []).reduce((s2, set) => s2 + set.weight * set.reps, 0), 0));
        const sets = s.totalSets ?? s.exercises.reduce((a, ex) => a + (ex.sets || []).length, 0);
        const dateStr = new Date(s.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        return `
        <div class="history-card">
          <button class="history-row" data-id="${s.id}">
            <div class="history-row-left">
              <span class="history-type">${s.sessionType.charAt(0).toUpperCase() + s.sessionType.slice(1)}</span>
              <span class="history-date">${dateStr}</span>
            </div>
            <div class="history-row-right">
              <span class="history-meta">${sets} sets · ${vol.toLocaleString()} kg · ${s.duration || '—'}</span>
              <span class="history-caret ${isOpen ? 'open' : ''}">›</span>
            </div>
          </button>
          ${isOpen ? `
          <div class="history-detail">
            ${s.exercises.map((ex) => `
              <div class="history-exercise">
                <div class="history-ex-name">${ex.name}${ex.skipped ? ' <span class="history-skip">skipped</span>' : ''}</div>
                ${(ex.sets || []).length > 0 ? `
                <div class="history-sets">
                  ${ex.sets.map((set, i) => `<span class="history-set-pill">${set.weight}kg × ${set.reps}</span>`).join('')}
                </div>` : ''}
              </div>
            `).join('')}
          </div>` : ''}
        </div>`;
      }).join('')}
    </div>`}

    <div class="danger-zone">
      <button class="btn btn-danger" id="reset-all-btn">Reset everything</button>
      <p class="danger-note">Wipes the Sheet (history + weights) and this device's local cache. Cannot be undone.</p>
    </div>
  `);

  document.getElementById('back-btn').addEventListener('click', () => go('home'));

  document.getElementById('reset-all-btn').addEventListener('click', async () => {
    if (!confirm('Wipe ALL session history and weights, both on the Sheet and this device? This cannot be undone.')) return;
    const btn = document.getElementById('reset-all-btn');
    btn.disabled = true;
    btn.textContent = 'Clearing…';
    const ok = await sheets.clearAll();
    store.clearAll();
    statsState = { selectedExerciseId: null, expandedSessions: new Set(), source: 'local' };
    if (!ok) alert('Sheet clear failed (local cleared). Re-deploy Code.gs to enable remote reset.');
    renderStats();
  });

  const progSelect = document.getElementById('prog-select');
  if (progSelect) {
    progSelect.addEventListener('change', (e) => {
      statsState.selectedExerciseId = e.target.value;
      paintStats(history);
    });
  }

  app.querySelectorAll('.history-row').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (statsState.expandedSessions.has(id)) statsState.expandedSessions.delete(id);
      else statsState.expandedSessions.add(id);
      paintStats(history);
    });
  });
}

function renderVolumeChart(weeks) {
  const w = 320, h = 140, pad = 24;
  const max = Math.max(1, ...weeks.map((wk) => wk.volume));
  const barW = (w - pad * 2) / weeks.length - 4;
  const bars = weeks.map((wk, i) => {
    const x = pad + i * ((w - pad * 2) / weeks.length);
    const barH = (wk.volume / max) * (h - pad - 16);
    const y = h - pad - barH;
    return `
      <rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="var(--accent)" rx="2"/>
      <text x="${x + barW / 2}" y="${h - 6}" text-anchor="middle" font-size="9" fill="var(--text3)" font-family="DM Sans">${wk.label}</text>
    `;
  }).join('');
  return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${bars}</svg>`;
}

function renderProgressionChart(points) {
  if (points.length === 0) return '<p class="empty-note">No data for this exercise yet.</p>';
  const w = 320, h = 160, pad = 28;
  const weights = points.map((p) => p.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;
  const xStep = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = pad + i * xStep;
    const y = h - pad - ((p.weight - minW) / range) * (h - pad * 2);
    return [x, y, p.weight];
  });

  const path = coords.map(([x, y], i) => (i === 0 ? `M${x} ${y}` : `L${x} ${y}`)).join(' ');
  const dots = coords.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="var(--accent)"/>`).join('');

  // Y-axis labels
  const yLabels = `
    <text x="4" y="${pad + 4}" font-size="9" fill="var(--text3)" font-family="DM Sans">${maxW}kg</text>
    <text x="4" y="${h - pad + 4}" font-size="9" fill="var(--text3)" font-family="DM Sans">${minW}kg</text>
  `;

  return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    ${yLabels}
    <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2"/>
    ${dots}
  </svg>`;
}

// FINISHER PICKER — shown after main exercises complete, lets user pick individual exercises
function renderFinisherPicker() {
  const finisher = activeSession.finisher;
  const selected = new Set();

  app.innerHTML = `
    <div class="screen fadeUp finisher-screen">
      <div class="finisher-card">
        <div class="finisher-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M12 2v4m0 12v4m-7.07-15.07l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
        </div>
        <h2 class="finisher-title">${finisher.name}</h2>
        <p class="finisher-sub">${finisher.subtitle}</p>
      </div>
      <p class="finisher-pick-label">Pick exercises to add:</p>
      <div class="finisher-exercise-list">
        ${finisher.exercises.map((ex, i) => `
          <button class="finisher-ex-btn" data-idx="${i}">
            <div class="finisher-ex-check" id="fcheck-${i}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <div class="finisher-ex-info">
              <span class="finisher-ex-name">${ex.name}</span>
              <span class="finisher-ex-detail">${ex.sets} sets &middot; ${ex.repsMin === ex.repsMax ? ex.repsMin : `${ex.repsMin}–${ex.repsMax}`} reps &middot; ${store.getWeight(ex.id, ex.startWeight)} kg</span>
            </div>
          </button>
        `).join('')}
      </div>
      <div class="finisher-actions">
        <button class="btn btn-secondary" id="skip-finisher">Skip all</button>
        <button class="btn btn-primary" id="add-selected">Add selected</button>
      </div>
    </div>`;

  app.querySelectorAll('.finisher-ex-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const check = document.getElementById(`fcheck-${idx}`);
      if (selected.has(idx)) {
        selected.delete(idx);
        check.classList.remove('checked');
      } else {
        selected.add(idx);
        check.classList.add('checked');
      }
    });
  });

  document.getElementById('skip-finisher').addEventListener('click', () => {
    completeSession();
  });

  document.getElementById('add-selected').addEventListener('click', () => {
    if (selected.size === 0) {
      completeSession();
      return;
    }
    const chosen = [...selected].sort((a, b) => a - b).map((i) => finisher.exercises[i]);
    addFinisherExercises(chosen);
    go('exercise');
  });
}

// WARMUP
function renderWarmup() {
  app.innerHTML = `
    <div class="screen fadeUp warmup-screen">
      <div class="warmup-icon">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      </div>
      <h2 class="warmup-title">Warm Up</h2>
      <p class="warmup-text">${activeSession.warmup}</p>
      <button class="btn btn-primary btn-lg" id="start-btn">Ready &mdash; let's go</button>
    </div>`;
  document.getElementById('start-btn').addEventListener('click', () => {
    startSessionTimer();
    go('exercise');
  });
}

// EXERCISE
function renderExercise() {
  const ex = currentExercise();
  const log = sessionLog[exerciseIndex];
  const weight = log.sets.length > 0 ? log.sets[log.sets.length - 1].weight : currentWeight();
  const totalEx = activeExercises.length;
  const progress = ((exerciseIndex) / totalEx) * 100;

  app.innerHTML = `
    <div class="screen fadeUp exercise-screen">
      <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${progress}%"></div></div>
      <header class="exercise-header">
        <button class="icon-btn" id="quit-btn" aria-label="Quit">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div class="exercise-header-center">
          <span class="exercise-counter">${exerciseIndex + 1} / ${totalEx}</span>
          <span class="exercise-timer" id="session-timer">${elapsed()}</span>
        </div>
        <button class="icon-btn text-btn" id="skip-btn">Skip</button>
      </header>

      <h2 class="exercise-name">${ex.name}</h2>
      <p class="exercise-note">${ex.note}</p>
      ${ex.compound ? '<span class="compound-tag">Compound</span>' : ''}

      <div class="set-dots">
        ${Array.from({ length: ex.sets }, (_, i) => {
          let cls = 'set-dot';
          if (i < setIndex) cls += ' done';
          else if (i === setIndex) cls += ' current';
          return `<div class="${cls}"></div>`;
        }).join('')}
      </div>
      <p class="set-label">Set ${setIndex + 1} of ${ex.sets}</p>

      <div class="target-blocks">
        <div class="target-block">
          <span class="target-label">Weight</span>
          <div class="target-adjust">
            <button class="adj-btn" id="w-minus">&minus;</button>
            <span class="target-value" id="w-value">${weight} kg</span>
            <button class="adj-btn" id="w-plus">+</button>
          </div>
        </div>
        <div class="target-block">
          <span class="target-label">Target</span>
          <div class="target-value-static">${ex.repsMin === ex.repsMax ? ex.repsMin : `${ex.repsMin}–${ex.repsMax}`} reps</div>
        </div>
      </div>

      <div class="cue-box">
        <svg class="cue-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>
        <span>${ex.cue}</span>
      </div>

      ${log.sets.length > 0 ? `
      <div class="completed-sets">
        ${log.sets.map((s, i) => `<div class="completed-set-row"><span class="completed-set-num">Set ${i + 1}</span><span>${s.weight} kg &times; ${s.reps}</span></div>`).join('')}
      </div>` : ''}

      <div class="exercise-actions">
        <button class="btn btn-primary btn-lg" id="set-done-btn">&check; Set done</button>
        <button class="btn btn-ghost" id="adjust-btn">Adjust reps</button>
      </div>
    </div>`;

  let currentAdjWeight = weight;
  document.getElementById('w-minus').addEventListener('click', () => {
    currentAdjWeight = Math.max(0, currentAdjWeight - ex.progressionKg);
    document.getElementById('w-value').textContent = `${currentAdjWeight} kg`;
  });
  document.getElementById('w-plus').addEventListener('click', () => {
    currentAdjWeight += ex.progressionKg;
    document.getElementById('w-value').textContent = `${currentAdjWeight} kg`;
  });

  document.getElementById('set-done-btn').addEventListener('click', () => {
    logSet(currentAdjWeight, ex.repsMax);
  });

  document.getElementById('adjust-btn').addEventListener('click', () => {
    showAdjustModal(currentAdjWeight, ex);
  });

  document.getElementById('skip-btn').addEventListener('click', () => {
    sessionLog[exerciseIndex].skipped = true;
    advanceExercise();
  });

  document.getElementById('quit-btn').addEventListener('click', () => {
    if (confirm('Quit this session? Progress will be lost.')) {
      stopSessionTimer();
      go('home');
    }
  });
}

function logSet(weight, reps) {
  const log = sessionLog[exerciseIndex];
  log.sets.push({ weight, reps, completed: true });
  setIndex++;

  if (setIndex >= currentExercise().sets) {
    finaliseExercise();
    startRest(currentExercise().rest, true);
  } else {
    startRest(currentExercise().rest, false);
  }
}

function finaliseExercise() {
  const ex = currentExercise();
  const log = sessionLog[exerciseIndex];
  log.weight = log.sets.length > 0 ? log.sets[0].weight : currentWeight();
  log.allHitMax = log.sets.length === ex.sets && log.sets.every((s) => s.reps >= ex.repsMax);
}

function advanceExercise() {
  exerciseIndex++;
  setIndex = 0;
  if (exerciseIndex >= activeExercises.length) {
    if (activeSession.finisher && !sessionLog.some((e) => activeSession.finisher.exercises.some((f) => f.id === e.id))) {
      go('finisher');
    } else {
      completeSession();
    }
  } else {
    go('exercise');
  }
}

function startRest(seconds, advanceAfter) {
  restDuration = seconds;
  restRemaining = seconds;
  restAdvanceAfter = advanceAfter;
  go('rest');

  if (restTimer) clearInterval(restTimer);
  restTimer = setInterval(() => {
    restRemaining--;
    updateRestDisplay();
    if (restRemaining <= 0) {
      clearInterval(restTimer);
      restTimer = null;
      if (restAdvanceAfter) advanceExercise();
      else go('exercise');
    }
  }, 1000);
}

function updateRestDisplay() {
  const el = document.getElementById('rest-countdown');
  if (el) {
    const m = Math.floor(restRemaining / 60);
    const s = restRemaining % 60;
    el.textContent = m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}`;
  }
  const ring = document.getElementById('rest-ring');
  if (ring) {
    const frac = restRemaining / restDuration;
    const circ = 2 * Math.PI * 54;
    ring.style.strokeDashoffset = circ * (1 - frac);
  }
}

function showAdjustModal(weight, ex) {
  let adjWeight = weight;
  let adjReps = ex.repsMax;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="bottom-sheet slideUp">
      <div class="sheet-handle"></div>
      <h3 class="sheet-title">Adjust Set</h3>
      <div class="adjust-fields">
        <div class="adjust-field">
          <span class="adjust-label">Weight (kg)</span>
          <div class="adjust-controls">
            <button class="adj-btn" id="ma-w-minus">&minus;</button>
            <span class="adjust-val" id="ma-w-val">${adjWeight}</span>
            <button class="adj-btn" id="ma-w-plus">+</button>
          </div>
        </div>
        <div class="adjust-field">
          <span class="adjust-label">Reps</span>
          <div class="adjust-controls">
            <button class="adj-btn" id="ma-r-minus">&minus;</button>
            <span class="adjust-val" id="ma-r-val">${adjReps}</span>
            <button class="adj-btn" id="ma-r-plus">+</button>
          </div>
        </div>
      </div>
      <button class="btn btn-primary btn-lg" id="ma-log">Log it</button>
      <button class="btn btn-ghost" id="ma-cancel">Cancel</button>
    </div>`;
  app.appendChild(overlay);

  overlay.querySelector('#ma-w-minus').addEventListener('click', () => {
    adjWeight = Math.max(0, adjWeight - ex.progressionKg);
    overlay.querySelector('#ma-w-val').textContent = adjWeight;
  });
  overlay.querySelector('#ma-w-plus').addEventListener('click', () => {
    adjWeight += ex.progressionKg;
    overlay.querySelector('#ma-w-val').textContent = adjWeight;
  });
  overlay.querySelector('#ma-r-minus').addEventListener('click', () => {
    adjReps = Math.max(0, adjReps - 1);
    overlay.querySelector('#ma-r-val').textContent = adjReps;
  });
  overlay.querySelector('#ma-r-plus').addEventListener('click', () => {
    adjReps++;
    overlay.querySelector('#ma-r-val').textContent = adjReps;
  });
  overlay.querySelector('#ma-log').addEventListener('click', () => {
    overlay.remove();
    logSet(adjWeight, adjReps);
  });
  overlay.querySelector('#ma-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// REST
function renderRest() {
  const nextEx = exerciseIndex + 1 < activeExercises.length ? activeExercises[exerciseIndex + 1] : null;
  const nextLabel = setIndex < currentExercise().sets
    ? `Set ${setIndex + 1} of ${currentExercise().name}`
    : nextEx ? nextEx.name : 'Session complete';
  const circ = 2 * Math.PI * 54;
  const frac = restRemaining / restDuration;

  app.innerHTML = `
    <div class="screen fadeUp rest-screen">
      <p class="rest-label">Rest</p>
      <div class="rest-ring-wrap">
        <svg class="rest-ring-svg" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="var(--bg3)" stroke-width="6"/>
          <circle id="rest-ring" cx="60" cy="60" r="54" fill="none" stroke="var(--accent)" stroke-width="6"
            stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - frac)}"
            transform="rotate(-90 60 60)"/>
        </svg>
        <span class="rest-countdown" id="rest-countdown">${restRemaining}</span>
      </div>
      <p class="rest-next">Next: ${nextLabel}</p>
      <div class="rest-actions">
        <button class="btn btn-ghost" id="back-to-exercise">Back</button>
        <button class="btn btn-ghost" id="skip-rest">Skip rest</button>
        <button class="btn btn-ghost" id="add-30">+30s</button>
      </div>
    </div>`;

  document.getElementById('back-to-exercise').addEventListener('click', () => {
    clearInterval(restTimer);
    restTimer = null;
    if (restAdvanceAfter) {
      exerciseIndex++;
      setIndex = 0;
    }
    exerciseIndex = Math.max(0, exerciseIndex - (restAdvanceAfter ? 1 : 0));
    go('exercise');
  });

  document.getElementById('skip-rest').addEventListener('click', () => {
    clearInterval(restTimer);
    restTimer = null;
    if (restAdvanceAfter) advanceExercise();
    else go('exercise');
  });
  document.getElementById('add-30').addEventListener('click', () => {
    restRemaining += 30;
    restDuration += 30;
  });
}

// COMPLETE
function completeSession() {
  stopSessionTimer();
  if (restTimer) { clearInterval(restTimer); restTimer = null; }
  const duration = elapsed();
  const totalSets = sessionLog.reduce((a, e) => a + e.sets.length, 0);
  const totalVol = sessionLog.reduce((a, e) => a + e.sets.reduce((s2, s) => s2 + s.weight * s.reps, 0), 0);
  const progressions = sessionLog.filter((e) => !e.skipped && e.allHitMax);

  const session = {
    id: Date.now().toString(36),
    sessionType: activeSession.id,
    date: new Date().toISOString(),
    duration,
    exercises: sessionLog
  };
  store.saveSession(session);

  // Push to Google Sheet (fire-and-forget — never blocks UI)
  sheets.saveSession(session);
  for (const ex of sessionLog) {
    if (!ex.skipped && ex.allHitMax) {
      const newWeight = (ex.weight || 0) + ex.progressionKg;
      sheets.saveWeight(ex.id, newWeight);
    }
  }

  app.innerHTML = `
    <div class="screen fadeUp complete-screen">
      <div class="complete-icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
      </div>
      <h2 class="complete-title">${activeSession.name} Complete</h2>
      <p class="complete-duration">${duration}</p>
      <div class="complete-stats">
        <div class="complete-stat"><span class="complete-stat-num">${totalSets}</span><span>Sets</span></div>
        <div class="complete-stat"><span class="complete-stat-num">${Math.round(totalVol).toLocaleString()}</span><span>Volume (kg)</span></div>
        <div class="complete-stat"><span class="complete-stat-num">${progressions.length}</span><span>Progressions</span></div>
      </div>
      ${progressions.length > 0 ? `
      <div class="progressions-list">
        <h3 class="prog-heading">Weight Increases</h3>
        ${progressions.map((e) => {
          const oldW = e.weight;
          const newW = oldW + e.progressionKg;
          return `<div class="prog-row"><span>${e.name}</span><span class="prog-vals">${oldW}kg &rarr; ${newW}kg</span></div>`;
        }).join('')}
      </div>` : ''}
      <button class="btn btn-primary btn-lg" id="done-btn">Done</button>
    </div>`;

  document.getElementById('done-btn').addEventListener('click', () => go('home'));
}

// Startup: render immediately with local data, then sync with the Sheet
// in the background. If anything comes back, re-render the home screen
// so the "Today" workout / synced weights appear.
render();

(async () => {
  if (!sheets.isConfigured()) return;

  const [todaysWorkout, remoteWeights] = await Promise.all([
    sheets.fetchTodaysWorkout(),
    sheets.fetchWeights()
  ]);

  let needsRerender = false;

  if (remoteWeights && typeof remoteWeights === 'object') {
    for (const [id, w] of Object.entries(remoteWeights)) {
      if (typeof w === 'number' && !isNaN(w)) {
        store.setWeight(id, w);
      }
    }
    needsRerender = true;
  }

  if (todaysWorkout && todaysWorkout.id && Array.isArray(todaysWorkout.exercises)) {
    const idx = liveSessions.findIndex((s) => s.id === todaysWorkout.id);
    const tagged = { ...todaysWorkout, fromSheet: true };
    if (idx >= 0) liveSessions[idx] = tagged;
    else liveSessions.unshift(tagged);
    needsRerender = true;
  }

  if (needsRerender && state.screen === 'home') render();
})();
