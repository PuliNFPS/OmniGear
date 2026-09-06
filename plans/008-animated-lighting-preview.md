# 008 — Make the lighting preview actually simulate the animated effects

- **Status**: DONE
- **Commit**: 3e2539f
- **Severity**: MEDIUM (additive, highest visual payoff in the app)
- **Category**: 8 — Missed opportunities
- **Estimated scope**: 3 files, ~60 lines

## Problem

The keyboard's lighting screen is labelled **"Prévia simulada"**
(`LightingSection.tsx:85`) and the simulation does not simulate. Four of the five demo
effects declare themselves animated, with explicit descriptions of what they do
(`apps/web/src/hardware/demoDevices.ts:336-362`):

```ts
{ id: 'respiracao', label: 'Respiração', description: 'A cor escolhida acende e apaga continuamente.', animated: true,  usesColor: true  },
{ id: 'onda',       label: 'Onda',       description: 'A cor percorre o teclado da esquerda para a direita.', animated: true, usesColor: true },
{ id: 'espectro',   label: 'Espectro',   description: 'Ciclo contínuo de cores, sem cor definida.', animated: true, usesColor: false },
{ id: 'reativo',    label: 'Reativo',    description: 'A tecla acende ao ser pressionada.', animated: true, usesColor: true  },
```

Choosing one of them enables the **Velocidade** slider — `LightingSection.tsx:44`
computes `const animated = settings.enabled && (effect?.animated ?? false)` purely to
gate that control, and `LightingSection.tsx:135-143` writes `settings.speed`.

But the preview renders a single static box-shadow, and `speed` never reaches it:

```tsx
/* apps/web/src/components/devices/KeyboardView.tsx:17-18 — current */
/** Simulated lighting drawn over the keys. */
glow?: { color: string; intensity: number } | null;
```

```tsx
/* apps/web/src/components/devices/KeyboardView.tsx:55-60 — current */
...(glow && !selected
  ? {
      borderColor: hexToRgba(glow.color, 0.55),
      boxShadow: `0 0 calc(var(--key-unit) * 0.24) ${hexToRgba(glow.color, 0.12 + (glow.intensity / 100) * 0.5)}`,
    }
  : {}),
```

```tsx
/* apps/web/src/components/sections/LightingSection.tsx:90-96 — current */
glow={
  settings.enabled
    ? { color: usesColor ? settings.color : '#FFFFFF', intensity: settings.brightness }
    : null
}
```

So the user selects **Respiração**, reads "acende e apaga continuamente", drags
**Velocidade** to 50% — and 61 keys sit there glowing at a constant brightness. The
one screen where motion _is_ the content has none of it. Selecting **Espectro**
("ciclo contínuo de cores") shows a fixed white glow.

This is the app's biggest visual gap and the clearest case in the codebase for adding
motion rather than correcting it.

### Why continuous animation is allowed here

The audit is otherwise hostile to infinite, decorative motion. This is not decorative:
it is a **simulation of the device's behaviour** — the same category as a video
preview. The description text makes a claim, and the animation is what makes the claim
true. It is also confined to one screen the user visits deliberately, not chrome that
follows them around.

That exemption does **not** extend to reduced motion. Continuous pulsing and travelling
light are exactly what a vestibular-sensitive user needs to avoid, so under
`prefers-reduced-motion: reduce` the preview keeps today's static glow. That is a
complete, honest fallback: the effect list, the descriptions and the Velocidade value
still communicate what the effect does.

## Target

Animate the glow's **opacity** (and, for Espectro, its hue) with CSS keyframes. Opacity
is colour-agnostic, so one keyframe serves every colour the user picks, and it stays on
the compositor.

### 1. Keyframes in `apps/web/src/styles.css`

Add to the `@theme` block from plans 001 and 003:

```css
@theme {
  /* ...earlier tokens and keyframes stay above... */

  /*
   * Lighting preview. These are a simulation of the keyboard's own behaviour, not
   * interface motion, so they run continuously — but only when the visitor has not
   * asked for reduced motion. Duration comes from the Velocidade setting, passed in
   * as an inline animation-duration.
   */
  @keyframes key-breathe {
    0%,
    100% {
      opacity: 0.22;
    }
    50% {
      opacity: 1;
    }
  }
  @keyframes key-spectrum {
    from {
      filter: hue-rotate(0deg);
    }
    to {
      filter: hue-rotate(360deg);
    }
  }
}
```

`key-breathe` serves both **Respiração** (every key in unison) and **Onda** (the same
pulse, offset per key by a delay derived from the key's horizontal position, which
reads as light travelling left to right).

### 2. `apps/web/src/components/devices/KeyboardView.tsx`

Widen the `glow` prop and render the glow as an animated overlay instead of an inline
box-shadow on the key itself:

```tsx
/* target — replacing lines 17-18 */
/** Simulated lighting drawn over the keys. `effect` and `speed` drive the animation. */
glow?: {
  color: string;
  intensity: number;
  /** Effect id from the device capabilities; unknown ids render a static glow. */
  effect?: string;
  /** 0-100 from the Velocidade setting. Ignored by static effects. */
  speed?: number;
} | null;
```

Inside the component, before the `keys.map(...)`:

```tsx
// Velocidade 0 is the slowest useful cycle, 100 the fastest. Kept above 400ms so a
// fast setting still reads as a pulse rather than a flicker.
const cycleMs = glow?.speed === undefined ? 1600 : 2400 - glow.speed * 20;
const animatedGlow =
  glow?.effect === 'respiracao' || glow?.effect === 'onda' || glow?.effect === 'espectro';
```

> **Correction applied during implementation.** The overlay cannot be a _child_ of the
> key: the key carries `overflow-hidden` (`KeyboardView.tsx:64`) to clip its label in
> the non-interactive `<span>` branch, and that would clip the outer halo too. The glow
> is therefore rendered as a **sibling layer** — absolutely positioned with the same
> geometry, drawn after the keys so it sits over them, `pointer-events-none` and
> `aria-hidden`. It carries both the tinted border and the halo, so the two fade
> together and "acende e apaga" reads correctly. It also means the key element itself
> needs no change at all beyond removing the glow from `keyStyle`.
>
> The settings field is `effectId`, not `effect` (`packages/shared/src/keyboard.ts:54`).
>
> **Espectro needed a second fix, found by looking at the rendered page.** The effect
> has `usesColor: false`, so `LightingSection` passes `color: '#FFFFFF'` — and
> `hue-rotate` on white is a no-op. The first implementation therefore rendered
> "Ciclo contínuo de cores" as a static white glow, reproducing the exact honesty gap
> this plan exists to close. The glow layer now seeds from a saturated `#FF0000` when
> the effect is `espectro` and sweeps the full circle from there. This was invisible to
> every mechanical check — build, lint, and the `animationName` assertion all passed.

Then, for each key, move both the `borderColor` and the `boxShadow` off the key and
onto a sibling glow layer, rendered for every key except the selected one:

```tsx
<span
  aria-hidden="true"
  className={cn(
    'pointer-events-none absolute inset-0',
    animatedGlow && 'motion-safe:animate-key-breathe',
    glow?.effect === 'espectro' && 'motion-safe:animate-key-spectrum',
  )}
  style={{
    borderRadius: 'inherit',
    boxShadow: `0 0 calc(var(--key-unit) * 0.24) ${hexToRgba(glow.color, 0.12 + (glow.intensity / 100) * 0.5)}`,
    animationDuration: `${cycleMs}ms`,
    animationTimingFunction: glow.effect === 'espectro' ? 'linear' : 'ease-in-out',
    animationIterationCount: 'infinite',
    // Onda: light travels left to right, so each key starts one step later.
    animationDelay: glow.effect === 'onda' ? `${(key.x / columns) * cycleMs}ms` : undefined,
  }}
/>
```

`linear` for Espectro because it is constant motion; `ease-in-out` for the breathing
pulse. Both match the audit's easing decision table.

Note the two `motion-safe:` gates: under reduced motion the overlay still renders with
its box-shadow but never animates, which is exactly today's static appearance.

`columns` is already computed at `KeyboardView.tsx:31`, and `key.x` is already used at
line 48, so the Onda delay needs no new geometry.

### 3. `apps/web/src/components/sections/LightingSection.tsx`

Pass the two new fields through:

```tsx
/* target — replacing lines 90-96 */
glow={
  settings.enabled
    ? {
        color: usesColor ? settings.color : '#FFFFFF',
        intensity: settings.brightness,
        effect: settings.effect,
        speed: settings.speed,
      }
    : null
}
```

Read the actual field names off `LightingSettings` in `packages/shared/src` before
writing this — the effect id may be named `effect`, `effectId` or similar. Use whatever
`LightingSection` already reads when it computes `effect` around line 44; do not invent
a name.

### Out of scope: `reativo`

**Reativo** ("A tecla acende ao ser pressionada") is press-driven, not continuous. It
needs interaction design — which press, for how long, and how it coexists with key
selection on a screen where clicking a key means "remap this key". Leave it rendering
the static glow. Do not improvise a behaviour for it.

## Repo conventions to follow

- `KeyboardView` builds one `keyStyle` object per key and passes it as an inline
  `style` (lines 47-61), because every dimension is derived from the `--key-unit`
  container query variable. Follow that: geometry and colour stay inline, animation
  _selection_ goes in the class list.
- The component already renders an absolutely-positioned decorative child with
  `aria-hidden="true"` and `--key-unit`-relative sizing — the remap dot at lines
  102-114. Imitate that pattern for the glow overlay.
- Keyframes belong in the `@theme` block of `apps/web/src/styles.css`, next to plans
  003 and 006.
- `hexToRgba` comes from `../../app/color` and is already imported at line 4.

## Boundaries

- Do NOT add a dependency. This is CSS keyframes plus inline style values; Motion,
  Framer Motion and ReactVibe are all out of scope — see the dependency decision in
  `plans/README.md`.
- Do NOT animate `box-shadow`, `background-color` or `filter` on the key element
  itself. Animate `opacity` (and `hue-rotate` for Espectro) on the overlay only.
- Do NOT animate the selected key's glow. The current code already skips the glow when
  `selected`; keep that — a pulsing selection would fight the remap affordance.
- Do NOT change the keyboard's geometry, the remap dot, the focus rings, or
  `onSelectKey`.
- Do NOT implement `reativo`.
- Do NOT let the animation run under `prefers-reduced-motion: reduce`; both classes
  must carry the `motion-safe:` prefix.
- Do NOT invent a field name for the effect id — read it from `LightingSettings`.
- Requires plans 001 and 002 (tokens and the reduced-motion architecture). If
  `styles.css` still has the blanket `transition-duration: 0.01ms !important` rule,
  STOP and run plan 002 first.

## Verification

- **Mechanical**:
  - `pnpm --filter @gearhub/web lint` → passes.
  - `pnpm --filter @gearhub/web test` → passes.
  - `pnpm --filter @gearhub/web build` → succeeds.
  - `pnpm audit:boundaries` → passes (no new cross-package import).
  - `pnpm exec prettier --check .` → passes.
- **Feel check**: `pnpm dev`, `http://localhost:5173`, **Explorar demonstração**, open
  **Wooting 60HE v2** with **Configurar**, go to **Iluminação**.
  - **Estático**: the preview must look exactly as it does today — a constant glow,
    Velocidade disabled.
  - **Respiração**: all 61 keys should pulse together. Drag **Velocidade** from 0 to
    100 and confirm the pulse visibly speeds up and never becomes a strobe.
  - **Onda**: the pulse should sweep left to right across the board and repeat
    seamlessly. If it looks like random flicker, the delay is not derived from `key.x`.
  - **Espectro**: the glow should cycle through hues continuously. The colour swatches
    and hex field are disabled for this effect (`usesColor: false`) — confirm they
    still are.
  - **Reativo**: static glow, no animation. Expected.
  - Change the colour to `#FF0000` while Respiração is running; the pulse must keep its
    rhythm and simply change colour — proof the animation is opacity-based, not
    colour-baked.
  - **Performance.** 61 keys animating at once is the heaviest thing in the app. Open
    DevTools → **Performance**, record five seconds on Respiração, and confirm the
    frame rate holds at 60fps with no long tasks. If it drops, report the measurement
    rather than reducing the effect quality on your own judgement.
  - **Reduced motion**: DevTools → **Rendering** → _prefers-reduced-motion: reduce_.
    Every effect must render the static glow, identical to Estático's appearance but
    with each effect's own colour. Nothing may pulse, sweep, or cycle. Confirm:
    ```js
    getComputedStyle(document.querySelector('[aria-hidden="true"].absolute.inset-0')).animationName;
    // "none" under reduced motion
    ```
- **Done when**: Respiração pulses, Onda sweeps left to right, Espectro cycles hue,
  Velocidade changes the rate of all three, reduced motion renders all of them static,
  and the Performance recording holds 60fps.
