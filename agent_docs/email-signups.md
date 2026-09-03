# PomoMons — Email Signups & Usage Stats

> Read this before touching `signup.js` or the mailing-list card.
> The feature is **dormant until you paste an endpoint URL** — see step 6.
> It is **live** as of 2 Sep 2026; `signup.js` holds a working endpoint and
> signups land in the "PomoMons — Email Signups" sheet.

---

## What this does

Two separate things, deliberately kept apart:

| | What it collects | Where it goes |
|---|---|---|
| **Backup codes** | An address, so a save code can be emailed back | Emailed, then forgotten |
| **Mailing list** | Consent to updates and polls, ticked separately | An `Updates OK` column |
| **Usage stats** | Anonymous counts — visits, sessions finished, mons caught | GoatCounter dashboard |

The offer is the **backup code**, not the newsletter. Mons live in one browser
and clearing it loses them; the code is how they come back, and that is what
people are handing over an address for.

The mailing list rides along as an **unticked** checkbox. Keep it unticked — a
pre-ticked box is not consent under GDPR — and keep its wording naming both
things it covers, updates *and* polls, because consent only covers what was
actually described. Repeat backups hide the box and omit the field entirely
rather than sending `false`, so a screen that never asked can never be
recorded as an answer.

**The save code is never written to the sheet.** It is emailed and dropped.
The sheet stays a list of addresses, which also means nobody can be rescued if
they lose both the email and their browser — that was a deliberate call.

> **Sending limit.** A consumer Gmail account can send about **100 emails a
> day** through Apps Script. Past that `MailApp.sendEmail` throws, the signup
> is still recorded, and the person gets no code. On a launch day that is a
> real ceiling: check the `Backups Sent` column against it, and move the
> sending to a proper mail service before any day likely to pass it.

Nothing in the app is ever gated on an email. The card is dismissible, the
app works identically whether someone signs up or not, and if `ENDPOINT` in
`signup.js` is blank the card and the envelope button are removed from the
page entirely.

---

## Where people are asked

- **Envelope button** in the header, left of the wordmark. Always available.
  This is the path back for anyone who dismissed the card.
- **The card** slides up above the stats strip on its own once someone has
  caught **2 mons** or finished **3 focus sessions**, whichever comes first.
  It appears only after the encounter (and any evolution) has finished, so it
  never lands on top of a catch.

Dismissing it sets `pm_email_state = 'dismissed'` and it won't return for
**14 days**. After **3** refusals it stops asking for good. Constants are at
the top of `signup.js`.

---

## Setup

### 1. Make the sheet

New Google Sheet. Leave the tab alone — `setup()` in step 4 names it and
writes the headers, which is less error-prone than typing them in by hand.

### 2. Open Apps Script

In the sheet: **Extensions → Apps Script**. It has to be opened *from the
sheet* — that binds the script to it, and `getActiveSpreadsheet()` below only
works on a bound script. A standalone project made at script.google.com has no
spreadsheet and every signup fails.

### 3. Paste this in, replacing everything

```javascript
// PomoMons signup collector.
const SHEET_NAME = 'Signups';
const HEADERS = ['Timestamp', 'Email', 'Source', 'Sessions', 'Catches', 'Updates OK', 'Backups Sent'];
const SITE = 'https://pomomons.io/';

// Run this once, by hand, from the Apps Script editor: it names the
// spreadsheet, makes sure there is a "Signups" tab, and writes the header row.
// Safe to run again — it only fills in whatever is missing.
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.rename('PomoMons — Email Signups');

  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    // A brand-new spreadsheet has one tab called "Sheet1"; reuse it rather
    // than leaving an empty stray tab behind.
    const first = ss.getSheets()[0];
    sheet = (ss.getSheets().length === 1 && first.getLastRow() === 0)
      ? first.setName(SHEET_NAME)
      : ss.insertSheet(SHEET_NAME);
  }

  sheet.getRange(1, 1, 1, HEADERS.length)
       .setValues([HEADERS])
       .setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, HEADERS.length);

  return 'Ready: "' + SHEET_NAME + '" tab with headers ' + HEADERS.join(', ');
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Honeypot — a bot fills every field it can find. Accept and discard, so
    // whatever sent it sees success and doesn't retry.
    if (data.website) return ok();

    const email = String(data.email || '').trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return fail('bad email');
    }

    const code = String(data.code || '');
    // Codes are ~600 chars for a full collection. The ceiling is a sanity
    // check on what gets pasted into an email, not a real limit.
    if (code.length > 20000) return fail('code too large');

    const wantsUpdates = data.updates === true;

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);            // two people signing up at once would
    try {                            // otherwise race for the same row
      const sheet = SpreadsheetApp.getActiveSpreadsheet()
                                  .getSheetByName(SHEET_NAME);
      if (!sheet) return fail('no "' + SHEET_NAME + '" tab — run setup() once');

      const row = findRow(sheet, email);

      if (row) {
        // Already on the list. Count the extra backup, and let consent be
        // granted but never withdrawn here — an unticked box on a repeat send
        // means "not asking again", not "unsubscribe me". Withdrawal is what
        // the unsubscribe link is for, and inferring it from a hidden checkbox
        // would silently drop people who never asked to leave.
        sheet.getRange(row, 7).setValue((Number(sheet.getRange(row, 7).getValue()) || 0) + 1);
        if (wantsUpdates) sheet.getRange(row, 6).setValue(true);
      } else {
        sheet.appendRow([
          new Date(),
          email,
          String(data.source   || '').slice(0, 40),
          Number(data.sessions) || 0,
          Number(data.catches)  || 0,
          wantsUpdates,
          1,
        ]);
      }
    } finally {
      lock.releaseLock();
    }

    // Sent after the row is written and outside the lock: a mail failure must
    // not cost us the signup, and must not hold the lock while it retries.
    if (code) sendBackup(email, code, data.origin);

    return ok();
  } catch (err) {
    return fail(String(err));
  }
}

// Column B, from row 2 down. Returns the sheet row number, or 0.
function findRow(sheet, email) {
  const last = sheet.getLastRow();
  if (last < 2) return 0;
  const values = sheet.getRange(2, 2, last - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === email) return i + 2;
  }
  return 0;
}

function sendBackup(email, code, origin) {
  const site = /^https:\/\/[^\s"'<>]+$/.test(String(origin || '')) ? origin : SITE;
  const link = site + '#restore=' + encodeURIComponent(code);

  const body =
    'Here is your PomoMons save code.\n\n' +
    'Your collection lives in your browser, so if you clear it, switch\n' +
    'computers, or use a different browser, this code is how you get your\n' +
    'mons back.\n\n' +
    'One-click restore:\n' + link + '\n\n' +
    'Or open PomoMons, go to MY MONS, press SAVE CODE, and paste this in:\n\n' +
    code + '\n\n' +
    'Keep this email. Catch more mons and send yourself a fresh code any\n' +
    'time from the envelope button — this one only covers the mons you had\n' +
    'when you asked for it.\n';

  try {
    MailApp.sendEmail({
      to: email,
      subject: 'Your PomoMons save code',
      body: body,
      name: 'PomoMons',
    });
  } catch (err) {
    // Out of daily quota, or a bad address that passed the format check.
    // The signup is already recorded, so this must not fail the request.
    console.error('backup mail failed for ' + email + ': ' + err);
  }
}

function ok()      { return json({ ok: true }); }
function fail(msg) { return json({ ok: false, error: msg }); }
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
                       .setMimeType(ContentService.MimeType.JSON);
}
```

### 4. Run `setup()` and authorise

Pick `setup` in the function dropdown and press **Run**. Google will say the
app is unverified — it is yours — so choose **Advanced → Go to … (unsafe)**,
then **Allow**.

You know it worked when the sheet gains a bold, frozen `Signups` header row
and renames itself. **Do not skip this.** Authorising is not optional
housekeeping: a web app set to "Execute as: Me" cannot run at all until you
have granted it permission to act as you, and until then every request — from
the site, from anywhere — is refused with a Drive "Access Denied" page. That
error names Drive, not permissions, so it sends you hunting through the
deployment settings, which are not the problem.

> **If the authorisation popup keeps vanishing**, open the deployed `/exec`
> URL directly in a browser tab where you are signed in. Google then serves
> the consent screen as a full page instead of a popup.

### 5. Deploy

**Deploy → New deployment → Type: Web app**

- **Execute as:** Me
- **Who has access:** **Anyone** — this must be "Anyone", not "Anyone with
  Google account", or visitors would be asked to sign in to Google.

Copy the **Web app URL**. It ends in `/exec`.

Each deployment has **its own URL and its own access setting**. If you make
more than one, check under **Manage deployments** that the URL you copied
belongs to the one set to "Anyone".

### 6. Paste the URL into the app

In `signup.js`:

```javascript
const ENDPOINT = 'https://script.google.com/macros/s/AKfy…/exec';
```

That single line switches the feature on.

### 7. Check it before trusting it with real addresses

`tools/check-signup-endpoint.js` sends four probes at the endpoint — a good
signup, the same one again, a malformed address, and a honeypot hit — and
reports which behaviours actually hold. `tools/` is gitignored, so this lives
only on the dev machine.

```
node tools/check-signup-endpoint.js            # reads ENDPOINT from signup.js
node tools/check-signup-endpoint.js "https://…/exec"
```

An HTML page instead of JSON means the request never reached the script:
either the deployment's access is not "Anyone", or step 4 was skipped.
Delete the `pomomons-test-…` rows from the sheet afterwards.

### 8. Redeploy after any script edit

Apps Script serves the **deployed** version, not the one in the editor.
After editing: **Deploy → Manage deployments → edit (pencil) → Version: New
version → Deploy.** Keeping the same deployment keeps the same URL.

---

## Why the request looks odd

`signup.js` posts with `Content-Type: text/plain` even though the body is
JSON. That is deliberate:

- Any other content type makes it a "preflighted" cross-origin request. The
  browser sends an `OPTIONS` request first, Apps Script does not answer
  `OPTIONS`, and the POST is never made.
- `text/plain` keeps it a "simple request", which goes straight through.

The script parses the body as JSON regardless, so nothing is lost.

---

## Spam handling

Public endpoints get found. Three layers, all cheap:

1. **Honeypot field** — off-screen, hidden from screen readers, not tabbable.
   Filled in ⇒ silently discarded, in the browser *and* in the script.
2. **Time on form** — submissions under 1.2s are refused. Bots fill instantly.
3. **Format + length checks and de-duplication**, in the script, where they
   can't be bypassed by editing the page.

None of this stops a determined person. It stops drive-by bots, which is the
realistic threat. If the sheet ever does fill with junk, the next step is a
shared secret in the request body, checked in `doPost`.

---

## Before you email anyone

The sheet is a list of addresses; it is not a mailing tool. Two things it
does **not** do for you:

- **Unsubscribes.** Bulk commercial email must carry a working opt-out
  (CAN-SPAM in the US, and consent rules under GDPR/PECR in the EU/UK). If
  you send from a spreadsheet you have to honour opt-outs by hand.
- **Deliverability.** Sending to a few hundred people from a personal Gmail
  gets throttled and lands in spam.

When the list is worth mailing, export the sheet to a proper tool (Kit and
Buttondown both import a CSV and handle unsubscribes and compliance). The
card's copy promises only "occasional PomoMons updates" — keep it to that.

Also note the card's copy is the consent record. If you later want to email
about something else, ask again rather than stretching what people agreed to.

---

## Usage stats

GoatCounter is already in `index.html` — no cookies, no personal data, so
there is nothing to disclose or consent to.

Pageviews come for free. `signup.js` adds three counted events:

| Event | Fires when |
|---|---|
| `session-complete` | A focus session finishes (not breaks) |
| `mon-caught` | A mon is added to the collection |
| `email-signup` | Someone joins the list |

They show in the dashboard under **Pages**, alongside real page paths.
The calls are wrapped in a `try` and a feature check — an ad blocker stops
the GoatCounter script from loading, and that must never break the app.

Dashboard: https://specialaccount11.goatcounter.com

> The dashboard has a public/private setting. Check it is **private** unless
> you want your traffic numbers visible to anyone with the URL — the site
> code is in the page source, so the URL is effectively public.

---

## Files

| File | Role |
|---|---|
| `signup.js` | All the behaviour. `ENDPOINT` and the timing constants are at the top |
| `index.html` | Envelope button in the header, card markup before the scripts |
| `style-v3.css` | One self-contained `Mailing list` block at the end |
| `app.js` | Fires `session-complete`, and offers the card after the encounter resolves |
| `collection.js` | Fires `mon-caught` |

## Stored keys

| Key | Meaning |
|---|---|
| `pm_email_state` | `''` \| `joined` \| `dismissed` |
| `pm_email_prompts` | How many times the card has appeared on its own |
| `pm_email_last` | When it last appeared (ms) |
| `pm_email_queue` | Signups that failed to send; retried on next load |

A signup that fails on a bad connection is queued rather than lost — the
person has already been told it worked, so it has to actually arrive.
