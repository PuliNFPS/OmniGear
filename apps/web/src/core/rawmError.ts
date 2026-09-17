/**
 * O núcleo devolve um código estável; o texto é decisão da casca.
 *
 * As mensagens são as mesmas de antes da migração de propósito: o
 * `subscribeToNotifications` reconhece a falha pelo `catch` e o
 * `queryRawmDevice` a mostra ao usuário.
 */
const MESSAGES: Record<string, string> = {
  'event-too-long': 'Evento RAWM excede 4.095 bytes.',
  'event-too-short': 'Evento RAWM precisa de cabeçalho.',
  'missing-preamble': 'Resposta RAWM sem preâmbulo válido.',
  'invalid-length': 'Resposta RAWM declarou comprimento inválido.',
  'report-not-64': 'Relatório RAWM deve ter 64 bytes.',
  'wrong-channel': 'Relatório não pertence ao canal virtual do mouse.',
  'truncated-report': 'Relatório RAWM truncado.',
  'not-a-query-result': 'Resposta RAWM não é resultado de consulta.',
  'invalid-utf8': 'Resposta RAWM não é texto válido.',
};

/**
 * Reveste um erro do núcleo com o texto que a interface mostra, sem perder o
 * código — e só o do núcleo. Uma mensagem que não está em `MESSAGES` não é um
 * `RawmError`: é um `TypeError` de uma chamada antes do `init()`, uma falha de
 * interop do Vite, um `RangeError` de `BigInt` sobre um epoch fracionário.
 * Disfarçar esse erro como falha de protocolo destruiria a mensagem original
 * e o stack — foi o que aconteceu na Tarefa 2, onde o texto mostrado ao
 * usuário era `Falha de protocolo RAWM: (0 , __vite_…`. Esse erro atravessa
 * intacto.
 *
 * O código fica em `cause` de propósito: a mensagem é para o usuário, mas
 * `subscribeToNotifications` precisa distinguir uma falha do montador de uma
 * falha de decodificação, e o passo 5 vai precisar separar o erro da guarda de
 * memória ativa de um erro de transporte. Descartar o código aqui fecharia essa
 * porta em silêncio.
 */
export function asRawmError(error: unknown): Error {
  const code = error instanceof Error ? error.message : String(error);
  if (!(code in MESSAGES)) return error instanceof Error ? error : new Error(code);
  return new Error(MESSAGES[code], { cause: code });
}
