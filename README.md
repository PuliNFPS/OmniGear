# OmniGear

A web app for configuring gaming mice and keyboards from different brands in a single, fast interface  without installing several heavy programs.

This repository replaces the previous Portuguese-only placeholder with the current OmniGear workspace.

## Stack

- **Web app:** React, Vite, Tailwind CSS (`apps/web`)
- **Shared types:** TypeScript (`packages/shared`)
- **UI kit:** Radix-based components (`packages/ui`)
- **Core:** Rust compiled to WebAssembly (`packages/core`)

## Requirements

- Node.js 22.12 or later
- [pnpm](https://pnpm.io/) 11.19.0
- [wasm-pack](https://rustwasm.github.io/wasm-pack/) (for building the Rust core)

## Setup

```bash
pnpm install
pnpm dev
```

The preview currently uses two mock peripherals so you can explore DPI, polling rate, lighting, and related settings without hardware.

## Scripts

| Command       | Description                                 |
| ------------- | ------------------------------------------- |
| `pnpm dev`    | Prepare the WASM core and start the web app |
| `pnpm build`  | Build all packages                          |
| `pnpm lint`   | Lint the workspace                          |
| `pnpm test`   | Run focused TypeScript and Rust tests       |
| `pnpm verify` | Run all local and CI quality gates          |

See [Code intelligence and quality checks](docs/code-quality.md) for Graphify setup, functionality search, architecture checks, and the team workflow.
