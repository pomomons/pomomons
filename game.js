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
  const MON_CY    = H * 0.5;      // mon centre-Y resting position (50% — vertical centre)
  const GROUND_Y  = Math.min(H - 50, MON_CY + 110); // where tomato lands after the throw

  // DOM refs (resolved on first start() call)
  let overlay, canvas, ctx,
      elMsg, elSub, elRarity, elLevel, elControls,
      btnThrow, btnFlee, btnCatchNext;

  let rafId    = null;
  let onDone   = null;

  // State machine
  const st = {
    phase:        'idle',  // appearing|idle|throwing|shaking|result|done
    mon:          null,
    caught:       false,
    frame:        0,       // general counter, reset each phase
    dpr:          1,
    monY:         0,       // current bob offset (idle phase)
    monBob:       0,       // frame counter for idle bob
    throwStartX:  SIZE * 0.82, // throw origin in canvas coords (set on throw)
    throwStartY:  H + 20,      // overwritten with button position on throw
  };

  // ── draw a wild mon sprite centred at (cx, cy) ────────────
  function drawMon(cx, cy, { scale = MON_SCALE, xOffset = 0, alpha = 1 } = {}) {
    MonSprite.drawOnCtx(ctx, st.mon, cx, cy, { scale, xOffset, alpha, shiny: st.mon.shiny || false });
  }

  // ── tomato renderer — matches the 🍅 logo icon (draws centred at origin) ──
  function drawTomatoPixelArt(r) {
    // Round body — same smooth circle as the emoji
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#e74c3c';
    ctx.fill();

    // Square pixel highlight — upper-left, matching the logo style
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(-Math.round(r * .44), -Math.round(r * .50),
                  Math.round(r * .30),  Math.round(r * .26));

    // Calyx — 5-leaf fanned spread matching the 🍅 emoji
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(-2,       -(r + 12),  4, 14); // stem
    ctx.fillRect(-(r - 4), -(r +  3), 11,  5); // far-left leaf
    ctx.fillRect(  r >> 2, -(r +  3), 11,  5); // far-right leaf
    ctx.fillRect(-(r >> 1),-(r +  8),  7,  4); // mid-left leaf
    ctx.fillRect( 2,       -(r +  8),  7,  4); // mid-right leaf
    ctx.fillRect(-8,       -(r + 12),  5,  4); // top-left leaf
    ctx.fillRect( 3,       -(r + 12),  5,  4); // top-right leaf
  }

  // ── draw the tomato projectile ────────────────────────────
  // t: 0→1 progress. Tomato launches from player side (bottom-right)
  // in a high parabolic arc toward the monster, like a Pokéball throw.
  function drawTomato(t) {
    const startX = st.throwStartX;
    const startY = st.throwStartY;  // button position in canvas coords
    const endX   = SIZE / 2;
    const endY   = MON_CY;
    // Arc height: peak sits at y=44 so the calyx (34px above centre) stays inside the canvas.
    const arcH   = (startY + endY) / 2 - 44;

    const x = startX + (endX - startX) * t;
    const y = startY + (endY - startY) * t - arcH * Math.sin(Math.PI * t);

    if (y > H + 4) return;

    const r     = 22;
    const angle = Math.PI * 4 * t; // 2 full forward rotations

    // Motion trail — 3 ghost echoes fading behind the ball
    for (let i = 3; i >= 1; i--) {
      const tp = Math.max(0, t - i * 0.036);
      const tx = startX + (endX - startX) * tp;
      const ty = startY + (endY - startY) * tp - arcH * Math.sin(Math.PI * tp);
      if (ty > H) continue;
      ctx.save();
      ctx.globalAlpha = 0.18 * (4 - i) / 3;
      ctx.beginPath();
      ctx.arc(Math.round(tx), Math.round(ty), Math.round(r * 0.72), 0, Math.PI * 2);
      ctx.fillStyle = '#e74c3c';
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle);
    drawTomatoPixelArt(r);
    ctx.restore();
  }

  // ── draw tomato sitting still for shaking / result phases ─
  function drawTomatoBall(x, y, wobble) {
    const r = 22;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(wobble);
    drawTomatoPixelArt(r);
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
      // Mon stays fully visible throughout the throw arc
      drawMon(cx, MON_CY + st.monY);
      if (f / 90 < 1) drawTomato(f / 90);

    } else if (st.phase === 'absorbing') {
      // Expanding white impact ring
      if (f < 12) {
        const rt = f / 12;
        ctx.save();
        ctx.globalAlpha = (1 - rt) * 0.85;
        ctx.beginPath();
        ctx.arc(cx, MON_CY, 8 + rt * 50, 0, Math.PI * 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();
      }
      // Mon shrinks rapidly into the tomato (easeIn scale-down)
      const absT  = Math.min(1, f / 35);
      const monSc = MON_SCALE * Math.max(0, 1 - absT * absT);
      if (monSc > 0.05) drawMon(cx, MON_CY, { scale: monSc });
      // Tomato sits at impact point on top
      drawTomatoBall(cx, MON_CY, 0);

    } else if (st.phase === 'falling') {
      // Tomato drops with gravity ease-in from MON_CY to GROUND_Y
      const fallT = Math.min(1, f / 22);
      const y     = MON_CY + (GROUND_Y - MON_CY) * fallT * fallT;
      drawTomatoBall(cx, y, 0);

    } else if (st.phase === 'landing') {
      // Two bounces with squish on each ground contact
      let y = GROUND_Y, sx = 1, sy = 1;
      if (f <= 6) {                          // initial impact squish
        const d = Math.exp(-(f / 6) * 5);
        sx = 1 + 0.30 * d;  sy = 1 - 0.22 * d;
      } else if (f <= 28) {                  // bounce 1 arc (45px high, 22f)
        const bt = (f - 6) / 22;
        y = GROUND_Y - 45 * 4 * bt * (1 - bt);
      } else if (f <= 34) {                  // bounce 1 landing squish
        const d = Math.exp(-((f - 28) / 6) * 5);
        sx = 1 + 0.18 * d;  sy = 1 - 0.14 * d;
      } else if (f <= 48) {                  // bounce 2 arc (22px high, 14f)
        const bt = (f - 34) / 14;
        y = GROUND_Y - 22 * 4 * bt * (1 - bt);
      } else if (f <= 54) {                  // bounce 2 landing squish
        const d = Math.exp(-((f - 48) / 6) * 5);
        sx = 1 + 0.10 * d;  sy = 1 - 0.08 * d;
      }                                      // f>54: ball rests still
      ctx.save();
      ctx.translate(cx, y);
      ctx.scale(sx, sy);
      drawTomatoPixelArt(22);
      ctx.restore();

    } else if (st.phase === 'shaking') {
      // 3 distinct shakes separated by pauses (40f shake, 20f pause each)
      const windows = [[0, 39], [60, 99], [120, 159]];
      let wobble = 0;
      for (const [s, e] of windows) {
        if (f >= s && f <= e) {
          const lt = (f - s) / (e - s);
          wobble = Math.sin(lt * Math.PI * 2) * 0.38;
          break;
        }
      }
      drawTomatoBall(cx, GROUND_Y, wobble);

    } else if (st.phase === 'locked') {
      // Shimmer effect tied to the click — window frames 22–58, click fires at 25
      if (f >= 22 && f <= 58) {
        const t = (f - 22) / 36;
        const shimAlpha = Math.sin(t * Math.PI);
        // White glow expands behind the tomato
        ctx.save();
        ctx.globalAlpha = shimAlpha * 0.50;
        ctx.beginPath();
        ctx.arc(cx, GROUND_Y, 22 + t * 22, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.restore();
      }
      drawTomatoBall(cx, GROUND_Y, 0);
      if (f >= 22 && f <= 58) {
        const t = (f - 22) / 36;
        const shimAlpha = Math.sin(t * Math.PI);
        // 8 golden rays burst outward on top of the tomato
        ctx.save();
        ctx.globalAlpha = shimAlpha * 0.90;
        ctx.strokeStyle = '#ffe082';
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const r1 = 26;
          const r2 = r1 + 8 + t * 24;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(angle) * r1, GROUND_Y + Math.sin(angle) * r1);
          ctx.lineTo(cx + Math.cos(angle) * r2, GROUND_Y + Math.sin(angle) * r2);
          ctx.stroke();
        }
        ctx.restore();
      }

    } else if (st.phase === 'result') {
      // Escape path only (catch always succeeds currently)
      const t   = Math.min(1, f / 40);
      const cy2 = MON_CY - t * SIZE * 0.55;
      const cx2 = cx + t * SIZE * 0.4;
      drawMon(cx2, cy2, { alpha: 1 - t * t });

    } else if (st.phase === 'postcatch') {
      // Mon bobs happily on the encounter canvas while the congrats text is shown
      st.monBob++;
      st.monY = Math.sin(st.monBob / 22) * 6;
      drawMon(cx, MON_CY + st.monY);
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
      st.caught = true;
      st.phase  = 'absorbing';
      st.frame  = 0;
    } else if (st.phase === 'absorbing' && st.frame >= 35) {
      st.phase = 'falling';
      st.frame = 0;
    } else if (st.phase === 'falling' && st.frame >= 22) {
      st.phase = 'landing';
      st.frame = 0;
      SFX.play('bounce');                   // initial landing bounce
    } else if (st.phase === 'landing') {
      if (st.frame === 29) SFX.play('bounce'); // bounce 1 hits ground
      if (st.frame === 49) SFX.play('bounce'); // bounce 2 hits ground
      if (st.frame >= 90) {
        st.phase = 'shaking';
        st.frame = 0;
      }
    } else if (st.phase === 'shaking') {
      // Fire shake sound at the start of each of the 3 shake windows
      if (st.frame === 1 || st.frame === 61 || st.frame === 121) {
        SFX.play('shake');
      }
      if (st.frame >= 161) {
        saveCaught();
        if (typeof saveExp === 'function') saveExp(25);
        st.phase = 'locked';
        st.frame = 0;
      }
    } else if (st.phase === 'locked') {
      if (st.frame === 25) SFX.play('click');  // delayed click with shimmer
      if (st.frame >= 120) {
        st.phase = 'postcatch';
        st.frame = 0;
        st.monBob = 0;

        SFX.music.stop();
        SFX.play('fanfare');

        // Update encounter overlay to show congratulations
        elMsg.textContent = 'CONGRATULATIONS!';
        elSub.textContent = `${st.mon.name} WAS CAUGHT!${st.mon.shiny ? ' \u2728 SHINY!' : ''}`;
        elSub.style.color = 'var(--green)';
        if (elLevel) elLevel.style.display = 'none';

        // Swap buttons: hide throw/flee, show NEXT
        btnThrow.hidden     = true;
        btnFlee.hidden      = true;
        btnCatchNext.hidden = false;
        elControls.classList.add('postcatch');
        elControls.style.opacity = '1';
      }
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
      btnCatchNext = document.getElementById('btn-catch-next');

      // HiDPI
      st.dpr = window.devicePixelRatio || 1;
      if (st.dpr !== 1) {
        canvas.width  = SIZE * st.dpr;
        canvas.height = H    * st.dpr;
        ctx.scale(st.dpr, st.dpr);
      }

      btnThrow.addEventListener('click', throw_);
      btnFlee.addEventListener('click',  flee);
      btnCatchNext.addEventListener('click', openMonInfo);
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
    if (elLevel) { elLevel.textContent = `LVL ${st.monLevel}`; elLevel.style.display = ''; }

    // Reset button state for repeat encounters
    btnThrow.hidden      = false;
    btnFlee.hidden       = false;
    btnCatchNext.hidden  = true;
    elControls.classList.remove('postcatch');

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

    // Measure where the throw button sits relative to the canvas so the
    // tomato arc can originate from that screen position.
    const cr = canvas.getBoundingClientRect();
    const br = btnThrow.getBoundingClientRect();
    st.throwStartX = (br.left + br.width  / 2 - cr.left) * (SIZE / cr.width);
    st.throwStartY = (br.top  + br.height / 2 - cr.top)  * (H    / cr.height);

    st.phase = 'throwing';
    st.frame = 0;
  }

  function flee() {
    if (st.phase !== 'idle') return;
    if (typeof saveExp === 'function') saveExp(5);
    elSub.textContent = 'YOU FLED SAFELY.';
    close();
  }

  function openMonInfo() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    overlay.classList.remove('active');
    MonInfoScreen.start(st.mon, onDone);
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

// ── Mon Info Screen ────────────────────────────────────────
// Shown after every successful catch. Displays the caught mon's animated
// sprite and full evolution chain so the player can learn about their new pal.
const MonInfoScreen = (() => {
  const CANVAS_SIZE    = 200;   // main sprite canvas logical size
  const EVO_NODE_SIZE  = 64;    // mini evo-chain canvas logical size

  let overlay, canvas, ctx, elName, elRarity, elChain, btnDone;
  let rafId  = null;
  let onDone = null;

  const st = { frame: 0, mon: null, dpr: 1 };

  // ── Main sprite animation (bobbing) ────────────────────
  function tick() {
    st.frame++;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const bobY = Math.sin(st.frame / 22) * 6;
    MonSprite.drawOnCtx(ctx, st.mon, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + bobY,
      { scale: 1.5, shiny: st.mon.shiny || false });
    rafId = requestAnimationFrame(tick);
  }

  // ── Build the evolution chain as DOM nodes ──────────────
  function buildEvoChain(mon) {
    elChain.innerHTML = '';

    const dpr = st.dpr;

    function makeNode(monData, labelText, isBase) {
      const node = document.createElement('div');
      node.className = 'evo-node' + (isBase ? ' base' : '');

      const c = document.createElement('canvas');
      c.width  = EVO_NODE_SIZE * dpr;
      c.height = EVO_NODE_SIZE * dpr;
      c.style.width  = EVO_NODE_SIZE + 'px';
      c.style.height = EVO_NODE_SIZE + 'px';
      const miniCtx = c.getContext('2d');
      if (dpr !== 1) miniCtx.scale(dpr, dpr);
      MonSprite.drawOnCtx(miniCtx, monData,
        EVO_NODE_SIZE / 2, EVO_NODE_SIZE / 2,
        { scale: 0.9, shiny: mon.shiny || false });
      node.appendChild(c);

      const nameEl = document.createElement('p');
      nameEl.className   = 'evo-node-name';
      nameEl.textContent = monData.name.toUpperCase();
      node.appendChild(nameEl);

      const lblEl = document.createElement('p');
      lblEl.className   = 'evo-node-label' + (isBase ? ' base-label' : '');
      lblEl.textContent = labelText;
      node.appendChild(lblEl);

      return node;
    }

    function makeArrow() {
      const span = document.createElement('span');
      span.className        = 'evo-arrow';
      span.textContent      = '→';
      span.setAttribute('aria-hidden', 'true');
      return span;
    }

    if (!mon.evolutions || mon.evolutions.length === 0) {
      elChain.appendChild(makeNode(mon, 'FINAL FORM', true));
      return;
    }

    elChain.appendChild(makeNode(mon, 'BASE', true));

    for (const evo of mon.evolutions) {
      elChain.appendChild(makeArrow());
      const evoMon = { ...mon, name: evo.name, color: evo.color, accent: evo.accent };
      elChain.appendChild(makeNode(evoMon, `LV. ${evo.atLevel}`, false));
    }
  }

  // ── dismiss ─────────────────────────────────────────────
  function dismiss() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    overlay.classList.remove('active');
    if (typeof onDone === 'function') onDone();
  }

  // ── public API ───────────────────────────────────────────
  function start(mon, doneCb) {
    if (!overlay) {
      overlay  = document.getElementById('mon-info-overlay');
      canvas   = document.getElementById('mon-info-canvas');
      ctx      = canvas.getContext('2d');
      elName   = document.getElementById('mon-info-name');
      elRarity = document.getElementById('mon-info-rarity');
      elChain  = document.getElementById('mon-info-evo-chain');
      btnDone  = document.getElementById('btn-mon-info-done');

      st.dpr = window.devicePixelRatio || 1;
      if (st.dpr !== 1) {
        canvas.width  = CANVAS_SIZE * st.dpr;
        canvas.height = CANVAS_SIZE * st.dpr;
        ctx.scale(st.dpr, st.dpr);
      }

      btnDone.addEventListener('click', dismiss);
    }

    onDone   = doneCb;
    st.mon   = mon;
    st.frame = 0;

    elName.textContent   = mon.name.toUpperCase();
    elRarity.textContent = mon.rarity.toUpperCase();
    elRarity.className   = `mon-info-rarity ${mon.rarity}`;

    buildEvoChain(mon);

    overlay.classList.add('active');
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
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
