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

export function decodeReportChunk(report: Uint8Array, virtualMouse: boolean): Uint8Array {
  const headerIndex = virtualMouse ? 1 : 0;
  if (report.length !== REPORT_BYTES) throw new RangeError('Relatório RAWM deve ter 64 bytes.');
  if (virtualMouse && report[0] !== VIRTUAL_MOUSE_CHANNEL) {
    throw new Error('Relatório não pertence ao canal virtual do mouse.');
  }
  const header = report[headerIndex];
  if ((header & 0x80) === 0) throw new Error('Relatório RAWM sem marcador de dados.');
  const length = header & 0x3f;
  if (length > report.length - headerIndex - 1) throw new Error('Relatório RAWM truncado.');
  return report.slice(headerIndex + 1, headerIndex + 1 + length);
}

export class RawEventAssembler {
  private bytes: number[] = [];
  private expectedLength: number | null = null;

  push(chunk: Uint8Array): Uint8Array | null {
    this.bytes.push(...chunk);
    if (this.bytes.length >= 4 && this.bytes.slice(0, 4).some((byte) => byte !== 0xff)) {
      this.reset();
      throw new Error('Resposta RAWM sem preâmbulo válido.');
    }
    if (this.expectedLength === null && this.bytes.length >= 6) {
      this.expectedLength = eventLength(Uint8Array.from(this.bytes.slice(4, 6)));
      if (this.expectedLength < 2) {
        this.reset();
        throw new Error('Resposta RAWM declarou comprimento inválido.');
      }
    }
    const totalLength = this.expectedLength === null ? null : this.expectedLength + 4;
    if (totalLength === null || this.bytes.length < totalLength) return null;
    if (this.bytes.length > totalLength) {
      this.reset();
      throw new Error('Resposta RAWM contém bytes além do evento declarado.');
    }
    const event = Uint8Array.from(this.bytes.slice(4));
    this.reset();
    return event;
  }

  reset() {
    this.bytes = [];
    this.expectedLength = null;
  }
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
