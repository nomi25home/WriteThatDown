# WriteThatDown

A Chrome extension that records your clicks and keystrokes as you work, then generates a polished step-by-step guide with screenshots — ready to share as a PDF, paste into email/Word/Slides, or export as Markdown.

**PDF export is a Pro feature** ($9.99 one-time). Everything else is free, forever.

---

## Features

- **Action recording** — captures clicks and text input in real-time across any website
- **Automatic step descriptions** — generates human-readable descriptions for every captured action
- **Screenshots** — each step includes a screenshot of the page at the moment of the action, with a click highlight on the element
- **Full-page guide editor** — reorder steps (drag-and-drop or up/down buttons), edit titles and notes, delete steps
- **Redaction tool** — draw black boxes over sensitive information in any screenshot, with undo/redo
- **Copy to Clipboard** — inline-styled HTML that pastes cleanly into email, Word, PowerPoint, Google Docs/Slides
- **Markdown export** — for developers, Notion, GitHub wikis
- **PDF export** *(Pro)* — opens a print-ready page and triggers the browser's Save as PDF dialog automatically
- **Recording indicator** — a branded pill badge in the bottom-right corner shows when recording is active
- **Pause / Resume** — pause recording mid-session without losing captured steps

> **Privacy principle:** WriteThatDown is local-only by design. All recordings, screenshots, and guides stay on your device. No accounts, no cloud sync, no data leaves your machine.

---

## Installation (unpacked)

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `WriteThatDown/` folder.

---

## How to use

1. Click the WriteThatDown icon in the toolbar.
2. Enter a guide title, then click **Start Recording**.
3. Switch to the tab you want to document and perform your steps.
4. Click the icon again and press **Stop**.
5. Click **Edit Guide** to review, reorder, or annotate steps.
6. Export as **Copy to Clipboard**, **Markdown**, or **PDF** (Pro).

---

## How it works

| Component | Role |
|---|---|
| `src/background/background.js` | Recording state, event queue, screenshot capture, export generators |
| `src/background/description-generator.js` | Converts raw events into plain-English step descriptions |
| `src/background/sanitise.js` | Sanitises incoming event fields (length caps, type checks) |
| `src/utils/shared.js` | Shared utilities: `escapeHtml`, `isSafeScreenshot`, `copyToClipboard` |
| `src/license/license.js` | Local HMAC-SHA256 license validation (`validateLicenseKey`, `isLicensed`) |
| `src/content/content.js` | Click / typing / focus listeners injected into the active tab |
| `src/popup/` | Toolbar popup UI — start, stop, pause, export |
| `src/editor/` | Full-page step editor with drag-and-drop and redaction canvas |
| `src/pdf/` | Dedicated extension page that renders the guide and auto-triggers print |

---

## Development

```bash
bun install     # install dev dependencies (Vitest + jsdom)
bun run test    # run the test suite (56 tests)
```

Tests cover `escapeHtml`, `isSafeScreenshot`, `sanitiseEvent`, `generateDescription`,
`validateLicenseKey`, and a jsdom regression test for the first-field typing capture.

---

## Roadmap

### In progress
- [ ] **PDF paywall** — async-first `print.js` with license gate and upgrade modal (Lane D)
- [ ] **Cloudflare Worker** — receives LemonSqueezy purchase webhooks, generates license key, emails buyer (Lane A)

### Near-term
- [ ] **Page-navigation re-injection** — re-inject the content script when the user navigates mid-recording
- [ ] **Better click descriptions** — improve the "Click the element" fallback by walking the DOM for visible text or ARIA role

### Power features
- [ ] **Callout annotations** — arrows and text labels on screenshots
- [ ] **Site licenses** — one key for a team (deferred; see `TODOS.md`)

### Other platforms
- [ ] **Chrome Web Store** — privacy policy, store screenshots, public release
- [ ] **Firefox / Edge / Safari**
- [ ] **Standalone desktop apps** (Electron or Tauri)

---

## Brand

See [`BRAND.md`](BRAND.md) for the full brand kit — colours, typography, button patterns, voice & tone, and export format guidelines.

---

Built with the assistance of Claude (Anthropic).
