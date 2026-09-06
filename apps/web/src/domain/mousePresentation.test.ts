import { describe, expect, it } from 'vitest';
import { createDemoMouse } from '../hardware/demoDevices';
import { mouseFeatureVisibility } from './mousePresentation';

describe('mouse feature presentation', () => {
  it('hides controls the model does not declare', () => {
    expect(mouseFeatureVisibility(createDemoMouse())).toEqual({
      performanceModes: false,
      wirelessTurbo: false,
      rPlus: false,
    });
  });

  it('shows each optional control only when its capability exists', () => {
    const device = createDemoMouse();
    device.capabilities.performanceModes = [
      { id: 'office', label: 'Office' },
      { id: 'gaming-plus', label: 'Gaming+' },
    ];
    device.capabilities.parameters.wirelessTurbo = true;
    device.capabilities.rPlus = { activatorButtonIds: ['lateral-dianteiro'] };

    expect(mouseFeatureVisibility(device)).toEqual({
      performanceModes: true,
      wirelessTurbo: true,
      rPlus: true,
    });
  });
});
