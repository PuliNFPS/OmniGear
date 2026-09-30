# Migração do dump onboard para o núcleo (passo 4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o passo 4 da migração: a decodificação das entradas do dump `0x14`, o montador do fluxo delimitado e a leitura de uma memória como configuração do editor passam para o núcleo; `onboardConfig.ts` é apagado; a duplicata declarada `declaredLength` fecha.

**Architecture:** `protocols/rawm/onboard.rs` guarda os tipos (`OnboardBinding`, `OnboardSlotConfig`), `decode_onboard_entry` (medida pelo `event_length` de `envelope.rs`) e o `OnboardConfigCollector`; `drivers/leviathan_v4/slot_settings.rs` guarda `settings_from_slot`. O montador atravessa a ponte como classe (Decisão 4, precedente do `RawEventAssembler`); os bytes crus atravessam como `Uint8Array` via `serde_bytes` (Decisão 5). Os tipos TS são gerados por `ts-rs`, e o `OnboardProfileReport` de `deviceDriver.ts` passa a ser o tipo gerado.

**Tech Stack:** Rust 2024, `serde`, `serde_bytes` 0.11, `ts-rs` 12 (dev), `wasm-bindgen` 0.2, `serde-wasm-bindgen` 0.6, TypeScript 5.9, Vitest, pnpm + Turborepo.

**Spec:** `docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md` — seção `## Passo 4 — desenho (2026-09-30)`, e `## Como verificar cada passo`.

## Global Constraints

- **O núcleo não faz I/O, é síncrono, não conhece `wasm-bindgen`.** `serde_bytes` é permitido no núcleo; `serde-wasm-bindgen` só na ponte.
- **Migrar é apagar.** O passo só fecha quando `onboardConfig.ts` não existe, a interface escrita à mão `OnboardProfileReport` foi trocada pelo tipo gerado, e nenhuma cópia de `declaredLength` sobra.
- **Comportamento idêntico.** Mesmas entradas decodificadas nos mesmos ids e ações, mesmos bytes crus, mesma montagem do dump (marcador reinicia a memória, entrada antes de marcador é ignorada, memórias ordenadas pelo índice), mesma leitura da memória como configuração. A régua são os vetores da Task 1, capturados do TypeScript atual.
- **Escopo:** `reportedMappings`, `preservedEvents`, `isShowPower` (driver) e `useDeviceReports` ficam em TypeScript. Puxá-los é antecipar o passo 5.
- **Nenhuma chamada à ponte no escopo de módulo.**
- **Estrutura nova que atravessa a ponte:** `Serialize`/`Deserialize` no núcleo, `#[cfg_attr(test, derive(ts_rs::TS))]`, entrada em `packages/core/src/bindings.rs`, e na ponte `to_js`/`from_js`.
- **Vetor novo** vai em `packages/core/vectors/rawm-protocol.json`, lido por `cargo test` **e** `vitest`, cada seção protegida contra vazio dos dois lados.
- **Tipos gerados** em `packages/shared/src/generated/`, nunca editados à mão; regenerar com `UPDATE_BINDINGS=1 cargo test -p gearhub-core generated`.
- **Sem strings de interface no núcleo.**
- **Nunca commitar `packages/core-wasm/pkg`.** `pnpm format` antes de cada commit. **Sem atribuição de IA em commits.**
- **Gate final:** `pnpm verify`, **e confirmação em hardware** antes do merge.

## Notas de ambiente

1. **`pnpm core:build` antes de `pnpm --filter @gearhub/web exec vitest run …`** depois de mudar Rust.
2. **Toolchain GNU no Windows:** `winapi-util` fica em 0.1.9 no `Cargo.lock`. Se um `cargo add` o subir, `cargo update -p winapi-util --precise 0.1.9`.
3. **`serde-wasm-bindgen`:** a ponte usa sempre `Serializer::json_compatible()` (helper `to_js`). Com `#[serde(with = "serde_bytes")]`, `Vec<u8>` vira `Uint8Array` na ida e é lido de `Uint8Array` na volta. A Task 4 prova isso com um teste — se não valer, **pare e reporte**. (Corrigido na execução: o `json_compatible()` força bytes como array; a ponte usa `serialize_bytes_as_arrays(false)` — ver Decisão 5 no spec.)
4. **Caminho por `process.cwd()`, nunca `import.meta.url`**, nos testes do Vitest.

---

## Estrutura de arquivos

**Criados:** `packages/core/src/protocols/rawm/onboard.rs`, `packages/core/src/drivers/leviathan_v4/slot_settings.rs`, e os gerados `packages/shared/src/generated/{OnboardBinding,OnboardSlotConfig}.ts`.

**Modificados:** `rawm-protocol.json`, `packages/core/tests/vectors.rs`, `apps/web/src/test/vectors.ts`, `apps/web/src/hardware/rawm/vectors.test.ts`, `packages/core/Cargo.toml`, `Cargo.lock`, `packages/core/src/protocols/rawm/mod.rs`, `packages/core/src/drivers/leviathan_v4/mod.rs`, `packages/core/src/bindings.rs`, `packages/core-wasm/src/lib.rs`, `apps/web/src/core/coreBridge.ts` (+ teste), `packages/shared/src/index.ts`, `apps/web/src/hardware/deviceDriver.ts`, `apps/web/src/hardware/rawm/LeviathanV4Driver.ts`, `apps/web/src/app/useDeviceReports.ts`, os dois testes de `onboardConfig` (renomeados), spec, `CLAUDE.md`, `docs/smoke-test-leviathan-v4.md`.

**Apagado:** `apps/web/src/hardware/rawm/onboardConfig.ts`.

---

### Task 1: Vetores do dump, capturados do TypeScript atual

**Files:**

- Modify: `packages/core/vectors/rawm-protocol.json`
- Modify: `apps/web/src/test/vectors.ts`
- Modify: `apps/web/src/hardware/rawm/vectors.test.ts`

**Interfaces:**

- Produces: seções `onboardEntry: {name, entry, expected: {keyIds: number[], action: MouseActionId | null} | null}[]` e `onboardDump: {name, payloads: string[], expected: {index, bindings: {keyIds, action, raw}[]}[] | null}[]` (hex minúsculo). Em `onboardEntry`, os bytes crus de uma entrada decodificada são sempre iguais a `entry`. Em `onboardDump`, `expected` é o retorno do **último** `push`; todos os `push` anteriores devolvem `null`.

- [ ] **Step 1: Seções no JSON**

Em `packages/core/vectors/rawm-protocol.json`, depois de `"invalidSnapshot": [...]`, acrescente (mantenha `"version": 1`):

```json
  "onboardEntry": [
    {"name": "clique esquerdo", "entry": "030a16010a0001010000", "expected": {"keyIds": [10], "action": "clique-esquerdo"}},
    {"name": "rolagem para cima", "entry": "030a16010c0003070000", "expected": {"keyIds": [12], "action": "rolagem-cima"}},
    {"name": "ciclo de DPI, uma função", "entry": "030c18011002010000000000", "expected": {"keyIds": [16], "action": "dpi-ciclo"}},
    {"name": "camada R-Plus, ativador primeiro", "entry": "030d1802100c02020000000000", "expected": {"keyIds": [16, 12], "action": "dpi-aumentar"}},
    {"name": "macro que o app não nomeia", "entry": "030805010e000102", "expected": {"keyIds": [14], "action": null}},
    {"name": "tecla com modificador não é ação do app", "entry": "030a16010a0201010000", "expected": {"keyIds": [10], "action": null}},
    {"name": "sétima tecla, show power, sem ação no app", "entry": "030c18010d020e0000000000", "expected": {"keyIds": [13], "action": null}},
    {"name": "três ids de tecla: guardada sem ids nem ação", "entry": "030c16030a0b0c0001010000", "expected": {"keyIds": [], "action": null}},
    {"name": "contagem de ids que passa do fim: guardada sem ids nem ação", "entry": "030516020a", "expected": {"keyIds": [], "action": null}},
    {"name": "não é evento de configuração", "entry": "0b0214", "expected": null},
    {"name": "mais curta que o comprimento declarado", "entry": "030c16010a0001010000", "expected": null},
    {"name": "curta demais para cabeçalho", "entry": "030416", "expected": null}
  ],
  "onboardDump": [
    {"name": "uma memória, uma entrada", "payloads": ["00", "030a16010a0001010000", "ff"], "expected": [{"index": 0, "bindings": [{"keyIds": [10], "action": "clique-esquerdo", "raw": "030a16010a0001010000"}]}]},
    {"name": "duas memórias, ordenadas pelo índice", "payloads": ["02", "030a16010b0001030000", "00", "030a16010a0001010000", "030805010e000102", "ff"], "expected": [{"index": 0, "bindings": [{"keyIds": [10], "action": "clique-esquerdo", "raw": "030a16010a0001010000"}, {"keyIds": [14], "action": null, "raw": "030805010e000102"}]}, {"index": 2, "bindings": [{"keyIds": [11], "action": "clique-central", "raw": "030a16010b0001030000"}]}]},
    {"name": "uma memória emitida de novo substitui a anterior", "payloads": ["01", "030a16010a0001010000", "01", "030a16010b0001020000", "ff"], "expected": [{"index": 1, "bindings": [{"keyIds": [11], "action": "clique-direito", "raw": "030a16010b0001020000"}]}]},
    {"name": "entrada antes de qualquer marcador é ignorada", "payloads": ["030a16010a0001010000", "ff"], "expected": []},
    {"name": "entrada que não é evento de configuração é descartada", "payloads": ["00", "0b0214", "030a16010a0001010000", "ff"], "expected": [{"index": 0, "bindings": [{"keyIds": [10], "action": "clique-esquerdo", "raw": "030a16010a0001010000"}]}]},
    {"name": "sem terminador não há resultado", "payloads": ["00", "030a16010a0001010000"], "expected": null}
  ]
```

Todos os `expected` foram **produzidos rodando o TypeScript atual** (`decodeOnboardEntry` e `OnboardConfigCollector` de `onboardConfig.ts`). Se o Step 4 reprovar algum, o vetor está errado: corrija para o que o TS atual produz e registre no relatório.

- [ ] **Step 2: Leitor TS**

Em `apps/web/src/test/vectors.ts`, os tipos:

```ts
interface OnboardEntryVector {
  name: string;
  entry: string;
  /** Null quando os bytes não são um evento de configuração. */
  expected: { keyIds: number[]; action: MouseActionId | null } | null;
}

interface OnboardDumpVector {
  name: string;
  payloads: string[];
  /** O retorno do último `push`; null quando o dump não terminou. */
  expected:
    | {
        index: number;
        bindings: { keyIds: number[]; action: MouseActionId | null; raw: string }[];
      }[]
    | null;
}
```

e os campos `onboardEntry: OnboardEntryVector[];` e `onboardDump: OnboardDumpVector[];` em `ProtocolVectors`.

- [ ] **Step 3: Testes contra a implementação atual**

Em `apps/web/src/hardware/rawm/vectors.test.ts`: importe `{ OnboardConfigCollector, decodeOnboardEntry } from './onboardConfig'`; no teste `'tem vetores de todas as seções'` acrescente `requireNonEmpty(vectors.onboardEntry, 'onboardEntry');` e `requireNonEmpty(vectors.onboardDump, 'onboardDump');`; e, no mesmo `describe`:

```ts
it.each(vectors.onboardEntry)('entrada onboard: $name', ({ entry, expected }) => {
  const decoded = decodeOnboardEntry(fromHex(entry));
  if (expected === null) {
    expect(decoded).toBeNull();
    return;
  }
  expect(decoded).not.toBeNull();
  expect({ keyIds: decoded!.keyIds, action: decoded!.action }).toEqual(expected);
  expect(toHex(decoded!.raw)).toBe(entry);
});

it.each(vectors.onboardDump)('dump onboard: $name', ({ payloads, expected }) => {
  const collector = new OnboardConfigCollector();
  const results = payloads.map((payload) => collector.push(fromHex(payload)));
  expect(results.slice(0, -1).every((result) => result === null)).toBe(true);
  const last = results.at(-1) ?? null;
  const shaped =
    last === null
      ? null
      : last.map((slot) => ({
          index: slot.index,
          bindings: slot.bindings.map((binding) => ({
            keyIds: binding.keyIds,
            action: binding.action,
            raw: toHex(binding.raw),
          })),
        }));
  expect(shaped).toEqual(expected);
});
```

- [ ] **Step 4: Rodar**

Run: `pnpm core:build && pnpm --filter @gearhub/web exec vitest run src/hardware/rawm/vectors.test.ts`
Expected: PASS, com 12 casos de entrada e 6 de dump.

Run: `cargo test -p gearhub-core --test vectors`
Expected: PASS (o Rust ainda ignora as seções novas).

- [ ] **Step 5: Commit**

```bash
pnpm format
git add packages/core/vectors/rawm-protocol.json apps/web/src/test/vectors.ts apps/web/src/hardware/rawm/vectors.test.ts
git commit -m "test: fixar em vetores o dump onboard que o mouse ja confirmou"
```

---

### Task 2: O dump no núcleo

**Files:**

- Create: `packages/core/src/protocols/rawm/onboard.rs`
- Modify: `packages/core/src/protocols/rawm/mod.rs`
- Modify: `packages/core/Cargo.toml`, `Cargo.lock`
- Modify: `packages/core/src/bindings.rs`
- Create (gerados): `packages/shared/src/generated/{OnboardBinding,OnboardSlotConfig}.ts`
- Modify: `packages/core/tests/vectors.rs`

**Interfaces:**

- Consumes: `super::envelope::event_length` (`pub(crate)`), `super::actions::{action_for_key, action_for_function}`, `crate::device::MouseActionId`.
- Produces (`gearhub_core::protocols::rawm`): `OnboardBinding { key_ids: Vec<u8>, action: Option<MouseActionId>, raw: Vec<u8> }` e `OnboardSlotConfig { index: u8, bindings: Vec<OnboardBinding> }` (`Serialize + Deserialize + Debug + Clone + PartialEq + Eq`, camelCase, `raw` via `serde_bytes`); `decode_onboard_entry(entry: &[u8]) -> Option<OnboardBinding>`; `OnboardConfigCollector` com `new()` / `Default` e `push(&mut self, payload: &[u8]) -> Option<Vec<OnboardSlotConfig>>`.

- [ ] **Step 1: Testes de vetor (falham por não compilar)**

Em `packages/core/tests/vectors.rs`: acrescente ao `use` de `gearhub_core::protocols::rawm` os nomes `OnboardConfigCollector, decode_onboard_entry`; as structs

```rust
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExpectedBinding {
    key_ids: Vec<u8>,
    action: Option<String>,
}

#[derive(Deserialize)]
struct OnboardEntryVector {
    name: String,
    entry: String,
    expected: Option<ExpectedBinding>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExpectedDumpBinding {
    key_ids: Vec<u8>,
    action: Option<String>,
    raw: String,
}

#[derive(Deserialize)]
struct ExpectedSlot {
    index: u8,
    bindings: Vec<ExpectedDumpBinding>,
}

#[derive(Deserialize)]
struct OnboardDumpVector {
    name: String,
    payloads: Vec<String>,
    expected: Option<Vec<ExpectedSlot>>,
}
```

os campos `onboard_entry: Vec<OnboardEntryVector>,` e `onboard_dump: Vec<OnboardDumpVector>,` em `Vectors`, e:

```rust
#[test]
fn onboard_entries_match_the_shared_vectors() {
    let vectors = vectors();
    require_non_empty(&vectors.onboard_entry, "onboardEntry");
    for vector in &vectors.onboard_entry {
        let decoded = decode_onboard_entry(&from_hex(&vector.entry));
        match (&vector.expected, decoded) {
            (None, None) => {}
            (Some(expected), Some(binding)) => {
                assert_eq!(binding.key_ids, expected.key_ids, "{}", vector.name);
                assert_eq!(
                    binding.action.map(|action| action.as_str()),
                    expected.action.as_deref(),
                    "{}",
                    vector.name
                );
                assert_eq!(to_hex(&binding.raw), vector.entry, "{}: bytes crus", vector.name);
            }
            (expected, decoded) => panic!(
                "{}: esperava {:?}, veio {decoded:?}",
                vector.name,
                expected.is_some()
            ),
        }
    }
}

#[test]
fn onboard_dumps_match_the_shared_vectors() {
    let vectors = vectors();
    require_non_empty(&vectors.onboard_dump, "onboardDump");
    for vector in &vectors.onboard_dump {
        let mut collector = OnboardConfigCollector::new();
        let (last, earlier) = vector.payloads.split_last().expect("payloads");
        for payload in earlier {
            assert_eq!(collector.push(&from_hex(payload)), None, "{}: antes do fim", vector.name);
        }
        let result = collector.push(&from_hex(last));
        let shaped: Option<Vec<(u8, Vec<(Vec<u8>, Option<&str>, String)>)>> = result
            .as_ref()
            .map(|slots| {
                slots
                    .iter()
                    .map(|slot| {
                        let bindings = slot
                            .bindings
                            .iter()
                            .map(|b| (b.key_ids.clone(), b.action.map(|a| a.as_str()), to_hex(&b.raw)))
                            .collect();
                        (slot.index, bindings)
                    })
                    .collect()
            });
        let expected: Option<Vec<(u8, Vec<(Vec<u8>, Option<&str>, String)>)>> =
            vector.expected.as_ref().map(|slots| {
                slots
                    .iter()
                    .map(|slot| {
                        let bindings = slot
                            .bindings
                            .iter()
                            .map(|b| (b.key_ids.clone(), b.action.as_deref(), b.raw.clone()))
                            .collect();
                        (slot.index, bindings)
                    })
                    .collect()
            });
        assert_eq!(shaped, expected, "{}", vector.name);
    }
}
```

Run: `cargo test -p gearhub-core --test vectors`
Expected: FAIL de compilação.

- [ ] **Step 2: Dependência**

Em `packages/core/Cargo.toml`, `[dependencies]`: `serde_bytes = "0.11"`. Depois: `cargo update -p winapi-util --precise 0.1.9` se o lock tiver subido (confira com `grep -A1 'name = "winapi-util"' Cargo.lock`).

- [ ] **Step 3: `onboard.rs`**

```rust
//! O dump de configuração onboard (`NOTIFY_TYPE_MOUSE_CONFIG`, 0x14).
//!
//! Depois de responder à consulta, o mouse transmite sem pedido os
//! mapeamentos que cada memória onboard guarda. O fluxo é delimitado: um
//! payload de um byte que não é 0xff abre uma memória e descarta o que havia
//! para ela; payloads maiores são as entradas; 0xff termina o dump. Cada
//! entrada tem o mesmo layout que o escritor usa, então o comprimento é o
//! mesmo campo de 12 bits que `event_length` lê.

use serde::{Deserialize, Serialize};

use super::actions::{action_for_function, action_for_key};
use super::envelope::event_length;
use crate::device::MouseActionId;

const CMD_CONFIG: u8 = 0x03;
const CONFIG_TYPE_MOUSE_KEY: u8 = 0x16;
const CONFIG_TYPE_MOUSE_FUNCTION: u8 = 0x18;
const END_OF_DUMP: u8 = 0xff;
/// O fabricante recusa uma entrada com mais que uma camada R-Plus de duas teclas.
const MAX_KEY_IDS: usize = 2;

/// Uma entrada de uma memória, como o mouse a relatou.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct OnboardBinding {
    /// One id, or two for an R-Plus layer with the activator first.
    pub key_ids: Vec<u8>,
    /// Null when no MouseActionId describes these bytes.
    pub action: Option<MouseActionId>,
    /// The entry as the mouse reported it. Macros, keyboard keys and shell
    /// commands have no action in this app, and rebuilding a slot from actions
    /// alone would erase them from flash, so the bytes are kept to be resent.
    #[serde(with = "serde_bytes")]
    #[cfg_attr(test, ts(type = "Uint8Array"))]
    pub raw: Vec<u8>,
}

/// Uma memória onboard e o que ela guarda.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct OnboardSlotConfig {
    pub index: u8,
    pub bindings: Vec<OnboardBinding>,
}

fn named_action(config_type: u8, payload: &[u8]) -> Option<MouseActionId> {
    match config_type {
        // [mod1, key_type, key_code, mod2]; um modificador não tem ação própria.
        CONFIG_TYPE_MOUSE_KEY if payload.len() >= 3 => {
            if payload[0] == 0 { action_for_key(payload[1], payload[2]) } else { None }
        }
        // [touch_type, function, value_lo, value_hi]
        CONFIG_TYPE_MOUSE_FUNCTION if payload.len() >= 2 => action_for_function(payload[1]),
        _ => None,
    }
}

/// Decodifica uma entrada. `None` só para bytes que não são um evento de
/// configuração; uma entrada que o app não sabe nomear volta com `action`
/// vazia e `raw` intacto.
pub fn decode_onboard_entry(entry: &[u8]) -> Option<OnboardBinding> {
    if entry.len() < 4 || entry[0] & 0x0f != CMD_CONFIG || entry.len() < event_length(entry) {
        return None;
    }
    let count = usize::from(entry[3]);
    if count > MAX_KEY_IDS || 4 + count > entry.len() {
        return Some(OnboardBinding { key_ids: Vec::new(), action: None, raw: entry.to_vec() });
    }
    Some(OnboardBinding {
        key_ids: entry[4..4 + count].to_vec(),
        action: named_action(entry[2], &entry[4 + count..]),
        raw: entry.to_vec(),
    })
}

/// Monta o dump delimitado. Recebe cada payload 0x14; devolve as memórias
/// quando o terminador chega, e `None` até lá.
#[derive(Debug, Default)]
pub struct OnboardConfigCollector {
    slots: std::collections::BTreeMap<u8, Vec<OnboardBinding>>,
    current: Option<u8>,
}

impl OnboardConfigCollector {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn push(&mut self, payload: &[u8]) -> Option<Vec<OnboardSlotConfig>> {
        match *payload {
            [] => None,
            [END_OF_DUMP] => Some(self.finish()),
            [index] => {
                // O marcador reinicia a memória: um novo dump substitui, nunca acumula.
                self.current = Some(index);
                self.slots.insert(index, Vec::new());
                None
            }
            _ => {
                let current = self.current?;
                if let Some(binding) = decode_onboard_entry(payload) {
                    self.slots.entry(current).or_default().push(binding);
                }
                None
            }
        }
    }

    fn finish(&mut self) -> Vec<OnboardSlotConfig> {
        self.current = None;
        std::mem::take(&mut self.slots)
            .into_iter()
            .map(|(index, bindings)| OnboardSlotConfig { index, bindings })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocols::rawm::{encode_mapping, with_protocol_envelope};

    fn entry(key_ids: &[u8], action: MouseActionId) -> Vec<u8> {
        with_protocol_envelope(&encode_mapping(key_ids, action).unwrap(), false).unwrap()
    }

    #[test]
    fn reads_every_written_action_back_as_itself() {
        for action in MouseActionId::ALL {
            let Some(inner) = encode_mapping(&[0x0a], action) else { continue };
            let bytes = with_protocol_envelope(&inner, false).unwrap();
            let decoded = decode_onboard_entry(&bytes).unwrap();
            assert_eq!(decoded.action, Some(action), "{}", action.as_str());
            assert_eq!(decoded.raw, bytes);
        }
    }

    #[test]
    fn reads_an_r_plus_layer_activator_first() {
        let decoded = decode_onboard_entry(&entry(&[0x10, 0x0c], MouseActionId::DpiCiclo)).unwrap();
        assert_eq!(decoded.key_ids, [0x10, 0x0c]);
    }

    #[test]
    fn a_marker_clears_what_was_held_for_that_slot() {
        let mut collector = OnboardConfigCollector::new();
        collector.push(&[1]);
        collector.push(&entry(&[0x0a], MouseActionId::CliqueEsquerdo));
        collector.push(&[1]);
        collector.push(&entry(&[0x0b], MouseActionId::CliqueDireito));
        let slots = collector.push(&[END_OF_DUMP]).unwrap();
        assert_eq!(slots.len(), 1);
        assert_eq!(slots[0].bindings.len(), 1);
        assert_eq!(slots[0].bindings[0].action, Some(MouseActionId::CliqueDireito));
    }

    #[test]
    fn finishing_resets_the_collector_for_the_next_dump() {
        let mut collector = OnboardConfigCollector::new();
        collector.push(&[0]);
        collector.push(&entry(&[0x0a], MouseActionId::CliqueEsquerdo));
        assert_eq!(collector.push(&[END_OF_DUMP]).unwrap().len(), 1);
        collector.push(&entry(&[0x0a], MouseActionId::CliqueEsquerdo));
        assert_eq!(collector.push(&[END_OF_DUMP]), Some(Vec::new()));
    }

    #[test]
    fn serde_keeps_raw_as_bytes_and_camel_case() {
        let binding = decode_onboard_entry(&entry(&[0x0a], MouseActionId::CliqueEsquerdo)).unwrap();
        let json = serde_json::to_value(&binding).unwrap();
        assert_eq!(json["keyIds"], serde_json::json!([10]));
        assert_eq!(json["action"], "clique-esquerdo");
        let back: OnboardBinding = serde_json::from_value(json).unwrap();
        assert_eq!(back, binding);
    }
}
```

Em `protocols/rawm/mod.rs`: `mod onboard;` e `pub use onboard::{OnboardBinding, OnboardConfigCollector, OnboardSlotConfig, decode_onboard_entry};`.

- [ ] **Step 4: Tipos gerados**

Em `bindings.rs`, `use crate::protocols::rawm::{OnboardBinding, OnboardSlotConfig};` (junto do `MouseParamSnapshot`) e as entradas `("OnboardBinding", render::<OnboardBinding>())` e `("OnboardSlotConfig", render::<OnboardSlotConfig>())`.

Run: `UPDATE_BINDINGS=1 cargo test -p gearhub-core generated && cargo test -p gearhub-core && cargo clippy --workspace --all-targets -- -D warnings`
Expected: PASS, sem avisos. `OnboardBinding.ts` declara `raw: Uint8Array` e importa `./MouseActionId`.

- [ ] **Step 5: Commit**

```bash
pnpm format
git add packages/core/Cargo.toml Cargo.lock packages/core/src packages/core/tests/vectors.rs packages/shared/src/generated
git commit -m "feat: dump onboard no nucleo"
```

---

### Task 3: A memória lida como configuração do editor

**Files:**

- Create: `packages/core/src/drivers/leviathan_v4/slot_settings.rs`
- Modify: `packages/core/src/drivers/leviathan_v4/mod.rs`

**Interfaces:**

- Consumes: `OnboardSlotConfig`/`OnboardBinding` (Task 2); `MouseSettings`, `MouseActionId`; `super::keys::button_id` (via `pub use` já existente: `button_id(key_id: u8) -> Option<&'static str>`); `describe` (para a base dos testes).
- Produces (`gearhub_core::drivers::leviathan_v4`): `settings_from_slot(base: &MouseSettings, slot: &OnboardSlotConfig) -> MouseSettings`.

A referência de comportamento é `settingsFromSlot` em `apps/web/src/hardware/rawm/onboardConfig.ts`: todos os botões (e os da camada R-Plus, se houver) começam `desativado`; uma entrada nomeada de uma tecla atribui a ação ao botão daquela tecla, se o botão existir na base; uma de duas teclas define ativador e alvo da camada R-Plus, se a base tiver camada e o alvo existir nela; **depois**, uma entrada sem nome de uma tecla devolve ao botão o valor da base. DPI, polling e parâmetros ficam como na base.

- [ ] **Step 1: `slot_settings.rs`**

```rust
//! Uma memória onboard lida como configuração do editor.
//!
//! Uma tecla que o dump não menciona não guarda nada, e por isso volta como
//! desativada — é a diferença entre mostrar o mouse e mostrar a suposição do
//! app. Entradas que o app não sabe nomear ficam como estavam: o driver
//! reenvia os bytes delas, e sobrescrever o botão com um palpite seria o mesmo
//! erro na direção contrária. DPI, polling e parâmetros não vêm no dump; só a
//! memória ativa os relata, pela consulta, então ficam como na base.

use super::keys::button_id;
use crate::device::{MouseActionId, MouseSettings};
use crate::protocols::rawm::OnboardSlotConfig;

pub fn settings_from_slot(base: &MouseSettings, slot: &OnboardSlotConfig) -> MouseSettings {
    let mut buttons = base.buttons.clone();
    buttons.values_mut().for_each(|action| *action = MouseActionId::Desativado);
    let mut r_plus = base.r_plus.clone();
    if let Some(layer) = r_plus.as_mut() {
        layer.buttons.values_mut().for_each(|action| *action = MouseActionId::Desativado);
    }

    for binding in &slot.bindings {
        let Some(action) = binding.action else { continue };
        match *binding.key_ids.as_slice() {
            [key] => {
                if let Some(assigned) = button_id(key).and_then(|id| buttons.get_mut(id)) {
                    *assigned = action;
                }
            }
            [activator, target] => {
                let (Some(layer), Some(activator), Some(target)) =
                    (r_plus.as_mut(), button_id(activator), button_id(target))
                else {
                    continue;
                };
                if let Some(assigned) = layer.buttons.get_mut(target) {
                    layer.activator_button_id = activator.to_owned();
                    *assigned = action;
                }
            }
            _ => {}
        }
    }

    // Uma tecla que o app não nomeia ainda guarda algo; deixá-la desativada
    // diria que o botão está livre quando não está.
    for binding in &slot.bindings {
        if binding.action.is_some() {
            continue;
        }
        let [key] = *binding.key_ids.as_slice() else { continue };
        let Some(id) = button_id(key) else { continue };
        if let (Some(assigned), Some(&original)) = (buttons.get_mut(id), base.buttons.get(id)) {
            *assigned = original;
        }
    }

    MouseSettings { buttons, r_plus, ..base.clone() }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::drivers::leviathan_v4::describe;
    use crate::protocols::rawm::{OnboardBinding, decode_onboard_entry, encode_mapping, with_protocol_envelope};

    fn base() -> MouseSettings {
        let vectors: serde_json::Value =
            serde_json::from_str(include_str!("../../../vectors/rawm-protocol.json")).unwrap();
        describe(&vectors["queries"]["leviathan-v4-captura"]).unwrap().defaults
    }

    fn binding(key_ids: &[u8], action: MouseActionId) -> OnboardBinding {
        let bytes = with_protocol_envelope(&encode_mapping(key_ids, action).unwrap(), false).unwrap();
        decode_onboard_entry(&bytes).unwrap()
    }

    fn slot(bindings: Vec<OnboardBinding>) -> OnboardSlotConfig {
        OnboardSlotConfig { index: 0, bindings }
    }

    #[test]
    fn takes_the_action_the_mouse_reports_for_a_key() {
        let settings = settings_from_slot(&base(), &slot(vec![binding(&[0x0b], MouseActionId::CliqueCentral)]));
        assert_eq!(settings.buttons["direito"], MouseActionId::CliqueCentral);
    }

    #[test]
    fn reads_a_key_the_dump_never_mentions_as_disabled() {
        let base = base();
        assert_eq!(base.buttons["esquerdo"], MouseActionId::CliqueEsquerdo);
        let settings = settings_from_slot(&base, &slot(vec![binding(&[0x0b], MouseActionId::CliqueDireito)]));
        assert_eq!(settings.buttons["esquerdo"], MouseActionId::Desativado);
    }

    #[test]
    fn reads_an_r_plus_layer_as_its_activator_and_target() {
        let settings =
            settings_from_slot(&base(), &slot(vec![binding(&[0x10, 0x0c], MouseActionId::DpiAumentar)]));
        let layer = settings.r_plus.unwrap();
        assert_eq!(layer.activator_button_id, "dpi");
        assert_eq!(layer.buttons["central"], MouseActionId::DpiAumentar);
    }

    #[test]
    fn leaves_a_button_whose_binding_it_cannot_name() {
        let macro_bytes = with_protocol_envelope(&[0x03, 0x00, 0x05, 0x01, 0x0a, 0x00, 0x01, 0x02], false).unwrap();
        let unnamed = decode_onboard_entry(&macro_bytes).unwrap();
        assert_eq!(unnamed.action, None);
        let base = base();
        let settings = settings_from_slot(&base, &slot(vec![unnamed]));
        assert_eq!(settings.buttons["esquerdo"], base.buttons["esquerdo"]);
    }

    #[test]
    fn keeps_dpi_polling_and_button_order() {
        let base = base();
        let settings = settings_from_slot(&base, &slot(vec![binding(&[0x0a], MouseActionId::CliqueEsquerdo)]));
        assert_eq!(settings.polling_rate, base.polling_rate);
        assert_eq!(settings.dpi_stages, base.dpi_stages);
        assert!(settings.buttons.keys().eq(base.buttons.keys()));
    }

    #[test]
    fn a_base_without_r_plus_stays_without_it() {
        let mut base = base();
        base.r_plus = None;
        let settings =
            settings_from_slot(&base, &slot(vec![binding(&[0x10, 0x0c], MouseActionId::DpiAumentar)]));
        assert_eq!(settings.r_plus, None);
    }
}
```

No `mod.rs` do Leviathan: `mod slot_settings;` e `pub use slot_settings::settings_from_slot;`.

- [ ] **Step 2: Rodar**

Run: `cargo test -p gearhub-core && cargo clippy --workspace --all-targets -- -D warnings`
Expected: PASS, sem avisos (reflua com `cargo fmt`).

- [ ] **Step 3: Commit**

```bash
pnpm format
git add packages/core/src
git commit -m "feat: ler uma memoria onboard como configuracao no nucleo"
```

---

### Task 4: A ponte e o `coreBridge`

**Files:**

- Modify: `packages/core-wasm/src/lib.rs`
- Modify: `apps/web/src/core/coreBridge.ts`, `coreBridge.test.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/web/src/hardware/rawm/vectors.test.ts`

**Interfaces:**

- Produces (`coreBridge.ts`): `class OnboardConfigCollector { push(payload: Uint8Array): OnboardSlotConfig[] | null }`; `decodeOnboardEntry(entry: Uint8Array): OnboardBinding | null`; `settingsFromSlot(base: MouseSettings, slot: OnboardSlotConfig): MouseSettings`.
- Produces: `@gearhub/shared` exporta `OnboardBinding` e `OnboardSlotConfig`.

- [ ] **Step 1: Testes que falham**

Em `apps/web/src/core/coreBridge.test.ts`, importe `OnboardConfigCollector, decodeOnboardEntry, settingsFromSlot` e acrescente:

```ts
describe('dump onboard através da ponte', () => {
  const entry = () => withProtocolEnvelope(encodeMapping([0x0a], 'clique-esquerdo')!, false);

  it('devolve os bytes crus como Uint8Array, nos dois sentidos', () => {
    const binding = decodeOnboardEntry(entry());
    expect(binding?.raw).toBeInstanceOf(Uint8Array);
    expect([...binding!.raw]).toEqual([...entry()]);

    const collector = new OnboardConfigCollector();
    collector.push(Uint8Array.from([0]));
    collector.push(entry());
    const slots = collector.push(Uint8Array.from([0xff]));
    expect(slots?.[0].bindings[0].raw).toBeInstanceOf(Uint8Array);

    const { defaults } = describeLeviathanV4(leviathanV4QueryFixture);
    // A volta: o slot sai da ponte e entra de novo, com o raw como Uint8Array.
    expect(settingsFromSlot(defaults, slots![0]).buttons.esquerdo).toBe('clique-esquerdo');
  });

  it('devolve null, não undefined, para o que não é evento e para o dump sem fim', () => {
    expect(decodeOnboardEntry(Uint8Array.from([0x0b, 0x02, 0x14]))).toBeNull();
    expect(new OnboardConfigCollector().push(Uint8Array.from([0]))).toBeNull();
  });
});
```

Run: `pnpm --filter @gearhub/web exec vitest run src/core/coreBridge.test.ts`
Expected: FAIL — os nomes não existem.

- [ ] **Step 2: A ponte**

Em `packages/core-wasm/src/lib.rs`, seguindo o `RawEventAssembler`:

```rust
#[wasm_bindgen(js_name = OnboardConfigCollector)]
pub struct WasmOnboardConfigCollector {
    inner: rawm::OnboardConfigCollector,
}

#[wasm_bindgen(js_class = OnboardConfigCollector)]
impl WasmOnboardConfigCollector {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self { inner: rawm::OnboardConfigCollector::new() }
    }

    /// As memórias quando o terminador chega; `null` até lá.
    pub fn push(&mut self, payload: &[u8]) -> Result<JsValue, JsError> {
        to_js(&self.inner.push(payload))
    }
}

#[wasm_bindgen(js_name = decodeOnboardEntry)]
pub fn decode_onboard_entry(entry: &[u8]) -> Result<JsValue, JsError> {
    to_js(&rawm::decode_onboard_entry(entry))
}

#[wasm_bindgen(js_name = settingsFromSlot)]
pub fn settings_from_slot(base: JsValue, slot: JsValue) -> Result<JsValue, JsError> {
    let base: MouseSettings = from_js(base)?;
    let slot: rawm::OnboardSlotConfig = from_js(slot)?;
    to_js(&leviathan_v4::settings_from_slot(&base, &slot))
}
```

Se o clippy pedir `Default` para `WasmOnboardConfigCollector`, faça como o `WasmRawEventAssembler` já faz (confira no arquivo).

- [ ] **Step 3: `coreBridge.ts` e `@gearhub/shared`**

Em `packages/shared/src/index.ts`: `export type { OnboardBinding } from './generated/OnboardBinding';` e `export type { OnboardSlotConfig } from './generated/OnboardSlotConfig';`.

Em `coreBridge.ts`, importe `OnboardConfigCollector as WasmOnboardConfigCollector`, `decodeOnboardEntry as wasmDecodeOnboardEntry`, `settingsFromSlot as wasmSettingsFromSlot` e os tipos `OnboardBinding, OnboardSlotConfig` de `'@gearhub/shared'`, e acrescente, depois do `RawEventAssembler`:

```ts
/**
 * Monta o dump onboard delimitado. Recebe cada payload 0x14 e devolve as
 * memórias quando o terminador chega, `null` até lá. O estado mora no núcleo;
 * este invólucro existe para a forma e para o tipo.
 */
export class OnboardConfigCollector {
  private readonly inner = new WasmOnboardConfigCollector();

  push(payload: Uint8Array): OnboardSlotConfig[] | null {
    return (this.inner.push(payload) as OnboardSlotConfig[] | null) ?? null;
  }
}

/** Uma entrada do dump; `null` para bytes que não são evento de configuração. */
export function decodeOnboardEntry(entry: Uint8Array): OnboardBinding | null {
  return (wasmDecodeOnboardEntry(entry) as OnboardBinding | null) ?? null;
}

/** O que uma memória onboard realmente guarda, aplicado sobre a configuração base. */
export function settingsFromSlot(base: MouseSettings, slot: OnboardSlotConfig): MouseSettings {
  try {
    return wasmSettingsFromSlot(base, slot) as MouseSettings;
  } catch (error) {
    throw asRawmError(error);
  }
}
```

- [ ] **Step 4: Os vetores conferem as duas implementações**

Em `vectors.test.ts`, importe `OnboardConfigCollector as CoreOnboardConfigCollector` e `decodeOnboardEntry as coreDecodeOnboardEntry` do `'../../core/coreBridge'` e, nos dois `it.each` da Task 1, repita as asserções também com as versões do núcleo (a mesma lógica, trocando o decodificador e o montador). Extraia a lógica de cada `it.each` para uma função local parametrizada pelo decodificador/montador para não duplicar o corpo.

- [ ] **Step 5: Rodar**

Run: `cargo test --workspace && cargo clippy --workspace --all-targets -- -D warnings && pnpm core:build && pnpm --filter @gearhub/web exec vitest run src/core src/hardware/rawm/vectors.test.ts`
Expected: PASS. Se o teste de `Uint8Array` reprovar (o `serde_bytes` não produziu `Uint8Array` na ida, ou não leu na volta), **pare e reporte** — não converta na casca sem avisar.

- [ ] **Step 6: Commit**

```bash
pnpm format
git add packages/core-wasm apps/web/src/core apps/web/src/hardware/rawm/vectors.test.ts packages/shared/src/index.ts
git commit -m "feat: expor o dump onboard pela ponte"
```

---

### Task 5: A casca passa a usar o núcleo, e `onboardConfig.ts` é apagado

**Files:**

- Delete: `apps/web/src/hardware/rawm/onboardConfig.ts`
- Modify: `apps/web/src/hardware/rawm/LeviathanV4Driver.ts`, `apps/web/src/app/useDeviceReports.ts`, `apps/web/src/hardware/deviceDriver.ts`
- Rename + modify: `onboardConfig.test.ts` → `onboardDump.test.ts`; `onboardConfig.settings.test.ts` → `slotSettings.test.ts`
- Modify: `apps/web/src/hardware/rawm/vectors.test.ts`

- [ ] **Step 1: Reapontar**

- `LeviathanV4Driver.ts`: `import { OnboardConfigCollector, type OnboardSlotConfig } from './onboardConfig';` sai; `OnboardConfigCollector` vem do `coreBridge` e `OnboardSlotConfig` de `'@gearhub/shared'` (import de tipo). Nada mais muda no driver.
- `useDeviceReports.ts`: `settingsFromSlot` vem do `'../core/coreBridge'`.
- `deviceDriver.ts`: troque a interface escrita à mão por

```ts
/** One onboard slot as the device reports it. Generated from the core. */
export type { OnboardSlotConfig as OnboardProfileReport } from '@gearhub/shared';
```

(se o arquivo usar `OnboardProfileReport` internamente, use `import type { OnboardSlotConfig } …` + `export type OnboardProfileReport = OnboardSlotConfig;`). Se o `MouseActionId` deixar de ser usado no arquivo, remova o import.

- [ ] **Step 2: Testes**

```bash
git mv apps/web/src/hardware/rawm/onboardConfig.test.ts apps/web/src/hardware/rawm/onboardDump.test.ts
git mv apps/web/src/hardware/rawm/onboardConfig.settings.test.ts apps/web/src/hardware/rawm/slotSettings.test.ts
```

Nos dois, troque o import de `'./onboardConfig'` pelo `'../../core/coreBridge'` (`OnboardBinding` passa a vir de `'@gearhub/shared'` como tipo). As asserções não mudam. Em `vectors.test.ts`, remova a metade que conferia o TS (`./onboardConfig`) — ficam as do núcleo.

- [ ] **Step 3: Apagar e procurar restos**

```bash
git rm apps/web/src/hardware/rawm/onboardConfig.ts
```

Run: `grep -rn "onboardConfig'\|declaredLength\|END_OF_DUMP\|MAX_KEY_IDS\|interface OnboardProfileReport" apps/web/src`
Expected: nenhuma ocorrência.

- [ ] **Step 4: Rodar**

Run: `pnpm test && pnpm lint && pnpm run audit`
Expected: PASS; o knip não aponta export sem uso.

- [ ] **Step 5: Commit**

```bash
pnpm format
git add -A apps/web/src
git commit -m "refactor: apagar onboardConfig.ts e ler o dump do nucleo"
```

---

### Task 6: Documentos e roteiro de hardware

**Files:**

- Modify: `docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md`, `CLAUDE.md`, `docs/smoke-test-leviathan-v4.md`

- [ ] **Step 1: Spec** — na `## Ordem corrigida`, item 4, acrescente ao final (mantendo o reflow): `**Implementado em 2026-09-30** pelo plano \`docs/superpowers/plans/2026-09-30-migracao-dump-onboard.md\`, aguardando a confirmação em hardware do roteiro em \`docs/smoke-test-leviathan-v4.md\`: \`onboardConfig.ts\` foi apagado e a duplicata \`declaredLength\` fechou.`

- [ ] **Step 2: CLAUDE.md**
- **Estado real:** acrescente que o passo 4 levou o dump onboard (`packages/core/src/protocols/rawm/onboard.rs`, `settings_from_slot` em `drivers/leviathan_v4/`), e marque como pendente de confirmação em hardware do roteiro do passo 4.
- **Ainda em TypeScript:** a frase passa a citar só o passo 5 (a sessão de `LeviathanV4Driver.ts` e a decodificação de `session.ts`).
- **Duplicatas:** troque o parágrafo por "Não resta duplicata de protocolo declarada: `declaredLength` fechou no passo 4. Uma exceção futura deve ser declarada do mesmo jeito — nomeada no spec, com data para sair —, nunca inferida. Ver `docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md`."
- **Generated:** na lista entre parênteses dos tipos gerados, acrescente "as memórias do dump onboard".
- Reflow em ~95–100 colunas.

- [ ] **Step 3: Roteiro** — ao final de `docs/smoke-test-leviathan-v4.md`:

```markdown
## Passo 4 — roteiro de confirmação (pendente)

O passo 4 moveu para o núcleo a leitura do dump onboard (`0x14`): a decodificação das
entradas, a montagem do fluxo delimitado e a leitura de cada memória como configuração. As
entradas e os dumps estão fixados pelos vetores `onboardEntry` e `onboardDump`, capturados do
TypeScript antigo; o que falta é o mouse confirmar.

1. **Conectar.** As quatro memórias aparecem com os mapeamentos que cada uma guarda, diferentes
   entre si.
2. ~~**O que o app não nomeia sobrevive.**~~ **Substituído na execução** por "Mapeamento
   relido": aplicar numa memória com macro num botão do editor apaga a macro, por um defeito
   anterior à migração (ver o spec, "Defeito conhecido, para o passo 5"). Não siga a versão antiga.
3. **Trocar de memória pelo mouse.** A tela acompanha a memória ativa.

Resultado: _preencher após o teste._
```

- [ ] **Step 4: Gate** — Run: `pnpm verify`. Expected: passa.

- [ ] **Step 5: Commit**

```bash
pnpm format
git add docs CLAUDE.md
git commit -m "docs: fechar o passo 4 no codigo e deixar o roteiro de hardware"
```

## Verificação em hardware

**Obrigatória antes do merge.** Roteiro na Task 6. Quem confirma preenche o resultado; o spec troca "aguardando a confirmação" por "Fechado em <data>" e o `CLAUDE.md` tira a pendência.

## Planos seguintes

Passo 5 — a sessão de `LeviathanV4Driver.ts` sob a interface de passos puxados (`## A forma do passo 5`), mais a decodificação de `session.ts`. O maior e o mais arriscado.
