# Homepage Styling Design — Figma Alignment

**Date:** 2026-04-06  
**Scope:** `website/` — homepage only (docs deferred)  
**Approach:** Option A — CSS overrides + config change, no TSX modifications

## Goals

Align the homepage visual design with the Figma spec (node `17331:10253`) using CSS and config changes only. Illustrations deferred to a separate task.

## Changes

### 1. `website/docusaurus.config.ts`

Update the `announcementBar` entry:

| Property | Before | After |
|---|---|---|
| `backgroundColor` | `'#9E6FF3'` (lilac) | `'#ffe3ad'` (amber/cream) |
| `textColor` | (default) | `'#1a0f2e'` (dark void) |

### 2. `website/src/css/custom.css`

Add two rules:

**Navbar brand name color** — `.navbar__title` → `color: #b896ff` (lilac-300)

**Hero text color** — `.hero__title, .hero__subtitle` → `color: #faf0f0` (warm cream)

### 3. `website/src/pages/index.module.css`

Override the hero "Get Started" button:

```css
.heroBanner :global(.button) {
  background: #faf0f0;
  color: #1c1e21;
  border: 1px solid #ebedf0;
  border-radius: 6px;
  font-weight: bold;
}
.heroBanner :global(.button:hover) {
  background: #ffffff;
  border-color: #d0d0d0;
}
```

## Out of Scope

- Feature section illustrations (user will supply SVG files separately)
- Docs page styling (next task after homepage)
- No new files, no TSX changes
