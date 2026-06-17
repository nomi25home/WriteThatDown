# WriteThatDown

A Chrome extension that records your clicks and keystrokes as you work, then generates a polished step-by-step guide with screenshots — ready to share as a PDF, paste into email/Word/Slides, or export as Markdown.

---

## Features

- **Action recording** — captures clicks and text input in real-time across any website
- **Automatic step descriptions** — generates human-readable descriptions for every captured action
- **Screenshots** — each step includes a screenshot of the page at the moment of the action, with a red rectangle highlight on the clicked element
- **Full-page guide editor** — reorder steps (drag-and-drop or up/down buttons), edit titles and notes, delete steps
- **Redaction tool** — draw black boxes over sensitive information in any screenshot, with undo/redo
- **PDF export** — opens a print-ready page and triggers the browser's Save as PDF dialog automatically
- **Copy to Clipboard** — inline-styled HTML that pastes cleanly into email, Word, PowerPoint, Google Docs/Slides
- **Markdown export** — for developers, Notion, GitHub wikis
- **Recording indicator** — a branded pill badge in the bottom-right corner shows when recording is active
- **Pause / Resume** — pause recording mid-session without losing captured steps

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `scribe-clone/` folder.

## How to use

1. Click the WriteThatDown icon in the toolbar.
2. Enter a guide title, then click **Start Recording**.
3. Switch to the tab you want to document and perform your steps.
4. Click the icon again and press **Stop**.
5. Click **Edit Guide** to review, reorder, or annotate steps.
6. Export as **PDF**, **Copy to Clipboard**, or **Markdown**.

## How it works

| Component | Role |
|---|---|
| `src/background/background.js` | Recording state, event queue, screenshot capture, export generators |
| `src/content/content.js` | Click / typing / focus listeners injected into the active tab |
| `src/popup/` | Toolbar popup UI — start, stop, pause, export |
| `src/editor/` | Full-page step editor with drag-and-drop and redaction canvas |
| `src/pdf/` | Dedicated extension page that renders the guide and auto-triggers print |
| `src/background/description-generator.js` | Converts raw events into plain-English step descriptions |

## Known issues

| # | Issue | Status |
|---|---|---|
| 1 | **First typed field not captured** — when recording starts, the very first input field the user types into is sometimes not captured as a step. Subsequent fields work correctly. Root cause is still under investigation (suspected: React/contentEditable frameworks returning stale `el.value` at blur time, combined with Chrome service worker restart timing). **Workaround:** click into any other element first, then type in the target field. | Open |

## Roadmap

### Near-term (polish & stability)
- [ ] **Fix first-field typing bug** — instrument the blur/input/mousedown pipeline with console diagnostics to pinpoint exactly which condition fails for specific sites (Reddit Slate editor, etc.)
- [ ] **Page-navigation re-injection** — the content script dies when the user navigates to a new URL mid-recording; detect the navigation and re-inject automatically to keep the session alive
- [ ] **Better click descriptions** — "Click the element" fallback is not useful; improve by walking up the DOM for nearest visible text, role, or landmark

### Distribution
- [ ] **Chrome Web Store submission** — privacy policy, store screenshots, version bump to `1.0`
- [ ] **Version tagging** — tag `v1.0` release on GitHub once known issues are resolved

### Power features
- [ ] **Callout annotations** — draw arrows and text labels on screenshots to highlight the click target
- [ ] **AI-generated descriptions** — send screenshot + click context to an LLM (local via Ollama or Claude API) for richer, context-aware step text
- [ ] **Google Slides / PowerPoint export** — one-click deck generation from a recorded guide
- [ ] **Pause indicator** — show a distinct "⏸ Paused" state on the recording badge

### Future / longer-term
- [ ] **Shareable link** — host a guide as a public URL (requires a backend)
- [ ] **Team / organisation guides** — shared library of recorded workflows

## Brand

See [`BRAND.md`](BRAND.md) for the full brand kit — colours (sampled from the app icon), typography, button patterns, voice & tone, and export format guidelines.

## Acknowledgements

Built with the assistance of Claude (Anthropic).
