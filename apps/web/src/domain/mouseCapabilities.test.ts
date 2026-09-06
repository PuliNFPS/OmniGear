import { describe, expect, it } from 'vitest';
import { createDemoMouse } from '../hardware/demoDevices';
import { assignRPlusAction, createRPlusSettings, selectRPlusActivator } from './mouseCapabilities';

describe('optional mouse capabilities', () => {
  it('does not add Leviathan-only controls to a model that does not declare them', () => {
    const device = createDemoMouse();

    expect(device.capabilities.performanceModes).toBeUndefined();
    expect(device.capabilities.rPlus).toBeUndefined();
    expect(device.capabilities.parameters.wirelessTurbo).toBeUndefined();
  });
});

describe('R-Plus settings', () => {
  const buttonIds = ['esquerdo', 'direito', 'central', 'lateral-dianteiro', 'lateral-traseiro'];

  it('creates a disabled secondary action for every physical button', () => {
    expect(createRPlusSettings(buttonIds, 'lateral-dianteiro')).toEqual({
      activatorButtonId: 'lateral-dianteiro',
      buttons: {
        esquerdo: 'desativado',
        direito: 'desativado',
        central: 'desativado',
        'lateral-dianteiro': 'desativado',
        'lateral-traseiro': 'desativado',
      },
    });
  });

  it('never assigns a secondary action to the activator', () => {
    const settings = createRPlusSettings(buttonIds, 'lateral-dianteiro');

    expect(assignRPlusAction(settings, 'lateral-dianteiro', 'dpi-ciclo')).toBe(settings);
    expect(assignRPlusAction(settings, 'lateral-traseiro', 'dpi-ciclo').buttons).toMatchObject({
      'lateral-dianteiro': 'desativado',
      'lateral-traseiro': 'dpi-ciclo',
    });
  });

  it('clears the new activator secondary action when the activator changes', () => {
    const settings = assignRPlusAction(
      createRPlusSettings(buttonIds, 'lateral-dianteiro'),
      'lateral-traseiro',
      'dpi-ciclo',
    );

    expect(selectRPlusActivator(settings, 'lateral-traseiro')).toEqual({
      activatorButtonId: 'lateral-traseiro',
      buttons: expect.objectContaining({ 'lateral-traseiro': 'desativado' }),
    });
  });
});
