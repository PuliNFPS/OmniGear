# Graph Report - OmniGear  (2026-09-06)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1017 nodes · 2366 edges · 67 communities (52 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cc65d185`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- editorStore.ts
- DeviceWorkspace.tsx
- cn
- ProfilesSection.tsx
- index.ts
- DpiSection.tsx
- scripts
- withProtocolEnvelope
- deviceDiscovery.ts
- leviathanV4.ts
- web/package.json
- diagnostics.ts
- RawmDiagnosticPage.tsx
- demoDevices.ts
- connectLeviathanV4.test.ts
- LeviathanV4Driver.ts
- coreBridge.ts
- writeProbe.ts
- web/components.json
- compilerOptions
- ui/components.json
- ui/package.json
- lib.rs
- devDependencies
- LeviathanV4Driver
- deviceStore.ts
- onboardConfig.settings.test.ts
- tasks
- DeviceStore
- MockMouseDriver
- App.tsx
- diagnostics.test.ts
- leviathanV4Fixture.ts
- mouseParamSnapshot.ts
- shared/package.json
- compilerOptions
- compilerOptions
- scripts
- compilerOptions
- dependencies
- vitest
- compilerOptions
- LeviathanV4Driver.onboard.test.ts
- encodeMouseFunction
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
2. `cn()` - 29 edges
3. `withProtocolEnvelope()` - 29 edges
4. `vitest` - 28 edges
5. `frameEvent()` - 23 edges
6. `useDeviceStore` - 22 edges
7. `DeviceWorkspace()` - 21 edges
8. `findSection()` - 20 edges
9. `captureQuery()` - 20 edges
10. `LeviathanV4Driver` - 19 edges

## Surprising Connections (you probably didn't know these)
- `StageRemoval` --references--> `DpiStage`  [EXTRACTED]
  apps/web/src/domain/dpi.ts → packages/shared/src/mouse.ts
- `ChangeBar()` --calls--> `cn()`  [EXTRACTED]
  apps/web/src/components/ChangeBar.tsx → packages/ui/src/lib/utils.ts
- `DeviceWorkspace()` --calls--> `cn()`  [EXTRACTED]
  apps/web/src/components/DeviceWorkspace.tsx → packages/ui/src/lib/utils.ts
- `OptionGroup()` --calls--> `cn()`  [EXTRACTED]
  apps/web/src/components/OptionGroup.tsx → packages/ui/src/lib/utils.ts
- `MouseButtonsSection()` --calls--> `cn()`  [EXTRACTED]
  apps/web/src/components/sections/MouseButtonsSection.tsx → packages/ui/src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (67 total, 9 thin omitted)

### Community 0 - "editorStore.ts"
Cohesion: 0.06
Nodes (50): useDeviceReports(), withOnboardProfiles(), useChangeCount(), useEditorEntry(), useKeyboardEditor(), useMouseEditor(), useProfileLoad(), BarContent (+42 more)

### Community 1 - "DeviceWorkspace.tsx"
Cohesion: 0.06
Nodes (39): findSection(), keyboardSections, mouseSections, SectionDefinition, sectionsFor(), MouseSideArt(), pointOnArc(), RotationDial() (+31 more)

### Community 2 - "cn"
Cohesion: 0.07
Nodes (38): hexToRgba(), isHexColor(), describeDevice(), defaultSectionFor(), deviceRoute(), homeRoute, keyboardSectionIds, mouseSectionIds (+30 more)

### Community 3 - "ProfilesSection.tsx"
Cohesion: 0.08
Nodes (35): connectionErrorMessages, connectionLabels, describeSettings(), deviceTypeLabels, mouseActionLabels, mouseParameterLabels, steps, ConfirmAction (+27 more)

### Community 4 - "index.ts"
Cohesion: 0.10
Nodes (36): handleFile(), buildProfileFile(), finite(), isRecord(), keyboardFits(), migrateMouseV1(), mouseFits(), ProfileFile (+28 more)

### Community 5 - "DpiSection.tsx"
Cohesion: 0.12
Nodes (29): AxisField(), commit(), axisName(), AxisProps, AxisSlider(), DpiSection(), changeAxis(), changeIndependentAxes() (+21 more)

### Community 6 - "scripts"
Cohesion: 0.06
Nodes (33): devDependencies, dependency-cruiser, knip, prettier, turbo, typescript, engines, node (+25 more)

### Community 7 - "withProtocolEnvelope"
Cohesion: 0.18
Nodes (19): captureQuery(), subscribeToNotifications(), buildQueryEvent(), crc16(), decodeReportChunk(), encodeLength(), eventLength(), frameEvent() (+11 more)

### Community 8 - "deviceDiscovery.ts"
Cohesion: 0.13
Nodes (16): BrowserHidApi, ConnectionResult, connectRecognized(), defaultConnector(), DeviceConnector, HidDisconnectEvent, HidRequestOptions, knownDevice (+8 more)

### Community 9 - "leviathanV4.ts"
Cohesion: 0.11
Nodes (20): deviceDefinitions, DeviceRequestFilter, HidCollectionInfo, HidDeviceIdentity, HidReportInfo, actions, buttons, createLeviathanV4Peripheral() (+12 more)

### Community 10 - "web/package.json"
Cohesion: 0.11
Nodes (20): react, name, private, type, version, eslint, @eslint/js, eslint-plugin-react-hooks (+12 more)

### Community 11 - "diagnostics.ts"
Cohesion: 0.14
Nodes (22): CaptureResult, CaptureSource, CHANNEL_LABELS, collectionStage(), describeDevice(), DiagnosticChannel, DiagnosticCollectionInfo, DiagnosticDeviceInfo (+14 more)

### Community 12 - "RawmDiagnosticPage.tsx"
Cohesion: 0.12
Nodes (16): downloadJson(), hidApi(), KEY_IDS, MAPPING_ACTIONS, MAPPING_SETS, RawmDiagnosticPage(), probe(), statusLabels (+8 more)

### Community 13 - "demoDevices.ts"
Cohesion: 0.11
Nodes (18): mouseFeatureVisibility(), createDemoKeyboard(), createDemoMouse(), demoKeyboardDefaults, demoMouseDefaults, keyboardActions, keyboardKeys, keyboardPhoto (+10 more)

### Community 14 - "connectLeviathanV4.test.ts"
Cohesion: 0.12
Nodes (9): connectLeviathanV4(), mouse, queryReports(), receiver, HidDeviceHandle, HidInputReportEvent, WebHidTransportOptions, withinTimeout() (+1 more)

### Community 15 - "LeviathanV4Driver.ts"
Cohesion: 0.17
Nodes (18): DeviceReport, intendedMappings(), isShowPower(), keyOf(), reportedMappings(), signatureOf(), actions, buttonIdsByKeyId (+10 more)

### Community 16 - "coreBridge.ts"
Cohesion: 0.18
Nodes (18): ByteArrayLike, CoreStatus, loadCore(), MouseParamSnapshot, RawAction, RawMouseFunction, RawMouseKey, RawMouseParamSnapshot (+10 more)

### Community 17 - "writeProbe.ts"
Cohesion: 0.26
Nodes (14): encodeAction(), encodeConfigReset(), encodeMouseParamSnapshot(), parseMouseParamState(), compareStates(), FieldDivergence, hex(), messageOf() (+6 more)

### Community 18 - "web/components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 19 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+9 more)

### Community 20 - "ui/components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 21 - "ui/package.json"
Cohesion: 0.12
Nodes (16): lucide-react, react-dom, @types/react, react, name, peerDependencies, react, react-dom (+8 more)

### Community 22 - "lib.rs"
Cohesion: 0.20
Nodes (10): append_u16_le(), config_event(), core_version(), encode_action(), encode_config_reset(), encode_mouse_function(), encode_mouse_key(), encode_mouse_param_snapshot() (+2 more)

### Community 23 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, tailwindcss, @tailwindcss/vite (+7 more)

### Community 24 - "LeviathanV4Driver"
Cohesion: 0.28
Nodes (3): LeviathanV4Driver, mouseSettings(), pause()

### Community 25 - "deviceStore.ts"
Cohesion: 0.22
Nodes (8): exitDemonstration(), ConnectionFailure, ConnectionState, demoWasActive(), mergeDevices(), rememberDemo(), requestDeviceMock, useDeviceStore

### Community 26 - "onboardConfig.settings.test.ts"
Cohesion: 0.21
Nodes (9): encodeLeviathanAction(), declaredLength(), decodeOnboardEntry(), namedAction(), OnboardBinding, OnboardConfigCollector, base, binding() (+1 more)

### Community 27 - "tasks"
Cohesion: 0.14
Nodes (13): dependsOn, outputs, cache, persistent, dependsOn, $schema, tasks, build (+5 more)

### Community 28 - "DeviceStore"
Cohesion: 0.19
Nodes (3): AddDeviceDialog(), HomePage(), DeviceStore

### Community 29 - "MockMouseDriver"
Cohesion: 0.23
Nodes (8): HidCommand, MouseDriver, mock_registry(), RegisteredDriver, Vec, encodes_dpi_little_endian(), encodes_polling_rate_little_endian(), MockMouseDriver

### Community 30 - "App.tsx"
Cohesion: 0.30
Nodes (7): App(), storedTheme(), systemTheme(), Theme, useTheme(), AppHeader(), BrandMark()

### Community 31 - "diagnostics.test.ts"
Cohesion: 0.20
Nodes (7): BrowserHidDevice, DiagnosticOptions, mouse, queryReports(), receiver, WriteProbeOptions, HardwareTransport

### Community 32 - "leviathanV4Fixture.ts"
Cohesion: 0.24
Nodes (7): query, leviathanV4QueryFixture, rawmReceiverQueryFixture, formatLiftOffDistance(), LEVIATHAN_V4_LOD_LEVELS, LodLevel, raw

### Community 33 - "mouseParamSnapshot.ts"
Cohesion: 0.26
Nodes (11): applySettingsToMouseParam(), encodeMouseParamBody(), glassMode(), integer(), integers(), isPackedAxes(), modeIds, packedDpi() (+3 more)

### Community 34 - "shared/package.json"
Cohesion: 0.17
Nodes (11): typescript, devDependencies, typescript, exports, name, private, scripts, build (+3 more)

### Community 35 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowSyntheticDefaultImports, esModuleInterop, jsx, module, moduleResolution, resolveJsonModule, skipLibCheck (+2 more)

### Community 36 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, jsx, module, moduleResolution, noEmit, skipLibCheck, strict, target (+1 more)

### Community 37 - "scripts"
Cohesion: 0.22
Nodes (8): name, private, scripts, build:wasm, format, lint, test, version

### Community 38 - "compilerOptions"
Cohesion: 0.22
Nodes (8): compilerOptions, module, moduleResolution, noEmit, skipLibCheck, strict, target, include

### Community 39 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, gearhub-core-wasm, @gearhub/shared, @gearhub/ui, lucide-react, react, react-dom, zustand

### Community 40 - "vitest"
Cohesion: 0.36
Nodes (5): isNotification(), parseNotification(), RawmNotification, notifyEvent(), vitest

### Community 41 - "compilerOptions"
Cohesion: 0.25
Nodes (7): compilerOptions, composite, module, moduleResolution, noEmit, skipLibCheck, include

### Community 42 - "LeviathanV4Driver.onboard.test.ts"
Cohesion: 0.38
Nodes (4): editorKeySets(), mappingEvents(), harness(), notifyReport()

### Community 43 - "encodeMouseFunction"
Cohesion: 0.53
Nodes (6): copyBytes(), encodeMouseFunction(), encodeMouseKey(), isByteArrayLike(), snapshotBytes(), textBytes()

### Community 44 - "pkg/package.json"
Cohesion: 0.33
Nodes (5): main, name, type, types, version

### Community 45 - "dependencies"
Cohesion: 0.33
Nodes (6): dependencies, class-variance-authority, clsx, lucide-react, radix-ui, tailwind-merge

### Community 46 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, test

### Community 47 - "imports"
Cohesion: 0.50
Nodes (4): imports, #components/*, #hooks/*, #lib/*

### Community 48 - "devDependencies"
Cohesion: 0.50
Nodes (4): devDependencies, react, @types/react, typescript

### Community 49 - "exports"
Cohesion: 0.50
Nodes (4): exports, ./components/*, ./hooks/*, ./lib/*

### Community 50 - "imports"
Cohesion: 0.50
Nodes (4): imports, #components/*, #hooks/*, #lib/*

### Community 51 - "run-rust-tool.mjs"
Cohesion: 0.50
Nodes (3): commands, coreDirectory, result

## Knowledge Gaps
- **306 isolated node(s):** `BarContent`, `ProfileWrite`, `SectionDefinition`, `Option`, `ButtonLayer` (+301 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 397 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `editorStore.ts`, `DeviceWorkspace.tsx`, `cn`, `leviathanV4Fixture.ts`, `index.ts`, `DpiSection.tsx`, `withProtocolEnvelope`, `deviceDiscovery.ts`, `leviathanV4.ts`, `web/package.json`, `LeviathanV4Driver.onboard.test.ts`, `demoDevices.ts`, `connectLeviathanV4.test.ts`, `writeProbe.ts`, `deviceStore.ts`, `onboardConfig.settings.test.ts`, `diagnostics.test.ts`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **Why does `typescript` connect `shared/package.json` to `web/package.json`, `ui/package.json`, `scripts`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `zustand` connect `web/package.json` to `editorStore.ts`, `deviceStore.ts`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **What connects `BarContent`, `ProfileWrite`, `SectionDefinition` to the rest of the system?**
  _306 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `editorStore.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05518207282913165 - nodes in this community are weakly interconnected._
- **Should `DeviceWorkspace.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.061072261072261075 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.0715846994535519 - nodes in this community are weakly interconnected._