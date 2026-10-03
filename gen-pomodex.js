/* gen-pomodex.js — builds the /pomodex/ page from the roster in monsters.js.
 *
 * Required and called by build.js, which writes the result straight into
 * _site/pomodex/index.html. There is no committed copy of the page: it is
 * derived from monsters.js on every build, so it cannot fall out of step with
 * the roster at all.
 *
 * That is the whole point. llms.txt and the JSON-LD featureList both claimed
 * "20 forms across 12 base species" long after the roster had grown to 30
 * across 16, nothing caught it, and an AI assistant was found quoting the
 * stale figure back verbatim. A public page listing every mon is exactly the
 * kind of file that rots the same way — so it is not a file anyone maintains.
 *
 * Lives at the repo root with build.js rather than in tools/, because tools/
 * is gitignored and absent on the Pages runner: a build step cannot live
 * there. It is in build.js's EXCLUDE list so it is never published.
 *
 * Sprite rendering: every sheet is W x 2W — two square frames stacked
 * vertically — and spriteBlinkMode holds frame 1 (eyes open) with frame 0 as
 * the blink. A plain <img> would show both frames at once, so each sprite is a
 * span with the sheet as a background at 100% 200%, positioned on the bottom
 * half. That needs no per-mon dimensions and stays correct whatever size the
 * artwork is; the shape is asserted below before being relied on.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = __dirname;

const MONS = new Function(
  fs.readFileSync(path.join(ROOT, 'monsters.js'), 'utf8') + '; return MONS;'
)();

// ── Flatten the roster ─────────────────────────────────────
// Evolutions are nested inside their base species but are separate Pomodex
// entries with their own dexNum, so the table is driven by a flat list sorted
// by dexNum. A base species' rarity applies to its whole line: rarity is a
// property of the encounter, and only base forms are ever encountered.
const rows = [];
for (const m of MONS) {
  rows.push({ ...m, stage: 'Base form', rarity: m.rarity, line: m.name });
  for (const e of m.evolutions || []) {
    rows.push({ ...e, stage: `Evolves at level ${e.atLevel}`, rarity: m.rarity, line: m.name });
  }
}
rows.sort((a, b) => a.dexNum - b.dexNum);

const baseCount = MONS.length;
const formCount = rows.length;

// ── Sanity checks ──────────────────────────────────────────
// This page is public and its numbers are quoted elsewhere, so assert the
// roster's shape rather than assuming it.
const problems = [];

const nums = rows.map((r) => r.dexNum);
for (let i = 0; i < nums.length; i++) {
  if (nums[i] !== i + 1) {
    problems.push(`dexNum ${nums[i]} is out of sequence at position ${i + 1} — the Pomodex has a hole or a duplicate`);
    break;
  }
}

function pngSize(file) {
  const b = fs.readFileSync(path.join(ROOT, file));
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

for (const r of rows) {
  if (!r.sprite) { problems.push(`${r.name} (#${r.dexNum}) has no sprite`); continue; }
  if (!fs.existsSync(path.join(ROOT, r.sprite))) {
    problems.push(`${r.name} (#${r.dexNum}) points at missing sprite ${r.sprite}`);
    continue;
  }
  // The CSS crop below assumes a vertical sheet of square frames.
  const [w, h] = pngSize(r.sprite);
  const frames = r.spriteFrames || 1;
  const axis   = r.spriteAxis || 'x';
  if (axis !== 'y' || h !== w * frames) {
    problems.push(`${r.name} (#${r.dexNum}): sprite is ${w}x${h} on axis '${axis}' with ${frames} frames — the page crops vertical square-frame sheets only`);
  }
}

// Thrown rather than exited: build.js requires this module, and a build that
// cannot describe the roster must fail loudly rather than ship a page that
// misdescribes it.
if (problems.length) {
  throw new Error('gen-pomodex: roster problems:\n   - ' + problems.join('\n   - '));
}

// ── Render ─────────────────────────────────────────────────
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// frames-1 of the way down a sheet of `frames` frames puts the last frame in
// view; with 2 frames that is the 100% the blink mode wants.
function sprite(r) {
  const frames = r.spriteFrames || 1;
  const pos    = frames > 1 ? '0 100%' : '0 0';
  const size   = `100% ${frames * 100}%`;
  return `<span class="dex-sprite" role="img" aria-label="${esc(r.name)}, a pixel-art ${esc(r.type.toLowerCase())} Pomomon"`
       + ` style="background-image:url('/${r.sprite}');background-size:${size};background-position:${pos}"></span>`;
}

const tableRows = rows.map((r) => `
        <tr>
          <td class="dex-num">#${String(r.dexNum).padStart(2, '0')}</td>
          <td>${sprite(r)}</td>
          <td class="dex-name">${esc(r.name)}</td>
          <td><span class="chip chip-${esc(r.type.toLowerCase())}">${esc(r.type)}</span></td>
          <td>${esc(r.stage)}</td>
          <td>${esc(r.line)}</td>
        </tr>`).join('');

// One <h2> per evolution line, so the page has real headings to rank on rather
// than a bare table, and each line reads as a unit.
const lines = MONS.map((m) => {
  const chain = [m, ...(m.evolutions || [])];
  const names = chain.map((c, i) =>
    i === 0 ? `<strong>${esc(c.name)}</strong>`
            : `<strong>${esc(c.name)}</strong> (level ${c.atLevel})`).join(' &rarr; ');
  const types = [...new Set(chain.map((c) => c.type))];
  return `
    <h3>${esc(m.name)}${chain.length > 1 ? ` &mdash; #${m.dexNum}&ndash;#${chain[chain.length - 1].dexNum}` : ` &mdash; #${m.dexNum}`}</h3>
    <p>
      ${names}.
      ${types.length > 1
        ? `Starts as ${esc(types[0])} and ends as ${esc(types[types.length - 1])}.`
        : `${esc(types[0])} type throughout.`}
      ${m.rarity === 'common' ? 'Common encounter.' : `Rarity: ${esc(m.rarity)}.`}
      ${chain.length === 1 ? 'Does not evolve.' : ''}
    </p>`;
}).join('');

const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pomodex — All ${formCount} Pomomons and Their Evolutions</title>

  <!-- GENERATED FILE — do not edit by hand.
       Produced by tools/gen-pomodex.js from the roster in monsters.js.
       Run \`node tools/gen-pomodex.js\` after changing the roster; build.js
       runs \`--check\` and fails if this file is out of date. -->

  <meta name="description" content="Every Pomomon in PomoMons: all ${formCount} forms across ${baseCount} base species, with their flavour types, evolution levels and Pomodex numbers.">
  <link rel="canonical" href="https://pomomons.io/pomodex/">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="theme-color" content="#2b5343">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="PomoMons">
  <meta property="og:title" content="Pomodex — All ${formCount} Pomomons and Their Evolutions">
  <meta property="og:description" content="All ${formCount} Pomomon forms across ${baseCount} base species, with flavour types and evolution levels.">
  <meta property="og:url" content="https://pomomons.io/pomodex/">
  <meta property="og:image" content="https://pomomons.io/assets/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://pomomons.io/assets/og-image.png">

  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/favicon-32.png">
  <link rel="stylesheet" href="/assets/content.css">
  <style>
    /* Each sheet is two square frames stacked vertically; frame 1 is the
       eyes-open pose. Cropping with a background keeps one frame on screen
       without needing each sprite's pixel dimensions here. */
    .dex-sprite {
      display: inline-block;
      width: 40px;
      height: 40px;
      background-repeat: no-repeat;
      image-rendering: pixelated;
      vertical-align: middle;
    }
  </style>
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>

  <header class="site-head">
    <div class="site-head-in">
      <a class="wordmark" href="/">
        <img src="/assets/sprites/Tomato/Tomato.png" alt="">
        <span><span class="pomo">POMO</span>MONS</span>
      </a>
      <nav class="site-nav" aria-label="Site">
        <a href="/">Timer</a>
        <a href="/pomodex/" aria-current="page">Pomodex</a>
        <a href="/pomodoro-technique/">The technique</a>
        <a href="/faq/">FAQ</a>
      </nav>
    </div>
  </header>

  <main id="main">
    <h1>The Pomodex</h1>
    <p class="standfirst">
      All ${formCount} Pomomon forms across ${baseCount} base species. You meet
      one at the end of a focus session &mdash; only base forms appear in the
      wild, and the other ${formCount - baseCount} are evolutions you reach by
      levelling a Pomomon you already caught.
    </p>

    <h2>Every Pomomon</h2>
    <div class="dex-wrap">
      <table>
        <caption>Pomodex #01&ndash;#${String(formCount).padStart(2, '0')}. Evolution levels are the level the previous form evolves at.</caption>
        <thead>
          <tr>
            <th scope="col">No.</th>
            <th scope="col">Sprite</th>
            <th scope="col">Name</th>
            <th scope="col">Type</th>
            <th scope="col">Stage</th>
            <th scope="col">Line</th>
          </tr>
        </thead>
        <tbody>${tableRows}
        </tbody>
      </table>
    </div>

    <h2>How catching and evolving work</h2>
    <p>
      A wild Pomomon appears when a focus session ends, and you throw a tomato
      to catch it. Each species has its own catch rate, so a throw can miss and
      the Pomomon can break free. Caught Pomomons gain levels as you complete
      more sessions, and evolve on their own at level 16, 20 or 36 depending on
      the line.
    </p>
    <p>
      Two rare variants can turn up on any encounter: a <strong>shiny</strong>
      Pomomon, gold-tinted with sparkles, at roughly 0.2% &mdash; about 1 in 500
      &mdash; and a <strong>dark</strong> Pomomon, near-black, at about 1%. The
      other 98.8% are normal. Shiny is rolled first and wins outright, so no
      Pomomon is ever both. The <a href="/faq/">FAQ</a> has more on the
      mechanics.
    </p>

    <h2>Evolution lines</h2>
    <p>
      The ${baseCount} lines in full, in Pomodex order.
    </p>
    ${lines}

    <div class="cta-block">
      <p>Every Pomomon is caught by finishing a focus session.</p>
      <a class="cta" href="/">START A SESSION</a>
    </div>
  </main>

  <footer class="site-foot">
    <div class="site-foot-in">
      <span>PomoMons &mdash; focus &middot; catch &middot; collect</span>
      <nav aria-label="Footer">
        <a href="/">Timer</a>
        <a href="/pomodoro-technique/">The technique</a>
        <a href="/faq/">FAQ</a>
        <a href="https://discord.gg/bXnKR8FeG" rel="noopener">Discord</a>
      </nav>
    </div>
  </footer>
</body>
</html>
`;

module.exports = {
  html:       page,
  formCount,
  baseCount,
};
