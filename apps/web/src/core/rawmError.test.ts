import { describe, expect, it } from 'vitest';
import { parseQueryJson, withProtocolEnvelope } from './coreBridge';

/**
 * Exercita o caminho completo, com o WASM real: um `RawmError` do núcleo
 * atravessa a ponte como `JsError`, chega aqui como `Error` cuja mensagem é o
 * código estável, e `asRawmError` a reveste com o texto em português sem
 * perder o código em `cause`. Um erro de digitação em qualquer uma das nove
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

  /**
   * `query_json` (Tarefa 5) é o primeiro chamador a devolver
   * `NotAQueryResult` e `InvalidUtf8` — as duas entradas que este teste
   * também prova estarem em `MESSAGES`. Antes da Tarefa 5, `parseQueryJson`
   * vivia em `protocol.ts`, lançava `new Error(...)` direto (sem `cause`) e
   * usava um texto diferente para o comprimento inválido
   * (`'Resposta RAWM está incompleta.'`); este teste também pina a mudança
   * de mensagem.
   */
  it('rejeita um evento que não é resultado de consulta, com o código em cause', () => {
    const event = withProtocolEnvelope([0x0b, 0, 0x00], false);
    let thrown: unknown;
    try {
      parseQueryJson(event);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    const error = thrown as Error;
    expect(error.message).toBe('Resposta RAWM não é resultado de consulta.');
    expect(error.cause).toBe('not-a-query-result');
  });

  it('rejeita uma carga que não é UTF-8 válido, com o código em cause', () => {
    const event = withProtocolEnvelope([0x02, 0, 0xff, 0xfe], false);
    let thrown: unknown;
    try {
      parseQueryJson(event);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    const error = thrown as Error;
    expect(error.message).toBe('Resposta RAWM não é texto válido.');
    expect(error.cause).toBe('invalid-utf8');
  });

  it('rejeita um evento mais curto que o comprimento declarado, com o código em cause', () => {
    const complete = withProtocolEnvelope([0x02, 0, 0x7b, 0x7d], false);
    const truncated = complete.slice(0, complete.length - 1);
    let thrown: unknown;
    try {
      parseQueryJson(truncated);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    const error = thrown as Error;
    expect(error.message).toBe('Resposta RAWM declarou comprimento inválido.');
    expect(error.cause).toBe('invalid-length');
  });
});
