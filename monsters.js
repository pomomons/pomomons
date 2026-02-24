// monsters.js — Pomomon roster data
// All Canvas drawing is in game.js. This file is data only.

const MONS = [
  // ── Common (spawn weight 60%) ─────────────────────────────
  { id: 1, name: 'Tomatchi',   color: '#e74c3c', accent: '#c0392b', rarity: 'common',   catchRate: 0.72,
    evolutions: [
      { atLevel: 16, name: 'Tomathorn', color: '#c0392b', accent: '#922b21' },
      { atLevel: 36, name: 'Tomatrex',  color: '#7b241c', accent: '#641e16' },
    ]
  },
  { id: 2, name: 'Broccoluff', color: '#27ae60', accent: '#1e8449', rarity: 'common',   catchRate: 0.68,
    evolutions: [
      { atLevel: 20, name: 'Broccosaurus', color: '#1a7a45', accent: '#145e34' },
    ]
  },
  { id: 3, name: 'Chipchip',   color: '#f39c12', accent: '#d68910', rarity: 'common',   catchRate: 0.65,
    evolutions: [
      { atLevel: 20, name: 'Chiplord', color: '#d68910', accent: '#b7770d' },
    ]
  },
  { id: 4, name: 'Mushamoo',   color: '#bdc3c7', accent: '#7f8c8d', rarity: 'common',   catchRate: 0.62 },

  // ── Uncommon (spawn weight 30%) ───────────────────────────
  { id: 5,  name: 'Lavandew',  color: '#8e44ad', accent: '#6c3483', rarity: 'uncommon', catchRate: 0.42 },
  { id: 6,  name: 'Frostee',   color: '#2980b9', accent: '#1a5276', rarity: 'uncommon', catchRate: 0.38 },

  // ── Rare (spawn weight 10%) ───────────────────────────────
  { id: 7,  name: 'Goldleaf',  color: '#f1c40f', accent: '#d4ac0d', rarity: 'rare',     catchRate: 0.22 },
  { id: 8,  name: 'Darkoji',   color: '#2c2c2c', accent: '#111',    rarity: 'rare',     catchRate: 0.18 },

  // ── Feature 4 additions ───────────────────────────────────
  // Common
  { id: 9,  name: 'Pepperino', color: '#e67e22', accent: '#ca6f1e', rarity: 'common',   catchRate: 0.70,
    evolutions: [
      { atLevel: 20, name: 'Blazepeppa', color: '#e74c3c', accent: '#c0392b' },
    ]
  },
  { id: 10, name: 'Lemonchi',  color: '#f7dc6f', accent: '#d4ac0d', rarity: 'common',   catchRate: 0.67 },
  { id: 11, name: 'Cornie',    color: '#f0b429', accent: '#c8960c', rarity: 'common',   catchRate: 0.64 },
  { id: 12, name: 'Berryblu',  color: '#5499c7', accent: '#2471a3', rarity: 'common',   catchRate: 0.61 },
  // Uncommon
  { id: 13, name: 'Grapechu',  color: '#7d3c98', accent: '#512e5f', rarity: 'uncommon', catchRate: 0.45,
    evolutions: [
      { atLevel: 16, name: 'Grapeking', color: '#6c3483', accent: '#4a235a' },
      { atLevel: 36, name: 'Grapelord', color: '#4a1a6b', accent: '#2e0a4e' },
    ]
  },
  { id: 14, name: 'Cocobun',   color: '#795548', accent: '#4e342e', rarity: 'uncommon', catchRate: 0.40 },
  // Rare
  { id: 15, name: 'Mintail',   color: '#1abc9c', accent: '#148f77', rarity: 'rare',     catchRate: 0.20 },
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

// Returns the current evolution stage of a mon based on its pal level.
// Returns the base mon object merged with the highest unlocked evolution's
// name/color/accent. No-evolution mons always return themselves unchanged.
function getMonStage(mon, palLevel) {
  if (!mon.evolutions || mon.evolutions.length === 0) return mon;
  let result = mon;
  for (const evo of mon.evolutions) {
    if (palLevel >= evo.atLevel) {
      result = { ...mon, name: evo.name, color: evo.color, accent: evo.accent };
    }
  }
  return result;
}
