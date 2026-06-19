# WriteThatDown — Week 1 Ship Plan

## Goal
Ship a paid Chrome extension with a PDF export paywall. One-time $9.99 license,
individual keys, fully local validation (HMAC-SHA256).

## Architecture decisions

- **License key**: HMAC-SHA256(email.toLowerCase().trim(), WORKER_SECRET) → hex string
- **Key generation**: Cloudflare Worker triggered by LemonSqueezy purchase webhook → emails key to buyer
- **Validation**: Runs locally in the extension via `crypto.subtle` (no network calls)
- **Paywall gate**: Single enforcement point in `print.js` (async-first, checks license before rendering)
- **Site license**: Deferred — individual licenses only for Week 1 (see TODOS.md)

## Lane status

### Lane B — shared utils + license + tests ✅ DONE
- [x] T3: Extract `escapeHtml`, `isSafeScreenshot`, `copyToClipboard` → `src/utils/shared.js`; switch HTML pages to `type="module"`
- [x] T2: `src/license/license.js` — `validateLicenseKey`, `storeLicense`, `getLicense`, `isLicensed`
- [x] T4: Vitest setup + unit tests (56 tests, 5 files)
- [x] T5: jsdom regression tests for first-field typing capture

### Lane D — paywall (requires Lane B) 🔜 NEXT
- [ ] T1: Restructure `print.js` async-first — `Promise.all([storage, isLicensed()])` before rendering;
       show paywall UI for unlicensed users with buy link + key/email entry form
- [ ] T6: Replace `setTimeout(600)` with `Promise.all(img.onload)` before `window.print()` (bundle with T1)
- [ ] T9: Add upgrade modal to PDF export buttons in `popup.js` and `editor.js`

### Lane A — worker + legal (parallel with D)
- [ ] T7: `worker/` directory — Cloudflare Worker that receives LemonSqueezy webhook,
       computes HMAC key, emails it to buyer via Resend/Mailgun
- [ ] T8: Privacy policy page (required by LemonSqueezy before storefront goes live) — **external task**

### Lane C — typing bug (low risk, polish)
- [ ] The mousedown flush fix is already in content.js and regression tests pass.
       Update CLAUDE.md to remove from known issues; spot-check React/contentEditable in real use.

## File map

```
src/
  utils/shared.js          escapeHtml, isSafeScreenshot, copyToClipboard
  license/license.js       validateLicenseKey, storeLicense, getLicense, isLicensed
  background/
    background.js          service worker (imports from shared.js + sanitise.js)
    sanitise.js            sanitiseEvent (extracted for testability)
    description-generator.js  generateDescription
  content/content.js       event capture (not a module — content script)
  popup/popup.js           recording controls + clipboard export
  editor/editor.js         guide editor + redaction
  pdf/print.js             PDF renderer (TO BE: async-first + license gate in Lane D)
worker/
  (T7) license-key-worker.js  Cloudflare Worker for key generation
tests/
  shared.test.js           escapeHtml, isSafeScreenshot
  license.test.js          validateLicenseKey round-trip
  sanitise.test.js         sanitiseEvent field truncation
  description.test.js      generateDescription branches
  content.test.js          mousedown flush regression
```

## Key constants to update before launch

- `WORKER_SECRET` in `src/license/license.js` — must match Cloudflare Worker secret
- LemonSqueezy product URL in the paywall UI (T1)
