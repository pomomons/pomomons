# PomoMons — Gamified Pomodoro Timer

## What This Is
A browser-based Pomodoro timer with a creature-collecting game layer.
After each focus session, a wild "Pomomon" (food-themed pixel creature) 
appears. Players throw a tomato to catch it and build a collection.

## Tech Stack
- Vanilla HTML5, CSS3, JavaScript — no frameworks, no build step
- HTML5 Canvas for Pomomon sprite animations
- localStorage for player state (level, EXP, settings)
- IndexedDB for collection data (50+ mons, shiny variants)
- Deployed on GitHub Pages from main branch root

## File Structure
- index.html — single app shell
- style.css — global styles
- app.js — timer logic and session flow
- game.js — encounter screen, throw animation, catch logic
- monsters.js — Pomomon roster data
- collection.js — Pokédex screen, active mon selector, IndexedDB
- audio.js — 8-bit sound effects (Web Audio API)
- assets/sprites/ — PNG sprite sheets
- assets/audio/ — .ogg chiptune files

## Reference Docs (read before working on related features)
- agent_docs/game-mechanics.md — EXP/leveling, catch rules, shiny odds
- agent_docs/monsters.md — full Pomomon roster, rarity tiers
- agent_docs/ui-layout.md — screen layouts, animation states

## Key Rules
- No external libraries unless explicitly approved
- All Canvas drawing lives in game.js only
- Desktop-first web layout — no max-width cap on body; stats strip spans full viewport width; main content column uses max-width: 680px centred
