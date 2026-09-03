// backup.js — turn a player's whole save into one copy-paste code, and back.
//
// There are no accounts, which is deliberate: no signup wall, and no store of
// anyone's data to leak. The cost is that a cleared browser takes the whole
// collection with it. This is the answer to that — a string the player keeps,
// which rebuilds their save anywhere.
//
// A code carries two things that live in different places:
//   • the caught records, from IndexedDB (collection.js owns the handle)
//   • progress and preferences, from the ~20 localStorage keys below
// Restoring only the creatures would put someone back at level 1 with their
// stats wiped, which is not a backup.

const Backup = (() => {

  // Bump when the payload shape changes in a way older readers can't handle.
  const VERSION = 1;

  // Progress and preferences worth carrying. Deliberately excluded:
  //   pm_email_*   signup bookkeeping — "dismissed 2 weeks ago" is about a
  //                browser, not a player, and restoring it would silence the
  //                card on a machine that has never seen it
  //   pm_caught    migration scratch, emptied into IndexedDB on first run
  const KEYS = [
    'pm_level', 'pm_exp',
    'pm_active', 'pm_active_rec_key', 'pm_active_pal_level',
    'pm_active_pal_exp', 'pm_active_shiny', 'pm_active_dark',
    'pm_total_sessions', 'pm_total_minutes', 'pm_total_catches',
    'pm_today_sessions', 'pm_today_minutes', 'pm_today_catches', 'pm_today_date',
    'pm_focus_mins', 'pm_short_mins', 'pm_long_mins',
    'pm_items', 'pm_muted', 'pm_stats_scope',
  ];

  // app.js runs a one-time cleanup that wipes the collection unless this is
  // set (see the pm_seed_purged block there). A restore must set it, or the
  // very next page load erases everything we just put back.
  const PURGE_FLAG = 'pm_seed_purged';

  // ── Code format ─────────────────────────────────────────────
  // PMZ1.<base64url>.<check>   Z = gzipped, B = plain
  // The check digit is what makes a truncated paste fail loudly. Codes get
  // copied out of emails and chat windows, and a silently half-imported
  // collection would be worse than a clear error.
  const SEP = '.';

  function hash(str) {                    // FNV-1a, enough to catch damage
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(36).padStart(7, '0').slice(-7);
  }

  function bytesToB64url(bytes) {
    let bin = '';
    // Chunked: spreading a large array into String.fromCharCode blows the stack.
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64urlToBytes(s) {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - b64.length % 4) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // CompressionStream is a browser API, not a library, so this stays within
  // the project's no-dependencies rule. Older browsers fall back to plain
  // base64 — a longer code, but a working one.
  const canZip = typeof CompressionStream !== 'undefined';

  async function pipe(bytes, stream) {
    const blob = new Blob([bytes]);
    return new Uint8Array(await new Response(blob.stream().pipeThrough(stream)).arrayBuffer());
  }

  // ── Public: create ──────────────────────────────────────────
  async function create() {
    const records = (typeof Collection !== 'undefined')
      ? await Collection.exportRecords()
      : [];

    const state = {};
    for (const k of KEYS) {
      const v = localStorage.getItem(k);
      if (v !== null) state[k] = v;
    }

    const payload = { v: VERSION, t: Date.now(), s: state, m: records };
    const raw = new TextEncoder().encode(JSON.stringify(payload));

    let body, tag;
    if (canZip) {
      body = bytesToB64url(await pipe(raw, new CompressionStream('gzip')));
      tag  = 'PMZ' + VERSION;
    } else {
      body = bytesToB64url(raw);
      tag  = 'PMB' + VERSION;
    }
    return tag + SEP + body + SEP + hash(body);
  }

  // ── Public: decode ──────────────────────────────────────────
  // Throws with a message worth showing a person. Never returns a partial.
  async function decode(code) {
    const clean = String(code || '').trim().replace(/\s+/g, '');
    if (!clean) throw new Error("That's empty — paste the whole code.");

    const parts = clean.split(SEP);
    if (parts.length !== 3) {
      throw new Error("That doesn't look like a PomoMons code. Copy the whole thing, including the PM at the front.");
    }

    const [tag, body, check] = parts;
    const m = /^PM([ZB])(\d+)$/.exec(tag);
    if (!m) throw new Error("That doesn't look like a PomoMons code.");

    if (Number(m[2]) > VERSION) {
      throw new Error('That code was made by a newer version of PomoMons. Refresh the page and try again.');
    }
    if (hash(body) !== check) {
      throw new Error("That code is damaged or incomplete — it looks like some of it didn't get copied.");
    }

    let json;
    try {
      const bytes = b64urlToBytes(body);
      const raw = m[1] === 'Z'
        ? await pipe(bytes, new DecompressionStream('gzip'))
        : bytes;
      json = JSON.parse(new TextDecoder().decode(raw));
    } catch (e) {
      throw new Error("That code couldn't be read. It may have been altered after it was copied.");
    }

    if (!json || typeof json !== 'object' || !Array.isArray(json.m) || typeof json.s !== 'object') {
      throw new Error("That code doesn't contain a PomoMons save.");
    }
    return json;
  }

  // ── Public: summarise ───────────────────────────────────────
  // What a code holds, so the player can be told what they're about to
  // overwrite before anything is touched.
  function summarise(payload) {
    const s = payload.s || {};
    return {
      mons:  payload.m.length,
      level: parseInt(s.pm_level || '1', 10) || 1,
      made:  payload.t ? new Date(payload.t) : null,
    };
  }

  // ── Public: restore ─────────────────────────────────────────
  // Destructive by definition — it replaces the save. Callers confirm first.
  async function restore(payload) {
    if (typeof Collection !== 'undefined') {
      await Collection.importRecords(payload.m);
    }

    // Clear every managed key first, so a value the old save had and the new
    // one doesn't (a companion that was never caught, say) doesn't survive.
    for (const k of KEYS) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(payload.s)) {
      if (KEYS.includes(k)) localStorage.setItem(k, String(v));
    }
    localStorage.setItem(PURGE_FLAG, '1');

    return summarise(payload);
  }

  // ── UI ──────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  let modal, codeBox, restoreBox, copyMsg, restoreMsg, pending = null;

  function say(el, text, bad) {
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('is-bad', !!bad);
  }

  async function open(prefill) {
    if (!modal) return;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    say(copyMsg, ''); say(restoreMsg, '');

    if (codeBox) {
      codeBox.value = 'BUILDING…';
      try { codeBox.value = await create(); }
      catch (e) { codeBox.value = ''; say(copyMsg, "Couldn't build a code.", true); }
    }
    if (prefill && restoreBox) {
      restoreBox.value = prefill;
      restoreBox.scrollIntoView({ block: 'nearest' });
    }
  }

  function close() {
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    pending = null;
  }

  async function doRestore() {
    const raw = restoreBox ? restoreBox.value : '';

    // Two taps: the first says what the code holds, the second commits. This
    // overwrites a collection, so "are you sure" has to name what's at stake.
    if (!pending) {
      let payload;
      try { payload = await decode(raw); }
      catch (e) { say(restoreMsg, e.message, true); return; }

      pending = payload;
      const s = summarise(payload);
      const when = s.made ? s.made.toLocaleDateString() : 'an unknown date';
      say(restoreMsg, `${s.mons} mon${s.mons === 1 ? '' : 's'}, level ${s.level}, saved ${when}. Press RESTORE again to replace what you have now.`);
      return;
    }

    try {
      await restore(pending);
    } catch (e) {
      say(restoreMsg, "Something went wrong writing the save. Nothing was changed.", true);
      pending = null;
      return;
    }
    say(restoreMsg, 'Restored. Reloading…');
    // A wholesale state swap touches every screen at once; reloading is the
    // honest way to get a consistent view rather than re-rendering piecemeal.
    if (location.hash.startsWith('#restore=')) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    setTimeout(() => location.reload(), 700);
  }

  async function copy() {
    if (!codeBox || !codeBox.value) return;
    try {
      await navigator.clipboard.writeText(codeBox.value);
      say(copyMsg, 'Copied.');
    } catch (e) {
      // Clipboard access is refused on insecure origins and in some browsers;
      // selecting the text is still a working answer.
      codeBox.focus(); codeBox.select();
      say(copyMsg, 'Press Ctrl+C to copy.');
    }
  }

  function init() {
    modal      = $('save-code');
    codeBox    = $('save-code-text');
    restoreBox = $('restore-code-text');
    copyMsg    = $('save-code-msg');
    restoreMsg = $('restore-msg');
    if (!modal) return;

    $('btn-save-code')?.addEventListener('click', () => open());
    $('btn-save-code-close')?.addEventListener('click', close);
    $('btn-copy-code')?.addEventListener('click', copy);
    $('btn-restore-code')?.addEventListener('click', doRestore);

    // Editing the pasted code cancels a pending confirmation, so the second
    // press can never commit a different code from the one just described.
    restoreBox?.addEventListener('input', () => { pending = null; say(restoreMsg, ''); });

    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && modal.classList.contains('active')) close();
    });

    // #restore=CODE — the one-click path out of the backup email.
    const m = /^#restore=(.+)$/.exec(location.hash);
    if (m) open(decodeURIComponent(m[1]));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { create, decode, restore, summarise, open, KEYS, VERSION };
})();
