# RAWM Leviathan V4 Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Recognize the RAWM Leviathan V4 receiver and deliver capability-gated performance modes, wireless turbo, and R-Plus settings through a safe WebHID driver.

**Architecture:** Keep device/model knowledge in a registry. Shared types describe optional capabilities; WebHID discovery chooses a model definition; a RAWM transport performs receiver/mouse query and framing; a driver translates editor snapshots to validated protocol packets. UI remains generic and renders only declared capabilities.

**Tech Stack:** React 19, TypeScript, Zustand, WebHID, Vitest, Rust/WASM protocol core with the checked-in development bridge.

---

### Task 1: Register the approved UI decisions

**Files:**
- Modify: `apps/web/.impeccable/design-catalog.json`
- Modify: `apps/web/.impeccable/mocks/leviathan-v4/*.json`
- Modify: `apps/web/.impeccable/design-handoff.md`

1. Mark the performance, Turbo sem fio, and R-Plus entries approved.
2. Record the final layout and capability-gating decisions in the handoff.
3. Rebuild the local design gallery and verify its entries.

### Task 2: Extend the shared mouse contract

**Files:**
- Modify: `packages/shared/src/mouse.ts`
- Modify: `apps/web/src/hardware/demoDevices.ts`
- Test: `apps/web/src/domain/mouseCapabilities.test.ts`

1. Write failing tests for optional performance modes, wireless turbo, and R-Plus invariants.
2. Add the new capability and settings types; rename `extendedRange` to `wirelessTurbo`.
3. Add helpers that normalize an action layer and prevent an R-Plus activator from receiving its own secondary action.
4. Update demo fixtures without claiming unsupported commercial features.

### Task 3: Add a per-model driver registry

**Files:**
- Create: `apps/web/src/hardware/deviceRegistry.ts`
- Create: `apps/web/src/hardware/rawm/leviathanV4.ts`
- Test: `apps/web/src/hardware/deviceRegistry.test.ts`

1. Write failing identity/collection matching tests.
2. Define a registry contract for filters, matching, capabilities, defaults, and connection.
3. Register RAWM VID `0x1915`, receiver PID `0x2346`, usage page `0xFF00`, usage `0x0001`.
4. Verify unknown devices remain unrecognized.

### Task 4: Implement RAWM framing and validated query

**Files:**
- Modify: `apps/web/src/hardware/WebHidTransport.ts`
- Create: `apps/web/src/hardware/rawm/protocol.ts`
- Test: `apps/web/src/hardware/rawm/protocol.test.ts`

1. Write failing fixtures for length headers, CRC16, physical and virtual report fragmentation, and response assembly.
2. Add input-report support and bounded request/response timeouts to the transport.
3. Implement query framing for receiver and ESB mouse channel without executing or importing vendor code.
4. Parse the reported JSON aliases into a validated snapshot; reject incomplete or mismatched responses.

### Task 5: Encode settings in the protocol core

**Files:**
- Modify: `packages/core/src/lib.rs`
- Modify: `packages/core/pkg/index.js`
- Modify: `packages/core/pkg/index.d.ts`
- Modify: `apps/web/src/core/coreBridge.ts`
- Test: `packages/core/src/lib.rs`
- Test: `apps/web/src/core/coreBridge.test.ts`

1. Write failing byte-vector tests for mouse parameters, actions, mouse keys, and mouse functions.
2. Export deterministic encoders from Rust/WASM.
3. Keep the development bridge behavior identical so the web app works before a release WASM build.
4. Verify Rust tests when the toolchain is available and TypeScript contract tests always.

### Task 6: Connect discovery and driver lifecycle

**Files:**
- Modify: `apps/web/src/hardware/deviceDiscovery.ts`
- Modify: `apps/web/src/hardware/deviceDriver.ts`
- Modify: `apps/web/src/store/deviceStore.ts`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/hardware/deviceDiscovery.integration.test.ts`
- Test: `apps/web/src/store/deviceStore.test.ts`

1. Write failing tests for picker recognition, authorized-device restoration, targeted disconnect, and safe write gating.
2. Discover through registry filters and build a `MousePeripheral` only after the RAWM query validates.
3. Associate the live driver/transport with the peripheral identity without placing non-serializable handles in persisted state.
4. Apply live snapshots and write the selected onboard profile only after acknowledgement/validated state.

### Task 7: Implement the approved generic UI

**Files:**
- Modify: `apps/web/src/components/sections/PerformanceSection.tsx`
- Modify: `apps/web/src/components/sections/ParametersSection.tsx`
- Modify: `apps/web/src/components/sections/MouseButtonsSection.tsx`
- Modify: `apps/web/src/app/labels.ts`
- Test: `apps/web/src/domain/mousePresentation.test.ts`

1. Write failing presentation-model tests proving unsupported controls are absent.
2. Place performance mode beside polling rate with the existing upright mouse area unchanged and no divider between controls.
3. Replace Alcance estendido with Turbo sem fio and its approved text.
4. Add accessible principal/R-Plus layer controls and activator selection.
5. Validate light/dark and narrow layouts in the running app.

### Task 8: Verify and maintain project metadata

**Files:**
- Modify: `graphify-out/*` via project command when available

1. Run focused Vitest suites after each green step.
2. Run full tests, typecheck/lint, and production build.
3. Run `pnpm graph:update`; if Graphify remains unavailable, report the exact blocker without hiding it.
4. Perform a WebHID smoke test with the physical receiver when the user can select it in the browser.
5. Remove temporary vendor-script analysis artifacts.

