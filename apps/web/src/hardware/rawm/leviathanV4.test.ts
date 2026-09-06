import { describe, expect, it } from 'vitest';
import { leviathanV4QueryFixture } from './leviathanV4Fixture';
import { createLeviathanV4Peripheral } from './leviathanV4';

const query = {
  dn: 'Leviathan V4',
  pi: 0x2346,
  vi: 0x1915,
  r: '1.2.3',
  battery: 76,
  cpi: 800,
  polling: 1000,
  cpi_l: [400, 800, 1600, 3200],
  ob: 0,
  pm: 3,
  lod: 2,
  ms: 1,
  at: 0,
  as: 0,
  rctrl: 1,
  top: 8,
  st: [0x80, 0x81, 0x82, 0x83],
};

describe('Leviathan V4 peripheral projection', () => {
  it('projects reported values and model capabilities into generic mouse settings', () => {
    const device = createLeviathanV4Peripheral(query, 'rawm-leviathan-v4:1915:2346');

    expect(device).toMatchObject({
      id: 'rawm-leviathan-v4:1915:2346',
      name: 'Leviathan V4',
      manufacturer: 'RAWM',
      connection: 'sem-fio',
      demo: false,
      battery: 76,
      firmware: '1.2.3',
      activeProfileSlot: 1,
    });
    expect(device.capabilities.performanceModes?.map((mode) => mode.label)).toEqual([
      'Office',
      'LP',
      'HP',
      'Gaming+',
    ]);
    expect(device.defaults).toMatchObject({
      pollingRate: 1000,
      performanceMode: 'gaming-plus',
      parameters: {
        motionSync: true,
        angleSnapping: false,
        rippleControl: true,
        wirelessTurbo: true,
      },
      rPlus: { activatorButtonId: 'lateral-dianteiro' },
    });
    expect(device.defaults.activeStageId).toBe('estagio-2');
  });

  it('rejects a query missing settings required by the editor', () => {
    expect(() => createLeviathanV4Peripheral({ dn: 'Leviathan V4' }, 'id')).toThrow('incompleta');
  });
});

describe('createLeviathanV4Peripheral on the real capture', () => {
  it('reads the model, firmware and battery the firmware reports', () => {
    const mouse = createLeviathanV4Peripheral(leviathanV4QueryFixture, 'real');

    expect(mouse.name).toBe('LEVIATHAN V4');
    expect(mouse.firmware).toBe('G-1.2.3');
    expect(mouse.battery).toBe(31);
  });

  it('reflects the state the mouse was actually in', () => {
    const mouse = createLeviathanV4Peripheral(leviathanV4QueryFixture, 'real');

    expect(mouse.defaults.pollingRate).toBe(4000);
    expect(mouse.defaults.performanceMode).toBe('gaming-plus');
    expect(mouse.defaults.parameters.wirelessTurbo).toBe(true);
    expect(mouse.defaults.parameters.motionSync).toBe(true);
  });

  // `ocs` carries one entry per onboard slot and `ocn` states how many. `st` is
  // a scalar (60) on this firmware, so the previous reading of it as a slot
  // array silently collapsed four profiles into one.
  it('sizes the onboard profiles from the onboard config fields', () => {
    const mouse = createLeviathanV4Peripheral(leviathanV4QueryFixture, 'real');

    expect(mouse.capabilities.profileSlots).toBe(4);
    expect(mouse.profiles).toHaveLength(4);
  });

  // Only the four populated slots are real DPI stages.
  it('drops the zero padding from the DPI stages', () => {
    const mouse = createLeviathanV4Peripheral(leviathanV4QueryFixture, 'real');

    expect(mouse.defaults.dpiStages.map((stage) => stage.x)).toEqual([400, 800, 1600, 3200]);
  });
});
