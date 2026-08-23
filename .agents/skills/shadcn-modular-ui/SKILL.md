---
name: shadcn-modular-ui
description: Install or add Shadcn UI components with the official CLI and compose them into accessible, reusable application UI. Use for Shadcn setup and component work; do not trigger for unrelated frontend styling.
---

# Shadcn Modular UI

Use Shadcn's source-owned components as reusable primitives while preserving repository conventions and avoiding duplicate UI logic.

## Inspect Before Running Commands

- Detect the package manager from the lockfile and use its runner consistently.
- Inspect `components.json`, import aliases, Tailwind/global CSS configuration, framework, monorepo layout, and existing `components/ui` primitives.
- Run commands from the workspace that owns `components.json`. Do not initialize Shadcn again when it is already configured.
- Review existing components before installing another primitive or creating a local duplicate.

## Use the CLI

For pnpm, use the current official forms:

- Inspect configuration: `pnpm dlx shadcn@latest info`
- Initialize an unconfigured existing project: `pnpm dlx shadcn@latest init`
- Preview an addition when risk warrants it: `pnpm dlx shadcn@latest add <component> --dry-run`
- Add only required components: `pnpm dlx shadcn@latest add <component>`
- Read component guidance: `pnpm dlx shadcn@latest docs <component>`

Use the equivalent `npx`, `yarn dlx`, or `bunx` runner when that package manager owns the repository. Do not use `--overwrite`, `--force`, or `--all` without inspecting the affected files and obtaining authorization for overwrites.

## Compose Modular UI

- Keep generated low-level primitives in the configured UI directory. Build domain-specific composites in feature or application component directories.
- Reuse primitives, variants, tokens, hooks, formatters, schemas, and state logic instead of copying JSX or class lists between screens.
- Centralize meaningful variants with the project's existing variant utility and preserve the shared `cn` helper rather than recreating merge logic.
- Separate presentation from data loading and domain decisions. Pass typed data and callbacks through focused component contracts.
- Prefer composition and slots over large components with many boolean props. Do not create generic wrappers that hide useful Shadcn APIs without reducing real duplication.
- Preserve keyboard behavior, focus management, labels, semantic structure, and ARIA behavior from the underlying primitive.

## Verify the Result

- Review CLI diffs and dependency changes before further customization.
- Run formatting, TypeScript checks, and the smallest relevant component or interaction tests.
- Test application behavior added around the primitive, not Shadcn's already-provided internal behavior.
- Check representative responsive and interactive states when the change affects layout or user interaction.
