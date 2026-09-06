import type { HardwareTransport } from '../WebHidTransport';
import {
  RawEventAssembler,
  buildQueryEvent,
  decodeReportChunk,
  frameEvent,
  parseQueryJson,
} from './protocol';

export interface RawmIdentity {
  deviceName: string;
  productId: number;
  vendorId: number | null;
  crcSupported: boolean;
  raw: Record<string, unknown>;
}

export interface QueryOptions {
  virtualMouse?: boolean;
  epochSeconds?: number;
  timeoutMs?: number;
}

function integer(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function validateRawmIdentity(raw: Record<string, unknown>): RawmIdentity {
  const deviceName = typeof raw.dn === 'string' ? raw.dn.trim() : '';
  const productId = integer(raw.pi);
  const vendorId = integer(raw.vi);
  if (!deviceName || productId === null) throw new Error('Resposta RAWM sem identidade válida.');
  return {
    deviceName,
    productId,
    vendorId,
    crcSupported: raw.crc === 1,
    raw,
  };
}

export async function queryRawmDevice(
  transport: HardwareTransport,
  options: QueryOptions = {},
): Promise<RawmIdentity> {
  const virtualMouse = options.virtualMouse ?? false;
  const timeoutMs = options.timeoutMs ?? 1000;
  const assembler = new RawEventAssembler();
  await transport.open();

  return new Promise<RawmIdentity>((resolve, reject) => {
    let settled = false;
    const finish = (result: RawmIdentity | Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribe();
      if (result instanceof Error) reject(result);
      else resolve(result);
    };
    const unsubscribe = transport.onInputReport((reportId, report) => {
      if (reportId !== 0) return;
      try {
        const chunk = decodeReportChunk(report, virtualMouse);
        if (chunk.length === 0) return;
        const event = assembler.push(chunk);
        if (event) finish(validateRawmIdentity(parseQueryJson(event)));
      } catch (error) {
        finish(error instanceof Error ? error : new Error('Resposta RAWM inválida.'));
      }
    });
    const timeout = setTimeout(
      () => finish(new Error('A consulta RAWM excedeu o tempo limite.')),
      timeoutMs,
    );

    const event = buildQueryEvent(options.epochSeconds);
    void (async () => {
      try {
        for (const report of frameEvent(event, virtualMouse)) {
          await transport.send({ reportId: 0, data: report });
        }
      } catch (error) {
        finish(error instanceof Error ? error : new Error('Falha ao consultar o dispositivo RAWM.'));
      }
    })();
  });
}
