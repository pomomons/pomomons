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
      // Bluebeary replaced Mufman as this line's one evolution — Mufman is
      // gone from the roster entirely, and its sprite is unreferenced. It took
      // Mufman's dexNum 12 as well, which keeps the dex contiguous; nothing
      // persists dexNum (saves store the base id, 5), so the reuse is free.
      //
      // 64px frames against Bluble's 32px — the full jump from the basic tier
      // to the final-evolution tier, the same shape as Cocokid → Cocokong and
      // Pita Pal → Pitagon. Mufman's 48px middle step is what dropped out.
      //
      // Colours sampled from the sprite: the fur's blue and the darker blue it
      // is shaded with (the near-black #160d3d is the outline, which no other
      // mon uses as accent).
      { atLevel: 20, dexNum: 12, name: 'Bluebeary', type: 'Sweet', color: '#52a4fd', accent: '#1a6be6',
        sprite: 'assets/sprites/Bluebeary/Bluebeary.png', spriteFrames: 2, spriteAxis: 'y',
        spriteBlinkMode: true, blinkInterval: 6000, blinkDuration: 900 },
    ]
  },
  // id 9 and dexNum 17 were Wedgling, removed from the roster. Both stay
  // retired rather than reused: caught records store the species id, so a
  // number that has meant something else is not worth handing to a new mon —
  // the same reason 2 has stayed skipped. That leaves a hole at #17 in the
  // dex; renumbering everything after it would be safe (nothing persists
  // dexNum) but would move twelve mons, so the gap stands instead.
  { id: 10, dexNum: 18, name: 'Purrplant', type: 'Savory', color: '#8e44ad', accent: '#5b2c6f', rarity: 'uncommon', catchRate: 0.45,
    sprite: 'assets/sprites/Purrplant/Purrplant.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150 },
  { id: 11, dexNum: 19, name: 'Chillcone', type: 'Sweet', color: '#f5e6c8', accent: '#c8a060', rarity: 'common',   catchRate: 0.68,
    sprite: 'assets/sprites/Chillcone/Chillcone.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150 },
  { id: 12, dexNum: 20, name: 'Cocokid',   type: 'Sweet', color: '#8b5a2b', accent: '#5c3a17', rarity: 'common',   catchRate: 0.66,
    sprite: 'assets/sprites/Cocokid/Cocokid.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150,
    evolutions: [
      // 64px frames — the final-evolution size tier, so it draws at full box
      // size next to Cocokid's 32px basic. Colours sampled from the sprite:
      // the husk's brown and the shadow it is shaded with.
      { atLevel: 20, dexNum: 21, name: 'Cocokong', type: 'Sweet', color: '#783d1e', accent: '#4f1e0f',
        sprite: 'assets/sprites/Cocokong/Cocokong.png', spriteFrames: 2, spriteAxis: 'y',
        spriteBlinkMode: true, blinkInterval: 4500, blinkDuration: 150 },
    ]
  },
  // Dragon fruit. Renamed from Pitagon, which is now the name of its
  // evolution — the id is what caught records store, so existing saves follow
  // the rename and keep their place in the line.
  // id 13 rather than the free 2,
  // which an old evolution used to hold — caught records store the id, so a
  // number that has ever meant something else is not worth reusing.
  // Colours sampled from the sprite: the skin's magenta and its shadow.
  { id: 13, dexNum: 22, name: 'Pita Pal', type: 'Sweet', color: '#c3193e', accent: '#760d28', rarity: 'common',   catchRate: 0.68,
    sprite: 'assets/sprites/Pitapal/Pitapal.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150,
    evolutions: [
      // 64px frames against Pita Pal's 32px — the full jump from the basic
      // tier to the final-evolution tier, so it doubles in size on screen.
      // Colours sampled from the sprite: the skin's red and its shadow, both
      // brighter than the basic's.
      { atLevel: 20, dexNum: 23, name: 'Pitagon', type: 'Sweet', color: '#e20239', accent: '#931a39',
        sprite: 'assets/sprites/Pitagon/Pitagon.png', spriteFrames: 2, spriteAxis: 'y',
        spriteBlinkMode: true, blinkInterval: 4500, blinkDuration: 150 },
    ]
  },
  // A bunch of grapes, so the first mon to use the Sour type — the palette has
  // carried --type-sour since the types were defined and nothing had claimed
  // it. Basic, no evolution line.
  //
  // Its frames are 64px, which is NATIVE_MAX: displaySize() reads a sprite's
  // native resolution as its intended size, so this draws at full box size,
  // the tier that until now held only final evolutions (Guacamonger,
  // Strangletti, Ghostpepper). Deliberate — it is meant to read as a big mon —
  // but it is why a basic mon out-sizes several evolved ones on screen.
  { id: 14, dexNum: 24, name: 'Soursquad', type: 'Sour',  color: '#64278d', accent: '#3d1460', rarity: 'common',   catchRate: 0.65,
    sprite: 'assets/sprites/Soursquad/Soursquad.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150 },
  // Toadstool. Savory for the mushroom's umami, which is also the type the art
  // reads as — nothing about the red cap says sweet or sour. Colours sampled
  // from the sprite: the cap's red and the darker red it is shaded with (the
  // cream stem is the third colour, but accent is used as a shadow everywhere
  // else, so the shade wins).
  //
  // 48px frames, the middle size tier — same as Donot, Purrplant and
  // Chillcone, which are basics too, so this sits in the roster at a normal
  // size rather than towering the way Soursquad does.
  //
  // Evolves once, at 20, the level every other two-stage line uses (Marshpuff,
  // Pumplet, Bluble); the three-stage lines are the only ones that go to 36.
  // Portobellord keeps Savory and steps up to 64px frames, the final-evolution
  // tier, so it reads as a proper growth from Mushkin's 48. Its colours are
  // sampled the same way: the portobello cap's brown and its shade, which is
  // where the line leaves the red toadstool palette behind.
  { id: 15, dexNum: 25, name: 'Mushkin',   type: 'Savory', color: '#b50f13', accent: '#7d060f', rarity: 'common',   catchRate: 0.67,
    sprite: 'assets/sprites/Mushkin/Mushkin.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150,
    evolutions: [
      { atLevel: 20, dexNum: 26, name: 'Portobellord', type: 'Savory', color: '#803b33', accent: '#632d2d',
        sprite: 'assets/sprites/Portobellord/Portobellord.png', spriteFrames: 2, spriteAxis: 'y',
        spriteBlinkMode: true, blinkInterval: 6000, blinkDuration: 900 },
    ]
  },
  // Orange. Basic mon, no evolution line. Sour for the citrus — the second mon
  // to use the type after Soursquad. Colours sampled from the sprite: the
  // peel's orange and the red-orange it is shaded with.
  //
  // 32px frames, the basic-mon size tier (same as Tomotot and Pita Pal), so it
  // draws small next to the 48px and 64px mons. That is the intended rule —
  // see agent_docs/monsters.md.
  //
  // catchRate 1.00 is cosmetic: the field is inert legacy, every catch already
  // succeeds. Kept explicit so the roster reads consistently.
  { id: 16, dexNum: 27, name: 'Citrano',   type: 'Sour',  color: '#f2700e', accent: '#cc3a19', rarity: 'common',   catchRate: 1.00,
    sprite: 'assets/sprites/Citrano/Citrano.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150 },
  // Potato. Basic mon, no evolution line. Savory — a potato is the plainest
  // case the type has. Colours sampled from the sprite: the skin's tan and the
  // brown it is shaded with.
  //
  // 32px frames (the file is 32×64, two stacked frames), the basic-mon size
  // tier alongside Tomotot, Pita Pal and Citrano.
  //
  // id 17 — the next unused number. 2 stays skipped: an old evolution held it
  // and caught records store the id.
  { id: 17, dexNum: 28, name: 'Spud',      type: 'Savory', color: '#f3b263', accent: '#985b33', rarity: 'common',   catchRate: 1.00,
    sprite: 'assets/sprites/Spud/Spud.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150,
    evolutions: [
      // 64px frames (64×128 file, two stacked) — the final-evolution tier, so
      // Idabro draws at full box size against Spud's 32px basic. One jump with
      // no 48px middle step, the same shape as Cocokid → Cocokong and
      // Bluble → Bluebeary.
      //
      // Colours sampled from the sprite: the potato flesh (#f5b057, 39% of the
      // opaque pixels) and the darker tone it is shaded with (#c3712e, 14%).
      // The cap's red (#fb1e2d) is the louder colour and still loses — accent
      // is a shadow everywhere else in this roster, the same call the comment
      // on Pinapip's crown records.
      //
      // The two frames differ by exactly 14 pixels and all of them are the
      // highlights on the sunglasses: white in frame 0, black in frame 1.
      // blinkMode rests on frame 1 and flashes frame 0, so this reads as a
      // glint crossing the lenses rather than a blink. Timed slower and longer
      // than the roster's 3000/150 default on purpose — a sparkle firing as
      // often as an eye-blink reads as a flicker.
      { atLevel: 20, dexNum: 29, name: 'Idabro', type: 'Savory', color: '#f5b057', accent: '#c3712e',
        sprite: 'assets/sprites/Idabro/Idabro.png', spriteFrames: 2, spriteAxis: 'y',
        spriteBlinkMode: true, blinkInterval: 4000, blinkDuration: 200 },
    ]
  },
  // Pineapple. Basic mon, no evolution line. Sweet rather than Sour, following
  // Pita Pal (dragon fruit): a tropical fruit reads Sweet here, and Sour is
  // held by the sharply acidic pair, Soursquad (grapes) and Citrano (orange).
  // Colours sampled from the sprite: the flesh's yellow and the orange it is
  // shaded with. The crown's greens are the third colour, but accent is a
  // shadow everywhere else in this roster, so the shade wins.
  //
  // 32px frames (32×64 file, two stacked), the basic-mon size tier.
  //
  // The two white pixels in frame 1 are the eye highlights, and they are the
  // ONLY white left in the sheet — worth knowing before running any "remove the
  // background" pass over this sprite again, because the first export had the
  // background baked in as opaque near-white and clearing it took the eyes too.
  // dexNum 30, not 29: Idabro took 29 as Spud's evolution, and an evolution
  // sits directly after its base (see the convention note at the top). Nothing
  // persists dexNum, so pushing Pinapip up one costs nothing.
  { id: 18, dexNum: 30, name: 'Pinapip',   type: 'Sweet',  color: '#fef438', accent: '#e06804', rarity: 'common',   catchRate: 1.00,
    sprite: 'assets/sprites/Pinapip/Pinapip.png', spriteFrames: 2, spriteAxis: 'y',
    spriteBlinkMode: true, blinkInterval: 3000, blinkDuration: 150 },
];

// ── TESTING ONLY — force every encounter to one mon ───────
// Set to a mon's name (e.g. 'Pita Pal') to make it spawn 100% of the time;
// null uses the normal even roll across the roster. Mirrors the session-length
// switches in app.js. ALWAYS return this to null before shipping — with it
// set there is no way to encounter anything else.
const TEST_FORCE_MON = null;

function getRandomMon() {
  if (TEST_FORCE_MON) {
    // Evolution stages are reachable here too, not just the base roster: a
    // stage only ever appears on screen after a player levels one, so pinning
    // spawns to it is the only quick way to look at a new evolution's art in
    // an encounter. The stage is merged onto its base the way getMonStage
    // does it, so the spawn carries the evolved name, sprite and colours.
    //
    // It also carries the BASE's id, which is the right call for the roster
    // but worth knowing while testing: catching a forced evolution files the
    // record under its base species at level 1, so it lands in My Mons as the
    // first-stage mon, not as the thing that was on the encounter screen.
    const forced = MONS.find(m => m.name === TEST_FORCE_MON)
      || MONS.flatMap(m => (m.evolutions || []).map(evo => ({ ...m, ...evo })))
             .find(stage => stage.name === TEST_FORCE_MON);
    // Falls through to the normal roll if the name is a typo, rather than
    // returning undefined and breaking every encounter.
    if (forced) return forced;
    console.warn('TEST_FORCE_MON: no mon named ' + TEST_FORCE_MON);
  }
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
// opts.frame — wrap each badge in .lv-frame, the outline the LV badges wear.
// Off by default: My Mons, the Pomodex, the mon-detail card and the evolution
// chain all want the plain chip. It has to be a real wrapper element and not a
// border on the badge — the outline is the wrapper's own background showing
// through its padding, and BOTH layers carry the same clip-path, which is what
// traces the notched corners. A border belongs to the single clipped box, so
// the clip cuts it away at exactly those corners and the badge ends up framed
// on its sides but bare on its steps.
function makeTypeBadges(type, opts) {
  const types = Array.isArray(type) ? type : (type ? [type] : []);
  const frame = !!(opts && opts.frame);
  const wrap = document.createElement('span');
  wrap.className = 'type-badges';
  for (const t of types) {
    const badge = document.createElement('span');
    badge.className = `type-badge type-${t.toLowerCase()}`;
    badge.textContent = t.toUpperCase();
    if (frame) {
      const outline = document.createElement('span');
      outline.className = 'lv-frame';
      outline.appendChild(badge);
      wrap.appendChild(outline);
    } else {
      wrap.appendChild(badge);
    }
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
