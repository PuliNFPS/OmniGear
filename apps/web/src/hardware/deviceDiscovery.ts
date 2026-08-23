import type { ConnectedPeripheral } from '@gearhub/shared';
import { mockPeripherals } from '../mocks/peripherals';

export async function discoverDevices(): Promise<ConnectedPeripheral[]> {
  // The real implementation will call navigator.hid.requestDevice() and use
  // the Rust registry to map vendor/product IDs to supported drivers.
  await new Promise((resolve) => setTimeout(resolve, 650));
  return structuredClone(mockPeripherals);
}
