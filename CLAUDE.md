# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install       # install dev dependencies
bun run test      # run full test suite via Vitest (57 tests)
```

Run a single test file:
```bash
bunx vitest run tests/shared.test.js
```

**Do not use `bun test`** — that runs Bun's own runner, which doesn't support the `// @vitest-environment jsdom` annotation used by `tests/content.test.js`.

Load the extension: `chrome://extensions/` → Developer mode → Load unpacked → select this folder.

## Architecture

This is a Chrome MV3 extension. There is no build step — source files are loaded directly by Chrome.

### Data flow

1. **content.js** (injected into all tabs) captures click and typing events and sends `CAPTURE_EVENT` messages to the background.
2. **background.js** (service worker) receives events, sanitises them via `sanitise.js`, generates descriptions via `description-generator.js`, takes a screenshot via `captureVisibleTab`, and persists the event array to `chrome.storage.local`.
3. **popup.html/js** reads recording state from storage and sends control messages (`START_RECORDING`, `STOP_RECORDING`, `TOGGLE_PAUSE`, `EXPORT_*`) to the background.
4. **editor.html/js** reads the event array from storage directly, renders editable step cards, writes changes back to storage.
5. **print.html/js** reads the event array from storage, builds a full HTML document, replaces the page via `document.write()`, then calls `window.print()`.

### Key invariants

- **ES modules everywhere except content.js.** `popup.js`, `editor.js`, `print.js`, and `background.js` use `import/export`. `content.js` is a plain script (content scripts cannot be ES modules) guarded by `window.__wtdActive` to prevent double-injection.
- **Shared utilities** live in `src/utils/shared.js` — `escapeHtml`, `isSafeScreenshot`, `copyToClipboard`. Import from here; do not duplicate.
- **All user-derived strings must pass through `escapeHtml` before being inserted into HTML.** Screenshots must pass through `isSafeScreenshot` before use in `<img src>`. This contract is enforced in all three HTML-generating paths (background.js, editor.js, print.js).
- **`sanitiseEvent` (in `src/background/sanitise.js`) strips unknown fields and caps string lengths.** It runs in the background before any event is stored. `generateDescription` must receive the already-sanitised event, not the raw content-script message.
- **License validation is local only** — `crypto.subtle` HMAC-SHA256 against `WORKER_SECRET`. No network calls. The `WORKER_SECRET` constant in `src/license/license.js` is a placeholder that must be replaced before packaging a release ZIP.

### Message trust model

`background.js` enforces two sender checks:
- `isFromExtension(sender)` — for control messages (`START_RECORDING`, `EXPORT_*`, etc.): requires `sender.id === chrome.runtime.id` and URL prefixed with the extension's own origin.
- `isFromContentScript(sender)` — for `CAPTURE_EVENT`: requires `sender.id === chrome.runtime.id` AND `sender.tab` is set (i.e., a real tab context).

### Testing approach

- **Unit tests** (`tests/shared.test.js`, `tests/sanitise.test.js`, `tests/license.test.js`, `tests/description.test.js`): pure functions, no Chrome API mocks needed.
- **DOM regression test** (`tests/content.test.js`): `// @vitest-environment jsdom`, reads `content.js` source via `readFileSync` and `eval`s it into the jsdom context with `global.chrome` mocked. This is the pattern to follow for testing content.js behaviour.
- Chrome extension APIs (`chrome.storage`, `chrome.tabs`, `chrome.scripting`) are **not mocked** in the current suite — background.js is not directly imported in tests. See `TODOS.md` for the deferred SW-restart regression test.

## Important files

| File | Role |
|------|------|
| `src/background/sanitise.js` | Extracted from background.js for testability — no Chrome API imports |
| `src/license/license.js` | `validateLicenseKey`, `storeLicense`, `getLicense`, `isLicensed` — all async |
| `src/utils/shared.js` | `escapeHtml`, `isSafeScreenshot`, `copyToClipboard` |
| `docs/PLAN.md` | Week 1 lane structure — Lane D (paywall) and Lane A (Cloudflare Worker) are next |
| `TODOS.md` | Deferred items: site license, free tier step limit, SW restart test |
| `docs/SECURITY-AUDIT.md` | Full security audit findings and remediation status |
| `BRAND.md` | Colours, typography, button patterns — consult before any visual changes |

## Roadmap context

**Lane D (next):** Restructure `print.js` async-first — `Promise.all([storage get, isLicensed()])` before rendering; show paywall UI for unlicensed users. Replace `setTimeout(600)` with `Promise.all(img.onload)`. Add upgrade modal to PDF buttons in popup and editor.

**Lane A (parallel):** `worker/` directory — Cloudflare Worker that receives LemonSqueezy webhook, computes HMAC key, emails it to buyer.

**Privacy principle:** Local-only by design. Do not suggest features that require a backend, cloud storage, or sending user data externally.
