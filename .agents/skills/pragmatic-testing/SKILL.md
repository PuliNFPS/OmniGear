---
name: pragmatic-testing
description: Design and implement focused TypeScript and Rust tests for changed behavior, regressions, and public contracts. Use when adding or reviewing tests; avoid exhaustive low-value coverage and implementation-detail assertions.
---

# Pragmatic Testing

Provide the smallest test set that gives credible evidence for the requested change.

## Select Necessary Tests

- Identify the observable behavior, risk, and failure mode before choosing a test level.
- Cover the changed happy path and only the important boundary, failure, or regression cases that could plausibly break.
- Prefer a few high-signal tests over exhaustive permutations, duplicate assertions, snapshots of unstable markup, or tests for trivial getters and framework internals.
- Test through the narrowest stable public contract. Avoid exposing private internals solely for tests.
- Use integration or end-to-end tests only when behavior crosses a boundary that unit tests cannot prove.

## Use Test-First When It Clarifies Behavior

- For a bug, first add a focused test that fails for the reported behavior, then implement the general correction and confirm the test passes.
- For new behavior with a clear contract, write the contract test first when it helps define inputs, outputs, errors, or edge cases.
- Implement code to satisfy the intended behavior, not a brittle assertion. If a test conflicts with the real contract, correct the test rather than distorting production code.
- Do not overfit with hard-coded special cases, test-only branches, or unnecessary production seams.

## TypeScript

- Use the repository's existing runner and conventions; do not introduce a second test framework without a concrete need.
- Test exported behavior, domain logic, component interaction, and meaningful async or error states.
- Prefer typed fixtures and lightweight fakes. Mock network, time, filesystem, or nondeterministic boundaries rather than every collaborator.
- Run the targeted test file and relevant type check first. Expand to the affected package or suite only when shared behavior or risk justifies it.

## Rust

- Put focused unit tests beside private or module-local logic and integration tests under `tests/` for public crate behavior.
- Prefer result and state assertions over implementation sequencing. Use test doubles at ports such as storage, clocks, randomness, or remote services.
- Test important `Result` error paths and invariants; do not add panic tests for impossible states merely to increase coverage.
- Run the narrowest useful `cargo test` target first, then the affected crate or workspace only when dependency impact requires it.

## Keep the Suite Useful

- Keep tests deterministic, isolated, readable, and fast enough for their intended feedback loop.
- Reuse concise fixtures/builders when they remove meaningful duplication; avoid large opaque test frameworks.
- Ask the user only when expected behavior is ambiguous or a broad/expensive test run needs authorization. Otherwise run the necessary scoped checks and report exactly what was and was not tested.
