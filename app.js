// app.js — timer logic and session/screen flow

// NOTE: The level-rewards / missions-map system was removed for launch
// (see git history for LEVEL_REWARDS, renderProgress, updateRewardDot).
// Leveling currently grants nothing beyond the level number itself.

// ── Screen switching ──────────────────────────────────────
const screens = document.querySelectorAll('.screen');

function showScreen(name) {
  screens.forEach(s => s.classList.toggle('active', s.id === `screen-${name}`));
  if (name === 'mymons')   Collection.renderMyMons();
  if (name === 'dex')      Collection.renderDex();
  // Blender is only visible on My Mons
  const blenderZone = document.getElementById('blender-zone');
  if (blenderZone && name !== 'mymons') blenderZone.classList.remove('active');
}

// ── Timer state ───────────────────────────────────────────
const MODES = {
  focus: 30 * 60,
  short: 5  * 60,
  long:  15 * 60,
};

const MIN_FOCUS = 20, MAX_FOCUS = 90;  // focus sessions: 20–90 min
const MIN_BREAK = 1,  MAX_BREAK = 90;  // breaks: freely adjustable

// Per-mode durations persist across sessions
const clampMins = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
let focusMins = clampMins(parseInt(localStorage.getItem('pm_focus_mins') || '30', 10) || 30, MIN_FOCUS, MAX_FOCUS);
let shortMins = clampMins(parseInt(localStorage.getItem('pm_short_mins') || '5',  10) || 5,  MIN_BREAK, MAX_BREAK);
let longMins  = clampMins(parseInt(localStorage.getItem('pm_long_mins')  || '15', 10) || 15, MIN_BREAK, MAX_BREAK);
// ── TESTING ONLY — short-circuit focus sessions ───────────
// Set to a number of seconds (e.g. 3) to make focus sessions fire almost
// immediately; null uses the normal minute-based durations.
const TEST_FOCUS_SECS = null;
const focusSecs = () => TEST_FOCUS_SECS ?? focusMins * 60;

MODES.focus = focusSecs();
MODES.short = shortMins * 60;
MODES.long  = longMins  * 60;

function currentModeMins() {
  return currentMode === 'focus' ? focusMins
       : currentMode === 'short' ? shortMins : longMins;
}

// Clamp + persist + apply a new duration for the currently selected mode.
// The ▲▼ steppers and click-to-edit adjust whichever mode is showing.
function setCurrentModeMins(val) {
  if (isNaN(val)) return;
  if (currentMode === 'focus') {
    focusMins   = clampMins(val, MIN_FOCUS, MAX_FOCUS);
    MODES.focus = focusSecs();
    localStorage.setItem('pm_focus_mins', focusMins);
  } else if (currentMode === 'short') {
    shortMins   = clampMins(val, MIN_BREAK, MAX_BREAK);
    MODES.short = shortMins * 60;
    localStorage.setItem('pm_short_mins', shortMins);
  } else {
    longMins    = clampMins(val, MIN_BREAK, MAX_BREAK);
    MODES.long  = longMins * 60;
    localStorage.setItem('pm_long_mins', longMins);
  }
  setMode(currentMode);
}

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

const MODE_LABELS = { focus: 'FOCUS SESSION', short: 'SHORT BREAK', long: 'LONG BREAK' };

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
  // Icon in its own span so the button can flex-centre it against the label
  // with a controlled gap — the ▶ / ⏸ glyphs fall back to a non-pixel font
  // and their wide advance threw the plain "▶ START" string off-centre.
  btnStart.innerHTML = running
    ? '<span class="btn-ico">⏸</span>PAUSE'
    : '<span class="btn-ico">▶</span>START';
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
  // Label and caret are separate spans so the caret can be pinned to the
  // button's right edge while the label stays centred. MODE_LABELS is a fixed
  // constant, so there is nothing user-supplied going through innerHTML here.
  btnMode.innerHTML =
    `<span class="mode-label">${MODE_LABELS[mode]}</span><span class="mode-caret">▼</span>`;
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
function positionModeDropdown() {
  const r = btnMode.getBoundingClientRect();
  modeDropdown.style.top  = (r.bottom + 6) + 'px';
  modeDropdown.style.left = r.left + 'px';
  modeDropdown.style.width = r.width + 'px';
}

btnMode.addEventListener('click', e => {
  e.stopPropagation();
  const opening = modeDropdown.hidden;
  if (opening) positionModeDropdown();
  modeDropdown.hidden = !opening;
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
  // Linear curve: 100, 150, 200, ... — keeps every reward level reachable.
  return 100 + 50 * (level - 1);
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
// Round an XP cost to a readable step that grows with its magnitude, so the
// player sees 1,600 rather than 1,637.
function roundNiceXp(n) {
  if (n < 100)    return Math.round(n / 5) * 5;
  if (n < 500)    return Math.round(n / 10) * 10;
  if (n < 2000)   return Math.round(n / 50) * 50;
  if (n < 10000)  return Math.round(n / 100) * 100;
  if (n < 100000) return Math.round(n / 1000) * 1000;
  return Math.round(n / 10000) * 10000;
}

// Growth is 1.12x per level. The original 1.3x compounded so hard that the
// level-36 evolution cost 291,836 XP — about 50,000 focus sessions, or three
// years of solid focusing, so nobody would ever have seen a final form.
// At 1.12x and 25 XP/session: evolution at lv20 ~87 sessions, lv36 ~580.
function palExpThreshold(level) {
  return roundNiceXp(30 * Math.pow(1.12, level - 1));
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
  if (!activeId || typeof MONS === 'undefined') {
    const nameEl = document.getElementById('companion-name');
    const metaEl = document.querySelector('.companion-meta');
    if (nameEl) {
      nameEl.textContent = 'focus to catch a mon!';
      // The prompt wraps to two lines where a mon's name is one, so it needs
      // its own placement clear of the "?" placeholder underneath.
      nameEl.classList.add('is-prompt');
    }
    if (metaEl) metaEl.style.visibility = 'hidden';
    if (typeof CompanionCanvas !== 'undefined') CompanionCanvas.clearMon();
    return;
  }
  const nameElActive = document.getElementById('companion-name');
  if (nameElActive) nameElActive.classList.remove('is-prompt');
  const mon = MONS.find(m => m.id === activeId);
  if (!mon) return;
  document.querySelector('.companion-meta').style.visibility = '';
  const level = parseInt(localStorage.getItem('pm_active_pal_level') || '1', 10);
  const shiny = localStorage.getItem('pm_active_shiny') === '1';
  const dark  = localStorage.getItem('pm_active_dark') === '1';
  const stage = typeof getMonStage === 'function' ? getMonStage(mon, level) : mon;
  const nameEl = document.getElementById('companion-name');
  const lvlEl  = document.getElementById('companion-level');
  if (nameEl) nameEl.textContent = stage.name;
  if (lvlEl)  lvlEl.textContent  = level;

  // XP toward the next pal level — mirrors the player's readout in the stats
  // strip. savePalExp() calls back here, so the bar updates on every gain.
  const exp    = parseInt(localStorage.getItem('pm_active_pal_exp') || '0', 10);
  const needed = palExpThreshold(level);
  const curEl  = document.getElementById('companion-xp-cur');
  const maxEl  = document.getElementById('companion-xp-max');
  const barEl  = document.getElementById('companion-xp-bar');
  if (curEl) curEl.textContent = exp;
  if (maxEl) maxEl.textContent = needed;
  if (barEl) barEl.style.width = Math.max(0, Math.min(100, (exp / needed) * 100)) + '%';

  if (typeof CompanionCanvas !== 'undefined') CompanionCanvas.setMon({ ...stage, shiny, dark });
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
  banner.className = 'level-up-banner';
  banner.textContent = `LEVEL UP! LV ${level}`;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 2200);
}

// ── Boot ──────────────────────────────────────────────────
// Ask the browser to protect our storage (IndexedDB collection + localStorage)
// from automatic eviction under disk pressure. Best-effort; safe to ignore failure.
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

loadPlayerState();
renderStats();
document.body.dataset.mode = currentMode;
Collection.init().then(async () => {
  // One-time cleanup: earlier builds auto-seeded the whole roster into IndexedDB
  // on every load. Wipe those leftover records once so the collection starts empty.
  if (!localStorage.getItem('pm_seed_purged')) {
    await Collection.clearAll();
    ['pm_active', 'pm_active_rec_key', 'pm_active_pal_level', 'pm_active_pal_exp',
     'pm_active_shiny', 'pm_active_dark'].forEach(k => localStorage.removeItem(k));
    localStorage.setItem('pm_total_catches', '0');
    localStorage.setItem('pm_seed_purged', '1');
    if (typeof updateCompanionDisplay === 'function') updateCompanionDisplay();
    if (typeof renderStats === 'function') renderStats();
  }
});

// Navigation
document.getElementById('btn-go-mymons').addEventListener('click', () => showScreen('mymons'));
document.getElementById('btn-companion-level')?.addEventListener('click', () => {
  if (typeof Collection !== 'undefined') Collection.openActiveMonDetail();
});
document.getElementById('btn-back-mymons').addEventListener('click',  () => showScreen('timer'));
document.getElementById('btn-back-dex').addEventListener('click',     () => showScreen('timer'));
document.getElementById('btn-to-dex').addEventListener('click',    () => showScreen('dex'));
document.getElementById('btn-to-mymons').addEventListener('click', () => showScreen('mymons'));

// Sync timer when tab becomes visible again after being hidden
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && running) {
    timeLeft = Math.max(0, Math.round((endTime - Date.now()) / 1000));
    renderTime();
    if (timeLeft <= 0) onSessionEnd();
  }
});

// Spawn-rate info modal
const spawnInfo = document.getElementById('spawn-info');
document.getElementById('btn-spawn-help')?.addEventListener('click', () => spawnInfo?.classList.add('active'));
document.getElementById('btn-spawn-info-close')?.addEventListener('click', () => spawnInfo?.classList.remove('active'));
spawnInfo?.addEventListener('click', e => { if (e.target === spawnInfo) spawnInfo.classList.remove('active'); });

// Audio toggle
function renderAudioIcon(muted) {
  document.getElementById('audio-waves').style.display = muted ? 'none' : '';
  document.getElementById('audio-mute').style.display  = muted ? ''     : 'none';
}
const btnAudio = document.getElementById('btn-audio');
btnAudio.addEventListener('click', () => renderAudioIcon(SFX.toggle()));
renderAudioIcon(SFX.isMuted()); // restore persisted mute state on load

// Time adjust — applies to whichever mode is currently selected
document.getElementById('btn-time-minus').addEventListener('click', () => {
  if (running) return;
  setCurrentModeMins(currentModeMins() - 1);
});

document.getElementById('btn-time-plus').addEventListener('click', () => {
  if (running) return;
  setCurrentModeMins(currentModeMins() + 1);
});

// Click-to-edit timer minutes (edits the currently selected mode)
elMinutes.addEventListener('click', () => {
  if (running) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentModeMins();
  input.maxLength = 2;
  input.className = 'timer-edit-input';
  elMinutes.textContent = '';
  elMinutes.appendChild(input);
  input.focus();
  input.select();

  function commit() {
    const val = parseInt(input.value, 10);
    if (!isNaN(val)) setCurrentModeMins(val);
    elMinutes.textContent = String(currentModeMins()).padStart(2, '0');
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { input.blur(); }
    if (e.key === 'Escape') {
      input.removeEventListener('blur', commit);
      elMinutes.textContent = String(currentModeMins()).padStart(2, '0');
    }
  });
});

// Restore active companion (name, pal level, evolved sprite colours)
updateCompanionDisplay();

renderTime();
updateBackground();
updateButtonStates();
elColon.style.animationPlayState = 'paused';
elColon.style.opacity = '1';
CompanionCanvas.init(document.getElementById('companion-canvas'));
