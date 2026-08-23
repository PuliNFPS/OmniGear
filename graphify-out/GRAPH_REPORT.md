# Graph Report - gearhub  (2026-08-23)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 405 nodes · 466 edges · 37 communities (31 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a2167517`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- index.ts
- DevicePanel.tsx
- ui/package.json
- devDependencies
- scripts
- dependencies
- compilerOptions
- App.tsx
- web/components.json
- ui/components.json
- tasks
- MockMouseDriver
- compilerOptions
- web/package.json
- devDependencies
- shared/package.json
- compilerOptions
- compilerOptions
- compilerOptions
- scripts
- pkg/package.json
- MouseCapabilities
- lib.rs
- run-rust-tool.mjs
- web/tsconfig.json
- graphify
- prepare-core.mjs
- gearhub-core-wasm
- HidCommand

## God Nodes (most connected - your core abstractions)
1. `scripts` - 18 edges
2. `compilerOptions` - 16 edges
3. `ConnectedPeripheral` - 11 edges
4. `compilerOptions` - 9 edges
5. `ConnectedDevice` - 8 edges
6. `compilerOptions` - 8 edges
7. `DeviceSettings` - 7 edges
8. `compilerOptions` - 7 edges
9. `HardwareTransport` - 6 edges
10. `App()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `ConnectedDevice` --implements--> `ConnectedPeripheral`  [EXTRACTED]
  apps/web/src/hardware/ConnectedDevice.ts → packages/shared/src/index.ts
- `ConnectedDevice` --references--> `DeviceCapabilities`  [EXTRACTED]
  apps/web/src/hardware/ConnectedDevice.ts → packages/shared/src/index.ts
- `ConnectedDevice` --references--> `DeviceSettings`  [EXTRACTED]
  apps/web/src/hardware/ConnectedDevice.ts → packages/shared/src/index.ts
- `ConnectedDevice` --references--> `PeripheralType`  [EXTRACTED]
  apps/web/src/hardware/ConnectedDevice.ts → packages/shared/src/index.ts
- `DeviceStore` --references--> `ConnectedPeripheral`  [EXTRACTED]
  apps/web/src/store/deviceStore.ts → packages/shared/src/index.ts

## Import Cycles
- None detected.

## Communities (37 total, 6 thin omitted)

### Community 0 - "index.ts"
Cohesion: 0.10
Nodes (16): update(), ConnectedDevice, discoverDevices(), HardwareTransport, HidDeviceHandle, WebHidTransport, mockPeripherals, DeviceStore (+8 more)

### Community 1 - "DevicePanel.tsx"
Cohesion: 0.12
Nodes (14): BrandMark(), DeviceIcon(), profiles, SegmentedControl(), SettingRow(), Sidebar(), Badge(), badgeVariants (+6 more)

### Community 2 - "ui/package.json"
Cohesion: 0.07
Nodes (27): react-dom, @types/react, react-dom, @types/react, devDependencies, react, @types/react, typescript (+19 more)

### Community 3 - "devDependencies"
Cohesion: 0.08
Nodes (26): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, tailwindcss, @tailwindcss/vite (+18 more)

### Community 4 - "scripts"
Cohesion: 0.08
Nodes (23): engines, node, name, packageManager, private, scripts, audit, audit:boundaries (+15 more)

### Community 5 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, gearhub-core-wasm, @gearhub/shared, @gearhub/ui, lucide-react, react, zustand, lucide-react (+15 more)

### Community 6 - "compilerOptions"
Cohesion: 0.09
Nodes (21): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+13 more)

### Community 7 - "App.tsx"
Cohesion: 0.18
Nodes (13): App(), DevicePanel(), CoreStatus, loadCore(), core_version(), init(), is_wasm_available(), Alert() (+5 more)

### Community 8 - "web/components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 9 - "ui/components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 10 - "tasks"
Cohesion: 0.11
Nodes (17): ^build, dist/**, ^lint, ^test, dependsOn, outputs, cache, persistent (+9 more)

### Community 11 - "MockMouseDriver"
Cohesion: 0.19
Nodes (9): HidCommand, Vec, MouseDriver, mock_registry(), RegisteredDriver, Vec, encodes_dpi_little_endian(), encodes_polling_rate_little_endian() (+1 more)

### Community 12 - "compilerOptions"
Cohesion: 0.13
Nodes (14): apps/**/*.ts, apps/**/*.tsx, packages/**/*.ts, packages/**/*.tsx, compilerOptions, allowSyntheticDefaultImports, esModuleInterop, jsx (+6 more)

### Community 13 - "web/package.json"
Cohesion: 0.14
Nodes (13): imports, #components/*, #hooks/*, #lib/*, name, private, scripts, build (+5 more)

### Community 14 - "devDependencies"
Cohesion: 0.18
Nodes (11): dependency-cruiser, knip, devDependencies, dependency-cruiser, knip, prettier, turbo, typescript (+3 more)

### Community 15 - "shared/package.json"
Cohesion: 0.18
Nodes (10): devDependencies, typescript, exports, name, private, scripts, build, lint (+2 more)

### Community 16 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, jsx, module, moduleResolution, noEmit, skipLibCheck, strict, target (+2 more)

### Community 17 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, module, moduleResolution, noEmit, skipLibCheck, strict, target, include (+1 more)

### Community 18 - "compilerOptions"
Cohesion: 0.22
Nodes (8): compilerOptions, composite, module, moduleResolution, noEmit, skipLibCheck, include, vite.config.ts

### Community 19 - "scripts"
Cohesion: 0.22
Nodes (8): name, private, scripts, build:wasm, format, lint, test, version

### Community 20 - "pkg/package.json"
Cohesion: 0.33
Nodes (5): main, name, type, types, version

### Community 21 - "MouseCapabilities"
Cohesion: 0.50
Nodes (3): Option, MouseCapabilities, Vec

### Community 23 - "run-rust-tool.mjs"
Cohesion: 0.50
Nodes (3): commands, coreDirectory, result

## Knowledge Gaps
- **192 isolated node(s):** `Feedback`, `SaveState`, `profiles`, `cache`, `persistent` (+187 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `ui/package.json`, `web/package.json`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `ui/package.json`, `web/package.json`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `Feedback`, `SaveState`, `profiles` to the rest of the system?**
  _192 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0953058321479374 - nodes in this community are weakly interconnected._
- **Should `DevicePanel.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11576354679802955 - nodes in this community are weakly interconnected._
- **Should `ui/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._