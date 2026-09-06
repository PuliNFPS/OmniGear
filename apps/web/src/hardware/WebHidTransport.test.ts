import { describe, expect, it, vi } from 'vitest';
import { WebHidTransport, type HidInputReportEvent } from './WebHidTransport';

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
