// monsters.js — Pomomon roster data
// All Canvas drawing is in game.js. This file is data only.

const MONS = [
  // ── Common (spawn weight 60%) ─────────────────────────────
  { id: 1, name: 'Tomatchi',   color: '#e74c3c', accent: '#c0392b', rarity: 'common',   catchRate: 0.72 },
  { id: 2, name: 'Broccoluff', color: '#27ae60', accent: '#1e8449', rarity: 'common',   catchRate: 0.68 },
  { id: 3, name: 'Chipchip',   color: '#f39c12', accent: '#d68910', rarity: 'common',   catchRate: 0.65 },
  { id: 4, name: 'Mushamoo',   color: '#bdc3c7', accent: '#7f8c8d', rarity: 'common',   catchRate: 0.62 },

  // ── Uncommon (spawn weight 30%) ───────────────────────────
  { id: 5, name: 'Lavandew',   color: '#8e44ad', accent: '#6c3483', rarity: 'uncommon', catchRate: 0.42 },
  { id: 6, name: 'Frostee',    color: '#2980b9', accent: '#1a5276', rarity: 'uncommon', catchRate: 0.38 },

  // ── Rare (spawn weight 10%) ───────────────────────────────
  { id: 7, name: 'Goldleaf',   color: '#f1c40f', accent: '#d4ac0d', rarity: 'rare',     catchRate: 0.22 },
  { id: 8, name: 'Darkoji',    color: '#2c2c2c', accent: '#111',    rarity: 'rare',     catchRate: 0.18 },
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
