import { describe, expect, it } from 'vitest';
import { createLeviathanV4Peripheral } from './leviathanV4';

const query = {
  dn: 'Leviathan V4',
  pi: 0x2346,
  vi: 0x1915,
  r: '1.2.3',
  battery: 76,
  cpi: 800,
  polling_rate: 1000,
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
    expect(() => createLeviathanV4Peripheral({ dn: 'Leviathan V4' }, 'id')).toThrow(
      'incompleta',
    );
  });
});
