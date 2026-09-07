# Graph Report - OmniGear  (2026-09-07)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1015 nodes · 2363 edges · 72 communities (55 shown, 11 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e4d69048`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- DeviceWorkspace.tsx
- cn
- ProfilesSection.tsx
- DpiSection.tsx
- scripts
- writeProbe.ts
- coreBridge.ts
- leviathanV4.ts
- protocol.ts
- LeviathanV4Driver.ts
- web/package.json
- editorStore.ts
- demoDevices.ts
- deviceDiscovery.ts
- WebHidTransport.ts
- ParametersSection.tsx
- RawmDiagnosticPage.tsx
- index.ts
- vitest
- profileFile.ts
- diagnostics.ts
- LeviathanV4Driver
- web/components.json
- compilerOptions
- ui/components.json
- lib.rs
- devDependencies
- ui/package.json
- App.tsx
- tasks
- deviceDriver.ts
- DeviceStore
- MockMouseDriver
- routes.ts
- mouseParamSnapshot.ts
- shared/package.json
- compilerOptions
- PerformanceSection.tsx
- HidDeviceHandle
- compilerOptions
- HomePage.tsx
- scripts
- compilerOptions
- dependencies
- deviceDiscovery.integration.test.ts
- compilerOptions
- DeviceDriver
- LeviathanV4Driver.onboard.test.ts
- pkg/package.json
- dependencies
- scripts
- deviceStore.test.ts
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
- `KeyboardPhotoProps` --references--> `PeripheralPhoto`  [EXTRACTED]
  apps/web/src/components/devices/KeyboardPhoto.tsx → packages/shared/src/peripheral.ts
- `MouseButtonMapProps` --references--> `PeripheralPhoto`  [EXTRACTED]
  apps/web/src/components/devices/MouseButtonMap.tsx → packages/shared/src/peripheral.ts
- `StageRemoval` --references--> `DpiStage`  [EXTRACTED]
  apps/web/src/domain/dpi.ts → packages/shared/src/mouse.ts
- `GeneralSection()` --calls--> `cn()`  [EXTRACTED]
  apps/web/src/components/sections/GeneralSection.tsx → packages/ui/src/lib/utils.ts
- `MouseButtonsSection()` --calls--> `cn()`  [EXTRACTED]
  apps/web/src/components/sections/MouseButtonsSection.tsx → packages/ui/src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (72 total, 11 thin omitted)

### Community 0 - "DeviceWorkspace.tsx"
Cohesion: 0.07
Nodes (39): mouseActionLabels, findSection(), keyboardSections, mouseSections, SectionDefinition, sectionsFor(), useChangeCount(), useEditorEntry() (+31 more)

### Community 1 - "cn"
Cohesion: 0.06
Nodes (36): hexToRgba(), isHexColor(), BarContent, ChangeBar(), ChangeBarProps, KeyboardPhoto(), KeyboardPhotoProps, KeyboardView() (+28 more)

### Community 2 - "ProfilesSection.tsx"
Cohesion: 0.09
Nodes (28): downloadJson(), connectionErrorMessages, steps, ConfirmAction, ConfirmDialog(), ImportState, NameDialog(), NameDialogState (+20 more)

### Community 3 - "DpiSection.tsx"
Cohesion: 0.13
Nodes (28): AxisField(), commit(), axisName(), AxisProps, AxisSlider(), DpiSection(), changeAxis(), changeIndependentAxes() (+20 more)

### Community 4 - "scripts"
Cohesion: 0.06
Nodes (33): devDependencies, dependency-cruiser, knip, prettier, turbo, typescript, engines, node (+25 more)

### Community 5 - "writeProbe.ts"
Cohesion: 0.18
Nodes (24): RawmDiagnosticPage(), encodeAction(), encodeConfigReset(), encodeMouseParamSnapshot(), queryReports(), queryReports(), encodeLeviathanAction(), parseMouseParamState() (+16 more)

### Community 6 - "coreBridge.ts"
Cohesion: 0.15
Nodes (24): ByteArrayLike, copyBytes(), CoreStatus, encodeMouseFunction(), encodeMouseKey(), isByteArrayLike(), loadCore(), MouseParamSnapshot (+16 more)

### Community 7 - "leviathanV4.ts"
Cohesion: 0.12
Nodes (21): registerDeviceDriver(), DeviceDefinition, deviceDefinitions, DeviceRequestFilter, HidCollectionInfo, HidDeviceIdentity, HidReportInfo, connectLeviathanV4() (+13 more)

### Community 8 - "protocol.ts"
Cohesion: 0.19
Nodes (15): captureQuery(), subscribeToNotifications(), buildQueryEvent(), crc16(), decodeReportChunk(), encodeLength(), eventLength(), isQueryResult() (+7 more)

### Community 9 - "LeviathanV4Driver.ts"
Cohesion: 0.15
Nodes (17): pause(), actions, buttonIdsByKeyId, EncodedAction, FUNCTION_SHOW_POWER, physicalKeyIds, SHOW_POWER_KEY_ID, TOUCH_TYPE_PRESS (+9 more)

### Community 10 - "web/package.json"
Cohesion: 0.11
Nodes (20): react, name, private, type, version, eslint, @eslint/js, eslint-plugin-react-hooks (+12 more)

### Community 11 - "editorStore.ts"
Cohesion: 0.15
Nodes (18): activeSettings(), isKeyboardSettings(), isMouseSettings(), withWrittenProfile(), applyTokens, cancelPendingApply(), EditorEntry, failedWrites (+10 more)

### Community 12 - "demoDevices.ts"
Cohesion: 0.11
Nodes (18): mouseFeatureVisibility(), createDemoMouse(), demoKeyboardDefaults, demoMouseDefaults, keyboardActions, keyboardKeys, keyboardPhoto, keyboardRows (+10 more)

### Community 13 - "deviceDiscovery.ts"
Cohesion: 0.15
Nodes (19): connectDemoDevices(), ConnectionFailure, ConnectionResult, connectRecognized(), defaultConnector(), DeviceConnector, HidDisconnectEvent, HidRequestOptions (+11 more)

### Community 14 - "WebHidTransport.ts"
Cohesion: 0.13
Nodes (12): BrowserHidDevice, DiagnosticOptions, mouse, receiver, isNotification(), parseNotification(), RawmNotification, notifyEvent() (+4 more)

### Community 15 - "ParametersSection.tsx"
Cohesion: 0.13
Nodes (12): connectionLabels, describeSettings(), deviceTypeLabels, mouseParameterLabels, MouseSideArt(), pointOnArc(), RotationDial(), ToggleId (+4 more)

### Community 16 - "RawmDiagnosticPage.tsx"
Cohesion: 0.10
Nodes (17): hidApi(), KEY_IDS, MAPPING_ACTIONS, MAPPING_SETS, probe(), statusLabels, statusStyles, WRITE_TARGETS (+9 more)

### Community 17 - "index.ts"
Cohesion: 0.19
Nodes (18): KeyboardAction, KeyboardCapabilities, KeyboardSettings, LightingCapabilities, LightingEffect, LightingSettings, MouseCapabilities, MouseParameterCapabilities (+10 more)

### Community 18 - "vitest"
Cohesion: 0.15
Nodes (12): mouse, receiver, query, raw, recordingDriver(), leviathanV4QueryFixture, rawmReceiverQueryFixture, formatLiftOffDistance() (+4 more)

### Community 19 - "profileFile.ts"
Cohesion: 0.18
Nodes (18): handleFile(), buildProfileFile(), finite(), isRecord(), keyboardFits(), migrateMouseV1(), mouseFits(), ProfileFile (+10 more)

### Community 20 - "diagnostics.ts"
Cohesion: 0.17
Nodes (19): CaptureResult, CaptureSource, collectionStage(), describeDevice(), DiagnosticChannel, DiagnosticCollectionInfo, DiagnosticDeviceInfo, DiagnosticReport (+11 more)

### Community 21 - "LeviathanV4Driver"
Cohesion: 0.21
Nodes (8): editorKeySets(), intendedMappings(), isShowPower(), keyOf(), LeviathanV4Driver, mouseSettings(), reportedMappings(), signatureOf()

### Community 22 - "web/components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 23 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+9 more)

### Community 24 - "ui/components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 25 - "lib.rs"
Cohesion: 0.20
Nodes (10): append_u16_le(), config_event(), core_version(), encode_action(), encode_config_reset(), encode_mouse_function(), encode_mouse_key(), encode_mouse_param_snapshot() (+2 more)

### Community 26 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, tailwindcss, @tailwindcss/vite (+7 more)

### Community 27 - "ui/package.json"
Cohesion: 0.13
Nodes (14): lucide-react, react-dom, @types/react, react, name, peerDependencies, react, react-dom (+6 more)

### Community 28 - "App.tsx"
Cohesion: 0.25
Nodes (9): App(), exitDemonstration(), navigate(), storedTheme(), systemTheme(), Theme, useTheme(), AppHeader() (+1 more)

### Community 29 - "tasks"
Cohesion: 0.14
Nodes (13): dependsOn, outputs, cache, persistent, dependsOn, $schema, tasks, build (+5 more)

### Community 30 - "deviceDriver.ts"
Cohesion: 0.24
Nodes (9): useDeviceReports(), withOnboardProfiles(), demoDriver, DeviceReport, driverFor(), liveDrivers, OnboardProfileReport, unregisterDeviceDriver() (+1 more)

### Community 31 - "DeviceStore"
Cohesion: 0.19
Nodes (3): AddDeviceDialog(), HomePage(), DeviceStore

### Community 32 - "MockMouseDriver"
Cohesion: 0.23
Nodes (8): HidCommand, MouseDriver, mock_registry(), RegisteredDriver, Vec, encodes_dpi_little_endian(), encodes_polling_rate_little_endian(), MockMouseDriver

### Community 33 - "routes.ts"
Cohesion: 0.29
Nodes (9): deviceRoute(), homeRoute, keyboardSectionIds, mouseSectionIds, parseHash(), Route, routeToHash(), subscribe() (+1 more)

### Community 34 - "mouseParamSnapshot.ts"
Cohesion: 0.26
Nodes (11): applySettingsToMouseParam(), encodeMouseParamBody(), glassMode(), integer(), integers(), isPackedAxes(), modeIds, packedDpi() (+3 more)

### Community 35 - "shared/package.json"
Cohesion: 0.17
Nodes (11): typescript, devDependencies, typescript, exports, name, private, scripts, build (+3 more)

### Community 36 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowSyntheticDefaultImports, esModuleInterop, jsx, module, moduleResolution, resolveJsonModule, skipLibCheck (+2 more)

### Community 37 - "PerformanceSection.tsx"
Cohesion: 0.33
Nodes (7): DevicePhoto(), PerformanceSection(), BatteryEstimate, estimateBatteryHours(), formatInterval(), reportInterval(), PeripheralPhoto

### Community 38 - "HidDeviceHandle"
Cohesion: 0.22
Nodes (3): HidDeviceHandle, withinTimeout(), HidCommand

### Community 39 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, jsx, module, moduleResolution, noEmit, skipLibCheck, strict, target (+1 more)

### Community 40 - "HomePage.tsx"
Cohesion: 0.31
Nodes (5): describeDevice(), defaultSectionFor(), sectionIdsFor(), DeviceCard(), DevicePreview()

### Community 41 - "scripts"
Cohesion: 0.22
Nodes (8): name, private, scripts, build:wasm, format, lint, test, version

### Community 42 - "compilerOptions"
Cohesion: 0.22
Nodes (8): compilerOptions, module, moduleResolution, noEmit, skipLibCheck, strict, target, include

### Community 43 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, gearhub-core-wasm, @gearhub/shared, @gearhub/ui, lucide-react, react, react-dom, zustand

### Community 44 - "deviceDiscovery.integration.test.ts"
Cohesion: 0.32
Nodes (3): BrowserHidApi, knownDevice, onDeviceDisconnected()

### Community 45 - "compilerOptions"
Cohesion: 0.25
Nodes (7): compilerOptions, composite, module, moduleResolution, noEmit, skipLibCheck, include

### Community 47 - "LeviathanV4Driver.onboard.test.ts"
Cohesion: 0.47
Nodes (3): mappingEvents(), harness(), notifyReport()

### Community 48 - "pkg/package.json"
Cohesion: 0.33
Nodes (5): main, name, type, types, version

### Community 49 - "dependencies"
Cohesion: 0.33
Nodes (6): dependencies, class-variance-authority, clsx, lucide-react, radix-ui, tailwind-merge

### Community 50 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, test

### Community 52 - "imports"
Cohesion: 0.50
Nodes (4): imports, #components/*, #hooks/*, #lib/*

### Community 53 - "devDependencies"
Cohesion: 0.50
Nodes (4): devDependencies, react, @types/react, typescript

### Community 54 - "exports"
Cohesion: 0.50
Nodes (4): exports, ./components/*, ./hooks/*, ./lib/*

### Community 55 - "imports"
Cohesion: 0.50
Nodes (4): imports, #components/*, #hooks/*, #lib/*

### Community 56 - "run-rust-tool.mjs"
Cohesion: 0.50
Nodes (3): commands, coreDirectory, result

## Knowledge Gaps
- **304 isolated node(s):** `SectionDefinition`, `ButtonLayer`, `Option`, `RowMetrics`, `BarContent` (+299 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 395 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `DeviceWorkspace.tsx`, `routes.ts`, `cn`, `DpiSection.tsx`, `writeProbe.ts`, `protocol.ts`, `LeviathanV4Driver.ts`, `web/package.json`, `editorStore.ts`, `demoDevices.ts`, `deviceDiscovery.integration.test.ts`, `deviceDiscovery.ts`, `WebHidTransport.ts`, `LeviathanV4Driver.onboard.test.ts`, `profileFile.ts`, `deviceStore.test.ts`, `deviceDriver.ts`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **Why does `typescript` connect `shared/package.json` to `web/package.json`, `ui/package.json`, `scripts`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Why does `zustand` connect `web/package.json` to `editorStore.ts`, `deviceDiscovery.ts`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `SectionDefinition`, `ButtonLayer`, `Option` to the rest of the system?**
  _304 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DeviceWorkspace.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06947996589940324 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.06384180790960452 - nodes in this community are weakly interconnected._
- **Should `ProfilesSection.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09302325581395349 - nodes in this community are weakly interconnected._