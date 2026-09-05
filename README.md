# PomoMons

A Pomodoro timer that's also a creature collector. Finish a focus session, a
wild Pomomon shows up, throw a tomato and catch it. Take breaks, build a
collection.

**[pomomons.io](https://pomomons.io)**

## What it does

- **Focus / short break / long break timer**, wall-clock based so it stays
  accurate even if the tab sits in the background — every 4th completed
  focus session earns a long break.
- **Catch a Pomomon after every focus session.** 12 base species, 20 forms
  once evolutions are counted, with 1% shiny and 5% dark variants.
- **My Mons / Pomodex** — a collection screen and a full dex of everything
  you've caught, stored locally per browser (IndexedDB).
- **Sound effects and desktop notifications** — an 8-bit chiptune set for
  catches/level-ups, and an optional browser notification + tab-title
  change when a session ends, so you notice even if you've tabbed away.
- **Save codes.** Progress lives in your browser, so a save code (emailed
  on request) lets you restore your collection on another device or after
  clearing browser data. No account, no password.

## Tech

Vanilla HTML/CSS/JS — no framework, no build step, no bundler. Runs by
opening `index.html` or serving the repo root with any static file server.

- `index.html` — app shell
- `app.js` — timer state and session flow
- `game.js` — encounter screen, throw/catch animation
- `monsters.js` — Pomomon roster data
- `collection.js` — Pokédex screen, My Mons, IndexedDB
- `audio.js` — sound effects (Web Audio API)
- `backup.js` — save-code generation/restore
- `signup.js` — email capture for save codes / mailing list
- `style.css`, `style-v2.css`, `style-v3.css` — styles, layered in that
  load order (later files win the cascade at equal specificity)
- `assets/sprites/`, `assets/audio/` — art and sound
- `agent_docs/` — reference docs on game mechanics, the mon roster, UI
  layout, and the email-signup pipeline; read these before changing the
  matching feature

Deployed on GitHub Pages from the `main` branch root — pushing to `main`
is what ships it.

## Running locally

No install needed. From the repo root:

```
python -m http.server 8000
```

then open `http://localhost:8000`. Opening `index.html` directly as a
`file://` URL also works for most things, but some features (fetch calls,
service worker if one gets added later) need it served over http.

## Status

In active pre-launch development. See `agent_docs/` for the parts of the
game/mechanics that are considered finalized for launch vs. still open.
