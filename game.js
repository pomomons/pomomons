// game.js — all Canvas drawing lives here (per CLAUDE.md)

// ── Shared sprite renderer ────────────────────────────────
// Used by EncounterScreen (encounter canvas) and Collection (card thumbnails).
const MonSprite = (() => {
  function block(ctx, color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  // Draw a mon centred on (cx, cy) into an already-obtained ctx.
  function drawOnCtx(ctx, mon, cx, cy, { scale = 1, xOffset = 0, alpha = 1, shiny = false } = {}) {
    ctx.save();
    ctx.globalAlpha = alpha;

    const bw = 48 * scale, bh = 48 * scale;
    const x0 = cx - bw / 2 + xOffset;
    const y0 = cy - bh / 2;

    // Shiny colour overrides
    const bodyColor   = shiny ? '#f1c40f' : mon.color;
    const accentColor = shiny ? '#d4ac0d' : mon.accent;

    // Drop shadow
    ctx.globalAlpha = alpha * 0.2;
    block(ctx, 'rgba(0,0,0,0.6)',
      cx - bw * 0.45 + xOffset, cy + bh / 2 + 3,
      bw * 0.9, 5 * scale
    );
    ctx.globalAlpha = alpha;

    // Body
    block(ctx, bodyColor, x0, y0, bw, bh);

    // Ears
    const ew = 10 * scale, eh = 12 * scale;
    block(ctx, bodyColor, x0 + 4 * scale,           y0 - eh + 2 * scale, ew, eh);
    block(ctx, bodyColor, x0 + bw - ew - 4 * scale, y0 - eh + 2 * scale, ew, eh);

    // Eyes
    const eyeY  = y0 + bh * 0.30;
    const eSize = 6 * scale;
    const eyeLX = cx - 11 * scale + xOffset;
    const eyeRX = cx + 5  * scale + xOffset;
    block(ctx, '#2c2c2c', eyeLX, eyeY, eSize, eSize);
    block(ctx, '#2c2c2c', eyeRX, eyeY, eSize, eSize);
    block(ctx, '#fff', eyeLX + 2 * scale, eyeY + scale, 2 * scale, 2 * scale);
    block(ctx, '#fff', eyeRX + 2 * scale, eyeY + scale, 2 * scale, 2 * scale);

    // Blush
    const blushColor = bodyColor + '99';
    const blushY = eyeY + eSize + 3 * scale;
    block(ctx, blushColor, eyeLX - 2 * scale, blushY, 10 * scale, 4 * scale);
    block(ctx, blushColor, eyeRX - 2 * scale, blushY, 10 * scale, 4 * scale);

    // Mouth (pixel smile)
    const mY = blushY + 6 * scale;
    const mX = cx - 6 * scale + xOffset;
    block(ctx, accentColor, mX,             mY,             4 * scale, 2 * scale);
    block(ctx, accentColor, mX + 4 * scale, mY + 2 * scale, 4 * scale, 2 * scale);
    block(ctx, accentColor, mX + 8 * scale, mY,             4 * scale, 2 * scale);

    // Shiny sparkle (small cross above right ear)
    if (shiny) {
      ctx.fillStyle = '#fff';
      const sx = x0 + bw - ew + 2 * scale;
      const sy = y0 - eh - 6 * scale;
      ctx.fillRect(Math.round(sx),             Math.round(sy + 2 * scale), Math.round(2 * scale), Math.round(6 * scale));
      ctx.fillRect(Math.round(sx - 2 * scale), Math.round(sy + 4 * scale), Math.round(6 * scale), Math.round(2 * scale));
    }

    ctx.restore();
  }

  // Convenience: clear a canvas and draw a mon centred in it.
  function draw(canvas, mon, { scale = 1, shiny = false } = {}) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawOnCtx(ctx, mon, canvas.width / 2, canvas.height / 2, { scale, shiny });
  }

  return { drawOnCtx, draw };
})();

// ── Companion idle animation ───────────────────────────────
const CompanionCanvas = (() => {
  const CANVAS_SIZE = 160; // logical px (canvas element attribute)

  // Placeholder sprite definition — replace with real sprite sheet later.
  // A simple pixel creature: colored body block + two eyes + blush marks.
  const SPRITE = {
    bodyColor:  '#e74c3c',   // tomato red
    eyeColor:   '#2c2c2c',
    blushColor: '#f1948a',
    shadowColor:'rgba(0,0,0,0.15)',
  };

  // Bob animation state
  const state = {
    y:         0,      // current vertical offset
    vy:        0,      // velocity
    squishY:   1,      // vertical scale for squash/stretch
    squishX:   1,      // horizontal scale
    frame:     0,      // animation frame counter
    blinkTimer:0,      // frames until next blink
    blinking:  false,
    blinkFrame:0,
    eyeOffset: 0,      // subtle side-to-side eye wander
    eyeDir:    1,
  };

  let canvas, ctx, rafId;

  // ── pixel helpers ──────────────────────────────────────
  function px(n) { return Math.round(n); }

  // Draw one "pixel block" at logical pixel coordinates.
  function block(color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(px(x), px(y), px(w), px(h));
  }

  // ── draw the placeholder sprite ────────────────────────
  // The sprite is drawn centred in the canvas.
  // Origin (0,0) = top-left of canvas.
  function drawSprite(bobY, sqX, sqY) {
    const cx = CANVAS_SIZE / 2;
    const cy = CANVAS_SIZE / 2;

    // Body dimensions (before squish)
    const bw = 48, bh = 48;
    // Apply squash/stretch around the centre
    const drawW = bw * sqX;
    const drawH = bh * sqY;
    const x0 = cx - drawW / 2;
    const y0 = cy - drawH / 2 + bobY;

    // Drop shadow
    ctx.save();
    ctx.globalAlpha = 0.25 * (1 - Math.abs(bobY) / 18);
    block(SPRITE.shadowColor,
      cx - (drawW * 0.9) / 2,
      cy + bh / 2 + 4 + bobY * 0.3,
      drawW * 0.9, 6 * sqX
    );
    ctx.restore();

    // Body
    block(SPRITE.bodyColor, x0, y0, drawW, drawH);

    // Ear-like bumps on top
    const earW = 10 * sqX, earH = 12 * sqY;
    block(SPRITE.bodyColor, x0 + 4 * sqX,        y0 - earH + 2, earW, earH);
    block(SPRITE.bodyColor, x0 + drawW - earW - 4 * sqX, y0 - earH + 2, earW, earH);

    // Eyes
    const eyeY   = y0 + drawH * 0.30;
    const eyeSize = 6 * sqX;
    const eyeLX  = cx - 11 * sqX + state.eyeOffset;
    const eyeRX  = cx + 5  * sqX + state.eyeOffset;

    if (!state.blinking) {
      block(SPRITE.eyeColor, eyeLX, eyeY, eyeSize, eyeSize * sqY);
      block(SPRITE.eyeColor, eyeRX, eyeY, eyeSize, eyeSize * sqY);
      // Eye shine
      block('#fff', eyeLX + 2, eyeY + 1, 2, 2);
      block('#fff', eyeRX + 2, eyeY + 1, 2, 2);
    } else {
      // Blink: thin horizontal line
      const blinkH = Math.max(1, eyeSize * 0.2 * sqY);
      block(SPRITE.eyeColor, eyeLX, eyeY + eyeSize * sqY / 2 - blinkH / 2, eyeSize, blinkH);
      block(SPRITE.eyeColor, eyeRX, eyeY + eyeSize * sqY / 2 - blinkH / 2, eyeSize, blinkH);
    }

    // Blush marks
    const blushY = eyeY + eyeSize * sqY + 3 * sqY;
    block(SPRITE.blushColor, eyeLX - 2, blushY, 10 * sqX, 4 * sqY);
    block(SPRITE.blushColor, eyeRX - 2, blushY, 10 * sqX, 4 * sqY);

    // Mouth — simple 3-pixel smile
    const mouthY = blushY + 6 * sqY;
    const mouthX = cx - 6 * sqX;
    block(SPRITE.eyeColor, mouthX,            mouthY,             4 * sqX, 2 * sqY);
    block(SPRITE.eyeColor, mouthX + 4 * sqX,  mouthY + 2 * sqY,   4 * sqX, 2 * sqY);
    block(SPRITE.eyeColor, mouthX + 8 * sqX,  mouthY,             4 * sqX, 2 * sqY);
  }

  // ── animation tick ─────────────────────────────────────
  function tick() {
    state.frame++;

    // --- Sinusoidal bob ---
    // Period ~90 frames (~1.5 s at 60 fps). Amplitude 10 px.
    state.y = Math.sin(state.frame / 28) * 10;

    // Squash at bottom of arc, stretch at top
    const t = Math.sin(state.frame / 28); // -1 to 1
    // Compress vertically at peak of downward travel (t near -1)
    state.squishY = 1 - t * 0.08;         // 0.92 – 1.08
    state.squishX = 1 + t * 0.04;         // 0.96 – 1.04

    // --- Blink ---
    if (!state.blinking) {
      state.blinkTimer--;
      if (state.blinkTimer <= 0) {
        state.blinking  = true;
        state.blinkFrame = 0;
        // Next blink in 3-6 seconds (180-360 frames)
        state.blinkTimer = 180 + Math.floor(Math.random() * 180);
      }
    } else {
      state.blinkFrame++;
      if (state.blinkFrame > 8) state.blinking = false;
    }

    // --- Eye wander ---
    state.eyeOffset += state.eyeDir * 0.04;
    if (Math.abs(state.eyeOffset) > 2) state.eyeDir *= -1;

    // --- Draw ---
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    drawSprite(state.y, state.squishX, state.squishY);

    rafId = requestAnimationFrame(tick);
  }

  // ── public API ─────────────────────────────────────────
  // Re-skin the companion with a caught mon's colours (called by collection.js).
  function setMon(mon) {
    SPRITE.bodyColor  = mon.color;
    SPRITE.blushColor = mon.color + '99';
  }

  function init(canvasEl) {
    canvas = canvasEl;
    ctx    = canvas.getContext('2d');

    // HiDPI / retina support: scale the drawing buffer by devicePixelRatio
    // so sprites stay crisp on high-density screens. CSS size stays at 160px
    // (set via HTML attribute or stylesheet); we only grow the buffer here.
    const dpr = window.devicePixelRatio || 1;
    if (dpr !== 1) {
      canvas.width  = CANVAS_SIZE * dpr;
      canvas.height = CANVAS_SIZE * dpr;
      ctx.scale(dpr, dpr);
    }

    // Kick off blink timer
    state.blinkTimer = 120 + Math.floor(Math.random() * 120);

    tick();
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
  }

  return { init, stop, setMon };
})();

// ── Encounter screen ───────────────────────────────────────
const EncounterScreen = (() => {
  const SIZE = 200; // logical canvas size

  // DOM refs (resolved on first start() call)
  let overlay, canvas, ctx,
      elMsg, elSub, elRarity, elControls,
      btnThrow, btnFlee, catchDots;

  let rafId    = null;
  let onDone   = null;

  // State machine
  const st = {
    phase:   'idle',  // appearing|idle|throwing|shaking|result|done
    mon:     null,
    caught:  false,
    frame:   0,       // general counter, reset each phase
    dpr:     1,
    monY:    0,       // current bob offset (idle phase)
    monBob:  0,       // frame counter for idle bob
  };

  // ── draw a wild mon sprite centred at (cx, cy) ────────────
  function drawMon(cx, cy, { scale = 1, xOffset = 0, alpha = 1 } = {}) {
    MonSprite.drawOnCtx(ctx, st.mon, cx, cy, { scale, xOffset, alpha, shiny: st.mon.shiny || false });
  }

  // ── draw the tomato projectile ────────────────────────────
  // t: 0→1 progress along arc
  function drawTomato(t) {
    const startX = SIZE / 2, startY = SIZE - 16;
    const endX   = SIZE / 2, endY   = SIZE * 0.28;
    const arcH   = 70; // px, arc peak height above straight line

    const x = startX + (endX - startX) * t;
    const y = startY + (endY - startY) * t - arcH * Math.sin(Math.PI * t);
    const r = 12 - 6 * t; // shrinks from 12→6 as it approaches mon

    ctx.save();
    ctx.beginPath();
    ctx.arc(Math.round(x), Math.round(y), Math.max(1, r), 0, Math.PI * 2);
    ctx.fillStyle = '#e74c3c';
    ctx.fill();
    // Stem
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - r - 4, 2, 5);
    ctx.restore();
  }

  // ── phase draw dispatcher ─────────────────────────────────
  function draw() {
    ctx.clearRect(0, 0, SIZE, SIZE);
    const cx = SIZE / 2;
    const f  = st.frame;

    if (st.phase === 'appearing') {
      // Slide down from above; ease out over 30 frames
      const t  = Math.min(1, f / 30);
      const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out
      const cy = SIZE * 0.32 * ease + SIZE * 0.01;
      drawMon(cx, cy);

    } else if (st.phase === 'idle') {
      st.monBob++;
      st.monY = Math.sin(st.monBob / 22) * 6;
      drawMon(cx, SIZE * 0.32 + st.monY);

    } else if (st.phase === 'throwing') {
      // Mon stays put; tomato animates
      drawMon(cx, SIZE * 0.32 + st.monY);
      const t = Math.min(1, f / 40);
      drawTomato(t);

    } else if (st.phase === 'shaking') {
      // 3 shake cycles over 30 frames
      const xOff = Math.sin((f / 30) * Math.PI * 6) * 8;
      drawMon(cx, SIZE * 0.32, { xOffset: xOff });

    } else if (st.phase === 'result') {
      if (st.caught) {
        // Flash then shrink to nothing
        const t     = Math.min(1, f / 50);
        const scale = Math.max(0, 1 - t * t); // quadratic shrink
        const flash = Math.sin(t * Math.PI * 6); // flicker
        const alpha = scale > 0.05 ? Math.max(0.2, 1 - Math.abs(flash) * 0.6) : 0;
        drawMon(cx, SIZE * 0.32, { scale, alpha });
      } else {
        // Jump up and fly off to top-right
        const t  = Math.min(1, f / 40);
        const cy = SIZE * 0.32 - t * SIZE * 0.55;
        const cx2 = cx + t * SIZE * 0.4;
        drawMon(cx2, cy, { alpha: 1 - t * t });
      }
    }
    // 'done' phase: canvas is blank
  }

  // ── rAF tick ──────────────────────────────────────────────
  function tick() {
    st.frame++;
    draw();

    // Phase transitions
    if (st.phase === 'appearing' && st.frame >= 30) {
      st.phase = 'idle';
      st.frame = 0;
      enableButtons(true);
    } else if (st.phase === 'throwing' && st.frame >= 40) {
      // Catch is always successful
      st.caught = true;
      st.phase  = 'shaking';
      st.frame  = 0;
    } else if (st.phase === 'shaking' && st.frame >= 30) {
      st.phase = 'result';
      st.frame = 0;
      showResult(st.caught);
    } else if (st.phase === 'result' && st.frame >= (st.caught ? 50 : 40)) {
      st.phase = 'done';
      close();
      return; // stop rAF
    }

    rafId = requestAnimationFrame(tick);
  }

  // ── UI helpers ────────────────────────────────────────────
  function enableButtons(on) {
    btnThrow.disabled = !on;
    btnFlee.disabled  = !on;
    elControls.style.opacity = on ? '1' : '0.4';
  }

  function showResult(caught) {
    if (caught) {
      elSub.textContent = `${st.mon.name} was caught!${st.mon.shiny ? ' ✨ Shiny!' : ''}`;
      elSub.style.color = 'var(--green)';
      saveCaught();
      if (typeof saveExp === 'function') saveExp(25);
    } else {
      elSub.textContent = `${st.mon.name} fled away!`;
      elSub.style.color = 'var(--red)';
      if (typeof saveExp === 'function') saveExp(5);
    }
  }

  function saveCaught() {
    const record = { id: st.mon.id, name: st.mon.name,
                     shiny: st.mon.shiny || false, caughtAt: Date.now() };
    if (typeof Collection !== 'undefined') {
      Collection.addCaught(record);
    } else {                         // fallback (IndexedDB unavailable)
      const list = JSON.parse(localStorage.getItem('pm_caught') || '[]');
      list.push(record);
      localStorage.setItem('pm_caught', JSON.stringify(list));
    }
  }

  // ── rarity dot display ────────────────────────────────────
  // Maps catchRate to 1-5 filled dots (higher rate = more dots = easier)
  function updateCatchDots(catchRate) {
    const filled = Math.round(catchRate * 5);
    const dotEls = catchDots.querySelectorAll('.cdot');
    dotEls.forEach((d, i) => d.classList.toggle('filled', i < filled));
  }

  // ── public API ────────────────────────────────────────────
  function start(doneCb) {
    // Resolve DOM refs once
    if (!overlay) {
      overlay     = document.getElementById('encounter-overlay');
      canvas      = document.getElementById('encounter-canvas');
      ctx         = canvas.getContext('2d');
      elMsg       = document.getElementById('encounter-msg');
      elSub       = document.getElementById('encounter-sub');
      elRarity    = document.getElementById('encounter-rarity');
      elControls  = document.getElementById('encounter-controls');
      btnThrow    = document.getElementById('btn-throw');
      btnFlee     = document.getElementById('btn-flee');
      catchDots   = document.getElementById('catch-dots');

      // HiDPI
      st.dpr = window.devicePixelRatio || 1;
      if (st.dpr !== 1) {
        canvas.width  = SIZE * st.dpr;
        canvas.height = SIZE * st.dpr;
        ctx.scale(st.dpr, st.dpr);
      }

      btnThrow.addEventListener('click', throw_);
      btnFlee.addEventListener('click',  flee);
    }

    onDone = doneCb;

    // Pick a random mon
    const mon   = getRandomMon();
    mon.shiny   = Math.random() < (1 / 64);
    st.mon      = mon;
    st.phase    = 'appearing';
    st.frame    = 0;
    st.monBob   = 0;
    st.monY     = 0;
    st.caught   = false;

    // Populate UI
    elMsg.textContent = `A wild ${mon.name} appeared!`;
    elSub.textContent = '';
    elSub.style.color = '';
    elRarity.textContent = mon.rarity.charAt(0).toUpperCase() + mon.rarity.slice(1);
    elRarity.className   = `encounter-rarity ${mon.rarity}`;
    updateCatchDots(mon.catchRate);
    enableButtons(false); // disabled until 'idle' phase

    // Show overlay
    overlay.classList.add('active');

    // Kick off rAF
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  }

  function throw_() {
    if (st.phase !== 'idle') return;
    enableButtons(false);
    st.phase = 'throwing';
    st.frame = 0;
  }

  function flee() {
    if (st.phase !== 'idle') return;
    if (typeof saveExp === 'function') saveExp(5);
    elSub.textContent = 'You fled safely.';
    close();
  }

  function close() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    // Short delay so the player can read the result text
    setTimeout(() => {
      overlay.classList.remove('active');
      if (typeof onDone === 'function') onDone();
    }, st.phase === 'done' ? 0 : 1400);
  }

  return { start };
})();
