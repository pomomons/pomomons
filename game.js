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

// ── Variant odds ───────────────────────────────────────────
// Rolled once per wild encounter (EncounterScreen.start). Shiny is rolled
// first and wins outright; dark is only rolled when shiny missed.
// If these change, update the CATCH RARITY table in index.html (the "?"
// popup) and agent_docs/game-mechanics.md — nothing derives that copy from
// these constants, so it has to be kept in step by hand.
const SHINY_RATE = 1 / 500;   // 0.2%
const DARK_RATE  = 1 / 100;   // 1% (0.998% effective, after the shiny roll)

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

  // ── Where the art actually starts inside its frame ─────────
  // Sprite frames are not tightly cropped: most creatures sit low in their
  // frame with transparent rows above them, and how many varies per sprite.
  //
  // Both screens used to hang the floating caption off the sprite BOX top —
  // the top edge of the square the frame is drawn into — which silently
  // assumes every head touches that edge. It does not, so the gap you saw
  // was the intended gap PLUS that sprite's own padding, and ranged from
  // 6.6px on Guacamonger (16 transparent rows) to 43.9px on Marinaro (104).
  // Same code, same intent, wildly different result per mon.
  //
  // This measures the first row of frame 0 that has any opaque pixel and
  // returns it as a fraction of the frame's height, which is also its
  // fraction of the drawn square. Callers add `fraction * size` to the box
  // top to get the real top of the creature.
  //
  // Measured across every frame, taking the HIGHEST art of any of them, so the
  // caption can never be crossed by the art whichever frame is showing.
  //
  // 18 of the 20 sprites have their two frames vertically aligned, so the
  // frame choice changes nothing for them. Marinaro is the exception: its
  // blink frame adds steam wisps 9 source rows above the pot lid, and the
  // blink is drawn for 450ms out of every 3450ms. Measuring only the resting
  // frame gave it the same 10px gap as everything else and then let the steam
  // cross the caption by 12px during each flash — a 13px caption with the
  // steam straight through it. Clearing the tallest frame is the only option
  // that never collides; the cost is that Marinaro's gap to its lid reads
  // wider than the rest while the steam is not drawn.
  //
  // The real fix for that one mon is in its art: if frame 0's steam were
  // dropped, or added to frame 1 as well, its caption would line up with the
  // rest of the roster automatically and nothing here would need changing.
  const _artTop = {};

  // Takes an already-resolved src plus its sheet layout. CompanionCanvas holds
  // a flattened SPRITE descriptor rather than a mon object, so it calls this
  // one directly; artTopFraction() below is the wrapper for callers that do
  // have a mon.
  function artTopFractionFor(src, frames = 1, axis = 'x', blinkMode = false) {
    if (!src) return 0;
    if (src in _artTop) return _artTop[src] || 0;

    const img = getImage(src);
    if (!img.complete || img.naturalWidth === 0) return 0;  // measure once loaded

    const srcW = axis === 'y' ? img.naturalWidth  : img.naturalWidth / frames;
    const srcH = axis === 'y' ? img.naturalHeight / frames : img.naturalHeight;
    if (!(srcW > 0) || !(srcH > 0)) return 0;

    let frac = 0;
    try {
      const probe = document.createElement('canvas');
      probe.width = srcW; probe.height = srcH;
      const pctx = probe.getContext('2d', { willReadFrequently: true });
      pctx.imageSmoothingEnabled = false;

      let best = srcH;
      for (let f = 0; f < frames; f++) {
        pctx.clearRect(0, 0, srcW, srcH);
        const sx = axis === 'y' ? 0 : f * srcW;
        const sy = axis === 'y' ? f * srcH : 0;
        pctx.drawImage(img, sx, sy, srcW, srcH, 0, 0, srcW, srcH);
        const data = pctx.getImageData(0, 0, srcW, srcH).data;
        let row = -1;
        for (let y = 0; y < srcH && row < 0; y++) {
          for (let x = 0; x < srcW; x++) {
            // 16, not 0: a few sprites carry faint anti-aliased fringe rows
            // that are invisible on screen but would read as the art's top.
            if (data[(y * srcW + x) * 4 + 3] > 16) { row = y; break; }
          }
        }
        if (row >= 0 && row < best) best = row;
      }
      if (best > 0 && best < srcH) frac = best / srcH;
    } catch (e) {
      // getImageData throws on a tainted canvas, which is what happens if the
      // app is opened over file:// rather than served. Cache the failure and
      // fall back to the old box-top behaviour rather than retrying per frame.
      frac = 0;
    }
    _artTop[src] = frac;
    return frac;
  }

  function artTopFraction(mon, shiny = false) {
    if (!mon) return 0;
    return artTopFractionFor(
      shiny ? (mon.shinySprite || mon.sprite) : mon.sprite,
      mon.spriteFrames || 1,
      mon.spriteAxis || 'x',
      mon.spriteBlinkMode || false);
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
           artTopFraction, artTopFractionFor,
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

  // Blank space kept clear above the mon, in canvas units, so the LV badge,
  // the XP bar and the floating name have somewhere to live. drawSprite() caps
  // the mon's drawn size against it.
  //
  // MEASURED, not tuned per breakpoint. The furniture above the mon is a fixed
  // pixel height (a badge, a bar, one or two lines of caption) while the canvas
  // it has to clear is drawn at anything from 148px to 269px, so the same
  // reserve is worth a different amount of room at every size — and the caption
  // wraps to a second line at narrow widths, which moves the target again. Hand
  // numbers held for the viewport they were measured at and failed either side
  // of it; asking the DOM where the badge and bar actually ended up is right
  // everywhere by construction.
  //
  // The guard rails only count when they genuinely sit over the mon's column.
  // On desktop the readout is off to the panel's left and the mon has the whole
  // top of the stage to itself — the overlap test comes back false there, the
  // measurement contributes nothing, and the reserve stays at the 16 the CSS
  // sets, which is exactly the sizing this canvas has always had.
  //
  // Cached because drawSprite() runs every frame and getBoundingClientRect
  // forces layout — refreshed only when something that feeds it can change.
  const GROUND_Y   = 192;  // all mons bottom-anchor here (canvas units)
  // Floor on the mon's own size (canvas units) so a tall stack of furniture on
  // a small phone can't shrink it away to nothing. 64 is a quarter of the
  // canvas height; below that the art stops reading as a creature.
  const MIN_MON_SIZE = 64;
  let _topReserve = 16;
  function readTopReserve() {
    if (!canvas) return;
    const v = parseFloat(getComputedStyle(canvas).getPropertyValue('--mon-top-reserve'));
    let units = Number.isFinite(v) ? v : 16;

    const cRect = canvas.getBoundingClientRect();
    if (cRect.height > 0 && nameEl) {
      // Room for the caption, unconditionally — not only when the LV badge
      // and XP bar sit over the stage. Without this the largest mons hit the
      // size cap (GROUND_Y - 16 = 176) with their heads so close to the top
      // of the canvas that the caption's computed position went ABOVE it and
      // was clamped to the canvas top, collapsing the gap to ~7px while
      // every smaller mon got ~11px. Mirrors the GAP formula in layoutName().
      // Only mons that would actually overrun are affected; everything under
      // the cap keeps its proportional size.
      const capPx = nameEl.offsetHeight + Math.max(8, cRect.height * 0.06);
      units = Math.max(units, capPx / cRect.height * CANVAS_SIZE);

      let lowest = 0;
      for (const g of [document.getElementById('btn-companion-level'),
                       document.querySelector('.companion-meta .xp-frame')]) {
        if (!g) continue;
        const r = g.getBoundingClientRect();
        if (r.right > cRect.left + 8 && r.left < cRect.right - 8) lowest = Math.max(lowest, r.bottom);
      }
      if (lowest > 0) {
        // Room for the lowest guard rail, the caption under it, and a little air.
        const needPx = (lowest - cRect.top) + nameEl.offsetHeight + 12;
        units = Math.max(units, needPx / cRect.height * CANVAS_SIZE);
      }
    }
    _topReserve = Math.min(units, GROUND_Y - MIN_MON_SIZE);
    _lastNameH  = nameEl ? nameEl.offsetHeight : 0;
  }
  // A longer name wraps to a second line and needs another line's worth of
  // room, so the caption's own height is an input to the reserve. tick()
  // watches it rather than re-measuring everything every frame.
  let _lastNameH = 0;

  // Name size relative to the drawn mon. Ratio is the desktop pairing this
  // layout has always used: a 224px canvas captioned at 16px.
  const NAME_PER_CANVAS = 16 / 224;
  const nameFit = {};

  // ── Caption placement ──────────────────────────────────
  // Where the floating name sits, and how big it is, depends on the canvas
  // box, the LV badge and XP bar boxes, the caption's own height and the
  // sprite's head position. All of that is measured off the DOM — and none
  // of it changes from one frame to the next.
  //
  // tick() used to re-derive the lot 60 times a second: eight-odd layout
  // reads, a write to .top, then another read straight after it. Reading a
  // geometry property after writing a layout-affecting one forces the browser
  // to recompute layout synchronously, so the whole measure-move-measure
  // sequence ran, uninterruptible, on every frame for the length of a
  // session. Now it runs when an input actually changes and tick() is left
  // with the transform, which the compositor handles without layout at all.
  //
  // Invalidated by: init, setMon, clearMon, a resize, the pixel font landing,
  // and — caught by the cheap comparisons in tick(), none of which touch
  // layout — a new caption string, a new head position, or app.js showing or
  // hiding .companion-meta.
  let _nameDirty      = true;
  let _namePlaceholder = false;
  let _lastNameText   = null;
  let _lastHeadY      = null;
  let _lastMetaVis    = null;
  let metaEl          = null;

  function invalidateName() { _nameDirty = true; }

  function layoutName() {
    _nameDirty = false;
    if (!nameEl || !canvas) return;

    // Measured against the canvas's own box rather than the stage's.
    // The two coincide everywhere except on a phone, where style-v3.css
    // draws the canvas larger than the stage it sits in (and offset above
    // it) so the mon can be bigger without the panel growing — a stage
    // percentage there would put the name somewhere on the mon's face.
    //
    // The caption's BOTTOM sits GAP above the sprite-box top, so the space
    // you actually see between the text and the mon is what GAP says it is.
    // This used to place the caption's top at a flat 14% of the canvas above
    // the mon, which quietly assumed the caption was small relative to the
    // canvas. On a short phone the canvas is 148px, 14% of it is 21px, and
    // the caption is 15px tall — leaving 6px, then nothing, then a negative
    // gap as soon as anything shifted. GAP is mostly proportional so the
    // desktop spacing is unchanged, with a floor for the small canvases.
    //
    // It's also floored so it can't ride up into the LV pill / XP bar — but
    // only when those actually sit over the sprite column. On desktop
    // .companion-meta is pushed right out to the panel's left, clear of
    // the mon, so a big mon's head has the whole top of the stage free
    // and the caption should use it instead of being pinned onto the
    // mon's forehead. Reserving the row's full height unconditionally
    // (the old rule) is what made medium/large companions look cramped.
    // Measure the real overlap of the two guard rails — the LV badge and
    // the XP bar — against the canvas, and only floor when they cross it
    // (which they do on a phone, where the row is drawn over the stage).
    const headFrac = (state.headY || 96) / CANVAS_SIZE;
    const GAP = Math.max(8, canvas.offsetHeight * 0.06);
    if (!metaEl) metaEl = document.querySelector('.companion-meta');
    const metaShown = metaEl && getComputedStyle(metaEl).visibility !== 'hidden';
    let topPx = canvas.offsetTop + headFrac * canvas.offsetHeight
                - nameEl.offsetHeight - GAP;
    if (metaShown) {
      const parentTop = nameEl.offsetParent
        ? nameEl.offsetParent.getBoundingClientRect().top : 0;
      const cRect = canvas.getBoundingClientRect();
      for (const g of [document.getElementById('btn-companion-level'),
                       metaEl.querySelector('.xp-frame')]) {
        if (!g) continue;
        const r = g.getBoundingClientRect();
        if (r.right > cRect.left + 8 && r.left < cRect.right - 8) {
          topPx = Math.max(topPx, r.bottom - parentTop + 4);
        }
      }
    }
    // Upper bound is the canvas's own top edge, not the stage's. On a phone
    // the canvas is drawn taller than the stage and offset above it, so a
    // big mon's head genuinely starts above the stage — clamping to the
    // stage (the old `Math.max(2, ...)`) shoved the caption back down onto
    // that head. It resolves to 0 wherever canvas and stage coincide, which
    // is everywhere except the phone tiers. The LV/XP floor below is what
    // stops the caption riding up into the readout.
    nameEl.style.top = `${Math.max(canvas.offsetTop, topPx)}px`;
    // Same reason the top is measured off the canvas and not the stage:
    // on a phone the canvas is the box that actually grew. Width cap is
    // the panel, which the 1.7x canvas is wider than.
    sizeMonName(nameEl, canvas.offsetWidth * NAME_PER_CANVAS, areaEl, nameFit);
    // Caption changed height (a longer name wrapped, or the font landed):
    // the mon's size cap is measured off it, so it has to be re-derived.
    // Read last, after both writes above, so this is the only forced reflow
    // in the function rather than one per frame.
    if (nameEl.offsetHeight !== _lastNameH) readTopReserve();

    _lastNameText = nameEl.textContent;
    _lastHeadY    = state.headY;
    _lastMetaVis  = metaEl ? metaEl.style.visibility : null;
  }

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
    // GROUND_Y (module scope) is the line all mons bottom-anchor to, whatever
    // their display size — readTopReserve() measures against the same line.

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
        // Clamped so the sprite box's top can never rise above the reserved
        // band at the top of the canvas. Mons bottom-anchor at GROUND_Y, so
        // the top is GROUND_Y - size, and the largest size that respects a
        // reserve of R is GROUND_Y - R.
        //
        // On desktop R is 16, which yields exactly MON_BOX (176) — the value
        // the old clamp already implied, so nothing there changes. On a phone
        // readTopReserve() measures it much higher: the panel there also has to
        // hold the LV badge, the XP bar and the mon's name, and a 176-unit mon
        // left no room for any of them — the caption ended up printed across a
        // big mon's chest and the badge sat over its head. Only the mons that
        // would actually overrun are affected; everything smaller than the cap
        // keeps its proportional size.
        const size = Math.min(MonSprite.displaySize(srcW, MON_BOX),
                              GROUND_Y - _topReserve);
        const cy   = GROUND_Y - size / 2;
        // The real top of the creature, not the top of its frame: sprites are
        // not tightly cropped, so the box top is the art top PLUS however
        // many transparent rows that particular sprite happens to carry. That
        // padding was being added to the caption's gap, which is why the gap
        // ranged from 7px to 44px across the roster instead of being one
        // distance. artTopFraction() measures it; see its own note.
        const artTop = MonSprite.artTopFractionFor(
          SPRITE.spriteSrc, SPRITE.frames, SPRITE.frameAxis, SPRITE.blinkMode);
        state.headY = cy - size / 2 + artTop * size;
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

    // Name floats just above the mon's head (tracks sprite size) and bobs in
    // sync. Only the bob is per-frame work now — see layoutName().
    if (nameEl) {
      if (SPRITE.noMon) {
        // Empty state: there is no head to track, and state.headY holds a stale
        // fallback that lands the text on top of the "?" placeholder. Clear the
        // inline styles so the stylesheet (.companion-name.is-prompt) places it.
        // Once, not every frame: these are writes, and a write to .top dirties
        // layout even when it sets the same empty string back.
        if (!_namePlaceholder) {
          nameEl.style.top = '';
          nameEl.style.transform = '';
          nameEl.style.fontSize = '';
          nameFit.key = null;
          _namePlaceholder = true;
          _lastNameText = null;
        }
      } else {
        _namePlaceholder = false;
        if (_nameDirty
            || nameEl.textContent !== _lastNameText
            || state.headY !== _lastHeadY
            || (metaEl && metaEl.style.visibility !== _lastMetaVis)) {
          layoutName();
        }
        // The one thing that genuinely changes every frame. transform is
        // composited, so this does not invalidate layout.
        nameEl.style.transform = `translateY(${state.y.toFixed(1)}px)`;
      }
    }

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

  // Draws one species as a flat silhouette traced from the sprite's alpha
  // shape. The drawImage's own colours don't matter here — 'source-in'
  // repaints only the pixels it just covered, i.e. exactly the sprite's
  // outline, with SILHOUETTE_COLOR. `alpha` drives the brief crossfade
  // between one species and the next.
  //
  // Colour and translucency mirror the Pomodex's uncaught tiles, which are
  // drawn normally and then given `brightness(0) opacity(.18)` in CSS
  // (buildDexCard, collection.js): pure black, 18% alpha. Keep the two in
  // step — they are the same idea in two places, and a player sees both.
  // There used to be a second copy of the sprite behind this one, offset 3px
  // and filled at 35% black, as a drop shadow. At full opacity that read as
  // depth; behind an 18% silhouette it would have been twice as dark as the
  // shape casting it, so it's gone rather than scaled down to nothing.
  const SILHOUETTE_COLOR = '#000';
  const SILHOUETTE_ALPHA = 0.18;
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

    // Stamp the shape at full opacity, then let the black fill carry the
    // alpha. 'source-in' multiplies source alpha by destination alpha, so
    // fading the fill alone gives exactly `alpha x SILHOUETTE_ALPHA` — fading
    // both layers (which is what setting globalAlpha before the drawImage
    // did) would square the crossfade instead.
    ctx.globalAlpha = 1;
    ctx.drawImage(img, srcX, srcY, srcW, srcH, dx, dy, size, size);
    ctx.globalCompositeOperation = 'source-in';
    ctx.globalAlpha = alpha * SILHOUETTE_ALPHA;
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
    // New mon, new caption: "COCOKID" and "GUACAMONGER" don't need the same
    // amount of room above the sprite, and the reserve is measured off it.
    readTopReserve();
    invalidateName();
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

    metaEl = document.querySelector('.companion-meta');

    readTopReserve();
    // The reserve comes from a media query, so it changes on rotate/resize —
    // and so does every box the caption is positioned against.
    window.addEventListener('resize', () => { readTopReserve(); invalidateName(); });
    // ...and the pixel font landing re-flows the badge and bar the reserve is
    // sized around, same reason sizeMonName has a font epoch.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { readTopReserve(); invalidateName(); });
    }

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
    invalidateName();
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

  // Warmed for the SHARE card's backdrop (buildShareCanvas, below) — same
  // forest art as the page background, red variant to match a focus-session
  // catch. Loaded now rather than at share time: canvas.toDataURL() has to
  // run synchronously off the click (see shareCatch's comment), and by the
  // time a player reaches SHARE the throw+catch animation has taken several
  // seconds, plenty for these to finish loading.
  const _shareBg = {};
  function getShareBg(kind) {
    if (!_shareBg[kind]) {
      const img = new Image();
      img.src = kind === 'focus' ? 'assets/backgrounds/forest-red.webp' : 'assets/backgrounds/forest.webp';
      _shareBg[kind] = img;
    }
    return _shareBg[kind];
  }
  getShareBg('default'); getShareBg('focus');

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
      elMonNameText, elNameTomato, elDexProg, elDexCount,
      btnThrow, btnFlee, btnCatchNext, btnCatchDex, btnCatchShare;

  // Total number of Pomodex entries (base mons + every evolution stage) —
  // mirrors renderDex() in collection.js. This is the denominator shown as
  // "N / TOTAL" on the catch screen.
  function dexEntryTotal() {
    if (typeof MONS === 'undefined') return 0;
    let n = 0;
    for (const mon of MONS) {
      n++;
      if (mon.evolutions) n += mon.evolutions.length;
    }
    return n;
  }

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
    // Top of the art, not of the frame — see MonSprite.artTopFraction. The
    // encounter screen carried the identical bug: a mon with a lot of
    // transparent rows above it got its name parked well clear of its head.
    const artTop = st.mon
      ? MonSprite.artTopFraction(st.mon, st.mon.shiny && !st.mon.dark) : 0;
    const boxTop = (MON_CY - st.monSize / 2 + artTop * st.monSize) / H * 100;
    // 9% of the canvas above that box, up from 7, so a big mon's head keeps a
    // bit of air between it and the caption.
    elMonName.style.top = (boxTop - 9) + '%';
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

        showDexProgress();
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

  // Fill in the tomato marker beside the mon's name. It starts as a blacked-
  // out silhouette for a species the player doesn't own yet (see start()), so
  // filling it is the marker's whole job: this one is yours now. Called on the
  // same beat as the Pomodex tick below, never on catch itself, so the two
  // read as one event instead of two.
  function fillNameTomato() {
    if (!elNameTomato) return;
    elNameTomato.classList.remove('is-silhouette');
    elNameTomato.classList.remove('is-pop');
    void elNameTomato.offsetWidth;      // restart the CSS pop animation
    elNameTomato.classList.add('is-pop');
  }

  // Reveal the Pomodex progress line on the catch screen and, when this was
  // a brand-new entry, tick the count up by one (N / TOTAL → N+1 / TOTAL)
  // with a blip. dexBefore/dexAfter are filled in asynchronously by start()
  // and saveCaught(); fall back to a +1 estimate if either didn't land.
  function showDexProgress() {
    let before = st.dexBefore;
    let after  = st.dexAfter;
    if (typeof after  !== 'number') after  = (typeof before === 'number') ? before + 1 : null;
    if (typeof before !== 'number') before = (typeof after  === 'number') ? Math.max(0, after - 1) : null;

    const total = (elDexProg && elDexCount) ? dexEntryTotal() : 0;

    // Nothing to tick: the line is missing from the page, the roster size is
    // unknown, or the before/after numbers never landed. Fill the tomato on
    // its own rather than bailing — a mon the player just caught must never
    // be left sitting behind a silhouette.
    if (!total || typeof after !== 'number') {
      fillNameTomato();
      return;
    }

    // Duplicate catch — no new entry. Show the current tally without a tick.
    // The marker was already full from the start of the encounter, so this
    // only replays the pop.
    if (after <= before) {
      elDexCount.textContent = `${after} / ${total}`;
      elDexProg.hidden = false;
      fillNameTomato();
      return;
    }

    // New entry: show the pre-catch number, then bump it after a beat.
    elDexCount.textContent = `${before} / ${total}`;
    elDexProg.hidden = false;
    setTimeout(() => {
      elDexCount.textContent = `${after} / ${total}`;
      elDexCount.classList.remove('is-tick');
      void elDexCount.offsetWidth;      // restart the CSS pop animation
      elDexCount.classList.add('is-tick');
      fillNameTomato();
      SFX.play('dexTick');
    }, 650);
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
      // Re-read the unique-entry count once the record is stored, so the
      // catch screen can animate dexBefore → dexAfter. Runs in parallel with
      // the shake/lock frames, so it's ready by the postcatch reveal.
      if (typeof Collection.getCaughtNames === 'function') {
        st.caughtKey
          .then(() => Collection.getCaughtNames())
          .then(names => { st.dexAfter = names.size; })
          .catch(() => { st.dexAfter = null; });
      }
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
      elMonNameText = document.getElementById('encounter-mon-name-text');
      elNameTomato  = document.getElementById('encounter-name-tomato');
      elShareMsg  = document.getElementById('encounter-share-msg');
      elDexProg   = document.getElementById('encounter-dex-progress');
      elDexCount  = document.getElementById('encounter-dex-count');
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
    mon.shiny   = Math.random() < SHINY_RATE;
    // Dark variant — rare darkened version of any mon. Shiny takes priority:
    // dark only applies when the mon did NOT roll shiny, so the dark rate you
    // actually see is DARK_RATE x (1 - SHINY_RATE) — 0.998% rather than a flat
    // 1%. The difference is a rounding artifact at these odds; the ? popup
    // quotes the effective numbers.
    mon.dark    = !mon.shiny && Math.random() < DARK_RATE;
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
    if (elMonName) {
      if (elMonNameText) elMonNameText.textContent = mon.name;
      else elMonName.textContent = mon.name;
      elMonName.style.opacity = '0';
    }
    // Tomato marker in front of the name: full icon if this species is already
    // in the collection, silhouette if not. Default to silhouette until the
    // async caught-names read below confirms ownership. .is-pop is last
    // encounter's fill blip — clear it here so it can be replayed.
    if (elNameTomato) {
      elNameTomato.classList.add('is-silhouette');
      elNameTomato.classList.remove('is-pop');
    }
    elSub.textContent = '';
    elSub.style.color = '';
    const isShiny = mon.shiny || false;
    const isDark  = mon.dark  || false;
    elRarity.textContent = isDark ? 'DARK' : isShiny ? 'SHINY' : '';
    elRarity.className   = `encounter-rarity ${isDark ? 'pitch-black' : isShiny ? 'ultra-rare' : ''}`;
    if (elTags) {
      elTags.innerHTML = '';
      // Show only the mon's normal type badge(s) — shiny/dark status is shown in the rarity slot.
      // { frame: true } gives each one the LV badge's outline, to match the
      // LV badge sitting opposite it in the same topbar.
      if (typeof makeTypeBadges === 'function' && mon.type) {
        elTags.appendChild(makeTypeBadges(mon.type, { frame: true }));
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

    // Pomodex progress — hidden until this catch is confirmed. Capture how
    // many unique entries the player has right now so the catch screen can
    // tick it up afterwards.
    if (elDexProg) {
      elDexProg.hidden = true;
      if (elDexCount) elDexCount.classList.remove('is-tick');
    }
    st.dexBefore = null;
    st.dexAfter  = null;
    if (typeof Collection !== 'undefined' && typeof Collection.getCaughtNames === 'function') {
      Collection.getCaughtNames()
        .then(names => {
          st.dexBefore = names.size;
          // Fill in the tomato marker now that we know if this species is owned.
          if (elNameTomato) elNameTomato.classList.toggle('is-silhouette', !names.has(mon.name));
        })
        .catch(() => { st.dexBefore = null; });
    }

    enableButtons(false); // disabled until 'idle' phase

    // Shiny / dark wild mons get their own reveal sting instead of the plain
    // two-hit announcement — a bright rising sparkle for shiny, a low ominous
    // stab for dark.
    //
    // Those two wait for the session-end chime to ring out first ({ after }).
    // An encounter always follows a finished focus session, so the chime's
    // four drawn-out notes are still sounding when this fires, and the sting —
    // the whole point of a rare spawn — was buried underneath them. The plain
    // announcement is a short blunt double-blip that cuts through fine, so it
    // stays immediate and keeps the encounter feeling instant.
    if (isShiny || isDark) SFX.play(isShiny ? 'shinyAppear' : 'darkAppear', { after: true });
    else                   SFX.play('encounter');

    // Flash transition, then reveal the encounter overlay.
    runFlashTransition(() => {
      overlay.classList.add('active');
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
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

  // Build a branded card for SHARE rather than a bare grab of the live
  // encounter canvas (which is transparent apart from the mon + platform —
  // no name, no level, no PomoMons branding, so it read as a random cutout
  // sprite once posted anywhere). Same forest backdrop as the rest of the
  // app, the mon on its usual ground platform, its name/level/variant, and
  // a footer. Pure canvas drawing, no DOM — every image it touches
  // (backgrounds, ground, mon sprite) is already loaded by postcatch time,
  // so this runs synchronously (required — see shareCatch's own comment).
  function buildShareCanvas() {
    const mon = st.mon;
    const W = 900, H2 = 1125;
    const sc = document.createElement('canvas');
    sc.width = W; sc.height = H2;
    const c = sc.getContext('2d');

    const isFocus = document.body.classList.contains('run-focus');
    const bg = getShareBg(isFocus ? 'focus' : 'default');
    if (bg.complete && bg.naturalWidth) {
      const s  = Math.max(W / bg.naturalWidth, H2 / bg.naturalHeight);
      const dw = bg.naturalWidth * s, dh = bg.naturalHeight * s;
      c.drawImage(bg, (W - dw) / 2, (H2 - dh) / 2, dw, dh);
    } else {
      c.fillStyle = isFocus ? '#af4d4d' : '#228674';
      c.fillRect(0, 0, W, H2);
    }

    // Darken top/bottom a touch so white text stays legible over sky or trees.
    const grad = c.createLinearGradient(0, 0, 0, H2);
    grad.addColorStop(0,    'rgba(0,0,0,.5)');
    grad.addColorStop(0.2,  'rgba(0,0,0,.05)');
    grad.addColorStop(0.78, 'rgba(0,0,0,.05)');
    grad.addColorStop(1,    'rgba(0,0,0,.6)');
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H2);

    const FONT = '"Press Start 2P", monospace';
    const shadow = (on) => {
      c.shadowColor = 'rgba(0,0,0,.55)';
      c.shadowOffsetX = on ? 3 : 0;
      c.shadowOffsetY = on ? 3 : 0;
    };

    // Wordmark — tomato + POMO (white) + MONS (gold), same split as the
    // in-page header.
    c.textBaseline = 'alphabetic';
    c.font = `40px ${FONT}`;
    const wPomo = c.measureText('\u{1F345} POMO').width;
    let x = W / 2 - (wPomo + c.measureText('MONS').width) / 2;
    shadow(true);
    c.textAlign = 'left';
    c.fillStyle = '#fff';
    c.fillText('\u{1F345} POMO', x, 100);
    x += wPomo;
    c.fillStyle = '#ffd600';
    c.fillText('MONS', x, 100);

    // Badges — LV always, SHINY/DARK when it applies. Sized/paired as a
    // centred group, same trick as the wordmark above.
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `16px ${FONT}`;
    shadow(false);
    const badges = [{ text: `LV ${st.monLevel || 1}`, bg: '#ffd600', fg: '#1a0a00' }];
    if (mon.dark)       badges.push({ text: 'DARK',  bg: '#141414', fg: '#fff'    });
    else if (mon.shiny) badges.push({ text: 'SHINY', bg: '#f1c40f', fg: '#5c4400' });
    const gap = 14, padX = 18, pillH = 40;
    const widths = badges.map(b => c.measureText(b.text).width + padX * 2);
    let bx = W / 2 - (widths.reduce((a, b) => a + b, 0) + gap * (badges.length - 1)) / 2;
    const badgeY = 160;
    badges.forEach((b, i) => {
      const w = widths[i];
      c.fillStyle = b.bg;
      c.beginPath();
      c.roundRect(bx, badgeY - pillH / 2, w, pillH, 8);
      c.fill();
      c.fillStyle = b.fg;
      c.fillText(b.text, bx + w / 2, badgeY + 1);
      bx += w + gap;
    });

    // Mon name
    c.textBaseline = 'alphabetic';
    c.font = `30px ${FONT}`;
    c.fillStyle = '#fff';
    shadow(true);
    c.fillText(mon.name.toUpperCase(), W / 2, 235);

    // Ground platform + mon, same art as the encounter screen itself.
    shadow(false);
    const stageCX = W / 2, stageCY = 640;
    if (_groundImg.complete && _groundImg.naturalWidth) {
      const pw = W * 0.82, ph = pw * (230 / 460);
      c.imageSmoothingEnabled = false;
      c.drawImage(_groundImg, stageCX - pw / 2, stageCY + 55 - ph / 2, pw, ph);
    }
    const shiny = (mon.shiny && !mon.dark) || false;
    const scale = MonSprite.sizeScale(mon, 460, 2.2, shiny);
    MonSprite.drawOnCtx(c, mon, stageCX, stageCY, { scale, shiny: mon.shiny || false, dark: mon.dark || false });

    // Caption + footer
    c.textBaseline = 'alphabetic';
    c.font = `20px ${FONT}`;
    c.fillStyle = '#ffd600';
    shadow(true);
    c.fillText('WAS CAUGHT!', W / 2, 985);
    shadow(false);
    c.font = `13px ${FONT}`;
    c.fillStyle = 'rgba(255,255,255,.85)';
    c.fillText('pomomons.io', W / 2, 1065);

    return sc;
  }

  // Share the catch. On mobile / anything with a native share sheet this
  // hands off to navigator.share (the only path that actually lists Discord's
  // app, iMessage, etc.). On desktop there's no sheet, so instead of a blind
  // clipboard copy we open a preview modal showing the branded card, and the
  // player copies or saves it from there — each modal button being its own
  // fresh user gesture, which is what clipboard.write() needs. Doesn't touch
  // the encounter overlay: NEXT/INFO stay available afterwards either way.
  async function shareCatch() {
    const mon     = st.mon;
    const variant = mon.shiny ? 'shiny ' : mon.dark ? 'dark ' : '';
    const text    = `I just caught a ${variant}${mon.name} on PomoMons! \u{1F345}`;
    const url     = 'https://pomomons.io';

    // Desktop: preview modal instead of a silent copy.
    if (!navigator.share && openSharePreview(text, url)) return;

    // Built synchronously (toDataURL + atob) rather than the async
    // canvas.toBlob — share() requires a live user gesture, and awaiting
    // toBlob() first was long enough in testing to lose it: share() then
    // rejected silently (not AbortError) and SHARE quietly did nothing.
    let blob = null;
    try {
      const dataUrl = buildShareCanvas().toDataURL('image/png');
      const base64  = dataUrl.slice(dataUrl.indexOf(',') + 1);
      const binary  = atob(base64);
      const bytes   = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      blob = new Blob([bytes], { type: 'image/png' });
    } catch (_) { /* snapshot is a nice-to-have, not required to share */ }
    const file = blob ? new File([blob], 'pomomon-catch.png', { type: 'image/png' }) : null;

    if (navigator.share) {
      const withFile = file && navigator.canShare && navigator.canShare({ files: [file] });
      try {
        await navigator.share(withFile ? { text, url, files: [file] } : { text, url });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return; // user backed out of the sheet
      }
    }

    // Share sheet missing (openSharePreview couldn't find its markup) or it
    // errored: last-resort plain clipboard copy.
    await copyShareToClipboard(blob, text, url, elShareMsg);
  }

  // Copy the caption + card image to the clipboard. Image + text together
  // when the API supports it (Chrome/Edge) so pasting into Discord brings
  // both; plain text otherwise, and also if the image attempt is what fails.
  // Raced against a 2s timeout: with no live gesture, clipboard calls don't
  // reject — they hang forever — and an honest failure beats a dead button.
  async function copyShareToClipboard(blob, text, url, msgEl) {
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
      say(msgEl, 'Copied! Paste it in Discord or anywhere.');
    } catch (_) {
      try {
        await withTimeout(navigator.clipboard.writeText(`${text} ${url}`));
        say(msgEl, 'Copied! Paste it in Discord or anywhere.');
      } catch (__) {
        say(msgEl, "Couldn't copy — try again?", true);
      }
    }
  }

  // Turn a canvas into a PNG Blob synchronously (toDataURL + atob), so the
  // caller keeps the click's user gesture for clipboard.write().
  function canvasToPngBlob(cv) {
    try {
      const dataUrl = cv.toDataURL('image/png');
      const base64  = dataUrl.slice(dataUrl.indexOf(',') + 1);
      const binary  = atob(base64);
      const bytes   = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: 'image/png' });
    } catch (_) { return null; }
  }

  // Desktop-only preview modal. Drops the freshly built catch card into
  // #share-preview-frame and shows it with COPY / SAVE / CLOSE. Returns
  // false (so shareCatch can fall back) if the markup isn't present.
  let _sharePrevWired = false;
  let _sharePrev = { text: '', url: '' };
  function openSharePreview(text, url) {
    const modal = document.getElementById('share-preview');
    const frame = document.getElementById('share-preview-frame');
    const msgEl = document.getElementById('share-preview-msg');
    if (!modal || !frame) return false;

    _sharePrev = { text, url };
    frame.replaceChildren(buildShareCanvas());
    if (msgEl) { msgEl.textContent = ''; msgEl.classList.remove('is-bad', 'is-shown'); }

    if (!_sharePrevWired) {
      _sharePrevWired = true;
      const close = () => {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
      };
      document.getElementById('btn-share-close')?.addEventListener('click', close);
      modal.addEventListener('click', e => { if (e.target === modal) close(); });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && modal.classList.contains('active')) close();
      });
      document.getElementById('btn-share-copy')?.addEventListener('click', () => {
        const cv = frame.querySelector('canvas');
        copyShareToClipboard(cv && canvasToPngBlob(cv), _sharePrev.text, _sharePrev.url, msgEl);
      });
      document.getElementById('btn-share-save')?.addEventListener('click', () => {
        const cv = frame.querySelector('canvas');
        if (!cv) return;
        const a = document.createElement('a');
        a.href = cv.toDataURL('image/png');
        a.download = 'pomomon-catch.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        say(msgEl, 'Saved to your downloads.');
      });
    }

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    return true;
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
      await MonInfoScreen.start(st.mon, onDone, { chooseNext: true });
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
  //
  // Its BACK button leads to the post-catch card, not the timer: INFO is a
  // detour off the same flow NEXT runs, so the player still gets the evolution
  // chain and the choice of what to do next. That also means onDone is handed
  // over rather than fired here — it awards the pal's XP and starts the next
  // session, so it has to run exactly once, and the post-catch card owns it
  // from the moment the detail card opens.
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

    const toDetail = !!(base && typeof Collection !== 'undefined' && Collection.openMonDetail);

    if (toDetail) {
      Collection.openMonDetail(base, rec, {
        // Raised while the detail card is still up (both overlays are z-index
        // 170, and this one is earlier in the DOM, so it sits behind until the
        // detail card comes down) — the player never sees the timer flash past.
        onClose: async () => {
          await MonInfoScreen.start(st.mon, onDone, { chooseNext: true });
          await afterCardAppears(document.getElementById('mon-info-overlay'));
        },
      });
      // Same 0.3s opacity-0 entry as the info card — hold this overlay behind
      // it until it lands. The My Mons fallback below is a screen, not an
      // overlay, and has no entry animation to wait on.
      await afterCardAppears(document.getElementById('mon-detail-overlay'));
    } else if (typeof showScreen === 'function') {
      showScreen('mymons');
    }

    overlay.classList.remove('active');
    // Only the fallback ends the encounter here; see the note above.
    if (!toDetail && typeof onDone === 'function') onDone();
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

  // Shiny and dark are recoloured with a canvas filter over the same PNG, and
  // that filter is only applied when drawOnCtx is told about it. Neither draw
  // below used to pass the flags, so a shiny or dark mon evolved as its plain
  // self — both the before and the after. The flags ride on the mon object
  // here, the way CatchScreen, MonInfoScreen and the companion canvas all read
  // them, so a caller only has to hand over a mon that knows what it is.
  //
  // During the fade-in the shiny sparkle comes up at full strength, because
  // drawOnCtx paints it outside the alpha it gives the sprite. Left as is: it
  // lasts a second and reads as part of the build-up.
  function variantOf(mon) {
    return { shiny: !!(mon && mon.shiny), dark: !!(mon && mon.dark) };
  }

  // Draw mon as a pure-white silhouette
  function drawSilhouette(mon, alpha, scale, bobY) {
    const white = { ...mon, color: '#ffffff', accent: '#ffffff' };
    MonSprite.drawOnCtx(ctx, white, SIZE / 2, SIZE / 2 + (bobY || 0),
      { scale: scale || 1, alpha: alpha !== undefined ? alpha : 1, ...variantOf(mon) });
  }

  // Draw mon in full colour
  function drawColored(mon, bobY) {
    MonSprite.drawOnCtx(ctx, mon, SIZE / 2, SIZE / 2 + (bobY || 0),
      { scale: 1, ...variantOf(mon) });
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
  // The post-catch footer's buttons, by the mode each one selects. app.js
  // owns NextSession (which mode is suggested, and what the player picked).
  const NEXT_BTN_IDS   = { focus: 'btn-next-focus', short: 'btn-next-short', long: 'btn-next-long' };
  const CANVAS_SIZE    = 200;   // main sprite canvas logical size
  const EVO_NODE_SIZE  = 64;    // mini evo-chain canvas logical size

  let overlay, canvas, ctx, elName, elRarity, elChain, btnDone, nextWrap;
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
  async function start(mon, doneCb, opts) {
    if (!overlay) {
      overlay  = document.getElementById('mon-info-overlay');
      canvas   = document.getElementById('mon-info-canvas');
      ctx      = canvas.getContext('2d');
      elName   = document.getElementById('mon-info-name');
      elRarity = document.getElementById('mon-info-rarity');
      elChain  = document.getElementById('mon-info-evo-chain');
      btnDone  = document.getElementById('btn-mon-info-done');
      nextWrap = document.getElementById('mon-info-next');

      st.dpr = window.devicePixelRatio || 1;
      if (st.dpr !== 1) {
        canvas.width  = CANVAS_SIZE * st.dpr;
        canvas.height = CANVAS_SIZE * st.dpr;
        ctx.scale(st.dpr, st.dpr);
      }

      btnDone.addEventListener('click', dismiss);
      // The post-catch footer. Each button records the choice and then closes
      // the card exactly as GOT IT! does — app.js applies it once the whole
      // encounter (and any evolution scene) has finished, so nothing here has
      // to know what still has to play out.
      for (const mode of Object.keys(NEXT_BTN_IDS)) {
        const btn = document.getElementById(NEXT_BTN_IDS[mode]);
        if (!btn) continue;
        btn.addEventListener('click', () => {
          if (typeof NextSession !== 'undefined') NextSession.choose(mode);
          dismiss();
        });
      }
    }

    onDone   = doneCb;
    st.mon   = mon;
    st.frame = 0;

    // Which footer this card wears. Opened from the Dex it is just a card to
    // look at, so it keeps GOT IT!; opened after a catch it is the last thing
    // before the timer, so it asks what to do next instead.
    const chooseNext = !!(opts && opts.chooseNext) && typeof NextSession !== 'undefined';
    // Hide the BUTTON, not its .pxb wrapper: .pxb sets display:flex, which
    // outranks the browser's own [hidden] rule, so a hidden wrapper still
    // renders. `.pxb:has(button[hidden])` (style.css) collapses the frame once
    // the button inside it is hidden — the idiom the rest of the app uses.
    if (btnDone)  btnDone.hidden  = chooseNext;
    if (nextWrap) nextWrap.hidden = !chooseNext;
    if (chooseNext) {
      for (const m of Object.keys(NEXT_BTN_IDS)) {
        const btn = document.getElementById(NEXT_BTN_IDS[m]);
        if (!btn) continue;
        // Swapping the real classes rather than inventing a new one — every V3
        // rule for the gold slab and the dark slab (fill, ring, clip-path, the
        // .pxb:has() ring selectors) then applies with nothing to keep in step.
        //
        // CONTINUE FOCUSING wears the gold slab whether or not it is the
        // suggested mode. It and the due break are the two answers the player
        // is actually weighing; the third is the odd one out, and leaving the
        // "keep working" option in dark grey read as the discouraged choice.
        const gold = m === NextSession.suggested || m === 'focus';
        btn.classList.toggle('btn-primary',    gold);
        btn.classList.toggle('btn-timer-dark', !gold);
      }
    }

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

