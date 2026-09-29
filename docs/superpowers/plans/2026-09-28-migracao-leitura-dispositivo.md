# Migração da leitura do dispositivo para o núcleo (passo 3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o passo 3 da migração: o snapshot de parâmetros (parse, encode, apply), a descrição do Leviathan V4 lida da consulta, a tabela de LOD e a identidade USB/nome passam para o núcleo; `mouseParamSnapshot.ts` é apagado; `MouseSettings` passa a ser gerado do Rust; a duplicata declarada de `packedDpi` fecha.

**Architecture:** Estruturas atravessam a ponte por `serde` + `serde-wasm-bindgen` (Decisão 3 do spec), e cada tipo TypeScript é gerado por `ts-rs` em `packages/shared/src/generated/`, conferido por um teste de guarda. O protocolo (layout do bloco de parâmetros, `pack_dpi`) fica em `protocols/rawm`; os fatos do aparelho (modos, limites, LOD, identidade, descrição) ficam em `drivers/leviathan_v4`. A casca passa a compor a descrição do núcleo com o que é desenho (foto, coordenadas, rótulos).

**Tech Stack:** Rust 2024, `serde` 1, `serde_json` 1, `indexmap` 2 (feature `serde`), `ts-rs` 12 (dev, feature `indexmap-impl`), `serde-wasm-bindgen` 0.6, `wasm-bindgen` 0.2, TypeScript 5.9, Vitest, pnpm + Turborepo.

**Spec:** `docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md` — seção `## Passo 3 — desenho (2026-09-28)`, e `## Como verificar cada passo`.

## Global Constraints

- **O núcleo não faz I/O, é síncrono, não conhece `wasm-bindgen`.** `serde`/`serde_json`/`indexmap` são permitidos no núcleo (Decisão 3). `serde-wasm-bindgen` só na ponte.
- **Migrar é apagar.** O passo só fecha quando `mouseParamSnapshot.ts` não existe, as interfaces escritas à mão de `MouseSettings`, `DpiStage`, `MouseParameters` e `MouseRPlusSettings` sumiram de `packages/shared/src/mouse.ts`, e as três cópias do regex do nome (`connectLeviathanV4.ts`, `diagnostics.ts`) e as constantes USB de `leviathanV4.ts` foram trocadas pelo núcleo.
- **Comportamento idêntico.** Mesmos bytes (provados pelos vetores capturados na Task 1), mesmas mensagens de erro ao usuário, mesma ordem de validação dos campos (o primeiro campo inválido é o que aparece na mensagem).
- **Única mudança de comportamento deliberada:** o driver passa a contar as memórias pela regra do núcleo (`ocs` contra `ocn`, teto 16) em vez de `ocs.length`.
- **Nenhuma chamada à ponte no escopo de módulo.** O WASM só está pronto depois do `init()`. Isso inclui `deviceRegistry.ts`, cujo array `deviceDefinitions` de módulo passa a ser uma função.
- **Erro novo que atravessa a ponte:** variante em `RawmError`, código estável em `code()`, entrada no teste exaustivo, texto em `apps/web/src/core/rawmError.ts`. Variantes com dado atravessam como `código:campo`.
- **Tipos gerados:** todos em `packages/shared/src/generated/`, nunca editados à mão, conferidos por `cargo test -p gearhub-core generated`; regenerar com `UPDATE_BINDINGS=1 cargo test -p gearhub-core generated`.
- **Vetor novo** vai em `packages/core/vectors/rawm-protocol.json`, lido por `cargo test` **e** `vitest`, cada seção protegida contra vazio dos dois lados.
- **Sem strings de interface no núcleo.** Rótulos ("Gaming+", "Baixo", "Memória 1", "Clique esquerdo") ficam na casca. Nomes de campo do firmware (`cpi`, `lod`) e ids (`office`, `esquerdo`) podem descer.
- **Nunca commitar `packages/core-wasm/pkg`.**
- **Formato:** `pnpm format` antes de cada commit.
- **Sem atribuição de IA em commits.** Nada de `Co-Authored-By`, `Generated with`, `Claude-Session`.
- **Gate final:** `pnpm verify`. **E confirmação em hardware** antes do merge (spec, passo 3).

## Notas de ambiente

1. **`pnpm core:build` antes de `pnpm --filter @gearhub/web exec vitest run …`.** Via `pnpm test` (turbo) o build acontece sozinho.
2. **Caminho por `process.cwd()`, nunca `import.meta.url`**, nos testes do Vitest.
3. **Toolchain GNU no Windows:** `winapi-util` está fixado em 0.1.9 no `Cargo.lock` (ver comentário em `packages/core/Cargo.toml`). Se um `cargo add`/`cargo update` o subir para 0.1.11, o build local falha com `dlltool.exe: program not found`; rode `cargo update -p winapi-util --precise 0.1.9`.
4. **`serde-wasm-bindgen` serializa mapas como `Map` do JS e `None` como `undefined` por padrão.** A ponte usa sempre `serde_wasm_bindgen::Serializer::json_compatible()`, que produz objetos comuns e `null` — é o que os tipos gerados declaram.
5. **Números vindos do JS:** um inteiro pode chegar ao `serde_json::Value` como `i64`, `u64` ou `f64` (`800.0`). Toda leitura numérica do JSON de consulta passa pelos helpers de `protocols/rawm/json.rs` (Task 3), nunca por `Value::as_i64` direto.
6. **`HIDDevice` do navegador não é objeto comum** (propriedades em getters do protótipo). O `coreBridge` o copia para um objeto simples antes de atravessar (Task 7).
7. **Shell:** comandos em Git Bash. Em PowerShell, `UPDATE_BINDINGS=1 cargo test …` vira `$env:UPDATE_BINDINGS='1'; cargo test …; Remove-Item Env:UPDATE_BINDINGS`.

---

## Estrutura de arquivos

**Criados (Rust):**

| arquivo                                                 | responsabilidade                                                     |
| ------------------------------------------------------- | -------------------------------------------------------------------- |
| `packages/core/src/bindings.rs`                         | `#[cfg(test)]`: guarda de todos os tipos gerados                     |
| `packages/core/src/device/settings.rs`                  | `MouseSettings`, `DpiStage`, `MouseParameters`, `MouseRPlusSettings` |
| `packages/core/src/protocols/rawm/json.rs`              | Leitura numérica tolerante do JSON de consulta                       |
| `packages/core/src/protocols/rawm/param_snapshot.rs`    | `MouseParamSnapshot`: parse e encode do bloco de parâmetros          |
| `packages/core/src/drivers/leviathan_v4/lod.rs`         | LOD: `raw` → milímetros, faixa                                       |
| `packages/core/src/drivers/leviathan_v4/identity.rs`    | USB, coleção de configuração, nome                                   |
| `packages/core/src/drivers/leviathan_v4/apply.rs`       | Modos de desempenho e `apply_settings`                               |
| `packages/core/src/drivers/leviathan_v4/description.rs` | Descrição do aparelho e contagem de memórias                         |

**Gerados (versionados):** em `packages/shared/src/generated/`: `DpiStage.ts`, `MouseParameters.ts`, `MouseRPlusSettings.ts`, `MouseSettings.ts`, `RawmMouseParamState.ts`, `LeviathanV4Usb.ts`, `DpiLimits.ts`, `NumericRange.ts`, `DpiAxes.ts`, `LeviathanV4Description.ts` (além do `MouseActionId.ts` existente).

**Modificados:** `rawm-protocol.json`, `packages/core/tests/vectors.rs`, `apps/web/src/test/vectors.ts`, `vectors.test.ts`, `leviathanV4Fixture.ts`, `Cargo.toml`s, `Cargo.lock`, `device/actions.rs`, `device/mod.rs`, `lib.rs`, `protocols/rawm/{mod,error,notify}.rs`, `drivers/leviathan_v4/{mod,keys}.rs`, `packages/core-wasm/src/lib.rs`, `coreBridge.ts`, `rawmError.ts`, `packages/shared/src/{mouse,index}.ts`, `leviathanV4.ts`, `leviathanV4Lod.ts`, `deviceRegistry.ts`, `connectLeviathanV4.ts`, `LeviathanV4Driver.ts`, `diagnostics.ts`, `writeProbe.ts`, `RawmDiagnosticPage.tsx`, `diagnostico.tsx`, testes correspondentes, spec, `CLAUDE.md`, `docs/smoke-test-leviathan-v4.md`.

**Apagado:** `apps/web/src/hardware/rawm/mouseParamSnapshot.ts`.

---

### Task 1: Vetores do bloco de parâmetros, capturados do TypeScript atual

Os bytes que o TS produz hoje são os confirmados em hardware. Fixá-los primeiro é o que permite migrar sem o mouse até a confirmação final.

**Files:**

- Modify: `packages/core/vectors/rawm-protocol.json`
- Modify: `apps/web/src/test/vectors.ts`
- Modify: `apps/web/src/hardware/rawm/vectors.test.ts`
- Modify: `apps/web/src/hardware/rawm/leviathanV4Fixture.ts`

**Interfaces:**

- Produces: seções JSON `queries` (objeto: nome → consulta), `paramSnapshot: {name, query, expected}[]`, `paramApply: {name, query, settings, expected}[]`, `invalidSnapshot: {name, query, patch, field}[]`. `patch` é um objeto: chave com `null` **remove** o campo, qualquer outro valor o substitui. `query` é uma chave de `queries`.
- Produces: `leviathanV4QueryFixture` continua exportado com o mesmo nome e tipo (`Record<string, unknown>`), agora lido de `queries["leviathan-v4-captura"]`.
- Produces (TS): `applyQueryPatch(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown>` em `apps/web/src/test/vectors.ts`.

- [ ] **Step 1: Acrescentar as seções ao JSON**

Em `packages/core/vectors/rawm-protocol.json`, depois de `"leviathanKeys": [...]`, acrescente (mantenha `"version": 1`):

```json
  "queries": {
    "leviathan-v4-captura": {
      "r": "G-1.2.3", "rc": 9, "dn": "LEVIATHAN V4", "pi": 9034, "vi": 6421, "battery": 31, "chr": 0,
      "cpi": 800, "polling": 4000, "light": 48,
      "cpi_l": [400, 800, 1600, 3200, 0, 0, 0, 0], "cpi_l_c": [1, 2, 6, 4, 0, 0, 0, 0],
      "ob": 0, "esb_addr": "00000000000000000000000000000000", "msg": "", "cn": 8, "pm": 3, "esb_ch": 0,
      "lod": 2, "lod_c": 0, "kd": [0, 0, 0, 0, 0, 0, 0], "ms": 1, "at": 0, "at2": 0, "as": 0,
      "rctrl": 0, "top": 8, "atp": 1, "co": "", "lz": 0, "st": 60, "rf_ch": 2, "crc": 1, "lua": 255,
      "noack": 0, "gm": [0, 0], "ocn": 4, "oci": 0, "ocs": [129, 130, 134, 132], "ec": 1, "dgom": 1,
      "sst": "PAW3950", "lbn": 128, "hc": 1, "rr": "G-1.0.0", "rrc": 1
    },
    "sintetica-51-bytes": {
      "dn": "Leviathan V4", "cpi": 1600, "polling": 1000, "light": 48,
      "cpi_l": [400, 800, 1600, 3200], "cpi_l_c": [1, 2, 3, 4], "ob": 2, "pm": 1, "lod": 2,
      "kd": [8, 8, 8, 8, 8, 8, 8], "ms": 1, "at": 0, "as": 1, "rctrl": 1, "top": 8, "co": [100, 90],
      "atp": 1, "ocs": [128, 129, 130, 131], "gm": [0, 0], "st": [128, 129, 130, 131]
    }
  },
  "paramSnapshot": [
    { "name": "corpo de 51 bytes confirmado", "query": "sintetica-51-bytes", "expected": "4006e8033004900120034006800c02010000000000020708080808080808010001010401020304080264005a0001048081828300" },
    { "name": "captura real, com o preenchimento de zeros", "query": "leviathan-v4-captura", "expected": "2003a00f3008900120034006800c00000000000000000003000000000002070000000000000001000000080102060400000000080001048182868400" }
  ],
  "paramApply": [
    {
      "name": "os padrões da captura reescrevem o mesmo corpo",
      "query": "leviathan-v4-captura",
      "settings": {"buttons":{"esquerdo":"clique-esquerdo","direito":"clique-direito","central":"clique-central","lateral-traseiro":"voltar","lateral-dianteiro":"avancar","dpi":"dpi-ciclo"},"dpiStages":[{"id":"estagio-1","x":400,"y":400},{"id":"estagio-2","x":800,"y":800},{"id":"estagio-3","x":1600,"y":1600},{"id":"estagio-4","x":3200,"y":3200}],"activeStageId":"estagio-2","independentAxes":false,"pollingRate":4000,"performanceMode":"gaming-plus","parameters":{"motionSync":true,"angleSnapping":false,"rippleControl":false,"wirelessTurbo":true,"liftOffDistance":2,"sensorRotation":0,"debounce":0,"sleepTimeout":1},"rPlus":{"activatorButtonId":"lateral-dianteiro","buttons":{"esquerdo":"desativado","direito":"desativado","central":"desativado","lateral-traseiro":"desativado","lateral-dianteiro":"desativado","dpi":"desativado"}}},
      "expected": "2003a00f3008900120034006800c00000000000000000003000000000002070000000000000001000000080102060400000000080001048182868400"
    },
    {
      "name": "polling, modo, turbo e motion sync",
      "query": "sintetica-51-bytes",
      "settings": {"buttons":{"esquerdo":"clique-esquerdo","direito":"clique-direito","central":"clique-central","lateral-traseiro":"voltar","lateral-dianteiro":"avancar","dpi":"dpi-ciclo"},"dpiStages":[{"id":"estagio-1","x":400,"y":400},{"id":"estagio-2","x":800,"y":800},{"id":"estagio-3","x":1600,"y":1600},{"id":"estagio-4","x":3200,"y":3200}],"activeStageId":"estagio-3","independentAxes":false,"pollingRate":4000,"performanceMode":"gaming-plus","parameters":{"motionSync":false,"angleSnapping":true,"rippleControl":true,"wirelessTurbo":false,"liftOffDistance":2,"sensorRotation":0,"debounce":0,"sleepTimeout":1},"rPlus":{"activatorButtonId":"lateral-dianteiro","buttons":{"esquerdo":"desativado","direito":"desativado","central":"desativado","lateral-traseiro":"desativado","lateral-dianteiro":"desativado","dpi":"desativado"}}},
      "expected": "4006a00f3004900120034006800c02030000000000020708080808080808000001010401020304000264005a0001048081828300"
    },
    {
      "name": "eixos independentes empacotam X nos 16 bits baixos e Y nos altos",
      "query": "leviathan-v4-captura",
      "settings": {"buttons":{"esquerdo":"clique-esquerdo","direito":"clique-direito","central":"clique-central","lateral-traseiro":"voltar","lateral-dianteiro":"avancar","dpi":"dpi-ciclo"},"dpiStages":[{"id":"estagio-1","x":400,"y":800},{"id":"estagio-2","x":1600,"y":1200}],"activeStageId":"estagio-2","independentAxes":true,"pollingRate":4000,"performanceMode":"gaming-plus","parameters":{"motionSync":true,"angleSnapping":false,"rippleControl":false,"wirelessTurbo":true,"liftOffDistance":2,"sensorRotation":0,"debounce":0,"sleepTimeout":1},"rPlus":{"activatorButtonId":"lateral-dianteiro","buttons":{"esquerdo":"desativado","direito":"desativado","central":"desativado","lateral-traseiro":"desativado","lateral-dianteiro":"desativado","dpi":"desativado"}}},
      "expected": "0000a00f300000034006b00408900120034006b00400000000000000000000000000000000000000000000000002070000000000000001000000080102060400000000080001048182868400"
    },
    {
      "name": "LOD, rotação negativa, angle snapping, ripple e modo office",
      "query": "leviathan-v4-captura",
      "settings": {"buttons":{"esquerdo":"clique-esquerdo","direito":"clique-direito","central":"clique-central","lateral-traseiro":"voltar","lateral-dianteiro":"avancar","dpi":"dpi-ciclo"},"dpiStages":[{"id":"estagio-1","x":400,"y":400},{"id":"estagio-2","x":800,"y":800},{"id":"estagio-3","x":1600,"y":1600},{"id":"estagio-4","x":3200,"y":3200}],"activeStageId":"estagio-2","independentAxes":false,"pollingRate":4000,"performanceMode":"office","parameters":{"motionSync":true,"angleSnapping":true,"rippleControl":true,"wirelessTurbo":true,"liftOffDistance":3,"sensorRotation":-10,"debounce":0,"sleepTimeout":1},"rPlus":{"activatorButtonId":"lateral-dianteiro","buttons":{"esquerdo":"desativado","direito":"desativado","central":"desativado","lateral-traseiro":"desativado","lateral-dianteiro":"desativado","dpi":"desativado"}}},
      "expected": "2003a00f3008900120034006800c00000000000000000000000000000003070000000000000001f60101080102060400000000080001048182868400"
    }
  ],
  "invalidSnapshot": [
    { "name": "lod ausente", "query": "leviathan-v4-captura", "patch": { "lod": null }, "field": "lod" },
    { "name": "kd vazio", "query": "leviathan-v4-captura", "patch": { "kd": [] }, "field": "kd" },
    { "name": "at fora de -128..127", "query": "leviathan-v4-captura", "patch": { "at": 200 }, "field": "at" },
    { "name": "gm em array curto", "query": "leviathan-v4-captura", "patch": { "gm": [1] }, "field": "gm" },
    { "name": "gm escalar fora de 0..1", "query": "leviathan-v4-captura", "patch": { "gm": 2 }, "field": "gm" },
    { "name": "cpi_l_c como texto que não é vazio", "query": "leviathan-v4-captura", "patch": { "cpi_l_c": "x" }, "field": "cpi_l_c" },
    { "name": "cpi zero", "query": "leviathan-v4-captura", "patch": { "cpi": 0 }, "field": "cpi" },
    { "name": "cpi fracionário", "query": "leviathan-v4-captura", "patch": { "cpi": 800.5 }, "field": "cpi" }
  ]
```

Todos os `expected` acima foram **produzidos rodando o TypeScript atual** (`parseMouseParamState` → `applySettingsToMouseParam` → `encodeMouseParamBody`), e os `settings` são os `defaults` de `createLeviathanV4Peripheral` com as mudanças que cada nome descreve. O Step 5 prova isso. Se algum reprovar, **o vetor está errado** — corrija-o para o que o TS atual produz e registre no relatório.

- [ ] **Step 2: Leitor TS**

Em `apps/web/src/test/vectors.ts`, acrescente os tipos (antes de `export interface ProtocolVectors`):

```ts
interface ParamSnapshotVector {
  name: string;
  query: string;
  expected: string;
}

interface ParamApplyVector {
  name: string;
  query: string;
  settings: MouseSettings;
  expected: string;
}

interface InvalidSnapshotVector {
  name: string;
  query: string;
  /** `null` remove o campo; qualquer outro valor o substitui. */
  patch: Record<string, unknown>;
  field: string;
}
```

os campos em `ProtocolVectors`:

```ts
  queries: Record<string, Record<string, unknown>>;
  paramSnapshot: ParamSnapshotVector[];
  paramApply: ParamApplyVector[];
  invalidSnapshot: InvalidSnapshotVector[];
```

troque o import de tipo para `import type { MouseActionId, MouseSettings } from '@gearhub/shared';`, e acrescente ao final do arquivo:

```ts
/** Aplica o `patch` de um vetor: `null` remove o campo, o resto substitui. */
export function applyQueryPatch(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const query = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete query[key];
    else query[key] = value;
  }
  return query;
}
```

- [ ] **Step 3: A fixture passa a ler dos vetores**

Em `apps/web/src/hardware/rawm/leviathanV4Fixture.ts`, mantenha o comentário de documentação do `leviathanV4QueryFixture` (acrescentando, ao final dele, a linha ` * The values live in packages/core/vectors/rawm-protocol.json, shared with the Rust tests.`) e troque o objeto literal por:

```ts
export const leviathanV4QueryFixture: Record<string, unknown> =
  readProtocolVectors().queries['leviathan-v4-captura'];
```

com `import { readProtocolVectors } from '../../test/vectors';` no topo. O `rawmReceiverQueryFixture` não muda.

- [ ] **Step 4: Testes contra a implementação atual**

Em `apps/web/src/hardware/rawm/vectors.test.ts`:

- acrescente ao import de `'../../test/vectors'` o `applyQueryPatch`;
- acrescente `import { applySettingsToMouseParam, encodeMouseParamBody, parseMouseParamState } from './mouseParamSnapshot';`;
- no teste `'tem vetores de todas as seções'`, acrescente:

```ts
requireNonEmpty(Object.keys(vectors.queries), 'queries');
requireNonEmpty(vectors.paramSnapshot, 'paramSnapshot');
requireNonEmpty(vectors.paramApply, 'paramApply');
requireNonEmpty(vectors.invalidSnapshot, 'invalidSnapshot');
```

- e, dentro do mesmo `describe`:

```ts
const query = (name: string) => {
  const found = vectors.queries[name];
  if (!found) throw new Error(`consulta de vetor desconhecida: ${name}`);
  return found;
};

it.each(vectors.paramSnapshot)('snapshot: $name', ({ query: name, expected }) => {
  expect(toHex(encodeMouseParamBody(parseMouseParamState(query(name))))).toBe(expected);
});

it.each(vectors.paramApply)('apply: $name', ({ query: name, settings, expected }) => {
  const next = applySettingsToMouseParam(parseMouseParamState(query(name)), settings);
  expect(toHex(encodeMouseParamBody(next))).toBe(expected);
});

it.each(vectors.invalidSnapshot)('snapshot inválido: $name', ({ query: name, patch, field }) => {
  expect(() => parseMouseParamState(applyQueryPatch(query(name), patch))).toThrow(
    `Snapshot RAWM incompleto ou invalido: ${field}.`,
  );
});
```

- [ ] **Step 5: Rodar**

Run: `pnpm core:build && pnpm --filter @gearhub/web exec vitest run src/hardware/rawm`
Expected: PASS em todos os arquivos, incluindo 2 casos de snapshot, 4 de apply e 8 de snapshot inválido, e os testes que usam `leviathanV4QueryFixture` (agora lida do JSON).

Run: `cargo test -p gearhub-core --test vectors`
Expected: PASS (o Rust ainda ignora as seções novas).

- [ ] **Step 6: Commit**

```bash
pnpm format
git add packages/core/vectors/rawm-protocol.json apps/web/src/test/vectors.ts apps/web/src/hardware/rawm/vectors.test.ts apps/web/src/hardware/rawm/leviathanV4Fixture.ts
git commit -m "test: fixar em vetores o bloco de parametros que o mouse ja confirmou"
```

---

### Task 2: `serde` no núcleo e `MouseSettings` gerado

**Files:**

- Create: `packages/core/src/device/settings.rs`
- Create: `packages/core/src/bindings.rs`
- Create (gerados): `packages/shared/src/generated/{DpiStage,MouseParameters,MouseRPlusSettings,MouseSettings}.ts`
- Modify: `packages/core/Cargo.toml`, `Cargo.lock`
- Modify: `packages/core/src/lib.rs`, `packages/core/src/device/mod.rs`, `packages/core/src/device/actions.rs`
- Modify: `packages/shared/src/mouse.ts`
- Modify: `docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md`

**Interfaces:**

- Produces: `gearhub_core::device::{MouseSettings, DpiStage, MouseParameters, MouseRPlusSettings}` com `Serialize + Deserialize + Debug + Clone + PartialEq`, campos em `snake_case` no Rust e `camelCase` no JSON. `MouseSettings.buttons` e `MouseRPlusSettings.buttons` são `IndexMap<String, MouseActionId>` (a ordem de inserção importa: é a ordem em que o driver envia os mapeamentos).
- Produces: `MouseActionId` passa a derivar `Serialize + Deserialize` com `#[serde(rename_all = "kebab-case")]`.
- Produces: `crate::bindings` (só em teste) com a lista `GENERATED` de tipos guardados; tarefas seguintes acrescentam entradas a ela.

- [ ] **Step 1: Dependências**

Em `packages/core/Cargo.toml`:

```toml
[dependencies]
indexmap = { version = "2", features = ["serde"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[dev-dependencies]
# Só em teste: gera os tipos TypeScript em packages/shared/src/generated/ e os
# confere contra os arquivos versionados. Fica fora do build do WASM.
#
# `winapi-util` está fixado em 0.1.9 no Cargo.lock: a 0.1.11 puxa
# `windows-sys` 0.61, que no toolchain GNU do Windows exige `dlltool.exe`. Um
# `cargo update` sem `--precise` desfaz o pin e o build local volta a falhar.
ts-rs = { version = "12", features = ["indexmap-impl"] }
```

(`serde` e `serde_json` saem de `[dev-dependencies]`, onde estavam só para os testes de vetor; `tests/vectors.rs` continua os usando normalmente.)

Run: `cargo update -p winapi-util --precise 0.1.9; cargo build -p gearhub-core`
Expected: compila; `Cargo.lock` mostra `winapi-util 0.1.9`.

- [ ] **Step 2: `MouseActionId` com serde**

Em `packages/core/src/device/actions.rs`, troque os atributos do enum por:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "kebab-case")]
#[cfg_attr(test, derive(ts_rs::TS))]
```

(o `#[cfg_attr(test, ts(rename_all = "kebab-case"))]` sai: o `ts-rs` lê o atributo do serde). **Mova** o teste `the_generated_typescript_matches_the_enum` e a constante `GENERATED`/função `generated()` para `bindings.rs` (Step 4); `as_str_names_exactly_the_generated_union` e `parse_is_the_inverse_of_as_str` ficam em `actions.rs`. Acrescente um teste que amarra o serde a `as_str`:

```rust
    #[test]
    fn serde_uses_the_same_ids_as_as_str() {
        for action in MouseActionId::ALL {
            assert_eq!(serde_json::to_value(action).unwrap(), action.as_str());
        }
    }
```

- [ ] **Step 3: `device/settings.rs`**

```rust
//! A configuração de um mouse como a casca a edita e o núcleo a aplica.
//!
//! Estes tipos são os donos de `MouseSettings` e de suas partes: o TypeScript
//! em `packages/shared/src/generated/` é gerado deles. `buttons` guarda a
//! ordem de inserção porque é a ordem em que os mapeamentos são enviados.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

use super::MouseActionId;

/// Um estágio de DPI, com os dois eixos.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct DpiStage {
    pub id: String,
    pub x: u32,
    pub y: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct MouseParameters {
    pub motion_sync: bool,
    pub angle_snapping: bool,
    pub ripple_control: bool,
    pub wireless_turbo: bool,
    pub lift_off_distance: u32,
    pub sensor_rotation: i32,
    pub debounce: u32,
    pub sleep_timeout: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct MouseRPlusSettings {
    pub activator_button_id: String,
    pub buttons: IndexMap<String, MouseActionId>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct MouseSettings {
    /// Button id to assigned action.
    pub buttons: IndexMap<String, MouseActionId>,
    pub dpi_stages: Vec<DpiStage>,
    pub active_stage_id: String,
    pub independent_axes: bool,
    pub polling_rate: u32,
    /// Null for models without selectable sensor power modes.
    pub performance_mode: Option<String>,
    pub parameters: MouseParameters,
    /// Null for models without an R-Plus secondary layer.
    pub r_plus: Option<MouseRPlusSettings>,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A casca manda o objeto como o editor o guarda; a ordem dos botões é a
    /// ordem de envio e não pode ser reordenada na travessia.
    #[test]
    fn round_trips_the_editor_shape_keeping_button_order() {
        let json = serde_json::json!({
            "buttons": { "dpi": "dpi-ciclo", "esquerdo": "clique-esquerdo" },
            "dpiStages": [{ "id": "estagio-1", "x": 400, "y": 800 }],
            "activeStageId": "estagio-1",
            "independentAxes": true,
            "pollingRate": 1000,
            "performanceMode": null,
            "parameters": {
                "motionSync": true, "angleSnapping": false, "rippleControl": false,
                "wirelessTurbo": true, "liftOffDistance": 2, "sensorRotation": -10,
                "debounce": 0, "sleepTimeout": 1
            },
            "rPlus": null
        });
        let settings: MouseSettings = serde_json::from_value(json.clone()).unwrap();
        assert_eq!(settings.buttons.keys().collect::<Vec<_>>(), ["dpi", "esquerdo"]);
        assert_eq!(settings.parameters.sensor_rotation, -10);
        assert_eq!(serde_json::to_value(&settings).unwrap(), json);
    }
}
```

Em `packages/core/src/device/mod.rs`:

```rust
pub mod actions;
pub mod capabilities;
pub mod registry;
pub mod settings;

pub use actions::MouseActionId;
pub use settings::{DpiStage, MouseParameters, MouseRPlusSettings, MouseSettings};
```

- [ ] **Step 4: `bindings.rs`, a guarda de todos os gerados**

`packages/core/src/bindings.rs`:

```rust
//! Guarda dos tipos TypeScript gerados em `packages/shared/src/generated/`.
//!
//! Os arquivos são versionados para que `@gearhub/shared` compile sem Rust.
//! Estes testes os impedem de divergir do núcleo: um campo novo, um rename, ou
//! uma edição à mão reprovam aqui, e um arquivo que nenhum tipo gera mais
//! também. Para regenerar: `UPDATE_BINDINGS=1 cargo test -p gearhub-core generated`.

use std::collections::BTreeSet;

use ts_rs::TS;

use crate::device::{DpiStage, MouseActionId, MouseParameters, MouseRPlusSettings, MouseSettings};

const DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../shared/src/generated");

fn render<T: TS>() -> String {
    T::export_to_string(&ts_rs::Config::default()).expect("ts-rs exporta")
}

/// Cada tipo guardado, pelo nome do arquivo que o `ts-rs` gera para ele.
fn generated() -> Vec<(&'static str, String)> {
    vec![
        ("MouseActionId", render::<MouseActionId>()),
        ("DpiStage", render::<DpiStage>()),
        ("MouseParameters", render::<MouseParameters>()),
        ("MouseRPlusSettings", render::<MouseRPlusSettings>()),
        ("MouseSettings", render::<MouseSettings>()),
    ]
}

#[test]
fn generated_typescript_matches_the_core() {
    let update = std::env::var_os("UPDATE_BINDINGS").is_some();
    let mut diverged = Vec::new();
    for (name, expected) in generated() {
        let path = format!("{DIR}/{name}.ts");
        if update {
            std::fs::write(&path, &expected).expect("escreve o arquivo gerado");
        }
        let committed = std::fs::read_to_string(&path)
            .unwrap_or_default()
            .replace("\r\n", "\n");
        if committed != expected {
            diverged.push(name);
        }
    }
    assert!(
        diverged.is_empty(),
        "tipos gerados divergiram do núcleo: {diverged:?}; rode UPDATE_BINDINGS=1 cargo test -p gearhub-core generated"
    );
}

#[test]
fn generated_directory_holds_only_what_the_core_generates() {
    let expected: BTreeSet<String> =
        generated().into_iter().map(|(name, _)| format!("{name}.ts")).collect();
    let present: BTreeSet<String> = std::fs::read_dir(DIR)
        .expect("diretório gerado presente")
        .map(|entry| entry.expect("entrada").file_name().to_string_lossy().into_owned())
        .collect();
    assert_eq!(present, expected, "arquivo órfão ou ausente em packages/shared/src/generated");
}
```

Em `packages/core/src/lib.rs`, depois de `pub mod protocols;`:

```rust
#[cfg(test)]
mod bindings;
```

- [ ] **Step 5: Ver a guarda reprovar, e gerar**

Run: `cargo test -p gearhub-core generated`
Expected: FAIL em `generated_typescript_matches_the_core` listando `DpiStage`, `MouseParameters`, `MouseRPlusSettings`, `MouseSettings` (e **não** `MouseActionId` — se ele aparecer, o serde mudou o arquivo, e isso tem de ser investigado antes de regenerar).

Run: `UPDATE_BINDINGS=1 cargo test -p gearhub-core generated && cargo test -p gearhub-core`
Expected: PASS. `git diff --stat packages/shared/src/generated/MouseActionId.ts` vazio.

- [ ] **Step 6: `@gearhub/shared` passa a usar os tipos gerados**

Em `packages/shared/src/mouse.ts`, apague as interfaces `DpiStage`, `MouseParameters`, `MouseRPlusSettings` e `MouseSettings` (com seus comentários) e, no topo, junto ao import existente de `MouseActionId`:

```ts
import type { DpiStage } from './generated/DpiStage';
import type { MouseActionId } from './generated/MouseActionId';
import type { MouseParameters } from './generated/MouseParameters';
import type { MouseRPlusSettings } from './generated/MouseRPlusSettings';
import type { MouseSettings } from './generated/MouseSettings';
```

e, no lugar onde as interfaces estavam:

```ts
/**
 * The editor's configuration. Generated from the core's `device/settings.rs`;
 * `cargo test` fails when the two diverge.
 */
export type { DpiStage, MouseParameters, MouseRPlusSettings, MouseSettings };
```

`MouseParameterId = keyof MouseParameters` continua como está. `packages/shared/src/index.ts` não muda.

- [ ] **Step 7: Emenda ao spec**

Na seção `## Passo 3 — desenho (2026-09-28)` do spec, troque a frase

`- \`RawmMouseParamState\` é interno do protocolo: gerado em \`apps/web/src/core/generated/\`, não em \`@gearhub/shared\`.`

por

`- Todos os tipos gerados moram em \`packages/shared/src/generated/\`, inclusive \`RawmMouseParamState\`, que é interno do protocolo. O \`ts-rs\` escreve os \`import\` entre tipos gerados como caminhos relativos ao mesmo diretório (\`./MouseSettings\`), e a descrição do aparelho referencia \`MouseSettings\`: separar os diretórios quebraria esses imports.`

- [ ] **Step 8: Verificar**

Run: `pnpm --filter @gearhub/shared lint && pnpm core:build && pnpm --filter @gearhub/web lint && cargo clippy --workspace --all-targets -- -D warnings && pnpm format:check`
Expected: tudo passa. Se o `tsc` da web reprovar por diferença de forma (um campo opcional virou obrigatório, por exemplo), **pare e reporte** — o tipo gerado tem de ser idêntico em forma ao que existia.

- [ ] **Step 9: Commit**

```bash
pnpm format
git add packages/core/Cargo.toml Cargo.lock packages/core/src packages/shared/src docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md
git commit -m "feat: MouseSettings passa a ser do nucleo e gerado para TypeScript"
```

---

### Task 3: O bloco de parâmetros no núcleo, e `pack_dpi`

**Files:**

- Create: `packages/core/src/protocols/rawm/json.rs`
- Create: `packages/core/src/protocols/rawm/param_snapshot.rs`
- Modify: `packages/core/src/protocols/rawm/mod.rs`, `error.rs`, `notify.rs`
- Modify: `packages/core/src/bindings.rs`
- Create (gerado): `packages/shared/src/generated/RawmMouseParamState.ts`
- Modify: `packages/core/tests/vectors.rs`

**Interfaces:**

- Produces (`gearhub_core::protocols::rawm`): `MouseParamSnapshot` (18 campos, `Serialize + Deserialize`, TS `RawmMouseParamState`); `parse_mouse_param_snapshot(raw: &serde_json::Value) -> Result<MouseParamSnapshot, RawmError>`; `encode_mouse_param_body(state: &MouseParamSnapshot) -> Vec<u8>`; `pack_dpi(x: u32, y: u32, independent_axes: bool) -> u32`.
- Produces (`pub(crate)`): `protocols::rawm::json::{integer(&Value) -> Option<i64>, number(&Value) -> Option<f64>}`.
- Produces: `RawmError::InvalidSnapshotField { field: &'static str }` (código `invalid-snapshot-field`) e `RawmError::detail(&self) -> Option<&'static str>`.

- [ ] **Step 1: Testes de vetor (falham por não compilar)**

Em `packages/core/tests/vectors.rs`: acrescente ao `use` de `gearhub_core::protocols::rawm` os nomes `RawmError, encode_mouse_param_body, parse_mouse_param_snapshot`; as structs

```rust
#[derive(Deserialize)]
struct ParamSnapshotVector {
    name: String,
    query: String,
    expected: String,
}

#[derive(Deserialize)]
struct InvalidSnapshotVector {
    name: String,
    query: String,
    patch: serde_json::Map<String, serde_json::Value>,
    field: String,
}
```

os campos em `Vectors`:

```rust
    queries: std::collections::HashMap<String, serde_json::Value>,
    param_snapshot: Vec<ParamSnapshotVector>,
    invalid_snapshot: Vec<InvalidSnapshotVector>,
```

os helpers

```rust
fn query(vectors: &Vectors, name: &str) -> serde_json::Value {
    vectors.queries.get(name).cloned().unwrap_or_else(|| panic!("consulta desconhecida: {name}"))
}

/// `null` remove o campo; qualquer outro valor o substitui.
fn patched(mut base: serde_json::Value, patch: &serde_json::Map<String, serde_json::Value>) -> serde_json::Value {
    let object = base.as_object_mut().expect("consulta é objeto");
    for (key, value) in patch {
        if value.is_null() {
            object.remove(key);
        } else {
            object.insert(key.clone(), value.clone());
        }
    }
    base
}
```

e os testes

```rust
#[test]
fn param_snapshot_matches_the_shared_vectors() {
    let vectors = vectors();
    require_non_empty(&vectors.param_snapshot, "paramSnapshot");
    for vector in &vectors.param_snapshot {
        let state = parse_mouse_param_snapshot(&query(&vectors, &vector.query))
            .unwrap_or_else(|error| panic!("{}: {error:?}", vector.name));
        assert_eq!(to_hex(&encode_mouse_param_body(&state)), vector.expected, "{}", vector.name);
    }
}

#[test]
fn invalid_snapshots_name_the_field_that_fails() {
    let vectors = vectors();
    require_non_empty(&vectors.invalid_snapshot, "invalidSnapshot");
    for vector in &vectors.invalid_snapshot {
        let raw = patched(query(&vectors, &vector.query), &vector.patch);
        match parse_mouse_param_snapshot(&raw) {
            Err(RawmError::InvalidSnapshotField { field }) => {
                assert_eq!(field, vector.field, "{}", vector.name)
            }
            other => panic!("{}: esperava campo inválido, veio {other:?}", vector.name),
        }
    }
}
```

Run: `cargo test -p gearhub-core --test vectors`
Expected: FAIL de compilação.

- [ ] **Step 2: O erro com dado**

Em `packages/core/src/protocols/rawm/error.rs`, acrescente a variante:

```rust
    /// Campo do snapshot de parâmetros ausente, do tipo errado ou fora da faixa.
    /// `field` é o nome como o firmware o envia (`cpi`, `lod`).
    InvalidSnapshotField { field: &'static str },
```

o braço em `code()`:

```rust
            Self::InvalidSnapshotField { .. } => "invalid-snapshot-field",
```

o método

```rust
    /// O dado que acompanha o código, quando há um. A ponte o envia junto
    /// (`código:dado`), e a casca o usa para montar a mensagem.
    pub fn detail(&self) -> Option<&'static str> {
        match self {
            Self::InvalidSnapshotField { field } => Some(field),
            _ => None,
        }
    }
```

e, no teste exaustivo, `assert_eq!(RawmError::InvalidSnapshotField { field: "cpi" }.code(), "invalid-snapshot-field");` mais um teste:

```rust
    #[test]
    fn only_variants_with_data_carry_a_detail() {
        assert_eq!(RawmError::InvalidSnapshotField { field: "lod" }.detail(), Some("lod"));
        assert_eq!(RawmError::EventTooLong.detail(), None);
    }
```

- [ ] **Step 3: `json.rs`**

```rust
//! Leitura numérica do JSON de consulta.
//!
//! O mesmo número chega de formas diferentes conforme o caminho: `800` lido
//! pelo `serde_json` é inteiro, mas vindo de um objeto JS pela ponte pode ser
//! `800.0`. Estes helpers aceitam os dois e reproduzem o que a casca fazia com
//! `Number.isInteger` e `typeof === 'number'`.

use serde_json::Value;

/// O maior inteiro que um `number` do JS representa sem perda.
const MAX_SAFE_INTEGER: f64 = 9_007_199_254_740_991.0;

/// `Some` quando o valor é um número inteiro, como `Number.isInteger`.
pub(crate) fn integer(value: &Value) -> Option<i64> {
    let number = value.as_number()?;
    if let Some(integer) = number.as_i64() {
        return Some(integer);
    }
    if let Some(unsigned) = number.as_u64() {
        return i64::try_from(unsigned).ok();
    }
    let float = number.as_f64()?;
    (float.fract() == 0.0 && float.abs() <= MAX_SAFE_INTEGER).then_some(float as i64)
}

/// `Some` quando o valor é um número finito, como `typeof === 'number'`.
pub(crate) fn number(value: &Value) -> Option<f64> {
    value.as_f64()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn integers_arrive_as_integers_or_as_whole_floats() {
        assert_eq!(integer(&json!(800)), Some(800));
        assert_eq!(integer(&json!(800.0)), Some(800));
        assert_eq!(integer(&json!(-3)), Some(-3));
        assert_eq!(integer(&json!(800.5)), None);
        assert_eq!(integer(&json!("800")), None);
        assert_eq!(integer(&Value::Null), None);
    }

    #[test]
    fn numbers_accept_fractions_but_not_text() {
        assert_eq!(number(&json!(0.5)), Some(0.5));
        assert_eq!(number(&json!("0.5")), None);
    }
}
```

- [ ] **Step 4: `param_snapshot.rs`**

```rust
//! O bloco de parâmetros do mouse: lido do JSON de consulta, escrito em binário.
//!
//! O layout é do protocolo RAWM (`CONFIG_TYPE_MOUSE_PARAM`), não de um
//! aparelho. A leitura é estrita de propósito: um campo que falta não é
//! preenchido com um padrão, porque reescrever o bloco com um valor inventado
//! apagaria o que o mouse tinha.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::error::RawmError;
use super::json::integer;

/// O bloco como o firmware o descreve. Os nomes em TS são os que as sondas
/// comparam campo a campo.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(rename = "RawmMouseParamState"))]
pub struct MouseParamSnapshot {
    pub resolution: u32,
    pub polling_rate: u32,
    pub light: u32,
    pub cpi_levels: Vec<u32>,
    pub onboard: u32,
    pub power_mode: u32,
    pub lift_off_distance: u32,
    pub key_delay: Vec<u32>,
    pub motion_sync: u32,
    pub angle_tuning: i32,
    pub angle_snapping: u32,
    pub ripple_control: u32,
    pub cpi_level_colors: Vec<u32>,
    pub tx_output_power: u32,
    pub battery_levels: Vec<u32>,
    pub auto_tx_power: u32,
    pub onboard_status: Vec<u32>,
    pub glass_mode: u32,
}

fn invalid(field: &'static str) -> RawmError {
    RawmError::InvalidSnapshotField { field }
}

fn scalar(raw: &Value, field: &'static str, min: i64, max: i64) -> Result<i64, RawmError> {
    raw.get(field)
        .and_then(integer)
        .filter(|value| (min..=max).contains(value))
        .ok_or(invalid(field))
}

/// `allow_empty`: o firmware manda `""` em vez de `[]` para uma tabela de
/// calibração vazia.
fn list(
    raw: &Value,
    field: &'static str,
    min: i64,
    max: i64,
    allow_empty: bool,
) -> Result<Vec<u32>, RawmError> {
    let value = raw.get(field).ok_or(invalid(field))?;
    if allow_empty && value.as_str() == Some("") {
        return Ok(Vec::new());
    }
    let items = value.as_array().ok_or(invalid(field))?;
    if (!allow_empty && items.is_empty()) || items.len() > 255 {
        return Err(invalid(field));
    }
    items
        .iter()
        .map(|item| {
            integer(item)
                .filter(|value| (min..=max).contains(value))
                .map(|value| value as u32)
                .ok_or(invalid(field))
        })
        .collect()
}

/// `gm` chega como `[x, ligado]` nesta firmware, ou como escalar 0/1.
fn glass_mode(raw: &Value) -> Result<u32, RawmError> {
    if let Some(items) = raw.get("gm").and_then(Value::as_array) {
        let values: Option<Vec<i64>> = items.iter().map(integer).collect();
        return match values {
            Some(values) if values.len() >= 2 => Ok(u32::from(values[1] != 0)),
            _ => Err(invalid("gm")),
        };
    }
    scalar(raw, "gm", 0, 1).map(|value| value as u32)
}

/// Lê o bloco da resposta de consulta. Os campos são validados na ordem abaixo,
/// e o primeiro que falhar é o que o erro nomeia.
pub fn parse_mouse_param_snapshot(raw: &Value) -> Result<MouseParamSnapshot, RawmError> {
    Ok(MouseParamSnapshot {
        resolution: scalar(raw, "cpi", 1, 0xffff_ffff)? as u32,
        polling_rate: scalar(raw, "polling", 1, 0xffff)? as u32,
        light: scalar(raw, "light", 0, 0xff)? as u32,
        // Os estágios sem uso chegam como zeros; o array tem largura fixa.
        cpi_levels: list(raw, "cpi_l", 0, 0xffff_ffff, false)?,
        onboard: scalar(raw, "ob", 0, 0xff)? as u32,
        power_mode: scalar(raw, "pm", 0, 0xff)? as u32,
        lift_off_distance: scalar(raw, "lod", 0, 0xff)? as u32,
        key_delay: list(raw, "kd", 0, 0xff, false)?,
        motion_sync: scalar(raw, "ms", 0, 1)? as u32,
        angle_tuning: scalar(raw, "at", -128, 127)? as i32,
        angle_snapping: scalar(raw, "as", 0, 1)? as u32,
        ripple_control: scalar(raw, "rctrl", 0, 1)? as u32,
        cpi_level_colors: list(raw, "cpi_l_c", 0, 7, true)?,
        tx_output_power: scalar(raw, "top", 0, 0xff)? as u32,
        battery_levels: list(raw, "co", 0, 0xffff, true)?,
        auto_tx_power: scalar(raw, "atp", 0, 1)? as u32,
        onboard_status: list(raw, "ocs", 0, 0xff, false)?,
        glass_mode: glass_mode(raw)?,
    })
}

fn push_u16(output: &mut Vec<u8>, value: u32) {
    output.extend_from_slice(&[value as u8, (value >> 8) as u8]);
}

fn push_u32(output: &mut Vec<u8>, value: u32) {
    output.extend_from_slice(&value.to_le_bytes());
}

/// Um valor acima de 16 bits só cabe como CPI2, com os eixos empacotados.
fn is_packed_axes(value: u32) -> bool {
    value > 0xffff
}

/// O corpo binário do bloco. Com eixos independentes, a resolução e os
/// estágios vão nos campos de 32 bits e os de 16 bits ficam zerados.
pub fn encode_mouse_param_body(state: &MouseParamSnapshot) -> Vec<u8> {
    let independent =
        is_packed_axes(state.resolution) || state.cpi_levels.iter().copied().any(is_packed_axes);
    let mut output = Vec::with_capacity(64);

    push_u16(&mut output, if independent { 0 } else { state.resolution });
    push_u16(&mut output, state.polling_rate);
    output.push(state.light as u8);
    output.push(if independent { 0 } else { state.cpi_levels.len() as u8 });
    if !independent {
        for &level in &state.cpi_levels {
            push_u16(&mut output, level);
        }
    }
    output.extend_from_slice(&[state.onboard as u8, state.power_mode as u8]);
    push_u32(&mut output, if independent { state.resolution } else { 0 });
    output.push(if independent { state.cpi_levels.len() as u8 } else { 0 });
    if independent {
        for &level in &state.cpi_levels {
            push_u32(&mut output, level);
        }
    }
    output.extend_from_slice(&[state.lift_off_distance as u8, state.key_delay.len() as u8]);
    output.extend(state.key_delay.iter().map(|&delay| delay as u8));
    output.extend_from_slice(&[
        state.motion_sync as u8,
        (state.angle_tuning & 0xff) as u8,
        state.angle_snapping as u8,
        state.ripple_control as u8,
        state.cpi_level_colors.len() as u8,
    ]);
    output.extend(state.cpi_level_colors.iter().map(|&color| (color & 0x07) as u8));
    output.extend_from_slice(&[state.tx_output_power as u8, state.battery_levels.len() as u8]);
    for &level in &state.battery_levels {
        push_u16(&mut output, level);
    }
    output.extend_from_slice(&[state.auto_tx_power as u8, state.onboard_status.len() as u8]);
    output.extend(state.onboard_status.iter().map(|&status| status as u8));
    output.push(state.glass_mode as u8);
    output
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn synthetic() -> Value {
        json!({
            "dn": "Leviathan V4", "cpi": 1600, "polling": 1000, "light": 48,
            "cpi_l": [400, 800, 1600, 3200], "cpi_l_c": [1, 2, 3, 4], "ob": 2, "pm": 1, "lod": 2,
            "kd": [8, 8, 8, 8, 8, 8, 8], "ms": 1, "at": 0, "as": 1, "rctrl": 1, "top": 8,
            "co": [100, 90], "atp": 1, "ocs": [128, 129, 130, 131], "gm": [0, 0]
        })
    }

    #[test]
    fn recreates_the_confirmed_51_byte_body() {
        let body = encode_mouse_param_body(&parse_mouse_param_snapshot(&synthetic()).unwrap());
        assert_eq!(body.len(), 51);
        assert_eq!(&body[..4], &[0x40, 0x06, 0xe8, 0x03]);
    }

    #[test]
    fn rejects_a_missing_field_instead_of_filling_a_default() {
        let mut raw = synthetic();
        raw.as_object_mut().unwrap().remove("kd");
        assert_eq!(
            parse_mouse_param_snapshot(&raw),
            Err(RawmError::InvalidSnapshotField { field: "kd" })
        );
    }

    #[test]
    fn accepts_an_empty_string_for_the_calibration_tables() {
        let mut raw = synthetic();
        raw["co"] = json!("");
        raw["cpi_l_c"] = json!("");
        let state = parse_mouse_param_snapshot(&raw).unwrap();
        assert!(state.battery_levels.is_empty());
        assert!(state.cpi_level_colors.is_empty());
    }

    #[test]
    fn reads_the_glass_mode_from_the_second_slot_or_a_scalar() {
        let mut raw = synthetic();
        raw["gm"] = json!([0, 5]);
        assert_eq!(parse_mouse_param_snapshot(&raw).unwrap().glass_mode, 1);
        raw["gm"] = json!(1);
        assert_eq!(parse_mouse_param_snapshot(&raw).unwrap().glass_mode, 1);
    }

    #[test]
    fn accepts_whole_floats_the_bridge_may_deliver() {
        let mut raw = synthetic();
        raw["cpi"] = json!(1600.0);
        assert_eq!(parse_mouse_param_snapshot(&raw).unwrap().resolution, 1600);
    }

    #[test]
    fn packed_axes_move_resolution_and_stages_to_the_32_bit_fields() {
        let mut state = parse_mouse_param_snapshot(&synthetic()).unwrap();
        state.resolution = 0x0320_0190;
        let body = encode_mouse_param_body(&state);
        assert_eq!(&body[..2], &[0, 0], "campo de 16 bits zerado");
    }
}
```

Em `packages/core/src/protocols/rawm/mod.rs`: acrescente `mod json;` (use `pub(crate) mod json;` — a descrição do Leviathan, na Task 6, usa os helpers) e `mod param_snapshot;`, e reexporte:

```rust
pub use param_snapshot::{MouseParamSnapshot, encode_mouse_param_body, parse_mouse_param_snapshot};
```

além de `pack_dpi` junto de `dpi_axes` no `pub use notify::{…}`.

- [ ] **Step 5: `pack_dpi`**

Em `packages/core/src/protocols/rawm/notify.rs`, logo depois de `dpi_axes`:

```rust
/// O inverso de `dpi_axes`, para escrever: X nos 16 bits baixos, Y nos altos.
/// Sem eixos independentes o valor é só X — o firmware lê Y zerado como igual a X.
pub fn pack_dpi(x: u32, y: u32, independent_axes: bool) -> u32 {
    if independent_axes { (x & 0xffff) | ((y & 0xffff) << 16) } else { x }
}
```

e, no `mod tests` do arquivo:

```rust
    /// A duplicata declarada de `packedDpi` fecha aqui: as duas direções moram
    /// no mesmo arquivo e se provam uma pela outra.
    #[test]
    fn pack_dpi_is_the_inverse_of_dpi_axes() {
        for (x, y) in [(400, 800), (1600, 1200), (45000, 100), (800, 800)] {
            let (read_x, read_y) = dpi_axes(pack_dpi(x, y, true));
            assert_eq!((u32::from(read_x), u32::from(read_y)), (x, y));
        }
        assert_eq!(pack_dpi(800, 1600, false), 800);
    }
```

- [ ] **Step 6: Tipo gerado**

Em `packages/core/src/bindings.rs`, acrescente `use crate::protocols::rawm::MouseParamSnapshot;` e, em `generated()`, a entrada `("RawmMouseParamState", render::<MouseParamSnapshot>()),`.

Run: `UPDATE_BINDINGS=1 cargo test -p gearhub-core generated && cargo test -p gearhub-core`
Expected: PASS, com `packages/shared/src/generated/RawmMouseParamState.ts` criado e os dois testes novos de `tests/vectors.rs` passando.

Run: `cargo clippy --workspace --all-targets -- -D warnings`
Expected: sem avisos.

- [ ] **Step 7: Commit**

```bash
pnpm format
git add packages/core/src packages/core/tests/vectors.rs packages/shared/src/generated
git commit -m "feat: bloco de parametros e pack_dpi no nucleo"
```

---

### Task 4: LOD e identidade do Leviathan V4

**Files:**

- Create: `packages/core/src/drivers/leviathan_v4/lod.rs`
- Create: `packages/core/src/drivers/leviathan_v4/identity.rs`
- Modify: `packages/core/src/drivers/leviathan_v4/mod.rs`
- Modify: `packages/core/src/bindings.rs`
- Create (gerados): `packages/shared/src/generated/{LeviathanV4Usb,NumericRange}.ts`

**Interfaces:**

- Produces (`gearhub_core::drivers::leviathan_v4`): `lod_millimetres(raw: u32) -> Option<f64>`; `lod_range() -> NumericRange`; `NumericRange { min: i32, max: i32, step: i32 }` (`Serialize`, TS `NumericRange`); `usb() -> LeviathanV4Usb` (`LeviathanV4Usb { vendor_id: u16, receiver_product_id: u16, config_usage_page: u16, config_usage: u16 }`, `Serialize`); `HidDevice`, `HidCollection`, `HidReport` (`Deserialize`, camelCase); `matches(device: &HidDevice) -> bool`; `is_device_name(name: &str) -> bool`.

- [ ] **Step 1: `lod.rs`**

```rust
//! Distância de levantamento (LOD).
//!
//! O aparelho guarda um índice, não uma distância: relata `lod: 2` para um
//! mouse a 1,0 mm. Os milímetros foram confirmados no software oficial. Os
//! nomes dos níveis (Baixo, Médio, Alto) são texto de tela e ficam na casca.

use serde::Serialize;

/// Uma faixa inteira que um controle da casca deve respeitar.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct NumericRange {
    pub min: i32,
    pub max: i32,
    pub step: i32,
}

/// `raw` como o snapshot guarda, e a distância que ele significa.
const LEVELS: [(u32, f64); 3] = [(1, 0.7), (2, 1.0), (3, 2.0)];

pub fn lod_millimetres(raw: u32) -> Option<f64> {
    LEVELS.iter().find(|&&(level, _)| level == raw).map(|&(_, millimetres)| millimetres)
}

pub fn lod_range() -> NumericRange {
    NumericRange { min: LEVELS[0].0 as i32, max: LEVELS[LEVELS.len() - 1].0 as i32, step: 1 }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_level_has_the_distance_the_official_software_shows() {
        assert_eq!(lod_millimetres(1), Some(0.7));
        assert_eq!(lod_millimetres(2), Some(1.0));
        assert_eq!(lod_millimetres(3), Some(2.0));
        assert_eq!(lod_millimetres(9), None);
    }

    #[test]
    fn the_range_spans_exactly_the_known_levels() {
        assert_eq!(lod_range(), NumericRange { min: 1, max: 3, step: 1 });
    }
}
```

- [ ] **Step 2: `identity.rs`**

```rust
//! Como reconhecer um Leviathan V4: o receptor USB e o nome que o mouse relata.

use serde::{Deserialize, Serialize};

const VENDOR_ID: u16 = 0x1915;
const RECEIVER_PRODUCT_ID: u16 = 0x2346;
/// A coleção vendor por onde o receptor fala o protocolo de configuração.
const CONFIG_USAGE_PAGE: u16 = 0xff00;
const CONFIG_USAGE: u16 = 0x0001;

/// Os números que a casca usa para montar o filtro do seletor WebHID.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct LeviathanV4Usb {
    pub vendor_id: u16,
    pub receiver_product_id: u16,
    pub config_usage_page: u16,
    pub config_usage: u16,
}

pub fn usb() -> LeviathanV4Usb {
    LeviathanV4Usb {
        vendor_id: VENDOR_ID,
        receiver_product_id: RECEIVER_PRODUCT_ID,
        config_usage_page: CONFIG_USAGE_PAGE,
        config_usage: CONFIG_USAGE,
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HidReport {
    pub report_id: u8,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HidCollection {
    pub usage_page: u16,
    pub usage: u16,
    #[serde(default)]
    pub input_reports: Vec<HidReport>,
    #[serde(default)]
    pub output_reports: Vec<HidReport>,
}

/// O que a casca sabe de um dispositivo HID antes de abri-lo.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HidDevice {
    pub vendor_id: u16,
    pub product_id: u16,
    pub collections: Vec<HidCollection>,
}

/// A coleção de configuração tem de ler e escrever pelo relatório 0: uma
/// interface irmã do mesmo receptor não responde a uma consulta.
fn is_config_collection(collection: &HidCollection) -> bool {
    let has_report_zero = |reports: &[HidReport]| reports.iter().any(|report| report.report_id == 0);
    collection.usage_page == CONFIG_USAGE_PAGE
        && collection.usage == CONFIG_USAGE
        && has_report_zero(&collection.input_reports)
        && has_report_zero(&collection.output_reports)
}

pub fn matches(device: &HidDevice) -> bool {
    device.vendor_id == VENDOR_ID
        && device.product_id == RECEIVER_PRODUCT_ID
        && device.collections.iter().any(is_config_collection)
}

/// O nome que o mouse relata em `dn`: `Leviathan` em qualquer caixa, ou
/// `魔鲸 V4` como o firmware chinês o chama.
pub fn is_device_name(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.contains("leviathan")
        || lower
            .match_indices("魔鲸")
            .any(|(index, found)| lower[index + found.len()..].trim_start().starts_with("v4"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn receiver(collections: Vec<HidCollection>) -> HidDevice {
        HidDevice { vendor_id: 0x1915, product_id: 0x2346, collections }
    }

    fn config_collection() -> HidCollection {
        HidCollection {
            usage_page: 0xff00,
            usage: 0x0001,
            input_reports: vec![HidReport { report_id: 0 }],
            output_reports: vec![HidReport { report_id: 0 }],
        }
    }

    #[test]
    fn matches_the_receiver_with_the_bidirectional_config_collection() {
        assert!(matches(&receiver(vec![config_collection()])));
    }

    #[test]
    fn rejects_a_sibling_interface_and_a_one_way_collection() {
        let consumer = HidCollection { usage_page: 0x000c, ..config_collection() };
        assert!(!matches(&receiver(vec![consumer])));
        let input_only = HidCollection { output_reports: vec![], ..config_collection() };
        assert!(!matches(&receiver(vec![input_only])));
        assert!(!matches(&receiver(vec![])));
    }

    #[test]
    fn does_not_guess_support_for_another_product_of_the_vendor() {
        let mut device = receiver(vec![config_collection()]);
        device.product_id = 0xffff;
        assert!(!matches(&device));
    }

    #[test]
    fn recognises_the_names_the_firmware_reports() {
        assert!(is_device_name("LEVIATHAN V4"));
        assert!(is_device_name("Leviathan V4"));
        assert!(is_device_name("魔鲸 V4"));
        assert!(is_device_name("魔鲸v4"));
        assert!(!is_device_name("RAWM HS Receiver"));
        assert!(!is_device_name("魔鲸 V3"));
        assert!(!is_device_name(""));
    }

    #[test]
    fn usb_numbers_are_the_receiver_s() {
        assert_eq!(
            usb(),
            LeviathanV4Usb {
                vendor_id: 0x1915,
                receiver_product_id: 0x2346,
                config_usage_page: 0xff00,
                config_usage: 0x0001
            }
        );
    }
}
```

- [ ] **Step 3: Reexportar e gerar**

Em `packages/core/src/drivers/leviathan_v4/mod.rs`:

```rust
//! O Leviathan V4: o que é fato deste aparelho, e não do protocolo RAWM.

mod identity;
mod keys;
mod lod;

pub use identity::{HidCollection, HidDevice, HidReport, LeviathanV4Usb, is_device_name, matches, usb};
pub use keys::{SHOW_POWER_KEY_ID, button_id, encode_show_power, key_id};
pub use lod::{NumericRange, lod_millimetres, lod_range};
```

Em `bindings.rs`, `use crate::drivers::leviathan_v4::{LeviathanV4Usb, NumericRange};` e as entradas `("LeviathanV4Usb", render::<LeviathanV4Usb>()),` e `("NumericRange", render::<NumericRange>()),`.

Run: `UPDATE_BINDINGS=1 cargo test -p gearhub-core generated && cargo test -p gearhub-core && cargo clippy --workspace --all-targets -- -D warnings`
Expected: PASS, sem avisos.

- [ ] **Step 4: Commit**

```bash
pnpm format
git add packages/core/src packages/shared/src/generated
git commit -m "feat: LOD e identidade do Leviathan V4 no nucleo"
```

---

### Task 5: Aplicar a configuração ao bloco de parâmetros

**Files:**

- Create: `packages/core/src/drivers/leviathan_v4/apply.rs`
- Modify: `packages/core/src/drivers/leviathan_v4/mod.rs`
- Modify: `packages/core/src/protocols/rawm/error.rs`
- Modify: `packages/core/tests/vectors.rs`

**Interfaces:**

- Consumes: `MouseParamSnapshot`, `pack_dpi`, `parse_mouse_param_snapshot`, `encode_mouse_param_body` (Task 3); `MouseSettings` (Task 2).
- Produces (`gearhub_core::drivers::leviathan_v4`): `apply_settings(snapshot: &MouseParamSnapshot, settings: &MouseSettings) -> Result<MouseParamSnapshot, RawmError>`; `pub(super) const PERFORMANCE_MODES: [&str; 4]` (usado pela descrição na Task 6).
- Produces: `RawmError::InvalidPerformanceMode` (`invalid-performance-mode`), `RawmError::InvalidDpiStages` (`invalid-dpi-stages`).

- [ ] **Step 1: Teste de vetor (falha por não compilar)**

Em `packages/core/tests/vectors.rs`: `use gearhub_core::device::MouseSettings;` (junto do `MouseActionId`), a struct

```rust
#[derive(Deserialize)]
struct ParamApplyVector {
    name: String,
    query: String,
    settings: MouseSettings,
    expected: String,
}
```

o campo `param_apply: Vec<ParamApplyVector>,` em `Vectors`, e

```rust
#[test]
fn param_apply_matches_the_shared_vectors() {
    let vectors = vectors();
    require_non_empty(&vectors.param_apply, "paramApply");
    for vector in &vectors.param_apply {
        let snapshot = parse_mouse_param_snapshot(&query(&vectors, &vector.query))
            .unwrap_or_else(|error| panic!("{}: {error:?}", vector.name));
        let next = leviathan_v4::apply_settings(&snapshot, &vector.settings)
            .unwrap_or_else(|error| panic!("{}: {error:?}", vector.name));
        assert_eq!(to_hex(&encode_mouse_param_body(&next)), vector.expected, "{}", vector.name);
    }
}
```

Run: `cargo test -p gearhub-core --test vectors`
Expected: FAIL de compilação (`apply_settings` não existe).

- [ ] **Step 2: Erros**

Em `error.rs`, as variantes

```rust
    /// Modo de desempenho que este aparelho não tem, ou nenhum.
    InvalidPerformanceMode,
    /// Estágios de DPI vazios, demais, ou sem o estágio ativo entre eles.
    InvalidDpiStages,
```

os braços `Self::InvalidPerformanceMode => "invalid-performance-mode",` e `Self::InvalidDpiStages => "invalid-dpi-stages",`, e as duas linhas no teste exaustivo.

- [ ] **Step 3: `apply.rs`**

```rust
//! A configuração do editor aplicada sobre o bloco que o mouse relatou.
//!
//! Só os campos que o editor controla mudam; o resto do bloco volta como o
//! mouse o mandou, inclusive o que esta versão do app não entende.

use crate::device::MouseSettings;
use crate::protocols::rawm::{MouseParamSnapshot, RawmError, pack_dpi};

/// Os modos de desempenho, na ordem do valor `pm` que o firmware usa.
pub(super) const PERFORMANCE_MODES: [&str; 4] = ["office", "lp", "hp", "gaming-plus"];

/// O valor de `top` quando o turbo sem fio está ligado.
const WIRELESS_TURBO_ON: u32 = 0x08;

/// Devolve a largura que o aparelho relatou. `cpi_l` tem largura fixa com os
/// estágios sem uso zerados, e o editor só carrega os preenchidos: escrever só
/// eles estreitaria o array sob o firmware e o deixaria incoerente com o
/// `cpi_l_c` de mesma largura.
fn pad_to_width(mut values: Vec<u32>, width: usize) -> Vec<u32> {
    if values.len() < width {
        values.resize(width, 0);
    }
    values
}

pub fn apply_settings(
    snapshot: &MouseParamSnapshot,
    settings: &MouseSettings,
) -> Result<MouseParamSnapshot, RawmError> {
    let mode = settings
        .performance_mode
        .as_deref()
        .and_then(|id| PERFORMANCE_MODES.iter().position(|&mode| mode == id))
        .ok_or(RawmError::InvalidPerformanceMode)?;
    let active = settings
        .dpi_stages
        .iter()
        .find(|stage| stage.id == settings.active_stage_id)
        .filter(|_| !settings.dpi_stages.is_empty() && settings.dpi_stages.len() <= 255)
        .ok_or(RawmError::InvalidDpiStages)?;
    let independent = settings.independent_axes;
    let parameters = &settings.parameters;

    Ok(MouseParamSnapshot {
        resolution: pack_dpi(active.x, active.y, independent),
        polling_rate: settings.polling_rate,
        cpi_levels: pad_to_width(
            settings
                .dpi_stages
                .iter()
                .map(|stage| pack_dpi(stage.x, stage.y, independent))
                .collect(),
            snapshot.cpi_levels.len(),
        ),
        power_mode: mode as u32,
        lift_off_distance: parameters.lift_off_distance,
        motion_sync: u32::from(parameters.motion_sync),
        angle_tuning: parameters.sensor_rotation,
        angle_snapping: u32::from(parameters.angle_snapping),
        ripple_control: u32::from(parameters.ripple_control),
        tx_output_power: if parameters.wireless_turbo { WIRELESS_TURBO_ON } else { 0 },
        ..snapshot.clone()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocols::rawm::parse_mouse_param_snapshot;
    use serde_json::json;

    fn snapshot() -> MouseParamSnapshot {
        parse_mouse_param_snapshot(&json!({
            "cpi": 800, "polling": 4000, "light": 48, "cpi_l": [400, 800, 1600, 3200, 0, 0, 0, 0],
            "cpi_l_c": [1, 2, 6, 4, 0, 0, 0, 0], "ob": 0, "pm": 3, "lod": 2,
            "kd": [0, 0, 0, 0, 0, 0, 0], "ms": 1, "at": 0, "as": 0, "rctrl": 0, "top": 8,
            "co": "", "atp": 1, "ocs": [129, 130, 134, 132], "gm": [0, 0]
        }))
        .unwrap()
    }

    fn settings() -> MouseSettings {
        serde_json::from_value(json!({
            "buttons": {}, "dpiStages": [
                { "id": "estagio-1", "x": 400, "y": 400 }, { "id": "estagio-2", "x": 800, "y": 800 }
            ],
            "activeStageId": "estagio-2", "independentAxes": false, "pollingRate": 1000,
            "performanceMode": "lp",
            "parameters": {
                "motionSync": false, "angleSnapping": true, "rippleControl": true,
                "wirelessTurbo": false, "liftOffDistance": 3, "sensorRotation": -10,
                "debounce": 0, "sleepTimeout": 1
            },
            "rPlus": null
        }))
        .unwrap()
    }

    #[test]
    fn changes_only_the_fields_the_editor_controls() {
        let before = snapshot();
        let next = apply_settings(&before, &settings()).unwrap();
        assert_eq!(next.polling_rate, 1000);
        assert_eq!(next.power_mode, 1);
        assert_eq!(next.tx_output_power, 0);
        assert_eq!(next.angle_tuning, -10);
        assert_eq!(next.key_delay, before.key_delay);
        assert_eq!(next.onboard_status, before.onboard_status);
        assert_eq!(next.cpi_level_colors, before.cpi_level_colors);
    }

    #[test]
    fn pads_the_stages_back_to_the_width_the_mouse_reported() {
        let next = apply_settings(&snapshot(), &settings()).unwrap();
        assert_eq!(next.cpi_levels, [400, 800, 0, 0, 0, 0, 0, 0]);
    }

    #[test]
    fn rejects_an_unknown_or_missing_performance_mode() {
        let mut unknown = settings();
        unknown.performance_mode = Some("turbo".into());
        assert_eq!(apply_settings(&snapshot(), &unknown), Err(RawmError::InvalidPerformanceMode));
        let mut missing = settings();
        missing.performance_mode = None;
        assert_eq!(apply_settings(&snapshot(), &missing), Err(RawmError::InvalidPerformanceMode));
    }

    #[test]
    fn rejects_an_active_stage_that_is_not_among_the_stages() {
        let mut orphan = settings();
        orphan.active_stage_id = "estagio-9".into();
        assert_eq!(apply_settings(&snapshot(), &orphan), Err(RawmError::InvalidDpiStages));
    }
}
```

Em `mod.rs` do Leviathan: `mod apply;` e `pub use apply::apply_settings;`.

- [ ] **Step 4: Rodar**

Run: `cargo test -p gearhub-core && cargo clippy --workspace --all-targets -- -D warnings`
Expected: PASS (os 4 vetores de `paramApply`, incluindo o de eixos independentes), sem avisos.

- [ ] **Step 5: Commit**

```bash
pnpm format
git add packages/core/src packages/core/tests/vectors.rs
git commit -m "feat: aplicar a configuracao ao bloco de parametros no nucleo"
```

---

### Task 6: A descrição do Leviathan V4

**Files:**

- Create: `packages/core/src/drivers/leviathan_v4/description.rs`
- Modify: `packages/core/src/drivers/leviathan_v4/mod.rs`, `keys.rs`
- Modify: `packages/core/src/protocols/rawm/error.rs`
- Modify: `packages/core/src/bindings.rs`
- Create (gerados): `packages/shared/src/generated/{DpiLimits,DpiAxes,LeviathanV4Description}.ts`

**Interfaces:**

- Consumes: `json::{integer, number}` (Task 3), `dpi_axes`, `PERFORMANCE_MODES` (Task 5), `lod_range`, `NumericRange` (Task 4), `MouseSettings` e partes (Task 2), `MouseActionId::ALL`.
- Produces (`gearhub_core::drivers::leviathan_v4`): `describe(raw: &Value) -> Result<LeviathanV4Description, RawmError>`; `onboard_slot_count(raw: &Value) -> u32`; `LeviathanV4Description`, `DpiLimits`, `DpiAxes` (`Serialize`, camelCase, TS gerado).
- Produces: `RawmError::IncompleteQuery { field: &'static str }` (`incomplete-query`, com `detail()`).
- Produces (`keys.rs`, `pub(super)`): `button_ids() -> impl Iterator<Item = &'static str>` na ordem de `PHYSICAL_KEYS`.

- [ ] **Step 1: Erro**

Em `error.rs`: variante `IncompleteQuery { field: &'static str }` (doc: "Campo que a descrição do aparelho exige ausente ou do tipo errado."), braço `Self::IncompleteQuery { .. } => "incomplete-query",`, o braço `Self::IncompleteQuery { field } => Some(field),` em `detail()`, e a linha no teste exaustivo.

- [ ] **Step 2: `button_ids` em `keys.rs`**

```rust
/// Os botões do aparelho, na ordem da tabela.
pub(super) fn button_ids() -> impl Iterator<Item = &'static str> {
    PHYSICAL_KEYS.iter().map(|&(button, _)| button)
}
```

- [ ] **Step 3: `description.rs`**

```rust
//! O que a consulta diz sobre este Leviathan V4, e o que o modelo suporta.
//!
//! A casca compõe isto com o desenho (foto, posições, rótulos) para montar o
//! periférico. Tudo aqui é fato do aparelho: muda se o firmware mudar, não se
//! a casca mudar.

use indexmap::IndexMap;
use serde::Serialize;
use serde_json::Value;

use super::apply::PERFORMANCE_MODES;
use super::keys::button_ids;
use super::lod::{NumericRange, lod_range};
use crate::device::{DpiStage, MouseActionId, MouseParameters, MouseRPlusSettings, MouseSettings};
use crate::protocols::rawm::json::{integer, number};
use crate::protocols::rawm::{RawmError, dpi_axes};

/// Faixa do sensor, não do menor e maior estágio salvos. A RAWM especifica
/// 100–45000 para este modelo (rawmshop.com/products/leviathan-v4).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct DpiLimits {
    pub min: u32,
    pub max: u32,
    pub step: u32,
    pub min_stages: u32,
    pub max_stages: u32,
    pub independent_axes: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct DpiAxes {
    pub x: u32,
    pub y: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct LeviathanV4Description {
    pub name: String,
    pub firmware: Option<String>,
    pub battery: Option<f64>,
    pub dpi: DpiLimits,
    pub polling_rates: Vec<u32>,
    /// Ids dos modos de desempenho, na ordem do valor `pm`.
    pub performance_modes: Vec<String>,
    pub lift_off_distance: NumericRange,
    pub sensor_rotation: NumericRange,
    pub r_plus_activator_button_ids: Vec<String>,
    pub actions: Vec<MouseActionId>,
    pub profile_slots: u32,
    pub active_profile_slot: u32,
    pub live_dpi: DpiAxes,
    /// A configuração que o mouse tinha no momento da consulta.
    pub defaults: MouseSettings,
}

const DPI: DpiLimits = DpiLimits {
    min: 100,
    max: 45_000,
    step: 50,
    min_stages: 1,
    max_stages: 8,
    independent_axes: false,
};
const POLLING_RATES: [u32; 7] = [125, 250, 500, 1000, 2000, 4000, 8000];
const SENSOR_ROTATION: NumericRange = NumericRange { min: -30, max: 30, step: 1 };
const R_PLUS_ACTIVATORS: [&str; 3] = ["lateral-traseiro", "lateral-dianteiro", "dpi"];
const R_PLUS_DEFAULT_ACTIVATOR: &str = "lateral-dianteiro";
/// O mapeamento de fábrica, na ordem em que os botões são enviados.
const FACTORY_BUTTONS: [(&str, MouseActionId); 6] = [
    ("esquerdo", MouseActionId::CliqueEsquerdo),
    ("direito", MouseActionId::CliqueDireito),
    ("central", MouseActionId::CliqueCentral),
    ("lateral-traseiro", MouseActionId::Voltar),
    ("lateral-dianteiro", MouseActionId::Avancar),
    ("dpi", MouseActionId::DpiCiclo),
];
const MAX_ONBOARD_SLOTS: u32 = 16;
const DEFAULT_NAME: &str = "Leviathan V4";
const WIRELESS_TURBO_ON: f64 = 8.0;

fn incomplete(field: &'static str) -> RawmError {
    RawmError::IncompleteQuery { field }
}

fn finite(raw: &Value, field: &'static str) -> Result<f64, RawmError> {
    raw.get(field).and_then(number).ok_or(incomplete(field))
}

fn numbers(raw: &Value, field: &'static str) -> Result<Vec<f64>, RawmError> {
    let items = raw.get(field).and_then(Value::as_array).ok_or(incomplete(field))?;
    let values: Option<Vec<f64>> = items.iter().map(number).collect();
    values.filter(|values| !values.is_empty()).ok_or(incomplete(field))
}

fn is_one(raw: &Value, field: &str) -> bool {
    raw.get(field).and_then(number) == Some(1.0)
}

/// `String(x)` do JS para um número: inteiros sem `.0`.
fn js_number_text(value: f64) -> String {
    if value.fract() == 0.0 && value.abs() < 1e21 {
        format!("{}", value as i64)
    } else {
        format!("{value}")
    }
}

/// Memórias onboard: `ocs` traz um byte de estado por memória e `ocn` diz
/// quantas. Os dois concordaram na firmware capturada; se discordarem, uma
/// memória só, em vez de dimensionar a tela num palpite. `st` já foi lido como
/// este array; na firmware real é o escalar 60.
pub fn onboard_slot_count(raw: &Value) -> u32 {
    let Some(statuses) = raw.get("ocs").and_then(Value::as_array).filter(|s| !s.is_empty())
    else {
        return 1;
    };
    let count = statuses.len() as u32;
    if let Some(declared) = raw.get("ocn").and_then(number) {
        if declared != f64::from(count) {
            return 1;
        }
    }
    count.min(MAX_ONBOARD_SLOTS)
}

fn performance_mode(raw_mode: f64) -> &'static str {
    let index = integer(&Value::from(raw_mode)).filter(|index| (0..4).contains(index));
    index.map_or(PERFORMANCE_MODES[0], |index| PERFORMANCE_MODES[index as usize])
}

fn axes(value: f64) -> DpiAxes {
    let (x, y) = dpi_axes(value as u32);
    DpiAxes { x: u32::from(x), y: u32::from(y) }
}

/// Lê a consulta. Os campos exigidos são validados na ordem abaixo, e o
/// primeiro que falhar é o que o erro nomeia.
pub fn describe(raw: &Value) -> Result<LeviathanV4Description, RawmError> {
    let name = raw
        .get("dn")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .unwrap_or(DEFAULT_NAME)
        .to_owned();
    // Os estágios sem uso chegam como zeros num array de largura fixa; a tela
    // só mostra os preenchidos.
    let levels: Vec<f64> = numbers(raw, "cpi_l")?.into_iter().filter(|&level| level > 0.0).collect();
    let active_dpi = finite(raw, "cpi")?;
    let polling_rate = finite(raw, "polling")?;
    // `oci` é a memória em uso. `ob` vem no bloco de parâmetros e não é esse
    // seletor, embora os dois leiam 0 num mouse que nunca saiu da primeira.
    let onboard_index = match raw.get("oci").and_then(number) {
        Some(index) => index,
        None => finite(raw, "ob")?,
    };
    let raw_mode = finite(raw, "pm")?;
    let lod = finite(raw, "lod")?;
    let angle = finite(raw, "at")?;
    for field in ["ms", "as", "rctrl", "top"] {
        finite(raw, field)?;
    }

    let active_index = levels.iter().position(|&level| level == active_dpi).unwrap_or(0);
    let profile_slots = onboard_slot_count(raw);
    let active_profile_slot = (onboard_index + 1.0).max(1.0).min(f64::from(profile_slots)) as u32;

    let defaults = MouseSettings {
        buttons: FACTORY_BUTTONS.iter().map(|&(id, action)| (id.to_owned(), action)).collect(),
        dpi_stages: levels
            .iter()
            .enumerate()
            .map(|(index, &level)| {
                let DpiAxes { x, y } = axes(level);
                DpiStage { id: format!("estagio-{}", index + 1), x, y }
            })
            .collect(),
        active_stage_id: format!("estagio-{}", active_index + 1),
        independent_axes: false,
        polling_rate: polling_rate as u32,
        performance_mode: Some(performance_mode(raw_mode).to_owned()),
        parameters: MouseParameters {
            motion_sync: is_one(raw, "ms"),
            angle_snapping: is_one(raw, "as"),
            ripple_control: is_one(raw, "rctrl"),
            wireless_turbo: raw.get("top").and_then(number) == Some(WIRELESS_TURBO_ON),
            lift_off_distance: lod as u32,
            sensor_rotation: angle as i32,
            debounce: 0,
            sleep_timeout: 1,
        },
        r_plus: Some(MouseRPlusSettings {
            activator_button_id: R_PLUS_DEFAULT_ACTIVATOR.to_owned(),
            buttons: button_ids()
                .map(|id| (id.to_owned(), MouseActionId::Desativado))
                .collect::<IndexMap<_, _>>(),
        }),
    };

    Ok(LeviathanV4Description {
        name,
        firmware: raw.get("r").and_then(|value| match value {
            Value::String(text) => Some(text.clone()),
            Value::Number(_) => number(value).map(js_number_text),
            _ => None,
        }),
        battery: raw.get("battery").and_then(number).filter(|level| (0.0..=100.0).contains(level)),
        dpi: DPI,
        polling_rates: POLLING_RATES.to_vec(),
        performance_modes: PERFORMANCE_MODES.iter().map(|&mode| mode.to_owned()).collect(),
        lift_off_distance: lod_range(),
        sensor_rotation: SENSOR_ROTATION,
        r_plus_activator_button_ids: R_PLUS_ACTIVATORS.iter().map(|&id| id.to_owned()).collect(),
        actions: MouseActionId::ALL.to_vec(),
        profile_slots,
        active_profile_slot,
        live_dpi: axes(active_dpi),
        defaults,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn capture() -> Value {
        let vectors: Value =
            serde_json::from_str(include_str!("../../../vectors/rawm-protocol.json")).unwrap();
        vectors["queries"]["leviathan-v4-captura"].clone()
    }

    #[test]
    fn reads_the_model_firmware_and_battery_the_firmware_reports() {
        let description = describe(&capture()).unwrap();
        assert_eq!(description.name, "LEVIATHAN V4");
        assert_eq!(description.firmware.as_deref(), Some("G-1.2.3"));
        assert_eq!(description.battery, Some(31.0));
    }

    #[test]
    fn reflects_the_state_the_mouse_was_in() {
        let defaults = describe(&capture()).unwrap().defaults;
        assert_eq!(defaults.polling_rate, 4000);
        assert_eq!(defaults.performance_mode.as_deref(), Some("gaming-plus"));
        assert!(defaults.parameters.wireless_turbo);
        assert!(defaults.parameters.motion_sync);
        assert_eq!(defaults.active_stage_id, "estagio-2");
    }

    #[test]
    fn drops_the_zero_padding_from_the_stages() {
        let stages = describe(&capture()).unwrap().defaults.dpi_stages;
        assert_eq!(stages.iter().map(|stage| stage.x).collect::<Vec<_>>(), [400, 800, 1600, 3200]);
    }

    #[test]
    fn sizes_the_onboard_memories_from_ocs_and_ocn() {
        assert_eq!(describe(&capture()).unwrap().profile_slots, 4);
        assert_eq!(onboard_slot_count(&json!({ "ocs": [1, 2, 3, 4], "ocn": 3 })), 1);
        assert_eq!(onboard_slot_count(&json!({ "ocs": [1, 2] })), 2);
        assert_eq!(onboard_slot_count(&json!({ "st": 60 })), 1);
        assert_eq!(onboard_slot_count(&json!({ "ocs": vec![0; 20] })), 16);
    }

    #[test]
    fn uses_the_sensor_range_not_the_saved_stages() {
        let mut raw = capture();
        raw["cpi_l"] = json!([400, 800, 0, 0, 0, 0, 0, 0]);
        let dpi = describe(&raw).unwrap().dpi;
        assert_eq!((dpi.min, dpi.max), (100, 45_000));
    }

    #[test]
    fn falls_back_to_the_model_name_and_the_first_memory() {
        let mut raw = capture();
        raw["dn"] = json!("   ");
        raw.as_object_mut().unwrap().remove("oci");
        let description = describe(&raw).unwrap();
        assert_eq!(description.name, "Leviathan V4");
        assert_eq!(description.active_profile_slot, 1);
    }

    #[test]
    fn names_the_first_missing_field_in_order() {
        assert_eq!(describe(&json!({ "dn": "L" })), Err(RawmError::IncompleteQuery { field: "cpi_l" }));
        let mut raw = capture();
        raw.as_object_mut().unwrap().remove("top");
        assert_eq!(describe(&raw), Err(RawmError::IncompleteQuery { field: "top" }));
        raw["cpi_l"] = json!([]);
        assert_eq!(describe(&raw), Err(RawmError::IncompleteQuery { field: "cpi_l" }));
    }

    #[test]
    fn an_unknown_mode_reads_as_office() {
        let mut raw = capture();
        raw["pm"] = json!(9);
        assert_eq!(describe(&raw).unwrap().defaults.performance_mode.as_deref(), Some("office"));
    }

    #[test]
    fn the_r_plus_layer_starts_disabled_on_every_button() {
        let r_plus = describe(&capture()).unwrap().defaults.r_plus.unwrap();
        assert_eq!(r_plus.activator_button_id, "lateral-dianteiro");
        assert_eq!(r_plus.buttons.len(), 6);
        assert!(r_plus.buttons.values().all(|&action| action == MouseActionId::Desativado));
    }

    #[test]
    fn a_numeric_firmware_prints_like_javascript() {
        assert_eq!(js_number_text(3.0), "3");
        assert_eq!(js_number_text(1.5), "1.5");
    }
}
```

No `mod.rs` do Leviathan: `mod description;` e `pub use description::{DpiAxes, DpiLimits, LeviathanV4Description, describe, onboard_slot_count};`. Em `bindings.rs`, as entradas `("DpiLimits", …)`, `("DpiAxes", …)` e `("LeviathanV4Description", render::<LeviathanV4Description>())`.

- [ ] **Step 4: Rodar**

Run: `UPDATE_BINDINGS=1 cargo test -p gearhub-core generated && cargo test -p gearhub-core && cargo clippy --workspace --all-targets -- -D warnings`
Expected: PASS, sem avisos. Confira que `packages/shared/src/generated/LeviathanV4Description.ts` importa `./MouseSettings`, `./MouseActionId`, `./NumericRange`, `./DpiLimits` e `./DpiAxes`.

- [ ] **Step 5: Commit**

```bash
pnpm format
git add packages/core/src packages/shared/src/generated
git commit -m "feat: descricao do Leviathan V4 lida da consulta no nucleo"
```

---

### Task 7: A ponte, o `coreBridge` e os erros com dado

**Files:**

- Modify: `packages/core-wasm/Cargo.toml`, `Cargo.lock`
- Modify: `packages/core-wasm/src/lib.rs`
- Modify: `apps/web/src/core/coreBridge.ts`, `coreBridge.test.ts`
- Modify: `apps/web/src/core/rawmError.ts`, `rawmError.test.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/web/src/hardware/rawm/vectors.test.ts`

**Interfaces:**

- Consumes: tudo das Tasks 3–6.
- Produces (`apps/web/src/core/coreBridge.ts`):
  - `parseMouseParamState(raw: Record<string, unknown>): RawmMouseParamState`
  - `encodeMouseParamBody(state: RawmMouseParamState): Uint8Array`
  - `applySettingsToMouseParam(snapshot: RawmMouseParamState, settings: MouseSettings): RawmMouseParamState`
  - `describeLeviathanV4(raw: Record<string, unknown>): LeviathanV4Description`
  - `leviathanOnboardSlotCount(raw: Record<string, unknown>): number`
  - `leviathanLodMillimetres(raw: number): number | null`
  - `leviathanV4Usb(): LeviathanV4Usb`
  - `matchesLeviathanV4(device: HidDeviceIdentityLike): boolean`, com a interface local (não exportada — o knip reprova tipo exportado sem uso) `HidDeviceIdentityLike = { vendorId: number; productId: number; collections: { usagePage: number; usage: number; inputReports?: { reportId: number }[]; outputReports?: { reportId: number }[] }[] }`
  - `isLeviathanV4Name(name: string): boolean`
- Produces: `@gearhub/shared` exporta `RawmMouseParamState`, `LeviathanV4Description`, `LeviathanV4Usb`.

- [ ] **Step 1: Dependências da ponte**

Em `packages/core-wasm/Cargo.toml`, `[dependencies]`:

```toml
serde = "1"
serde-wasm-bindgen = "0.6"
serde_json = "1"
```

Run: `cargo build -p gearhub-core-wasm && grep -A1 'name = "winapi-util"' Cargo.lock`
Expected: compila; `version = "0.1.9"`.

- [ ] **Step 2: Testes TS que falham**

Em `apps/web/src/core/coreBridge.test.ts`, importe os nove nomes novos e `leviathanV4QueryFixture` de `'../hardware/rawm/leviathanV4Fixture'`, e acrescente:

```ts
describe('estruturas através da ponte', () => {
  it('lê o snapshot como objeto comum, com os nomes que as sondas comparam', () => {
    const state = parseMouseParamState(leviathanV4QueryFixture);
    expect(state).toMatchObject({ resolution: 800, pollingRate: 4000, liftOffDistance: 2 });
    expect({ ...state, resolution: 1600 }.resolution).toBe(1600);
  });

  it('nomeia o campo inválido na mensagem e guarda só o código em cause', () => {
    let thrown: unknown;
    try {
      parseMouseParamState({ ...leviathanV4QueryFixture, lod: undefined });
    } catch (error) {
      thrown = error;
    }
    expect((thrown as Error).message).toBe('Snapshot RAWM incompleto ou invalido: lod.');
    expect((thrown as Error).cause).toBe('invalid-snapshot-field');
  });

  it('aplica a configuração e devolve null, não undefined, nos opcionais', () => {
    const description = describeLeviathanV4(leviathanV4QueryFixture);
    expect(description.defaults.rPlus).not.toBeUndefined();
    expect(describeLeviathanV4({ ...leviathanV4QueryFixture, r: undefined }).firmware).toBeNull();
    const next = applySettingsToMouseParam(parseMouseParamState(leviathanV4QueryFixture), {
      ...description.defaults,
      pollingRate: 1000,
    });
    expect(encodeMouseParamBody(next)[2]).toBe(0xe8);
  });

  it('recusa um modo de desempenho desconhecido com o texto de sempre', () => {
    const description = describeLeviathanV4(leviathanV4QueryFixture);
    expect(() =>
      applySettingsToMouseParam(parseMouseParamState(leviathanV4QueryFixture), {
        ...description.defaults,
        performanceMode: 'turbo',
      }),
    ).toThrow('Modo de desempenho RAWM invalido.');
  });

  it('mantém a ordem dos botões na travessia', () => {
    const { defaults } = describeLeviathanV4(leviathanV4QueryFixture);
    expect(Object.keys(defaults.buttons)).toEqual([
      'esquerdo',
      'direito',
      'central',
      'lateral-traseiro',
      'lateral-dianteiro',
      'dpi',
    ]);
  });

  it('expõe LOD, contagem de memórias, USB e nome', () => {
    expect(leviathanLodMillimetres(2)).toBe(1);
    expect(leviathanLodMillimetres(9)).toBeNull();
    expect(leviathanOnboardSlotCount({ ocs: [1, 2, 3, 4], ocn: 4 })).toBe(4);
    expect(leviathanV4Usb()).toEqual({
      vendorId: 0x1915,
      receiverProductId: 0x2346,
      configUsagePage: 0xff00,
      configUsage: 1,
    });
    expect(isLeviathanV4Name('魔鲸 V4')).toBe(true);
    expect(
      matchesLeviathanV4({
        vendorId: 0x1915,
        productId: 0x2346,
        collections: [
          {
            usagePage: 0xff00,
            usage: 1,
            inputReports: [{ reportId: 0 }],
            outputReports: [{ reportId: 0 }],
          },
        ],
      }),
    ).toBe(true);
  });
});
```

Run: `pnpm --filter @gearhub/web exec vitest run src/core/coreBridge.test.ts`
Expected: FAIL — os nomes não existem.

- [ ] **Step 3: A ponte**

Em `packages/core-wasm/src/lib.rs`: troque `js_error` por

```rust
/// Converte o erro tipado do núcleo num erro de JavaScript que carrega o
/// código — e, para as variantes com dado, `código:dado`. A casca escolhe o
/// texto; aqui não há tradução.
fn js_error(error: rawm::RawmError) -> JsError {
    match error.detail() {
        Some(detail) => JsError::new(&format!("{}:{detail}", error.code())),
        None => JsError::new(error.code()),
    }
}

/// Uma falha de conversão não é erro de protocolo: atravessa com o texto do
/// serde, e a casca a deixa passar intacta.
fn conversion_error(error: serde_wasm_bindgen::Error) -> JsError {
    JsError::new(&error.to_string())
}

/// Objetos comuns e `null` — o que os tipos gerados declaram. O serializador
/// padrão produziria `Map` para os botões e `undefined` para os opcionais.
fn to_js<T: serde::Serialize>(value: &T) -> Result<JsValue, JsError> {
    value
        .serialize(&serde_wasm_bindgen::Serializer::json_compatible())
        .map_err(conversion_error)
}

fn from_js<T: serde::de::DeserializeOwned>(value: JsValue) -> Result<T, JsError> {
    serde_wasm_bindgen::from_value(value).map_err(conversion_error)
}
```

com `use gearhub_core::device::MouseSettings;` junto do `MouseActionId`, e, antes de `core_version`:

```rust
#[wasm_bindgen(js_name = parseMouseParamState)]
pub fn parse_mouse_param_state(raw: JsValue) -> Result<JsValue, JsError> {
    let raw: serde_json::Value = from_js(raw)?;
    to_js(&rawm::parse_mouse_param_snapshot(&raw).map_err(js_error)?)
}

#[wasm_bindgen(js_name = encodeMouseParamBody)]
pub fn encode_mouse_param_body(state: JsValue) -> Result<Vec<u8>, JsError> {
    let state: rawm::MouseParamSnapshot = from_js(state)?;
    Ok(rawm::encode_mouse_param_body(&state))
}

#[wasm_bindgen(js_name = applySettingsToMouseParam)]
pub fn apply_settings_to_mouse_param(snapshot: JsValue, settings: JsValue) -> Result<JsValue, JsError> {
    let snapshot: rawm::MouseParamSnapshot = from_js(snapshot)?;
    let settings: MouseSettings = from_js(settings)?;
    to_js(&leviathan_v4::apply_settings(&snapshot, &settings).map_err(js_error)?)
}

#[wasm_bindgen(js_name = describeLeviathanV4)]
pub fn describe_leviathan_v4(raw: JsValue) -> Result<JsValue, JsError> {
    let raw: serde_json::Value = from_js(raw)?;
    to_js(&leviathan_v4::describe(&raw).map_err(js_error)?)
}

#[wasm_bindgen(js_name = leviathanOnboardSlotCount)]
pub fn leviathan_onboard_slot_count(raw: JsValue) -> Result<u32, JsError> {
    let raw: serde_json::Value = from_js(raw)?;
    Ok(leviathan_v4::onboard_slot_count(&raw))
}

#[wasm_bindgen(js_name = leviathanLodMillimetres)]
pub fn leviathan_lod_millimetres(raw: u32) -> Option<f64> {
    leviathan_v4::lod_millimetres(raw)
}

#[wasm_bindgen(js_name = leviathanV4Usb)]
pub fn leviathan_v4_usb() -> Result<JsValue, JsError> {
    to_js(&leviathan_v4::usb())
}

#[wasm_bindgen(js_name = matchesLeviathanV4)]
pub fn matches_leviathan_v4(device: JsValue) -> Result<bool, JsError> {
    let device: leviathan_v4::HidDevice = from_js(device)?;
    Ok(leviathan_v4::matches(&device))
}

#[wasm_bindgen(js_name = isLeviathanV4Name)]
pub fn is_leviathan_v4_name(name: &str) -> bool {
    leviathan_v4::is_device_name(name)
}
```

- [ ] **Step 4: `rawmError.ts`**

Acrescente a `MESSAGES`:

```ts
  'invalid-snapshot-field': 'Snapshot RAWM incompleto ou invalido: {campo}.',
  'incomplete-query': 'Consulta RAWM incompleta: {campo}.',
  'invalid-performance-mode': 'Modo de desempenho RAWM invalido.',
  'invalid-dpi-stages': 'Configuracao de DPI RAWM invalida.',
```

e troque o corpo de `asRawmError` por:

```ts
export function asRawmError(error: unknown): Error {
  const text = error instanceof Error ? error.message : String(error);
  // Variantes com dado chegam como `código:dado`; o código é a parte antes do
  // primeiro `:`. Um erro que não vem do núcleo pode ter `:` também
  // ("TypeError: …"), mas a parte antes dele não está em MESSAGES.
  const separator = text.indexOf(':');
  const code = separator === -1 ? text : text.slice(0, separator);
  const detail = separator === -1 ? '' : text.slice(separator + 1);
  if (!(code in MESSAGES)) return error instanceof Error ? error : new Error(text);
  return new Error(MESSAGES[code].replace('{campo}', detail), { cause: code });
}
```

Atualize o comentário de documentação de `asRawmError` com uma frase sobre o `código:dado`. Em `rawmError.test.ts`, acrescente:

```ts
it('monta a mensagem com o dado e guarda só o código em cause', () => {
  const error = asRawmError(new Error('invalid-snapshot-field:cpi'));
  expect(error.message).toBe('Snapshot RAWM incompleto ou invalido: cpi.');
  expect(error.cause).toBe('invalid-snapshot-field');
});

it('deixa passar intacto um erro com dois-pontos que não vem do núcleo', () => {
  const original = new TypeError('TypeError: x is not a function');
  expect(asRawmError(original)).toBe(original);
});
```

e atualize o número de códigos no comentário do topo ("dez" → "catorze").

- [ ] **Step 5: `coreBridge.ts` e `@gearhub/shared`**

Em `packages/shared/src/index.ts`, acrescente:

```ts
export type { LeviathanV4Description } from './generated/LeviathanV4Description';
export type { LeviathanV4Usb } from './generated/LeviathanV4Usb';
export type { RawmMouseParamState } from './generated/RawmMouseParamState';
```

Em `coreBridge.ts`, importe os nove nomes do `'gearhub-core-wasm'` com prefixo `wasm` (em ordem alfabética, como o bloco está), os tipos `LeviathanV4Description, LeviathanV4Usb, MouseSettings, RawmMouseParamState` de `'@gearhub/shared'`, e acrescente, depois de `encodeLeviathanShowPower`:

```ts
/** Lê o bloco de parâmetros da resposta de consulta. */
export function parseMouseParamState(raw: Record<string, unknown>): RawmMouseParamState {
  try {
    return wasmParseMouseParamState(raw) as RawmMouseParamState;
  } catch (error) {
    throw asRawmError(error);
  }
}

/** O corpo binário do bloco, pronto para `encodeMouseParamSnapshot`. */
export function encodeMouseParamBody(state: RawmMouseParamState): Uint8Array {
  try {
    return wasmEncodeMouseParamBody(state);
  } catch (error) {
    throw asRawmError(error);
  }
}

/** A configuração do editor aplicada sobre o bloco que o mouse relatou. */
export function applySettingsToMouseParam(
  snapshot: RawmMouseParamState,
  settings: MouseSettings,
): RawmMouseParamState {
  try {
    return wasmApplySettingsToMouseParam(snapshot, settings) as RawmMouseParamState;
  } catch (error) {
    throw asRawmError(error);
  }
}

/** O que a consulta diz sobre o Leviathan V4, e o que o modelo suporta. */
export function describeLeviathanV4(raw: Record<string, unknown>): LeviathanV4Description {
  try {
    return wasmDescribeLeviathanV4(raw) as LeviathanV4Description;
  } catch (error) {
    throw asRawmError(error);
  }
}

/** Quantas memórias onboard a consulta anuncia. */
export function leviathanOnboardSlotCount(raw: Record<string, unknown>): number {
  return wasmLeviathanOnboardSlotCount(raw);
}

/** A distância, em milímetros, de um nível de LOD; `null` para um nível desconhecido. */
export function leviathanLodMillimetres(raw: number): number | null {
  return wasmLeviathanLodMillimetres(raw) ?? null;
}

/** Os números USB do receptor, para o filtro do seletor WebHID. */
export function leviathanV4Usb(): LeviathanV4Usb {
  return wasmLeviathanV4Usb() as LeviathanV4Usb;
}

interface HidDeviceIdentityLike {
  vendorId: number;
  productId: number;
  collections: {
    usagePage: number;
    usage: number;
    inputReports?: { reportId: number }[];
    outputReports?: { reportId: number }[];
  }[];
}

/**
 * Se o dispositivo é o receptor do Leviathan V4 com a coleção de configuração.
 *
 * O `HIDDevice` do navegador guarda tudo em getters do protótipo, que a
 * conversão do serde não enxerga; por isso a cópia para um objeto simples.
 */
export function matchesLeviathanV4(device: HidDeviceIdentityLike): boolean {
  return wasmMatchesLeviathanV4({
    vendorId: device.vendorId,
    productId: device.productId,
    collections: device.collections.map((collection) => ({
      usagePage: collection.usagePage,
      usage: collection.usage,
      inputReports: (collection.inputReports ?? []).map(({ reportId }) => ({ reportId })),
      outputReports: (collection.outputReports ?? []).map(({ reportId }) => ({ reportId })),
    })),
  });
}

/** Se o nome que o mouse relata é o de um Leviathan V4. */
export function isLeviathanV4Name(name: string): boolean {
  return wasmIsLeviathanV4Name(name);
}
```

- [ ] **Step 6: Os vetores passam a conferir as duas implementações**

Em `apps/web/src/hardware/rawm/vectors.test.ts`, importe de `'../../core/coreBridge'` os nomes `applySettingsToMouseParam as coreApply`, `encodeMouseParamBody as coreEncode`, `parseMouseParamState as coreParse`, e acrescente uma segunda asserção a cada um dos três `it.each` da Task 1:

```ts
// paramSnapshot
expect(toHex(coreEncode(coreParse(query(name))))).toBe(expected);
// paramApply
expect(toHex(coreEncode(coreApply(coreParse(query(name)), settings)))).toBe(expected);
// invalidSnapshot
expect(() => coreParse(applyQueryPatch(query(name), patch))).toThrow(
  `Snapshot RAWM incompleto ou invalido: ${field}.`,
);
```

- [ ] **Step 7: Rodar**

Run: `cargo test --workspace && cargo clippy --workspace --all-targets -- -D warnings && pnpm core:build && pnpm --filter @gearhub/web exec vitest run src/core src/hardware/rawm/vectors.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
pnpm format
git add packages/core-wasm Cargo.lock apps/web/src/core apps/web/src/hardware/rawm/vectors.test.ts packages/shared/src/index.ts
git commit -m "feat: expor snapshot, descricao e identidade pela ponte"
```

---

### Task 8: A casca passa a usar o núcleo, e `mouseParamSnapshot.ts` é apagado

**Files:**

- Delete: `apps/web/src/hardware/rawm/mouseParamSnapshot.ts`
- Modify: `apps/web/src/hardware/rawm/leviathanV4.ts`, `leviathanV4Lod.ts`, `connectLeviathanV4.ts`, `LeviathanV4Driver.ts`, `diagnostics.ts`, `writeProbe.ts`
- Modify: `apps/web/src/hardware/deviceRegistry.ts`, `deviceDiscovery.ts` (se usar `deviceDefinitions`)
- Modify (testes): `mouseParamSnapshot.test.ts`, `leviathanV4Lod.test.ts`, `connectLeviathanV4.test.ts`, `vectors.test.ts`, e qualquer outro que importe de `./mouseParamSnapshot` ou use `deviceDefinitions`/`LEVIATHAN_V4_LOD_LEVELS`/`RAWM_*`

**Interfaces:**

- Consumes: os invólucros da Task 7.
- Produces: `deviceDefinitions(): DeviceDefinition[]` (função memoizada) no lugar do array de módulo. `createLeviathanV4Peripheral(raw, id)` e `formatLiftOffDistance(raw)` mantêm assinatura e resultado.

- [ ] **Step 1: `leviathanV4.ts`**

Apague: as constantes `RAWM_VENDOR_ID`, `LEVIATHAN_V4_RECEIVER_PRODUCT_ID`, `RAWM_CONFIG_USAGE_PAGE`, `RAWM_CONFIG_USAGE`; `leviathanV4ParameterCapabilities` como objeto de módulo; `actions`; `finiteNumber`, `numericArray`, `performanceMode`, `onboardSlotCount`; os imports de `leviathanV4Lod`, `createRPlusSettings` e `dpiAxes`. Mantenha `buttons` (com o comentário sobre a foto 213x420). Troque os modos por rótulos:

```ts
/** Rótulos de tela dos modos; os ids e a ordem vêm do núcleo. */
const performanceModeLabels: Record<string, string> = {
  office: 'Office',
  lp: 'LP',
  hp: 'HP',
  'gaming-plus': 'Gaming+',
};
```

e reescreva `createLeviathanV4Peripheral`:

```ts
/**
 * Compõe o periférico: o núcleo diz o que o aparelho é e em que estado está
 * (`describeLeviathanV4`); este arquivo acrescenta só o desenho — a foto, as
 * posições dos botões e os rótulos.
 */
export function createLeviathanV4Peripheral(
  raw: Record<string, unknown>,
  id: string,
): MousePeripheral {
  const description = describeLeviathanV4(raw);
  const settings = description.defaults;

  return {
    id,
    type: 'mouse',
    name: description.name,
    manufacturer: 'RAWM',
    connection: 'sem-fio',
    status: 'conectado',
    firmware: description.firmware,
    demo: false,
    battery: description.battery,
    photo: { src: '/dispositivos/leviathan-v4.png', aspect: 213 / 420 },
    capabilities: {
      dpi: description.dpi,
      pollingRates: description.pollingRates,
      performanceModes: description.performanceModes.map((mode) => ({
        id: mode,
        label: performanceModeLabels[mode] ?? mode,
      })),
      buttons,
      actions: description.actions,
      parameters: {
        motionSync: true,
        angleSnapping: true,
        rippleControl: true,
        wirelessTurbo: true,
        liftOffDistance: description.liftOffDistance,
        sensorRotation: description.sensorRotation,
      },
      rPlus: { activatorButtonIds: description.rPlusActivatorButtonIds },
      profileSlots: description.profileSlots,
    },
    defaults: structuredClone(settings),
    profiles: Array.from({ length: description.profileSlots }, (_, index) => ({
      index: index + 1,
      // The mouse reports no slot names, so this is the app's own label. It
      // follows the vendor hub's "Onboard Memory 1-4" rather than inventing a
      // separate vocabulary for the same four slots.
      name: `Memória ${index + 1}`,
      settings: structuredClone(settings),
      initial: index + 1 !== description.activeProfileSlot,
    })),
    activeProfileSlot: description.activeProfileSlot,
    liveDpi: description.liveDpi,
  };
}
```

com `import { describeLeviathanV4 } from '../../core/coreBridge';` e os imports de tipo que sobrarem em uso (`MouseButtonSpot`, `MousePeripheral`). Se o `tsc` reclamar de `performanceModes` ou `rPlus` opcionais em `MouseCapabilities`, a forma acima é a mesma de antes — investigue o tipo em vez de fazer cast.

- [ ] **Step 2: `leviathanV4Lod.ts`**

```ts
import { leviathanLodMillimetres } from '../../core/coreBridge';

/**
 * Lift-off distance levels, as the screen names them.
 *
 * The device stores an index, not a distance: it reports `lod: 2` for a mouse
 * sitting at 1.0 mm. The official software presents the three as named levels
 * rather than measurements, so the name leads and the distance follows it.
 * The distances are device facts and live in the core; the names are ours.
 */
const LEVEL_NAMES: Record<number, string> = { 1: 'Baixo', 2: 'Médio', 3: 'Alto' };

/** Falls back to the raw value so an unknown level stays visible, not hidden. */
export function formatLiftOffDistance(raw: number): string {
  const name = LEVEL_NAMES[raw];
  const millimetres = leviathanLodMillimetres(raw);
  if (name === undefined || millimetres === null) return `nível ${raw}`;
  const distance = millimetres.toLocaleString('pt-BR', { minimumFractionDigits: 1 });
  return `${name} · ${distance} mm`;
}
```

Em `leviathanV4Lod.test.ts`: troque o import de `parseMouseParamState` para o `coreBridge`, e troque o teste `'spans exactly the range the capability advertises'` por:

```ts
// The core owns the range; every level in it needs a name here, or the
// control would show "nível N" for a level the mouse really has.
it('names every level in the range the core advertises', () => {
  const { min, max } = describeLeviathanV4(leviathanV4QueryFixture).liftOffDistance;
  for (let raw = min; raw <= max; raw += 1) {
    expect(formatLiftOffDistance(raw)).not.toMatch(/^nível/);
  }
});
```

- [ ] **Step 3: `deviceRegistry.ts`**

Troque os imports de `./rawm/leviathanV4` por `import { leviathanV4Usb, matchesLeviathanV4 } from '../core/coreBridge';`, apague `hasRawConfigCollection`, e troque o array de módulo por:

```ts
let definitions: DeviceDefinition[] | null = null;

/**
 * Built on first use, not at import: the numbers come from the core, which is
 * only callable after `init()` resolves.
 */
export function deviceDefinitions(): DeviceDefinition[] {
  if (definitions) return definitions;
  const usb = leviathanV4Usb();
  definitions = [
    {
      id: 'rawm-leviathan-v4',
      manufacturer: 'RAWM',
      model: 'Leviathan V4',
      requestFilter: {
        vendorId: usb.vendorId,
        usagePage: usb.configUsagePage,
        usage: usb.configUsage,
      },
      matches: (device) => matchesLeviathanV4(device),
    },
  ];
  return definitions;
}
```

e troque `deviceDefinitions` por `deviceDefinitions()` em `deviceRequestFilters` e `matchDeviceDefinition` (e em qualquer outro uso: `grep -rn "deviceDefinitions" apps/web/src`). Em `connectLeviathanV4.test.ts`, `deviceDefinitions[0]` vira `deviceDefinitions()[0]`.

- [ ] **Step 4: `connectLeviathanV4.ts`**

Troque o regex por `if (!isLeviathanV4Name(mouse.deviceName)) {` e o import de `parseMouseParamState` para o `coreBridge` (junto de `isLeviathanV4Name`).

- [ ] **Step 5: O driver**

Em `LeviathanV4Driver.ts`: o import de `./mouseParamSnapshot` sai; `applySettingsToMouseParam`, `encodeMouseParamBody`, `parseMouseParamState` e `leviathanOnboardSlotCount` vêm do `coreBridge`; `RawmMouseParamState` vem de `'@gearhub/shared'` (import de tipo). No construtor:

```ts
// The same rule the peripheral used to size the memories screen: one
// reader of `ocs`/`ocn`, in the core.
this.slotCount = leviathanOnboardSlotCount(rawSnapshot);
```

- [ ] **Step 6: As sondas**

- `diagnostics.ts`: o import de `./leviathanV4` sai; `parseMouseParamState` vem do `coreBridge`, `RawmMouseParamState` de `'@gearhub/shared'`. Apague `const LEVIATHAN_NAME = /…/`; em `nameStage`, `const matches = isLeviathanV4Name(deviceName);`. Em `collectionStage`, `identityStage` e `requestDiagnosticDevice`, chame `const usb = leviathanV4Usb();` **dentro** da função e troque `RAWM_CONFIG_USAGE_PAGE` → `usb.configUsagePage`, `RAWM_CONFIG_USAGE` → `usb.configUsage`, `LEVIATHAN_V4_RECEIVER_PRODUCT_ID` → `usb.receiverProductId`, `RAWM_VENDOR_ID` → `usb.vendorId`. Os textos das mensagens não mudam.
- `writeProbe.ts`: o import de `./mouseParamSnapshot` sai; `encodeMouseParamBody`, `parseMouseParamState` vêm do `coreBridge`, `RawmMouseParamState` de `'@gearhub/shared'`.

- [ ] **Step 7: Testes**

- `mouseParamSnapshot.test.ts`: troque o import de `'./mouseParamSnapshot'` pelo `'../../core/coreBridge'`. O arquivo continua — agora exercita o WASM real. Se algum `expect` dependia de o objeto ser mutável por referência, ajuste para o valor devolvido.
- `vectors.test.ts`: remova as asserções contra o TS (as que usam `applySettingsToMouseParam`/`encodeMouseParamBody`/`parseMouseParamState` de `./mouseParamSnapshot`) e o import; as do `coreBridge` ficam (pode tirar o `as core…`).
- Qualquer outro teste que importe de `./mouseParamSnapshot`, `LEVIATHAN_V4_LOD_LEVELS` ou `RAWM_*`: aponte para o `coreBridge`/`leviathanV4Usb()`.

- [ ] **Step 8: Apagar e procurar restos**

```bash
git rm apps/web/src/hardware/rawm/mouseParamSnapshot.ts
```

Run: `grep -rn "mouseParamSnapshot'\|LEVIATHAN_V4_LOD_LEVELS\|RAWM_VENDOR_ID\|RAWM_CONFIG_USAGE\|LEVIATHAN_V4_RECEIVER_PRODUCT_ID\|魔鲸\|packedDpi\|onboardSlotCount\|hasRawConfigCollection" apps/web/src`
Expected: nenhuma ocorrência (os testes de `connectLeviathanV4.test.ts` e `diagnostics.test.ts` podem citar o nome do mouse em dados de teste; `魔鲸` em dado de teste é aceitável — reporte onde aparecer).

Run: `grep -rn "interface MouseSettings\|interface DpiStage\|interface MouseParameters\|interface MouseRPlusSettings" packages/shared/src`
Expected: nenhuma ocorrência.

- [ ] **Step 9: Rodar tudo**

Run: `pnpm test && pnpm lint && pnpm run audit`
Expected: PASS; o knip não aponta export sem uso.

- [ ] **Step 10: Commit**

```bash
pnpm format
git add -A apps/web/src
git commit -m "refactor: apagar mouseParamSnapshot.ts e ler o aparelho do nucleo"
```

---

### Task 9: Sondas, documentos e roteiro de hardware

**Files:**

- Modify: `apps/web/src/diagnostico.tsx`
- Modify: `apps/web/src/components/RawmDiagnosticPage.tsx`
- Modify: `apps/web/src/hardware/rawm/writeProbe.ts`, `writeProbe.test.ts`
- Modify: `docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md`
- Modify: `CLAUDE.md`
- Modify: `docs/smoke-test-leviathan-v4.md`

- [ ] **Step 1: A página de diagnóstico inicializa o núcleo**

`diagnostico.tsx` monta a página sem esperar o `init()` do WASM, e desde o passo 1 toda chamada da sonda ao `coreBridge` depende dele. Reescreva como o `main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RawmDiagnosticPage } from './components/RawmDiagnosticPage';
import { ensureCoreReady } from './core/coreBridge';
import './styles.css';

function mount() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RawmDiagnosticPage />
    </StrictMode>,
  );
}

/**
 * Separate entry on purpose. The main app restores authorized devices on mount
 * and registers a live driver, and any edit in the editor applies to hardware
 * immediately. Keeping the probe out of that tree is what makes "read-only" a
 * structural property instead of a promise.
 *
 * Like the main entry, it waits for the core: every probe stage goes through
 * it. A core that fails to load still renders, and the first stage reports why.
 */
void ensureCoreReady()
  .catch(() => undefined)
  .then(mount);
```

- [ ] **Step 2: Ids de tecla reais na sonda de mapeamento**

Em `RawmDiagnosticPage.tsx`, troque `KEY_IDS` por alvos nomeados pelo botão, resolvidos no núcleo **no clique** (nunca no escopo de módulo):

```tsx
/** The buttons the probe can target; the key id comes from the core. */
const KEY_TARGETS: { buttonId: string; rotulo: string }[] = [
  { buttonId: 'dpi', rotulo: 'Botão de DPI (mais seguro)' },
  { buttonId: 'lateral-traseiro', rotulo: 'Lateral traseiro' },
  { buttonId: 'lateral-dianteiro', rotulo: 'Lateral dianteiro' },
  { buttonId: 'central', rotulo: 'Clique central' },
  { buttonId: 'direito', rotulo: 'Clique direito' },
  { buttonId: 'esquerdo', rotulo: 'Clique esquerdo (arriscado)' },
];
```

O estado passa a guardar `buttonId` (`useState(KEY_TARGETS[0].buttonId)`), o `<select>` lista `KEY_TARGETS` com `value={item.buttonId}`, e a chamada vira:

```tsx
const keyId = leviathanKeyId(buttonId);
if (keyId === null) return; // unreachable: every target is a physical key
probeButtonMapping(device, keyId, action, { comConfigReset: withReset });
```

com `leviathanKeyId` importado do `coreBridge`. Leia o componente antes de editar e mantenha a estrutura de estado e o JSX existentes; troque só o que depende de `KEY_IDS`.

- [ ] **Step 3: A sonda de conjunto reconstrói a sétima tecla**

Em `writeProbe.ts`, `probeMappingSet`, logo depois do laço que monta os mapeamentos:

```ts
// CONFIG_RESET clears the seventh key too, and the driver always rebuilds
// it. A probe that did not would confirm a sequence the app never sends.
events.push(withProtocolEnvelope(encodeLeviathanShowPower(), useCrc));
```

com `encodeLeviathanShowPower` importado do `coreBridge`. Em `writeProbe.test.ts`, acrescente um teste que roda `probeMappingSet` com um conjunto de uma entrada e confere que o último evento enviado (antes do enquadramento) é o show power — siga o padrão de transporte falso que o arquivo já usa para `probeMappingSet`, e compare o evento remontado com `withProtocolEnvelope(encodeLeviathanShowPower(), useCrc)`. Se o arquivo não tiver um teste de `probeMappingSet` para copiar, escreva o transporte falso seguindo o do teste mais próximo e registre isso no relatório.

- [ ] **Step 4: Spec**

Na `## Ordem corrigida`, item 3, acrescente ao final:

```markdown
**Implementado em 2026-09-28** pelo plano `docs/superpowers/plans/2026-09-28-migracao-leitura-dispositivo.md`,
aguardando a confirmação em hardware do roteiro em `docs/smoke-test-leviathan-v4.md`:
`mouseParamSnapshot.ts` foi apagado; `MouseSettings` é do núcleo; a duplicata de `packedDpi`
fechou com `pack_dpi`.
```

Na seção `## Duplicata declarada no caminho de escrita — \`packedDpi\``, acrescente ao final: `**Fechada em 2026-09-28:** \`pack_dpi\` mora ao lado de \`dpi_axes\` em \`notify.rs\`, um teste prova um pelo outro, e os vetores \`paramApply\` cobrem a direção de escrita com eixos independentes.`

- [ ] **Step 5: CLAUDE.md**

- No parágrafo **Estado real**, acrescente ao fim do parágrafo que já fala do passo 2 uma frase: `O passo 3 levou o bloco de parâmetros (\`packages/core/src/protocols/rawm/param_snapshot.rs\`), a descrição, o LOD e a identidade do Leviathan V4 (\`packages/core/src/drivers/leviathan_v4/\`); \`MouseSettings\` é do núcleo.`
- Em **Ainda em TypeScript**, remova o item do passo 3 (a frase passa a começar em \`onboardConfig.ts\` (passo 4)), mantendo o reflow em ~95–100 colunas.
- Em **Duas duplicatas de protocolo sobrevivem**: a de `packedDpi` fechou. Reescreva para "Uma duplicata de protocolo sobrevive **de propósito e declarada**: \`declaredLength\` (\`onboardConfig.ts\`), fecha no passo 4." mantendo a frase sobre como exceções devem ser declaradas.
- Na seção sobre `packages/shared/src/generated/`: "hoje \`MouseActionId\`" vira "hoje \`MouseActionId\`, \`MouseSettings\` e suas partes, o snapshot de parâmetros e a descrição do Leviathan V4"; a guarda agora está em `packages/core/src/bindings.rs` (não mais em `device/actions.rs`), e ela também reprova arquivo órfão no diretório.
- Acrescente à lista de convenções: `**Estrutura nova que atravessa a ponte:** tipo com \`Serialize\`/\`Deserialize\` no núcleo, \`#[cfg_attr(test, derive(ts_rs::TS))]\`, entrada em \`bindings.rs\`, e na ponte \`to_js\`/\`from_js\` (serializador \`json_compatible\`, senão mapas viram \`Map\` e opcionais viram \`undefined\`).`

- [ ] **Step 6: Roteiro de hardware**

Em `docs/smoke-test-leviathan-v4.md`, acrescente ao final:

```markdown
## Passo 3 — roteiro de confirmação (pendente)

O passo 3 moveu para o núcleo a leitura da consulta e o bloco de parâmetros, que é o caminho
de escrita de DPI, polling, LOD, modo e parâmetros. Os bytes estão fixados pelos vetores
`paramSnapshot` e `paramApply`, capturados do TypeScript antigo; o que falta é o mouse aceitar.

1. **Conectar.** Nome, estágios de DPI, polling, modo de desempenho, LOD e as quatro memórias
   aparecem como no mouse.
2. **Escrever.** Mudar um estágio de DPI, o polling, o LOD, o modo, Motion Sync e a rotação;
   aplicar; desconectar e reconectar; os valores persistiram.
3. **Diagnóstico.** Abrir `diagnostico.html`, rodar a leitura: todos os estágios `ok`, o
   snapshot interpretado com os valores do mouse.
4. **Sonda de mapeamentos.** Rodar um conjunto completo; os botões respondem como o conjunto
   diz e o indicador de bateria continua funcionando.

Resultado: _preencher após o teste._
```

- [ ] **Step 7: Gate**

Run: `pnpm verify`
Expected: `format:check`, `lint`, `test`, `build` e `audit` passam.

- [ ] **Step 8: Commit**

```bash
pnpm format
git add apps/web/src docs CLAUDE.md
git commit -m "docs: fechar o passo 3 no codigo e deixar o roteiro de hardware"
```

## Verificação em hardware

**Obrigatória antes do merge.** O roteiro está em `docs/smoke-test-leviathan-v4.md` (Task 9, Step 6). Quem confirma no mouse preenche o resultado, e o spec troca "aguardando a confirmação" por "Fechado em <data>".

## Planos seguintes

Passo 4 — `onboardConfig.ts`, a decodificação do dump `0x14`. Fecha a duplicata declarada `declaredLength`.
