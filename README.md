# Resource Dashboard

A lightweight, no-build web app for looking up contacts for the partners you work with — bankers, law firms, corporate secretaries, accounting services, property agents/partners, interior designers (IDs), and mortgage brokers — and reaching them directly on WhatsApp.

## How it works

1. Pick a **Resource Type** from the dropdown (e.g. Banker).
2. Additional fields appear based on that type:
   - **Banker** shows a Bank/Company Name filter and a Residential/Commercial filter.
   - Other types show a Company/Firm Name filter.
3. Matching contacts appear below as cards with name, role, company, and a **WhatsApp** button that opens a chat with that number.
4. Use **+ Add Contact** to add a new contact (or edit/delete an existing one via the **Edit** button on a card).

## Data & persistence

- Sample contacts live in `data/contacts.json` and are loaded the first time you open the app.
- After that, all contacts (including anything you add/edit/delete) are stored in the browser's `localStorage`, so changes persist across reloads on the same browser/device.
- To reset back to the sample data, clear this site's local storage (or open dev tools → Application → Local Storage → delete the `resourceDashboard.contacts.v1` key) and reload.

## Running locally

No build step is required — it's plain HTML/CSS/JS. Serve the folder with any static server, for example:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser.
