# Redesign da UI de configuração de mouse — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a página de configurações genérica do `apps/web` por sete telas orientadas ao device, sustentadas por um modelo de dados que separa capabilities, perfil e telemetria.

**Architecture:** `packages/shared` passa a expor tipos de mouse mais uma porta `MouseDriver`; `apps/web` consome essa porta através de um único store zustand que mantém um `draft` aplicado ao vivo no device e persistido em slot sob demanda. As telas são registradas num `sectionRegistry` — o rail de navegação renderiza o registry, então nunca existe item de menu sem tela atrás. Os tokens de cor saem do app e passam a morar em `packages/ui`.

**Tech Stack:** pnpm workspaces + turbo, React 19, Vite 8, Tailwind 4, zustand 5, Radix via shadcn, TypeScript 5.9, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-09-04-mouse-ui-redesign-design.md`

## Global Constraints

- Branch de trabalho: `feat/mouse-ui-redesign`. Nunca commitar em `main` (skill `commit-best-practices` do repo).
- Formato de commit: `feat: <resumo imperativo>` ou `bug: <resumo imperativo>`, minúsculo quando natural, sem ponto final, até 72 caracteres.
- Node ≥ 22.12, pnpm 11.19.0.
- `pnpm audit:boundaries` é gate de CI: nenhuma dependência de pacote para app, nenhum ciclo em runtime, nenhum acesso a WASM fora de `apps/web/src/core/coreBridge.ts`.
- Capability ausente ⇒ o controle **não é renderizado**. Nunca desabilitado, nunca cinza. Esta regra vale para toda tela.
- Todo valor numérico de configuração (DPI, Hz, ms, mm, graus) usa `font-variant-numeric: tabular-nums`.
- Componentes referenciam apenas tokens semânticos (`--color-bg-raised`), nunca primitivos (`--gray-800`) e nunca valores literais.
- Cor no chrome é proibida. As únicas presenças cromáticas são os estágios de DPI (`green | cyan | blue | violet | magenta`) e o vermelho de destrutivo.
- Não introduzir um segundo framework de teste. Vitest é o runner do repositório (skill `pragmatic-testing`).
- Após qualquer mudança estrutural, rodar `pnpm graph:update` (conforme `AGENTS.md`).

## Ajustes ao spec feitos por este plano

Três lacunas apareceram ao derivar as tarefas. O plano as fecha; o spec deve ser lido junto com esta seção.

1. **`pollingRate.runtimeHours`** — a tela de Performance promete estimativa de bateria recalculando em tempo real, mas nenhum tipo do spec carrega os dados dessa estimativa. Inventar a fórmula produziria um número falso na tela. O dado passa a vir do driver, ao lado do polling rate de que depende.
2. **`MouseDriver.onDisconnect`** — a §8 do spec exige preservar o `draft` quando o mouse desconecta e reaplicá-lo ao reconectar, mas a porta não tinha como notificar. Adicionada assinatura de subscrição.
3. **`DeviceDisconnectedError`** — a §8 distingue "falhou" de "sumiu", e essa distinção precisa de um tipo, não de comparação de string de mensagem.

## Sequenciamento e o ponto de corte

Os tipos antigos (`DeviceSettings`, `ConnectedPeripheral`) **coexistem com os novos entre a Task 1 e a Task 6**. Isso é temporário e deliberado: permite que a árvore compile e os testes passem em cada commit. A Task 6 é o ponto de corte — remove a UI antiga e os tipos antigos de uma vez, quando o substituto já existe. Nenhum commit deixa o repositório vermelho.

| Fase | Tasks | Entrega |
| --- | --- | --- |
| Fundação | 1–3 | Tipos, driver mock e store, testados, sem UI nova |
| Base visual | 4–5 | Tokens em `packages/ui` e primitivos shadcn |
| Corte | 6 | Shell + home + Performance; UI e tipos antigos removidos |
| Telas | 7–12 | DPI, render, Buttons, Parameters, Profiles, Device |
| Fechamento | 13–14 | Verificação completa e passe das skills `interfaces:*` |

---

## Task 1: Modelo de dados em `packages/shared`

Cria os tipos do spec §5 e as duas funções de domínio que o store vai precisar. Inclui a configuração do Vitest no pacote, que hoje não tem runner.

**Files:**
- Create: `packages/shared/src/mouse/capabilities.ts`
- Create: `packages/shared/src/mouse/profile.ts`
- Create: `packages/shared/src/mouse/telemetry.ts`
- Create: `packages/shared/src/mouse/session.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/package.json`
- Test: `packages/shared/src/mouse/session.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `MouseCapabilities`, `MouseButton`, `ParameterCapabilities`, `MouseRenderId`, `MouseProfile`, `DpiStage`, `DpiStageColor`, `ButtonAction`, `MouseParameters`, `MouseTelemetry`, `MouseSession`, `ProfileSlot`, `profileFingerprint(profile: MouseProfile): string`, `isDirty(session: MouseSession): boolean`, `estimateRuntimeHours(caps: MouseCapabilities, pollingRate: number): [number, number] | null`.

- [ ] **Step 1: Adicionar Vitest ao pacote `shared`**

`packages/shared/package.json` — adicionar o script e a devDependency (mesma versão que `apps/web` já usa, `4.1.11`):

```json
{
  "scripts": {
    "build": "tsc --noEmit",
    "lint": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "5.9.3",
    "vitest": "4.1.11"
  }
}
```

Depois: `pnpm install`

- [ ] **Step 2: Escrever o teste que falha**

Create `packages/shared/src/mouse/session.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { MouseProfile, MouseSession } from './session';
import { estimateRuntimeHours, isDirty, profileFingerprint } from './session';
import type { MouseCapabilities } from './capabilities';

const profile: MouseProfile = {
  name: 'Competitive',
  dpi: {
    stages: [{ id: 's1', x: 800, y: 800, color: 'green' }],
    activeStageId: 's1',
    independentXY: false,
  },
  pollingRate: 1000,
  bindings: { left: { kind: 'button', button: 'left' } },
  parameters: {
    motionSync: true,
    straightLineCorrection: false,
    rippleCorrection: false,
    longRangeMode: false,
    debounceMs: 1,
    sleepMinutes: 5,
    lodMm: 1.5,
    sensorRotationDeg: 0,
  },
};

const session = (draft: MouseProfile): MouseSession => ({
  id: 'm1',
  name: 'Mock',
  manufacturer: 'OmniGear',
  capabilities: {} as MouseCapabilities,
  telemetry: { connection: 'dongle', firmware: 'v1' },
  slots: [{ index: 1, profile }],
  activeSlotIndex: 1,
  draft,
});

describe('profileFingerprint', () => {
  it('ignora ordem de chaves, para que dirty não dispare por reordenação', () => {
    const reordered: MouseProfile = {
      ...profile,
      bindings: { left: { button: 'left', kind: 'button' } as never },
    };
    expect(profileFingerprint(reordered)).toBe(profileFingerprint(profile));
  });
});

describe('isDirty', () => {
  it('é falso quando o draft é igual ao slot ativo', () => {
    expect(isDirty(session(structuredClone(profile)))).toBe(false);
  });

  it('é verdadeiro quando um valor do draft diverge', () => {
    const draft = structuredClone(profile);
    draft.pollingRate = 8000;
    expect(isDirty(session(draft))).toBe(true);
  });

  it('é verdadeiro quando o slot ativo está vazio', () => {
    const s = session(structuredClone(profile));
    s.slots = [{ index: 1, profile: null }];
    expect(isDirty(s)).toBe(true);
  });
});

describe('estimateRuntimeHours', () => {
  const caps = {
    pollingRate: { supported: [1000, 8000], runtimeHours: { 1000: [45, 56], 8000: [27, 34] } },
  } as MouseCapabilities;

  it('devolve a faixa declarada para o polling rate', () => {
    expect(estimateRuntimeHours(caps, 8000)).toEqual([27, 34]);
  });

  it('devolve null quando não há dado, em vez de inventar um número', () => {
    expect(estimateRuntimeHours(caps, 4000)).toBeNull();
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @gearhub/shared exec vitest run src/mouse/session.test.ts`
Expected: FAIL — `Failed to resolve import "./session"`

- [ ] **Step 4: Escrever `capabilities.ts`**

Create `packages/shared/src/mouse/capabilities.ts`:

```ts
/** Identifica qual silhueta o registry de render deve desenhar. */
export type MouseRenderId = 'generic-5button' | 'generic-7button';

export interface MouseButton {
  id: string;
  label: string;
  /** Normalizado 0..1 no viewBox do render. */
  hotspot: { x: number; y: number };
  remappable: boolean;
}

export interface ParameterCapabilities {
  motionSync?: boolean;
  straightLineCorrection?: boolean;
  rippleCorrection?: boolean;
  longRangeMode?: boolean;
  debounceMs?: { supported: number[] };
  sleepMinutes?: { supported: number[] };
  lod?: { min: number; max: number; step: number };
  sensorRotation?: { min: number; max: number; step: number };
}

export interface MouseCapabilities {
  dpi: { min: number; max: number; step: number; maxStages: number; independentXY: boolean };
  /**
   * `runtimeHours` mapeia cada polling rate suportado para a faixa de autonomia
   * declarada pelo fabricante. Sem esse dado a tela de Performance não exibe
   * estimativa — ela nunca calcula um número por conta própria.
   */
  pollingRate: { supported: number[]; runtimeHours?: Record<number, [number, number]> };
  buttons: MouseButton[];
  parameters: ParameterCapabilities;
  profiles: { onboardSlots: number };
  battery: boolean;
  renderId: MouseRenderId;
}
```

- [ ] **Step 5: Escrever `profile.ts`**

Create `packages/shared/src/mouse/profile.ts`:

```ts
export type DpiStageColor = 'green' | 'cyan' | 'blue' | 'violet' | 'magenta';

export interface DpiStage {
  id: string;
  x: number;
  y: number;
  color: DpiStageColor;
}

export type ButtonAction =
  | { kind: 'button'; button: 'left' | 'right' | 'middle' | 'back' | 'forward' }
  | { kind: 'dpi'; mode: 'cycle' | 'shift' | 'up' | 'down' }
  | { kind: 'keystroke'; keys: string[] }
  | { kind: 'scroll'; direction: 'up' | 'down' }
  | { kind: 'disabled' }
  /** Reservado. Nenhuma UI no v1. */
  | { kind: 'macro'; macroId: string };

export interface MouseParameters {
  motionSync: boolean;
  straightLineCorrection: boolean;
  rippleCorrection: boolean;
  longRangeMode: boolean;
  debounceMs: number;
  sleepMinutes: number;
  lodMm: number;
  sensorRotationDeg: number;
}

export interface MouseProfile {
  name: string;
  dpi: { stages: DpiStage[]; activeStageId: string; independentXY: boolean };
  pollingRate: number;
  /** buttonId → ação. As chaves vêm de `MouseCapabilities.buttons[].id`. */
  bindings: Record<string, ButtonAction>;
  parameters: MouseParameters;
}
```

- [ ] **Step 6: Escrever `telemetry.ts`**

Create `packages/shared/src/mouse/telemetry.ts`:

```ts
/** Estado vivo do device. Read-only, nunca persiste. */
export interface MouseTelemetry {
  batteryPercent?: number;
  charging?: boolean;
  connection: 'wired' | 'dongle' | 'bluetooth';
  firmware: string;
}
```

- [ ] **Step 7: Escrever `session.ts` com as funções de domínio**

Create `packages/shared/src/mouse/session.ts`:

```ts
import type { MouseCapabilities } from './capabilities';
import type { MouseProfile } from './profile';
import type { MouseTelemetry } from './telemetry';

export type { MouseProfile };

export interface ProfileSlot {
  index: number;
  profile: MouseProfile | null;
}

export interface MouseSession {
  id: string;
  name: string;
  manufacturer: string;
  capabilities: MouseCapabilities;
  telemetry: MouseTelemetry;
  slots: ProfileSlot[];
  activeSlotIndex: number;
  /** O que está na tela e no mouse. */
  draft: MouseProfile;
}

/** Serializa com chaves ordenadas, para que reordenação não conte como mudança. */
function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
}

export function profileFingerprint(profile: MouseProfile): string {
  return stable(profile);
}

/**
 * Derivado, nunca armazenado: um `dirty` guardado em estado vira uma segunda
 * fonte de verdade que sai de sincronia.
 */
export function isDirty(session: MouseSession): boolean {
  const saved = session.slots.find((slot) => slot.index === session.activeSlotIndex)?.profile;
  if (!saved) return true;
  return profileFingerprint(saved) !== profileFingerprint(session.draft);
}

/** `null` quando o fabricante não declarou autonomia para esse polling rate. */
export function estimateRuntimeHours(
  capabilities: MouseCapabilities,
  pollingRate: number,
): [number, number] | null {
  return capabilities.pollingRate.runtimeHours?.[pollingRate] ?? null;
}
```

- [ ] **Step 8: Reexportar em `index.ts`**

Modify `packages/shared/src/index.ts` — **acrescentar** ao final, sem remover nada (os tipos antigos só saem na Task 6):

```ts
export * from './mouse/capabilities';
export * from './mouse/profile';
export * from './mouse/telemetry';
export * from './mouse/session';
```

- [ ] **Step 9: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @gearhub/shared exec vitest run src/mouse/session.test.ts`
Expected: PASS — 6 testes

Depois: `pnpm --filter @gearhub/shared lint`
Expected: sem erros de tipo

- [ ] **Step 10: Commit**

```bash
git add packages/shared
git commit -m "feat: add mouse domain types and profile fingerprint"
```

---

## Task 2: Porta `MouseDriver` e driver mock

A porta fala a linguagem do domínio. Decidir quais relatórios HID enviar é responsabilidade do adapter, nunca da UI.

**Files:**
- Create: `packages/shared/src/mouse/driver.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `apps/web/src/mocks/mice.ts`
- Create: `apps/web/src/hardware/mockDriver.ts`
- Test: `apps/web/src/hardware/mockDriver.test.ts`

**Interfaces:**
- Consumes: tudo da Task 1.
- Produces: `MouseDriver`, `MouseIdentity`, `DeviceDisconnectedError`, `createMockDriver(mouseId: string): MockMouseDriver`, `MockMouseDriver` (a porta mais `simulateDisconnect()`, `simulateReconnect()`, `failNextWrite()`), `mockMice: MockMouse[]`, `MouseSummary`, `listMockMice(): Promise<MouseSummary[]>`.

- [ ] **Step 1: Escrever a porta**

Create `packages/shared/src/mouse/driver.ts`:

```ts
import type { MouseCapabilities } from './capabilities';
import type { MouseProfile } from './profile';
import type { ProfileSlot } from './session';
import type { MouseTelemetry } from './telemetry';

/** Distingue "a escrita falhou" de "o mouse sumiu". A UI reage diferente a cada uma. */
export class DeviceDisconnectedError extends Error {
  constructor(message = 'O mouse foi desconectado') {
    super(message);
    this.name = 'DeviceDisconnectedError';
  }
}

export interface MouseIdentity {
  id: string;
  name: string;
  manufacturer: string;
}

export interface MouseDriver {
  /** Nome e fabricante vêm do driver: não são configuração nem telemetria. */
  readIdentity(): Promise<MouseIdentity>;
  readCapabilities(): Promise<MouseCapabilities>;
  readTelemetry(): Promise<MouseTelemetry>;
  readSlots(): Promise<ProfileSlot[]>;
  /**
   * Recebe o perfil inteiro de propósito: o adapter faz o diff contra o último
   * perfil aplicado e decide o que enviar. A UI nunca sabe o que é um report.
   */
  applyLive(profile: MouseProfile): Promise<void>;
  writeSlot(index: number, profile: MouseProfile): Promise<void>;
  factoryReset(): Promise<void>;
  /** Devolve a função de cancelamento da subscrição. */
  onDisconnect(listener: () => void): () => void;
}
```

Modify `packages/shared/src/index.ts` — acrescentar:

```ts
export * from './mouse/driver';
```

- [ ] **Step 2: Escrever o teste que falha**

Create `apps/web/src/hardware/mockDriver.test.ts`:

```ts
import { DeviceDisconnectedError } from '@gearhub/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockDriver } from './mockDriver';

afterEach(() => vi.useRealTimers());

describe('createMockDriver', () => {
  it('entrega capabilities diferentes por mouse, para provar a regra de capability ausente', async () => {
    const full = await createMockDriver('mock-vanguard').readCapabilities();
    const basic = await createMockDriver('mock-scout').readCapabilities();

    expect(full.parameters.sensorRotation).toBeDefined();
    expect(basic.parameters.sensorRotation).toBeUndefined();
  });

  it('rejeita com DeviceDisconnectedError depois de simular a desconexão', async () => {
    const driver = createMockDriver('mock-vanguard');
    const profile = (await driver.readSlots())[0]!.profile!;

    driver.simulateDisconnect();

    await expect(driver.applyLive(profile)).rejects.toBeInstanceOf(DeviceDisconnectedError);
  });

  it('avisa os assinantes de onDisconnect e para de avisar depois do cancelamento', () => {
    const driver = createMockDriver('mock-vanguard');
    const listener = vi.fn();

    const unsubscribe = driver.onDisconnect(listener);
    driver.simulateDisconnect();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    driver.simulateDisconnect();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @gearhub/web exec vitest run src/hardware/mockDriver.test.ts`
Expected: FAIL — `Failed to resolve import "./mockDriver"`

- [ ] **Step 4: Escrever as fixtures**

Create `apps/web/src/mocks/mice.ts`. Os dois mice existem para provar a regra de capability: o Scout **não** tem rotação de sensor, LOD nem long range, e tem 2 slots em vez de 4.

```ts
import type { MouseCapabilities, MouseProfile, MouseTelemetry } from '@gearhub/shared';

export interface MockMouse {
  id: string;
  name: string;
  manufacturer: string;
  capabilities: MouseCapabilities;
  telemetry: MouseTelemetry;
  slots: (MouseProfile | null)[];
}

const vanguardProfile: MouseProfile = {
  name: 'Competitive',
  dpi: {
    stages: [
      { id: 's1', x: 400, y: 400, color: 'green' },
      { id: 's2', x: 800, y: 800, color: 'cyan' },
      { id: 's3', x: 1600, y: 1600, color: 'blue' },
      { id: 's4', x: 3200, y: 3200, color: 'violet' },
    ],
    activeStageId: 's2',
    independentXY: false,
  },
  pollingRate: 1000,
  bindings: {
    left: { kind: 'button', button: 'left' },
    right: { kind: 'button', button: 'right' },
    middle: { kind: 'button', button: 'middle' },
    back: { kind: 'button', button: 'back' },
    forward: { kind: 'dpi', mode: 'cycle' },
  },
  parameters: {
    motionSync: true,
    straightLineCorrection: false,
    rippleCorrection: false,
    longRangeMode: false,
    debounceMs: 1,
    sleepMinutes: 5,
    lodMm: 1.5,
    sensorRotationDeg: 0,
  },
};

const scoutProfile: MouseProfile = {
  name: 'Daily',
  dpi: {
    stages: [
      { id: 's1', x: 800, y: 800, color: 'green' },
      { id: 's2', x: 1600, y: 1600, color: 'magenta' },
    ],
    activeStageId: 's1',
    independentXY: false,
  },
  pollingRate: 1000,
  bindings: {
    left: { kind: 'button', button: 'left' },
    right: { kind: 'button', button: 'right' },
    middle: { kind: 'button', button: 'middle' },
  },
  parameters: {
    motionSync: false,
    straightLineCorrection: false,
    rippleCorrection: false,
    longRangeMode: false,
    debounceMs: 2,
    sleepMinutes: 10,
    lodMm: 2,
    sensorRotationDeg: 0,
  },
};

export const mockMice: MockMouse[] = [
  {
    id: 'mock-vanguard',
    name: 'Vanguard 8K',
    manufacturer: 'OmniGear',
    capabilities: {
      dpi: { min: 100, max: 26_000, step: 50, maxStages: 5, independentXY: true },
      pollingRate: {
        supported: [125, 500, 1000, 4000, 8000],
        runtimeHours: { 125: [70, 90], 500: [58, 70], 1000: [45, 56], 4000: [32, 40], 8000: [27, 34] },
      },
      buttons: [
        { id: 'left', label: 'Botão esquerdo', hotspot: { x: 0.27, y: 0.19 }, remappable: false },
        { id: 'right', label: 'Botão direito', hotspot: { x: 0.73, y: 0.19 }, remappable: true },
        { id: 'middle', label: 'Botão do meio', hotspot: { x: 0.5, y: 0.18 }, remappable: true },
        { id: 'back', label: 'Lateral traseiro', hotspot: { x: 0.12, y: 0.38 }, remappable: true },
        { id: 'forward', label: 'Lateral dianteiro', hotspot: { x: 0.12, y: 0.47 }, remappable: true },
      ],
      parameters: {
        motionSync: true,
        straightLineCorrection: true,
        rippleCorrection: true,
        longRangeMode: true,
        debounceMs: { supported: [0, 1, 2, 4, 8, 15, 20] },
        sleepMinutes: { supported: [1, 2, 3, 5, 20, 30] },
        lod: { min: 0.7, max: 2, step: 0.1 },
        sensorRotation: { min: -30, max: 30, step: 1 },
      },
      profiles: { onboardSlots: 4 },
      battery: true,
      renderId: 'generic-5button',
    },
    telemetry: { batteryPercent: 82, charging: false, connection: 'dongle', firmware: 'v1.4.2' },
    slots: [vanguardProfile, null, null, null],
  },
  {
    id: 'mock-scout',
    name: 'Scout Wired',
    manufacturer: 'OmniGear',
    capabilities: {
      dpi: { min: 200, max: 12_000, step: 100, maxStages: 3, independentXY: false },
      pollingRate: { supported: [125, 500, 1000] },
      buttons: [
        { id: 'left', label: 'Botão esquerdo', hotspot: { x: 0.27, y: 0.19 }, remappable: false },
        { id: 'right', label: 'Botão direito', hotspot: { x: 0.73, y: 0.19 }, remappable: true },
        { id: 'middle', label: 'Botão do meio', hotspot: { x: 0.5, y: 0.18 }, remappable: true },
      ],
      // Sem sensorRotation, sem lod, sem longRangeMode: os controles somem da tela.
      parameters: {
        motionSync: true,
        debounceMs: { supported: [0, 2, 4, 8] },
      },
      profiles: { onboardSlots: 2 },
      battery: false,
      renderId: 'generic-5button',
    },
    telemetry: { connection: 'wired', firmware: 'v1.0.0' },
    slots: [scoutProfile, null],
  },
];
```

- [ ] **Step 5: Escrever o driver mock**

Create `apps/web/src/hardware/mockDriver.ts`. O `latency` e o `failNext` existem porque a §8 do spec só pode ser construída se os caminhos de falha forem alcançáveis.

```ts
import {
  DeviceDisconnectedError,
  type MouseCapabilities,
  type MouseDriver,
  type MouseProfile,
  type MouseTelemetry,
  type ProfileSlot,
} from '@gearhub/shared';
import { mockMice, type MockMouse } from '../mocks/mice';

export interface MouseSummary {
  id: string;
  name: string;
  manufacturer: string;
  batteryPercent?: number;
  connection: MouseTelemetry['connection'];
}

export interface MockMouseDriver extends MouseDriver {
  simulateDisconnect(): void;
  simulateReconnect(): void;
  failNextWrite(): void;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function listMockMice(): Promise<MouseSummary[]> {
  await wait(400);
  return mockMice.map((mouse) => ({
    id: mouse.id,
    name: mouse.name,
    manufacturer: mouse.manufacturer,
    batteryPercent: mouse.telemetry.batteryPercent,
    connection: mouse.telemetry.connection,
  }));
}

export function createMockDriver(mouseId: string): MockMouseDriver {
  const mouse: MockMouse | undefined = mockMice.find((candidate) => candidate.id === mouseId);
  if (!mouse) throw new Error(`Mouse mock desconhecido: ${mouseId}`);

  const state = structuredClone(mouse);
  const listeners = new Set<() => void>();
  let connected = true;
  let failNext = false;

  function guard(): void {
    if (!connected) throw new DeviceDisconnectedError();
    if (failNext) {
      failNext = false;
      throw new Error('A gravação falhou');
    }
  }

  return {
    async readIdentity() {
      await wait(40);
      return { id: state.id, name: state.name, manufacturer: state.manufacturer };
    },
    async readCapabilities(): Promise<MouseCapabilities> {
      await wait(120);
      return structuredClone(state.capabilities);
    },
    async readTelemetry(): Promise<MouseTelemetry> {
      await wait(80);
      return structuredClone(state.telemetry);
    },
    async readSlots(): Promise<ProfileSlot[]> {
      await wait(120);
      return state.slots.map((profile, index) => ({
        index: index + 1,
        profile: profile ? structuredClone(profile) : null,
      }));
    },
    async applyLive(profile: MouseProfile): Promise<void> {
      await wait(60);
      guard();
      void profile;
    },
    async writeSlot(index: number, profile: MouseProfile): Promise<void> {
      await wait(240);
      guard();
      state.slots[index - 1] = structuredClone(profile);
    },
    async factoryReset(): Promise<void> {
      await wait(400);
      guard();
      state.slots = state.slots.map(() => null);
    },
    onDisconnect(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    simulateDisconnect(): void {
      connected = false;
      for (const listener of listeners) listener();
    },
    simulateReconnect(): void {
      connected = true;
    },
    failNextWrite(): void {
      failNext = true;
    },
  };
}
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @gearhub/web exec vitest run src/hardware/mockDriver.test.ts`
Expected: PASS — 3 testes

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/mouse/driver.ts packages/shared/src/index.ts apps/web/src/mocks/mice.ts apps/web/src/hardware/mockDriver.ts apps/web/src/hardware/mockDriver.test.ts
git commit -m "feat: add mouse driver port and mock implementation"
```

---

## Task 3: Store da sessão

Concentra as decisões de aplicação: throttle do arraste, reversão em falha, preservação do draft na desconexão.

**Files:**
- Create: `apps/web/src/store/mouseStore.ts`
- Test: `apps/web/src/store/mouseStore.test.ts`

**Interfaces:**
- Consumes: Task 1 e Task 2.
- Produces: `useMouseStore` com o estado `{ session, driver, status, applying, feedback, disconnected }` e as ações `openMouse(id)`, `closeMouse()`, `patchDraft(recipe)`, `saveToSlot(index)`, `selectSlot(index)`, `factoryReset()`.

- [ ] **Step 1: Escrever o teste que falha**

Create `apps/web/src/store/mouseStore.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockDriver } from '../hardware/mockDriver';
import { useMouseStore } from './mouseStore';

const initial = useMouseStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  useMouseStore.setState(initial, true);
});
afterEach(() => vi.useRealTimers());

async function open(id = 'mock-vanguard') {
  const promise = useMouseStore.getState().openMouse(id);
  await vi.runAllTimersAsync();
  await promise;
}

describe('mouseStore', () => {
  it('agrupa edições rápidas numa única aplicação ao device', async () => {
    await open();
    const spy = vi.spyOn(useMouseStore.getState().driver!, 'applyLive');

    for (const rate of [125, 500, 1000, 4000]) {
      useMouseStore.getState().patchDraft((draft) => {
        draft.pollingRate = rate;
      });
    }
    await vi.runAllTimersAsync();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0].pollingRate).toBe(4000);
  });

  it('reverte o draft quando applyLive falha', async () => {
    await open();
    const before = useMouseStore.getState().session!.draft.pollingRate;
    vi.spyOn(useMouseStore.getState().driver!, 'applyLive').mockRejectedValue(new Error('nope'));

    useMouseStore.getState().patchDraft((draft) => {
      draft.pollingRate = 8000;
    });
    await vi.runAllTimersAsync();

    expect(useMouseStore.getState().session!.draft.pollingRate).toBe(before);
    expect(useMouseStore.getState().feedback?.type).toBe('error');
  });

  it('preserva o draft na desconexão e reaplica ao reconectar', async () => {
    await open();
    useMouseStore.getState().patchDraft((draft) => {
      draft.pollingRate = 8000;
    });
    await vi.runAllTimersAsync();

    const driver = useMouseStore.getState().driver as ReturnType<typeof createMockDriver>;
    driver.simulateDisconnect();
    expect(useMouseStore.getState().disconnected).toBe(true);
    expect(useMouseStore.getState().session!.draft.pollingRate).toBe(8000);

    driver.simulateReconnect();
    const spy = vi.spyOn(driver, 'applyLive');
    const promise = useMouseStore.getState().reconnect();
    await vi.runAllTimersAsync();
    await promise;

    expect(useMouseStore.getState().disconnected).toBe(false);
    expect(spy.mock.calls[0]![0].pollingRate).toBe(8000);
  });

  it('limpa o dirty ao gravar no slot', async () => {
    await open();
    useMouseStore.getState().patchDraft((draft) => {
      draft.pollingRate = 8000;
    });
    await vi.runAllTimersAsync();

    const promise = useMouseStore.getState().saveToSlot(1);
    await vi.runAllTimersAsync();
    await promise;

    const { session } = useMouseStore.getState();
    expect(session!.slots[0]!.profile!.pollingRate).toBe(8000);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @gearhub/web exec vitest run src/store/mouseStore.test.ts`
Expected: FAIL — `Failed to resolve import "./mouseStore"`

- [ ] **Step 3: Escrever o store**

Create `apps/web/src/store/mouseStore.ts`:

```ts
import { DeviceDisconnectedError, type MouseProfile, type MouseSession } from '@gearhub/shared';
import { create } from 'zustand';
import { createMockDriver, type MockMouseDriver } from '../hardware/mockDriver';

export type Feedback = { type: 'success' | 'error'; title: string; message: string };

/** Janela de agrupamento do arraste. Um gesto não pode virar quarenta escritas. */
const APPLY_THROTTLE_MS = 100;

interface MouseStore {
  session: MouseSession | null;
  driver: MockMouseDriver | null;
  loading: boolean;
  applying: boolean;
  disconnected: boolean;
  feedback: Feedback | null;
  openMouse(id: string): Promise<void>;
  closeMouse(): void;
  patchDraft(recipe: (draft: MouseProfile) => void): void;
  saveToSlot(index: number): Promise<void>;
  selectSlot(index: number): Promise<void>;
  reconnect(): Promise<void>;
  factoryReset(): Promise<void>;
  dismissFeedback(): void;
}

let applyTimer: ReturnType<typeof setTimeout> | null = null;
let lastConfirmed: MouseProfile | null = null;

export const useMouseStore = create<MouseStore>((set, get) => {
  async function flushApply(): Promise<void> {
    const { session, driver } = get();
    if (!session || !driver) return;
    const attempted = structuredClone(session.draft);
    set({ applying: true });
    try {
      await driver.applyLive(attempted);
      lastConfirmed = attempted;
      set({ applying: false });
    } catch (error) {
      const revert = lastConfirmed ? structuredClone(lastConfirmed) : attempted;
      set((state) => ({
        applying: false,
        disconnected: error instanceof DeviceDisconnectedError ? true : state.disconnected,
        session: state.session ? { ...state.session, draft: revert } : null,
        feedback:
          error instanceof DeviceDisconnectedError
            ? null
            : { type: 'error', title: 'Não foi aplicado', message: 'A mudança voltou ao valor anterior.' },
      }));
    }
  }

  function scheduleApply(): void {
    if (applyTimer) clearTimeout(applyTimer);
    applyTimer = setTimeout(() => {
      applyTimer = null;
      void flushApply();
    }, APPLY_THROTTLE_MS);
  }

  return {
    session: null,
    driver: null,
    loading: false,
    applying: false,
    disconnected: false,
    feedback: null,

    openMouse: async (id) => {
      set({ loading: true, feedback: null });
      const driver = createMockDriver(id);
      const [identity, capabilities, telemetry, slots] = await Promise.all([
        driver.readIdentity(),
        driver.readCapabilities(),
        driver.readTelemetry(),
        driver.readSlots(),
      ]);
      const activeSlot = slots.find((slot) => slot.profile) ?? slots[0]!;
      const draft = structuredClone(activeSlot.profile ?? emptyProfile());
      lastConfirmed = structuredClone(draft);
      driver.onDisconnect(() => set({ disconnected: true }));
      set({
        driver,
        loading: false,
        disconnected: false,
        session: {
          id: identity.id,
          name: identity.name,
          manufacturer: identity.manufacturer,
          capabilities,
          telemetry,
          slots,
          activeSlotIndex: activeSlot.index,
          draft,
        },
      });
    },

    closeMouse: () => {
      if (applyTimer) clearTimeout(applyTimer);
      applyTimer = null;
      lastConfirmed = null;
      set({ session: null, driver: null, disconnected: false, feedback: null });
    },

    patchDraft: (recipe) => {
      const { session } = get();
      if (!session) return;
      const draft = structuredClone(session.draft);
      recipe(draft);
      set({ session: { ...session, draft } });
      scheduleApply();
    },

    saveToSlot: async (index) => {
      const { session, driver } = get();
      if (!session || !driver) return;
      try {
        await driver.writeSlot(index, session.draft);
        set({
          session: {
            ...session,
            activeSlotIndex: index,
            slots: session.slots.map((slot) =>
              slot.index === index ? { ...slot, profile: structuredClone(session.draft) } : slot,
            ),
          },
          feedback: { type: 'success', title: 'Salvo', message: `Perfil gravado no slot ${index}.` },
        });
      } catch {
        set({
          feedback: { type: 'error', title: 'Não foi salvo', message: 'Tente gravar novamente.' },
        });
      }
    },

    selectSlot: async (index) => {
      const { session } = get();
      if (!session) return;
      const profile = session.slots.find((slot) => slot.index === index)?.profile;
      if (!profile) return;
      const draft = structuredClone(profile);
      set({ session: { ...session, activeSlotIndex: index, draft } });
      scheduleApply();
    },

    reconnect: async () => {
      const { session, driver } = get();
      if (!session || !driver) return;
      set({ disconnected: false });
      await flushApply();
    },

    factoryReset: async () => {
      const { driver } = get();
      if (!driver) return;
      await driver.factoryReset();
      const { session } = get();
      if (!session) return;
      set({
        session: { ...session, slots: session.slots.map((slot) => ({ ...slot, profile: null })) },
        feedback: { type: 'success', title: 'Restaurado', message: 'Os slots do mouse foram limpos.' },
      });
    },

    dismissFeedback: () => set({ feedback: null }),
  };
});

function emptyProfile(): MouseProfile {
  return {
    name: 'Novo perfil',
    dpi: { stages: [{ id: 's1', x: 800, y: 800, color: 'green' }], activeStageId: 's1', independentXY: false },
    pollingRate: 1000,
    bindings: {},
    parameters: {
      motionSync: false,
      straightLineCorrection: false,
      rippleCorrection: false,
      longRangeMode: false,
      debounceMs: 0,
      sleepMinutes: 5,
      lodMm: 1,
      sensorRotationDeg: 0,
    },
  };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @gearhub/web exec vitest run src/store/mouseStore.test.ts`
Expected: PASS — 4 testes

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/store/mouseStore.ts apps/web/src/store/mouseStore.test.ts
git commit -m "feat: add mouse session store with throttled live apply"
```

---

## Task 4: Camada de tokens em `packages/ui`

Os tokens saem do app e passam a morar no design system. Hoje `packages/ui` depende do app para existir visualmente, o que inverte a dependência.

Os **valores** desta task são provisórios e explicitamente marcados como tal: a Task 14 os substitui pelos valores medidos por `interfaces:better-colors`. O que esta task fixa são os **papéis**.

**Files:**
- Create: `packages/ui/src/styles/tokens.css`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: nada.
- Produces: os tokens semânticos `--color-bg-canvas`, `--color-bg-surface`, `--color-bg-raised`, `--color-bg-hover`, `--color-border-subtle`, `--color-border-strong`, `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-fill-solid`, `--color-fill-solid-text`, `--color-danger`, `--color-stage-green|cyan|blue|violet|magenta`, e as classes utilitárias Tailwind correspondentes.

- [ ] **Step 1: Escrever os tokens**

Create `packages/ui/src/styles/tokens.css`:

```css
/*
 * Dois níveis. Primitivos nomeados por valor, nunca referenciados por componente.
 * Semânticos nomeados por papel, o único nível que componente usa.
 *
 * VALORES PROVISÓRIOS: substituídos na Task 14 pela paleta medida em OKLCH e
 * emitida em HSL por `interfaces:better-colors`. Os NOMES são definitivos.
 */
:root {
  /* primitivos */
  --gray-950: 60 3% 4%;
  --gray-900: 60 3% 8%;
  --gray-850: 60 3% 11%;
  --gray-800: 60 3% 14%;
  --gray-700: 60 3% 17%;
  --gray-600: 60 2% 24%;
  --gray-400: 60 2% 54%;
  --gray-300: 60 3% 72%;
  --gray-100: 60 5% 95%;
  --red-400: 0 79% 71%;
  --stage-green-value: 145 63% 60%;
  --stage-cyan-value: 187 68% 60%;
  --stage-blue-value: 220 90% 74%;
  --stage-violet-value: 267 85% 77%;
  --stage-magenta-value: 315 82% 72%;

  /* semânticos — superfícies */
  --color-bg-canvas: var(--gray-950);
  --color-bg-surface: var(--gray-900);
  --color-bg-raised: var(--gray-850);
  --color-bg-hover: var(--gray-800);

  /* semânticos — bordas */
  --color-border-subtle: var(--gray-700);
  --color-border-strong: var(--gray-600);

  /* semânticos — texto */
  --color-text-primary: var(--gray-100);
  --color-text-secondary: var(--gray-300);
  --color-text-muted: var(--gray-400);

  /* semânticos — ênfase. Sem acento cromático: primário é inversão de contraste. */
  --color-fill-solid: var(--gray-100);
  --color-fill-solid-text: var(--gray-950);

  /* semânticos — perigo. Único vermelho do app. */
  --color-danger: var(--red-400);

  /* semânticos — estágios de DPI. Única cor de identidade do app. */
  --color-stage-green: var(--stage-green-value);
  --color-stage-cyan: var(--stage-cyan-value);
  --color-stage-blue: var(--stage-blue-value);
  --color-stage-violet: var(--stage-violet-value);
  --color-stage-magenta: var(--stage-magenta-value);
}

@theme inline {
  --color-bg-canvas: hsl(var(--color-bg-canvas));
  --color-bg-surface: hsl(var(--color-bg-surface));
  --color-bg-raised: hsl(var(--color-bg-raised));
  --color-bg-hover: hsl(var(--color-bg-hover));
  --color-border-subtle: hsl(var(--color-border-subtle));
  --color-border-strong: hsl(var(--color-border-strong));
  --color-text-primary: hsl(var(--color-text-primary));
  --color-text-secondary: hsl(var(--color-text-secondary));
  --color-text-muted: hsl(var(--color-text-muted));
  --color-fill-solid: hsl(var(--color-fill-solid));
  --color-fill-solid-text: hsl(var(--color-fill-solid-text));
  --color-danger: hsl(var(--color-danger));
  --color-stage-green: hsl(var(--color-stage-green));
  --color-stage-cyan: hsl(var(--color-stage-cyan));
  --color-stage-blue: hsl(var(--color-stage-blue));
  --color-stage-violet: hsl(var(--color-stage-violet));
  --color-stage-magenta: hsl(var(--color-stage-magenta));
  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
}
```

- [ ] **Step 2: Importar os tokens no app, sem remover nada ainda**

Os componentes antigos (`Sidebar`, `DevicePanel`, `SettingRow`) só somem na Task 6, e até lá as classes `.sidebar`, `.settings-group`, `.setting-row` e `.toggle` continuam sendo usadas. Apagá-las aqui deixaria o app sem estilo por várias tarefas.

Modify `apps/web/src/styles.css` — no topo, **acrescentar** o import e **remover apenas** os blocos `:root { … }`, `.dark { … }` e `@theme inline { … }`, que os tokens novos substituem. Todo o resto do arquivo fica intacto por enquanto.

```css
@import 'tailwindcss';
@import '@gearhub/ui/styles/tokens.css';
@source "../../../packages/ui/src";

/* Todo valor de configuração muda enquanto o usuário arrasta. Com numerais
   proporcionais o número muda de largura e o layout treme. */
.tnum {
  font-variant-numeric: tabular-nums;
}

/* … o CSS de componente existente permanece até a Task 6 … */
```

- [ ] **Step 3: Expor o CSS no `exports` do pacote**

Modify `packages/ui/package.json` — acrescentar ao bloco `exports`:

```json
"./styles/*": "./src/styles/*"
```

- [ ] **Step 4: Verificar que o app ainda compila**

Run: `pnpm --filter @gearhub/web build`
Expected: PASS. Se o Vite não resolver `@gearhub/ui/styles/tokens.css`, o `exports` do Step 3 não foi salvo.

A UI antiga vai aparecer com as cores trocadas neste ponto — ela referenciava `--primary` e `--accent`, que deixaram de existir. Isso é esperado e dura até a Task 6, que remove essa UI.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/styles/tokens.css packages/ui/package.json apps/web/src/styles.css
git commit -m "feat: move design tokens into the ui package"
```

---

## Task 5: Primitivos de UI via shadcn

Seguindo a skill `shadcn-modular-ui` do repositório: inspecionar antes de rodar, adicionar só o necessário, não usar `--overwrite` nem `--all`.

**Files:**
- Create: `packages/ui/src/components/slider.tsx`
- Create: `packages/ui/src/components/switch.tsx`
- Create: `packages/ui/src/components/dialog.tsx`
- Create: `packages/ui/src/components/tooltip.tsx`
- Create: `packages/ui/src/components/segmented.tsx`

**Interfaces:**
- Consumes: Task 4.
- Produces: `Slider`, `Switch`, `Dialog` + subcomponentes, `Tooltip` + subcomponentes, e `Segmented` (composto próprio, não shadcn).

- [ ] **Step 1: Inspecionar a configuração existente**

```bash
pnpm dlx shadcn@latest info
```

Confirmar que o `components.json` de `packages/ui` aponta para `src/components` e usa o alias do pacote. Não rodar `init` — já está configurado.

- [ ] **Step 2: Adicionar os primitivos**

```bash
cd packages/ui && pnpm dlx shadcn@latest add slider switch dialog tooltip
```

Revisar o diff antes de seguir. Se algum arquivo existente for tocado, parar e reportar.

- [ ] **Step 3: Escrever o composto `Segmented`**

Não vem do shadcn: é um radiogroup de opções numéricas, usado por polling rate e debounce. Sem acento cromático, o selecionado é inversão de contraste.

Create `packages/ui/src/components/segmented.tsx`:

```tsx
import { cn } from '../lib/utils';

export function Segmented<T extends number | string>({
  label,
  options,
  value,
  format = String,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  format?: (option: T) => string;
  onChange(option: T): void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {options.map((option) => {
        const selected = option === value;
        return (
          <button
            key={String(option)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option)}
            className={cn(
              'tnum h-9 flex-1 rounded-md border text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fill-solid',
              selected
                ? 'border-fill-solid bg-fill-solid font-semibold text-fill-solid-text'
                : 'border-border-subtle bg-bg-surface text-text-muted hover:bg-bg-hover hover:text-text-primary',
            )}
          >
            {format(option)}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Verificar tipos**

Run: `pnpm --filter @gearhub/ui lint`
Expected: sem erros

- [ ] **Step 5: Commit**

```bash
git add packages/ui
git commit -m "feat: add slider, switch, dialog, tooltip and segmented primitives"
```

---

## Task 6: Shell, registry de seções, home e Performance — o ponto de corte

Esta é a task que remove a UI e os tipos antigos. Ela entrega uma fatia vertical completa: listar mice → entrar num device → mudar o polling rate → ver a estimativa de bateria mudar → salvar no slot.

O `sectionRegistry` existe para que o rail nunca mostre um item de menu sem tela atrás. As tasks 7–12 acrescentam uma entrada cada.

**Files:**
- Create: `apps/web/src/app/AppShell.tsx`
- Create: `apps/web/src/app/DeviceWorkspace.tsx`
- Create: `apps/web/src/app/DirtyBar.tsx`
- Create: `apps/web/src/features/registry.ts`
- Create: `apps/web/src/features/devices/DeviceGallery.tsx`
- Create: `apps/web/src/features/performance/PerformanceSection.tsx`
- Modify: `apps/web/src/App.tsx`
- Delete: `apps/web/src/components/DevicePanel.tsx`, `Sidebar.tsx`, `SettingRow.tsx`, `SegmentedControl.tsx`, `DeviceIcon.tsx`
- Delete: `apps/web/src/store/deviceStore.ts`, `apps/web/src/hardware/deviceDiscovery.ts`, `apps/web/src/hardware/deviceDiscovery.test.ts`, `apps/web/src/hardware/ConnectedDevice.ts`, `apps/web/src/mocks/peripherals.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `apps/web/src/features/performance/PerformanceSection.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: `sectionRegistry: SectionDefinition[]`, `SectionDefinition = { id: string; label: string; Component: () => JSX.Element }`, `AppShell`.

- [ ] **Step 1: Instalar a infraestrutura de teste de componente**

Nenhum teste de componente existe hoje. A regra "capability ausente ⇒ controle ausente" é o coração do design e vai regredir se não for testada.

```bash
pnpm --filter @gearhub/web add -D @testing-library/react@16 @testing-library/jest-dom@6 jsdom@25
```

Modify `apps/web/vite.config.ts`:

```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

Create `apps/web/src/test-setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 2: Escrever o teste que falha**

Create `apps/web/src/features/performance/PerformanceSection.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMouseStore } from '../../store/mouseStore';
import { PerformanceSection } from './PerformanceSection';

const initial = useMouseStore.getState();
afterEach(() => {
  useMouseStore.setState(initial, true);
  vi.useRealTimers();
});

async function open(id: string) {
  vi.useFakeTimers();
  const promise = useMouseStore.getState().openMouse(id);
  await vi.runAllTimersAsync();
  await promise;
  vi.useRealTimers();
}

describe('PerformanceSection', () => {
  it('mostra a estimativa de autonomia do polling rate ativo', async () => {
    await open('mock-vanguard');
    render(<PerformanceSection />);
    expect(screen.getByText('45–56 h')).toBeInTheDocument();
  });

  it('omite a estimativa quando o mouse não declara autonomia', async () => {
    await open('mock-scout');
    render(<PerformanceSection />);
    expect(screen.queryByText(/Autonomia estimada/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @gearhub/web exec vitest run src/features/performance/PerformanceSection.test.tsx`
Expected: FAIL — `Failed to resolve import "./PerformanceSection"`

- [ ] **Step 4: Escrever a seção de Performance**

Create `apps/web/src/features/performance/PerformanceSection.tsx`:

```tsx
import { estimateRuntimeHours } from '@gearhub/shared';
import { Segmented } from '@gearhub/ui/components/segmented';
import { useMouseStore } from '../../store/mouseStore';

const formatRate = (rate: number) => (rate >= 1000 ? `${rate / 1000}K` : String(rate));

export function PerformanceSection() {
  const session = useMouseStore((state) => state.session);
  const patchDraft = useMouseStore((state) => state.patchDraft);
  if (!session) return null;

  const { capabilities, draft } = session;
  const runtime = estimateRuntimeHours(capabilities, draft.pollingRate);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 p-8">
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
          Taxa de reporte
        </h2>
        <div className="mt-3">
          <Segmented
            label="Taxa de reporte"
            options={capabilities.pollingRate.supported}
            value={draft.pollingRate}
            format={formatRate}
            onChange={(rate) =>
              patchDraft((profile) => {
                profile.pollingRate = rate;
              })
            }
          />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-text-muted">
          <span>Trabalho</span>
          <span>Competitivo</span>
        </div>
      </section>

      {runtime && (
        <section className="rounded-xl border border-border-subtle bg-bg-surface p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
            Autonomia estimada
          </h2>
          <p className="tnum mt-2 text-3xl tracking-tight text-text-primary">
            {runtime[0]}–{runtime[1]} h
          </p>
          <p className="mt-2 text-[13px] text-text-muted">
            Com a bateria cheia, na taxa de reporte selecionada.
          </p>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Escrever o registry**

Create `apps/web/src/features/registry.ts`. Cada task de tela acrescenta **uma** entrada. O rail renderiza este array, então nunca existe item sem tela.

```ts
import type { ComponentType } from 'react';
import { PerformanceSection } from './performance/PerformanceSection';

export interface SectionDefinition {
  id: string;
  label: string;
  Component: ComponentType;
}

export const sectionRegistry: SectionDefinition[] = [
  { id: 'performance', label: 'Desempenho', Component: PerformanceSection },
];
```

- [ ] **Step 6: Escrever a galeria de devices**

Create `apps/web/src/features/devices/DeviceGallery.tsx`:

```tsx
import { Button } from '@gearhub/ui/components/button';
import { useEffect, useState } from 'react';
import { listMockMice, type MouseSummary } from '../../hardware/mockDriver';
import { useMouseStore } from '../../store/mouseStore';

export function DeviceGallery() {
  const [mice, setMice] = useState<MouseSummary[] | null>(null);
  const openMouse = useMouseStore((state) => state.openMouse);

  useEffect(() => {
    void listMockMice().then(setMice);
  }, []);

  if (!mice) {
    return <p className="p-12 text-center text-sm text-text-muted">Procurando dispositivos…</p>;
  }

  if (mice.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-xl font-semibold text-text-primary">Conecte um mouse</h1>
        <p className="max-w-sm text-sm text-text-muted">
          Ligue o receptor 2.4G ou o cabo. Conexões Bluetooth não são reconhecidas.
        </p>
        <Button onClick={() => window.location.reload()}>Procurar de novo</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4 p-8 sm:grid-cols-2">
      {mice.map((mouse) => (
        <button
          key={mouse.id}
          type="button"
          onClick={() => void openMouse(mouse.id)}
          className="rounded-xl border border-border-subtle bg-bg-surface p-5 text-left transition-colors hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fill-solid"
        >
          <span className="block text-base font-semibold text-text-primary">{mouse.name}</span>
          <span className="tnum mt-1 block text-xs text-text-muted">
            {mouse.manufacturer} · {mouse.connection}
            {mouse.batteryPercent !== undefined && ` · ${mouse.batteryPercent}%`}
          </span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Escrever a barra de dirty**

Create `apps/web/src/app/DirtyBar.tsx`:

```tsx
import { isDirty } from '@gearhub/shared';
import { Button } from '@gearhub/ui/components/button';
import { useMouseStore } from '../store/mouseStore';

export function DirtyBar() {
  const session = useMouseStore((state) => state.session);
  const saveToSlot = useMouseStore((state) => state.saveToSlot);
  if (!session || !isDirty(session)) return null;

  return (
    <div className="flex items-center justify-between border-t border-border-subtle bg-bg-surface px-6 py-3">
      <span className="text-[13px] text-text-muted">
        Alterações não salvas no slot {session.activeSlotIndex}
      </span>
      <Button onClick={() => void saveToSlot(session.activeSlotIndex)}>Salvar no slot</Button>
    </div>
  );
}
```

- [ ] **Step 8: Escrever o workspace e o shell**

Create `apps/web/src/app/DeviceWorkspace.tsx`:

```tsx
import { useState } from 'react';
import { sectionRegistry } from '../features/registry';
import { useMouseStore } from '../store/mouseStore';
import { DirtyBar } from './DirtyBar';

export function DeviceWorkspace() {
  const session = useMouseStore((state) => state.session)!;
  const applying = useMouseStore((state) => state.applying);
  const disconnected = useMouseStore((state) => state.disconnected);
  const closeMouse = useMouseStore((state) => state.closeMouse);
  const reconnect = useMouseStore((state) => state.reconnect);
  const [sectionId, setSectionId] = useState(sectionRegistry[0]!.id);

  const section = sectionRegistry.find((entry) => entry.id === sectionId) ?? sectionRegistry[0]!;

  return (
    <div className="grid min-h-screen grid-cols-[220px_1fr]">
      <aside className="border-r border-border-subtle bg-bg-surface">
        <button
          type="button"
          onClick={closeMouse}
          className="flex h-14 w-full items-center px-5 text-sm text-text-muted hover:text-text-primary"
        >
          ← Dispositivos
        </button>
        <nav aria-label="Seções" className="p-2">
          {sectionRegistry.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setSectionId(entry.id)}
              aria-current={entry.id === sectionId ? 'page' : undefined}
              className={
                entry.id === sectionId
                  ? 'w-full rounded-md bg-fill-solid px-3 py-2 text-left text-sm font-semibold text-fill-solid-text'
                  : 'w-full rounded-md px-3 py-2 text-left text-sm text-text-muted hover:bg-bg-hover hover:text-text-primary'
              }
            >
              {entry.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex min-h-screen flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border-subtle px-6 text-sm">
          <span
            aria-hidden
            className={`size-1.5 rounded-full ${disconnected ? 'bg-transparent ring-1 ring-text-muted' : 'bg-text-primary'}`}
          />
          <span className="font-medium text-text-primary">{session.name}</span>
          <span className="tnum text-xs text-text-muted">
            {session.telemetry.connection}
            {session.telemetry.batteryPercent !== undefined &&
              ` · ${session.telemetry.batteryPercent}%`}
          </span>
          {applying && <span className="ml-auto text-xs text-text-muted">aplicando…</span>}
        </header>

        {disconnected && (
          <div className="flex items-center justify-between bg-bg-raised px-6 py-3 text-[13px]">
            <span className="text-text-secondary">
              O mouse desconectou. Suas alterações foram preservadas.
            </span>
            <button type="button" onClick={() => void reconnect()} className="text-text-primary underline">
              Reaplicar
            </button>
          </div>
        )}

        <div className="flex-1">
          <section.Component />
        </div>
        <DirtyBar />
      </main>
    </div>
  );
}
```

Create `apps/web/src/app/AppShell.tsx`:

```tsx
import { useMouseStore } from '../store/mouseStore';
import { DeviceGallery } from '../features/devices/DeviceGallery';
import { DeviceWorkspace } from './DeviceWorkspace';

export function AppShell() {
  const session = useMouseStore((state) => state.session);
  return session ? <DeviceWorkspace /> : <DeviceGallery />;
}
```

- [ ] **Step 9: Substituir `App.tsx`**

Modify `apps/web/src/App.tsx` — conteúdo inteiro:

```tsx
import { AppShell } from './app/AppShell';

export function App() {
  return <AppShell />;
}
```

- [ ] **Step 10: Remover a UI e os tipos antigos**

```bash
git rm apps/web/src/components/DevicePanel.tsx apps/web/src/components/Sidebar.tsx \
       apps/web/src/components/SettingRow.tsx apps/web/src/components/SegmentedControl.tsx \
       apps/web/src/components/DeviceIcon.tsx \
       apps/web/src/store/deviceStore.ts \
       apps/web/src/hardware/deviceDiscovery.ts apps/web/src/hardware/deviceDiscovery.test.ts \
       apps/web/src/hardware/ConnectedDevice.ts apps/web/src/mocks/peripherals.ts
```

Modify `packages/shared/src/index.ts` — remover `PeripheralType`, `DeviceCapabilities`, `DeviceSettings` e `ConnectedPeripheral`. Manter `HidCommand` (usado por `WebHidTransport.ts`, que permanece). O arquivo passa a ser apenas:

```ts
export interface HidCommand {
  reportId: number;
  data: Uint8Array;
}

export * from './mouse/capabilities';
export * from './mouse/profile';
export * from './mouse/telemetry';
export * from './mouse/session';
export * from './mouse/driver';
```

`BrandMark.tsx` permanece.

- [ ] **Step 11: Terminar o `styles.css`**

Agora que os componentes que usavam essas classes não existem mais, `apps/web/src/styles.css` passa a ser exatamente isto — todo o CSS de componente (`.sidebar`, `.device-nav-item`, `.settings-group`, `.setting-row`, `.toggle`, `.empty-state`, `.topbar`, `.content-shell`, `.range`, `.alert-stack` e os blocos `@media` de largura) sai:

```css
@import 'tailwindcss';
@import '@gearhub/ui/styles/tokens.css';
@source "../../../packages/ui/src";

html {
  background: hsl(var(--color-bg-canvas));
  color: hsl(var(--color-text-primary));
  color-scheme: dark;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

button,
input {
  font: inherit;
}

/* Todo valor de configuração muda enquanto o usuário arrasta. Com numerais
   proporcionais o número muda de largura e o layout treme. */
.tnum {
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

`main.tsx` já monta o `dark` via classe? Não: a Task 4 tornou o dark o único tema, então remover de `App.tsx`/`main.tsx` qualquer `classList.toggle('dark', …)` remanescente. O `color-scheme: dark` acima é o que informa o navegador.

- [ ] **Step 12: Rodar os testes e o build**

Run: `pnpm --filter @gearhub/web exec vitest run`
Expected: PASS — mockDriver (3), mouseStore (4), PerformanceSection (2)

Run: `pnpm build`
Expected: sucesso, sem referência a `ConnectedPeripheral`

- [ ] **Step 13: Commit**

```bash
git add -A apps/web packages/shared
git commit -m "feat: replace settings page with device workspace shell"
```

---

## Task 7: Seção de DPI

**Files:**
- Create: `apps/web/src/features/dpi/DpiSection.tsx`
- Create: `apps/web/src/features/dpi/stageColors.ts`
- Modify: `apps/web/src/features/registry.ts`
- Test: `apps/web/src/features/dpi/DpiSection.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: `DpiSection`, `stageColorClass(color: DpiStageColor): string`.

- [ ] **Step 1: Escrever o teste que falha**

Create `apps/web/src/features/dpi/DpiSection.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMouseStore } from '../../store/mouseStore';
import { DpiSection } from './DpiSection';

const initial = useMouseStore.getState();
afterEach(() => {
  useMouseStore.setState(initial, true);
  vi.useRealTimers();
});

async function open(id: string) {
  vi.useFakeTimers();
  const promise = useMouseStore.getState().openMouse(id);
  await vi.runAllTimersAsync();
  await promise;
  vi.useRealTimers();
}

describe('DpiSection', () => {
  it('renderiza um card por estágio do perfil', async () => {
    await open('mock-vanguard');
    render(<DpiSection />);
    expect(screen.getAllByRole('slider')).toHaveLength(4);
  });

  it('omite o controle de X/Y quando o mouse não suporta eixos independentes', async () => {
    await open('mock-scout');
    render(<DpiSection />);
    expect(screen.queryByLabelText(/eixos x\/y independentes/i)).not.toBeInTheDocument();
  });

  it('esconde a ação de adicionar quando o limite de estágios foi atingido', async () => {
    await open('mock-scout');
    useMouseStore.getState().patchDraft((draft) => {
      draft.dpi.stages = [
        { id: 'a', x: 400, y: 400, color: 'green' },
        { id: 'b', x: 800, y: 800, color: 'cyan' },
        { id: 'c', x: 1600, y: 1600, color: 'blue' },
      ];
    });
    render(<DpiSection />);
    expect(screen.queryByRole('button', { name: /adicionar estágio/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @gearhub/web exec vitest run src/features/dpi/DpiSection.test.tsx`
Expected: FAIL — `Failed to resolve import "./DpiSection"`

- [ ] **Step 3: Escrever o mapa de cores**

Create `apps/web/src/features/dpi/stageColors.ts`:

```ts
import type { DpiStageColor } from '@gearhub/shared';

/** As cinco identidades cromáticas do app. Nenhuma delas colide com o vermelho de perigo. */
export const STAGE_ORDER: DpiStageColor[] = ['green', 'cyan', 'blue', 'violet', 'magenta'];

const CLASSES: Record<DpiStageColor, string> = {
  green: 'bg-stage-green',
  cyan: 'bg-stage-cyan',
  blue: 'bg-stage-blue',
  violet: 'bg-stage-violet',
  magenta: 'bg-stage-magenta',
};

export function stageColorClass(color: DpiStageColor): string {
  return CLASSES[color];
}

export function nextStageColor(used: DpiStageColor[]): DpiStageColor {
  return STAGE_ORDER.find((color) => !used.includes(color)) ?? 'green';
}
```

- [ ] **Step 4: Escrever a seção**

Create `apps/web/src/features/dpi/DpiSection.tsx`:

```tsx
import { Slider } from '@gearhub/ui/components/slider';
import { Switch } from '@gearhub/ui/components/switch';
import { useMouseStore } from '../../store/mouseStore';
import { nextStageColor, stageColorClass } from './stageColors';

export function DpiSection() {
  const session = useMouseStore((state) => state.session);
  const patchDraft = useMouseStore((state) => state.patchDraft);
  if (!session) return null;

  const { capabilities, draft } = session;
  const { stages } = draft.dpi;
  const canAdd = stages.length < capabilities.dpi.maxStages;
  const canRemove = stages.length > 1;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
          Estágios · {stages.length} de {capabilities.dpi.maxStages}
        </h2>
        {canAdd && (
          <button
            type="button"
            onClick={() =>
              patchDraft((profile) => {
                const color = nextStageColor(profile.dpi.stages.map((stage) => stage.color));
                const last = profile.dpi.stages.at(-1)!;
                profile.dpi.stages.push({
                  id: `s${Date.now()}`,
                  x: last.x,
                  y: last.y,
                  color,
                });
              })
            }
            className="rounded-md border border-border-strong px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover"
          >
            Adicionar estágio
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {stages.map((stage, index) => {
          const active = stage.id === draft.dpi.activeStageId;
          return (
            <div
              key={stage.id}
              className={`rounded-xl border p-4 ${
                active ? 'border-border-strong bg-bg-raised' : 'border-border-subtle bg-bg-surface'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-text-secondary">
                  <span aria-hidden className={`size-2 rounded-full ${stageColorClass(stage.color)}`} />
                  Estágio {index + 1}
                </span>
                <span className="tnum text-sm font-semibold text-text-primary">{stage.x}</span>
              </div>

              <div className="mt-3">
                <Slider
                  aria-label={`DPI do estágio ${index + 1}`}
                  min={capabilities.dpi.min}
                  max={capabilities.dpi.max}
                  step={capabilities.dpi.step}
                  value={[stage.x]}
                  onValueChange={([next]) =>
                    patchDraft((profile) => {
                      const target = profile.dpi.stages[index]!;
                      target.x = next!;
                      if (!profile.dpi.independentXY) target.y = next!;
                    })
                  }
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() =>
                    patchDraft((profile) => {
                      profile.dpi.activeStageId = stage.id;
                    })
                  }
                  className={active ? 'text-text-primary' : 'text-text-muted hover:text-text-primary'}
                >
                  {active ? 'Estágio ativo' : 'Tornar ativo'}
                </button>
                {canRemove && (
                  <button
                    type="button"
                    onClick={() =>
                      patchDraft((profile) => {
                        profile.dpi.stages = profile.dpi.stages.filter((s) => s.id !== stage.id);
                        if (profile.dpi.activeStageId === stage.id) {
                          profile.dpi.activeStageId = profile.dpi.stages[0]!.id;
                        }
                      })
                    }
                    className="text-text-muted hover:text-text-primary"
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {capabilities.dpi.independentXY && (
        <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-bg-surface px-4 py-3">
          <span className="text-sm text-text-secondary">Eixos X/Y independentes</span>
          <Switch
            aria-label="Eixos X/Y independentes"
            checked={draft.dpi.independentXY}
            onCheckedChange={(checked) =>
              patchDraft((profile) => {
                profile.dpi.independentXY = checked;
                if (!checked) for (const stage of profile.dpi.stages) stage.y = stage.x;
              })
            }
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Registrar a seção**

Modify `apps/web/src/features/registry.ts` — acrescentar o import e a entrada **antes** de `performance`:

```ts
import { DpiSection } from './dpi/DpiSection';

export const sectionRegistry: SectionDefinition[] = [
  { id: 'dpi', label: 'DPI', Component: DpiSection },
  { id: 'performance', label: 'Desempenho', Component: PerformanceSection },
];
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @gearhub/web exec vitest run src/features/dpi/DpiSection.test.tsx`
Expected: PASS — 3 testes

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/dpi apps/web/src/features/registry.ts
git commit -m "feat: add dpi stage section"
```

---

## Task 8: Render do mouse

Silhueta genérica paramétrica com hotspots posicionados a partir de coordenadas normalizadas. É o contrato que permite trocar por SVG por modelo depois sem tocar em componente.

**Files:**
- Create: `apps/web/src/components/MouseRender/MouseRender.tsx`
- Create: `apps/web/src/components/MouseRender/shells.ts`
- Test: `apps/web/src/components/MouseRender/MouseRender.test.tsx`

**Interfaces:**
- Consumes: Task 1.
- Produces: `MouseRender({ renderId, buttons, activeButtonId, onSelectButton })`, `SHELLS: Record<MouseRenderId, { viewBox: string; outline: string; seam: string }>`.

- [ ] **Step 1: Escrever o teste que falha**

Create `apps/web/src/components/MouseRender/MouseRender.test.tsx`:

```tsx
import type { MouseButton } from '@gearhub/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MouseRender } from './MouseRender';

const buttons: MouseButton[] = [
  { id: 'left', label: 'Botão esquerdo', hotspot: { x: 0.25, y: 0.2 }, remappable: false },
  { id: 'right', label: 'Botão direito', hotspot: { x: 0.75, y: 0.2 }, remappable: true },
];

describe('MouseRender', () => {
  it('posiciona cada callout na coordenada normalizada do botão', () => {
    render(<MouseRender renderId="generic-5button" buttons={buttons} onSelectButton={vi.fn()} />);
    const left = screen.getByRole('button', { name: 'Botão esquerdo' });
    expect(left.style.left).toBe('25%');
    expect(left.style.top).toBe('20%');
  });

  it('renderiza um callout por botão declarado nas capabilities', () => {
    render(<MouseRender renderId="generic-5button" buttons={buttons} onSelectButton={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @gearhub/web exec vitest run src/components/MouseRender/MouseRender.test.tsx`
Expected: FAIL — `Failed to resolve import "./MouseRender"`

- [ ] **Step 3: Escrever as silhuetas**

Create `apps/web/src/components/MouseRender/shells.ts`:

```ts
import type { MouseRenderId } from '@gearhub/shared';

/**
 * Silhuetas genéricas. Quando chegar SVG por modelo, basta acrescentar entradas
 * aqui e um novo valor em `MouseRenderId` — nenhum componente muda.
 */
export const SHELLS: Record<MouseRenderId, { viewBox: string; outline: string; seam: string }> = {
  'generic-5button': {
    viewBox: '0 0 100 160',
    outline: 'M50 3C23 3 11 40 11 79c0 50 15 78 39 78s39-28 39-78C89 40 77 3 50 3Z',
    seam: 'M50 5v58',
  },
  'generic-7button': {
    viewBox: '0 0 100 160',
    outline: 'M50 3C21 3 9 42 9 82c0 48 17 75 41 75s41-27 41-75C91 42 79 3 50 3Z',
    seam: 'M50 5v62',
  },
};
```

- [ ] **Step 4: Escrever o componente**

Create `apps/web/src/components/MouseRender/MouseRender.tsx`:

```tsx
import type { MouseButton, MouseRenderId } from '@gearhub/shared';
import { SHELLS } from './shells';

export function MouseRender({
  renderId,
  buttons,
  activeButtonId,
  onSelectButton,
}: {
  renderId: MouseRenderId;
  buttons: MouseButton[];
  activeButtonId?: string;
  onSelectButton(buttonId: string): void;
}) {
  const shell = SHELLS[renderId];

  return (
    <div className="relative mx-auto aspect-[100/160] w-[220px]">
      <svg viewBox={shell.viewBox} className="h-full w-full" aria-hidden>
        <path
          d={shell.outline}
          className="fill-bg-raised stroke-border-strong"
          strokeWidth={1.5}
        />
        <path d={shell.seam} className="stroke-border-subtle" strokeWidth={1} />
      </svg>

      {buttons.map((button) => {
        const active = button.id === activeButtonId;
        return (
          <button
            key={button.id}
            type="button"
            aria-label={button.label}
            aria-pressed={active}
            disabled={!button.remappable}
            onClick={() => onSelectButton(button.id)}
            style={{ left: `${button.hotspot.x * 100}%`, top: `${button.hotspot.y * 100}%` }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-md border px-2 py-1 text-[11px] transition-colors ${
              active
                ? 'border-fill-solid bg-fill-solid font-semibold text-fill-solid-text'
                : 'border-border-strong bg-bg-raised text-text-secondary hover:text-text-primary'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {button.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @gearhub/web exec vitest run src/components/MouseRender/MouseRender.test.tsx`
Expected: PASS — 2 testes

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/MouseRender
git commit -m "feat: add parametric mouse render with button hotspots"
```

---

## Task 9: Seção de Buttons

**Files:**
- Create: `apps/web/src/features/buttons/ButtonsSection.tsx`
- Create: `apps/web/src/features/buttons/ActionPicker.tsx`
- Create: `apps/web/src/features/buttons/actionLabel.ts`
- Modify: `apps/web/src/features/registry.ts`
- Test: `apps/web/src/features/buttons/actionLabel.test.ts`

**Interfaces:**
- Consumes: Tasks 1–8.
- Produces: `ButtonsSection`, `ActionPicker({ open, onOpenChange, onPick })`, `actionLabel(action: ButtonAction): string`.

- [ ] **Step 1: Escrever o teste que falha**

Create `apps/web/src/features/buttons/actionLabel.test.ts`:

```ts
import type { ButtonAction } from '@gearhub/shared';
import { describe, expect, it } from 'vitest';
import { actionLabel } from './actionLabel';

describe('actionLabel', () => {
  it('descreve cada variante da união sem cair num rótulo genérico', () => {
    const cases: [ButtonAction, string][] = [
      [{ kind: 'button', button: 'left' }, 'Clique esquerdo'],
      [{ kind: 'dpi', mode: 'cycle' }, 'Alternar DPI'],
      [{ kind: 'keystroke', keys: ['Ctrl', 'C'] }, 'Ctrl + C'],
      [{ kind: 'scroll', direction: 'up' }, 'Rolar para cima'],
      [{ kind: 'disabled' }, 'Desativado'],
    ];
    for (const [action, expected] of cases) expect(actionLabel(action)).toBe(expected);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @gearhub/web exec vitest run src/features/buttons/actionLabel.test.ts`
Expected: FAIL — `Failed to resolve import "./actionLabel"`

- [ ] **Step 3: Escrever os rótulos**

Create `apps/web/src/features/buttons/actionLabel.ts`:

```ts
import type { ButtonAction } from '@gearhub/shared';

const BUTTONS = {
  left: 'Clique esquerdo',
  right: 'Clique direito',
  middle: 'Clique do meio',
  back: 'Voltar',
  forward: 'Avançar',
} as const;

const DPI_MODES = {
  cycle: 'Alternar DPI',
  shift: 'DPI temporário',
  up: 'Aumentar DPI',
  down: 'Diminuir DPI',
} as const;

export function actionLabel(action: ButtonAction): string {
  switch (action.kind) {
    case 'button':
      return BUTTONS[action.button];
    case 'dpi':
      return DPI_MODES[action.mode];
    case 'keystroke':
      return action.keys.join(' + ');
    case 'scroll':
      return action.direction === 'up' ? 'Rolar para cima' : 'Rolar para baixo';
    case 'disabled':
      return 'Desativado';
    case 'macro':
      return 'Macro';
  }
}
```

- [ ] **Step 4: Escrever o picker**

Create `apps/web/src/features/buttons/ActionPicker.tsx`:

```tsx
import type { ButtonAction } from '@gearhub/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@gearhub/ui/components/dialog';
import { actionLabel } from './actionLabel';

/** Macro está fora do v1: nenhuma opção de macro é oferecida. */
const OPTIONS: ButtonAction[] = [
  { kind: 'button', button: 'left' },
  { kind: 'button', button: 'right' },
  { kind: 'button', button: 'middle' },
  { kind: 'button', button: 'back' },
  { kind: 'button', button: 'forward' },
  { kind: 'dpi', mode: 'cycle' },
  { kind: 'dpi', mode: 'shift' },
  { kind: 'scroll', direction: 'up' },
  { kind: 'scroll', direction: 'down' },
  { kind: 'disabled' },
];

export function ActionPicker({
  open,
  buttonLabel,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  buttonLabel: string;
  onOpenChange(open: boolean): void;
  onPick(action: ButtonAction): void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ação para {buttonLabel}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-1">
          {OPTIONS.map((action) => (
            <button
              key={actionLabel(action)}
              type="button"
              onClick={() => {
                onPick(action);
                onOpenChange(false);
              }}
              className="rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              {actionLabel(action)}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Escrever a seção**

Create `apps/web/src/features/buttons/ButtonsSection.tsx`:

```tsx
import { useState } from 'react';
import { MouseRender } from '../../components/MouseRender/MouseRender';
import { useMouseStore } from '../../store/mouseStore';
import { ActionPicker } from './ActionPicker';
import { actionLabel } from './actionLabel';

export function ButtonsSection() {
  const session = useMouseStore((state) => state.session);
  const patchDraft = useMouseStore((state) => state.patchDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  if (!session) return null;

  const { capabilities, draft } = session;
  const editing = capabilities.buttons.find((button) => button.id === editingId);

  return (
    <div className="mx-auto w-full max-w-3xl p-8">
      <MouseRender
        renderId={capabilities.renderId}
        buttons={capabilities.buttons}
        activeButtonId={editingId ?? undefined}
        onSelectButton={setEditingId}
      />

      <ul className="mx-auto mt-8 max-w-md space-y-1">
        {capabilities.buttons.map((button) => (
          <li
            key={button.id}
            className="flex items-center justify-between border-b border-border-subtle py-2 text-sm last:border-0"
          >
            <span className="text-text-muted">{button.label}</span>
            <span className="text-text-primary">
              {draft.bindings[button.id] ? actionLabel(draft.bindings[button.id]!) : '—'}
            </span>
          </li>
        ))}
      </ul>

      <ActionPicker
        open={editing !== undefined}
        buttonLabel={editing?.label ?? ''}
        onOpenChange={(open) => !open && setEditingId(null)}
        onPick={(action) =>
          patchDraft((profile) => {
            if (editing) profile.bindings[editing.id] = action;
          })
        }
      />
    </div>
  );
}
```

- [ ] **Step 6: Registrar a seção**

Modify `apps/web/src/features/registry.ts` — `buttons` vai **primeiro**:

```ts
import { ButtonsSection } from './buttons/ButtonsSection';

export const sectionRegistry: SectionDefinition[] = [
  { id: 'buttons', label: 'Botões', Component: ButtonsSection },
  { id: 'dpi', label: 'DPI', Component: DpiSection },
  { id: 'performance', label: 'Desempenho', Component: PerformanceSection },
];
```

- [ ] **Step 7: Rodar os testes e confirmar que passam**

Run: `pnpm --filter @gearhub/web exec vitest run src/features/buttons`
Expected: PASS — 1 teste

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/buttons apps/web/src/features/registry.ts
git commit -m "feat: add button remapping section"
```

---

## Task 10: Seção de Parameters

A tela onde a regra "capability ausente ⇒ controle ausente" fica mais visível: o Scout renderiza um subconjunto estrito do Vanguard.

**Files:**
- Create: `apps/web/src/features/parameters/ParametersSection.tsx`
- Create: `apps/web/src/features/parameters/ToggleRow.tsx`
- Modify: `apps/web/src/features/registry.ts`
- Test: `apps/web/src/features/parameters/ParametersSection.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: `ParametersSection`, `ToggleRow({ label, description, checked, onChange })`.

- [ ] **Step 1: Escrever o teste que falha**

Create `apps/web/src/features/parameters/ParametersSection.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMouseStore } from '../../store/mouseStore';
import { ParametersSection } from './ParametersSection';

const initial = useMouseStore.getState();
afterEach(() => {
  useMouseStore.setState(initial, true);
  vi.useRealTimers();
});

async function open(id: string) {
  vi.useFakeTimers();
  const promise = useMouseStore.getState().openMouse(id);
  await vi.runAllTimersAsync();
  await promise;
  vi.useRealTimers();
}

describe('ParametersSection', () => {
  it('renderiza todos os controles do mouse completo', async () => {
    await open('mock-vanguard');
    render(<ParametersSection />);
    expect(screen.getByLabelText('Sincronização de movimento')).toBeInTheDocument();
    expect(screen.getByLabelText('Altura de rastreio')).toBeInTheDocument();
    expect(screen.getByLabelText('Rotação do sensor')).toBeInTheDocument();
  });

  it('não renderiza controles que o mouse não declara — nunca desabilitados', async () => {
    await open('mock-scout');
    render(<ParametersSection />);
    expect(screen.getByLabelText('Sincronização de movimento')).toBeInTheDocument();
    expect(screen.queryByLabelText('Altura de rastreio')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Rotação do sensor')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Correção de ondulação')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @gearhub/web exec vitest run src/features/parameters/ParametersSection.test.tsx`
Expected: FAIL — `Failed to resolve import "./ParametersSection"`

- [ ] **Step 3: Escrever a linha de toggle**

Create `apps/web/src/features/parameters/ToggleRow.tsx`:

```tsx
import { Switch } from '@gearhub/ui/components/switch';

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange(checked: boolean): void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border-subtle py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-text-primary">{label}</p>
        <p className="mt-0.5 text-[13px] leading-5 text-text-muted">{description}</p>
      </div>
      <Switch aria-label={label} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
```

- [ ] **Step 4: Escrever a seção**

Create `apps/web/src/features/parameters/ParametersSection.tsx`:

```tsx
import { Segmented } from '@gearhub/ui/components/segmented';
import { Slider } from '@gearhub/ui/components/slider';
import { useMouseStore } from '../../store/mouseStore';
import { ToggleRow } from './ToggleRow';

export function ParametersSection() {
  const session = useMouseStore((state) => state.session);
  const patchDraft = useMouseStore((state) => state.patchDraft);
  if (!session) return null;

  const caps = session.capabilities.parameters;
  const { parameters } = session.draft;

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 p-8 lg:grid-cols-2">
      <div className="space-y-6">
        <section className="rounded-xl border border-border-subtle bg-bg-surface px-4 py-2">
          {caps.motionSync && (
            <ToggleRow
              label="Sincronização de movimento"
              description="Alinha o envio à leitura do sensor. Traça a trajetória com mais fidelidade e adiciona uma latência mínima."
              checked={parameters.motionSync}
              onChange={(checked) =>
                patchDraft((profile) => {
                  profile.parameters.motionSync = checked;
                })
              }
            />
          )}
          {caps.straightLineCorrection && (
            <ToggleRow
              label="Correção de linha reta"
              description="Remove o desvio ao puxar o mouse em linha reta. Feito para desenho, não para jogo."
              checked={parameters.straightLineCorrection}
              onChange={(checked) =>
                patchDraft((profile) => {
                  profile.parameters.straightLineCorrection = checked;
                })
              }
            />
          )}
          {caps.rippleCorrection && (
            <ToggleRow
              label="Correção de ondulação"
              description="Suaviza a trepidação em movimentos muito rápidos."
              checked={parameters.rippleCorrection}
              onChange={(checked) =>
                patchDraft((profile) => {
                  profile.parameters.rippleCorrection = checked;
                })
              }
            />
          )}
          {caps.longRangeMode && (
            <ToggleRow
              label="Alcance estendido"
              description="Mantém a conexão estável a distâncias maiores, ao custo de bateria."
              checked={parameters.longRangeMode}
              onChange={(checked) =>
                patchDraft((profile) => {
                  profile.parameters.longRangeMode = checked;
                })
              }
            />
          )}
        </section>

        {caps.debounceMs && (
          <section className="rounded-xl border border-border-subtle bg-bg-surface p-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
              Atraso antirrepique
            </h3>
            <p className="mb-3 mt-1 text-[13px] text-text-muted">
              Evita que um clique seja lido duas vezes. Valores altos atrasam o clique.
            </p>
            <Segmented
              label="Atraso antirrepique"
              options={caps.debounceMs.supported}
              value={parameters.debounceMs}
              format={(ms) => `${ms} ms`}
              onChange={(ms) =>
                patchDraft((profile) => {
                  profile.parameters.debounceMs = ms;
                })
              }
            />
          </section>
        )}

        {caps.sleepMinutes && (
          <section className="rounded-xl border border-border-subtle bg-bg-surface p-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
              Suspensão
            </h3>
            <p className="mb-3 mt-1 text-[13px] text-text-muted">
              Tempo parado até o mouse dormir para poupar bateria.
            </p>
            <Segmented
              label="Suspensão"
              options={caps.sleepMinutes.supported}
              value={parameters.sleepMinutes}
              format={(min) => `${min} min`}
              onChange={(min) =>
                patchDraft((profile) => {
                  profile.parameters.sleepMinutes = min;
                })
              }
            />
          </section>
        )}
      </div>

      <div className="space-y-6">
        {caps.lod && (
          <section className="rounded-xl border border-border-subtle bg-bg-surface p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                Altura de rastreio
              </h3>
              <span className="tnum text-sm text-text-primary">{parameters.lodMm.toFixed(1)} mm</span>
            </div>
            <p className="mb-3 mt-1 text-[13px] text-text-muted">
              Até que altura o sensor continua lendo o mousepad ao levantar o mouse.
            </p>
            <Slider
              aria-label="Altura de rastreio"
              min={caps.lod.min}
              max={caps.lod.max}
              step={caps.lod.step}
              value={[parameters.lodMm]}
              onValueChange={([next]) =>
                patchDraft((profile) => {
                  profile.parameters.lodMm = next!;
                })
              }
            />
          </section>
        )}

        {caps.sensorRotation && (
          <section className="rounded-xl border border-border-subtle bg-bg-surface p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                Rotação do sensor
              </h3>
              <span className="tnum text-sm text-text-primary">
                {parameters.sensorRotationDeg}°
              </span>
            </div>
            <p className="mb-3 mt-1 text-[13px] text-text-muted">
              Compensa a inclinação da sua pegada, para que horizontal continue horizontal.
            </p>
            <Slider
              aria-label="Rotação do sensor"
              min={caps.sensorRotation.min}
              max={caps.sensorRotation.max}
              step={caps.sensorRotation.step}
              value={[parameters.sensorRotationDeg]}
              onValueChange={([next]) =>
                patchDraft((profile) => {
                  profile.parameters.sensorRotationDeg = next!;
                })
              }
            />
          </section>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Registrar a seção**

Modify `apps/web/src/features/registry.ts` — acrescentar após `performance`:

```ts
import { ParametersSection } from './parameters/ParametersSection';

// … dentro do array, após performance:
{ id: 'parameters', label: 'Parâmetros', Component: ParametersSection },
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @gearhub/web exec vitest run src/features/parameters/ParametersSection.test.tsx`
Expected: PASS — 2 testes

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/parameters apps/web/src/features/registry.ts
git commit -m "feat: add sensor parameters section"
```

---

## Task 11: Seção de Profiles

**Files:**
- Create: `apps/web/src/features/profiles/ProfilesSection.tsx`
- Modify: `apps/web/src/features/registry.ts`
- Test: `apps/web/src/features/profiles/ProfilesSection.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: `ProfilesSection`.

- [ ] **Step 1: Escrever o teste que falha**

Create `apps/web/src/features/profiles/ProfilesSection.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMouseStore } from '../../store/mouseStore';
import { ProfilesSection } from './ProfilesSection';

const initial = useMouseStore.getState();
afterEach(() => {
  useMouseStore.setState(initial, true);
  vi.useRealTimers();
});

async function open(id: string) {
  vi.useFakeTimers();
  const promise = useMouseStore.getState().openMouse(id);
  await vi.runAllTimersAsync();
  await promise;
  vi.useRealTimers();
}

describe('ProfilesSection', () => {
  it('renderiza um slot por slot onboard declarado', async () => {
    await open('mock-vanguard');
    render(<ProfilesSection />);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('marca o slot vazio como vazio em vez de mostrar um card em branco', async () => {
    await open('mock-vanguard');
    render(<ProfilesSection />);
    expect(screen.getAllByText('Slot vazio')).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @gearhub/web exec vitest run src/features/profiles/ProfilesSection.test.tsx`
Expected: FAIL — `Failed to resolve import "./ProfilesSection"`

- [ ] **Step 3: Escrever a seção**

Create `apps/web/src/features/profiles/ProfilesSection.tsx`:

```tsx
import { isDirty } from '@gearhub/shared';
import { useMouseStore } from '../../store/mouseStore';

export function ProfilesSection() {
  const session = useMouseStore((state) => state.session);
  const saveToSlot = useMouseStore((state) => state.saveToSlot);
  const selectSlot = useMouseStore((state) => state.selectSlot);
  if (!session) return null;

  const dirty = isDirty(session);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 p-8">
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
        Slots do mouse · {session.slots.length}
      </h2>

      <ul className="space-y-2">
        {session.slots.map((slot) => {
          const active = slot.index === session.activeSlotIndex;
          return (
            <li
              key={slot.index}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                active ? 'border-border-strong bg-bg-raised' : 'border-border-subtle bg-bg-surface'
              }`}
            >
              <span className="flex items-center gap-3">
                <span className="tnum text-xs text-text-muted">{slot.index}</span>
                <span className="text-sm text-text-primary">
                  {slot.profile ? slot.profile.name : 'Slot vazio'}
                </span>
                {active && <span className="text-xs text-text-muted">em uso</span>}
              </span>

              {slot.profile && !active ? (
                <button
                  type="button"
                  onClick={() => void selectSlot(slot.index)}
                  className="rounded-md border border-border-strong px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover"
                >
                  Carregar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void saveToSlot(slot.index)}
                  className="rounded-md border border-border-strong px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover"
                >
                  {slot.profile ? 'Sobrescrever' : 'Gravar aqui'}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {dirty && (
        <p className="text-[13px] text-text-muted">
          O que está no mouse agora não corresponde ao slot {session.activeSlotIndex}. Grave para
          que sobreviva a desligar o computador.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Registrar a seção**

Modify `apps/web/src/features/registry.ts` — acrescentar após `parameters`:

```ts
import { ProfilesSection } from './profiles/ProfilesSection';

// … dentro do array, após parameters:
{ id: 'profiles', label: 'Perfis', Component: ProfilesSection },
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @gearhub/web exec vitest run src/features/profiles/ProfilesSection.test.tsx`
Expected: PASS — 2 testes

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/profiles apps/web/src/features/registry.ts
git commit -m "feat: add onboard profile slots section"
```

---

## Task 12: Seção de Device

**Files:**
- Create: `apps/web/src/features/device/DeviceSection.tsx`
- Modify: `apps/web/src/features/registry.ts`
- Test: `apps/web/src/features/device/DeviceSection.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: `DeviceSection`.

- [ ] **Step 1: Escrever o teste que falha**

Create `apps/web/src/features/device/DeviceSection.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMouseStore } from '../../store/mouseStore';
import { DeviceSection } from './DeviceSection';

const initial = useMouseStore.getState();
afterEach(() => {
  useMouseStore.setState(initial, true);
  vi.useRealTimers();
});

async function open(id: string) {
  vi.useFakeTimers();
  const promise = useMouseStore.getState().openMouse(id);
  await vi.runAllTimersAsync();
  await promise;
  vi.useRealTimers();
}

describe('DeviceSection', () => {
  it('mostra a versão de firmware lida do device', async () => {
    await open('mock-vanguard');
    render(<DeviceSection />);
    expect(screen.getByText('v1.4.2')).toBeInTheDocument();
  });

  it('exige confirmação antes de restaurar — o botão sozinho não apaga nada', async () => {
    await open('mock-vanguard');
    render(<DeviceSection />);

    await userEvent.click(screen.getByRole('button', { name: 'Restaurar' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(useMouseStore.getState().session!.slots[0]!.profile).not.toBeNull();
  });
});
```

Instalar o utilitário de interação, ainda não presente:

```bash
pnpm --filter @gearhub/web add -D @testing-library/user-event@14
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @gearhub/web exec vitest run src/features/device/DeviceSection.test.tsx`
Expected: FAIL — `Failed to resolve import "./DeviceSection"`

- [ ] **Step 3: Escrever a seção**

Create `apps/web/src/features/device/DeviceSection.tsx`:

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@gearhub/ui/components/dialog';
import { useState } from 'react';
import { useMouseStore } from '../../store/mouseStore';

export function DeviceSection() {
  const session = useMouseStore((state) => state.session);
  const factoryReset = useMouseStore((state) => state.factoryReset);
  const [confirming, setConfirming] = useState(false);
  if (!session) return null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 p-8">
      <section className="flex items-center justify-between rounded-xl border border-border-subtle bg-bg-surface px-4 py-3">
        <span className="text-sm text-text-primary">Firmware</span>
        <span className="tnum text-sm text-text-muted">{session.telemetry.firmware}</span>
      </section>

      <section className="flex items-center justify-between rounded-xl border border-border-subtle bg-bg-surface px-4 py-3">
        <span className="text-sm text-text-primary">Parear receptor</span>
        <button
          type="button"
          className="rounded-md border border-border-strong px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover"
        >
          Parear
        </button>
      </section>

      <section className="rounded-xl border border-border-subtle bg-bg-surface px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-primary">Restaurar padrão de fábrica</span>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-md border border-danger/40 px-3 py-1.5 text-xs text-danger hover:bg-bg-hover"
          >
            Restaurar
          </button>
        </div>
        <p className="mt-1 text-[13px] text-text-muted">
          Apaga os {session.slots.length} slots do mouse. Não dá para desfazer.
        </p>
      </section>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restaurar o padrão de fábrica?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-muted">
            Os {session.slots.length} slots gravados no mouse serão apagados. Perfis não salvos em
            slot também se perdem.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-md border border-border-strong px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                void factoryReset();
              }}
              className="rounded-md border border-danger/40 px-3 py-1.5 text-xs text-danger hover:bg-bg-hover"
            >
              Restaurar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 4: Registrar a seção**

Modify `apps/web/src/features/registry.ts` — acrescentar por último:

```ts
import { DeviceSection } from './device/DeviceSection';

// … dentro do array, ao final:
{ id: 'device', label: 'Dispositivo', Component: DeviceSection },
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @gearhub/web exec vitest run src/features/device/DeviceSection.test.tsx`
Expected: PASS — 2 testes

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/device apps/web/src/features/registry.ts apps/web/package.json
git commit -m "feat: add device section with guarded factory reset"
```

---

## Task 13: Verificação completa

**Files:**
- Modify: `README.md`
- Modify: `graphify-out/**` (gerado)

- [ ] **Step 1: Rodar o gate completo**

Run: `pnpm verify`
Expected: PASS em format, lint, test, build e audit.

Se `knip` (`audit:ts`) reportar exports não usados, remover o export — não adicionar exceção ao `knip.jsonc` sem motivo declarado.

- [ ] **Step 2: Confirmar as fronteiras de arquitetura**

Run: `pnpm audit:boundaries`
Expected: PASS. Em particular, nenhum import de `apps/web` dentro de `packages/*`.

- [ ] **Step 3: Rodar o app e percorrer a fatia vertical**

Run: `pnpm dev`

Percorrer manualmente: galeria → abrir o Vanguard → Botões (remapear o lateral) → DPI (arrastar um estágio) → Desempenho (trocar o polling e ver a autonomia mudar) → Parâmetros → Perfis (gravar no slot 2) → Dispositivo. Depois abrir o Scout e confirmar que rotação de sensor, LOD e alcance estendido **não aparecem**.

- [ ] **Step 4: Atualizar o README**

Modify `README.md` — substituir a frase da seção de setup:

```markdown
The preview currently uses two mock peripherals so you can explore DPI, polling rate, lighting, and related settings without hardware.
```

por:

```markdown
The preview ships two mock mice with deliberately different capabilities, so you can see
how the interface adapts: the Vanguard 8K exposes sensor rotation, lift-off distance and
extended range, and the Scout Wired does not render those controls at all.
```

- [ ] **Step 5: Atualizar o grafo**

Run: `pnpm graph:update`

- [ ] **Step 6: Commit**

```bash
git add README.md graphify-out
git commit -m "feat: refresh readme and code graph for the redesign"
```

---

## Task 14: Passe das skills de interface

Só agora, sobre tela construída. Esta é a task que produz os valores definitivos da paleta.

**Files:**
- Modify: `packages/ui/src/styles/tokens.css`
- Modify: arquivos apontados por cada skill

- [ ] **Step 1: `interfaces:better-colors`**

Invocar a skill sobre `packages/ui/src/styles/tokens.css` e as telas construídas. Ela deve:

1. gerar as rampas em OKLCH e emiti-las na notação HSL que o projeto usa;
2. medir o contraste de cada par que renderiza de verdade — `text-muted` sobre `bg-surface` **e** sobre `bg-raised`, os cinco estágios sobre `bg-surface`, o `danger` sobre `bg-surface`;
3. confirmar que os cinco estágios têm a mesma lightness perceptual, com chroma proporcional ao máximo de cada hue, e ficam a pelo menos 60° de distância do vermelho de perigo;
4. confirmar que `bg-canvas`, `bg-surface`, `bg-raised` e `bg-hover` são degraus distinguíveis — é a única coisa que carrega elevação num sistema sem sombra.

Substituir os valores provisórios da Task 4 pelos valores medidos. Os **nomes** não mudam.

- [ ] **Step 2: `interfaces:better-accessibility`**

Sobre as sete telas. Atenção particular a: alvo de toque dos callouts do `MouseRender`, rótulo acessível de cada `Slider`, ordem de foco no rail, e o fato de que a cor do estágio de DPI nunca pode ser o único portador da identidade do estágio — o número precisa estar lá também.

- [ ] **Step 3: `interfaces:better-layout`**

Agrupamento, alinhamento e ordem de leitura por tela. A tela de Parâmetros é a de maior risco por ser a mais densa.

- [ ] **Step 4: `interfaces:better-ui`**

Raio concêntrico entre card e controle interno, alinhamento óptico dos pontos de estágio e profundidade de superfície.

- [ ] **Step 5: `interfaces:better-writing`**

Todos os rótulos e descrições. O critério: um texto deve dizer o que a opção faz para quem não conhece o jargão, sem virar manual.

- [ ] **Step 6: `interfaces:better-interface`**

Revisão combinada, para pegar o que os passes isolados deixaram passar.

- [ ] **Step 7: Reverificar e commitar**

Run: `pnpm verify`
Expected: PASS

```bash
git add -A
git commit -m "feat: apply measured palette and interface review fixes"
```

---

## Cobertura do spec

| Seção do spec | Task |
| --- | --- |
| §4 Arquitetura de informação (7 telas) | 6, 7, 9, 10, 11, 12 |
| §5 Modelo de dados | 1 |
| §6 Porta do driver e os dois "sujos" | 2, 3, 6 (DirtyBar) |
| §7 Sistema visual | 4, 14 |
| §8 Estados e erro | 3 (revert, desconexão), 6 (banner, dirty bar), 12 (confirmação) |
| §9 Estrutura de arquivos e remoções | 6 |
| §10 Testes | 1, 2, 3, 6, 7, 8, 9, 10, 11, 12 |
| §11 Gates de qualidade | 13, 14 |
| §12 Caminho pós-v1 | não implementado por desenho — `MouseRenderId` e `ButtonAction.macro` deixam o espaço |
