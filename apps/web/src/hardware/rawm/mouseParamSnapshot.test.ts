import { describe, expect, it } from 'vitest';
import { leviathanV4QueryFixture } from './leviathanV4Fixture';
import { createLeviathanV4Peripheral } from './leviathanV4';
import {
  applySettingsToMouseParam,
  encodeMouseParamBody,
  parseMouseParamState,
} from './mouseParamSnapshot';

const raw = {
  dn: 'Leviathan V4',
  cpi: 1600,
  polling: 1000,
  light: 0x30,
  cpi_l: [400, 800, 1600, 3200],
  cpi_l_c: [1, 2, 3, 4],
  ob: 2,
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
  ocs: [0x80, 0x81, 0x82, 0x83],
  gm: [0, 0],
  st: [0x80, 0x81, 0x82, 0x83],
};

describe('RAWM mouse parameter snapshot', () => {
  it('recreates the confirmed complete 51-byte parameter body', () => {
    expect([...encodeMouseParamBody(parseMouseParamState(raw))]).toEqual([
      0x40, 0x06, 0xe8, 0x03, 0x30, 0x04, 0x90, 0x01, 0x20, 0x03, 0x40, 0x06, 0x80, 0x0c, 0x02,
      0x01, 0, 0, 0, 0, 0, 0x02, 0x07, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x01, 0x00, 0x01,
      0x01, 0x04, 0x01, 0x02, 0x03, 0x04, 0x08, 0x02, 0x64, 0x00, 0x5a, 0x00, 0x01, 0x04, 0x80,
      0x81, 0x82, 0x83, 0x00,
    ]);
  });

  it('updates only user-managed fields and preserves transport-critical arrays', () => {
    const state = parseMouseParamState(raw);
    const device = createLeviathanV4Peripheral(raw, 'id');
    const settings = structuredClone(device.defaults);
    settings.pollingRate = 4000;
    settings.performanceMode = 'gaming-plus';
    settings.parameters.wirelessTurbo = false;
    settings.parameters.motionSync = false;

    const updated = applySettingsToMouseParam(state, settings);

    expect(updated).toMatchObject({
      pollingRate: 4000,
      powerMode: 3,
      txOutputPower: 0,
      motionSync: 0,
      keyDelay: state.keyDelay,
      batteryLevels: state.batteryLevels,
      onboardStatus: state.onboardStatus,
    });
    expect(state.pollingRate).toBe(1000);
  });

  it('rejects incomplete snapshots instead of filling protocol defaults', () => {
    expect(() => parseMouseParamState({ ...raw, kd: undefined })).toThrow('incompleto');
  });
});

// Captured from a real Leviathan V4. Every field below is what the firmware
// actually sends, and each one broke a different assumption in the parser.
describe('parseMouseParamState on the real capture', () => {
  it('parses the firmware response as sent', () => {
    const state = parseMouseParamState(leviathanV4QueryFixture);

    expect(state.pollingRate).toBe(4000);
    expect(state.resolution).toBe(800);
    expect(state.powerMode).toBe(3);
    expect(state.liftOffDistance).toBe(2);
    expect(state.txOutputPower).toBe(8);
    expect(state.motionSync).toBe(1);
  });

  // Unused DPI slots come back as zeros, not as a shorter array.
  it('keeps the zero padding of the DPI level arrays', () => {
    const state = parseMouseParamState(leviathanV4QueryFixture);

    expect(state.cpiLevels).toEqual([400, 800, 1600, 3200, 0, 0, 0, 0]);
    expect(state.cpiLevelColors).toEqual([1, 2, 6, 4, 0, 0, 0, 0]);
  });

  // `co` is an empty string on this firmware, not the int array we assumed.
  it('accepts an empty battery-calibration field', () => {
    expect(parseMouseParamState(leviathanV4QueryFixture).batteryLevels).toEqual([]);
  });

  it('still rejects a snapshot that is genuinely missing a field', () => {
    const incomplete = { ...leviathanV4QueryFixture };
    delete incomplete.lod;

    expect(() => parseMouseParamState(incomplete)).toThrow('lod');
  });
});
