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
    const reports = frameEvent(
      Uint8Array.from({ length: 70 }, (_, index) => index),
      false,
    );
    expect(reports).toHaveLength(2);
    expect(reports[0]).toHaveLength(64);
    expect(reports[0][0]).toBe(0xbf);
    expect([...decodeReportChunk(reports[0], false)!]).toEqual(
      Array.from({ length: 63 }, (_, index) => index),
    );
    expect(reports[1][0]).toBe(0x87);
  });

  it('reserves the first byte for the virtual mouse channel', () => {
    const reports = frameEvent(
      Uint8Array.from({ length: 63 }, (_, index) => index),
      true,
    );
    expect(reports).toHaveLength(2);
    expect([...reports[0].slice(0, 3)]).toEqual([0xc0, 0xbe, 0]);
    expect([...decodeReportChunk(reports[0], true)!]).toEqual(
      Array.from({ length: 62 }, (_, index) => index),
    );
  });

  it('reassembles the FF preamble and event only after the declared length arrives', () => {
    const event = withProtocolEnvelope([0x02, 0, 0x7b, 0x7d], false);
    const response = Uint8Array.from([0xff, 0xff, 0xff, 0xff, ...event]);
    const assembler = new RawEventAssembler();

    expect(assembler.push(response.slice(0, 3))).toEqual([]);
    expect(assembler.push(response.slice(3, 6))).toEqual([]);
    expect([...assembler.push(response.slice(6))[0]]).toEqual([...event]);
  });

  it('rejects a response without the four-byte preamble', () => {
    const assembler = new RawEventAssembler();
    expect(() => assembler.push(Uint8Array.from([0, 0, 0, 0, 0x02, 0x02]))).toThrow('preâmbulo');
  });

  it('extracts JSON only from a complete query-result command', () => {
    const json = new TextEncoder().encode('{"dn":"Leviathan V4","pi":9026}\u0000');
    const event = withProtocolEnvelope([0x02, 0, ...json], false);
    expect(parseQueryJson(event)).toMatchObject({ dn: 'Leviathan V4', pi: 9026 });
  });
});

// Framing observed on real hardware: the receiver packs events back to back in
// the byte stream, so a single 30-byte chunk can carry the tail of one event
// and the head of the next. Dropping that surplus loses the following event and
// leaves the assembler mid-JSON, which reads as a missing preamble.
describe('RawEventAssembler with real receiver framing', () => {
  function event(cmd: number, body: number[]): number[] {
    const length = body.length + 2;
    return [0xff, 0xff, 0xff, 0xff, (cmd & 0x0f) | ((length >> 4) & 0xf0), length & 0xff, ...body];
  }

  it('emits both events when one chunk spans the boundary', () => {
    const stream = [...event(0x02, [1, 2, 3]), ...event(0x0b, [4, 5])];
    const assembler = new RawEventAssembler();

    const events = assembler.push(Uint8Array.from(stream));

    expect(events).toHaveLength(2);
    expect(events[0][0] & 0x0f).toBe(0x02);
    expect([...events[0].slice(2)]).toEqual([1, 2, 3]);
    expect(events[1][0] & 0x0f).toBe(0x0b);
  });

  it('carries a partial event across chunks', () => {
    const stream = event(0x02, [9, 9, 9, 9, 9, 9]);
    const assembler = new RawEventAssembler();

    expect(assembler.push(Uint8Array.from(stream.slice(0, 5)))).toEqual([]);
    const events = assembler.push(Uint8Array.from(stream.slice(5)));

    expect(events).toHaveLength(1);
    expect([...events[0].slice(2)]).toEqual([9, 9, 9, 9, 9, 9]);
  });
});

describe('decodeReportChunk on non-data reports', () => {
  // The receiver interleaves frames without the 0x80 marker. Three showed up in
  // the real capture; they are its own traffic, not corruption.
  it('returns null instead of throwing', () => {
    const report = new Uint8Array(64);
    report[0] = 0xc0;
    report[1] = 0x52;

    expect(decodeReportChunk(report, true)).toBeNull();
  });
});
