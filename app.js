// app.js — timer logic and session/screen flow

// ── Level reward milestones ────────────────────────────────
const LEVEL_REWARDS = [
  { level:  2, name: 'Focus Tea',      desc: '+10% XP for 1 session',          type: 'item'    },
  { level:  5, name: 'Blender',         desc: 'Blend mons into smoothie items', type: 'feature' },
  { level:  8, name: 'Rare Scanner',   desc: 'Rare mons appear more often',    type: 'feature' },
  { level: 10, name: 'Double Tomato',  desc: 'Throw 2 tomatoes per encounter', type: 'item'    },
  { level: 15, name: 'Golden Tomato',  desc: 'Guarantees the next catch',      type: 'item'    },
  { level: 18, name: 'XP Share',       desc: 'Benched mons earn 25% XP too',   type: 'feature' },
  { level: 20, name: 'Mega Tomato',    desc: '+50% catch rate for 3 sessions', type: 'item'    },
  { level: 25, name: 'Mon Radar',      desc: 'Preview the next encounter',     type: 'feature' },
  { level: 30, name: 'Lucky Egg',      desc: 'Double player XP for 24 hrs',   type: 'item'    },
  { level: 35, name: 'Shiny Stone',    desc: 'Force shiny on next encounter',  type: 'item'    },
  { level: 40, name: 'Custom Timer',   desc: 'Set custom break durations',     type: 'feature' },
  { level: 50, name: 'Master Trainer', desc: 'Title + gold companion border',  type: 'style'   },
  { level: 60, name: 'Evo Boost',      desc: 'Mons evolve 25% faster',         type: 'feature' },
  { level: 75, name: 'Legend Radar',   desc: 'Legendary mons can now appear',  type: 'feature' },
  { level:100, name: 'Pomomon Master', desc: 'Prestige mode unlocked',         type: 'style'   },
];

// ── Screen switching ──────────────────────────────────────
const screens = document.querySelectorAll('.screen');

function showScreen(name) {
  screens.forEach(s => s.classList.toggle('active', s.id === `screen-${name}`));
  if (name === 'mymons')   Collection.renderMyMons();
  if (name === 'dex')      Collection.renderDex();
  if (name === 'progress') renderProgress();
  // Blender is only visible on My Mons
  const blenderZone = document.getElementById('blender-zone');
  if (blenderZone && name !== 'mymons') blenderZone.classList.remove('active');
}

// ── Progress / reward dot ─────────────────────────────────
function updateRewardDot() {
  const playerLevel = parseInt(localStorage.getItem('pm_level') || '1', 10);
  const claimed     = JSON.parse(localStorage.getItem('pm_claimed_rewards') || '[]');
  const hasUnclaimed = LEVEL_REWARDS.some(r => r.level <= playerLevel && !claimed.includes(r.level));
  const dot = document.getElementById('reward-dot');
  if (dot) dot.classList.toggle('visible', hasUnclaimed);
}

function renderProgress() {
  const playerLevel = parseInt(localStorage.getItem('pm_level') || '1', 10);
  const claimed     = JSON.parse(localStorage.getItem('pm_claimed_rewards') || '[]');
  const list = document.getElementById('progress-list');
  list.innerHTML = '';
  let nextGoalAssigned = false;

  LEVEL_REWARDS.forEach(reward => {
    const unlocked  = playerLevel >= reward.level;
    const isClaimed = claimed.includes(reward.level);
    const isNext    = !unlocked && !nextGoalAssigned;
    if (isNext) nextGoalAssigned = true;

    const row = document.createElement('div');
    const tagClass = 'progress-tag progress-tag-' + reward.type;

    if (unlocked && !isClaimed) {
      // Unclaimed reward — highlight and show claim button
      row.className = 'progress-row unlocked claimable';
      row.innerHTML =
        `<span class="progress-status next">★</span>` +
        `<span class="progress-lvl">LV.${String(reward.level).padStart(2, '0')}</span>` +
        `<div class="progress-info">` +
          `<span class="progress-name">${reward.name}</span>` +
          `<span class="progress-desc">${reward.desc}</span>` +
        `</div>` +
        `<button class="btn-claim" data-level="${reward.level}">CLAIM</button>`;
    } else if (unlocked && isClaimed) {
      row.className = 'progress-row unlocked';
      row.innerHTML =
        `<span class="progress-status unlocked">✓</span>` +
        `<span class="progress-lvl">LV.${String(reward.level).padStart(2, '0')}</span>` +
        `<div class="progress-info">` +
          `<span class="progress-name">${reward.name}</span>` +
          `<span class="progress-desc">${reward.desc}</span>` +
        `</div>` +
        `<span class="${tagClass}">${reward.type.toUpperCase()}</span>`;
    } else {
      row.className = 'progress-row' + (isNext ? ' next-goal' : ' locked');
      const statusIcon  = isNext ? '▶' : '—';
      const statusClass = 'progress-status ' + (isNext ? 'next' : 'locked');
      row.innerHTML =
        `<span class="${statusClass}">${statusIcon}</span>` +
        `<span class="progress-lvl">LV.${String(reward.level).padStart(2, '0')}</span>` +
        `<div class="progress-info">` +
          `<span class="progress-name">${reward.name}</span>` +
          `<span class="progress-desc">${reward.desc}</span>` +
        `</div>` +
        `<span class="${tagClass}">${reward.type.toUpperCase()}</span>`;
    }

    list.appendChild(row);
  });

  updateRewardDot();
}

// ── Timer state ───────────────────────────────────────────
const MODES = {
  focus: 3,        // ⚠ TESTING: 3 s (restore to 25 * 60)
  short: 5  * 60,
  long:  15 * 60,
};

let focusMins   = 25;
const MIN_FOCUS = 1, MAX_FOCUS = 90; // ⚠ TESTING: MIN_FOCUS 1 (restore to 5)

let currentMode   = 'focus';
let timeLeft      = MODES.focus;
let running       = false;
let intervalId    = null;
let endTime       = 0;   // wall-clock ms when the current run should finish
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

const MODE_LABELS = { focus: 'FOCUS', short: 'SHORT BREAK', long: 'LONG BREAK' };

// ── Background state ──────────────────────────────────────
// Only two visual states: red (running focus) or teal (everything else)
function updateBackground() {
  document.body.classList.toggle('run-focus', running && currentMode === 'focus');
}

function renderTime() {
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  elMinutes.textContent = mm;
  elSeconds.textContent = ss;
  document.title = running ? `${mm}:${ss} — PomoMons` : 'PomoMons';
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
  if (el('stat-minutes'))  el('stat-minutes').textContent  = minutes;
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

function timerTick() {
  const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
  if (remaining !== timeLeft) {
    timeLeft = remaining;
    renderTime();
  }
  if (timeLeft <= 0) onSessionEnd();
}

function startTimer() {
  if (running) return;
  running = true;
  endTime = Date.now() + timeLeft * 1000;
  SFX.play('start');
  elColon.style.animationPlayState = 'running';
  updateBackground();
  updateButtonStates();
  renderTime();
  intervalId = setInterval(timerTick, 1000);
}

function pauseTimer() {
  if (!running) return;
  timeLeft = Math.max(0, Math.round((endTime - Date.now()) / 1000));
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
      // Award pal XP after encounter resolves; trigger evolution screen if needed
      const activeId = parseInt(localStorage.getItem('pm_active') || '0', 10);
      const palResult = activeId ? savePalExp(activeId, 25) : null;

      if (palResult && palResult.evolved && typeof EvolutionScreen !== 'undefined') {
        EvolutionScreen.start(palResult, () => {
          CompanionCanvas.init(document.getElementById('companion-canvas'));
          setMode(nextMode);
        });
      } else {
        CompanionCanvas.init(document.getElementById('companion-canvas'));
        setMode(nextMode);
      }
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
  // companion-level is set by updateCompanionDisplay(), not here
}

// ── Pal (companion) level system ──────────────────────────
// Uses an exponential curve tuned so the first evolution (~lvl 16)
// takes roughly 50-60 sessions — achievable within a few weeks of use.
function palExpThreshold(level) {
  return Math.round(30 * Math.pow(1.3, level - 1));
}

function getPalState() {
  const level = parseInt(localStorage.getItem('pm_active_pal_level') || '1', 10);
  const exp   = parseInt(localStorage.getItem('pm_active_pal_exp')   || '0', 10);
  return { level, exp };
}

// Award XP to the active companion's record. Returns an object describing
// any level-up or evolution that occurred, or null if no active companion.
function savePalExp(speciesId, delta) {
  if (!speciesId || typeof MONS === 'undefined') return null;
  const mon = MONS.find(m => m.id === speciesId);
  if (!mon) return null;

  const PAL_MAX = 100;
  let { level, exp } = getPalState();

  const fromMon = typeof getMonStage === 'function' ? getMonStage(mon, level) : mon;

  exp += delta;
  let leveled = false;
  while (exp >= palExpThreshold(level) && level < PAL_MAX) {
    exp -= palExpThreshold(level);
    level++;
    leveled = true;
  }
  if (level >= PAL_MAX) exp = 0;

  localStorage.setItem('pm_active_pal_level', level);
  localStorage.setItem('pm_active_pal_exp',   exp);

  // On level-up, persist the new level to the IDB record
  if (leveled && typeof Collection !== 'undefined' && Collection.updateActivePalLevel) {
    Collection.updateActivePalLevel(level);
  }

  const toMon  = typeof getMonStage === 'function' ? getMonStage(mon, level) : mon;
  const evolved = fromMon.name !== toMon.name;

  updateCompanionDisplay();
  return { leveled, evolved, fromMon, toMon, newLevel: level };
}

// Refresh the companion area (name, pal level, canvas colours) from localStorage.
// Called after any change to the active companion or its pal level.
function updateCompanionDisplay() {
  const activeId = parseInt(localStorage.getItem('pm_active') || '0', 10);
  if (!activeId || typeof MONS === 'undefined') return;
  const mon = MONS.find(m => m.id === activeId);
  if (!mon) return;
  const level = parseInt(localStorage.getItem('pm_active_pal_level') || '1', 10);
  const shiny = localStorage.getItem('pm_active_shiny') === '1';
  const stage = typeof getMonStage === 'function' ? getMonStage(mon, level) : mon;
  const nameEl = document.getElementById('companion-name');
  const lvlEl  = document.getElementById('companion-level');
  if (nameEl) nameEl.textContent = stage.name;
  if (lvlEl)  lvlEl.textContent  = level;
  if (typeof CompanionCanvas !== 'undefined') CompanionCanvas.setMon({ ...stage, shiny });
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

  if (levelled) {
    showLevelUpBanner(level);
    updateRewardDot();
  }
}

function showLevelUpBanner(level) {
  SFX.play('levelUp');
  const hasReward = LEVEL_REWARDS.some(r => r.level === level);
  const banner = document.createElement('div');
  banner.className = 'level-up-banner';
  banner.innerHTML  = `LEVEL UP! LVL ${level}` +
    (hasReward ? `<span class="banner-sub">★ NEW REWARD — CHECK PROGRESS MAP</span>` : '');
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), hasReward ? 3000 : 2200);
}

// ── Boot ──────────────────────────────────────────────────
loadPlayerState();
renderStats();
document.body.dataset.mode = currentMode;
Collection.init();

// Navigation
document.getElementById('btn-go-mymons').addEventListener('click', () => showScreen('mymons'));
document.getElementById('btn-go-dex').addEventListener('click',    () => showScreen('dex'));
document.getElementById('btn-back-mymons').addEventListener('click',  () => showScreen('timer'));
document.getElementById('btn-back-dex').addEventListener('click',     () => showScreen('timer'));
document.getElementById('btn-back-progress').addEventListener('click', () => showScreen('timer'));
document.getElementById('btn-map-icon').addEventListener('click', () => showScreen('progress'));

// Claim reward delegation
document.getElementById('progress-list').addEventListener('click', e => {
  const btn = e.target.closest('.btn-claim');
  if (!btn) return;
  const level   = parseInt(btn.dataset.level, 10);
  const claimed = JSON.parse(localStorage.getItem('pm_claimed_rewards') || '[]');
  if (!claimed.includes(level)) {
    claimed.push(level);
    localStorage.setItem('pm_claimed_rewards', JSON.stringify(claimed));
  }
  renderProgress();
});

// Sync timer when tab becomes visible again after being hidden
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && running) {
    timeLeft = Math.max(0, Math.round((endTime - Date.now()) / 1000));
    renderTime();
    if (timeLeft <= 0) onSessionEnd();
  }
});

// Audio toggle
const btnAudio = document.getElementById('btn-audio');
btnAudio.addEventListener('click', () => {
  const muted = SFX.toggle();
  document.getElementById('audio-waves').style.display = muted ? 'none' : '';
  document.getElementById('audio-mute').style.display  = muted ? ''     : 'none';
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

// Restore active companion (name, pal level, evolved sprite colours)
updateCompanionDisplay();
updateRewardDot();
MapIcon.draw(document.getElementById('map-icon-canvas'));

renderTime();
renderDots();
updateBackground();
updateButtonStates();
elColon.style.animationPlayState = 'paused';
elColon.style.opacity = '1';
CompanionCanvas.init(document.getElementById('companion-canvas'));
