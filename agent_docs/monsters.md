# PomoMons — Monster Roster Reference

> Read this before adding new mons, changing rarity tiers, or updating sprite logic.

---

## Mon Object Schema

```js
{
  id:        Number,   // Unique integer, 1-indexed, never reused
  name:      String,   // Display name (title-case, max ~10 chars)
  color:     String,   // CSS hex — primary body color
  accent:    String,   // CSS hex — darker shade for ears, shadows, mouth
  rarity:    String,   // 'common' | 'uncommon' | 'rare' | 'legendary'
  catchRate: Number,   // 0–1 decimal; see game-mechanics.md for ranges
}
```

Shiny palette is NOT stored on the mon object — it is generated at encounter time
and stored on the caught record (`{ ..., shiny: true }`). When `shiny === true`,
the sprite draws with gold (`#f1c40f`) as the primary color and `#d4ac0d` accent.

---

## Starter Roster (Feature 2, IDs 1–8)

| ID | Name       | Color     | Accent    | Rarity   | catchRate | Inspiration      |
|----|------------|-----------|-----------|----------|-----------|------------------|
| 1  | Tomatchi   | #e74c3c   | #c0392b   | common   | 0.72      | tomato           |
| 2  | Broccoluff | #27ae60   | #1e8449   | common   | 0.68      | broccoli         |
| 3  | Chipchip   | #f39c12   | #d68910   | common   | 0.65      | potato chip      |
| 4  | Mushamoo   | #bdc3c7   | #7f8c8d   | common   | 0.62      | mushroom         |
| 5  | Lavandew   | #8e44ad   | #6c3483   | uncommon | 0.42      | lavender / dew   |
| 6  | Frostee    | #2980b9   | #1a5276   | uncommon | 0.38      | ice cream        |
| 7  | Goldleaf   | #f1c40f   | #d4ac0d   | rare     | 0.22      | gold / matcha    |
| 8  | Darkoji    | #2c2c2c   | #111111   | rare     | 0.18      | dark chocolate   |

---

## Rarity Tiers

| Tier      | Spawn % | catchRate range | Future count |
|-----------|---------|-----------------|--------------|
| common    | 60 %    | 0.60 – 0.75     | ~25 mons     |
| uncommon  | 30 %    | 0.35 – 0.50     | ~15 mons     |
| rare      | 10 %    | 0.15 – 0.25     | ~8 mons      |
| legendary | 2 %*    | 0.05 – 0.10     | ~2 mons      |

*legendary spawns require a separate weight table update in `monsters.js`.

---

## Adding a New Mon

1. Append a new object to the `MONS` array in `monsters.js`.
2. Assign the next available `id` (never recycle IDs — players may already have records).
3. Choose `color` / `accent` so the sprite reads clearly at 48×48 logical pixels.
4. Set `catchRate` within the rarity tier's defined range.
5. Document it in this file's roster table.
6. If adding a new rarity tier, update `RARITY_WEIGHT` in `monsters.js` and this doc.

---

## Sprite Style Guide

All mons are drawn as pixel-art creatures using `fillRect` blocks in `game.js`.
The placeholder style (used until real sprite sheets land in `assets/sprites/`) follows:

- **Body**: 48×48 logical px square, `mon.color`
- **Ears**: two small bumps on top, `mon.color`
- **Eyes**: two 6×6 blocks, dark (`#2c2c2c`), with 2×2 white shine
- **Blush**: two 10×4 blocks below eyes, lighter tint of `mon.color`
- **Mouth**: 3-block pixel smile, `accent`
- **Shadow**: semi-transparent ellipse under body, fades at bob apex

Shiny sprites swap body + accent colors for gold (`#f1c40f` / `#d4ac0d`) and add
a small sparkle star above the right ear.

---

## Sprite Sheet Integration (Future)

When real PNG sprites are ready:
- Place at `assets/sprites/mon_{id}.png` (normal) and `mon_{id}_s.png` (shiny)
- Each sheet: 4 frames × 48px wide = 192×48 px, 8 fps idle loop
- `game.js drawMon()` will detect the sheet and use `drawImage()` instead of blocks
- Placeholder block drawing stays as fallback if the image hasn't loaded
