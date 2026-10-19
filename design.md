# Escrit Design System

The shared interface system for Escrit's marketplace, buyer and seller
accounts, checkout, and administration screens.

## Genre

Atmospheric: a dark, precise marketplace with restrained neon signals and
playful but purposeful interaction.

## Macrostructure family

- Marketing pages: Ecosystem Index — lead with discovery and real listings.
- App pages: Workbench — keep account tasks, deal status, and next actions
  legible and close together.
- Content pages: Workbench — preserve the existing route-specific content and
  form order inside the shared app shell.

## Theme

Midnight, anchored on cool graphite and electric cyan. The cyan signal is for
primary actions, active states, and focus; semantic payment and order states
retain their own distinct colors.

- `--color-paper`: `oklch(13% 0.022 260)`
- `--color-paper-2`: `oklch(17% 0.025 260)`
- `--color-paper-3`: `oklch(21% 0.026 260)`
- `--color-ink`: `oklch(94% 0.010 260)`
- `--color-ink-2`: `oklch(82% 0.015 260)`
- `--color-rule`: `oklch(28% 0.022 260)`
- `--color-rule-2`: `oklch(38% 0.026 260)`
- `--color-muted`: `oklch(68% 0.016 260)`
- `--color-accent`: `oklch(79% 0.14 198)`
- `--color-accent-ink`: `oklch(13% 0.022 260)`
- `--color-focus`: `oklch(82% 0.15 198)`

Light mode remains available through the theme control and uses the same hue
family with contrast-appropriate lightness.

## Typography

- Display: Tomorrow, weight 600–700, roman.
- Body: Geist, weight 400–600.
- Outlier: JetBrains Mono, used only for compact metadata and status labels.
- Display tracking: `-0.03em`.

## Spacing

Use the named 4-point scale in `client/src/styles/tokens.css`; page and
component spacing should use Tailwind utilities or those shared tokens rather
than one-off values.

## Motion

- Easings: `--ease-out`, `--ease-in`, and `--ease-in-out`.
- Reveal pattern: one short route transition; content stays readable without
  scroll-triggered reveals.
- Reduced motion: disable spatial movement and autoplay, keeping state changes
  immediate and visible.

## Microinteractions

- Hover: small, reversible lift on listing cards and primary actions.
- Focus: immediate high-contrast outline; never animate its appearance.
- Feedback: keep existing status messages and errors; do not replace them with
  decorative success toasts.
- Touch: every hover action remains available by tap or keyboard.

## CTA voice

- Primary: compact electric-cyan fill with graphite text; label the action.
- Secondary: transparent surface with a quiet rule and readable text.
- Keep action labels on one line and preserve the current destination.

## Per-page allowances

- Marketplace discovery may use real listing imagery and product-card grids.
- Account, checkout, and admin screens use the shared palette and controls;
  functional content takes precedence over decorative enrichment.
- Avoid fabricated statistics, testimonials, and seller claims.

## What pages MUST share

- The Escrit wordmark, existing route structure, and payment-state semantics.
- Graphite surfaces, cyan action/focus signal, Tomorrow + Geist typography,
  and the shared spacing and motion tokens.
- Functional account, cart, checkout, escrow, and dispute behavior.

## What pages MAY differ on

- Page-specific content hierarchy and existing form / table composition.
- Discovery surfaces may foreground imagery; account surfaces may foreground
  status, controls, and next actions.
- Light or dark palette according to the user's saved theme choice.

## Exports

### `tokens.css`

The canonical app tokens live in `client/src/styles/tokens.css`. Color channel
tokens are stored as OKLCH triplets so Tailwind's opacity modifiers continue to
work.

### Tailwind v4 `@theme`

```css
@theme {
  --color-paper: oklch(13% 0.022 260);
  --color-ink: oklch(94% 0.010 260);
  --color-accent: oklch(79% 0.14 198);
  --font-display: "Tomorrow", sans-serif;
  --font-body: "Geist", sans-serif;
  --spacing-md: 1rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### DTCG `tokens.json`

```json
{
  "color": {
    "paper": { "$value": "oklch(13% 0.022 260)", "$type": "color" },
    "ink": { "$value": "oklch(94% 0.010 260)", "$type": "color" },
    "accent": { "$value": "oklch(79% 0.14 198)", "$type": "color" }
  },
  "font": {
    "display": { "$value": "Tomorrow", "$type": "fontFamily" },
    "body": { "$value": "Geist", "$type": "fontFamily" }
  },
  "space": {
    "md": { "$value": "1rem", "$type": "dimension" }
  }
}
```

### shadcn/ui CSS variables

```css
:root {
  --background: 13% 0.022 260;
  --foreground: 94% 0.010 260;
  --primary: 79% 0.14 198;
  --primary-foreground: 13% 0.022 260;
  --muted: 28% 0.022 260;
  --muted-foreground: 68% 0.016 260;
  --border: 28% 0.022 260;
  --input: 17% 0.025 260;
  --ring: 82% 0.15 198;
  --radius: 0.75rem;
}
```
