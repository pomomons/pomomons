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
  const CANVAS_SIZE = 200; // logical px (canvas element attribute)

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
  const SIZE      = 200;          // logical canvas width
  const H         = 380;          // logical canvas height — tall for long throw arc
  const MON_SCALE = 1.5;          // wild mon drawn at 1.5× base size
  const MON_CY    = SIZE * 0.38;  // mon centre-Y resting position (76px from top)

  // DOM refs (resolved on first start() call)
  let overlay, canvas, ctx,
      elMsg, elSub, elRarity, elLevel, elControls,
      btnThrow, btnFlee;

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
  function drawMon(cx, cy, { scale = MON_SCALE, xOffset = 0, alpha = 1 } = {}) {
    MonSprite.drawOnCtx(ctx, st.mon, cx, cy, { scale, xOffset, alpha, shiny: st.mon.shiny || false });
  }

  // ── draw the tomato projectile ────────────────────────────
  // t: 0→1 progress. Tomato launches from player side (bottom-right)
  // in a high parabolic arc toward the monster, like a Pokéball throw.
  function drawTomato(t) {
    const startX = SIZE * 0.82;
    const startY = H + 20;          // launches from below the tall canvas
    const endX   = SIZE / 2;
    const endY   = MON_CY;
    const arcH   = H * 0.60;        // arc peaks ~10px from canvas top

    const x = startX + (endX - startX) * t;
    const y = startY + (endY - startY) * t - arcH * Math.sin(Math.PI * t);

    if (y > H + 4) return;

    const r     = 22;               // bigger tomato
    const angle = Math.PI * 4 * t; // 2 full forward rotations

    // Motion trail — 3 ghost echoes fading behind the ball
    for (let i = 3; i >= 1; i--) {
      const tp = Math.max(0, t - i * 0.036);
      const tx = startX + (endX - startX) * tp;
      const ty = startY + (endY - startY) * tp - arcH * Math.sin(Math.PI * tp);
      if (ty > H) continue;
      ctx.save();
      ctx.globalAlpha = 0.20 * (4 - i) / 3;
      ctx.beginPath();
      ctx.arc(Math.round(tx), Math.round(ty), Math.round(r * 0.72), 0, Math.PI * 2);
      ctx.fillStyle = '#e74c3c';
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle);

    // Body
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#e74c3c';
    ctx.fill();

    // Pixel shine (upper-left, square highlight like the logo)
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.fillRect(-Math.round(r * .44), -Math.round(r * .50),
                  Math.round(r * .28),  Math.round(r * .22));

    // Calyx — 5-leaf spread matching the logo 🍅
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(-2,       -(r + 12), 4,  14); // stem
    ctx.fillRect(-(r - 4), -(r +  3), 11,  5); // far-left leaf
    ctx.fillRect(  r >> 2, -(r +  3), 11,  5); // far-right leaf
    ctx.fillRect(-(r >> 1),-(r +  8),  7,  4); // mid-left leaf
    ctx.fillRect( 2,       -(r +  8),  7,  4); // mid-right leaf
    ctx.fillRect(-8,       -(r + 12),  5,  4); // top-left leaf
    ctx.fillRect( 3,       -(r + 12),  5,  4); // top-right leaf

    ctx.restore();
  }

  // ── draw tomato sitting still for shaking / result phases ─
  function drawTomatoBall(x, y, wobble) {
    const r = 22;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(wobble);

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#e74c3c';
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.fillRect(-Math.round(r * .44), -Math.round(r * .50),
                  Math.round(r * .28),  Math.round(r * .22));

    ctx.fillStyle = '#27ae60';
    ctx.fillRect(-2,       -(r + 12), 4,  14);
    ctx.fillRect(-(r - 4), -(r +  3), 11,  5);
    ctx.fillRect(  r >> 2, -(r +  3), 11,  5);
    ctx.fillRect(-(r >> 1),-(r +  8),  7,  4);
    ctx.fillRect( 2,       -(r +  8),  7,  4);
    ctx.fillRect(-8,       -(r + 12),  5,  4);
    ctx.fillRect( 3,       -(r + 12),  5,  4);

    ctx.restore();
  }

  // ── phase draw dispatcher ─────────────────────────────────
  function draw() {
    ctx.clearRect(0, 0, SIZE, H);
    const cx = SIZE / 2;
    const f  = st.frame;

    if (st.phase === 'appearing') {
      // Slide in from above; cubic ease-out over 30 frames
      const t    = Math.min(1, f / 30);
      const ease = 1 - Math.pow(1 - t, 3);
      drawMon(cx, MON_CY * ease);

    } else if (st.phase === 'idle') {
      st.monBob++;
      st.monY = Math.sin(st.monBob / 22) * 6;
      drawMon(cx, MON_CY + st.monY);

    } else if (st.phase === 'throwing') {
      const t = Math.min(1, f / 90);

      // Mon fades out as the tomato closes in (absorption effect)
      const monAlpha = t > 0.75 ? Math.max(0, 1 - (t - 0.75) / 0.25) : 1;
      if (monAlpha > 0) {
        drawMon(cx, MON_CY + st.monY, { alpha: monAlpha });
      }

      // Expanding white ring at impact moment
      if (t > 0.9) {
        const ft = (t - 0.9) / 0.1;
        ctx.save();
        ctx.globalAlpha = (1 - ft) * 0.8;
        ctx.beginPath();
        ctx.arc(cx, MON_CY, 14 + ft * 30, 0, Math.PI * 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }

      if (t < 1) drawTomato(t);

    } else if (st.phase === 'shaking') {
      // Ball rocks left-right 3 times on the ground, diminishing amplitude
      const shakeT = f / 30;
      const wobble = Math.sin(shakeT * Math.PI * 6) * 0.28 * (1 - shakeT * 0.5);
      drawTomatoBall(cx, MON_CY + 18, wobble);

    } else if (st.phase === 'locked') {
      // Ball sits still after the click — brief hold before congrats screen
      drawTomatoBall(cx, MON_CY + 18, 0);

    } else if (st.phase === 'result') {
      // Escape path only (catch always succeeds currently)
      const t   = Math.min(1, f / 40);
      const cy2 = MON_CY - t * SIZE * 0.55;
      const cx2 = cx + t * SIZE * 0.4;
      drawMon(cx2, cy2, { alpha: 1 - t * t });
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
    } else if (st.phase === 'throwing' && st.frame >= 90) {
      // Catch is always successful
      st.caught = true;
      st.phase  = 'shaking';
      st.frame  = 0;
    } else if (st.phase === 'shaking' && st.frame >= 30) {
      SFX.play('click');
      saveCaught();
      if (typeof saveExp === 'function') saveExp(25);
      st.phase = 'locked';
      st.frame = 0;
    } else if (st.phase === 'locked' && st.frame >= 20) {
      st.phase = 'done';
      rafId = null;
      SFX.music.stop();
      overlay.classList.remove('active');
      CatchScreen.start(st.mon, onDone);
      return;
    } else if (st.phase === 'result' && st.frame >= 40) {
      st.phase = 'done';
      close();
      return;
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
      SFX.play('catch');
      elSub.textContent = `${st.mon.name} WAS CAUGHT!${st.mon.shiny ? ' ✨ SHINY!' : ''}`;
      elSub.style.color = 'var(--green)';
      saveCaught();
      if (typeof saveExp === 'function') saveExp(25);
    } else {
      elSub.textContent = `${st.mon.name} FLED AWAY!`;
      elSub.style.color = 'var(--red)';
      if (typeof saveExp === 'function') saveExp(5);
    }
  }

  function saveCaught() {
    // Use the level shown to the player at encounter start
    const initLevel = st.monLevel || 1;

    const record = { id: st.mon.id, name: st.mon.name,
                     shiny: st.mon.shiny || false, caughtAt: Date.now(),
                     palLevel: initLevel };

    if (typeof Collection !== 'undefined') {
      Collection.addCaught(record);
    } else {                         // fallback (IndexedDB unavailable)
      const list = JSON.parse(localStorage.getItem('pm_caught') || '[]');
      list.push(record);
      localStorage.setItem('pm_caught', JSON.stringify(list));
    }
  }


  // ── JS-driven full-screen flash transition ────────────────
  // Two white flashes → dark hold → reveal → fade out.
  // Calls onReveal() when the encounter screen should appear.
  function runFlashTransition(onReveal) {
    const el = document.getElementById('encounter-flash');
    if (!el) { onReveal(); return; }

    // Start transparent black
    el.style.transition = 'none';
    el.style.background = '#000';
    el.style.opacity    = '0';

    // Fade to black
    setTimeout(() => { el.style.transition = 'opacity 450ms ease'; el.style.opacity = '0.95'; }, 16);

    // Reveal encounter screen beneath the darkness
    setTimeout(onReveal, 580);

    // Lift the darkness
    setTimeout(() => { el.style.transition = 'opacity 550ms ease'; el.style.opacity = '0'; }, 700);
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
      elLevel     = document.getElementById('encounter-level');
      elControls  = document.getElementById('encounter-controls');
      btnThrow    = document.getElementById('btn-throw');
      btnFlee     = document.getElementById('btn-flee');

      // HiDPI
      st.dpr = window.devicePixelRatio || 1;
      if (st.dpr !== 1) {
        canvas.width  = SIZE * st.dpr;
        canvas.height = H    * st.dpr;
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

    // Compute wild mon level (player level ±2) once at encounter start
    const playerLevel = parseInt(localStorage.getItem('pm_level') || '1', 10);
    const offset      = Math.floor(Math.random() * 5) - 2;
    st.monLevel       = Math.max(1, Math.min(100, playerLevel + offset));

    // Populate UI
    elMsg.textContent = `A WILD ${mon.name} APPEARED!`;
    elSub.textContent = '';
    elSub.style.color = '';
    elRarity.textContent = mon.rarity.toUpperCase();
    elRarity.className   = `encounter-rarity ${mon.rarity}`;
    if (elLevel) elLevel.textContent = `LVL ${st.monLevel}`;
    enableButtons(false); // disabled until 'idle' phase

    SFX.play('encounter');

    // Flash transition, then reveal encounter overlay and start music
    runFlashTransition(() => {
      overlay.classList.add('active');
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
      if (typeof SFX !== 'undefined') SFX.music.start();
    });
  }

  function throw_() {
    if (st.phase !== 'idle') return;
    SFX.play('throw');
    enableButtons(false);
    st.phase = 'throwing';
    st.frame = 0;
  }

  function flee() {
    if (st.phase !== 'idle') return;
    if (typeof saveExp === 'function') saveExp(5);
    elSub.textContent = 'YOU FLED SAFELY.';
    close();
  }

  function close() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (typeof SFX !== 'undefined') SFX.music.stop();
    // Short delay so the player can read the result text
    setTimeout(() => {
      overlay.classList.remove('active');
      if (typeof onDone === 'function') onDone();
    }, st.phase === 'done' ? 0 : 1400);
  }

  return { start };
})();

// ── Evolution Screen ───────────────────────────────────────
// Full-screen cinematic triggered when the active companion levels past
// an evolution threshold. All sprite drawing uses MonSprite.drawOnCtx.
const EvolutionScreen = (() => {
  const SIZE = 200;

  let overlay, canvas, ctx, elMsg, elSub, btnDismiss;
  let rafId = null, onDone = null, autoDismissTimer = null;

  const st = {
    phase:    'idle',  // blackin|text1|silhouette|flash|reveal|done
    frame:    0,
    bobFrame: 0,
    fromMon:  null,   // base stage (before evolution)
    toMon:    null,   // new stage (after evolution)
    dpr:      1,
  };

  // Draw mon as a pure-white silhouette
  function drawSilhouette(mon, alpha, scale, bobY) {
    const white = { ...mon, color: '#ffffff', accent: '#ffffff' };
    MonSprite.drawOnCtx(ctx, white, SIZE / 2, SIZE / 2 + (bobY || 0),
      { scale: scale || 1, alpha: alpha !== undefined ? alpha : 1 });
  }

  // Draw mon in full colour
  function drawColored(mon, bobY) {
    MonSprite.drawOnCtx(ctx, mon, SIZE / 2, SIZE / 2 + (bobY || 0), { scale: 1 });
  }

  function tick() {
    st.frame++;
    st.bobFrame++;
    const f = st.frame;
    ctx.clearRect(0, 0, SIZE, SIZE);

    if (st.phase === 'blackin') {
      // Silhouette of old mon fades in over 60 frames
      drawSilhouette(st.fromMon, Math.min(1, f / 60));
      if (f >= 60) { st.phase = 'text1'; st.frame = 0; }

    } else if (st.phase === 'text1') {
      drawSilhouette(st.fromMon, 1);
      if (f === 1) {
        elMsg.textContent = `WHAT? ${st.fromMon.name.toUpperCase()} IS EVOLVING!`;
        elMsg.style.opacity = '1';
      }
      if (f >= 40) { st.phase = 'silhouette'; st.frame = 0; }

    } else if (st.phase === 'silhouette') {
      // Silhouette bobs gently for ~2 s
      const bobY = Math.sin(st.bobFrame / 22) * 8;
      drawSilhouette(st.fromMon, 1, 1, bobY);
      if (f >= 120) {
        st.phase = 'flash';
        st.frame = 0;
        elMsg.style.opacity = '0';
      }

    } else if (st.phase === 'flash') {
      // Rapidly alternate old / new silhouette (4-frame intervals)
      const useNew = Math.floor(f / 4) % 2 === 1;
      drawSilhouette(useNew ? st.toMon : st.fromMon, 1);
      if (f >= 64) { st.phase = 'reveal'; st.frame = 0; }

    } else if (st.phase === 'reveal') {
      const bobY = Math.sin(st.bobFrame / 22) * 8;
      if (f <= 18) {
        // Brief strobe: silhouette ↔ colour
        if (Math.floor(f / 3) % 2 === 0) drawColored(st.toMon, bobY);
        else drawSilhouette(st.toMon, 1, 1, bobY);
      } else {
        drawColored(st.toMon, bobY);
        if (f === 19) {
          elMsg.textContent =
            `${st.fromMon.name.toUpperCase()} EVOLVED INTO ${st.toMon.name.toUpperCase()}!`;
          elMsg.style.opacity = '1';
          elSub.textContent  = 'CONGRATULATIONS!';
          elSub.style.opacity = '1';
        }
      }
      if (f >= 120) { st.phase = 'done'; st.frame = 0; }

    } else if (st.phase === 'done') {
      drawColored(st.toMon, Math.sin(st.bobFrame / 22) * 8);
      if (f === 1) {
        SFX.play('levelUp');
        btnDismiss.style.opacity      = '1';
        btnDismiss.style.pointerEvents = 'auto';
        autoDismissTimer = setTimeout(dismiss, 4000);
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  function dismiss() {
    if (autoDismissTimer) { clearTimeout(autoDismissTimer); autoDismissTimer = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    overlay.classList.remove('active');
    if (typeof onDone === 'function') onDone();
  }

  // params: { fromMon, toMon }   doneCb: called after dismiss
  function start(params, doneCb) {
    if (!overlay) {
      overlay    = document.getElementById('evolution-overlay');
      canvas     = document.getElementById('evolution-canvas');
      ctx        = canvas.getContext('2d');
      elMsg      = document.getElementById('evolution-msg');
      elSub      = document.getElementById('evolution-sub');
      btnDismiss = document.getElementById('btn-evo-dismiss');

      st.dpr = window.devicePixelRatio || 1;
      if (st.dpr !== 1) {
        canvas.width  = SIZE * st.dpr;
        canvas.height = SIZE * st.dpr;
        ctx.scale(st.dpr, st.dpr);
      }

      btnDismiss.addEventListener('click', dismiss);
    }

    onDone        = doneCb;
    st.fromMon    = params.fromMon;
    st.toMon      = params.toMon;
    st.phase      = 'blackin';
    st.frame      = 0;
    st.bobFrame   = 0;
    autoDismissTimer = null;

    elMsg.textContent  = '';
    elMsg.style.opacity = '0';
    elSub.textContent  = '';
    elSub.style.opacity = '0';
    btnDismiss.style.opacity      = '0';
    btnDismiss.style.pointerEvents = 'none';

    overlay.classList.add('active');
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  }

  return { start };
})();

// ── Catch Screen ───────────────────────────────────────────
// Full-screen congratulations overlay shown after a successful catch.
// Displays the mon sprite (bobbing), a "GOTCHA!" headline, and a fanfare.
const CatchScreen = (() => {
  const SIZE = 200;

  let overlay, canvas, ctx, elName, elShiny, btnContinue;
  let rafId = null, onDone = null, autoDismissTimer = null;

  const st = { frame: 0, mon: null, dpr: 1 };

  function tick() {
    st.frame++;
    ctx.clearRect(0, 0, SIZE, SIZE);
    const bobY = Math.sin(st.frame / 22) * 6;
    MonSprite.drawOnCtx(ctx, st.mon, SIZE / 2, SIZE / 2 + bobY,
      { scale: 1.5, shiny: st.mon.shiny || false });
    rafId = requestAnimationFrame(tick);
  }

  function dismiss() {
    if (autoDismissTimer) { clearTimeout(autoDismissTimer); autoDismissTimer = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    overlay.classList.remove('active');
    if (typeof onDone === 'function') onDone();
  }

  function start(mon, doneCb) {
    if (!overlay) {
      overlay     = document.getElementById('catch-overlay');
      canvas      = document.getElementById('catch-canvas');
      ctx         = canvas.getContext('2d');
      elName      = document.getElementById('catch-name');
      elShiny     = document.getElementById('catch-shiny');
      btnContinue = document.getElementById('btn-catch-continue');

      st.dpr = window.devicePixelRatio || 1;
      if (st.dpr !== 1) {
        canvas.width  = SIZE * st.dpr;
        canvas.height = SIZE * st.dpr;
        ctx.scale(st.dpr, st.dpr);
      }

      btnContinue.addEventListener('click', dismiss);
    }

    onDone    = doneCb;
    st.mon    = mon;
    st.frame  = 0;

    elName.textContent  = mon.name.toUpperCase();
    elShiny.textContent = mon.shiny ? '✨ SHINY!' : '';

    overlay.classList.add('active');
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);

    SFX.play('fanfare');
    autoDismissTimer = setTimeout(dismiss, 6000);
  }

  return { start };
})();

// ── Map icon pixel art ────────────────────────────────────
const MapIcon = (() => {
  // 16×16 pixel grid — colour key:
  //   B = dark border, p = parchment, t = trail, s = start (red), g = goal (gold)
  const COLORS = {
    B: '#4a2e10',
    p: '#c8965a',
    t: '#7a5020',
    s: '#e63030',
    g: '#ffd600',
  };

  const MAP = [
    'BBBBBBBBBBBBBBBB',
    'BppppppppppppppB',
    'BpsspppppppppppB',
    'BpssptpppppppppB',
    'BppppptppppppppB',
    'BpppppptpppppppB',
    'BppppppptppppppB',
    'BppppppppttppppB',
    'BppppppppptppppB',
    'BpppppppppptpppB',
    'BppppppppppttppB',
    'BppppppppppptppB',
    'BpppppppppppggpB',
    'BpppppppppppggpB',
    'BppppppppppppppB',
    'BBBBBBBBBBBBBBBB',
  ];

  function draw(canvas) {
    const ctx  = canvas.getContext('2d');
    const rows = MAP.length;
    const cols = MAP[0].length;
    const pw   = canvas.width  / cols;
    const ph   = canvas.height / rows;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    MAP.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const col = COLORS[row[x]];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(Math.round(x * pw), Math.round(y * ph), Math.ceil(pw), Math.ceil(ph));
      }
    });
  }

  return { draw };
})();
