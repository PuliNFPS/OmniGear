import { describe, expect, it, vi } from 'vitest';
import { createDemoMouse } from './demoDevices';
import { driverFor, registerDeviceDriver, unregisterDeviceDriver } from './deviceDriver';

describe('live driver registry', () => {
  it('associates a non-serializable driver with a peripheral id', () => {
    const device = { ...createDemoMouse(), id: 'live', demo: false };
    const driver = { applyToSession: vi.fn(), writeProfile: vi.fn() };

    registerDeviceDriver(device.id, driver);
    expect(driverFor(device)).toBe(driver);
    unregisterDeviceDriver(device.id);
    expect(() => driverFor(device)).toThrow('Nenhum driver');
  });
});
