import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MouseActionId, MouseSettings } from '@gearhub/shared';

/**
 * Os vetores defendem as duas implementações do protocolo enquanto elas
 * coexistirem: um encoder que divergir quebra o `cargo test` e o `vitest` no
 * mesmo commit.
 *
 * O caminho sai do cwd, e não de `import.meta.url`, pela mesma razão que
 * `setupCore.ts` documenta: num teste com `@vitest-environment jsdom` o módulo
 * não tem URL `file:`.
 */
const VECTORS = '../../packages/core/vectors/rawm-protocol.json';

interface EnvelopeVector {
  name: string;
  input: string;
  crc: boolean;
  expected: string;
}

interface QueryEventVector {
  name: string;
  epochSeconds: number;
  expected: string;
}

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

export interface ProtocolVectors {
  version: number;
  envelope: EnvelopeVector[];
  queryEvent: QueryEventVector[];
  mapping: MappingVector[];
  showPower: ShowPowerVector[];
  leviathanKeys: LeviathanKeyVector[];
  queries: Record<string, Record<string, unknown>>;
  paramSnapshot: ParamSnapshotVector[];
  paramApply: ParamApplyVector[];
  invalidSnapshot: InvalidSnapshotVector[];
  onboardEntry: OnboardEntryVector[];
  onboardDump: OnboardDumpVector[];
  identity: IdentityVector[];
  sessionEvents: SessionEventsVector[];
  sessionApply: SessionApplyVector[];
  sessionWriteProfile: SessionWriteProfileVector[];
}

export function readProtocolVectors(): ProtocolVectors {
  return JSON.parse(readFileSync(resolve(process.cwd(), VECTORS), 'utf8')) as ProtocolVectors;
}

export function fromHex(value: string): Uint8Array {
  if (value.length % 2 !== 0) {
    throw new Error(`fromHex: comprimento ímpar (${value.length}): ${value}`);
  }
  const bytes = value.match(/.{2}/g) ?? [];
  return Uint8Array.from(bytes.map((byte) => Number.parseInt(byte, 16)));
}

export function toHex(bytes: Uint8Array | number[]): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

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
