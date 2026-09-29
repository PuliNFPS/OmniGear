import { describe, expect, it } from 'vitest';
import { applyQueryPatch, fromHex, readProtocolVectors, toHex } from '../../test/vectors';
import {
  applySettingsToMouseParam,
  buildQueryEvent,
  encodeMouseParamBody,
  parseMouseParamState,
  encodeLeviathanShowPower,
  encodeMapping,
  leviathanButtonId,
  leviathanKeyId,
  withProtocolEnvelope,
} from '../../core/coreBridge';

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
    requireNonEmpty(Object.keys(vectors.queries), 'queries');
    requireNonEmpty(vectors.paramSnapshot, 'paramSnapshot');
    requireNonEmpty(vectors.paramApply, 'paramApply');
    requireNonEmpty(vectors.invalidSnapshot, 'invalidSnapshot');
  });

  it.each(vectors.envelope)('envelope: $name', ({ input, crc, expected }) => {
    expect(toHex(withProtocolEnvelope(fromHex(input), crc))).toBe(expected);
  });

  it.each(vectors.queryEvent)('consulta: $name', ({ epochSeconds, expected }) => {
    expect(toHex(buildQueryEvent(epochSeconds))).toBe(expected);
  });

  it.each(vectors.mapping)('mapeamento: $name', ({ keyIds, action, expected }) => {
    const hex = (bytes: Uint8Array | null) => (bytes === null ? null : toHex(bytes));
    expect(hex(encodeMapping(fromHex(keyIds), action))).toBe(expected);
  });

  it.each(vectors.showPower)('show power: $name', ({ expected }) => {
    expect(toHex(encodeLeviathanShowPower())).toBe(expected);
  });

  it.each(vectors.leviathanKeys)('tecla do Leviathan: $buttonId', ({ buttonId, keyId }) => {
    expect(leviathanKeyId(buttonId)).toBe(keyId);
    expect(leviathanButtonId(keyId)).toBe(buttonId);
  });
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
});

describe('fromHex', () => {
  it('rejeita uma string hexadecimal de comprimento ímpar em vez de truncá-la', () => {
    expect(() => fromHex('abc')).toThrow(/ímpar/);
  });

  it('aceita a string vazia', () => {
    expect(fromHex('')).toEqual(new Uint8Array());
  });
});
