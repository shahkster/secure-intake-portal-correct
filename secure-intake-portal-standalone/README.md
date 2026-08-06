# Secure Intake Portal — Standalone Version

This is a complete standalone website. It does **not** require a CRM.

It includes:

- One-agent email/password login
- Persistent requests stored in Supabase
- Random client links that work on another phone or computer
- 48-hour expiration
- Last-name verification with a three-attempt lockout
- SSN and date of birth can be requested separately or together
- Optional routing and account-number collection
- ABA routing-number checksum validation
- AES-256-GCM encryption before sensitive values are stored
- Masked SSN and account-number review
- One-time submission links
- Audit events for important actions
- Permanent deletion from the dashboard

## What you need

1. A free Supabase account for the database
2. A free Vercel account for the website
3. Node.js LTS installed on your computer

## Part 1 — Create the database

1. Go to Supabase and create a new project.
2. Wait for the project to finish setting up.
3. Open **SQL Editor** in the Supabase dashboard.
4. Open the file `supabase/schema.sql` from this folder.
5. Copy the entire file into the SQL Editor and click **Run**.

If you already set up an earlier version of this portal, run
`supabase/add-dob-option.sql` once in the SQL Editor instead. It adds the
separate DOB option without deleting existing requests.

6. In Supabase, open **Project Settings > API Keys**.
7. Copy:
   - Project URL
   - Secret key beginning with `sb_secret_`

Never place the secret key in frontend code, GitHub, email, or a client link.

## Part 2 — Configure and test locally

### Mac

1. Double-click `start-mac.command`.
2. If macOS blocks it, right-click it and choose **Open**.

### Windows

1. Double-click `start-windows.bat`.

The setup asks for:

- Supabase project URL
- Supabase secret key
- Your agent login email
- Your agent login password

It creates a private `.env.local` file containing those settings and three random encryption/signing secrets.

The local website normally opens at:

```text
http://localhost:3000
```

You may be asked to sign into Vercel the first time `vercel dev` runs.

## Part 3 — Put the site online

Open Terminal or Command Prompt inside this project folder and run:

```bash
npm install
npx vercel login
npx vercel link
```

When `vercel link` asks questions:

- Set up this project: **Yes**
- Choose your Vercel account
- Link to an existing project: **No**
- Project name: choose any name, such as `secure-client-intake`
- Directory: press Enter to use the current directory

Then open your Vercel dashboard:

1. Select the new project.
2. Open **Settings > Environment Variables**.
3. Open your local `.env.local` file in a text editor.
4. Add every variable from that file to Vercel:
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `SESSION_SECRET`
   - `DATA_ENCRYPTION_KEY`
   - `VERIFY_PEPPER`
   - `REQUEST_EXPIRY_HOURS`
5. Apply each variable to Production, Preview, and Development.
6. Return to Terminal and run:

```bash
npx vercel --prod
```

Vercel will display the public website address when deployment finishes.

## Testing the live flow

1. Open the Vercel address and sign in as the agent.
2. Create a request using a fake client name.
3. Copy the generated link.
4. Open the link in a private/incognito window or on another phone.
5. Enter the fake client last name.
6. Enter the fictitious DOB, SSN, and/or bank information selected for that request.
7. Submit it.
8. Return to the agent dashboard and click **Refresh**.
9. Click **Review**.

Use fictitious data only during testing. A routing number must pass the ABA checksum; `021000021` is suitable for testing the validation logic.

## Important operational notes

- Keep `.env.local` private. It is ignored by Git automatically.
- Do not change `DATA_ENCRYPTION_KEY` while records exist. Existing records would become unreadable.
- Changing `VERIFY_PEPPER` invalidates verification for pending links.
- Changing `SESSION_SECRET` signs every agent and client session out.
- The portal is configured for one agent login. Multiple agents require a real user-management system.
- Last-name-only verification is intentionally what was requested, but it is weak identity verification. Add an SMS code before using this as a production intake method.
- This code provides technical safeguards but is not a compliance certification or independent security audit.

## Files you may customize

- Portal wording and layout: `src/App.jsx`
- Colors and spacing: `src/styles.css`
- Link expiration: `REQUEST_EXPIRY_HOURS` environment variable
- Database schema: `supabase/schema.sql`
