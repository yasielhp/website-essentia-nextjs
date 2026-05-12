# Design System: Essentia — Longevity Center & Social Wellness Club

**Project:** Next.js 16 / React 19 / Tailwind CSS v4
**Stack:** TypeScript · GSAP · Local fonts (Jedira, DM Sans)

---

## 1. Visual Theme & Atmosphere

Essentia's visual language is **quiet luxury with scientific intention** — the aesthetic of a private members' club that happens to be obsessed with the science of living longer. The palette is drawn from nature: deep teal-forest tones balanced against warm, bleached-linen neutrals. Nothing competes for attention; every element earns its presence.

The mood reads as **serene, unhurried, and premium**. Large amounts of breathing room surround every element. Type is sparse and deliberate. Motion is choreographed with GSAP: scroll-driven reveals, letter-by-letter hover animations, and pinned bento grids communicate that the brand moves with intention, never urgency.

The site flows between two tonal worlds — a warm sandy light mode for content sections and a deep petroleum dark mode for the footer and inverted UI states — creating a satisfying day-to-night rhythm as the user scrolls.

---

## 2. Color Palette & Roles

### Petroleum Family — The Brand Anchor

Deep, muted teal-greens pulled from old-growth forest and mineral-rich ocean depths.

| Descriptive Name | Hex       | Functional Role                                                                                |
| ---------------- | --------- | ---------------------------------------------------------------------------------------------- |
| Pale Sage Mist   | `#e7e9e6` | Subtle hover fills on light surfaces (`petroleum-50`)                                          |
| Frost Lichen     | `#d7dbd9` | Hairline borders and dividers on light backgrounds (`petroleum-100`)                           |
| Weathered Jade   | `#4a6767` | Muted secondary body copy, placeholder text, subdued labels (`petroleum-400`)                  |
| Forest Mineral   | `#335554` | Interactive text, focus rings, primary link color (`petroleum-500`)                            |
| Deep Still Water | `#103838` | Primary dark background (footer), default solid button fill, html base color (`petroleum-700`) |
| Abyssal Teal     | `#0c2c2c` | Button hover state on solid variant (`petroleum-800`)                                          |
| Midnight Kelp    | `#092121` | Button active/pressed state, deepest shadow reference (`petroleum-900`)                        |

### Sand Family — The Warmth Counterpoint

Sun-bleached linens and weathered stone. Warm without being yellow, neutral without feeling cold.

| Descriptive Name    | Hex       | Functional Role                                                                             |
| ------------------- | --------- | ------------------------------------------------------------------------------------------- |
| Warm Ivory Breath   | `#faf8f5` | Lightest surface — hover state on white buttons, delicate background tint (`sand-50`)       |
| Bleached Linen      | `#f0ede6` | Primary content section background — hero overlay, brand statement, newsletter (`sand-100`) |
| Pale Stone          | `#e6e3da` | Accordion borders, secondary surface boundaries (`sand-200`)                                |
| Aged Parchment      | `#c2baa5` | Body copy on dark (petroleum) backgrounds, footer text (`sand-500`)                         |
| Warm Driftwood      | `#b4a388` | Heading text on dark backgrounds, prominent muted labels (`sand-600`)                       |
| Bleached Terracotta | `#a9997d` | Accent links and menu category headings on dark backgrounds (`sand-700`)                    |

### Alert Red — Functional Only

Used exclusively for form validation states. Never decorative.

| Descriptive Name | Hex       | Functional Role                           |
| ---------------- | --------- | ----------------------------------------- |
| Blush Error Wash | `#fee2e2` | Error background tint (`red-100`)         |
| Coral Alert      | `#f87171` | Error border stroke on inputs (`red-400`) |
| Signal Red       | `#ef4444` | Error body text (`red-500`)               |
| Deep Warning     | `#dc2626` | Strongest error emphasis (`red-600`)      |

### Base

- **Pure White** `#ffffff` — white button variant, text on dark video backgrounds
- **Pure Black** `#000000` — video overlay controls (`bg-black/40`)

---

## 3. Typography Rules

### Display Typeface — Jedira (Serif, 400)

A custom serif loaded locally from `Jedira-Regular.woff2`. Used for all large brand statements and hero headlines. Its character is **editorial and unhurried** — closer to a luxury magazine masthead than a digital interface font. Applied via `font-display` utility class.

- **Usage:** Hero tagline ("For those who take the long view."), brand statement heading ("A longer life should also be a better one."), any typographic centrepiece
- **Sizes in use:** `text-4xl` (mobile) → `text-6xl` (small screens) → `text-7xl` (desktop)
- **Letter spacing:** `tracking-wide` — adds the editorial openness characteristic of the brand

### Body Typeface — DM Sans (Sans-serif)

A geometric humanist sans loaded locally in three weights: Light (300), Regular (400), Medium (500). Applied via `font-body` utility class and set as the html default.

- **Weight 300 (Light):** Long-form body copy, descriptive paragraphs
- **Weight 400 (Regular):** Navigation links, input text, labels, general UI
- **Weight 500 (Medium):** Buttons, sub-headings, accordion headers, footer section titles, card titles
- **Rendering:** `-webkit-font-smoothing: antialiased` + `text-rendering: optimizeLegibility` — the brand demands crisp, refined letterforms

### Typographic Hierarchy Summary

- **Display (Jedira 400):** Major headlines — the brand voice
- **Medium (DM Sans 500):** Section sub-headings, UI labels with emphasis
- **Regular (DM Sans 400):** Navigation, interactive text, forms
- **Small (DM Sans 300–400, `text-sm`/`text-xs`):** Captions, metadata, legal copy, accordion detail text

---

## 4. Component Stylings

### Buttons

**Shape:** All buttons are fully pill-shaped (`rounded-full`), echoing the organic, cellular aesthetic of a longevity brand. No sharp corners anywhere in the button system.

**Sizing system:**

- `sm` — 32px tall (`h-8`), compact padding (`px-3`), `text-sm` — used for inline actions
- `md` — 40px tall (`h-10`), standard padding (`px-7 py-2.5`), `text-sm` — default UI button
- `lg` — 48px tall (`h-12`), generous padding (`px-6`), `text-base` — hero CTAs and primary actions

**Variant palette:**

| Variant         | Background                 | Text             | Border           | Hover                       |
| --------------- | -------------------------- | ---------------- | ---------------- | --------------------------- |
| `solid`         | Deep Still Water `#103838` | White            | None             | Abyssal Teal `#0c2c2c`      |
| `outline`       | Transparent                | Deep Still Water | Deep Still Water | Pale Sage Mist `#e7e9e6`    |
| `ghost`         | Transparent                | Deep Still Water | None             | Pale Sage Mist `#e7e9e6`    |
| `soft`          | Pale Sage Mist             | Deep Still Water | None             | Frost Lichen `#d7dbd9`      |
| `white`         | White                      | Deep Still Water | None             | Warm Ivory Breath `#faf8f5` |
| `outline-white` | Transparent                | White            | White            | `white/10` tint             |
| `ghost-white`   | Transparent                | White            | None             | `white/10` tint             |

**Micro-interaction:** All buttons use GSAP-powered text split animation on hover — characters animate individually, adding a premium tactile quality. Transitions are `duration-200 ease-in-out`.

---

### Cards / Dropdown Feature Cards

The navigation dropdown uses **portrait-orientation cards** with a rich image fill.

- **Shape:** Gently rounded corners (`rounded-2xl`) — a softer rectangle, not pill
- **Min height:** `min-h-50` (200px) at `w-112.5` (450px)
- **Overlay:** Deep gradient from bottom — `linear-gradient(to top, rgb(9 33 33 / 0.9), rgb(12 44 44 / 0.4), transparent)` — ensures text legibility over any photo
- **Fallback (no image):** Solid Forest Mineral `#335554` fill
- **Text on card:** White, with title at `text-2xl font-medium` and description at `text-sm opacity-80`
- **Entry animation:** GSAP stagger — title and description slide up from `y: 10` to `y: 0` with `opacity: 0 → 1`

---

### Navigation Header

A **floating pill header** — one of the most distinctive layout signatures of the brand.

- **Background:** Bleached Linen `#f0ede6` (`bg-sand-50`)
- **Text:** Forest Mineral `#335554`
- **Shape:** `rounded-b-2xl` on mobile (flat top, rounded bottom), `rounded-2xl` (full pill) on desktop after `md:mt-16` floats it from the viewport edge
- **Position:** `fixed` with `max-w-4xl` centering — floats above all content, `z-10`
- **Width:** Full viewport constrained to max 896px — not edge-to-edge, giving it the "card floating in air" quality
- **Divider:** A `border-sand-100` appears between top bar and open dropdown

---

### Mobile Menu

- Expands with GSAP height animation from the bottom of the header pill
- Uses `Accordion.Group` for single-open exclusivity
- Sub-items indented with a `border-sand-200 border-l` left-rail treatment — clean, typographic hierarchy
- Menu items stagger-fade in with `y: 10 → y: 0`

---

### Inputs / Forms

**Email input:**

- **Shape:** Fully pill-shaped (`rounded-full`) — consistent with button language
- **Height:** 40px (`h-10`) — matches the medium button
- **Background:** Transparent — lets section background show through
- **Border:** Fine single-pixel stroke, adapts to theme:
  - Light theme: `border-petroleum-200` → `border-petroleum-500` on focus
  - Dark theme: `border-petroleum-500` → `border-sand-400` on focus
- **Error state:** `border-red-400` with `focus:ring-red-500/20` ring
- **Transition:** `duration-200` smooth border colour shift

**Checkbox:**

- Custom `accent-current` colour — inherits the petroleum family
- 16px × 16px (`h-4 w-4`) with subtle `rounded` corner
- Label uses `text-sm leading-snug text-petroleum-500` — legible but understated

**Accordion (GDPR info):**

- `rounded-2xl border border-sand-200` container
- Header button `text-xs tracking-wide uppercase` — almost invisible until needed
- Chevron rotates 180° on open with `transition-transform duration-300 ease-in-out`
- Content reveals via CSS grid row height: `0fr → 1fr`

---

### Footer

- **Background:** Deep Still Water `#103838` — the darkest surface, anchors the page
- **Shape:** `rounded-tl-3xl rounded-tr-3xl` — generously curved top corners, as if the footer card is resting below the content
- **Overlap:** `-mt-6` on the footer so it slides gently under the last content section, creating visible depth
- **Text:** Aged Parchment `#c2baa5` for body, Warm Driftwood `#b4a388` for section headings
- **Dividers:** `border-petroleum-500` — subtle, barely-there lines between contact zones
- **Social icons:** `rounded-full border border-petroleum-500 p-2` — ghost circle treatment

---

## 5. Layout Principles

### The Container

Every section constrains content to `max-w-4xl` (896px) with `mx-auto` centering. This max-width is the backbone of the entire layout — it creates a focused reading column that never stretches uncomfortably wide.

### Whitespace Strategy

**Generous and deliberate.** Sections use `py-16 md:py-24` vertical padding — the brand does not rush the eye. Internal section spacing uses `gap-3` to `gap-5` for tight groupings, stepping up to `gap-10` for block-level separation.

### Scroll-Driven Depth Layering

The homepage uses GSAP ScrollTrigger to create a **z-axis narrative**:

1. **Hero** (`h-[300vh]` scroll distance): Video starts as a rounded card with padding, then expands to full-bleed as user scrolls — the transition from "preview" to "immersive"
2. **Brand Statement** (`h-[200vh]` scroll distance): Bento grid of images is pinned; grid columns expand from compressed to full as user scrolls — the reveal of the space
3. **Newsletter**: A rest point at natural content width

### Grid System

- **Bento grid** in brand statement: 2-column mobile → 5-column desktop, with images spanning 1–3 rows
- **Footer:** Single-column mobile → 3-column desktop via `flex-col → flex-row`
- No rigid grid framework — layouts are composed with CSS Grid and Flexbox directly

### Responsive Strategy

Two primary breakpoints via Tailwind `md:` (768px):

- **Mobile-first base:** Single column, full-width CTAs, accordion navigation
- **Desktop enhancement (`md:`):** Float header, expand grid, show additional bento images, side-by-side footer columns

### Motion Principles

- **Entrance:** Elements enter from below (`y: 8–30 → 0`) with fade-in — never from the side
- **Exits:** Elements leave upward (`y: -5–40`) — opposing the entrance for a natural arc
- **Stagger:** 40–80ms between sibling elements creates cascading reveals
- **Easing:** `power2.out` / `power3.out` for entrances (quick start, graceful settle); `power2.in` / `power3.in` for exits (builds then snaps)
- **Duration:** 200–350ms for UI interactions; 300–700ms for scroll-driven reveals
