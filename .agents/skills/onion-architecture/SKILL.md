---
name: onion-architecture
description: Design or refactor domain-oriented services with Onion Architecture, dependency inversion, dependency injection, ports, and adapters. Use for architectural boundaries and service design; do not impose it on trivial modules.
---

# Onion Architecture

Keep domain and application decisions independent from frameworks and infrastructure while avoiding ceremonial layers.

## Apply the Dependency Rule

Organize responsibilities conceptually from the center outward:

1. Domain: entities, value objects, invariants, and domain policies.
2. Application: use cases, orchestration, commands, queries, and port definitions.
3. Adapters: persistence, HTTP, messaging, external APIs, clocks, and other port implementations.
4. Delivery and composition: controllers, handlers, UI entry points, configuration, and dependency wiring.

Dependencies point inward. Inner layers must not import database clients, web frameworks, UI frameworks, or concrete external services.

## Invert and Inject Dependencies

- Define narrow ports at the layer that consumes the capability, using domain-oriented operations rather than infrastructure-shaped APIs.
- Inject implementations explicitly through constructors or function parameters.
- Assemble concrete dependencies in one composition root near the application boundary.
- Avoid service locators, hidden globals, singleton mutation, and domain code that constructs infrastructure clients.
- Keep transactions, retries, serialization, and protocol details at the appropriate outer boundary unless they are genuine domain rules.

## Choose Useful Abstractions

- Add an interface or trait for a real boundary, substitution, volatile dependency, or test seam—not for every struct or function.
- Keep ports small and cohesive. Split interfaces when consumers need different capabilities.
- Use domain types across inner boundaries; translate transport and persistence models in adapters.
- Prefer explicit use cases over generic manager, helper, or service objects with unrelated responsibilities.
- If the existing application is small, introduce only the boundaries required by the current change and leave a clear path for later extraction.

## Verify the Architecture

- Test domain rules as fast pure tests and application use cases with lightweight port fakes.
- Use integration tests for real adapters and a small number of boundary tests for complete wiring.
- Review imports and construction sites to confirm dependency direction and ensure infrastructure types have not leaked inward.
- Document a non-obvious boundary decision when future maintainers could otherwise reconnect layers incorrectly.
