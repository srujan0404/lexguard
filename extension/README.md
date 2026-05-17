# LexGuard Chrome extension (Manifest V3)

A consent firewall in your toolbar. Detects legal pages, scans them on demand against the same Cloud Run backend the website uses, and shows a compact scorecard inline.

## Side-load (for judges)

1. Open `chrome://extensions` in Chrome (or any Chromium browser).
2. Toggle **Developer mode** in the top-right.
3. Click **Load unpacked** and select this `extension/` folder.
4. Pin the LexGuard icon to the toolbar (puzzle-piece menu → pin).

## Use it

1. Navigate to any terms / privacy / refund policy / offer letter page.
2. The toolbar icon shows a red `!` badge when LexGuard detects legal text (URL pattern or keyword density >= 8 hits).
3. Click the LexGuard icon → pick the document domain (Employment / Privacy / Ticketing / Consumer / Rental / Generic) → click **Scan this page**.
4. Wait ~30–60 s. The popup renders severity, risk score 0–100, recycled-template banner, severity histogram, and the top 3 concerns.
5. Click **Open full report ↗** to jump to the full editorial scorecard on the website.

## Settings

Click **settings** in the popup footer (or `chrome://extensions/?options=<id>`) to override:

- **Backend (Cloud Run)** — point at a local `http://localhost:8000` while developing.
- **Website (full report link)** — point at `http://localhost:3000` while developing.

Defaults target the deployed Cloud Run + website.

## Privacy

- The extension never sends any data without an explicit click on **Scan this page**.
- The content script reads only the active tab's visible text, capped at 60 000 characters, when you click Scan.
- No tracking, no analytics, no third-party scripts.

## Files

- `manifest.json` — MV3 manifest with `activeTab`, `scripting`, `storage` perms and `<all_urls>` host access for content script + API fetch.
- `content.js` — page heuristics + text extraction (guarded against double-injection).
- `background.js` — service worker that badges the toolbar icon when legal text is detected.
- `popup.html` / `popup.css` / `popup.js` — 380×520 popup, Midnight Edition styling matching the website.
- `options.html` / `options.js` — backend/website URL overrides stored in `chrome.storage.sync`.
- `icons/{16,48,128}.png` — shield-with-accent-mark generated programmatically; replace if you prefer a different mark.
