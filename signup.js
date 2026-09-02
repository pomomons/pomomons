// signup.js — optional email capture + usage events.
//
// Nothing here ever blocks the app. The card is a fixed-position panel that
// sits above the stats strip: it takes no space in the timer screen's layout,
// so it can't push the screen over and make fitTimerScreen() (app.js) shrink
// everything to pay for it. Dismissing it is always one tap, and the envelope
// button in the header opens it again for anyone who wants back in later.
//
// Signups POST to a Google Apps Script web app, which appends a row to a
// Google Sheet. See agent_docs/email-signups.md for the script and the setup.

const Signup = (() => {

  // ── Config ──────────────────────────────────────────────
  // Paste the Apps Script deployment URL here (see agent_docs/email-signups.md).
  // While it is empty the feature stays completely dormant: no card, no
  // envelope button, nothing posted anywhere.
  const ENDPOINT = '';

  // When to offer it. Whichever comes first — a player who catches is engaged,
  // a player who only runs the timer is too, and they get there at different
  // rates.
  const AFTER_CATCHES  = 2;
  const AFTER_SESSIONS = 3;

  // Someone who closes the card is telling us something. Ask again after a
  // fortnight, and give up entirely after this many refusals.
  const REASK_AFTER_DAYS = 14;
  const MAX_PROMPTS      = 3;

  // A bot fills every field it can see and submits instantly; a person takes
  // a moment. Neither check is worth much alone, and both are backed up by
  // the same checks server-side.
  const MIN_FILL_MS = 1200;

  // ── State ───────────────────────────────────────────────
  // pm_email_state   '' | 'joined' | 'dismissed'
  // pm_email_prompts how many times the card has appeared on its own
  // pm_email_last    when it last appeared (ms)
  // pm_email_queue   submissions that failed to send, retried on next load
  const K = {
    state:   'pm_email_state',
    prompts: 'pm_email_prompts',
    last:    'pm_email_last',
    queue:   'pm_email_queue',
  };

  const get  = (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
  const set  = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
  const num  = (k) => parseInt(get(k, '0'), 10) || 0;

  let card, form, input, btnOpen, msgEl, shownAt = 0, wired = false;
  // Whatever the markup ships with — the status line falls back to it, so the
  // bar always has a second line and never changes height.
  let defaultMsg = '';

  // ── Usage events ────────────────────────────────────────
  // GoatCounter is already on the page (index.html). It counts pageviews on
  // its own; these are the things worth knowing that a pageview can't tell
  // you. Guarded because an ad blocker will stop the script from loading and
  // that must never throw.
  function event(name) {
    try {
      if (window.goatcounter && typeof window.goatcounter.count === 'function') {
        window.goatcounter.count({ path: name, title: name, event: true });
      }
    } catch (e) { /* analytics must never break the app */ }
  }

  // ── Sending ─────────────────────────────────────────────
  // Content-Type has to be text/plain: anything else makes this a "preflighted"
  // request, the browser sends an OPTIONS first, and Apps Script doesn't answer
  // OPTIONS — so the whole thing fails before the POST is ever made. text/plain
  // keeps it a simple request. The body is still JSON; the script parses it.
  async function post(payload) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const body = await res.json().catch(() => ({}));
    if (body && body.ok === false) throw new Error(body.error || 'rejected');
    return body;
  }

  // A signup that fails on a flaky connection shouldn't just evaporate — the
  // player already gave us the address and has been told it worked.
  function queue(payload) {
    let q = [];
    try { q = JSON.parse(get(K.queue, '[]')) || []; } catch (e) { q = []; }
    q.push(payload);
    set(K.queue, JSON.stringify(q.slice(-5)));
  }

  async function flushQueue() {
    if (!ENDPOINT) return;
    let q = [];
    try { q = JSON.parse(get(K.queue, '[]')) || []; } catch (e) { return; }
    if (!q.length) return;
    const left = [];
    for (const item of q) {
      try { await post(item); } catch (e) { left.push(item); }
    }
    set(K.queue, JSON.stringify(left));
  }

  // ── Card ────────────────────────────────────────────────
  // The bar is fixed-position, so on its own it would sit on top of the timer
  // screen's controls. Instead it publishes its height as --signup-reserve,
  // which #screen-timer adds to its bottom padding (style-v3.css), lifting the
  // content clear. The resize event is how app.js is asked to re-run
  // fitTimerScreen(); it already listens for it, so nothing new is coupled.
  function reserveSpace() {
    const px = card && card.classList.contains('active')
      ? Math.ceil(card.getBoundingClientRect().height) + 8
      : 0;
    document.documentElement.style.setProperty('--signup-reserve', px + 'px');
    window.dispatchEvent(new Event('resize'));
  }

  function open(source) {
    if (!card) return;
    card.classList.add('active');
    card.setAttribute('aria-hidden', 'false');
    card.dataset.source = source || 'manual';
    shownAt = Date.now();
    message('');
    if (input) input.value = '';
    reserveSpace();
  }

  function close() {
    if (!card) return;
    card.classList.remove('active');
    card.setAttribute('aria-hidden', 'true');
    reserveSpace();
  }

  function dismiss() {
    set(K.state, 'dismissed');
    close();
  }

  function message(text, kind) {
    if (!msgEl) return;
    msgEl.textContent = text || defaultMsg;
    msgEl.className = 'signup-msg' + (text && kind ? ' is-' + kind : '');
  }

  // Deliberately loose. The only thing worth rejecting here is an obvious
  // typo — anything stricter starts throwing out addresses that are perfectly
  // valid, and the address still has to survive a real send either way.
  function looksLikeEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  }

  async function submit(e) {
    e.preventDefault();
    if (!ENDPOINT) return;

    const honeypot = form.querySelector('[name="website"]');
    if (honeypot && honeypot.value) { close(); return; }   // bot: drop silently

    const email = (input.value || '').trim();
    if (!looksLikeEmail(email)) { message('That address looks off — check it?', 'err'); return; }
    if (Date.now() - shownAt < MIN_FILL_MS) { message('One moment…', 'err'); return; }

    const btn = form.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'SENDING'; }

    const payload = {
      email,
      source:   card.dataset.source || 'manual',
      sessions: num('pm_total_sessions'),
      catches:  num('pm_total_catches'),
      at:       new Date().toISOString(),
    };

    try {
      await post(payload);
    } catch (err) {
      // Already have the address; hold it and retry on the next load rather
      // than making them type it again.
      queue(payload);
    }

    set(K.state, 'joined');
    event('email-signup');
    message("You're on the list!", 'ok');
    if (btn) { btn.disabled = false; btn.textContent = 'JOIN'; }
    setTimeout(close, 1400);
  }

  // ── Auto-prompt ─────────────────────────────────────────
  function shouldPrompt() {
    if (!ENDPOINT) return false;
    // Under ~480px tall (landscape phones, tiny windows) the screen is already
    // being scaled down to fit and there is no room to reserve for the bar —
    // it would sit on the START button. The envelope button still works, so
    // this only stops it appearing uninvited.
    if (window.innerHeight < 480) return false;
    const state = get(K.state);
    if (state === 'joined') return false;
    if (num(K.prompts) >= MAX_PROMPTS) return false;
    if (state === 'dismissed') {
      const days = (Date.now() - num(K.last)) / 86400000;
      if (days < REASK_AFTER_DAYS) return false;
    }
    return num('pm_total_catches')  >= AFTER_CATCHES
        || num('pm_total_sessions') >= AFTER_SESSIONS;
  }

  // Only ever on the timer screen with nothing else up — the card must not
  // land on top of an encounter, a catch card or the evolution sequence.
  function screenIsClear() {
    const timer = document.getElementById('screen-timer');
    if (!timer || !timer.classList.contains('active')) return false;
    return !document.querySelector(
      '.encounter-overlay.active, .catch-overlay.active, .mon-info-overlay.active, ' +
      '.mon-detail-overlay.active, .evolution-overlay.active, .spawn-info.active'
    );
  }

  // Called after the things that make someone worth asking. Waits for a calm
  // moment rather than interrupting whatever just happened.
  function maybePrompt() {
    if (!shouldPrompt()) return;
    setTimeout(() => {
      if (!shouldPrompt() || !screenIsClear()) return;
      set(K.prompts, String(num(K.prompts) + 1));
      set(K.last, String(Date.now()));
      open('auto');
    }, 1500);
  }

  // ── Wiring ──────────────────────────────────────────────
  function init() {
    if (wired) return;
    wired = true;

    card    = document.getElementById('signup-card');
    btnOpen = document.getElementById('btn-signup');
    if (!card) return;

    form   = card.querySelector('form');
    input  = document.getElementById('signup-email');
    msgEl  = card.querySelector('.signup-msg');
    if (msgEl) defaultMsg = msgEl.textContent.trim();

    // No endpoint configured yet: leave the app exactly as it was.
    if (!ENDPOINT) {
      card.remove();
      if (btnOpen) btnOpen.closest('.signup-shadow, .btn-shadow')?.remove();
      return;
    }

    if (form)    form.addEventListener('submit', submit);
    if (btnOpen) btnOpen.addEventListener('click', () => open('header'));
    card.querySelectorAll('[data-signup-close]').forEach(el =>
      el.addEventListener('click', dismiss));

    // Esc closes it, like the game's other dismissible layers.
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && card.classList.contains('active')) dismiss();
    });

    // The bar's height changes with the viewport (two columns become one
    // below 480px), so the space reserved for it has to follow.
    if (window.ResizeObserver) new ResizeObserver(() => {
      if (card.classList.contains('active')) reserveSpace();
    }).observe(card);

    if (get(K.state) === 'joined' && btnOpen) {
      btnOpen.setAttribute('aria-label', "You're on the mailing list");
      btnOpen.classList.add('is-joined');
    }

    flushQueue();
  }

  return { init, open, maybePrompt, event };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', Signup.init);
} else {
  Signup.init();
}
