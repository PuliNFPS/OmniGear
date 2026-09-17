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

function rawmErrorMessage(code: string): string {
  return MESSAGES[code] ?? `Falha de protocolo RAWM: ${code}.`;
}

/**
 * Reveste um erro vindo da ponte com o texto que a interface mostra, sem
 * perder o código.
 *
 * O código fica em `cause` de propósito: a mensagem é para o usuário, mas
 * `subscribeToNotifications` precisa distinguir uma falha do montador de uma
 * falha de decodificação, e o passo 5 vai precisar separar o erro da guarda de
 * memória ativa de um erro de transporte. Descartar o código aqui fecharia essa
 * porta em silêncio.
 */
export function asRawmError(error: unknown): Error {
  const code = error instanceof Error ? error.message : String(error);
  return new Error(rawmErrorMessage(code), { cause: code });
}
