import { describe, expect, it, vi } from 'vitest';
import type { HardwareTransport } from '../WebHidTransport';
import {
  parseNotification,
  subscribeToNotifications,
  type RawmNotification,
} from './notifications';
import { frameEvent, withProtocolEnvelope } from './protocol';

/** Builds a notify event the way the mouse sends one. */
function notifyEvent(type: number, payload: number[]): Uint8Array {
  return withProtocolEnvelope([0x0b, 0, type, ...payload], false);
}

describe('parseNotification', () => {
  // Cycling DPI with the button is the case this exists for.
  it('reads a DPI change as a little-endian 16-bit value', () => {
    expect(parseNotification(notifyEvent(0x00, [0x20, 0x03]))).toEqual({
      kind: 'dpi',
      value: 800,
    });
  });

  it('reads the packed 32-bit value used for independent axes', () => {
    expect(parseNotification(notifyEvent(0x06, [0x20, 0x03, 0x90, 0x01]))).toEqual({
      kind: 'dpi-xy',
      value: 0x01900320,
    });
  });

  it('reads a polling rate change', () => {
    expect(parseNotification(notifyEvent(0x01, [0xa0, 0x0f]))).toEqual({
      kind: 'polling',
      value: 4000,
    });
  });

  it('ignores notifications this app has no use for', () => {
    expect(parseNotification(notifyEvent(0x17, [50]))).toBeNull();
  });

  it('ignores an event that is not a notification', () => {
    expect(parseNotification(withProtocolEnvelope([0x02, 0, 0x7b, 0x7d], false))).toBeNull();
  });

  it('ignores a truncated payload rather than reporting a wrong value', () => {
    expect(parseNotification(notifyEvent(0x00, [0x20]))).toBeNull();
  });
});

describe('subscribeToNotifications', () => {
  function fakeTransport() {
    let listener: ((reportId: number, data: Uint8Array) => void) | null = null;
    const transport: HardwareTransport = {
      open: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined),
      onInputReport(next) {
        listener = next;
        return () => {
          listener = null;
        };
      },
    };
    return {
      transport,
      emit(event: Uint8Array) {
        const framed = frameEvent(Uint8Array.from([0xff, 0xff, 0xff, 0xff, ...event]), true);
        framed.forEach((report) => listener?.(0, report));
      },
      emitRaw(report: Uint8Array) {
        listener?.(0, report);
      },
      get listening() {
        return listener !== null;
      },
    };
  }

  it('reports DPI changes while the device stays connected', () => {
    const fake = fakeTransport();
    const seen: RawmNotification[] = [];
    subscribeToNotifications(fake.transport, (notification) => seen.push(notification));

    fake.emit(notifyEvent(0x00, [0x20, 0x03]));
    fake.emit(notifyEvent(0x00, [0x40, 0x06]));

    expect(seen).toEqual([
      { kind: 'dpi', value: 800 },
      { kind: 'dpi', value: 1600 },
    ]);
  });

  // The same endpoint carries the receiver's own frames.
  it('keeps listening after a report it cannot decode', () => {
    const fake = fakeTransport();
    const seen: RawmNotification[] = [];
    subscribeToNotifications(fake.transport, (notification) => seen.push(notification));

    fake.emitRaw(new Uint8Array(64).fill(0x11));
    fake.emit(notifyEvent(0x00, [0x20, 0x03]));

    expect(seen).toEqual([{ kind: 'dpi', value: 800 }]);
  });

  it('stops listening when unsubscribed', () => {
    const fake = fakeTransport();
    const unsubscribe = subscribeToNotifications(fake.transport, () => undefined);

    unsubscribe();

    expect(fake.listening).toBe(false);
  });
});
