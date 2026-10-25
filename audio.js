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
  // dest  — optional node to play into instead of the speakers. Only the
  //         evolution loop uses it (see startLoop): its notes go through a
  //         bus it can fade out on STOP, and they don't count towards
  //         scheduledUntil — a loop that is always 0.15s ahead of itself
  //         would otherwise hold every { after: true } sound back forever.
  function tone(freq, type, t, dur, gain = 0.22, dest = null) {
    const ac  = getCtx();
    const osc = ac.createOscillator();
    const env = ac.createGain();
    osc.connect(env);
    env.connect(dest || ac.destination);

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
    if (!dest && end > scheduledUntil) scheduledUntil = end;
  }

  // Deterministic PRNG (a classic linear congruential generator) seeded by
  // dexNum — mon cries use this instead of Math.random() so a given species
  // always sounds the same, but can still draw as many independent random
  // values as a cry needs (note count, shape, per-note jitter, whether
  // there's a noise layer...) rather than just one or two pitch offsets.
  function makeRng(seed) {
    let s = (seed * 9301 + 49297) % 233280;
    if (s <= 0) s += 233280;
    return function () {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }
  const lerp = (r, [lo, hi]) => lo + r * (hi - lo);

  // Cry CONTOUR shapes — the actual Gen 1 cries (decoded from the
  // disassembly's audio/sfx/cry*.asm) turn out to vary far more in SHAPE
  // than in pitch: some are a steady climb (Eeveelutions), some a flat
  // climb-then-fall (most "normal" cries), some a near-flat repeated note
  // (Krabby/Kingler's clack-clack-clack), some a zigzagging warble
  // (Ponyta), some two short phrases with a gap (Psyduck's "psy? psy?"),
  // some a quick multi-step trill (Mew). Each shape below takes a note
  // count and the per-mon rng and returns one freqMul per note; 'double'
  // also marks a gapIndex — a near-silent "breath" note instead of a sung
  // one. Picking a SHAPE independently of size/tier is deliberate: in the
  // real data, note count and contour don't track body size at all (Mew's
  // cry has 8 notes, Gyarados's has 4) — size only governs pitch/duty/length
  // range, never the shape riding on top of it.
  const SHAPES = {
    rise(n, rng) {   // smooth climb, settles back down on the last note
      const start = 0.82 + rng() * 0.10, peak = 1.25 + rng() * 0.25;
      const freqMuls = Array.from({ length: n }, (_, i) => start + (peak - start) * (i / (n - 1)));
      freqMuls[n - 1] *= 0.85;
      return { freqMuls, gapIndex: -1 };
    },
    fall(n, rng) {   // a roar losing steam — starts up, steps down throughout
      const start = 1.15 + rng() * 0.25, end = 0.5 + rng() * 0.15;
      const freqMuls = Array.from({ length: n }, (_, i) => start + (end - start) * (i / (n - 1)));
      return { freqMuls, gapIndex: -1 };
    },
    arc(n, rng) {    // rises to a peak partway through, then falls away
      const base = 0.85 + rng() * 0.10, peak = 1.2 + rng() * 0.3;
      const peakIdx = Math.max(1, Math.min(n - 2, Math.floor(n * 0.4)));
      const freqMuls = Array.from({ length: n }, (_, i) => {
        const t = i <= peakIdx ? i / peakIdx : 1 - (i - peakIdx) / Math.max(1, n - 1 - peakIdx);
        return base + (peak - base) * t;
      });
      return { freqMuls, gapIndex: -1 };
    },
    stutter(n, rng) { // near-flat, same note repeated with tiny jitter
      const base = 0.95 + rng() * 0.10;
      const freqMuls = Array.from({ length: n }, () => base + (rng() - 0.5) * 0.06);
      return { freqMuls, gapIndex: -1 };
    },
    warble(n, rng) { // zigzags up/down note to note — a discrete vibrato
      const base = 0.95 + rng() * 0.15, depth = 0.08 + rng() * 0.10;
      const freqMuls = Array.from({ length: n }, (_, i) => base + (i % 2 === 0 ? depth : -depth));
      return { freqMuls, gapIndex: -1 };
    },
    double(n, rng) { // two short calls with a near-silent gap between them
      const half  = Math.max(1, Math.floor((n - 1) / 2));
      const start = 0.95 + rng() * 0.20;
      const freqMuls = [];
      for (let i = 0; i < half; i++) freqMuls.push(start - i * 0.05);
      const gapIndex = freqMuls.length;
      freqMuls.push(start * 0.9);
      for (let i = 0; i < n - half - 1; i++) freqMuls.push(start * 1.05 - i * 0.05);
      return { freqMuls, gapIndex };
    },
  };
  const SHAPE_NAMES = Object.keys(SHAPES);

  // Size/stage tiers (see getCryTier, monsters.js) — the axis that pitch,
  // duty cycle and overall length ride on. Tier never touches shape/note
  // count; see the comment on SHAPES above for why.
  const CRY_TIERS = {
    1: { freq: [760, 1140], dur: [0.16, 0.30], duty: [0.10, 0.22], detune: [1.006, 1.016], peakBase: 0.24, noiseChance: 0.35, noiseAmt: [0.006, 0.020], sub: false },
    2: { freq: [300, 520],  dur: [0.26, 0.46], duty: [0.28, 0.46], detune: [1.006, 1.016], peakBase: 0.25, noiseChance: 0.55, noiseAmt: [0.018, 0.045], sub: false },
    3: { freq: [85, 160],   dur: [0.38, 0.62], duty: [0.48, 0.72], detune: [1.004, 1.012], peakBase: 0.27, noiseChance: 0.85, noiseAmt: [0.045, 0.095], sub: true  },
  };

  // A true pulse wave at a given duty cycle (0-1), via its Fourier series —
  // NOT the same as OscillatorNode's built-in 'square', which is fixed at
  // 50% duty. The real Game Boy's pulse channels could step through four
  // duty cycles (12.5/25/50/75%), and that thin-vs-fat duty is a big part of
  // why its cries read as "Game Boy" rather than "generic synth beep": a
  // thin duty (~15%) is nasal and squeaky, a fat one (~65%) is rounder and
  // more hollow. Cached per duty so repeat cries don't rebuild it.
  const pulseWaveCache = new Map();
  function pulseWave(ac, duty) {
    const key = Math.round(duty * 48);
    if (pulseWaveCache.has(key)) return pulseWaveCache.get(key);
    const d = Math.min(0.9, Math.max(0.08, key / 48));
    const N = 20;
    const real = new Float32Array(N);
    const imag = new Float32Array(N);
    for (let n = 1; n < N; n++) real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * d);
    const w = ac.createPeriodicWave(real, imag, { disableNormalization: false });
    pulseWaveCache.set(key, w);
    return w;
  }

  // One pulse-wave voice through a 3-note contour (see cryImpl). Each note
  // gets its OWN attack + decay rather than one envelope over the whole cry
  // — that per-note re-attack is what turns "one tone sliding around" into
  // "three short bleats stitched together," which is what the real cries
  // (decoded from the Gen 1 disassembly's audio/sfx/cry*.asm — three
  // square_note events per channel, each with its own volume fade) actually
  // do. Frequency steps between notes rather than sliding, for the same
  // reason: the hardware changed the frequency register at each new note,
  // it didn't glide.
  function cryVoice(ac, wave, notes, baseFreq, detune, gainScale, t0) {
    const osc = ac.createOscillator();
    osc.setPeriodicWave(wave);
    const env = ac.createGain();
    osc.connect(env); env.connect(ac.destination);

    env.gain.setValueAtTime(0.0001, t0);
    for (const n of notes) {
      osc.frequency.setValueAtTime(baseFreq * n.freqMul * detune, t0 + n.tStart);
      const attack = Math.min(0.012, Math.max(0.002, (n.tEnd - n.tStart) * 0.25));
      env.gain.linearRampToValueAtTime(n.peak * gainScale, t0 + n.tStart + attack);
      env.gain.exponentialRampToValueAtTime(Math.max(0.0005, n.peak * n.decayTo * gainScale), t0 + n.tEnd);
    }
    const end = t0 + notes[notes.length - 1].tEnd;
    osc.start(t0);
    osc.stop(end + 0.02);
    return end;
  }

  // Mon cry. Tier (size/stage — see CRY_TIERS above) sets the pitch/duty/
  // length RANGE; dexNum's rng then independently rolls a note count (3-6),
  // one of SHAPES, per-note jitter, and whether a noise layer plays at all —
  // so two mons in the same tier land in the same register but almost never
  // land on the same tune. Two detuned pulse-wave voices throughout (the
  // disassembly runs cries on two square channels a few Hz apart, for a
  // thicker, chorused tone).
  // opts.after — like play()'s { after: true }, but always pads an extra
  // beat (CRY_AFTER_PAD) on top of however long is left to ring out, rather
  // than landing right on the tail of it. play()'s version waits exactly
  // until scheduledUntil and no longer, which put the cry right under the
  // last note of the session-end chime — audible as "during," not "after."
  const CRY_AFTER_PAD = 0.18;
  function cry(dexNum, opts) {
    if (muted || typeof dexNum !== 'number') return;

    if (opts && opts.after) {
      let wait = CRY_AFTER_PAD;
      try { wait = Math.max(0, scheduledUntil - getCtx().currentTime) + CRY_AFTER_PAD; } catch (_) { /* keep default */ }
      lastPlayAt = performance.now();
      setTimeout(() => cry(dexNum), wait * 1000);
      return;
    }

    try { cryImpl(dexNum); lastPlayAt = performance.now(); }
    catch (_) { /* fail silently if Web Audio is unavailable */ }
  }

  // Every gain in cryImpl below (note peaks, the sub layer, the noise burst)
  // is multiplied by this before scheduling. One knob to retune loudness
  // without having to touch each tier's numbers individually.
  const CRY_VOLUME = 0.55;

  function cryImpl(dexNum) {
    const tier = (typeof getCryTier === 'function') ? getCryTier(dexNum) : 1;
    const T    = CRY_TIERS[tier] || CRY_TIERS[1];
    const rng  = makeRng(dexNum);
    const ac   = getCtx();
    const t0   = ac.currentTime;

    const baseFreq = lerp(rng(), T.freq);
    const dur      = lerp(rng(), T.dur);
    const duty     = lerp(rng(), T.duty);
    const detune   = lerp(rng(), T.detune);

    const noteCount = 3 + Math.floor(rng() * 4);               // 3-6 notes
    const shapeName = SHAPE_NAMES[Math.floor(rng() * SHAPE_NAMES.length)];
    const shape     = SHAPES[shapeName](noteCount, rng);

    // How much each note holds before dipping toward the next one. 'fall'
    // leans toward holding longer (a sustained roar); 'stutter' leans
    // toward cutting short (a clipped re-attack on every note).
    let sustain = 0.45 + rng() * 0.35;
    if (shapeName === 'fall')    sustain = Math.min(0.88, sustain + 0.10);
    if (shapeName === 'stutter') sustain = Math.max(0.25, sustain - 0.15);

    // Note lengths: randomized weights (the gap note in 'double' always
    // short) normalized against the cry's total duration.
    const weights = Array.from({ length: noteCount }, (_, i) =>
      i === shape.gapIndex ? 0.35 : 0.7 + rng() * 0.9);
    const wSum = weights.reduce((a, b) => a + b, 0);

    const notes = [];
    let tCursor = 0;
    for (let i = 0; i < noteCount; i++) {
      const tStart = tCursor;
      const tEnd   = tCursor + (weights[i] / wSum) * dur;
      tCursor = tEnd;

      const isLast = i === noteCount - 1;
      const isGap  = i === shape.gapIndex;
      let peak = T.peakBase * (1 - 0.12 * i / Math.max(1, noteCount - 1)) + (rng() - 0.5) * 0.02;
      if (isGap) peak *= 0.18; // a breath, not a note

      notes.push({
        freqMul: shape.freqMuls[i],
        tStart, tEnd,
        peak: peak * CRY_VOLUME,
        decayTo: isLast ? 0.02 + rng() * 0.04 : sustain,
      });
    }

    const wave = pulseWave(ac, duty);
    const end1 = cryVoice(ac, wave, notes, baseFreq, 1,      1,               t0);
    const end2 = cryVoice(ac, wave, notes, baseFreq, detune, 0.45 + rng() * 0.15, t0);

    // Final-form sub layer — triangle an octave down, for the body a thin
    // pulse wave can't supply on its own.
    if (T.sub) {
      const sub    = ac.createOscillator();
      sub.type     = 'triangle';
      const subEnv = ac.createGain();
      sub.connect(subEnv); subEnv.connect(ac.destination);
      subEnv.gain.setValueAtTime(0.0001, t0);
      for (const n of notes) {
        sub.frequency.setValueAtTime(baseFreq * n.freqMul * 0.5, t0 + n.tStart);
        subEnv.gain.linearRampToValueAtTime(0.13 * CRY_VOLUME, t0 + n.tStart + 0.015);
        subEnv.gain.exponentialRampToValueAtTime(Math.max(0.0005, 0.13 * CRY_VOLUME * n.decayTo), t0 + n.tEnd);
      }
      sub.start(t0); sub.stop(t0 + dur + 0.02);
    }

    // Noise-channel grit, under the loudest note — present only some of
    // the time (see CRY_TIERS' noiseChance): in the real data noise is tied
    // to a cry's CHARACTER more than its size, so some tier-3 cries get none
    // and some tier-1 cries get a touch, same buffer-noise technique as
    // blend()'s scream at a fraction of the level.
    if (rng() < T.noiseChance) {
      let loudIdx = 0;
      for (let i = 1; i < notes.length; i++) if (notes[i].peak > notes[loudIdx].peak) loudIdx = i;
      const nStart = t0 + notes[loudIdx].tStart;
      const nEnd   = t0 + notes[Math.min(notes.length - 1, loudIdx + 1)].tEnd;
      const nDur   = nEnd - nStart;
      const noiseAmt = lerp(rng(), T.noiseAmt);

      if (nDur > 0.01) {
        const bufSize = Math.ceil(ac.sampleRate * nDur);
        const buf  = ac.createBuffer(1, bufSize, ac.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

        const src  = ac.createBufferSource();
        src.buffer = buf;
        const bpf  = ac.createBiquadFilter();
        bpf.type   = 'bandpass';
        bpf.Q.value = 0.7;
        bpf.frequency.setValueAtTime(baseFreq * 5, nStart);
        bpf.frequency.exponentialRampToValueAtTime(Math.max(120, baseFreq * 1.5), nEnd);
        const nEnv = ac.createGain();
        nEnv.gain.setValueAtTime(noiseAmt * CRY_VOLUME, nStart);
        nEnv.gain.exponentialRampToValueAtTime(0.0003, nEnd);

        src.connect(bpf); bpf.connect(nEnv); nEnv.connect(ac.destination);
        src.start(nStart); src.stop(nEnd + 0.02);
      }
    }

    const end = Math.max(end1, end2, t0 + dur) + 0.02;
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

    // ── Evolution ─────────────────────────────────────────────
    // Follows the order Gen 1/2 Pokémon play it in (pokered
    // engine/movie/evolution.asm, pokecrystal evolution_animation.asm):
    // a tink, the OLD form's cry, a looping tune under the flicker (see
    // startLoop), silence and a sparkle burst on the change, the NEW form's
    // cry, then a jingle. Stopping it cuts the tune and plays the old cry
    // again, with no jingle. The cue points live in EvolutionScreen (game.js).

    // Tiny high tink → evolution screen opens
    evoTink() {
      const t = getCtx().currentTime;
      tone(2093, 'square',   t,        0.035, 0.10);  // C7
      tone(3136, 'triangle', t + 0.03, 0.07,  0.07);  // G7 ring
    },

    // Rising charge-up sweep → old/new flicker. Lasts the flicker's 64
    // frames (~1.07s) and ends right where the sparkle takes over.
    evoCharge() {
      const t = getCtx().currentTime;
      tone({ start: 220, end: 1760 }, 'square',   t, 1.05, 0.05);
      tone({ start: 110, end: 880  }, 'triangle', t, 1.05, 0.10);
    },

    // Impact + twinkle cascade → new form appears. Gold/Silver's
    // SFX_EVOLVED stands in the same spot, with the balls of light.
    evoSparkle() {
      const t = getCtx().currentTime;
      tone(131, 'triangle', t, 0.25, 0.18);                         // C3 whomp
      [1568, 2093, 2637, 3136, 2637, 3136, 3520, 4186].forEach((f, i) =>
        tone(f, 'triangle', t + i * 0.045, 0.09, 0.12));            // G6 → C8 twinkles
      tone({ start: 1047, end: 4186 }, 'sine', t + 0.05, 0.45, 0.05); // shimmer sweep
    },

    // "Grand March" → "CONGRATULATIONS!". Its own tune on purpose: the
    // screen used to borrow levelUp, so evolving sounded like any level-up.
    // Picked by the owner from seven options, then cut to its first 1.5s —
    // the original went on to a B5-D6-C6 tag, which was dropped on request —
    // and given a D6 leading into a held C-major chord and a short chord stab.
    evoFanfare() {
      const t = getCtx().currentTime;
      tone(392,  'square', t,        0.12, 0.20);  // G4
      tone(523,  'square', t + 0.15, 0.12, 0.20);  // C5
      tone(659,  'square', t + 0.30, 0.12, 0.20);  // E5
      tone(784,  'square', t + 0.45, 0.28, 0.20);  // G5
      tone(659,  'square', t + 0.78, 0.12, 0.20);  // E5
      tone(784,  'square', t + 0.93, 0.12, 0.20);  // G5
      tone(1175, 'square', t + 1.08, 0.12, 0.20);  // D6 — steps down into the hold
      tone(1047, 'square', t + 1.23, 0.48, 0.22);  // C6 hold, as a full chord
      tone(659,  'square', t + 1.23, 0.48, 0.07);  // E5
      tone(784,  'square', t + 1.23, 0.48, 0.06);  // G5
      tone(131,  'triangle', t,        0.28, 0.18);  // C3 bass
      tone(98,   'triangle', t + 0.45, 0.28, 0.18);  // G2
      tone(110,  'triangle', t + 0.78, 0.28, 0.18);  // A2
      tone(98,   'triangle', t + 1.08, 0.12, 0.18);  // G2 under the D6
      tone(131,  'triangle', t + 1.23, 0.51, 0.20);  // C3 — home
      // A beat of rest, then one short C-major stab over a deep bass to close.
      [523, 659, 784, 1047].forEach((f, i) =>       // C5 E5 G5 C6
        tone(f, 'square', t + 1.79, 0.20, i === 0 || i === 3 ? 0.10 : 0.08));
      tone(65,   'triangle', t + 1.79, 0.28, 0.22);  // C2
    },

    // Deflating sweep → player pressed STOP
    evoPowerDown() {
      const t = getCtx().currentTime;
      tone({ start: 880, end: 110 }, 'square',   t,        0.50, 0.12);
      tone({ start: 440, end: 55  }, 'triangle', t + 0.02, 0.55, 0.14);
    },

    // Engine rev + an 8-bit scream → mon blended into smoothie
    // Gains are the original mix at 70%. Every level is scaled by the same
    // factor — engine envelope, LFO depth, both overtones and the exhaust
    // noise — so the balance between the layers is unchanged; retune them
    // together rather than moving one. The 0.001 ramp targets are silence,
    // not levels, and are left alone.
    blend() {
      const ac  = getCtx();
      const t   = ac.currentTime;

      // ── Running order ──────────────────────────────────────
      // The two overlap: the blender starts, and the scream happens DURING
      // it. The 0.18s offset lets the motor catch before the mon reacts, and
      // 0.18 + 1.30 = 1.48s leaves the scream finishing comfortably inside
      // the blender's 1.8s, so the rev outlasts it rather than cutting off
      // underneath it.
      //
      // Both halves below are timed off their own start constant rather than
      // off t, so re-ordering them is these two lines and nothing else: give
      // scT a later time than engT + dur to put the scream after the blender,
      // or engT a later time than scT + scDur to put it before.
      const dur   = 1.8;    // how long the blender runs
      const scDur = 0.85;   // how long the scream lasts
      const engT  = t;
      const scT   = t + 0.18;

      // ── Main engine oscillator: low square wave revving up then winding down
      const osc      = ac.createOscillator();
      osc.type       = 'square';
      osc.frequency.setValueAtTime(55, engT);
      osc.frequency.linearRampToValueAtTime(240, engT + dur * 0.6);
      osc.frequency.linearRampToValueAtTime(70,  engT + dur);

      const env = ac.createGain();
      env.gain.setValueAtTime(0.059, engT);
      env.gain.linearRampToValueAtTime(0.063, engT + dur * 0.6);
      env.gain.exponentialRampToValueAtTime(0.001, engT + dur);

      // ── LFO: simulates engine cylinder firing (put-put-put effect)
      const lfo      = ac.createOscillator();
      lfo.type       = 'sine';
      lfo.frequency.setValueAtTime(22, engT);           // low RPM at start
      lfo.frequency.linearRampToValueAtTime(95, engT + dur * 0.6);  // rev up
      lfo.frequency.linearRampToValueAtTime(30, engT + dur);         // wind down

      const lfoDepth      = ac.createGain();
      lfoDepth.gain.value = 0.046;

      lfo.connect(lfoDepth);
      lfoDepth.connect(env.gain);
      osc.connect(env);
      env.connect(ac.destination);

      osc.start(engT); osc.stop(engT + dur + 0.05);
      lfo.start(engT); lfo.stop(engT + dur + 0.05);

      // ── Harmonic overtone: one octave up, lower gain
      tone({ start: 110, end: 480 }, 'square', engT,          dur * 0.6,  0.042);
      tone({ start: 480, end: 140 }, 'square', engT + dur * 0.55, dur * 0.5, 0.028);

      // ── Exhaust grit: low-pass filtered noise underneath
      const bufSize = Math.ceil(ac.sampleRate * dur);
      const buf     = ac.createBuffer(1, bufSize, ac.sampleRate);
      const data    = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

      const exhaust     = ac.createBufferSource();
      exhaust.buffer    = buf;
      const lpf         = ac.createBiquadFilter();
      lpf.type          = 'lowpass';
      lpf.frequency.setValueAtTime(300, engT);
      lpf.frequency.linearRampToValueAtTime(800, engT + dur * 0.6);
      lpf.frequency.linearRampToValueAtTime(200, engT + dur);
      const exhaustEnv  = ac.createGain();
      exhaustEnv.gain.setValueAtTime(0.035, engT);
      exhaustEnv.gain.exponentialRampToValueAtTime(0.001, engT + dur);

      exhaust.connect(lpf);
      lpf.connect(exhaustEnv);
      exhaustEnv.connect(ac.destination);
      exhaust.start(engT);
      exhaust.stop(engT + dur + 0.05);

      // ── The mon's last word ────────────────────────────────
      // A scream is not a loud "ahh". What separates a scream from a calm
      // vocalisation is ROUGHNESS: fast amplitude modulation in the 30-150Hz
      // band (Arnal et al. 2015). Speech modulates at 4-5Hz; a scream carries
      // a much faster flutter on top, too fast for the ear to resolve into
      // pulses, so it is heard as harshness instead. Several earlier passes
      // here were smooth tones with the right vowel and the right pitch and
      // still sounded gentle, because a smooth tone has no energy in that
      // band at all. Four things build the scream, in order of how much they
      // matter:
      //
      //   1. roughGate   — the 30-150Hz roughness. The whole effect.
      //   2. SC_ARC      — MOVEMENT. Roughness alone still reads as a held
      //                    note: an earlier pass drifted 520→470Hz across the
      //                    sustain under a dead-flat level, and was reported as
      //                    "too monotone for a scream". See below.
      //   3. shaper      — waveshaper distortion, standing in for the chaotic
      //                    vocal-fold vibration of a real shout. Smudges the
      //                    harmonics and fills the spectrum.
      //   4. scSub       — a subharmonic an octave down, the other classic
      //                    nonlinear vocal phenomenon. Adds weight, and its
      //                    harmonics halve the spacing feeding the formants.
      //
      // Then formant filters shape it into the /ae/ of "apple" (see the
      // formant table below), riding the pitch as it goes. Turning roughGate
      // off (depth 0) returns this to the gentle version.
      //
      // One thing that did NOT survive testing: driving the roughness from a
      // per-cycle randomised buffer instead of a sine, to imitate real vocal
      // jitter. It was inaudible in an A/B against this version, and no
      // measurement could separate the two either — the 62→110Hz sweep already
      // spreads that energy across the band. Not worth two buffer generators.

      // Pitch contour, shared by the fundamental, the subharmonic and the
      // formants, so none of them can drift apart.
      //
      // A scream MOVES. The version this replaced drifted 520→470Hz over the
      // sustain — 1.7 semitones, one held note. This arc travels about 7.6
      // semitones while the sound is still loud: a panic spike up, a strained
      // sag, then the collapse.
      //
      // Why earlier attempts at a moving pitch were abandoned, because it is
      // not obvious: they moved the pitch while the formants below stayed
      // FIXED, and that is what produced the "wow"/"ow" diphthong they were
      // rejected for. A vowel is defined by where the formants sit RELATIVE to
      // the pitch, so sliding one past the other changes the vowel. Real
      // voices raise their formants as they strain; FORMANT_TRACK further down
      // does the same, which is what lets this arc exist without the vowel
      // breaking. Do not add pitch movement here without it.
      //
      // Last leg is exponential (the voice giving out); the rest are linear.
      const SC_ARC = [      // [seconds after scT, Hz]
        [0,     460],
        [0.10,  905],       // panic spike
        [0.30,  850],
        [0.52,  770],       // straining
        [scDur, 300],       // gives out
      ];
      const scPitch = (param, mult) => {
        param.setValueAtTime(SC_ARC[0][1] * mult, scT);
        for (let i = 1; i < SC_ARC.length; i++) {
          const [dt, hz] = SC_ARC[i];
          if (i === SC_ARC.length - 1) param.exponentialRampToValueAtTime(hz * mult, scT + dt);
          else                         param.linearRampToValueAtTime(hz * mult, scT + dt);
        }
      };

      const scSrc = ac.createOscillator();
      scSrc.type  = 'sawtooth';   // rich in harmonics; a square starves the formants
      scPitch(scSrc.frequency, 1);

      const scSub = ac.createOscillator();
      scSub.type  = 'sawtooth';
      scPitch(scSub.frequency, 0.5);

      // Vibrato, on the fundamental only — leaving the subharmonic steady
      // decouples the two slightly, which is itself a source of roughness.
      // Depth is 1-2% on purpose: a few Hz of wobble per second is speech's
      // syllable rate, and at ~7% this read as "AH-AH-AH" rather than one
      // held note.
      const wob      = ac.createOscillator();
      wob.type       = 'sine';
      wob.frequency.value = 5.5;
      const wobDepth = ac.createGain();
      wobDepth.gain.setValueAtTime(5, scT);
      wobDepth.gain.linearRampToValueAtTime(10, scT + scDur);
      wob.connect(wobDepth);
      wobDepth.connect(scSrc.frequency);

      // Breath rasp. Reuses the exhaust's noise buffer; one AudioBuffer can
      // feed any number of sources.
      const rasp      = ac.createBufferSource();
      rasp.buffer     = buf;
      const raspGain  = ac.createGain();
      raspGain.gain.value = 0.16;

      const subGain = ac.createGain();
      subGain.gain.value = 0.5;

      const voice = ac.createGain();
      voice.gain.value = 0.5;
      scSrc.connect(voice);
      scSub.connect(subGain);  subGain.connect(voice);
      rasp.connect(raspGain);  raspGain.connect(voice);

      // (2) Chaos. tanh clipping: harmonics multiply and the peaks flatten,
      // which is what an over-driven larynx does. DRIVE is the harshness
      // dial — 1 is clean, 8 is a shriek.
      const DRIVE  = 5;
      const curve  = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) curve[i] = Math.tanh((i * 2 / 1024 - 1) * DRIVE);
      const shaper = ac.createWaveShaper();
      shaper.curve = curve;
      shaper.oversample = '4x';

      // (1) Roughness. Gain swings between 0.15 and 1.0 at 60-110Hz — inside
      // the 30-150Hz window, and well clear of the 4-5Hz speech rate below
      // it. Rate climbs as the scream strains. Drop roughDepth toward 0 to
      // soften; raising the rate past ~150 turns harsh into buzzy.
      const roughGate  = ac.createGain();
      roughGate.gain.value = 0.575;
      const rough      = ac.createOscillator();
      rough.type       = 'sine';
      rough.frequency.setValueAtTime(62, scT);
      rough.frequency.linearRampToValueAtTime(110, scT + scDur);
      const roughDepth = ac.createGain();
      roughDepth.gain.value = 0.425;
      rough.connect(roughDepth);
      roughDepth.connect(roughGate.gain);

      voice.connect(shaper);
      shaper.connect(roughGate);

      // Output envelope. This used to ramp up and then hold at EXACTLY 0.17 for
      // half a second, which is the other half of why it read as monotone — a
      // flat pitch under a flat level. Rendering the envelope on its own put
      // numbers on it: 82% of the loud stretch was frozen and the level never
      // once changed direction. It now swells, breaks, and swells again before
      // giving out, which is what a voice running out of air does.
      //
      // 0.20 peak puts the scream well over the engine (0.063) and exhaust
      // (0.035) it plays against — it leads the sound rather than sitting
      // inside it. All three together peak around 0.30, so there is still
      // plenty of headroom before clipping.
      const scEnv = ac.createGain();
      scEnv.gain.setValueAtTime(0.0001, scT);
      scEnv.gain.linearRampToValueAtTime(0.130, scT + 0.03);
      scEnv.gain.linearRampToValueAtTime(0.195, scT + 0.14);
      scEnv.gain.linearRampToValueAtTime(0.140, scT + 0.28);  // strain break
      scEnv.gain.linearRampToValueAtTime(0.200, scT + 0.44);
      scEnv.gain.linearRampToValueAtTime(0.170, scT + 0.60);
      scEnv.gain.exponentialRampToValueAtTime(0.001, scT + scDur);

      // The vowel: [centre Hz, Q, level]. This is /ae/ — the A in "apple",
      // "cat", "trap". NOT the /ah/ of "say ahh" at the doctor, which is a
      // different vowel and which this used to be: 730/1090/2440. The two
      // are told apart almost entirely by the MIDDLE number. F2 is the
      // front-back axis: /ae/ is a front vowel and puts it high, around
      // 2100; /ah/ is a back vowel and puts it near 1090. With F2 down there
      // the scream came out soft and rounded no matter how rough or loud it
      // got, because it was the wrong vowel, not a wrong scream.
      //
      // Reference (adult male; ours run higher, scaled for a small creature):
      //   /ae/ apple  660 / 1720 / 2410      /ah/ father  730 / 1090 / 2440
      //   /ee/ heed   270 / 2290 / 3010      /oo/ boot    300 /  870 / 2240
      //
      // Q is bandwidth, centre over Q: keep it low enough that each window
      // stays wider than the gaps between the source's harmonics, or the
      // sound thins out to nothing. F2 carries the vowel's identity here, so
      // it is mixed loud — front vowels lean on it.
      // How far the formants follow the pitch. 0 pins them where they are,
      // which is what broke every earlier attempt at a moving pitch (see
      // SC_ARC); 1 would move them in lockstep, holding the vowel perfectly
      // but sounding mechanical, since a real tract does not scale that
      // cleanly. 0.5 was picked by A/B against 0 and 0.45. The vowel opens up
      // as the pitch climbs — intended: that is what straining sounds like.
      //
      // The numbers below stay the RESTING values, at the arc's opening pitch.
      const FORMANT_TRACK = 0.5;
      for (const [freq, q, level] of [[900, 3, 1.0], [2100, 3.5, 0.85], [2900, 4, 0.35]]) {
        const bp  = ac.createBiquadFilter();
        bp.type   = 'bandpass';
        bp.Q.value         = q;
        const track = (hz) => freq * (1 + FORMANT_TRACK * (hz / SC_ARC[0][1] - 1));
        bp.frequency.setValueAtTime(track(SC_ARC[0][1]), scT);
        for (let i = 1; i < SC_ARC.length; i++) {
          bp.frequency.linearRampToValueAtTime(track(SC_ARC[i][1]), scT + SC_ARC[i][0]);
        }
        const fg  = ac.createGain();
        fg.gain.value = level;
        roughGate.connect(bp);
        bp.connect(fg);
        fg.connect(scEnv);
      }

      scEnv.connect(ac.destination);
      scSrc.start(scT);  scSrc.stop(scT + scDur + 0.05);
      scSub.start(scT);  scSub.stop(scT + scDur + 0.05);
      wob.start(scT);    wob.stop(scT + scDur + 0.05);
      rough.start(scT);  rough.stop(scT + scDur + 0.05);
      rasp.start(scT);   rasp.stop(scT + scDur + 0.05);
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
    if (muted) stopLoop();
    return muted;
  }

  // ── Evolution loop ───────────────────────────────────────────
  // The one sound that runs until told to stop, so it can't be a sounds{}
  // entry: it's scheduled a few notes at a time, 0.15s ahead on the audio
  // clock, and every note plays through one bus that stopLoop() fades out.
  // An original tune, not Nintendo's: a minor arpeggio climbing a semitone
  // every second (A, B♭, B, C) over a pulsing bass — 4s a cycle, so the
  // ~3.7s it plays for is one long climb that tops out as the flicker ends.
  const LOOP_STEP  = 0.125;   // seconds per note
  const LOOP_AHEAD = 0.15;    // how far ahead to schedule
  const LOOP_ARP   = [0, 3, 7, 12];
  let loop = null;

  function loopNotes(step, t, bus) {
    const k = Math.floor(step / 8) % 4;   // semitones up: A, B♭, B, C
    const i = step % 8;
    tone(440 * Math.pow(2, (k + LOOP_ARP[i % 4]) / 12), 'square', t, 0.10, 0.06, bus);
    if (i % 2 === 0) tone(110 * Math.pow(2, k / 12), 'triangle', t, 0.11, 0.16, bus);
  }

  function startLoop() {
    if (muted) return;
    stopLoop();
    try {
      const ac  = getCtx();
      const bus = ac.createGain();
      bus.connect(ac.destination);
      const l = { bus, step: 0, nextAt: ac.currentTime + 0.05, timer: null };
      const pump = () => {
        // A background tab throttles the timer to ~1s; skip the notes it
        // missed rather than firing them all at once when it wakes.
        if (l.nextAt < ac.currentTime) {
          const missed = Math.ceil((ac.currentTime - l.nextAt) / LOOP_STEP);
          l.step += missed; l.nextAt += missed * LOOP_STEP;
        }
        while (l.nextAt < ac.currentTime + LOOP_AHEAD) {
          loopNotes(l.step++, l.nextAt, bus);
          l.nextAt += LOOP_STEP;
        }
      };
      pump();
      l.timer = setInterval(pump, 25);
      loop = l;
      lastPlayAt = performance.now();
    } catch (_) { /* fail silently if Web Audio is unavailable */ }
  }

  // Safe to call when nothing is playing. Fades over 30ms rather than
  // cutting, which would click.
  function stopLoop() {
    if (!loop) return;
    const l = loop;
    loop = null;
    clearInterval(l.timer);
    try {
      const t = getCtx().currentTime;
      l.bus.gain.setValueAtTime(1, t);
      l.bus.gain.linearRampToValueAtTime(0, t + 0.03);
      setTimeout(() => { try { l.bus.disconnect(); } catch (_) {} }, 400);
    } catch (_) {}
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

  // Create/resume the AudioContext ahead of the first sound. Call from a user
  // gesture (pointerdown/keydown) so the first real sound has no setup cost.
  function warm() { try { getCtx(); } catch (_) {} }

  return { play, toggle, isMuted, cry, warm, startLoop, stopLoop };
})();
