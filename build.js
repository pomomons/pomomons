/* PomoMons build — strips comments and whitespace into _site/.
 *
 * Why this exists: the source files carry long explanatory comments on
 * purpose, and those were being downloaded by every visitor. style-v3.css
 * alone shipped ~43 KB over the wire of which only ~9 KB was actual CSS.
 * Source stays exactly as written; only what lands in _site/ is squeezed.
 *
 * Deliberately conservative. Terser runs with top-level mangling OFF because
 * the app's files talk to each other through globals (MONS, MonSprite,
 * Collection, SFX, addStat...) with no module system to track them. CSS is
 * level-1 only: no rule merging or reordering, so cascade order — which this
 * codebase leans on hard, style-v3 overriding style.css — cannot shift.
 * HTML uses conservativeCollapse so runs of whitespace become one space
 * rather than vanishing, which keeps inline spacing identical.
 *
 *   node build.js          build into _site/
 *   node build.js --check  build, then run the verification pass only
 */

const fs     = require('fs');
const path   = require('path');
const zlib   = require('zlib');
const crypto = require('crypto');

const { minify: minifyJS }   = require('terser');
const CleanCSS               = require('clean-css');
const { minify: minifyHTML } = require('html-minifier-terser');

const ROOT = __dirname;
const OUT  = path.join(ROOT, '_site');

// The live origin, taken from CNAME so the two can never disagree. Used to
// check that every URL the sitemap advertises is a page this build produced.
const SITE_ORIGIN = 'https://' +
  fs.readFileSync(path.join(ROOT, 'CNAME'), 'utf8').trim();

// Everything else in the repo is source, tooling or documentation and has no
// business on the live site. agent_docs/ and CLAUDE.md were being served
// publicly before this build existed.
// Compared case-insensitively: the repo tracks CLAUDE.MD, Windows reports it
// as CLAUDE.md, and the Linux runner that actually builds the site would
// otherwise publish it.
const EXCLUDE = new Set([
  '_site', 'node_modules', '.git', '.claude', '.github', 'tools',
  'agent_docs', 'art-source', 'build.js', 'package.json', 'package-lock.json',
  'claude.md', 'readme.md', '.gitignore',
  // Build infrastructure, not content: build.js requires it to generate the
  // Pomodex page. It sits at the root rather than in tools/ because tools/ is
  // gitignored and so does not exist on the Pages runner.
  'gen-pomodex.js',
  // The Japanese prose fragment build.js swaps into /ja/. Source, not a page.
  'ja-prose.html',
].map((s) => s.toLowerCase()));

// Individual files kept in the repo but not published. The full 568-glyph TTF
// is the source tools/subset-fonts.js reads to regenerate the timer subset, so
// it has to stay tracked — but nothing requests it, and copying it would ship
// 84KB nobody downloads on purpose.
const EXCLUDE_FILES = new Set([
  'assets/fonts/PressStart2P-SMBTLL.ttf',
  // Same story: the 2 MB source for the Japanese subset, and the list of the
  // subset's characters that verify() checks the Japanese text against.
  'assets/fonts/DotGothic16-Regular.ttf',
  'assets/fonts/DotGothic16-ja.chars.txt',
].map((s) => s.toLowerCase()));

const JS_OPTS = {
  compress: {
    // Defaults minus the ones that can surprise you in a no-module codebase.
    // unused/dead_code are left on but only ever reach function scope, since
    // toplevel is off.
    toplevel: false,
    drop_console: false,
    passes: 1,
  },
  mangle: {
    toplevel: false,   // cross-file globals must keep their names
  },
  format: { comments: false },
};

const CSS_OPTS = {
  level: 1,            // whitespace + comments only; no cross-rule rewriting
  format: false,
};

const HTML_OPTS = {
  removeComments: true,
  collapseWhitespace: true,
  conservativeCollapse: true,   // collapse to one space, never to nothing
  preserveLineBreaks: false,
  minifyCSS: CSS_OPTS,
  minifyJS: JS_OPTS,
  // Leave every attribute exactly as authored — quote removal and "redundant"
  // attribute stripping are where HTML minifiers usually draw blood.
  removeAttributeQuotes: false,
  removeRedundantAttributes: false,
  removeEmptyAttributes: false,
  useShortDoctype: false,
  sortAttributes: false,
  sortClassName: false,
};

// ── Cache busting ──────────────────────────────────────────
// Every stylesheet and script reference gets ?v=<content hash>, stamped into
// index.html and sw.js at build time.
//
// The service worker serves the page network-first but static assets
// stale-while-revalidate, so the first load after a deploy used to pair the
// NEW index.html with the PREVIOUS stylesheet out of the cache. Usually
// survivable. Not survivable the day the new HTML dropped its Google Fonts
// link because the new CSS self-hosts the face: the cached CSS knew nothing
// about that, no font loaded, and every screen fell back to Courier New.
//
// With a hash in the URL the pairing cannot happen. The page is always fresh,
// so it always names the current hashes; a cached entry under last deploy's
// hash never matches and is simply refetched. It also means CACHE_VERSION
// stops being something a human has to remember to bump.
//
// Fonts are deliberately NOT stamped: index.html preloads them and style.css
// requests them, and the two URLs have to agree or the browser downloads each
// face twice. Their filenames already change when their content does.
const hashable = (rel) => /^[^/]+\.(css|js)$/.test(rel) && rel !== 'sw.js';
const STAMPED  = ['index.html', 'sw.js'];

function contentHash(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
}

function stampRefs(code, rel, hashes, version) {
  let out = code;
  for (const [asset, h] of Object.entries(hashes)) {
    const esc = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (rel === 'index.html') {
      // Anchored on the attribute and the closing quote, so a bare mention of
      // the filename in prose or a comment is never rewritten.
      out = out.replace(new RegExp(`((?:href|src)=")${esc}(")`, 'g'), `$1${asset}?v=${h}$2`);
    } else {
      // sw.js: the quoted entries of PRECACHE_URLS.
      out = out.replace(new RegExp(`(['"])${esc}\\1`, 'g'), `$1${asset}?v=${h}$1`);
    }
  }
  if (rel === 'sw.js') {
    out = out.replace(/const CACHE_VERSION = '[^']*';/,
      `const CACHE_VERSION = '${version}';`);
  }
  return out;
}

const gz = (s) => zlib.gzipSync(Buffer.from(s), { level: 9 }).length;
const kb = (n) => (n / 1024).toFixed(1).padStart(6) + ' KB';

const rows = [];
let rawBefore = 0, rawAfter = 0, gzBefore = 0, gzAfter = 0;

function record(rel, before, after) {
  const b = { raw: Buffer.byteLength(before), gz: gz(before) };
  const a = { raw: Buffer.byteLength(after),  gz: gz(after)  };
  rawBefore += b.raw; rawAfter += a.raw;
  gzBefore  += b.gz;  gzAfter  += a.gz;
  rows.push([rel, b.gz, a.gz]);
}

async function processFile(rel, stamp) {
  const src  = path.join(ROOT, rel);
  const dest = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  const ext = path.extname(rel).toLowerCase();
  const read = () => {
    const raw = fs.readFileSync(src, 'utf8');
    return stamp ? stampRefs(raw, rel, stamp.hashes, stamp.version) : raw;
  };

  if (ext === '.js') {
    const code = read();
    const res  = await minifyJS(code, JS_OPTS);
    if (res.error) throw new Error(`${rel}: ${res.error}`);
    fs.writeFileSync(dest, res.code);
    record(rel, code, res.code);
    return;
  }

  if (ext === '.css') {
    const code = read();
    const res  = new CleanCSS(CSS_OPTS).minify(code);
    if (res.errors.length) throw new Error(`${rel}: ${res.errors.join('; ')}`);
    for (const w of res.warnings) console.warn(`  ! ${rel}: ${w}`);
    fs.writeFileSync(dest, res.styles);
    record(rel, code, res.styles);
    return;
  }

  if (ext === '.html') {
    const code = read();
    const res  = await minifyHTML(code, HTML_OPTS);
    fs.writeFileSync(dest, res);
    record(rel, code, res);
    return;
  }

  fs.copyFileSync(src, dest);            // assets, icons, CNAME, txt, ico
}

// ── sitemap lastmod ────────────────────────────────────────
// <lastmod> was a hand-typed date and had drifted a month behind the site it
// describes. A date that is demonstrably wrong is worse than no date: Google
// stops trusting the field and ignores it everywhere on the sitemap.
//
// Stamped from HEAD's commit date rather than "today", so rebuilding an
// unchanged site does not keep moving the date forward — that churn is the
// other way crawlers learn to distrust it. Falls back to today only when git
// is unavailable (the Pages runner checks out at depth 1, which still carries
// HEAD's own commit date).
function lastCommitDate() {
  try {
    return require('child_process')
      .execSync('git log -1 --format=%cs', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function stampSitemap() {
  const dest = path.join(OUT, 'sitemap.xml');
  if (!fs.existsSync(dest)) return;
  const date = lastCommitDate();
  const xml  = fs.readFileSync(dest, 'utf8')
    .replace(/<lastmod>[^<]*<\/lastmod>/g, `<lastmod>${date}</lastmod>`);
  fs.writeFileSync(dest, xml);
  console.log(`  sitemap.xml lastmod stamped ${date}`);
}

function walk(dir, base = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE.has(entry.name.toLowerCase())) continue;
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
    else if (!EXCLUDE_FILES.has(rel.toLowerCase())) out.push(rel);
  }
  return out;
}

// ── Verification ───────────────────────────────────────────
// A minifier that silently drops something is worse than no minifier at all,
// and there is no test suite here to catch it. These are the two failures
// that would actually take the app down: JS that no longer parses, and an
// element id the scripts look up by name going missing from the HTML.
function verify() {
  const problems = [];

  // ── The testing override must never ship ──
  // app.js can short-circuit session durations to a few seconds for local
  // testing. Every push to main deploys automatically, so leaving it on is
  // one forgotten `git push` away from real visitors finishing a "focus
  // session" in three seconds — and each one still credits a full focusMins
  // to their sessions, minutes and day-by-day history. That is exactly how
  // this project's own stats reached 680 minutes across 35 sessions in an
  // afternoon. A failed build publishes nothing and leaves the previous
  // deploy serving, which is the right outcome here.
  //
  // monsters.js carries the same kind of switch for encounters: TEST_FORCE_MON
  // pins every spawn to one mon, which would leave the roster looking like it
  // has a single creature in it. Same rule, same check.
  const TEST_SWITCHES = [
    ['app.js',      ['TEST_FOCUS_SECS', 'TEST_BREAK_SECS']],
    ['monsters.js', ['TEST_FORCE_MON']],
    ['collection.js', ['TEST_DEMO_FILL']],
    ['game.js',       ['TEST_FORCE_SHINY']],
  ];
  for (const [file, names] of TEST_SWITCHES) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const name of names) {
      // String.raw: in a plain quoted string '\s' is just 's', which compiled to
      // a regex that matched nothing and silently switched this check off.
      const m = src.match(new RegExp(String.raw`const ${name}\s*=\s*([^;]+);`));
      if (m && m[1].trim() !== 'null') {
        problems.push(`${name} (${file}) is ${m[1].trim()}, not null — `
          + 'the testing override is on and must not be deployed');
      }
    }
  }

  for (const rel of walk(OUT)) {
    if (!rel.endsWith('.js')) continue;
    const code = fs.readFileSync(path.join(OUT, rel), 'utf8');
    try { new Function(code); }
    catch (e) { problems.push(`${rel} no longer parses: ${e.message}`); }
  }

  const srcHTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const outHTML = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');

  const ids = new Set();
  for (const rel of walk(ROOT).filter((f) => f.endsWith('.js'))) {
    const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const m of code.matchAll(/getElementById\(\s*['"]([\w-]+)['"]/g)) ids.add(m[1]);
    for (const m of code.matchAll(/querySelector(?:All)?\(\s*['"]#([\w-]+)/g)) ids.add(m[1]);
  }
  for (const id of ids) {
    if (srcHTML.includes(`id="${id}"`) && !outHTML.includes(`id="${id}"`)) {
      problems.push(`#${id} is referenced by a script but vanished from index.html`);
    }
  }

  // Class hooks the scripts toggle at runtime must survive in the stylesheets.
  const cssOut = ['style.css', 'style-v2.css', 'style-v3.css']
    .map((f) => fs.readFileSync(path.join(OUT, f), 'utf8')).join('\n');
  for (const cls of ['active', 'run-focus', 'is-today', 'history-row']) {
    if (!cssOut.includes(cls)) problems.push(`.${cls} missing from the built CSS`);
  }

  // ── Cache busting actually applied ──
  // A missed stamp is invisible until the NEXT deploy, when a returning
  // visitor pairs the fresh page with that asset's stale cached copy. That is
  // the bug this whole mechanism exists to prevent, so assert it landed:
  // every reference carries a hash, and every hash is the current one.
  const assets = walk(ROOT).filter(hashable);
  for (const asset of assets) {
    const real = contentHash(fs.readFileSync(path.join(OUT, asset)));
    const bare = new RegExp('(?:href|src)="' + asset.replace(/[.]/g, '[.]') + '"');
    if (bare.test(outHTML)) {
      problems.push(`${asset} is referenced without a ?v= hash in index.html`);
    }
    if (!outHTML.includes(`${asset}?v=${real}`)) {
      problems.push(`${asset} is not referenced at its current hash (${real}) in index.html`);
    }
  }

  const swOut = fs.readFileSync(path.join(OUT, 'sw.js'), 'utf8');
  const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const srcVersion = (swSrc.match(/CACHE_VERSION = '([^']*)'/) || [])[1];
  const outVersion = (swOut.match(/CACHE_VERSION=["']([^"']*)["']/) || [])[1];
  if (!outVersion) problems.push('CACHE_VERSION missing from the built sw.js');
  else if (outVersion === srcVersion) problems.push('CACHE_VERSION was not stamped by the build');

  // Every precached URL must resolve to a real file, query stripped, and any
  // hashable one must carry its hash or the precache defeats its own purpose.
  const swRefs = swOut.matchAll(/["']([^"']+[.](?:css|js|png|webp|html|webmanifest))(\?v=[a-f0-9]+)?["']/g);
  for (const m of swRefs) {
    if (!fs.existsSync(path.join(OUT, m[1]))) {
      problems.push(`sw.js precaches ${m[1]}, which is not in _site/`);
    }
    if (hashable(m[1]) && !m[2]) problems.push(`sw.js precaches ${m[1]} without a ?v= hash`);
  }

  // ── The generated Pomodex page describes the real roster ──
  // The page is generated from monsters.js on every build, so it cannot be
  // stale — but assert the counts it published match the roster anyway, since
  // those numbers are the ones quoted in llms.txt and the JSON-LD and the
  // whole reason this page is generated is that they had silently drifted.
  const dexOut = path.join(OUT, 'pomodex', 'index.html');
  if (!fs.existsSync(dexOut)) {
    problems.push('pomodex/index.html was not generated into _site/');
  } else {
    const dexHTML = fs.readFileSync(dexOut, 'utf8');
    const { formCount, baseCount } = require('./gen-pomodex.js');
    if (!dexHTML.includes(`All ${formCount} Pomomon forms across ${baseCount} base species`)) {
      problems.push(`the Pomodex page does not state "${formCount} forms across ${baseCount} base species" — the generator and the roster disagree`);
    }
  }

  // ── Japanese: the committed font subset must cover every character used ──
  // A character missing from DotGothic16-ja.woff2 does not error: it silently
  // falls back to a system face and breaks the pixel look on that one glyph.
  try {
    const vm = require('vm');
    const sandbox = { document: { documentElement: { lang: 'en' }, body: null } };
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'strings.js'), 'utf8') + '\n;this.__ja = I18N.ja;', sandbox);
    const used = new Set();
    for (const v of Object.values(sandbox.__ja)) for (const ch of v) used.add(ch);
    const prose = fs.readFileSync(path.join(ROOT, 'ja-prose.html'), 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&');
    for (const ch of prose) used.add(ch);
    const have = new Set(fs.readFileSync(path.join(ROOT, 'assets/fonts/DotGothic16-ja.chars.txt'), 'utf8'));
    const cjk = (ch) => /[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]/.test(ch);
    const missing = [...used].filter((ch) => cjk(ch) && !have.has(ch));
    if (missing.length) {
      problems.push(`Japanese text uses ${missing.length} character(s) missing from DotGothic16-ja.woff2: ${missing.join('')} — run: node tools/subset-ja-font.js`);
    }
  } catch (e) {
    problems.push('Japanese font check could not run: ' + e.message);
  }

  // ── Every sitemap URL must be a page that exists ──
  // A sitemap is a direct instruction to Google to go and fetch these URLs.
  // Pointing it at one that 404s is the fastest way to teach a crawler the
  // file is unreliable, and it is silent — nothing in the app breaks, the
  // pages just quietly stop getting indexed. Cheap to assert here, since the
  // sitemap is about to grow a row per content page.
  const smPath = path.join(OUT, 'sitemap.xml');
  if (fs.existsSync(smPath)) {
    const sm = fs.readFileSync(smPath, 'utf8');
    const locs = [...sm.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
    if (!locs.length) problems.push('sitemap.xml lists no <loc> URLs');
    for (const loc of locs) {
      if (!loc.startsWith(SITE_ORIGIN + '/')) {
        problems.push(`sitemap.xml lists ${loc}, which is not under ${SITE_ORIGIN}`);
        continue;
      }
      const rel = loc.slice(SITE_ORIGIN.length + 1);
      // "" is the homepage; a trailing-slash path is a directory index.
      const target = rel === ''            ? 'index.html'
                   : rel.endsWith('/')     ? rel + 'index.html'
                   : rel.endsWith('.html') ? rel
                   :                         rel + '/index.html';
      if (!fs.existsSync(path.join(OUT, target))) {
        problems.push(`sitemap.xml lists ${loc}, but _site/${target} does not exist`);
      }
    }
    if (!/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(sm)) {
      problems.push('sitemap.xml lastmod was not stamped to a YYYY-MM-DD date');
    }
  }

  return problems;
}

// ── The Japanese page ──────────────────────────────────────
// /ja/ is the app itself, not a separate site: same scripts, same stylesheets,
// same localStorage and IndexedDB (it is the same origin), so a player's
// collection is the same on / and /ja/. It differs by <html lang="ja"> (which
// strings.js reads to translate the UI), the head tags, the prose between the
// PROSE markers, and a <base href="/"> so every relative path in the HTML, the
// CSS-free JS image loads and the service worker registration still resolve
// from the site root. Generated from the stamped source index.html, so the
// ?v= hashes match the English page exactly.
const JA_META = {
  title: 'PomoMons:モンスターをつかまえるポモドーロタイマー(無料・登録不要)',
  description: '集中セッションが終わるたびに、ポモモンがあらわれます。トマトを投げてつかまえて、コレクションを増やそう。無料のポモドーロタイマー。登録不要、オフラインでも使えます。',
  ogTitle: 'PomoMons:集中セッションでモンをつかまえるポモドーロタイマー',
};

async function buildJa(hashes, version) {
  const raw = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  let html = stampRefs(raw, 'index.html', hashes, version);
  // Source lines are wrapped for editing; in English a newline is a space, in
  // Japanese it would show as a gap between two characters. Join them.
  const CJK = '[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]';
  const prose = fs.readFileSync(path.join(ROOT, 'ja-prose.html'), 'utf8')
    .replace(new RegExp(`(${CJK})[ \t]*\n[ \t]*(?=${CJK}|<)`, 'g'), '$1');
  const A = '<!--PROSE-START-->', B = '<!--PROSE-END-->';
  const a = html.indexOf(A), b = html.indexOf(B);
  if (a < 0 || b < a) throw new Error('index.html is missing its PROSE-START / PROSE-END markers');
  html = html.slice(0, a) + prose + html.slice(b + B.length);

  const sub = (re, rep, label) => {
    if (!re.test(html)) throw new Error(`/ja/: could not find ${label} in index.html`);
    html = html.replace(re, rep);
  };
  sub(/<html lang="en">/, '<html lang="ja">', '<html lang>');
  sub(/<title>[\s\S]*?<\/title>/, () => `<title>${JA_META.title}</title>`, '<title>');
  sub(/(<meta name="description" content=")[^"]*(")/, (m, p, q) => p + JA_META.description + q, 'meta description');
  sub(/(<meta property="og:title" content=")[^"]*(")/, (m, p, q) => p + JA_META.ogTitle + q, 'og:title');
  sub(/(<meta property="og:description" content=")[^"]*(")/, (m, p, q) => p + JA_META.description + q, 'og:description');
  sub(/(<meta property="og:url" content=")[^"]*(")/, (m, p, q) => p + SITE_ORIGIN + '/ja/' + q, 'og:url');
  sub(/(<meta property="og:type" content="website">)/, '$1\n  <meta property="og:locale" content="ja_JP">', 'og:type');
  sub(/(<link rel="canonical" href=")[^"]*(")/, (m, p, q) => p + SITE_ORIGIN + '/ja/' + q, 'canonical');
  // The language switch points back at the English page from here.
  sub(/<a href="\/ja\/" lang="ja" hreflang="ja">日本語<\/a>/, '<a href="/" lang="en" hreflang="en">English</a>', 'language link');
  // <base> makes `#about` mean "/#about"; the one in-page link has to be
  // spelled out so it scrolls this page instead of navigating to the English one.
  sub(/href="#about"/, 'href="/ja/#about"', 'scroll cue link');
  sub(/(<meta charset="UTF-8">)/, '$1\n  <base href="/">', 'meta charset');

  const min = await minifyHTML(html, HTML_OPTS);
  const dest = path.join(OUT, 'ja', 'index.html');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, min);
  record('ja/index.html', html, min);
  console.log('  ja/index.html generated');
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const files = walk(ROOT);

  // Pass 1: everything whose own content is not affected by the stamping.
  for (const rel of files) {
    if (!STAMPED.includes(rel)) await processFile(rel);
  }

  // Hash the built output, not the source — the bytes visitors receive are
  // what the URL has to identify.
  const hashes = {};
  for (const rel of files.filter(hashable)) {
    hashes[rel] = contentHash(fs.readFileSync(path.join(OUT, rel)));
  }
  const version = 'b' + contentHash(
    Object.keys(hashes).sort().map((k) => k + hashes[k]).join('|'));

  // Pass 2: the two files that carry the references.
  for (const rel of files.filter((r) => STAMPED.includes(r))) {
    await processFile(rel, { hashes, version });
  }

  // The Pomodex page has no source file — it is derived from monsters.js, so
  // it is built here rather than copied. Minified through the same pipeline as
  // the hand-written pages so it is not the one page shipping raw.
  const dex = require('./gen-pomodex.js');
  const dexDest = path.join(OUT, 'pomodex', 'index.html');
  fs.mkdirSync(path.dirname(dexDest), { recursive: true });
  const dexMin = await minifyHTML(dex.html, HTML_OPTS);
  fs.writeFileSync(dexDest, dexMin);
  record('pomodex/index.html', dex.html, dexMin);
  console.log(`  pomodex/index.html generated — ${dex.formCount} forms across ${dex.baseCount} species`);

  await buildJa(hashes, version);

  stampSitemap();

  rows.sort((a, b) => (b[1] - b[2]) - (a[1] - a[2]));
  console.log('\n  file                      gzipped before   after    saved');
  console.log('  ' + '-'.repeat(58));
  for (const [rel, b, a] of rows) {
    console.log(`  ${rel.padEnd(24)} ${kb(b)} ${kb(a)} ${kb(b - a)}`);
  }
  console.log('  ' + '-'.repeat(58));
  console.log(`  ${'TOTAL'.padEnd(24)} ${kb(gzBefore)} ${kb(gzAfter)} ${kb(gzBefore - gzAfter)}`);
  console.log(`\n  ${files.length} files -> _site/  (${(100 * (gzBefore - gzAfter) / gzBefore).toFixed(0)}% smaller over the wire)\n`);

  const problems = verify();
  if (problems.length) {
    console.error('  VERIFICATION FAILED:');
    for (const p of problems) console.error('   - ' + p);
    process.exit(1);
  }
  console.log('  Verification passed: all scripts parse, no ids or class hooks lost.\n');
})();
