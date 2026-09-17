import { describe, expect, it } from 'vitest';
import {
  dpiAxes,
  encodeAction,
  encodeConfigReset,
  encodeMouseFunction,
  encodeMouseKey,
  encodeMouseParamSnapshot,
  parseNotification,
  type RawMouseKey,
  withProtocolEnvelope,
} from './coreBridge';

function bytes(value: Uint8Array): number[] {
  return [...value];
}

/**
 * Builds a notify event the way the mouse sends one — same shape the deleted
 * TypeScript `notifyEvent` helper and the Rust `notify()` test helper both use.
 */
function notifyEvent(kind: number, payload: number[]): Uint8Array {
  return withProtocolEnvelope([0x0b, 0, kind, ...payload], false);
}

describe('RAWM core encoders', () => {
  it('encodes a complete mouse parameter snapshot without dropping unknown bytes', () => {
    const snapshot = {
      bytes: Uint8Array.from([0x10, 0x20, 0x30, 0xfe, 0xed]),
      decodedKnownField: 0x10,
      decodedUnknownField: 'kept outside the typed view',
    };

    expect(bytes(encodeMouseParamSnapshot(snapshot))).toEqual([
      0x03, 0x00, 0x15, 0x10, 0x20, 0x30, 0xfe, 0xed,
    ]);
  });

  it('encodes an action with a little-endian 32-bit argument', () => {
    expect(bytes(encodeAction({ action: 0x34, value: 0x01020304 }))).toEqual([
      0x06, 0x00, 0x34, 0x04, 0x03, 0x02, 0x01,
    ]);
  });

  it('encodes config reset without adding transport framing', () => {
    expect(bytes(encodeConfigReset())).toEqual([0x03, 0x00, 0x03]);
  });

  it('encodes a mouse key assignment in the RAWM field order', () => {
    expect(
      bytes(
        encodeMouseKey({
          keyIds: [0x12, 0x34],
          modifier1: 0x56,
          modifier2: 0x78,
          keyType: 0x01,
          keyCode: 0x9a,
        }),
      ),
    ).toEqual([0x03, 0x00, 0x16, 0x02, 0x12, 0x34, 0x56, 0x01, 0x9a, 0x78, 0x00]);
  });

  it('always emits zero for the reserved mouse-key byte', () => {
    const legacyInput = {
      keyIds: [0x12, 0x34],
      modifier1: 0x56,
      modifier2: 0x78,
      keyType: 0x01,
      keyCode: 0x9a,
      keyEvent: 0xbc,
    } as unknown as RawMouseKey;

    expect(bytes(encodeMouseKey(legacyInput))).toEqual([
      0x03, 0x00, 0x16, 0x02, 0x12, 0x34, 0x56, 0x01, 0x9a, 0x78, 0x00,
    ]);
  });

  it('encodes a mouse function with a little-endian value and text bytes', () => {
    expect(
      bytes(
        encodeMouseFunction({
          keyIds: [0xaa],
          touchType: 0x02,
          functionId: 0x10,
          value: 0x1234,
          text: 'F',
        }),
      ),
    ).toEqual([0x03, 0x00, 0x18, 0x01, 0xaa, 0x02, 0x10, 0x34, 0x12, 0x00, 0x01, 0x00, 0x46]);
  });
});

/**
 * `notifications.test.ts` only exercises `parseNotification` through
 * `subscribeToNotifications`, and every case there sends a `dpi` event. That
 * leaves the flatten in `core-wasm` (`RawmNotification` → `[kind, value,
 * payload]`) and the reassemble here (`[kind, value, payload]` → the
 * `RawmNotification` union) untested for the other four kinds — a swapped
 * field, or `onboard-config` silently degrading to an empty payload through
 * the `payload ?? new Uint8Array()` fallback, would pass every other suite
 * and only surface on hardware. This exercises the real WASM crossing for
 * all five kinds and asserts the full reassembled shape each time.
 */
describe('parseNotification e dpiAxes através da ponte', () => {
  it('reassembles a DPI change', () => {
    expect(parseNotification(notifyEvent(0x00, [0x20, 0x03]))).toEqual({
      kind: 'dpi',
      value: 800,
    });
  });

  it('reassembles the packed 32-bit value used for independent axes', () => {
    expect(parseNotification(notifyEvent(0x06, [0x20, 0x03, 0x90, 0x01]))).toEqual({
      kind: 'dpi-xy',
      value: 0x0190_0320,
    });
  });

  it('reassembles a polling rate change', () => {
    expect(parseNotification(notifyEvent(0x01, [0xa0, 0x0f]))).toEqual({
      kind: 'polling',
      value: 4000,
    });
  });

  it('reassembles the onboard index as a zero-based byte, under the index field', () => {
    expect(parseNotification(notifyEvent(0x22, [2]))).toEqual({
      kind: 'onboard-index',
      index: 2,
    });
  });

  it('reassembles an onboard config payload with its bytes intact, not just its presence', () => {
    const notification = parseNotification(notifyEvent(0x14, [0xaa, 0xbb, 0xcc]));

    expect(notification?.kind).toBe('onboard-config');
    expect(bytes((notification as { payload: Uint8Array }).payload)).toEqual([0xaa, 0xbb, 0xcc]);
  });

  it('returns null for a notification this app has no use for', () => {
    expect(parseNotification(notifyEvent(0x17, [50]))).toBeNull();
  });

  it('unpacks DPI axes through the real wasm', () => {
    expect(dpiAxes(0x0190_0320)).toEqual({ x: 800, y: 400 });
    expect(dpiAxes(800)).toEqual({ x: 800, y: 800 });
  });
});
