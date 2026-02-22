# PomoMons — UI Layout Reference

> Read this before working on any screen, animation, or layout feature.
> Reflects the implemented Feature 1 shell. Update when screens change.

---

## Screen System

The app is a single HTML page (`index.html`). Screens are `<main>` elements with class
`.screen`. Only one screen is visible at a time via `.screen.active { display: flex }`.

```
showScreen(name)          // app.js — toggles .active on matching #screen-{name}
```

| Screen ID          | Nav button `data-screen` | Default |
|--------------------|--------------------------|---------|
| `screen-timer`     | `timer`                  | active  |
| `screen-collection`| `collection`             | hidden  |

---

## App Header (always visible)

```
┌─────────────────────────────────────────┐
│  PomoMons           LVL 3               │
│                     ████████░░ EXP      │
└─────────────────────────────────────────┘
```

| Element          | Selector / ID         | Notes                              |
|------------------|-----------------------|------------------------------------|
| App title        | `.app-title`          | Static text "PomoMons"             |
| Level number     | `#player-level`       | Written by `loadPlayerState()`     |
| EXP bar fill     | `#exp-bar`            | `style.width` set as percentage    |
| EXP bar track    | `.exp-bar-wrap`       | 80px wide, always visible          |

Height: `--header-h: 56px`. Background: `--red`. Stored in `localStorage` keys:
`pm_level`, `pm_exp`. Max EXP is currently `100` (placeholder — see `game-mechanics.md`).

---

## Timer Screen (`#screen-timer`)

```
┌─────────────────────────────────────────┐
│  [companion canvas 160×160]             │
│  ???                                    │
│                                         │
│  [ Focus ][ Short Break ][ Long Break ] │
│                                         │
│           25 : 00                       │
│                                         │
│        [ Start ]  [ Reset ]             │
│                                         │
│           ○  ○  ○  ○                    │
└─────────────────────────────────────────┘
```

### Companion Canvas

| Property       | Value                                   |
|----------------|-----------------------------------------|
| Element        | `#companion-canvas`                     |
| HTML size      | `width="160" height="160"` (buffer)     |
| CSS display    | 160px; 180px on screens ≥ 400px         |
| Rendering      | `image-rendering: pixelated`            |
| HiDPI          | `game.js init()` scales buffer by `dpr` |
| Animation      | `CompanionCanvas` module in `game.js`   |
| Name label     | `#companion-name` (`.companion-name`)   |

Canvas background: `--tan`. Border: 3px solid `--brown`. Shadow: 4px offset `--brown`.

### Session Mode Tabs

Three `<button role="tab">` inside `.session-tabs`:

| `data-mode` | Duration | Label        |
|-------------|----------|--------------|
| `focus`     | 25 min   | Focus        |
| `short`     | 5 min    | Short Break  |
| `long`      | 15 min   | Long Break   |

Active tab: `.tab.active` (red fill). Switching tab calls `setMode(mode)` in `app.js`,
which also updates `aria-selected` on each button. Pill-shaped container: `--radius-lg`.

### Timer Display

```html
<section class="timer-display" aria-live="polite">
  <span id="timer-minutes">25</span>
  <span class="timer-colon">:</span>
  <span id="timer-seconds">00</span>
</section>
```

Font size: 5rem (mobile), 6rem (≥ 400px). The colon (`.timer-colon`) uses a CSS
`blink` keyframe animation. **The animation starts paused** — it only runs while the
timer is actively counting down. Managed in `app.js` via `animationPlayState`.

### Timer Controls

| Element          | ID                | Behaviour                         |
|------------------|-------------------|-----------------------------------|
| Start/Pause btn  | `#btn-start-pause`| Cycles Start → Pause → Resume     |
| Reset btn        | `#btn-reset`      | Calls `setMode(currentMode)`      |

Button classes: `.btn.btn-primary` (green) and `.btn.btn-ghost` (tan).
Press feedback: `translateY(2px)` on `:active`.

### Session Dots

Four `<span class="dot">` inside `.session-dots`. Class `.filled` (red) is added
by `renderDots()` for each completed focus session mod 4.
Counter `sessionsToday` lives in `app.js` memory only (not persisted).

---

## Collection Screen (`#screen-collection`)

```
┌─────────────────────────────────────────┐
│  COLLECTION                  0 / 50     │
│                                         │
│  ┌───┐  ┌───┐  ┌───┐                   │
│  │   │  │   │  │   │  ← 3-col grid     │
│  └───┘  └───┘  └───┘                   │
│                                         │
│  (empty state message when 0 caught)    │
└─────────────────────────────────────────┘
```

| Element          | Selector / ID         | Notes                              |
|------------------|-----------------------|------------------------------------|
| Title            | `.screen-title`       | "COLLECTION" (uppercase via CSS)   |
| Count            | `#collection-count`   | "X / 50" written by `collection.js`|
| Grid             | `#collection-grid`    | CSS grid, 3 cols, gap 10px         |
| Empty state      | `.empty-state`        | Shown until first card is injected |

Mon cards (injected by `collection.js`): `.mon-card`. Unseen mons get `.unseen`
(greyed out, no cursor). Each card has an inner `<canvas>` for the sprite thumbnail.

---

## Bottom Navigation (always visible, fixed)

```
┌────────────────┬────────────────┐
│  🍅            │  📖            │
│  Timer         │  Collection    │
└────────────────┴────────────────┘
```

Fixed to bottom, max-width 480px (centred). Height: `--nav-h: 64px`.
Active button: `.nav-btn.active` (color `--red`). Clicking calls `showScreen(name)`.

---

## CSS Design Tokens (`:root`)

| Token         | Value     | Used for                         |
|---------------|-----------|----------------------------------|
| `--red`       | `#e74c3c` | Header, active states, filled dots|
| `--red-dark`  | `#c0392b` | Shadows on red elements          |
| `--cream`     | `#fdf6e3` | Page background                  |
| `--tan`       | `#e8dcc8` | Canvas bg, tab track, ghost btn  |
| `--brown`     | `#8b6914` | Borders, shadows on canvas/cards |
| `--green`     | `#27ae60` | Start button                     |
| `--font-pixel`| monospace | All UI text                      |
| `--header-h`  | `56px`    | Header height                    |
| `--nav-h`     | `64px`    | Bottom nav height                |
| `--radius`    | `8px`     | Standard border-radius           |
| `--radius-lg` | `16px`    | Pill shapes (tabs, etc.)         |

Dark mode: all `--cream/tan/brown/gray-*` tokens are overridden via
`@media (prefers-color-scheme: dark)`.

---

## Companion Idle Animation States (game.js)

| State       | Description                                              |
|-------------|----------------------------------------------------------|
| Bob         | Sinusoidal vertical movement ±10px, period ~1.5 s        |
| Squash      | `squishY` 0.92–1.08, `squishX` 0.96–1.04 in sync with bob|
| Blink       | Eyes close for 8 frames; triggers every 3–6 s randomly  |
| Eye wander  | `eyeOffset` drifts ±2px side-to-side                    |
| Drop shadow | Ellipse under body, fades when bob is at apex            |

`CompanionCanvas.init(canvasEl)` — starts the rAF loop.
`CompanionCanvas.stop()` — cancels the rAF loop (call before showing encounter screen).

All Canvas drawing must remain in `game.js` (CLAUDE.md rule).

---

## Encounter Screen (NOT YET BUILT)

Triggered by `onSessionEnd()` in `app.js` after a focus session completes.
Will overlay or replace the timer screen temporarily. Placeholder hook:
```js
// TODO: trigger encounter screen (game.js) in a future feature  [app.js:93]
```
See `game-mechanics.md` for catch rules and `monsters.md` for Pomomon roster.
