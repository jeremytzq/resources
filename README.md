# Resource Dashboard

A lightweight web app for looking up contacts for the partners you work with — bankers, law firms, corporate secretaries, accounting services, property agents/partners, interior designers (IDs), and mortgage brokers — rating them, and reaching them directly on WhatsApp.

## How it works

1. Pick a **Resource Type** from the dropdown (e.g. Banker).
2. Additional fields appear based on that type:
   - **Banker** shows a Bank/Company Name filter and a Residential/Commercial filter.
   - Other types show a Company/Firm Name filter.
3. Matching contacts appear below as cards, best-rated first, with a company logo, name, role, company, **★ rating**, a short review, and a **WhatsApp** button that opens a chat with that number. Contacts rated 4★ or 5★ get a "Recommended" tag.
4. Use **+ Add Contact** to add a new contact (or edit/delete an existing one via the **Edit** button on a card). You can optionally paste a **Logo URL** for the company — if left blank, or if the image fails to load, a colored initials badge is shown instead.
5. Resource types themselves aren't fixed — open **⚙ Settings → Manage Resource Types** to add a new one (e.g. "Photographer"), optionally with the same Residential/Commercial split Banker has. A type can only be deleted once no contacts are using it.

## Access model

- **Viewing contacts, star-rating them, and messaging via WhatsApp** is open to anyone who has the dashboard link — no passcode needed, including clicking the stars on a card to rate a contact.
- **Adding, editing, or deleting a contact (including its written review), managing resource types, and the ⚙ Settings panel**, are locked behind a passcode. The first time you try any of these, you'll be asked to unlock — after that it stays unlocked for the rest of your browser session (until you close the tab).
- When deployed on Vercel (see below), that passcode is checked **on the server**, using the `SETTINGS_PASSCODE` environment variable — it's never shipped to the browser, so it can't be read out of the page source. Every write request is re-checked server-side too, not just the initial unlock prompt.
- The rating action is deliberately narrow: even a hand-crafted request only ever accepts a contact id and a 1–5 rating for that action, and anything else in the request is ignored — it can't be used to change a contact's name, company, phone, or review.
- If you're running the app locally/statically without the Vercel functions available (e.g. via `python3 -m http.server`), there's no server to check the passcode against, so the app just unlocks locally — this mode is for your own machine only anyway.

## Ratings

Each contact can have:

- A **1–5 star rating** — click directly on the stars on any card to set or change it. Open to anyone viewing the dashboard, no passcode required.
- A short **review** (e.g. "Very responsive, closed the deal fast") — set via the passcode-gated Add/Edit form, alongside the rest of the contact's details.

Contacts are listed best-rated first within each resource type, and a green **Recommended** tag appears automatically for anyone rated 4★ or 5★, so you can see at a glance who's worth going back to.

## Resource types

Resource types (Banker, Law Firm, Renovation, etc.) live alongside contacts, not hardcoded — you can add your own via **⚙ Settings → Manage Resource Types** (passcode required). Deleting a type is blocked while any contact still uses it, so contacts can never end up hidden under a resource type that no longer exists.

When connected to a Google Sheet, resource types live in a second **Categories** tab, alongside the **Contacts** tab, and are automatically seeded with the dashboard's defaults the first time the sheet is used — you don't need to run anything manually for this (though `seedCategories()` is available in the Apps Script editor if you ever want to force a reseed onto an empty Categories tab).

## Data & persistence

The dashboard picks its data source automatically, in this order:

1. **Shared Google Sheet via server (recommended for a deployed dashboard).** If the app is deployed with the `/api/contacts` serverless function available and `SHEETS_API_URL` configured (see Vercel section below), every visitor automatically reads and writes the same Google Sheet — this is what makes "anyone with the link sees the whole database" work.
2. **Google Sheet, connected directly from this browser.** If you paste an Apps Script Web App URL into ⚙ Settings (see below) without server-side config, that browser talks to the Sheet directly. Useful for local testing; the connection is only remembered on that one browser.
3. **Local storage (default/fallback).** Sample contacts live in `data/contacts.json` and load on first visit; after that, anything you add/edit/delete is stored in that browser's `localStorage` only — nothing is shared across browsers or devices.

The badge next to ⚙ Settings always shows which mode is active.

## Connecting to a Google Sheet (the backing database)

Whether you use it directly (mode 2) or via the Vercel server proxy (mode 1), the Sheet + Apps Script setup is the same:

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet (e.g. name it "Resource Dashboard Contacts").
2. In the Sheet, open **Extensions → Apps Script**.
3. Delete the default placeholder code and paste in the contents of [`google-apps-script/Code.gs`](google-apps-script/Code.gs) from this repo.
4. Save the project (e.g. name it "Resource Dashboard API").
5. *(Optional)* To start with the same sample contacts as local mode: in the Apps Script editor, select the `seedSampleData` function from the function dropdown and click **Run**. Approve the permission prompts (it only needs access to this one spreadsheet).
6. Click **Deploy → New deployment**.
   - Select type: **Web app**.
   - Execute as: **Me**.
   - Who has access: **Anyone**. (Required so the app can call it without each visitor signing in with Google. This URL is a secret in its own right — see below for how it's kept away from visitors.)
7. Click **Deploy**, approve the authorization prompts, then copy the **Web app URL** (it ends in `/exec`).

**If you already had a Sheet set up before `rating`/`review`/resource-type management existed:** just paste the updated `Code.gs` into the same Apps Script project and create a new deployment version (Deploy → Manage deployments → edit → New version) — no need to recreate the Sheet. The code now reads whichever columns actually exist in row 1 and appends new fields to the end automatically the next time it writes, instead of assuming a fixed column order. It also forces the phone cell to plain-text formatting on every write, since Google Sheets can otherwise treat a leading `+` (e.g. `+6591234567`) as the start of a formula and silently strip it. A **Categories** tab is created and auto-seeded with the dashboard's default resource types the first time the updated code runs.

**If your Sheet predates the `aircon_services`/`renovation` category id rename:** after redeploying, run `migrateCategoryIds` once from the Apps Script editor's function dropdown. It rewrites the old `property_partner`/`interior_designer` ids to the new ones in both the Categories and Contacts tabs, so any contacts already saved under those types move over instead of disappearing from the dropdown. Safe to run more than once.

## Deploying to Vercel (so anyone with the link sees the shared database)

This gives every visitor automatic, live access to the same Google Sheet, with no per-browser setup:

1. Push this repo to GitHub (if not already) and import it into [Vercel](https://vercel.com/new). No framework/build settings are needed — Vercel serves the static files and picks up the two functions in `api/` automatically.
2. In the Vercel project's **Settings → Environment Variables**, add:
   - `SHEETS_API_URL` — the Apps Script `/exec` URL from the steps above. Kept server-side only; never sent to the browser.
   - `SETTINGS_PASSCODE` — a passcode of your choosing. This is what unlocks Settings and add/edit/delete for anyone using the dashboard, and it's checked server-side on every write.
3. Deploy (or redeploy if you changed env vars after the first deploy — Vercel only picks up new env vars on a fresh deployment).
4. Open the deployed URL: contacts load for everyone automatically ("Shared Google Sheet (live for everyone)" badge). Adding/editing/deleting a contact, or opening Settings, will prompt for the passcode.

**Note on scope:** hiding the Apps Script URL behind the server and passcode-gating writes covers the dashboard's own UI. The Apps Script Web App itself has no independent secret check, so if its `/exec` URL ever leaks separately, someone with it could call it directly. Treat that URL the same way you'd treat a database credential — don't paste it anywhere public. Let me know if you'd like an extra shared-secret check added inside the Apps Script itself for defense in depth.

To go back to local/offline mode from a given browser (mode 2/3), open **⚙ Settings** and click **Disconnect**.

## Running locally

Serve the folder with any static server, for example:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser. In this mode there's no `/api` server, so the app falls back to direct-Sheet or local-storage mode, and the passcode gate unlocks locally without server verification (see "Access model" above).
