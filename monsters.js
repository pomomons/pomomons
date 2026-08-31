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
  { id: 1, dexNum: 1,  name: 'Tomotot',  type: 'Savory', color: '#e74c3c', accent: '#c0392b', rarity: 'common',   catchRate: 0.99,
    sprite: 'assets/sprites/Tomotot/tomotot.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150,
    evolutions: [
      { atLevel: 16, dexNum: 2,  name: 'Marinaro',    type: 'Savory',          color: '#c0392b', accent: '#922b21',
        sprite: 'assets/sprites/Marinaro/Marinaro.png', spriteFrames: 2, spriteAxis: 'y',
        spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 450 },
      { atLevel: 36, dexNum: 3,  name: 'Strangletti', type: 'Savory',          color: '#7b1a1a', accent: '#4a0a0a',
        sprite: 'assets/sprites/Strangletti/Strangletti.png', spriteFrames: 2, spriteAxis: 'y',
        spriteBlinkMode: true, blinkInterval: 6000, blinkDuration: 900 },
    ]
  },
  { id: 3, dexNum: 4,  name: 'Avocuddle', type: 'Savory', color: '#7db356', accent: '#4a7c2f', rarity: 'common',   catchRate: 1.00,
    sprite: 'assets/sprites/Avocuddle/avocuddle.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150,
    evolutions: [
      { atLevel: 20, dexNum: 5,  name: 'Pittsworth',  type: 'Bitter',          color: '#7a5c2a', accent: '#5a3e14',
        sprite: 'assets/sprites/Pittsworth/pittsworth.png', spriteFrames: 2, spriteAxis: 'y',
        spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150 },
      { atLevel: 36, dexNum: 6,  name: 'Guacamonger', type: 'Savory',          color: '#4d6b1a', accent: '#2e4a0a',
        sprite: 'assets/sprites/Guacamonger/guacamonger.png', spriteFrames: 2, spriteAxis: 'y',
        spriteBlinkMode: true, blinkInterval: 6000, blinkDuration: 900 },
    ]
  },
  { id: 4, dexNum: 7,  name: 'Chilino',    type: 'Spicy', color: '#d32f2f', accent: '#b71c1c', rarity: 'common',   catchRate: 0.70,
    sprite: 'assets/sprites/Chilino/chilino.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150,
    evolutions: [
      { atLevel: 20, dexNum: 8,  name: 'Scorchpepper', type: 'Spicy',           color: '#e55b00', accent: '#b33000',
        sprite: 'assets/sprites/Scorchpepper/Scorchpepper.png', spriteFrames: 2, spriteAxis: 'y',
        spriteBlinkMode: true, blinkInterval: 6000, blinkDuration: 1000 },
      { atLevel: 36, dexNum: 9,  name: 'Ghostpepper',  type: 'Spicy',           color: '#a8c8d8', accent: '#6a9ab0',
        sprite: 'assets/sprites/GhostPepper/ghostpepper.png', spriteFrames: 2, spriteAxis: 'y',
        spriteBlinkMode: true, blinkInterval: 6000, blinkDuration: 1350 },
    ]
  },
  { id: 8, dexNum: 15, name: 'Marshpuff',  type: 'Sweet', color: '#ecf0f1', accent: '#bdc3c7', rarity: 'common',   catchRate: 0.70,
    sprite: 'assets/sprites/Marshpuff/Marshpuff.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150,
    evolutions: [
      { atLevel: 20, dexNum: 16, name: 'Marshmelt', type: 'Sweet', color: '#c8a060', accent: '#8b6530',
        sprite: 'assets/sprites/Marshmelt/Marshmelt.png', spriteFrames: 2, spriteAxis: 'y',
        spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150 },
    ]
  },
  { id: 7, dexNum: 13, name: 'Pumplet',    type: 'Savory', color: '#e67e22', accent: '#d35400', rarity: 'common',   catchRate: 0.70,
    sprite: 'assets/sprites/Pumplet/Pumplet.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150,
    evolutions: [
      { atLevel: 20, dexNum: 14, name: 'Jackwicks', type: 'Savory', color: '#e67e22', accent: '#8b3a00',
        sprite: 'assets/sprites/Jackwick/Jackwick.png', spriteFrames: 2, spriteAxis: 'y',
        spriteBlinkMode: true, blinkInterval: 6000, blinkDuration: 900 },
    ]
  },
  { id: 6, dexNum: 10, name: 'Donot',      type: 'Sweet', color: '#6b3a2a', accent: '#4a2010', rarity: 'common',   catchRate: 0.65,
    sprite: 'assets/sprites/Donot/Donot.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 1200 },
  { id: 5, dexNum: 11, name: 'Bluble',     type: 'Sweet', color: '#2980b9', accent: '#1a5276', rarity: 'common',   catchRate: 0.65,
    sprite: 'assets/sprites/Bluble/Bluble.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150,
    evolutions: [
      { atLevel: 20, dexNum: 12, name: 'Mufman', type: 'Sweet', color: '#a67c52', accent: '#6b4423',
        sprite: 'assets/sprites/Mufman/Mufman.png', spriteFrames: 2, spriteAxis: 'y',
        spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150 },
    ]
  },
  { id: 9, dexNum: 17, name: 'Wedgling',   type: 'Savory', color: '#f5c842', accent: '#c89a10', rarity: 'common',   catchRate: 0.70,
    sprite: 'assets/sprites/Wedgling/Wedgling.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150 },
  { id: 10, dexNum: 18, name: 'Purrplant', type: 'Savory', color: '#8e44ad', accent: '#5b2c6f', rarity: 'uncommon', catchRate: 0.45,
    sprite: 'assets/sprites/Purrplant/Purrplant.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150 },
  { id: 11, dexNum: 19, name: 'Chillcone', type: 'Sweet', color: '#f5e6c8', accent: '#c8a060', rarity: 'common',   catchRate: 0.68,
    sprite: 'assets/sprites/Chillcone/Chillcone.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150 },
  { id: 12, dexNum: 20, name: 'Cocokid',   type: 'Sweet', color: '#8b5a2b', accent: '#5c3a17', rarity: 'common',   catchRate: 0.66,
    sprite: 'assets/sprites/Cocokid/Cocokid.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150 },
];

function getRandomMon() {
  // Rarity tiers removed — every first-stage mon spawns at an equal rate.
  return MONS[Math.floor(Math.random() * MONS.length)];
}

// ── Natures ─────────────────────────────────────────────────
// Flavour-only personality traits (like Pokémon natures). They don't affect
// stats — this game has none — but give every caught mon a bit of character.
const NATURES = [
  'Hardy',  'Lonely', 'Brave',   'Adamant', 'Naughty',
  'Bold',   'Docile', 'Relaxed', 'Impish',  'Lax',
  'Timid',  'Hasty',  'Serious', 'Jolly',   'Naive',
  'Modest', 'Mild',   'Quiet',   'Bashful', 'Rash',
  'Calm',   'Gentle', 'Sassy',   'Careful', 'Quirky',
];

const NATURE_FLAVOR = {
  Hardy:   'Loves a challenge',   Lonely:  'Enjoys quiet focus',
  Brave:   'Fears nothing',       Adamant: 'Never gives up',
  Naughty: 'A little rascal',     Bold:    'Takes the lead',
  Docile:  'Easygoing and calm',  Relaxed: 'Likes to take it slow',
  Impish:  'Loves a good prank',  Lax:     'Goes with the flow',
  Timid:   'Shy around others',   Hasty:   'Always in a hurry',
  Serious: 'All business',        Jolly:   'Cheerful and upbeat',
  Naive:   'Curious about all',   Modest:  'Humble and kind',
  Mild:    'Gentle-hearted',      Quiet:   'Prefers to listen',
  Bashful: 'Blushes easily',      Rash:    'Acts on impulse',
  Calm:    'Cool under pressure', Gentle:  'Soft and caring',
  Sassy:   'Full of attitude',    Careful: 'Plans every move',
  Quirky:  'Delightfully odd',
};

// 50/50 gender roll and a random nature — assigned once, when a mon is caught.
function randomGender() { return Math.random() < 0.5 ? 'M' : 'F'; }
function randomNature() { return NATURES[Math.floor(Math.random() * NATURES.length)]; }

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
