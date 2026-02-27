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

    // Short thud + metallic ping → ball locks shut after shakes
    click() {
      const t = getCtx().currentTime;
      tone({ start: 180, end: 50 }, 'square', t,        0.06, 0.40);
      tone(1400,                    'sine',   t + 0.02,  0.04, 0.20);
    },

    // Triumphant ascending jingle → catch confirmed
    fanfare() {
      const t = getCtx().currentTime;
      tone(523,  'square',   t,        0.09, 0.20);  // C5
      tone(659,  'square',   t + 0.10, 0.09, 0.20);  // E5
      tone(784,  'square',   t + 0.20, 0.09, 0.20);  // G5
      tone(1047, 'square',   t + 0.31, 0.22, 0.22);  // C6 (peak)
      tone(784,  'triangle', t + 0.31, 0.55, 0.10);  // G5 harmony
      tone(988,  'square',   t + 0.55, 0.08, 0.18);  // B5
      tone(784,  'square',   t + 0.65, 0.08, 0.18);  // G5
      tone(523,  'square',   t + 0.75, 0.32, 0.22);  // C5 (resolution hold)
    },

    // Engine rev sound → mon blended into smoothie
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
      env.gain.setValueAtTime(0.45, t);
      env.gain.linearRampToValueAtTime(0.5, t + dur * 0.6);
      env.gain.exponentialRampToValueAtTime(0.001, t + dur);

      // ── LFO: simulates engine cylinder firing (put-put-put effect)
      const lfo      = ac.createOscillator();
      lfo.type       = 'sine';
      lfo.frequency.setValueAtTime(22, t);           // low RPM at start
      lfo.frequency.linearRampToValueAtTime(95, t + dur * 0.6);  // rev up
      lfo.frequency.linearRampToValueAtTime(30, t + dur);         // wind down

      const lfoDepth      = ac.createGain();
      lfoDepth.gain.value = 0.38;

      lfo.connect(lfoDepth);
      lfoDepth.connect(env.gain);
      osc.connect(env);
      env.connect(ac.destination);

      osc.start(t); osc.stop(t + dur + 0.05);
      lfo.start(t); lfo.stop(t + dur + 0.05);

      // ── Harmonic overtone: one octave up, lower gain
      tone({ start: 110, end: 480 }, 'square', t,             dur * 0.6,  0.20);
      tone({ start: 480, end: 140 }, 'square', t + dur * 0.55, dur * 0.5, 0.14);

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
      exhaustEnv.gain.setValueAtTime(0.18, t);
      exhaustEnv.gain.exponentialRampToValueAtTime(0.001, t + dur);

      exhaust.connect(lpf);
      lpf.connect(exhaustEnv);
      exhaustEnv.connect(ac.destination);
      exhaust.start(t);
      exhaust.stop(t + dur + 0.05);
    },
  };

  // ── Encounter music loop ─────────────────────────────────────
  // A looping 2-bar phrase in D minor (square wave melody + bass).
  // Scheduled ahead via Web Audio API clock for gap-free looping.
  const music = (() => {
    let playing = false;
    let pending = [];   // { osc, env } pairs currently scheduled
    let timerId = null;

    const BPM = 148;
    const B   = 60 / BPM;   // quarter note ≈ 0.405 s
    const e   = B / 2;      // eighth  note ≈ 0.203 s

    // 2-bar melodic phrase in D minor.
    // Descends D5→F4 then ascends back — wave-like contour.
    // Total duration: 12×e + 2×B = 12×0.203 + 2×0.405 ≈ 3.24 s
    const MELODY = [
      [587, e], [523, e],   // D5  C5
      [466, e], [392, e],   // Bb4 G4
      [440, e], [392, e],   // A4  G4
      [349, B],             // F4  (quarter — moment of tension)
      [392, e], [440, e],   // G4  A4
      [466, e], [523, e],   // Bb4 C5
      [587, e], [523, e],   // D5  C5
      [466, B],             // Bb4 (quarter — holds before loop)
    ];

    // Bass: 8 quarter notes = 8×B ≈ 3.24 s (matches MELODY)
    const BASS = [
      [147, B], [196, B], [233, B], [220, B],   // D3 G3 Bb3 A3
      [196, B], [175, B], [196, B], [147, B],   // G3 F3 G3  D3
    ];

    function schedNote(freq, startT, dur, gain) {
      const ac  = getCtx();
      const osc = ac.createOscillator();
      const env = ac.createGain();
      osc.type            = 'square';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, startT);
      env.gain.linearRampToValueAtTime(gain, startT + 0.01);
      env.gain.setValueAtTime(gain, startT + Math.max(0.01, dur - 0.04));
      env.gain.linearRampToValueAtTime(0, startT + dur);
      osc.connect(env);
      env.connect(ac.destination);
      osc.start(startT);
      osc.stop(startT + dur + 0.02);
      pending.push({ osc, env });
    }

    function scheduleLoop() {
      if (!playing) return;
      const t = getCtx().currentTime + 0.05;

      let mt = t;
      for (const [freq, dur] of MELODY) {
        if (freq) schedNote(freq, mt, dur * 0.88, 0.09);
        mt += dur;
      }

      let bt = t;
      for (const [freq, dur] of BASS) {
        schedNote(freq, bt, dur * 0.82, 0.12);
        bt += dur;
      }

      // Re-schedule 150 ms before this loop ends to avoid gaps
      timerId = setTimeout(scheduleLoop, (mt - t - 0.15) * 1000);
    }

    function start() {
      if (playing || muted) return;
      playing = true;
      scheduleLoop();
    }

    function stop() {
      playing = false;
      clearTimeout(timerId);
      timerId = null;
      if (!ctx) { pending = []; return; }
      const t = ctx.currentTime;
      for (const { osc, env } of pending) {
        try {
          env.gain.cancelScheduledValues(t);
          env.gain.setValueAtTime(env.gain.value, t);
          env.gain.linearRampToValueAtTime(0, t + 0.08);
          osc.stop(t + 0.10);
        } catch (_) {}
      }
      pending = [];
    }

    return { start, stop };
  })();

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
    if (muted) music.stop();
    return muted;
  }

  return { play, toggle, music };
})();
