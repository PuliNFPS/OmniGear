import { describe, expect, it, vi } from 'vitest';
import type { BrowserHidDevice } from '../deviceDiscovery';
import type { HardwareTransport, HidInputReportEvent } from '../WebHidTransport';
import { captureQuery, requestDiagnosticDevice, runReadOnlyDiagnostic } from './diagnostics';
import { frameEvent, withProtocolEnvelope } from './protocol';

const receiver = { dn: 'RAWM HS Receiver', pi: 0x2346, vi: 0x1915, crc: 1 };
const mouse = {
  dn: 'Leviathan V4',
  pi: 0x9999,
  vi: 0x1915,
  crc: 1,
  cpi: 1600,
  polling: 1000,
  light: 0x30,
  cpi_l: [400, 800, 1600, 3200],
  cpi_l_c: [1, 2, 3, 4],
  ob: 0,
  pm: 1,
  lod: 2,
  kd: [8, 8, 8, 8, 8, 8, 8],
  ms: 1,
  at: 0,
  as: 1,
  rctrl: 1,
  top: 8,
  co: [100, 90],
  atp: 1,
  ocs: [0x80],
  gm: [0, 0],
  st: [0x80],
};

function queryReports(value: Record<string, unknown>, virtual: boolean): Uint8Array[] {
  const json = new TextEncoder().encode(`${JSON.stringify(value)}\0`);
  const event = withProtocolEnvelope([2, 0, ...json], false);
  return frameEvent(Uint8Array.from([0xff, 0xff, 0xff, 0xff, ...event]), virtual);
}

function fakeDevice(mouseRaw: Record<string, unknown> = mouse, noiseReports = 0): BrowserHidDevice {
  const listeners = new Set<(event: HidInputReportEvent) => void>();
  const sent: Uint8Array[] = [];
  const emit = (reportId: number, bytes: Uint8Array) => {
    const copied = bytes.slice();
    const event = { reportId, data: new DataView(copied.buffer) };
    listeners.forEach((listener) => listener(event));
  };
  const device = {
    vendorId: 0x1915,
    productId: 0x2346,
    productName: 'RAWM HS Receiver',
    opened: false,
    sent,
    collections: [
      {
        usagePage: 0xff00,
        usage: 1,
        inputReports: [{ reportId: 0 }],
        outputReports: [{ reportId: 0 }],
      },
    ],
    async open() {
      device.opened = true;
    },
    async sendReport(_reportId: number, data: BufferSource) {
      const report = new Uint8Array(data as ArrayBuffer);
      sent.push(report);
      const virtual = report[0] === 0xc0;
      const responses = queryReports(virtual ? mouseRaw : receiver, virtual);
      queueMicrotask(() => {
        // Movement traffic on the mouse's own collection, ahead of the answer.
        for (let index = 0; index < noiseReports; index += 1) {
          emit(1, new Uint8Array(8).fill(index & 0xff));
        }
        responses.forEach((response) => emit(0, response));
      });
    },
    addEventListener(_type: 'inputreport', listener: (event: HidInputReportEvent) => void) {
      listeners.add(listener);
    },
    removeEventListener(_type: 'inputreport', listener: (event: HidInputReportEvent) => void) {
      listeners.delete(listener);
    },
  };
  return device as unknown as BrowserHidDevice & { sent: Uint8Array[] };
}

function stage(report: Awaited<ReturnType<typeof runReadOnlyDiagnostic>>, id: string) {
  return report.etapas.find((item) => item.id === id);
}

describe('runReadOnlyDiagnostic', () => {
  it('reports every stage and keeps the raw payloads of both channels', async () => {
    const report = await runReadOnlyDiagnostic(fakeDevice());

    expect(stage(report, 'colecao')?.status).toBe('ok');
    expect(stage(report, 'consulta-receptor')?.status).toBe('ok');
    expect(stage(report, 'identidade-receptor')?.status).toBe('ok');
    expect(stage(report, 'consulta-mouse')?.status).toBe('ok');
    expect(stage(report, 'nome-mouse')?.status).toBe('ok');
    expect(stage(report, 'snapshot')?.status).toBe('ok');
    expect(report.receptor).toMatchObject({ pi: 0x2346 });
    expect(report.mouse).toMatchObject({ dn: 'Leviathan V4' });
    expect(report.snapshot?.pollingRate).toBe(1000);
    expect(report.relatorios.length).toBeGreaterThan(0);
  });

  // The reason this module exists: the strict parser must not swallow the
  // payload we need in order to fix the strict parser.
  it('keeps the raw mouse JSON when the snapshot fails to parse', async () => {
    const incomplete: Record<string, unknown> = { ...mouse };
    delete incomplete.lod;
    const report = await runReadOnlyDiagnostic(fakeDevice(incomplete));

    expect(stage(report, 'snapshot')?.status).toBe('falha');
    expect(report.erroSnapshot).toContain('lod');
    expect(report.snapshot).toBeNull();
    expect(report.mouse).toMatchObject({ dn: 'Leviathan V4', cpi: 1600 });
  });

  it('flags an unexpected mouse name without discarding the response', async () => {
    const report = await runReadOnlyDiagnostic(fakeDevice({ ...mouse, dn: 'LV4 Wireless' }));

    expect(stage(report, 'nome-mouse')?.status).toBe('aviso');
    expect(stage(report, 'nome-mouse')?.detail).toContain('LV4 Wireless');
    expect(report.mouse).toMatchObject({ dn: 'LV4 Wireless' });
  });

  it('names a rejected transmission instead of blaming a sleeping mouse', async () => {
    const device = fakeDevice();
    device.sendReport = async () => {
      throw new DOMException('Failed to write the report.', 'NotAllowedError');
    };

    const report = await runReadOnlyDiagnostic(device);

    expect(stage(report, 'consulta-receptor')?.status).toBe('falha');
    expect(stage(report, 'consulta-receptor')?.detail).toContain('recusou o envio');
    expect(stage(report, 'consulta-mouse')?.detail).not.toContain('Mexa o mouse');
  });

  // The unfiltered picker can hand us any HID device; a probe built on restraint
  // should not transmit to one it already knows cannot answer.
  it('does not transmit when the vendor collection is missing', async () => {
    const device = fakeDevice() as BrowserHidDevice & { sent: Uint8Array[] };
    device.collections = [{ usagePage: 0x0001, usage: 0x0002 }];

    const report = await runReadOnlyDiagnostic(device);

    expect(stage(report, 'colecao')?.status).toBe('falha');
    expect(stage(report, 'consulta-receptor')).toBeUndefined();
    expect(device.sent).toHaveLength(0);
  });

  // The hex dump is the fallback artifact when parsing fails, so movement
  // traffic must not be able to push the vendor response out of it.
  it('keeps the vendor response even when mouse traffic floods the log', async () => {
    const report = await runReadOnlyDiagnostic(fakeDevice(mouse, 200));
    const vendor = report.relatorios.filter((entry) => entry.reportId === 0);
    const noise = report.relatorios.filter((entry) => entry.reportId !== 0);

    expect(vendor.length).toBeGreaterThan(0);
    expect(noise.length).toBeLessThanOrEqual(24);
    expect(report.mouse).toMatchObject({ dn: 'Leviathan V4' });
  });

  it('records the report ids declared by each collection', async () => {
    const report = await runReadOnlyDiagnostic(fakeDevice());

    expect(report.dispositivo.collections[0]).toMatchObject({
      inputReportIds: [0],
      outputReportIds: [0],
    });
  });

  it('transmits query events only, and registers no driver', async () => {
    const device = fakeDevice() as BrowserHidDevice & { sent: Uint8Array[] };
    await runReadOnlyDiagnostic(device);

    expect(device.sent.length).toBeGreaterThan(0);
    for (const report of device.sent) {
      const payloadStart = report[0] === 0xc0 ? 2 : 1;
      expect(report[payloadStart] & 0x0f).toBe(0x01);
    }
  });
});

describe('captureQuery', () => {
  it('survives a malformed report and still assembles a later response', async () => {
    let listener: ((reportId: number, data: Uint8Array) => void) | null = null;
    const transport: HardwareTransport = {
      open: vi.fn(async () => undefined),
      send: vi.fn(async () => {
        queueMicrotask(() => {
          const malformed = new Uint8Array(64).fill(0x11);
          malformed[0] = 0x8a;
          listener?.(0, malformed);
          queryReports(receiver, false).forEach((report) => listener?.(0, report));
        });
      }),
      onInputReport(next) {
        listener = next;
        return () => {
          listener = null;
        };
      },
    };

    const log: Parameters<typeof captureQuery>[2] = [];
    const result = await captureQuery(transport, 'fisico', log, 200);

    expect(result.raw).toMatchObject({ pi: 0x2346 });
    expect(log.length).toBe(2);
  });

  it('reports the last decoding error when nothing assembles before the timeout', async () => {
    let listener: ((reportId: number, data: Uint8Array) => void) | null = null;
    const transport: HardwareTransport = {
      open: vi.fn(async () => undefined),
      send: vi.fn(async () => {
        // Data marker set, so it reaches the assembler; body has no FF preamble.
        const malformed = new Uint8Array(64).fill(0x11);
        malformed[0] = 0x8a;
        queueMicrotask(() => listener?.(0, malformed));
      }),
      onInputReport(next) {
        listener = next;
        return () => {
          listener = null;
        };
      },
    };

    const result = await captureQuery(transport, 'fisico', [], 30);

    expect(result.raw).toBeNull();
    expect(result.error).toContain('preâmbulo');
  });
});

describe('requestDiagnosticDevice', () => {
  // Selecting a sibling interface of the same receiver is what the first real
  // bring-up hit: the picker showed identical rows and the consumer-control
  // interface came back, with no output reports to answer on.
  it('asks the picker for the vendor configuration collection', async () => {
    const requestDevice = vi.fn(async () => []);
    await requestDiagnosticDevice({ requestDevice } as never);

    expect(requestDevice).toHaveBeenCalledWith({
      filters: [{ vendorId: 0x1915, usagePage: 0xff00, usage: 0x0001 }],
    });
  });

  it('drops every filter when asked to show all devices', async () => {
    const requestDevice = vi.fn(async () => []);
    await requestDiagnosticDevice({ requestDevice } as never, true);

    expect(requestDevice).toHaveBeenCalledWith({ filters: [] });
  });
});
