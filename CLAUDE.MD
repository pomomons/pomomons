# PomoMons — Gamified Pomodoro Timer

## What This Is
A browser-based Pomodoro timer with a creature-collecting game layer.
After each focus session, a wild "Pomomon" (food-themed pixel creature) 
appears. Players throw a tomato to catch it and build a collection.

## Tech Stack
- Vanilla HTML5, CSS3, JavaScript — no frameworks, no runtime dependencies
- HTML5 Canvas for Pomomon sprite animations
- localStorage for player state (level, EXP, settings)
- IndexedDB for collection data (30 mon forms across 16 base species; shiny/dark variants)
- Installable PWA (manifest.webmanifest + sw.js) — works offline
- Deployed on GitHub Pages by .github/workflows/deploy.yml on every push to main
  (custom domain pomomons.io via CNAME)

## File Structure
- index.html — the app shell
- style.css — base styles; style-v2.css and style-v3.css layer on top (v3 = the current "field console" skin: forest-photo background, amber/green palette, plate frames, CRT scanlines)
- app.js — timer logic and session flow
- game.js — encounter screen, throw animation, catch logic, all canvas drawing
- monsters.js — Pomomon roster data + makeTypeBadges()
- collection.js — Pokédex screen, active mon selector, IndexedDB
- backup.js — save-code encode/decode for cross-device restore
- audio.js — 8-bit sound effects, fully synthesized via Web Audio API (no audio files)
- signup.js — optional mailing-list card
- 404.html — served by GitHub Pages for unknown paths; self-contained (inline
  CSS) so it needs no stamped asset references
- faq/index.html, pomodoro-technique/index.html — standalone prose pages, no
  app JS, styled by assets/content.css. They exist for search: the app shell
  has ~320 words of UI labels and the word "pomodoro" appears nowhere in its
  body, so it has nothing to rank on by itself.
- gen-pomodex.js — generates the /pomodex/ page from monsters.js at build time
  (see Build & Deploy). Root-level, not tools/, because tools/ is gitignored
  and absent on the Pages runner. In build.js EXCLUDE, so never published.
- assets/content.css — styles for the prose pages only; nothing in the app
  loads it. Deliberately separate from the three app sheets, which exist to
  build a fixed-viewport pixel console and do not suit a page of text.
- assets/sprites/ — PNG sprite sheets
- assets/backgrounds/ — greenbackground.webp / redbackground.webp (v3 background; source PNGs in art-source/backgrounds/)
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

- `TEST_FOCUS_SECS` / `TEST_BREAK_SECS` in app.js short-circuit session
  durations for local testing. build.js REFUSES to build while either is
  non-null, because every push to main deploys automatically and a 3-second
  focus session still credits a full focusMins to sessions, minutes and the
  day-by-day history. Set them, test, set them back to null before committing
  app.js. If a push slips through, the build fails and the previous deploy
  keeps serving.
- Never edit `_site/` — it is regenerated and gitignored.
- **The /pomodex/ page has no source file.** `gen-pomodex.js` derives it from
  the roster in monsters.js and build.js writes it straight into
  `_site/pomodex/index.html`. Add a mon and the public page updates itself on
  the next build; there is nothing to remember to regenerate. This is on
  purpose: llms.txt and the JSON-LD `featureList` both advertised "20 forms
  across 12 base species" for weeks after the roster reached 30 across 16, and
  an AI assistant was found quoting the stale figure back verbatim. If you add
  a roster field the page should show, edit gen-pomodex.js. It asserts the
  Pomodex numbering has no holes and that every sprite sheet is a vertical
  stack of square frames, and throws (failing the build) if not.
- `sitemap.xml` `<lastmod>` is stamped by build.js from HEAD's commit date —
  never type a date in by hand. build.js also asserts every `<loc>` resolves to
  a page in `_site/`, so add the page before adding the URL.
- When adding a standalone page, add it to `sitemap.xml`, link to it from the
  settings menu in index.html, and add it to the `PAGES` list in
  `tools/check-content-pages.js`. A page reachable only from the sitemap gets
  indexed far more reluctantly than one the site actually links to.
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
- `node tools/check-cross-screen.js [_site]` drives each screen's controls and
  asserts the other screens' state is untouched. The app is one page with a
  pile of global `querySelectorAll` calls, so a class reused for its looks
  silently becomes a shared behaviour — scope any selector that binds
  behaviour to the container that owns it (`#mode-dropdown .mode-option`, not
  `.mode-option`). Run it whenever you add a control that borrows another
  component's classes.
- `node tools/check-mymons-sort.js [_site]` seeds an awkward collection
  through Collection.importRecords and drives the real sort control, asserting
  each order, that the choice persists, and that ties are stable. It also
  checks the rendered card count still matches the seed — renderMyMons drops
  any record whose species id is missing from MONS, silently, and the roster
  skips id 2.
- `node tools/check-animation-rate.js [_site]` replaces rAF with a virtual clock
  it can run at 60/30/15fps, plays a real encounter through to the catch and a
  real evolution through to its dismiss button, and asserts both take the same
  amount of TIME at every rate. The timed sequences in game.js are written in
  60fps frames (throw arc 90, shake window 40) and advance off `clock.step(now)`
  from frameClock() — never one frame per rAF callback, which is what made the
  catch run 30s instead of 7.7s on a tab coming back from a long spell hidden.
  Run it if you add or retime a phase. Sound cues are counted too: a cue has to
  fire on the tick that *crosses* its mark, since a time-based clock lands on
  14.7 and 15.3 and never on 15.
- `node tools/check-spawn-levels.js [_site]` samples the real roster at seven
  player levels and asserts the wild-spawn rules: every form can appear, an
  evolution only once the player is within `SPAWN_LEVEL_GRACE` (2) of the level
  it evolves at, base forms are never crowded out, and — the quiet one — that
  every spawn's level sits inside the band that produces the form on screen. A
  caught record stores only a species id and a level, and `getMonStage` derives
  the form from the level, so an unclamped level 50 wild Tomotot is filed as a
  level 50 Tomotot and renders as Strangletti. Nothing errors; the player just
  catches one mon and is given another. Run it after touching `getRandomMon`,
  `spawnableForms`, the level maths in `game.js` `start()`, or any
  `evolutions[].atLevel`.
- `node tools/check-content-pages.js [_site]` renders 404.html and each prose
  page at three widths and asserts: no sideways scroll, no console errors or
  failed requests, one h1, a title/description/canonical, every same-origin
  link resolves to a real file, every JSON-LD block parses, each Pomodex sprite
  actually decodes, and — on /faq/ — that every question in the FAQPage schema
  appears verbatim as a visible h2. That last one is the condition Google
  requires for an FAQ rich result, and the schema and the prose are two copies
  of the same text that can drift apart silently.
- `node tools/check-sw-shell.js [_site]` proves a visit to a content page
  cannot replace the cached offline app shell. `networkFirstPage` used to run
  `cache.put('index.html', ...)` on EVERY navigation, which was harmless on a
  one-page site and wrong the moment /faq/ existed: one visit stored the FAQ as
  the shell, and the next offline launch opened the FAQ with no timer. Note it
  serves `no-store` where check-sw-upgrade.js serves `max-age=600` — with a
  live HTTP cache an offline navigation is answered from it, the service
  worker's fallback never runs, and the test passes no matter what sw.js does.
  It did exactly that while the bug was still present.
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

## The homepage is two things stacked
`index.html` is the app **and** a page of prose below it. The split matters:

- `.app-viewport` (`#top`) wraps the header, the three screens, every overlay
  and the stats strip, and has a **hard `height: 100dvh`**. That is what keeps
  the app exactly one screen tall; `min-height` alone let it measure 814px
  against an 807px viewport and pushed the prose down by the difference. The
  base sheet's `body { height: 100% }` used to do this job.
- The forest photo, the scanlines and the vignette moved from `<body>` onto
  `.app-viewport`. They had to: `--bg-pos` is `center calc(50% - 7vh)` and that
  50% resolves against whatever box paints it, so on a now-taller body the app
  would open on a different crop. The two fixed overlays would also have lain
  across the prose — the vignette is 52% black at the edges. `body::after` from
  the base sheet is switched off in style-v3.css for the same reason.
- `.stats-strip` is `position: absolute`, not fixed, so it scrolls away with
  the app instead of floating over the text.
- `updateStatsReserve()` measures against `.app-viewport`, not
  `window.innerHeight`. Those agreed while the page was one screen tall; now a
  resize fired while the reader is down in the prose would read a strip that is
  above the viewport and reserve space the timer screen does not have.
- `.home-prose` and its footer live **outside** `.app-viewport`. Anything added
  inside it takes height from the timer, because `fitTimerScreen()` scales the
  screen's contents down from `scrollHeight`.
- Prose styles are scoped under `.home-prose`. Note `.home-prose a` is 0-1-1,
  so a single-class rule like `.prose-cta-link` loses to it — that shipped the
  CTA as gold text on a gold slab until a screenshot caught it. Scope new
  element styles under `.home-prose` too.
- `node tools/_diff-head.js` renders the app against HEAD at four viewports and
  diffs every element's geometry. Run it after any layout change here. **Use a
  fresh browser context per version** — it originally shared one, and the
  service worker served HEAD's cached CSS to the new HTML, inventing 147
  differences that existed only in the test.

## Key Rules
- No external libraries in the shipped app unless explicitly approved
  (build-time devDependencies in package.json are separate and already approved)
- All Canvas drawing lives in game.js only
- Desktop-first web layout — no max-width cap on body; stats strip spans full viewport width; main content column uses max-width: 680px centred

## Workflow Rules
- After completing each set of edits and you are ready for the user's next instructions, run the following via Bash to play an audible notification: `powershell -c "[console]::beep(900,200); Start-Sleep -Milliseconds 80; [console]::beep(1200,300)"`
