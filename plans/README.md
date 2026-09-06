# Animation plans

Motion audit of OmniGear, run against commit `3e2539f`. Findings were read from the
source and then **confirmed in Chrome against the running app** (`pnpm dev`, CDP,
computed styles and `document.getAnimations()`); every plan quotes the measurement that
justifies it.

The proposed CSS was also **compiled against tailwindcss 4.3.3 in isolation**, outside
the repo, so the plans state what Tailwind actually emits rather than what it ought to.
That settled three things the plans depend on: `--default-transition-duration:
var(--duration-fast)` survives as a resolvable reference; `@keyframes` declared inside
a user `@theme` block are emitted even when the only candidate is variant-wrapped
(`motion-safe:data-[state=open]:animate-dialog-in`); and `scale-*` compiles to the
standalone CSS `scale` property, not `transform`.

The headline: OmniGear has essentially no motion today. `apps/web/.impeccable/build/state.json`
still lists the `motion` design phase as `"pending"`, and the code agrees — the shadcn
animation classes on the dialog and select are dead, and the one global motion rule in
the stylesheet removes the rest.

Stack for every plan: **React 19 + Tailwind v4.3.3 (CSS-first) + shadcn components over
Radix**. No motion library is introduced and no dependency is added; the next section
records which ones were evaluated and why each was turned down.

## Dependency decision: no animation library

Adding one was explicitly on the table and the field was surveyed. **The answer is no**
— not on principle, but because the one problem a library would have solved turned out
to be a problem that should be removed rather than animated. Recorded here so it is not
re-litigated.

### What was evaluated

| Candidate                                                                                                    | Cost                                | What it would solve here                    | Verdict                                                             |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| [Motion](https://motion.dev/docs/react) (`motion/react`)                                                     | 4.6kb core, **+25kb** `domMax`      | Layout/FLIP on the ChangeBar reflow         | No — the reflow should be removed, not animated                     |
| [AutoAnimate](https://auto-animate.formkit.com/)                                                             | ~3kb, auto `prefers-reduced-motion` | Children added/removed/moved in a container | Best fit of the libraries — but the problem dissolved               |
| [Motion One](https://motion.dev/) (`animate()`)                                                              | 3.8kb                               | Imperative WAAPI wrapper                    | Adds nothing over CSS keyframes here                                |
| [View Transitions API](https://web.dev/blog/same-document-view-transitions-are-now-baseline-newly-available) | **0kb, native**                     | Automatic FLIP including height changes     | Viable, but wrong shape — see below                                 |
| `tw-animate-css`                                                                                             | CSS only                            | The dead shadcn classes in plans 003        | Redundant — plan 003 defines six keyframes on the repo's own tokens |
| [ReactVibe FlowList](https://reactvibe.com/docs/components/flowlist)                                         | copy-paste + `framer-motion`        | Staggered scroll-triggered list reveals     | No — decorative motion on high-frequency surfaces                   |

### Why the layout gap disappeared

Layout animation was the entire case for a library: CSS cannot smooth a reflow. So the
reflow was measured (see plan 006 for the full table). The ChangeBar's height swings
**45px → 61px** when a state with a detail line arrives, and because the bar is
`sticky bottom-0` its top edge moves up 16px and shoves the page content behind it.

But the status text's `x` is `360` in **every** state — it never moves horizontally.
The 268px width swing is an invisible container edge. So the only visible shift is the
16px height change, and animating that on a sticky bar still moves the page, just more
slowly. Plan 006 reserves the height with `min-h-[61px]` instead: the shift is gone
outright, for zero bytes, and no FLIP is needed.

The reservation was checked across widths (1440 / 1024 / 700 / 480 / 380). It holds at
480px and up. Below that the actions wrap and the bar oscillates across three heights
with a 40px spread — see the follow-up below. A layout library would not have helped
there either: FLIP would animate a 40px shove rather than prevent it.

### Notes on the two closest calls

**AutoAnimate** was the strongest library candidate by a wide margin — ~3kb against
Motion's ~30kb, and it disables itself under `prefers-reduced-motion` without being
asked, which fits plan 002's architecture exactly. It is the right tool if this repo
later grows a genuinely dynamic list (reorderable profile slots, say). It is not needed
for anything in plans 001-008.

**View Transitions API** deserves a real mention because it costs nothing and is
[Baseline as of October 2025](https://web.dev/blog/same-document-view-transitions-are-now-baseline-newly-available)
(Chrome 111+, Firefox 133+, Safari 18+). Browser support is a non-issue for this app in
particular: `deviceDiscovery.ts:24-40` reaches for `navigator.hid` and reports
`'sem-suporte'` without it, so configuring real hardware requires a Chromium browser
anyway. The mismatch is shape, not support — a view transition snapshots and freezes
the whole document, which is right for a navigation and wrong for a status bar that
changes three times in 1.4 seconds (measured). Overlapping calls get skipped. Worth
revisiting if OmniGear ever animates between device screens.

**Motion**, for the record, prices layout animations in the `domMax` bundle at +25kb on
top of the 4.6kb `LazyMotion` + `m` core; `domAnimation` (+15kb) does not include them.
That is ~30kb gz on a current bundle of **127kb gz**, roughly **+23%**. The README
promises "a single, fast interface without installing several heavy programs". Even had
the reflow been worth animating, that trade would have been hard to defend against a
~3kb alternative.

### What the "make it prettier" budget bought instead

Plan 008. The lighting preview declares four animated effects with explicit
descriptions and animates none of them. Fixing that is the largest visual change
available in this app, it costs zero bytes of dependency, and it closes an honesty gap
— a panel labelled "Prévia simulada" that does not simulate.

## Plans

| #                                         | Title                                           | Severity | Category                  | Status |
| ----------------------------------------- | ----------------------------------------------- | -------- | ------------------------- | ------ |
| [001](001-motion-tokens.md)               | Add motion tokens (easing + duration)           | HIGH     | Cohesion & tokens         | DONE   |
| [002](002-reduced-motion.md)              | Stop reduced motion from freezing the spinners  | HIGH     | Accessibility             | DONE   |
| [003](003-dialog-select-entrances.md)     | Make the dialog and select entrances real       | HIGH     | Purpose / Origin          | DONE   |
| [004](004-button-press-feedback.md)       | Scope the Button transition, add press feedback | MEDIUM   | Performance / Physicality | DONE   |
| [005](005-dead-transition-properties.md)  | Transition the properties that actually change  | MEDIUM   | Cohesion & tokens         | DONE   |
| [006](006-changebar-state-transitions.md) | Stop the ChangeBar from teleporting             | MEDIUM   | Missed opportunity        | DONE   |
| [007](007-theme-flip-coherence.md)        | Make the theme switch atomic                    | MEDIUM   | Cohesion & tokens         | DONE   |
| [008](008-animated-lighting-preview.md)   | Actually simulate the animated lighting effects | MEDIUM   | Missed opportunity        | DONE   |

## Execution order and dependencies

Run in numerical order. The first two are prerequisites for everything after them.

```
001 (tokens)  ──┬──> 003 (dialog/select) ──> 006 (ChangeBar)
                ├──> 004 (button press)
                └──> 005 (dead transitions)
002 (reduced motion) ──> everything that adds movement (003, 004, 006, 008)
007 (theme flip) ── independent, but 001 changes the numbers it measures
008 (lighting)  ── independent of 003-007; needs 001 and 002
```

- **001 must land first.** There are no `--ease-*` or `--duration-*` tokens today;
  everything rides Tailwind's default `150ms cubic-bezier(0.4, 0, 0.2, 1)`. Plans 003
  through 008 all cite the tokens 001 creates. Running them first would mean
  hand-typing curves in six places — the exact duplication the audit flags.
- **002 must land before any plan that adds motion.** The current
  `@media (prefers-reduced-motion: reduce)` block at `apps/web/src/styles.css:190-199`
  forces `transition-duration: 0.01ms !important` on `*`. Anything 003-008 adds would
  land inside it and silently do nothing for those users. 002 also replaces that
  blanket rule with the `motion-safe:` architecture every later plan relies on.
- **003 before 006.** Plan 006 reuses `--animate-fade-in` / `--animate-fade-out`,
  which 003 defines.
- **004, 005 and 007 are independent** of each other and can go in any order once 001
  and 002 are in.

Plans 001, 002, 003, 006, 007 and 008 all edit `apps/web/src/styles.css`. Applying them one at a
time in order avoids conflicts; each says exactly where in the file its block goes.

## What the audit found and did not plan

Reported but deliberately **not** turned into a plan:

- **`packages/ui/src/components/badge.tsx:8`** — `transition-[color,box-shadow]` looks
  like the same defect plan 005 fixes, but it is unreachable. The only Badge with hover
  styling is `AppHeader.tsx:34`, which passes `transition-colors` in `className`, and
  `tailwind-merge` makes the override win. Measured live on the header badge:
  `"color, background-color, border-color, …"`. Left alone.
- **Section content swap** (`DeviceWorkspace.tsx:119`) — the sidebar swaps the whole
  main panel instantly. It is a candidate for a ~120ms opacity fade, but the sidebar is
  the most-used navigation in the app and the audit's frequency rule argues against
  adding motion to something hit constantly. Judgement call, left out; revisit only if
  the swap actually reads as jarring in use.
- **Skeleton to content** (`HomePage.tsx:190-204` to `47-64`) — a hard swap with no
  crossfade. Real but low value: it happens once per session, and the skeleton is
  usually on screen for a few hundred milliseconds.
- **`switch.tsx:18`** — checked and correct. The thumb transitions `transform` and it
  actually has a `translate-x-5`; the track transitions colours and its colours change.
  This is the exemplar the other plans point at.
- **`transform-origin: center` on dialogs** — correct for modals, which appear centred.
  Not a finding.

## Layout follow-up: the ChangeBar wraps below ~480px — CLOSED, out of scope

**Resolved by a product decision: OmniGear targets desktop only.** The measurements
below are kept for the record, but the remaining gap is at phone width and is no longer
something to fix.

Note that the shipped `min-h-[61px]` already covers every width a desktop user
realistically hits, including a half-screen window: 1440, 1024, 700 and 480 all measure
a stable height. Only 380px still oscillates.

Two consequences worth knowing if the decision is ever revisited: WebHID is desktop-only
today (no mobile browser exposes `navigator.hid`, and `deviceDiscovery.ts:40` already
reports `'sem-suporte'`), so a phone can only ever run the demo — but Android support is
planned for Chrome 157. And the repo still carries responsive intent that now overshoots
the target: `min-width: 320px` on `body` (`styles.css:236`), a `width=device-width`
viewport tag, 24 `sm:` and 7 `md:` breakpoints, and responsive studies in
`apps/web/.impeccable`. Nothing was removed — that is a separate decision, not a motion one.

### Original measurements

Measured `bar.getBoundingClientRect().height` through a flip-then-save cycle at five
widths:

```
width   before  dirty  saving  saved   spread
1440    45      61     61      61      16px
1024    61      61     61      45      16px
 700    45      61     61      61      16px
 480    61      61     61      45      16px
 380    45      77     77      85      40px
```

At 380px the action buttons wrap onto their own line and the sticky bar shoves the page
by up to 40px across three distinct heights. Plan 006's `min-h-[61px]` removes the
shift from 480px up and is harmless below, but it cannot fix the wrap — the natural
height already exceeds it, and reserving 85px permanently would cost a tenth of a phone
viewport.

The options would have been: reserve the taller height only below the wrap breakpoint,
keep the actions on a fixed second row on small screens, or drop the `detail` line on
narrow viewports. None is needed — see the decision at the top of this section.

## Non-motion follow-up found along the way

Not part of any plan, logged here because the audit surfaced it and it shares a root
cause with plan 003:

**`packages/ui/src/components/select.tsx` uses `item-aligned` positioning, which leaves
two Radix variables unset.** `select.tsx:48` defaults `position` to `'item-aligned'`
and all three call sites use the default, but Radix populates
`--radix-select-content-transform-origin` and
`--radix-select-content-available-height` only inside `SelectPopperPosition`
(`@radix-ui/react-select/dist/index.mjs:712`). Measured with the profile dropdown open:
the origin variable is unset, and `max-height` computes to `100%` rather than the
available height — so `max-h-(--radix-select-content-available-height)` on line 57 is
not constraining the dropdown to the viewport.

Plan 003 removes the dead `origin-(…)` utility and works correctly in `item-aligned`
mode. Switching to `position="popper"` would fix the max-height too and give a
trigger-anchored origin, but it changes **where the dropdown appears on screen** —
from overlaying the trigger to dropping below it. That is a design decision, not a
motion fix, so it is left to the maintainer.

## Verifying the work

Every plan carries its own mechanical checks and a feel check. Repo-wide gate:

```bash
pnpm verify   # format:check + lint + test + build + audit
```

The feel checks assume `pnpm dev` on `http://localhost:5173`, entering the app through
**Explorar demonstração** (two simulated peripherals: a Viper V4 Pro mouse and a
Wooting 60HE v2 keyboard). Several checks use DevTools → **Animations** at 10% speed
and DevTools → **Rendering** → _Emulate CSS media feature prefers-reduced-motion_.
