import { describe, expect, it } from 'vitest';
import { fromHex, readProtocolVectors, toHex } from '../../test/vectors';
import { buildQueryEvent, withProtocolEnvelope } from './protocol';

const vectors = readProtocolVectors();

describe('vetores de conformidade do protocolo RAWM', () => {
  it('declara a versão que este teste entende', () => {
    expect(vectors.version).toBe(1);
  });

  it.each(vectors.envelope)('envelope: $name', ({ input, crc, expected }) => {
    expect(toHex(withProtocolEnvelope(fromHex(input), crc))).toBe(expected);
  });

  it.each(vectors.queryEvent)('consulta: $name', ({ epochSeconds, expected }) => {
    expect(toHex(buildQueryEvent(epochSeconds))).toBe(expected);
  });
});
