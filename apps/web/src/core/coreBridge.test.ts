import { describe, expect, it } from 'vitest';
import {
  encodeAction,
  encodeConfigReset,
  encodeMouseFunction,
  encodeMouseKey,
  encodeMouseParamSnapshot,
  type RawMouseKey,
} from './coreBridge';

function bytes(value: Uint8Array): number[] {
  return [...value];
}

describe('RAWM core encoders', () => {
  it('encodes a complete mouse parameter snapshot without dropping unknown bytes', () => {
    const snapshot = {
      bytes: Uint8Array.from([0x10, 0x20, 0x30, 0xfe, 0xed]),
      decodedKnownField: 0x10,
      decodedUnknownField: 'kept outside the typed view',
    };

    expect(bytes(encodeMouseParamSnapshot(snapshot))).toEqual([
      0x03,
      0x00,
      0x15,
      0x10,
      0x20,
      0x30,
      0xfe,
      0xed,
    ]);
  });

  it('encodes an action with a little-endian 32-bit argument', () => {
    expect(bytes(encodeAction({ action: 0x34, value: 0x01020304 }))).toEqual([
      0x06,
      0x00,
      0x34,
      0x04,
      0x03,
      0x02,
      0x01,
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
      0x03,
      0x00,
      0x16,
      0x02,
      0x12,
      0x34,
      0x56,
      0x01,
      0x9a,
      0x78,
      0x00,
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
