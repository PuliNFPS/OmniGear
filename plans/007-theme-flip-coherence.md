# 007 — Make the theme switch atomic instead of a two-stage flip

- **Status**: DONE
- **Commit**: 3e2539f
- **Severity**: MEDIUM
- **Category**: 7 — Cohesion & tokens
- **Estimated scope**: 2 files, ~20 lines

## Problem

Toggling the theme flips a single class on the document root:

```ts
/* apps/web/src/app/useTheme.ts:24-26 — current */
useEffect(() => {
  document.documentElement.classList.toggle('dark', theme === 'escuro');
}, [theme]);
```

Every colour in the app is a token on `:root` / `.dark`
(`apps/web/src/styles.css:9-63`), so the class swap changes all of them at once. But
the elements do not _arrive_ at once, because roughly a quarter of them carry
`transition-colors` and the rest do not.

Measured in Chrome on **Viper V4 Pro → Parâmetros**, two frames after clicking the
theme button:

```
html  transition-duration: "0s"     background-color: rgb(13,13,13) -> rgb(243,243,241)  (same frame)
body  transition-duration: "0s"

document.getAnimations() during the switch: 126 running transitions, 150ms each
  color               25
  border-top-color    24
  border-right-color  24
  border-bottom-color 24
  border-left-color   24
  background-color     5
```

So the page ground snaps to the new theme in one frame while 126 element transitions
crossfade behind it over the following 150ms. The theme arrives in two waves: the
backdrop first, then the cards, borders and text catching up. On the Parâmetros screen,
which is a long list of bordered rows, this is the worst case; other screens run fewer
transitions but have the same split.

None of those 126 transitions were authored for the theme switch — they exist for
hover feedback on sidebar links, cards, keys and switches, and the theme flip
accidentally triggers all of them at once.

## Target

Make the switch atomic. The theme is a rare, deliberate action on a crisp utility
interface; an instant, coherent flip reads as correct, and it is far cheaper than
coordinating a 126-element crossfade.

Suppress transitions for the two frames the class change takes, then restore them.

### 1. `apps/web/src/styles.css`

Add near the other global rules — after the `button, input, select, textarea` block
(currently lines 110-115) and before the `/* Shared elevation … */` comment
(currently line 117):

```css
/*
 * The theme flips atomically. Without this the page background changes in a single
 * frame while every element carrying `transition-colors` crossfades behind it —
 * measured 126 of them on the Parâmetros screen — so the new theme arrives in two
 * waves. The attribute is set by useTheme.ts and removed two frames later.
 */
[data-theme-switching],
[data-theme-switching] *,
[data-theme-switching] *::before,
[data-theme-switching] *::after {
  transition: none !important;
}
```

This looks like the blanket rule plan 002 deleted, and it is deliberately different:
that one applied permanently to a whole class of users and destroyed their loading
feedback. This one is scoped to an attribute that exists for two animation frames
during an explicit user action, and it removes motion that nobody authored.

### 2. `apps/web/src/app/useTheme.ts`

```ts
/* target — replacing lines 24-26 */
useEffect(() => {
  const root = document.documentElement;
  // Transitions are suppressed while the class swaps so the whole interface
  // changes in one frame instead of the background leading and the rest following.
  root.setAttribute('data-theme-switching', '');
  root.classList.toggle('dark', theme === 'escuro');

  // One frame for the new class to apply, a second for the styles to settle.
  const frame = requestAnimationFrame(() =>
    requestAnimationFrame(() => root.removeAttribute('data-theme-switching')),
  );
  return () => cancelAnimationFrame(frame);
}, [theme]);
```

Two frames is the minimum that reliably covers the recalculation; one frame can leave
the attribute removed before the new styles have been applied, which lets a few
transitions start after all.

The effect also runs on mount, adding and removing the attribute once during the first
paint. That is harmless — nothing is transitioning yet.

`prefers-reduced-motion` needs no special handling here: the outcome is _less_ motion
in both modes.

## Repo conventions to follow

- `useTheme.ts` owns the theme end to end and is the only place that touches the
  `dark` class (`apps/web/src/app/useTheme.ts:20-41`). The inline script in
  `apps/web/index.html:12-27` sets the class before first paint and then hands over —
  its comment says so explicitly. Do not add theme logic anywhere else.
- Hooks in `apps/web/src/app/` use `useCallback`/`useEffect` directly with no helper
  abstractions; keep that shape.
- Comments explain _why_, in full sentences — see `useTheme.ts:20`
  (`/** Keeps the chosen theme; falls back to the system preference on first visit. */`)
  and `useTheme.ts:34` (`// A blocked storage must not prevent the theme from
changing.`). Match that voice.
- Global CSS rules live in `apps/web/src/styles.css`, the repo's only stylesheet.

## Steps

1. In `apps/web/src/styles.css`, insert the `[data-theme-switching]` rule and its
   comment after the `button, input, select, textarea { font: inherit; }` block
   (currently ends at line 115) and before the `/* Shared elevation … */` comment
   (currently line 117).
2. In `apps/web/src/app/useTheme.ts`, replace the `useEffect` at lines 24-26 with the
   target version above.
3. Run `pnpm exec prettier --write apps/web/src/styles.css apps/web/src/app/useTheme.ts`.

## Boundaries

- Do NOT add a colour transition to `html` or `body`. That would fix the ground but
  leave the elements without `transition-colors` still snapping — it makes the split
  less visible rather than removing it, and it puts a full-page paint on a timer.
- Do NOT change `apps/web/index.html`. The pre-paint script is correct and must stay
  synchronous.
- Do NOT change the `Theme` type, the storage key, `toggleTheme`, or
  `apps/web/src/components/AppHeader.tsx`.
- Do NOT use a `setTimeout` instead of the two `requestAnimationFrame` calls; a timer
  can fire in the middle of a frame and let some transitions start.
- Do NOT extend the `[data-theme-switching]` rule to also disable animations. The
  loading spinner must keep turning if a save is in flight when the theme is toggled.
- Do NOT add dependencies.
- If `useTheme.ts:24-26` does not match the quoted `useEffect`, STOP and report.

## Verification

- **Mechanical**:
  - `pnpm --filter @gearhub/web lint` → passes (the effect's cleanup satisfies
    `react-hooks`; if the linter complains, do not silence it — report it).
  - `pnpm --filter @gearhub/web test` → passes.
  - `pnpm --filter @gearhub/web build` → succeeds.
- **Feel check**: run `pnpm dev`, `http://localhost:5173`, **Explorar demonstração**,
  open **Viper V4 Pro** with **Configurar**, go to **Parâmetros** — the screen with the
  most bordered rows.
  - Click the sun/moon button in the header several times. The whole screen must change
    in one step. Watch the row borders and the card backgrounds specifically: before
    this plan they lag the page background by 150ms.
  - Confirm the count drops to zero (Console, then click the toggle):
    ```js
    const btn = document.querySelector('header button[aria-label*="tema"]');
    btn.click();
    requestAnimationFrame(() =>
      requestAnimationFrame(
        () => console.log(document.getAnimations().length), // 0 — was 126
      ),
    );
    ```
  - Confirm the attribute does not get stuck: after toggling, run
    `document.documentElement.hasAttribute('data-theme-switching')` → `false`. If it
    stays `true`, hover transitions will be dead across the app.
  - Immediately after a toggle, hover a sidebar item. The background must still ease
    in — proof that transitions were restored, not permanently disabled.
  - Start a save (**DPI**, change a value, **Salvar no perfil**) and toggle the theme
    while "Salvando no Perfil 1…" is showing. The spinner must keep turning through the
    flip.
  - Reload the page in each theme and confirm there is no flash of the wrong theme —
    the pre-paint script in `index.html` still owns that.
- **Done when**: `document.getAnimations().length` is `0` two frames after a theme
  toggle on the Parâmetros screen, the attribute is absent afterwards, and hover
  transitions still work.
