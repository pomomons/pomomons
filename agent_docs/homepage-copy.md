# Homepage below-the-fold copy — strategy and draft

Written 2026-10-03, for review before building. Nothing here is live yet.

---

## 1. What this page can and cannot win

**Not winnable now: "pomodoro timer" itself.** pomofocus.io and the other
incumbents have years of accumulated links. No amount of writing closes that
this year. Chasing it head-on produces a page that is worse at everything else.

**Winnable, and worth the most: the intersection queries** — the ones where
PomoMons is not *a* good answer but *the* answer:

| Query cluster | Why we can win it |
|---|---|
| gamified pomodoro timer, pomodoro timer game, pomodoro timer with rewards | Crowded but weak — see the SERP audit below |
| monster catching / creature collecting timer | Almost nobody is doing this on the open web with original art |
| free pomodoro timer no sign up, no account, offline, no download | All true of us, and a real filter for searchers |
| pomomons | Brand. Trivial, but the GitHub repo was outranking the site until today |

### SERP audit (searched 2026-10-03)

For **"gamified pomodoro timer"** the page-one field includes: a GitHub repo
(`kevinleaves/pomoquest`), a site on a **bolt.host** subdomain, one on a
**vercel.app** subdomain, plus Pomodomate, PlantPomo and PomPal.

That is a weak field. Several of the things ranking are not products with
domains — they are prototypes on free hosting. pomomons.io is a real domain
with a real app behind it, and that is a structural advantage over half of
page one.

For **creature-collecting timers** specifically, the field is: Chrome
extensions, GitHub hobby projects, an iOS app, an Android app, and a
downloadable Windows/Mac game. Most are built around characters their authors
do not own, which caps how far any of them can be promoted.

**Nothing in either search is a browser-based, no-install, works-offline
creature collector with original artwork.** That is the gap, it is real, and
the copy below is built to occupy it.

### One honest counter-signal

pomodorokitty.com ranks with essentially **no prose at all** — its headings are
UI labels like "Cat base colour". So text is not the only lever, and anyone
telling you otherwise is selling something. What it has is brand and links.

The conclusion is not "skip the writing", it is: **writing wins the long tail,
links win the head terms.** We are doing both. This document is the first; the
launch posts in `launch-posts.md` are the second.

---

## 2. Rules the copy follows

1. **No overlap with the pages we just shipped.** `/pomodoro-technique/` owns
   the method. `/faq/` owns the operational questions. `/pomodex/` owns the
   roster. The homepage owns **what PomoMons is and why it is different**.
   Repeating them would set our own pages competing with each other for the
   same queries and leave both looking thin.
2. **Every section says something only we can say** — the real odds, the real
   numbers, the actual design reasoning. Rephrased generic advice is exactly
   what Google's helpful-content system is built to demote.
3. **Honest about limits.** The "when it doesn't help" paragraph is there
   because it is true and because pages that admit a limitation outperform
   pages that read as brochures.
4. **Nothing invented.** No ratings, no testimonials, no user counts, no
   competitor pricing. Every number below is checked against the code.
5. **Intent stays satisfied.** The timer remains above the fold and loads
   first. Someone who came to start a session never has to read a word.
6. **No trademarked characters named.** The genre is described as "creature
   collector". We rank for the concept without borrowing someone's IP.

---

## 3. The draft

~900 words. Headings are H2s; the logo stays the H1 (see §4).

---

### A Pomodoro timer with a monster at the end of every session

PomoMons is a free Pomodoro timer with a creature collector attached. You pick
one task, start a focus session, and work until the timer runs out. When it
does, a wild Pomomon appears — a food-themed pixel monster — and you throw a
tomato to catch it.

It runs in a browser tab. There is no account to make, nothing to download, no
paid tier and no ads, and once the page has loaded a single time it keeps
working with no connection at all.

### How it works

1. **Set your session.** It opens on 30 minutes of focus, a 5 minute break and
   a 15 minute long break — a little longer than the classic 25. All three
   adjust with the arrows above the clock: focus from 20 to 90 minutes, breaks
   from 1 to 90.
2. **Press START and work.** The clock is measured against real time, not
   counted frame by frame, so it stays correct while the tab sits in the
   background. You can have it notify you when the session is up.
3. **Meet what turns up.** A wild Pomomon appears the moment the session ends.
4. **Throw a tomato.** Every species has its own catch rate, so a throw can
   miss and a rarer one can break free. Or press RUN AWAY and go straight to
   your break.
5. **Take the break.** After every fourth focus session you get the long one.

### What you are collecting

There are **30 Pomomon forms across 16 base species**, numbered #1 to #30 in
the Pomodex. Only the 16 base forms appear in the wild — the other 14 are
evolutions, which a Pomomon you have already caught reaches on its own at level
16, 20 or 36.

Every one is drawn from food. Tomotot is a tomato that evolves into a pot of
marinara and then into a tangle of spaghetti. Chilino is a chilli that ends up
as a ghost pepper. There are five flavour types — Savory, Sweet,
Spicy, Sour and Bitter — and a Pomomon can change type as it evolves.

Two rare variants turn up on any encounter. A **shiny** is gold-tinted and
sparkling, at roughly **1 in 500**. A **dark** is near-black, at about **1 in
100**. Shiny is rolled first and wins outright, so no Pomomon is ever both.
You can see [every Pomomon and its evolution level](/pomodex/) before you start.

### Why a reward at the end actually helps

The Pomodoro Technique works. Its weak point is that finishing a session gives
you nothing except the absence of a ringing noise. That is fine on a day when
the work is interesting. It is much less fine on the other days, and the other
days are when you needed the method.

PomoMons puts something small at the end instead. It is deliberately small: it
takes about ten seconds, it happens exactly where you were going to stop
anyway, and it never asks you to keep playing. The point is to give the end of
a session a shape, so that starting the next one is a smaller decision than it
was.

It will not fix a task you are avoiding for a real reason, and it will not make
a bad plan into a good one. If you have never got on with timers at all, a
monster at the end is unlikely to change that. What it reliably does is make
the fourth session of the afternoon easier to start than the fourth session of
a plain timer. If you are new to the method,
[here is how the Pomodoro Technique works](/pomodoro-technique/) and where the
25 minutes came from.

### Free, no account, and it keeps working offline

There is no sign-up. Open the page and press START.

Your level, your sessions and your whole collection are saved in your own
browser, on your own device. They are never uploaded, and there is nothing to
log in to, because there is no account for them to belong to. The site counts
anonymous page views and sets no tracking cookies.

The trade is that browser storage belongs to the browser: clear your site data,
switch browser, or use a private window, and the collection goes with it. So
there is an optional save code — copy it, or have it emailed — that restores
your collection on any device. It is the only thing an email address is ever
used for, and nothing in the app requires one.

Because it is an installable web app, your browser can add PomoMons to your
home screen or desktop and open it in its own window with no address bar. After
one load, the timer, the encounters and your collection all work with no
connection. The [FAQ](/faq/) covers the rest.

### How it compares to other focus timers

Most focus apps with a reward loop are phone apps you install from a store, and
most of the browser ones are hobby projects built around characters their
authors do not own. PomoMons is deliberately neither: it opens in a tab on any
device, the creatures are original, and nothing is behind a payment or a login.

Against a plain Pomodoro timer, the honest difference is one thing — the ten
seconds at the end. Everything underneath is a real timer: adjustable
intervals, long break every fourth session, a running history of your sessions,
minutes and catches, and a clock that does not drift when you look away.

---

## 4. Decisions that need the owner

### a) The H1 — recommend leaving it

Today the page's H1 is the **POMOMONS** wordmark. A brand-only H1 spends the
page's strongest heading signal on a word nobody searches yet.

- **Option 1 (recommended): leave it.** Zero visual change. The descriptive
  weight goes into the H2s above, which carry real weight of their own.
- **Option 2: change the visible tagline.** The header currently reads
  "FOCUS · CATCH · COLLECT" under the wordmark. Rewriting that to something
  like "A POMODORO TIMER YOU CATCH MONSTERS IN" and folding it into the H1 is
  the strongest option on paper — but it changes the look of the top of the
  page, and that is a brand decision, not an SEO one.

### b) A real footer — recommend yes

The three new pages are currently linked only from inside the settings menu,
behind a click. The below-the-fold section gives us somewhere to put a plain,
always-visible footer linking to them. Links a crawler can see without
simulating a click are worth meaningfully more, and it is free to add here.

### c) Honest note on schema

I will extend the homepage's existing structured data, but should set
expectations: Google removed HowTo rich results from search in 2023, and FAQ
rich results are now restricted to a narrow set of sites. The schema still
helps Google understand what the page *is* — it will not put a decorated result
in the listings. Anyone promising otherwise is working from old guidance.

---

## 5. Not in this page, on purpose

- **ADHD.** A real and sizeable query cluster in this niche, and one line on
  the homepage would rank for none of it. It deserves its own page, written
  carefully and without health claims.
- **The /N-minute-timer pages.** Still waiting on the Keyword Planner check.
- **Usage statistics.** pomofox got a lot of links from a "106,000 focus
  sessions" data post. That is a genuinely good idea and worth doing — once
  there are enough sessions to write about honestly. At 153 visitors a month
  there are not.
