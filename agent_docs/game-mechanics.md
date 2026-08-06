# PomoMons — Game Mechanics Reference

> Read this before working on encounter logic, XP/leveling, or catch flow.
> Updated Aug 2026 for launch. Reflects the shipped mechanics.

---

## Encounter Trigger

- An encounter fires after every **focus session** completes (not breaks).
- Handled in `app.js → onSessionEnd()` when `currentMode === 'focus'`.
- Calls `EncounterScreen.start(onDone)` in `game.js`.
- Every 4th completed focus session queues a long break; otherwise short break.

---

## Spawning

**Uniform.** `getRandomMon()` in `monsters.js` picks any base mon with equal
probability. Rarity tiers (common/uncommon/rare weighting) were removed for
launch — the `rarity` / `catchRate` fields still on the mon data are inert
legacy and are not read anywhere.

Wild mon level = player level ± 2 (clamped 1–100), rolled at encounter start.

---

## Variants (the only "rarities")

Rolled independently at encounter start, in this priority order:

```
shiny = Math.random() < 0.01          // 1%
dark  = !shiny && Math.random() < 0.05 // 5% (never both)
```

- **Shiny** — gold-tinted sprite (hue-rotate filter, or `shinySprite` if set),
  animated sparkles, `SHINY` shown in the encounter's centre rarity slot.
- **Dark** — near-black sprite (`DARK_FILTER` canvas filter, no separate PNG),
  `DARK` shown in the centre rarity slot.
- Normal mons show **nothing** in the rarity slot.
- Variant flags are stored on the caught record (`{ shiny, dark }`) and shown
  as card labels in My Mons.

---

## Catching

**Catches always succeed — by design** (user decision for launch). There is no
catch roll and no escape path; RUN AWAY is the only way an encounter ends
without a catch. If a miss chance is ever reintroduced, see git history for
the removed `showResult(false)` flee path.

Post-catch the player can hit **NEXT** (mon info card) or **POMODEX** (jump
straight to the collection).

---

## XP & Leveling

**Player** (`pm_level` / `pm_exp` in localStorage):
- +25 XP per catch (`saveExp(25)` in game.js when the ball locks).
- Threshold is LINEAR: `expThreshold(level) = 100 + 50 * (level - 1)`.
- Overflow carries. Level-up shows a banner + SFX.
- **Leveling currently grants nothing else.** The level-rewards / missions-map
  system was removed for launch (see git history: `LEVEL_REWARDS`,
  `renderProgress`, `updateRewardDot`, `#screen-progress`, `btn-map-icon`).

**Companion / pal** (per caught record in IndexedDB):
- The active companion gains +25 pal XP per completed focus session
  (`savePalExp` in app.js, called from the encounter-done callback).
- `palExpThreshold(level) = Math.round(30 * 1.3^(level-1))`.
- Smoothies grant +1 pal level instantly (drag onto a mon card in My Mons).
- Evolutions fire at per-mon `atLevel` thresholds (see monsters.md) via the
  `EvolutionScreen` overlay.

---

## Blender & Smoothies

- On My Mons (desktop only — hidden under 480px, drag-and-drop needs a pointer):
  drag a mon card onto BLEND → confirm modal → record is deleted, +1 smoothie
  item (`pm_items` in localStorage).
- Drag the SMOOTHIES box onto a mon card → consume 1 smoothie, +1 pal level.
- Available from the start (no level gate).

---

## Persistence

- `navigator.storage.persist()` requested at boot (best-effort eviction guard).
- Collection: IndexedDB `pomomons_db` / store `caught` (one record per catch,
  carries palLevel/palExp/shiny/dark). localStorage fallback if IDB missing.
- Scalar state: localStorage — see MEMORY/key list; notable keys:
  `pm_level`, `pm_exp`, `pm_active*`, `pm_total_*`, `pm_items`, `pm_muted`,
  `pm_focus_mins`, `pm_seed_purged`.

---

## Encounter Animation Phases (game.js EncounterScreen)

| Phase       | Description                                          |
|-------------|------------------------------------------------------|
| `appearing` | Mon slides down; floating name hidden until sized    |
| `idle`      | Mon + name bob `sin(frame/22)*6`; buttons enabled    |
| `throwing`  | Tomato arcs at the mon                               |
| `landing`   | Ball bounces (2 bounces, squish + SFX)               |
| `shaking`   | 3 shake windows; record + XP saved at the end        |
| `locked`    | Click SFX, shimmer                                   |
| `postcatch` | CONGRATULATIONS + NEXT / POMODEX buttons             |
| `done`      | Overlay hides; `onDone` fires (pal XP, next mode)    |
