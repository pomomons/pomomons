# PomoMons — Email Signups & Usage Stats

> Read this before touching `signup.js` or the mailing-list card.
> The feature is **dormant until you paste an endpoint URL** — see step 5.

---

## What this does

Two separate things, deliberately kept apart:

| | What it collects | Where it goes |
|---|---|---|
| **Mailing list** | Email addresses people choose to give | A Google Sheet you own |
| **Usage stats** | Anonymous counts — visits, sessions finished, mons caught | GoatCounter dashboard |

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

New Google Sheet. Name the first tab `Signups`. Put these headers in row 1:

```
Timestamp | Email | Source | Sessions | Catches
```

### 2. Open Apps Script

In the sheet: **Extensions → Apps Script**.

### 3. Paste this in, replacing everything

```javascript
// PomoMons signup collector.
// Appends one row per signup to the "Signups" tab. Deployed as a web app so
// the site can POST to it; see agent_docs/email-signups.md.

const SHEET_NAME = 'Signups';

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

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);            // two people signing up at once would
    try {                            // otherwise race for the same row
      const sheet = SpreadsheetApp.getActiveSpreadsheet()
                                  .getSheetByName(SHEET_NAME);

      // Already on the list: succeed without adding a duplicate row.
      const existing = sheet.getLastRow() > 1
        ? sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues().flat()
        : [];
      if (existing.some(v => String(v).trim().toLowerCase() === email)) return ok();

      sheet.appendRow([
        new Date(),
        email,
        String(data.source   || '').slice(0, 40),
        Number(data.sessions) || 0,
        Number(data.catches)  || 0,
      ]);
    } finally {
      lock.releaseLock();
    }
    return ok();
  } catch (err) {
    return fail(String(err));
  }
}

function ok()      { return json({ ok: true }); }
function fail(msg) { return json({ ok: false, error: msg }); }
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
                       .setMimeType(ContentService.MimeType.JSON);
}
```

### 4. Deploy

**Deploy → New deployment → Type: Web app**

- **Execute as:** Me
- **Who has access:** **Anyone** — this must be "Anyone", not "Anyone with
  Google account", or visitors would be asked to sign in to Google.

Authorise when prompted (it will warn the app is unverified — it is yours;
choose **Advanced → Go to … (unsafe)**).

Copy the **Web app URL**. It ends in `/exec`.

### 5. Paste the URL into the app

In `signup.js`:

```javascript
const ENDPOINT = 'https://script.google.com/macros/s/AKfy…/exec';
```

That single line switches the feature on.

### 6. Redeploy after any script edit

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
