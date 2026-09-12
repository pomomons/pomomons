# PomoMons — Gamified Pomodoro Timer

## What This Is
A browser-based Pomodoro timer with a creature-collecting game layer.
After each focus session, a wild "Pomomon" (food-themed pixel creature) 
appears. Players throw a tomato to catch it and build a collection.

## Tech Stack
- Vanilla HTML5, CSS3, JavaScript — no frameworks, no runtime dependencies
- HTML5 Canvas for Pomomon sprite animations
- localStorage for player state (level, EXP, settings)
- IndexedDB for collection data (20 mon forms across 12 base species; shiny/dark variants)
- Installable PWA (manifest.webmanifest + sw.js) — works offline
- Deployed on GitHub Pages by .github/workflows/deploy.yml on every push to main
  (custom domain pomomons.io via CNAME)

## File Structure
- index.html — single app shell
- style.css — base styles; style-v2.css and style-v3.css layer on top (v3 = the current "field console" skin: forest-photo background, amber/green palette, plate frames, CRT scanlines)
- app.js — timer logic and session flow
- game.js — encounter screen, throw animation, catch logic, all canvas drawing
- monsters.js — Pomomon roster data + makeTypeBadges()
- collection.js — Pokédex screen, active mon selector, IndexedDB
- backup.js — save-code encode/decode for cross-device restore
- audio.js — 8-bit sound effects, fully synthesized via Web Audio API (no audio files)
- signup.js — optional mailing-list card
- assets/sprites/ — PNG sprite sheets
- assets/backgrounds/ — forest.webp / forest-red.webp (v3 background)
- assets/icons/ — PWA icons
- assets/fonts/ — both pixel faces, self-hosted. PressStart2P-latin.woff2 is
  Google's own latin subset (--font-pixel, the whole UI);
  PressStart2P-SMBTLL-digits.woff2 is the squared-zero timer face cut down to
  the 14 characters the clock can draw (--font-timer). The full 568-glyph
  PressStart2P-SMBTLL.ttf stays tracked as the subsetting source but is
  excluded from _site by build.js — regenerate with tools/subset-fonts.js if
  the timer ever needs more characters.

## Reference Docs (read before working on related features)
- agent_docs/game-mechanics.md — EXP/leveling, catch rules, shiny odds
- agent_docs/monsters.md — full Pomomon roster, rarity tiers
- agent_docs/ui-layout.md — screen layouts, animation states
- agent_docs/email-signups.md — mailing-list backup flow, Brevo/Apps Script setup

## Build & Deploy
Source at the repo root is what you edit, comments and all. `node build.js`
minifies it into `_site/`, and only `_site/` is published — so agent_docs/,
CLAUDE.md and README.md are no longer served publicly. The comments were 64% of
the download before this existed (style-v3.css alone shipped 42KB to deliver 8KB
of CSS).

- Never edit `_site/` — it is regenerated and gitignored.
- Never minify a source file in place.
- build.js stamps `?v=<content hash>` onto every stylesheet and script
  reference in index.html and sw.js, and stamps CACHE_VERSION from those
  hashes. Do NOT bump CACHE_VERSION by hand and do not add query strings
  yourself. This exists because the service worker serves the page
  network-first but assets stale-while-revalidate, so a returning visitor's
  first load used to pair the new index.html with the previous stylesheet —
  which shipped a broken font once. Fonts are deliberately unstamped: the
  preload URL and the @font-face url() must match or each face downloads
  twice.
- `node tools/check-mymons-sort.js [_site]` seeds an awkward collection
  through Collection.importRecords and drives the real sort control, asserting
  each order, that the choice persists, and that ties are stable. It also
  checks the rendered card count still matches the seed — renderMyMons drops
  any record whose species id is missing from MONS, silently, and the roster
  skips id 2.
- `node tools/check-sw-upgrade.js [ref]` is the regression test for that:
  it serves a previous deploy, lets the service worker cache it, swaps in the
  new build, reloads once, and asserts the fonts survived. Run it after any
  change to sw.js, the @font-face rules, or how index.html references assets.
- `node tools/check-build.js` loads the source and built trees side by side in
  Playwright and diffs every element's geometry and computed styles across
  eight screen states (three with a companion seeded, since an empty
  collection skips the whole companion branch), plus asserts the 47 cross-file
  globals survived mangling. Run it before pushing anything that changes CSS
  or JS structure.
- `node tools/check-fonts.js` proves both faces actually load and are applied
  rather than silently falling back to Courier New, and that the timer subset's
  glyph advances still match the original TTF exactly.
- `node tools/measure-companion.js` diffs the floating caption's placement
  against HEAD across five viewports, then reports the animation loop's layout
  cost. The caption's position is cached and recomputed only on invalidation
  (see layoutName() in game.js) — if you add a new input to its placement, mark
  it dirty there or it will not update.
- Terser runs with `mangle.toplevel: false` on purpose: the files talk to each
  other through globals with no module system, so renaming top-level names
  would break them silently. If you add a new cross-file global, add it to the
  API list in tools/check-build.js.

## Key Rules
- No external libraries in the shipped app unless explicitly approved
  (build-time devDependencies in package.json are separate and already approved)
- All Canvas drawing lives in game.js only
- Desktop-first web layout — no max-width cap on body; stats strip spans full viewport width; main content column uses max-width: 680px centred

## Workflow Rules
- After completing each set of edits and you are ready for the user's next instructions, run the following via Bash to play an audible notification: `powershell -c "[console]::beep(900,200); Start-Sleep -Milliseconds 80; [console]::beep(1200,300)"`
