# PomoMons launch plan

**Autostart: DROPPED 2026-10-01 at the user's request. Do not rebuild it.**
This plan previously described an opt-in auto-start toggle as shipped and
verified. It is not in the code — no `pm_autostart`, `#toggle-autostart` or any
`autostart` string exists — and the user has now confirmed they do not want it.
The settings menu ships `#toggle-notify` ("Notify when timer ends", backed by
`pm_notify`) in its place. The rest of the Leak #2 work IS present and
verified: `Notify`, `titleOverride`, `BASE_TITLE`, `getBgTicker`/`startTicker`.

Copied out of Claude Code's local memory store on 2026-09-30 so it lives in the repo
rather than only on one laptop. Treat this file as the source of truth from
now on and update it here as items land.

Working toward a Product Hunt launch for PomoMons (gamified Pomodoro timer,
repo: C:\Users\HP\OneDrive\Documents\pomomons). Plan is tracked as a P0 (must-fix
before launch) / P1 (nice-to-have after) task list, worked through over
several sessions.

**Launch date: Sunday 18 October 2026** — confirmed by the user 2026-09-06
(recommended as the weekend slot with the best odds of the #1 Product of the
Day badge for a consumer/fun app).

**Distribution kit — user asked to be reminded to start this (2026-09-06),
not yet begun.** All prior work is product polish; there is still zero
distribution planning. Scope offered: demo GIF/video, PH gallery
screenshots, PH "coming soon" teaser page (~Oct 11), an engagement group of
30-50 people, migrate the mailing list off Apps Script to Buttondown/Kit
before mailing. PH listing copy + launch-day messages were already drafted
in the 2026-09-06 session (Discord post, mailing-list email w/ subject
options, Show HN / Reddit post, tagline "A Pomodoro timer where focus
sessions catch monsters").

**Done:**
- Backup-code emails now send via Brevo (transactional API) from
  hello@pomomons.io instead of the user's personal Gmail. Verified delivered.
- Mailing-list signup: envelope icon redone as a floppy-disk save icon,
  card redone as a centered popup w/ backdrop, added a Discord link button
  (https://discord.gg/bXnKR8FeG), header icon layout fixed, My Mons/Pomodex
  button-height consistency fixed.
- Discord button icon redrawn to match the pixel-art Clyde in
  ~/Downloads/discord.png (monochrome silhouette, viewBox 25x19).
- Leak #2 (session-end signal): app.js now has a `Notify` helper (asks
  permission on first session end, never on load), a `titleOverride` that
  parks "Break time!" / "Back to work!" on the tab title until the next
  start or a manual mode change. (An opt-in autostart toggle was described here
  too; it never shipped and was dropped 2026-10-01 — see the note at the top.)
- Settings menu: the speaker button in the wordmark row is now a gear
  (`#btn-settings`, reuses the `.audio-shadow`/`.pxb-audio` wrapper so it
  keeps the mobile top-right pin). It opens `#settings-menu` (end of body,
  positioned by app.js like `.mode-dropdown`) holding: sound toggle
  (`#btn-audio`, label reads Sound on/off), Discord link (`#btn-discord`),
  Email updates (`#btn-signup`), and a `#toggle-notify` checkbox ("Notify when
  timer ends"). The old top-left `.header-left-btns` cluster is
  gone; its CSS in style-v3.css is now dead but left in place.
- Settings menu label "Email updates" renamed to "Save". The free
  `#btn-save-code` button (got a save code with no email) was removed; it's
  now labeled RESTORE and only opens the paste-a-code-in half of the modal
  (`backup.js` `open(prefill, restoreOnly)` + `.save-code.restore-only`
  CSS) — email is the only way to get a code, restoring a code doesn't
  require one.
- Committed and pushed to origin/main (b39be65) 2026-09-04. Confirmed
  TEST_FOCUS_SECS/TEST_BREAK_SECS were reset to `null` before the push.
- Leak #3 (background-tab alarm lateness): timerTick() was already
  wall-clock-based (safe against drift), but the driving `setInterval`
  itself gets throttled to ~once/min in a hidden tab, which could delay
  the alarm/notification firing. Fixed by adding a tiny dedicated Worker
  (inline, via Blob URL — `getBgTicker()`/`startTicker()`/`stopTicker()`
  in app.js) running its own 1s interval alongside the main one; workers
  aren't subject to that page-level throttling. Pushed 9561ef1
  2026-09-04. Not yet verified with a real 25-min backgrounded-tab test.
- Mobile audit pass 1 (2026-09-04, pushed 24a9d6d): tested the whole flow
  at 390x844, 360x800, and spot-checked 320x568, using a same-origin
  iframe on a local `python -m http.server` as a true-viewport test
  harness (window resize_window did not actually change the tab's real
  viewport in this environment — it reported success but innerWidth never
  changed — so the iframe trick is the fallback if this comes up again).
  Found and fixed two real layout bugs: the header wordmark's last letter
  ran under the gear button below ~374px wide (style-v3.css, new
  max-width:374px step); My Mons' RESTORE+count wrapped to their own line
  at that width but sat left-pinned instead of centered like the Dex
  screen's matching wrap. Also noticed in passing (not fixed, not
  mobile-specific): `#btn-tab-mymons` in the Dex-screen header has no
  click handler — clicking "MY MONS" while already on the Dex screen does
  nothing; `#btn-to-mymons` is the one that actually works.
- README rewrite (2026-09-04, pushed 7af8e03): replaced the one-line
  placeholder with a real overview — feature list, file structure, how
  to run locally, deploy note (GitHub Pages from main). Mon count stated
  as "12 base species, 20 forms with evolutions" (verified by grepping
  monsters.js for dexNum entries), not the "50+" figure in CLAUDE.md's
  IndexedDB comment, which looks stale/aspirational.
- SHARE button on the catch screen (2026-09-04, pushed 7a87745), for the
  "loops" push (getting people to bring PomoMons into Discord/elsewhere
  themselves): a third button next to NEXT/INFO after a catch. Tries
  `navigator.share` first (native OS share sheet — this is what actually
  lists Discord's mobile app, iMessage, etc.), attaching a PNG snapshot
  of the catch canvas plus a caption + pomomons.io link. No share sheet
  (most desktop browsers) → copies image+caption to the clipboard
  (falls back further to caption-only text if the image copy itself
  fails) so it can be pasted into a Discord message box directly; shows
  a brief "Copied!" line under the buttons. Not yet live-tested in an
  actual browser (only `node -c`/brace-balance checked) — worth a real
  click-through, especially the clipboard-image-paste-into-Discord path
  and the postcatch button row at mobile widths (that screen is still on
  the "rest of the mobile audit" list below, unrelated to this add).
- Catch-screen NEXT button fix (2026-09-04, pushed 9d38d3e): NEXT was
  taller than INFO/SHARE because "NEXT ▶" wrapped onto its own line —
  turned out to reproduce at full desktop width too, not just mobile,
  because .encounter-controls-wrap caps at 560px regardless of window
  size. Fixed with white-space:nowrap + tighter padding as the base
  style (style.css), plus a further mobile-only shrink (style-v3.css,
  <=480px) so all three buttons still fit one row down to 320px.
  Verified in-browser via the iframe test harness at 320/360/390/480 and
  at natural desktop width — this is the first real live-browser check
  of the postcatch/SHARE row (the SHARE-button commit itself was only
  syntax-checked, not visually verified, until this pass).
- SHARE button was actually dead on click, found + fixed (2026-09-04,
  pushed 1a7932d) while doing a real end-to-end catch test (start focus
  session -> encounter -> throw -> catch -> click SHARE for real,
  instead of only inspecting layout). Cause: shareCatch() awaited
  canvas.toBlob() before calling navigator.share()/clipboard — that
  async detour lost the click's user-gesture window, so share() failed
  silently and the clipboard fallback hangs forever with no gesture
  (confirmed directly: navigator.clipboard.writeText() with no live
  gesture neither resolves nor rejects on this Chrome build — it just
  hangs). Fixed by building the PNG synchronously (toDataURL+atob, no
  await) so share()/clipboard are the first async call after the click.
  Verified live: a real click now genuinely opens the native Windows
  share flyout — confirmed by the flyout actually appearing on-screen
  (invisible to and un-clickable by browser automation, closed it with
  Escape both times to avoid leaving the user's real Chrome stuck).
  Lesson for future testing here: a layout/CSS check with hidden-attr
  toggles is not enough for anything gesture-gated (share, clipboard,
  fullscreen, etc.) — has to be a real click through the real flow.
- Mobile audit finished (2026-09-04): walked the throw/catch flow for
  real (start focus session -> encounter -> THROW -> catch -> NEXT/
  SHARE/INFO, all by real click) plus the signup card and the RESTORE
  save-code modal, at 390 and 360px. All fine as-is, no fixes needed:
  THROW!/RUN AWAY fit on one line and the button disables/animation
  read fine mid-throw; the signup card's consent-checkbox text looked
  like it was clipped at the card's bottom edge but measuring
  scrollHeight vs clientHeight confirmed it's the full text with ~24px
  of clear padding below it, not a bug. The mobile audit from the
  launch plan is now fully done.
- SHARE card redesign (2026-09-04, pushed 5030dd9): the shared image was
  a bare grab of the live encounter canvas — transparent background,
  just the mon + platform, no name/level/branding, read as a random
  stock cutout once posted anywhere (user's own words: "doesn't look
  that cool"). Replaced with `buildShareCanvas()`, a proper 900x1125
  card: the app's own forest backdrop (red variant for a focus-session
  catch), wordmark, LV + SHINY/DARK badges, mon name, the mon on its
  usual ground platform (reuses MonSprite.drawOnCtx/sizeScale so shiny
  hue-rotate/dark filter/sparkles all match exactly), "WAS CAUGHT!",
  pomomons.io footer. Has to stay fully synchronous like the rest of
  shareCatch() (see the 1a7932d entry above) — both background jpgs are
  now preloaded alongside the ground sprite so that holds. Verified by
  rendering the card directly for a normal/shiny/dark catch, the red
  backdrop, and the roster's longest name (Guacamonger) — all clean, no
  overflow. Environment note: this session's test tab repeatedly had
  its rAF loop stall (throw/catch animation frozen indefinitely) when
  not the OS-focused window — unrelated to app code, worked around by
  calling the drawing function directly / forcing button state instead
  of waiting on the animation. Mention this to the user if a future
  session hits the same stall, so it isn't mistaken for a real bug.
- Background load speed-up (2026-09-05, pushed 64374f4): user reported the
  forest backdrop sometimes appearing late. Two fixes: converted
  forest.jpg/forest-red.jpg to WebP (378KB->29KB, 442KB->39KB — flat pixel
  art compresses ~92%, verified visually identical with a crop compare),
  updating refs in style-v3.css and game.js's share-card; and added
  `<link rel="preload" as="image">` for both in index.html <head> so they
  fetch on load instead of being discovered mid-render (the red variant
  previously didn't load until the first focus session). Same commit also
  halved the three gain layers in SFX.shake() (audio.js). Not yet
  live-verified in a browser — worth confirming the WebP renders right.
- Batch pushed e4f9894 (2026-09-05), all not yet browser-verified:
  * SHARE desktop preview: on browsers with no navigator.share, SHARE now
    opens #share-preview (blender-confirm shell) showing buildShareCanvas()'s
    card with COPY / SAVE / CLOSE — each button its own gesture so
    clipboard.write() keeps working. Mobile still goes straight to
    navigator.share. Extracted copyShareToClipboard + canvasToPngBlob in
    game.js. Worth a real click-through (gesture/clipboard path has broken
    here before — see the 1a7932d note above).
  * Backup prompt (signup.js) less pushy: first offer at 5 catches / 6
    sessions (was 2/3), re-ask gap 30d (was 14), still MAX_PROMPTS 3.
    Catching a dark/shiny qualifies it on its own — noteRareCatch() sets
    pm_email_rare, fired from Collection.addCaught, cleared when shown.
  * Floating mon name clearance for medium/large mons: companion caption
    (game.js positionMonName-equivalent block ~L565) only floors under the
    LV/XP row when that row actually overlaps the sprite column (it doesn't
    on desktop — .companion-meta sits far left); base gap 0.10->0.14.
    Encounter caption gap 7%->9%.
  * My Mons: RESTORE moved out of the header to a centered .mymons-restore
    row at the foot of the scroll area (margin-top:auto parks it at the
    bottom). index.html + style-v3.css.
- PWA / installable (2026-09-06, NOT yet committed or browser-verified): added
  `manifest.webmanifest` + `sw.js` at repo root, `assets/icons/` (icon-192,
  icon-512, icon-maskable-512, apple-touch-icon — all a nearest-neighbour
  upscale of the 32px Tomato sprite on #228674). index.html head got the
  manifest link + apple-mobile-web-app tags; a deferred `navigator
  .serviceWorker.register('sw.js')` sits after the GoatCounter script.
  SW strategy: network-first for navigations (never traps on a stale
  version), stale-while-revalidate for same-origin assets, cache-first for
  Google Fonts, signup endpoint + GoatCounter left alone. Shell is
  precached (HTML/CSS/JS + backgrounds + Tomato/Ground); mon sprites cache
  on first view. Bump CACHE_VERSION in sw.js on any deploy touching a
  precached file. Verified locally over http.server: manifest valid +
  served as application/manifest+json, all 18 precache URLs 200, sw.js
  passes `node -c`. Still needs a real Chrome check: DevTools > Application
  > Manifest clean, "Install PomoMons" prompt appears, offline reload works.

**Still open (P0):**
- Google housekeeping (orphan Apps Script project + its spreadsheet, rename
  the live project, delete the `pomomons-test-…`/`brevo-test`/`final-e2e-test`
  rows from the Signups sheet) — DONE by the user 2026-09-06.
- Leak #2 follow-up: PARTIALLY verified 2026-09-06 on a local 12s/6s test
  build driven via claude-in-chrome. Confirmed: `Notify` object + `titleOverride`
  + `getBgTicker`/`startTicker` all present and wired; title shows the countdown
  ("00:12 — PomoMons") during a run; the settings-menu toggle row is 295px in a
  299px menu with no overflow / no text clip, menu is only 173px tall anchored
  near the top so it won't overflow phone heights either. (That session also
  reported verifying an autostart toggle; no such code exists — dropped
  2026-10-01.) NOT verified (automation env freezes
  a non-OS-focused tab — the 12s session never completed, timer stuck at 00:12
  ~30s later): the actual end-of-session transition — title flipping to
  "Break time! — PomoMons" and the OS notification firing. Needs a human at the keyboard; see the manual test steps
  handed over in that session.
- Leak #3 follow-up: still NOT verifiable here for the same reason (the
  harness suspends the page + its Worker when the tab isn't OS-focused, which
  is exactly the backgrounded-tab condition under test). Needs a real Chrome:
  start a focus session, switch to another app/tab for the full duration,
  confirm the alarm/notification fires on time (±a couple seconds), not late.
- Make it installable (manifest.webmanifest + service worker) — DONE, pushed
  cd01522 2026-09-06, and verified live in Chrome: SW registered + activated +
  controlling the page, caches pomomons-precache-v1 (19 files) +
  pomomons-runtime-v1 populated, manifest + all 4 icons serve 200, and on a
  reload every asset incl. the HTML doc came from cache (transferSize 0) so a
  no-network reload works. No console errors, no visual regression. Only bit
  not machine-checked: the literal omnibox "Install" button (not visible to
  automation) — all of Chrome's criteria for it pass though.
- Mobile audit is done except the blender/smoothie flow (already
  `display:none`-hidden on touch per existing CSS — worth confirming
  that's still the intended call, but low priority).
- Fix `#btn-tab-mymons` having no click handler — DONE, pushed 0fc10a9
  2026-09-06. Turned out `#btn-tab-dex` had the same gap; both are the gold
  already-active tab in their collection header. Wired each to
  `showScreen()` for its own screen (harmless no-op) + added
  `aria-current="page"`. The cross-nav buttons (`#btn-to-dex`/`#btn-to-mymons`)
  were always fine.
- WebP backgrounds (from 64374f4) — VERIFIED 2026-09-06: `body`
  background-image resolves to `forest.webp`, both webp files serve 200 and
  decode, and the live pomomons.io screenshot shows the forest bg rendering
  correctly. Done.
- Desktop SHARE preview (#share-preview from e4f9894) — still NOT
  browser-verified; the automation env freezes on the catch animation so the
  catch→SHARE→preview→COPY/SAVE path couldn't be walked. Needs a real catch
  in Chrome.

**UI button spacing/padding audit (2026-09-06, static CSS pass, not yet fixed):**
- `#btn-spawn-info-close` ("GOT IT!" in the `?` spawn-rates modal), `#btn-evo-dismiss`
  ("AWESOME!" in the evolution overlay) and `.signup-join` ("SEND") are bare
  `.btn-primary` with NO `.pxb` wrapper — so they keep style.css's old
  `inset 0 0 0 6px #000` ring + 14px gradient bands and the base `.btn`
  `12px 28px` padding, missing the V3 flat-slab look + `2px 5px 5px 2px`
  cast-shadow frame every other primary button has. Fix: wrap the first two in
  `<div class="pxb">`; SEND needs the flat box-shadow applied directly (wrapping
  it would disturb the `.signup-fields` flex row).
- Mobile (<480px): `← BACK` in the collection header stays `12px 20px` / 12px
  font while `.collection-tab` + `.btn-save-code` shrink to `8px 12px` / 10px in
  the `@media (max-width:479px)` block — BACK renders visibly chunkier than the
  tabs beside it. Fix: add `.pxb-back .btn { padding: 8px 12px; font-size: 10px }`
  to that query.
- `#btn-flee` (RUN AWAY) is `padding: 16px 24px` vs `.encounter-controls .btn`
  `16px 16px` (style.css base only — the short-screen tiers already equalise
  them). Outer size matches via equal flex, only the label's side breathing room
  differs. Fix: `16px 16px` on `#btn-flee` too.
- Minor/latent: POMODEX vertical padding 10px vs FOCUS/RESET/START 12px (equalised
  in practice by the shared `min-height: clamp(42px,6vh,60px)`); `.btn-adjust`
  asymmetric `8px 12px` on a 40x40 square (min-size governs); `.settings-row`
  `12px 14px` vs `.mode-option` `12px 8px` (separate menus).

**2026-09-06 session — all shipped in `30d72cd` (pushed to origin/main), plus
`35fee94` (tomotot blush).** One commit covering: SEO foundation (bucket 1),
the UI button-spacing audit fixes, LV/help alignment + START/POMODEX bottom
gap, encounter-controls dead space, rare-mon encounter sounds, ~360 lines of
dead CSS removed, the audio.js music engine removed, orphan NewMap.png
deleted, favicon set, prefers-reduced-motion, doc corrections, sw.js
CACHE_VERSION v2. `TEST_FOCUS_SECS`/`TEST_BREAK_SECS` confirmed back to `null`
in the committed app.js. Cleanup menu items 1-8 all done; only the optional
3-stylesheet flatten remains (advised: post-launch, dedicated task only).

**SEO + AI-discoverability plan (started 2026-09-06):** user wants organic
traffic from Google AND from AI assistants (ChatGPT etc.). Full plan was split
into 4 buckets: (1) me / no UI impact, (2) me / UI impact, (3) user / UI
impact, (4) user / no UI impact. Offered to save the full plan as
`agent_docs/seo-plan.md` — do that if revisited.
- **Bucket 1 DONE 2026-09-06 (uncommitted):** `<title>` → "PomoMons —
  Gamified Pomodoro Timer (Free, No Sign-Up)"; meta description rewritten;
  added `<link rel=canonical href=https://pomomons.io/>` + `<meta name=robots
  content="index, follow, max-image-preview:large">`; OG/Twitter updated
  (added og:site_name, og:image:alt, "Pomodoro timer" now in the titles);
  JSON-LD `WebApplication` block in <head> (FAQPage schema deliberately NOT
  added yet — Google needs the Q&A visible on-page, so it waits for the
  bucket-2 on-page FAQ). Header wordmark `<div class="logo">` → `<h1
  class="logo">` (only one h1 on the page; encounter-overlay wordmark stays a
  div); `h1.logo{font-size:inherit;font-weight:inherit}` added to style.css —
  verified visually identical (16px/400 computed, logo-row rect unchanged, no
  h-scroll). app.js: `renderTime()` idle branch was hardcoding
  `document.title='PomoMons'` on load, clobbering the SEO title for JS-
  rendering crawlers — now captures `const BASE_TITLE = document.title` at
  module load and restores that when idle (running / break titles unchanged).
  New root files: `robots.txt` (allow all + explicit GPTBot/ClaudeBot/
  PerplexityBot/Google-Extended/CCBot/etc. + Sitemap line), `sitemap.xml`
  (homepage only for now), `llms.txt` (llmstxt.org-style summary).
- **Bucket 1 NOT done:** the standalone content pages (B1-B6:
  /pomodoro-technique, /25-minute-timer etc., /pomodex, /blog + posts,
  comparison page, /changelog) — deferred as the next chunk; they need a
  shared page template + a content/voice review. README rewrite also pending.

**SEO audit + first content pages (2026-10-03):** full audit run. Finding: the
technical layer was already in good shape (title/description/canonical/OG/
JSON-LD/robots/llms.txt all correct, page weight fine, no CWV problem) and the
content layer was the entire gap — one URL, ~320 words of body text, almost all
uppercase UI labels, and the word "pomodoro" appearing **zero** times in the
body. Competitor pomofox.com runs ~1,100 words on its homepage plus ~40
subpages. Shipped in response:

- **GitHub repo metadata.** The repo, not pomomons.io, was the #1 result for
  the brand name, and it had no description, no homepage URL and no topics — so
  the one page ranking for "pomomons" did not link to the site. All three set
  via `gh repo edit` (14 topics).
- **Stale facts corrected.** llms.txt and the JSON-LD `featureList` both said
  "20 forms across 12 base species"; the roster is 30 across 16. A web search
  was observed quoting the stale numbers back verbatim, so this was actively
  misinforming AI assistants. llms.txt also gained the long-break rule, the
  real shiny/dark odds (0.2% / ~1%), the five types, blending and companions.
- **Three standalone pages**, styled by `assets/content.css`, linked from the
  settings menu and listed in sitemap.xml: `/faq/` (12 Q&A + FAQPage schema —
  the schema bucket 1 deliberately held back until the Q&A was visible),
  `/pomodoro-technique/` (~1,100 words, Article + HowTo schema), and
  `/pomodex/` (every mon, generated from monsters.js).
- **`404.html`.** GitHub Pages was serving its own generic 404 with no route
  back to the app.
- **Build hardening:** sitemap `<lastmod>` stamped from HEAD's commit date
  (it had drifted a month behind); every sitemap `<loc>` asserted to resolve to
  a real page in `_site/`; the Pomodex page generated at build time so it
  cannot go stale.
- **sw.js bug found and fixed.** `networkFirstPage` ran
  `cache.put('index.html', ...)` on every navigation, so one visit to a content
  page overwrote the offline app shell — the next offline launch opened that
  page instead of the timer. Only the shell's own path writes the shell now;
  content pages cache under their own URL. Also added a `fresh.ok` guard, since
  a 404/5xx from the host used to become the permanent offline shell. Covered
  by `tools/check-sw-shell.js`, which was confirmed to fail against the old
  code.
- **Deliberately NOT done — prose on the homepage itself.** This is the single
  highest-value item left and it is the one that needs supervision. `body` is
  `min-height:100dvh` with `.screen{flex:1;overflow-y:auto}`, the stats strip is
  `position:fixed`, and `fitTimerScreen()` scales the whole timer screen down
  from `scrollHeight` — so content added inside `#screen-timer` shrinks the
  timer, and content added after it needs the header + screens + strip wrapped
  in a `.app-shell` of its own. That is a structural change to the layout the
  geometry test exists to protect, across ~12 height/orientation media queries.
  Do it as a dedicated task with eyes on the result, not bundled into other
  work.
- **Still user-side:** Google Search Console + Bing verification (no
  `google-site-verification` tag exists yet — paste the string and it goes in),
  a GoatCounter traffic baseline before measuring any of this, keyword-volume
  sanity check in Keyword Planner before building the `/N-minute-timer` pages,
  and the backlink/distribution push (Product Hunt, itch.io, AlternativeTo,
  Reddit — all need a human account and a human posting).
- **Two repos to commit:** the three new checkers live in `tools/`, which is
  gitignored here and has its own git repo. `gen-pomodex.js` is at the root
  precisely because tools/ does not exist on the Pages runner.

**TRAFFIC BASELINE — 153 visitors in the 30 days to 2026-10-03** (GoatCounter,
specialaccount11.goatcounter.com). Roughly 5/day. Recorded the day the three
content pages went live and Search Console was first verified, so it is the
before-figure for every SEO change in this section. Compare against it at
2026-11-03 (one month) and 2027-01-03 (three months) rather than reading the
daily numbers, which are too small to mean anything individually.

Deployed and verified live 2026-10-03: Search Console verification tag
(property `https://pomomons.io/`, URL-prefix type), /faq/, /pomodoro-technique/,
/pomodex/, 404.html, the sw.js shell fix and the corrected llms.txt counts.
- **Deploy note:** index.html + style.css + app.js are all in sw.js PRECACHE,
  so bump `CACHE_VERSION` 'v1'→'v2' in sw.js in the commit that ships this or
  returning visitors keep the stale shell.

**Cleanup/polish pass (2026-09-06, uncommitted) — while user does SEO/distribution:**
- **Dead CSS removed (~360 lines)**: `.btn-dex`/`.pxb-dex`, `.session-tabs`/`.tab`,
  `.big-box`, `.timer-display--bare`, `.collection-btns`, `.btn-collection-items`,
  `.screen-title`, `.stats-top`/`.stats-bottom` (v3 rebuilt the strip around
  `.stats-row`), `.btn-map-icon`/`#map-icon-canvas`/`.has-reward` (no map screen),
  `.tag`/`.tag-shiny`/`.tag-dark` (encounter now shows shiny/dark in the rarity
  slot, `#encounter-tags` only holds makeTypeBadges output), `.banner-sub`,
  the whole removed progress/rewards screen (`#screen-progress`, `.progress-*`,
  `.btn-claim`), `.controls-wrap`, `.pxb-panel.timer-panel`, and the
  folded-into-settings-menu cluster in v3 (`.header-left-btns`, `.pxb-discord`,
  `.discord-shadow`, standalone `.btn-discord`/`.btn-signup`/`.pxb-signup` rules
  + their max-width:820px block). Verified: dead-selector scan clean (only
  false positives left = `type-*` built by makeTypeBadges, `is-ok/is-err` built
  as `'is-'+kind` in signup.js), braces balanced, no empty media queries, and a
  fresh-CSS browser reload at 2400px showed layout unchanged + all removed rules
  gone + all kept rules intact.
- **`is-joined` bug fixed**: signup.js adds `.is-joined` to `#btn-signup`, but
  the CSS was `.btn-signup.is-joined` and the element's class is
  `settings-row signup-shadow` (no `btn-signup`), so the "already subscribed"
  gold state never showed. Changed selector to `#btn-signup.is-joined`.
  (`.signup-shadow` class kept on the element — signup.js `.closest()` uses it.)
- **Docs corrected**: CLAUDE.md ("50+ mons"→20 forms/12 species; removed the
  "assets/audio/ — .ogg files" line, folder was empty and deleted; added v2/v3,
  backup.js, signup.js, PWA); README (audio is synthesized/no files; asset
  dirs; added PWA bullet); agent_docs/ui-layout.md refreshed for style-v3.css
  (was only aware of v2) — gear/settings menu vs the old "mute button",
  forest-photo background, amber/green palette, the new clip tokens, NEXT/INFO/
  SHARE post-catch row, the `.mymons-scroll` clip mechanism.
- **Cleanup items 4-7 done 2026-09-06 (uncommitted):**
  - **[4] Orphan-asset sweep**: full `assets/` scan — only 1 orphan,
    `assets/sprites/Map/NewMap.png` (map screen never shipped; its `.btn-map-icon`
    CSS was removed in item 1). `git rm`'d it + removed the empty `Map/` dir.
    All other 30 assets referenced by full path — repo is clean.
  - **[5] prefers-reduced-motion**: added a global block at the top of style.css
    (`*, *::before, *::after { animation-duration: .01ms !important;
    animation-iteration-count: 1 !important; transition-duration: .01ms
    !important; scroll-behavior: auto !important }`) — safe because every
    entrance anim uses `forwards` (snaps to end state) and every flash has no
    `forwards` (snaps to resting). Plus a `.blend-result-flash` override so the
    "SMOOTHIE OBTAINED!" toast still shows statically (its anim fades both in
    AND out, so zeroing duration alone would hide it). Canvas sprite bob is
    rAF-driven in game.js — NOT covered by a CSS pass (still moves).
  - **[6] HTML validation**: 146 IDs all unique, all 7 `<img>` have alt, no
    nested `<button>`/`<a>`, no block elements in `<p>`, exactly one `<h1>`,
    tags balanced. Clean — no fixes needed.
  - **[7] SW precache audit**: all 19 `PRECACHE_URLS` exist, all 7 index.html
    `<script>` tags covered, nothing load-critical missing. Bumped
    `CACHE_VERSION` 'v1'→'v2' in sw.js (this session touched index.html + all
    3 CSS + app.js, all precached) — so the earlier "bump before deploy" note
    is now handled.
  - **Bonus**: removed dead `@keyframes enc-flash` (0 refs — the flash
    transition is done with inline styles + setTimeout in runFlashTransition).
- **Dead `music` engine removed 2026-09-06 (uncommitted)**: deleted the whole
  encounter-music module from audio.js (355→244 lines) — the looping chiptune
  loop that was never started (`music.start()` only ever in a commented-out
  line). Also removed the 3 dead `SFX.music.stop()` / commented `.start()`
  call sites in game.js and dropped `music` from `SFX`'s public API. No
  behaviour change (there was never any music).
- **`assets/sprites/Tomotot/tomotot.png` committed** 2026-09-06 as `35fee94`
  on main (NOT pushed) — user confirmed the ~10px cheek-blush tweak was
  intentional. Committed alone; the rest of the session's work stays
  uncommitted.
- **Item 8 (favicon) DONE 2026-09-06 (uncommitted)**: old `<link rel=icon>`
  pointed straight at the 32px `Tomato.png` sprite frame. Generated a
  tight-cropped tomato on the brand teal at proper sizes — `favicon.ico`
  (16/32/48 multi-res) at repo root + `assets/icons/favicon-32.png` /
  `favicon-16.png`. index.html head now has `favicon.ico sizes="any"` +
  32/16 PNG links. Not added to sw.js PRECACHE (not load-critical; runtime
  SWR caches them). Verified all serve 200, no 404s, tab title also confirmed
  showing the new SEO `<title>`.
- Cleanup menu items 1-8 are all done. Only the "bigger, if you want to
  invest" item remains: flatten style.css/-v2/-v3 into one sheet (advised
  against as casual work — deliberate refactor only).
- Before any commit of the session's main pile: revert `TEST_FOCUS_SECS=5` in
  app.js to `null` (user still testing as of last check).

**Distribution kit — STARTED 2026-09-07.** First piece done: a 6-week organic
short-form (TikTok/IG Reels/YT Shorts) content plan, published as an artifact:
https://claude.ai/code/artifact/d67281d7-c46e-4e12-8e1f-c81df1a7606d
Core thesis: PomoMons' catch/shiny-reveal animations ARE the content, so it's
screen-recordings only, faceless, phone-native capture of the installed PWA,
edited in VN (not CapCut — 2025 price hike + content-rights ToS change).
Four pillars (The Drop / The Loop / The POV / The Run), 1 post/day, batch
weekly, measure ONLY 3-second retention + link clicks. Key tactic: post one
clip 5× with 5 different hooks to isolate what the hook structure should be.
Five decisions left open for the user in §08 (face vs faceless, brand vs
founder account, 1 vs 2 posts/day, seed creators or not, which pillar to
over-index on). Honest framing given: Finch's real engine was paid+UGC, so the
realistic 6-week win is a reusable clip library, not a viral break.
Still not started from the kit: demo GIF/video, PH gallery screenshots, PH
"coming soon" page (~Oct 11), engagement group of 30-50, mailing-list
migration off Apps Script.

**Repo state 2026-09-07:** clean, `main` == `origin/main` at `7a80ec4`
(transparent favicon). `30d72cd` before it. A "mon level appended to the name"
feature was built and then removed at the user's request — don't re-suggest it.

**Launch-day checklist (added 2026-10-01):**
- **Export the Signups sheet to CSV once signups start arriving.** The list is
  empty today, so there is nothing to lose yet — which is exactly why this is
  easy to forget. Those addresses are the only data in the project that cannot
  be recreated from git, and they will exist in one Google account only. See
  `agent_docs/accounts.md` §3.
- Watch the Brevo cap on launch day: free tier is **300 emails/day**. Past it
  the send fails, the signup is still recorded, and that person never gets a
  backup code. A Product Hunt spike is the one realistic way to hit that.

**Open (P1):**
- Streaks / completion count.
- More mons past 21.

**Why this is saved:** the plan itself was only ever discussed in chat, never
written to a file in the repo — asked directly (2026-09-04) whether it would
survive a `/clear`, and it would not have without this.

**How to apply:** at the start of a PomoMons session, check this file for
what's still open before assuming a fresh task. Update the done/open lists as
items are finished or new ones come up — don't let this file go stale.
