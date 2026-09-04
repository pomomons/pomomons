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
  // The timer screen can only be measured while it's the visible one — a
  // display:none screen has no height to fit against. (See fitTimerScreen.)
  if (name === 'timer') fitTimerScreen();
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
// ── TESTING ONLY — short-circuit session durations ────────
// Set to a number of seconds (e.g. 5) to make sessions fire almost
// immediately; null uses the normal minute-based durations.
// Note: while these are set, the ▲▼ steppers are inert — setCurrentModeMins()
// also routes through these helpers. Always return them to null before shipping.
const TEST_FOCUS_SECS = null;
const TEST_BREAK_SECS = null;
const focusSecs = () => TEST_FOCUS_SECS ?? focusMins * 60;
const shortSecs = () => TEST_BREAK_SECS ?? shortMins * 60;
const longSecs  = () => TEST_BREAK_SECS ?? longMins  * 60;

MODES.focus = focusSecs();
MODES.short = shortSecs();
MODES.long  = longSecs();

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
    MODES.short = shortSecs();
    localStorage.setItem('pm_short_mins', shortMins);
  } else {
    longMins    = clampMins(val, MIN_BREAK, MAX_BREAK);
    MODES.long  = longSecs();
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

// ── Session-end signal that outlasts the alarm ────────────
// SFX.play('sessionEnd') is gone the instant it finishes, so someone who
// stepped away, muted the tab, or had the volume down comes back to no sign
// anything happened. These three things fix that: a desktop notification, a
// tab title that stays changed until you act, and an optional auto-start.

// Parked on the tab title by onSessionEnd(); renderTime() shows it whenever
// the timer is stopped, in place of the plain 'PomoMons', until the next
// timer starts or the player picks a mode by hand.
let titleOverride = null;

const Notify = {
  supported: 'Notification' in window,
  icon: 'assets/sprites/Tomato/Tomato.png',
  // Permission is never requested on page load — only the first time a
  // session actually ends, which is the moment it's obviously wanted.
  async fire(title, body) {
    if (!this.supported) return;
    if (Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch (_) { /* legacy callback API */ }
    }
    if (Notification.permission !== 'granted') return;
    try {
      const n = new Notification(title, { body, icon: this.icon, tag: 'pomomons-session' });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (_) { /* some browsers require a service worker and throw here */ }
  },
};

const AUTOSTART_KEY = 'pm_autostart';
function autoStartEnabled() { return localStorage.getItem(AUTOSTART_KEY) === '1'; }

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
  document.title = running       ? `${mm}:${ss} — PomoMons`
                 : titleOverride ? titleOverride
                 :                 'PomoMons';
}

// ── Stats scope: all-time totals vs. today only ────────────
// Each stat is written twice — a lifetime total (pm_total_*) and a per-day
// bucket (pm_today_*) stamped with the local date it belongs to. The bucket is
// zeroed lazily on the first read or write after the date rolls over, so there
// is no midnight timer to keep alive: simply opening the app the next day (or
// finishing a session past midnight) is enough to start the new day at zero.
const STAT_KINDS = ['sessions', 'minutes', 'catches'];

// Local date, not UTC — "today" has to mean the player's today.
function todayStamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function rollDayIfNeeded() {
  const stamp = todayStamp();
  if (localStorage.getItem('pm_today_date') === stamp) return;
  localStorage.setItem('pm_today_date', stamp);
  STAT_KINDS.forEach(k => localStorage.setItem('pm_today_' + k, '0'));
}

// The single entry point for changing a stat, so the lifetime total and
// today's bucket can never drift apart.
function addStat(kind, delta) {
  rollDayIfNeeded();
  for (const key of ['pm_total_' + kind, 'pm_today_' + kind]) {
    localStorage.setItem(key, parseInt(localStorage.getItem(key) || '0', 10) + delta);
  }
}

// Which set the strip is showing. Defaults to 'total' — the behaviour the
// strip has always had — so nothing changes for an existing player until they
// press the button.
let statsScope = localStorage.getItem('pm_stats_scope') === 'today' ? 'today' : 'total';

function renderStats() {
  rollDayIfNeeded();
  const prefix = statsScope === 'today' ? 'pm_today_' : 'pm_total_';
  const read = kind => parseInt(localStorage.getItem(prefix + kind) || '0', 10);
  const el = id => document.getElementById(id);
  if (el('stat-sessions')) el('stat-sessions').textContent = read('sessions');
  if (el('stat-minutes'))  el('stat-minutes').textContent  = read('minutes');
  if (el('stat-catches'))  el('stat-catches').textContent  = read('catches');
  const scopeBtn = el('btn-stats-scope');
  if (scopeBtn) {
    // Only the visible span — the button also holds the hidden width-setting
    // twin, which textContent would wipe out.
    el('stats-scope-val').textContent = statsScope === 'today' ? 'TODAY' : 'ALL TIME';
    // Tells a screen reader which set is showing, and what pressing it does.
    scopeBtn.setAttribute('aria-label',
      statsScope === 'today' ? "Showing today's stats — switch to all time"
                             : 'Showing all-time stats — switch to today');
    scopeBtn.title = statsScope === 'today' ? 'Showing today — tap for all time'
                                            : 'Showing all time — tap for today';
  }
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
  titleOverride = null;
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
  titleOverride = null;
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
    // Signal that survives the alarm: title stays changed until the break is
    // started (or a mode is picked by hand); notification reaches a stepped-
    // away player. setMode(nextMode) below never touches titleOverride.
    titleOverride = 'Break time! — PomoMons';
    Notify.fire('Focus session complete', 'Nice work — time for a break. A wild Pomomon showed up.');
    // Update persistent stats (lifetime + today, see addStat)
    addStat('sessions', 1);
    addStat('minutes',  focusMins);
    // Pageviews alone can't tell a finished session from a tab left open.
    if (typeof Signup !== 'undefined') Signup.event('session-complete');
    renderStats();
    CompanionCanvas.stop();
    EncounterScreen.start(() => {
      // Award pal XP after encounter resolves; trigger evolution screen if needed
      const activeId = parseInt(localStorage.getItem('pm_active') || '0', 10);
      const palResult = activeId ? savePalExp(activeId, 25) : null;

      // The mailing-list card is offered here, once the encounter (and any
      // evolution) has played out and we're back on the timer screen — not
      // mid-celebration. Signup decides whether it's earned and whether it
      // has been asked too often already.
      const backOnTimer = () => {
        CompanionCanvas.init(document.getElementById('companion-canvas'));
        setMode(nextMode);
        if (autoStartEnabled()) startTimer();
        if (typeof Signup !== 'undefined') Signup.maybePrompt();
      };

      if (palResult && palResult.evolved && typeof EvolutionScreen !== 'undefined') {
        EvolutionScreen.start(palResult, backOnTimer);
      } else {
        backOnTimer();
      }
    });
    return;
  }

  // Break ended — go back to a focus session, cued up at its full duration and
  // waiting to be started. The break's own duration used to be reloaded here
  // and the mode left where it was, so the next thing the player saw was
  // another break: they had to reach for the mode dropdown every cycle to get
  // back to work. setMode() moves the label, the dropdown's ticked row, the
  // clock and the buttons together, and leaves it stopped unless the player
  // opted into auto-start.
  titleOverride = 'Back to work! — PomoMons';
  Notify.fire('Break over', 'Back to it — start your next focus session.');
  setMode('focus');
  if (autoStartEnabled()) startTimer();
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
    titleOverride = null;
    setMode(opt.dataset.mode);
    modeDropdown.hidden = true;
  });
});

document.addEventListener('click', () => { modeDropdown.hidden = true; });

// ── Settings menu ─────────────────────────────────────────
// Same fixed-position-under-the-button pattern as the mode dropdown, but
// right-aligned to the gear since it sits at the header's right edge.
const btnSettings  = document.getElementById('btn-settings');
const settingsMenu = document.getElementById('settings-menu');

function positionSettingsMenu() {
  const r = btnSettings.getBoundingClientRect();
  settingsMenu.style.top   = (r.bottom + 6) + 'px';
  settingsMenu.style.left  = 'auto';
  settingsMenu.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
}

function closeSettingsMenu() {
  if (settingsMenu.hidden) return;
  settingsMenu.hidden = true;
  btnSettings.setAttribute('aria-expanded', 'false');
}

if (btnSettings && settingsMenu) {
  btnSettings.addEventListener('click', e => {
    e.stopPropagation();
    modeDropdown.hidden = true;
    const opening = settingsMenu.hidden;
    if (opening) positionSettingsMenu();
    settingsMenu.hidden = !opening;
    btnSettings.setAttribute('aria-expanded', String(opening));
  });
  // Clicks inside the menu (sound toggle, Discord link) keep it open; the
  // signup button opens its own modal, so let that one close the menu.
  settingsMenu.addEventListener('click', e => {
    if (e.target.closest('#btn-signup')) closeSettingsMenu();
    else e.stopPropagation();
  });
  window.addEventListener('resize', () => { if (!settingsMenu.hidden) positionSettingsMenu(); });
  document.addEventListener('click', closeSettingsMenu);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSettingsMenu(); });
}

// ── Controls ──────────────────────────────────────────────
btnStart.addEventListener('click', () => running ? pauseTimer() : startTimer());
btnReset.addEventListener('click', resetTimer);

// Auto-start toggle: remembered across visits, off until the player asks.
const autostartToggle = document.getElementById('toggle-autostart');
if (autostartToggle) {
  autostartToggle.checked = autoStartEnabled();
  autostartToggle.addEventListener('change', () => {
    localStorage.setItem(AUTOSTART_KEY, autostartToggle.checked ? '1' : '0');
    SFX.play('click');
  });
}

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
      // No companion yet: the rotating silhouette teaser stands on its own,
      // no caption. (The "how to catch" explainer lives in the ? popup.)
      nameEl.textContent = '';
      nameEl.classList.remove('is-prompt');
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
    localStorage.setItem('pm_today_catches', '0');
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

// Stats strip: swap the three tiles between all-time totals and today only.
document.getElementById('btn-stats-scope')?.addEventListener('click', () => {
  statsScope = statsScope === 'today' ? 'total' : 'today';
  localStorage.setItem('pm_stats_scope', statsScope);
  SFX.play('click');
  renderStats();
});

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
document.getElementById('btn-spawn-help')?.addEventListener('click', () => {
  // Fill in the "how it works" line with the player's actual focus length.
  const intro = document.getElementById('spawn-info-intro');
  if (intro) intro.textContent =
    `COMPLETE A ${focusMins}-MINUTE FOCUS SESSION AND A WILD POMOMON MAY APPEAR.`;
  spawnInfo?.classList.add('active');
});
document.getElementById('btn-spawn-info-close')?.addEventListener('click', () => spawnInfo?.classList.remove('active'));
spawnInfo?.addEventListener('click', e => { if (e.target === spawnInfo) spawnInfo.classList.remove('active'); });

// Audio toggle — lives in the settings menu now; icon swaps waves↔X and the
// row label reads the current state.
function renderAudioIcon(muted) {
  document.getElementById('audio-waves').style.display = muted ? 'none' : '';
  document.getElementById('audio-mute').style.display  = muted ? ''     : 'none';
  const label = document.getElementById('audio-label');
  if (label) label.textContent = muted ? 'Sound off' : 'Sound on';
  btnAudio.setAttribute('aria-checked', String(!muted));
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

// ── Timer screen fit ──────────────────────────────────────
// The two panels hold their natural height on purpose (see the "neither one
// flexes" comment in style-v3.css: letting them shrink clipped the timer
// panel's bottom border and the grass platform), so anything that doesn't
// fit became a scroll in the middle of the screen — with the scrollbar
// hidden, which is what made it feel like the middle was drifting on its own
// while the logo and the strip stayed put.
//
// The fluid tier in style-v3.css already trims spacing to claw that back,
// but it was tuned to *just* fit: at 807px tall the screen clears its box by
// about a pixel, and it still overflows between 941-949px, around 765-790px,
// and everywhere under ~710px. These two steps close the gap for good.
const timerScreen = document.getElementById('screen-timer');
const statsStrip  = document.querySelector('.stats-strip');

// Step 1 — reserve the room the strip actually takes, not the worst case.
// --stats-h has to cover the strip wrapped to two rows, so on a desktop
// window it holds back ~150px above an 80px strip. Both parts of the real
// figure have to be measured: the height is content-driven (the tiles wrap
// under 820px wide) and the strip floats clear of the bottom bezel rather
// than sitting on the viewport edge.
function updateStatsReserve() {
  if (!statsStrip) return;
  const r = statsStrip.getBoundingClientRect();
  if (!r.height) return;                       // hidden / not laid out yet
  const gapBelow = window.innerHeight - r.bottom;
  document.documentElement.style.setProperty(
    '--stats-reserve', Math.ceil(r.height + gapBelow + 8) + 'px');
}

// Step 2 — if the panels still don't fit, scale the whole screen down by
// exactly the shortfall. zoom, unlike transform: scale, is part of layout:
// the screen's own box shrinks with its contents, so nothing is left half
// scrolled and the strip and logo stay exactly where they are.
function fitTimerScreen() {
  updateStatsReserve();
  if (!timerScreen || !timerScreen.classList.contains('active')) return;

  timerScreen.style.setProperty('--timer-fit', '1');

  // Settle rather than solve in one shot. clientHeight and scrollHeight are
  // both rounded to whole pixels, and zooming re-runs the layout underneath
  // the numbers the ratio was derived from, so a single pass can land a
  // pixel or two short. Three passes is comfortably enough to converge; the
  // 2px tolerance keeps an exact fit from triggering a pointless 0.998.
  let fit = 1;
  for (let pass = 0; pass < 3; pass++) {
    const available = timerScreen.clientHeight;  // reading this forces reflow
    const needed    = timerScreen.scrollHeight;
    if (!(available > 0) || needed <= available + 2) break;
    fit *= (available - 2) / needed;
    timerScreen.style.setProperty('--timer-fit', fit);
  }
}

window.addEventListener('resize', fitTimerScreen);
// The pixel font lands after first paint and every panel is sized in it.
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTimerScreen);
// The strip changes height on its own — the tiles wrap, and the LV badge and
// XP numbers grow a digit as the player levels.
if (window.ResizeObserver && statsStrip) new ResizeObserver(fitTimerScreen).observe(statsStrip);

fitTimerScreen();
