// monsters.js — Pomomon roster data
// All Canvas drawing is in game.js. This file is data only.
//
// To add a PNG sprite for a mon, set the optional fields:
//   sprite:          'assets/sprites/foo.png'  // normal variant
//   shinySprite:     'assets/sprites/foo-s.png' // shiny (falls back to sprite)
//   spriteFrames:    3       // frame count (default 1 = static)
//   spriteAxis:      'x'/'y' // 'x' = horizontal sheet (default), 'y' = vertical sheet
//   spriteFps:       8       // uniform cycling speed (ignored when spriteBlinkMode true)
//   spriteBlinkMode: true    // hold frame 1 (open), briefly flash frame 0 (blink)
//   blinkInterval:   3000    // ms eyes stay open between blinks (default 3000)
//   blinkDuration:   150     // ms blink lasts (default 150)
// Mons without a sprite field will use the procedural block-art renderer.

const MONS = [
  { id: 1, name: 'Tomotot',  color: '#e74c3c', accent: '#c0392b', rarity: 'common',   catchRate: 0.99,
    sprite: 'assets/sprites/Tomotot/tomotot.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150,
    evolutions: [
      { atLevel: 16, name: 'Marinaro', color: '#c0392b', accent: '#922b21',
        sprite: 'assets/sprites/Marinaro/Marinaro.png', spriteFrames: 2, spriteAxis: 'y',
        spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 450 },
    ]
  },
  // TEST MODE: Marinaro catchable in wild (normally obtained via evolution at pal level 16)
  { id: 2, name: 'Marinaro', color: '#c0392b', accent: '#922b21', rarity: 'uncommon',  catchRate: 0.45,
    sprite: 'assets/sprites/Marinaro/Marinaro.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 450 },
  { id: 3, name: 'Avocuddle', color: '#7db356', accent: '#4a7c2f', rarity: 'common',   catchRate: 1.00,
    sprite: 'assets/sprites/Avocuddle/avocuddle.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150,
    evolutions: [
      { atLevel: 20, name: 'Pittsworth',  color: '#7a5c2a', accent: '#5a3e14',
        sprite: 'assets/sprites/Pittsworth/pittsworth.png', spriteFrames: 2, spriteAxis: 'y',
        spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150 },
      { atLevel: 36, name: 'Guacamonger', color: '#4d6b1a', accent: '#2e4a0a',
        sprite: 'assets/sprites/Guacamonger/guacamonger.png', spriteFrames: 2, spriteAxis: 'y',
        spriteBlinkMode: true, blinkInterval: 6000, blinkDuration: 900 },
    ]
  },
  { id: 4, name: 'Chilino',    color: '#d32f2f', accent: '#b71c1c', rarity: 'common',   catchRate: 0.70,
    sprite: 'assets/sprites/Chilino/chilino.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150 },
  // TEST MODE: Pittsworth catchable in wild (normally obtained via evolution at pal level 20)
  { id: 5, name: 'Pittsworth',  color: '#7a5c2a', accent: '#5a3e14', rarity: 'uncommon', catchRate: 1.00,
    sprite: 'assets/sprites/Pittsworth/pittsworth.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150 },
  // TEST MODE: Guacamonger catchable in wild (normally obtained via evolution at pal level 36)
  { id: 6, name: 'Guacamonger', color: '#4d6b1a', accent: '#2e4a0a', rarity: 'rare',     catchRate: 1.00,
    sprite: 'assets/sprites/Guacamonger/guacamonger.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 6000, blinkDuration: 900 },
];

// Spawn weight per rarity tier
const RARITY_WEIGHT = { common: 60, uncommon: 30, rare: 10 };

// Returns a random MONS entry using weighted rarity selection.
// TEST MODE: always spawn Guacamonger — restore weighted pool for production.
function getRandomMon() {
  return MONS.find(m => m.name === 'Guacamonger');
  const pool = [];
  for (const mon of MONS) {
    const w = RARITY_WEIGHT[mon.rarity] || 0;
    for (let i = 0; i < w; i++) pool.push(mon);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// Returns the current evolution stage of a mon based on its pal level.
// Returns the base mon merged with all fields from the highest unlocked evolution
// (name, color, accent, and optionally sprite/spriteFrames/etc.).
function getMonStage(mon, palLevel) {
  if (!mon.evolutions || mon.evolutions.length === 0) return mon;
  let result = mon;
  for (const evo of mon.evolutions) {
    if (palLevel >= evo.atLevel) {
      result = { ...mon, ...evo };
    }
  }
  return result;
}
