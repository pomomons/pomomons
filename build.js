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

// Everything else in the repo is source, tooling or documentation and has no
// business on the live site. agent_docs/ and CLAUDE.md were being served
// publicly before this build existed.
// Compared case-insensitively: the repo tracks CLAUDE.MD, Windows reports it
// as CLAUDE.md, and the Linux runner that actually builds the site would
// otherwise publish it.
const EXCLUDE = new Set([
  '_site', 'node_modules', '.git', '.claude', '.github', 'tools',
  'agent_docs', 'build.js', 'package.json', 'package-lock.json',
  'claude.md', 'readme.md', '.gitignore',
].map((s) => s.toLowerCase()));

// Individual files kept in the repo but not published. The full 568-glyph TTF
// is the source tools/subset-fonts.js reads to regenerate the timer subset, so
// it has to stay tracked — but nothing requests it, and copying it would ship
// 84KB nobody downloads on purpose.
const EXCLUDE_FILES = new Set([
  'assets/fonts/PressStart2P-SMBTLL.ttf',
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

  return problems;
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
