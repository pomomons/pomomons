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

    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // ── Sound definitions ────────────────────────────────────────
  const sounds = {

    // Rising double-blip → timer starts
    start() {
      const t = getCtx().currentTime;
      tone(440, 'square', t,        0.05, 0.18);
      tone(660, 'square', t + 0.06, 0.07, 0.18);
    },

    // Ascending 4-note jingle → focus session complete
    sessionEnd() {
      const t = getCtx().currentTime;
      [523, 659, 784, 1047].forEach((f, i) =>   // C5 E5 G5 C6
        tone(f, 'square', t + i * 0.11, 0.09, 0.22));
    },

    // Two-hit announcement → wild mon appears
    encounter() {
      const t = getCtx().currentTime;
      tone(220, 'square', t,        0.10, 0.28);
      tone(440, 'square', t + 0.13, 0.18, 0.28);
    },

    // Downward whoosh → tomato thrown
    throw() {
      const t = getCtx().currentTime;
      tone({ start: 700, end: 180 }, 'square', t, 0.18, 0.22);
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
  };

  // ── Public API ───────────────────────────────────────────────
  let muted = false;

  function play(name) {
    if (muted) return;
    try {
      if (sounds[name]) sounds[name]();
    } catch (_) { /* fail silently if Web Audio is unavailable */ }
  }

  function toggle() {
    muted = !muted;
    return muted;
  }

  return { play, toggle };
})();
