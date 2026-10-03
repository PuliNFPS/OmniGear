# Migração da sessão do Leviathan V4 para o núcleo (passo 5) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o passo 5, o último da migração: a sessão do driver (`LeviathanV4Driver.ts`) e a decodificação de `session.ts` passam para o núcleo sob a interface de passos puxados; `session.ts` e `notifications.ts` são apagados; `LeviathanV4Driver.ts` vira casca — fila, bomba e ouvintes.

**Architecture:** `drivers/leviathan_v4/session.rs` guarda a `LeviathanV4Session`: um único leitor do fluxo de entrada (`feed_report`), o estado do aparelho (snapshot, memória ativa, dump, revisões, assinatura do que o mouse guarda) e as operações (`begin_query`, `begin_apply`, `begin_write_profile`), cujos passos saem um por vez de `next_step`. `drivers/leviathan_v4/mappings.rs` guarda o conjunto que o editor reconstrói, a assinatura tipada e os eventos preservados. `protocols/rawm/query.rs` ganha a identidade. A ponte expõe a sessão como classe (Decisão 4); passos e eventos atravessam como objetos comuns com tipo gerado por `ts-rs`. A casca executa os passos e repassa os eventos.

**Tech Stack:** Rust 2024, `serde`, `serde_json`, `serde_bytes` 0.11, `indexmap` 2, `ts-rs` 12 (dev), `wasm-bindgen` 0.2, `serde-wasm-bindgen` 0.6, TypeScript 5.9, Vitest, pnpm + Turborepo.

**Spec:** `docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md` — seções `## A forma do passo 5: passos puxados, não uma lista pronta`, `## Passo 5 — desenho (2026-10-03)` e `## Como verificar cada passo`.

## Global Constraints

- **O núcleo não faz I/O, é síncrono, não conhece `wasm-bindgen`.** `serde-wasm-bindgen` só na ponte.
- **Migrar é apagar.** O passo só fecha quando `session.ts` e `notifications.ts` não existem e `LeviathanV4Driver.ts` não importa nenhum encoder, nem `withProtocolEnvelope`, `frameEvent`, `parseNotification`, `OnboardConfigCollector` ou `applySettingsToMouseParam`.
- **Paridade.** Mesmos bytes, na mesma ordem, com as mesmas esperas; mesmos eventos; mesmo ciclo de vida da assinatura. A régua são os vetores da Task 1, capturados do TypeScript atual. As exceções são só as declaradas: as três do spec — `abort()` zera a assinatura, a conferência a mais antes da pausa e o montador único reiniciado num relatório malformado — e as quatro desta execução, listadas em "Desvios declarados na execução", abaixo.
- **Escopo.** Ficam fora a macro sobrescrita, a proteção do clique esquerdo e a troca de memória ao aplicar. O defeito da macro é portado como está e registrado num vetor.
- **Mensagens ao usuário idênticas às de hoje.** Os textos estão na tabela `### Erros` do desenho do passo 5, mais `invalid-query-json` (abaixo).
- **Nenhuma chamada à ponte no escopo de módulo.** `new LeviathanV4Session()` só dentro de construtor ou função.
- **Estrutura nova que atravessa a ponte:** `Serialize` no núcleo, `#[cfg_attr(test, derive(ts_rs::TS))]`, entrada em `packages/core/src/bindings.rs`, export em `packages/shared/src/index.ts`, e na ponte `to_js`/`from_js`.
- **Erro novo que atravessa a ponte:** variante em `RawmError`, código em `code()`, dado em `detail()`, texto em `apps/web/src/core/rawmError.ts`.
- **Vetor novo** em `packages/core/vectors/rawm-protocol.json`, lido por `cargo test` **e** `vitest`, com guarda contra seção vazia dos dois lados.
- **Tipos gerados** em `packages/shared/src/generated/`, nunca editados à mão: `UPDATE_BINDINGS=1 cargo test -p gearhub-core generated`.
- **Sem strings de interface no núcleo.**
- **Commits:** `pnpm format` antes de cada um; nunca `packages/core-wasm/pkg`, `graphify-out/`, `.codex/` nem `apps/web/.impeccable/`; adicione arquivos pelo caminho, nunca `git add -A` na raiz. **Sem atribuição de IA.**
- **Gate final:** `pnpm verify`, **e confirmação em hardware** antes do merge.

### Desvios declarados na execução

O spec não os previa; a Task 8 os registra nele.

1. **`InvalidQueryJson`** (`invalid-query-json`, "Identificação RAWM inválida."). Hoje uma resposta que não é JSON mostra a mensagem do `SyntaxError` do navegador, e uma que é JSON mas não é objeto mostra "Identificação RAWM inválida.". As duas passam a mostrar o segundo texto.
2. **Configuração inválida falha no `begin_*`, antes de qualquer byte.** Isso cobre botão desconhecido, ativador R-Plus, modo de desempenho e estágios de DPI. Hoje a aplicação completa já mandou o `CONFIG_RESET` quando o modo falha, e o `writeProfile` já mandou o reset e o `SAVE` de abertura. Só toca caminhos de erro que o editor não produz. Os blocos continuam decididos quando começam; a conferência é um ensaio.
3. **`begin_write_profile(slot: u32)`, e não `u8`.** O `wasm-bindgen` trunca o número para o tipo do parâmetro, e com `u8` a memória 257 viraria a 1.
4. **A checagem de tipo `isMouseSettings` não zera mais a assinatura** quando falha. O caminho é inalcançável: este driver só recebe configuração de mouse.

## Review Focus

As cinco condições que nenhum vetor exercita e que mais podem atingir quem usa o app. Cada uma tem teste na tarefa dona do código.

1. **Uma consulta que estourou o tempo com o envio ainda pendente, seguida de uma aplicação.** O envio velho falha tarde e não pode abortar a aplicação nova (Task 7, "does not let a timed-out query abort the next operation").
2. **O mouse anuncia outra memória durante a última pausa da aplicação.** A aplicação falha com "A memória ativa mudou…", e a próxima reescreve tudo (Task 5, `the_guard_also_fires_during_the_last_pause` e `a_memory_change_mid_apply_stops_it_and_forces_a_full_rewrite`).
3. **O usuário aperta o botão de DPI enquanto os parâmetros saem.** O snapshot fica com o DPI anunciado, e não com o escrito (Task 5, `a_dpi_announced_while_the_parameters_go_out_wins`).
4. **Um relatório de outro canal chega durante a consulta da conexão.** A consulta falha com a mensagem do canal, e a conexão deixa de ouvir o receptor (Task 4, `a_report_that_does_not_decode_fails_only_a_pending_query`; Task 7, "fails the pending query on a report from another channel" e "refuses a mouse that is not a Leviathan V4 and stops listening").
5. **Gravar na memória 0, numa fracionária ou além das que o mouse tem.** É recusado sem enviar nada (Task 5, `a_profile_write_beyond_the_memories_is_refused`; Task 7, os dois testes de `writeProfile`).

## Notas de ambiente

1. **`pnpm core:build` antes de `pnpm --filter @gearhub/web exec vitest run …`** depois de mudar Rust.
2. **Toolchain GNU no Windows:** `winapi-util` fica em 0.1.9 no `Cargo.lock`. Se algo o subir: `cargo update -p winapi-util --precise 0.1.9`.
3. **A ponte usa `json_compatible()` com `serialize_bytes_as_arrays(false)`** (helper `to_js`): um campo `#[serde(with = "serde_bytes")]` vira `Uint8Array`, e `None` vira `null`.
4. **`u64` atravessa o `wasm-bindgen` como `BigInt`.** O `beginQuery` do `coreBridge` converte com `BigInt(epochSeconds)`, como o `buildQueryEvent` já faz.
5. **Caminho por `process.cwd()`, nunca `import.meta.url`**, nos testes do Vitest.
6. **O script de captura da Task 1 não é versionado.** Ele é rodado uma vez e apagado.
7. **`vi.useFakeTimers()` do Vitest não falseia `queueMicrotask`.** O mouse falso responde por microtarefa, e a consulta resolve sem avançar o relógio.

---

## Estrutura de arquivos

**Criados:**

- núcleo: `packages/core/src/drivers/leviathan_v4/session.rs` e `mappings.rs`;
- gerados: `packages/shared/src/generated/{RawmIdentity,HidCommand,SessionStep,SessionEvent}.ts`;
- testes: `apps/web/src/test/sessionVectors.ts` e `apps/web/src/hardware/rawm/leviathanV4Harness.ts`;
- temporário, apagado na Task 7: `apps/web/src/hardware/rawm/legacySessionRunners.ts`.

**Modificados:**

- vetores: `rawm-protocol.json`, `packages/core/tests/vectors.rs`, `apps/web/src/test/vectors.ts`, `apps/web/src/hardware/rawm/vectors.test.ts`;
- núcleo: `packages/core/src/protocols/rawm/{error,query,mod}.rs`, `packages/core/src/command.rs`, `packages/core/src/device/actions.rs`, `packages/core/src/drivers/leviathan_v4/mod.rs`, `packages/core/src/bindings.rs`;
- ponte: `packages/core-wasm/src/lib.rs`;
- casca: `packages/shared/src/index.ts`, `apps/web/src/core/{coreBridge,rawmError}.ts` e os testes deles, `apps/web/src/hardware/rawm/{LeviathanV4Driver,connectLeviathanV4}.ts`;
- testes adaptados: os três `LeviathanV4Driver*.test.ts`, `connectLeviathanV4.test.ts`, `DeviceWorkspace.liveDpi.test.tsx`;
- documentos: o spec, `CLAUDE.md`, `docs/smoke-test-leviathan-v4.md`.

**Apagados:** `apps/web/src/hardware/rawm/{session,notifications}.ts` e os dois testes deles, e `legacySessionRunners.ts`.

---

### Task 1: Vetores da sessão, capturados do TypeScript atual

**Files:**

- Modify: `apps/web/src/test/vectors.ts`
- Create: `apps/web/src/test/sessionVectors.ts`
- Create (temporário): `apps/web/src/hardware/rawm/legacySessionRunners.ts`
- Create (descartável, não versionado): `apps/web/src/hardware/rawm/sessionVectors.capture.test.ts`
- Modify: `apps/web/src/hardware/rawm/session.ts` (só um `export`)
- Modify: `packages/core/vectors/rawm-protocol.json`
- Modify: `apps/web/src/hardware/rawm/vectors.test.ts`

**Interfaces:**

- Produces: as seções de `rawm-protocol.json`, todas com `query` (nome em `queries`) e `patch` (onde `null` remove o campo):
  - `identity: {name, query, patch, expected: {deviceName, productId, vendorId: number|null, crcSupported} | null}[]` — `expected` nulo significa `invalid-identity`;
  - `sessionEvents: {name, query, patch, reports: string[], expected: SessionEventJson[]}[]` — relatórios de 64 bytes em hex;
  - `sessionApply: {name, query, patch, dump: string[] | null, applies: {settings, expected: StepJson[]}[]}[]` — `dump` são os payloads `0x14`, no formato de `onboardDump`;
  - `sessionWriteProfile: {name, query, patch, dump, slot, settings, expected: StepJson[]}[]` — `slot` conta de 0.
- Produces (`apps/web/src/test/vectors.ts`): `StepJson = {send: string} | {wait: number}`, `SlotJson`, `SessionEventJson`.
- Produces (`apps/web/src/test/sessionVectors.ts`): `deliveredReports(event)`, `notifyReport(type, payload)`, `answerReports(raw)`, `shapeSlots(slots)`.

- [ ] **Step 1: Tipos dos vetores**

Em `apps/web/src/test/vectors.ts`, antes de `export interface ProtocolVectors`:

```ts
/** Um passo da sessão como os vetores o guardam: o relatório em hex, ou a espera. */
export type StepJson = { send: string } | { wait: number };

export interface SlotJson {
  index: number;
  bindings: { keyIds: number[]; action: MouseActionId | null; raw: string }[];
}

export type SessionEventJson =
  | { kind: 'dpi'; x: number; y: number }
  | { kind: 'active-slot'; index: number }
  | { kind: 'onboard-slots'; slots: SlotJson[] };

interface IdentityVector {
  name: string;
  query: string;
  patch: Record<string, unknown>;
  /** Null quando a resposta não tem identidade (`invalid-identity`). */
  expected: {
    deviceName: string;
    productId: number;
    vendorId: number | null;
    crcSupported: boolean;
  } | null;
}

interface SessionEventsVector {
  name: string;
  query: string;
  patch: Record<string, unknown>;
  /** Relatórios de 64 bytes, entregues com id 0 depois da consulta. */
  reports: string[];
  expected: SessionEventJson[];
}

interface SessionApplyVector {
  name: string;
  query: string;
  patch: Record<string, unknown>;
  /** Payloads `0x14` entregues antes das aplicações; null quando o dump não chega. */
  dump: string[] | null;
  /** Aplicações em sequência, na mesma sessão. */
  applies: { settings: MouseSettings; expected: StepJson[] }[];
}

interface SessionWriteProfileVector {
  name: string;
  query: string;
  patch: Record<string, unknown>;
  dump: string[] | null;
  /** A memória de destino, contando de 0. */
  slot: number;
  settings: MouseSettings;
  expected: StepJson[];
}
```

e, em `ProtocolVectors`, os campos `identity: IdentityVector[];`, `sessionEvents: SessionEventsVector[];`, `sessionApply: SessionApplyVector[];` e `sessionWriteProfile: SessionWriteProfileVector[];`.

- [ ] **Step 2: Os bytes de entrada da sessão**

Crie `apps/web/src/test/sessionVectors.ts`:

```ts
import type { OnboardSlotConfig } from '@gearhub/shared';
import { frameEvent, withProtocolEnvelope } from '../core/coreBridge';
import { toHex, type SlotJson } from './vectors';

/** O montador exige este preâmbulo antes de cada evento que chega. */
const PREAMBLE = [0xff, 0xff, 0xff, 0xff];
const CMD_NOTIFY = 0x0b;
const CMD_QUERY_RESULT = 0x02;

/** Um evento como chega ao transporte: com o preâmbulo, no canal virtual do mouse. */
export function deliveredReports(event: Uint8Array): Uint8Array[] {
  return frameEvent(Uint8Array.from([...PREAMBLE, ...event]), true);
}

/** Uma notificação do tipo `type`. As dos vetores cabem num relatório. */
export function notifyReport(type: number, payload: ArrayLike<number>): Uint8Array {
  return deliveredReports(
    withProtocolEnvelope([CMD_NOTIFY, 0, type, ...Array.from(payload)], false),
  )[0];
}

/** A resposta de consulta que um mouse com `raw` mandaria, com o terminador nulo do firmware. */
export function answerReports(raw: Record<string, unknown>): Uint8Array[] {
  const json = new TextEncoder().encode(`${JSON.stringify(raw)}\0`);
  return deliveredReports(withProtocolEnvelope([CMD_QUERY_RESULT, 0, ...json], false));
}

/** As memórias com os bytes crus em hex, como os vetores as guardam. */
export function shapeSlots(slots: OnboardSlotConfig[]): SlotJson[] {
  return slots.map((slot) => ({
    index: slot.index,
    bindings: slot.bindings.map((binding) => ({
      keyIds: binding.keyIds,
      action: binding.action,
      raw: toHex(binding.raw),
    })),
  }));
}
```

- [ ] **Step 3: Exportar a validação de identidade**

Em `apps/web/src/hardware/rawm/session.ts`, troque `function validateRawmIdentity` por `export function validateRawmIdentity`. Nada mais muda; o arquivo é apagado na Task 7.

- [ ] **Step 4: Rodar o driver antigo contra as entradas dos vetores**

Crie `apps/web/src/hardware/rawm/legacySessionRunners.ts`:

```ts
import { vi } from 'vitest';
import type { MouseSettings } from '@gearhub/shared';
import { notifyReport, shapeSlots } from '../../test/sessionVectors';
import { fromHex, toHex, type SessionEventJson, type StepJson } from '../../test/vectors';
import type { DeviceReport } from '../deviceDriver';
import { LeviathanV4Driver } from './LeviathanV4Driver';
import { validateRawmIdentity } from './session';

/**
 * O driver TypeScript anterior ao passo 5, rodado contra as entradas dos
 * vetores da sessão. Existe só enquanto as duas implementações coexistem: a
 * Task 7 o apaga junto com o driver antigo.
 */

const NOTIFY_MOUSE_CONFIG = 0x14;

function legacyDriver(raw: Record<string, unknown>) {
  const listeners = new Set<(reportId: number, data: Uint8Array) => void>();
  const steps: StepJson[] = [];
  const driver = new LeviathanV4Driver(
    {
      open: async () => undefined,
      send: async ({ data }) => {
        steps.push({ send: toHex(data) });
      },
      onInputReport: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    raw,
    raw.crc === 1,
  );
  const feed = (report: Uint8Array) => {
    for (const listener of listeners) listener(0, report);
  };
  return { driver, steps, feed };
}

/** O `pause(8)` do driver vira um passo `wait`, na ordem em que acontece entre os envios. */
async function recordingPauses(steps: StepJson[], run: () => Promise<void>): Promise<void> {
  const spy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
    callback: () => void,
    milliseconds?: number,
  ) => {
    steps.push({ wait: milliseconds ?? 0 });
    callback();
    return 0;
  }) as unknown as typeof setTimeout);
  try {
    await run();
  } finally {
    spy.mockRestore();
  }
}

function feedDump(feed: (report: Uint8Array) => void, dump: string[] | null): void {
  for (const payload of dump ?? []) feed(notifyReport(NOTIFY_MOUSE_CONFIG, fromHex(payload)));
}

export function legacyIdentity(raw: Record<string, unknown>) {
  try {
    const { deviceName, productId, vendorId, crcSupported } = validateRawmIdentity(raw);
    return { deviceName, productId, vendorId, crcSupported };
  } catch {
    return null;
  }
}

export function legacyEvents(raw: Record<string, unknown>, reports: string[]): SessionEventJson[] {
  const { driver, feed } = legacyDriver(raw);
  const events: SessionEventJson[] = [];
  let streaming = false;
  driver.onDeviceReport((report: DeviceReport) => {
    // O replay da inscrição não é evento do fluxo.
    if (!streaming) return;
    events.push(
      report.kind === 'dpi'
        ? { kind: 'dpi', x: report.value, y: report.y ?? report.value }
        : { kind: 'active-slot', index: report.slotIndex - 1 },
    );
  });
  driver.onOnboardProfiles((slots) => {
    if (streaming) events.push({ kind: 'onboard-slots', slots: shapeSlots(slots) });
  });
  streaming = true;
  for (const report of reports) feed(fromHex(report));
  return events;
}

export async function legacyApply(
  raw: Record<string, unknown>,
  dump: string[] | null,
  applies: MouseSettings[],
): Promise<StepJson[][]> {
  const { driver, steps, feed } = legacyDriver(raw);
  feedDump(feed, dump);
  const results: StepJson[][] = [];
  for (const settings of applies) {
    steps.length = 0;
    await recordingPauses(steps, () => driver.applyToSession(settings));
    results.push([...steps]);
  }
  return results;
}

export async function legacyWriteProfile(
  raw: Record<string, unknown>,
  dump: string[] | null,
  slot: number,
  settings: MouseSettings,
): Promise<StepJson[]> {
  const { driver, steps, feed } = legacyDriver(raw);
  feedDump(feed, dump);
  await recordingPauses(steps, () => driver.writeProfile(slot + 1, 'Perfil', settings));
  return [...steps];
}
```

- [ ] **Step 5: O script de captura**

Crie `apps/web/src/hardware/rawm/sessionVectors.capture.test.ts`. Ele é descartável e não entra em commit:

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { it } from 'vitest';
import type { MouseSettings } from '@gearhub/shared';
import { withProtocolEnvelope } from '../../core/coreBridge';
import { notifyReport } from '../../test/sessionVectors';
import { applyQueryPatch, readProtocolVectors, toHex } from '../../test/vectors';
import { createLeviathanV4Peripheral } from './leviathanV4';
import { mappingEvents } from './LeviathanV4Driver';
import {
  legacyApply,
  legacyEvents,
  legacyIdentity,
  legacyWriteProfile,
} from './legacySessionRunners';

const PATH = resolve(process.cwd(), '../../packages/core/vectors/rawm-protocol.json');
const QUERY = 'leviathan-v4-captura';
/** Entradas sem nome no app: uma tecla fora do editor, e outra para a memória de destino. */
const ACTIVE_ENTRY = [3, 8, 0x05, 1, 0x60, 1, 2, 3];
const EDITED_ENTRY = [3, 8, 0x05, 1, 0x61, 4, 5, 6];
/** Bytes sem nome no botão esquerdo (0x0a), que o editor reconstrói. */
const MACRO_ON_LEFT = [3, 8, 0x05, 1, 0x0a, 1, 2, 3];
const END = 'ff';

it('captura os vetores da sessão a partir do driver TypeScript atual', async () => {
  const base = readProtocolVectors().queries[QUERY];
  const defaults = createLeviathanV4Peripheral(base, 'captura').defaults as MouseSettings;
  const polling500: MouseSettings = { ...defaults, pollingRate: 500 };
  const withoutCentral: MouseSettings = {
    ...defaults,
    buttons: { ...defaults.buttons, central: 'desativado' },
  };
  const entries = (events: Uint8Array[]) =>
    events.map((event) => toHex(withProtocolEnvelope(event, false)));
  const slot = (index: number, payloads: string[]) => [toHex([index]), ...payloads];
  const notify = (type: number, payload: ArrayLike<number>) => toHex(notifyReport(type, payload));
  const held = entries(mappingEvents(defaults));
  // O evento de uma tecla só: [cmd, len, tipo, contagem = 1, id da tecla, …].
  const heldWithoutLeft = entries(
    mappingEvents(defaults).filter((event) => !(event[3] === 1 && event[4] === 0x0a)),
  );

  const identityCases: [string, Record<string, unknown>][] = [
    ['o mouse da captura', {}],
    ['o receptor, sem crc', { dn: 'RAWM HS Receiver', pi: 9030, vi: 6421, crc: null }],
    ['nome com espaços nas pontas é aparado', { dn: '  Leviathan V4  ' }],
    ['sem vi: fabricante nulo', { vi: null }],
    ['vi que não é número: fabricante nulo', { vi: 'a' }],
    ['crc diferente de 1 não conta', { crc: 2 }],
    ['sem dn', { dn: null }],
    ['dn em branco', { dn: '   ' }],
    ['dn que não é texto', { dn: 5 }],
    ['sem pi', { pi: null }],
    ['pi fracionário', { pi: 1.5 }],
    ['pi negativo', { pi: -1 }],
  ];
  const identity = identityCases.map(([name, patch]) => ({
    name,
    query: QUERY,
    patch,
    expected: legacyIdentity(applyQueryPatch(base, patch)),
  }));

  const eventCases: [string, string[]][] = [
    ['DPI simétrico', [notify(0x00, [0x40, 0x06])]],
    ['DPI com eixos independentes', [notify(0x06, [0x20, 0x03, 0x40, 0x06])]],
    ['DPI zerado não vira evento', [notify(0x00, [0, 0])]],
    ['troca de memória', [notify(0x22, [1])]],
    ['a mesma memória anunciada de novo', [notify(0x22, [0])]],
    ['memória além das que o mouse tem é ignorada', [notify(0x22, [4])]],
    ['polling é ignorado', [notify(0x01, [0xe8, 0x03])]],
    [
      'dump montado',
      [
        notify(0x14, [0]),
        notify(0x14, withProtocolEnvelope(mappingEvents(defaults)[0], false)),
        notify(0x14, [0xff]),
      ],
    ],
    [
      'relatório que não decodifica, sem consulta pendente, é pulado',
      [toHex(new Uint8Array(64).fill(0x11)), notify(0x00, [0x20, 0x03])],
    ],
  ];
  const sessionEvents = eventCases.map(([name, reports]) => ({
    name,
    query: QUERY,
    patch: {},
    reports,
    expected: legacyEvents(base, reports),
  }));

  const applyCases: {
    name: string;
    patch: Record<string, unknown>;
    dump: string[] | null;
    applies: MouseSettings[];
  }[] = [
    { name: 'sem dump: aplicação completa', patch: {}, dump: null, applies: [polling500] },
    {
      name: 'com dump e mapeamentos iguais: só parâmetros',
      patch: {},
      dump: [...slot(0, held), END],
      applies: [polling500],
    },
    {
      name: 'mapeamento mudado: completa, e o que o app não nomeia volta',
      patch: {},
      dump: [...slot(0, [...held, toHex(ACTIVE_ENTRY)]), END],
      applies: [withoutCentral],
    },
    {
      name: 'macro num botão do editor: sempre completa, e a macro não volta',
      patch: {},
      dump: [...slot(0, [...heldWithoutLeft, toHex(MACRO_ON_LEFT)]), END],
      applies: [defaults],
    },
    {
      name: 'duas aplicações seguidas: a segunda só com parâmetros',
      patch: {},
      dump: null,
      applies: [defaults, polling500],
    },
    { name: 'sem CRC', patch: { crc: 0 }, dump: null, applies: [defaults] },
    {
      name: 'dump de outra memória não conta',
      patch: {},
      dump: [...slot(2, held), END],
      applies: [polling500],
    },
  ];
  const sessionApply = [];
  for (const { name, patch, dump, applies } of applyCases) {
    const steps = await legacyApply(applyQueryPatch(base, patch), dump, applies);
    sessionApply.push({
      name,
      query: QUERY,
      patch,
      dump,
      applies: applies.map((settings, index) => ({ settings, expected: steps[index] })),
    });
  }

  const writeCases = [
    {
      name: 'grava na memória de destino, com o que ela guarda sem nome',
      patch: {},
      dump: [...slot(0, [toHex(ACTIVE_ENTRY)]), ...slot(1, [toHex(EDITED_ENTRY)]), END],
      slot: 1,
      settings: defaults,
    },
    {
      name: 'sem dump: o colchete nomeia a memória 4',
      patch: {},
      dump: null,
      slot: 3,
      settings: defaults,
    },
  ];
  const sessionWriteProfile = [];
  for (const { name, patch, dump, slot: target, settings } of writeCases) {
    sessionWriteProfile.push({
      name,
      query: QUERY,
      patch,
      dump,
      slot: target,
      settings,
      expected: await legacyWriteProfile(applyQueryPatch(base, patch), dump, target, settings),
    });
  }

  // Acrescenta as seções no fim do arquivo sem reescrever as que já existem.
  const text = readFileSync(PATH, 'utf8');
  const sections = { identity, sessionEvents, sessionApply, sessionWriteProfile };
  const inserted = Object.entries(sections)
    .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`)
    .join(',\n');
  const end = text.lastIndexOf('}');
  writeFileSync(PATH, `${text.slice(0, end).trimEnd()},\n${inserted}\n}\n`);
});
```

- [ ] **Step 6: Capturar, formatar e apagar o script**

Run: `pnpm core:build && pnpm --filter @gearhub/web exec vitest run src/hardware/rawm/sessionVectors.capture.test.ts`
Expected: PASS, com as quatro seções novas no fim de `rawm-protocol.json`.

Run: `pnpm exec prettier --write packages/core/vectors/rawm-protocol.json && git diff --stat packages/core/vectors/rawm-protocol.json`
Expected: só linhas acrescentadas, nenhuma seção existente reformatada. Se o diff mexer em seções antigas, **pare e reporte**.

Run: `rm apps/web/src/hardware/rawm/sessionVectors.capture.test.ts`

- [ ] **Step 7: Conferir o driver antigo contra os vetores, e o que os nomes prometem**

Em `apps/web/src/hardware/rawm/vectors.test.ts`:

- importe `legacyApply, legacyEvents, legacyIdentity, legacyWriteProfile` de `'./legacySessionRunners'` e o tipo `StepJson` de `'../../test/vectors'`;
- no teste `'tem vetores de todas as seções'`, acrescente `requireNonEmpty(vectors.identity, 'identity');`, `requireNonEmpty(vectors.sessionEvents, 'sessionEvents');`, `requireNonEmpty(vectors.sessionApply, 'sessionApply');` e `requireNonEmpty(vectors.sessionWriteProfile, 'sessionWriteProfile');`;
- depois do helper `query` dentro do `describe`, acrescente:

```ts
it.each(vectors.identity)(
  'identidade (driver antigo): $name',
  ({ query: name, patch, expected }) => {
    expect(legacyIdentity(applyQueryPatch(query(name), patch))).toEqual(expected);
  },
);

it.each(vectors.sessionEvents)(
  'eventos (driver antigo): $name',
  ({ query: name, patch, reports, expected }) => {
    expect(legacyEvents(applyQueryPatch(query(name), patch), reports)).toEqual(expected);
  },
);

it.each(vectors.sessionApply)(
  'aplicação (driver antigo): $name',
  async ({ query: name, patch, dump, applies }) => {
    const steps = await legacyApply(
      applyQueryPatch(query(name), patch),
      dump,
      applies.map(({ settings }) => settings),
    );
    expect(steps).toEqual(applies.map(({ expected }) => expected));
  },
);

it.each(vectors.sessionWriteProfile)(
  'gravação de perfil (driver antigo): $name',
  async ({ query: name, patch, dump, slot, settings, expected }) => {
    expect(
      await legacyWriteProfile(applyQueryPatch(query(name), patch), dump, slot, settings),
    ).toEqual(expected);
  },
);

it('os vetores da sessão dizem o que os nomes dizem', () => {
  const waits = (steps: StepJson[]) => steps.filter((step) => 'wait' in step).length;
  const sent = (steps: StepJson[]) =>
    steps.map((step) => ('send' in step ? step.send : '')).join('|');
  const apply = (name: string) => {
    const found = vectors.sessionApply.find((vector) => vector.name === name);
    if (!found) throw new Error(`vetor ausente: ${name}`);
    return found.applies.map(({ expected }) => expected);
  };
  const [onlyParameters] = apply('com dump e mapeamentos iguais: só parâmetros');
  expect(waits(onlyParameters)).toBe(1);
  const [full] = apply('sem dump: aplicação completa');
  expect(waits(full)).toBeGreaterThan(8);
  const [first, second] = apply('duas aplicações seguidas: a segunda só com parâmetros');
  expect(waits(first)).toBeGreaterThan(8);
  expect(waits(second)).toBe(1);
  const [preserved] = apply('mapeamento mudado: completa, e o que o app não nomeia volta');
  expect(sent(preserved)).toContain('0308050160010203');
  const [macro] = apply('macro num botão do editor: sempre completa, e a macro não volta');
  expect(waits(macro)).toBeGreaterThan(8);
  expect(sent(macro)).not.toContain('030805010a010203');
  const write = vectors.sessionWriteProfile.find(({ slot }) => slot === 1);
  expect(sent(write!.expected)).toContain('0308050161040506');
  expect(sent(write!.expected)).not.toContain('0308050160010203');
});
```

- [ ] **Step 8: Rodar**

Run: `pnpm --filter @gearhub/web exec vitest run src/hardware/rawm/vectors.test.ts`
Expected: PASS. São 12 casos de identidade, 9 de eventos, 7 de aplicação, 2 de gravação, e o teste dos nomes. Se o teste dos nomes reprovar, um caso foi montado errado: corrija o script (recrie-o a partir do Step 5), recapture e registre no relatório.

Run: `cargo test -p gearhub-core --test vectors`
Expected: PASS. O Rust ainda ignora as seções novas.

- [ ] **Step 9: Commit**

```bash
pnpm format
git add packages/core/vectors/rawm-protocol.json apps/web/src/test/vectors.ts apps/web/src/test/sessionVectors.ts apps/web/src/hardware/rawm/legacySessionRunners.ts apps/web/src/hardware/rawm/session.ts apps/web/src/hardware/rawm/vectors.test.ts
git commit -m "test: fixar em vetores a sessao que o driver TypeScript faz hoje"
```

---

### Task 2: Os erros da sessão em `RawmError`

**Files:**

- Modify: `packages/core/src/protocols/rawm/error.rs`
- Modify: `apps/web/src/core/rawmError.ts`, `apps/web/src/core/rawmError.test.ts`

**Interfaces:**

- Produces (`RawmError`): `InvalidIdentity`, `InvalidQueryJson`, `UnrecognizedMouse { name: String }`, `InvalidOnboardIndex`, `InvalidProfileSlot`, `UnknownButton { button: String }`, `InvalidRPlusActivator`, `UnknownRPlusButton { button: String }`, `ActiveSlotChanged`, `OperationInProgress`, `NotQueried`. `detail()` passa a devolver `Option<&str>`.

- [ ] **Step 1: Testes que falham**

Em `error.rs`, no teste `pins_the_stable_code_for_each_variant`, acrescente:

```rust
        assert_eq!(RawmError::InvalidIdentity.code(), "invalid-identity");
        assert_eq!(RawmError::InvalidQueryJson.code(), "invalid-query-json");
        assert_eq!(
            RawmError::UnrecognizedMouse { name: "X".into() }.code(),
            "unrecognized-mouse"
        );
        assert_eq!(RawmError::InvalidOnboardIndex.code(), "invalid-onboard-index");
        assert_eq!(RawmError::InvalidProfileSlot.code(), "invalid-profile-slot");
        assert_eq!(
            RawmError::UnknownButton { button: "x".into() }.code(),
            "unknown-button"
        );
        assert_eq!(
            RawmError::InvalidRPlusActivator.code(),
            "invalid-rplus-activator"
        );
        assert_eq!(
            RawmError::UnknownRPlusButton { button: "x".into() }.code(),
            "unknown-rplus-button"
        );
        assert_eq!(RawmError::ActiveSlotChanged.code(), "active-slot-changed");
        assert_eq!(RawmError::OperationInProgress.code(), "operation-in-progress");
        assert_eq!(RawmError::NotQueried.code(), "not-queried");
```

e, no teste `only_variants_with_data_carry_a_detail`:

```rust
        assert_eq!(
            RawmError::UnrecognizedMouse { name: "RAWM HS Receiver".into() }.detail(),
            Some("RAWM HS Receiver")
        );
        assert_eq!(
            RawmError::UnknownButton { button: "central".into() }.detail(),
            Some("central")
        );
        assert_eq!(
            RawmError::UnknownRPlusButton { button: "dpi".into() }.detail(),
            Some("dpi")
        );
        assert_eq!(RawmError::ActiveSlotChanged.detail(), None);
```

Em `rawmError.test.ts`, importe `asRawmError` se ainda não estiver importado e acrescente:

```ts
describe('erros da sessão', () => {
  it.each([
    ['invalid-identity', 'Resposta RAWM sem identidade válida.'],
    ['invalid-query-json', 'Identificação RAWM inválida.'],
    ['invalid-onboard-index', 'Indice onboard ausente ou invalido na resposta do mouse.'],
    ['invalid-profile-slot', 'Indice de perfil RAWM invalido.'],
    ['invalid-rplus-activator', 'Ativador R-Plus RAWM invalido.'],
    [
      'active-slot-changed',
      'A memória ativa mudou durante a aplicação. Revise o perfil antes de aplicar novamente.',
    ],
    ['operation-in-progress', 'Outra operação RAWM ainda está em andamento.'],
    ['not-queried', 'O mouse ainda não respondeu à consulta.'],
  ])('%s vira o texto de sempre, com o código em cause', (code, text) => {
    const error = asRawmError(new Error(code));
    expect(error.message).toBe(text);
    expect(error.cause).toBe(code);
  });

  it.each([
    ['unrecognized-mouse:RAWM: X', 'Mouse RAWM conectado nao reconhecido: RAWM: X.'],
    ['unknown-button:inexistente', 'Botao RAWM desconhecido: inexistente.'],
    ['unknown-rplus-button:lateral', 'Botao R-Plus RAWM desconhecido: lateral.'],
  ])('%s leva o dado para o texto, mesmo com ":" no dado', (raw, text) => {
    expect(asRawmError(new Error(raw)).message).toBe(text);
  });
});
```

Run: `cargo test -p gearhub-core error && pnpm --filter @gearhub/web exec vitest run src/core/rawmError.test.ts`
Expected: FAIL. O Rust não compila, e o TS não encontra os códigos.

- [ ] **Step 2: As variantes**

Em `error.rs`, ao fim do `enum RawmError`:

```rust
    /// Resposta de consulta sem nome ou sem id de produto.
    InvalidIdentity,
    /// Resposta de consulta cujo texto não é um objeto JSON.
    InvalidQueryJson,
    /// O mouse que respondeu não é um Leviathan V4; `name` é o nome que ele declarou.
    UnrecognizedMouse { name: String },
    /// `oci` ausente, fracionário ou além das memórias que o mouse tem.
    InvalidOnboardIndex,
    /// Memória de destino além das que o mouse tem.
    InvalidProfileSlot,
    /// Botão do editor que este aparelho não tem.
    UnknownButton { button: String },
    /// Ativador da camada R-Plus que este aparelho não tem.
    InvalidRPlusActivator,
    /// Botão da camada R-Plus que este aparelho não tem.
    UnknownRPlusButton { button: String },
    /// O mouse trocou de memória no meio de uma aplicação à sessão.
    ActiveSlotChanged,
    /// Uma operação começou antes de a anterior terminar.
    OperationInProgress,
    /// Uma escrita antes de a primeira resposta ligar a sessão.
    NotQueried,
```

Em `code()`:

```rust
            Self::InvalidIdentity => "invalid-identity",
            Self::InvalidQueryJson => "invalid-query-json",
            Self::UnrecognizedMouse { .. } => "unrecognized-mouse",
            Self::InvalidOnboardIndex => "invalid-onboard-index",
            Self::InvalidProfileSlot => "invalid-profile-slot",
            Self::UnknownButton { .. } => "unknown-button",
            Self::InvalidRPlusActivator => "invalid-rplus-activator",
            Self::UnknownRPlusButton { .. } => "unknown-rplus-button",
            Self::ActiveSlotChanged => "active-slot-changed",
            Self::OperationInProgress => "operation-in-progress",
            Self::NotQueried => "not-queried",
```

E troque `detail()` inteiro por:

```rust
    /// O dado que acompanha o código, quando há um. A ponte o envia junto
    /// (`código:dado`), e a casca o usa para montar a mensagem.
    pub fn detail(&self) -> Option<&str> {
        match self {
            Self::InvalidSnapshotField { field } | Self::IncompleteQuery { field } => Some(field),
            Self::UnrecognizedMouse { name } => Some(name),
            Self::UnknownButton { button } | Self::UnknownRPlusButton { button } => Some(button),
            _ => None,
        }
    }
```

O `js_error` da ponte (`packages/core-wasm/src/lib.rs`) compila sem mudança.

- [ ] **Step 3: Os textos**

Em `apps/web/src/core/rawmError.ts`, ao fim de `MESSAGES`:

```ts
  'invalid-identity': 'Resposta RAWM sem identidade válida.',
  'invalid-query-json': 'Identificação RAWM inválida.',
  'unrecognized-mouse': 'Mouse RAWM conectado nao reconhecido: {campo}.',
  'invalid-onboard-index': 'Indice onboard ausente ou invalido na resposta do mouse.',
  'invalid-profile-slot': 'Indice de perfil RAWM invalido.',
  'unknown-button': 'Botao RAWM desconhecido: {campo}.',
  'invalid-rplus-activator': 'Ativador R-Plus RAWM invalido.',
  'unknown-rplus-button': 'Botao R-Plus RAWM desconhecido: {campo}.',
  'active-slot-changed':
    'A memória ativa mudou durante a aplicação. Revise o perfil antes de aplicar novamente.',
  'operation-in-progress': 'Outra operação RAWM ainda está em andamento.',
  'not-queried': 'O mouse ainda não respondeu à consulta.',
```

Em `rawmError.test.ts`, o comentário do primeiro `describe` fala em "catorze strings": passe para "vinte e cinco".

- [ ] **Step 4: Rodar**

Run: `cargo test --workspace && cargo clippy --workspace --all-targets -- -D warnings && pnpm core:build && pnpm --filter @gearhub/web exec vitest run src/core`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm format
git add packages/core/src/protocols/rawm/error.rs apps/web/src/core/rawmError.ts apps/web/src/core/rawmError.test.ts
git commit -m "feat: erros da sessao do driver no RawmError"
```

---

### Task 3: A identidade no núcleo

**Files:**

- Modify: `packages/core/src/protocols/rawm/query.rs`, `packages/core/src/protocols/rawm/mod.rs`
- Modify: `packages/core/src/bindings.rs`
- Create (gerado): `packages/shared/src/generated/RawmIdentity.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/core/tests/vectors.rs`

**Interfaces:**

- Consumes: `RawmError::{InvalidIdentity, InvalidQueryJson}` (Task 2); `super::json::{integer, number}`.
- Produces (`gearhub_core::protocols::rawm`):
  - `RawmIdentity { device_name: String, product_id: u32, vendor_id: Option<u32>, crc_supported: bool, raw: serde_json::Value }`, com `Serialize`, `Debug`, `Clone` e `PartialEq`, em camelCase; `raw` atravessa como `Record<string, unknown>`;
  - `parse_identity(raw: Value) -> Result<RawmIdentity, RawmError>`;
  - `parse_query_answer(event: &[u8]) -> Result<RawmIdentity, RawmError>`.

- [ ] **Step 1: Teste de vetor (falha por não compilar)**

Em `packages/core/tests/vectors.rs`, acrescente `parse_identity` ao `use gearhub_core::protocols::rawm::{…}`, e:

```rust
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExpectedIdentity {
    device_name: String,
    product_id: u32,
    vendor_id: Option<u32>,
    crc_supported: bool,
}

#[derive(Deserialize)]
struct IdentityVector {
    name: String,
    query: String,
    patch: serde_json::Map<String, serde_json::Value>,
    expected: Option<ExpectedIdentity>,
}
```

o campo `identity: Vec<IdentityVector>,` em `Vectors`, e:

```rust
#[test]
fn identities_match_the_shared_vectors() {
    let vectors = vectors();
    require_non_empty(&vectors.identity, "identity");
    for vector in &vectors.identity {
        let raw = patched(query(&vectors, &vector.query), &vector.patch);
        match (parse_identity(raw), &vector.expected) {
            (Ok(identity), Some(expected)) => {
                assert_eq!(identity.device_name, expected.device_name, "{}", vector.name);
                assert_eq!(identity.product_id, expected.product_id, "{}", vector.name);
                assert_eq!(identity.vendor_id, expected.vendor_id, "{}", vector.name);
                assert_eq!(identity.crc_supported, expected.crc_supported, "{}", vector.name);
            }
            (Err(RawmError::InvalidIdentity), None) => {}
            (result, _) => panic!("{}: veio {result:?}", vector.name),
        }
    }
}
```

Run: `cargo test -p gearhub-core --test vectors`
Expected: FAIL de compilação.

- [ ] **Step 2: A identidade**

Em `query.rs`, acrescente aos `use`:

```rust
use serde::Serialize;
use serde_json::Value;

use super::json::{integer, number};
```

e, depois de `query_json`:

```rust
/// Quem respondeu à consulta, e a resposta inteira.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct RawmIdentity {
    pub device_name: String,
    pub product_id: u32,
    /// Null quando a resposta não traz um id de fabricante válido.
    pub vendor_id: Option<u32>,
    pub crc_supported: bool,
    /// A resposta como chegou, para quem descreve o aparelho.
    #[cfg_attr(test, ts(type = "Record<string, unknown>"))]
    pub raw: Value,
}

/// Um id USB: inteiro, não negativo. Ids têm 16 bits; um valor além de `u32`
/// conta como ausente.
fn usb_id(value: Option<&Value>) -> Option<u32> {
    value
        .and_then(integer)
        .and_then(|id| u32::try_from(id).ok())
}

/// A identidade que a resposta declara. O nome é aparado; sem nome ou sem
/// produto não há identidade. Reproduz o `validateRawmIdentity` de `session.ts`.
pub fn parse_identity(raw: Value) -> Result<RawmIdentity, RawmError> {
    let device_name = raw
        .get("dn")
        .and_then(Value::as_str)
        .map(str::trim)
        .unwrap_or_default()
        .to_owned();
    if device_name.is_empty() {
        return Err(RawmError::InvalidIdentity);
    }
    let product_id = usb_id(raw.get("pi")).ok_or(RawmError::InvalidIdentity)?;
    Ok(RawmIdentity {
        device_name,
        product_id,
        vendor_id: usb_id(raw.get("vi")),
        crc_supported: raw.get("crc").and_then(number) == Some(1.0),
        raw,
    })
}

/// A resposta à consulta, lida até a identidade.
pub fn parse_query_answer(event: &[u8]) -> Result<RawmIdentity, RawmError> {
    let text = query_json(event)?;
    let raw: Value = serde_json::from_str(&text).map_err(|_| RawmError::InvalidQueryJson)?;
    if !raw.is_object() {
        return Err(RawmError::InvalidQueryJson);
    }
    parse_identity(raw)
}
```

Nos testes de `query.rs`:

```rust
    #[test]
    fn the_answer_must_be_a_json_object() {
        let event = |text: &str| {
            let mut body = vec![0x02, 0];
            body.extend_from_slice(text.as_bytes());
            body.push(0);
            with_protocol_envelope(&body, false).expect("válido")
        };
        assert_eq!(parse_query_answer(&event("[1]")), Err(RawmError::InvalidQueryJson));
        assert_eq!(parse_query_answer(&event("{")), Err(RawmError::InvalidQueryJson));
        assert_eq!(
            parse_query_answer(&event(r#"{"dn":"Leviathan V4","pi":9026}"#))
                .map(|identity| identity.product_id),
            Ok(9026)
        );
    }
```

Em `mod.rs`: `pub use query::{RawmIdentity, build_query_event, is_query_result, parse_identity, parse_query_answer, query_json};`.

- [ ] **Step 3: O tipo gerado**

Em `bindings.rs`, importe `RawmIdentity` junto de `MouseParamSnapshot` e acrescente `("RawmIdentity", render::<RawmIdentity>()),` ao fim de `generated()`. Rode `UPDATE_BINDINGS=1 cargo test -p gearhub-core generated` e confira `packages/shared/src/generated/RawmIdentity.ts`. Ele deve declarar `raw: Record<string, unknown>` e `vendorId: number | null`.

Em `packages/shared/src/index.ts`: `export type { RawmIdentity } from './generated/RawmIdentity';`.

- [ ] **Step 4: Rodar**

Run: `cargo test --workspace && cargo clippy --workspace --all-targets -- -D warnings`
Expected: PASS, com os 12 casos de identidade conferidos pelo Rust.

- [ ] **Step 5: Commit**

```bash
pnpm format
git add packages/core/src/protocols/rawm packages/core/src/bindings.rs packages/core/tests/vectors.rs packages/shared/src
git commit -m "feat: identidade da consulta no nucleo"
```

---

### Task 4: A sessão no núcleo — leitura

**Files:**

- Create: `packages/core/src/drivers/leviathan_v4/session.rs`
- Modify: `packages/core/src/drivers/leviathan_v4/mod.rs`
- Modify: `packages/core/src/command.rs`
- Modify: `packages/core/src/bindings.rs`
- Create (gerados): `packages/shared/src/generated/{HidCommand,SessionStep,SessionEvent}.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/core/tests/vectors.rs`

**Interfaces:**

- Consumes: `parse_query_answer`, `RawmIdentity` (Task 3); `RawmError::{UnrecognizedMouse, InvalidOnboardIndex, OperationInProgress}` (Task 2).
- Produces (`gearhub_core::drivers::leviathan_v4`):
  - `LeviathanV4Session` com `new()`, `feed_report(&mut self, report_id: u8, report: &[u8]) -> Result<Vec<SessionEvent>, RawmError>`, `begin_query(&mut self, epoch_seconds: u64) -> Result<(), RawmError>`, `next_step(&mut self) -> Result<Option<Step>, RawmError>`, `abort(&mut self)`, `active_slot(&self) -> Option<u8>`, `dpi(&self) -> Option<DpiAxes>` e `slots(&self) -> Option<&[OnboardSlotConfig]>`;
  - `Step::{Send(HidCommand), Wait { ms: u32 }}`, gerado em TS como `SessionStep`;
  - `SessionEvent::{Queried(RawmIdentity), Dpi(DpiAxes), ActiveSlot { index: u8 }, OnboardSlots { slots }}`;
  - `QUERY_TIMEOUT_MS: u32 = 1000`.
- Produces (`gearhub_core::command`): `HidCommand` passa a derivar `Serialize`, com `data` em `Uint8Array` na ponte.

- [ ] **Step 1: Teste de vetor (falha por não compilar)**

Em `packages/core/tests/vectors.rs`:

- acrescente `frame_event` ao `use gearhub_core::protocols::rawm::{…}`;
- acrescente a linha `use gearhub_core::drivers::leviathan_v4::{LeviathanV4Session, SessionEvent};`;
- acrescente o campo `session_events: Vec<SessionEventsVector>,` em `Vectors`;
- acrescente:

```rust
#[derive(Deserialize)]
struct SessionEventsVector {
    name: String,
    query: String,
    patch: serde_json::Map<String, serde_json::Value>,
    reports: Vec<String>,
    expected: Vec<serde_json::Value>,
}

const PREAMBLE: [u8; 4] = [0xff; 4];

/// Um evento como chega ao transporte: com o preâmbulo, no canal virtual.
fn delivered(event: &[u8]) -> Vec<[u8; 64]> {
    let mut chunk = PREAMBLE.to_vec();
    chunk.extend_from_slice(event);
    frame_event(&chunk, true)
}

/// Uma sessão ligada pela resposta que um mouse com `raw` mandaria.
fn connected(raw: &serde_json::Value) -> LeviathanV4Session {
    let mut session = LeviathanV4Session::new();
    session.begin_query(0).expect("consulta");
    while session.next_step().expect("passo").is_some() {}
    let mut body = vec![0x02, 0];
    body.extend(serde_json::to_vec(raw).expect("json"));
    body.push(0);
    let mut events = Vec::new();
    for report in delivered(&with_protocol_envelope(&body, false).expect("resposta")) {
        events.extend(session.feed_report(0, &report).expect("resposta lida"));
    }
    assert!(
        matches!(events.last(), Some(SessionEvent::Queried(_))),
        "a resposta não ligou a sessão"
    );
    session
}

/// O evento na forma dos vetores: bytes crus em hex.
fn shaped_event(event: &SessionEvent) -> serde_json::Value {
    use serde_json::json;
    match event {
        SessionEvent::Queried(identity) => {
            json!({ "kind": "queried", "deviceName": identity.device_name })
        }
        SessionEvent::Dpi(axes) => json!({ "kind": "dpi", "x": axes.x, "y": axes.y }),
        SessionEvent::ActiveSlot { index } => json!({ "kind": "active-slot", "index": index }),
        SessionEvent::OnboardSlots { slots } => json!({
            "kind": "onboard-slots",
            "slots": slots.iter().map(|slot| json!({
                "index": slot.index,
                "bindings": slot.bindings.iter().map(|binding| json!({
                    "keyIds": binding.key_ids,
                    "action": binding.action.map(|action| action.as_str()),
                    "raw": to_hex(&binding.raw),
                })).collect::<Vec<_>>(),
            })).collect::<Vec<_>>(),
        }),
    }
}

#[test]
fn session_events_match_the_shared_vectors() {
    let vectors = vectors();
    require_non_empty(&vectors.session_events, "sessionEvents");
    for vector in &vectors.session_events {
        let mut session = connected(&patched(query(&vectors, &vector.query), &vector.patch));
        let mut events = Vec::new();
        for report in &vector.reports {
            let read = session
                .feed_report(0, &from_hex(report))
                .unwrap_or_else(|error| panic!("{}: {error:?}", vector.name));
            events.extend(read.iter().map(shaped_event));
        }
        assert_eq!(events, vector.expected, "{}", vector.name);
    }
}
```

Run: `cargo test -p gearhub-core --test vectors`
Expected: FAIL de compilação.

- [ ] **Step 2: `HidCommand` atravessa a ponte**

Troque `packages/core/src/command.rs` por:

```rust
use serde::Serialize;

/// Um relatório HID pronto para enviar. O núcleo o monta; quem envia é a casca.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct HidCommand {
    pub report_id: u8,
    #[serde(with = "serde_bytes")]
    #[cfg_attr(test, ts(type = "Uint8Array"))]
    pub data: Vec<u8>,
}
```

- [ ] **Step 3: `session.rs`, a leitura**

Crie `packages/core/src/drivers/leviathan_v4/session.rs`:

```rust
//! A sessão do Leviathan V4: o que o mouse tem agora, e o que enviar a seguir.
//!
//! O núcleo não faz I/O e é síncrono: não envia nem espera nada. Ele decide o
//! próximo passo no instante em que a casca o pede (`next_step`), e a casca o
//! executa; o que chega do mouse entra por `feed_report`. Pedir um passo por
//! vez é o que deixa o núcleo ver, entre dois passos, o que o mouse anunciou —
//! ver `## A forma do passo 5` em
//! `docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md`.

use std::collections::VecDeque;

use serde::Serialize;
use serde_json::Value;

use super::description::{DpiAxes, onboard_slot_count};
use super::identity::is_device_name;
use crate::command::HidCommand;
use crate::protocols::rawm::json::integer;
use crate::protocols::rawm::{
    MouseParamSnapshot, OnboardConfigCollector, OnboardSlotConfig, RawEventAssembler, RawmError,
    RawmIdentity, RawmNotification, build_query_event, decode_report_chunk, dpi_axes, frame_event,
    is_query_result, parse_mouse_param_snapshot, parse_notification, parse_query_answer,
};

/// Quanto a casca espera a resposta de uma consulta, contando a abertura do dispositivo.
pub const QUERY_TIMEOUT_MS: u32 = 1000;

/// O canal em que o receptor entrega o mouse; os outros ids são tráfego dele.
const VENDOR_REPORT_ID: u8 = 0;

type Report = [u8; 64];

/// O que a casca faz a seguir.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(rename = "SessionStep"))]
pub enum Step {
    /// Enviar este relatório.
    Send(HidCommand),
    /// Esperar antes de pedir o próximo passo.
    Wait { ms: u32 },
}

/// O que um relatório que chegou significa.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub enum SessionEvent {
    /// A resposta à consulta pendente.
    Queried(RawmIdentity),
    /// O mouse anunciou um DPI, com os dois eixos diferentes de zero.
    Dpi(DpiAxes),
    /// O mouse anunciou a memória ativa — mesmo a que já era.
    ActiveSlot { index: u8 },
    /// O dump das memórias terminou de chegar.
    OnboardSlots { slots: Vec<OnboardSlotConfig> },
}

/// O que a primeira resposta revelou do aparelho.
#[derive(Debug)]
struct Device {
    slot_count: u32,
    snapshot: MouseParamSnapshot,
    active_slot: u8,
}

#[derive(Debug)]
struct Query {
    reports: VecDeque<Report>,
}

#[derive(Debug)]
enum Operation {
    /// Enviando a consulta, ou esperando a resposta.
    Query(Query),
}

#[derive(Debug, Default)]
pub struct LeviathanV4Session {
    /// O único leitor do fluxo: consulta, notificações e dump passam por ele.
    assembler: RawEventAssembler,
    collector: OnboardConfigCollector,
    /// `None` até a primeira resposta.
    device: Option<Device>,
    /// `None` até o dump terminar de chegar.
    slots: Option<Vec<OnboardSlotConfig>>,
    operation: Option<Operation>,
}

impl LeviathanV4Session {
    pub fn new() -> Self {
        Self::default()
    }

    /// A memória que o mouse está usando, contando de 0; `None` antes da primeira resposta.
    pub fn active_slot(&self) -> Option<u8> {
        self.device.as_ref().map(|device| device.active_slot)
    }

    /// O DPI que o mouse está usando; `None` antes da primeira resposta.
    pub fn dpi(&self) -> Option<DpiAxes> {
        self.device
            .as_ref()
            .map(|device| axes(device.snapshot.resolution))
    }

    /// As memórias do último dump; `None` até ele terminar de chegar.
    pub fn slots(&self) -> Option<&[OnboardSlotConfig]> {
        self.slots.as_deref()
    }

    /// Começa uma consulta. A primeira resposta liga a sessão; as seguintes a
    /// atualizam. A casca espera o `Queried` contra `QUERY_TIMEOUT_MS`.
    pub fn begin_query(&mut self, epoch_seconds: u64) -> Result<(), RawmError> {
        self.ensure_idle()?;
        let event = build_query_event(epoch_seconds)?;
        self.operation = Some(Operation::Query(Query {
            reports: frame_event(&event, true).into(),
        }));
        Ok(())
    }

    /// O próximo passo da operação em andamento; `None` quando não há o que fazer.
    pub fn next_step(&mut self) -> Result<Option<Step>, RawmError> {
        match self.operation.as_mut() {
            None => Ok(None),
            // A consulta continua pendente depois do último envio, até a resposta chegar.
            Some(Operation::Query(query)) => Ok(query.reports.pop_front().map(send)),
        }
    }

    /// Encerra a operação em andamento. Sem operação, nada.
    pub fn abort(&mut self) {
        self.operation = None;
    }

    /// Bytes que chegaram, e o que eles significam.
    ///
    /// Só falha com uma consulta pendente — e então a encerra. Sem consulta
    /// pendente, um relatório que não decodifica reinicia o montador e é
    /// pulado: o mesmo canal leva quadros do próprio receptor.
    pub fn feed_report(
        &mut self,
        report_id: u8,
        report: &[u8],
    ) -> Result<Vec<SessionEvent>, RawmError> {
        if report_id != VENDOR_REPORT_ID {
            return Ok(Vec::new());
        }
        let events = match self.assemble(report) {
            Ok(events) => events,
            Err(error) => {
                self.assembler.reset();
                if self.query_pending() {
                    self.operation = None;
                    return Err(error);
                }
                return Ok(Vec::new());
            }
        };
        let mut read = Vec::new();
        for event in events {
            if is_query_result(&event) {
                // Uma resposta que ninguém pediu é ignorada, como antes.
                if self.query_pending() {
                    self.operation = None;
                    read.push(self.answer(&event)?);
                }
                continue;
            }
            if let Some(notification) = parse_notification(&event) {
                read.extend(self.notify(notification));
            }
        }
        Ok(read)
    }

    fn ensure_idle(&self) -> Result<(), RawmError> {
        match self.operation {
            Some(_) => Err(RawmError::OperationInProgress),
            None => Ok(()),
        }
    }

    fn query_pending(&self) -> bool {
        matches!(self.operation, Some(Operation::Query(_)))
    }

    fn assemble(&mut self, report: &[u8]) -> Result<Vec<Vec<u8>>, RawmError> {
        match decode_report_chunk(report, true)? {
            Some(chunk) if !chunk.is_empty() => self.assembler.push(&chunk),
            _ => Ok(Vec::new()),
        }
    }

    /// A primeira resposta confere o nome e o snapshot e liga a sessão; as
    /// seguintes exigem `oci` e atualizam memória e snapshot.
    fn answer(&mut self, event: &[u8]) -> Result<SessionEvent, RawmError> {
        let identity = parse_query_answer(event)?;
        let raw = &identity.raw;
        match self.device.as_mut() {
            None => {
                if !is_device_name(&identity.device_name) {
                    return Err(RawmError::UnrecognizedMouse {
                        name: identity.device_name.clone(),
                    });
                }
                let snapshot = parse_mouse_param_snapshot(raw)?;
                let slot_count = onboard_slot_count(raw);
                // Na conexão, um `oci` ausente vale a memória 0, como o construtor do driver fazia.
                let oci = raw
                    .get("oci")
                    .filter(|value| !value.is_null())
                    .cloned()
                    .unwrap_or_else(|| Value::from(0));
                let active_slot = onboard_index(&oci, slot_count)?;
                self.device = Some(Device {
                    slot_count,
                    snapshot,
                    active_slot,
                });
            }
            Some(device) => {
                let active_slot =
                    onboard_index(raw.get("oci").unwrap_or(&Value::Null), device.slot_count)?;
                device.snapshot = parse_mouse_param_snapshot(raw)?;
                device.active_slot = active_slot;
            }
        }
        Ok(SessionEvent::Queried(identity))
    }

    fn notify(&mut self, notification: RawmNotification) -> Option<SessionEvent> {
        match notification {
            RawmNotification::Dpi(value) => self.dpi_announced(u32::from(value)),
            RawmNotification::DpiXy(value) => self.dpi_announced(value),
            // O app não acompanha a taxa anunciada.
            RawmNotification::Polling(_) => None,
            RawmNotification::OnboardIndex(index) => {
                let device = self.device.as_mut()?;
                if u32::from(index) >= device.slot_count {
                    return None;
                }
                device.active_slot = index;
                Some(SessionEvent::ActiveSlot { index })
            }
            RawmNotification::OnboardConfig(payload) => {
                let slots = self.collector.push(&payload)?;
                self.slots = Some(slots.clone());
                Some(SessionEvent::OnboardSlots { slots })
            }
        }
    }

    /// O snapshot acompanha todo DPI anunciado; o evento só sai com os dois eixos.
    fn dpi_announced(&mut self, value: u32) -> Option<SessionEvent> {
        let device = self.device.as_mut()?;
        device.snapshot.resolution = value;
        let announced = axes(value);
        (announced.x != 0 && announced.y != 0).then_some(SessionEvent::Dpi(announced))
    }
}

fn send(report: Report) -> Step {
    Step::Send(HidCommand {
        report_id: VENDOR_REPORT_ID,
        data: report.to_vec(),
    })
}

/// A memória ativa que a resposta declara: inteira, de 0 ao número de memórias.
fn onboard_index(value: &Value, slot_count: u32) -> Result<u8, RawmError> {
    integer(value)
        .filter(|index| (0..i64::from(slot_count)).contains(index))
        .map(|index| index as u8)
        .ok_or(RawmError::InvalidOnboardIndex)
}

fn axes(value: u32) -> DpiAxes {
    let (x, y) = dpi_axes(value);
    DpiAxes {
        x: u32::from(x),
        y: u32::from(y),
    }
}
```

Em `drivers/leviathan_v4/mod.rs`: `mod session;` e `pub use session::{LeviathanV4Session, QUERY_TIMEOUT_MS, SessionEvent, Step};`.

- [ ] **Step 4: Testes de unidade da leitura**

Ao fim de `session.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocols::rawm::with_protocol_envelope;
    use serde_json::json;

    const PREAMBLE: [u8; 4] = [0xff; 4];

    fn capture() -> Value {
        let vectors: Value =
            serde_json::from_str(include_str!("../../../vectors/rawm-protocol.json")).unwrap();
        vectors["queries"]["leviathan-v4-captura"].clone()
    }

    fn delivered(event: &[u8]) -> Vec<Report> {
        let mut chunk = PREAMBLE.to_vec();
        chunk.extend_from_slice(event);
        frame_event(&chunk, true)
    }

    fn answer_reports(raw: &Value) -> Vec<Report> {
        let mut body = vec![0x02, 0];
        body.extend(serde_json::to_vec(raw).unwrap());
        body.push(0);
        delivered(&with_protocol_envelope(&body, false).unwrap())
    }

    fn notify(kind: u8, payload: &[u8]) -> Report {
        let mut body = vec![0x0b, 0, kind];
        body.extend_from_slice(payload);
        delivered(&with_protocol_envelope(&body, false).unwrap())[0]
    }

    fn feed(
        session: &mut LeviathanV4Session,
        reports: &[Report],
    ) -> Result<Vec<SessionEvent>, RawmError> {
        let mut events = Vec::new();
        for report in reports {
            events.extend(session.feed_report(0, report)?);
        }
        Ok(events)
    }

    fn drain(session: &mut LeviathanV4Session) -> Result<Vec<Step>, RawmError> {
        let mut steps = Vec::new();
        while let Some(step) = session.next_step()? {
            steps.push(step);
        }
        Ok(steps)
    }

    fn query(
        session: &mut LeviathanV4Session,
        raw: &Value,
    ) -> Result<Vec<SessionEvent>, RawmError> {
        session.begin_query(0).unwrap();
        drain(session).unwrap();
        feed(session, &answer_reports(raw))
    }

    fn connected() -> LeviathanV4Session {
        let mut session = LeviathanV4Session::new();
        query(&mut session, &capture()).unwrap();
        session
    }

    #[test]
    fn the_first_answer_connects_the_session() {
        let mut session = LeviathanV4Session::new();
        assert_eq!(session.active_slot(), None);
        assert_eq!(session.dpi(), None);
        let events = query(&mut session, &capture()).unwrap();
        assert!(matches!(
            events.as_slice(),
            [SessionEvent::Queried(identity)] if identity.device_name == "LEVIATHAN V4"
        ));
        assert_eq!(session.active_slot(), Some(0));
        assert_eq!(session.dpi(), Some(DpiAxes { x: 800, y: 800 }));
    }

    #[test]
    fn the_query_sends_without_pauses_and_stays_pending_until_answered() {
        let mut session = LeviathanV4Session::new();
        session.begin_query(0x1234_5678).unwrap();
        let steps = drain(&mut session).unwrap();
        assert_eq!(steps.len(), 1);
        assert!(matches!(
            &steps[0],
            Step::Send(command) if command.report_id == 0 && command.data[0] == 0xc0
        ));
        assert_eq!(session.begin_query(0), Err(RawmError::OperationInProgress));
        feed(&mut session, &answer_reports(&capture())).unwrap();
        assert_eq!(session.begin_query(0), Ok(()));
    }

    #[test]
    fn a_mouse_that_is_not_a_leviathan_is_refused() {
        let mut raw = capture();
        raw["dn"] = json!("RAWM HS Receiver");
        let mut session = LeviathanV4Session::new();
        assert_eq!(
            query(&mut session, &raw),
            Err(RawmError::UnrecognizedMouse {
                name: "RAWM HS Receiver".into()
            })
        );
        assert_eq!(session.active_slot(), None);
        assert_eq!(session.begin_query(0), Ok(()));
    }

    #[test]
    fn connecting_without_oci_means_memory_zero_but_a_later_query_requires_it() {
        let mut raw = capture();
        raw.as_object_mut().unwrap().remove("oci");
        let mut session = LeviathanV4Session::new();
        query(&mut session, &raw).unwrap();
        assert_eq!(session.active_slot(), Some(0));
        assert_eq!(query(&mut session, &raw), Err(RawmError::InvalidOnboardIndex));
    }

    #[test]
    fn a_later_query_updates_the_memory_and_the_dpi() {
        let mut session = connected();
        let mut raw = capture();
        raw["oci"] = json!(2);
        raw["cpi"] = json!(3200);
        query(&mut session, &raw).unwrap();
        assert_eq!(session.active_slot(), Some(2));
        assert_eq!(session.dpi(), Some(DpiAxes { x: 3200, y: 3200 }));
    }

    #[test]
    fn an_answer_nobody_asked_for_is_ignored() {
        let mut session = connected();
        let mut raw = capture();
        raw["oci"] = json!(3);
        assert_eq!(feed(&mut session, &answer_reports(&raw)), Ok(vec![]));
        assert_eq!(session.active_slot(), Some(0));
    }

    #[test]
    fn a_report_that_does_not_decode_fails_only_a_pending_query() {
        let foreign = [0x11; 64];
        let mut session = connected();
        assert_eq!(session.feed_report(0, &foreign), Ok(vec![]));
        assert_eq!(feed(&mut session, &[notify(0x00, &[0x40, 0x06])]).unwrap().len(), 1);

        session.begin_query(0).unwrap();
        drain(&mut session).unwrap();
        assert_eq!(session.feed_report(0, &foreign), Err(RawmError::WrongChannel));
        // A consulta que falhou acabou: outra pode começar.
        assert_eq!(session.begin_query(0), Ok(()));
    }

    #[test]
    fn reports_outside_the_vendor_channel_are_ignored() {
        let mut session = connected();
        assert_eq!(session.feed_report(1, &notify(0x22, &[1])), Ok(vec![]));
        assert_eq!(session.active_slot(), Some(0));
    }

    #[test]
    fn notifications_before_the_first_answer_change_nothing() {
        let mut session = LeviathanV4Session::new();
        let read = feed(&mut session, &[notify(0x00, &[0x40, 0x06]), notify(0x22, &[1])]);
        assert_eq!(read, Ok(vec![]));
        assert_eq!(session.active_slot(), None);
    }

    #[test]
    fn abort_ends_a_pending_query() {
        let mut session = LeviathanV4Session::new();
        session.begin_query(0).unwrap();
        session.abort();
        assert_eq!(session.next_step(), Ok(None));
        assert_eq!(session.begin_query(0), Ok(()));
    }
}
```

- [ ] **Step 5: Os tipos gerados**

Em `bindings.rs`:

- importe `crate::command::HidCommand`;
- acrescente `SessionEvent` e `Step` ao `use crate::drivers::leviathan_v4::{…}`;
- acrescente a `generated()`:

```rust
        ("HidCommand", render::<HidCommand>()),
        ("SessionStep", render::<Step>()),
        ("SessionEvent", render::<SessionEvent>()),
```

Rode `UPDATE_BINDINGS=1 cargo test -p gearhub-core generated` e confira os três arquivos:

- `HidCommand.ts` é `{ reportId: number, data: Uint8Array, }`;
- `SessionStep.ts` une `{ "kind": "send" } & HidCommand` e `{ "kind": "wait", ms: number, }`;
- `SessionEvent.ts` tem os quatro `kind`: `queried`, `dpi`, `active-slot` e `onboard-slots`.

Se o `ts-rs` não gerar a união com `kind`, **pare e reporte**. Não troque por variantes escritas à mão.

Em `packages/shared/src/index.ts`:

- apague a `export interface HidCommand { … }` escrita à mão;
- acrescente:

```ts
export type { DpiAxes } from './generated/DpiAxes';
export type { HidCommand } from './generated/HidCommand';
export type { SessionEvent } from './generated/SessionEvent';
export type { SessionStep } from './generated/SessionStep';
```

- [ ] **Step 6: Rodar**

Run: `cargo test --workspace && cargo clippy --workspace --all-targets -- -D warnings && pnpm --filter @gearhub/shared exec tsc --noEmit && pnpm --filter @gearhub/web exec tsc --noEmit`
Expected: PASS. Os 9 casos de `sessionEvents` são conferidos pelo Rust, e o `HidCommand` gerado é aceito onde o escrito à mão era usado. Se o pacote não tiver `tsc` direto, use `pnpm lint`.

- [ ] **Step 7: Commit**

```bash
pnpm format
git add packages/core/src packages/core/tests/vectors.rs packages/shared/src
git commit -m "feat: sessao do Leviathan V4 no nucleo, leitura"
```

---

### Task 5: A sessão no núcleo — escrita

**Files:**

- Create: `packages/core/src/drivers/leviathan_v4/mappings.rs`
- Modify: `packages/core/src/drivers/leviathan_v4/session.rs`, `mod.rs`
- Modify: `packages/core/src/device/actions.rs`
- Modify: `packages/core/tests/vectors.rs`

**Interfaces:**

- Consumes: a sessão da Task 4; `apply_settings`, `key_id`, `SHOW_POWER_KEY_ID`, `encode_show_power`, `encode_mapping`, e `encode_config_reset`, `encode_action` e `encode_mouse_param_snapshot` da raiz do crate.
- Produces (`LeviathanV4Session`):
  - `begin_apply(&mut self, settings: &MouseSettings) -> Result<(), RawmError>`;
  - `begin_write_profile(&mut self, slot: u32, settings: &MouseSettings) -> Result<(), RawmError>`;
  - `next_step` passa a falhar com `ActiveSlotChanged`;
  - `abort` zera a assinatura numa escrita.
- Produces (`mappings.rs`, privado ao driver): `mapping_events`, `intended_signature`, `reported_signature`, `preserved_events` e `Signature`.

- [ ] **Step 1: Testes de vetor (falham)**

Em `packages/core/tests/vectors.rs`:

- acrescente `Step` ao `use gearhub_core::drivers::leviathan_v4::{…}`;
- acrescente os campos `session_apply: Vec<SessionApplyVector>,` e `session_write_profile: Vec<SessionWriteProfileVector>,` em `Vectors`;
- acrescente:

```rust
#[derive(Deserialize)]
struct SessionApplyCase {
    settings: MouseSettings,
    expected: Vec<serde_json::Value>,
}

#[derive(Deserialize)]
struct SessionApplyVector {
    name: String,
    query: String,
    patch: serde_json::Map<String, serde_json::Value>,
    dump: Option<Vec<String>>,
    applies: Vec<SessionApplyCase>,
}

#[derive(Deserialize)]
struct SessionWriteProfileVector {
    name: String,
    query: String,
    patch: serde_json::Map<String, serde_json::Value>,
    dump: Option<Vec<String>>,
    slot: u32,
    settings: MouseSettings,
    expected: Vec<serde_json::Value>,
}

fn notify_report(kind: u8, payload: &[u8]) -> [u8; 64] {
    let mut body = vec![0x0b, 0, kind];
    body.extend_from_slice(payload);
    delivered(&with_protocol_envelope(&body, false).expect("notificação"))[0]
}

fn feed_dump(session: &mut LeviathanV4Session, dump: Option<&Vec<String>>) {
    for payload in dump.into_iter().flatten() {
        session
            .feed_report(0, &notify_report(0x14, &from_hex(payload)))
            .expect("dump");
    }
}

/// Os passos até o fim, na forma dos vetores.
fn drain(session: &mut LeviathanV4Session, name: &str) -> Vec<serde_json::Value> {
    let mut steps = Vec::new();
    while let Some(step) = session
        .next_step()
        .unwrap_or_else(|error| panic!("{name}: {error:?}"))
    {
        steps.push(match step {
            Step::Send(command) => serde_json::json!({ "send": to_hex(&command.data) }),
            Step::Wait { ms } => serde_json::json!({ "wait": ms }),
        });
    }
    steps
}

#[test]
fn session_applies_match_the_shared_vectors() {
    let vectors = vectors();
    require_non_empty(&vectors.session_apply, "sessionApply");
    for vector in &vectors.session_apply {
        let mut session = connected(&patched(query(&vectors, &vector.query), &vector.patch));
        feed_dump(&mut session, vector.dump.as_ref());
        for (index, apply) in vector.applies.iter().enumerate() {
            session
                .begin_apply(&apply.settings)
                .unwrap_or_else(|error| panic!("{}: {error:?}", vector.name));
            let name = format!("{} #{index}", vector.name);
            assert_eq!(drain(&mut session, &name), apply.expected, "{name}");
        }
    }
}

#[test]
fn session_profile_writes_match_the_shared_vectors() {
    let vectors = vectors();
    require_non_empty(&vectors.session_write_profile, "sessionWriteProfile");
    for vector in &vectors.session_write_profile {
        let mut session = connected(&patched(query(&vectors, &vector.query), &vector.patch));
        feed_dump(&mut session, vector.dump.as_ref());
        session
            .begin_write_profile(vector.slot, &vector.settings)
            .unwrap_or_else(|error| panic!("{}: {error:?}", vector.name));
        assert_eq!(drain(&mut session, &vector.name), vector.expected, "{}", vector.name);
    }
}
```

Run: `cargo test -p gearhub-core --test vectors`
Expected: FAIL de compilação. `begin_apply` e `begin_write_profile` não existem.

- [ ] **Step 2: `MouseActionId` ordenável**

Em `packages/core/src/device/actions.rs`, acrescente `PartialOrd, Ord` ao `#[derive(…)]` de `MouseActionId`. A assinatura tipada ordena por ele.

- [ ] **Step 3: `mappings.rs`**

Crie `packages/core/src/drivers/leviathan_v4/mappings.rs`:

```rust
//! O conjunto de mapeamentos que o editor reconstrói, e o que o mouse diz guardar.
//!
//! `CONFIG_RESET` limpa todo mapeamento do mouse, então o que vai depois dele
//! é o conjunto inteiro: os botões do editor, a camada R-Plus e a sétima
//! tecla, que nenhum controle alcança. O que o mouse relatou e o app não sabe
//! nomear — macros, teclas de teclado — volta como chegou, fora das teclas que
//! o editor reconstrói.

use std::collections::BTreeSet;

use super::keys::{SHOW_POWER_KEY_ID, encode_show_power, key_id};
use crate::device::{MouseActionId, MouseSettings};
use crate::protocols::rawm::{OnboardSlotConfig, RawmError, encode_mapping};

/// Uma tecla, ou um par R-Plus com o ativador primeiro, e a ação do editor.
struct KeySet {
    key_ids: Vec<u8>,
    action: MouseActionId,
}

/// O que uma tecla guarda.
///
/// `Raw` só aparece hoje do lado relatado; é por ele que um botão do editor
/// com uma macro poderá ser escrito de volta, quando o editor souber mostrá-lo
/// (ver `### Escopo: migração com paridade` no desenho do passo 5).
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
enum Binding {
    Action(MouseActionId),
    Raw(Vec<u8>),
}

/// O que um conjunto de mapeamentos deixa no mouse, comparável.
///
/// Substitui a assinatura em texto do driver TypeScript (`teclas=valor`,
/// ordenada e unida por `|`). A igualdade é a mesma: aquela codificação era
/// injetiva — nenhum nome de ação começa com `raw:` — e o `join` guardava
/// repetições, como esta lista ordenada guarda.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct Signature(Vec<(Vec<u8>, Binding)>);

impl Signature {
    fn new(mut entries: Vec<(Vec<u8>, Binding)>) -> Self {
        entries.sort();
        Self(entries)
    }
}

fn is_show_power(key_ids: &[u8]) -> bool {
    key_ids == [SHOW_POWER_KEY_ID]
}

/// Toda tecla que o editor reconstrói, na ordem em que vai para o mouse.
fn editor_key_sets(settings: &MouseSettings) -> Result<Vec<KeySet>, RawmError> {
    let mut sets = Vec::new();
    for (button, &action) in &settings.buttons {
        let key = key_id(button).ok_or_else(|| RawmError::UnknownButton {
            button: button.clone(),
        })?;
        sets.push(KeySet {
            key_ids: vec![key],
            action,
        });
    }
    if let Some(r_plus) = &settings.r_plus {
        let activator =
            key_id(&r_plus.activator_button_id).ok_or(RawmError::InvalidRPlusActivator)?;
        for (button, &action) in &r_plus.buttons {
            if *button == r_plus.activator_button_id {
                continue;
            }
            let target = key_id(button).ok_or_else(|| RawmError::UnknownRPlusButton {
                button: button.clone(),
            })?;
            sets.push(KeySet {
                key_ids: vec![activator, target],
                action,
            });
        }
    }
    Ok(sets)
}

/// Os eventos de mapeamento. Depois de `CONFIG_RESET` tem de ser o conjunto
/// inteiro, não uma diferença: o que ficar de fora para de funcionar até
/// desligar o mouse — inclusive a sétima tecla.
pub(super) fn mapping_events(settings: &MouseSettings) -> Result<Vec<Vec<u8>>, RawmError> {
    let mut events: Vec<Vec<u8>> = editor_key_sets(settings)?
        .into_iter()
        .filter_map(|set| encode_mapping(&set.key_ids, set.action))
        .collect();
    events.push(encode_show_power());
    Ok(events)
}

/// O que as configurações deixariam no mouse. Uma tecla desativada não
/// escreve nada, então não fica.
pub(super) fn intended_signature(settings: &MouseSettings) -> Result<Signature, RawmError> {
    Ok(Signature::new(
        editor_key_sets(settings)?
            .into_iter()
            .filter(|set| encode_mapping(&set.key_ids, set.action).is_some())
            .map(|set| (set.key_ids, Binding::Action(set.action)))
            .collect(),
    ))
}

/// O que o mouse diz guardar numa memória, com nome onde o app tem um.
pub(super) fn reported_signature(slot: &OnboardSlotConfig) -> Signature {
    Signature::new(
        slot.bindings
            .iter()
            // A sétima tecla é reconstruída igual dos dois lados.
            .filter(|binding| !is_show_power(&binding.key_ids))
            .map(|binding| {
                let held = binding
                    .action
                    .map_or_else(|| Binding::Raw(binding.raw.clone()), Binding::Action);
                (binding.key_ids.clone(), held)
            })
            .collect(),
    )
}

/// As entradas sem nome que o mouse relatou, para reenviar intactas. As teclas
/// que o editor reconstrói ficam de fora: dois eventos para uma tecla brigariam.
pub(super) fn preserved_events(
    settings: &MouseSettings,
    slot: Option<&OnboardSlotConfig>,
) -> Result<Vec<Vec<u8>>, RawmError> {
    let Some(slot) = slot else {
        return Ok(Vec::new());
    };
    let mut rebuilt: BTreeSet<Vec<u8>> = editor_key_sets(settings)?
        .into_iter()
        .map(|set| set.key_ids)
        .collect();
    rebuilt.insert(vec![SHOW_POWER_KEY_ID]);
    Ok(slot
        .bindings
        .iter()
        .filter(|binding| binding.action.is_none() && !rebuilt.contains(&binding.key_ids))
        .map(|binding| binding.raw.clone())
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::device::MouseRPlusSettings;
    use crate::drivers::leviathan_v4::describe;
    use crate::protocols::rawm::{OnboardBinding, decode_onboard_entry, with_protocol_envelope};

    fn defaults() -> MouseSettings {
        let vectors: serde_json::Value =
            serde_json::from_str(include_str!("../../../vectors/rawm-protocol.json")).unwrap();
        describe(&vectors["queries"]["leviathan-v4-captura"])
            .unwrap()
            .defaults
    }

    fn binding(key_ids: &[u8], action: Option<MouseActionId>, raw: &[u8]) -> OnboardBinding {
        OnboardBinding {
            key_ids: key_ids.to_vec(),
            action,
            raw: raw.to_vec(),
        }
    }

    /// Uma memória como o mouse a relataria depois de receber `settings`.
    fn held(settings: &MouseSettings) -> OnboardSlotConfig {
        OnboardSlotConfig {
            index: 0,
            bindings: mapping_events(settings)
                .unwrap()
                .iter()
                .filter_map(|event| {
                    decode_onboard_entry(&with_protocol_envelope(event, false).unwrap())
                })
                .collect(),
        }
    }

    #[test]
    fn the_set_ends_with_the_seventh_key() {
        let events = mapping_events(&defaults()).unwrap();
        assert_eq!(events.last(), Some(&encode_show_power()));
    }

    #[test]
    fn a_disabled_key_writes_nothing_and_is_not_held() {
        let mut settings = defaults();
        let count = mapping_events(&settings).unwrap().len();
        settings
            .buttons
            .insert("central".into(), MouseActionId::Desativado);
        assert_eq!(mapping_events(&settings).unwrap().len(), count - 1);
        assert!(
            !intended_signature(&settings)
                .unwrap()
                .0
                .iter()
                .any(|(keys, _)| keys == &[0x0c])
        );
    }

    #[test]
    fn unknown_buttons_name_themselves() {
        let mut settings = defaults();
        settings
            .buttons
            .insert("inexistente".into(), MouseActionId::Voltar);
        assert_eq!(
            mapping_events(&settings).err(),
            Some(RawmError::UnknownButton {
                button: "inexistente".into()
            })
        );
    }

    #[test]
    fn the_r_plus_layer_pairs_the_activator_first_and_skips_it() {
        let mut settings = defaults();
        settings.r_plus = Some(MouseRPlusSettings {
            activator_button_id: "lateral-dianteiro".into(),
            buttons: [
                ("lateral-dianteiro".to_string(), MouseActionId::Voltar),
                ("central".to_string(), MouseActionId::DpiAumentar),
            ]
            .into_iter()
            .collect(),
        });
        let sets = editor_key_sets(&settings).unwrap();
        let layer: Vec<&KeySet> = sets.iter().filter(|set| set.key_ids.len() == 2).collect();
        assert_eq!(layer.len(), 1);
        assert_eq!(layer[0].key_ids, vec![0x0f, 0x0c]);
        assert_eq!(layer[0].action, MouseActionId::DpiAumentar);
    }

    #[test]
    fn a_bad_r_plus_activator_or_button_is_refused() {
        let mut settings = defaults();
        settings.r_plus = Some(MouseRPlusSettings {
            activator_button_id: "inexistente".into(),
            buttons: Default::default(),
        });
        assert_eq!(
            mapping_events(&settings).err(),
            Some(RawmError::InvalidRPlusActivator)
        );
        settings.r_plus = Some(MouseRPlusSettings {
            activator_button_id: "dpi".into(),
            buttons: [("inexistente".to_string(), MouseActionId::Voltar)]
                .into_iter()
                .collect(),
        });
        assert_eq!(
            mapping_events(&settings).err(),
            Some(RawmError::UnknownRPlusButton {
                button: "inexistente".into()
            })
        );
    }

    #[test]
    fn what_the_mouse_reports_matches_what_the_settings_would_leave() {
        let settings = defaults();
        assert_eq!(
            reported_signature(&held(&settings)),
            intended_signature(&settings).unwrap()
        );
    }

    /// O defeito do passo 4, portado como está: os bytes sem nome num botão do
    /// editor nunca batem com o que o editor pretende.
    #[test]
    fn a_macro_on_an_editor_button_never_matches() {
        let settings = defaults();
        let mut slot = held(&settings);
        slot.bindings.retain(|binding| binding.key_ids != [0x0a]);
        slot.bindings
            .push(binding(&[0x0a], None, &[3, 8, 0x05, 1, 0x0a, 1, 2, 3]));
        assert_ne!(
            reported_signature(&slot),
            intended_signature(&settings).unwrap()
        );
    }

    #[test]
    fn preserved_entries_are_the_unnamed_ones_outside_the_editor() {
        let settings = defaults();
        let slot = OnboardSlotConfig {
            index: 1,
            bindings: vec![
                // Fora do editor e sem nome: volta.
                binding(&[0x60], None, &[3, 8, 0x05, 1, 0x60, 1, 2, 3]),
                // Botão do editor: o editor reconstrói.
                binding(&[0x0a], None, &[3, 8, 0x05, 1, 0x0a, 1, 2, 3]),
                // A sétima tecla: reconstruída.
                binding(&[SHOW_POWER_KEY_ID], None, &[9]),
                // Tem nome: não é preservada.
                binding(&[0x61], Some(MouseActionId::Voltar), &[7]),
            ],
        };
        assert_eq!(
            preserved_events(&settings, Some(&slot)).unwrap(),
            vec![vec![3, 8, 0x05, 1, 0x60, 1, 2, 3]]
        );
        assert_eq!(preserved_events(&settings, None).unwrap(), Vec::<Vec<u8>>::new());
    }
}
```

Em `mod.rs`: `mod mappings;`.

Run: `cargo test -p gearhub-core mappings`
Expected: os testes de `mappings` passam. O build sem `cfg(test)` avisa código sem uso, porque nada fora dos testes usa `mappings` ainda. O Step 4 resolve isso, e o `clippy` só roda no Step 6.

- [ ] **Step 4: `session.rs`, a escrita**

Troque **tudo acima de `#[cfg(test)]`** em `session.rs` por:

```rust
//! A sessão do Leviathan V4: o que o mouse tem agora, e o que enviar a seguir.
//!
//! O núcleo não faz I/O e é síncrono: não envia nem espera nada. Ele decide o
//! próximo passo no instante em que a casca o pede (`next_step`), e a casca o
//! executa; o que chega do mouse entra por `feed_report`. Pedir um passo por
//! vez é o que deixa o núcleo ver, entre dois passos, uma troca de memória ou
//! um DPI que o mouse anunciou — ver `## A forma do passo 5` em
//! `docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md`.

use std::collections::VecDeque;

use serde::Serialize;
use serde_json::Value;

use super::apply::apply_settings;
use super::description::{DpiAxes, onboard_slot_count};
use super::identity::is_device_name;
use super::mappings::{
    Signature, intended_signature, mapping_events, preserved_events, reported_signature,
};
use crate::command::HidCommand;
use crate::device::MouseSettings;
use crate::protocols::rawm::json::integer;
use crate::protocols::rawm::{
    MouseParamSnapshot, OnboardConfigCollector, OnboardSlotConfig, RawEventAssembler, RawmError,
    RawmIdentity, RawmNotification, build_query_event, decode_report_chunk, dpi_axes,
    encode_mouse_param_body, frame_event, is_query_result, parse_mouse_param_snapshot,
    parse_notification, parse_query_answer, with_protocol_envelope,
};
use crate::{encode_action, encode_config_reset, encode_mouse_param_snapshot};

/// Quanto a casca espera a resposta de uma consulta, contando a abertura do dispositivo.
pub const QUERY_TIMEOUT_MS: u32 = 1000;

/// A pausa depois de cada evento escrito, a do driver confirmado em hardware.
const EVENT_PAUSE_MS: u32 = 8;

/// Abre (`1 | memória << 8`) e fecha (`0`) a gravação de uma memória na flash.
const ACTION_SAVE_CONFIG_TO_FDS: u8 = 0x34;

/// O canal em que o receptor entrega o mouse; os outros ids são tráfego dele.
const VENDOR_REPORT_ID: u8 = 0;

type Report = [u8; 64];

/// O que a casca faz a seguir.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(rename = "SessionStep"))]
pub enum Step {
    /// Enviar este relatório.
    Send(HidCommand),
    /// Esperar antes de pedir o próximo passo.
    Wait { ms: u32 },
}

/// O que um relatório que chegou significa.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub enum SessionEvent {
    /// A resposta à consulta pendente.
    Queried(RawmIdentity),
    /// O mouse anunciou um DPI, com os dois eixos diferentes de zero.
    Dpi(DpiAxes),
    /// O mouse anunciou a memória ativa — mesmo a que já era.
    ActiveSlot { index: u8 },
    /// O dump das memórias terminou de chegar.
    OnboardSlots { slots: Vec<OnboardSlotConfig> },
}

/// O que a primeira resposta revelou do aparelho.
#[derive(Debug)]
struct Device {
    crc_supported: bool,
    slot_count: u32,
    snapshot: MouseParamSnapshot,
    active_slot: u8,
}

#[derive(Debug)]
struct Query {
    reports: VecDeque<Report>,
}

/// Os blocos de uma escrita, na ordem do driver confirmado em hardware. Cada
/// um é decidido quando começa, não quando a escrita começa.
#[derive(Debug)]
enum Block {
    Reset,
    SaveOpen(u32),
    /// Do início do corpo até o fim, o mouse não guarda nem o conjunto velho nem o novo.
    ClearSignature,
    Parameters,
    Mappings,
    Preserved,
    CommitSignature,
    SaveClose,
}

/// Um evento a enviar. O de parâmetros leva o snapshot que escreve.
#[derive(Debug)]
struct Outgoing {
    event: Vec<u8>,
    writes: Option<MouseParamSnapshot>,
}

impl Outgoing {
    fn plain(event: Vec<u8>) -> Self {
        Self {
            event,
            writes: None,
        }
    }
}

#[derive(Debug)]
struct Write {
    settings: MouseSettings,
    intended: Signature,
    /// A memória cujas entradas sem nome são reenviadas.
    target_slot: u8,
    /// A revisão de memória do início. Só a aplicação à sessão a confere.
    guard: Option<u64>,
    blocks: VecDeque<Block>,
    events: VecDeque<Outgoing>,
    reports: VecDeque<Report>,
    pause_owed: bool,
    /// O snapshot que o evento no ar escreve, e a revisão de DPI de quando foi calculado.
    in_flight: Option<(MouseParamSnapshot, u64)>,
}

impl Write {
    fn new(
        settings: &MouseSettings,
        intended: Signature,
        target_slot: u8,
        guard: Option<u64>,
        blocks: Vec<Block>,
    ) -> Self {
        Self {
            settings: settings.clone(),
            intended,
            target_slot,
            guard,
            blocks: blocks.into(),
            events: VecDeque::new(),
            reports: VecDeque::new(),
            pause_owed: false,
            in_flight: None,
        }
    }
}

#[derive(Debug)]
enum Operation {
    /// Enviando a consulta, ou esperando a resposta.
    Query(Query),
    Write(Box<Write>),
}

#[derive(Debug, Default)]
pub struct LeviathanV4Session {
    /// O único leitor do fluxo: consulta, notificações e dump passam por ele.
    assembler: RawEventAssembler,
    collector: OnboardConfigCollector,
    /// `None` até a primeira resposta.
    device: Option<Device>,
    /// `None` até o dump terminar de chegar.
    slots: Option<Vec<OnboardSlotConfig>>,
    /// O que o mouse guarda na memória ativa. `None` quando não se sabe — e
    /// então a próxima aplicação reescreve tudo.
    applied: Option<Signature>,
    /// Sobe a cada DPI anunciado; resolve a corrida com o bloco de parâmetros.
    dpi_revision: u64,
    /// Sobe quando o mouse anuncia outra memória; é o que a guarda confere.
    slot_revision: u64,
    operation: Option<Operation>,
}

impl LeviathanV4Session {
    pub fn new() -> Self {
        Self::default()
    }

    /// A memória que o mouse está usando, contando de 0; `None` antes da primeira resposta.
    pub fn active_slot(&self) -> Option<u8> {
        self.device.as_ref().map(|device| device.active_slot)
    }

    /// O DPI que o mouse está usando; `None` antes da primeira resposta.
    pub fn dpi(&self) -> Option<DpiAxes> {
        self.device
            .as_ref()
            .map(|device| axes(device.snapshot.resolution))
    }

    /// As memórias do último dump; `None` até ele terminar de chegar.
    pub fn slots(&self) -> Option<&[OnboardSlotConfig]> {
        self.slots.as_deref()
    }

    /// Começa uma consulta. A primeira resposta liga a sessão; as seguintes a
    /// atualizam. A casca espera o `Queried` contra `QUERY_TIMEOUT_MS`.
    pub fn begin_query(&mut self, epoch_seconds: u64) -> Result<(), RawmError> {
        self.ensure_idle()?;
        let event = build_query_event(epoch_seconds)?;
        self.operation = Some(Operation::Query(Query {
            reports: frame_event(&event, true).into(),
        }));
        Ok(())
    }

    /// Começa a aplicar `settings` à sessão, sem tocar a flash: desligar o
    /// mouse devolve o que está gravado. Os mapeamentos só sobrevivem dentro
    /// do bloco que o `CONFIG_RESET` abre, então vão inteiros sempre que
    /// mudam; quando só um parâmetro mudou, o bloco de parâmetros vai sozinho.
    pub fn begin_apply(&mut self, settings: &MouseSettings) -> Result<(), RawmError> {
        self.ensure_idle()?;
        let device = self.device()?;
        let target_slot = device.active_slot;
        let intended = match validate(device, settings) {
            Ok(intended) => intended,
            Err(error) => {
                // O driver zerava a assinatura em qualquer falha da aplicação.
                self.applied = None;
                return Err(error);
            }
        };
        let blocks = if self.applied.as_ref() == Some(&intended) {
            vec![Block::Parameters]
        } else {
            vec![
                Block::Reset,
                Block::ClearSignature,
                Block::Parameters,
                Block::Mappings,
                Block::Preserved,
                Block::CommitSignature,
            ]
        };
        let write = Write::new(settings, intended, target_slot, Some(self.slot_revision), blocks);
        self.operation = Some(Operation::Write(Box::new(write)));
        Ok(())
    }

    /// Começa a gravar `settings` na memória `slot`, contando de 0. Grava na
    /// flash: os `SAVE` em volta do corpo são o que confirma a gravação. O
    /// conjunto vai inteiro sempre — o reset dentro do colchete gravaria a
    /// memória sem mapeamentos.
    pub fn begin_write_profile(
        &mut self,
        slot: u32,
        settings: &MouseSettings,
    ) -> Result<(), RawmError> {
        self.ensure_idle()?;
        let device = self.device()?;
        if slot >= device.slot_count {
            return Err(RawmError::InvalidProfileSlot);
        }
        let intended = validate(device, settings)?;
        let blocks = vec![
            Block::Reset,
            Block::SaveOpen(slot),
            Block::ClearSignature,
            Block::Parameters,
            Block::Mappings,
            Block::Preserved,
            Block::CommitSignature,
            Block::SaveClose,
        ];
        // Sem guarda: a gravação escolhe a memória, em vez de escrever na ativa.
        let write = Write::new(settings, intended, slot as u8, None, blocks);
        self.operation = Some(Operation::Write(Box::new(write)));
        Ok(())
    }

    /// O próximo passo da operação em andamento; `None` quando não há o que
    /// fazer. Numa aplicação à sessão, falha com `ActiveSlotChanged` se o
    /// mouse trocou de memória desde o início — e a operação acaba.
    pub fn next_step(&mut self) -> Result<Option<Step>, RawmError> {
        match self.operation.take() {
            None => Ok(None),
            Some(Operation::Query(mut query)) => {
                let step = query.reports.pop_front().map(send);
                // Continua pendente depois do último envio, até a resposta chegar.
                self.operation = Some(Operation::Query(query));
                Ok(step)
            }
            Some(Operation::Write(mut write)) => match self.advance(&mut write) {
                Ok(Some(step)) => {
                    self.operation = Some(Operation::Write(write));
                    Ok(Some(step))
                }
                Ok(None) => Ok(None),
                Err(error) => {
                    // Uma escrita interrompida deixa o mouse sem o conjunto velho e sem o novo.
                    self.applied = None;
                    Err(error)
                }
            },
        }
    }

    /// Encerra a operação em andamento. Sem operação, nada; uma consulta
    /// encerrada não mexe na assinatura; uma escrita encerrada a zera.
    pub fn abort(&mut self) {
        if matches!(self.operation.take(), Some(Operation::Write(_))) {
            self.applied = None;
        }
    }

    /// Bytes que chegaram, e o que eles significam.
    ///
    /// Só falha com uma consulta pendente — e então a encerra. Sem consulta
    /// pendente, um relatório que não decodifica reinicia o montador e é
    /// pulado: o mesmo canal leva quadros do próprio receptor.
    pub fn feed_report(
        &mut self,
        report_id: u8,
        report: &[u8],
    ) -> Result<Vec<SessionEvent>, RawmError> {
        if report_id != VENDOR_REPORT_ID {
            return Ok(Vec::new());
        }
        let events = match self.assemble(report) {
            Ok(events) => events,
            Err(error) => {
                self.assembler.reset();
                if self.query_pending() {
                    self.operation = None;
                    return Err(error);
                }
                return Ok(Vec::new());
            }
        };
        let mut read = Vec::new();
        for event in events {
            if is_query_result(&event) {
                // Uma resposta que ninguém pediu é ignorada, como antes.
                if self.query_pending() {
                    self.operation = None;
                    read.push(self.answer(&event)?);
                }
                continue;
            }
            if let Some(notification) = parse_notification(&event) {
                read.extend(self.notify(notification));
            }
        }
        Ok(read)
    }

    fn device(&self) -> Result<&Device, RawmError> {
        self.device.as_ref().ok_or(RawmError::NotQueried)
    }

    fn ensure_idle(&self) -> Result<(), RawmError> {
        match self.operation {
            Some(_) => Err(RawmError::OperationInProgress),
            None => Ok(()),
        }
    }

    fn query_pending(&self) -> bool {
        matches!(self.operation, Some(Operation::Query(_)))
    }

    fn assemble(&mut self, report: &[u8]) -> Result<Vec<Vec<u8>>, RawmError> {
        match decode_report_chunk(report, true)? {
            Some(chunk) if !chunk.is_empty() => self.assembler.push(&chunk),
            _ => Ok(Vec::new()),
        }
    }

    /// A primeira resposta confere o nome e o snapshot e liga a sessão; as
    /// seguintes exigem `oci` e atualizam memória e snapshot.
    fn answer(&mut self, event: &[u8]) -> Result<SessionEvent, RawmError> {
        let identity = parse_query_answer(event)?;
        let raw = &identity.raw;
        match self.device.as_mut() {
            None => {
                if !is_device_name(&identity.device_name) {
                    return Err(RawmError::UnrecognizedMouse {
                        name: identity.device_name.clone(),
                    });
                }
                let snapshot = parse_mouse_param_snapshot(raw)?;
                let slot_count = onboard_slot_count(raw);
                // Na conexão, um `oci` ausente vale a memória 0, como o construtor do driver fazia.
                let oci = raw
                    .get("oci")
                    .filter(|value| !value.is_null())
                    .cloned()
                    .unwrap_or_else(|| Value::from(0));
                let active_slot = onboard_index(&oci, slot_count)?;
                self.device = Some(Device {
                    crc_supported: identity.crc_supported,
                    slot_count,
                    snapshot,
                    active_slot,
                });
            }
            Some(device) => {
                let active_slot =
                    onboard_index(raw.get("oci").unwrap_or(&Value::Null), device.slot_count)?;
                device.snapshot = parse_mouse_param_snapshot(raw)?;
                device.active_slot = active_slot;
            }
        }
        self.applied = self.active_signature();
        Ok(SessionEvent::Queried(identity))
    }

    fn notify(&mut self, notification: RawmNotification) -> Option<SessionEvent> {
        match notification {
            RawmNotification::Dpi(value) => self.dpi_announced(u32::from(value)),
            RawmNotification::DpiXy(value) => self.dpi_announced(value),
            // O app não acompanha a taxa anunciada.
            RawmNotification::Polling(_) => None,
            RawmNotification::OnboardIndex(index) => {
                let device = self.device.as_mut()?;
                if u32::from(index) >= device.slot_count {
                    return None;
                }
                // Só uma memória diferente conta como troca; o evento sai de qualquer jeito.
                if index != device.active_slot {
                    self.slot_revision += 1;
                }
                device.active_slot = index;
                self.applied = self.active_signature();
                Some(SessionEvent::ActiveSlot { index })
            }
            RawmNotification::OnboardConfig(payload) => {
                let slots = self.collector.push(&payload)?;
                self.slots = Some(slots.clone());
                self.applied = self.active_signature();
                Some(SessionEvent::OnboardSlots { slots })
            }
        }
    }

    /// O snapshot acompanha todo DPI anunciado; o evento só sai com os dois eixos.
    fn dpi_announced(&mut self, value: u32) -> Option<SessionEvent> {
        let device = self.device.as_mut()?;
        device.snapshot.resolution = value;
        self.dpi_revision += 1;
        let announced = axes(value);
        (announced.x != 0 && announced.y != 0).then_some(SessionEvent::Dpi(announced))
    }

    fn active_signature(&self) -> Option<Signature> {
        let active = self.device.as_ref()?.active_slot;
        self.slots
            .as_ref()?
            .iter()
            .find(|slot| slot.index == active)
            .map(reported_signature)
    }

    fn advance(&mut self, write: &mut Write) -> Result<Option<Step>, RawmError> {
        loop {
            // Antes de qualquer decisão: antes de cada relatório, depois de
            // cada pausa e antes do fim — o `checkSlot()` do driver.
            if write
                .guard
                .is_some_and(|revision| revision != self.slot_revision)
            {
                return Err(RawmError::ActiveSlotChanged);
            }
            if let Some(report) = write.reports.pop_front() {
                return Ok(Some(send(report)));
            }
            if write.pause_owed {
                write.pause_owed = false;
                return Ok(Some(Step::Wait { ms: EVENT_PAUSE_MS }));
            }
            // O evento no ar terminou, pausa incluída.
            if let Some((next, revision)) = write.in_flight.take() {
                self.commit_snapshot(next, revision);
            }
            if let Some(outgoing) = write.events.pop_front() {
                let event = with_protocol_envelope(&outgoing.event, self.device()?.crc_supported)?;
                write.reports = frame_event(&event, true).into();
                write.pause_owed = true;
                write.in_flight = outgoing
                    .writes
                    .map(|snapshot| (snapshot, self.dpi_revision));
                continue;
            }
            match write.blocks.pop_front() {
                Some(block) => self.open(block, write)?,
                None => return Ok(None),
            }
        }
    }

    fn open(&mut self, block: Block, write: &mut Write) -> Result<(), RawmError> {
        match block {
            Block::Reset => write
                .events
                .push_back(Outgoing::plain(encode_config_reset())),
            Block::SaveOpen(slot) => write.events.push_back(Outgoing::plain(encode_action(
                ACTION_SAVE_CONFIG_TO_FDS,
                1 | (slot << 8),
            ))),
            Block::SaveClose => write.events.push_back(Outgoing::plain(encode_action(
                ACTION_SAVE_CONFIG_TO_FDS,
                0,
            ))),
            Block::ClearSignature => self.applied = None,
            Block::Parameters => {
                let next = apply_settings(&self.device()?.snapshot, &write.settings)?;
                let event = encode_mouse_param_snapshot(&encode_mouse_param_body(&next));
                write.events.push_back(Outgoing {
                    event,
                    writes: Some(next),
                });
            }
            Block::Mappings => write.events.extend(
                mapping_events(&write.settings)?
                    .into_iter()
                    .map(Outgoing::plain),
            ),
            Block::Preserved => {
                let slot = self
                    .slots
                    .as_ref()
                    .and_then(|slots| slots.iter().find(|slot| slot.index == write.target_slot));
                write.events.extend(
                    preserved_events(&write.settings, slot)?
                        .into_iter()
                        .map(Outgoing::plain),
                );
            }
            Block::CommitSignature => self.applied = Some(write.intended.clone()),
        }
        Ok(())
    }

    fn commit_snapshot(&mut self, next: MouseParamSnapshot, revision: u64) {
        let unchanged = revision == self.dpi_revision;
        if let Some(device) = self.device.as_mut() {
            device.snapshot = if unchanged {
                next
            } else {
                // Um DPI anunciado durante o envio é mais novo que o enviado.
                MouseParamSnapshot {
                    resolution: device.snapshot.resolution,
                    ..next
                }
            };
        }
    }
}

/// Confere as configurações antes de qualquer byte: o que falharia no meio
/// da escrita falha aqui, sem deixar o mouse com o conjunto pela metade.
fn validate(device: &Device, settings: &MouseSettings) -> Result<Signature, RawmError> {
    let intended = intended_signature(settings)?;
    apply_settings(&device.snapshot, settings)?;
    Ok(intended)
}

fn send(report: Report) -> Step {
    Step::Send(HidCommand {
        report_id: VENDOR_REPORT_ID,
        data: report.to_vec(),
    })
}

/// A memória ativa que a resposta declara: inteira, de 0 ao número de memórias.
fn onboard_index(value: &Value, slot_count: u32) -> Result<u8, RawmError> {
    integer(value)
        .filter(|index| (0..i64::from(slot_count)).contains(index))
        .map(|index| index as u8)
        .ok_or(RawmError::InvalidOnboardIndex)
}

fn axes(value: u32) -> DpiAxes {
    let (x, y) = dpi_axes(value);
    DpiAxes {
        x: u32::from(x),
        y: u32::from(y),
    }
}
```

No módulo `tests`:

- troque a linha `use crate::protocols::rawm::with_protocol_envelope;` por `use crate::device::MouseActionId;` (`with_protocol_envelope` passa a vir por `use super::*`);
- acrescente `use crate::drivers::leviathan_v4::describe;`.

- [ ] **Step 5: Testes de unidade da escrita**

No módulo `tests` de `session.rs`, acrescente:

```rust
    fn defaults() -> MouseSettings {
        describe(&capture()).unwrap().defaults
    }

    fn polling_500() -> MouseSettings {
        MouseSettings {
            polling_rate: 500,
            ..defaults()
        }
    }

    fn waits(steps: &[Step]) -> usize {
        steps
            .iter()
            .filter(|step| matches!(step, Step::Wait { .. }))
            .count()
    }

    /// Um dump em que cada memória de `slots` guarda o que `settings` escreveria.
    fn held_dump(session: &mut LeviathanV4Session, slots: &[u8], settings: &MouseSettings) {
        let mut reports = Vec::new();
        for &slot in slots {
            reports.push(notify(0x14, &[slot]));
            for event in mapping_events(settings).unwrap() {
                reports.push(notify(0x14, &with_protocol_envelope(&event, false).unwrap()));
            }
        }
        reports.push(notify(0x14, &[0xff]));
        feed(session, &reports).unwrap();
    }

    #[test]
    fn writing_before_the_first_answer_is_refused() {
        let mut session = LeviathanV4Session::new();
        assert_eq!(session.begin_apply(&defaults()), Err(RawmError::NotQueried));
        assert_eq!(
            session.begin_write_profile(0, &defaults()),
            Err(RawmError::NotQueried)
        );
    }

    #[test]
    fn one_operation_at_a_time() {
        let mut session = connected();
        session.begin_apply(&defaults()).unwrap();
        assert_eq!(session.begin_apply(&defaults()), Err(RawmError::OperationInProgress));
        assert_eq!(session.begin_query(0), Err(RawmError::OperationInProgress));
    }

    #[test]
    fn every_event_ends_with_a_pause() {
        let mut session = connected();
        session.begin_apply(&defaults()).unwrap();
        let steps = drain(&mut session).unwrap();
        assert_eq!(steps.last(), Some(&Step::Wait { ms: 8 }));
        // Reset, parâmetros, os mapeamentos e a sétima tecla.
        assert!(waits(&steps) > 8);
    }

    #[test]
    fn a_held_mapping_set_lets_the_parameters_go_alone() {
        let mut session = connected();
        held_dump(&mut session, &[0], &defaults());
        session.begin_apply(&polling_500()).unwrap();
        assert_eq!(waits(&drain(&mut session).unwrap()), 1);
    }

    #[test]
    fn invalid_settings_fail_before_any_byte_and_force_a_full_rewrite() {
        let mut session = connected();
        held_dump(&mut session, &[0], &defaults());
        let mut broken = defaults();
        broken
            .buttons
            .insert("inexistente".into(), MouseActionId::CliqueEsquerdo);
        assert_eq!(
            session.begin_apply(&broken),
            Err(RawmError::UnknownButton {
                button: "inexistente".into()
            })
        );
        assert_eq!(session.next_step(), Ok(None));
        session.begin_apply(&polling_500()).unwrap();
        assert!(waits(&drain(&mut session).unwrap()) > 1);
    }

    #[test]
    fn a_memory_change_mid_apply_stops_it_and_forces_a_full_rewrite() {
        let mut session = connected();
        // As duas memórias guardam o mesmo: só a falha explica uma reescrita completa.
        held_dump(&mut session, &[0, 1], &defaults());
        session.begin_apply(&polling_500()).unwrap();
        assert!(matches!(session.next_step(), Ok(Some(Step::Send(_)))));
        feed(&mut session, &[notify(0x22, &[1])]).unwrap();
        assert_eq!(session.next_step(), Err(RawmError::ActiveSlotChanged));
        assert_eq!(session.next_step(), Ok(None));
        session.begin_apply(&polling_500()).unwrap();
        assert!(waits(&drain(&mut session).unwrap()) > 1);
    }

    #[test]
    fn the_guard_also_fires_during_the_last_pause() {
        let mut session = connected();
        held_dump(&mut session, &[0, 1], &defaults());
        session.begin_apply(&polling_500()).unwrap();
        let mut step = session.next_step().unwrap();
        while matches!(step, Some(Step::Send(_))) {
            step = session.next_step().unwrap();
        }
        assert_eq!(step, Some(Step::Wait { ms: 8 }));
        feed(&mut session, &[notify(0x22, &[1])]).unwrap();
        assert_eq!(session.next_step(), Err(RawmError::ActiveSlotChanged));
    }

    #[test]
    fn the_same_memory_announced_again_does_not_stop_an_apply() {
        let mut session = connected();
        session.begin_apply(&defaults()).unwrap();
        session.next_step().unwrap();
        feed(&mut session, &[notify(0x22, &[0])]).unwrap();
        assert!(drain(&mut session).is_ok());
    }

    #[test]
    fn a_profile_write_is_not_guarded() {
        let mut session = connected();
        session.begin_write_profile(2, &defaults()).unwrap();
        session.next_step().unwrap();
        feed(&mut session, &[notify(0x22, &[1])]).unwrap();
        assert!(drain(&mut session).is_ok());
    }

    #[test]
    fn a_profile_write_beyond_the_memories_is_refused() {
        let mut session = connected();
        assert_eq!(
            session.begin_write_profile(4, &defaults()),
            Err(RawmError::InvalidProfileSlot)
        );
        assert_eq!(session.next_step(), Ok(None));
    }

    #[test]
    fn the_written_dpi_becomes_the_session_dpi() {
        let mut session = connected();
        let mut settings = defaults();
        let last = settings.dpi_stages.last().unwrap().id.clone();
        settings.active_stage_id = last;
        let written = apply_settings(
            &parse_mouse_param_snapshot(&capture()).unwrap(),
            &settings,
        )
        .unwrap()
        .resolution;
        session.begin_apply(&settings).unwrap();
        drain(&mut session).unwrap();
        assert_eq!(session.dpi(), Some(axes(written)));
    }

    #[test]
    fn a_dpi_announced_while_the_parameters_go_out_wins() {
        let mut session = connected();
        held_dump(&mut session, &[0], &defaults());
        session.begin_apply(&polling_500()).unwrap();
        assert!(matches!(session.next_step(), Ok(Some(Step::Send(_)))));
        // 1234 DPI: nenhum estágio tem esse valor.
        feed(&mut session, &[notify(0x00, &[0xd2, 0x04])]).unwrap();
        drain(&mut session).unwrap();
        assert_eq!(session.dpi(), Some(DpiAxes { x: 1234, y: 1234 }));
    }

    #[test]
    fn abort_ends_a_write_and_forces_a_full_rewrite() {
        let mut session = connected();
        held_dump(&mut session, &[0], &defaults());
        session.begin_apply(&polling_500()).unwrap();
        session.next_step().unwrap();
        session.abort();
        assert_eq!(session.next_step(), Ok(None));
        session.begin_apply(&polling_500()).unwrap();
        assert!(waits(&drain(&mut session).unwrap()) > 1);
    }

    #[test]
    fn abort_while_idle_or_querying_keeps_what_the_mouse_holds() {
        let mut session = connected();
        held_dump(&mut session, &[0], &defaults());
        session.abort();
        session.begin_query(0).unwrap();
        session.abort();
        session.begin_apply(&polling_500()).unwrap();
        assert_eq!(waits(&drain(&mut session).unwrap()), 1);
    }
```

- [ ] **Step 6: Rodar**

Run: `cargo test --workspace && cargo clippy --workspace --all-targets -- -D warnings`
Expected: PASS. Os 7 vetores de aplicação e os 2 de gravação são conferidos byte a byte, com as esperas. Se um vetor reprovar, **não ajuste o vetor**. Ele veio do driver confirmado em hardware: a divergência está no núcleo.

- [ ] **Step 7: Commit**

```bash
pnpm format
git add packages/core/src packages/core/tests/vectors.rs
git commit -m "feat: sessao do Leviathan V4 no nucleo, escrita"
```

---

### Task 6: A ponte e o `coreBridge`

**Files:**

- Modify: `packages/core-wasm/src/lib.rs`
- Modify: `apps/web/src/core/coreBridge.ts`, `apps/web/src/core/coreBridge.test.ts`
- Modify: `apps/web/src/test/sessionVectors.ts`
- Modify: `apps/web/src/hardware/rawm/vectors.test.ts`

**Interfaces:**

- Produces (`coreBridge.ts`):
  - `class LeviathanV4Session` com `feedReport(reportId: number, report: Uint8Array): SessionEvent[]`, `beginQuery(epochSeconds?: number): void`, `beginApply(settings: MouseSettings): void`, `beginWriteProfile(slot: number, settings: MouseSettings): void`, `nextStep(): SessionStep | null`, `abort(): void`, `activeSlot(): number | null`, `dpi(): DpiAxes | null` e `slots(): OnboardSlotConfig[] | null`;
  - `leviathanQueryTimeoutMs(): number`;
  - `parseRawmIdentity(raw: Record<string, unknown>): RawmIdentity`.
- Produces (`sessionVectors.ts`): `connectedSession(raw)`, `drainSteps(session): StepJson[]` e `shapeEvent(event)`.

- [ ] **Step 1: Testes que falham**

Em `apps/web/src/core/coreBridge.test.ts`:

- importe `LeviathanV4Session, leviathanQueryTimeoutMs, parseRawmIdentity` do `'./coreBridge'`;
- importe `answerReports, notifyReport` de `'../test/sessionVectors'`, `fromHex` de `'../test/vectors'` e o tipo `SessionStep` de `'@gearhub/shared'`;
- confira que `describeLeviathanV4` e `leviathanV4QueryFixture` já estão importados;
- acrescente:

```ts
describe('sessão do Leviathan V4 através da ponte', () => {
  function connect(session: LeviathanV4Session) {
    session.beginQuery(0);
    const steps: SessionStep[] = [];
    for (let step = session.nextStep(); step; step = session.nextStep()) steps.push(step);
    const events = answerReports(leviathanV4QueryFixture).flatMap((report) =>
      session.feedReport(0, report),
    );
    return { steps, events };
  }

  it('entrega passos e eventos como objetos comuns, com os bytes em Uint8Array', () => {
    const session = new LeviathanV4Session();
    expect(session.activeSlot()).toBeNull();
    expect(session.dpi()).toBeNull();
    expect(session.slots()).toBeNull();

    const { steps, events } = connect(session);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ kind: 'send', reportId: 0 });
    expect(steps[0].kind === 'send' && steps[0].data).toBeInstanceOf(Uint8Array);
    expect(session.nextStep()).toBeNull();

    const queried = events.at(-1);
    expect(queried).toMatchObject({
      kind: 'queried',
      deviceName: 'LEVIATHAN V4',
      crcSupported: true,
    });
    expect(queried?.kind === 'queried' && queried.raw.dn).toBe('LEVIATHAN V4');
    expect(session.activeSlot()).toBe(0);
    expect(session.dpi()).toEqual({ x: 800, y: 800 });
  });

  it('a espera atravessa como { kind: "wait", ms }', () => {
    const session = new LeviathanV4Session();
    connect(session);
    session.beginApply(describeLeviathanV4(leviathanV4QueryFixture).defaults);
    let last = session.nextStep();
    for (let step = last; step; step = session.nextStep()) last = step;
    expect(last).toEqual({ kind: 'wait', ms: 8 });
  });

  it('o dump chega com os bytes crus em Uint8Array, no evento e no estado', () => {
    const session = new LeviathanV4Session();
    connect(session);
    const events = ['00', '030a16010a0001010000', 'ff'].flatMap((payload) =>
      session.feedReport(0, notifyReport(0x14, fromHex(payload))),
    );
    const dump = events.at(-1);
    expect(dump?.kind).toBe('onboard-slots');
    expect(dump?.kind === 'onboard-slots' && dump.slots[0].bindings[0].raw).toBeInstanceOf(
      Uint8Array,
    );
    expect(session.slots()?.[0].bindings[0].raw).toBeInstanceOf(Uint8Array);
  });

  it('um erro com dado chega traduzido, com o código em cause', () => {
    const session = new LeviathanV4Session();
    connect(session);
    const defaults = describeLeviathanV4(leviathanV4QueryFixture).defaults;
    let thrown: unknown;
    try {
      session.beginApply({ ...defaults, buttons: { ...defaults.buttons, inexistente: 'voltar' } });
    } catch (error) {
      thrown = error;
    }
    expect((thrown as Error).message).toBe('Botao RAWM desconhecido: inexistente.');
    expect((thrown as Error).cause).toBe('unknown-button');
  });

  it('lê a identidade e o tempo-limite da consulta', () => {
    expect(parseRawmIdentity({ dn: ' Leviathan V4 ', pi: 1 })).toMatchObject({
      deviceName: 'Leviathan V4',
      productId: 1,
      vendorId: null,
      crcSupported: false,
    });
    expect(leviathanQueryTimeoutMs()).toBe(1000);
  });
});
```

O comentário acima de `describe('parseNotification e dpiAxes através da ponte'` cita `notifications.test.ts` e `subscribeToNotifications`, que a Task 7 apaga. Reescreva-o: a sessão do núcleo consome as notificações sem passar pela ponte, e este teste é o que exercita o achatamento de `parseNotification`, que continua lá por causa dos vetores `notify`.

Run: `pnpm --filter @gearhub/web exec vitest run src/core/coreBridge.test.ts`
Expected: FAIL. Os nomes não existem.

- [ ] **Step 2: A ponte**

Em `packages/core-wasm/src/lib.rs`, depois de `settings_from_slot`:

```rust
#[wasm_bindgen(js_name = parseRawmIdentity)]
pub fn parse_rawm_identity(raw: JsValue) -> Result<JsValue, JsError> {
    let raw: serde_json::Value = from_js(raw)?;
    to_js(&rawm::parse_identity(raw).map_err(js_error)?)
}

#[wasm_bindgen(js_name = leviathanQueryTimeoutMs)]
pub fn leviathan_query_timeout_ms() -> u32 {
    leviathan_v4::QUERY_TIMEOUT_MS
}

/// A sessão atravessa como classe, como o montador (Decisão 4); passos e
/// eventos voltam como objetos comuns.
#[wasm_bindgen(js_name = LeviathanV4Session)]
pub struct WasmLeviathanV4Session {
    inner: leviathan_v4::LeviathanV4Session,
}

#[wasm_bindgen(js_class = LeviathanV4Session)]
impl WasmLeviathanV4Session {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: leviathan_v4::LeviathanV4Session::new(),
        }
    }

    #[wasm_bindgen(js_name = feedReport)]
    pub fn feed_report(&mut self, report_id: u8, report: &[u8]) -> Result<JsValue, JsError> {
        to_js(&self.inner.feed_report(report_id, report).map_err(js_error)?)
    }

    #[wasm_bindgen(js_name = beginQuery)]
    pub fn begin_query(&mut self, epoch_seconds: u64) -> Result<(), JsError> {
        self.inner.begin_query(epoch_seconds).map_err(js_error)
    }

    #[wasm_bindgen(js_name = beginApply)]
    pub fn begin_apply(&mut self, settings: JsValue) -> Result<(), JsError> {
        let settings: MouseSettings = from_js(settings)?;
        self.inner.begin_apply(&settings).map_err(js_error)
    }

    #[wasm_bindgen(js_name = beginWriteProfile)]
    pub fn begin_write_profile(&mut self, slot: u32, settings: JsValue) -> Result<(), JsError> {
        let settings: MouseSettings = from_js(settings)?;
        self.inner
            .begin_write_profile(slot, &settings)
            .map_err(js_error)
    }

    #[wasm_bindgen(js_name = nextStep)]
    pub fn next_step(&mut self) -> Result<JsValue, JsError> {
        to_js(&self.inner.next_step().map_err(js_error)?)
    }

    pub fn abort(&mut self) {
        self.inner.abort();
    }

    #[wasm_bindgen(js_name = activeSlot)]
    pub fn active_slot(&self) -> Option<u8> {
        self.inner.active_slot()
    }

    pub fn dpi(&self) -> Result<JsValue, JsError> {
        to_js(&self.inner.dpi())
    }

    pub fn slots(&self) -> Result<JsValue, JsError> {
        to_js(&self.inner.slots())
    }
}

impl Default for WasmLeviathanV4Session {
    fn default() -> Self {
        Self::new()
    }
}
```

- [ ] **Step 3: `coreBridge.ts`**

Acrescente ao `import … from 'gearhub-core-wasm'`:

- `LeviathanV4Session as WasmLeviathanV4Session`;
- `leviathanQueryTimeoutMs as wasmLeviathanQueryTimeoutMs`;
- `parseRawmIdentity as wasmParseRawmIdentity`.

Acrescente ao `import type … from '@gearhub/shared'`: `DpiAxes`, `RawmIdentity`, `SessionEvent` e `SessionStep`.

Depois de `settingsFromSlot`, acrescente:

```ts
/** A identidade que uma resposta de consulta declara. */
export function parseRawmIdentity(raw: Record<string, unknown>): RawmIdentity {
  try {
    return wasmParseRawmIdentity(raw) as RawmIdentity;
  } catch (error) {
    throw asRawmError(error);
  }
}

/** Quanto esperar a resposta de uma consulta, contando a abertura do dispositivo. */
export function leviathanQueryTimeoutMs(): number {
  return wasmLeviathanQueryTimeoutMs();
}

/**
 * A sessão do Leviathan V4, que vive no núcleo: o que o mouse tem e o que
 * enviar a seguir. Este invólucro só traduz o erro tipado e dá o tipo gerado
 * ao que a ponte devolve.
 */
export class LeviathanV4Session {
  private readonly inner = new WasmLeviathanV4Session();

  /** O que um relatório que chegou significa. Só falha com uma consulta pendente. */
  feedReport(reportId: number, report: Uint8Array): SessionEvent[] {
    try {
      return this.inner.feedReport(reportId, report) as SessionEvent[];
    } catch (error) {
      throw asRawmError(error);
    }
  }

  beginQuery(epochSeconds = Math.floor(Date.now() / 1000)): void {
    try {
      this.inner.beginQuery(BigInt(epochSeconds));
    } catch (error) {
      throw asRawmError(error);
    }
  }

  beginApply(settings: MouseSettings): void {
    try {
      this.inner.beginApply(settings);
    } catch (error) {
      throw asRawmError(error);
    }
  }

  /** `slot` conta de 0. */
  beginWriteProfile(slot: number, settings: MouseSettings): void {
    try {
      this.inner.beginWriteProfile(slot, settings);
    } catch (error) {
      throw asRawmError(error);
    }
  }

  /** O próximo passo; `null` quando a operação acabou. */
  nextStep(): SessionStep | null {
    try {
      return (this.inner.nextStep() as SessionStep | null) ?? null;
    } catch (error) {
      throw asRawmError(error);
    }
  }

  abort(): void {
    this.inner.abort();
  }

  /** A memória ativa, contando de 0; `null` antes da primeira resposta. */
  activeSlot(): number | null {
    return this.inner.activeSlot() ?? null;
  }

  dpi(): DpiAxes | null {
    return (this.inner.dpi() as DpiAxes | null) ?? null;
  }

  slots(): OnboardSlotConfig[] | null {
    return (this.inner.slots() as OnboardSlotConfig[] | null) ?? null;
  }
}
```

- [ ] **Step 4: Os vetores conferem também o núcleo**

Em `apps/web/src/test/sessionVectors.ts`:

- acrescente `SessionEvent` ao `import type … from '@gearhub/shared'`;
- importe `LeviathanV4Session` do `'../core/coreBridge'`;
- importe também `type SessionEventJson` e `type StepJson` de `'./vectors'`;
- acrescente:

```ts
/** Uma sessão do núcleo ligada pela resposta que um mouse com `raw` mandaria. */
export function connectedSession(raw: Record<string, unknown>): LeviathanV4Session {
  const session = new LeviathanV4Session();
  session.beginQuery(0);
  while (session.nextStep()) {
    // A consulta só envia; a resposta vem abaixo.
  }
  const events = answerReports(raw).flatMap((report) => session.feedReport(0, report));
  if (events.at(-1)?.kind !== 'queried') throw new Error('a resposta não ligou a sessão');
  return session;
}

/** Os passos até o fim, na forma dos vetores. */
export function drainSteps(session: LeviathanV4Session): StepJson[] {
  const steps: StepJson[] = [];
  for (let step = session.nextStep(); step; step = session.nextStep()) {
    steps.push(step.kind === 'send' ? { send: toHex(step.data) } : { wait: step.ms });
  }
  return steps;
}

/** Um evento na forma dos vetores. A resposta da consulta não aparece neles. */
export function shapeEvent(event: SessionEvent): SessionEventJson {
  switch (event.kind) {
    case 'queried':
      throw new Error('uma resposta de consulta não é evento dos vetores');
    case 'dpi':
      return { kind: 'dpi', x: event.x, y: event.y };
    case 'active-slot':
      return { kind: 'active-slot', index: event.index };
    case 'onboard-slots':
      return { kind: 'onboard-slots', slots: shapeSlots(event.slots) };
  }
}
```

Em `vectors.test.ts`:

- importe `parseRawmIdentity` do `'../../core/coreBridge'`, e `connectedSession, drainSteps, notifyReport, shapeEvent` de `'../../test/sessionVectors'`;
- depois dos testes do driver antigo, acrescente a metade do núcleo:

```ts
it.each(vectors.identity)('identidade (núcleo): $name', ({ query: name, patch, expected }) => {
  const raw = applyQueryPatch(query(name), patch);
  if (expected === null) {
    expect(() => parseRawmIdentity(raw)).toThrow('Resposta RAWM sem identidade válida.');
    return;
  }
  const { deviceName, productId, vendorId, crcSupported } = parseRawmIdentity(raw);
  expect({ deviceName, productId, vendorId, crcSupported }).toEqual(expected);
});

it.each(vectors.sessionEvents)(
  'eventos (núcleo): $name',
  ({ query: name, patch, reports, expected }) => {
    const session = connectedSession(applyQueryPatch(query(name), patch));
    const events = reports.flatMap((report) => session.feedReport(0, fromHex(report)));
    expect(events.map(shapeEvent)).toEqual(expected);
  },
);

it.each(vectors.sessionApply)(
  'aplicação (núcleo): $name',
  ({ query: name, patch, dump, applies }) => {
    const session = connectedSession(applyQueryPatch(query(name), patch));
    for (const payload of dump ?? []) session.feedReport(0, notifyReport(0x14, fromHex(payload)));
    for (const { settings, expected } of applies) {
      session.beginApply(settings);
      expect(drainSteps(session)).toEqual(expected);
    }
  },
);

it.each(vectors.sessionWriteProfile)(
  'gravação de perfil (núcleo): $name',
  ({ query: name, patch, dump, slot, settings, expected }) => {
    const session = connectedSession(applyQueryPatch(query(name), patch));
    for (const payload of dump ?? []) session.feedReport(0, notifyReport(0x14, fromHex(payload)));
    session.beginWriteProfile(slot, settings);
    expect(drainSteps(session)).toEqual(expected);
  },
);
```

- [ ] **Step 5: Rodar**

Run: `cargo test --workspace && cargo clippy --workspace --all-targets -- -D warnings && pnpm core:build && pnpm --filter @gearhub/web exec vitest run src/core src/hardware/rawm/vectors.test.ts`
Expected: PASS. As duas metades dos vetores conferem: o driver antigo e o núcleo pela ponte. Se `data` ou `raw` não chegarem como `Uint8Array`, **pare e reporte**. Não converta na casca.

- [ ] **Step 6: Commit**

```bash
pnpm format
git add packages/core-wasm/src/lib.rs apps/web/src/core apps/web/src/test/sessionVectors.ts apps/web/src/hardware/rawm/vectors.test.ts
git commit -m "feat: expor a sessao do Leviathan V4 pela ponte"
```

---

### Task 7: A casca passa a ser bomba, e `session.ts` e `notifications.ts` são apagados

**Files:**

- Modify: `apps/web/src/hardware/rawm/LeviathanV4Driver.ts`, `connectLeviathanV4.ts`
- Create: `apps/web/src/hardware/rawm/leviathanV4Harness.ts`
- Rewrite: `LeviathanV4Driver.test.ts`, `LeviathanV4Driver.state.test.ts`, `LeviathanV4Driver.onboard.test.ts`
- Modify: `connectLeviathanV4.test.ts`, `apps/web/src/components/DeviceWorkspace.liveDpi.test.tsx`, `apps/web/src/hardware/rawm/vectors.test.ts`, `apps/web/src/core/rawmError.ts` (comentário)
- Delete: `apps/web/src/hardware/rawm/{session,session.test,notifications,notifications.test,legacySessionRunners}.ts`

**Interfaces:**

- Consumes: `LeviathanV4Session`, `leviathanQueryTimeoutMs` (Task 6); `asRawmError`.
- Produces (`LeviathanV4Driver`):
  - `constructor(transport: HardwareTransport, queryTimeoutMs = leviathanQueryTimeoutMs())`;
  - `query(epochSeconds?: number): Promise<RawmIdentity>`;
  - `close(): void`;
  - as cinco operações de `DeviceDriver`: `applyToSession`, `writeProfile`, `readState`, `onDeviceReport` e `onOnboardProfiles`.

- [ ] **Step 1: O mouse falso dos testes**

Crie `apps/web/src/hardware/rawm/leviathanV4Harness.ts`:

```ts
import { vi } from 'vitest';
import type { HidCommand } from '@gearhub/shared';
import { withProtocolEnvelope } from '../../core/coreBridge';
import { answerReports, deliveredReports } from '../../test/sessionVectors';
import type { HardwareTransport } from '../WebHidTransport';
import { LeviathanV4Driver } from './LeviathanV4Driver';
import { leviathanV4QueryFixture } from './leviathanV4Fixture';

const CMD_QUERY = 0x01;
const CMD_NOTIFY = 0x0b;

/**
 * Um Leviathan V4 falso: responde à consulta com `raw` e entrega ao driver o
 * que o teste anunciar. Os relatórios enviados ficam em `sent`.
 */
export function fakeLeviathanV4(raw: Record<string, unknown> = leviathanV4QueryFixture) {
  const listeners = new Set<(reportId: number, data: Uint8Array) => void>();
  const sent: Uint8Array[] = [];
  let answer: Record<string, unknown> | null = raw;
  let failAfter: number | null = null;
  const deliver = (reports: Uint8Array[]) => {
    for (const report of reports) for (const listener of listeners) listener(0, report);
  };
  const transport = {
    open: vi.fn<() => Promise<void>>(async () => undefined),
    send: vi.fn<(command: HidCommand) => Promise<void>>(async ({ data }) => {
      if (failAfter !== null && sent.length >= failAfter) {
        throw new Error('Falha de transporte simulada.');
      }
      sent.push(data);
      // [0] canal virtual, [1] cabeçalho do pedaço, [2] o comando do evento.
      const reply = answer;
      if ((data[2] & 0x0f) === CMD_QUERY && reply) {
        queueMicrotask(() => deliver(answerReports(reply)));
      }
    }),
    onInputReport(listener: (reportId: number, data: Uint8Array) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  } satisfies HardwareTransport;
  return {
    transport,
    sent,
    notify(type: number, payload: number[]) {
      deliver(deliveredReports(withProtocolEnvelope([CMD_NOTIFY, 0, type, ...payload], false)));
    },
    report(data: Uint8Array) {
      deliver([data]);
    },
    answerWith(next: Record<string, unknown> | null) {
      answer = next;
    },
    failAfter(count: number | null) {
      failAfter = count;
    },
    listeners: () => listeners.size,
  };
}

/** Um driver já ligado pela consulta, com os envios dela descartados. */
export async function connectedDriver(
  fake: ReturnType<typeof fakeLeviathanV4>,
): Promise<LeviathanV4Driver> {
  const driver = new LeviathanV4Driver(fake.transport);
  await driver.query();
  fake.sent.length = 0;
  return driver;
}
```

- [ ] **Step 2: Os testes do driver, reescritos (falham)**

Troque `LeviathanV4Driver.test.ts` por:

```ts
import { describe, expect, it } from 'vitest';
import type { MouseSettings } from '@gearhub/shared';
import { createLeviathanV4Peripheral } from './leviathanV4';
import { leviathanV4QueryFixture } from './leviathanV4Fixture';
import { connectedDriver, fakeLeviathanV4 } from './leviathanV4Harness';

const settings = createLeviathanV4Peripheral(leviathanV4QueryFixture, 'real')
  .defaults as MouseSettings;

// Layout with the CRC envelope: [0] virtual channel, [1] chunk header, [2] cmd,
// [3] len, [4] 0x24, [5..6] crc, [7] inner cmd, [8] inner len, [9] inner type.
const innerCommand = (report: Uint8Array) => report[7];

describe('LeviathanV4Driver', () => {
  it('sends every step through the virtual mouse channel', async () => {
    const fake = fakeLeviathanV4();
    const driver = await connectedDriver(fake);
    await driver.applyToSession(settings);
    expect(fake.sent.length).toBeGreaterThan(0);
    expect(fake.sent.every((report) => report[0] === 0xc0)).toBe(true);
  });

  it('applies to the session without committing to flash', async () => {
    const fake = fakeLeviathanV4();
    const driver = await connectedDriver(fake);
    await driver.applyToSession(settings);
    // Action events carry command 0x06; a session apply sends none.
    expect(fake.sent.some((report) => innerCommand(report) === 0x06)).toBe(false);
  });

  it('brackets a profile write with the saves that commit it', async () => {
    const fake = fakeLeviathanV4();
    const driver = await connectedDriver(fake);
    await driver.writeProfile(4, 'Perfil 4', settings);
    const actions = fake.sent.filter((report) => innerCommand(report) === 0x06);
    expect(actions).toHaveLength(2);
    expect(actions[0][9]).toBe(0x34); // ACTION_SAVE_CONFIG_TO_FDS
    // The opening save names the slot: 1 | ((4 - 1) << 8) = 0x0301.
    expect(actions[0][10]).toBe(0x01);
    expect(actions[0][11]).toBe(0x03);
    expect(actions[1][10]).toBe(0x00);
    expect(actions[1][11]).toBe(0x00);
  });

  it('refuses a slot the shell cannot convert, without sending', async () => {
    const fake = fakeLeviathanV4();
    const driver = await connectedDriver(fake);
    await expect(driver.writeProfile(0, 'Perfil', settings)).rejects.toThrow(
      'Indice de perfil RAWM invalido.',
    );
    await expect(driver.writeProfile(1.5, 'Perfil', settings)).rejects.toThrow(
      'Indice de perfil RAWM invalido.',
    );
    expect(fake.sent).toHaveLength(0);
  });

  it('refuses a slot beyond the memories the mouse has, without sending', async () => {
    const fake = fakeLeviathanV4();
    const driver = await connectedDriver(fake);
    await expect(driver.writeProfile(5, 'Perfil', settings)).rejects.toThrow(
      'Indice de perfil RAWM invalido.',
    );
    expect(fake.sent).toHaveLength(0);
  });

  it('runs one operation after another', async () => {
    const fake = fakeLeviathanV4();
    const driver = await connectedDriver(fake);
    await Promise.all([
      driver.applyToSession(settings),
      driver.applyToSession({ ...settings, pollingRate: 500 }),
    ]);
    expect(fake.sent.length).toBeGreaterThan(0);
  });
});
```

Troque `LeviathanV4Driver.state.test.ts` por:

```ts
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { MouseSettings } from '@gearhub/shared';
import type { DeviceReport } from '../deviceDriver';
import { LeviathanV4Driver } from './LeviathanV4Driver';
import { createLeviathanV4Peripheral } from './leviathanV4';
import { leviathanV4QueryFixture as fixture } from './leviathanV4Fixture';
import { connectedDriver, fakeLeviathanV4 } from './leviathanV4Harness';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const settings = createLeviathanV4Peripheral(fixture, 'test').defaults as MouseSettings;

function listen(driver: LeviathanV4Driver): DeviceReport[] {
  const reports: DeviceReport[] = [];
  driver.onDeviceReport((report) => reports.push(report));
  return reports;
}

it('connects with one query on the virtual channel', async () => {
  const fake = fakeLeviathanV4();
  const driver = new LeviathanV4Driver(fake.transport);
  await expect(driver.query()).resolves.toMatchObject({
    deviceName: 'LEVIATHAN V4',
    crcSupported: true,
  });
  expect(fake.sent).toHaveLength(1);
  expect(fake.sent[0][0]).toBe(0xc0);
});

it('counts opening the device against the query timeout', async () => {
  const fake = fakeLeviathanV4();
  fake.transport.open.mockImplementation(() => new Promise<void>(() => undefined));
  const driver = new LeviathanV4Driver(fake.transport, 5);
  const failed = expect(driver.query()).rejects.toThrow('A consulta RAWM excedeu o tempo limite.');
  await vi.advanceTimersByTimeAsync(5);
  await failed;
});

it('times out without an answer, and the next query still works', async () => {
  const fake = fakeLeviathanV4();
  fake.answerWith(null);
  const driver = new LeviathanV4Driver(fake.transport, 5);
  const failed = expect(driver.query()).rejects.toThrow('tempo limite');
  await vi.advanceTimersByTimeAsync(5);
  await failed;
  fake.answerWith(fixture);
  await expect(driver.query()).resolves.toMatchObject({ deviceName: 'LEVIATHAN V4' });
});

it('fails the pending query on a report from another channel', async () => {
  const fake = fakeLeviathanV4();
  fake.answerWith(null);
  const driver = new LeviathanV4Driver(fake.transport);
  const failed = expect(driver.query()).rejects.toThrow(
    'Relatório não pertence ao canal virtual do mouse.',
  );
  await vi.advanceTimersByTimeAsync(0);
  fake.report(new Uint8Array(64).fill(0x11));
  await failed;
});

it('refuses a mouse that is not a Leviathan V4', async () => {
  const fake = fakeLeviathanV4({ ...fixture, dn: 'RAWM HS Receiver' });
  await expect(new LeviathanV4Driver(fake.transport).query()).rejects.toThrow(
    'Mouse RAWM conectado nao reconhecido: RAWM HS Receiver.',
  );
});

it('reads the actual active memory independently of the opaque ob parameter', async () => {
  const fake = fakeLeviathanV4({ ...fixture, ob: 3, oci: 1 });
  const driver = await connectedDriver(fake);
  const reports = listen(driver);
  expect(reports[0]).toEqual({ kind: 'active-profile', slotIndex: 2 });
  fake.answerWith({ ...fixture, ob: 3, oci: 2, cpi: 3200 });
  await expect(driver.readState()).resolves.toEqual({
    activeProfileSlot: 3,
    dpi: { x: 3200, y: 3200 },
  });
  fake.notify(0x22, [3]);
  expect(reports.at(-1)).toEqual({ kind: 'active-profile', slotIndex: 4 });
});

it('receives DPI buttons and decodes independent axes for the editor', async () => {
  const fake = fakeLeviathanV4();
  const driver = await connectedDriver(fake);
  const reports = listen(driver);
  fake.notify(0x00, [0x40, 0x06]);
  expect(reports.at(-1)).toEqual({ kind: 'dpi', value: 1600, y: 1600 });
  fake.notify(0x06, [0x20, 0x03, 0x40, 0x06]);
  expect(reports.at(-1)).toEqual({ kind: 'dpi', value: 800, y: 1600 });
});

it('stops sending a session configuration when the physical memory changes', async () => {
  const fake = fakeLeviathanV4();
  const driver = await connectedDriver(fake);
  fake.transport.send.mockImplementationOnce(async ({ data }) => {
    fake.sent.push(data);
    fake.notify(0x22, [1]);
  });
  const rejected = expect(driver.applyToSession(settings)).rejects.toThrow('memória ativa mudou');
  await vi.runAllTimersAsync();
  await rejected;
  expect(fake.sent).toHaveLength(1);
});

it('does not let a timed-out query abort the next operation', async () => {
  const reference = fakeLeviathanV4();
  const clean = await connectedDriver(reference);
  const done = clean.applyToSession(settings);
  await vi.runAllTimersAsync();
  await done;

  const fake = fakeLeviathanV4();
  const driver = await connectedDriver(fake);
  let failLate: (error: Error) => void = () => undefined;
  fake.transport.send.mockImplementationOnce(
    () =>
      new Promise<void>((_resolve, reject) => {
        failLate = reject;
      }),
  );
  const timedOut = expect(driver.readState()).rejects.toThrow('tempo limite');
  await vi.advanceTimersByTimeAsync(1000);
  await timedOut;
  const apply = driver.applyToSession(settings);
  // A aplicação começou e espera a primeira pausa quando o envio velho falha.
  await vi.advanceTimersByTimeAsync(0);
  failLate(new Error('envio tardio'));
  await vi.runAllTimersAsync();
  await apply;
  expect(fake.sent).toEqual(reference.sent);
});
```

Troque `LeviathanV4Driver.onboard.test.ts` por:

```ts
import { describe, expect, it } from 'vitest';
import type { MouseSettings } from '@gearhub/shared';
import { notifyReport } from '../../test/sessionVectors';
import { fromHex, readProtocolVectors } from '../../test/vectors';
import { createLeviathanV4Peripheral } from './leviathanV4';
import { leviathanV4QueryFixture } from './leviathanV4Fixture';
import { connectedDriver, fakeLeviathanV4 } from './leviathanV4Harness';

const settings = createLeviathanV4Peripheral(leviathanV4QueryFixture, 'real')
  .defaults as MouseSettings;
const innerType = (report: Uint8Array) => report[9];
const LEFT_CLICK_ENTRY = '030a16010a0001010000';

function deliverDump(fake: ReturnType<typeof fakeLeviathanV4>, payloads: string[]): void {
  for (const payload of payloads) fake.report(notifyReport(0x14, fromHex(payload)));
}

/** O dump de um mouse que guarda os mapeamentos padrão na memória 0, dos vetores. */
function heldDump(): string[] {
  const vector = readProtocolVectors().sessionApply.find(
    ({ name }) => name === 'com dump e mapeamentos iguais: só parâmetros',
  );
  if (!vector?.dump) throw new Error('vetor do dump padrão ausente');
  return vector.dump;
}

describe('reading the onboard slots', () => {
  it('replays a dump that landed before anyone subscribed', async () => {
    const fake = fakeLeviathanV4();
    const driver = await connectedDriver(fake);
    deliverDump(fake, ['02', LEFT_CLICK_ENTRY, 'ff']);
    let received: { index: number }[] = [];
    driver.onOnboardProfiles((slots) => {
      received = slots;
    });
    expect(received.map((slot) => slot.index)).toEqual([2]);
  });

  it('names the bindings the mouse reported', async () => {
    const fake = fakeLeviathanV4();
    const driver = await connectedDriver(fake);
    deliverDump(fake, ['00', LEFT_CLICK_ENTRY, 'ff']);
    let received: { bindings: { keyIds: number[]; action: string | null }[] }[] = [];
    driver.onOnboardProfiles((slots) => {
      received = slots;
    });
    const left = received[0].bindings.find((binding) => binding.keyIds[0] === 0x0a);
    expect(left?.action).toBe('clique-esquerdo');
  });
});

// The vendor's mouse dropdown only selects which onboard slot to edit.
describe('switching the active onboard slot', () => {
  it('is not offered without a verified mouse-side switch command', async () => {
    const driver = await connectedDriver(fakeLeviathanV4());
    expect((driver as { switchProfile?: unknown }).switchProfile).toBeUndefined();
  });
});

it('stops skipping after a write that failed part way through', async () => {
  const fake = fakeLeviathanV4();
  const driver = await connectedDriver(fake);
  deliverDump(fake, heldDump());

  // The reset and the first events land, then the transport gives out.
  fake.failAfter(4);
  await expect(
    driver.applyToSession({ ...settings, buttons: { ...settings.buttons, central: 'desativado' } }),
  ).rejects.toThrow('Falha de transporte simulada.');
  fake.failAfter(null);
  fake.sent.length = 0;

  // What the mouse originally reported is no longer assumed to be in place.
  await driver.applyToSession(settings);
  expect(fake.sent.map(innerType)).toContain(0x03);
});
```

Run: `pnpm --filter @gearhub/web exec vitest run src/hardware/rawm/LeviathanV4Driver`
Expected: FAIL. O driver ainda tem o construtor antigo e não tem `query`.

- [ ] **Step 3: O driver como bomba**

Troque `apps/web/src/hardware/rawm/LeviathanV4Driver.ts` inteiro por:

```ts
import type {
  MouseSettings,
  OnboardSlotConfig,
  PeripheralSettings,
  RawmIdentity,
  SessionEvent,
} from '@gearhub/shared';
import { LeviathanV4Session, leviathanQueryTimeoutMs } from '../../core/coreBridge';
import { asRawmError } from '../../core/rawmError';
import { isMouseSettings } from '../../domain/settings';
import type { DeviceDriver, DeviceReport, DeviceState } from '../deviceDriver';
import type { HardwareTransport } from '../WebHidTransport';

function mouseSettings(settings: PeripheralSettings): MouseSettings {
  if (!isMouseSettings(settings))
    throw new TypeError('O Leviathan V4 requer configuracao de mouse.');
  return settings;
}

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * A casca do Leviathan V4: fila, bomba e ouvintes. Toda decisão — o que o
 * mouse tem, o que enviar, quando parar — é da sessão do núcleo; aqui só se
 * executa o passo que ela pede e se repassa o que o mouse anuncia.
 *
 * The vendor's Onboard config dropdown is an editing cursor, not a switch. No
 * mouse-side switch command has been verified: IQ_SET_PROFILE_ID (0x40) belongs
 * to HS keyboards; see docs/rawm-onboard-config.md §5. Notification 0x22 and
 * readState supply the active index independently.
 */
export class LeviathanV4Driver implements DeviceDriver {
  private readonly session = new LeviathanV4Session();
  private tail: Promise<void> = Promise.resolve();
  private readonly slotListeners = new Set<(slots: OnboardSlotConfig[]) => void>();
  private readonly reportListeners = new Set<(report: DeviceReport) => void>();
  /** Quem espera a resposta da consulta em andamento. */
  private answered: ((result: RawmIdentity | Error) => void) | null = null;
  /**
   * Sobe quando uma consulta estoura o tempo. Uma bomba de geração antiga — a
   * da consulta abandonada, ainda presa num envio — para sem tocar a sessão,
   * que a essa altura pode estar com outra operação.
   */
  private generation = 0;
  private readonly unsubscribe: () => void;

  /**
   * Ouve o transporte antes de qualquer consulta: o dump responde à mesma
   * consulta, e um único leitor desde o primeiro relatório é o que garante
   * pegá-lo.
   */
  constructor(
    private readonly transport: HardwareTransport,
    private readonly queryTimeoutMs = leviathanQueryTimeoutMs(),
  ) {
    this.unsubscribe = transport.onInputReport((reportId, report) =>
      this.receive(reportId, report),
    );
  }

  /** Para de ouvir o transporte. O `connect` chama quando a consulta falha. */
  close(): void {
    this.unsubscribe();
  }

  /** Consulta o mouse. A primeira resposta liga a sessão; as seguintes a atualizam. */
  query(epochSeconds?: number): Promise<RawmIdentity> {
    return this.enqueue(() => this.runQuery(epochSeconds));
  }

  readState(): Promise<DeviceState> {
    return this.enqueue(async () => {
      await this.runQuery();
      const slot = this.session.activeSlot();
      const dpi = this.session.dpi();
      if (slot === null || dpi === null) throw asRawmError(new Error('not-queried'));
      return { activeProfileSlot: slot + 1, dpi };
    });
  }

  /** The mouse announces a DPI cycled by its own button; the editor follows. */
  onDeviceReport(listener: (report: DeviceReport) => void): () => void {
    this.reportListeners.add(listener);
    const slot = this.session.activeSlot();
    const dpi = this.session.dpi();
    if (slot !== null) listener({ kind: 'active-profile', slotIndex: slot + 1 });
    if (dpi !== null) listener({ kind: 'dpi', value: dpi.x, y: dpi.y });
    return () => {
      this.reportListeners.delete(listener);
    };
  }

  /**
   * The mappings each onboard slot holds. A dump already collected is replayed
   * at once, so a subscriber that arrives late still gets it.
   */
  onOnboardProfiles(listener: (slots: OnboardSlotConfig[]) => void): () => void {
    this.slotListeners.add(listener);
    const slots = this.session.slots();
    if (slots) listener(slots);
    return () => {
      this.slotListeners.delete(listener);
    };
  }

  /** Applies to the session without touching flash; the core decides what goes. */
  applyToSession(settings: PeripheralSettings): Promise<void> {
    return this.enqueue(async () => {
      this.session.beginApply(mouseSettings(settings));
      await this.pump();
    });
  }

  /** Writes an onboard profile, which persists. `slotIndex` counts from 1. */
  writeProfile(slotIndex: number, _name: string, settings: PeripheralSettings): Promise<void> {
    // O TypeScript não tem tipo inteiro; o resto da faixa quem confere é o núcleo.
    if (!Number.isInteger(slotIndex) || slotIndex < 1) {
      return Promise.reject(asRawmError(new Error('invalid-profile-slot')));
    }
    return this.enqueue(async () => {
      this.session.beginWriteProfile(slotIndex - 1, mouseSettings(settings));
      await this.pump();
    });
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const current = this.tail.then(operation, operation);
    this.tail = current.then(
      () => undefined,
      () => undefined,
    );
    return current;
  }

  private receive(reportId: number, report: Uint8Array): void {
    let events: SessionEvent[];
    try {
      events = this.session.feedReport(reportId, report);
    } catch (error) {
      // O núcleo só falha aqui com uma consulta pendente, e já a encerrou.
      this.answered?.(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    for (const event of events) this.dispatch(event);
  }

  private dispatch(event: SessionEvent): void {
    switch (event.kind) {
      case 'queried':
        this.answered?.(event);
        return;
      case 'dpi':
        for (const listener of this.reportListeners) {
          listener({ kind: 'dpi', value: event.x, y: event.y });
        }
        return;
      case 'active-slot':
        for (const listener of this.reportListeners) {
          listener({ kind: 'active-profile', slotIndex: event.index + 1 });
        }
        return;
      case 'onboard-slots':
        for (const listener of this.slotListeners) listener(event.slots);
        return;
    }
  }

  private runQuery(epochSeconds?: number): Promise<RawmIdentity> {
    return new Promise<RawmIdentity>((resolve, reject) => {
      let settled = false;
      const finish = (result: RawmIdentity | Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.answered = null;
        if (result instanceof Error) reject(result);
        else resolve(result);
      };
      // O tempo conta desde antes de abrir o dispositivo.
      const timer = setTimeout(() => {
        this.generation += 1;
        this.session.abort();
        finish(new Error('A consulta RAWM excedeu o tempo limite.'));
      }, this.queryTimeoutMs);
      this.answered = finish;
      void (async () => {
        try {
          await this.transport.open();
          if (settled) return;
          this.session.beginQuery(epochSeconds);
          await this.pump();
        } catch (error) {
          finish(
            error instanceof Error ? error : new Error('Falha ao consultar o dispositivo RAWM.'),
          );
        }
      })();
    });
  }

  /** Executa os passos que a sessão pede, até ela não ter mais nenhum. */
  private async pump(): Promise<void> {
    const generation = this.generation;
    try {
      for (let step = this.session.nextStep(); step; step = this.session.nextStep()) {
        if (step.kind === 'send') {
          await this.transport.send({ reportId: step.reportId, data: step.data });
        } else {
          await pause(step.ms);
        }
        if (generation !== this.generation) return;
      }
    } catch (error) {
      if (generation === this.generation) this.session.abort();
      throw error;
    }
  }
}
```

- [ ] **Step 4: O `connect` muda de ordem**

Troque `connectLeviathanV4.ts` inteiro por:

```ts
import type { MousePeripheral } from '@gearhub/shared';
import { registerDeviceDriver } from '../deviceDriver';
import type { BrowserHidDevice } from '../deviceDiscovery';
import type { DeviceDefinition } from '../deviceRegistry';
import { WebHidTransport } from '../WebHidTransport';
import { LeviathanV4Driver } from './LeviathanV4Driver';
import { createLeviathanV4Peripheral } from './leviathanV4';

/**
 * Liga o Leviathan V4. O driver nasce antes da consulta e já ouve o receptor,
 * para que um único leitor veja o fluxo desde o primeiro relatório. Identidade,
 * nome e snapshot são conferidos pelo núcleo na primeira resposta.
 */
export async function connectLeviathanV4(
  device: BrowserHidDevice,
  definition: DeviceDefinition,
): Promise<MousePeripheral> {
  if (definition.id !== 'rawm-leviathan-v4' || !definition.matches(device)) {
    throw new Error('O receptor WebHID nao corresponde ao Leviathan V4.');
  }
  const id = `${definition.id}:${device.vendorId.toString(16)}:${device.productId.toString(16)}`;
  const driver = new LeviathanV4Driver(new WebHidTransport(device));
  try {
    const mouse = await driver.query();
    const peripheral = createLeviathanV4Peripheral(mouse.raw, id);
    registerDeviceDriver(id, driver);
    return peripheral;
  } catch (error) {
    driver.close();
    throw error;
  }
}
```

Em `connectLeviathanV4.test.ts`:

- `fakeDevice` passa a devolver `BrowserHidDevice & { listenerCount(): number }`, com `listenerCount: () => listeners.size` no objeto;
- acrescente:

```ts
it('refuses a mouse that is not a Leviathan V4 and stops listening', async () => {
  const device = fakeDevice(receiver, { ...mouse, dn: 'Outro Mouse' });
  await expect(connectLeviathanV4(device, deviceDefinitions()[0])).rejects.toThrow(
    'Mouse RAWM conectado nao reconhecido: Outro Mouse.',
  );
  expect(device.listenerCount()).toBe(0);
});
```

Em `DeviceWorkspace.liveDpi.test.tsx`, troque o `beforeEach` por:

```tsx
beforeEach(async () => {
  useDeviceStore.setState({ devices: [structuredClone(device)] });
  const fake = fakeLeviathanV4(fixture);
  notify = (type, payload) => fake.notify(type, payload);
  const driver = new LeviathanV4Driver(fake.transport);
  await driver.query();
  registerDeviceDriver(device.id, driver);
  vi.useFakeTimers();
});
```

Importe `fakeLeviathanV4` de `'../hardware/rawm/leviathanV4Harness'`, e remova os imports de `frameEvent` e `withProtocolEnvelope` se ficarem sem uso.

`apps/web/src/app/useDeviceReports.test.ts` não muda. O comentário dele sobre o replay continua verdadeiro.

- [ ] **Step 5: Apagar o que migrou**

```bash
git rm apps/web/src/hardware/rawm/session.ts apps/web/src/hardware/rawm/session.test.ts apps/web/src/hardware/rawm/notifications.ts apps/web/src/hardware/rawm/notifications.test.ts apps/web/src/hardware/rawm/legacySessionRunners.ts
```

Em `vectors.test.ts`, remova a metade do driver antigo: os quatro `it.each(…)('… (driver antigo): $name'` e o import de `'./legacySessionRunners'`. Ficam as do núcleo e o teste dos nomes.

Em `apps/web/src/core/rawmError.ts`, os dois comentários citam `subscribeToNotifications` e `queryRawmDevice`, que não existem mais. Reescreva-os:

- **Primeiro:** as mensagens são as de antes da migração, e a casca as mostra ao usuário.
- **Segundo:** o código em `cause` é o que distingue o erro da guarda de memória ativa (`active-slot-changed`) de uma falha de transporte.

- [ ] **Step 6: Procurar restos**

Run: `grep -rn "queryRawmDevice\|subscribeToNotifications\|validateRawmIdentity\|legacySessionRunners\|appliedMappings\|editorKeySets\|preservedEvents\|mappingEvents\|ACTION_SAVE_CONFIG_TO_FDS\|from './session'\|from './notifications'" apps/web/src`
Expected: nenhuma ocorrência.

Run: `grep -n "encodeMapping\|encodeConfigReset\|encodeAction\|withProtocolEnvelope\|frameEvent\|parseNotification\|OnboardConfigCollector\|applySettingsToMouseParam\|leviathanKeyId" apps/web/src/hardware/rawm/LeviathanV4Driver.ts`
Expected: nenhuma ocorrência.

- [ ] **Step 7: Rodar**

Run: `pnpm test && pnpm lint && pnpm run audit`
Expected: PASS, e o knip não aponta export sem uso. As exportações da ponte que só os testes usam (`parseNotification`, `OnboardConfigCollector`, `dpiAxes`, `leviathanOnboardSlotCount`, `leviathanShowPowerKeyId`) passam, como `decodeOnboardEntry` passa desde o passo 4.

- [ ] **Step 8: Commit**

```bash
pnpm format
git add apps/web/src
git commit -m "refactor: o driver do Leviathan V4 vira bomba da sessao do nucleo"
```

---

### Task 8: Documentos e roteiro de hardware

**Files:**

- Modify: `docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md`, `CLAUDE.md`, `docs/smoke-test-leviathan-v4.md`

- [ ] **Step 1: Spec**

- Na `## Ordem corrigida`, item 5, acrescente ao final, mantendo o reflow e usando a data do commit: `**Implementado em AAAA-MM-DD** pelo plano \`docs/superpowers/plans/2026-10-03-migracao-sessao.md\`, aguardando a confirmação em hardware do roteiro em \`docs/smoke-test-leviathan-v4.md\`: \`session.ts\` e \`notifications.ts\` foram apagados, e \`LeviathanV4Driver.ts\` só executa os passos da sessão do núcleo.`
- No fim do `## Passo 5 — desenho (2026-10-03)`, antes de `### Entrega`, acrescente `### Desvios declarados na execução`, com os quatro itens da seção de mesmo nome deste plano. Acrescente também um parágrafo sobre a geração da bomba: uma consulta que estoura o tempo com um envio ainda preso não pode abortar nem roubar passos da operação seguinte, então a casca numera as bombas, e a antiga para sem tocar a sessão.
- Na tabela de `### Erros`, acrescente a linha de `InvalidQueryJson`.

- [ ] **Step 2: CLAUDE.md**

- **Estado real:** passe a data para a de hoje e acrescente que o passo 5 levou a sessão do driver (`packages/core/src/drivers/leviathan_v4/session.rs` e `mappings.rs`). `session.ts` e `notifications.ts` não existem mais, e `LeviathanV4Driver.ts` é só fila, bomba e ouvintes. Marque como pendente da confirmação em hardware do roteiro do passo 5.
- **Ainda em TypeScript:** troque a frase por "Nenhum protocolo resta em TypeScript; o que fica é casca — a bomba e a fila do driver, `WebHidTransport`, as sondas de diagnóstico (Decisão 1) e a tela."
- **Generated:** na lista entre parênteses dos tipos gerados, acrescente "a identidade da consulta, os passos e eventos da sessão e o `HidCommand`".
- Reflow em ~95–100 colunas.

- [ ] **Step 3: Roteiro**

Ao final de `docs/smoke-test-leviathan-v4.md`:

```markdown
## Passo 5 — roteiro de confirmação (pendente)

O passo 5 moveu para o núcleo a sessão do driver: o leitor do fluxo de entrada, a consulta,
a memória ativa, a assinatura do que o mouse guarda e a decisão de cada envio, com as
pausas. Os bytes e as esperas estão fixados pelos vetores `sessionApply` e
`sessionWriteProfile`, capturados do driver TypeScript anterior; o que falta é o mouse
confirmar. Nenhum passo grava em memória que guarde macro (defeito conhecido, portado como
está).

1. **Conectar.** Nome, DPI, memória ativa e as quatro memórias com os mapeamentos de cada
   uma — o leitor único pegou o dump.
2. **Botões do mouse.** Trocar o DPI e a memória pelo mouse: a tela acompanha.
3. **Só parâmetros.** Aplicar só DPI e polling: os botões continuam funcionando (um evento
   só, sem `CONFIG_RESET`).
4. **Mapeamento na sessão.** Mudar um botão e aplicar à sessão: funciona; desligar e religar
   o mouse devolve o que está na flash.
5. **Gravar.** Gravar numa memória sem macro e reconectar: a tela relê exatamente o que foi
   gravado, e o indicador de bateria sobrevive.
6. **Sondas.** Rodar a página de diagnóstico e a sonda de escrita.

A troca de memória no meio de uma aplicação não é provocável à mão (a aplicação dura cerca
de 150 ms) e fica com os testes.

Resultado: _preencher após o teste._
```

- [ ] **Step 4: Gate**

Run: `pnpm verify`
Expected: passa.

- [ ] **Step 5: Commit**

```bash
pnpm format
git add docs CLAUDE.md
git commit -m "docs: fechar o passo 5 no codigo e deixar o roteiro de hardware"
```

## Verificação em hardware

**Obrigatória antes do merge.** O roteiro está na Task 8. Quem confirma preenche o resultado. Depois disso, o spec troca "aguardando a confirmação" por "Fechado em <data>", e o `CLAUDE.md` tira a pendência.

## Planos seguintes

- **PR dos itens 1 e 2:** macro num botão do editor (precisa da decisão de produto sobre como o editor mostra um botão com bytes sem nome; o gancho é `Binding::Raw` em `mappings.rs`) e proteção do clique esquerdo (validação no `begin_apply`).
- **Item 3, só a pedido:** investigar se o mouse tem um comando para trocar a memória ativa.
