import type { MousePeripheral } from '@gearhub/shared';
import { registerDeviceDriver } from '../deviceDriver';
import type { BrowserHidDevice } from '../deviceDiscovery';
import type { DeviceDefinition } from '../deviceRegistry';
import { WebHidTransport } from '../WebHidTransport';
import { LeviathanV4Driver } from './LeviathanV4Driver';
import { createLeviathanV4Peripheral } from './leviathanV4';
import { parseMouseParamState } from './mouseParamSnapshot';
import { queryRawmDevice } from './session';

export async function connectLeviathanV4(
  device: BrowserHidDevice,
  definition: DeviceDefinition,
): Promise<MousePeripheral> {
  if (definition.id !== 'rawm-leviathan-v4' || !definition.matches(device)) {
    throw new Error('O receptor WebHID nao corresponde ao Leviathan V4.');
  }
  const id = `${definition.id}:${device.vendorId.toString(16)}:${device.productId.toString(16)}`;
  const transport = new WebHidTransport(device);
  const mouse = await queryRawmDevice(transport, { virtualMouse: true });
  if (!/leviathan|魔鲸\s*v4/i.test(mouse.deviceName)) {
    throw new Error(`Mouse RAWM conectado nao reconhecido: ${mouse.deviceName}.`);
  }
  parseMouseParamState(mouse.raw);

  const peripheral = createLeviathanV4Peripheral(mouse.raw, id);
  registerDeviceDriver(id, new LeviathanV4Driver(transport, mouse.raw, mouse.crcSupported));
  return peripheral;
}
