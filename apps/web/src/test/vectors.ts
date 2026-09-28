import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MouseActionId } from '@gearhub/shared';

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

export interface ProtocolVectors {
  version: number;
  envelope: EnvelopeVector[];
  queryEvent: QueryEventVector[];
  mapping: MappingVector[];
  showPower: ShowPowerVector[];
  leviathanKeys: LeviathanKeyVector[];
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
