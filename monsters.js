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
  { id: 1, dexNum: 1,  name: 'Tomotot',  type: 'Basic', color: '#e74c3c', accent: '#c0392b', rarity: 'common',   catchRate: 0.99,
    sprite: 'assets/sprites/Tomotot/tomotot.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150,
    evolutions: [
      { atLevel: 16, dexNum: 2,  name: 'Marinaro',    type: 'Water',           color: '#c0392b', accent: '#922b21',
        sprite: 'assets/sprites/Marinaro/Marinaro.png', spriteFrames: 2, spriteAxis: 'y',
        spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 450 },
      { atLevel: 36, dexNum: 3,  name: 'Strangletti', type: 'Dark',            color: '#7b1a1a', accent: '#4a0a0a',
        sprite: 'assets/sprites/Strangletti/Strangletti.png', spriteFrames: 2, spriteAxis: 'y',
        spriteBlinkMode: true, blinkInterval: 6000, blinkDuration: 900 },
    ]
  },
  { id: 3, dexNum: 4,  name: 'Avocuddle', type: 'Basic', color: '#7db356', accent: '#4a7c2f', rarity: 'common',   catchRate: 1.00,
    sprite: 'assets/sprites/Avocuddle/avocuddle.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150,
    evolutions: [
      { atLevel: 20, dexNum: 5,  name: 'Pittsworth',  type: 'Basic',           color: '#7a5c2a', accent: '#5a3e14',
        sprite: 'assets/sprites/Pittsworth/pittsworth.png', spriteFrames: 2, spriteAxis: 'y',
        spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150 },
      { atLevel: 36, dexNum: 6,  name: 'Guacamonger', type: 'Fighting',        color: '#4d6b1a', accent: '#2e4a0a',
        sprite: 'assets/sprites/Guacamonger/guacamonger.png', spriteFrames: 2, spriteAxis: 'y',
        spriteBlinkMode: true, blinkInterval: 6000, blinkDuration: 900 },
    ]
  },
  { id: 4, dexNum: 7,  name: 'Chilino',    type: 'Basic', color: '#d32f2f', accent: '#b71c1c', rarity: 'common',   catchRate: 0.70,
    sprite: 'assets/sprites/Chilino/chilino.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150,
    evolutions: [
      { atLevel: 20, dexNum: 8,  name: 'Scorchpepper', type: 'Fire',            color: '#e55b00', accent: '#b33000',
        sprite: 'assets/sprites/Scorchpepper/Scorchpepper.png', spriteFrames: 2, spriteAxis: 'y',
        spriteBlinkMode: true, blinkInterval: 6000, blinkDuration: 1000 },
      { atLevel: 36, dexNum: 9,  name: 'Ghostpepper',  type: ['Fire', 'Ghost'], color: '#a8c8d8', accent: '#6a9ab0',
        sprite: 'assets/sprites/Ghostpepper/Ghostpepper.png', spriteFrames: 2, spriteAxis: 'y',
        spriteBlinkMode: true, blinkInterval: 6000, blinkDuration: 1350 },
    ]
  },
  { id: 8, dexNum: 13, name: 'Marshpuff',  type: 'Sweet', color: '#ecf0f1', accent: '#bdc3c7', rarity: 'common',   catchRate: 0.70,
    sprite: 'assets/sprites/Marshpuff/Marshpuff.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150,
    evolutions: [
      { atLevel: 20, dexNum: 14, name: 'Marshmelt', type: 'Sweet', color: '#c8a060', accent: '#8b6530',
        sprite: 'assets/sprites/Marshmelt/Marshmelt.png', spriteFrames: 2, spriteAxis: 'y',
        spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150 },
    ]
  },
  { id: 7, dexNum: 12, name: 'Pumplet',    type: 'Ghost', color: '#e67e22', accent: '#d35400', rarity: 'common',   catchRate: 0.70,
    sprite: 'assets/sprites/Pumplet/Pumplet.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150 },
  { id: 6, dexNum: 10, name: 'Donot',      type: 'Sweet', color: '#6b3a2a', accent: '#4a2010', rarity: 'common',   catchRate: 0.65,
    sprite: 'assets/sprites/Donot/Donot.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 1200 },
  { id: 5, dexNum: 11, name: 'Bluble',     type: 'Basic', color: '#2980b9', accent: '#1a5276', rarity: 'common',   catchRate: 0.65,
    sprite: 'assets/sprites/Bluble/Bluble.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150 },
];

// Spawn weight per rarity tier
const RARITY_WEIGHT = { common: 60, uncommon: 30, rare: 10 };

// Returns a random MONS entry using weighted rarity selection.
function getRandomMon() {
  const pool = [];
  for (const mon of MONS) {
    const w = RARITY_WEIGHT[mon.rarity] || 0;
    for (let i = 0; i < w; i++) pool.push(mon);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// Builds one or two type badge <span> elements wrapped in a container.
// type can be a string ('Fire') or array (['Fire','Ghost']).
function makeTypeBadges(type) {
  const types = Array.isArray(type) ? type : (type ? [type] : []);
  const wrap = document.createElement('span');
  wrap.className = 'type-badges';
  for (const t of types) {
    const badge = document.createElement('span');
    badge.className = `type-badge type-${t.toLowerCase()}`;
    badge.textContent = t.toUpperCase();
    wrap.appendChild(badge);
  }
  return wrap;
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
