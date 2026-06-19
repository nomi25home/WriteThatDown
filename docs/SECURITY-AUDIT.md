# WriteThatDown — Security Audit Report

**Date:** 2026-06-19  
**Scope:** Chrome MV3 extension source, devDependency supply chain  
**Auditor:** CSO skill (Claude Code)  
**Session:** cso/14017-1781844957

---

## Findings Summary

| # | Severity | Title | Status |
|---|----------|-------|--------|
| C1 | CRITICAL | Vitest CVE GHSA-5xrq-8626-4rwp — arbitrary file read/execute | **FIXED** |
| H1 | HIGH | `web_accessible_resources` match too broad — any extension can load editor.html | **FIXED** |
| M1 | MEDIUM | No `.gitignore` — node_modules & macOS junk exposed to `git add` | **FIXED** |
| M2 | MEDIUM | `.DS_Store` tracked in git (contains Finder metadata) | **FIXED** |
| L1 | LOW | `generateDescription` called with unsanitised event (bypasses length caps) | **FIXED** |
| L2 | LOW | Markdown export injects `event.screenshot` without `isSafeScreenshot` guard | **FIXED** |
| I1 | INFO | `WORKER_SECRET` placeholder bundled in extension ZIP | Accepted — pre-launch checklist |
| I2 | INFO | `captureVisibleTab(null)` captures focused window, not recording tab | Accepted — UX bug, not security |

---

## Detailed Findings

### C1 — CRITICAL: Vitest CVE GHSA-5xrq-8626-4rwp

**Affected version:** `vitest ^2.0.0` (pinned in `package.json`)  
**CVE:** GHSA-5xrq-8626-4rwp  
**Impact:** Attacker with network access to the Vitest UI dev server (localhost:51204 by default) can read arbitrary files from the developer's machine, including `.env` files and SSH keys. Affects any developer machine running `vitest --ui`.

**Fix applied:** `package.json` `vitest` upgraded from `^2.0.0` → `^3.2.6`. Verified 56/56 tests pass.

**Note on test command:** `bun test` runs Bun's own test runner (which doesn't support the `// @vitest-environment jsdom` annotation). Always use `bun run test` to invoke Vitest.

---

### H1 — HIGH: `web_accessible_resources` too broad

**Location:** `manifest.json` — `web_accessible_resources[0].matches`  
**Before:** `["chrome-extension://*/*"]`  
**Impact:** Any other installed Chrome extension could load `src/editor/editor.html` in a frame or navigate to it. This expands the attack surface for cross-extension message spoofing: a compromised extension could interact with the editor UI or send `chrome.runtime` messages that appear to come from an extension context.

**Analysis:** `popup.html` opens `editor.html` via `chrome.tabs.create({ url: chrome.runtime.getURL(...) })`. Extension pages can always navigate to other same-extension pages without `web_accessible_resources` — WAR is only needed for web pages or foreign extensions to access the resource.

**Fix applied:** `web_accessible_resources` section removed from `manifest.json` entirely. Popup → editor navigation is unaffected.

---

### M1 — MEDIUM: No `.gitignore`

**Before:** No `.gitignore` file in the repo.  
**Impact:** Running `git add .` (or `git add -A`) would commit `node_modules/` (≈95 packages), `.DS_Store`, and `.sync-conflict-*` files. A large `node_modules` push is hard to remove from git history; `.DS_Store` leaks directory structure to public repos.

**Fix applied:** `.gitignore` created with:
```
node_modules/
.DS_Store
._*
.sync-conflict-*
dist/
*.zip
.vite/
```

---

### M2 — MEDIUM: `.DS_Store` previously tracked in git

**Before:** `.DS_Store` was committed and tracked in git.  
**Fix applied:** `git rm --cached .DS_Store` run; file now covered by `.gitignore`.

---

### L1 — LOW: `generateDescription` used unsanitised event data

**Location:** `src/background/background.js:97`  
**Before:**
```js
events.push({
  ...sanitiseEvent(message.event),
  description: generateDescription(message.event),  // original, unsanitised
  ...
});
```
**Impact:** `generateDescription` embeds `event.fieldLabel` and `event.text` (from content script, untruncated) into the `description` string. A page with a field whose `aria-label` is 300+ chars would create an oversized description, bypassing sanitiseEvent's 100-char fieldLabel cap. The description is also used verbatim in Markdown export.

HTML output paths use `escapeHtml(event.description)` so XSS is not possible there, but the length bypass is real.

**Fix applied:** `generateDescription(clean)` now receives the already-sanitised event object.

---

### L2 — LOW: Markdown export missing `isSafeScreenshot` guard

**Location:** `src/background/background.js:259`  
**Before:**
```js
if (event.screenshot) md += `![Step ${index + 1} Screenshot](${event.screenshot})\n\n`;
```
**Impact:** If storage is somehow corrupted with a non-data-URI screenshot value (e.g., an `http://` URL), it would be embedded raw in the Markdown. Low probability (screenshots come from `chrome.tabs.captureVisibleTab` which always returns JPEG data URIs), but inconsistent with the HTML paths.

**Fix applied:** Changed to `if (isSafeScreenshot(event.screenshot))`.

---

### I1 — INFORMATIONAL: `WORKER_SECRET` placeholder bundled in extension

**Location:** `src/license/license.js:1`  
**Value:** `const WORKER_SECRET = '__REPLACE_WITH_WORKER_SECRET__';`

This is a known, accepted MVP tradeoff documented in `docs/PLAN.md`. When the real secret is inserted before packaging, anyone who downloads the extension ZIP can extract it and generate valid license keys.

**Mitigation:** For MVP, accept. See `TODOS.md` for the longer-term server-side validation option.  
**Pre-launch checklist:** Replace placeholder with actual secret before building the release ZIP.

---

### I2 — INFORMATIONAL: `captureVisibleTab(null)` captures focused window

**Location:** `src/background/background.js:167`  
```js
return await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 50 });
```
Passing `null` as the window ID captures the currently-focused browser window, not necessarily the window/tab that fired the event. If the user alt-tabs to another window between the click and the screenshot, the wrong window is captured.

**Not a security issue** — a UX bug. Deferred to a future fix (pass `sender.tab.windowId` explicitly).

---

## What Was Verified Clean

| Area | Finding |
|------|---------|
| XSS surfaces | All dynamic values in innerHTML/document.write/template strings are passed through `escapeHtml()`. Verified in background.js, editor.js, print.js. |
| Message handler trust | `isFromExtension` + `isFromContentScript` guards on all handlers; CAPTURE_EVENT restricted to tab senders. |
| Screenshot validation | `isSafeScreenshot` guards all `<img src>` injections in HTML output. |
| Password capture | `isPasswordField` check in content.js; passwords recorded as `[password]` placeholder. |
| eval / Function usage | None found across all source files. |
| External network calls | None — fully local. No `host_permissions`, no `fetch` to external URLs. |
| git history | No `.env` files, no real secrets found in git log. `WORKER_SECRET` is a placeholder only. |
| CSP | All extension pages have `default-src 'self'; img-src data: blob:; style-src 'unsafe-inline'`. |
| Dependency audit | 5 CVEs in devDependencies (all in vitest/vite ecosystem) — all resolved by upgrade to vitest ^3.2.6. |

---

## Remediation Status

All CRITICAL, HIGH, MEDIUM, and LOW findings have been fixed in this session:

```
commit: security fixes (post-audit)
- vitest upgraded 2.x → 3.2.6 (CVE GHSA-5xrq-8626-4rwp)
- web_accessible_resources removed from manifest (H1)
- .gitignore added; .DS_Store untracked (M1, M2)
- generateDescription now uses sanitised event (L1)
- Markdown export uses isSafeScreenshot guard (L2)
```
