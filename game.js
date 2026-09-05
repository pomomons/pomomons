// game.js — all Canvas drawing lives here (per CLAUDE.md)

// Canvas filter for the "dark" variant — a very rare, darkened black/black-grey
// version of any mon (analogous to shiny, but shadowy instead of golden).
const DARK_FILTER = 'brightness(0.28) grayscale(0.9) contrast(1.15)';

// ── Floating mon-name sizing ──────────────────────────────
// Both the companion panel and the encounter arena caption the mon with its
// name floating just above its head, so the caption reads as part of the art
// and has to grow and shrink with the mon. It didn't: every rule set a fixed
// size (16px, re-hardcoded to 8/12/14px per breakpoint) while the canvas it
// labels ranges from 90px to 398px wide. The phone was the worst of it —
// style-v3.css draws the companion at 1.7x there, and the name was pinned
// *smaller* than desktop's.
//
// Callers pass the size the name wants at the mon's current drawn size; this
// backs it off only if the name wouldn't fit the panel.
const NAME_MIN_PX   = 8;    // default floor: the pixel font's readable limit
const NAME_TRACKING = 0.1;  // letter-spacing on both name rules, in em

// Measurement only — nothing is ever drawn on this context.
const _nameMeasureCtx = document.createElement('canvas').getContext('2d');

// Press Start 2P arrives async. measureText before it lands reports the
// fallback font's metrics, and none of the other cache inputs change when
// the real font swaps in — so bump an epoch and let every name re-measure.
let _nameFontEpoch = 0;
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { _nameFontEpoch++; });
}

// Content-box width. clientWidth still includes padding, hence the subtraction.
function contentWidth(el) {
  if (!el) return 0;
  const cs = getComputedStyle(el);
  return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
}

// Size `el` to `targetPx`, backed off if the name wouldn't fit on one line.
// The long names ("SCORCHPEPPER") need that: at the phone's 1.7x they would
// otherwise wrap onto the mon's face. Two limits, whichever is tighter:
//
//   - el's own box, which is what actually decides where the text wraps;
//   - the content box of `boxEl`, the panel, which is what clips it. On a
//     phone the name's box is widened past the stage (see .companion-name)
//     so a long name isn't shrunk to fit a box narrower than the art it
//     labels — the panel is the real edge there.
//
// Neither depends on font-size, so there's no feedback loop. Whole pixels
// only — Press Start 2P blurs at fractional sizes.
//
// `cache` is a plain object owned by the caller. This runs from the render
// loop, so the measuring is skipped unless an input actually changed.
function sizeMonName(el, targetPx, boxEl, cache, minPx) {
  if (!el || !(targetPx > 0)) return;
  const text = (el.textContent || '').toUpperCase();  // text-transform: uppercase
  const own  = el.clientWidth;
  const key  = _nameFontEpoch + '|' + Math.round(targetPx) + '|' + own + '|' +
               (boxEl ? boxEl.clientWidth : 0) + '|' + text;
  if (cache.key === key) return;
  cache.key = key;

  let size = targetPx;
  const outer = contentWidth(boxEl);
  const avail = outer > 0 ? Math.min(own, outer) : own;
  if (text && avail > 0) {
    _nameMeasureCtx.font = size + 'px ' + getComputedStyle(el).fontFamily;
    const w = _nameMeasureCtx.measureText(text).width + size * NAME_TRACKING * text.length;
    if (w > avail) size *= avail / w;
  }
  el.style.fontSize = Math.max(minPx || NAME_MIN_PX, Math.floor(size)) + 'px';
}

// ── Shared sprite renderer ────────────────────────────────
// Used by EncounterScreen (encounter canvas) and Collection (card thumbnails).
const MonSprite = (() => {
  // ── PNG image cache ──────────────────────────────────────
  // Keyed by src path. Images are loaded once and reused.
  const _imgCache = {};

  function getImage(src) {
    if (!_imgCache[src]) {
      const img = new Image();
      img.src = src;
      _imgCache[src] = img;
    }
    return _imgCache[src];
  }

  // ── Display size from native sprite resolution ─────────────
  // The roster is drawn at 32, 36, 48 and 64 px per frame, and that native
  // resolution IS how each creature's size is encoded — a 32px Bluble is
  // meant to read as half a 64px Guacamonger. Every screen derives its
  // on-screen size from this one rule so that relationship holds
  // everywhere.
  //
  // Two earlier approaches both destroyed it, in opposite directions:
  // a flat display size made every mon identical, and `min(srcW * 3, cap)`
  // flattened only the top end (48px and 64px mons both pinned to the cap)
  // while leaving 32px ones small — which is what made the sizing look
  // arbitrary rather than simply uniform.
  //
  // `boxPx` is the room available for the LARGEST mon in the roster;
  // everything else scales down from there in proportion to its native
  // width. Change NATIVE_MAX only if art larger than 64px is added.
  const NATIVE_MAX = 64;
  // 1 = true proportion (a 32px mon renders at half a 64px one). Lower it to
  // compress the spread if the smallest mons end up reading too small —
  // 0.6 would put 32px at ~66% of 64px instead of 50%. Single knob: every
  // screen sizes its mons through displaySize().
  const SIZE_CURVE = 1;
  function displaySize(srcW, boxPx) {
    return Math.round(boxPx * Math.pow(srcW / NATIVE_MAX, SIZE_CURVE));
  }

  // Native per-frame width of a mon's sprite, or null if it isn't loaded yet.
  function nativeFrameW(mon, shiny = false) {
    const src = shiny ? (mon.shinySprite || mon.sprite) : mon.sprite;
    if (!src) return null;
    const img = getImage(src);
    if (!img.complete || img.naturalWidth === 0) return null;
    const frames = mon.spriteFrames || 1;
    return mon.spriteAxis === 'y' ? img.naturalWidth : img.naturalWidth / frames;
  }

  // Draw scale that lands a mon at its proportional display size within a
  // box sized for the largest mon. Falls back to desiredScale pre-load.
  function sizeScale(mon, boxPx, desiredScale = 1, shiny = false) {
    const srcW = nativeFrameW(mon, shiny);
    if (srcW === null) return desiredScale;
    return displaySize(srcW, boxPx) / (srcW * 3);
  }

  // Returns the draw scale capped so the sprite fits within maxPx (width or
  // height). Kept for callers that genuinely want "as big as will fit"; for
  // drawing a mon use sizeScale() instead, which preserves the size
  // relationship between mons. Capping is what made a 48px and a 64px mon
  // render identically — both pinned to the cap.
  // Falls back to desiredScale if the image isn't loaded yet.
  function fitScale(mon, maxPx, desiredScale = 1, shiny = false) {
    const src = shiny ? (mon.shinySprite || mon.sprite) : mon.sprite;
    if (!src) return desiredScale;
    const img = getImage(src);
    if (!img.complete || img.naturalWidth === 0) return desiredScale;
    const frames = mon.spriteFrames || 1;
    const srcW   = mon.spriteAxis === 'y' ? img.naturalWidth : img.naturalWidth / frames;
    return Math.min(desiredScale, maxPx / (srcW * 3));
  }

  // Pre-warm the cache for a mon so its image is ready before first draw.
  function preload(mon) {
    if (mon.sprite)      getImage(mon.sprite);
    if (mon.shinySprite) getImage(mon.shinySprite);
  }

  // Preload all sprites for an array of mons (including evolutions).
  // Calls onAllLoaded once every pending image has finished loading.
  function preloadAll(mons, onAllLoaded) {
    const pending = [];
    function track(src) {
      if (!src) return;
      const img = getImage(src);
      if (!img.complete) pending.push(img);
    }
    for (const mon of mons) {
      track(mon.sprite);
      track(mon.shinySprite);
      if (mon.evolutions) {
        for (const evo of mon.evolutions) { track(evo.sprite); track(evo.shinySprite); }
      }
    }
    if (!pending.length) return;
    let done = 0;
    const bump = () => { if (++done === pending.length) onAllLoaded(); };
    for (const img of pending) {
      // once:true listeners never stack across repeated preloadAll calls;
      // count errors too so a broken sprite can't stall the callback forever
      img.addEventListener('load',  bump, { once: true });
      img.addEventListener('error', bump, { once: true });
    }
  }

  function block(ctx, color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  // ── PNG path: draw image centred at (cx, cy) ────────────
  // frameAxis 'x': frames laid out horizontally (default).
  // frameAxis 'y': frames laid out vertically (top=frame 0, bottom=frame 1…).
  // blinkMode: hold frame 1 (open) for blinkInterval ms, flash frame 0 (blink) for blinkDuration ms.
  function drawPng(ctx, src, cx, cy, {
    scale = 1, xOffset = 0, alpha = 1,
    frames = 1, fps = 8,
    frameAxis = 'x',
    blinkMode = false, blinkInterval = 3000, blinkDuration = 150,
    shiny = false, dark = false,
  } = {}) {
    const img = getImage(src);
    if (!img.complete || img.naturalWidth === 0) return false; // not ready yet

    let frameIndex;
    if (blinkMode && frames === 2) {
      const t = Date.now() % (blinkInterval + blinkDuration);
      frameIndex = t < blinkDuration ? 0 : 1; // 0=blink(top), 1=open(bottom)
    } else {
      frameIndex = frames > 1 ? Math.floor(Date.now() / (1000 / fps)) % frames : 0;
    }

    // Derive source rect — image dimensions tell us true frame size so any
    // export resolution works; destination is always scaled to a square.
    let srcX, srcY, srcW, srcH;
    if (frameAxis === 'y') {
      srcW = img.naturalWidth;
      srcH = img.naturalHeight / frames;
      srcX = 0;
      srcY = frameIndex * srcH;
    } else {
      srcW = img.naturalWidth / frames;
      srcH = img.naturalHeight;
      srcX = frameIndex * srcW;
      srcY = 0;
    }

    // Pixel density = 3 screen px per source px — size grows with sprite canvas.
    const size = srcW * 3 * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false; // keep pixel art crisp when scaled
    if (dark)       ctx.filter = DARK_FILTER;
    else if (shiny) ctx.filter = 'hue-rotate(120deg) saturate(1.6) brightness(1.08)';
    ctx.drawImage(
      img,
      srcX, srcY, srcW, srcH,                                    // source: this frame
      Math.round(cx - size / 2 + xOffset), Math.round(cy - size / 2), // dest position
      Math.round(size), Math.round(size)                          // dest size
    );
    ctx.restore();
    return true;
  }

  // ── Shiny sparkle — animated twinkling crosses around the mon ──
  // spriteSize: logical px of the sprite (used to place stars relative to edges)
  function drawSparkle(ctx, cx, cy, scale, spriteSize = 48) {
    const hw = spriteSize * scale / 2;
    const t  = Date.now() / 600;
    const stars = [
      { dx:  hw * 0.9,  dy: -hw * 1.15, sz: 2.5 * scale, color: '#fff',    phase: 0   },
      { dx: -hw * 0.85, dy: -hw * 0.65, sz: 2   * scale, color: '#ffe566', phase: 1.3 },
      { dx:  hw * 1.15, dy:  hw * 0.1,  sz: 1.5 * scale, color: '#fff',    phase: 0.7 },
      { dx: -hw * 0.2,  dy: -hw * 1.35, sz: 1.5 * scale, color: '#ffe566', phase: 2.0 },
    ];
    ctx.save();
    for (const s of stars) {
      const pulse = (Math.sin(t * Math.PI * 2 + s.phase * Math.PI) + 1) / 2;
      if (pulse < 0.05) continue;
      ctx.globalAlpha = pulse * 0.95;
      ctx.fillStyle   = s.color;
      const sx = Math.round(cx + s.dx);
      const sy = Math.round(cy + s.dy);
      const w  = Math.max(1, Math.round(s.sz));
      const h  = Math.max(2, Math.round(s.sz * 2.5));
      ctx.fillRect(sx - Math.round(w / 2), sy - Math.round(h / 2), w, h); // vertical bar
      ctx.fillRect(sx - Math.round(h / 2), sy - Math.round(w / 2), h, w); // horizontal bar
    }
    ctx.restore();
  }

  // Draw a mon centred on (cx, cy) into an already-obtained ctx.
  // Uses PNG sprite if mon.sprite (or mon.shinySprite when shiny) is set
  // and the image has loaded; falls back to block art otherwise.
  function drawOnCtx(ctx, mon, cx, cy, { scale = 1, xOffset = 0, alpha = 1, shiny = false, dark = false } = {}) {
    // Dark variant reuses the normal PNG and darkens it via canvas filter (no separate sprite).
    const spriteSrc = (shiny && !dark) ? (mon.shinySprite || mon.sprite) : mon.sprite;

    if (spriteSrc) {
      // Derive display size from actual frame width × pixel density (3 px per sprite px).
      const _img    = getImage(spriteSrc);
      const _frames = mon.spriteFrames || 1;
      const _srcW   = (_img.complete && _img.naturalWidth > 0)
        ? (mon.spriteAxis === 'y' ? _img.naturalWidth : _img.naturalWidth / _frames)
        : 32;
      const pw = _srcW * 3 * scale;

      const drew = drawPng(ctx, spriteSrc, cx, cy, {
        scale, xOffset, alpha, shiny, dark,
        frames:        mon.spriteFrames    || 1,
        fps:           mon.spriteFps       || 8,
        frameAxis:     mon.spriteAxis      || 'x',
        blinkMode:     mon.spriteBlinkMode || false,
        blinkInterval: mon.blinkInterval   || 3000,
        blinkDuration: mon.blinkDuration   || 150,
      });
      if (drew) {
        if (shiny) drawSparkle(ctx, cx + xOffset, cy, scale, pw);
        return;
      }
      // PNG not ready. While it's still loading, skip the block-art fallback
      // so we don't flash the placeholder creature — callers re-render once
      // the image finishes (see preloadAll). Only fall through to block art
      // when the image genuinely failed to load (complete but zero width).
      if (!_img.complete) return;
    }

    // ── Block-art fallback ───────────────────────────────────
    ctx.save();
    ctx.globalAlpha = alpha;

    const bw = 48 * scale, bh = 48 * scale;
    const x0 = cx - bw / 2 + xOffset;
    const y0 = cy - bh / 2;

    // Shiny / dark colour overrides
    const bodyColor   = dark ? '#2b2b2b' : (shiny ? '#f1c40f' : mon.color);
    const accentColor = dark ? '#141414' : (shiny ? '#d4ac0d' : mon.accent);

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
    if (shiny) drawSparkle(ctx, cx + xOffset, cy, scale);

    ctx.restore();
  }

  // Convenience: clear a canvas and draw a mon centred in it.
  // fit (0–1): the fraction of the canvas the LARGEST mon in the roster
  // fills; every other mon scales down from that in proportion to its
  // native sprite width (see displaySize). This used to size every mon to
  // the same `canvas * fit`, which made a 32px mon and a 64px one identical
  // in the collection grids — the place the flattening was most obvious,
  // since the cards sit side by side. Overrides scale for PNG mons.
  function draw(canvas, mon, { scale = 1, shiny = false, dark = false, fit = null } = {}) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let drawScale = scale;
    if (fit !== null) {
      const spriteSrc = (shiny && !dark) ? (mon.shinySprite || mon.sprite) : mon.sprite;
      if (spriteSrc) {
        const img = getImage(spriteSrc);
        if (img.complete && img.naturalWidth > 0) {
          const frames = mon.spriteFrames || 1;
          const srcW   = mon.spriteAxis === 'y' ? img.naturalWidth : img.naturalWidth / frames;
          const boxPx = Math.min(canvas.width, canvas.height) * fit;
          drawScale = displaySize(srcW, boxPx) / (srcW * 3);
        }
      }
    }
    drawOnCtx(ctx, mon, canvas.width / 2, canvas.height / 2, { scale: drawScale, shiny, dark });
  }

  return { drawOnCtx, draw, getImage, preload, preloadAll, fitScale, drawSparkle,
           displaySize, nativeFrameW, sizeScale };
})();

// ── Companion idle animation ───────────────────────────────
const CompanionCanvas = (() => {
  const CANVAS_SIZE = 200; // logical px (canvas element attribute)
  // Room a 64px mon fills on this stage; every smaller mon scales down from
  // it in proportion (see MonSprite.displaySize). 176 is the ceiling here:
  // the stage bottom-anchors at GROUND_Y 192 with a 16px top margin, so
  // anything larger stops touching the ground and starts sinking through it.
  const MON_BOX = 176;

  const SPRITE = {
    noMon:      true,    // true until setMon() is called; suppresses all drawing
    bodyColor:  '#e74c3c',   // tomato red (block-art fallback)
    eyeColor:   '#2c2c2c',
    blushColor: '#f1948a',
    shadowColor:'rgba(0,0,0,0.15)',
    spriteSrc:     null,   // set by setMon() when mon has a PNG sprite
    shiny:         false,
    dark:          false, // very rare darkened variant
    frames:        1,     // sprite sheet frame count
    fps:           8,     // animation speed (uniform cycling)
    frameAxis:     'x',   // 'x' = horizontal sheet, 'y' = vertical sheet
    blinkMode:     false, // hold frame 1 (open), briefly flash frame 0 (blink)
    blinkInterval: 3000,  // ms eyes stay open
    blinkDuration: 150,   // ms blink lasts
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

  let canvas, ctx, rafId, nameEl, areaEl;

  // Name size relative to the drawn mon. Ratio is the desktop pairing this
  // layout has always used: a 224px canvas captioned at 16px.
  const NAME_PER_CANVAS = 16 / 224;
  const nameFit = {};

  // ── pixel helpers ──────────────────────────────────────
  function px(n) { return Math.round(n); }

  // Draw one "pixel block" at logical pixel coordinates.
  function block(color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(px(x), px(y), px(w), px(h));
  }

  // ── draw the companion sprite ───────────────────────────
  // Uses PNG if available (bob + squish via canvas transforms), else block art.
  // Origin (0,0) = top-left of canvas.
  function drawSprite(bobY, sqX, sqY) {
    const cx = CANVAS_SIZE / 2;
    // All mons bottom-anchor to this Y regardless of their display size.
    const GROUND_Y = 192;

    if (SPRITE.spriteSrc) {
      const img = MonSprite.getImage(SPRITE.spriteSrc);
      if (img.complete && img.naturalWidth > 0) {
        let frameIndex;
        if (SPRITE.blinkMode && SPRITE.frames === 2) {
          const t = Date.now() % (SPRITE.blinkInterval + SPRITE.blinkDuration);
          frameIndex = t < SPRITE.blinkDuration ? 0 : 1;
        } else {
          frameIndex = SPRITE.frames > 1
            ? Math.floor(Date.now() / (1000 / SPRITE.fps)) % SPRITE.frames
            : 0;
        }
        let srcX, srcY, srcW, srcH;
        if (SPRITE.frameAxis === 'y') {
          srcW = img.naturalWidth;
          srcH = img.naturalHeight / SPRITE.frames;
          srcX = 0;
          srcY = frameIndex * srcH;
        } else {
          srcW = img.naturalWidth / SPRITE.frames;
          srcH = img.naturalHeight;
          srcX = frameIndex * srcW;
          srcY = 0;
        }
        // Proportional to the sprite's native resolution (see displaySize):
        // MON_BOX is the room for a 64px mon, so 48px -> 132, 36px -> 99 and
        // 32px -> 88. This used to be a flat 160 for every mon, which made
        // a 32px starter exactly as large as a 64px final evolution.
        const size = MonSprite.displaySize(srcW, MON_BOX);
        const cy   = Math.max(size / 2 + 16, GROUND_Y - size / 2);
        state.headY = cy - size / 2; // resting sprite-box top, for the floating name
        // Sprite with bob + squish, slicing the correct frame
        ctx.save();
        ctx.translate(cx, cy + bobY);
        ctx.scale(sqX, sqY);
        ctx.imageSmoothingEnabled = false;
        if (SPRITE.dark)       ctx.filter = DARK_FILTER;
        else if (SPRITE.shiny) ctx.filter = 'hue-rotate(120deg) saturate(1.6) brightness(1.08)';
        ctx.drawImage(img, srcX, srcY, srcW, srcH, Math.round(-size / 2), Math.round(-size / 2), size, size);
        ctx.restore();
        if (SPRITE.shiny && !SPRITE.dark) MonSprite.drawSparkle(ctx, cx, cy + bobY, 1, size);
        return;
      }
    }

    // Body dimensions (before squish)
    const bw = 48, bh = 48;
    const cy = GROUND_Y - bh / 2; // bottom-anchor block art at same ground level
    // Apply squash/stretch around the centre
    const drawW = bw * sqX;
    const drawH = bh * sqY;
    const x0 = cx - drawW / 2;
    const y0 = cy - drawH / 2 + bobY;


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

    // --- Sinusoidal bob (matches the encounter/catch screen: sin(frame/22)*6, no squish) ---
    state.y = Math.sin(state.frame / 22) * 6;
    state.squishY = 1;
    state.squishX = 1;

    // Name floats just above the mon's head (tracks sprite size) and bobs in sync
    if (nameEl) {
      if (SPRITE.noMon) {
        // Empty state: there is no head to track, and state.headY holds a stale
        // fallback that lands the text on top of the "?" placeholder. Clear the
        // inline styles so the stylesheet (.companion-name.is-prompt) places it.
        nameEl.style.top = '';
        nameEl.style.transform = '';
        nameEl.style.fontSize = '';
        nameFit.key = null;
      } else {
        // Measured against the canvas's own box rather than the stage's.
        // The two coincide everywhere except on a phone, where style-v3.css
        // draws the canvas larger than the stage it sits in (and offset above
        // it) so the mon can be bigger without the panel growing — a stage
        // percentage there would put the name somewhere on the mon's face.
        // The name is floored so it can't ride up into the LV pill / XP bar.
        // That floor used to be a flat 15% of the stage, from when the row
        // was ~26px tall and the mon's head never got near it; at the phone's
        // 1.7x the head clears the row entirely and the caption landed on top
        // of the XP bar. Measured off the row itself now, so it holds at any
        // mon size — and falls back to the old 15% when the row is hidden
        // (no companion yet), where the stage's whole top is free.
        const headFrac = (state.headY || 96) / CANVAS_SIZE;
        const stageH   = nameEl.offsetParent ? nameEl.offsetParent.offsetHeight : canvas.offsetHeight;
        const metaEl   = document.querySelector('.companion-meta');
        const metaShown = metaEl && getComputedStyle(metaEl).visibility !== 'hidden';
        const floorPx  = metaShown ? metaEl.offsetTop + metaEl.offsetHeight + 4
                                   : 0.15 * stageH;
        const topPx    = canvas.offsetTop + (headFrac - 0.10) * canvas.offsetHeight;
        nameEl.style.top = `${Math.max(floorPx, topPx)}px`;
        nameEl.style.transform = `translateY(${state.y.toFixed(1)}px)`;
        // Same reason the top is measured off the canvas and not the stage:
        // on a phone the canvas is the box that actually grew. Width cap is
        // the panel, which the 1.7x canvas is wider than.
        sizeMonName(nameEl, canvas.offsetWidth * NAME_PER_CANVAS, areaEl, nameFit);
      }
    }

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
    if (SPRITE.noMon) { drawPlaceholderRotation(state.y); rafId = requestAnimationFrame(tick); return; }
    drawSprite(state.y, state.squishX, state.squishY);

    rafId = requestAnimationFrame(tick);
  }

  // ── Empty-state placeholder — no mon caught yet, so there's nothing to
  // draw for real. Instead of a static "?", cycle through every Pomomon's
  // silhouette — every entry in MONS *plus* every evolution stage, even the
  // ones that can't be caught yet — as a "who's out there" teaser. It
  // quick-fades from one to the next, bottom-anchored at the same GROUND_Y
  // real mons use so the rotation doesn't jump around vertically. ──
  // Halved from 700/150 to run the rotation at double speed. Both numbers
  // move together so the crossfade stays the same share of each species'
  // turn — halving only the hold would leave the fade covering 43% of it and
  // the teaser would read as a blur rather than a cycle.
  const SILHOUETTE_SHOW_MS = 350;  // how long each species holds before swapping
  const SILHOUETTE_FADE_MS = 75;   // crossfade duration at the start of each swap

  let silhouettePool  = null; // lazy-built: MONS filtered to sprite-bearing entries
  let silhouetteIndex = -1;
  // The outgoing species itself, not its index: the pool is reshuffled between
  // passes, so an index kept across one would point at a different mon and the
  // crossfade would fade out something that was never on screen.
  let silhouettePrevMon = null;
  let silhouetteSwitchAt    = 0;
  let silhouetteFadeStartAt = 0;

  function ensureSilhouettePool() {
    if (silhouettePool && silhouettePool.length) return;
    if (typeof MONS === 'undefined') { silhouettePool = []; return; } // not loaded yet
    // Flatten the roster: each base mon, then each of its evolution stages
    // merged onto the base so every stage carries its own sprite fields.
    // Evolutions that aren't catchable yet are still previewed here.
    silhouettePool = [];
    for (const m of MONS) {
      if (m.sprite) silhouettePool.push(m);
      for (const evo of (m.evolutions || [])) {
        const stage = { ...m, ...evo };
        if (stage.sprite) silhouettePool.push(stage);
      }
    }
    shuffleSilhouettes();
    MonSprite.preloadAll(silhouettePool, () => {});
  }

  // Roster order walked the dex 1, 2, 3... and, worse, put each mon directly
  // next to its own evolutions — the teaser read as a list being recited
  // rather than a glimpse of what's out there. Fisher-Yates, reshuffled at the
  // end of every pass so the sequence doesn't visibly repeat either (a pass is
  // only ~10s at 350ms a species).
  function shuffleSilhouettes(avoid) {
    for (let i = silhouettePool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = silhouettePool[i]; silhouettePool[i] = silhouettePool[j]; silhouettePool[j] = t;
    }
    // A reshuffle can deal the species that's still on screen back into first
    // place, which would read as the rotation having stalled. Swap it away.
    if (avoid && silhouettePool.length > 1 && silhouettePool[0] === avoid) {
      const j = 1 + Math.floor(Math.random() * (silhouettePool.length - 1));
      const t = silhouettePool[0]; silhouettePool[0] = silhouettePool[j]; silhouettePool[j] = t;
    }
  }

  // Draws one species as a flat silhouette: a drop shadow, then a solid,
  // fully-opaque black fill traced from the sprite's alpha shape. The
  // drawImage's own colours don't matter here — 'source-in' repaints only
  // the pixels it just covered, i.e. exactly the sprite's silhouette, with
  // SILHOUETTE_COLOR. `alpha` only drives the brief crossfade between one
  // species and the next; a settled silhouette sits at full opacity.
  const SILHOUETTE_COLOR = '#000';
  function drawSilhouette(mon, bobY, alpha) {
    if (!mon || alpha <= 0) return;
    const img = MonSprite.getImage(mon.sprite);
    if (!img.complete || img.naturalWidth === 0) return; // still loading — skip this frame

    const frames = mon.spriteFrames || 1;
    const axis   = mon.spriteAxis || 'x';
    const frameIdx = frames > 1 ? frames - 1 : 0; // last frame = eyes-open on blink sheets
    let srcW, srcH, srcX, srcY;
    if (axis === 'y') {
      srcW = img.naturalWidth;
      srcH = img.naturalHeight / frames;
      srcX = 0; srcY = frameIdx * srcH;
    } else {
      srcW = img.naturalWidth / frames;
      srcH = img.naturalHeight;
      srcX = frameIdx * srcW; srcY = 0;
    }

    const GROUND_Y = 192; // matches drawSprite()'s real-mon anchor
    const cx   = CANVAS_SIZE / 2;
    const size = MonSprite.displaySize(srcW, MON_BOX); // same rule as drawSprite()
    const cy   = Math.max(size / 2 + 16, GROUND_Y - size / 2);
    const dx = Math.round(-size / 2), dy = Math.round(-size / 2);

    ctx.save();
    ctx.translate(cx, cy + bobY);
    ctx.imageSmoothingEnabled = false;

    ctx.globalAlpha = alpha * 0.35;
    ctx.filter = 'brightness(0)';
    ctx.drawImage(img, srcX, srcY, srcW, srcH, dx + 3, dy + 3, size, size);
    ctx.filter = 'none';

    ctx.globalAlpha = alpha;
    ctx.drawImage(img, srcX, srcY, srcW, srcH, dx, dy, size, size);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = SILHOUETTE_COLOR;
    ctx.fillRect(dx - 4, dy - 4, size + 8, size + 8);

    ctx.restore();
  }

  function drawPlaceholderRotation(bobY) {
    ensureSilhouettePool();
    if (!silhouettePool.length) return; // MONS not loaded yet — nothing to show

    const now = Date.now();
    if (now >= silhouetteSwitchAt) {
      silhouettePrevMon = silhouettePool[silhouetteIndex] || null;
      if (silhouetteIndex + 1 >= silhouettePool.length) {
        shuffleSilhouettes(silhouettePrevMon);   // new order for the next pass
        silhouetteIndex = 0;
      } else {
        silhouetteIndex++;
      }
      silhouetteSwitchAt    = now + SILHOUETTE_SHOW_MS;
      silhouetteFadeStartAt = now;
    }
    const fadeT = Math.min(1, (now - silhouetteFadeStartAt) / SILHOUETTE_FADE_MS);
    if (fadeT < 1 && silhouettePrevMon) {
      drawSilhouette(silhouettePrevMon, bobY, 1 - fadeT);
    }
    drawSilhouette(silhouettePool[silhouetteIndex], bobY, fadeT);
  }

  // ── public API ─────────────────────────────────────────
  // Re-skin the companion with a caught mon's colours/sprite (called by collection.js).
  function setMon(mon) {
    SPRITE.noMon      = false;
    SPRITE.bodyColor  = mon.color;
    SPRITE.blushColor = mon.color + '99';
    SPRITE.shiny      = mon.shiny || false;
    SPRITE.dark       = mon.dark  || false;
    SPRITE.spriteSrc  = (mon.shiny && !mon.dark) ? (mon.shinySprite || mon.sprite || null)
                                                 : (mon.sprite || null);
    SPRITE.frames        = mon.spriteFrames    || 1;
    SPRITE.fps           = mon.spriteFps       || 8;
    SPRITE.frameAxis     = mon.spriteAxis      || 'x';
    SPRITE.blinkMode     = mon.spriteBlinkMode || false;
    SPRITE.blinkInterval = mon.blinkInterval   || 3000;
    SPRITE.blinkDuration = mon.blinkDuration   || 150;
    if (SPRITE.spriteSrc) MonSprite.preload(mon);
  }

  function init(canvasEl) {
    canvas = canvasEl;
    ctx    = canvas.getContext('2d');
    nameEl = document.getElementById('companion-name');
    areaEl = canvas.closest('.companion-area');

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

  // Reset to the empty state (draws the "?" placeholder). Called when there is
  // no active companion so a previously-shown mon isn't left on the canvas.
  function clearMon() {
    SPRITE.noMon     = true;
    SPRITE.spriteSrc = null;
  }

  return { init, stop, setMon, clearMon };
})();

// ── Encounter screen ───────────────────────────────────────
const EncounterScreen = (() => {
  const SIZE      = 480;          // logical canvas width (wider to fit ground sprite)
  const H         = 380;          // logical canvas height — tall for long throw arc
  const MON_SCALE = 1.5;          // wild mon drawn at 1.5× base size
  // Room a 64px mon would get; smaller sprites scale down from it in
  // proportion to their native width. Wild spawns come from getRandomMon(),
  // which only ever returns first-stage mons (32/36/48px) — so this is set
  // so that a 48px mon, the largest that can actually appear, lands on 184,
  // exactly where it sat under the old hard cap. Only the smaller classes
  // move, and they move down to where they belong rather than everything
  // being pinned to one size.
  const MON_BOX   = 245;
  const MON_CY    = H * 0.5;      // mon centre-Y resting position (50% — vertical centre)
  const THROW_Y_SHIFT = -30;                          // shift whole throw animation up
  const GROUND_Y  = Math.min(H - 50, MON_CY + 110 + THROW_Y_SHIFT); // where tomato lands

  const _tomatoImg = new Image();
  _tomatoImg.src = 'assets/sprites/Tomato/Tomato.png';

  const _groundImg = new Image();
  _groundImg.src = 'assets/sprites/Ground/Ground1.png';

  // Draw one square "pixel" block, snapped to whole screen pixels — same
  // convention as MonSprite's sparkle FX. Used instead of ctx.arc()/stroke()
  // for the catch-effect bursts below so they read as chunky 8-bit particles
  // rather than smooth anti-aliased vector shapes.
  function block(color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  // A ring of square blocks around (cx, cy) — the pixel-art stand-in for a
  // stroked/filled circle.
  function blockRing(color, cx, cy, radius, blockSize, count, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const bx = cx + Math.cos(angle) * radius;
      const by = cy + Math.sin(angle) * radius;
      block(color, bx - blockSize / 2, by - blockSize / 2, blockSize, blockSize);
    }
    ctx.restore();
  }

  // DOM refs (resolved on first start() call)
  let overlay, canvas, ctx,
      elMsg, elSub, elRarity, elTags, elLevel, elControls, elMonName, elShareMsg,
      btnThrow, btnFlee, btnCatchNext, btnCatchDex, btnCatchShare;

  let rafId    = null;
  let onDone   = null;

  // As in CompanionCanvas, but off this canvas's own reference size: the
  // encounter mon sits in a 480x380 box, captioned at 16px when the stage
  // is at its full 480px. Short-screen tiers cap the stage at 380/300/227px
  // and the canvas scales with it, so the caption now scales too.
  const NAME_PER_CANVAS = 16 / SIZE;
  const nameFit = {};

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
    const shiny = (st.mon.shiny && !st.mon.dark) || false;
    // Proportional to native resolution — MON_BOX is the room a 64px mon
    // gets, everything else scales down from it. This was
    // `fitScale(mon, 184, ...)`, a hard cap: at MON_SCALE 1.5 a 48px and a
    // 64px mon both landed on exactly 184 while a 32px one sat at 144, so
    // the top three size classes were nearly indistinguishable.
    const srcW = MonSprite.nativeFrameW(st.mon, shiny);
    const base = srcW === null ? MON_SCALE
                               : MonSprite.displaySize(srcW, MON_BOX) / (srcW * 3);
    // `scale` still rides along so the catch animation can shrink the mon.
    const s = base * (scale / MON_SCALE);
    MonSprite.drawOnCtx(ctx, st.mon, cx, cy, { scale: s, xOffset, alpha, shiny: st.mon.shiny || false, dark: st.mon.dark || false });
    // Track the drawn sprite size so the floating name can sit above the mon's head
    const img = MonSprite.getImage(shiny ? (st.mon.shinySprite || st.mon.sprite) : st.mon.sprite);
    if (img && img.complete && img.naturalWidth) {
      const srcW = st.mon.spriteAxis === 'y' ? img.naturalWidth : img.naturalWidth / (st.mon.spriteFrames || 1);
      st.monSize = srcW * 3 * s;
    }
  }

  // Place the floating name just above the mon's head, tracking its drawn size + bob.
  // Stays hidden until the sprite size is known so it doesn't flash at a stale spot.
  function positionMonName() {
    if (!elMonName) return;
    if (!st.monSize) { elMonName.style.opacity = '0'; return; }
    const boxTop = (MON_CY - st.monSize / 2) / H * 100; // sprite-box top, % of canvas
    elMonName.style.top = (boxTop - 7) + '%';
    // Floored at 12px rather than the default 8. The arena's other copy
    // (.encounter-sub is 13px on a phone) doesn't shrink with the canvas,
    // so a pure ratio would leave the mon's own name the smallest text on
    // the screen it headlines.
    sizeMonName(elMonName, canvas.offsetWidth * NAME_PER_CANVAS,
                canvas.closest('.encounter-arena'), nameFit, 12);
    elMonName.style.transform = `translateY(${st.monY.toFixed(1)}px)`;
    elMonName.style.opacity = '1';
  }

  // ── tomato renderer — draws PNG centred at origin, r controls display size ──
  function drawTomatoPixelArt(r) {
    const size = r * 2;
    if (_tomatoImg.complete && _tomatoImg.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(_tomatoImg, -size / 2, -size / 2, size, size);
    } else {
      // Fallback: plain red circle until image loads
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#e74c3c';
      ctx.fill();
    }
  }

  // ── draw the tomato projectile ────────────────────────────
  // t: 0→1 progress. Tomato launches from player side (bottom-right)
  // in a high parabolic arc toward the monster, like a Pokéball throw.
  function drawTomato(t) {
    const startX = st.throwStartX;
    const startY = st.throwStartY;  // button position in canvas coords
    const endX   = SIZE / 2;
    const endY   = MON_CY + THROW_Y_SHIFT;
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

  // ── ground sprite platform ───────────────────────────────────
  function drawPlatform() {
    if (!_groundImg.complete || !_groundImg.naturalWidth) return;
    const w  = 460;
    const h  = 230;
    const cx = SIZE / 2;
    const cy = MON_CY + 78;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(_groundImg, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  }

  // ── phase draw dispatcher ─────────────────────────────────
  function draw() {
    ctx.clearRect(0, 0, SIZE, H);
    drawPlatform();
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
      positionMonName();

    } else if (st.phase === 'throwing') {
      // Mon stays fully visible throughout the throw arc
      drawMon(cx, MON_CY + st.monY);
      if (f / 90 < 1) drawTomato(f / 90);

    } else if (st.phase === 'absorbing') {
      // Expanding white impact ring — a burst of square pixels, not a smooth stroke
      if (f < 12) {
        const rt = f / 12;
        blockRing('#fff', cx, MON_CY, 8 + rt * 50, 6, 12, (1 - rt) * 0.85);
      }
      // Mon shrinks rapidly into the tomato (easeIn scale-down)
      const absT  = Math.min(1, f / 35);
      const monSc = MON_SCALE * Math.max(0, 1 - absT * absT);
      if (monSc > 0.05) drawMon(cx, MON_CY, { scale: monSc });
      // Tomato sits at impact point on top
      drawTomatoBall(cx, MON_CY, 0);

    } else if (st.phase === 'falling') {
      // Tomato drops with gravity ease-in from MON_CY to GROUND_Y
      const fallT = Math.min(1, f / 12);
      const y     = MON_CY + (GROUND_Y - MON_CY) * fallT * fallT;
      drawTomatoBall(cx, y, 0);

    } else if (st.phase === 'landing') {
      // Two bounces with squish on each ground contact
      let y = GROUND_Y, sx = 1, sy = 1;
      if (f <= 3) {                          // initial impact squish
        const d = Math.exp(-(f / 3) * 5);
        sx = 1 + 0.30 * d;  sy = 1 - 0.22 * d;
      } else if (f <= 14) {                  // bounce 1 arc (45px high, 11f)
        const bt = (f - 3) / 11;
        y = GROUND_Y - 45 * 4 * bt * (1 - bt);
      } else if (f <= 17) {                  // bounce 1 landing squish
        const d = Math.exp(-((f - 14) / 3) * 5);
        sx = 1 + 0.18 * d;  sy = 1 - 0.14 * d;
      } else if (f <= 25) {                  // bounce 2 arc (22px high, 8f)
        const bt = (f - 17) / 8;
        y = GROUND_Y - 22 * 4 * bt * (1 - bt);
      } else if (f <= 28) {                  // bounce 2 landing squish
        const d = Math.exp(-((f - 25) / 3) * 5);
        sx = 1 + 0.10 * d;  sy = 1 - 0.08 * d;
      }                                      // f>28: ball rests still
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
      // Shimmer effect tied to the click — window frames 22–58, click fires at 25.
      // A pixel-dust burst (two block rings) stands in for the old smooth
      // glow + thin rotating ray lines, so the catch confirmation reads as
      // 8-bit particles rather than a vector glow.
      if (f >= 22 && f <= 58) {
        const t = (f - 22) / 36;
        const shimAlpha = Math.sin(t * Math.PI);
        blockRing('#fff', cx, GROUND_Y, 14 + t * 16, 5, 10, shimAlpha * 0.55);
      }
      drawTomatoBall(cx, GROUND_Y, 0);
      if (f >= 22 && f <= 58) {
        const t = (f - 22) / 36;
        const shimAlpha = Math.sin(t * Math.PI);
        blockRing('#ffe082', cx, GROUND_Y, 26 + t * 24, 6, 8, shimAlpha * 0.90);
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
      positionMonName();
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
    } else if (st.phase === 'falling' && st.frame >= 12) {
      st.phase = 'landing';
      st.frame = 0;
      SFX.play('bounce');                   // initial landing bounce
    } else if (st.phase === 'landing') {
      if (st.frame === 15) SFX.play('bounce'); // bounce 1 hits ground
      if (st.frame === 26) SFX.play('bounce'); // bounce 2 hits ground
      if (st.frame >= 45) {
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
        elSub.style.color = '#fff';

        // Swap buttons: hide throw/flee, show NEXT/INFO/SHARE
        btnThrow.hidden      = true;
        btnFlee.hidden       = true;
        btnCatchNext.hidden  = false;
        btnCatchDex.hidden   = false;
        btnCatchShare.hidden = false;
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

  function saveCaught() {
    // Use the level shown to the player at encounter start
    const initLevel = st.monLevel || 1;

    const record = { id: st.mon.id, name: st.mon.name,
                     shiny: st.mon.shiny || false, dark: st.mon.dark || false,
                     caughtAt: Date.now(),
                     palLevel: initLevel };

    // Kept so the INFO button can open this exact record's detail card.
    // addCaught also stamps gender/nature onto the same object.
    st.caughtRec = record;

    if (typeof Collection !== 'undefined') {
      st.caughtKey = Collection.addCaught(record)
        .then(key => { record._key = key; return key; })
        .catch(() => null);
    } else {                         // fallback (IndexedDB unavailable)
      const list = JSON.parse(localStorage.getItem('pm_caught') || '[]');
      list.push(record);
      localStorage.setItem('pm_caught', JSON.stringify(list));
      record._key  = list.length - 1;
      st.caughtKey = Promise.resolve(record._key);
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
      elTags      = document.getElementById('encounter-tags');
      elLevel     = document.getElementById('encounter-level');
      elControls  = document.getElementById('encounter-controls');
      elMonName   = document.getElementById('encounter-mon-name');
      elShareMsg  = document.getElementById('encounter-share-msg');
      btnThrow    = document.getElementById('btn-throw');
      btnFlee     = document.getElementById('btn-flee');
      btnCatchNext = document.getElementById('btn-catch-next');
      btnCatchDex = document.getElementById('btn-catch-dex');
      btnCatchShare = document.getElementById('btn-catch-share');

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
      btnCatchDex.addEventListener('click', openCaughtInfo);
      btnCatchShare.addEventListener('click', shareCatch);
    }

    onDone = doneCb;

    // Pick a random mon — clone it so shiny/dark rolls never mutate the shared MONS roster
    const mon   = { ...getRandomMon() };
    mon.shiny   = Math.random() < 0.01;               // shiny rate = 1%
    // Dark variant — rare darkened version of any mon. Shiny takes priority:
    // dark only applies when the mon did NOT roll shiny.
    mon.dark    = !mon.shiny && Math.random() < 0.05; // dark rate = 5%
    st.mon      = mon;
    MonSprite.preload(mon); // start loading PNG early so it's ready by first draw
    st.phase    = 'appearing';
    st.frame    = 0;
    st.monBob   = 0;
    st.monY     = 0;
    st.monSize  = 0;   // recomputed once the sprite image is ready
    st.caught   = false;
    st.caughtRec = null;
    st.caughtKey = null;

    // Compute wild mon level (player level ±2) once at encounter start
    const playerLevel = parseInt(localStorage.getItem('pm_level') || '1', 10);
    const offset      = Math.floor(Math.random() * 5) - 2;
    st.monLevel       = Math.max(1, Math.min(100, playerLevel + offset));

    // Populate UI
    elMsg.textContent = 'A WILD MON APPEARED!';
    if (elMonName) { elMonName.textContent = mon.name; elMonName.style.opacity = '0'; }
    elSub.textContent = '';
    elSub.style.color = '';
    const isShiny = mon.shiny || false;
    const isDark  = mon.dark  || false;
    elRarity.textContent = isDark ? 'DARK' : isShiny ? 'SHINY' : '';
    elRarity.className   = `encounter-rarity ${isDark ? 'pitch-black' : isShiny ? 'ultra-rare' : ''}`;
    if (elTags) {
      elTags.innerHTML = '';
      // Show only the mon's normal type badge(s) — shiny/dark status is shown in the rarity slot.
      if (typeof makeTypeBadges === 'function' && mon.type) {
        elTags.appendChild(makeTypeBadges(mon.type));
      }
    }
    if (elLevel) { elLevel.textContent = `LV ${st.monLevel}`; elLevel.style.display = ''; }

    // Reset button state for repeat encounters
    btnThrow.hidden      = false;
    btnFlee.hidden       = false;
    btnCatchNext.hidden  = true;
    btnCatchDex.hidden   = true;
    btnCatchShare.hidden = true;
    elControls.classList.remove('postcatch');
    if (elShareMsg) { elShareMsg.textContent = ''; elShareMsg.classList.remove('is-shown', 'is-bad'); }

    enableButtons(false); // disabled until 'idle' phase

    SFX.play('encounter');

    // Flash transition, then reveal encounter overlay and start music
    runFlashTransition(() => {
      overlay.classList.add('active');
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
      // if (typeof SFX !== 'undefined') SFX.music.start();  // music disabled
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
    st.throwStartY = (br.top  + br.height / 2 - cr.top)  * (H    / cr.height) + THROW_Y_SHIFT;

    st.phase = 'throwing';
    st.frame = 0;
  }

  function flee() {
    if (st.phase !== 'idle') return;
    if (typeof saveExp === 'function') saveExp(5);
    elSub.textContent = 'YOU FLED SAFELY.';
    close();
  }

  // Hold the outgoing overlay until the incoming card has finished animating
  // in, then drop it. Both cards enter on the mon-info-appear keyframes, which
  // start at opacity 0 — so whatever sits behind them is visible through the
  // whole 300-350ms fade, not just for the frame the class changes on. Raising
  // the card first and dropping this overlay immediately still played that
  // fade over the timer screen. Waiting for animationend means it plays over
  // the encounter overlay instead, and reads as a crossfade.
  //
  // animationend bubbles, so the listener has to ignore animations finishing
  // on the card's own children. The timeout is the backstop for when no
  // animation runs at all — prefers-reduced-motion, or a browser that never
  // fires the event — where waiting forever would strand the overlay up.
  function afterCardAppears(el) {
    return new Promise(resolve => {
      if (!el) return resolve();
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        el.removeEventListener('animationend', onEnd);
        clearTimeout(timer);
        resolve();
      };
      const onEnd = e => { if (e.target === el) finish(); };
      el.addEventListener('animationend', onEnd);
      const timer = setTimeout(finish, 600);
    });
  }

  // Share the catch to Discord, Twitter/X, texts, whatever the OS share
  // sheet offers — or, on browsers with no share sheet (most desktops),
  // copy a caption + the catch snapshot so it can be pasted straight into
  // a Discord message box. Doesn't touch the encounter overlay: NEXT/INFO
  // stay available after sharing, same postcatch screen either way.
  async function shareCatch() {
    const mon     = st.mon;
    const variant = mon.shiny ? 'shiny ' : mon.dark ? 'dark ' : '';
    const text    = `I just caught a ${variant}${mon.name} on PomoMons! \u{1F345}`;
    const url     = 'https://pomomons.io';

    // Built synchronously (toDataURL + atob) rather than the async
    // canvas.toBlob — share()/clipboard.write() both require a live user
    // gesture, and awaiting toBlob() first was long enough in testing to
    // lose it: share() then rejected (silently, not AbortError) and the
    // clipboard fallback hung forever with no gesture of its own, so
    // SHARE just quietly did nothing.
    let blob = null;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const base64  = dataUrl.slice(dataUrl.indexOf(',') + 1);
      const binary  = atob(base64);
      const bytes   = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      blob = new Blob([bytes], { type: 'image/png' });
    } catch (_) { /* snapshot is a nice-to-have, not required to share */ }
    const file = blob ? new File([blob], 'pomomon-catch.png', { type: 'image/png' }) : null;

    // Prefer the native share sheet (this is what actually gets Discord's
    // mobile app, iMessage, etc. onto the list) — try with the snapshot
    // attached, then without, before falling back to clipboard.
    if (navigator.share) {
      const withFile = file && navigator.canShare && navigator.canShare({ files: [file] });
      const shareData = withFile ? { text, url, files: [file] } : { text, url };
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return; // user backed out of the sheet
        // otherwise fall through to the clipboard fallback below
      }
    }

    // Desktop fallback: no share sheet, so copy instead. Image + text
    // together when the clipboard API supports it (Chrome/Edge), so
    // pasting into Discord brings both; plain text everywhere else, and
    // also if the image attempt itself is the thing that fails. Raced
    // against a timeout: without a live gesture (e.g. share() above
    // already spent it) clipboard calls don't reject, they hang forever —
    // an honest failure message beats a button that quietly does nothing.
    const withTimeout = p => Promise.race([
      p, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
    ]);
    try {
      if (blob && typeof ClipboardItem !== 'undefined') {
        await withTimeout(navigator.clipboard.write([new ClipboardItem({
          'text/plain': new Blob([`${text} ${url}`], { type: 'text/plain' }),
          'image/png':  blob,
        })]));
      } else {
        await withTimeout(navigator.clipboard.writeText(`${text} ${url}`));
      }
      say(elShareMsg, 'Copied! Paste it in Discord or anywhere.');
    } catch (_) {
      try {
        await withTimeout(navigator.clipboard.writeText(`${text} ${url}`));
        say(elShareMsg, 'Copied! Paste it in Discord or anywhere.');
      } catch (__) {
        say(elShareMsg, "Couldn't copy — try again?", true);
      }
    }
  }

  function say(el, text, bad) {
    if (!el) return;
    clearTimeout(el._hideTimer);
    el.textContent = text;
    el.classList.toggle('is-bad', !!bad);
    el.classList.add('is-shown');
    el._hideTimer = setTimeout(() => el.classList.remove('is-shown'), 3500);
  }

  // Raise the info card BEFORE dropping the encounter overlay, not after. Its
  // start() awaits an IndexedDB read (the caught-names set for the evolution
  // chain) before it shows anything, so hiding the encounter overlay up front
  // left nothing covering the timer screen for those frames too. The info card
  // is z-index 170 against the encounter overlay's 100, so it covers it from
  // the moment it appears.
  async function openMonInfo() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    try {
      await MonInfoScreen.start(st.mon, onDone);
      await afterCardAppears(document.getElementById('mon-info-overlay'));
    } finally {
      // finally, so a failed lookup can't strand the player on the encounter
      // overlay with a dead NEXT button.
      overlay.classList.remove('active');
    }
  }

  // Skip the mon-info card and open the caught mon's own detail card —
  // the same card My Mons opens. Falls back to the collection screen if the
  // record couldn't be resolved.
  async function openCaughtInfo() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

    // Same ordering as openMonInfo above: resolve everything this needs while
    // the encounter overlay is still up, open the destination, and only then
    // take the overlay down. Tearing it down first (and running onDone, which
    // puts the timer screen back) meant the wait on st.caughtKey was spent
    // looking at the timer screen.
    await st.caughtKey;   // the record needs its real key before equip/rename work
    const rec  = st.caughtRec;
    const base = rec && typeof MONS !== 'undefined' ? MONS.find(m => m.id === rec.id) : null;

    if (base && typeof Collection !== 'undefined' && Collection.openMonDetail) {
      Collection.openMonDetail(base, rec);
      // Same 0.3s opacity-0 entry as the info card — hold this overlay behind
      // it until it lands. The My Mons fallback below is a screen, not an
      // overlay, and has no entry animation to wait on.
      await afterCardAppears(document.getElementById('mon-detail-overlay'));
    } else if (typeof showScreen === 'function') {
      showScreen('mymons');
    }

    overlay.classList.remove('active');
    if (typeof onDone === 'function') onDone();
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
    const bobY  = Math.sin(st.frame / 22) * 6;
    const scale = MonSprite.sizeScale(st.mon, SIZE * 0.92, 1.5, (st.mon.shiny && !st.mon.dark) || false);
    MonSprite.drawOnCtx(ctx, st.mon, SIZE / 2, SIZE / 2 + bobY,
      { scale, shiny: st.mon.shiny || false, dark: st.mon.dark || false });
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
    elShiny.textContent = mon.dark ? '🖤 DARK!' : mon.shiny ? '✨ SHINY!' : '';

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
    const bobY  = Math.sin(st.frame / 22) * 6;
    const scale = MonSprite.sizeScale(st.mon, CANVAS_SIZE * 0.92, 1.5, (st.mon.shiny && !st.mon.dark) || false);
    MonSprite.drawOnCtx(ctx, st.mon, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + bobY,
      { scale, shiny: st.mon.shiny || false, dark: st.mon.dark || false });
    rafId = requestAnimationFrame(tick);
  }

  // ── Build the evolution chain as DOM nodes ──────────────
  function buildEvoChain(mon, ownedNames) {
    elChain.innerHTML = '';

    const dpr = st.dpr;

    function makeNode(monData, labelText, isBase) {
      const owned = !ownedNames || ownedNames.has(monData.name);
      const node = document.createElement('div');
      node.className = 'evo-node' + (isBase ? ' base' : '');

      const c = document.createElement('canvas');
      c.width  = EVO_NODE_SIZE * dpr;
      c.height = EVO_NODE_SIZE * dpr;
      c.style.width  = EVO_NODE_SIZE + 'px';
      c.style.height = EVO_NODE_SIZE + 'px';
      if (!owned) c.style.filter = 'brightness(0) opacity(0.55)';
      const miniCtx = c.getContext('2d');
      if (dpr !== 1) miniCtx.scale(dpr, dpr);
      const s = MonSprite.sizeScale(monData, EVO_NODE_SIZE * 0.88, 0.9, false);
      MonSprite.drawOnCtx(miniCtx, monData,
        EVO_NODE_SIZE / 2, EVO_NODE_SIZE / 2,
        { scale: s, shiny: mon.shiny || false, dark: mon.dark || false });
      node.appendChild(c);

      const nameEl = document.createElement('p');
      nameEl.className   = 'evo-node-name';
      nameEl.textContent = owned ? monData.name.toUpperCase() : '???';
      if (!owned) nameEl.style.opacity = '0.5';
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

    // If this mon has no evolutions, check if it's an evolved form of another base mon
    let rootMon = mon;
    if ((!mon.evolutions || mon.evolutions.length === 0) && typeof MONS !== 'undefined') {
      const parent = MONS.find(m => m.evolutions && m.evolutions.some(e => e.name === mon.name));
      if (parent) rootMon = parent;
    }

    if (!rootMon.evolutions || rootMon.evolutions.length === 0) {
      elChain.appendChild(makeNode(rootMon, 'FINAL FORM', true));
      return;
    }

    elChain.appendChild(makeNode(rootMon, 'BASE', true));

    for (const evo of rootMon.evolutions) {
      elChain.appendChild(makeArrow());
      const evoMon = { ...rootMon, ...evo };
      elChain.appendChild(makeNode(evoMon, `LV ${evo.atLevel}`, false));
    }

    // If any chain sprites weren't loaded yet, redraw once they finish
    const chainMons = [rootMon, ...(rootMon.evolutions || []).map(e => ({ ...rootMon, ...e }))];
    MonSprite.preloadAll(chainMons, () => buildEvoChain(mon, ownedNames));
  }

  // ── dismiss ─────────────────────────────────────────────
  function dismiss() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    overlay.classList.remove('active');
    if (typeof onDone === 'function') onDone();
  }

  // ── public API ───────────────────────────────────────────
  async function start(mon, doneCb) {
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

    const shiny = mon.shiny || false;
    const dark  = mon.dark  || false;
    elName.textContent   = mon.name.toUpperCase();
    elRarity.textContent = dark ? 'DARK' : shiny ? 'SHINY' : '';
    elRarity.className   = `mon-info-rarity ${dark ? 'pitch-black' : shiny ? 'ultra-rare' : ''}`;
    const elDexNum = document.getElementById('mon-info-dexnum');
    if (elDexNum) elDexNum.textContent = mon.dexNum ? `#${String(mon.dexNum).padStart(3, '0')}` : '';
    const elType = document.getElementById('mon-info-type');
    if (elType && typeof makeTypeBadges === 'function') {
      elType.innerHTML = '';
      elType.appendChild(makeTypeBadges(mon.type));
    }

    let ownedNames = null;
    if (typeof Collection !== 'undefined' && typeof Collection.getCaughtNames === 'function') {
      ownedNames = await Collection.getCaughtNames();
    }
    buildEvoChain(mon, ownedNames);

    overlay.classList.add('active');
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  }

  return { start };
})();


// ── MonDetailCanvas ─────────────────────────────────────────
// Small, reusable animated sprite for the individual-mon detail card.
// Bobs the passed mon on the given canvas (same idle motion as everywhere
// else). Collection.js owns the card's DOM/data; canvas drawing stays here.
const MonDetailCanvas = (() => {
  const SIZE = 200; // logical px (matches #mon-detail-canvas width/height)

  let canvas = null, ctx = null, rafId = null, mon = null, frame = 0, scaled = false;

  function tick() {
    frame++;
    ctx.clearRect(0, 0, SIZE, SIZE);
    const bobY  = Math.sin(frame / 22) * 6;
    const scale = MonSprite.sizeScale(mon, SIZE * 0.92, 1.5, (mon.shiny && !mon.dark) || false);
    MonSprite.drawOnCtx(ctx, mon, SIZE / 2, SIZE / 2 + bobY,
      { scale, shiny: mon.shiny || false, dark: mon.dark || false });
    rafId = requestAnimationFrame(tick);
  }

  function start(canvasEl, monData) {
    canvas = canvasEl;
    ctx    = canvas.getContext('2d');
    if (!scaled) {
      const dpr = window.devicePixelRatio || 1;
      if (dpr !== 1) { canvas.width = SIZE * dpr; canvas.height = SIZE * dpr; ctx.scale(dpr, dpr); }
      scaled = true;
    }
    mon   = monData;
    frame = 0;
    if (typeof MonSprite !== 'undefined') MonSprite.preloadAll([mon], () => {});
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  }

  function stop() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }

  return { start, stop };
})();

