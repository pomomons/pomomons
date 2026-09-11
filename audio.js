// audio.js — 8-bit synthesized sound effects (Web Audio API)
// No external files needed; all sounds are generated programmatically.

const SFX = (() => {
  let ctx = null;

  // Lazy-init AudioContext on first play (browsers require a user gesture first).
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // How far into the future, on the AudioContext clock, the sounds scheduled
  // so far ring out. tone() pushes it forward; play(name, { after: true })
  // reads it back so a sound can wait its turn instead of landing on top of
  // one that is still sounding. Measured rather than tabulated, so no
  // hand-written length can drift out of step when a sound is retuned.
  let scheduledUntil = 0;

  // Schedule a single tone.
  // freq  — Hz number, or { start, end } for a linear frequency sweep
  // type  — OscillatorNode type ('square' | 'triangle' | 'sine')
  // t     — absolute AudioContext start time
  // dur   — duration in seconds
  // gain  — peak amplitude (0–1)
  function tone(freq, type, t, dur, gain = 0.22) {
    const ac  = getCtx();
    const osc = ac.createOscillator();
    const env = ac.createGain();
    osc.connect(env);
    env.connect(ac.destination);

    osc.type = type;
    if (typeof freq === 'object') {
      osc.frequency.setValueAtTime(freq.start, t);
      osc.frequency.linearRampToValueAtTime(freq.end, t + dur);
    } else {
      osc.frequency.setValueAtTime(freq, t);
    }

    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    const end = t + dur + 0.02;
    osc.start(t);
    osc.stop(end);
    if (end > scheduledUntil) scheduledUntil = end;
  }

  // ── Sound definitions ────────────────────────────────────────
  const sounds = {

    // Rising double-blip → timer starts
    start() {
      const t = getCtx().currentTime;
      tone(440, 'square', t,        0.05, 0.18);
      tone(660, 'square', t + 0.06, 0.07, 0.18);
    },

    // Ascending 4-note jingle → focus session complete (~5x longer, drawn-out chime)
    sessionEnd() {
      const t = getCtx().currentTime;
      [523, 659, 784, 1047].forEach((f, i) =>   // C5 E5 G5 C6
        tone(f, 'square', t + i * 0.55, 0.45, 0.22));
    },

    // Two-hit announcement → wild mon appears
    encounter() {
      const t = getCtx().currentTime;
      tone(220, 'square', t,        0.10, 0.28);
      tone(440, 'square', t + 0.13, 0.18, 0.28);
    },

    // Bright rising sparkle → a SHINY wild mon appears (replaces encounter()).
    // Ascending arpeggio topped with a shimmering high tail.
    shinyAppear() {
      const t = getCtx().currentTime;
      tone(1047, 'square',   t,        0.06, 0.20);  // C6
      tone(1319, 'square',   t + 0.07, 0.06, 0.20);  // E6
      tone(1568, 'square',   t + 0.14, 0.06, 0.20);  // G6
      tone(2093, 'triangle', t + 0.21, 0.34, 0.15);  // C7 shimmer
      tone({ start: 2093, end: 3136 }, 'sine', t + 0.24, 0.40, 0.055); // twinkle sweep
    },

    // Low ominous stab → a DARK wild mon appears (replaces encounter()).
    // Descending growl with a dissonant tritone layer and a sub rumble.
    darkAppear() {
      const t = getCtx().currentTime;
      tone({ start: 220, end: 104 }, 'square',   t,        0.55, 0.30); // growl down
      tone({ start: 311, end: 147 }, 'square',   t + 0.02, 0.45, 0.13); // tritone layer
      tone(55,                       'triangle', t + 0.02, 0.62, 0.22); // sub rumble
      tone({ start: 1300, end: 880 }, 'sine',    t + 0.16, 0.50, 0.04); // eerie high whine
    },

    // Squish-launch thwack + rising whoosh → tomato thrown
    throw() {
      const t = getCtx().currentTime;
      tone({ start: 260, end: 60  }, 'square',   t,        0.07, 0.40); // thwack
      tone({ start: 150, end: 680 }, 'triangle', t + 0.05, 0.28, 0.15); // whoosh
    },

    // Upward sparkle sweep + ping → mon caught
    catch() {
      const t = getCtx().currentTime;
      tone({ start: 300, end: 900 }, 'square',   t,        0.20, 0.22);
      tone(1047,                     'triangle',  t + 0.18, 0.12, 0.18);
    },

    // Triumphant 5-note arpeggio → level up
    levelUp() {
      const t = getCtx().currentTime;
      [523, 659, 784, 1047, 1319].forEach((f, i) =>  // C5 E5 G5 C6 E6
        tone(f, 'square', t + i * 0.08, 0.07, 0.22));
    },

    // Soft rising pip → companion selected
    select() {
      const t = getCtx().currentTime;
      tone({ start: 440, end: 660 }, 'triangle', t, 0.07, 0.18);
    },

    // Springy elastic bop → ball bounces on ground
    bounce() {
      const t = getCtx().currentTime;
      tone({ start: 480, end: 90 }, 'sine',     t,        0.07, 0.34); // elastic pitch drop
      tone(260,                     'triangle', t + 0.01, 0.05, 0.20); // soft body thud underneath
    },

    // Heavy impact thud → ball rocks during shake
    // Gains are the original mix at 70% — it plays up to three times in a row
    // during a catch and was the loudest thing on the screen. All three layers
    // are scaled by the same factor so the balance between them is unchanged;
    // to retune, scale them together rather than moving one.
    shake() {
      const t = getCtx().currentTime;
      tone({ start: 160, end: 40  }, 'square',   t,        0.18, 0.245); // heavy low thud
      tone({ start: 320, end: 100 }, 'square',   t,        0.10, 0.158); // mid punch layer
      tone(95,                       'triangle', t + 0.03, 0.16, 0.123); // deep sub rumble
    },

    // Satisfying low mechanical click → ball locks shut
    click() {
      const t = getCtx().currentTime;
      tone({ start: 380, end: 90 }, 'square',   t,        0.09, 0.75); // punchy mid-low click body
      tone(900,                     'triangle', t,        0.03, 0.50); // brief mid snap on attack
    },

    // Soft mechanical tick → any button that makes no sound of its own.
    // Deliberately slight next to click() above: about a tenth of its level
    // and a third of its length. This one fires on a lot of taps, so it has
    // to register as feedback without competing with the sounds that mark
    // something actually happening.
    uiClick() {
      const t = getCtx().currentTime;
      tone({ start: 420, end: 190 }, 'square',   t, 0.030, 0.075); // body
      tone(1400,                     'triangle', t, 0.016, 0.040); // attack snap
    },

    // Triumphant brass trumpet fanfare → catch confirmed
    fanfare() {
      const t = getCtx().currentTime;
      // Three ascending pickup notes (sawtooth = brassier timbre)
      tone(523,  'sawtooth', t,         0.08, 0.22);  // C5
      tone(659,  'sawtooth', t + 0.10,  0.08, 0.22);  // E5
      tone(784,  'sawtooth', t + 0.20,  0.08, 0.24);  // G5
      // Big C6 peak — double-layered for sustain effect
      tone(1047, 'sawtooth', t + 0.30,  0.09, 0.30);  // C6 bright attack
      tone(1047, 'sawtooth', t + 0.38,  0.34, 0.22);  // C6 sustain body
      tone(784,  'triangle', t + 0.30,  0.42, 0.10);  // G5 harmony (softer)
      // Descending resolution
      tone(784,  'sawtooth', t + 0.76,  0.08, 0.22);  // G5
      tone(523,  'sawtooth', t + 0.87,  0.42, 0.28);  // C5 final hold
    },

    // Bright ascending three-blip → Pomodex counter ticks up by one
    dexTick() {
      const t = getCtx().currentTime;
      tone(880,  'square',   t,        0.05, 0.18);  // A5
      tone(1319, 'square',   t + 0.06, 0.06, 0.20);  // E6
      tone(1760, 'triangle', t + 0.12, 0.14, 0.13);  // A6 sparkle tail
    },

    // Engine rev sound → mon blended into smoothie
    // Gains are the original mix at 70%. Every level is scaled by the same
    // factor — engine envelope, LFO depth, both overtones and the exhaust
    // noise — so the balance between the layers is unchanged; retune them
    // together rather than moving one. The 0.001 ramp targets are silence,
    // not levels, and are left alone.
    blend() {
      const ac  = getCtx();
      const t   = ac.currentTime;
      const dur = 1.8;

      // ── Main engine oscillator: low square wave revving up then winding down
      const osc      = ac.createOscillator();
      osc.type       = 'square';
      osc.frequency.setValueAtTime(55, t);
      osc.frequency.linearRampToValueAtTime(240, t + dur * 0.6);
      osc.frequency.linearRampToValueAtTime(70,  t + dur);

      const env = ac.createGain();
      env.gain.setValueAtTime(0.059, t);
      env.gain.linearRampToValueAtTime(0.063, t + dur * 0.6);
      env.gain.exponentialRampToValueAtTime(0.001, t + dur);

      // ── LFO: simulates engine cylinder firing (put-put-put effect)
      const lfo      = ac.createOscillator();
      lfo.type       = 'sine';
      lfo.frequency.setValueAtTime(22, t);           // low RPM at start
      lfo.frequency.linearRampToValueAtTime(95, t + dur * 0.6);  // rev up
      lfo.frequency.linearRampToValueAtTime(30, t + dur);         // wind down

      const lfoDepth      = ac.createGain();
      lfoDepth.gain.value = 0.046;

      lfo.connect(lfoDepth);
      lfoDepth.connect(env.gain);
      osc.connect(env);
      env.connect(ac.destination);

      osc.start(t); osc.stop(t + dur + 0.05);
      lfo.start(t); lfo.stop(t + dur + 0.05);

      // ── Harmonic overtone: one octave up, lower gain
      tone({ start: 110, end: 480 }, 'square', t,             dur * 0.6,  0.042);
      tone({ start: 480, end: 140 }, 'square', t + dur * 0.55, dur * 0.5, 0.028);

      // ── Exhaust grit: low-pass filtered noise underneath
      const bufSize = Math.ceil(ac.sampleRate * dur);
      const buf     = ac.createBuffer(1, bufSize, ac.sampleRate);
      const data    = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

      const exhaust     = ac.createBufferSource();
      exhaust.buffer    = buf;
      const lpf         = ac.createBiquadFilter();
      lpf.type          = 'lowpass';
      lpf.frequency.setValueAtTime(300, t);
      lpf.frequency.linearRampToValueAtTime(800, t + dur * 0.6);
      lpf.frequency.linearRampToValueAtTime(200, t + dur);
      const exhaustEnv  = ac.createGain();
      exhaustEnv.gain.setValueAtTime(0.035, t);
      exhaustEnv.gain.exponentialRampToValueAtTime(0.001, t + dur);

      exhaust.connect(lpf);
      lpf.connect(exhaustEnv);
      exhaustEnv.connect(ac.destination);
      exhaust.start(t);
      exhaust.stop(t + dur + 0.05);
    },
  };

  // ── Public API ───────────────────────────────────────────────
  let muted = localStorage.getItem('pm_muted') === '1';

  // performance.now() of the last sound that actually started. The general
  // button tick at the bottom of this file reads it to work out whether a
  // button already made a noise of its own.
  let lastPlayAt = -Infinity;

  // opts.after — hold this sound back until everything already scheduled has
  // finished, instead of layering it over the tail. A wall-clock timer rather
  // than an audio-clock offset, so it works for the sounds built from raw
  // nodes (blend) as well as the tone() ones. Mute is re-checked when it
  // actually fires, so muting during the wait still silences it.
  function play(name, opts) {
    if (muted) return;
    if (!sounds[name]) return;

    if (opts && opts.after) {
      let wait = 0;
      try { wait = Math.max(0, scheduledUntil - getCtx().currentTime); } catch (_) { wait = 0; }
      if (wait > 0) {
        // Counts as played now. The caller has made a noise happen, even
        // though it lands later, so the button tick shouldn't double up on it.
        lastPlayAt = performance.now();
        setTimeout(() => play(name), wait * 1000);
        return;
      }
    }

    try {
      sounds[name]();
      lastPlayAt = performance.now();
    } catch (_) { /* fail silently if Web Audio is unavailable */ }
  }

  function toggle() {
    muted = !muted;
    localStorage.setItem('pm_muted', muted ? '1' : '0');
    return muted;
  }

  function isMuted() { return muted; }

  // ── General button feedback ──────────────────────────────────
  // Every button that doesn't already make a sound gets the soft tick, so the
  // whole app answers back on tap instead of only the few places with bespoke
  // audio.
  //
  // Which buttons those are is decided at click time rather than listed. This
  // runs in the capture phase, notes the clock, and looks again on the next
  // task — by which point the button's own handlers have run. If one of them
  // played something, the click is already covered and this stays quiet. So
  // there is no list to keep in step when a sound is added or taken away
  // later, and no way for a button to end up making two noises at once.
  //
  // A handler that plays its sound asynchronously (after an await, or on a
  // delay) would slip past the check and get a tick as well. Nothing in the
  // app does that today; data-sfx="none" is the opt-out if one ever needs it.
  const TICK_TARGETS = 'button, [role="button"], .mon-card, .mode-option';

  document.addEventListener('click', (e) => {
    if (muted) return;
    const el = e.target && e.target.closest && e.target.closest(TICK_TARGETS);
    if (!el) return;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    if (el.dataset && el.dataset.sfx === 'none') return;

    // Unlock the AudioContext inside the gesture itself. The tick is scheduled
    // from a timer, which is no longer a user gesture as far as the browser is
    // concerned — so if the very first sound of the session were a deferred
    // tick, Safari and mobile Chrome would refuse to start audio at all.
    try { getCtx(); } catch (_) { return; }

    const at = performance.now();
    setTimeout(() => { if (lastPlayAt < at) play('uiClick'); }, 0);
  }, true);

  return { play, toggle, isMuted };
})();
