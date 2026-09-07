import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HardwareTransport } from '../WebHidTransport';
import { frameEvent, withProtocolEnvelope } from './protocol';
import { queryRawmDevice } from './session';

afterEach(() => vi.useRealTimers());

function queryResult(value: Record<string, unknown>, virtualMouse: boolean) {
  const json = new TextEncoder().encode(`${JSON.stringify(value)}\u0000`);
  const event = withProtocolEnvelope([0x02, 0, ...json], false);
  return frameEvent(Uint8Array.from([0xff, 0xff, 0xff, 0xff, ...event]), virtualMouse);
}

function respondingTransport(responses: Uint8Array[]): HardwareTransport {
  let listener: ((reportId: number, data: Uint8Array) => void) | null = null;
  return {
    open: vi.fn(async () => undefined),
    send: vi.fn(async () => {
      queueMicrotask(() => responses.forEach((response) => listener?.(0, response)));
    }),
    onInputReport(next) {
      listener = next;
      return () => {
        listener = null;
      };
    },
  };
}

describe('queryRawmDevice', () => {
  it('counts opening the device against the query timeout', async () => {
    vi.useFakeTimers();
    const transport: HardwareTransport = {
      open: () => new Promise<void>(() => undefined),
      send: vi.fn(async () => undefined),
      onInputReport: vi.fn(() => () => undefined),
    };
    const query = queryRawmDevice(transport, { timeoutMs: 5 });
    let failure: unknown;
    void query.catch((error: unknown) => {
      failure = error;
    });

    await vi.advanceTimersByTimeAsync(5);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain('tempo limite');
  });

  it('queries and validates the physical receiver identity', async () => {
    const response = queryResult({ dn: 'RAWM HS Receiver', vi: 0x1915, pi: 0x2346, crc: 1 }, false);
    const transport = respondingTransport(response);

    await expect(
      queryRawmDevice(transport, { virtualMouse: false, epochSeconds: 0x12345678 }),
    ).resolves.toMatchObject({ productId: 0x2346, vendorId: 0x1915, crcSupported: true });
    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({ reportId: 0, data: expect.any(Uint8Array) }),
    );
  });

  it('removes a listener that answers synchronously during registration', async () => {
    const responses = queryResult(
      { dn: 'RAWM HS Receiver', vi: 0x1915, pi: 0x2346, crc: 1 },
      false,
    );
    const unsubscribe = vi.fn();
    const transport: HardwareTransport = {
      open: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined),
      onInputReport(listener) {
        responses.forEach((response) => listener(0, response));
        return unsubscribe;
      },
    };

    await expect(queryRawmDevice(transport)).resolves.toMatchObject({ productId: 0x2346 });
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(transport.send).not.toHaveBeenCalled();
  });

  it('requires product identity instead of accepting arbitrary JSON', async () => {
    const response = queryResult({ message: 'ok' }, false);
    await expect(queryRawmDevice(respondingTransport(response))).rejects.toThrow('identidade');
  });

  it('times out and removes the report listener', async () => {
    const unsubscribe = vi.fn();
    const transport: HardwareTransport = {
      open: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined),
      onInputReport: () => unsubscribe,
    };

    await expect(queryRawmDevice(transport, { timeoutMs: 5 })).rejects.toThrow('tempo');
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
