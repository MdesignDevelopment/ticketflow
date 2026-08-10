# TicketFlow — Design System (MASTER)

Enterprise B2B support tooling. Visual direction: **cool slate surfaces + indigo accent**,
crisp and modern (Linear / Vercel feel). Light-mode only today; tokens are semantic so dark
mode can be added later without touching components.

> Single source of truth. Every page must follow this. All colors come from CSS variables in
> `src/app/globals.css` — **never hardcode hex values** for things a token already covers.

---

## 1. Foundation

- **Font:** Inter via `next/font/google`, variable `--font-inter`, applied on `<html>`.
- **Base size:** 14px (`--text-sm`). Numeric/tabular data uses `.tabular-nums`.
- **Radius:** `--radius` = 10px. Scale: `rounded-md` (8), `rounded-lg` (10), `rounded-xl` (14), `rounded-2xl` (18).
- **Spacing rhythm:** page padding `p-8` (32px). Card padding 20–24px. Gaps: 12/16/24px. Section spacing 28–36px.
- **Max content width:** `max-w-[1280px]` centered for reading-width pages (dashboard, detail). Tables/lists may go full width.

## 2. Color tokens (use these, not raw hex)

| Purpose | Token |
|---|---|
| App canvas | `var(--background)` `#F7F8FA` |
| Card / panel | `var(--card)` `#FFFFFF` |
| Primary text | `var(--foreground)` |
| Muted/secondary text | `var(--muted-foreground)` (AA on white) |
| Hairline border | `var(--border)` |
| Stronger border / inputs | `var(--border-strong)` |
| Brand / primary action | `var(--primary)` indigo-600, hover `var(--primary-hover)` |
| Primary tint (active nav, chips) | `var(--primary-subtle)` bg + `var(--primary-subtle-fg)` text |
| Neutral fill | `var(--secondary)` |
| Zebra / table head / subtle fill | `var(--muted)` |

**Semantic** (each has `*`, `*-subtle` bg, `*-border`, `*-fg` text-on-subtle):
`--success` (emerald), `--warning` (amber), `--destructive` (red), `--info` (sky).
Badges/alerts = `*-subtle` background + `*-fg` text + `*-border` 1px border.

**Charts:** `--chart-1..8` (indigo, sky, teal, amber, red, violet, slate, pink), gridlines `--chart-grid`.
Recharts must pull from these — no bespoke palettes per page.

## 3. Elevation

Soft, layered shadows: `--shadow-xs/sm/md/lg/xl`. Cards rest at `--shadow-sm`. Popovers/menus `--shadow-lg`.
Modals `--shadow-xl`. Borders + shadow together (not shadow alone).

## 4. Component utilities (in globals.css — prefer these)

- **Surface:** `.surface` (card + border + shadow-sm + radius-xl) or `.surface-flat` (no shadow).
- **Buttons:** `.btn` + `.btn-primary` / `.btn-secondary` / `.btn-ghost` / `.btn-danger`. Always `cursor-pointer`, 150ms transitions, disabled state built in.
- **Inputs:** `.input`, `.select`, `.textarea` — indigo focus ring (`0 0 0 3px rgba(99,102,241,.15)`).
- **Badges:** `.badge` + semantic subtle bg/fg/border.
- **Tables:** `.data-table` — uppercase muted header on `--muted`, hairline rows, hover row tint, `tabular-nums` for numbers.

## 5. Patterns

- **Page header:** `h1` 24px/600 + one-line muted description on the left; primary action button(s) right. Bottom margin 24px.
- **KPI cards:** small uppercase muted label (11px, tracking-wide), big value (28–32px/700 `tabular-nums`), optional sub/delta. Use `.surface`.
- **Section header:** 15px/600 title + 13px muted description, separated by a hairline border-bottom.
- **Filter bar:** inputs/selects in `.input`/`.select`, grouped in a `.surface-flat` or inline row, with a primary Filter button + ghost Clear.
- **Empty states:** centered, muted, with an icon + short sentence (never a bare "No data").
- **Loading:** `.skeleton` blocks matching final layout; reserve space to avoid layout shift.

## 6. Interaction & a11y (non-negotiable)

- `cursor-pointer` on every clickable element. Hover = color/bg/border/shadow change, **never** layout-shifting scale.
- Transitions 150–200ms, `transition-colors`/`transition-shadow`.
- Keyboard focus is visible (global `:focus-visible` indigo ring; inputs use their own ring).
- Icon-only buttons get `aria-label`. Form inputs get `<label>`. Color is never the only signal (pair with text/icon).
- Respect `prefers-reduced-motion` (handled globally).
- SVG icons only (stroke-width 1.8, 24×24 viewBox, sized 14–18px) — **no emoji icons**.

## 7. Anti-patterns

- ❌ Hardcoded hex where a token exists (esp. muddy bespoke chart palettes).
- ❌ Pure-black text/borders; ornate gradients; heavy drop shadows.
- ❌ `colorScheme` mismatches on native selects (set `color-scheme: light`).
- ❌ Layout-shifting hover (`scale`), instant state changes, transitions > 300ms.

## 8. Page-specific overrides

Live in `design-system/pages/<name>.md`. If present, they override this file for that page.
