import { describe, expect, it, vi } from 'vitest';
import { leviathanV4QueryFixture } from './leviathanV4Fixture';
import type { HidCommand } from '@gearhub/shared';
import type { HardwareTransport } from '../WebHidTransport';
import { createLeviathanV4Peripheral } from './leviathanV4';
import { encodeLeviathanAction, LeviathanV4Driver, mappingEvents } from './LeviathanV4Driver';

const raw = {
  dn: 'Leviathan V4',
  pi: 0x2346,
  vi: 0x1915,
  crc: 0,
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

function transport(): HardwareTransport & { send: ReturnType<typeof vi.fn> } {
  return {
    open: vi.fn(async () => undefined),
    send: vi.fn(async () => undefined),
    onInputReport: vi.fn(() => () => undefined),
  };
}

describe('LeviathanV4Driver', () => {
  it('encodes confirmed mouse, wheel, DPI and R-Plus action shapes', () => {
    expect([...encodeLeviathanAction([1], 'clique-esquerdo')!]).toEqual([
      3, 0, 0x16, 1, 1, 0, 1, 1, 0, 0,
    ]);
    expect([...encodeLeviathanAction([7], 'dpi-ciclo')!]).toEqual([
      3, 0, 0x18, 1, 7, 2, 1, 0, 0, 0, 0, 0,
    ]);
    expect([...encodeLeviathanAction([6, 1], 'rolagem-cima')!]).toEqual([
      3, 0, 0x16, 2, 6, 1, 0, 3, 0x41, 0, 0,
    ]);
    expect(encodeLeviathanAction([1], 'desativado')).toBeNull();
  });

  it('serializes a complete live configuration through the virtual mouse channel', async () => {
    const io = transport();
    const driver = new LeviathanV4Driver(io, raw, false);
    const settings = createLeviathanV4Peripheral(raw, 'id').defaults;
    await driver.applyToSession(settings);

    expect(io.send).toHaveBeenCalled();
    const reports = io.send.mock.calls.map(([command]) => (command as HidCommand).data);
    expect(reports.every((report: Uint8Array) => report[0] === 0xc0)).toBe(true);
  });
});

// Confirmed on hardware: CONFIG_RESET clears every mapping the mouse holds, and
// a reset followed by a single mapping left the scroll wheel dead until a power
// cycle. The mapping set below cannot restore it, so it must not be sent.
describe('mapping set completeness', () => {
  it('covers no wheel key id, which is why mappings stay unsent', () => {
    const settings = createLeviathanV4Peripheral(leviathanV4QueryFixture, 'real').defaults;

    const events = mappingEvents(settings);

    // Every event is a mouse-key or mouse-function type, none of them a wheel.
    const wheelEvents = events.filter((event) => event[2] === 0x16 && event[6] === 0x03);
    expect(wheelEvents).toHaveLength(0);
  });

  it('applies a parameter change without resetting the configuration', async () => {
    const sent: Uint8Array[] = [];
    const transport = {
      open: async () => undefined,
      send: async (command: { data: Uint8Array }) => {
        sent.push(command.data);
      },
      onInputReport: () => () => undefined,
    };
    const driver = new LeviathanV4Driver(transport, leviathanV4QueryFixture, true);
    const settings = createLeviathanV4Peripheral(leviathanV4QueryFixture, 'real').defaults;

    await driver.applyToSession({ ...settings, pollingRate: 1000 });

    const stream = Uint8Array.from(sent.flatMap((report) => [...report.slice(2)]));
    // The parameter type only; no config reset (inner type 0x03) was sent.
    expect(stream[7]).toBe(0x15);
    expect(sent.length).toBeGreaterThan(0);
  });

  it('refuses to write a profile until the sequence is verified', async () => {
    const transport = {
      open: async () => undefined,
      send: async () => undefined,
      onInputReport: () => () => undefined,
    };
    const driver = new LeviathanV4Driver(transport, leviathanV4QueryFixture, true);
    const settings = createLeviathanV4Peripheral(leviathanV4QueryFixture, 'real').defaults;

    await expect(driver.writeProfile(1, 'Perfil 1', settings)).rejects.toThrow(
      'nao foi verificada',
    );
  });
});
