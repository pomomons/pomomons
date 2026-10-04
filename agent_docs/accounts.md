# PomoMons — Accounts & Services

> **What this file is for.** Losing a laptop is recoverable: the code is on
> GitHub and the site rebuilds itself. Losing an *account* is not. This is the
> list of outside services PomoMons depends on, what breaks if each one is
> lost, and what to do about it.
>
> **Never put passwords, API keys or recovery codes in this file.** It is in a
> public repo. This records *which* accounts exist and *what they do*. The
> secrets belong in a password manager.

Written 2026-10-01. Owner: the project owner's personal Google identity (every
service below is registered to it unless noted). The address itself is
deliberately not written here — this file is in a public repo, and an email
address in it is an address scrapers can read. It is in the password manager
with everything else.

---

## The short version

| Service | Holds | If the account is lost |
|---|---|---|
| **GitHub** | All source, both repos, the deploy | Site keeps serving; no more updates |
| **Spaceship** (registrar + DNS) | `pomomons.io`, and the `hello@` forwarder | **Domain dies. Worst case here.** |
| **Google** | Signups spreadsheet + Apps Script backend | Signups stop; subscriber list lost |
| **Brevo** | Sends the backup-code emails | Signups recorded, no code emailed |
| **GoatCounter** | Anonymous visit stats | History lost; app unaffected |
| **Discord** | Community invite | Invite link in the app dies |
| **Product Hunt** | Launch listing (planned) | Launch has to be redone |

Ranked by how bad it is: **Spaceship → Google → GitHub → Brevo → the rest.**

---

## 1. GitHub — the code and the deploy

- Account: `pomomons` (user ID `263062220`). **Renamed from a personal handle
  on 2026-10-04** so the account name gives away nothing about its owner.
  GitHub redirects the old namespace, but the owner is content for the old
  name to be claimed by anyone, which would break those redirects — so treat
  every `github.com/<old-name>/…` URL anywhere as already dead and use the
  URLs below.
- Commits are authored as `pomomons
  <263062220+pomomons@users.noreply.github.com>`, GitHub's private no-reply
  form. The number is the account ID and is what actually attributes a commit,
  so attribution survives any future rename. Both repos pin this in their local
  `user.email`, and "Keep my email addresses private" + "Block command line
  pushes that expose my email" are on in GitHub's settings. A personal address
  must never appear in a commit again.
- `github.com/pomomons/pomomons` — **PUBLIC**. The app. Pushing to `main`
  triggers `.github/workflows/deploy.yml`, which runs `build.js` and publishes
  `_site/` to GitHub Pages.
- `github.com/pomomons/pomomons-tools` — **PRIVATE**. The dev-only
  screenshot and build-verification harness. Deliberately kept out of the
  public repo. Includes `signup-collector.gs`, which is the only copy of the
  Apps Script backend outside Google's editor.
- Pages serves the custom domain from the `CNAME` file (`pomomons.io`), so the
  live site does not depend on the account name at all — nothing on
  pomomons.io links to GitHub, and the deploy workflow never names the owner.
  A rename cannot take the site down.

**If this account is lost:** the live site keeps working — Pages serves the
last build — but nothing can be changed or fixed. The public repo could be
re-cloned by anyone who has a copy; the **private** tools repo could not.

**Do:** 2FA on, recovery codes stored off this laptop. Note that the tools repo
being private means there is no public copy to fall back on.

---

## 2. Spaceship — the domain and DNS *(the one that actually kills the project)*

- Registrar **and** DNS host for `pomomons.io` — "Spaceship, Inc."
- **Registered 20 Aug 2026; paid through 20 Aug 2027.** Auto-renew was turned
  on 2026-10-01. Verified via RDAP, not from memory — re-check with
  `https://rdap.identitydigital.services/rdap/domain/pomomons.io` if in doubt.
- Nameservers: `launch1.spaceship.net`, `launch2.spaceship.net`
- Mail: `mx1/mx2.efwd.spaceship.net` — `efwd` is Spaceship's **email
  forwarding**, so `hello@pomomons.io` is a *forwarder*, not a mailbox. Mail to
  it is relayed to the personal Gmail.
- **WHOIS privacy is ON — verified 2026-10-04 against the registry, not the
  Spaceship dashboard.** The public registrant record shows an empty name,
  `org = Privacy service provided by WITHHELD FOR PRIVACY LLC` and nothing but
  "Delaware" for an address; the only published email is
  `abuse@spaceship.com`. Domain status is `client transfer prohibited`, which
  blocks a transfer-out hijack. This matters because WHOIS is the one place in
  the whole project that would otherwise publish a real legal name and postal
  address — the repo and the site never had either. Re-check at the same RDAP
  URL above if the domain is ever transferred or the privacy service lapses;
  the dashboard can say "on" while the registry still serves old data.

**Why this is the worst one.** If the domain lapses it goes back on the open
market and anyone can register it. Then: `pomomons.io` points somewhere else,
every link ever shared is dead, `hello@pomomons.io` belongs to a stranger, and
Brevo's domain verification (§4) breaks. Unlike every other failure here, this
one is **not undoable** — you cannot force a sale back.

**Done 2026-10-01:** auto-renew is on, the card on file was checked, and
renewal notices go to the Gmail rather than `hello@pomomons.io`.

**The one thing to re-check, once a year, before 20 Aug 2027:** that the card
on file is still valid. Auto-renew with an expired card fails *silently* — it
is the usual way domains are lost, and the notice would arrive in a year when
none of this is fresh. If the card is ever replaced or reissued, update it here
too.

---

## 3. Google — the signup backend and the subscriber list

- Spreadsheet: **"PomoMons — Email Signups"**, tab `Signups`
- An Apps Script project **bound to that spreadsheet** (Extensions → Apps
  Script). It must stay bound — `getActiveSpreadsheet()` only works on a bound
  script, and a standalone project at `script.google.com` has no sheet.
- Deployed as a web app; `signup.js` posts to that
  `script.google.com/macros/s/…/exec` URL. Apps Script serves the **deployed**
  version, not the editor's — re-deploy after editing.
- Script Property `BREVO_API_KEY` lives here (see §4).

**If this account is lost:** signups stop being recorded, and the subscriber
list goes with it. Those addresses are real people who cannot be recreated —
once there are any, this is the only genuinely irreplaceable data in the
project.

**Do:**
- 2FA on, recovery codes off-laptop — **done 2026-10-01.**
- **Export the sheet to CSV whenever there are subscribers to lose.** As of
  2026-10-01 the list is empty, so there is nothing at risk yet and no export
  to make. The risk starts at the *first* signup, which in practice means the
  Product Hunt launch — so fold the export into the launch checklist rather
  than treating it as done. An empty sheet is not the same as a safe one.
- If the endpoint URL ever changes, it has to be updated in `signup.js` and
  pushed.

See `agent_docs/email-signups.md` for how the whole flow works.

---

## 4. Brevo — outbound email

- Sends backup-code emails from `hello@pomomons.io` via the transactional API.
- Free tier: **300 emails/day.** Past that the send fails, the signup is still
  recorded, and that person gets no code.
- The API key is **not in the repo** — it is a Google Apps Script Property
  named `BREVO_API_KEY`, read at send time. Keep it that way.
- `pomomons.io` is verified as a sending domain in Brevo, and
  `hello@pomomons.io` is the verified sender. That verification depends on DNS
  records at Spaceship (§2).

**If this account is lost:** signups keep working, but nobody receives a backup
code. Recoverable — make a new account, verify the domain again, replace the
script property.

---

## 5. GoatCounter — usage stats

- Dashboard: `https://specialaccount11.goatcounter.com`
- Script tag in `index.html` around line 898. No cookies, no personal data.
- Loaded defensively: an ad blocker stopping it must never break the app.

**If this account is lost:** past stats are gone, the app is unaffected. Lowest
stakes on this list.

---

## 6. Discord — community

- Invite: `https://discord.gg/bXnKR8FeG`, linked from the settings menu
  (`#btn-discord`).

**If this is lost:** the in-app button points at a dead invite, which needs a
code change and a push to fix. Worth having a second account with owner rights
on the server before the launch, so one lost login doesn't orphan it.

---

## 7. Product Hunt — the launch *(not yet done)*

- Planned launch listing; see `agent_docs/launch-plan.md`.
- Nothing depends on it technically. If the account is lost before launch day,
  the listing has to be rebuilt.

---

## Recovery-code checklist

**Done 2026-10-01** for GitHub, Spaceship, Google and Brevo.

2FA protects an account right up until it locks you out of it, so the recovery
codes have to exist somewhere that is not this laptop and not the account they
unlock. Printed on paper, or in a password manager reachable from a phone, both
work. Re-do this for any new service the project comes to depend on.

The failure to avoid: codes saved in a file on the laptop that died, or mailed
to `hello@pomomons.io`, which depends on the domain you are trying to recover.

---

## See also

- `agent_docs/email-signups.md` — how signups, Apps Script and Brevo fit
  together
- `agent_docs/launch-plan.md` — the live product task list
- The backup plan (Claude's memory) — what survives this laptop dying
