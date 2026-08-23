# Code intelligence and quality checks

OmniGear uses two complementary layers. Graphify helps humans and AI assistants find functionality and relationships quickly. Deterministic checks decide whether code is valid enough to merge.

## One-time setup

Install the repository dependencies:

```sh
pnpm install --frozen-lockfile
```

Install the pinned developer tools:

```sh
uv tool install "graphifyy[mcp]==0.9.48"
cargo install cargo-machete --version 0.9.2 --locked
```

On Windows, `uv` can be installed with:

```powershell
winget install --exact --id astral-sh.uv
```

Restart the terminal if the installers update `PATH`.

The repository already contains the shared Graphify skill, Cursor rule, MCP configuration, and an initial graph. Tools that support the Agent Skills convention load `.agents/skills/graphify`. Codex also reads the graph-first instructions in `AGENTS.md`; Cursor applies `.cursor/rules/graphify.mdc` and starts the MCP server from `.cursor/mcp.json`.

## Finding functionality

Start with a scoped query instead of opening many files:

```sh
graphify query "Where is device discovery implemented?" --budget 1500
graphify query "How does the web app initialize the Rust WASM core?" --budget 1500
graphify path "loadCore()" "is_wasm_available()"
graphify explain "coreBridge.ts"
```

Use the results as a map. Inspect only the returned files and line locations, then confirm important behavior with source, compiler checks, and tests. `EXTRACTED` edges came from syntax; `INFERRED` or `AMBIGUOUS` edges need extra verification.

After changing source code, refresh the graph:

```sh
pnpm graph:update
```

Use `pnpm graph:index` for a clean rebuild, after large refactors, or after upgrading Graphify. Commit refreshed portable graph artifacts with the related code change. The local cache and machine-specific root file remain ignored.

For another MCP-compatible assistant, configure an stdio server with command `graphify-mcp` and argument `graphify-out/graph.json`.

## Deterministic checks

Run everything before opening a pull request:

```sh
pnpm verify
```

Individual commands are available when working on a focused area:

| Command                 | Purpose                                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test`             | Runs focused TypeScript and Rust behavior tests through Turborepo.                                                                                 |
| `pnpm lint`             | Runs ESLint, TypeScript checks, and Rust Clippy.                                                                                                   |
| `pnpm build`            | Proves the packages and web application build together.                                                                                            |
| `pnpm audit:ts`         | Uses Knip to find unused TypeScript files, exports, types, and dependencies.                                                                       |
| `pnpm audit:boundaries` | Uses dependency-cruiser to reject runtime cycles, unresolved imports, package-to-app dependencies, and direct WASM access outside `coreBridge.ts`. |
| `pnpm audit:rust`       | Uses cargo-machete to flag likely unused Cargo dependencies.                                                                                       |
| `pnpm run audit`        | Runs all three static audits.                                                                                                                      |
| `pnpm verify`           | Runs formatting, linting, tests, build, and all audits in CI order.                                                                                |

Knip currently contains three narrow skeleton exceptions for the planned WebHID abstractions and store API. Do not add broad ignore patterns. Remove each exception when that skeleton code becomes connected.

cargo-machete is intentionally fast and heuristic. Investigate a finding before deleting a dependency; generated code, renamed crates, and build scripts can require a documented exception.

## Team workflow

1. Pull the repository and install the pinned tools once.
2. Ask Graphify where functionality lives before broad code exploration.
3. Make the change and add only the tests needed for its public behavior or regression risk.
4. Run the narrow relevant checks while working.
5. Run `pnpm verify` before the pull request.
6. Run `pnpm graph:update` and commit graph changes alongside source changes.
7. CI repeats the deterministic verification; Graphify remains an interactive navigation tool, not a correctness gate.
