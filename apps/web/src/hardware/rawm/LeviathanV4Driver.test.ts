import { describe, expect, it, vi } from 'vitest';
import { leviathanV4QueryFixture } from './leviathanV4Fixture';
import type { HidCommand } from '@gearhub/shared';
import type { HardwareTransport } from '../WebHidTransport';
import { createLeviathanV4Peripheral } from './leviathanV4';
import { LeviathanV4Driver, mappingEvents } from './LeviathanV4Driver';

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
describe('writing a configuration', () => {
  function recordingDriver() {
    const sent: Uint8Array[] = [];
    const transport = {
      open: async () => undefined,
      send: async (command: { data: Uint8Array }) => {
        sent.push(command.data);
      },
      onInputReport: () => () => undefined,
    };
    return {
      sent,
      driver: new LeviathanV4Driver(transport, leviathanV4QueryFixture, true),
      settings: createLeviathanV4Peripheral(leviathanV4QueryFixture, 'real').defaults,
    };
  }

  // Report layout: [0] virtual channel, [1] chunk header, then the event.
  // With the CRC envelope that is [2] cmd, [3] len, [4] 0x24, [5..6] crc,
  // [7] inner cmd, [8] inner len, [9] inner type, [10..] payload.
  const innerCommand = (report: Uint8Array) => report[7];
  const innerType = (report: Uint8Array) => report[9];

  it('opens with a config reset and resends the whole mapping set', async () => {
    const { sent, driver, settings } = recordingDriver();

    await driver.applyToSession({ ...settings, pollingRate: 1000 });
    const types = sent.map(innerType);

    expect(types).toContain(0x03); // config reset
    expect(types).toContain(0x15); // parameters
    expect(types.filter((type) => type === 0x16 || type === 0x18).length).toBeGreaterThan(5);
  });

  // CONFIG_RESET clears it too, and no editor control would ever rebuild it.
  it('rebuilds the seventh key the editor never exposes', async () => {
    const { settings } = recordingDriver();

    const events = mappingEvents(settings);
    const showPower = events.find((event) => event[2] === 0x18 && event[4] === 0x0d);

    expect(showPower).toBeDefined();
    expect(showPower![6]).toBe(0x0e); // show-power function id
  });

  it('applies to the session without committing to flash', async () => {
    const { sent, driver, settings } = recordingDriver();

    await driver.applyToSession(settings);

    // Action events carry command 0x06; a session apply sends none.
    expect(sent.some((report) => innerCommand(report) === 0x06)).toBe(false);
  });

  it('brackets a profile write with the saves that commit it', async () => {
    const { sent, driver, settings } = recordingDriver();

    await driver.writeProfile(4, 'Perfil 4', settings);
    const actions = sent.filter((report) => innerCommand(report) === 0x06);

    expect(actions).toHaveLength(2);
    // Inner action event: [9] the action id, [10..] its little-endian value.
    expect(actions[0][9]).toBe(0x34); // ACTION_SAVE_CONFIG_TO_FDS
    // The opening save names the slot: 1 | ((4 - 1) << 8) = 0x0301.
    expect(actions[0][10]).toBe(0x01);
    expect(actions[0][11]).toBe(0x03);
    // The closing save commits with zero.
    expect(actions[1][10]).toBe(0x00);
    expect(actions[1][11]).toBe(0x00);
  });

  it('rejects a slot index outside the addressable range', async () => {
    const { driver, settings } = recordingDriver();

    await expect(driver.writeProfile(0, 'Perfil', settings)).rejects.toThrow('invalido');
  });
});
