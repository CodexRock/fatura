# Fatura — Design System & UX Redesign
### World-Class App Design Audit · April 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Audit Findings — What's Broken](#2-audit-findings)
3. [Design Principles](#3-design-principles)
4. [Visual Identity](#4-visual-identity)
5. [Design Tokens](#5-design-tokens)
6. [Typography System](#6-typography-system)
7. [Spacing & Layout](#7-spacing--layout)
8. [Component Library Redesign](#8-component-library-redesign)
9. [Screen-by-Screen Redesign](#9-screen-by-screen-redesign)
10. [Motion & Interaction Design](#10-motion--interaction-design)
11. [Accessibility](#11-accessibility)
12. [Implementation Roadmap](#12-implementation-roadmap)

---

## 1. Executive Summary

**Fatura** is a DGI-compliant invoice management SaaS for Moroccan businesses. The application has a solid architectural foundation — clean component structure, Firebase backend, bilingual FR/AR support — but the visual execution has significant coherence problems that undermine trust and usability.

**Core Problem:** The app has a split personality. Two completely different visual grammars coexist: one (Dashboard, Sidebar) that uses the custom `#1B4965` primary, and another (Invoices list, loading states) that reverts to Tailwind's `indigo-600`. There is no single source of truth for color, border radius, spacing, or typography weight usage.

**Target:** A calm, modern, professional SaaS product. Think Linear, Notion, or Stripe's dashboard — but warmer, anchored in Moroccan professional culture. Clean geometric surfaces, generous whitespace, one coherent visual language from login to settings.

---

## 2. Audit Findings

### 2.1 Critical Issues (Ship-blocking)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| C1 | **Color split-personality**: `bg-indigo-600` used in `Invoices.tsx` while the design system defines `primary: #1B4965`. Two unrelated blues in the same app. | `Invoices.tsx:91` | Destroys visual coherence |
| C2 | **Client names not resolved**: Dashboard table shows `ID: {inv.clientId.substring(0,6)}...` instead of the client's actual name. | `Dashboard.tsx:279` | Breaks core usability — data is unreadable |
| C3 | **Hamburger has no handler**: The mobile `<Menu />` icon in Header has no `onClick` — tapping it does nothing. | `Header.tsx:38-44` | Mobile navigation is broken |
| C4 | **Native browser dialogs**: `confirm()` and `alert()` are used for payment confirmation and PDF errors. | `Invoices.tsx:58,63`, `InvoiceView.tsx` | Jarring, un-styled, breaks immersion |
| C5 | **`pb-safe` class undefined**: `MobileNav.tsx` uses `pb-safe` but `tailwindcss-safe-area` plugin is not installed. | `MobileNav.tsx:12` | iPhone bottom bar overlaps navigation |

### 2.2 Design Consistency Issues

| # | Issue | Location |
|---|-------|----------|
| D1 | **Loading spinner inconsistency**: Dashboard uses `<Loader2 animate-spin text-[#1B4965]>`. Invoices uses a raw `border-indigo-600` spinning div. | `Dashboard.tsx:50`, `Invoices.tsx:72-76` |
| D2 | **Border radius chaos**: `rounded-xl`, `rounded-2xl`, `rounded-3xl` used interchangeably with no semantic rule. | App-wide |
| D3 | **Hardcoded badge**: Sidebar shows `badge: 3` for Factures as a static literal, not from real data. | `Sidebar.tsx:17` |
| D4 | **Font weight overuse**: `font-black` appears on metric values but creates excessive contrast in dense layouts. | `Dashboard.tsx:97,117,154` |
| D5 | **Shadow inconsistency**: Some cards use `shadow-sm`, others `shadow-[0_2px_10px_rgb(0,0,0,0.02)]`, others `shadow-[0_4px_14px_0_...]`. No system. | App-wide |
| D6 | **Emoji in production heading**: `👋` in Dashboard greeting is casual and unscalable for Arabic RTL context. | `Dashboard.tsx:74` |
| D7 | **Settings uses string-template CSS**: `inputClass` defined as a raw string constant rather than a shared component. | `Settings.tsx:59` |
| D8 | **CTA button duplicated**: "Nouvelle Facture" button is copy-pasted between Header (mobile), Header (desktop), Dashboard, and Quick Actions — four separate implementations. | Multiple files |

### 2.3 UX Flow Issues

| # | Issue | Impact |
|---|-------|--------|
| U1 | **No mobile sidebar**: Desktop gets a 260px sidebar. Mobile gets a bottom tab bar. But there's no sheet/drawer that slides in from the hamburger. Business name, plan indicator, logout — all invisible on mobile. | Medium |
| U2 | **Revenue chart has no Y-axis or scale**: The bar chart shows no grid lines or value labels. Users cannot determine if a bar represents 1K or 100K MAD without hovering. | Medium |
| U3 | **Invoices page bottom padding (`pb-48`)**: Mobile bottom padding is `pb-48` — a heavy-handed workaround instead of layout-level fix. Causes excessive white space on desktop. | Low |
| U4 | **No empty state on Dashboard**: First-time users see empty metric cards with `0 MAD` and `0` counts. There's no onboarding nudge or contextual empty state. | Medium |
| U5 | **Settings tab overflow on mobile**: 5 tabs in Settings don't scroll horizontally on small screens — they stack or truncate. | Medium |

---

## 3. Design Principles

### 3.1 The Four Pillars

**I. Calm Authority**
Professional confidence without coldness. Every screen should feel like it was made by someone who knows exactly what they're doing. No noise, no clutter, no unnecessary decorative elements.

**II. Generous Precision**
White space is not emptiness — it's structure. Every element breathes. Margins are deliberate. The grid is sacred. Nothing floats arbitrarily.

**III. Progressive Disclosure**
Show what matters now. Hide what matters later. Complex invoice creation doesn't overwhelm — it guides. Settings don't intimidate — they reveal.

**IV. Coherence Over Cleverness**
Every component looks like it belongs to the same family. No visual surprises. Consistency builds trust, especially in financial software.

---

## 4. Visual Identity

### 4.1 Brand Personality

Fatura sits at the intersection of **Moroccan business culture** and **modern SaaS design**. The visual language should feel:
- Contemporary but not trendy
- Professional but not corporate-cold
- Precise but not clinical
- Warm but not casual

**Reference points:** Stripe Dashboard (precision), Lunchbreak (warmth), Linear (calm density), Qonto (European fintech clarity)

### 4.2 Logo & Wordmark

The current "F" in a rounded square works. Evolve it slightly:
- Keep `#1B4965` as brand primary
- Use `font-weight: 700`, Inter, letter-spacing `-0.04em` for the wordmark
- The "F" mark in sidebar should be `24px`, not `text-lg`
- Add subtle grain texture overlay at 3% opacity on the icon background for depth

### 4.3 Color Narrative

| Role | Hex | Usage |
|------|-----|-------|
| **Ocean** (primary) | `#1B4965` | Nav, primary buttons, headings, active states |
| **Sky** (secondary) | `#5FA8D3` | Links, focus rings, secondary accents |
| **Amber** (accent) | `#F4A261` | CTAs, highlights, "warm" actions (add client) |
| **Forest** (success) | `#2D6A4F` | Paid status, positive deltas |
| **Coral** (danger) | `#E63946` | Overdue, errors, destructive actions |
| **Slate** (neutral) | `#64748B` | Secondary text, metadata |
| **Cloud** (background) | `#F8FAFC` | Page background (slightly cooler than current) |
| **White** (surface) | `#FFFFFF` | Cards, modals, input fields |

---

## 5. Design Tokens

These replace all hardcoded hex values and should be referenced throughout the codebase.

### 5.1 Color Scale (Full)

```typescript
// tailwind.config.ts — replace current extend.colors with:
colors: {
  // Primary — Ocean Blue
  primary: {
    50:  '#EFF6FB',
    100: '#D6EAF5',
    200: '#ACD5EB',
    300: '#7BBFDE',
    400: '#5FA8D3',  // secondary (current)
    500: '#3B8CB9',
    600: '#2A6F99',
    700: '#1B4965',  // primary (current) ← main brand
    800: '#133651',
    900: '#0C2438',
    950: '#071624',
  },
  // Accent — Warm Amber
  accent: {
    50:  '#FFF8F0',
    100: '#FEECD8',
    200: '#FDD9B1',
    300: '#FBBF80',
    400: '#F9A057',
    500: '#F4A261',  // current accent ← keep
    600: '#E07D35',
    700: '#C4621F',
    800: '#9D4C18',
    900: '#7B3C16',
  },
  // Success — Forest Green
  success: {
    50:  '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#2D6A4F',  // current ← keep
    600: '#1A5E3F',
    700: '#144D33',
  },
  // Danger — Coral Red
  danger: {
    50:  '#FFF5F5',
    100: '#FECACA',
    200: '#FCA5A5',
    300: '#F87171',
    400: '#EF4444',
    500: '#E63946',  // current ← keep
    600: '#C0313D',
    700: '#9B2335',
  },
  // Neutral — Slate (Tailwind's slate is already excellent — keep it)
}
```

### 5.2 Semantic Color Aliases

```typescript
// In globals or design-tokens.ts
const tokens = {
  // Backgrounds
  bg: {
    app:     'bg-slate-50',    // #F8FAFC — page
    surface: 'bg-white',       // Cards
    subtle:  'bg-slate-50/80', // Hover states, table rows
    overlay: 'bg-slate-900/40',// Modal backdrop
  },
  // Borders
  border: {
    default: 'border-slate-100',
    medium:  'border-slate-200',
    strong:  'border-slate-300',
    brand:   'border-primary-700',
    focus:   'ring-primary-400/40',
  },
  // Text
  text: {
    primary:   'text-slate-900',
    secondary: 'text-slate-600',
    tertiary:  'text-slate-400',
    brand:     'text-primary-700',
    inverse:   'text-white',
  },
  // Radius — UNIFIED SYSTEM
  radius: {
    sm:   'rounded-lg',    // 8px  — inputs, badges, small elements
    md:   'rounded-xl',    // 12px — buttons, small cards
    lg:   'rounded-2xl',   // 16px — main cards
    xl:   'rounded-3xl',   // 24px — panels, modals, hero sections
    full: 'rounded-full',  // Pills, avatars
  },
  // Shadows — UNIFIED SYSTEM
  shadow: {
    sm:    'shadow-sm',                                          // Subtle depth
    card:  'shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.04)]', // Cards
    modal: 'shadow-[0_8px_40px_rgba(0,0,0,0.12)]',            // Modals
    btn:   'shadow-[0_2px_8px_rgba(27,73,101,0.20)]',         // Primary CTA
    hover: 'shadow-[0_4px_20px_rgba(27,73,101,0.18)]',        // Elevated hover
  },
}
```

---

## 6. Typography System

**Typeface:** Inter (keep — excellent for Arabic-adjacent Latin)
**Arabic:** Noto Kufi Arabic (keep)

### 6.1 Type Scale

```
Display XL  — 36px / font-weight 700 / tracking -0.04em / line-height 1.1
Display L   — 28px / font-weight 700 / tracking -0.03em / line-height 1.2
Heading 1   — 22px / font-weight 700 / tracking -0.02em / line-height 1.3
Heading 2   — 18px / font-weight 600 / tracking -0.01em / line-height 1.4
Heading 3   — 15px / font-weight 600 / tracking -0.005em / line-height 1.4
Body        — 14px / font-weight 400 / tracking 0       / line-height 1.6
Body SM     — 13px / font-weight 400 / tracking 0       / line-height 1.5
Label       — 12px / font-weight 600 / tracking 0.03em  / line-height 1.0 (UPPERCASE)
Caption     — 11px / font-weight 500 / tracking 0.02em  / line-height 1.4
Mono        — 13px / font-family monospace / tracking 0.01em (invoice numbers, IDs)
```

### 6.2 Font Weight Rules

- **700 (Bold)**: Section headings, page titles, nav brand name
- **600 (Semibold)**: Card headings, button labels, form labels, active nav
- **500 (Medium)**: Secondary headings, metadata, badge text, table headers
- **400 (Regular)**: Body copy, descriptions, inactive nav
- **ELIMINATE**: `font-black` (900) — too heavy for financial data. Max is 700.

### 6.3 Number Formatting

Financial figures deserve their own treatment:
- Use `tabular-nums` feature: `font-variant-numeric: tabular-nums`
- Large figures (MAD amounts): `text-2xl font-bold tabular-nums text-slate-900`
- Small counts: `text-3xl font-bold tabular-nums text-slate-900`
- Percentages/deltas: `text-xs font-semibold` with color semantic

### 6.4 Tailwind Config Addition

```typescript
fontFamily: {
  sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
  arabic: ['"Noto Kufi Arabic"', 'sans-serif'],
  mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'], // For invoice numbers
},
```

---

## 7. Spacing & Layout

### 7.1 Spacing Scale (Tailwind defaults — reinforce discipline)

```
4px   (1)  — Icon gap, tight label spacing
8px   (2)  — Close element grouping
12px  (3)  — Standard gap within a component
16px  (4)  — Section within a card, input padding
20px  (5)  — Standard card padding (mobile)
24px  (6)  — Standard card padding (desktop), section gap
32px  (8)  — Between major sections
40px  (10) — Between section groups
48px  (12) — Page top margin (desktop)
```

**Rule:** Always use even multiples of 4px. Never use `py-3.5`, `gap-3.5` — these break the grid rhythm.

### 7.2 Layout Grid

**Desktop:**
```
Sidebar:       260px fixed left
Content area:  Fluid, max-width 1280px
Content pad:   24px horizontal, 40px vertical
Card grid:     gap-6 (24px)
```

**Mobile:**
```
Content pad:   16px horizontal, 24px vertical
Bottom nav:    64px + safe-area-inset-bottom
Card gap:      gap-4 (16px)
```

### 7.3 Responsive Breakpoints

```
sm:  640px  — Multi-column cards begin
md:  768px  — Two-column grids
lg:  1024px — Sidebar appears
xl:  1280px — Full dashboard layout
2xl: 1536px — Wider content with constrained max-width
```

### 7.4 Content Max-Width

Page content: `max-w-screen-xl` (1280px), centered, not `max-w-7xl` (1168px).
The extra 112px of breathing room significantly improves readability on ultrawide monitors.

---

## 8. Component Library Redesign

### 8.1 Button

**Current Problems:**
- Four separate implementations of "Nouvelle Facture" button across the app
- No consistent disabled state styling
- `active:scale-[0.98]` works well — keep it

**Redesigned Specification:**

```typescript
// Variants
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success'
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

// Design spec per variant:
primary:   bg-primary-700 text-white shadow-btn hover:bg-primary-800 active:scale-[0.98]
secondary: bg-accent-500 text-white shadow-[0_2px_8px_rgba(244,162,97,0.25)] hover:bg-accent-600
ghost:     bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900
outline:   bg-white border border-slate-200 text-slate-700 hover:border-primary-700 hover:text-primary-700
danger:    bg-danger-500 text-white hover:bg-danger-600
success:   bg-success-500 text-white hover:bg-success-600

// Sizes:
xs: px-3 py-1.5 text-xs rounded-lg gap-1.5
sm: px-4 py-2 text-sm rounded-xl gap-2
md: px-5 py-2.5 text-sm rounded-xl gap-2  (DEFAULT)
lg: px-6 py-3.5 text-base rounded-2xl gap-2.5

// States:
disabled: opacity-50 cursor-not-allowed pointer-events-none
loading:  opacity-70 cursor-wait (show Loader2 spinner, preserve width)
```

**Key rule:** All buttons have `font-semibold`. Never `font-bold` or `font-medium` on buttons.

---

### 8.2 Input / Form Field

**Current Problems:**
- `inputClass` string constant in Settings is not a shared component
- Focus ring uses `ring-secondary` which maps to `#5FA8D3` — needs to be `ring-primary-400/40` for consistency
- No consistent error state across all uses

**Redesigned Specification:**

```
Container:  flex flex-col gap-1.5
Label:      text-sm font-semibold text-slate-700
Input:      w-full h-11 px-4 py-0 bg-white border border-slate-200 rounded-xl
            text-sm text-slate-900 placeholder:text-slate-400
            focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400
            transition-all duration-150
            disabled:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60
Error msg:  text-xs font-medium text-danger-500 flex items-center gap-1
Helper txt: text-xs text-slate-400

Height: ALWAYS h-11 (44px) — never h-10 or h-9. Touch target standard.
```

**States:**
- Default: `border-slate-200`
- Focus: `border-primary-400 ring-2 ring-primary-400/20`
- Error: `border-danger-400 ring-2 ring-danger-400/15`
- Disabled: `bg-slate-50 border-slate-100 opacity-60`
- Success: `border-success-500`

---

### 8.3 Card

**Current Problems:**
- Three different shadow values used for cards
- `rounded-2xl` and `rounded-3xl` mixed with no semantic distinction

**Unified Card System:**

```
Surface Card (default):
  bg-white rounded-2xl border border-slate-100
  shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.04)]
  
Metric Card (KPI):
  Same as Surface + relative overflow-hidden
  
Panel (full-width section container):
  bg-white rounded-3xl border border-slate-100
  shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.04)]
  
Interactive Card (clickable):
  Surface Card + cursor-pointer
  hover:border-slate-200 hover:shadow-[0_4px_20px_rgba(27,73,101,0.08)]
  transition-all duration-200

Danger Card (overdue, alerts):
  bg-danger-50/40 border border-danger-100 rounded-2xl
  hover:border-danger-200 hover:bg-danger-50/60
```

**Rule:** `rounded-2xl` = cards. `rounded-xl` = inputs, buttons, badges. `rounded-3xl` = panels/sections. `rounded-full` = avatars, pill badges.

---

### 8.4 Badge / Status Chip

**Current Problems:**
- Different border-radius across implementations (`rounded-md` vs inline styles)
- Invoice status uses `text-[11px]` — too small
- No unified padding spec

**Redesigned:**

```
Base:       inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg
            text-xs font-semibold tracking-wide leading-none
            (NO uppercase — leads to readability issues at small sizes)

Statuses:
draft:      bg-slate-100 text-slate-600
sent:       bg-primary-50 text-primary-700 border border-primary-200/60
paid:       bg-success-50 text-success-600 border border-success-200/60
overdue:    bg-danger-50 text-danger-600 border border-danger-200/60  
cancelled:  bg-slate-100 text-slate-400 line-through-none
pending:    bg-accent-50 text-accent-700 border border-accent-200/60

Dot variant (list rows): w-1.5 h-1.5 rounded-full inline-block mr-1.5 [color]
```

---

### 8.5 Data Table

**Current Problems:**
- No clear column alignment rules
- Table header `text-xs uppercase tracking-wider` is correct — keep
- Row hover state needs to be more visible

**Redesigned:**

```
Container:  overflow-hidden rounded-2xl border border-slate-100
Header row: bg-slate-50/80 border-b border-slate-100
            text-[11px] font-semibold uppercase tracking-widest text-slate-400
Data row:   bg-white border-b border-slate-50 last:border-0
            hover:bg-primary-50/40 transition-colors duration-100 cursor-pointer

Column types:
  Text:     text-left
  Numbers:  text-right font-mono tabular-nums
  Status:   text-center
  Actions:  text-right w-12 (icon button)
  
Row height: py-4 px-6 (always consistent — never py-3 or py-4.5)

Empty state: Full-width centered, min-height 320px, illustration + message + CTA
```

---

### 8.6 Sidebar (Desktop)

**Current Problems:**
- Brand area padding inconsistency
- `border-l-[3px]` active indicator + `bg-[#1B4965]/5` is a mixed metaphor — choose one
- Plan indicator is tiny and easy to miss
- The static `badge: 3` must be removed or made dynamic

**Redesigned Sidebar Spec:**

```
Width:      256px (down from 260px — cleaner number)
Background: #FFFFFF
Border:     border-r border-slate-100

Sections (top to bottom):
━━━━━━━━━━━━━━━━━━━━━━━━
BRAND AREA (h-16, px-5)
  Logo: 32px × 32px rounded-xl bg-primary-700 shadow-[0_2px_8px_rgba(27,73,101,0.20)]
  Wordmark: text-[15px] font-bold text-primary-700 tracking-tight
  TVA badge: text-[10px] font-semibold text-slate-400 uppercase tracking-wide
  Bottom border: border-b border-slate-100

NAV SECTION (flex-1, px-3, py-4)
  Section label (optional): text-[10px] font-bold uppercase tracking-widest text-slate-300 px-3 mb-2
  Nav items: gap-0.5 (minimal gap — breathes through padding)

NAV ITEM STATES:
  Default:  px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500
            hover:bg-slate-50 hover:text-slate-800 transition-all duration-150
  Active:   px-3 py-2.5 rounded-xl text-sm font-semibold text-primary-700
            bg-primary-50 — NO border-l, clean pill style

  Icon: w-[18px] h-[18px] flex-shrink-0
  Label: flex-1
  Badge: min-w-[20px] h-5 px-1.5 rounded-full bg-danger-500 text-white text-[10px] font-bold

USER FOOTER (p-4, border-t border-slate-100)
  Avatar: w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold text-sm
  Name: text-[13px] font-semibold text-slate-800
  Plan badge: text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-accent-50 text-accent-700
  Logout: text-sm text-slate-400 hover:text-danger-500 w-full rounded-xl
          hover:bg-slate-50 px-3 py-2 transition-colors
```

---

### 8.7 Mobile Navigation

**Current Problems:**
- `pb-safe` doesn't work (plugin not installed)
- No visual differentiation between active/inactive strong enough for small screens
- No floating action button (FAB) for primary action

**Redesigned Mobile Nav:**

```
Container:
  fixed bottom-0 left-0 right-0 z-40
  bg-white/90 backdrop-blur-xl
  border-t border-slate-100
  padding-bottom: env(safe-area-inset-bottom, 0px)  ← use inline style, not class

Items: 5 items, evenly distributed
  Touch target: min w-16 h-16 per item (48px+ icon area)

Item states:
  Inactive: text-slate-400, icon stroke-[1.75]
  Active:   text-primary-700, icon has filled background chip

Active indicator:
  NOT an underline dot — instead a 28px × 28px bg-primary-50 rounded-full
  behind the icon. The icon itself strokes thicker (stroke-2.5).

Label: text-[10px] font-medium, visible always (not hidden on active)

FAB (Floating Action Button):
  Position: Centered in nav bar, sits on the border-t (overlaps it)
  Size: w-14 h-14 rounded-full bg-primary-700 text-white
  Shadow: shadow-[0_4px_20px_rgba(27,73,101,0.35)]
  Icon: Plus, w-6 h-6
  This replaces the center nav item (typically replaced with a + slot)
  
  Layout: [Home] [Invoices] [FAB] [Clients] [Settings]
```

---

### 8.8 Header

**Current Problems:**
- Mobile hamburger does nothing
- Desktop header has no visual weight — `shadow-sm/50` is too subtle
- Language toggle shows the OTHER language as the button label (unintuitive)

**Redesigned Header:**

```
Height: h-16 (keep)
Background: bg-white
Border: border-b border-slate-100 (remove shadow — clean is better)

Mobile left: [Hamburger → opens DrawerSheet] [Logo mark]
Mobile right: [Lang toggle] [New Invoice FAB in nav — don't duplicate here]

Desktop left: Breadcrumb nav
  Parent: text-sm font-medium text-slate-400 hover:text-slate-700
  Separator: / text-slate-200
  Current: text-sm font-semibold text-slate-900
  
  Top-level (no parent): text-lg font-semibold text-slate-900 (NOT primary colored)
  
Desktop right:
  [Lang toggle] [Notifications] [New Invoice button]

Language toggle redesign:
  Current bug: shows "AR" when in French (shows what to switch TO)
  Fix: Show flag + current language: 🇫🇷 FR  /  🇲🇦 AR
  Design: bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5
          text-xs font-semibold text-slate-600 hover:border-slate-300

Notifications bell:
  Relative positioned button, red dot indicator for unread
  The current implementation is correct — just ensure the bell is always visible
  on desktop too (currently hidden on desktop — show it everywhere)

New Invoice (desktop):
  bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-semibold
  shadow-[0_2px_8px_rgba(27,73,101,0.20)]
  hover:bg-primary-800 active:scale-[0.98]
  Exactly ONE implementation, imported from Button component
```

---

### 8.9 Mobile Drawer / Sheet

**This component is currently MISSING and needs to be created.**

When hamburger is tapped on mobile:
```
Behavior: Slides in from left, covers 85vw max 320px
Backdrop: Fixed overlay, bg-slate-900/40 backdrop-blur-[2px]
Content: Identical to desktop Sidebar (reuse the component)
Close: Tap backdrop or X button at top-right of drawer
Animation: translate-x from -100% to 0, duration-300 ease-out
```

---

### 8.10 Modal / Dialog

**Current Problems:**
- `ConfirmDialog` component exists but native `confirm()` is used instead
- Animation uses `animate-in` which needs Tailwind animate plugin

**Redesigned Modal:**

```
Backdrop:   fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50
Container:  bg-white rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.14)]
            max-w-md w-full mx-4 overflow-hidden

Header: px-6 pt-6 pb-4
  Title: text-[17px] font-bold text-slate-900
  Close X: absolute top-4 right-4, p-2 rounded-xl hover:bg-slate-50

Body: px-6 pb-6 space-y-4

Footer: px-6 pb-6 flex gap-3 justify-end
  Buttons: min-w-[88px] (prevent button width jumping)

Animation: scale from 97% + opacity from 0, duration-200 ease-out
```

---

## 9. Screen-by-Screen Redesign

### 9.1 Login Screen

**Current:** Two-panel layout doesn't exist — it's a simple centered form. This is fine for MVP.

**Redesign:**

```
Layout: Centered single column, max-w-sm, vh-centered
Background: #F8FAFC with subtle diagonal grid pattern at 3% opacity
  (pure CSS background-image: linear-gradient... SVG dots pattern)

Logo area:
  48px × 48px rounded-2xl bg-primary-700 "F" centered
  Below: "Fatura" wordmark text-2xl font-bold text-primary-700
  Below: Tagline text-sm text-slate-500 (max 50 chars)

Form card:
  bg-white rounded-3xl p-8 shadow-[0_8px_40px_rgba(0,0,0,0.08)]
  border border-slate-100

Phone step:
  Label: "Numéro de téléphone"
  Input: Country prefix +212 shown as a select prefix, then number field
  CTA: Full-width primary button "Continuer →"
  
OTP step:
  Title: "Vérifiez votre numéro"
  Subtitle: "Code envoyé au +212 6XX XXX XXX" (masked number)
  OTP inputs: 6 individual boxes, 48px × 56px each, rounded-xl
              border-2 border-slate-200 text-2xl font-bold text-center
              focus:border-primary-700 tabular-nums
              Auto-advance on input (current behavior — keep)
  Below: "Renvoyer le code" link (gray → active after 60s countdown)
  CTA: Full-width primary button "Vérifier"
  Back: Text link "← Modifier le numéro"

Language toggle: Top-right corner of card, text-xs
DGI compliance note: Very bottom, text-[11px] text-slate-400 text-center
  "Factures conformes DGI · Données sécurisées au Maroc"
```

---

### 9.2 Onboarding (4-Step Wizard)

**Redesign:**

```
Progress indicator:
  4 connected dots, active = filled primary, completed = checkmark, future = gray ring
  "Étape 2 sur 4" text below in text-sm text-slate-500
  Full-width thin progress bar (h-1 bg-primary-100 → active portion bg-primary-700)

Step card: max-w-lg centered, rounded-3xl p-8
Step header: Step number pill (Étape 1) + Step title (h2)

Step 1 — Identité légale:
  Fields laid out with 2-column grid where logical (city + code postal)
  Legal form: Custom segmented control (SARL / SA / EI / Auto-entrepreneur)
  NOT a dropdown — radio group styled as pills

Step 2 — Régime fiscal:
  Three large radio cards, full width
  Each card: icon + title + subtitle describing the regime
  Selected: border-primary-700 bg-primary-50 checkmark top-right

Step 3 — Contact & adresse:
  Address fields in logical visual order (not alphabetical)
  City: searchable dropdown (combobox) from MOROCCAN_CITIES list

Step 4 — Branding:
  Logo upload: Large drop zone 180px × 120px, dashed border, icon + text
  Color picker: Grid of 8 color swatches + "Personnalisé" hex input
  Preview: Small invoice thumbnail that updates live as color is chosen
  Payment terms: Segmented control (7j / 15j / 30j / 45j / 60j)

Navigation:
  Back: ghost button left
  Next / Finish: primary button right, full-width on mobile
```

---

### 9.3 Dashboard

**Critical Fix:** Resolve client name display (C2).

**Redesign:**

```
Page layout: max-w-screen-xl, px-6 py-10

Greeting section:
  h1: "Bonjour, [Name]" — text-2xl font-bold text-slate-900 (remove emoji)
  Subtitle: Date string — text-sm text-slate-500 capitalize
  Right side (desktop): "Période: Avril 2026" filter chip

━━━ ROW 1: METRIC CARDS (4-column grid) ━━━
  
  Card spacing: gap-5
  
  Card Anatomy (unified):
  ┌─────────────────────────────────┐
  │  [Icon chip]  [Label]           │
  │                                 │
  │  [Big Number]                   │
  │  [Delta badge]                  │
  └─────────────────────────────────┘
  
  Icon chip: w-9 h-9 rounded-xl, color per metric
  Big number: text-2xl font-bold tabular-nums text-slate-900
  Delta: flex items-center gap-1 text-xs font-semibold
         TrendingUp/Down icon at w-3.5 h-3.5
         Positive: text-success-600
         Negative: text-danger-500
  
  Overdue card: Interactive (clickable) with ChevronRight →
  Special treatment: danger-50/40 background, danger-100 border
  Bold count: text-3xl font-bold text-danger-600

━━━ ROW 2: CHART + QUICK ACTIONS ━━━

  Chart panel (xl:col-span-2):
    Header: "Chiffre d'affaires" h2 + Period selector (dropdown, right-aligned)
    
    Improved chart:
      Add Y-axis value labels (3 values: 0, max/2, max)
      Right-aligned, text-[11px] text-slate-400 tabular-nums
      Horizontal gridlines: border-dashed border-slate-100 (not border-solid)
      Bars: max-w-[40px], rounded-t-lg
      Current month bar: accent-500 (amber) — keep this distinction
      Other bars: primary-200 → primary-700 gradient (dark to light old months)
      
      Bar hover tooltip:
        Refined: white card (not dark), rounded-xl, shadow-modal
        Content: Month name + formatted amount
        Arrow pointing down at bar

  Quick Actions panel:
    Title: "Actions rapides" h2
    
    3 action buttons, full width, vertical stack, gap-3:
    
    1. "Nouvelle Facture" — primary button, lg size, has Plus icon
    2. "Ajouter un Client" — secondary button (accent), lg size, has Users icon
    3. "Exporter TVA DGI" — outline button, md size, has Download icon
       DISABLED state with tooltip "Bientôt disponible"
       (Not a fake button that shows toast — use proper disabled + tooltip)

━━━ ROW 3: RECENT INVOICES + TOP CLIENTS ━━━

  Recent Invoices panel (lg:col-span-2):
    Client name MUST be resolved — not truncated ID
    
    Table columns: N° / Date / Client / TTC / Statut
    Each row: clickable, hover:bg-primary-50/30
    Status badge: redesigned (see 8.4)
    
    Empty state (first-time users):
      Illustration: FileText icon in a circle bg-primary-50
      Title: "Aucune facture encore"
      Subtitle: "Créez votre première facture en moins de 2 minutes."
      CTA: Primary button "Créer une facture"

  Top Clients panel:
    Rank indicator: Text number in w-7 h-7 rounded-full
    Active: bg-primary-700 text-white
    Hover: transition with bg shift
    Amount: right-aligned, font-mono tabular-nums, text-sm font-semibold
    Show "Aucun client" empty state with CTA
```

---

### 9.4 Invoices List

**Critical Fix:** Remove `indigo-600` — replace with `primary-700` everywhere.

**Redesign:**

```
Page header:
  Title: "Factures" — text-xl font-bold text-slate-900
  Subtitle: "X factures · X MAD encours" — computed, text-sm text-slate-500
  CTA: "Nouvelle facture" primary button (import from Button component)

Summary bar → REPLACE with cleaner stat strip:
  Horizontal: [Total TTC: X MAD] | [Payées: X] | [En attente: X MAD] | [En retard: X]
  Each stat separated by vertical divider, no box around the strip
  Text: text-sm, amount in font-mono tabular-nums

Filter tabs:
  Horizontal scrollable row on mobile, static on desktop
  Tab style: px-4 py-2 rounded-full text-sm font-medium
  Inactive: text-slate-500 hover:text-slate-800
  Active: bg-primary-50 text-primary-700 font-semibold
  Count bubble on each tab: small pill bg-slate-100 text-slate-500 ml-1

Search + Filter row:
  Search: Flex-1, h-10 rounded-xl border-slate-200, magnifying glass prefix icon
  Date filter: Button with Calendar icon + "Période" label
  Export: Ghost button, Download icon
  All in one visual row, gap-3

Table:
  See DataTable redesign (8.5)
  
  Column widths:
    N°:      w-32 (monospace)
    Date:    w-28
    Client:  flex-1
    TTC:     w-36 text-right tabular-nums
    Échéance:w-28
    Statut:  w-24 text-center
    Actions: w-10

  Actions (per row): MoreVertical dropdown
    Options: Voir / Télécharger PDF / Marquer payée / Dupliquer / Annuler
    Dropdown: white card, rounded-xl, shadow-modal, min-w-[180px]
    Destructive items (Annuler): text-danger-500 separator above

Pagination:
  Bottom of table, right-aligned
  "Afficher 25 sur 142 factures"
  Prev/Next buttons: outline style, rounded-xl
  Page numbers: ghost buttons, active = bg-primary-50 text-primary-700

Loading state:
  Skeleton rows: 8 rows, each row has matching column structure as real data
  Animated: animate-pulse, bg-slate-100 rounded-md for each cell
  Color: bg-slate-100 (NOT indigo — fix this!)
```

---

### 9.5 Invoice Detail (View)

**Redesign:**

```
Header bar (sticky on scroll):
  [← Retour] [N° Facture][Status Badge]     [Actions]
  
  Actions group (right-aligned, gap-2):
    [Télécharger PDF] outline button
    [Envoyer] outline button  
    [• • •] More actions dropdown (Share, Duplicate, Cancel)
  
  For sent/overdue invoices: [Enregistrer paiement] primary button

Status Banner (conditional, full-width below header):
  Overdue: bg-danger-50 border-b border-danger-100 text-danger-700
           "Cette facture est en retard de X jours. Relancez votre client."
           CTA: "Envoyer relance" text link right-aligned

Two-column layout (lg):
  Left (main): Invoice preview card
  Right (sidebar): Status, timeline, payment history

Invoice Preview Card:
  Styled to mimic the actual PDF output
  Letterhead with business info + client info (2 columns)
  Lines table with quantities, unit price, TVA, total
  Footer with payment terms, bank details
  This is the "source of truth" visual — what they'll see in the PDF

Right Sidebar:
  Status card: large badge + amount + due date
  Payment Timeline: vertical list of payment events
    - "Facture créée" → date
    - "Envoyée" → date (if applicable)
    - "Paiement reçu" → date + amount (if applicable)
    Each step: circle indicator + date + description

Payment Modal (redesigned, no native confirm):
  Trigger: "Enregistrer un paiement" button
  Modal: max-w-md, rounded-3xl
  Fields: Montant (MAD), Date, Méthode (segmented control), Référence
  Partial payment: show remaining balance live as amount is typed
  Submit: "Enregistrer le paiement" primary button
```

---

### 9.6 Invoice Create

**High complexity — focus on clarity and flow.**

**Redesign:**

```
Layout: Two sections — sticky left summary, scrollable right form (on desktop)

Left sticky (lg:w-80):
  "Résumé de la facture"
  Live-updating totals as lines are added:
    HT total, TVA breakdown by rate, TTC total
  Client info summary (compact)
  Draft auto-save indicator

Right scrollable:
  
  Section 1: Client
    Searchable dropdown with existing clients
    Or "+ Nouveau client" link
    Selected client: show address, ICE, payment terms in a compact card

  Section 2: Lignes de facturation
    Each line: 
      Description (flex-1) | Qté (w-20) | PU HT (w-28) | TVA % (w-20) | Total HT (w-28) | [Delete]
    Line rows: bg-white border border-slate-100 rounded-xl p-3 mb-2
    "+ Ajouter une ligne" ghost button, full-width, dashed border
    Product picker: typeahead search from catalog

  Section 3: Conditions
    Dates: Issue date + Due date (two date inputs side by side)
    Payment terms: Segmented control (7j / 15j / 30j / 60j / Personnalisé)
    Remise globale: Number input with % suffix, only shown if toggled
    Notes: Textarea, optional

  Sticky bottom bar (mobile):
    "Brouillon enregistré" status + [Envoyer] button

  Desktop footer:
    [Enregistrer brouillon] (ghost) + [Prévisualiser] (outline) + [Finaliser et envoyer] (primary)
```

---

### 9.7 Clients

**Redesign:**

```
Page layout:
  Header: "Clients" title + "X clients actifs" subtitle + [+ Ajouter un client] button

Search + filter row:
  Search input (flex-1)
  [Ville ↓] filter dropdown
  [Trier par ↓] dropdown (Nom / CA / Dernière facture)

Client cards (grid, not table — more visual):
  Desktop: 3 columns, gap-5
  Mobile: 1 column
  
  Card:
  ┌────────────────────────────────────┐
  │ [Avatar] Name                [•••] │
  │          ICE: XXX                  │
  │          📍 Casablanca             │
  │ ────────────────────────────────── │
  │ CA Total: X MAD    Factures: X     │
  │ [Créer facture →]                  │
  └────────────────────────────────────┘
  
  Avatar: 40px initials circle, color derived from name hash
  Quick action: "Créer facture" inline button on hover (desktop), always visible (mobile)
  
  Empty state: Large centered, with illustration, CTA

Add/Edit Client Modal:
  Grouped fields:
    Group 1: "Identité" — Nom commercial, Raison sociale, ICE, IF
    Group 2: "Contact" — Téléphone, Email, Site web
    Group 3: "Adresse" — Rue, Ville, Code postal
  
  2-column grid for short fields (tel + email side by side)
  Submit: "Enregistrer le client" primary button
```

---

### 9.8 Products & Services

**Redesign:**

```
Header: "Produits & Services" + [+ Nouveau produit]

Category filter bar:
  Horizontal chips: "Tous" + each category
  Active: bg-primary-50 text-primary-700 border border-primary-200

View toggle: Grid / Liste (icon buttons, right-aligned)

Product grid (default):
  Desktop: 4 columns
  Mobile: 2 columns
  
  Card:
  ┌──────────────────────┐
  │ [Category icon/color] │
  │ Product Name          │
  │ Description truncated │
  │ ─────────────────── │
  │ Prix: X MAD HT  TVA % │
  │ [Modifier]            │
  └──────────────────────┘
  
  Category color: left border accent (4px left border in category color)

List view (alternate):
  Table format: Désignation / Catégorie / Prix HT / TVA / Prix TTC / Actions

Add/Edit Product modal:
  Category: hybrid — select existing OR type new name
  Price: Two inputs side by side (HT + auto-calculated TTC)
  TVA: Segmented control (0% / 7% / 10% / 14% / 20%)
  Unit: text input (heure, unité, kg, mois...)
```

---

### 9.9 Settings

**Current Problems:** 5 tabs on mobile overflow. Settings inputs inconsistent.

**Redesign:**

```
Layout (desktop):
  Left rail (w-48): vertical tab list, sticky
  Right content: scrollable, max-w-2xl

Layout (mobile):
  Tabs become a horizontal scroll row at top (overflow-x-auto, hide scrollbar)
  Content below

Tab style:
  Desktop (vertical):
    px-4 py-2.5 rounded-xl text-sm font-medium
    Inactive: text-slate-600 hover:bg-slate-50
    Active: bg-primary-50 text-primary-700 font-semibold
    Icons: w-4 h-4 mr-2.5
  
  Mobile (horizontal pills):
    px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap
    Same active/inactive color scheme

Per-section design:

  ENTREPRISE:
    Form grouped into cards:
      Card 1: "Identité légale" — SARL/SA/ICE/IF/RC
      Card 2: "Coordonnées" — address, tel, email, website
      Card 3: "Branding" — logo upload + color picker + invoice preview
    Save button: sticky bottom on mobile, bottom of form on desktop
    
  FACTURATION:
    TVA regime: Large 3-option card picker (not dropdown)
    Default TVA rate: segmented control
    Invoice prefix: text input with live preview "FAC-2026-0001"
    Payment terms default: segmented control
    
  BANQUE:
    Bank name, RIB, IBAN, BIC — all in one card
    "Ces informations apparaissent au bas de vos factures"
    
  ABONNEMENT:
    Plan comparison table or cards
    Current plan: highlighted with checkmark
    Upgrade CTA: primary button
    Usage stats: invoices used / limit, clients used / limit
    
  CONFORMITÉ DGI:
    Status cards for each DGI requirement
    Export UBL: primary action per invoice
    Instructions for submission
```

---

## 10. Motion & Interaction Design

### 10.1 Principles

- **Purpose over decoration**: Every animation should communicate state, guide attention, or provide feedback — never just look cool
- **Fast response**: Hover/focus transitions ≤ 150ms. Micro-interactions ≤ 200ms. Macro transitions ≤ 350ms.
- **Respect preferences**: All animations respect `prefers-reduced-motion`

### 10.2 Animation Library

```css
/* Add to index.css */

@media (prefers-reduced-motion: no-preference) {
  
  /* Page enter */
  .page-enter {
    animation: pageEnter 250ms ease-out both;
  }
  @keyframes pageEnter {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* Card appear (staggered) */
  .card-appear {
    animation: cardAppear 300ms ease-out both;
  }
  @keyframes cardAppear {
    from { opacity: 0; transform: scale(0.97) translateY(4px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }

  /* Modal enter */
  .modal-enter {
    animation: modalEnter 200ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }
  @keyframes modalEnter {
    from { opacity: 0; transform: scale(0.95); }
    to   { opacity: 1; transform: scale(1); }
  }

  /* Sidebar drawer */
  .drawer-enter {
    animation: drawerEnter 280ms cubic-bezier(0.4, 0, 0.2, 1) both;
  }
  @keyframes drawerEnter {
    from { transform: translateX(-100%); }
    to   { transform: translateX(0); }
  }

  /* Toast notification */
  .toast-enter {
    animation: toastEnter 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }
  @keyframes toastEnter {
    from { opacity: 0; transform: translateY(-16px) scale(0.9); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
}
```

### 10.3 Interaction Specs

| Interaction | Duration | Easing | Effect |
|------------|----------|--------|--------|
| Button hover | 120ms | ease | bg-color shift |
| Button press | 80ms | ease-in | scale 0.97 |
| Card hover | 180ms | ease | shadow lift + border darken |
| Nav item hover | 150ms | ease | bg-color + text-color |
| Page transition | 250ms | ease-out | fade + slide up 8px |
| Modal open | 200ms | spring | scale + fade |
| Toast appear | 300ms | spring | drop from top |
| Drawer slide | 280ms | ease-in-out | translateX |
| Tab switch | 200ms | ease | content cross-fade |
| Row hover | 100ms | ease | bg-color |

### 10.4 Chart Bar Animation

```css
/* On mount, bars animate from 0 height */
.chart-bar {
  transform-origin: bottom;
  animation: barGrow 600ms cubic-bezier(0.34, 1.1, 0.64, 1) both;
}

/* Stagger each bar by 60ms */
.chart-bar:nth-child(1) { animation-delay: 0ms; }
.chart-bar:nth-child(2) { animation-delay: 60ms; }
.chart-bar:nth-child(3) { animation-delay: 120ms; }
/* ... */

@keyframes barGrow {
  from { transform: scaleY(0); }
  to   { transform: scaleY(1); }
}
```

---

## 11. Accessibility

### 11.1 Color Contrast Requirements

| Pair | Ratio | Required | Status |
|------|-------|----------|--------|
| `#1B4965` on white | 8.6:1 | 4.5:1 AA | ✅ |
| `#5FA8D3` on white | 2.8:1 | 4.5:1 AA | ❌ Fix needed |
| `#F4A261` on white | 2.1:1 | 4.5:1 AA | ❌ Never use as text on white |
| `#2D6A4F` on white | 6.2:1 | 4.5:1 AA | ✅ |
| `#E63946` on white | 4.6:1 | 4.5:1 AA | ✅ (barely) |
| White on `#1B4965` | 8.6:1 | 4.5:1 AA | ✅ |

**Action Items:**
- `#5FA8D3` must NEVER be used as standalone text on white — only as icon/decoration color
- `#F4A261` must NEVER be text — only bg/border/icon
- For links and interactive text using secondary color, darken to `#2E7DAB` (passes AA)

### 11.2 Keyboard Navigation

Every interactive element must have:
- Visible focus ring: `focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2`
- Logical tab order
- Skip-to-content link at page top (hidden until focused)

### 11.3 Touch Targets

- Minimum touch target: 44×44px (Apple HIG / Material)
- Current mobile nav items are correct at `w-16 h-16`
- Inline action buttons (in table rows, dropdowns): minimum `w-11 h-11`
- Small icon buttons: wrap in `p-2` container = 44px with icon

### 11.4 ARIA Requirements

```html
<!-- Sidebar nav -->
<nav aria-label="Navigation principale">
<a aria-current="page">  <!-- for active link -->

<!-- Status badges -->
<span role="status" aria-label="Statut: Payée">

<!-- Modal -->
<div role="dialog" aria-modal="true" aria-labelledby="modal-title">

<!-- Loading states -->
<div role="status" aria-live="polite" aria-label="Chargement...">

<!-- Chart -->
<div role="img" aria-label="Graphique CA: Novembre 45000 MAD, Décembre 62000 MAD...">
```

### 11.5 RTL (Arabic) Support

- All layout uses logical properties where Tailwind supports: `ms-` (margin-start), `me-` (margin-end)
- Directional icons (ChevronRight, ArrowLeft) must mirror in RTL
- `<html dir="rtl">` correctly flips flexbox — verify all gap/space utilities

---

## 12. Implementation Roadmap

### Phase 1 — Critical Fixes (1–2 days)

| Task | File | Priority |
|------|------|----------|
| Fix `indigo-600` → `primary-700` throughout `Invoices.tsx` | `Invoices.tsx` | P0 |
| Resolve client names in Dashboard table (join with client data) | `Dashboard.tsx`, `useDashboard.ts` | P0 |
| Fix mobile hamburger → wire up drawer/sheet state | `Header.tsx`, new `Drawer.tsx` | P0 |
| Replace all `confirm()` / `alert()` with `ConfirmDialog` component | `Invoices.tsx`, `InvoiceView.tsx` | P0 |
| Fix `pb-safe` → `style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}` | `MobileNav.tsx` | P0 |

### Phase 2 — Design Coherence (3–5 days)

| Task | Files | Priority |
|------|-------|----------|
| Update Tailwind color tokens (full scale) | `tailwind.config.ts` | P1 |
| Unified border-radius rules (sm/md/lg/xl mapping) | Global pass | P1 |
| Unified shadow tokens | `index.css` + components | P1 |
| Refactor `inputClass` string → shared `Input` component everywhere | `Settings.tsx` | P1 |
| Remove `font-black` → max `font-bold` for numbers | App-wide | P1 |
| Add `tabular-nums` to all financial figures | App-wide | P1 |
| Remove hardcoded badge `3` → real data from context | `Sidebar.tsx` | P1 |

### Phase 3 — New Components (5–7 days)

| Component | Description |
|-----------|-------------|
| `Drawer.tsx` | Mobile slide-in sidebar sheet |
| `FAB.tsx` | Floating Action Button for mobile nav |
| Improved chart | Add Y-axis labels + gridlines + bar animation |
| `Tooltip.tsx` | For disabled buttons ("Bientôt disponible") |
| Empty states | Per-page first-time user empty states with CTA |
| Toast redesign | Use white card style, not dark pill |

### Phase 4 — Polish (2–3 days)

| Task |
|------|
| Page transition animations on route change |
| Staggered metric card entrance animations |
| Chart bar grow animations on mount |
| Consistent skeleton loading states app-wide |
| Focus-visible rings on all interactive elements |
| `prefers-reduced-motion` media query wrapper |

---

## Quick Reference: Design Decisions at a Glance

```
Border Radius:  sm=8px  md=12px  lg=16px  xl=24px  full=pill
Shadows:        card=[1+4px dual]  modal=[40px heavy]  btn=[8px brand]
Font weights:   Headings=700  Labels/Buttons=600  Body=400  Meta=500  MAX=700
Colors:         Primary text = #1B4965 (Ocean)   Never use #5FA8D3 as text
                Never use #F4A261 as text          Danger text = #E63946
Touch targets:  Min 44×44px everywhere (mobile)
Animation:      Hover=120ms  Micro=200ms  Macro=350ms  Spring for modals
Grid:           Desktop gap-6 (24px)  Mobile gap-4 (16px)  Always multiples of 4px
```

---

*Document authored by Claude · Fatura Design System v1.0 · April 2026*
