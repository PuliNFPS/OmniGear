import { describe, expect, it } from 'vitest';
import { fromHex, readProtocolVectors, toHex } from '../../test/vectors';
import { buildQueryEvent, encodeMouseFunction, withProtocolEnvelope } from '../../core/coreBridge';
import {
  FUNCTION_SHOW_POWER,
  SHOW_POWER_KEY_ID,
  TOUCH_TYPE_PRESS,
  actions,
  buttonIdsByKeyId,
  physicalKeyIds,
} from './leviathanV4Keys';
import { encodeLeviathanAction } from './LeviathanV4Driver';

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

  it('tem vetores de todas as seções', () => {
    requireNonEmpty(vectors.envelope, 'envelope');
    requireNonEmpty(vectors.queryEvent, 'queryEvent');
    requireNonEmpty(vectors.mapping, 'mapping');
    requireNonEmpty(vectors.showPower, 'showPower');
    requireNonEmpty(vectors.leviathanKeys, 'leviathanKeys');
  });

  it.each(vectors.envelope)('envelope: $name', ({ input, crc, expected }) => {
    expect(toHex(withProtocolEnvelope(fromHex(input), crc))).toBe(expected);
  });

  it.each(vectors.queryEvent)('consulta: $name', ({ epochSeconds, expected }) => {
    expect(toHex(buildQueryEvent(epochSeconds))).toBe(expected);
  });

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
});

describe('fromHex', () => {
  it('rejeita uma string hexadecimal de comprimento ímpar em vez de truncá-la', () => {
    expect(() => fromHex('abc')).toThrow(/ímpar/);
  });

  it('aceita a string vazia', () => {
    expect(fromHex('')).toEqual(new Uint8Array());
  });
});
