# 003 — Make the dialog and select entrances real (they are dead CSS today)

- **Status**: DONE
- **Commit**: 3e2539f
- **Severity**: HIGH
- **Category**: 1 — Purpose & frequency / 3 — Physicality & origin
- **Estimated scope**: 3 files (1 CSS, 2 TSX), ~60 lines

## Problem

`packages/ui/src/components/dialog.tsx` and `packages/ui/src/components/select.tsx`
carry the full shadcn animation class list. **None of those classes exist.**

```tsx
/* packages/ui/src/components/dialog.tsx:31 — current (DialogOverlay) */
'fixed inset-0 z-50 bg-black/55 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
```

```tsx
/* packages/ui/src/components/dialog.tsx:51 — current (DialogContent) */
'fixed top-1/2 left-1/2 z-50 grid w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto rounded-2xl border bg-popover p-6 text-popover-foreground shadow-2xl duration-150 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-h-[calc(100vh-4rem)]',
```

```tsx
/* packages/ui/src/components/select.tsx:57 — current (SelectContent) */
'relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
```

`animate-in`, `animate-out`, `fade-in-0`, `fade-out-0`, `zoom-in-95`, `zoom-out-95`
and `slide-in-from-*` are provided by the `tw-animate-css` / `tailwindcss-animate`
plugins. **Neither is installed and neither is imported.** Verified four ways:

- `tailwindcss@4.3.3/theme.css` defines only `--animate-spin`, `--animate-ping`,
  `--animate-pulse`, `--animate-bounce`.
- `grep -rl "animate-in" node_modules/.pnpm/tailwindcss@4.3.3/node_modules/tailwindcss`
  returns no results.
- Neither name appears in any `package.json` or in `pnpm-lock.yaml`.
- `apps/web/src/styles.css` is the only stylesheet and contains no `@plugin` and no
  `@keyframes`.

Measured in Chrome against the running app, opening **Adicionar dispositivo**:

```
document.getAnimations().length       -> 0   (before AND two frames after opening)
dialog-content  animationName         -> "none"
dialog-overlay  animationName         -> "none"
dialog-overlay  opacity               -> "1"        (the black scrim hard-cuts in)
@keyframes registered in the document -> ["spin", "pulse"]
```

Both dialogs and dropdowns are **hard cuts**. The black overlay appears at full
opacity in one frame; the panel teleports in. That affects all five dialogs
(`AddDeviceDialog.tsx:41`, `ConfirmDialog.tsx:39`, `ProfilesSection.tsx:305`,
`ProfilesSection.tsx:376`, plus `ProfileLoadConfirm`) and all three selects
(`DeviceWorkspace.tsx:77`, `KeyboardKeysSection.tsx:92`,
`MouseButtonsSection.tsx:145`).

Two more defects sit on the same lines:

**(a) `duration-150` at `dialog.tsx:51` is live and wrong.** CSS's initial
`transition-property` is `all`, so `duration-150` alone produces a real
`transition: all 150ms` on the dialog panel — measured
`transitionProperty: "all", transitionDuration: "0.15s"`. That is the anti-pattern the
audit calls out under Performance: it animates every animatable property, layout
properties included, off the compositor.

**(b) `origin-(--radix-select-content-transform-origin)` at `select.tsx:57` is dead.**
`select.tsx:48` defaults `position` to `'item-aligned'`, and all three call sites use
that default — but Radix only sets that variable inside `SelectPopperPosition`
(`@radix-ui/react-select/dist/index.mjs:712`), never in `SelectItemAlignedPosition`.
Measured with the profile dropdown open:

```
--radix-select-content-transform-origin -> (unset)
transform-origin                        -> "107.5px 53px"   (the panel's own centre)
```

So the moment a scale animation goes live, it would scale from the panel's centre. In
`item-aligned` mode the panel is deliberately laid over the trigger, so a _very_
subtle scale from centre is visually indistinguishable from a trigger-anchored one —
but the dead utility must go, and the scale must stay small enough for that to hold.

## Target

### 1. Keyframes and animation tokens in `apps/web/src/styles.css`

Extend the `@theme` block created by plan 001 with these entries:

```css
@theme {
  /* ...plan 001 duration and easing tokens stay above... */

  --animate-overlay-in: overlay-in var(--duration-modal) var(--ease-out);
  --animate-overlay-out: overlay-out var(--duration-fast) var(--ease-out);
  --animate-dialog-in: dialog-in var(--duration-modal) var(--ease-out);
  --animate-dialog-out: dialog-out var(--duration-fast) var(--ease-out);
  --animate-popover-in: popover-in var(--duration-popover) var(--ease-out);
  --animate-popover-out: popover-out var(--duration-fast) var(--ease-out);
  --animate-fade-in: overlay-in var(--duration-fast) var(--ease-out);
  --animate-fade-out: overlay-out var(--duration-fast) var(--ease-out);

  /*
   * Panels scale from 0.96/0.98, never from 0 — nothing appears out of nothing.
   * Only `scale` and `opacity` are animated: Tailwind v4 centres the dialog with the
   * separate `translate` property (measured `translate: -50% -50%`,
   * `transform: none`), so touching `transform` here would fight the centring.
   */
  @keyframes overlay-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes overlay-out {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
  @keyframes dialog-in {
    from {
      opacity: 0;
      scale: 0.96;
    }
    to {
      opacity: 1;
      scale: 1;
    }
  }
  @keyframes dialog-out {
    from {
      opacity: 1;
      scale: 1;
    }
    to {
      opacity: 0;
      scale: 0.96;
    }
  }
  @keyframes popover-in {
    from {
      opacity: 0;
      scale: 0.98;
    }
    to {
      opacity: 1;
      scale: 1;
    }
  }
  @keyframes popover-out {
    from {
      opacity: 1;
      scale: 1;
    }
    to {
      opacity: 0;
      scale: 0.98;
    }
  }
}
```

Timing rationale: dialogs enter over `--duration-modal` (220ms, inside the audit's
200-500ms modal budget) and leave over `--duration-fast` (120ms). Selects enter over
`--duration-popover` (180ms, inside the 150-250ms dropdown budget) and leave over
120ms. The asymmetry is deliberate — the deliberate phase (opening, where there is new
content to read) is slower; dismissal snaps.

`--animate-fade-in` / `--animate-fade-out` are the reduced-motion variants: opacity
only, no scale. They must exist rather than being omitted, because Radix keeps an
element mounted only while its computed `animation-name` is not `none`; with no
animation at all the exit would be skipped and the panel would vanish in one frame.

**Putting `@keyframes` inside a user `@theme` block is verified to work**, including
for the variant-wrapped candidates this plan actually writes. Compiling this exact
theme block with tailwindcss 4.3.3 against the candidate list
`['motion-safe:data-[state=open]:animate-dialog-in', 'motion-reduce:data-[state=closed]:animate-fade-out']`
emits:

```css
@media (prefers-reduced-motion: no-preference) {
  .motion-safe\:data-\[state\=open\]\:animate-dialog-in[data-state='open'] {
    animation: var(--animate-dialog-in);
  }
}
@media (prefers-reduced-motion: reduce) {
  .motion-reduce\:data-\[state\=closed\]\:animate-fade-out[data-state='closed'] {
    animation: var(--animate-fade-out);
  }
}
@keyframes dialog-in { … }
@keyframes overlay-out { … }
```

Fallback, only if the `animationName` check below still reports `none`: move the six
`@keyframes` blocks out of `@theme` to the top level of `styles.css`, and leave the
eight `--animate-*` entries inside it.

### 2. `packages/ui/src/components/dialog.tsx`

```tsx
/* target — DialogOverlay, replacing line 31 */
'fixed inset-0 z-50 bg-black/55 data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in',
```

```tsx
/* target — DialogContent, replacing line 51 */
'fixed top-1/2 left-1/2 z-50 grid w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto rounded-2xl border bg-popover p-6 text-popover-foreground shadow-2xl motion-safe:data-[state=closed]:animate-dialog-out motion-safe:data-[state=open]:animate-dialog-in motion-reduce:data-[state=closed]:animate-fade-out motion-reduce:data-[state=open]:animate-fade-in sm:max-h-[calc(100vh-4rem)]',
```

Note what left the string: `duration-150` (defect (a) above) and every
`animate-in` / `fade-*` / `zoom-*` class. The overlay is opacity-only, so it needs no
`motion-safe:` gate and runs identically in both modes.

### 3. `packages/ui/src/components/select.tsx`

```tsx
/* target — SelectContent, replacing line 57 */
'relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md motion-safe:data-[state=closed]:animate-popover-out motion-safe:data-[state=open]:animate-popover-in motion-reduce:data-[state=closed]:animate-fade-out motion-reduce:data-[state=open]:animate-fade-in',
```

Removed: the dead `origin-(--radix-select-content-transform-origin)` and the four dead
`slide-in-from-*` classes. Leave lines 58-59 (the `position === 'popper'` offsets)
exactly as they are.

## Repo conventions to follow

- `packages/ui` is a source-only shadcn kit: each component is a plain function with a
  `data-slot` attribute and a single `cn(...)` call merging a base string with
  `className`. Keep that shape; change only the base string.
- Motion tokens and keyframes live in `apps/web/src/styles.css`, which already
  `@source`s the UI package (`@source "../../../packages/ui/src";`, line 2) — that is
  why classes used inside `packages/ui` get generated at all. Do not add a second
  stylesheet.
- Exemplar of a correct, already-working transition in this kit:
  `packages/ui/src/components/switch.tsx:18` — it transitions the property that
  actually changes (`transition-transform` paired with a real
  `data-[state=checked]:translate-x-5`).
- Tailwind v4 keyframes belong **inside** the `@theme` block next to their
  `--animate-*` entry; that is what upstream Tailwind does in
  `tailwindcss/theme.css:438-443`.

## Steps

1. In `apps/web/src/styles.css`, extend the `@theme` block added by plan 001 with the
   eight `--animate-*` declarations and the six `@keyframes` from **Target section 1**.
2. In `packages/ui/src/components/dialog.tsx`, replace the base string on line 31 with
   the DialogOverlay target string.
3. In the same file, replace the base string on line 51 with the DialogContent target
   string. Confirm `duration-150` is gone.
4. In `packages/ui/src/components/select.tsx`, replace the base string on line 57 with
   the SelectContent target string. Confirm `origin-(...)` and all `slide-in-from-*`
   are gone, and that `max-h-(--radix-select-content-available-height)` is still there.
5. Run `pnpm exec prettier --write packages/ui/src/components/dialog.tsx packages/ui/src/components/select.tsx apps/web/src/styles.css`.

## Boundaries

- Do NOT install `tw-animate-css` or `tailwindcss-animate`, or any other dependency.
  The repo gates on `knip` and `pnpm verify`; the keyframes above are deliberately
  hand-written so the curves come from the project's own tokens.
- Do NOT change `select.tsx:48` (`position = 'item-aligned'`) or pass
  `position="popper"` anywhere. Switching Radix positioning modes changes where the
  dropdown appears on screen, which is a design decision outside this plan. It is
  logged as a follow-up in `plans/README.md`.
- Do NOT touch `select.tsx:32` (SelectTrigger) — plan 005 owns it.
- Do NOT change any component's markup, props, or exports. Base class strings and
  `styles.css` only.
- Do NOT use `scale(0)` or any scale below `0.9`.
- If plan 001's `@theme` block is not present in `styles.css`, STOP — run plan 001
  first. If any line quoted above does not match what you find, STOP and report the
  drift instead of improvising.

## Verification

- **Mechanical**:
  - `pnpm --filter @gearhub/ui lint` (runs `tsc --noEmit`) → passes.
  - `pnpm --filter @gearhub/web build` → succeeds.
  - `pnpm exec prettier --check .` → passes.
  - `grep -c "animate-in\|animate-out\|fade-in-0\|zoom-in-95\|slide-in-from" packages/ui/src/components/*.tsx`
    → `0` for every file.
- **Feel check**: run `pnpm dev`, go to `http://localhost:5173`, click
  **Explorar demonstração**.
  - Click **Adicionar dispositivo**. The black scrim should fade up rather than
    appear, and the panel should come in slightly small and settle. Close it — the
    exit should be visibly quicker than the entrance.
  - Open a device with **Configurar**, then open the **Perfil 1** dropdown in the
    sidebar. It should fade and settle from 0.98; because the panel sits over the
    trigger in `item-aligned` mode, it should not read as growing from anywhere odd.
  - DevTools → **Animations** panel → set speed to **10%** and reopen both. Watch for:
    the panel must never start from nothing (no `scale(0)` pop), and the overlay and
    panel must finish together rather than the scrim landing first.
  - Spam the dropdown trigger open and closed quickly. Keyframes restart from zero by
    design — confirm this produces no visible flicker at normal speed. If it does,
    report it rather than converting to transitions; that is a separate change.
  - DevTools → **Rendering** → _prefers-reduced-motion: reduce_. Reopen the dialog and
    the dropdown: both must still **fade** (so Radix still runs its exit) and must
    **not scale**. Confirm in the Console with the dialog open:
    ```js
    getComputedStyle(document.querySelector('[data-slot="dialog-content"]')).animationName;
    // "overlay-in"  — the fade variant, not "dialog-in"
    ```
  - Confirm the stray transition is gone (dialog open, normal motion):
    ```js
    getComputedStyle(document.querySelector('[data-slot="dialog-content"]')).transitionDuration;
    // "0s" — the `transition: all 150ms` produced by `duration-150` is gone
    ```
    Check the _duration_, not the property. `transition-property` computes to `all`
    on every element in the document — that is the CSS initial value, and with a `0s`
    duration it transitions nothing.
- **Done when**: `document.getAnimations().length` is greater than 0 two frames after
  opening a dialog (it is `0` today), both console expressions above hold, and the
  grep for dead classes returns `0`.
