# Resource Dashboard

A lightweight, no-build web app for looking up contacts for the partners you work with — bankers, law firms, corporate secretaries, accounting services, property agents/partners, interior designers (IDs), and mortgage brokers — and reaching them directly on WhatsApp.

## How it works

1. Pick a **Resource Type** from the dropdown (e.g. Banker).
2. Additional fields appear based on that type:
   - **Banker** shows a Bank/Company Name filter and a Residential/Commercial filter.
   - Other types show a Company/Firm Name filter.
3. Matching contacts appear below as cards with a company logo, name, role, company, and a **WhatsApp** button that opens a chat with that number.
4. Use **+ Add Contact** to add a new contact (or edit/delete an existing one via the **Edit** button on a card). You can optionally paste a **Logo URL** for the company — if left blank, or if the image fails to load, a colored initials badge is shown instead.

## Data & persistence

By default, the dashboard runs in **local mode**:

- Sample contacts live in `data/contacts.json` and are loaded the first time you open the app.
- After that, all contacts (including anything you add/edit/delete) are stored in the browser's `localStorage`, so changes persist across reloads on the same browser/device only — nothing is shared across browsers or devices.
- To reset back to the sample data, clear this site's local storage (or open dev tools → Application → Local Storage → delete the `resourceDashboard.contacts.v1` key) and reload.

For a real shared database, connect it to a **Google Sheet** instead (see below) — then every add/edit/delete goes straight to the Sheet, and the Sheet becomes the single source of truth across any browser/device.

## Connecting to a Google Sheet

The dashboard can use a Google Sheet as its database via a small Google Apps Script Web App (no separate server or hosting needed — Google hosts the script for you).

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet (e.g. name it "Resource Dashboard Contacts").
2. In the Sheet, open **Extensions → Apps Script**.
3. Delete the default placeholder code and paste in the contents of [`google-apps-script/Code.gs`](google-apps-script/Code.gs) from this repo.
4. Save the project (e.g. name it "Resource Dashboard API").
5. *(Optional)* To start with the same sample contacts as local mode: in the Apps Script editor, select the `seedSampleData` function from the function dropdown and click **Run**. Approve the permission prompts (it only needs access to this one spreadsheet).
6. Click **Deploy → New deployment**.
   - Select type: **Web app**.
   - Execute as: **Me**.
   - Who has access: **Anyone**. (This is required so the dashboard page can call it without asking each visitor to sign in with Google — treat the resulting URL like a password: anyone who has it can read/write this sheet, so don't share it publicly.)
7. Click **Deploy**, approve the authorization prompts, then copy the **Web app URL** (it ends in `/exec`).
8. Back in the dashboard, click **⚙ Settings** in the top bar, paste the URL into **Apps Script Web App URL**, and click **Save & Connect**.

Once connected, the badge next to Settings shows "Google Sheet connected", and you can also open the Sheet directly any time to bulk-edit contacts, add columns for your own use, or share it with teammates via normal Google Sheets sharing.

To go back to local/offline mode, open **⚙ Settings** and click **Disconnect**.

## Running locally

No build step is required — it's plain HTML/CSS/JS. Serve the folder with any static server, for example:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser.
