# PomoMons — UI Layout Reference

> Read this before working on any screen, animation, or layout feature.
> Updated Aug 2026 for launch. style.css is the base layer; style-v2.css
> layers on top (remove its <link> in index.html to revert the V2 polish).

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

- **Header**: tomato + POMO MONS wordmark + "FOCUS · CATCH · COLLECT" tagline.
  Mute button top-right (`.pxb-audio` > `#btn-audio`, pixel-clipped dark square).
- **Stats strip** (`footer.stats-strip`, fixed bottom, full-width, black):
  LV badge (gold pill), `x / y XP` text, XP bar, SESSIONS / MINUTES / CATCHES.
- Body background: teal idle (`#00a888`); red during running focus
  (`body.run-focus`, also swaps `--panel-bg`).
- Content column: max-width 680px centred (desktop-first per CLAUDE.md).

---

## Design Language (buttons & badges)

- **One corner style**: pixel-staircase `clip-path` — `--pixel-clip` (4px
  blocks, 3 steps) for buttons/panels, `--pixel-clip-sm` (2 steps) for small
  controls and badges. (`--pixel-clip-1` single-step and `--pixel-clip-round`
  exist but are currently unused.)
- **Two button colors only**: gold `var(--gold)` = primary (START, POMODEX,
  THROW!, GOT IT!, BLEND IT!, active tab); `#222` black with 3-shade inset
  shading = secondary (FOCUS SESSION, RESET, RUN AWAY, CANCEL, BACK, inactive
  tab, mute, `?`, ▲▼). No white buttons.
- Timer-screen action buttons are all `min-height: 60px` (style-v2.css).
- Badges (LVL pill gold, type badge per-type color): flat (no inset shading),
  `--pixel-clip-sm` corners, `.6rem` font.
- Font: Press Start 2P everywhere.

---

## Timer Screen

Companion panel (`.pxb-panel > .companion-area`):
- `?` help button top-right → opens the spawn-info modal (catch rarity odds
  NORMAL 94% / DARK 5% / SHINY 1%, blender-confirm-styled).
- LVL pill + type badge grouped top-left, side by side.
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
3. **Controls panel**: THROW! (gold) / RUN AWAY (black), equal width
   (`flex: 1 1 0`, max 240px). Post-catch swaps to NEXT + POMODEX (jumps
   straight to My Mons after resolving the encounter).

---

## Collection Screens

- **Sticky top block on My Mons** (`.mymons-top`, `position: sticky; top: 0`):
  header row (BACK · MY MONS / POMODEX tabs · count) + the blender toolbar
  pin together; the grid scrolls beneath. Collection screens use
  `justify-content: flex-start` (only the timer screen centres).
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
