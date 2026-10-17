import type { MousePeripheral } from '@gearhub/shared';
import { registerDeviceDriver } from '../deviceDriver';
import type { BrowserHidDevice } from '../deviceDiscovery';
import type { DeviceDefinition } from '../deviceRegistry';
import { WebHidTransport } from '../WebHidTransport';
import { LeviathanV4Driver } from './LeviathanV4Driver';
import { createLeviathanV4Peripheral } from './leviathanV4';

/**
 * Liga o Leviathan V4. O driver nasce antes da consulta e já ouve o receptor,
 * para que um único leitor veja o fluxo desde o primeiro relatório. Identidade,
 * nome e snapshot são conferidos pelo núcleo na primeira resposta.
 */
export async function connectLeviathanV4(
  device: BrowserHidDevice,
  definition: DeviceDefinition,
): Promise<MousePeripheral> {
  if (definition.id !== 'rawm-leviathan-v4' || !definition.matches(device)) {
    throw new Error('O receptor WebHID nao corresponde ao Leviathan V4.');
  }
  const id = `${definition.id}:${device.vendorId.toString(16)}:${device.productId.toString(16)}`;
  const driver = new LeviathanV4Driver(new WebHidTransport(device));
  try {
    const mouse = await driver.query();
    const peripheral = createLeviathanV4Peripheral(mouse.raw, id);
    registerDeviceDriver(id, driver);
    return peripheral;
  } catch (error) {
    driver.close();
    throw error;
  }
}
