import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockPeripherals } from '../mocks/peripherals';
import { discoverDevices } from './deviceDiscovery';

describe('discoverDevices', () => {
  afterEach(() => vi.useRealTimers());

  it('returns isolated device data that callers can safely mutate', async () => {
    vi.useFakeTimers();

    const discovery = discoverDevices();
    await vi.runAllTimersAsync();
    const devices = await discovery;

    expect(devices).toEqual(mockPeripherals);
    expect(devices).not.toBe(mockPeripherals);
    expect(devices[0]).not.toBe(mockPeripherals[0]);

    devices[0].settings.profile = 'Changed by caller';
    expect(mockPeripherals[0].settings.profile).toBe('Competitive');
  });
});
