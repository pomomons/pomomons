// app.js — timer logic and session/screen flow

// ── Screen switching ──────────────────────────────────────
const screens = document.querySelectorAll('.screen');

function showScreen(name) {
  screens.forEach(s => s.classList.toggle('active', s.id === `screen-${name}`));
  if (name === 'collection') Collection.render();
}

// ── Timer state ───────────────────────────────────────────
const MODES = {
  focus: 25 * 60,
  short: 5  * 60,
  long:  15 * 60,
};

let focusMins   = 25;
const MIN_FOCUS = 5, MAX_FOCUS = 90;

let currentMode   = 'focus';
let timeLeft      = MODES.focus;
let running       = false;
let intervalId    = null;
let sessionsToday = 0;

// ── DOM refs ──────────────────────────────────────────────
const elMinutes = document.getElementById('timer-minutes');
const elSeconds = document.getElementById('timer-seconds');
const elColon   = document.querySelector('.timer-colon');
const btnStart  = document.getElementById('btn-start-pause');
const btnReset  = document.getElementById('btn-reset');
const dots      = document.querySelectorAll('.session-dots .dot');

// ── Background state ──────────────────────────────────────
// Only two visual states: red (running focus) or teal (everything else)
function updateBackground() {
  document.body.classList.toggle('run-focus', running && currentMode === 'focus');
}

function renderTime() {
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  elMinutes.textContent = String(m).padStart(2, '0');
  elSeconds.textContent = String(s).padStart(2, '0');
}

function renderDots() {
  dots.forEach((d, i) => d.classList.toggle('filled', i < (sessionsToday % 4)));
}

function renderStats() {
  const sessions = parseInt(localStorage.getItem('pm_total_sessions') || '0', 10);
  const minutes  = parseInt(localStorage.getItem('pm_total_minutes')  || '0', 10);
  const catches  = parseInt(localStorage.getItem('pm_total_catches')  || '0', 10);
  const el = id => document.getElementById(id);
  if (el('stat-sessions')) el('stat-sessions').textContent = sessions;
  if (el('stat-minutes'))  el('stat-minutes').textContent  = minutes + 'm';
  if (el('stat-catches'))  el('stat-catches').textContent  = catches;
}

function setMode(mode) {
  currentMode = mode;
  timeLeft    = MODES[mode];
  running     = false;
  clearInterval(intervalId);
  btnStart.textContent = 'Start';
  elColon.style.animationPlayState = 'paused';
  elColon.style.opacity = '1';
  document.body.dataset.mode = mode;
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.mode === mode);
    t.setAttribute('aria-selected', t.dataset.mode === mode ? 'true' : 'false');
  });
  updateBackground();
  renderTime();
}

function startPause() {
  if (running) {
    // Pause
    running = false;
    clearInterval(intervalId);
    btnStart.textContent = 'Resume';
    elColon.style.animationPlayState = 'paused';
    elColon.style.opacity = '1';
    renderTime();
    updateBackground();
  } else {
    // Start / Resume
    running = true;
    SFX.play('start');
    btnStart.textContent = 'Pause';
    elColon.style.animationPlayState = 'running';
    updateBackground();
    intervalId = setInterval(() => {
      timeLeft--;
      renderTime();
      if (timeLeft <= 0) onSessionEnd();
    }, 1000);
  }
}

function onSessionEnd() {
  clearInterval(intervalId);
  running = false;
  SFX.play('sessionEnd');
  btnStart.textContent = 'Start';
  elColon.style.animationPlayState = 'paused';
  elColon.style.opacity = '1';
  updateBackground();

  if (currentMode === 'focus') {
    sessionsToday++;
    renderDots();
    // Update persistent stats
    const prevSessions = parseInt(localStorage.getItem('pm_total_sessions') || '0', 10);
    const prevMinutes  = parseInt(localStorage.getItem('pm_total_minutes')  || '0', 10);
    localStorage.setItem('pm_total_sessions', prevSessions + 1);
    localStorage.setItem('pm_total_minutes',  prevMinutes + focusMins);
    renderStats();
    CompanionCanvas.stop();
    EncounterScreen.start(() => {
      CompanionCanvas.init(document.getElementById('companion-canvas'));
    });
  }

  // Auto-reset to current mode's full duration
  timeLeft = MODES[currentMode];
  renderTime();
}

// ── Mode tabs ─────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => setMode(tab.dataset.mode));
});

// ── Controls ──────────────────────────────────────────────
btnStart.addEventListener('click', startPause);
btnReset.addEventListener('click', () => setMode(currentMode));

// ── Player state (localStorage) ───────────────────────────
function expThreshold(level) {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

function loadPlayerState() {
  const level  = parseInt(localStorage.getItem('pm_level') || '1', 10);
  const exp    = parseInt(localStorage.getItem('pm_exp')   || '0', 10);
  const expMax = expThreshold(level);
  document.getElementById('player-level').textContent = level;
  document.getElementById('exp-bar').style.width = `${Math.min(100, (exp / expMax) * 100)}%`;
  const elXpCur = document.getElementById('xp-current');
  const elXpMax = document.getElementById('xp-max');
  if (elXpCur) elXpCur.textContent = exp;
  if (elXpMax) elXpMax.textContent = expMax;
  const compLvl = document.getElementById('companion-level');
  if (compLvl) compLvl.textContent = level;
}

function saveExp(delta) {
  let level = parseInt(localStorage.getItem('pm_level') || '1', 10);
  let exp   = parseInt(localStorage.getItem('pm_exp')   || '0', 10);
  exp += delta;

  let levelled = false;
  while (exp >= expThreshold(level)) {
    exp -= expThreshold(level);
    level++;
    levelled = true;
  }

  localStorage.setItem('pm_level', level);
  localStorage.setItem('pm_exp',   exp);
  loadPlayerState();

  if (levelled) showLevelUpBanner(level);
}

function showLevelUpBanner(level) {
  SFX.play('levelUp');
  const banner = document.createElement('div');
  banner.className   = 'level-up-banner';
  banner.textContent = `Level up! LVL ${level}`;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 2200);
}

// ── Boot ──────────────────────────────────────────────────
loadPlayerState();
renderStats();
document.body.dataset.mode = currentMode;
Collection.init();

// Navigation
document.getElementById('btn-go-collection').addEventListener('click', () => showScreen('collection'));
document.getElementById('btn-back').addEventListener('click', () => showScreen('timer'));

// Time adjust
document.getElementById('btn-time-minus').addEventListener('click', () => {
  if (running) return;
  focusMins = Math.max(MIN_FOCUS, focusMins - 5);
  MODES.focus = focusMins * 60;
  if (currentMode === 'focus') setMode('focus');
});

document.getElementById('btn-time-plus').addEventListener('click', () => {
  if (running) return;
  focusMins = Math.min(MAX_FOCUS, focusMins + 5);
  MODES.focus = focusMins * 60;
  if (currentMode === 'focus') setMode('focus');
});

// Restore active companion from previous session
const _activeId  = parseInt(localStorage.getItem('pm_active') || '0', 10);
const _activeMon = _activeId && typeof MONS !== 'undefined'
  ? MONS.find(m => m.id === _activeId) : null;
if (_activeMon) {
  CompanionCanvas.setMon(_activeMon);
  document.getElementById('companion-name').textContent = _activeMon.name;
}

renderTime();
renderDots();
updateBackground();
elColon.style.animationPlayState = 'paused';
elColon.style.opacity = '1';
CompanionCanvas.init(document.getElementById('companion-canvas'));
