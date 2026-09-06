import { describe, expect, it } from 'vitest';
import {
  RawEventAssembler,
  buildQueryEvent,
  crc16,
  decodeReportChunk,
  frameEvent,
  parseQueryJson,
  withProtocolEnvelope,
} from './protocol';

describe('RAWM protocol envelope', () => {
  it('writes the 12-bit event length into the header', () => {
    expect([...withProtocolEnvelope([0x03, 0x00, 0x15], false)]).toEqual([0x03, 0x03, 0x15]);

    const long = new Array(0x123).fill(0);
    long[0] = 0x03;
    expect([...withProtocolEnvelope(long, false).slice(0, 2)]).toEqual([0x13, 0x23]);
  });

  it('matches the vendor CRC16 routine', () => {
    expect(crc16(new TextEncoder().encode('123456789'))).toBe(0x29b1);
  });

  it('wraps CRC little-endian around an already length-coded inner event', () => {
    expect([...withProtocolEnvelope([0x06, 0, 0x34, 0, 0, 0, 0], true)]).toEqual([
      0x03, 0x0c, 0x24, 0x42, 0x1d, 0x06, 0x07, 0x34, 0, 0, 0, 0,
    ]);
  });
});

describe('RAWM query and HID framing', () => {
  it('builds a deterministic PC query with an eight-byte timestamp', () => {
    expect([...buildQueryEvent(0x12345678)]).toEqual([
      0x01, 0x0d, 0x03, 0x00, 0x00, 0x78, 0x56, 0x34, 0x12, 0, 0, 0, 0,
    ]);
  });

  it('uses 63-byte physical chunks and pads each 64-byte report', () => {
    const reports = frameEvent(Uint8Array.from({ length: 70 }, (_, index) => index), false);
    expect(reports).toHaveLength(2);
    expect(reports[0]).toHaveLength(64);
    expect(reports[0][0]).toBe(0xbf);
    expect([...decodeReportChunk(reports[0], false)]).toEqual(
      Array.from({ length: 63 }, (_, index) => index),
    );
    expect(reports[1][0]).toBe(0x87);
  });

  it('reserves the first byte for the virtual mouse channel', () => {
    const reports = frameEvent(Uint8Array.from({ length: 63 }, (_, index) => index), true);
    expect(reports).toHaveLength(2);
    expect([...reports[0].slice(0, 3)]).toEqual([0xc0, 0xbe, 0]);
    expect([...decodeReportChunk(reports[0], true)]).toEqual(
      Array.from({ length: 62 }, (_, index) => index),
    );
  });

  it('reassembles the FF preamble and event only after the declared length arrives', () => {
    const event = withProtocolEnvelope([0x02, 0, 0x7b, 0x7d], false);
    const response = Uint8Array.from([0xff, 0xff, 0xff, 0xff, ...event]);
    const assembler = new RawEventAssembler();

    expect(assembler.push(response.slice(0, 3))).toBeNull();
    expect(assembler.push(response.slice(3, 6))).toBeNull();
    expect([...assembler.push(response.slice(6))!]).toEqual([...event]);
  });

  it('rejects a response without the four-byte preamble', () => {
    const assembler = new RawEventAssembler();
    expect(() => assembler.push(Uint8Array.from([0, 0, 0, 0, 0x02, 0x02]))).toThrow(
      'preâmbulo',
    );
  });

  it('extracts JSON only from a complete query-result command', () => {
    const json = new TextEncoder().encode('{"dn":"Leviathan V4","pi":9026}\u0000');
    const event = withProtocolEnvelope([0x02, 0, ...json], false);
    expect(parseQueryJson(event)).toMatchObject({ dn: 'Leviathan V4', pi: 9026 });
  });
});
