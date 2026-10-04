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

## 1. AlternativeTo — lowest risk, do this first

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

**Licence:** Free · **Platforms:** Web, PWA

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
| Social / header | `assets/og-image.png` | 1200x630 |

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

## 2. itch.io — the game framing

itch.io takes browser games, and the game layer is the genuinely novel part.
Create a new project, kind "HTML", and link out rather than uploading a build
(the app needs its own origin for the service worker and saved collections).

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
> - **30 forms across 16 base species**, every one hand-drawn pixel art
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
> forms across 16 species to find, they evolve, and there are shinies at 1 in
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
