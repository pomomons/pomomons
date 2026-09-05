// signup.js — optional email capture + usage events.
//
// The card is a popup, centered over the whole screen with a dimmed
// backdrop: it takes no space in the timer screen's layout, so it can't push
// the screen over and make fitTimerScreen() (app.js) shrink everything to
// pay for it. Dismissing it is always one tap — the ✕, Esc, or the backdrop
// — and the envelope button in the header opens it again for anyone who
// wants back in later.
//
// Signups POST to a Google Apps Script web app, which appends a row to a
// Google Sheet. See agent_docs/email-signups.md for the script and the setup.

const Signup = (() => {

  // ── Config ──────────────────────────────────────────────
  // Paste the Apps Script deployment URL here (see agent_docs/email-signups.md).
  // While it is empty the feature stays completely dormant: no card, no
  // envelope button, nothing posted anywhere.
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbztyYzTn8d_JSzIjuJdX2UGYrBec51cTeotb6SZa5qW0d2hbq1HduOUU0IPO7oCJO_laA/exec';

  // When to offer it. Whichever comes first — a player who catches is engaged,
  // a player who only runs the timer is too, and they get there at different
  // rates. Set high enough that a first-time visitor poking around never sees
  // it: by 5 catches or 6 sessions there's a collection actually worth not
  // losing. Catching a dark or shiny mon (see noteRareCatch) also qualifies
  // on its own — that's a rare pull nobody wants to lose to a cleared cache.
  const AFTER_CATCHES  = 5;
  const AFTER_SESSIONS = 6;

  // Someone who closes the card is telling us something. Leave a long gap
  // before asking again, and give up entirely after this many refusals.
  const REASK_AFTER_DAYS = 30;
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
  // pm_email_rare    '1' once a dark/shiny has been caught — qualifies the
  //                  prompt on its own, cleared when it's actually shown
  const K = {
    state:   'pm_email_state',
    prompts: 'pm_email_prompts',
    last:    'pm_email_last',
    queue:   'pm_email_queue',
    addr:    'pm_email_addr',     // remembered only to prefill a repeat backup
    rare:    'pm_email_rare',
  };

  const get  = (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
  const set  = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
  const num  = (k) => parseInt(get(k, '0'), 10) || 0;

  let card, backdrop, form, input, btnOpen, msgEl, titleEl, consentEl, shownAt = 0, wired = false;
  // Whatever the markup ships with — the status line falls back to it, so the
  // bar always has a second line and never changes height.
  let defaultMsg = '';
  // The card's shipped wording, kept so a repeat visit can swap to the
  // fresh-backup copy and back again without hardcoding either in two places.
  let firstTitle = '', firstMsg = '';

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
  // A popup over the whole screen, backdrop included — it plays no part in
  // the timer screen's layout, so opening or closing it never touches
  // fitTimerScreen().
  function open(source) {
    if (!card) return;
    card.classList.add('active');
    card.setAttribute('aria-hidden', 'false');
    if (backdrop) { backdrop.classList.add('active'); backdrop.setAttribute('aria-hidden', 'false'); }
    card.dataset.source = source || 'manual';
    shownAt = Date.now();
    message('');

    // Someone already on the list is here for a fresh code, not to join again.
    // A backup taken three mons ago is not a backup, so this path has to be
    // easy — otherwise the promise quietly rots as they keep playing.
    const rejoining = get(K.state) === 'joined';
    if (titleEl) titleEl.textContent = rejoining ? 'SEND A FRESH BACKUP' : firstTitle;
    if (msgEl)   defaultMsg = rejoining
      ? 'Your last code only covers the mons you had then. This one covers all of them.'
      : firstMsg;
    message('');

    // The tickbox is consent for the mailing list, which is a one-time
    // decision. Showing it again on a repeat send would invite an unticked box
    // to read as a withdrawal, and it is not — that is what unsubscribe is for.
    if (consentEl) consentEl.hidden = rejoining;

    if (input) input.value = rejoining ? get(K.addr, '') : '';
  }

  function close() {
    if (!card) return;
    card.classList.remove('active');
    card.setAttribute('aria-hidden', 'true');
    if (backdrop) { backdrop.classList.remove('active'); backdrop.setAttribute('aria-hidden', 'true'); }
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

    // The backup code is the whole reason someone hands over an address, so a
    // failure to build one must not be silent — better to say so than to send
    // a cheerful email with nothing useful in it.
    let code = '';
    try {
      if (typeof Backup !== 'undefined') code = await Backup.create();
    } catch (err) {
      code = '';
    }
    if (!code) {
      message("Couldn't build your backup code — try again in a moment.", 'err');
      if (btn) { btn.disabled = false; btn.textContent = 'SEND'; }
      return;
    }

    const payload = {
      email,
      source:   card.dataset.source || 'manual',
      sessions: num('pm_total_sessions'),
      catches:  num('pm_total_catches'),
      at:       new Date().toISOString(),
      code,
      // Sent so the email can carry a one-click restore link back to wherever
      // the game is actually being played.
      origin:   location.origin + location.pathname,
    };

    // Consent is reported only on the send where it was actually asked for.
    // Repeat backups hide the tickbox, and a hidden box still carries its old
    // state — sending that would claim someone agreed on a screen that never
    // put the question to them. Omitting the field leaves the sheet's existing
    // answer alone, which is what the script does with a missing value.
    const consent = form.querySelector('#signup-updates');
    if (consentEl && !consentEl.hidden) payload.updates = !!(consent && consent.checked);

    try {
      await post(payload);
    } catch (err) {
      // Already have the address; hold it and retry on the next load rather
      // than making them type it again.
      queue(payload);
    }

    set(K.state, 'joined');
    set(K.addr, email);            // so a later "send me a fresh one" is one tap
    event('email-signup');
    message('Sent! Check your email for your code.', 'ok');
    if (btn) { btn.disabled = false; btn.textContent = 'SEND'; }
    setTimeout(close, 2200);
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
    return get(K.rare) === '1'
        || num('pm_total_catches')  >= AFTER_CATCHES
        || num('pm_total_sessions') >= AFTER_SESSIONS;
  }

  // A dark or shiny just went into the collection. Flag it so the next calm
  // moment on the timer screen offers the backup, even if the catch/session
  // counts aren't there yet — the joined / max-prompts / cooldown guards in
  // shouldPrompt still apply.
  function noteRareCatch() {
    if (get(K.state) === 'joined') return;
    set(K.rare, '1');
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
      set(K.rare, '');   // spent — a later rare catch can set it again
      open('auto');
    }, 1500);
  }

  // ── Wiring ──────────────────────────────────────────────
  function init() {
    if (wired) return;
    wired = true;

    card     = document.getElementById('signup-card');
    backdrop = document.getElementById('signup-backdrop');
    btnOpen  = document.getElementById('btn-signup');
    if (!card) return;

    form      = card.querySelector('form');
    input     = document.getElementById('signup-email');
    msgEl     = card.querySelector('.signup-msg');
    titleEl   = card.querySelector('.signup-title');
    consentEl = card.querySelector('.signup-consent');
    if (msgEl)   defaultMsg = firstMsg = msgEl.textContent.trim();
    if (titleEl) firstTitle = titleEl.textContent.trim();

    // No endpoint configured yet: leave the app exactly as it was.
    if (!ENDPOINT) {
      card.remove();
      if (backdrop) backdrop.remove();
      if (btnOpen) btnOpen.closest('.signup-shadow, .btn-shadow')?.remove();
      return;
    }

    if (form)     form.addEventListener('submit', submit);
    if (btnOpen)  btnOpen.addEventListener('click', () => open('header'));
    if (backdrop) backdrop.addEventListener('click', dismiss);
    card.querySelectorAll('[data-signup-close]').forEach(el =>
      el.addEventListener('click', dismiss));

    // Esc closes it, like the game's other dismissible layers.
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && card.classList.contains('active')) dismiss();
    });

    if (get(K.state) === 'joined' && btnOpen) {
      btnOpen.setAttribute('aria-label', "You're on the mailing list");
      btnOpen.classList.add('is-joined');
    }

    flushQueue();
  }

  return { init, open, maybePrompt, noteRareCatch, event };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', Signup.init);
} else {
  Signup.init();
}
