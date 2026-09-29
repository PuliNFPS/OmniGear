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
  'unknown-action': 'Ação de botão desconhecida.',
  'invalid-snapshot-field': 'Snapshot RAWM incompleto ou invalido: {campo}.',
  'incomplete-query': 'Consulta RAWM incompleta: {campo}.',
  'invalid-performance-mode': 'Modo de desempenho RAWM invalido.',
  'invalid-dpi-stages': 'Configuracao de DPI RAWM invalida.',
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
 *
 * As variantes com dado chegam como `código:dado`; o dado entra no lugar de
 * `{campo}` no texto, e `cause` guarda só o código.
 */
export function asRawmError(error: unknown): Error {
  const text = error instanceof Error ? error.message : String(error);
  // Variantes com dado chegam como `código:dado`; o código é a parte antes do
  // primeiro `:`. Um erro que não vem do núcleo pode ter `:` também
  // ("TypeError: …"), mas a parte antes dele não está em MESSAGES.
  const separator = text.indexOf(':');
  const code = separator === -1 ? text : text.slice(0, separator);
  const detail = separator === -1 ? '' : text.slice(separator + 1);
  if (!(code in MESSAGES)) return error instanceof Error ? error : new Error(text);
  return new Error(MESSAGES[code].replace('{campo}', detail), { cause: code });
}
