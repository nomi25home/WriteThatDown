# WriteThatDown — Brand Kit

> All colours are sampled directly from the app icon (`icons/ChatGPT Image Jun 17, 2026, 01_03_49 PM.png`).
> Reference this file whenever adding UI, copy, or assets to the extension.

---

## Logo

| Asset | Path | Use |
|---|---|---|
| 16×16 | `icons/icon16.png` | Browser favicon, small contexts |
| 32×32 | `icons/icon32.png` | Toolbar (HiDPI) |
| 48×48 | `icons/icon48.png` | Extension card, in-app headers |
| 128×128 | `icons/icon128.png` | Chrome Web Store listing |
| Source | `icons/ChatGPT Image Jun 17, 2026, 01_03_49 PM.png` | Original high-res (do not delete) |

**Logo usage rules**
- Always use the PNG assets — never re-draw or stretch the icon.
- Minimum display size: 16×16 px.
- In in-app headers, display at 28 px height with `border-radius: 6px` alongside the wordmark.

---

## Wordmark

`WriteThatDown` — one word, title case, no spaces.

**Never write:** Write That Down / writethatdown / WTD (except as a recognised abbreviation in headings)

---

## Colour Palette

All colours sampled from the icon by pixel analysis.

### Primary

| Name | Hex | Source in icon | Use |
|---|---|---|---|
| **Brand Blue** | `#0a44ec` | Gradient right/bottom edge | Primary CTA buttons, step number badges, active states, links, wordmark |
| **Brand Navy** | `#100d8a` | Gradient left edge (darkest) | Dark text, topbar, primary button bg |
| **Brand Indigo** | `#3811bc` | Gradient top | Gradient start, hover states, accent |
| **Pencil Blue** | `#2021d2` | Pencil shaft | Secondary actions, focus rings |

### Secondary / Accents

| Name | Hex | Source in icon | Use |
|---|---|---|---|
| **Soft Lavender** | `#9c8bf9` | Pencil eraser | Soft accents, tags, pills |
| **Muted Lavender** | `#9a9bde` | Pencil ferrule | Disabled states, muted borders |
| **Document Blue** | `#e8ebf9` | Document surface in icon | Card backgrounds, input backgrounds, surface tint |
| **Deep Navy** | `#051685` | Checkmark | Darkest text, high-contrast elements |

### Neutral / UI

| Name | Hex | Use |
|---|---|---|
| **White** | `#ffffff` | Page bg, topbar, modal bg |
| **Page BG** | `#f5f5f5` | Editor/page background |
| **Border** | `#e8e8e8` | Card borders, dividers |
| **Text Primary** | `#111111` | Body text, headings |
| **Text Secondary** | `#555555` | Sub-descriptions, secondary copy |
| **Text Muted** | `#888888` | Metadata, timestamps, labels |
| **Success** | `#16a34a` | Saved/copied confirmation states |
| **Danger** | `#dc2626` | Delete, error states |

### Gradient

The icon background uses a diagonal gradient. Use this for hero/cover elements:

```css
background: linear-gradient(135deg, #3811bc 0%, #100d8a 30%, #0a44ec 100%);
```

---

## Typography

**Font stack:**
`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`

| Role | Size | Weight |
|---|---|---|
| Page title / H1 | 28–32 px | 800 |
| Section heading / H2 | 20 px | 700 |
| Step title | 16 px | 700 |
| Body / notes | 13–15 px | 400 |
| Labels / metadata | 10–12 px | 700 (uppercase, 0.08em tracking) |
| Footer / attribution | 12 px | 400 |

---

## Voice & Tone

- **Concise** — every word earns its place.
- **Action-first** — step descriptions start with a verb: *Click*, *Type*, *Select*.
- **Friendly, not casual** — professional enough for work, warm enough to not feel robotic.
- **Present tense** — "Click the button" not "You should click the button".

### In-product copy

| Context | Copy |
|---|---|
| Recording indicator | `Writing it down…` |
| Popup header | `Guide Creator` |
| Empty state | `No steps recorded yet. Start a recording to capture steps.` |
| Saved confirmation | `Saved` |
| Copied confirmation | `Copied!` |
| Footer attribution | `Created with WriteThatDown` / `Powered by WriteThatDown` |

---

## UI Patterns

### Buttons

| Type | BG | Text | Border |
|---|---|---|---|
| Primary | `#111111` | `#fff` | `#111111` |
| CTA / apply | `#0a44ec` | `#fff` | `#0a44ec` |
| Default | `#fff` | `#333` | `#ddd` |
| Danger | `#fff5f5` | `#dc2626` | `#fca5a5` |
| Success (transient) | `#16a34a` | `#fff` | — |

Border-radius: `6px`. Font-size: `13px`, weight `500`.

### Step number badges

- Shape: circle, 28–30 px
- Background: `#0a44ec`
- Text: `#fff`, 13 px, weight 700

### Cards (step cards)

- Background: `#fff`
- Border: `1px solid #e8e8e8`
- Border-radius: `12px`
- Box-shadow: `0 1px 4px rgba(0,0,0,0.04)`
- Hover shadow: `0 4px 12px rgba(0,0,0,0.08)`
- Focus/active border: `#0a44ec`

### Focus rings / active inputs

```css
border-color: #0a44ec;
box-shadow: 0 0 0 3px rgba(10, 68, 236, 0.15);
```

---

## Export Formats

| Format | Audience | Notes |
|---|---|---|
| **PDF** | Formal / print / sharing | Opens print dialog in new tab; print-optimised layout |
| **Markdown** | Developers, Notion, GitHub | Screenshots embedded as base64 data URLs |
| **Copy to Clipboard** | Email, Word, PPT, Google Docs/Slides | Inline-styled HTML; no `<style>` blocks |

---

## File Structure Reference

```
WriteThatDown/
├── icons/                     ← All logo assets (source + generated PNGs)
├── src/
│   ├── background/
│   │   ├── background.js          ← State, messaging, export generators
│   │   └── description-generator.js  ← Human-readable step descriptions
│   ├── content/
│   │   └── content.js             ← Event capture, click highlight, recording indicator
│   ├── editor/
│   │   ├── editor.html            ← Full-page guide editor
│   │   └── editor.js              ← Edit, reorder, redact, export logic
│   └── popup/
│       ├── popup.html             ← Extension popup UI
│       └── popup.js               ← Popup logic
├── manifest.json
├── BRAND.md                   ← This file — single source of truth for brand
└── README.md
```
