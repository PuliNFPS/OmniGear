import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebHidTransport, type HidInputReportEvent } from './WebHidTransport';

afterEach(() => vi.useRealTimers());

function fakeDevice() {
  let listener: ((event: HidInputReportEvent) => void) | null = null;
  return {
    device: {
      opened: false,
      open: vi.fn(async function (this: { opened: boolean }) {
        this.opened = true;
      }),
      sendReport: vi.fn(async () => undefined),
      addEventListener: vi.fn(
        (_type: 'inputreport', next: (event: HidInputReportEvent) => void) => {
          listener = next;
        },
      ),
      removeEventListener: vi.fn(() => {
        listener = null;
      }),
    },
    emit(bytes: number[]) {
      const data = Uint8Array.from(bytes);
      listener?.({ reportId: 0, data: new DataView(data.buffer) });
    },
  };
}

describe('WebHidTransport', () => {
  it('rejects when opening the HID device exceeds the operation timeout', async () => {
    vi.useFakeTimers();
    const fake = fakeDevice();
    fake.device.open.mockImplementation(() => new Promise<undefined>(() => undefined));
    const opening = new WebHidTransport(fake.device, { operationTimeoutMs: 5 }).open();
    let failure: unknown;
    void opening.catch((error: unknown) => {
      failure = error;
    });

    await vi.advanceTimersByTimeAsync(5);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain('abrir');
  });

  it('rejects when sending a HID report exceeds the operation timeout', async () => {
    vi.useFakeTimers();
    const fake = fakeDevice();
    fake.device.opened = true;
    fake.device.sendReport.mockImplementation(() => new Promise<undefined>(() => undefined));
    const sending = new WebHidTransport(fake.device, { operationTimeoutMs: 5 }).send({
      reportId: 0,
      data: Uint8Array.from([1]),
    });
    let failure: unknown;
    void sending.catch((error: unknown) => {
      failure = error;
    });

    await vi.advanceTimersByTimeAsync(5);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain('enviar');
  });

  it('opens once and sends report data', async () => {
    const fake = fakeDevice();
    const transport = new WebHidTransport(fake.device);

    await transport.send({ reportId: 0, data: Uint8Array.from([1, 2, 3]) });
    await transport.send({ reportId: 0, data: Uint8Array.from([4]) });

    expect(fake.device.open).toHaveBeenCalledTimes(1);
    expect(fake.device.sendReport).toHaveBeenCalledTimes(2);
  });

  it('subscribes to input reports and returns an unsubscribe function', () => {
    const fake = fakeDevice();
    const transport = new WebHidTransport(fake.device);
    const received: number[][] = [];

    const unsubscribe = transport.onInputReport((reportId, data) => {
      received.push([reportId, ...data]);
    });
    fake.emit([7, 8]);
    unsubscribe();
    fake.emit([9]);

    expect(received).toEqual([[0, 7, 8]]);
    expect(fake.device.removeEventListener).toHaveBeenCalledOnce();
  });
});
