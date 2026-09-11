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

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

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

async function processFile(rel) {
  const src  = path.join(ROOT, rel);
  const dest = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  const ext = path.extname(rel).toLowerCase();

  if (ext === '.js') {
    const code = fs.readFileSync(src, 'utf8');
    const res  = await minifyJS(code, JS_OPTS);
    if (res.error) throw new Error(`${rel}: ${res.error}`);
    fs.writeFileSync(dest, res.code);
    record(rel, code, res.code);
    return;
  }

  if (ext === '.css') {
    const code = fs.readFileSync(src, 'utf8');
    const res  = new CleanCSS(CSS_OPTS).minify(code);
    if (res.errors.length) throw new Error(`${rel}: ${res.errors.join('; ')}`);
    for (const w of res.warnings) console.warn(`  ! ${rel}: ${w}`);
    fs.writeFileSync(dest, res.styles);
    record(rel, code, res.styles);
    return;
  }

  if (ext === '.html') {
    const code = fs.readFileSync(src, 'utf8');
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

  return problems;
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const files = walk(ROOT);
  for (const rel of files) await processFile(rel);

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
