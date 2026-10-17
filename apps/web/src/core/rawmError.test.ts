import { describe, expect, it } from 'vitest';
import { asRawmError } from './rawmError';
import { parseQueryJson, withProtocolEnvelope } from './coreBridge';

/**
 * Exercita o caminho completo, com o WASM real: um `RawmError` do núcleo
 * atravessa a ponte como `JsError`, chega aqui como `Error` cuja mensagem é o
 * código estável, e `asRawmError` a reveste com o texto em português sem
 * perder o código em `cause`. Só alguns códigos de `RawmError::code()`
 * atravessam o WASM real aqui; os demais são conferidos pelo teste de códigos do
 * Rust e pela tabela de `MESSAGES`. Um código que não batesse com `MESSAGES`
 * atravessaria sem tradução, com o código cru como mensagem.
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

  /**
   * Um `TypeError` de fora do núcleo — uma chamada antes do `init()`, uma
   * falha de interop do Vite — não é um `RawmError`. Disfarçá-lo como falha
   * de protocolo foi o bug real da Tarefa 2: o texto mostrado ao usuário era
   * `Falha de protocolo RAWM: (0 , __vite_…`, com a mensagem original e o
   * stack perdidos.
   */
  it('deixa um erro que não é do núcleo atravessar intacto', () => {
    const original = new TypeError('(0 , __vite_ssr_import_0__.default) is not a function');

    const wrapped = asRawmError(original);

    expect(wrapped).toBe(original);
    expect(wrapped.message).toBe(original.message);
    expect(wrapped.stack).toBe(original.stack);
  });

  it('monta a mensagem com o dado e guarda só o código em cause', () => {
    const error = asRawmError(new Error('invalid-snapshot-field:cpi'));
    expect(error.message).toBe('Snapshot RAWM incompleto ou invalido: cpi.');
    expect(error.cause).toBe('invalid-snapshot-field');
  });

  it('deixa passar intacto um código que só existe na cadeia de protótipos', () => {
    const original = new Error('constructor:x');
    expect(asRawmError(original)).toBe(original);
  });

  it('deixa passar intacto um erro com dois-pontos que não vem do núcleo', () => {
    const original = new TypeError('TypeError: x is not a function');
    expect(asRawmError(original)).toBe(original);
  });
});

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
