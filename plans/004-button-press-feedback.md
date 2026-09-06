# 004 — Scope the Button transition and give pressable surfaces press feedback

- **Status**: DONE
- **Commit**: 3e2539f
- **Severity**: MEDIUM
- **Category**: 5 — Performance / 3 — Physicality & origin
- **Estimated scope**: 2 files, ~4 lines changed

## Problem

### (a) `transition-all` on the shared Button base

```tsx
/* packages/ui/src/components/button.tsx:8 — current, first line of the cva base */
"inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
```

Measured live on **Adicionar dispositivo**:

```
transitionProperty: "all"
transitionDuration: "0.15s"
```

`transition: all` animates every animatable property, including layout properties, off
the compositor. The size variants change padding (`has-[>svg]:px-3` at line 22,
`has-[>svg]:px-2.5` at line 24), so a Button that gains or loses an icon animates its
own padding on the main thread. This is the anti-pattern the audit names outright.

Every `<Button>` in the app inherits it — 26 usages across 8 files.

### (b) Nothing in the app responds to being pressed

There is no `:active` rule anywhere in `apps/web/src` or `packages/ui/src`
(`grep -rn "active:" apps/web/src packages/ui/src` returns nothing). Clicking
**Salvar no perfil**, **Configurar**, **Reconectar** or a device card produces no
physical acknowledgement at all — the only feedback is whatever the click causes
downstream, which for a save is a status change 80ms later.

## Target

### 1. `packages/ui/src/components/button.tsx:8`

Replace `transition-all` with an explicit property list, and add press feedback:

```tsx
/* target — button.tsx:8, first line of the cva base */
"inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,opacity,scale] outline-none motion-safe:active:scale-[0.97] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
```

Three things to understand about that string:

- `scale` — not `transform` — is the correct property name. Tailwind v4 compiles
  `scale-*` to the standalone CSS `scale` property. Verified two ways: measuring the
  live dialog panel (`translate: "-50% -50%"`, `transform: "none"`), and compiling the
  candidate with tailwindcss 4.3.3, which emits

  ```css
  @media (prefers-reduced-motion: no-preference) {
    .motion-safe\:active\:scale-\[0\.97\]:active {
      scale: 0.97;
    }
  }
  ```

  Listing `transform` in the transition property list would not transition the press.
  The bracket list compiles verbatim to
  `transition-property: color,background-color,border-color,box-shadow,opacity,scale;`

- No duration class is needed. Plan 001 sets `--default-transition-duration` to
  `--duration-fast` (120ms), which sits inside the audit's 100-160ms press budget.
- `motion-safe:` keeps the promise made in plan 002: movement is opt-in, so this
  disappears under `prefers-reduced-motion: reduce` while the colour and shadow
  transitions on the same element survive.

`0.97` is the audit's press value and is deliberately subtle — the range is 0.95-0.98.

### 2. `apps/web/src/components/HomePage.tsx:106`

The device cards are the largest pressable target on the home screen and are plain
`<button>`s, not `Button`s, so they need the same treatment explicitly:

```tsx
/* HomePage.tsx:106 — current */
'flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
```

```tsx
/* target */
'flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-[color,background-color,border-color,scale] motion-safe:active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
```

`0.99` rather than `0.97` because the card is roughly 560x96px; the same ratio that
reads as a press on a 36px button reads as a lurch on a card this size.

### Where press feedback deliberately does NOT go

This is a scope boundary, not an oversight. Do not add `active:scale-*` to:

- `apps/web/src/components/devices/KeyboardView.tsx:64` — the 61 keys of the keyboard
  grid (count measured in the browser).
- `apps/web/src/components/devices/MouseButtonMap.tsx:94` — the five button spots.
- `apps/web/src/components/DeviceWorkspace.tsx:101` — the sidebar navigation links.
- `apps/web/src/components/OptionGroup.tsx:56` — the segmented controls.
- `apps/web/src/components/sections/LightingSection.tsx:182` — the effect rows.
- `apps/web/src/components/sections/LightingSection.tsx:247` — the colour swatches
  (plan 005 owns that line for a different reason).

Those are the app's core editing surface, clicked continuously in a single session.
The audit's frequency rule is explicit that motion on elements hit tens of times a day
should be removed or drastically reduced, not added.

## Repo conventions to follow

- `packages/ui/src/components/button.tsx` uses `cva` with a base string plus `variants`
  (lines 7-37). Only the base string changes; leave `variants`, `defaultVariants` and
  the `Button` function untouched.
- The repo already writes explicit transition property lists in exactly this form —
  `transition-[color,box-shadow]` at `packages/ui/src/components/badge.tsx:8`,
  `input.tsx:11` and `select.tsx:32`. Imitate that syntax (no spaces inside the
  brackets); it is verified working, measured as `"color, box-shadow"` on the live
  select trigger.
- App-level components compose classes through `cn(...)` from
  `@gearhub/ui/lib/utils`; `HomePage.tsx:105` already does this.

## Steps

1. In `packages/ui/src/components/button.tsx`, replace the base string on line 8 with
   the target string from **Target section 1**. Verify `transition-all` no longer
   appears in the file.
2. In `apps/web/src/components/HomePage.tsx`, replace the class string on line 106
   with the target from **Target section 2**. Leave the conditional `selected ? ... : ...`
   branches on lines 107-109 exactly as they are.
3. Run `pnpm exec prettier --write packages/ui/src/components/button.tsx apps/web/src/components/HomePage.tsx`.

## Boundaries

- Do NOT add press feedback to any file in the "deliberately does NOT go" list above.
- Do NOT change the `cva` variants, sizes, or the `Button` component signature.
- Do NOT add a `duration-*` class to either element — the token default from plan 001
  is the intended value, and a hardcoded duration would be the duplication the audit
  flags.
- Do NOT use `transform` in the transition property list; Tailwind v4 needs `scale`.
- Do NOT add `active:` styles that are not gated by `motion-safe:`.
- `variant="link"` is currently unused (`grep -rn 'variant="link"' apps/web/src`
  returns nothing), so the base press scale is safe. If that changes, the link variant
  should opt out — but do NOT add that opt-out speculatively now.
- Do NOT add dependencies.
- If line 8 of `button.tsx` or line 106 of `HomePage.tsx` does not match the "current"
  block quoted above, STOP and report the drift.

## Verification

- **Mechanical**:
  - `pnpm --filter @gearhub/ui lint` → passes.
  - `pnpm --filter @gearhub/web lint` → passes.
  - `pnpm --filter @gearhub/web build` → succeeds.
  - `grep -rn "transition-all" packages/ui/src apps/web/src` → no results.
  - `grep -rn "active:" apps/web/src packages/ui/src` → exactly two results, both
    prefixed with `motion-safe:`.
- **Feel check**: run `pnpm dev`, open `http://localhost:5173`, click
  **Explorar demonstração**.
  - Press and hold **Adicionar dispositivo**. The button should tuck in slightly and
    spring back on release. It must not feel rubbery — if the scale is legible as
    "shrinking", it is too much.
  - Press and hold a device card in the list. The card should move less than the
    button did, proportionally.
  - Press and hold the sidebar items and several keyboard keys on
    **Wooting 60HE v2 → Teclas**. They must **not** scale. If they do, a class landed
    on the wrong element.
  - DevTools → **Rendering** → _prefers-reduced-motion: reduce_, then press the button
    again: no scale at all, but the background should still change on hover.
  - Confirm the property list took effect (Console, on the home screen):
    ```js
    getComputedStyle(document.querySelector('[data-slot="button"]')).transitionProperty;
    // "color, background-color, border-color, box-shadow, opacity, scale"  — not "all"
    ```
- **Done when**: the console expression above no longer returns `"all"`, both greps
  return what is listed, and the press is visible on buttons and cards but absent on
  the keyboard grid and sidebar.
