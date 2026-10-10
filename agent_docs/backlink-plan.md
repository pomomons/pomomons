# Building a following + backlinks/AI-citation, before the PH launch

Written 2026-10-09. User decided to build an audience first rather than launch
on Product Hunt immediately — PH is now the *capstone* of this plan, not the
start of it. Likely pushes the Oct 18 date back; that's expected and fine,
don't launch PH until Discord/following has real people in it who'll show up
on day one.

Treat this as a companion to `launch-plan.md` (overall project state) and
`launch-posts.md` (the actual post drafts — AlternativeTo and itch.io are
DONE, don't revisit). This file is the new work: pre-PH audience building,
backlinks, and AI-answer-engine citation.

## Why this order

PH's old "Coming Soon" page (what we planned around) was discontinued ~Aug
2025 — there's no pre-launch teaser page anymore, just a forum thread. That
removed the one mechanism PH offered for pre-building an audience, which
makes doing it ourselves (content + community + directories) the only path,
not a nice-to-have.

## Phase 0 — this week, highest leverage per hour spent

1. **Unblock the short-form content plan.** A 6-week TikTok/Reels/Shorts plan
   already exists (artifact from 2026-09-07,
   `claude.ai/code/artifact/d67281d7-c46e-4e12-8e1f-c81df1a7606d`). It's been
   sitting idle because 5 decisions were left open: face vs. faceless, brand
   vs. founder account, 1 vs. 2 posts/day, seed creators or not, which of the
   four pillars (Drop/Loop/POV/Run) to over-index on. This is the single
   highest-leverage following-builder for this product specifically — the
   catch/shiny-reveal animation already IS short-form content, no new asset
   needed. Make the 5 calls and start posting.
2. **Pick 2-3 pre-launch audience sites and submit now.** These exist
   specifically to fill the gap PH's Coming Soon used to cover — a following
   *before* the real launch, plus a backlink each: **BetaList**, **Uneed**,
   **Fazier**, **SaaSHub**. Low effort, no timing pressure, stack with
   AlternativeTo/itch.io (already done).

## Phase 1 — weeks 1-3, running in parallel

- **Indie Hackers build-in-public post(s).** That audience follows progress,
  not just launches — good fit for watching the mon roster/mechanics evolve.
- **1-2 technical "war story" posts**, cross-posted to Dev.to/Hashnode (and
  your own blog if you want one): the rAF/animation-timing bug (catch
  sequence running 30s instead of 7.7s on a backgrounded tab), the service
  worker cache-pairing bug (new HTML shipped with a stale stylesheet). These
  are genuinely interesting to developers, rank for dev-search terms, and
  double as HN fodder later. Draft exists in spirit in the r/webdev Showoff
  Saturday post in `launch-posts.md` — expand that into standalone posts.
- **Awesome-list PRs** — one-line additions to `awesome-pomodoro`,
  `awesome-pwa`. Permanent links from trusted repos, pure backlink value, no
  audience-building angle but cheap and durable.
- **PWA directories** (e.g. appscope-style PWA listing sites). Zero new
  claims needed — already a real PWA — just submission.

## Phase 2 — weeks 2-4, once there's something to point to

- **Reddit, in the order already drafted in `launch-posts.md`**: r/SideProject
  first (safest, built for this), then r/webdev (Showoff Saturday only),
  r/WebGames, r/pomodoro, r/PWA. Do **not** post to r/productivity — it bans
  self-promotion outright; only reply there if someone asks for a
  recommendation.
- **Show HN** — this is a one-shot; don't spend it before there's visible
  traction (some Reddit upvotes, a Discord with actual people) to point to in
  the comments if asked "how's this doing."
- **Let Discord grow from this traffic.** It's currently empty — that's fine,
  it's a destination for people arriving from the above, not a channel to
  post into yet. Once there are real members, *then* "tell Discord the day
  before" (from the old plan) becomes meaningful.

## Phase 3 — launch, whenever the following is real

PH no longer has a teaser page — warm up via the forum-thread mechanism in
the final week instead, then launch with the Name/Tagline/Description/first
comment already drafted in `launch-posts.md`. Trigger condition: Discord has
people who'll actually show up, not a calendar date.

## Ongoing, not gated on any of the above — SEO + AI-citation

These compound independently and should keep running regardless of PH timing:

- **"Alternative to X" pages** — flagged in `keyword-strategy.md` as the
  single best remaining SEO opportunity, zero built. Worth doing at your own
  pace; it's the biggest lever for *sustained* search traffic because it
  targets people already searching for a replacement app (same logic as the
  Focus Friend AlternativeTo listing, but as owned content instead of a
  third-party directory entry).
- **`/research/` is the core AI-citation asset** — specific, sourced,
  numeric claims (DOIs, effect sizes) are exactly what answer engines quote
  over generic blog restatements. Keep it current as the roster/mechanics
  grow; don't let it drift from `llms.txt`.
- **Reddit/HN threads double as AI-citation fodder.** Answer engines
  (Perplexity, ChatGPT browsing) weight real Reddit discussion heavily for
  "best X app" queries — a genuine, well-received thread gets surfaced and
  quoted later, independent of whether it drives direct traffic now.
- **Fact consistency across every external listing** (session lengths, mon
  counts, shiny odds) matters more than it looks — AI engines are less
  likely to cite a source whose facts conflict with other sources about the
  same entity. CLAUDE.md already enforces this for the on-site pages; hold
  every new directory listing to the same bar.

## Explicitly not doing / low priority

- Wikipedia "External links" edits — real backlink value but high risk of
  being reverted as spam from an unestablished account; revisit only once
  PomoMons has independent press coverage to cite.
- G2/Capterra — B2B SaaS audience mismatch, skip.
- Cold outreach to productivity blogs for "best pomodoro apps" listicle
  inclusion — fine later, not worth the time until there's a following to
  point to as social proof.
