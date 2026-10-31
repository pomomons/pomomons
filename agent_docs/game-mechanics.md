# PomoMons — Game Mechanics Reference

> Read this before working on encounter logic, XP/leveling, or catch flow.
> Updated Aug 2026 for launch. Reflects the shipped mechanics.

---

## Encounter Trigger

- An encounter fires after every **focus session** completes (not breaks).
- Handled in `app.js → onSessionEnd()` when `currentMode === 'focus'`.
- Calls `EncounterScreen.start(afterEncounter(nextMode), { meta })` in `game.js`.
- Every 4th completed focus session queues a long break; otherwise short break.
  The count is kept in `pm_cycle_sessions` so a reload doesn't reset it.
- The wild mon is written to `pm_pending_encounter` when it appears and erased
  when the encounter ends. If the page closes first, the next load re-opens the
  same mon at the same level (or, if it was already caught/fled, just runs the
  rest: pal XP, evolution, next session).

---

## Spawning

**Every form can spawn, gated by player level.** `getRandomMon(playerLevel)` in
`monsters.js` builds its pool from `spawnableForms(playerLevel)`: all 15 base
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

Picking is uniform across the pool, with one exception: a species flagged
`rare: true` (only Donot) is weighted at `RARE_SPAWN_WEIGHT` (0.1, monsters.js),
so it turns up 1/10th as often as any other form — about 0.66% of spawns at
level 1, 0.34% once all 30 forms are unlocked. It still rolls shiny/dark like
anything else. Rarity tiers were removed for launch and the `rarity` string
field is inert legacy — `rare` is the live flag. `catchRate` was removed
outright in 2026-10 — it had never been read. `tools/check-spawn-levels.js`
asserts the 0.1 ratio.

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
- **Rare species** (Donot) — purple `RARE` label, shown in front of any
  variant label, so a shiny Donot reads `RARE SHINY` (the rarest catch).
  Also a RARE badge on the share card. All slots are filled by
  `fillRarityLabels` (monsters.js), one span per label.
- Normal mons show **nothing** in the rarity slot.
- Variant flags are stored on the caught record (`{ shiny, dark }`) and shown
  as card labels in My Mons. Rarity is not stored — it comes from the species.
- My Mons RARITY sort: shiny Donot > dark Donot > shiny > Donot > dark > plain.

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
- +35 XP per catch (`saveExp(35)` in game.js when the ball locks); +7 XP for
  fleeing instead (`saveExp(7)`).
- Threshold is LINEAR: `expThreshold(level) = 80 + 35 * (level - 1)`, capped
  at level 36 (`PLAYER_LEVEL_SCALING_CAP`) — the cost stops climbing past
  the level every species has finished unlocking by.
- Overflow carries. Level-up shows a banner + SFX.
- **Leveling currently grants nothing else.** The level-rewards / missions-map
  system was removed for launch (see git history: `LEVEL_REWARDS`,
  `renderProgress`, `updateRewardDot`, `#screen-progress`, `btn-map-icon`).

**Companion / pal** (per caught record in IndexedDB):
- The active companion gains +35 pal XP per completed focus session
  (`savePalExp` in app.js, called from the encounter-done callback).
- `palExpThreshold(level) = Math.round(30 * 1.10^(level-1))`, capped at
  level 36 (`PAL_LEVEL_SCALING_CAP`) — same reasoning as the player cap
  above. Uncapped, 1.10x still made level 100 cost 107,000+ XP; capped, the
  cost holds at the level-36 rate past that (see the sizing note above
  `palExpThreshold` in app.js — tuned 2026-10-12).
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

- On My Mons, desktop: drag a mon card onto BLEND → confirm modal → record is
  deleted, +1 smoothie item (`pm_items` in localStorage). Drag the SMOOTHIES
  box onto a mon card → consume 1 smoothie, +1 pal level.
- Phones (≤479px, no HTML5 drag-and-drop on touch): the same two actions are
  two taps — tap BLEND or SMOOTHIES to arm it, then tap a card (see the
  tap-to-blend note in collection.js). The zone is no longer hidden there.
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
