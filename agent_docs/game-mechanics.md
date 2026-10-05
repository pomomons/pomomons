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

**Every form can spawn, gated by player level.** `getRandomMon(playerLevel)` in
`monsters.js` builds its pool from `spawnableForms(playerLevel)`: all 16 base
forms, always, plus every evolution the player has earned. An evolution is
earned when `playerLevel >= evo.atLevel - SPAWN_LEVEL_GRACE` (grace = 2).

The grace is not arbitrary — it is the same ±2 the level roll uses, so a form
becomes encounterable exactly when the roll could legitimately produce it. A
level 14 player can meet a Marinaro (evolves at 16) because a +2 roll reaches
16; at 13 they cannot, because no roll does.

Base forms are never removed from the pool. Unlocking an evolution *adds* to
what a player can meet, so a level 50 player still runs into Tomotot. A side
effect worth knowing: a species with evolutions unlocked occupies more of the
pool than one without, so it spawns more often. That is deliberate.

Picking is uniform across the pool. Rarity tiers were removed for launch and
the `rarity` field is inert legacy. `catchRate` was removed outright in
2026-10 — it had never been read.

**Wild mon level** = player level ± 2, then **clamped into the band that
produces the form on screen** (`loLevel`/`hiLevel`, attached by
`spawnableForms`). The clamp is load-bearing, not cosmetic: a caught record
stores only a species id and a level, and `getMonStage` derives the displayed
form from that level. Without the clamp a level 50 wild Tomotot would be filed
at level 50 and render in the collection as Strangletti — the player catches
one mon and is handed another. It cuts both ways: meeting a Marinaro at player
level 14 pulls the roll up to 16, the level that makes it one.

Consequence of the shared record: catching a wild evolution credits its earlier
stages in the dex too, because `getCaughtNames` walks a record's level through
the whole line. Catching a Marinaro counts Tomotot as seen.

Covered by `tools/check-spawn-levels.js`, which samples the real built roster
at seven player levels and asserts the gate boundaries, that base forms are
never crowded out, and that every catch is filed at a level that keeps it the
form that was caught.

---

## Variants (the only "rarities")

Rolled independently at encounter start, in this priority order:

```
shiny = Math.random() < SHINY_RATE          // 1/500  = 0.2%
dark  = !shiny && Math.random() < DARK_RATE // 1/100  = 1% (never both)
```

`SHINY_RATE` / `DARK_RATE` are defined at the top of `game.js`. Because shiny
is rolled first and wins outright, the dark rate players actually see is
`DARK_RATE × (1 − SHINY_RATE)` = 0.998%, leaving 98.8% normal. The CATCH
RARITY table in the "?" popup (`#spawn-info` in index.html) quotes those
effective figures and is **not** generated from the constants — change both
together.

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
  `EvolutionScreen` overlay. STOP there records the threshold in the record's
  `evoDeclined` (getMonStage skips it forever otherwise) — but a decline isn't
  permanent: every `EVOLUTION_REPROMPT_LEVELS` (5) levels past that threshold,
  `pendingDeclinedEvolution` (monsters.js) flags it again and the screen
  re-offers it, from both `savePalExp` (timer sessions) and `applySmootie`
  (smoothies). Taking the re-offer calls `Collection.acceptEvolution` to clear
  the decline; declining it again just waits for the next +5 boundary.

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
