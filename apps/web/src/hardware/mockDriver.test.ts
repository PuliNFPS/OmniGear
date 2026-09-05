import { DeviceDisconnectedError } from '@gearhub/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockDriver } from './mockDriver';

afterEach(() => vi.useRealTimers());

describe('createMockDriver', () => {
  it('entrega capabilities diferentes por mouse, para provar a regra de capability ausente', async () => {
    const full = await createMockDriver('mock-vanguard').readCapabilities();
    const basic = await createMockDriver('mock-scout').readCapabilities();

    expect(full.parameters.sensorRotation).toBeDefined();
    expect(basic.parameters.sensorRotation).toBeUndefined();
  });

  it('rejeita com DeviceDisconnectedError depois de simular a desconexão', async () => {
    const driver = createMockDriver('mock-vanguard');
    const profile = (await driver.readSlots())[0]!.profile!;

    driver.simulateDisconnect();

    await expect(driver.applyLive(profile)).rejects.toBeInstanceOf(DeviceDisconnectedError);
  });

  it('avisa os assinantes de onDisconnect e para de avisar depois do cancelamento', () => {
    const driver = createMockDriver('mock-vanguard');
    const listener = vi.fn();

    const unsubscribe = driver.onDisconnect(listener);
    driver.simulateDisconnect();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    driver.simulateDisconnect();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
