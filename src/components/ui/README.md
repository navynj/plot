# components/ui/ — shadcn primitives, generic only

**May live here:** shadcn/ui-generated primitives and equally generic behavior
wrappers (e.g. `scroll-anchor`). Everything here must be reusable by any
feature: props in, markup out.

**May not live here:** feature or domain logic of any kind. Nothing in this
directory may know what a node, field, or view is. Feature components
(`components/<feature>/`) compose these primitives; the dependency never points
the other way.

## Design tokens (settled Phase 1.6)

- **Stack:** shadcn/ui, Radix primitives, `radix-nova` style, Lucide icons.
  CSS-variable theming in `src/app/globals.css`; `cn()` helper in `lib/utils`.
- **Color:** `neutral` base (pure grayscale oklch); semantic tokens
  (`background`, `foreground`, `muted`, `border`, `primary`, …) — style with
  tokens, never raw palette classes like `neutral-500`.
- **Radius:** `--radius: 0.625rem` (Nova default).
- **Font:** Geist Sans (`--font-sans`) / Geist Mono (`--font-mono`) via
  `next/font`, wired into the theme.
- **Dark mode:** follows the system preference (`prefers-color-scheme`) — there
  is no theme toggle, so the `dark` variant is media-query based, not
  class-based.

Add a primitive with `pnpm dlx shadcn@latest add <name>` — pull components as
phases need them, not the whole catalog.
