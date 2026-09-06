# 006 — Stop the ChangeBar from teleporting between states

- **Status**: DONE
- **Commit**: 3e2539f
- **Severity**: MEDIUM (additive — this is new motion, not a corrected animation)
- **Category**: 8 — Missed opportunities
- **Estimated scope**: 2 files, ~30 lines

## Problem

`apps/web/src/components/ChangeBar.tsx` is the app's primary feedback surface. It is
pinned to the bottom of every device screen (`DeviceWorkspace.tsx:123`) and it is where
the user learns whether their edit registered, whether it is being written, and whether
it failed. It has six visual states, driven by `offline` plus the `EditorStatus` union
`'ocioso' | 'aplicando' | 'gravando' | 'gravado' | 'falha-aplicacao' | 'falha-gravacao'`
(`apps/web/src/store/editorStore.ts:12-13`), branching at `ChangeBar.tsx:49-128`.

Every transition between those states is a hard cut. Measured against the running app:

Flipping one switch on **Viper V4 Pro → Parâmetros**:

```
before: "Nenhuma alteração pendente."
after:  "1 alteração não salva"
```

Then pressing **Salvar no perfil**:

```
t+0ms:    "1 alteração não salva"
t+80ms:   "Salvando no Perfil 1…"
t+1400ms: "Alterações salvas no Perfil 1" / "Nenhuma alteração pendente."
```

Three complete content swaps in under a second and a half. Each one replaces the icon
(a dot, a spinner, a check, or an alert), the title, the detail line, and the action
buttons — two buttons appear out of nothing when the bar goes dirty, and vanish the
same way when it settles. On failure the container border also flips straight from
`border-border` to `border-destructive` (`ChangeBar.tsx:132-135`).

Nothing here animates because nothing in the app animates yet, but this is the one
place where a state change carries real meaning and currently arrives with no
explanation of what just happened. The audit's missed-opportunities category names
exactly this: state changes that teleport, where a brief transition would prevent a
jarring change.

### The bar also changes height, and it is `sticky`

Measured on **Viper V4 Pro → Parâmetros**, taking bounding boxes through a full
flip-then-save cycle:

```
state    bar.h  bar.y   status.x  status.y  status.w  detail line?
before   45     760     360       773       960       no
after    61     744     360       757       799       YES
saving   61     744     360       757       799       YES
saved    61     744     360       765       692       no
```

Two things fall out of that table:

- **The bar grows 16px** (45 → 61) the moment a state with a `detail` line arrives, and
  because it is `sticky bottom-0` (`ChangeBar.tsx:133`) its top edge moves up 16px —
  `bar.y` 760 → 744. The page content behind it lurches every time the status changes.
  That is the only _visible_ layout shift in the component.
- **The text never moves horizontally.** `status.x` is `360` in all four states. The
  status block's width swings 960 → 799 → 692 as the buttons appear, but the text is
  left-aligned inside a `flex-1` box, so only an invisible container edge moves. This
  needs no animation at all.

So the height oscillation should be **removed, not animated**. Animating a 16px height
change on a sticky bar still moves the page — it just takes longer to do it. Reserving
the space costs nothing and eliminates the shift outright.

The same cycle measured across viewport widths, `bar.getBoundingClientRect().height`
in each of the four states:

```
width   before  dirty  saving  saved   spread
1440    45      61     61      61      16px
1024    61      61     61      45      16px
 700    45      61     61      61      16px
 480    61      61     61      45      16px
 380    45      77     77      85      40px   <- actions wrap to a second line
```

At 480px and above the swing is always the same 16px, so a single reserved height of
61px removes it. Somewhere between 380px and 480px the row's `flex-wrap` pushes the
action buttons onto their own line, and the bar then oscillates across **three**
heights with a 40px spread. `min-h-[61px]` cannot fix that — the natural height is
already above it — and reserving 85px permanently would cost a tenth of the viewport on
a phone.

**That narrow-screen case is a layout decision, not a motion one**, and this plan does
not make it. Step (iii) reserves 61px, which removes the shift at 480px and up and is
harmless below. The sub-480px wrap is logged as a follow-up in `plans/README.md`.

Two constraints shape the fix:

- The status block carries `aria-live="polite"` (`ChangeBar.tsx:138`). A screen reader
  tracks the live region **element**; if that element is replaced, the announcement can
  be lost, and if two copies of the text co-exist during a crossfade, it can be
  announced twice. So the fix must not remount the `aria-live` node and must never
  have old and new text in the DOM at the same time.
- The action buttons must be clickable the instant they are painted. A fade is fine
  (it does not block pointer events); a slide-in that moves the hit target is not.

## Target

A short, subtle entrance played by the bar's contents whenever the state key changes,
plus a real transition on the container border.

### 1. Animation token in `apps/web/src/styles.css`

Add to the `@theme` block (alongside plan 003's entries):

```css
@theme {
  /* ...plan 001 and plan 003 entries stay above... */

  --animate-bar-in: bar-in var(--duration-popover) var(--ease-out);

  /*
   * The change bar re-enters rather than crossfades: React swaps the block by key,
   * so only one copy is ever in the DOM and the aria-live region announces once.
   * 2px is all the lift needed to read as "this is new".
   */
  @keyframes bar-in {
    from {
      opacity: 0;
      translate: 0 2px;
    }
    to {
      opacity: 1;
      translate: 0 0;
    }
  }
}
```

Uses the standalone `translate` property, matching plan 003's keyframes and Tailwind
v4's own transform model. `--animate-fade-in` from plan 003 is reused as the
reduced-motion variant.

### 2. `apps/web/src/components/ChangeBar.tsx`

**(i)** Add a `key` field to the `BarContent` interface (currently lines 21-28):

```tsx
interface BarContent {
  /** Identifies the visual state, so the bar replays its entrance when it changes. */
  key: string;
  icon: ReactNode;
  title: string;
  detail?: string;
  actions: ReactNode;
  destructive?: boolean;
  muted?: boolean;
}
```

**(ii)** Give every branch of the IIFE at lines 49-128 a `key`, matching the branch it
belongs to:

| Branch (current line)                 | `key`         |
| ------------------------------------- | ------------- |
| `offline` (line 50)                   | `'offline'`   |
| `case 'aplicando'` (line 67)          | `'aplicando'` |
| `case 'gravando'` (line 74)           | `'gravando'`  |
| `case 'gravado'` (line 80)            | `'gravado'`   |
| `case 'falha-*'` (line 87)            | `status`      |
| `default`, `changes === 0` (line 107) | `'limpo'`     |
| `default`, dirty (line 115)           | `'sujo'`      |

The dirty branch deliberately uses one key for any change count, so typing in a field
that moves the count from 1 to 2 does **not** replay the animation. Only a genuine
state change does.

**(iii)** Replace the render block (currently lines 130-153) with the version below.
Note `min-h-[61px]` on the inner row — that is the reserved height that removes the
16px sticky-bar lurch measured above. 61px is the tallest state the bar reaches at
480px and up (title + detail line), so from that width the bar never changes height and
the page behind it never moves. Below ~480px the actions wrap and the bar still
oscillates; that is out of scope, as explained under **Problem**.

61px is derived from the row's current `py-3` plus two lines at the current font sizes.
It is a measured constant, not a magic number — if the padding or the type scale
changes, it must be re-measured.

```tsx
return (
  <div
    className={cn(
      'sticky bottom-0 z-20 border-t bg-surface transition-colors',
      content.destructive ? 'border-destructive' : 'border-border',
    )}
  >
    {/* Reserved height: without it the bar swings 45px-61px and, being sticky,
        shoves the page content every time the status changes. */}
    <div className="mx-auto flex min-h-[61px] w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 sm:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-2.5" aria-live="polite">
        {/* Keyed so a new state re-enters; the aria-live element above stays put. */}
        <div
          key={content.key}
          className="flex min-w-0 flex-1 items-center gap-2.5 motion-safe:animate-bar-in motion-reduce:animate-fade-in"
        >
          {content.icon}
          <div className="min-w-0">
            <p className={cn('text-sm', content.muted && 'text-muted-foreground')}>
              {content.title}
            </p>
            {content.detail && <p className="text-xs text-muted-foreground">{content.detail}</p>}
          </div>
        </div>
      </div>
      {hint && changes === 0 && (
        <p className="hidden text-sm text-muted-foreground lg:block">{hint}</p>
      )}
      {content.actions && (
        <div
          key={content.key}
          className="flex items-center gap-2 motion-safe:animate-bar-in motion-reduce:animate-fade-in"
        >
          {content.actions}
        </div>
      )}
    </div>
  </div>
);
```

Three changes from the current markup: `transition-colors` added to the sticky
container so the destructive border eases in; one new keyed wrapper inside the
`aria-live` div; the same key and classes on the existing actions div. The
`aria-live="polite"` element itself is untouched and never remounts.

Both keyed blocks use the same key, so they replay in the same frame and the bar reads
as one object changing rather than two.

## Repo conventions to follow

- `ChangeBar.tsx` builds its whole visual state in one IIFE returning a `BarContent`
  object (lines 49-128) and renders it once. Extend that object; do not add a second
  state mechanism, a `useState`, or an effect.
- Class composition goes through `cn(...)` from `@gearhub/ui/lib/utils`, already
  imported at line 2.
- Comments in this codebase explain the _why_ in a full sentence — see the existing
  `/** Contextual guidance for the current screen, shown while editing. */` at
  `ChangeBar.tsx:13`. Match that.
- Animation tokens and keyframes belong in the `@theme` block of
  `apps/web/src/styles.css`, next to plan 003's.

## Boundaries

- Do NOT move, remove, or remount the `aria-live="polite"` element. It stays exactly
  where it is at line 138 with the same attributes.
- Do NOT animate the `hint` paragraph — it is static per screen and changes only on
  navigation.
- Do NOT add an exit animation or keep the previous state mounted to crossfade. Two
  copies of the status text in the DOM would risk a duplicate screen-reader
  announcement.
- Do NOT animate the bar's height, padding, or position. It is `sticky` above the page
  content; moving it would shift the layout under the user's cursor.
- Do NOT change the row's `py-3`, `gap-y-2`, or the title/detail font sizes. `61px` is
  computed from them; changing either silently makes the reservation stop matching and
  the lurch comes back. If a change is genuinely needed, re-measure and update the
  value in the same commit.
- Do NOT try to fix the sub-480px wrap here — not with a taller `min-h`, not with a
  responsive variant, not by suppressing the wrap. It needs a layout decision.
- Do NOT change any of the strings, the branch logic, the props interface
  (`ChangeBarProps`, lines 8-19), or the callbacks.
- Do NOT change `apps/web/src/store/editorStore.ts`.
- Do NOT use a duration above `--duration-popover` (180ms) here — the bar can change
  three times in 1.4s, and a slower entrance would still be running when the next
  state arrives.
- Requires plans 001, 002 and 003 to be applied first (tokens, the reduced-motion
  architecture, and `--animate-fade-in`). If `--animate-fade-in` is not in
  `styles.css`, STOP.

## Verification

- **Mechanical**:
  - `pnpm --filter @gearhub/web lint` → passes.
  - `pnpm --filter @gearhub/web test` → passes. `apps/web/src/domain/changes.test.ts`
    covers `describeChangeCount`, which this plan does not touch.
  - `pnpm --filter @gearhub/web build` → succeeds.
  - `pnpm exec prettier --check .` → passes.
- **Feel check**: run `pnpm dev`, `http://localhost:5173`, **Explorar demonstração**,
  open **Viper V4 Pro** with **Configurar**, go to **Parâmetros**.
  - Flip _Sincronização de movimento_. The bar should lift 2px and fade as it changes
    from "Nenhuma alteração pendente." to "1 alteração não salva", and the **Descartar**
    and **Salvar no perfil** buttons should arrive with it, in the same frame — not
    staggered.
  - Flip a second switch so the count goes to 2. The bar text must update **without**
    replaying the animation. If it replays, the dirty branch is keying on `changes`
    instead of the constant `'sujo'`.
  - Press **Salvar no perfil** and watch the full sequence at DevTools → **Animations**
    → 10% speed: dirty → "Salvando no Perfil 1…" → "Alterações salvas". Each step
    should re-enter cleanly; no step should still be animating when the next begins.
  - Click **Salvar no perfil** and immediately try to click **Descartar** as it
    appears. The buttons must be clickable the moment they are visible.
  - **No height lurch.** Scroll the Parâmetros list so content sits right above the
    bar, then flip a switch and save. The content above the bar must not move at all.
    Confirm numerically in the Console:
    ```js
    const row = document.querySelector('[aria-live="polite"]').parentElement;
    const bar = row.parentElement;
    bar.getBoundingClientRect().height; // 62 in every state — was 45 then 61
    // 62, not 61: the reserved 61px is on the inner row, and the bar adds its 1px
    // top border. What matters is that the three readings are identical.
    ```
    Run it before flipping the switch, after flipping it, and again once saved. All
    three must return the same number. If `min-h-[61px]` is missing or the padding
    changed, they will not. Repeat at a 480px-wide window — same result expected. At
    380px the numbers will still differ; that is the known, out-of-scope wrap case.
  - **Keyboard focus.** `key={content.key}` makes the actions wrapper remount on every
    state change, which can move focus. Tab to **Salvar no perfil**, press Enter, and
    note where focus lands (`document.activeElement` in the Console). If it drops to
    `<body>`, check the same sequence on a build without this plan applied before
    treating it as a regression — the branches already return different button
    fragments, so React very likely remounts them today too. If it is genuinely new,
    report it rather than working around it; the fix belongs in a follow-up that
    manages focus deliberately, not in an animation change.
  - Go to **Perfis**, trigger a failure state if one is reachable in the demo; the
    top border should ease to red rather than snapping.
  - DevTools → **Rendering** → _prefers-reduced-motion: reduce_: repeat the switch
    flip. The bar should still **fade** (so the change is not silent) but must not
    lift. Confirm:
    ```js
    getComputedStyle(document.querySelector('[aria-live="polite"] > div')).animationName;
    // "overlay-in" under reduced motion, "bar-in" otherwise
    ```
  - **Screen-reader check** (the reason the structure is constrained): with VoiceOver
    or NVDA running, flip a switch and confirm "1 alteração não salva" is announced
    exactly once. If it is announced twice, the keyed wrapper has been placed on or
    above the `aria-live` element instead of inside it.
- **Done when**: the bar re-enters on every real state change, does not re-enter when
  only the change count moves, announces once, and the console expression returns the
  two names above in the two motion modes.
