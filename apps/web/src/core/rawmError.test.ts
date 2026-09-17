import { describe, expect, it } from 'vitest';
import { withProtocolEnvelope } from './coreBridge';

/**
 * Exercita o caminho completo, com o WASM real: um `RawmError` do núcleo
 * atravessa a ponte como `JsError`, chega aqui como `Error` cuja mensagem é o
 * código estável, e `asRawmError` a reveste com o texto em português sem
 * perder o código em `cause`. Um erro de digitação em qualquer uma das sete
 * strings de `RawmError::code()` cairia no fallback genérico
 * `Falha de protocolo RAWM: <code>.` sem que nenhuma suíte notasse — este
 * teste é o que notaria.
 */
describe('erro RAWM através da ponte', () => {
  it('chega como Error com a mensagem traduzida e o código em cause', () => {
    let thrown: unknown;
    try {
      withProtocolEnvelope([0x03], false);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    const error = thrown as Error;
    expect(error.message).toBe('Evento RAWM precisa de cabeçalho.');
    expect(error.cause).toBe('event-too-short');
  });
});
