---
name: ui-ux-pro-max
description: Professional UI/UX design rules and golden-theme design system for الفارس الذهبي للدعاية project. Use whenever building or refining UI components, pages, popups, cards, or map markers — covers color palette, typography, motion, anti-patterns, and a pre-delivery quality checklist distilled from UI/UX Pro Max and Open Design.
---

# UI/UX Pro Max — Golden Knight Design System

Distilled from the [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) and [Open Design](https://github.com/nexu-io/open-design) reasoning engines, tuned to the project's golden brand identity.

## Core principles (apply to every visual change)

1. **Never use emoji as icons.** Always use SVG (Lucide-react or inline SVG paths). 📍 ✓ ✕ are forbidden inside UI surfaces.
2. **`cursor-pointer`** on every clickable element. Hover states with `transition-all duration-200`.
3. **Contrast 4.5:1 minimum** for body text against background, 3:1 for large text.
4. **No generic AI aesthetics:** no purple-to-pink gradients, no Inter/Poppins default pairings, no white card on white background.
5. **Use the project's semantic tokens** (`bg-primary`, `text-foreground`, `border-border` …) — never hardcode hex inside components except inside SVG generators (maps, pins, PDFs).
6. **Status badges** use `bg-primary/10 text-primary` for high contrast on both light and dark themes.
7. **Respect `prefers-reduced-motion`** — wrap optional animations in `motion-safe:` Tailwind variants.
8. **Responsive checkpoints:** 375 / 768 / 1024 / 1440 px.

## Brand palette

- **Primary Gold:** `#d6ac40` (HSL `42 67% 55%`)
- **Gold Highlight:** `#f4c25a`
- **Gold Deep:** `#b8860b`
- **Dark Surface:** `#0a0a14` → `#15110a` (radial)
- **Light Surface:** HSL `40 20% 98%`
- **Status colors:** متاح `#22C55E` · مؤجر `#2D6BFF` · قريباً `#F59E0B` · صيانة `#EF4444` · مخفي `#94A3B8`

## Typography

- Arabic body / UI: **Tajawal**
- Latin display / numbers in pins/badges: **Manrope** (already loaded)
- Never fall back to system fonts inside generated SVG — embed `font-family="'Manrope', 'Tajawal', sans-serif"`.

## Motion register

- Hover / press: 150–200 ms ease-out
- Card enter: 250–300 ms (use `animate-in fade-in slide-in-from-*`)
- Pulse / glow on selection: 2 s loop, opacity 0.7 → 1
- Avoid simultaneous large-area animations that fight for attention.

## Reference files

- `references/design-systems.md` — when to pick which visual style
- `references/anti-patterns.md` — patterns to never ship
- `references/checklist.md` — pre-delivery QA
- `references/map-pins.md` — specific rules for map pin SVGs

## Anti-patterns (never ship)

- Emoji icons inside cards, buttons, popups.
- Pop-ups floating far from their anchor (more than 8 px gap between InfoWindow tip and marker top).
- Pins that look like rounded rectangles with stubby tails — use real teardrop or pill+pointer shapes.
- Dark text on dark gradients without a scrim.
- Buttons without hover state or without `cursor-pointer`.