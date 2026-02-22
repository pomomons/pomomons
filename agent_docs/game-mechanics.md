# PomoMons — Game Mechanics Reference

> Read this before working on encounter logic, EXP/leveling, or catch balance.

---

## Encounter Trigger

- An encounter fires after every **focus session** completes (not breaks).
- Handled in `app.js → onSessionEnd()` when `currentMode === 'focus'`.
- Calls `EncounterScreen.start(onDone)` in `game.js`.

---

## Pomomon Spawning

Spawn weights by rarity tier:

| Rarity   | Weight | % chance |
|----------|--------|----------|
| common   | 60     | 60 %     |
| uncommon | 30     | 30 %     |
| rare     | 10     | 10 %     |

`getRandomMon()` in `monsters.js` builds a weighted pool and picks uniformly.

---

## Catch Formula

```
success = Math.random() < mon.catchRate
```

`catchRate` is a decimal 0–1 defined per mon in `monsters.js`.

| Rarity   | catchRate range |
|----------|-----------------|
| common   | 0.60 – 0.75     |
| uncommon | 0.35 – 0.50     |
| rare     | 0.15 – 0.25     |

No other modifiers in Feature 2. Future features may factor in player level or
active companion bonuses.

---

## Shiny Odds

Checked independently of catch success, at the moment of encounter generation:

```
isShiny = Math.random() < (1 / 64)   // ≈ 1.5625 %
```

Shiny mons have their `color` and `accent` replaced with a gold palette when drawn.
Shiny status is stored in the caught record.

---

## EXP Rewards

| Outcome | EXP gained |
|---------|------------|
| Caught  | +25        |
| Fled    | +5         |

Awarded at the end of the encounter via `saveExp(delta)` in `app.js`.

---

## Leveling

Level-up threshold formula (EXP required to reach the next level):

```
threshold(level) = Math.floor(100 * Math.pow(1.5, level - 1))
```

| Level | EXP needed to level up |
|-------|------------------------|
| 1     | 100                    |
| 2     | 150                    |
| 3     | 225                    |
| 4     | 338                    |
| 5     | 506                    |

EXP overflow carries over to the next level.
`pm_level` and `pm_exp` are stored in `localStorage`.
The header EXP bar width is `(pm_exp / threshold(pm_level)) * 100 %`.

---

## Persistence (Feature 2 — localStorage)

| Key         | Type        | Contents                                  |
|-------------|-------------|-------------------------------------------|
| `pm_level`  | integer     | Current player level (starts at 1)        |
| `pm_exp`    | integer     | EXP within the current level              |
| `pm_caught` | JSON array  | `[{ id, name, shiny, caughtAt }, ...]`    |

Migrates to IndexedDB in Feature 3 (collection screen).
`pm_caught` is append-only in Feature 2; duplicates allowed (multi-catch same species).

---

## Encounter Animation Phases (game.js EncounterScreen)

| Phase       | Duration   | Description                                   |
|-------------|------------|-----------------------------------------------|
| `appearing` | 30 frames  | Mon slides down from top of canvas            |
| `idle`      | unlimited  | Mon bobs; Throw / Flee buttons enabled        |
| `throwing`  | 40 frames  | Tomato arcs toward mon; buttons disabled      |
| `shaking`   | 30 frames  | Mon shakes ±8 px (3 cycles) after tomato hit |
| `result`    | 50 frames  | Caught: flash + shrink. Fled: jump + fly off  |
| `done`      | —          | Overlay hides; `onDone` callback fires        |
