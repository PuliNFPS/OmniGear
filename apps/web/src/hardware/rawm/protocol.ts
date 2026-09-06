const CMD_CONFIG = 0x03;
const CMD_QUERY = 0x01;
const CONFIG_TYPE_CRC = 0x24;
const OS_PC = 0x03;
const REPORT_BYTES = 64;
const PHYSICAL_PAYLOAD_BYTES = 63;
const VIRTUAL_PAYLOAD_BYTES = 62;
const VIRTUAL_MOUSE_CHANNEL = 0xc0;

function eventLength(event: Uint8Array): number {
  return ((event[0] & 0xf0) << 4) | event[1];
}

function encodeLength(event: Uint8Array): Uint8Array {
  if (event.length > 0x0fff) throw new RangeError('Evento RAWM excede 4.095 bytes.');
  if (event.length < 2) throw new RangeError('Evento RAWM precisa de cabeçalho.');
  const encoded = event.slice();
  encoded[0] = (encoded[0] & 0x0f) | ((encoded.length >> 4) & 0xf0);
  encoded[1] = encoded.length & 0xff;
  return encoded;
}

/** CRC16 routine used by RAWM configuration events. */
export function crc16(data: Uint8Array): number {
  let crc = 0xffff;
  for (const value of data) {
    crc = ((crc >> 8) & 0xff) | ((crc << 8) & 0xffff);
    crc ^= value;
    crc ^= (crc & 0xff) >> 4;
    crc ^= (crc << 12) & 0xffff;
    crc ^= ((crc & 0xff) << 5) & 0xffff;
  }
  return crc & 0xffff;
}

export function withProtocolEnvelope(source: ArrayLike<number>, useCrc: boolean): Uint8Array {
  const inner = encodeLength(Uint8Array.from(source));
  if (!useCrc) return inner;

  const checksum = crc16(inner);
  return encodeLength(
    Uint8Array.from([
      CMD_CONFIG,
      0,
      CONFIG_TYPE_CRC,
      checksum & 0xff,
      (checksum >> 8) & 0xff,
      ...inner,
    ]),
  );
}

export function buildQueryEvent(epochSeconds = Math.floor(Date.now() / 1000)): Uint8Array {
  const timestamp = BigInt(epochSeconds);
  const bytes = [CMD_QUERY, 0, OS_PC, 0, 0];
  for (let shift = 0n; shift < 64n; shift += 8n) {
    bytes.push(Number((timestamp >> shift) & 0xffn));
  }
  return withProtocolEnvelope(bytes, false);
}

export function frameEvent(event: Uint8Array, virtualMouse: boolean): Uint8Array[] {
  const payloadBytes = virtualMouse ? VIRTUAL_PAYLOAD_BYTES : PHYSICAL_PAYLOAD_BYTES;
  const reports: Uint8Array[] = [];
  for (let offset = 0; offset < event.length; offset += payloadBytes) {
    const chunk = event.slice(offset, offset + payloadBytes);
    const report = new Uint8Array(REPORT_BYTES);
    const headerIndex = virtualMouse ? 1 : 0;
    if (virtualMouse) report[0] = VIRTUAL_MOUSE_CHANNEL;
    report[headerIndex] = 0x80 | chunk.length;
    report.set(chunk, headerIndex + 1);
    reports.push(report);
  }
  return reports;
}

export function decodeReportChunk(report: Uint8Array, virtualMouse: boolean): Uint8Array | null {
  const headerIndex = virtualMouse ? 1 : 0;
  if (report.length !== REPORT_BYTES) throw new RangeError('Relatório RAWM deve ter 64 bytes.');
  if (virtualMouse && report[0] !== VIRTUAL_MOUSE_CHANNEL) {
    throw new Error('Relatório não pertence ao canal virtual do mouse.');
  }
  const header = report[headerIndex];
  // The receiver interleaves frames of its own without the data marker. They
  // are not corruption, so they are skipped rather than failing the exchange.
  if ((header & 0x80) === 0) return null;
  const length = header & 0x3f;
  if (length > report.length - headerIndex - 1) throw new Error('Relatório RAWM truncado.');
  return report.slice(headerIndex + 1, headerIndex + 1 + length);
}

export class RawEventAssembler {
  private bytes: number[] = [];

  /**
   * Returns every event completed by this chunk, keeping leftover bytes for the
   * next one. Events arrive packed back to back, so a chunk routinely ends in
   * the middle of the following event; discarding that surplus loses it and
   * leaves the buffer mid-payload, which surfaces as a missing preamble.
   */
  push(chunk: Uint8Array): Uint8Array[] {
    this.bytes.push(...chunk);
    const events: Uint8Array[] = [];

    for (;;) {
      if (this.bytes.length >= 4 && this.bytes.slice(0, 4).some((byte) => byte !== 0xff)) {
        this.reset();
        throw new Error('Resposta RAWM sem preâmbulo válido.');
      }
      if (this.bytes.length < 6) break;

      const declared = eventLength(Uint8Array.from(this.bytes.slice(4, 6)));
      if (declared < 2) {
        this.reset();
        throw new Error('Resposta RAWM declarou comprimento inválido.');
      }

      const total = declared + 4;
      if (this.bytes.length < total) break;
      events.push(Uint8Array.from(this.bytes.slice(4, total)));
      this.bytes = this.bytes.slice(total);
    }

    return events;
  }

  reset() {
    this.bytes = [];
  }
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
