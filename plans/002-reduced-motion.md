# 002 — Stop reduced motion from freezing the loading spinners

- **Status**: DONE
- **Commit**: 3e2539f
- **Severity**: HIGH
- **Category**: 6 — Accessibility
- **Estimated scope**: 1 file, ~10 lines changed

## Problem

`apps/web/src/styles.css:190-199` removes **all** motion from the app for anyone with
`prefers-reduced-motion: reduce`:

```css
/* apps/web/src/styles.css:190-199 — current */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

The rulebook is explicit that reduced motion means _fewer and gentler_ animations, not
zero — transitions that aid comprehension should survive, only position changes should
go. But this is not only a philosophy problem. Measured in Chrome launched with
`--force-prefers-reduced-motion` against the running app:

```
animate-spin  →  animationDuration: "1e-05s", animationIterationCount: "1"
```

That is a **broken loading state**, not a gentler one. The two spinners in the app are:

- `apps/web/src/components/ChangeBar.tsx:30` — shown for the `aplicando`, `gravando`
  statuses, i.e. "Aplicando ajustes…" and "Salvando no Perfil 1…".
- `apps/web/src/components/AddDeviceDialog.tsx:77` — shown while connecting to a device.

For a reduced-motion user, both render a **static, frozen circle**. The only signal
that the app is working is a text label; the icon that is supposed to carry
"in progress" is inert. The same rule flattens the `animate-pulse` skeletons at
`apps/web/src/components/HomePage.tsx:198-201` into three plain grey blocks — and
`animate-pulse` is a pure opacity animation, exactly the kind reduced motion is
supposed to keep.

The blanket `transition-duration: 0.01ms !important` also makes this block a hard
prerequisite for every other plan: any transition added by plans 003-007 lands inside
it and silently becomes instant for these users.

## Target

Replace the blanket suppression with the opt-in architecture: **motion that moves
things is written inside `motion-safe:` (or `@media (prefers-reduced-motion:
no-preference)`); colour, opacity and loading feedback stay unconditional.**

```css
/* apps/web/src/styles.css — target, replacing lines 190-199 */
/*
 * Reduced motion removes movement, not feedback. Colour and opacity transitions
 * still explain what changed, and the loading spinners keep turning — a frozen
 * spinner would leave "Aplicando ajustes…" with no sign that anything is running.
 * Anything that moves an element is written with Tailwind's `motion-safe:` variant
 * or inside `@media (prefers-reduced-motion: no-preference)`, so it disappears here
 * on its own.
 */
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}
```

That is the whole replacement. Nothing else is needed, because from this plan onward
every movement in the codebase is authored as opt-in.

Why the spinner is exempt: a loading indicator is essential, non-decorative state
indication. WCAG 2.3.3 (Animation from Interactions) covers non-essential motion
triggered by interaction; a progress indicator is the textbook essential case. It is a
16px icon rotating in place — it carries no vestibular risk, and freezing it removes
the app's only visual "working" cue.

## Repo conventions to follow

- `apps/web/src/styles.css` is the only stylesheet in the repo
  (`find apps packages -name "*.css"` returns exactly one file). All global rules
  belong there.
- The file explains _why_ above each non-obvious rule, in full sentences — see
  `apps/web/src/styles.css:115` (`/* Shared elevation for cards and floating surfaces
in both themes. */`) and `:127` (`/* The devices are black: a soft halo keeps the
photo readable on both themes. */`). Match that voice.
- Tailwind v4.3.3 ships the `motion-safe:` and `motion-reduce:` variants (verified in
  `tailwindcss/dist/lib.js`), so component-level movement is gated in the class list
  rather than with a second global block.

## Steps

1. Open `apps/web/src/styles.css`.
2. Delete the entire existing block at lines 190-199 (the
   `@media (prefers-reduced-motion: reduce)` rule and its `*, *::before, *::after`
   selector).
3. In its place, insert the comment and `@media` block from **Target** above verbatim.
4. Run `pnpm exec prettier --write apps/web/src/styles.css`.

## Boundaries

- Do NOT touch any `.tsx` file. This plan is CSS-only.
- Do NOT add `motion-safe:` classes to components here — plans 003-007 add them
  alongside the movement they gate.
- Do NOT keep a reduced `transition-duration` override "just in case". Leaving any
  `!important` duration rule on `*` re-breaks every later plan.
- Do NOT add dependencies.
- If lines 190-199 do not contain the block quoted under **Problem**, STOP and report
  the drift.

## Verification

- **Mechanical**:
  - `pnpm --filter @gearhub/web build` → succeeds.
  - `pnpm exec prettier --check apps/web/src/styles.css` → passes.
  - `grep -n "prefers-reduced-motion" apps/web/src/styles.css` → exactly one match.
- **Feel check**: run `pnpm dev`, open DevTools → **Rendering** panel → set
  _Emulate CSS media feature prefers-reduced-motion_ to **reduce**, then:
  - Go to `http://localhost:5173`, click **Explorar demonstração**, open the mouse
    with **Configurar**, go to **DPI**, change a value, and press
    **Salvar no perfil**. During "Salvando no Perfil 1…" the small circle to the left
    of the text **must be spinning**. Before this plan it was frozen.
  - Confirm in the Console while reduced motion is emulated:
    ```js
    const d = Object.assign(document.createElement('div'), { className: 'animate-spin' });
    document.body.append(d);
    getComputedStyle(d).animationDuration; // "1s"      (was "1e-05s")
    getComputedStyle(d).animationIterationCount; // "infinite" (was "1")
    d.remove();
    const a = document.querySelector('nav a:not([aria-current])');
    getComputedStyle(a).transitionDuration; // "0.12s"   (was "1e-05s")
    ```
  - Reload the page with reduced motion still emulated and watch the home screen
    skeleton: the three placeholder blocks should pulse, not sit flat.
  - Nothing should _move_ under reduced motion — at this point in the sequence nothing
    in the app moves at all, so this is trivially true; plans 003-007 keep it true by
    gating their movement behind `motion-safe:`.
- **Done when**: the four console expressions return the values above and the spinner
  visibly turns during a save with reduced motion emulated.
