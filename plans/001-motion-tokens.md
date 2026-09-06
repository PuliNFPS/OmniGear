# 001 — Add motion tokens (easing + duration) to the design system

- **Status**: DONE
- **Commit**: 3e2539f
- **Severity**: HIGH
- **Category**: 7 — Cohesion & tokens
- **Estimated scope**: 1 file, ~30 lines added

## Problem

`apps/web/src/styles.css` defines a complete token system for colour and elevation
(`--background`, `--border`, `--elevation-strength`, …) but **no motion tokens at all**.
Every transition in the app therefore falls back to Tailwind's built-in defaults.

Measured in Chrome against the running app (`http://localhost:5173`), on the sidebar
navigation links, the device cards, the switch, and the 61 keyboard keys — every one
of them reports the same thing:

```
transition-duration: 0.15s
transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1)
```

Those come from `tailwindcss@4.3.3/theme.css:492-493`:

```css
/* node_modules/.pnpm/tailwindcss@4.3.3/node_modules/tailwindcss/theme.css:492 — current default */
--default-transition-duration: 150ms;
--default-transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
```

`cubic-bezier(0.4, 0, 0.2, 1)` is an **ease-in-out**. It starts slow. For a hover or a
colour change — which is what ~20 of the app's transitions are — the slow start delays
the exact frame the user is watching for. Per the audit rulebook, hover and colour
changes want `ease`, entrances want a strong `ease-out`.

Tailwind's own `--ease-out` is also too weak for deliberate motion:

```css
/* tailwindcss/theme.css:434-436 — current defaults */
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

This plan lands first. Plans 002–007 all reference the tokens it creates; without it
they would each hand-type their own curve, which is the exact duplication the audit
flags.

## Target

Two additions to `apps/web/src/styles.css`, placed between the existing `.dark` block
and the existing `@theme inline` block.

```css
/*
 * Motion tokens. The interface is a crisp utility tool, so motion is fast and
 * restrained: hover uses `ease`, anything that enters or exits uses a strong
 * ease-out, and nothing in the UI runs longer than 220ms.
 */
@theme {
  --duration-fast: 120ms; /* hover, colour and focus feedback */
  --duration-press: 160ms; /* press feedback */
  --duration-popover: 180ms; /* selects, dropdowns, popovers */
  --duration-modal: 220ms; /* dialogs */

  --ease-out: cubic-bezier(0.23, 1, 0.32, 1); /* entering and exiting */
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1); /* moving on screen */
  --ease-hover: cubic-bezier(0.25, 0.1, 0.25, 1); /* the CSS `ease` curve */

  --default-transition-duration: var(--duration-fast);
  --default-transition-timing-function: var(--ease-hover);
}
```

Effects of the last two lines: every existing bare `transition-colors`,
`transition-transform`, `transition-shadow` and `transition-[…]` in the app — about
twenty of them — moves from `150ms cubic-bezier(0.4, 0, 0.2, 1)` to
`120ms cubic-bezier(0.25, 0.1, 0.25, 1)` with no per-component edit.

`--ease-out` and `--ease-in-out` are Tailwind v4 theme keys, so redefining them also
regenerates the `ease-out` / `ease-in-out` utilities with the strong curves. That is
safe here: `grep -rn "ease-out\|ease-in-out\|ease-in\b" apps/web/src packages/ui/src`
returns **no** current usage, so nothing existing changes shape.

**The `var()`-to-`var()` indirection on the last two lines is verified**, not assumed.
Compiling exactly this `@theme` block with tailwindcss 4.3.3 emits:

```css
--default-transition-duration: var(--duration-fast);
--duration-fast: 120ms;

.transition-colors {
  transition-property: color, background-color, border-color, …;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
}
```

Both references survive to the stylesheet and resolve at runtime.

Fallback, only if the verification step below still reports `0.15s` after the two
causes named there have been ruled out: replace `var(--duration-fast)` with the literal
`120ms` and `var(--ease-hover)` with the literal `cubic-bezier(0.25, 0.1, 0.25, 1)` on
those two lines. Keep the four `--duration-*` and three `--ease-*` tokens exactly as
they are — plans 003 and 006 reference them by name.

## Repo conventions to follow

- All design tokens live in `apps/web/src/styles.css`. Colour tokens are declared in
  `:root` / `.dark` (lines 9-63) and then re-exported through `@theme inline`
  (lines 66-93). Follow that file's comment style: a short block comment above a group
  explaining the intent, in the same voice as `/* Shared elevation for cards and
floating surfaces in both themes. */` (line 116).
- Use a **separate, non-`inline` `@theme` block**. The existing block is
  `@theme inline` because its values wrap runtime vars (`hsl(var(--background))`);
  `inline` would stop the motion tokens from being emitted as CSS variables, and
  plans 003 and 006 need to reference them from hand-written CSS.
- Exemplar of the token-group style to imitate: `apps/web/src/styles.css:65-93`.

## Steps

1. Open `apps/web/src/styles.css`.
2. Find the end of the `.dark { … }` block (currently line 63, closing `}`) and the
   start of `@theme inline {` (currently line 66).
3. Insert the whole `@theme { … }` block from **Target** above between them, keeping
   one blank line either side.
4. Do not modify the existing `:root`, `.dark`, or `@theme inline` blocks.
5. Run Prettier so the file matches the repo format:
   `pnpm exec prettier --write apps/web/src/styles.css`

## Boundaries

- Do NOT touch any `.tsx` file. This plan is CSS-only.
- Do NOT remove or edit the existing `@media (prefers-reduced-motion: reduce)` block
  at `apps/web/src/styles.css:190-199`. Plan 002 owns it; changing it here would
  collide.
- Do NOT add `@keyframes` or `--animate-*` entries. Plan 003 owns those.
- Do NOT add dependencies. In particular do NOT install `tw-animate-css` or
  `tailwindcss-animate`.
- If `styles.css` no longer has a `.dark` block ending near line 63 followed by
  `@theme inline`, STOP and report the drift instead of guessing a location.

## Verification

- **Mechanical**:
  - `pnpm --filter @gearhub/web build` → succeeds.
  - `pnpm exec prettier --check apps/web/src/styles.css` → passes.
  - `pnpm --filter @gearhub/web lint` → no new errors.
- **Feel check**: run `pnpm dev`, open `http://localhost:5173`, click
  **Explorar demonstração**, then open a device with **Configurar**.
  - Hover the sidebar items (Botões / DPI / Desempenho / Parâmetros / Perfis / Geral).
    The background should catch up with the cursor noticeably sooner than before —
    it now starts immediately instead of easing in.
  - In DevTools → Console, confirm the tokens actually reached the elements:
    ```js
    const a = document.querySelector('nav a:not([aria-current])');
    getComputedStyle(a).transitionDuration; // "0.12s"
    getComputedStyle(a).transitionTimingFunction; // "cubic-bezier(0.25, 0.1, 0.25, 1)"
    getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim();
    // "cubic-bezier(0.23, 1, 0.32, 1)"
    ```
    If `transitionDuration` still reads `0.15s`, the `@theme` block was written as
    `@theme inline` or placed inside another block — fix that before continuing.
- **Done when**: the three console expressions above return exactly those values and
  the build passes.
