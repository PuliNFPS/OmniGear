import { withProtocolEnvelope } from '../../core/coreBridge';

export {
  decodeReportChunk,
  frameEvent,
  RawEventAssembler,
  withProtocolEnvelope,
} from '../../core/coreBridge';

const CMD_QUERY = 0x01;
const OS_PC = 0x03;

function eventLength(event: Uint8Array): number {
  return ((event[0] & 0xf0) << 4) | event[1];
}

export function buildQueryEvent(epochSeconds = Math.floor(Date.now() / 1000)): Uint8Array {
  const timestamp = BigInt(epochSeconds);
  const bytes = [CMD_QUERY, 0, OS_PC, 0, 0];
  for (let shift = 0n; shift < 64n; shift += 8n) {
    bytes.push(Number((timestamp >> shift) & 0xffn));
  }
  return withProtocolEnvelope(bytes, false);
}

/** Query results carry command 0x02; the stream also carries other events. */
export function isQueryResult(event: Uint8Array): boolean {
  return (event[0] & 0x0f) === 0x02;
}

export function parseQueryJson(event: Uint8Array): Record<string, unknown> {
  if (event.length !== eventLength(event)) throw new Error('Resposta RAWM está incompleta.');
  if ((event[0] & 0x0f) !== 0x02) throw new Error('Resposta RAWM não é resultado de consulta.');
  const payload = event.slice(2);
  const end = payload.at(-1) === 0 ? payload.length - 1 : payload.length;
  const parsed: unknown = JSON.parse(new TextDecoder().decode(payload.slice(0, end)));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Identificação RAWM inválida.');
  }
  return parsed as Record<string, unknown>;
}
