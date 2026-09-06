import type { Peripheral, PeripheralSettings } from '@gearhub/shared';

/**
 * Port used by the editor. Applying to the session and writing a profile are
 * distinct results: only a confirmed write changes what the device keeps.
 */
export interface DeviceDriver {
  applyToSession(settings: PeripheralSettings): Promise<void>;
  writeProfile(slotIndex: number, name: string, settings: PeripheralSettings): Promise<void>;
}

const APPLY_DELAY_MS = 260;
const WRITE_DELAY_MS = 520;
const liveDrivers = new Map<string, DeviceDriver>();

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Simulated driver: it acknowledges the operation without touching hardware. */
const demoDriver: DeviceDriver = {
  async applyToSession() {
    await wait(APPLY_DELAY_MS);
  },
  async writeProfile() {
    await wait(WRITE_DELAY_MS);
  },
};

export function driverFor(device: Peripheral): DeviceDriver {
  if (device.demo) return demoDriver;
  const driver = liveDrivers.get(device.id);
  if (driver) return driver;
  throw new Error(`Nenhum driver implementado para ${device.name}.`);
}

export function registerDeviceDriver(deviceId: string, driver: DeviceDriver): void {
  liveDrivers.set(deviceId, driver);
}

export function unregisterDeviceDriver(deviceId: string): void {
  liveDrivers.delete(deviceId);
}
