import { describe, expect, it } from 'vitest';
import { fromHex, readProtocolVectors, toHex } from '../../test/vectors';
import { buildQueryEvent, withProtocolEnvelope } from '../../core/coreBridge';

const vectors = readProtocolVectors();

/**
 * `it.each` não falha um array vazio: ele roda zero casos e relata sucesso.
 * Se uma seção sumisse do JSON compartilhado (por remoção, ou por um rename
 * que nada pegou), os `it.each` abaixo passariam sem checar nada. O lado
 * Rust já se protege disso com `require_non_empty` em
 * `packages/core/tests/vectors.rs`; este teste é o par do lado TypeScript.
 */
function requireNonEmpty<T>(cases: T[], section: string): void {
  if (cases.length === 0) {
    throw new Error(`sem vetores de ${section}`);
  }
}

describe('vetores de conformidade do protocolo RAWM', () => {
  it('declara a versão que este teste entende', () => {
    expect(vectors.version).toBe(1);
  });

  it('tem vetores de envelope e de consulta', () => {
    requireNonEmpty(vectors.envelope, 'envelope');
    requireNonEmpty(vectors.queryEvent, 'queryEvent');
  });

  it.each(vectors.envelope)('envelope: $name', ({ input, crc, expected }) => {
    expect(toHex(withProtocolEnvelope(fromHex(input), crc))).toBe(expected);
  });

  it.each(vectors.queryEvent)('consulta: $name', ({ epochSeconds, expected }) => {
    expect(toHex(buildQueryEvent(epochSeconds))).toBe(expected);
  });
});

describe('fromHex', () => {
  it('rejeita uma string hexadecimal de comprimento ímpar em vez de truncá-la', () => {
    expect(() => fromHex('abc')).toThrow(/ímpar/);
  });

  it('aceita a string vazia', () => {
    expect(fromHex('')).toEqual(new Uint8Array());
  });
});
