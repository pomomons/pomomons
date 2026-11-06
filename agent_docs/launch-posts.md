# Launch posts — drafts for the owner to review and post

Written 2026-10-03, alongside the SEO work logged in `launch-plan.md`.

**These are drafts for a human to post, not copy to automate.** Every platform
below either requires a real account with history or actively bans accounts
that look automated. The point of the whole exercise is links from other sites
pointing at pomomons.io, because the site currently has almost none and that is
the main thing holding back the new content pages.

Post order matters a little: do AlternativeTo and itch.io first (quiet, no
timing pressure), then Product Hunt (one shot, pick the day), then Reddit
(highest risk, needs the most care).

---

## 1. AlternativeTo — DONE 2026-10-09, listing is live

A directory listing rather than a post. No timing pressure, no karma
requirement, and the link is permanent. alternativeto.net, "Add application".

**Name:** PomoMons

**Tagline:** A Pomodoro timer that's also a creature collector.

**Description:**

> PomoMons is a free Pomodoro timer with a monster-catching game attached.
> Finish a focus session and a wild food-themed pixel mon appears — throw a
> tomato, catch it, and it joins your Pomodex. There are 30 forms across 16
> base species, with evolutions and rare shiny and dark variants.
>
> It runs in the browser with no account and no download, works offline once
> loaded, and can be installed to your home screen or desktop. Sessions default
> to 30 minutes with 5-minute short breaks and a 15-minute long break every
> fourth session; focus is adjustable from 20 to 90 minutes and breaks from 1 to
> 90. Your collection is stored in your own browser, and an optional emailed
> save code moves it between devices. No ads, no tracking cookies, no paid tier.

> **Two wording decisions, deliberate.** "monster-catching" stays in the first
> line because that is the phrase people search and it matches the live meta
> description; the creatures themselves are "mons" everywhere after it.
>
> And the durations are stated outright rather than as "adjustable from the
> classic 25/5/15", which is what this draft said until 2026-10-04. The default
> is **30**, not 25. That exact error shipped to the live FAQ and its structured
> data once already. Any copy quoting a session length must be checked against
> `focusMins` in app.js, not against what a Pomodoro timer is assumed to do.

**List as an alternative to:** Focus Friend, Forest, Study Bunny, Flora, Focus
Plant, Focumon, Pomofocus, Tomato Timer, Focus To-Do

> **Put Focus Friend first and do not skip this field.** It is the highest-value
> ten minutes in this entire document. Focus Friend is Google Play's App of the
> Year and the #1 focus app in America, it has no web version, and its
> AlternativeTo page lists **60 alternatives of which not one is a
> browser-based creature collector** — they are nearly all app-blockers.
> The whole cute-companion category (Forest, Flora, Study Bunny, Focus Plant,
> Finch) is phone-only. These pages already rank and already collect people
> actively looking to switch, and the most on-point answer is missing from all
> of them.

**Tags.** Take whatever the field autocompletes rather than inventing a
spelling — a tag nobody else uses is a tag nobody browses. In priority order,
because the first few do nearly all the work:

> *Core:* `pomodoro` · `pomodoro-timer` · `productivity` · `timer` ·
> `time-management`
> *Why someone picks this one:* `gamification` · `pixel-art` · `study-timer` ·
> `focus`
> *Filters people actually use:* `pwa` · `offline` · `no-registration` ·
> `free` · `privacy-friendly` · `web-based` · `no-ads` · `cross-platform`

Do **not** add: `open-source` (there is no licence — see below), `dark-mode`
(does not exist), `task-management` / `todo` (no task list), `time-tracking`
(implies billable logging), `self-hosted`, or any blocker tag.

**Directory feature checkboxes, adjudicated 2026-10-04** against the code, not
from memory. Directories offer a long list and most of it does not apply:

| Offered | Verdict | Why |
|---|---|---|
| Works offline | **yes** | Service worker + PWA; the three core JS files make no `fetch`/XHR calls at all |
| Portable | **yes** | No install, runs from a URL, save code moves the data between devices |
| Privacy focused | **yes** | No account, no cookies anywhere, data stays local, cookieless analytics |
| Lightweight | **yes** | 237 KB of HTML+CSS+JS; 860 KB for the whole site including sprites and both fonts |
| Encrypted backup | **no** | The save code is `PMZ1.<base64url>.<check>` — gzip, base64url, then an FNV-1a hash that `backup.js` itself describes as "enough to catch damage". A corruption check, not a cipher; anyone holding a code can decode it in a console |
| E2E encryption | **no** | Nothing is encrypted at any point, and the code is emailed through Brevo in plain text. The most damaging claim on this list if made |
| Cloud sync | **no** | The code is manual copy-paste or email. No sync and no server-side store, on purpose: no account means no database of anyone's data to leak |
| Calendar view | **no** | The history modal renders `history-list`, a plain list of days. No month grid |
| Distraction free | **no**, and deliberately | A judgement call rather than a code fact. In this category it means a bare minimal timer, and PomoMons is the opposite by design: catch animation, sparkles, sound, a reward loop |

That last row is the strategic one. The apps on the Focus Friend alternative
pages are mostly blockers selling distraction-free, so borrowing their language
enters a comparison PomoMons loses on its own terms. `gamification` and
`pixel-art` are where it wins, because nothing else on that page has either.

**Source code / licence.** The repo is public with **no licence file**, which
GitHub reports as `license: none declared` and which legally means all rights
reserved — visible source is not open source. Answer **Source Available** and
`No licence / All rights reserved`. That is the reversible direction: adding an
open-source licence later is easy, withdrawing one is not possible. If the
open-source audience is ever wanted — several `awesome-*` lists require an OSI
licence, and AlternativeTo has an open-source filter — the standard move for a
project like this is MIT for the code with the sprite art explicitly reserved,
since the client-side source is already served to every visitor anyway and the
artwork is the part that is actually defensible.

**Licence:** Free

**Platforms**, checked 2026-10-04 against the manifest and the live site rather
than assumed. `display: standalone`, 192 and 512 icons, a registered service
worker, and `manifest.webmanifest` serving live as
`application/manifest+json` — so it genuinely installs, it is not just a
bookmark:

**Tick `Online`, and nothing else.** Plus a separate `PWA` field if the form
has one outside the OS list.

AlternativeTo's own instruction on that field is explicit: *"Only add desktop /
mobile OS if the app has an app for the platform. For web apps only use online
and / or SaaS."* A PWA is still a web app to them. Being installable is not the
test — shipping a platform build is, and there is none.

This entry first said to tick Windows, Mac, Linux, Chrome OS, Android, iPhone
and iPad on the grounds that the manifest makes it installable on all of them.
That reasoning was sound and still wrong, because the field is not asking what
the app can run on. Worth keeping as a warning: the facts were all verified and
the answer was still incorrect, because the question was misread. Read the
directory's guidance text before filling a field, not just the field label.

**Leave blank, with reasons:**

- **Windows, Mac, Linux, Chrome OS, Android, iPhone, iPad** — no platform build
  exists. Installability does not qualify.
- **Software as a Service** — implies a hosted service with a server-side
  component. PomoMons is static files; there are no accounts and nothing runs
  on a server.
- **Self-Hosted** — no documented path, and no licence permitting
  redistribution.
- **Any individual browser slot** (Google Chrome, Firefox, Safari, Edge) —
  these mean a browser *extension*, which this is not.

Mobile is a full claim, not a hedged one: the mobile audit is complete at 390,
360 and 320px, and the blender — the one feature that used to be hidden on
touch, because drag-and-drop does not fire there — came back as a two-tap
flow. Nothing is missing on a phone.

**URL:** `https://pomomons.io/`

**Features** (AlternativeTo has a separate field for these; one per line, and
they are searchable facets, so claim only what is true):

> Pomodoro timer · Gamification · Works offline · No registration required ·
> Progressive Web App · Adjustable intervals · Session history · Desktop
> notifications · Privacy-friendly · No ads · Portable / no install ·
> Collectible creatures

> **"Dark mode" was in this list until 2026-10-04 and is false.** There is no
> theme toggle, no `prefers-color-scheme` rule and no `data-theme` attribute
> anywhere; the v3 skin is one fixed palette that only swaps the backdrop
> green-to-red during a focus run. A "dark" Pomomon is a rare *variant*, which
> is presumably where the confusion came from. It was verified by grep before
> being removed, the same way the 25-vs-30 default was.
>
> Checked and true, for the record: zero `document.cookie` use anywhere,
> GoatCounter is cookieless, and app.js / game.js / collection.js make no
> `fetch` or `XMLHttpRequest` calls at all, so offline and privacy both hold.
> But GoatCounter *does* send a pageview, so "no analytics" would be false —
> "no tracking cookies" is the accurate claim and the one to keep using.
>
> Also absent, so never claim them: any task or to-do list, time tracking in
> the billable sense, and app or website blocking — which is what most of the
> apps on those Focus Friend alternative pages actually do.

**Images.** The listing is far weaker without them, and nothing in the repo is
a screenshot yet. What exists and is usable as-is:

| Field | File | Note |
|---|---|---|
| Icon | `assets/icons/icon-512.png` | 512x512, already the PWA icon |
| Social / header | `assets/og-image-v3.png` | 1200x630 |

Screenshots still to capture, in this order of usefulness — the catch is the
whole pitch, so lead with it:

1. The moment after a catch, with the mon named on screen
2. The timer mid-focus-session, companion visible
3. My Mons with a collection of six or more
4. The Pomodex grid

Capture them at desktop width on the real site, not a local test build, so the
stamped asset versions and the real backdrop are what appear. A seeded
collection is needed for 3 — an empty one makes the app look unfinished.

**Do not fill in:** a pricing field (there is no paid tier — leave it free, do
not enter 0 into a "starting price" box, which some directories render as
"$0/mo" and makes it look like a lapsed trial), or a company/vendor name.

---

## 2. itch.io — DONE 2026-10-09, listing is live (as a click-through "PLAY NOW" page, not embedded — see the note below)

itch.io takes browser games, and the game layer is the genuinely novel part.

**How the embed actually works, found out the hard way 2026-10-09:** itch's
"HTML" kind requires an uploaded file — there's no field to just link out to
an external URL. A `<meta refresh>`/`location.href` redirect run from inside
itch's embed iframe stays trapped in that iframe (it navigates the iframe,
not the real browser tab), so pomomons.io rendered squeezed into whatever
small embed box itch defaulted to. Fixed by uploading a one-file HTML stub
(`index.html`) that's just a "▶ PLAY NOW" button with `target="_blank"
rel="noopener"` — a real link click reliably escapes the iframe into a proper
new tab, where the app gets a normal full-size window. The stub itself is not
in the repo (it's static boilerplate, zipped and uploaded directly to itch).

This also sidesteps a real risk of embedding the live app directly in itch's
iframe: some browsers (Chrome's storage partitioning, Safari ITP) treat a
cross-origin iframe's storage as separate from a direct visit to the same
site, so a player's saved collection and the installable/offline PWA features
could behave differently — or not persist — inside the embed versus visiting
pomomons.io normally. Opening in a real new tab avoids that entirely.

**Title:** PomoMons

**Short description:** Study with a Pomodoro timer. Catch a monster every time
you focus.

**Body:**

> **Focus · Catch · Collect**
>
> PomoMons is a Pomodoro study timer wrapped around a creature collector. You
> set a focus session and work. When the timer runs out, a wild Pomomon shows
> up — a food-themed pixel monster — and you throw a tomato to catch it.
>
> - **30 forms across 15 base species**, every one hand-drawn pixel art
> - **Evolutions** at level 16, 20 and 36
> - **Shiny** (1 in 500) and **dark** (1 in 100) variants
> - Five flavour types: Savory, Sweet, Spicy, Sour, Bitter
> - Set a favourite as your **companion**, or blend spares into smoothies to
>   level another mon up
> - 8-bit sound, synthesized in the browser — no audio files
>
> It is a real Pomodoro timer underneath: adjustable focus and break lengths, a
> long break every fourth session, a running history of your sessions and
> minutes, and a timer that stays accurate in a background tab.
>
> Free, no account, no ads. Works offline once loaded and installs to your home
> screen. Built in vanilla HTML, CSS and JavaScript with no framework.
>
> **Play: https://pomomons.io**

**Tags:** pomodoro, productivity, pixel-art, creature-collector, monsters,
study, html5, pwa, free, no-install

---

## 3. Product Hunt — one shot, so pick the day

You get one launch. Post **12:01am Pacific**, on a **Tuesday, Wednesday or
Thursday** — weekends are quiet and Monday is crowded. Be around for the first
six hours to answer comments; that is most of what decides how it goes.

**Name:** PomoMons

**Tagline (60 char max):** The Pomodoro timer where focus sessions catch monsters

**Description (260 char max):**

> A free Pomodoro timer with a creature collector attached. Finish a focus
> session, a wild pixel monster appears, throw a tomato to catch it. 30 to
> collect, with evolutions and shinies. No account, no ads, works offline.

**Topics:** Productivity, Time Tracking, Games, Web App

**First comment — post this yourself as maker, immediately after launching:**

> Hi Product Hunt 👋
>
> I kept bouncing off Pomodoro timers. The method works, but finishing a
> session gives you nothing except the absence of a ringing noise, and on a bad
> day that is not enough to make me start the next one.
>
> So PomoMons puts something at the end of it. Finish a focus session and a
> wild Pomomon turns up — a food-themed pixel monster — and you throw a tomato
> to catch it. It takes about ten seconds, it happens exactly where you were
> going to stop anyway, and it gives the end of a session a shape. There are 30
> forms across 15 species to find, they evolve, and there are shinies at 1 in
> 500 if you are lucky.
>
> Underneath it is an honest Pomodoro timer: adjustable focus and break
> lengths, long break every fourth session, session history, and a clock that
> stays right when the tab is in the background.
>
> Free, no account, no ads, no paid tier. It works offline and installs to your
> home screen. Vanilla HTML, CSS and JavaScript — no framework, no build step
> for years, which was half the fun.
>
> Happy to answer anything. I would especially like to hear which monster you
> think should exist and does not yet.

---

## 4. Reddit — read this part before posting anywhere

Reddit is where this most easily goes wrong. Two things to know:

**r/productivity bans self-promotion outright.** Their rule reads "Self-promotion
is not allowed here in any form, even if asked for recommendations." A launch
post there gets removed and risks the account. Do not post it. The only thing
that works in that sub is replying to someone who has asked for tool
recommendations, disclosing plainly that you made it — and even that is at the
mods' discretion.

**Most subs require account history.** A brand-new account posting a link
reads as spam to both the filters and the humans. If the account is new or has
little history, spend a week commenting normally somewhere first.

### Subs where this is actually welcome

| Sub | Notes |
|---|---|
| r/SideProject | Built for exactly this. Start here. |
| r/webdev | **Showoff Saturday** only — weekday posts get removed |
| r/InternetIsBeautiful | Strict mods, but a good fit. Title must describe, not sell |
| r/WebGames | Browser games, fits the catching half |
| r/pomodoro | Small but perfectly on-topic |
| r/PWA | Technical angle; small audience, friendly |

### Draft for r/SideProject

**Title:** I made a Pomodoro timer that gives you a monster to catch at the end
of every focus session

**Body:**

> I bounce off normal Pomodoro timers. The method is fine — the problem is that
> finishing a session gives you nothing, so on a bad day there is nothing
> pulling you into the next one.
>
> So I built one that hands you something small at the end. Finish a focus
> session and a wild "Pomomon" appears — a food-themed pixel monster — and you
> throw a tomato at it to catch it. It goes in your Pomodex, levels up as you
> do more sessions, and evolves. 30 forms across 16 species so far, with shiny
> variants at 1 in 500.
>
> The timer part is real, not a gimmick: adjustable focus and break lengths, a
> long break every fourth session, session history, and it stays accurate when
> the tab is backgrounded (measured against the clock, not counted frames —
> that one took a while).
>
> Vanilla HTML, CSS and JS, no framework. Installable PWA, works fully offline,
> collection saved locally with an optional emailed code to move it between
> devices. Free, no ads, no account.
>
> https://pomomons.io
>
> The thing I would most like feedback on: is the reward big enough to actually
> pull you back in, or does it wear off after a week? I genuinely do not know
> yet.

### Draft for r/webdev (Showoff Saturday ONLY)

**Title:** Showoff Saturday: a Pomodoro timer with a creature collector bolted
on, vanilla JS, no framework

**Body:**

> https://pomomons.io
>
> Pomodoro timer where finishing a focus session spawns a pixel monster you
> throw a tomato at to catch. 30 of them, they evolve, there are shinies.
>
> The parts that were actually interesting to build:
>
> - **Timing.** The animation sequences were written in 60fps frames and ran at
>   whatever rate rAF fired, so a tab coming back from being hidden played a
>   7-second catch over 30 seconds. They run off elapsed time now, with a test
>   that plays the whole sequence at 60/30/15fps and asserts it takes the same
>   wall-clock time at each.
> - **Service worker upgrades.** Page is network-first, assets are
>   stale-while-revalidate, so one deploy paired the new HTML with the previous
>   stylesheet out of cache and shipped a broken font. Everything carries a
>   content hash in its URL now so that pairing cannot happen.
> - **Fonts.** Subset the pixel face down to the 14 characters the clock can
>   draw.
>
> No framework, no runtime dependencies. Build step is a minifier and a set of
> Playwright checks that diff the built output against source geometry across
> eight screen states.
>
> Happy to go into any of it.

### If you want to mention it in r/productivity at all

Do not post. Wait until somebody asks for a timer recommendation, then reply
like a person, disclosing it:

> Full disclosure, I made this one, so take it with the appropriate salt — but
> it is the reason I actually finish sessions now. [one sentence on what it is]
> It is free with no account if you want to try it: pomomons.io

---

## 5. Indie Hackers — build-in-public post (not done yet)

IH readers follow a project over months, so this is post #1 of a series, not
a one-off ad. What does well there: real numbers (even small ones), what you
tried, what failed, one clear question at the end. What flops: a feature list
with a link.

**Before posting:** fill in the `[brackets]` with real figures from
GoatCounter. Small honest numbers beat vague ones on IH.

**Title:** Building a Pomodoro timer where every focus session catches a
monster: [X] visitors, $0, and what I got wrong

**Body:**

> I've used Pomodoro timers on and off for years and always quit them for the
> same reason: finishing a session gives you nothing. On a bad day there's no
> pull into the next one.
>
> So I built PomoMons (https://pomomons.io). Finish a focus session and a
> food-themed pixel monster appears. You throw a tomato to catch it, it goes in
> your Pomodex, levels up as you keep working, and evolves. 30 forms across 16
> species right now, shinies at 1 in 500.
>
> **Where it is**
>
> - Free, no ads, no account. Installable, works offline.
> - Vanilla HTML/CSS/JS on GitHub Pages. Running cost is the domain.
> - [X] visitors last 30 days, [Y] email signups, [Z] people in the Discord.
>
> **What's worked so far**
>
> - Listings on AlternativeTo and itch.io: [what they brought in, even if
>   "not much"].
> - [anything else with a number attached]
>
> **What I got wrong**
>
> - I spent months polishing before doing any distribution. The app was ready
>   long before anyone knew it existed.
> - I planned around Product Hunt's "Coming Soon" page, then found out it had
>   been discontinued. So I'm building an audience first and treating PH as the
>   finish line, not the start.
>
> **What's next**
>
> - Short videos of the catch and shiny animations (the animation already is
>   the content).
> - More mons, and streaks.
> - Product Hunt, once there are people who'd actually show up.
>
> **My question for you:** for a free side project with no revenue yet, would
> you add a paid tier now (cosmetics, extra mons) or wait until there's a real
> user base? I keep going back and forth.
>
> I'll post an update every couple of weeks with the numbers, good or bad.

**Follow-up posts (every 2 weeks):** same shape — numbers, one thing that
worked, one that didn't, one question. Topics in the bank: the first short
video's results, the backlink/SEO experiment, the PH launch itself.

## 6. Dev.to — two "war story" posts (not done yet)

Post one, wait about a week, post the other. Each stands alone. Dev.to's
rules ask AI-assisted posts to say so; the italic line at the end of each
draft covers that.

**Tags (max 4):** post 1 `javascript` `webdev` `gamedev` `performance`;
post 2 `javascript` `webdev` `pwa` `serviceworker`.

**Cross-posting to Hashnode:** publish on Dev.to first. On Hashnode, paste the
same text and set "canonical URL" in the post settings to the Dev.to link, so
Google doesn't treat it as a copy.

### Post 1 — the animation that ran 4x too slow

**Title:** My 7-second animation took 31 seconds whenever you came back to the
tab

**Body:**

> I make PomoMons, a Pomodoro timer where finishing a focus session spawns a
> pixel monster you throw a tomato at to catch. Here's a bug you'll hit too if
> you count animation frames.
>
> ## The symptom
>
> The throw-and-catch sequence normally takes about 7.7 seconds. Sometimes it
> crawled: the tomato drifted through the air, the shakes dragged on, and the
> whole thing took around 30 seconds. Once the mon was caught, everything
> looked normal again.
>
> It only happened when you came back to the tab after it had been hidden for a
> while. That's exactly when it matters, because the timer ends while you're
> off in another tab.
>
> ## The cause
>
> Every timed animation was written in 60fps frames: the throw arc was 90
> frames, each shake window 40, the evolution silhouette 120. Each
> `requestAnimationFrame` callback moved the animation forward one frame.
>
> That only works if the browser calls you 60 times a second. When a
> long-hidden tab comes back, Chrome takes several seconds to get its rendering
> back to full speed. At 15 callbacks a second, a 463-frame sequence takes 31
> seconds.
>
> What made it confusing: the sprites animated off `Date.now()`, so they kept
> normal speed. It didn't look like the page was slow. It looked like the throw
> animation was broken.
>
> ## The fix
>
> Keep the frame numbers (they're a nice way to think about timing), but work
> out how many frames each callback covers from the time that actually passed:
>
> ```js
> function frameClock(maxStep = 6) {
>   const FRAME_MS = 1000 / 60;
>   let last = null;
>   return {
>     step(now) {
>       const t = typeof now === 'number' ? now : performance.now();
>       if (last === null) { last = t; return 1; }
>       const frames = (t - last) / FRAME_MS;
>       last = t;
>       return Math.min(maxStep, Math.max(0, frames));
>     },
>     reset() { last = null; },
>   };
> }
> ```
>
> The cap of 6 matters. Without it, a tab hidden mid-sequence comes back with a
> huge time gap and skips straight to the end. With it, the animation picks up
> where it paused.
>
> ## The gotcha that came with it
>
> Sound effects fired on `if (st.frame === 15)`. Once frames are fractional,
> the clock goes 14.7, then 15.3, and never equals 15, so the sounds just
> stopped. Now each cue fires on the tick that carries the clock *past* its
> mark.
>
> Same idea when one phase hands off to the next: carry the leftover fraction
> forward instead of resetting to zero, or six phases in a row each lose a bit
> of time.
>
> ## Proving it
>
> I wrote a test that plays a real catch and a real evolution against a fake
> clock at three frame rates:
>
> | fps | callbacks | catch  | evolution |
> |----:|----------:|-------:|----------:|
> | 60  | 463       | 7717ms | 6750ms    |
> | 30  | 232       | 7733ms | 6767ms    |
> | 15  | 116       | 7733ms | 6800ms    |
>
> Before the fix, 15fps gave 30,867ms.
>
> **Takeaway:** if your animation's length is measured in callbacks, it's
> measured in something the browser is free to change. Measure time.
>
> *Written with help from an AI assistant; the bug, fix and numbers are from
> the real project.* PomoMons is free at https://pomomons.io.

### Post 2 — the deploy that turned every font into Courier New

**Title:** My service worker paired new HTML with an old stylesheet, and the
whole site turned into Courier New

**Body:**

> I make PomoMons, a Pomodoro timer that installs and works offline, which
> means it has a service worker. After one deploy, people coming back to the
> site saw the entire interface in Courier New instead of the pixel font.
> First-time visitors were fine.
>
> ## The setup
>
> The service worker used two common strategies:
>
> - **The page (HTML): network-first.** Always try for the newest version.
> - **CSS and JS: stale-while-revalidate.** Serve the cached copy instantly,
>   fetch the new one in the background for next time.
>
> Each is reasonable alone. Together, a returning visitor's first load after a
> deploy gets the **new** HTML and the **old** CSS.
>
> ## Why that broke the font
>
> Usually a mismatched pair is survivable. This one wasn't. I'd moved the pixel
> font from Google Fonts to self-hosted, so the new HTML dropped its Google
> Fonts `<link>` and the new CSS carried the `@font-face` rules. The old cached
> CSS knew about none of that. Result: no font anywhere, so the browser fell
> back to Courier New.
>
> I reproduced it reliably with a script that serves the old deploy, lets the
> service worker cache it, swaps in the new build, and reloads. Sample text
> measured 172.8px wide, exactly the fallback font's width.
>
> ## Why bumping the cache version didn't help
>
> The usual advice is to bump `CACHE_VERSION`. But the *old* service worker is
> still in charge of the load that's already happening. The new one doesn't
> take over until later, so that first load still gets the mismatch.
>
> ## The fix: a content hash in every URL
>
> The build script now adds `?v=<hash of the file>` to every stylesheet and
> script reference, in the HTML and in the service worker's precache list:
>
> ```html
> <link rel="stylesheet" href="style.css?v=3f9a1c2e">
> ```
>
> The HTML is always fetched fresh, so it always names the current hashes, and
> an old cached file under an old hash never matches. The bad pairing can't
> happen. The build also derives `CACHE_VERSION` from those hashes, so nobody
> has to remember to bump it.
>
> One exception: fonts aren't stamped. The HTML preloads them and the CSS
> requests them, and if those two URLs disagree the font downloads twice.
> Their filenames already change when their content does.
>
> ## The bonus bug
>
> While in there I found the precache was never actually read. Install filled
> one cache, but every request only looked in the *other* one, so the app shell
> downloaded twice on a first visit and was never served from where it was
> stored. Lookups now fall back to the precache.
>
> After the fix, the same reproduction measures 288.0px with the pixel font
> loaded, on the first reload and the second.
>
> **Takeaway:** network-first HTML plus cached assets will eventually pair new
> markup with old styles. Make the asset URL change whenever its content does.
>
> *Written with help from an AI assistant; the bug, fix and numbers are from
> the real project.* PomoMons is free at https://pomomons.io.

---

## Also worth doing, no writing required

- **GitHub topics** — already done 2026-10-03.
- **Awesome lists.** `awesome-pomodoro`, `awesome-selfhosted`-adjacent lists,
  `awesome-pwa`. A pull request adding one line. Slow, but these are permanent
  links from well-trusted repos.
- **Hacker News Show HN.** Title: `Show HN: PomoMons – a Pomodoro timer that
  gives you a monster to catch`. Low odds of taking off, no downside if it does
  not. Post 8–10am Eastern on a weekday.
- **The Discord.** Whoever is already in there is the most likely source of
  early Product Hunt support. Tell them the day before.
