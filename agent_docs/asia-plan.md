# Asian markets: accessibility and marketing plan

Written 2026-11-16. Targets chosen by the owner: **India + Southeast Asia,
Japan, Korea.** China is out of scope (Google/GitHub Pages access is
unreliable there and the platforms are different: Baidu, Douyin,
Xiaohongshu). Scope of the first pass: this plan plus low-risk quick wins.

**Standing caveat:** like keyword-strategy.md, nothing here is measured. There
is no keyword tool on this machine. The search terms below are reasoned, and
§5 says how to check demand for free before building anything expensive.

## 1. Where the product stands (audited 2026-11-16)

- **No localization at all.** Every page is `lang="en"`; no `hreflang`, no
  translation layer, no locale detection. All UI text is hardcoded English:
  `index.html`, plus about 33 string-assignment sites across app.js, game.js,
  collection.js, backup.js and signup.js. Mon names are English food puns.
- **Fonts.** `--font-pixel` is Press Start 2P's *latin* subset. It has no CJK
  glyphs, so Japanese/Korean text would render in whatever the OS picks.
  **Quick win shipped 2026-11-16:** the stack in style.css now lists
  Hiragino / Yu Gothic / Noto JP, Apple SD Gothic / Malgun / Noto KR, and
  PingFang / YaHei / Noto SC before the generic `monospace`. English output
  is unchanged. This is a safety net, not a design: a translated UI still
  needs a deliberate font choice (§3).
- **Mobile weight is fine.** The built site transfers about 420 KB for a first
  app load (the 418 KB og-image is only fetched by crawlers and link previews,
  not by players). JS+CSS is about 40 KB gzipped, 41 sprites about 85 KB,
  two 120 KB background photos. That is acceptable on mid-range Android over
  4G, which is the main India/SEA device. Re-measure with a throttled Lighthouse
  run before claiming it, since this is size only, not speed.
- **Search.** The site ranks for nothing in any language yet, and its only
  prose is English. Instagram/TikTok links are nofollow bio links.

## 2. Market by market

| Market | Search / social | First move |
|---|---|---|
| India, Southeast Asia | Instagram, YouTube, TikTok (SEA). English works for many users; mobile-first | No translation needed first. Fix posting times, check mobile, then add Indonesian / Vietnamese / Thai later if traffic shows up |
| Japan | Google, YouTube, X, Instagram. Term: `ポモドーロタイマー`; "study with me" is `勉強配信` / `作業用` culture | Japanese UI + a `/ja/` landing page + Japanese-captioned shorts |
| Korea | **Naver** matters as much as Google; YouTube, Instagram. Term: `뽀모도로 타이머`; study-with-me (`스터디윗미`, `공스타그램`) is huge | Korean UI + `/ko/` page + register in Naver Search Advisor + Korean-captioned shorts |

**Trademark note for Japan and Korea:** the no-Pokémon-names/terms rule in
shorts-plan.md matters more here, not less. Also avoid `ポケモン`-style
katakana naming schemes ("-mon" is fine as it is, but do not imitate the
franchise's wording in Japanese copy). Keep terms.html's no-affiliation line
in every language.

## 3. Accessibility work (in order)

1. **A strings layer, not a rewrite.** Add `strings.js` (one object per
   language) and a small `t(key)` helper; mark static text in index.html with
   `data-i18n="key"`. Do it in one pass over the ~33 JS sites and the HTML
   labels. Load it before app.js and add `t` to the globals list in
   tools/check-build.js (Terser runs with `mangle.toplevel: false`, so the name
   survives). Mon names stay in English at first; translating them is a
   separate, riskier decision.
2. **Fonts per language.** Keep Press Start 2P for the timer digits and Latin.
   For body/menu text use a pixel face that has the glyphs:
   - Japanese: DotGothic16 (OFL).
   - Korean: Galmuri (OFL).
   Check each licence and *subset* it (the way PressStart2P-latin was cut
   down) so it doesn't add hundreds of KB. Only load it on the matching
   language. Unsubsetted CJK fonts are 1 MB+ and would wreck the mobile
   weight in §1.
3. **Layout slack.** The UI is a fixed-viewport console. Japanese is
   usually shorter than English; Korean and Indonesian are often longer.
   Re-run check-encounter-labels.js, check-cross-screen.js and
   check-accessibility.js per language, and add the new language to each.
4. **Per-language URLs.** `/ja/` and `/ko/` as real pages that build.js
   generates from strings.js (same pattern as gen-pomodex.js), each with its own
   `lang`, title, description and canonical, and reciprocal `hreflang` tags
   plus `x-default`. Do **not** add `hreflang` before those pages exist: it
   must point at real, reciprocal URLs. Add them to sitemap.xml (build.js
   asserts every `<loc>` resolves) and to `tools/check-content-pages.js`.
5. **Legal pages.** privacy/ and terms/ are English only. The email signup is
   the one personal-data flow, and Japan, Korea and India each have their own
   data-protection law. Have the owner decide whether translated versions are
   needed before the signup card is shown in those languages. This is a
   flag, not legal advice.
6. **PWA.** Add `lang` and a localized `name`/`description` per language
   only once a language ships; the manifest is shared today.

## 4. Marketing for these audiences

- **Fix the posting time first (zero code).** The Buffer slot is 6:00 PM US
  Eastern. That is about **4:30 AM in India**, 6 AM in Manila/Singapore-ish
  zones and 8 AM in Japan/Korea the next morning. So Japan and Korea are
  already fine and India/SEA are not. If India/SEA is a priority, a second
  slot around 7-9 PM IST (about 9:30-11:30 AM Eastern) is the one to add, but
  the free Buffer plan caps queued posts per channel, so the choice is to swap
  the one daily time or cut to alternate days. Pick one and track it in
  GoatCounter.
- **Language-light videos first.** The best performers (`24-every-cry`,
  `27-all-30`, `26-catch-asmr`, `29-catch-all`) are mostly sound and visuals,
  so they travel with only the on-screen text and caption changed. Re-render
  those with Japanese and Korean captions before making anything new. The
  video text lives in tools/video/shorts/; check that the renderer's font
  covers the glyphs, the same CJK problem as the UI.
- **Separate accounts per language.** One Instagram account posting English,
  Japanese and Korean confuses the recommendation algorithm. Plan `ja` and
  `ko` accounts (or channels) only once a translated landing page exists to
  link to from the bio.
- **Hashtags.** Use local tags next to the English ones, for example Japan:
  `#ポモドーロ #勉強垢 #作業用`; Korea: `#뽀모도로 #공스타그램 #스터디윗미`.
  Verify each tag's current content on the platform before using it. Some
  tags are used for unrelated content.
- **Naver (Korea).** Register the Korean page in Naver Search Advisor and
  submit its sitemap. Naver does not rank a site Google has never heard of
  well, and it favours Korean-language pages on its own blog/cafe ecosystem,
  so expect this to be slow.
- **Communities.** ADHD and study communities (Reddit has little reach in
  Japan/Korea): Japan uses X, Korea uses Instagram study accounts and
  Naver Cafes. India/SEA: r/studytips, r/IndianStudents-style communities and
  study Instagram.

## 5. Measure before building

1. **Demand check (free).** GoatCounter already breaks visits down by country
   and the "new players" count. Look at the last 30 days for JP / KR / IN /
   ID / VN / PH / TH before deciding which language to build first. Real
   traffic beats the guesses in this document.
2. **Query check.** Search `ポモドーロタイマー` and `뽀모도로 타이머` in
   Google / Naver and look at page one. If it is wall-to-wall dedicated timer
   sites (the same trap as keyword-strategy.md §1), a localized landing page
   will not win by itself; lean on shorts and communities instead.
3. **One language first.** Build the strings layer, then ship **one**
   language and watch it for a month. Do not translate three at once.

## 6. Order of work

1. [done 2026-11-16] CJK font fallback in `--font-pixel`.
2. [skipped by the owner] Read GoatCounter country data. Its country counts
   undercount (ad blockers; two Philippine signups never showed up as a
   country), so the Japanese build went ahead on the strength of the plan.
3. Decide the Buffer posting-time change for India/SEA (§4). Still open.
4. Throttled-mobile Lighthouse run for India/SEA devices. Still open.
5. [done 2026-11-16, branch `japanese-ui`, not merged] Strings layer
   (`strings.js`) + Japanese. See §7.
6. [done with 5] `/ja/` page, hreflang, sitemap. Still open: register /ja/ in
   Google Search Console (and Naver for any later Korean page).
7. Translated captions on the language-light shorts. Needs the /ja/ page live
   first, so the bio link has somewhere to go.
8. Korean: reuse the strings layer, add `I18N.ko`, a Galmuri subset, `/ko/`.

## 7. What the Japanese build is (2026-11-16)

- `/ja/` is the app, not a second site. Same scripts, stylesheets and
  storage; a collection is the same on `/` and `/ja/`. build.js generates it
  from index.html (see CLAUDE.md, Build & Deploy).
- Translated: all UI text, the settings, history, save-code, signup and
  notification-help text, every status line in the encounter, catch, evolution
  and backup flows, type names, the homepage prose (`ja-prose.html`), and the
  title/description/OG tags. The history screen shows dates as `M/D(曜)`.
- **Deliberately left in English:** mon names (a brand and search terms), the
  share-card image (canvas text needs the CJK font loaded first), nature and
  held-item names (data), and the pages behind the footer links (`/research/`,
  `/pomodex/`, `/privacy/`, `/terms/`, `/focus-friend-alternative/`). Those
  links are labelled `(英語)` so nobody is surprised.
- **Franchise wording avoided on purpose:** no `野生の` / `おや!?` /
  `〜に進化した` phrasing, no `手持ち`, `色違い`, `もちもの`, `せいべつ`,
  `せいかく`, `ポケモン図鑑`. Keep it that way when editing.
- **Needs a native speaker's review before any Japanese marketing.** The
  translation is a first pass. Most worth a second pair of eyes:
  `ポモデックス`, `あつめたモン`, `うま味` for the Savory type, `シャイニー`,
  and the research paragraph.
- **Privacy and terms are English only.** The signup card now shows in
  Japanese; decide whether translated privacy/terms pages are needed.
  The signup posts `location.origin + location.pathname`, so Sheet rows from
  the Japanese page carry `/ja/` and show how many signups it earns.
- **Not done:** auto-redirect by browser language (deliberately: it breaks
  crawlers and surprises people; the footer has a language link), an in-app
  language switch, a Japanese manifest (installing from `/ja/` still opens
  `/`), and Korean/Indonesian/Vietnamese/Thai.
