# Keyword strategy — where to aim next, and what to skip

Researched 2026-10-03. Supersedes the page-building priorities in the original
audit; see §6 for what changed and why.

**Standing caveat:** there is no keyword tool on this machine. Everything below
is reasoned from observed search results, intent logic and competitor
behaviour — not measured volume. Where a decision is expensive, §7 says how to
check it for free before committing.

---

## 1. The correction: drop the /N-minute-timer pages

The original audit ranked "nine `/25-minute-timer` style pages" as the third
priority, at an estimated 200–1,500 visits a month. **That was wrong and the
pages should not be built.**

Searching `"25 minute timer" online countdown` returns a page one made almost
entirely of sites that exist *only* to serve timer durations: setalarmclock.net,
vclock.com, online-stopwatch.com, timer.net, timerminutes.com, timer.live,
softaims.com, pomodorotimer.online, forestfocustimer.com. Nine of them, several
running a page per duration across every number from 1 to 90.

Three reasons to walk away:

1. **The competition is purpose-built.** These domains have nothing to do but
   win these queries, and they have been doing it for years.
2. **Google answers it itself.** A countdown widget appears above the results
   for duration queries and takes the clicks that would otherwise go to a
   result.
3. **The intent is wrong for us.** Someone typing "25 minute timer" wants a
   bare countdown this second. They do not want a creature collector, and the
   one thing PomoMons is better at than anyone is exactly the thing that
   visitor does not want. We would be competing with our advantage switched
   off.

pomofox builds these pages because pomofox *is* a plain timer — for them the
intent matches. For PomoMons it does not. The only arguable exceptions are
`/25-minute-timer` (Pomodoro-native) and `/30-minute-timer` (our own default),
and even those are weak bets that should wait for the Search Console data in §7.

---

## 2. The best opportunity: "alternative to" pages

This is the strongest lower-hanging fruit, and it is validated rather than
guessed.

**The gap is real.** Forest is the biggest name in gamified focus. It runs on
iOS and Android with browser extensions — **there is no official desktop
app**. Searching for one surfaces an unofficial Netlify clone and advice to
*run an Android emulator on your PC*. That is a frustrated, high-intent
audience with an unmet need.

**The play is proven.** focumon.com — a gamified focus web app with monster
collection, so about as close a competitor as exists — runs a dedicated
`/on/forest` page titled "Focumon | Forest App Alternative", roughly 2,200
words, built around a side-by-side feature comparison. Someone is already
making this work in this exact niche.

**We have a wedge against both.** Focumon has `/sign_in` and `/sign_up`:
it requires an account. Forest is an app-store install. PomoMons needs neither
— no account, no install, works offline, free with no paid tier. For a certain
searcher that is decisive, and no amount of Focumon's feature depth answers it.

### The finding that reframes all of this (researched 2026-10-03)

Checked the whole "cute companion focus app" category, not just Forest:

| App | Platforms | Companion mechanic |
|---|---|---|
| Focus Friend | iPhone, iPad, Android | A bean that knits while you focus |
| Forest | iOS, Android (+ browser extensions) | Plant a tree, it dies if you leave |
| Flora | Mobile | Plant a tree, optional real-money stake |
| Study Bunny | iOS, Android | Bunny companion, coins, shop |
| Focus Plant | iOS, Android | Collect raindrops, grow plants |
| Finch | Mobile | Self-care pet bird |

**Every popular app in this category is a phone app.** Not one of them runs in
a browser. Meanwhile the people who most need a focus timer are sitting at a
desk with a browser already open, and the phone-based ones cannot even see
whether you are working — Focus Friend's mechanic is detecting whether you
picked your phone up.

That is the positioning, and it is true rather than spun: **the focus-pet
category is phone-shaped, and PomoMons is the one for people working at a
computer.** It is a better line than any individual comparison, because it is
a category-level observation nobody else can make without admitting it.

### Focus Friend is the single best target

- **Google Play's App of the Year and the #1 focus app in America**, built by
  Hank Green with Honey B Games. Enormous, recently-created brand awareness —
  which means enormous search volume for the name and everything around it.
- **No web version.** iPhone, iPad and Android only.
- Its whole mechanic is phone-native: the bean knits as long as you do not
  open another app *on your phone*. For someone whose distraction is a browser
  tab on a laptop, the app cannot help by design.
- AlternativeTo's "Focus Friend Alternatives" page lists **60 alternatives**,
  and search results show that listing running to at least five pages — so the
  demand for an alternative is demonstrably large.
- **Not one of those 60 is a browser-based creature collector.** They are
  overwhelmingly app-blockers: LeechBlock, Cold Turkey, SelfControl,
  ClearSpace, Focus Firewall. Tools that punish distraction, not tools that
  reward focus.

The closest thing in spirit to Focus Friend that runs in a browser for free is
missing from the page where people go looking for exactly that.

### Targets, best first

| Page | The searcher's problem |
|---|---|
| **Focus Friend for desktop / on your computer** | Huge new audience, no web version, phone-only mechanic |
| **Forest alternative for desktop / browser** | No official desktop app; searchers are told to use an Android emulator |
| Study Bunny alternative for PC | Big student following, iOS/Android only |
| Free alternative to Forest / Flora | Does not want to pay, or does not want the real-money stake |
| Focus app with no account / no sign-up | Will not make an account for a timer |
| Focumon alternative | Hit the sign-up wall |

### Do not build eight of these

Templated comparison pages are a recognised spam pattern and Google's
helpful-content system demotes them as a group. Build **two or three genuinely
written ones** for the biggest names, plus **one flagship category page** built
on the observation above — that every app in this category is a phone app.
The category page is the one that can rank for the long tail of "focus pet app
for pc", "study timer with a pet on computer" and everything shaped like it,
and it is a real piece of writing rather than a fill-in-the-blanks table.

**Rules for these pages, non-negotiable:** every claim about a competitor must
be true on the day it is written, dated, and limited to things that do not
change often (platform availability, whether an account is required). Never
state a competitor's price — pricing changes and a stale price is both
embarrassing and a liability. Be genuinely fair about what they do better;
a comparison page that pretends the competitor has no merits reads as
untrustworthy and converts worse.

---

## 3. ADHD — highest-value audience cluster

Searches like "pomodoro timer for adhd" and "adhd focus timer" come from people
who have tried a lot of things and will try another. Two reasons this outranks
raw volume in value:

- **Intent is extremely high.** They are looking for a tool right now.
- **These communities share.** ADHD subreddits, Discords and TikTok pass tools
  around constantly, which produces the one thing the site is short of — links
  from places that are not us.

Competitor evidence: the Android app "Pomodoro Pets" explicitly pitches itself
to "anyone with ADHD or trouble focusing who enjoys creature collectors". The
positioning is established and winnable.

**Hard constraint:** no health claims. Do not say PomoMons helps ADHD, treats
anything, or is designed for a condition. Write about the *experience* — that
starting is the hard part, that a small immediate reward at a session boundary
lowers the cost of beginning the next one, that nothing here is gated behind
remembering to come back. Honest, experiential, no clinical framing. One page,
written carefully.

---

## 4. The quiet wins: our own true qualifiers

Each of these has low volume on its own, near-zero competition, and we are
genuinely the best answer on the open web:

- pomodoro timer no sign up / without an account
- offline pomodoro timer / works without internet
- pomodoro timer no ads
- browser pomodoro timer, no download
- pomodoro timer that works in a background tab

These do not need their own pages. They need to appear as natural phrases in
the homepage copy and the FAQ — which the draft in `homepage-copy.md` already
does deliberately. Cheap, already paid for.

---

## 5. Long-haul plays, in order of how much they compound

### a) A page per Pomomon — 30 pages, already half-built

Near-zero search volume today. Worth doing anyway:

- **The generator already exists.** `gen-pomodex.js` builds the roster page from
  `monsters.js` at build time. Extending it from one page to thirty-one is a
  small change, not a new project, and the pages can never go stale.
- **It compounds with the brand.** Every player who wonders what Pitapal
  evolves into currently has nowhere to land. As the game grows, these pages
  capture all of it.
- **Image search.** Thirty pieces of original pixel art, each on its own page
  with a real caption, is a surface the site does not currently have at all.

Low cost, no risk, pays off over years. The clearest long-haul build.

### b) The study-aesthetic cluster

"cute study timer", "aesthetic study timer", "pixel study timer", "study timer
with music". Student audience, heavily driven by Pinterest and TikTok, and
pixel art is a genuine fit rather than a stretch. Lower competition than
anything with "pomodoro" in it.

### c) Informational posts that attract links

"how long should a study session be", "pomodoro vs flowtime", "what to do in a
pomodoro break". Slow, and only worth starting if posts will keep coming —
a blog with three posts and a two-year gap is worse than no blog.

### d) The data post, later

pomofox got a lot of attention from a "106,000 focus sessions" analysis. It is
a genuinely good idea and the app already records sessions. **Not yet** — at
153 visitors a month there is nothing honest to write. Revisit at a few
thousand sessions.

---

## 6. The thing worth more than any page: getting listed elsewhere

The head terms — "pomodoro timer", "best pomodoro app" — are not winnable with
our own pages this year. But look at who *does* win them: Zapier, ClickUp,
Toggl, Jotform and a dozen others, all running "best Pomodoro timer apps"
roundups.

**Being included in one of those outranks anything we can write**, for two
reasons. It borrows their authority for the terms we cannot reach. And it is
what AI assistants quote: ask any assistant for a good Pomodoro timer and it
answers from those roundups, not from pomomons.io. `llms.txt` helps an
assistant describe PomoMons accurately once it has found it — being in the
roundups is how it finds it at all.

This is outreach, not writing: a short, honest email to the author of a roundup
that is actually maintained, saying what PomoMons is and why it is different
enough to be worth a line. Low hit rate, very high value per hit.

**Specific targets found 2026-10-03**, and the niche ones are far better odds
than the big names because they are smaller sites actively maintaining lists:

| Site | The post | Note |
|---|---|---|
| gridfiti.com | "10 Apps like Flora: The Best Alternatives" | Niche, student audience |
| gillde.com | "10+ Apps like Study Bunny: The Best Alternatives" | Same shape |
| peazehub.com | "9 Best Gamified Study Apps in 2026 — Ranked" | Directly on-topic |
| toolfinder.com | "Best Pomodoro Timers" | Established, curated |
| zapier.com | "The 6 best Pomodoro timer apps" | Huge authority, hardest to get into |
| focusdog.app | "The Best Focus Pet Apps in 2026, Compared" | **Skip** — a competitor running content marketing; they will not list us |

The pitch writes itself and does not need to be a pitch: *every app on your
list is a phone app, and some of your readers are looking for one that runs on
the computer they are already working at.* That is a useful note to an author
maintaining a list, not a favour being asked.

**Free and immediate — AlternativeTo.** The listing drafted in
`launch-posts.md` lets one entry be filed as an alternative to several apps at
once. File PomoMons against **Focus Friend, Forest, Flora, Study Bunny and
Focus Plant**. Those pages already rank and already collect people looking to
switch, and the Focus Friend page in particular lists 60 alternatives without a
single browser-based one. This costs nothing and takes ten minutes.

Other surfaces worth the same thinking:

- **YouTube "study with me" creators** need a timer visible on screen for hours.
  A pixel-art one is more watchable than a system clock. One creator adopting
  it is worth more than a page.
- **Pinterest** — study-aesthetic boards, where the artwork is the product.
- **Reddit threads rank in Google** and are quoted heavily by AI assistants, so
  an honest comment in a tool thread keeps paying long after it is posted.

---

## 7. How to stop guessing — free, and nearly here

Search Console was verified today. In **four to six weeks** it will show, for
free and specific to this site: every query that showed pomomons.io a result,
how many times, how often it was clicked, and the average position.

That is better than any estimate in this document. The method for the long haul
is not to guess harder — it is:

1. Wait for real query data.
2. Find queries already producing impressions at position 8–25. Those are terms
   Google already thinks we are relevant for and we are nearly ranking for.
3. Write the page or strengthen the section for those specific terms.
4. Repeat.

Pages built this way succeed far more often than pages built from a hunch,
because the demand is proven before the work starts.

**Do first, in order:** the homepage copy (drafted, waiting on approval) →
the distribution push in `launch-posts.md` → then stop and look at Search
Console before building anything else.

---

## 8. Deliberately not doing

- **Pokémon-adjacent terms.** There is real volume in "pokemon pomodoro timer"
  and the top results are hobby projects using the characters. We could chase
  it. We should not: it invites a trademark problem, and it undercuts the one
  thing that makes PomoMons more defensible than everything else in that search
  — the creatures are original and ours.
- **"Productivity" as a general term.** Hopelessly broad, owned by companies
  with marketing departments, and no intent match.
- **Anything claiming a health or clinical benefit.** Covered in §3.
