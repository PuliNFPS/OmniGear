# 005 — Transition the properties that actually change

- **Status**: DONE
- **Commit**: 3e2539f
- **Severity**: MEDIUM
- **Category**: 7 — Cohesion & tokens
- **Estimated scope**: 4 files, 4 lines changed

## Problem

Four elements declare a transition on a property that never changes, while the property
that _does_ change is not transitioned. The result in each case is a transition utility
that costs a class and buys nothing, plus a visible snap.

### (a) Lighting colour swatches — `apps/web/src/components/sections/LightingSection.tsx:247`

```tsx
/* current */
'size-7 rounded-full border transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none disabled:opacity-40',
value.toUpperCase() === preset ? 'border-foreground' : 'border-border',
```

Selecting a preset swaps `border-border` for `border-foreground`. Nothing ever sets a
transform. Measured on **Wooting 60HE v2 → Iluminação**, across all six swatches:

```
transitionProperty: "transform, translate, scale, rotate"
transform:          "none"
```

So the declared transition can never fire, and the selection ring the user is actually
looking at appears in one frame.

### (b) Checkbox — `packages/ui/src/components/checkbox.tsx:12`

```tsx
/* current */
'peer size-5 shrink-0 rounded-[5px] border border-strong bg-background shadow-xs transition-shadow outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background',
```

Checking the box changes `border-color`, `background-color` and `color`. The transition
covers `box-shadow` only. Measured on **Viper V4 Pro → DPI**, toggling
_Eixos X/Y independentes_:

```
transitionProperty: "box-shadow"
background-color before click: rgb(13, 13, 13)
background-color after click:  rgb(245, 245, 245)
transitions running during the toggle: none
```

The box inverts instantly — the one control in the app where a short crossfade would
actually explain that the state flipped.

### (c) Select trigger — `packages/ui/src/components/select.tsx:32`

```tsx
/* current, relevant fragment */
'... shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring ... aria-invalid:border-destructive ... dark:bg-input/30 dark:hover:bg-input/50 ...';
```

Measured live: `transitionProperty: "color, box-shadow"`. But `dark:hover:bg-input/50`
changes `background-color` and `focus-visible:border-ring` /
`aria-invalid:border-destructive` change `border-color`. Neither is in the list, so in
dark mode the profile picker's hover background snaps.

### (d) Input — `packages/ui/src/components/input.tsx:11`

```tsx
/* current, relevant fragment */
'... shadow-xs transition-[color,box-shadow] outline-none ... focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 ... aria-invalid:border-destructive dark:aria-invalid:ring-destructive/40',
```

Measured live: `transitionProperty: "color, box-shadow"`. The focus ring fades in
(box-shadow) while the border colour it is drawn against jumps. The `aria-invalid`
path is reachable in normal use — `LightingSection.tsx:228` sets `aria-invalid` while
the hex field holds an incomplete value, so typing `#FF` flips the border straight to
red under a fading ring.

## Target

Each fix is the same shape: name the properties that change.

```tsx
/* (a) LightingSection.tsx:247 — target */
'size-7 rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none disabled:opacity-40',
```

```tsx
/* (b) checkbox.tsx:12 — target */
'peer size-5 shrink-0 rounded-[5px] border border-strong bg-background shadow-xs transition-[color,background-color,border-color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background',
```

```tsx
/* (c) select.tsx:32 — target: only the transition utility changes */
transition - [color, background - color, border - color, box - shadow];
```

```tsx
/* (d) input.tsx:11 — target: only the transition utility changes */
transition - [color, border - color, box - shadow];
```

No durations or easings are specified anywhere here. All four inherit
`--duration-fast` (120ms) and `--ease-hover` from plan 001, which is what the audit
prescribes for colour changes. Adding a per-component duration would reintroduce
exactly the scattered-values problem plan 001 exists to remove.

`transition-colors` is used for (a) rather than a bracket list because it is the
repo's dominant idiom for a pure colour change and it already expands to
`color, background-color, border-color, outline-color, …` — verified live on the
sidebar links.

## Repo conventions to follow

- The explicit-list form is already the house style for mixed transitions:
  `transition-[color,box-shadow]` appears at `packages/ui/src/components/badge.tsx:8`,
  `input.tsx:11` and `select.tsx:32`. No spaces inside the brackets — measured working.
- `transition-colors` is the house style for pure colour changes: 14 usages across
  `apps/web/src/components`, e.g. `DeviceWorkspace.tsx:101` and `AppHeader.tsx:48`.
- Best exemplar of a correctly scoped transition already in the repo:
  `packages/ui/src/components/switch.tsx:11-18` — the track declares
  `transition-colors` for its colour change and the thumb declares
  `transition-transform` for its real `translate-x-5`. Each names what it animates.

## Steps

1. `apps/web/src/components/sections/LightingSection.tsx:247` — change
   `transition-transform` to `transition-colors`. Leave the rest of the string and the
   conditional branch on the next line untouched.
2. `packages/ui/src/components/checkbox.tsx:12` — change `transition-shadow` to
   `transition-[color,background-color,border-color,box-shadow]`.
3. `packages/ui/src/components/select.tsx:32` — change `transition-[color,box-shadow]`
   to `transition-[color,background-color,border-color,box-shadow]`. Change nothing
   else on that line.
4. `packages/ui/src/components/input.tsx:11` — change `transition-[color,box-shadow]`
   to `transition-[color,border-color,box-shadow]`.
5. Run `pnpm exec prettier --write apps/web/src/components/sections/LightingSection.tsx packages/ui/src/components/checkbox.tsx packages/ui/src/components/select.tsx packages/ui/src/components/input.tsx`.

## Boundaries

- Do NOT touch `packages/ui/src/components/badge.tsx:8`. Its
  `transition-[color,box-shadow]` looks like the same defect but is not reachable: the
  only Badge with hover styling is `AppHeader.tsx:34`, which passes
  `transition-colors` in `className`, and `cn`/`tailwind-merge` makes the override win.
  Measured on the live header badge: `"color, background-color, border-color, …"`.
- Do NOT touch `select.tsx:57` (SelectContent) — plan 003 owns it.
- Do NOT add `active:` or scale behaviour to the colour swatches; plan 004 deliberately
  excludes them.
- Do NOT add duration or easing classes to any of these four lines.
- Do NOT change markup, props or conditional class branches — transition utilities only.
- If any "current" fragment quoted above does not match the file, STOP and report.

## Verification

- **Mechanical**:
  - `pnpm --filter @gearhub/ui lint` and `pnpm --filter @gearhub/web lint` → pass.
  - `pnpm --filter @gearhub/web build` → succeeds.
  - `grep -rn "transition-transform" apps/web/src` → no results
    (`packages/ui/src/components/switch.tsx:18` keeps its own, correctly).
  - `grep -rn "transition-shadow" packages/ui/src` → no results.
- **Feel check**: run `pnpm dev`, `http://localhost:5173`, **Explorar demonstração**.
  - **Wooting 60HE v2 → Iluminação**: click through the six colour swatches. The white
    selection ring should now ease between swatches instead of jumping. Confirm in the
    Console:
    ```js
    getComputedStyle(document.querySelector('button[aria-label^="Usar a cor"]')).transitionProperty;
    // starts with "color, background-color, border-color, …" — not "transform, translate, scale, rotate"
    ```
  - **Viper V4 Pro → DPI**: toggle _Eixos X/Y independentes_ repeatedly. The box should
    now fill and empty over 120ms rather than inverting in one frame. In DevTools →
    **Animations**, set speed to 10% and toggle again: you should see the background
    and border cross over together, not the shadow alone.
  - Switch to dark mode (the icon at the top right) and hover the **Perfil 1** picker
    in the sidebar. Its background should ease in.
  - **Wooting 60HE v2 → Iluminação**: clear the hex field and type `#FF`. The border
    should ease to red rather than snapping while the ring fades.
  - Reduced motion (**Rendering** → _prefers-reduced-motion: reduce_): all four should
    still change colour — they are colour transitions, which plan 002 deliberately
    keeps — just at whatever the browser does with a 120ms colour fade. Nothing here
    should be gated behind `motion-safe:`.
- **Done when**: both greps return nothing, the swatch console expression no longer
  reports the transform family, and the checkbox visibly crossfades at 10% speed.
