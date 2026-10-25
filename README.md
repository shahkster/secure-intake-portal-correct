# LEGACY COMFORT LIFE

Life insurance CRM: leads, dialing, callbacks, deals, team leaderboard. Boss and agent roles, 2FA required for everyone, boss-only account creation, CSV lead import with assignment, live notifications for every deal.

## Deploy on Vercel (about 10 minutes, works from a phone)

1. **Put the code on GitHub.** Create a new private repo and upload this folder (github.com → New repository → "uploading an existing file").
2. **Import it in Vercel.** vercel.com → Add New → Project → pick the repo.
3. **Add a database.** In the Vercel project → Storage → Create → Neon (Postgres). It adds `DATABASE_URL` for you.
4. **Add environment variables** (Project → Settings → Environment Variables):
   - `SESSION_SECRET`: 64 random characters (the app refuses anything under 32)
   - `ENCRYPTION_KEY`: 32 random bytes in base64 (run `openssl rand -base64 32`, or use any base64 key generator that outputs 44 characters ending in `=`)
   - `SETUP_KEY`: any long passphrase you make up (12+ characters)
   - `APP_NAME` and `NEXT_PUBLIC_APP_NAME`: optional — the site already uses LEGACY COMFORT LIFE
   - `APP_TIMEZONE`: `America/New_York`
   - Optional `ROUTING_API_KEY`: free key from api-ninjas.com so routing numbers show the bank's name and city (without it, numbers are still checked for typos)
   - Optional `CRON_SECRET`: any long random string, for callback reminders (see below)
5. **Deploy**, then open `https://your-app.vercel.app/setup`, type your `SETUP_KEY`, and create the boss account. That page locks itself afterward.
6. Sign in, scan the QR code with Google Authenticator, and you're in. Add agents on the **Team** page.

**Keep `ENCRYPTION_KEY` safe and never change it** — SSNs and bank numbers are encrypted with it and can't be read without it.

## How it works

- **Accounts:** only a boss can create accounts. New people get a one-time temporary password, must pick their own password, and must set up 2FA before they see anything. 5 wrong tries locks an account for 15 minutes. Boss can reset passwords, reset 2FA (lost phone), or deactivate someone — which signs them out everywhere immediately.
- **Agents** see only leads and deals assigned to them. **Bosses** see everything.
- **Leads:** one-tap status, tap-to-call (logged as a dial), the lead's local time with a warning outside 8am–9pm, callbacks with an overdue banner at the top of every page.
- **Import:** boss uploads a CSV, columns are matched automatically, then leads go to one agent, get split evenly across several, or stay unassigned. Duplicate phone numbers can be skipped. Agents get notified.
- **Notifications:** the bell has "For me" (assignments, status changes on your deals) and "All deals" (every deal logged or updated, whole team). Turn on desktop alerts from the bell.
- **Their time:** every lead shows its local time (using ZIP for states split across time zones) with a warning outside 8am–9pm. Callbacks can be entered in their time or yours.
- **Weather:** each lead links to the National Weather Service forecast for their area, and the lead page shows current conditions when there's a street address.
- **BMI:** calculated automatically from height and weight (5'10", 70 in, 178 cm, 180 lbs, 82 kg all work).
- **Routing numbers:** checked for typos instantly, and the bank name and city are shown when `ROUTING_API_KEY` is set.
- **Secure client link:** on any lead, tick SSN and/or bank details and create a link. Text or email it. The client sees a short security check, types their numbers on their own phone (hidden as they type), and it saves straight to the lead. Links work once and expire in 48 hours.
- **Sensitive data:** SSN and bank account numbers are AES-256 encrypted in the database, shown masked, and every reveal is written to an audit log. Card numbers and CVVs are intentionally not stored.

## Calling and auto-dial

Pick how calls go out with **Call with** (on the Leads page or your Account page): your phone app, **Zoom Phone** (opens Zoom and dials automatically), or **Google Voice** (opens voice.google.com with the number filled in; set the account # to match the number after /u/ in your Google Voice address).

**Start auto-dial** on the Leads page calls the first lead that's inside calling hours. Press a number for how the call went and it saves the result and dials the next lead right away. Leads outside 8am–9pm their time, flagged leads, and leads already marked Sold, Not Interested, Wrong Number or Do Not Call are skipped.

| Key | Does |
|---|---|
| 1 | No answer (+1 try: 1st, 2nd, 3rd…) |
| 2 | Not interested |
| 3 | Callback (pick a time in their time zone) |
| 4 | Interested |
| 5 | Talked to them |
| 6 | Wrong number |
| 7 | Sold (opens Log a deal) |
| 9 | Do not call (adds them to your internal list) |
| C / Enter / ↑ ↓ / S / Esc | Call / open / move / skip / stop |

On a phone, the same buttons show in the bar at the bottom.

## Card BIN check

Type a card number on a lead to see the network, debit/credit and issuing bank. Only the first 6 digits are sent for the lookup (binlist.net — its free tier allows a handful of lookups per hour, and results are cached). You can keep the brand, bank and last 4 on the lead. The full number, expiry and CVV are never saved.

## Resources page

Carrier phone numbers (tap to call with your dialer), what to write by age/health/product, rebuttals, the beneficiary script, Corebridge and Chubb client walkthroughs, Google Voice extension setup, and a license fee calculator. Content lives in `lib/resources.ts` — edit that file to update it. Quick links are edited right on the page by the boss.

## Phone alerts

- **iPhone (iOS 16.4+):** open the site in Safari → Share → Add to Home Screen → open it from the home screen. A bar appears asking to turn on alerts. Tap it.
- **Android / computer:** tap the bell → Turn on alerts.
- Alerts go out for: every deal logged or status change (whole team), leads assigned to you, a client finishing their secure form, and callbacks 15 minutes before they're due.

**Callback reminders while nobody has the app open** need something to ping the site every 5 minutes. Free option: create a job at cron-job.org that opens `https://YOUR-SITE/api/cron/callbacks?key=YOUR_CRON_SECRET` every 5 minutes. (On Vercel Pro you can use Vercel Cron instead.) While anyone on the team has the CRM open, reminders also go out on their own.

## Do Not Call

The National Do Not Call Registry has no free lookup service. Your agency needs a SAN from telemarketing.donotcall.gov; the first five area codes are free each year and more cost a yearly fee per area code. You must re-download at least every 31 days.

Upload the files on the **Compliance** page. Every lead is checked automatically on import, when it's created or edited, and after each upload. Matches are hidden from agents. When a client asks not to be called, set their status to "Do Not Call" — they're added to your own internal list and blocked from future imports too.

Storage note: each area code is roughly a million numbers. A free database tier holds a few area codes. For whole states, upgrade the database or use a paid scrubbing service.

### FreeDNCList check (Compliance page)

1. **Download numbers to check** — a CSV with one column of phone numbers. No names or other lead details leave the CRM.
2. Upload it at freednclist.com, pick the phone column, process, and download the results as CSV.
3. Upload the results on the Compliance page, confirm which result values mean "on the list", and save. Matches are hidden from agents and remembered, so the same number is caught if it's imported again. A later clean result undoes an earlier FreeDNCList match (never your internal list or registry matches).

With a FreeDNCList Business VIP plan, add `FREEDNC_API_KEY` and use **Check numbers automatically** instead. A failed or unclear answer is never treated as clean.

FreeDNCList is an independent service, not the government registry. It's a useful extra layer, but it doesn't replace your own SAN.

## Insurance agent screening

There's no free public database to check names against (NIPR's Producer Database is paid and per-report). Leads are hidden from agents when:
- their phone, email or full name is on your agent list (paste or upload it on the Compliance page),
- their email is at an insurance company, or
- an agent taps "They're an insurance agent" on the lead (it also adds them to the list so they're caught in future imports).

- or someone checks them on the NAIC licensee lookup. On the Compliance page, **Check leads on the NAIC agent lookup** walks through unchecked leads: tap **Look up** (it opens the NAIC search for the lead's state and copies their last name), paste, tick NAIC's terms box, search, then tap **Licensed agent** or **Not an agent**. Each lead page also has a "Check if they're a licensed agent" link. NAIC asks you to accept its terms for every search and only matches names reliably by license number, so this is a quick human check rather than an automatic one.

You can review everything under Leads → Flagged and put back anyone flagged by mistake.

## Security

- Next.js 16 / React 19 with no known vulnerabilities at release (`npm audit`).
- Passwords: bcrypt. 2FA codes can't be reused. Accounts lock for 15 minutes after 8 wrong tries; any one connection is blocked after 20 failed sign-ins in 15 minutes.
- Sessions are signed, expire after 12 hours, and are cut off instantly when a password or 2FA is reset or someone is deactivated (their phone alerts stop too).
- Agents can only reach their own leads and deals — every server action re-checks this, not just the screens.
- SSNs and bank numbers are AES-256 encrypted; every reveal is logged. Card numbers, expiry and CVV are never stored.
- Secure client links: random and unguessable, single use, 48-hour expiry. Only send them to the client’s own phone or email.
- Strict security headers (CSP, no framing, HSTS). The database connection verifies the server's certificate.

## Run locally

```
cp .env.example .env.local   # fill it in (Node 20.9 or newer)
npm install
npm run dev
```
