import type { ConnectedPeripheral } from '@gearhub/shared';

export const mockPeripherals: ConnectedPeripheral[] = [
  {
    id: 'mock-superlight',
    name: 'G Pro X Superlight',
    manufacturer: 'Logitech',
    type: 'mouse',
    capabilities: {
      dpi: { min: 100, max: 25_600, presets: [800, 1600, 3200] },
      pollingRate: { supported: [125, 500, 1000] },
      battery: true,
    },
    settings: { dpi: 1600, pollingRate: 1000, batteryLevel: 82, profile: 'Competitive' },
  },
  {
    id: 'mock-wooting',
    name: '60HE',
    manufacturer: 'Wooting',
    type: 'keyboard',
    capabilities: {
      rapidTrigger: true,
      actuation: { min: 0.1, max: 4, step: 0.1 },
      lighting: true,
    },
    settings: { rapidTrigger: true, actuation: 0.5, lighting: true, profile: 'Daily driver' },
  },
];
