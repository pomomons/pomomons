// app.js — timer logic and session/screen flow

// ── Screen switching ──────────────────────────────────────
const screens  = document.querySelectorAll('.screen');
const navBtns  = document.querySelectorAll('.nav-btn');

function showScreen(name) {
  screens.forEach(s  => s.classList.toggle('active', s.id === `screen-${name}`));
  navBtns.forEach(b  => b.classList.toggle('active', b.dataset.screen === name));
  if (name === 'collection') Collection.render();
}

navBtns.forEach(btn => {
  btn.addEventListener('click', () => showScreen(btn.dataset.screen));
});

// ── Timer state ───────────────────────────────────────────
const MODES = {
  focus: .05 * 60,
  short: 5  * 60,
  long:  15 * 60,
};

let currentMode   = 'focus';
let timeLeft      = MODES.focus;
let running       = false;
let intervalId    = null;
let sessionsToday = 0;

// ── DOM refs ──────────────────────────────────────────────
const elMinutes   = document.getElementById('timer-minutes');
const elSeconds   = document.getElementById('timer-seconds');
const elColon     = document.querySelector('.timer-colon');
const btnStart    = document.getElementById('btn-start-pause');
const btnReset    = document.getElementById('btn-reset');
const dots        = document.querySelectorAll('.session-dots .dot');

function renderTime() {
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  elMinutes.textContent = String(m).padStart(2, '0');
  elSeconds.textContent = String(s).padStart(2, '0');
}

function renderDots() {
  dots.forEach((d, i) => d.classList.toggle('filled', i < (sessionsToday % 4)));
}

function setMode(mode) {
  currentMode = mode;
  timeLeft    = MODES[mode];
  running     = false;
  clearInterval(intervalId);
  btnStart.textContent = 'Start';
  elColon.style.animationPlayState = 'paused';
  elColon.style.opacity = '1';
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.mode === mode);
    t.setAttribute('aria-selected', t.dataset.mode === mode ? 'true' : 'false');
  });
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
  } else {
    // Start / Resume
    running = true;
    btnStart.textContent = 'Pause';
    elColon.style.animationPlayState = 'running';
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
  btnStart.textContent = 'Start';
  elColon.style.animationPlayState = 'paused';
  elColon.style.opacity = '1';

  if (currentMode === 'focus') {
    sessionsToday++;
    renderDots();
    CompanionCanvas.stop();
    EncounterScreen.start(() => {
      // Encounter closed — restart companion idle animation
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
// EXP needed to reach the NEXT level (see game-mechanics.md)
function expThreshold(level) {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

function loadPlayerState() {
  const level  = parseInt(localStorage.getItem('pm_level') || '1', 10);
  const exp    = parseInt(localStorage.getItem('pm_exp')   || '0', 10);
  const expMax = expThreshold(level);
  document.getElementById('player-level').textContent = level;
  document.getElementById('exp-bar').style.width = `${Math.min(100, (exp / expMax) * 100)}%`;
}

// Add delta EXP, handle level-ups, persist, refresh header.
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
  const banner = document.createElement('div');
  banner.className   = 'level-up-banner';
  banner.textContent = `Level up! LVL ${level}`;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 2200);
}

// ── Boot ──────────────────────────────────────────────────
loadPlayerState();
Collection.init();   // opens IndexedDB; async, non-blocking
renderTime();
renderDots();
// Colon starts paused; only blinks while timer is running
elColon.style.animationPlayState = 'paused';
elColon.style.opacity = '1';
CompanionCanvas.init(document.getElementById('companion-canvas'));
