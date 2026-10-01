# PomoMons — Monster Roster Reference

> Read this before adding new mons, evolutions, or changing sprite logic.
> Updated Aug 2026 for launch.

---

## Mon Object Schema (`MONS` in monsters.js)

```js
{
  id:        Number,   // unique, never reused (records reference it)
  dexNum:    Number,   // pomodex ordering — see numbering convention below
  name:      String,   // display name
  type:      String | [String, String],  // flavour type — 'Sweet', 'Spicy', 'Savory', 'Sour', 'Bitter' (array supported for dual-type but unused currently)
  color:     String,   // hex — used by procedural block-art fallback
  accent:    String,   // hex — darker accent for fallback art
  rarity:    String,   // LEGACY — inert, not read anywhere
  catchRate: Number,   // LEGACY — inert, catches are always 100%

  // Sprite fields (all mons currently use PNG sprites):
  sprite:          'assets/sprites/<Name>/<Name>.png',
  shinySprite:     optional separate shiny PNG (falls back to hue-rotate filter),
  spriteFrames:    2,        // frame count
  spriteAxis:      'y',      // vertical sheet (frames stacked)
  spriteBlinkMode: true,     // frame 1 = eyes open (held), frame 0 = blink flash
  blinkInterval:   3000,     // ms between blinks
  blinkDuration:   150,      // ms blink lasts (evolved mons often longer)

  evolutions: [   // optional, ordered by atLevel
    { atLevel, dexNum, name, type, color, accent, sprite, spriteFrames, ... }
  ]
}
```

`getMonStage(mon, palLevel)` returns the base mon merged with the highest
unlocked evolution's fields.

---

## Current Roster (16 lines, 28 dex entries)

Dex #17 is a hole: Wedgling was removed and its number retired, the same
way id 2 stays skipped.

Types are **flavour-based** (Sweet, Spicy, Savory, Sour, Bitter) — every mon
is a food, so a taste axis fits better than borrowed elemental types. A
line's type only shifts across evolution when the prep genuinely changes the
flavour (avocado pit is bitter/inedible before the guac: Savory → Bitter →
Savory). Otherwise it holds steady, even through a name change (tomato →
marinara → spaghetti stays Savory throughout, and Bluble → Bluebeary stays Sweet).
Sour is used by Soursquad (grapes) and Citrano (orange).

| id | Dex | Name       | Type    | Evolutions (atLevel → dex)                         |
|----|-----|------------|---------|-----------------------------------------------------|
| 1  | 1   | Tomotot    | Savory  | 16 → Marinaro #2 (Savory), 36 → Strangletti #3 (Savory) |
| 3  | 4   | Avocuddle  | Savory  | 20 → Pittsworth #5 (Bitter), 36 → Guacamonger #6 (Savory) |
| 4  | 7   | Chilino    | Spicy   | 20 → Scorchpepper #8 (Spicy), 36 → Ghostpepper #9 (Spicy) |
| 6  | 10  | Donot      | Sweet   | —                                                    |
| 5  | 11  | Bluble     | Sweet   | 20 → Bluebeary #12 (Sweet)                           |
| 7  | 13  | Pumplet    | Savory  | 20 → Jackwicks #14 (Savory)                          |
| 8  | 15  | Marshpuff  | Sweet   | 20 → Marshmelt #16 (Sweet)                           |
| 10 | 18  | Purrplant  | Savory  | —                                                    |
| 11 | 19  | Chillcone  | Sweet   | —                                                    |
| 12 | 20  | Cocokid    | Sweet   | 20 → Cocokong #21 (Sweet)                            |
| 13 | 22  | Pita Pal   | Sweet   | 20 → Pitagon #23 (Sweet)                             |
| 14 | 24  | Soursquad  | Sour    | —                                                    |
| 15 | 25  | Mushkin    | Savory  | 20 → Portobellord #26 (Savory)                       |
| 16 | 27  | Citrano    | Sour    | —                                                    |
| 17 | 28  | Spud       | Savory  | 20 → Idabro #29 (Savory)                             |
| 18 | 30  | Pinapip    | Sweet   | —                                                    |

Spawning is **uniform** across base mons (no rarity weighting). Shiny (1/500,
0.2%) and dark (1/100, 1% — 0.998% effective, since the dark roll only happens
if the shiny roll failed) variant rolls are independent of species — see
game-mechanics.md. These were documented here as 1% and 5%, which never matched
`SHINY_RATE`/`DARK_RATE` in game.js; corrected 2026-10-01 against the code.

---

## Sprite Conventions

- Location: `assets/sprites/<Name>/<Name>.png` (one folder per mon).
- **2-frame vertical blink sheet**: frame 0 (top) = blink, frame 1 (bottom) = open.
  File height = 2× frame height.
- **Frame size scales with evolution stage — intentional** (bigger = more evolved):
  - Basic mons: 32×32 (some 48)
  - Middle evolutions: 48×48 (mostly)
  - Final evolutions: 64×64
  Do NOT "fix" a 32px basic to match larger mons.
- Renderer (`MonSprite` in game.js) draws at 3× logical scale, fit-capped per
  screen; the procedural block-art renderer is the fallback if `sprite` is unset.
- Dark variant reuses the normal PNG through a canvas darken filter — no
  separate art needed. Shiny uses `shinySprite` if present, else a gold
  hue-rotate filter + sparkles.

---

## Adding a New Mon

1. Drop the sprite at `assets/sprites/<Name>/<Name>.png` (2-frame vertical sheet).
2. Append to `MONS`: next unused `id`, `dexNum` per the numbering convention
   below, type, colors, standard blink fields.
3. Dex counts and grids update automatically (`TOTAL_DEX` is computed).
4. Update the roster table in this file.

**Dex numbering convention:** a new evolution takes the number immediately
after its base/prior stage, and every existing entry with a dexNum ≥ that
value shifts up by one. Evolution lines read contiguously in the pomodex.
Array order in `MONS` doesn't matter — dex screens sort by `dexNum`.
