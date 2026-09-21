# HRSign Brand Identity Guidelines

> Version 1.0 — 2026-09

This document defines the HRSign brand identity system and its usage rules.
All brand assets are located in `public/brand/`.

---

## 1. Brand Concept

HRSign is an enterprise HR document signing and sealing platform. The brand
mark communicates three core ideas:

| Element | Meaning |
|---------|---------|
| **Blue rounded square** | Trust, professionalism, enterprise-grade reliability |
| **White document with folded corner** | The document — the central object being signed |
| **Signature pen stroke** | The signing action — human handwriting on paper |
| **Seal checkmark** | The sealing/stamp action — verification and completion |

The icon works as a visual metaphor: a document enters the system, gets
signed, and is sealed — the full HRSign lifecycle in one mark.

---

## 2. Logo Variations

### 2.1 Primary Logo (Horizontal)

File: `logo-horizontal.svg`

Icon + wordmark in a horizontal lockup. Use this in the application sidebar,
email headers, and marketing pages where horizontal space is available.

```
[Icon]  HRSign
```

### 2.2 Stacked Logo (Vertical)

File: `logo-stacked.svg`

Icon above the wordmark with the tagline below. Use this in login pages,
loading screens, and standalone brand placements.

```
   [Icon]
  HRSign
HR e-Sign & Sealing
```

### 2.3 Icon Only

File: `logo-icon.svg`

The mark without the wordmark. Use this as the application icon, favicon, and
in tight spaces (≤ 48px) where the wordmark would be illegible.

### 2.4 White Icon Variant

File: `logo-icon-white.svg`

All-white version with transparent background. Use this on dark or
brand-colored backgrounds (e.g., dark mode, colored hero sections).

---

## 3. Color Palette

### 3.1 Primary Brand Colors

| Role | Name | Hex | Usage |
|------|------|-----|-------|
| Primary | Signature Blue | `#2563EB` | Logo background, brand accents, primary buttons |
| Ink | Dark Slate | `#1E293B` | Wordmark "Sign" portion, headings, body text |
| Paper | White | `#FFFFFF` | Document shape in icon, light backgrounds |
| Fold Tint | Light Blue | `#DBEAFE` | Document fold shadow, subtle accents |

### 3.2 Functional Colors

| Role | Hex | Usage |
|------|-----|-------|
| Success | `#16A34A` | Completed states, positive indicators |
| Warning | `#F59E0B` | Pending states, expiration warnings |
| Danger | `#DC2626` | Rejected states, destructive actions |
| Muted | `#64748B` | Secondary text, taglines, captions |
| Border | `#E2E8F0` | Card borders, dividers |

### 3.3 Color Usage Rules

- **Do** use Signature Blue as the dominant brand color in UI chrome
  (sidebar, header, primary buttons).
- **Do** use functional colors only for their semantic purpose, not for
  decoration.
- **Don't** create new shades of blue outside the defined palette.
- **Don't** use Signature Blue for large body text areas — it is reserved
  for accents and interactive elements.

---

## 4. Typography

### 4.1 Font Family

| Usage | Font | Fallbacks |
|-------|------|-----------|
| UI & Headings | Geist Sans | -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif |
| Code & Mono | Geist Mono | "SF Mono", Monaco, Consolas, monospace |

### 4.2 Wordmark Treatment

The "HRSign" wordmark uses Geist Sans Bold (700) with tight letter-spacing
(-1px). The "HR" portion is set in Signature Blue (`#2563EB`) and the "Sign"
portion in Dark Slate (`#1E293B`), creating a visual link between the icon
(blue) and the brand initial.

### 4.3 Type Scale (UI)

| Element | Size | Weight |
|---------|------|--------|
| Page title (h1) | 20px | 600 |
| Section title (h2) | 16px | 600 |
| Body text | 14px | 400 |
| Caption/Label | 12px | 500 |
| Micro text | 10px | 400 |

---

## 5. Clear Space & Minimum Sizes

### 5.1 Clear Space

The logo requires clear space equal to the height of the icon's blue
background square on all sides. No other element (text, image, UI chrome)
may enter this zone.

```
┌─────────────────────────
│  ↑
│  ←  [LOGO]  →    clear = 1× icon height
│  ↓
└─────────────────────────
```

### 5.2 Minimum Sizes

| Context | Minimum |
|---------|---------|
| Favicon (digital) | 16×16 px |
| App icon (digital) | 48×48 px |
| Print (wordmark) | 120 px wide |
| Print (icon only) | 24×24 mm |

Below 16px, use a simplified silhouette (blue square + white shape) without
the signature stroke or seal detail.

---

## 6. Usage Rules

### 6.1 DO

- Use the provided SVG files for all digital applications.
- Maintain the original aspect ratio — never stretch or compress.
- Place the logo on white or very light backgrounds in default usage.
- Use the white icon variant on dark or brand-colored backgrounds.
- Reference `BrandLogo` component (`src/components/brand/BrandLogo.tsx`)
  for inline SVG rendering in React — it stays crisp at any size.

### 6.2 DON'T

- **Don't** recolor the logo or change the blue to a different hue.
- **Don't** add drop shadows, glows, or bevels to the logo.
- **Don't** rotate or skew the logo.
- **Don't** place the full-color logo on a busy or low-contrast background.
- **Don't** rearrange the icon and wordmark into an unapproved configuration.
- **Don't** use the wordmark without the icon in primary brand placements
  (the icon is the anchor of brand recognition).
- **Don't** modify the SVG paths or export at non-square aspect ratios.

---

## 7. Favicon & App Icons

### 7.1 Favicon

The favicon is a multi-resolution ICO file containing 16×16, 32×32, and
48×48 pixel versions.

| File | Format | Sizes | Location |
|------|--------|-------|----------|
| `favicon.ico` | ICO | 16, 32, 48 | `src/app/favicon.ico` |
| `favicon-16.png` | PNG | 16×16 | `public/brand/` |
| `favicon-32.png` | PNG | 32×32 | `public/brand/` |
| `favicon-48.png` | PNG | 48×48 | `public/brand/` |

At 16×16 and 32×32, fine details (signature stroke, seal checkmark) may
not be individually distinguishable — the blue square + white document
silhouette is the primary recognition cue at these sizes.

### 7.2 App Icons

| File | Format | Size | Usage |
|------|--------|------|-------|
| `icon-128.png` | PNG | 128×128 | PWA icon, social card |
| `icon-256.png` | PNG | 256×256 | High-resolution app icon |

---

## 8. File Format Guide

| Format | Files | Usage |
|--------|-------|-------|
| **SVG** | `logo-icon.svg`, `logo-horizontal.svg`, `logo-stacked.svg`, `logo-icon-white.svg` | Web, print, source — infinitely scalable. Primary format for all use cases. |
| **PNG** | `favicon-{16,32,48}.png`, `icon-{128,256}.png` | App icons, social previews, contexts without SVG support. |
| **ICO** | `favicon.ico` | Browser tab favicon (multi-resolution). |

### Regenerating Assets

The PNG and ICO files are generated from the SVG sources:

```bash
node scripts/generate-brand-assets.mjs
```

This script uses `sharp` (a Next.js transitive dependency) to rasterize the
SVG. Re-run after modifying any SVG source.

---

## 9. Implementation in Code

### React Component

```tsx
import { BrandLogo } from "@/components/brand/BrandLogo";

// In a sidebar or header
<BrandLogo className="h-9 w-9" />
```

The `BrandLogo` component renders an inline SVG (no network request, crisp at
any size). Use it wherever the brand mark appears in the UI.

### Static Reference

```tsx
// In metadata or OpenGraph tags
import icon from "@/app/favicon.ico";
```

---

## 10. Changelog

| Date | Change |
|------|--------|
| 2026-09-22 | Initial brand identity system created |
