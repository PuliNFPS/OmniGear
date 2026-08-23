---
name: maintainable-code
description: Write or refactor production code for modularity, clarity, reuse, and stable boundaries. Use during implementation or maintainability refactors; do not use for architecture selection or test-only work.
---

# Maintainable Code

Improve maintainability without turning a focused change into a speculative framework.

## Understand Before Changing

- Inspect nearby code, repository conventions, dependency direction, and existing reusable utilities before designing new structure.
- Preserve public behavior unless the task explicitly changes it.
- Keep the change focused. Do not mix broad cleanup with feature or bug work unless the cleanup is required for a safe implementation.

## Design Cohesive Modules

- Give each module, component, function, and type one clear reason to change.
- Separate domain decisions from transport, persistence, framework, and UI details.
- Prefer small composable units with explicit inputs, outputs, errors, and ownership.
- Keep state local and minimize hidden mutation, global state, temporal coupling, and boolean-flag behavior.
- Use names that express domain intent. Comments should explain why or constraints, not narrate obvious code.

## Avoid Duplicate Knowledge

- Search for existing behavior before adding helpers, components, validators, queries, constants, or mappings.
- Keep each business rule and meaningful transformation in one authoritative place.
- Extract repeated behavior behind a well-named function, module, component, or type. Reuse it instead of copying and editing variants.
- Do not force coincidentally similar code into one abstraction. A shared abstraction must represent the same concept and change for the same reason.
- Remove obsolete paths after migration when compatibility is not required; do not leave parallel implementations without a documented boundary.

## Use Abstraction Deliberately

- Introduce an abstraction when it creates a stable boundary, removes duplicated domain knowledge, isolates a volatile dependency, or enables a real substitution.
- Prefer composition over inheritance and explicit dependencies over service locators or ambient globals.
- Keep interfaces narrow and owned by their consumers. Do not create an interface for every concrete type or add generic parameters for hypothetical future use.
- Place framework-specific code at the edges and keep reusable core logic framework-independent when practical.

## Verify Quality

- Handle errors at the layer that has enough context to act; do not silently swallow failures.
- Preserve type safety. Avoid unchecked casts, broad `any`, panic-prone shortcuts, or stringly typed domain states when stronger types are practical.
- Format and run the smallest relevant lint, type, build, and test checks for the change.
- Review the final diff for duplicated logic, dead code, accidental API growth, unrelated churn, and needlessly complex abstractions.
