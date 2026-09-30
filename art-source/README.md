# art-source/

Editable originals for the game's pixel art, plus the concept and reference
images they came out of. **Nothing in here is served to the live site** —
`build.js` excludes this folder, the same way it excludes `agent_docs/`.

Why it's tracked at all: `assets/sprites/` only holds flattened PNGs. Those
are what the game draws, but they can't be re-opened and edited layer by
layer. The `.piskel` files here can. Until this folder existed they lived in
one folder on one laptop's Desktop and nowhere else, so a dead disk meant
redrawing a mon from scratch rather than opening it and nudging a pixel.

## piskel/

[Piskel](https://www.piskelapp.com/) project files — open them with *Import
.piskel* on the web app or in the desktop build.

The filenames are the mon each one draws. Most were named `image-<timestamp>`
when they were saved, so the names here were recovered by decoding each file's
frames and pixel-matching them against the shipped sprite:

| File | Shipped sprite | How it was matched |
|---|---|---|
| `Avocuddle.piskel` | `assets/sprites/Avocuddle/avocuddle.png` | 99.8% pixel match |
| `Donot.piskel` | `assets/sprites/Donot/Donot.png` | 100% pixel match |
| `GhostPepper.piskel` | `assets/sprites/GhostPepper/ghostpepper.png` | named in the file; 2 layers |
| `Pumplet.piskel` | `assets/sprites/Pumplet/Pumplet.png` | 100% pixel match |
| `Scorchpepper.piskel` | `assets/sprites/Scorchpepper/Scorchpepper.png` | 65% pixel match, 100% palette match — a 3-frame draft; the shipped sprite has 2 |
| `Tomotot.piskel` | `assets/sprites/Tomotot/tomotot.png` | 99.4% pixel match |
| `unidentified-20260701.piskel` | — | 32x32, 3 frames. Matches no shipped sprite (best score 0.4%). Probably an abandoned sketch; kept because it can't be recovered if it turns out not to be. |

**Only 6 of the 30 mons have an editable source.** Avocuddle, Donot,
GhostPepper, Pumplet, Scorchpepper and Tomotot are covered. The other 24 —
Bluble, Bluebeary, Chilino, Chillcone, Citrano, Cocokid, Cocokong, Guacamonger,
Jackwick, Marinaro, Marshmelt, Marshpuff, Mufman, Mushkin, Pinapip, Pitagon,
Pitapal, Pittsworth, Portobellord, Purrplant, Soursquad, Spud, Strangletti and
Wedgling — exist only as flattened PNGs. Their layered originals were never
saved, or were saved somewhere this folder doesn't know about. If one turns up,
it belongs here.

## reference/

Concept art, alternate takes and working screenshots. Original filenames kept
so they stay recognisable. None of these are wired into the game.

- `avocado2.png`, `guacamonster.png` — large concept paintings for Avocuddle
  and Guacamonger.
- `test eyes.png` — Guacamonger side by side with a glowing-eyes variant. The
  glow version never shipped.
- `Ghostpepper.png`, `ghostpepper1.png`, `Scorchpepper.png` — sprite-sized
  alternates. All three differ from the shipped sprite of the same name, so
  they're earlier or rejected takes rather than duplicates.
- `Tomato.png` — the throwable tomato at 256x256. The shipped sprite is 32x32.
- `corners.png` — a screenshot of the app's own UI, used while tuning the
  panel corners. `example.png` sat beside it byte-for-byte identical and was
  dropped.
- `image (1).png`, `Screenshot 2026-05-21 003453.png` — unlabelled working
  images, kept rather than guessed at.

One file in the original folder was left out as unrelated to PomoMons:
`clash royale icon.png`.

## Matching the background's pixel size

If you redraw `assets/backgrounds/forest.webp`, note that the page background
is scaled to the viewport while sprites are drawn at a fixed scale, so "one
art pixel" is a different size in each:

- Main timer screen: **2.75** screen pixels per art pixel (200px canvas,
  a 64px mon drawn into 176).
- Catch screen: **3.83** (480px canvas; the 120x60 ground drawn at 460x230).
- Background today: **~0.99** — which is why it reads as fine-grained next to
  the chunky sprites.

Drawing the background at one third of its current size (1038x1024 ->
**346x341**) lands it at ~3 screen pixels per art pixel, between the two sprite
scales and matching the `srcW * 3` density the sprite code is written around.
`image-rendering: pixelated` would need adding to `body` and the three overlay
rules that use the same photo first, or the browser will smooth the enlargement
into a blur.
