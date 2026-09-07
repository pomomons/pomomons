# PomoMons — Gamified Pomodoro Timer

## What This Is
A browser-based Pomodoro timer with a creature-collecting game layer.
After each focus session, a wild "Pomomon" (food-themed pixel creature) 
appears. Players throw a tomato to catch it and build a collection.

## Tech Stack
- Vanilla HTML5, CSS3, JavaScript — no frameworks, no build step
- HTML5 Canvas for Pomomon sprite animations
- localStorage for player state (level, EXP, settings)
- IndexedDB for collection data (20 mon forms across 12 base species; shiny/dark variants)
- Installable PWA (manifest.webmanifest + sw.js) — works offline
- Deployed on GitHub Pages from main branch root (custom domain pomomons.io via CNAME)

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

## Reference Docs (read before working on related features)
- agent_docs/game-mechanics.md — EXP/leveling, catch rules, shiny odds
- agent_docs/monsters.md — full Pomomon roster, rarity tiers
- agent_docs/ui-layout.md — screen layouts, animation states
- agent_docs/email-signups.md — mailing-list backup flow, Brevo/Apps Script setup

## Key Rules
- No external libraries unless explicitly approved
- All Canvas drawing lives in game.js only
- Desktop-first web layout — no max-width cap on body; stats strip spans full viewport width; main content column uses max-width: 680px centred

## Workflow Rules
- After completing each set of edits and you are ready for the user's next instructions, run the following via Bash to play an audible notification: `powershell -c "[console]::beep(900,200); Start-Sleep -Milliseconds 80; [console]::beep(1200,300)"`
