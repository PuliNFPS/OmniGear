import { describe, expect, it, vi } from 'vitest';
import type { BrowserHidDevice } from '../deviceDiscovery';
import type { HidInputReportEvent } from '../WebHidTransport';
import { leviathanV4QueryFixture } from './leviathanV4Fixture';
import { parseMouseParamState } from './mouseParamSnapshot';
import { frameEvent, withProtocolEnvelope } from './protocol';
import { compareStates, probePollingWrite } from './writeProbe';

function queryReports(value: Record<string, unknown>): Uint8Array[] {
  const json = new TextEncoder().encode(`${JSON.stringify(value)}\0`);
  const event = withProtocolEnvelope([2, 0, ...json], false);
  return frameEvent(Uint8Array.from([0xff, 0xff, 0xff, 0xff, ...event]), true);
}

/** Answers queries from `state`, and records everything that is not a query. */
function fakeMouse(options: { ignoreWrites?: boolean } = {}) {
  const listeners = new Set<(event: HidInputReportEvent) => void>();
  let state: Record<string, unknown> = { ...leviathanV4QueryFixture };
  const writes: Uint8Array[] = [];
  let stream = new Uint8Array();

  const device = {
    vendorId: 0x1915,
    productId: 0x2346,
    productName: 'RAWM HS Receiver',
    opened: false,
    collections: [{ usagePage: 0xff00, usage: 1 }],
    async open() {
      device.opened = true;
    },
    async sendReport(_reportId: number, data: BufferSource) {
      const report = new Uint8Array(data as ArrayBuffer);
      const payload = report.slice(2, 2 + (report[1] & 0x3f));
      // A query event carries command 0x01 in the low nibble of its first byte.
      if ((payload[0] & 0x0f) === 0x01) {
        const responses = queryReports(state);
        queueMicrotask(() =>
          responses.forEach((response) => {
            const copied = response.slice();
            const event = { reportId: 0, data: new DataView(copied.buffer) };
            listeners.forEach((listener) => listener(event));
          }),
        );
        return;
      }
      writes.push(payload);
      stream = Uint8Array.from([...stream, ...payload]);
      const declared = ((stream[0] & 0xf0) << 4) | stream[1];
      if (!options.ignoreWrites && stream.length >= declared) {
        // Outer CRC envelope (5 bytes) + inner config header (3), then the body:
        // u16 resolution, u16 polling. Decoding it here is what proves the
        // encoder puts the polling rate where the firmware reads it.
        state = { ...state, polling: stream[10] | (stream[11] << 8) };
        stream = new Uint8Array();
      }
    },
    addEventListener(_type: 'inputreport', listener: (event: HidInputReportEvent) => void) {
      listeners.add(listener);
    },
    removeEventListener(_type: 'inputreport', listener: (event: HidInputReportEvent) => void) {
      listeners.delete(listener);
    },
  };

  return {
    device: device as unknown as BrowserHidDevice,
    writes,
  };
}

describe('probePollingWrite', () => {
  it('confirms the round trip when the mouse reports the new value', async () => {
    const mouse = fakeMouse();

    const report = await probePollingWrite(mouse.device, 1000, { settleMs: 0 });

    expect(report.erro).toBeNull();
    expect(report.alvo.de).toBe(4000);
    expect(report.alvo).toMatchObject({ campo: 'pollingRate', para: 1000 });
    expect(report.depois?.pollingRate).toBe(1000);
    expect(report.divergencias).toEqual([]);
    expect(report.confirmado).toBe(true);
    expect(report.conclusivo).toBe(true);
  });

  // Writing the value the mouse already holds reads back clean whether or not
  // the event was accepted, so it must not be reported as evidence.
  it('marks a write of the current value as inconclusive', async () => {
    const mouse = fakeMouse();

    const report = await probePollingWrite(mouse.device, 4000, { settleMs: 0 });

    expect(report.divergencias).toEqual([]);
    expect(report.confirmado).toBe(true);
    expect(report.conclusivo).toBe(false);
    expect(report.erro).toContain('já estava em 4000 Hz');
  });

  // The point of the probe: a wrong byte layout must surface as a named field,
  // not as a mouse quietly behaving differently.
  it('names every field that moved when the write does not land', async () => {
    const mouse = fakeMouse({ ignoreWrites: true });

    const report = await probePollingWrite(mouse.device, 1000, { settleMs: 0 });

    expect(report.confirmado).toBe(false);
    expect(report.divergencias).toContainEqual({
      campo: 'pollingRate',
      esperado: 1000,
      obtido: 4000,
    });
  });

  // Nothing may reach flash: a power cycle has to undo this test.
  it('sends one parameter event, with no reset and no save to flash', async () => {
    const mouse = fakeMouse();

    await probePollingWrite(mouse.device, 1000, { settleMs: 0 });

    // The parameter event exceeds the 62-byte virtual payload, so it arrives as
    // more than one report. What matters is that it is a single event.
    const stream = Uint8Array.from(mouse.writes.flatMap((write) => [...write]));
    const declared = ((stream[0] & 0xf0) << 4) | stream[1];
    expect(declared).toBe(stream.length);

    // Outer config event carrying the CRC wrapper, inner one the parameter type.
    expect(stream[0] & 0x0f).toBe(0x03);
    expect(stream[2]).toBe(0x24);
    expect(stream[7]).toBe(0x15);
    // Neither a config reset (inner type 0x03) nor any action event (cmd 0x06).
    expect(stream[7]).not.toBe(0x03);
    expect(mouse.writes.some((write) => (write[0] & 0x0f) === 0x06)).toBe(false);
  });

  it('reports the mouse falling silent instead of claiming success', async () => {
    const device = {
      vendorId: 0x1915,
      productId: 0x2346,
      opened: true,
      collections: [{ usagePage: 0xff00, usage: 1 }],
      open: vi.fn(async () => undefined),
      sendReport: vi.fn(async () => undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as BrowserHidDevice;

    const report = await probePollingWrite(device, 1000, { timeoutMs: 20, settleMs: 0 });

    expect(report.confirmado).toBe(false);
    expect(report.erro).toContain('Leitura antes da escrita falhou');
  });
});

describe('compareStates', () => {
  it('ignores fields that match and reports the ones that do not', () => {
    const base = parseMouseParamState(leviathanV4QueryFixture);

    expect(compareStates(base, base)).toEqual([]);
    expect(compareStates({ ...base, liftOffDistance: 3 }, base)).toEqual([
      { campo: 'liftOffDistance', esperado: 3, obtido: 2 },
    ]);
  });
});
