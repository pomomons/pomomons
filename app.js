// app.js — timer logic and session/screen flow

// ── Screen switching ──────────────────────────────────────
const screens = document.querySelectorAll('.screen');

function showScreen(name) {
  screens.forEach(s => s.classList.toggle('active', s.id === `screen-${name}`));
  if (name === 'mymons') Collection.renderMyMons();
  if (name === 'dex')    Collection.renderDex();
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
const btnStart     = document.getElementById('btn-start');
const btnReset     = document.getElementById('btn-reset');
const btnMode      = document.getElementById('btn-mode');
const modeDropdown = document.getElementById('mode-dropdown');
const dots         = document.querySelectorAll('.session-dots .dot');

const MODE_LABELS = { focus: 'FOCUS', short: 'SHORT', long: 'LONG' };

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

function updateButtonStates() {
  const isIdle = !running && timeLeft === MODES[currentMode];
  btnStart.textContent = running ? '⏸ PAUSE' : '▶ START';
  btnStart.classList.toggle('btn-timer-start', !running);
  btnStart.classList.toggle('btn-timer-pause', running);
  btnReset.disabled = isIdle;
}

function setMode(mode) {
  currentMode = mode;
  timeLeft    = MODES[mode];
  running     = false;
  clearInterval(intervalId);
  elColon.style.animationPlayState = 'paused';
  elColon.style.opacity = '1';
  document.body.dataset.mode = mode;
  btnMode.textContent = `${MODE_LABELS[mode]} ▼`;
  document.querySelectorAll('.mode-option').forEach(o => {
    o.classList.toggle('active', o.dataset.mode === mode);
  });
  updateBackground();
  renderTime();
  updateButtonStates();
}

function startTimer() {
  if (running) return;
  running = true;
  SFX.play('start');
  elColon.style.animationPlayState = 'running';
  updateBackground();
  updateButtonStates();
  intervalId = setInterval(() => {
    timeLeft--;
    renderTime();
    if (timeLeft <= 0) onSessionEnd();
  }, 1000);
}

function pauseTimer() {
  if (!running) return;
  running = false;
  clearInterval(intervalId);
  elColon.style.animationPlayState = 'paused';
  elColon.style.opacity = '1';
  renderTime();
  updateBackground();
  updateButtonStates();
}

function resetTimer() {
  clearInterval(intervalId);
  running = false;
  timeLeft = MODES[currentMode];
  elColon.style.animationPlayState = 'paused';
  elColon.style.opacity = '1';
  updateBackground();
  renderTime();
  updateButtonStates();
}

function onSessionEnd() {
  clearInterval(intervalId);
  running = false;
  SFX.play('sessionEnd');
  elColon.style.animationPlayState = 'paused';
  elColon.style.opacity = '1';
  updateBackground();
  updateButtonStates();

  if (currentMode === 'focus') {
    sessionsToday++;
    renderDots();
    // Every 4th session → long break; otherwise → short break
    const nextMode = sessionsToday % 4 === 0 ? 'long' : 'short';
    // Update persistent stats
    const prevSessions = parseInt(localStorage.getItem('pm_total_sessions') || '0', 10);
    const prevMinutes  = parseInt(localStorage.getItem('pm_total_minutes')  || '0', 10);
    localStorage.setItem('pm_total_sessions', prevSessions + 1);
    localStorage.setItem('pm_total_minutes',  prevMinutes + focusMins);
    renderStats();
    CompanionCanvas.stop();
    EncounterScreen.start(() => {
      CompanionCanvas.init(document.getElementById('companion-canvas'));
      setMode(nextMode);
    });
    return;
  }

  // Break ended — reset to full break duration (user starts it manually)
  timeLeft = MODES[currentMode];
  renderTime();
}

// ── Mode dropdown ─────────────────────────────────────────
btnMode.addEventListener('click', e => {
  e.stopPropagation();
  modeDropdown.hidden = !modeDropdown.hidden;
});

document.querySelectorAll('.mode-option').forEach(opt => {
  opt.addEventListener('click', () => {
    setMode(opt.dataset.mode);
    modeDropdown.hidden = true;
  });
});

document.addEventListener('click', () => { modeDropdown.hidden = true; });

// ── Controls ──────────────────────────────────────────────
btnStart.addEventListener('click', () => running ? pauseTimer() : startTimer());
btnReset.addEventListener('click', resetTimer);

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
  banner.textContent = `LEVEL UP! LVL ${level}`;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 2200);
}

// ── Boot ──────────────────────────────────────────────────
loadPlayerState();
renderStats();
document.body.dataset.mode = currentMode;
Collection.init();

// Navigation
document.getElementById('btn-go-mymons').addEventListener('click', () => showScreen('mymons'));
document.getElementById('btn-go-dex').addEventListener('click',    () => showScreen('dex'));
document.getElementById('btn-back-mymons').addEventListener('click', () => showScreen('timer'));
document.getElementById('btn-back-dex').addEventListener('click',    () => showScreen('timer'));

// Audio toggle
const btnAudio = document.getElementById('btn-audio');
btnAudio.addEventListener('click', () => {
  const muted = SFX.toggle();
  btnAudio.textContent = muted ? '🔇' : '🔊';
});

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
updateButtonStates();
elColon.style.animationPlayState = 'paused';
elColon.style.opacity = '1';
CompanionCanvas.init(document.getElementById('companion-canvas'));
