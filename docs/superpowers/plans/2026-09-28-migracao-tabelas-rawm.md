# Migração das tabelas de teclas e ações para o núcleo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o passo 2 da migração: `leviathanV4Keys.ts` é apagado, o vocabulário de ações (`MouseActionId`) passa a ter um só dono — um enum Rust do qual o tipo TypeScript é **gerado** por `ts-rs` —, e a tabela ação→bytes, a tabela botão↔id de tecla e a sétima tecla (show power) vivem no núcleo.

**Architecture:** O núcleo ganha três peças: `device::MouseActionId` (o vocabulário, genérico), `protocols::rawm::actions` (como o RAWM codifica cada ação, e o inverso) e `drivers::leviathan_v4::keys` (os ids físicos do Leviathan V4 e a sétima tecla). A ponte expõe sete funções pequenas; `coreBridge.ts` as envolve. A casca continua dona de tudo que **não** é função direta da tabela — `editorKeySets`, `mappingEvents`, as assinaturas, `preservedEvents` (passo 5) e `namedAction`/`declaredLength` (passo 4) — e só troca de onde tira os números.

**Tech Stack:** Rust 2024 (`gearhub-core`, `gearhub-core-wasm`), `ts-rs` 12 (dev-dependency), `wasm-bindgen` 0.2, TypeScript 5.9, Vitest, pnpm + Turborepo.

**Spec:** `docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md` — passo 2 da `## Ordem corrigida` e `## Como verificar cada passo`.

## Global Constraints

- **O núcleo não faz I/O, é síncrono, não conhece `wasm-bindgen`.** Nenhum `#[wasm_bindgen]` em `packages/core`. (A exceção única deste plano é um teste `#[cfg(test)]` que **lê** o arquivo gerado para compará-lo — teste, não núcleo.)
- **Migrar é apagar.** O passo só fecha quando `leviathanV4Keys.ts` não existe e a união escrita à mão em `packages/shared/src/mouse.ts` sumiu.
- **Escopo:** só o que é função direta da tabela desce. `editorKeySets`, `mappingEvents`, `intendedMappings`, `reportedMappings`, `preservedEvents` ficam no driver; `namedAction`, `declaredLength`, `CONFIG_TYPE_*` ficam em `onboardConfig.ts`. Puxar qualquer um deles é antecipar os passos 4 e 5.
- **Nenhuma chamada à ponte no escopo de módulo.** O WASM só está pronto depois do `init()`; uma chamada no topo de um módulo roda na importação e lança `TypeError`. Toda consulta à ponte acontece dentro de uma função.
- **Erro novo que atravessa a ponte:** variante em `RawmError`, código estável em `code()`, entrada no teste exaustivo de códigos, texto em `apps/web/src/core/rawmError.ts`.
- **Vetor novo:** vai em `packages/core/vectors/rawm-protocol.json`, lido por `cargo test` **e** `vitest`, cada seção protegida contra vazio dos dois lados.
- **Sem strings de interface no núcleo.** Os ids de ação (`'clique-esquerdo'`) e de botão (`'esquerdo'`) são identificadores salvos nas configurações, não texto de tela — por isso podem descer.
- **Nunca commitar `packages/core-wasm/pkg`.**
- **Formato:** `pnpm format` antes de cada commit. `pnpm verify` roda `format:check`.
- **Sem atribuição de IA em commits.** Nada de `Co-Authored-By`, `Generated with`, `Claude-Session`.
- **Gate final:** `pnpm verify`.

## Notas de ambiente

1. **`pnpm core:build` antes de `pnpm --filter @gearhub/web test`.** Os testes exercitam o `.wasm` real; depois de mudar Rust, reconstrua. Via `pnpm test` (turbo) o build acontece sozinho.
2. **Caminho por `process.cwd()`, nunca por `import.meta.url`** nos testes do Vitest (ver `apps/web/src/test/vectors.ts`).
3. **`ts-rs` 12 no toolchain `stable-x86_64-pc-windows-gnu` desta máquina:** a cadeia `ts-rs-macros → termcolor → winapi-util 0.1.11 → windows-sys 0.61` exige `dlltool.exe`, que não está instalado, e o build falha com `error calling dlltool 'dlltool.exe': program not found`. Fixar `winapi-util` em `0.1.9` no `Cargo.lock` (que usa `windows-sys 0.59`, sem `dlltool`) resolve — testado. O CI roda em `ubuntu-latest` e não é afetado. Um `cargo update` sem `--precise` desfaz o pin; o comentário no `Cargo.toml` diz isso.
4. **Três proteções do turbo que não podem sair** (ver `CLAUDE.md`). Este plano acrescenta uma quarta, pela mesma razão: o arquivo gerado entra nos `inputs` de `test` de `packages/core/turbo.json`, senão editá-lo à mão deixa `@gearhub/core:test` em cache hit e a guarda de deriva nunca roda.
5. **Shell:** os comandos abaixo são Git Bash. Em PowerShell, `UPDATE_BINDINGS=1 cargo test …` vira `$env:UPDATE_BINDINGS='1'; cargo test …; Remove-Item Env:UPDATE_BINDINGS`.

---

## Estrutura de arquivos

**Criados:**

| arquivo                                          | responsabilidade                                                |
| ------------------------------------------------ | --------------------------------------------------------------- |
| `packages/core/src/device/actions.rs`            | `MouseActionId`: o vocabulário de ações, e a guarda do `.ts`    |
| `packages/core/src/protocols/rawm/actions.rs`    | Como o RAWM codifica cada ação, o inverso, e `encode_mapping`   |
| `packages/core/src/drivers/leviathan_v4/mod.rs`  | Módulo do Leviathan V4 (os passos 3 e 5 acrescentam arquivos)   |
| `packages/core/src/drivers/leviathan_v4/keys.rs` | Ids físicos das teclas e a sétima tecla (show power)            |
| `packages/shared/src/generated/MouseActionId.ts` | **Gerado** por `ts-rs`; versionado, conferido pelo `cargo test` |

**Modificados:**

| arquivo                                                         | mudança                                                               |
| --------------------------------------------------------------- | --------------------------------------------------------------------- |
| `packages/core/vectors/rawm-protocol.json`                      | Seções `mapping`, `showPower`, `leviathanKeys`                        |
| `packages/core/tests/vectors.rs`                                | Lê e confere as três seções novas                                     |
| `apps/web/src/test/vectors.ts`                                  | Tipos das seções novas                                                |
| `apps/web/src/hardware/rawm/vectors.test.ts`                    | Confere as seções novas (primeiro contra o TS, depois contra a ponte) |
| `packages/core/Cargo.toml`, `Cargo.lock`                        | `ts-rs` como dev-dependency; pin de `winapi-util`                     |
| `packages/core/src/device/mod.rs`                               | `pub mod actions; pub use actions::MouseActionId;`                    |
| `packages/core/src/protocols/rawm/mod.rs`                       | `mod actions;` e reexportações                                        |
| `packages/core/src/protocols/rawm/error.rs`                     | `RawmError::UnknownAction`                                            |
| `packages/core/src/drivers/mod.rs`                              | `pub mod leviathan_v4;`                                               |
| `packages/core/turbo.json`                                      | Arquivo gerado nos `inputs` de `test`                                 |
| `packages/shared/src/mouse.ts`                                  | A união some; o tipo vem do arquivo gerado                            |
| `.prettierignore`                                               | Ignora `packages/shared/src/generated/`                               |
| `packages/core-wasm/src/lib.rs`                                 | Sete funções novas                                                    |
| `apps/web/src/core/coreBridge.ts`                               | Invólucros das sete funções                                           |
| `apps/web/src/core/rawmError.ts`                                | Texto de `unknown-action`                                             |
| `apps/web/src/hardware/rawm/LeviathanV4Driver.ts`               | Usa a ponte; `encodeLeviathanAction` sai                              |
| `apps/web/src/hardware/rawm/onboardConfig.ts`                   | Usa a ponte; os mapas de módulo saem                                  |
| `apps/web/src/hardware/rawm/writeProbe.ts`                      | `encodeLeviathanAction` → `encodeMapping`                             |
| quatro arquivos de teste que importam `encodeLeviathanAction`   | idem                                                                  |
| `docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md` | Passo 2 marcado como fechado                                          |
| `CLAUDE.md`                                                     | Estado real; por que o arquivo gerado é versionado                    |

**Apagado:** `apps/web/src/hardware/rawm/leviathanV4Keys.ts`.

---

### Task 1: Vetores de mapeamento capturados da implementação atual

Os bytes que o TypeScript produz hoje são os confirmados em hardware. Os vetores os fixam **antes** de qualquer mudança, e só passam a valer como fonte depois que o TS atual passa contra eles. É por isso que este passo não precisa do mouse.

**Files:**

- Modify: `packages/core/vectors/rawm-protocol.json`
- Modify: `apps/web/src/test/vectors.ts`
- Modify: `apps/web/src/hardware/rawm/vectors.test.ts`

**Interfaces:**

- Produces: seções JSON `mapping: {name, keyIds, action, expected: string | null}[]`, `showPower: {name, expected}[]`, `leviathanKeys: {buttonId, keyId}[]` (hex minúsculo, sem separador). Tipos TS `MappingVector`, `ShowPowerVector`, `LeviathanKeyVector` no `ProtocolVectors`.

- [ ] **Step 1: Acrescentar as seções ao JSON**

Em `packages/core/vectors/rawm-protocol.json`, depois de `"queryEvent": [...]`, acrescente (mantenha `"version": 1` — seções novas não mudam o formato das antigas, e o serde do lado Rust ignora campos que não conhece):

```json
  "mapping": [
    { "name": "clique esquerdo", "keyIds": "0a", "action": "clique-esquerdo", "expected": "030016010a0001010000" },
    { "name": "clique direito", "keyIds": "0a", "action": "clique-direito", "expected": "030016010a0001020000" },
    { "name": "clique central", "keyIds": "0a", "action": "clique-central", "expected": "030016010a0001030000" },
    { "name": "voltar", "keyIds": "0a", "action": "voltar", "expected": "030016010a0001040000" },
    { "name": "avançar", "keyIds": "0a", "action": "avancar", "expected": "030016010a0001050000" },
    { "name": "rolagem para cima é 0x07, não 0x41", "keyIds": "0c", "action": "rolagem-cima", "expected": "030016010c0003070000" },
    { "name": "rolagem para baixo é 0x08, não 0x3f", "keyIds": "0c", "action": "rolagem-baixo", "expected": "030016010c0003080000" },
    { "name": "ciclo de DPI", "keyIds": "10", "action": "dpi-ciclo", "expected": "030018011002010000000000" },
    { "name": "aumentar DPI", "keyIds": "10", "action": "dpi-aumentar", "expected": "030018011002020000000000" },
    { "name": "diminuir DPI", "keyIds": "10", "action": "dpi-diminuir", "expected": "030018011002030000000000" },
    { "name": "desativado não escreve nada", "keyIds": "0a", "action": "desativado", "expected": null },
    { "name": "R-Plus: ativador primeiro, alvo depois", "keyIds": "100c", "action": "dpi-ciclo", "expected": "03001802100c02010000000000" }
  ],
  "showPower": [
    { "name": "sétima tecla, reconstruída depois de todo CONFIG_RESET", "expected": "030018010d020e0000000000" }
  ],
  "leviathanKeys": [
    { "buttonId": "esquerdo", "keyId": 10 },
    { "buttonId": "direito", "keyId": 11 },
    { "buttonId": "central", "keyId": 12 },
    { "buttonId": "lateral-traseiro", "keyId": 14 },
    { "buttonId": "lateral-dianteiro", "keyId": 15 },
    { "buttonId": "dpi", "keyId": 16 }
  ]
```

Os valores esperados de `mapping` e `showPower` foram montados à mão a partir do layout de `encode_mouse_key` (`03 00 16 | n | ids | mod1 key_type key_code mod2 00`) e `encode_mouse_function` (`03 00 18 | n | ids | touch fn | value_lo value_hi | 00 | len_lo len_hi`). **Se o Step 4 reprovar algum, o vetor está errado, não o código** — corrija o hex para o que o TS atual produz, e registre no commit qual mudou. Não há hardware envolvido neste passo porque os bytes do TS atual são os confirmados no mouse.

- [ ] **Step 2: Tipos no leitor TS**

Em `apps/web/src/test/vectors.ts`, antes de `export interface ProtocolVectors`, acrescente:

```ts
interface MappingVector {
  name: string;
  keyIds: string;
  action: MouseActionId;
  /** Null quando a ação não escreve nada. */
  expected: string | null;
}

interface ShowPowerVector {
  name: string;
  expected: string;
}

interface LeviathanKeyVector {
  buttonId: string;
  keyId: number;
}
```

e os campos em `ProtocolVectors`:

```ts
export interface ProtocolVectors {
  version: number;
  envelope: EnvelopeVector[];
  queryEvent: QueryEventVector[];
  mapping: MappingVector[];
  showPower: ShowPowerVector[];
  leviathanKeys: LeviathanKeyVector[];
}
```

com `import type { MouseActionId } from '@gearhub/shared';` no topo do arquivo.

- [ ] **Step 3: Testes contra a implementação TS atual**

Em `apps/web/src/hardware/rawm/vectors.test.ts`, acrescente os imports:

```ts
import {
  FUNCTION_SHOW_POWER,
  SHOW_POWER_KEY_ID,
  TOUCH_TYPE_PRESS,
  buttonIdsByKeyId,
  physicalKeyIds,
} from './leviathanV4Keys';
import { encodeLeviathanAction } from './LeviathanV4Driver';
```

e `encodeMouseFunction` ao import de `'../../core/coreBridge'`. Estenda o teste de seções não vazias:

```ts
it('tem vetores de todas as seções', () => {
  requireNonEmpty(vectors.envelope, 'envelope');
  requireNonEmpty(vectors.queryEvent, 'queryEvent');
  requireNonEmpty(vectors.mapping, 'mapping');
  requireNonEmpty(vectors.showPower, 'showPower');
  requireNonEmpty(vectors.leviathanKeys, 'leviathanKeys');
});
```

(substitui o `it('tem vetores de envelope e de consulta', …)`) e acrescente, dentro do mesmo `describe`:

```ts
it.each(vectors.mapping)('mapeamento: $name', ({ keyIds, action, expected }) => {
  const encoded = encodeLeviathanAction([...fromHex(keyIds)], action);
  expect(encoded === null ? null : toHex(encoded)).toBe(expected);
});

it.each(vectors.showPower)('show power: $name', ({ expected }) => {
  const encoded = encodeMouseFunction({
    keyIds: [SHOW_POWER_KEY_ID],
    touchType: TOUCH_TYPE_PRESS,
    functionId: FUNCTION_SHOW_POWER,
  });
  expect(toHex(encoded)).toBe(expected);
});

it.each(vectors.leviathanKeys)('tecla do Leviathan: $buttonId', ({ buttonId, keyId }) => {
  expect(physicalKeyIds[buttonId]).toBe(keyId);
  expect(buttonIdsByKeyId.get(keyId)).toBe(buttonId);
});

it('cobre toda tecla do Leviathan e toda ação', () => {
  expect(vectors.leviathanKeys.map(({ buttonId }) => buttonId).sort()).toEqual(
    Object.keys(physicalKeyIds).sort(),
  );
  expect(new Set(vectors.mapping.map(({ action }) => action))).toEqual(
    new Set(Object.keys(actions)),
  );
});
```

com `actions` no import de `./leviathanV4Keys`. O último teste impede que uma ação nova entre na tabela sem vetor.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm core:build && pnpm --filter @gearhub/web exec vitest run src/hardware/rawm/vectors.test.ts`
Expected: PASS, com os 12 casos de mapeamento, 1 de show power e 6 de tecla listados. Se algum hex reprovar, veja a nota do Step 1.

Run: `cargo test -p gearhub-core --test vectors`
Expected: PASS (o lado Rust ainda não lê as seções novas e as ignora).

- [ ] **Step 5: Commit**

```bash
pnpm format
git add packages/core/vectors/rawm-protocol.json apps/web/src/test/vectors.ts apps/web/src/hardware/rawm/vectors.test.ts
git commit -m "test: fixar em vetores os bytes de mapeamento que o mouse ja confirmou"
```

---

### Task 2: `MouseActionId` no núcleo, com o tipo TypeScript gerado

**Files:**

- Create: `packages/core/src/device/actions.rs`
- Create: `packages/shared/src/generated/MouseActionId.ts` (gerado)
- Modify: `packages/core/src/device/mod.rs`
- Modify: `packages/core/Cargo.toml`, `Cargo.lock`
- Modify: `packages/shared/src/mouse.ts`
- Modify: `packages/core/turbo.json`
- Modify: `.prettierignore`

**Interfaces:**

- Produces: `gearhub_core::device::MouseActionId` — `enum { CliqueEsquerdo, CliqueDireito, CliqueCentral, Voltar, Avancar, DpiCiclo, DpiAumentar, DpiDiminuir, RolagemCima, RolagemBaixo, Desativado }`, `Copy + Eq + Hash + Debug`; `MouseActionId::ALL: [MouseActionId; 11]`; `fn as_str(self) -> &'static str`; `fn parse(id: &str) -> Option<MouseActionId>`.
- Produces: `packages/shared/src/generated/MouseActionId.ts` exportando `type MouseActionId`; `@gearhub/shared` continua exportando `MouseActionId` com o mesmo nome.

- [ ] **Step 1: Dependência e pin**

Em `packages/core/Cargo.toml`, em `[dev-dependencies]`:

```toml
[dev-dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
# Só em teste: gera o tipo TypeScript de `MouseActionId` e o confere contra o
# arquivo versionado. Fica fora do build do WASM.
#
# `winapi-util` está fixado em 0.1.9 no Cargo.lock: a 0.1.11 puxa
# `windows-sys` 0.61, que no toolchain GNU do Windows exige `dlltool.exe`. Um
# `cargo update` sem `--precise` desfaz o pin e o build local volta a falhar.
ts-rs = "12"
```

Run:

```bash
cargo update -p winapi-util --precise 0.1.9
cargo tree -p gearhub-core -e dev -i windows-sys
```

Expected: a árvore mostra `windows-sys v0.59.x` (ou nenhum `windows-sys` fora do Windows), nunca `v0.61`.

- [ ] **Step 2: Testes primeiro**

Os testes vivem no `mod tests` do próprio `actions.rs` (Step 3). O vermelho que importa é o da guarda, no Step 4: ela reprova enquanto o arquivo gerado não existe.

- [ ] **Step 3: Implementar**

`packages/core/src/device/actions.rs`:

```rust
//! O vocabulário de ações que um botão de mouse pode receber.
//!
//! Este enum é o único dono de `MouseActionId`. O tipo TypeScript em
//! `packages/shared/src/generated/MouseActionId.ts` é gerado a partir dele por
//! `ts-rs`, e um teste aqui reprova quando os dois divergem. Os ids são
//! identificadores salvos nas configurações do usuário, não texto de tela.

/// Uma ação atribuível a um botão físico.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(rename_all = "kebab-case"))]
pub enum MouseActionId {
    CliqueEsquerdo,
    CliqueDireito,
    CliqueCentral,
    Voltar,
    Avancar,
    DpiCiclo,
    DpiAumentar,
    DpiDiminuir,
    RolagemCima,
    RolagemBaixo,
    Desativado,
}

impl MouseActionId {
    pub const ALL: [Self; 11] = [
        Self::CliqueEsquerdo,
        Self::CliqueDireito,
        Self::CliqueCentral,
        Self::Voltar,
        Self::Avancar,
        Self::DpiCiclo,
        Self::DpiAumentar,
        Self::DpiDiminuir,
        Self::RolagemCima,
        Self::RolagemBaixo,
        Self::Desativado,
    ];

    /// O id como a casca o guarda. Um teste abaixo o amarra ao nome que o
    /// `ts-rs` gera, para que os dois não possam divergir.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::CliqueEsquerdo => "clique-esquerdo",
            Self::CliqueDireito => "clique-direito",
            Self::CliqueCentral => "clique-central",
            Self::Voltar => "voltar",
            Self::Avancar => "avancar",
            Self::DpiCiclo => "dpi-ciclo",
            Self::DpiAumentar => "dpi-aumentar",
            Self::DpiDiminuir => "dpi-diminuir",
            Self::RolagemCima => "rolagem-cima",
            Self::RolagemBaixo => "rolagem-baixo",
            Self::Desativado => "desativado",
        }
    }

    pub fn parse(id: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|action| action.as_str() == id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeSet;
    use ts_rs::TS;

    const GENERATED: &str = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../shared/src/generated/MouseActionId.ts"
    );

    fn generated() -> String {
        MouseActionId::export_to_string(&ts_rs::Config::default()).expect("ts-rs exporta")
    }

    /// O arquivo é versionado para que `@gearhub/shared` compile sem Rust.
    /// Esta guarda é o que o impede de divergir do enum: um variante novo, um
    /// rename, ou uma edição à mão no `.ts` reprovam aqui.
    ///
    /// Para regenerar: `UPDATE_BINDINGS=1 cargo test -p gearhub-core generated`.
    #[test]
    fn the_generated_typescript_matches_the_enum() {
        let expected = generated();
        if std::env::var_os("UPDATE_BINDINGS").is_some() {
            std::fs::write(GENERATED, &expected).expect("escreve o arquivo gerado");
        }
        let committed = std::fs::read_to_string(GENERATED)
            .expect("arquivo gerado presente")
            .replace("\r\n", "\n");
        assert_eq!(
            committed, expected,
            "MouseActionId.ts divergiu do enum; rode UPDATE_BINDINGS=1 cargo test -p gearhub-core generated"
        );
    }

    /// `as_str` é escrito à mão; o `ts-rs` deriva os nomes das variantes. Os
    /// dois conjuntos precisam ser o mesmo, senão a ponte devolveria um id que
    /// o tipo TypeScript não conhece.
    #[test]
    fn as_str_names_exactly_the_generated_union() {
        let decl = MouseActionId::decl(&ts_rs::Config::default());
        let generated: BTreeSet<&str> = decl.split('"').skip(1).step_by(2).collect();
        let written: BTreeSet<&str> = MouseActionId::ALL.iter().map(|a| a.as_str()).collect();
        assert_eq!(generated, written);
    }

    #[test]
    fn parse_is_the_inverse_of_as_str() {
        for action in MouseActionId::ALL {
            assert_eq!(MouseActionId::parse(action.as_str()), Some(action));
        }
        assert_eq!(MouseActionId::parse("clique-lateral"), None);
        assert_eq!(MouseActionId::parse(""), None);
    }
}
```

Em `packages/core/src/device/mod.rs`, no topo:

```rust
pub mod actions;
pub mod capabilities;
pub mod registry;

pub use actions::MouseActionId;
```

- [ ] **Step 4: Ver a guarda reprovar, e gerar**

Run: `cargo test -p gearhub-core generated`
Expected: FAIL em `the_generated_typescript_matches_the_enum` com `arquivo gerado presente` (o arquivo ainda não existe).

Run: `mkdir -p packages/shared/src/generated && UPDATE_BINDINGS=1 cargo test -p gearhub-core generated && cargo test -p gearhub-core actions`
Expected: PASS nos três testes, e `packages/shared/src/generated/MouseActionId.ts` contém:

```ts
// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
export type MouseActionId =
  | 'clique-esquerdo'
  | 'clique-direito'
  | 'clique-central'
  | 'voltar'
  | 'avancar'
  | 'dpi-ciclo'
  | 'dpi-aumentar'
  | 'dpi-diminuir'
  | 'rolagem-cima'
  | 'rolagem-baixo'
  | 'desativado';
```

- [ ] **Step 5: Provar que a guarda pega edição à mão**

Troque `"voltar"` por `"voltarr"` no `.ts` gerado, rode `cargo test -p gearhub-core generated`, veja FAIL, e desfaça com `git checkout -- packages/shared/src/generated/MouseActionId.ts` (se ainda não versionado, regenere com `UPDATE_BINDINGS=1`). Não commite a edição.

- [ ] **Step 6: `@gearhub/shared` passa a usar o tipo gerado**

Em `packages/shared/src/mouse.ts`, substitua o bloco

```ts
/** Actions a physical mouse button can be assigned to. */
export type MouseActionId =
  | 'clique-esquerdo'
  ...
  | 'desativado';
```

por

```ts
import type { MouseActionId } from './generated/MouseActionId';

/**
 * Actions a physical mouse button can be assigned to. Generated from the core's
 * `MouseActionId` enum; `cargo test` fails when the two diverge.
 */
export type { MouseActionId };
```

(o `import` vai para a primeira linha do arquivo; o comentário e o `export type` ficam onde a união estava). `packages/shared/src/index.ts` não muda.

- [ ] **Step 7: Prettier e turbo**

Em `.prettierignore`, ao final:

```
# Gerado pelo ts-rs a partir de packages/core/src/device/actions.rs e conferido
# byte a byte pelo cargo test. Formatar o arquivo faria a guarda reprovar.
packages/shared/src/generated/
```

Em `packages/core/turbo.json`, nos `inputs` de `test` (não em `lint`), acrescente a linha:

```json
"$TURBO_ROOT$/packages/shared/src/generated/**"
```

- [ ] **Step 8: Verificar**

Run: `pnpm --filter @gearhub/shared lint && pnpm --filter @gearhub/web lint && cargo clippy --workspace --all-targets -- -D warnings && pnpm format:check`
Expected: tudo passa.

- [ ] **Step 9: Commit**

```bash
pnpm format
git add packages/core/Cargo.toml Cargo.lock packages/core/src/device packages/shared/src/generated packages/shared/src/mouse.ts packages/core/turbo.json .prettierignore
git commit -m "feat: gerar MouseActionId a partir do enum do nucleo"
```

---

### Task 3: Tabelas de ação e de tecla no núcleo

**Files:**

- Create: `packages/core/src/protocols/rawm/actions.rs`
- Create: `packages/core/src/drivers/leviathan_v4/mod.rs`
- Create: `packages/core/src/drivers/leviathan_v4/keys.rs`
- Modify: `packages/core/src/protocols/rawm/mod.rs`
- Modify: `packages/core/src/drivers/mod.rs`
- Modify: `packages/core/tests/vectors.rs`

**Interfaces:**

- Consumes: `gearhub_core::device::MouseActionId` (Task 2); `crate::encode_mouse_key(key_ids: &[u8], modifier_one: u8, modifier_two: u8, key_type: u8, key_code: u8) -> Vec<u8>` e `crate::encode_mouse_function(key_ids: &[u8], touch_type: u8, function_id: u8, value: u16, text: &[u8]) -> Vec<u8>` (já existem em `lib.rs`).
- Produces, em `gearhub_core::protocols::rawm`: `encode_mapping(key_ids: &[u8], action: MouseActionId) -> Option<Vec<u8>>`; `encode_function_press(key_ids: &[u8], function_id: u8) -> Vec<u8>`; `action_for_key(key_type: u8, key_code: u8) -> Option<MouseActionId>`; `action_for_function(function_id: u8) -> Option<MouseActionId>`; `const FUNCTION_SHOW_POWER: u8 = 0x0e`.
- Produces, em `gearhub_core::drivers::leviathan_v4`: `key_id(button_id: &str) -> Option<u8>`; `button_id(key_id: u8) -> Option<&'static str>`; `const SHOW_POWER_KEY_ID: u8 = 0x0d`; `encode_show_power() -> Vec<u8>`.

- [ ] **Step 1: Testes do lado dos vetores (falham por não compilar)**

Em `packages/core/tests/vectors.rs`, troque o `use` do topo por:

```rust
use gearhub_core::device::MouseActionId;
use gearhub_core::drivers::leviathan_v4;
use gearhub_core::protocols::rawm::{build_query_event, encode_mapping, with_protocol_envelope};
use serde::Deserialize;
```

acrescente as structs:

```rust
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MappingVector {
    name: String,
    key_ids: String,
    action: String,
    expected: Option<String>,
}

#[derive(Deserialize)]
struct ShowPowerVector {
    name: String,
    expected: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LeviathanKeyVector {
    button_id: String,
    key_id: u8,
}
```

os campos em `Vectors`:

```rust
    mapping: Vec<MappingVector>,
    show_power: Vec<ShowPowerVector>,
    leviathan_keys: Vec<LeviathanKeyVector>,
```

e os testes, ao final:

```rust
#[test]
fn encode_mapping_matches_the_shared_vectors() {
    let vectors = vectors();
    require_non_empty(&vectors.mapping, "mapping");
    for vector in &vectors.mapping {
        let action = MouseActionId::parse(&vector.action)
            .unwrap_or_else(|| panic!("{}: ação desconhecida {}", vector.name, vector.action));
        let encoded = encode_mapping(&from_hex(&vector.key_ids), action);
        assert_eq!(encoded.map(|bytes| to_hex(&bytes)), vector.expected, "{}", vector.name);
    }
}

/// Uma ação nova no enum sem vetor passaria sem ser conferida byte a byte.
#[test]
fn every_action_has_a_mapping_vector() {
    let vectors = vectors();
    let covered: std::collections::BTreeSet<&str> =
        vectors.mapping.iter().map(|vector| vector.action.as_str()).collect();
    for action in MouseActionId::ALL {
        assert!(covered.contains(action.as_str()), "sem vetor para {}", action.as_str());
    }
}

#[test]
fn show_power_matches_the_shared_vectors() {
    let vectors = vectors();
    require_non_empty(&vectors.show_power, "showPower");
    for vector in &vectors.show_power {
        assert_eq!(to_hex(&leviathan_v4::encode_show_power()), vector.expected, "{}", vector.name);
    }
}

#[test]
fn leviathan_keys_match_the_shared_vectors() {
    let vectors = vectors();
    require_non_empty(&vectors.leviathan_keys, "leviathanKeys");
    for vector in &vectors.leviathan_keys {
        assert_eq!(leviathan_v4::key_id(&vector.button_id), Some(vector.key_id), "{}", vector.button_id);
        assert_eq!(leviathan_v4::button_id(vector.key_id), Some(vector.button_id.as_str()));
    }
}
```

Run: `cargo test -p gearhub-core --test vectors`
Expected: FAIL de compilação — `encode_mapping` e `drivers::leviathan_v4` não existem.

- [ ] **Step 2: `protocols/rawm/actions.rs`**

```rust
//! Como o RAWM codifica cada ação, e o caminho inverso para ler um dump.
//!
//! Os códigos são os da biblioteca do fabricante (`send_event_mouse_key` e
//! `send_event_mouse_function`). A tabela serve ao escritor e ao leitor: o
//! inverso é calculado dela, nunca escrito à parte.

use crate::device::MouseActionId;
use crate::{encode_mouse_function, encode_mouse_key};

const TOUCH_TYPE_PRESS: u8 = 0x02;
const MOUSE_KEY_TYPE_MKEY: u8 = 0x01;
const MOUSE_KEY_TYPE_WHEEL: u8 = 0x03;

/// A função que acende o indicador de bateria. Nenhuma ação do app a nomeia.
pub const FUNCTION_SHOW_POWER: u8 = 0x0e;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum EncodedAction {
    Key { key_type: u8, key_code: u8 },
    Function { function_id: u8 },
    Disabled,
}

fn encoded(action: MouseActionId) -> EncodedAction {
    use EncodedAction::{Disabled, Function, Key};
    use MouseActionId::*;
    match action {
        CliqueEsquerdo => Key { key_type: MOUSE_KEY_TYPE_MKEY, key_code: 1 },
        CliqueDireito => Key { key_type: MOUSE_KEY_TYPE_MKEY, key_code: 2 },
        CliqueCentral => Key { key_type: MOUSE_KEY_TYPE_MKEY, key_code: 3 },
        Voltar => Key { key_type: MOUSE_KEY_TYPE_MKEY, key_code: 4 },
        Avancar => Key { key_type: MOUSE_KEY_TYPE_MKEY, key_code: 5 },
        // MOUSE_KEY_WHEEL_UP e _DOWN na biblioteca do fabricante, não 0x41 e 0x3f.
        RolagemCima => Key { key_type: MOUSE_KEY_TYPE_WHEEL, key_code: 0x07 },
        RolagemBaixo => Key { key_type: MOUSE_KEY_TYPE_WHEEL, key_code: 0x08 },
        DpiCiclo => Function { function_id: 1 },
        DpiAumentar => Function { function_id: 2 },
        DpiDiminuir => Function { function_id: 3 },
        Desativado => Disabled,
    }
}

/// Um evento de função disparado ao pressionar, sem valor nem texto.
pub fn encode_function_press(key_ids: &[u8], function_id: u8) -> Vec<u8> {
    encode_mouse_function(key_ids, TOUCH_TYPE_PRESS, function_id, 0, &[])
}

/// O evento que atribui `action` às teclas `key_ids` — uma, ou duas para uma
/// camada R-Plus, com o ativador primeiro. `None` quando a ação não escreve
/// nada: desativar uma tecla é deixá-la fora do conjunto depois do
/// CONFIG_RESET.
pub fn encode_mapping(key_ids: &[u8], action: MouseActionId) -> Option<Vec<u8>> {
    match encoded(action) {
        EncodedAction::Key { key_type, key_code } => {
            Some(encode_mouse_key(key_ids, 0, 0, key_type, key_code))
        }
        EncodedAction::Function { function_id } => Some(encode_function_press(key_ids, function_id)),
        EncodedAction::Disabled => None,
    }
}

/// A ação que um par tipo/código de tecla significa, sem modificador.
pub fn action_for_key(key_type: u8, key_code: u8) -> Option<MouseActionId> {
    MouseActionId::ALL
        .into_iter()
        .find(|&action| encoded(action) == EncodedAction::Key { key_type, key_code })
}

/// A ação que um id de função significa.
pub fn action_for_function(function_id: u8) -> Option<MouseActionId> {
    MouseActionId::ALL
        .into_iter()
        .find(|&action| encoded(action) == EncodedAction::Function { function_id })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Byte a byte contra send_event_mouse_key e send_event_mouse_function na
    // biblioteca do fabricante, com os ids que o mouse relata para si.
    #[test]
    fn encodes_mouse_wheel_dpi_and_r_plus_as_the_vendor_does() {
        assert_eq!(
            encode_mapping(&[0x0a], MouseActionId::CliqueEsquerdo),
            Some(vec![3, 0, 0x16, 1, 0x0a, 0, 1, 1, 0, 0])
        );
        assert_eq!(
            encode_mapping(&[0x10], MouseActionId::DpiCiclo),
            Some(vec![3, 0, 0x18, 1, 0x10, 2, 1, 0, 0, 0, 0, 0])
        );
        assert_eq!(
            encode_mapping(&[0x0c], MouseActionId::RolagemCima),
            Some(vec![3, 0, 0x16, 1, 0x0c, 0, 3, 0x07, 0, 0])
        );
        assert_eq!(
            encode_mapping(&[0x10, 0x0c], MouseActionId::DpiCiclo),
            Some(vec![3, 0, 0x18, 2, 0x10, 0x0c, 2, 1, 0, 0, 0, 0, 0])
        );
        assert_eq!(encode_mapping(&[0x0a], MouseActionId::Desativado), None);
    }

    /// O leitor inverte a tabela do escritor. Se duas ações dividissem um
    /// código, o dump de uma voltaria como a outra.
    #[test]
    fn every_written_action_reads_back_as_itself() {
        for action in MouseActionId::ALL {
            let read = match encoded(action) {
                EncodedAction::Key { key_type, key_code } => action_for_key(key_type, key_code),
                EncodedAction::Function { function_id } => action_for_function(function_id),
                EncodedAction::Disabled => continue,
            };
            assert_eq!(read, Some(action), "{}", action.as_str());
        }
    }

    #[test]
    fn codes_the_app_has_no_action_for_read_as_none() {
        assert_eq!(action_for_key(MOUSE_KEY_TYPE_MKEY, 9), None);
        assert_eq!(action_for_key(0x02, 1), None);
        assert_eq!(action_for_function(FUNCTION_SHOW_POWER), None);
    }
}
```

Em `packages/core/src/protocols/rawm/mod.rs`, acrescente `mod actions;` (em ordem alfabética, antes de `mod assembler;`) e:

```rust
pub use actions::{
    FUNCTION_SHOW_POWER, action_for_function, action_for_key, encode_function_press, encode_mapping,
};
```

- [ ] **Step 3: `drivers/leviathan_v4`**

`packages/core/src/drivers/leviathan_v4/mod.rs`:

```rust
//! O Leviathan V4: o que é fato deste aparelho, e não do protocolo RAWM.

mod keys;

pub use keys::{SHOW_POWER_KEY_ID, button_id, encode_show_power, key_id};
```

`packages/core/src/drivers/leviathan_v4/keys.rs`:

```rust
//! Os ids de tecla como o mouse os relata no próprio dump de configuração.
//!
//! 0x0a esquerdo, 0x0b direito, 0x0c central, 0x0e M4, 0x0f M5, 0x10 a tecla
//! de DPI. 0x0d é uma sétima tecla ligada a FUNCTION_SHOW_POWER, que a
//! interface oficial não rotula; as sete batem com os sete atrasos de
//! debounce em `kd`.
//!
//! Valores anteriores eram 1 a 7, que não são ids de tecla. Por isso todo
//! mapeamento escrito era aceito e ignorado.

use crate::protocols::rawm::{FUNCTION_SHOW_POWER, encode_function_press};

/// Os ids de botão da casca, pareados com o id de tecla do mouse.
const PHYSICAL_KEYS: [(&str, u8); 6] = [
    ("esquerdo", 0x0a),
    ("direito", 0x0b),
    ("central", 0x0c),
    ("lateral-traseiro", 0x0e),
    ("lateral-dianteiro", 0x0f),
    ("dpi", 0x10),
];

/// A sétima tecla não tem controle no editor, então nada nas configurações a
/// reconstruiria. O CONFIG_RESET a limpa como qualquer outra, e um conjunto
/// que a omite derruba em silêncio o indicador de bateria.
pub const SHOW_POWER_KEY_ID: u8 = 0x0d;

pub fn key_id(button_id: &str) -> Option<u8> {
    PHYSICAL_KEYS
        .iter()
        .find(|(button, _)| *button == button_id)
        .map(|&(_, key)| key)
}

pub fn button_id(key_id: u8) -> Option<&'static str> {
    PHYSICAL_KEYS
        .iter()
        .find(|&&(_, key)| key == key_id)
        .map(|&(button, _)| button)
}

/// O evento que devolve à sétima tecla o que o CONFIG_RESET tirou.
pub fn encode_show_power() -> Vec<u8> {
    encode_function_press(&[SHOW_POWER_KEY_ID], FUNCTION_SHOW_POWER)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn button_and_key_ids_are_inverse() {
        for (button, key) in PHYSICAL_KEYS {
            assert_eq!(key_id(button), Some(key));
            assert_eq!(button_id(key), Some(button));
        }
    }

    #[test]
    fn the_seventh_key_belongs_to_no_button() {
        assert_eq!(button_id(SHOW_POWER_KEY_ID), None);
        assert_eq!(key_id("roda"), None);
    }

    #[test]
    fn show_power_is_a_press_of_function_0x0e_on_key_0x0d() {
        assert_eq!(encode_show_power(), vec![3, 0, 0x18, 1, 0x0d, 2, 0x0e, 0, 0, 0, 0, 0]);
    }
}
```

Em `packages/core/src/drivers/mod.rs`:

```rust
pub mod leviathan_v4;
pub mod mock_mouse;
```

- [ ] **Step 4: Rodar**

Run: `cargo test -p gearhub-core`
Expected: PASS, incluindo os quatro testes novos de `tests/vectors.rs` e os de `actions.rs` e `keys.rs`.

Run: `cargo clippy --workspace --all-targets -- -D warnings`
Expected: sem avisos. (Se o clippy reclamar de `use MouseActionId::*` — `enum_glob_use` não é padrão, não deve —, troque por nomes qualificados.)

- [ ] **Step 5: Commit**

```bash
pnpm format
git add packages/core/src packages/core/tests/vectors.rs
git commit -m "feat: tabelas de acao e de tecla do Leviathan V4 no nucleo"
```

---

### Task 4: A ponte e o `coreBridge`

**Files:**

- Modify: `packages/core/src/protocols/rawm/error.rs`
- Modify: `packages/core-wasm/src/lib.rs`
- Modify: `apps/web/src/core/coreBridge.ts`
- Modify: `apps/web/src/core/rawmError.ts`
- Test: `apps/web/src/core/coreBridge.test.ts`, `apps/web/src/core/rawmError.test.ts`, `apps/web/src/hardware/rawm/vectors.test.ts`

**Interfaces:**

- Consumes: tudo que a Task 3 produz; `MouseActionId::parse` (Task 2).
- Produces, em `apps/web/src/core/coreBridge.ts`:
  - `encodeMapping(keyIds: ArrayLike<number>, action: MouseActionId): Uint8Array | null` — lança `Error('Ação de botão desconhecida.', { cause: 'unknown-action' })` para um id que o núcleo não conhece.
  - `actionForKey(keyType: number, keyCode: number): MouseActionId | null`
  - `actionForFunction(functionId: number): MouseActionId | null`
  - `leviathanKeyId(buttonId: string): number | null`
  - `leviathanButtonId(keyId: number): string | null`
  - `leviathanShowPowerKeyId(): number`
  - `encodeLeviathanShowPower(): Uint8Array`

- [ ] **Step 1: `RawmError::UnknownAction`**

Em `packages/core/src/protocols/rawm/error.rs`, acrescente a variante ao final do enum:

```rust
    /// Id de ação que o núcleo não conhece — uma configuração salva por outra
    /// versão do app, por exemplo.
    UnknownAction,
```

o braço em `code()`:

```rust
            Self::UnknownAction => "unknown-action",
```

e a linha no teste exaustivo de códigos:

```rust
        assert_eq!(RawmError::UnknownAction.code(), "unknown-action");
```

- [ ] **Step 2: Testes TS que falham**

Em `apps/web/src/core/coreBridge.test.ts`, acrescente ao import de `./coreBridge`: `actionForFunction`, `actionForKey`, `encodeLeviathanShowPower`, `encodeMapping`, `leviathanButtonId`, `leviathanKeyId`, `leviathanShowPowerKeyId`. E ao final do arquivo:

```ts
describe('tabelas de ação e de tecla do núcleo', () => {
  it('codifica uma ação e devolve null para desativado', () => {
    expect(bytes(encodeMapping([0x0a], 'clique-esquerdo')!)).toEqual([
      3, 0, 0x16, 1, 0x0a, 0, 1, 1, 0, 0,
    ]);
    expect(encodeMapping([0x0a], 'desativado')).toBeNull();
  });

  it('recusa um id de ação que o núcleo não conhece, com o código em cause', () => {
    let thrown: unknown;
    try {
      encodeMapping([0x0a], 'clique-lateral' as never);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe('Ação de botão desconhecida.');
    expect((thrown as Error).cause).toBe('unknown-action');
  });

  it('lê de volta a ação de um código de tecla ou de função', () => {
    expect(actionForKey(0x03, 0x07)).toBe('rolagem-cima');
    expect(actionForKey(0x01, 0x09)).toBeNull();
    expect(actionForFunction(2)).toBe('dpi-aumentar');
    expect(actionForFunction(0x0e)).toBeNull();
  });

  it('traduz entre botão e id de tecla do Leviathan V4', () => {
    expect(leviathanKeyId('dpi')).toBe(0x10);
    expect(leviathanKeyId('roda')).toBeNull();
    expect(leviathanButtonId(0x0e)).toBe('lateral-traseiro');
    expect(leviathanButtonId(leviathanShowPowerKeyId())).toBeNull();
  });

  it('monta a sétima tecla', () => {
    expect(leviathanShowPowerKeyId()).toBe(0x0d);
    expect(bytes(encodeLeviathanShowPower())).toEqual([
      3, 0, 0x18, 1, 0x0d, 2, 0x0e, 0, 0, 0, 0, 0,
    ]);
  });
});
```

Run: `pnpm --filter @gearhub/web exec vitest run src/core/coreBridge.test.ts`
Expected: FAIL — os nomes não são exportados.

- [ ] **Step 3: A ponte**

Em `packages/core-wasm/src/lib.rs`, acrescente os imports:

```rust
use gearhub_core::device::MouseActionId;
use gearhub_core::drivers::leviathan_v4;
```

e, antes de `core_version`:

```rust
#[wasm_bindgen(js_name = encodeMapping)]
pub fn encode_mapping(key_ids: &[u8], action: &str) -> Result<Option<Vec<u8>>, JsError> {
    let action = MouseActionId::parse(action).ok_or_else(|| js_error(rawm::RawmError::UnknownAction))?;
    Ok(rawm::encode_mapping(key_ids, action))
}

#[wasm_bindgen(js_name = actionForKey)]
pub fn action_for_key(key_type: u8, key_code: u8) -> Option<String> {
    rawm::action_for_key(key_type, key_code).map(|action| action.as_str().to_owned())
}

#[wasm_bindgen(js_name = actionForFunction)]
pub fn action_for_function(function_id: u8) -> Option<String> {
    rawm::action_for_function(function_id).map(|action| action.as_str().to_owned())
}

#[wasm_bindgen(js_name = leviathanKeyId)]
pub fn leviathan_key_id(button_id: &str) -> Option<u8> {
    leviathan_v4::key_id(button_id)
}

#[wasm_bindgen(js_name = leviathanButtonId)]
pub fn leviathan_button_id(key_id: u8) -> Option<String> {
    leviathan_v4::button_id(key_id).map(str::to_owned)
}

#[wasm_bindgen(js_name = leviathanShowPowerKeyId)]
pub fn leviathan_show_power_key_id() -> u8 {
    leviathan_v4::SHOW_POWER_KEY_ID
}

#[wasm_bindgen(js_name = encodeLeviathanShowPower)]
pub fn encode_leviathan_show_power() -> Vec<u8> {
    leviathan_v4::encode_show_power()
}
```

- [ ] **Step 4: Os invólucros**

Em `apps/web/src/core/coreBridge.ts`, acrescente ao import de `'gearhub-core-wasm'` (em ordem alfabética, como o bloco já está):

```ts
  actionForFunction as wasmActionForFunction,
  actionForKey as wasmActionForKey,
  encodeLeviathanShowPower as wasmEncodeLeviathanShowPower,
  encodeMapping as wasmEncodeMapping,
  leviathanButtonId as wasmLeviathanButtonId,
  leviathanKeyId as wasmLeviathanKeyId,
  leviathanShowPowerKeyId as wasmLeviathanShowPowerKeyId,
```

`import type { MouseActionId } from '@gearhub/shared';` no topo, e, depois de `encodeMouseFunction`:

```ts
/**
 * O evento que atribui `action` às teclas — uma, ou duas para R-Plus com o
 * ativador primeiro. `null` quando a ação não escreve nada.
 */
export function encodeMapping(keyIds: ArrayLike<number>, action: MouseActionId): Uint8Array | null {
  try {
    return wasmEncodeMapping(copyBytes(keyIds), action) ?? null;
  } catch (error) {
    throw asRawmError(error);
  }
}

/*
 * O núcleo devolve o id como texto. A conversão para `MouseActionId` é segura
 * porque o tipo é gerado do mesmo enum, e `cargo test` reprova quando os
 * nomes divergem (`as_str_names_exactly_the_generated_union`).
 */

/** A ação que um par tipo/código de tecla significa, ou `null`. */
export function actionForKey(keyType: number, keyCode: number): MouseActionId | null {
  return (wasmActionForKey(keyType, keyCode) ?? null) as MouseActionId | null;
}

/** A ação que um id de função significa, ou `null`. */
export function actionForFunction(functionId: number): MouseActionId | null {
  return (wasmActionForFunction(functionId) ?? null) as MouseActionId | null;
}

/** O id de tecla que o Leviathan V4 relata para um botão, ou `null`. */
export function leviathanKeyId(buttonId: string): number | null {
  return wasmLeviathanKeyId(buttonId) ?? null;
}

/** O botão a que um id de tecla do Leviathan V4 pertence, ou `null`. */
export function leviathanButtonId(keyId: number): string | null {
  return wasmLeviathanButtonId(keyId) ?? null;
}

/** A sétima tecla, que nenhum controle do editor alcança. */
export function leviathanShowPowerKeyId(): number {
  return wasmLeviathanShowPowerKeyId();
}

/** O evento que devolve à sétima tecla o indicador de bateria. */
export function encodeLeviathanShowPower(): Uint8Array {
  return wasmEncodeLeviathanShowPower();
}
```

Em `apps/web/src/core/rawmError.ts`, no `MESSAGES`:

```ts
  'unknown-action': 'Ação de botão desconhecida.',
```

e, em `apps/web/src/core/rawmError.test.ts`, se houver um comentário que conte as mensagens ("nove strings"), atualize o número para dez.

- [ ] **Step 5: Os vetores passam a conferir as duas implementações**

Em `apps/web/src/hardware/rawm/vectors.test.ts`, os três `it.each` da Task 1 passam a conferir o TS atual **e** a ponte. Troque-os por:

```ts
it.each(vectors.mapping)('mapeamento: $name', ({ keyIds, action, expected }) => {
  const hex = (bytes: Uint8Array | null) => (bytes === null ? null : toHex(bytes));
  expect(hex(encodeLeviathanAction([...fromHex(keyIds)], action))).toBe(expected);
  expect(hex(encodeMapping(fromHex(keyIds), action))).toBe(expected);
});

it.each(vectors.showPower)('show power: $name', ({ expected }) => {
  const encoded = encodeMouseFunction({
    keyIds: [SHOW_POWER_KEY_ID],
    touchType: TOUCH_TYPE_PRESS,
    functionId: FUNCTION_SHOW_POWER,
  });
  expect(toHex(encoded)).toBe(expected);
  expect(toHex(encodeLeviathanShowPower())).toBe(expected);
});

it.each(vectors.leviathanKeys)('tecla do Leviathan: $buttonId', ({ buttonId, keyId }) => {
  expect(physicalKeyIds[buttonId]).toBe(keyId);
  expect(buttonIdsByKeyId.get(keyId)).toBe(buttonId);
  expect(leviathanKeyId(buttonId)).toBe(keyId);
  expect(leviathanButtonId(keyId)).toBe(buttonId);
});
```

com `encodeLeviathanShowPower`, `encodeMapping`, `leviathanButtonId`, `leviathanKeyId` no import de `'../../core/coreBridge'`.

- [ ] **Step 6: Rodar**

Run: `cargo test -p gearhub-core && pnpm core:build && pnpm --filter @gearhub/web exec vitest run src/core src/hardware/rawm/vectors.test.ts`
Expected: PASS.

Run: `cargo clippy --workspace --all-targets -- -D warnings`
Expected: sem avisos.

- [ ] **Step 7: Commit**

```bash
pnpm format
git add packages/core/src/protocols/rawm/error.rs packages/core-wasm/src/lib.rs apps/web/src/core apps/web/src/hardware/rawm/vectors.test.ts
git commit -m "feat: expor as tabelas de acao e de tecla pela ponte"
```

---

### Task 5: A casca passa a usar o núcleo, e `leviathanV4Keys.ts` é apagado

**Files:**

- Modify: `apps/web/src/hardware/rawm/LeviathanV4Driver.ts`
- Modify: `apps/web/src/hardware/rawm/onboardConfig.ts`
- Modify: `apps/web/src/hardware/rawm/writeProbe.ts`
- Modify: `apps/web/src/hardware/rawm/LeviathanV4Driver.test.ts`, `onboardConfig.test.ts`, `onboardConfig.settings.test.ts`, `vectors.test.ts`
- Delete: `apps/web/src/hardware/rawm/leviathanV4Keys.ts`

**Interfaces:**

- Consumes: os sete invólucros da Task 4.
- Produces: `encodeLeviathanAction` deixa de existir; quem codificava uma ação chama `encodeMapping` de `coreBridge`. `mappingEvents`, `LeviathanV4Driver` e o resto da API do driver não mudam.

- [ ] **Step 1: O driver**

Em `apps/web/src/hardware/rawm/LeviathanV4Driver.ts`:

- No import de `'../../core/coreBridge'`, **remova** `encodeMouseFunction` e `encodeMouseKey` (se não forem mais usados no arquivo — confira com uma busca) e **acrescente** `encodeLeviathanShowPower`, `encodeMapping`, `leviathanKeyId`, `leviathanShowPowerKeyId`.
- Remova o bloco `import { FUNCTION_SHOW_POWER, … } from './leviathanV4Keys';`.
- Apague a função `encodeLeviathanAction` inteira.
- Em `editorKeySets`, troque as três consultas:

```ts
const keyId = leviathanKeyId(buttonId);
if (keyId === null) throw new Error(`Botao RAWM desconhecido: ${buttonId}.`);
```

```ts
const activator = leviathanKeyId(settings.rPlus.activatorButtonId);
if (activator === null) throw new Error('Ativador R-Plus RAWM invalido.');
```

```ts
const target = leviathanKeyId(buttonId);
if (target === null) throw new Error(`Botao R-Plus RAWM desconhecido: ${buttonId}.`);
```

- Em `mappingEvents`:

```ts
export function mappingEvents(settings: MouseSettings): Uint8Array[] {
  const events: Uint8Array[] = [];
  for (const { keyIds, action } of editorKeySets(settings)) {
    const event = encodeMapping(keyIds, action);
    if (event) events.push(event);
  }
  events.push(encodeLeviathanShowPower());
  return events;
}
```

- `isShowPower` (a consulta fica dentro da função, nunca em `const` de módulo):

```ts
const isShowPower = (keyIds: number[]) =>
  keyIds.length === 1 && keyIds[0] === leviathanShowPowerKeyId();
```

- Em `intendedMappings`, o filtro:

```ts
      .filter(({ keyIds, action }) => encodeMapping(keyIds, action) !== null)
```

- Em `preservedEvents`: `rebuilt.add(keyOf([leviathanShowPowerKeyId()]));`
- Se `MouseActionId` deixar de ser usado no import de `'@gearhub/shared'`, remova-o de lá (o `lint` reprova import não usado).

- [ ] **Step 2: `onboardConfig.ts`**

- Troque `import { actions, buttonIdsByKeyId, type EncodedAction } from './leviathanV4Keys';` por `import { actionForFunction, actionForKey, leviathanButtonId } from '../../core/coreBridge';`.
- Apague os dois mapas de módulo e o `for` que os preenche (`keyActions`, `functionActions`). Eles rodavam na importação; a consulta agora é por chamada.
- `namedAction`:

```ts
function namedAction(type: number, payload: Uint8Array): MouseActionId | null {
  if (type === CONFIG_TYPE_MOUSE_KEY && payload.length >= 3) {
    // [mod1, key_type, key_code, mod2]; a modifier has no action of its own.
    return payload[0] === 0 ? actionForKey(payload[1], payload[2]) : null;
  }
  if (type === CONFIG_TYPE_MOUSE_FUNCTION && payload.length >= 2) {
    // [touch_type, function, value_lo, value_hi]
    return actionForFunction(payload[1]);
  }
  return null;
}
```

- Em `settingsFromSlot`, troque as quatro ocorrências de `buttonIdsByKeyId.get(x)` por `leviathanButtonId(x)`. As guardas `if (buttonId && …)` e `if (!activator || !target || …)` continuam corretas com `null`.

- [ ] **Step 3: `writeProbe.ts`**

Troque `import { encodeLeviathanAction } from './LeviathanV4Driver';` por `encodeMapping` no import de `'../../core/coreBridge'`, e as três chamadas `encodeLeviathanAction(` por `encodeMapping(`. A sonda passa a montar a própria sequência com o **mesmo** encoder do driver — é a condição 2 da Decisão 1 do spec.

- [ ] **Step 4: Testes**

- `LeviathanV4Driver.test.ts`: remova `encodeLeviathanAction` do import e apague o teste `'encodes mouse, wheel, DPI and R-Plus actions as the vendor does'` — ele foi portado para `actions.rs` na Task 3 e está coberto pelos vetores e por `coreBridge.test.ts`.
- `onboardConfig.test.ts` e `onboardConfig.settings.test.ts`: troque `import { encodeLeviathanAction } from './LeviathanV4Driver';` por `encodeMapping` do `'../../core/coreBridge'` (junte ao import existente de `withProtocolEnvelope` se houver), `encodeLeviathanAction(` por `encodeMapping(`, e `Parameters<typeof encodeLeviathanAction>[1]` por `MouseActionId` (com `import type { MouseActionId } from '@gearhub/shared';`).
- `vectors.test.ts`: remova as linhas que conferem o TS (`encodeLeviathanAction`, `encodeMouseFunction` com as constantes, `physicalKeyIds`, `buttonIdsByKeyId`), os imports de `./leviathanV4Keys` e `./LeviathanV4Driver`, e apague o teste `'cobre toda tecla do Leviathan e toda ação'`, que lia as tabelas TS. A cobertura "toda ação tem vetor" fica com `every_action_has_a_mapping_vector`, no lado Rust, que lê o próprio enum.

- [ ] **Step 5: Apagar**

```bash
git rm apps/web/src/hardware/rawm/leviathanV4Keys.ts
```

Run: `grep -rn "leviathanV4Keys\|encodeLeviathanAction\|physicalKeyIds\|buttonIdsByKeyId\|TOUCH_TYPE_PRESS\|FUNCTION_SHOW_POWER\|SHOW_POWER_KEY_ID" apps/web/src packages/shared/src`
Expected: nenhuma ocorrência.

- [ ] **Step 6: Rodar tudo**

Run: `pnpm test`
Expected: PASS nos dois lados.

Run: `pnpm lint && pnpm run audit`
Expected: sem erros; o knip não aponta export sem uso.

- [ ] **Step 7: Commit**

```bash
pnpm format
git add -A apps/web/src
git commit -m "refactor: apagar leviathanV4Keys.ts e ler as tabelas do nucleo"
```

---

### Task 6: Fechar o passo

**Files:**

- Modify: `docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Spec**

Na `## Ordem corrigida`, ao fim do item 2, acrescente:

```markdown
**Fechado em 2026-09-28** pelo plano `docs/superpowers/plans/2026-09-28-migracao-tabelas-rawm.md`:
`leviathanV4Keys.ts` foi apagado; `MouseActionId` é um enum do núcleo e o tipo TypeScript é
gerado dele por `ts-rs`, versionado e conferido pelo `cargo test`.
```

- [ ] **Step 2: CLAUDE.md**

No parágrafo **Ainda em TypeScript**, remova `` `leviathanV4Keys.ts` (passo 2), `` (a frase passa a começar em `mouseParamSnapshot.ts`). Em `## O núcleo é gerado, nunca versionado`, ao final da seção, acrescente:

```markdown
**A exceção é `packages/shared/src/generated/`.** O `ts-rs` gera ali tipos TypeScript a partir
de enums do núcleo (hoje `MouseActionId`), e eles **são** versionados, para que
`@gearhub/shared` compile sem Rust. Um teste em `packages/core/src/device/actions.rs` compara o
arquivo com o que o `ts-rs` geraria e reprova se divergirem; para regenerar,
`UPDATE_BINDINGS=1 cargo test -p gearhub-core generated`. Nunca edite à mão, e não remova o
caminho dos `inputs` de `test` em `packages/core/turbo.json` — sem ele, uma edição à mão deixa
`@gearhub/core:test` em cache hit e a guarda não roda.
```

- [ ] **Step 3: Gate**

Run: `pnpm verify`
Expected: `format:check`, `lint`, `test`, `build` e `audit` passam.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md CLAUDE.md
git commit -m "docs: fechar o passo 2 da migracao do nucleo"
```

## Verificação em hardware

Não exigida pelo spec neste passo (só nos passos 3 a 5), e os vetores da Task 1 fixam os bytes que o mouse já confirmou antes de qualquer mudança. Um aplicar de configuração no Leviathan V4 depois do merge continua sendo a confirmação barata de que nada mudou no fio.

## Planos seguintes

Passo 3 — leitura do dispositivo: `mouseParamSnapshot.ts`, a metade de `leviathanV4.ts` que descreve o aparelho, a tabela de LOD e a identidade. Fecha a duplicata declarada de `packedDpi` e acrescenta arquivos a `packages/core/src/drivers/leviathan_v4/`.
