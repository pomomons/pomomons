# PomoMons — UI Layout Reference

> Read this before working on any screen, animation, or layout feature.
> Three stylesheets, cascading in load order (later wins at equal
> specificity): **style.css** (base) → **style-v2.css** (spacing/hero-timer
> refresh) → **style-v3.css** (the current "field console" skin: forest-photo
> background, amber-on-green palette, stamped-plate panel frames, CRT
> scanlines, the settings menu, the mailing-list card). Remove a `<link>` in
> index.html to peel back a layer. Whole-pixel font sizes only — Press Start
> 2P blurs at fractional sizes.

---

## Screen System

Single page. Screens are `<main class="screen">`; one is visible via `.active`.
`showScreen(name)` in app.js toggles `#screen-{name}` and re-renders collections.

| Screen ID          | Purpose                              |
|--------------------|--------------------------------------|
| `screen-timer`     | Timer + companion (default)          |
| `screen-mymons`    | Caught mons grid + blender toolbar   |
| `screen-dex`       | Pomodex (all dex entries)            |

(The former `screen-progress` / level-rewards screen was removed for launch.)
Overlays (fixed, `.active` to show): encounter, catch, evolution, mon-info,
spawn-info, blender-confirm.

---

## Global Chrome

- **Header**: tomato + POMO MONS wordmark (an `<h1>`, `.logo`) + "FOCUS ·
  CATCH · COLLECT" tagline. **Gear button top-right** (`#btn-settings`, class
  `.btn-audio`, in `.pxb-audio` — pixel-clipped dark square) opens
  `#settings-menu` (a fixed dropdown, positioned by app.js like
  `.mode-dropdown`): Sound on/off (`#btn-audio`), Join our Discord
  (`#btn-discord`), Save (`#btn-signup` — mailing-list card), Auto-start next
  session (`#toggle-autostart`).
- **Stats strip** (`footer.stats-strip`, fixed bottom): a single `.stats-row`
  — LV badge (amber pill) · `x / y XP` text over the XP bar · SESSIONS /
  MINUTES / CATCHES tiles with a scope toggle. Under v3 it floats as its own
  framed plate inside the bezel, not a bar welded to the edge.
- Body background: v3 paints a forest photo — `forest.webp` over `#2b5343`
  when idle/break, `forest-red.webp` over `#8f3b34` during a running focus
  session (`body.run-focus`, which also swaps the whole palette). CRT
  scanlines + vignette overlay on top.
- Content column: max-width 680px centred (desktop-first per CLAUDE.md).

---

## Design Language (buttons & badges)

- **Pixel-staircase `clip-path` corners.** v3 redefines the notch tokens with
  2px steps (finer): `--pixel-clip` (deep, panels), `--pixel-clip-sm`,
  `--pixel-clip-xs` (shallow — buttons, LV badges, most chips),
  `--pixel-clip-2xs` (near-square — stat tiles, type badges, strip).
- **Two button colours only**: amber `var(--gold)` (`#e5ac35` in v3) = primary
  (START, POMODEX, THROW!, GOT IT!, BLEND IT!, active tab); a translucent
  dark-green `var(--btn-dark)` with a thin lit/​shaded edge = secondary (FOCUS
  SESSION, RESET, RUN AWAY, CANCEL, BACK, inactive tab, gear, `?`, ▲▼). No
  white buttons. Primary buttons carry a black pixel outline + cast shadow via
  their `.pxb` (or `.btn-shadow`) wrapper — `clip-path` discards a real
  box/​drop-shadow, so the wrapper's own padded background draws the edge.
- Timer-screen action buttons: `min-height: clamp(42px, 6vh, 60px)` (v3),
  ~60px on a full monitor.
- Badges (LV pill amber, type badge per-type colour): flat, `--pixel-clip-xs`
  / `-2xs` corners, 8–12px whole-pixel type.
- Font: Press Start 2P everywhere.

---

## Timer Screen

Companion panel (`.pxb-panel > .panel-rail > .companion-area`):
- `?` help button top-right → opens the spawn-info modal (catch rarity odds
  NORMAL 94% / DARK 5% / SHINY 1%, blender-confirm-styled).
- `.companion-meta` sits top-left, out over the panel clear of the sprite: the
  LV pill (a real `<button>`, opens the companion's detail card) over its XP
  bar. The numeric "x / y XP" line is `display:none` under v3. Its `top` is
  nudged so the LV pill's top aligns with the `?` button's.
- `companion-stage` (200px canvas + ground PNG behind): the mon bobs
  `sin(frame/22) * 6` with **no squish** (matches encounter/catch screens).
- Floating mon name overlays the stage just above the mon's head — positioned
  per-frame from the sprite's drawn size (`state.headY`) and bobbing in sync.
  Not bold (no text-stroke).

Timer panel: CSS text timer (never wraps; `white-space: nowrap`), ▲▼ minute
steppers (hidden while running), FOCUS SESSION dropdown + RESET row, START,
POMODEX. Focus duration persists (`pm_focus_mins`, clamp 5–90).

---

## Encounter Overlay

Full-screen. Layout top→bottom:
1. Same logo + tagline as the main page.
2. **Arena panel** (`.encounter-arena`, `--panel-bg` + `--pixel-clip`,
   max-width 560px): headline "A WILD MON APPEARED!", then a 3-column topbar —
   LVL pill (left) · rarity slot (centre: SHINY/DARK only, empty for normal) ·
   type badge (right); each pinned to its grid column so hiding rarity never
   shifts the type. Below: `encounter-stage` (480×380 canvas) with the
   floating bobbing mon name (hidden until the sprite size is known, then
   positioned above the head — no flash).
3. **Controls panel** (`.encounter-controls`, same three-layer plate frame):
   THROW! (amber) / RUN AWAY (dark), equal width (`flex: 1 1 0`, max 240px).
   Post-catch swaps to **NEXT / INFO / SHARE** (NEXT resolves the encounter,
   INFO opens the dex entry, SHARE copies/opens a branded catch card). A
   collapsed `#encounter-share-msg` status line sits below (shown only after
   SHARE on the mobile share path).

---

## Collection Screens

- **Fixed top block on My Mons** (`.mymons-top`, non-scrolling): header row
  (BACK · MY MONS / POMODEX tabs · count) + the blender toolbar. Under v3 the
  screen itself is `overflow: hidden` and only `.mymons-scroll` (a flex child
  with a `margin-bottom` clawback to the stats strip) scrolls — a true clip
  top and bottom, so cards never render behind the header or the translucent
  footer. RESTORE parks at the foot of that scroll box (`.mymons-restore`).
- **The gap under RESTORE is 16px, the same gap the header leaves between
  BACK and the blender panel**, and it is derived, not tuned: `.mymons-restore`
  takes `margin-bottom: calc(var(--stats-reserve) - 4px)`, where
  `--stats-reserve` is the strip measured where it actually sits (app.js
  `updateStatsReserve`, kept current by a ResizeObserver on the strip). It used
  to claw back from `--stats-h`, which is a worst-case reserve sized for the
  strip wrapped to two rows — against the strip's real height that ran 21px
  long on a desktop window and 17px short on a short landscape one, so the gap
  swung from 21px down to the button sitting behind the strip depending on the
  viewport. `node tools/measure-mymons-gaps.js` prints both gaps across
  viewports; they now read 16px everywhere.
- **Blender toolbar** (desktop only; hidden < 480px): two horizontal dashed
  cards — BLEND (drop target) and SMOOTHIES (drag source, count as a lowercase
  `x N` badge on the icon's corner).
- **Grid**: 3 columns. My Mons cards: sprite, name, LVL, type badge(s), and a
  SHINY/DARK label only for variant records; active companion gets a green
  border + ★. Cards are drag sources for blending. Dex cards: unseen entries
  grey out; count `x / 20` auto-computed.

---

## Canvas & Animation Rules

- **All canvas drawing lives in game.js** (CLAUDE.md rule): `MonSprite`
  (shared renderer + preloading), `CompanionCanvas`, `EncounterScreen`,
  `EvolutionScreen`, catch + mon-info screens.
- Shared idle bob everywhere: `sin(frame / 22) * 6`, no squash.
- Sprites render at 3× with `image-rendering: pixelated`; HiDPI buffers scale
  by devicePixelRatio.

---

## Dev Harness (not shipped)

`tools/shoot.js` (gitignored) — Playwright screenshot harness: serves the app,
seeds a full collection via `Collection.addCaught`, forces short sessions
in-page (`MODES.focus = 2`), and captures every screen at 1440px + 375px into
`tools/shots/`. Run: `node tools/shoot.js`. This is how UI changes are
visually verified.

## Floating mon caption placement

Both the timer screen's companion and the encounter screen hang the mon's
name off the top of its art, measured by `MonSprite.artTopFraction` /
`artTopFractionFor` in game.js.

They used to hang it off the sprite BOX top — the top edge of the square the
frame is drawn into — which assumes every creature's head touches that edge.
None of them do: sprite frames carry transparent rows above the art, and how
many varies per sprite. The gap you saw was the intended gap plus that
sprite's own padding, so it ranged from 6.6px (Guacamonger, 16 rows) to
43.9px (Marinaro, 104) across the roster. 18 of the 20 forms now land within
9.7-11.4px of each other.

Two things to know before changing it:

- The measurement takes the HIGHEST art across all frames, not the resting
  frame. Frames are vertically aligned on 18 of 20 sprites so it usually
  makes no difference. Marinaro's blink frame adds steam wisps 9 source rows
  above its lid; measuring the resting frame gave it a normal 10px gap and
  then let the steam cross the caption by 12px during each 450ms flash.
  Marinaro (31px) therefore still reads wider than the rest; it closes on its
  own if that sprite's frames are aligned in the art. Donot's 2-row
  difference is not visible in the gap.
- `readTopReserve` reserves the caption's own height unconditionally, not
  only when the LV badge and XP bar sit over the stage. Without it the
  largest mons hit the size cap with their heads so near the canvas top that
  the caption's position went above it and was clamped, collapsing their gap
  to ~7px. This shrinks the two 64px sprites slightly on desktop; everything
  under the cap is unaffected.

Two invariants `layoutName()` depends on, both of which were broken and are
now covered by `node tools/check-name-stable.js`:

- **Never compute against a hidden screen.** `display:none` makes every box
  measure 0, so the position resolves to `top:0` — and caching that while
  clearing the dirty flag meant it was never recomputed, because nothing
  tick() watches changes on the way back. Equipping happens FROM My Mons, so
  the timer screen is hidden at exactly the moment setMon() invalidates the
  caption. The guard returns early WITHOUT clearing `_nameDirty`.
- **Size the caption before measuring it.** `sizeMonName` sets the font size,
  which decides the caption's height, and the height is an input to its own
  position. Sizing afterwards used the previous caption's height and landed
  3px out, correcting only if a later invalidation happened to fire — which
  made it depend on how you got to the screen.

Both were introduced by caching this work instead of running it every frame.
Anything that reads a measurement here has to ask whether it is reading it
before or after something else changes it, and whether the screen is even
visible.

`node tools/measure-name-gap.js` prints the real gap per form, measured from
the caption's bottom edge to the first pixel the canvas actually painted.
`node tools/check-name-stable.js` re-reads the same mons across reloads,
switches, waits, a hidden screen, and the real equip-through-the-UI flow, and
fails if any of them disagree.
