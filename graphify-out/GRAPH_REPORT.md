# Graph Report - OmniGear  (2026-09-06)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1018 nodes · 2383 edges · 65 communities (50 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `da00e7cf`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- editorStore.ts
- DeviceWorkspace.tsx
- cn
- ProfilesSection.tsx
- index.ts
- writeProbe.ts
- DpiSection.tsx
- scripts
- coreBridge.ts
- leviathanV4.ts
- protocol.ts
- LeviathanV4Driver.ts
- LeviathanV4Driver
- web/package.json
- diagnostics.ts
- deviceDiscovery.ts
- App.tsx
- demoDevices.ts
- withProtocolEnvelope
- web/components.json
- compilerOptions
- ui/components.json
- ui/package.json
- WebHidTransport.ts
- lib.rs
- ChangeBar.tsx
- devDependencies
- tasks
- MockMouseDriver
- DeviceStore
- diagnostics.test.ts
- leviathanV4Fixture.ts
- mouseParamSnapshot.ts
- shared/package.json
- compilerOptions
- compilerOptions
- deviceStore.ts
- scripts
- compilerOptions
- dependencies
- compilerOptions
- LeviathanV4Driver.onboard.test.ts
- pkg/package.json
- dependencies
- scripts
- imports
- devDependencies
- exports
- imports
- run-rust-tool.mjs
- serve-design.mjs
- web/tsconfig.json
- graphify
- HidCommand
- MouseCapabilities
- build-design-gallery.mjs
- prepare-core.mjs
- gearhub-core-wasm
- Option

## God Nodes (most connected - your core abstractions)
1. `useEditorStore` - 33 edges
2. `withProtocolEnvelope()` - 29 edges
3. `cn()` - 29 edges
4. `vitest` - 28 edges
5. `frameEvent()` - 23 edges
6. `LeviathanV4Driver` - 22 edges
7. `useDeviceStore` - 22 edges
8. `DeviceWorkspace()` - 21 edges
9. `findSection()` - 20 edges
10. `captureQuery()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `StageRemoval` --references--> `DpiStage`  [EXTRACTED]
  apps/web/src/domain/dpi.ts → packages/shared/src/mouse.ts
- `DeviceWorkspace()` --calls--> `cn()`  [EXTRACTED]
  apps/web/src/components/DeviceWorkspace.tsx → packages/ui/src/lib/utils.ts
- `GeneralSection()` --calls--> `cn()`  [EXTRACTED]
  apps/web/src/components/sections/GeneralSection.tsx → packages/ui/src/lib/utils.ts
- `OptionGroup()` --calls--> `cn()`  [EXTRACTED]
  apps/web/src/components/OptionGroup.tsx → packages/ui/src/lib/utils.ts
- `MouseButtonsSection()` --calls--> `cn()`  [EXTRACTED]
  apps/web/src/components/sections/MouseButtonsSection.tsx → packages/ui/src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (65 total, 9 thin omitted)

### Community 0 - "editorStore.ts"
Cohesion: 0.06
Nodes (44): useDeviceReports(), withOnboardProfiles(), useChangeCount(), useEditorEntry(), useKeyboardEditor(), useProfileLoad(), DeviceWorkspace(), ProfileLoadConfirm() (+36 more)

### Community 1 - "DeviceWorkspace.tsx"
Cohesion: 0.06
Nodes (39): findSection(), keyboardSections, mouseSections, SectionDefinition, sectionsFor(), useMouseEditor(), MouseSideArt(), pointOnArc() (+31 more)

### Community 2 - "cn"
Cohesion: 0.07
Nodes (38): hexToRgba(), isHexColor(), describeDevice(), defaultSectionFor(), deviceRoute(), homeRoute, keyboardSectionIds, mouseSectionIds (+30 more)

### Community 3 - "ProfilesSection.tsx"
Cohesion: 0.08
Nodes (34): connectionErrorMessages, connectionLabels, describeSettings(), deviceTypeLabels, mouseActionLabels, mouseParameterLabels, steps, ConfirmAction (+26 more)

### Community 4 - "index.ts"
Cohesion: 0.10
Nodes (37): handleFile(), buildProfileFile(), finite(), isRecord(), keyboardFits(), migrateMouseV1(), mouseFits(), ProfileFile (+29 more)

### Community 5 - "writeProbe.ts"
Cohesion: 0.10
Nodes (31): downloadJson(), KEY_IDS, MAPPING_ACTIONS, MAPPING_SETS, RawmDiagnosticPage(), statusLabels, statusStyles, WRITE_TARGETS (+23 more)

### Community 6 - "DpiSection.tsx"
Cohesion: 0.12
Nodes (29): AxisField(), commit(), axisName(), AxisProps, AxisSlider(), DpiSection(), changeAxis(), changeIndependentAxes() (+21 more)

### Community 7 - "scripts"
Cohesion: 0.06
Nodes (33): devDependencies, dependency-cruiser, knip, prettier, turbo, typescript, engines, node (+25 more)

### Community 8 - "coreBridge.ts"
Cohesion: 0.15
Nodes (24): ByteArrayLike, copyBytes(), CoreStatus, encodeMouseFunction(), encodeMouseKey(), isByteArrayLike(), loadCore(), MouseParamSnapshot (+16 more)

### Community 9 - "leviathanV4.ts"
Cohesion: 0.11
Nodes (20): deviceDefinitions, DeviceRequestFilter, HidCollectionInfo, HidDeviceIdentity, HidReportInfo, actions, buttons, createLeviathanV4Peripheral() (+12 more)

### Community 10 - "protocol.ts"
Cohesion: 0.21
Nodes (16): captureQuery(), isNotification(), parseNotification(), subscribeToNotifications(), buildQueryEvent(), crc16(), decodeReportChunk(), eventLength() (+8 more)

### Community 11 - "LeviathanV4Driver.ts"
Cohesion: 0.14
Nodes (18): actions, buttonIdsByKeyId, EncodedAction, FUNCTION_SHOW_POWER, MOUSE_KEY_TYPE_MKEY, MOUSE_KEY_TYPE_WHEEL, physicalKeyIds, SHOW_POWER_KEY_ID (+10 more)

### Community 12 - "LeviathanV4Driver"
Cohesion: 0.17
Nodes (11): DeviceReport, editorKeySets(), intendedMappings(), isShowPower(), keyOf(), LeviathanV4Driver, mouseSettings(), pause() (+3 more)

### Community 13 - "web/package.json"
Cohesion: 0.11
Nodes (20): react, name, private, type, version, eslint, @eslint/js, eslint-plugin-react-hooks (+12 more)

### Community 14 - "diagnostics.ts"
Cohesion: 0.14
Nodes (21): hidApi(), probe(), CaptureResult, CaptureSource, CHANNEL_LABELS, collectionStage(), describeDevice(), DiagnosticChannel (+13 more)

### Community 15 - "deviceDiscovery.ts"
Cohesion: 0.16
Nodes (14): BrowserHidApi, ConnectionResult, connectRecognized(), DeviceConnector, HidDisconnectEvent, HidRequestOptions, knownDevice, onDeviceDisconnected() (+6 more)

### Community 16 - "App.tsx"
Cohesion: 0.16
Nodes (9): App(), exitDemonstration(), storedTheme(), systemTheme(), Theme, useTheme(), AppHeader(), BrandMark() (+1 more)

### Community 17 - "demoDevices.ts"
Cohesion: 0.12
Nodes (16): mouseFeatureVisibility(), createDemoMouse(), demoKeyboardDefaults, demoMouseDefaults, keyboardActions, keyboardKeys, keyboardPhoto, keyboardRows (+8 more)

### Community 18 - "withProtocolEnvelope"
Cohesion: 0.16
Nodes (12): mouse, queryReports(), receiver, encodeLeviathanAction(), RawmNotification, notifyEvent(), entry(), encodeLength() (+4 more)

### Community 19 - "web/components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 20 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+9 more)

### Community 21 - "ui/components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 22 - "ui/package.json"
Cohesion: 0.12
Nodes (16): lucide-react, react-dom, @types/react, react, name, peerDependencies, react, react-dom (+8 more)

### Community 23 - "WebHidTransport.ts"
Cohesion: 0.18
Nodes (6): HidDeviceHandle, HidInputReportEvent, WebHidTransport, WebHidTransportOptions, withinTimeout(), HidCommand

### Community 24 - "lib.rs"
Cohesion: 0.20
Nodes (10): append_u16_le(), config_event(), core_version(), encode_action(), encode_config_reset(), encode_mouse_function(), encode_mouse_key(), encode_mouse_param_snapshot() (+2 more)

### Community 25 - "ChangeBar.tsx"
Cohesion: 0.20
Nodes (9): BarContent, ChangeBar(), ChangeBarProps, countChanges(), countListChanges(), describeChangeCount(), idsOf(), isRecord() (+1 more)

### Community 26 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, tailwindcss, @tailwindcss/vite (+7 more)

### Community 27 - "tasks"
Cohesion: 0.14
Nodes (13): dependsOn, outputs, cache, persistent, dependsOn, $schema, tasks, build (+5 more)

### Community 28 - "MockMouseDriver"
Cohesion: 0.23
Nodes (8): HidCommand, MouseDriver, mock_registry(), RegisteredDriver, Vec, encodes_dpi_little_endian(), encodes_polling_rate_little_endian(), MockMouseDriver

### Community 29 - "DeviceStore"
Cohesion: 0.21
Nodes (3): AddDeviceDialog(), HomePage(), DeviceStore

### Community 30 - "diagnostics.test.ts"
Cohesion: 0.20
Nodes (7): BrowserHidDevice, DiagnosticOptions, mouse, queryReports(), receiver, WriteProbeOptions, HardwareTransport

### Community 31 - "leviathanV4Fixture.ts"
Cohesion: 0.24
Nodes (7): query, leviathanV4QueryFixture, rawmReceiverQueryFixture, formatLiftOffDistance(), LEVIATHAN_V4_LOD_LEVELS, LodLevel, raw

### Community 32 - "mouseParamSnapshot.ts"
Cohesion: 0.26
Nodes (11): applySettingsToMouseParam(), encodeMouseParamBody(), glassMode(), integer(), integers(), isPackedAxes(), modeIds, packedDpi() (+3 more)

### Community 33 - "shared/package.json"
Cohesion: 0.17
Nodes (11): typescript, devDependencies, typescript, exports, name, private, scripts, build (+3 more)

### Community 34 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowSyntheticDefaultImports, esModuleInterop, jsx, module, moduleResolution, resolveJsonModule, skipLibCheck (+2 more)

### Community 35 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, jsx, module, moduleResolution, noEmit, skipLibCheck, strict, target (+1 more)

### Community 36 - "deviceStore.ts"
Cohesion: 0.33
Nodes (8): createDemoKeyboard(), connectDemoDevices(), ConnectionFailure, ConnectionState, demoWasActive(), mergeDevices(), rememberDemo(), useDeviceStore

### Community 37 - "scripts"
Cohesion: 0.22
Nodes (8): name, private, scripts, build:wasm, format, lint, test, version

### Community 38 - "compilerOptions"
Cohesion: 0.22
Nodes (8): compilerOptions, module, moduleResolution, noEmit, skipLibCheck, strict, target, include

### Community 39 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, gearhub-core-wasm, @gearhub/shared, @gearhub/ui, lucide-react, react, react-dom, zustand

### Community 40 - "compilerOptions"
Cohesion: 0.25
Nodes (7): compilerOptions, composite, module, moduleResolution, noEmit, skipLibCheck, include

### Community 41 - "LeviathanV4Driver.onboard.test.ts"
Cohesion: 0.47
Nodes (3): mappingEvents(), harness(), notifyReport()

### Community 42 - "pkg/package.json"
Cohesion: 0.33
Nodes (5): main, name, type, types, version

### Community 43 - "dependencies"
Cohesion: 0.33
Nodes (6): dependencies, class-variance-authority, clsx, lucide-react, radix-ui, tailwind-merge

### Community 44 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, test

### Community 45 - "imports"
Cohesion: 0.50
Nodes (4): imports, #components/*, #hooks/*, #lib/*

### Community 46 - "devDependencies"
Cohesion: 0.50
Nodes (4): devDependencies, react, @types/react, typescript

### Community 47 - "exports"
Cohesion: 0.50
Nodes (4): exports, ./components/*, ./hooks/*, ./lib/*

### Community 48 - "imports"
Cohesion: 0.50
Nodes (4): imports, #components/*, #hooks/*, #lib/*

### Community 49 - "run-rust-tool.mjs"
Cohesion: 0.50
Nodes (3): commands, coreDirectory, result

## Knowledge Gaps
- **306 isolated node(s):** `ProfileWrite`, `SectionDefinition`, `Option`, `ButtonLayer`, `ToggleId` (+301 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 395 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `withProtocolEnvelope` to `editorStore.ts`, `DeviceWorkspace.tsx`, `cn`, `index.ts`, `writeProbe.ts`, `DpiSection.tsx`, `LeviathanV4Driver.onboard.test.ts`, `leviathanV4.ts`, `LeviathanV4Driver.ts`, `protocol.ts`, `web/package.json`, `deviceDiscovery.ts`, `App.tsx`, `demoDevices.ts`, `WebHidTransport.ts`, `ChangeBar.tsx`, `diagnostics.test.ts`, `leviathanV4Fixture.ts`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `typescript` connect `shared/package.json` to `web/package.json`, `ui/package.json`, `scripts`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `zustand` connect `web/package.json` to `editorStore.ts`, `deviceStore.ts`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `ProfileWrite`, `SectionDefinition`, `Option` to the rest of the system?**
  _306 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `editorStore.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06368011847463902 - nodes in this community are weakly interconnected._
- **Should `DeviceWorkspace.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06293706293706294 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.0715846994535519 - nodes in this community are weakly interconnected._