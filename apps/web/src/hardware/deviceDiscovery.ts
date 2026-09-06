import type { Peripheral } from '@gearhub/shared';
import { createDemoKeyboard, createDemoMouse } from './demoDevices';
import {
  deviceRequestFilters,
  matchDeviceDefinition,
  type DeviceDefinition,
  type HidDeviceIdentity,
} from './deviceRegistry';
import type { HidDeviceHandle } from './WebHidTransport';

export type ConnectionFailure = 'sem-suporte' | 'permissao' | 'nao-reconhecido' | 'falha';

export type ConnectionResult =
  | { status: 'conectado'; devices: Peripheral[] }
  | { status: 'cancelado' }
  | { status: 'erro'; reason: ConnectionFailure };

export type BrowserHidDevice = HidDeviceIdentity & HidDeviceHandle;

interface HidRequestOptions {
  filters: ReturnType<typeof deviceRequestFilters>;
}

interface HidDisconnectEvent {
  device: BrowserHidDevice;
}

export interface BrowserHidApi {
  requestDevice(options: HidRequestOptions): Promise<BrowserHidDevice[]>;
  getDevices(): Promise<BrowserHidDevice[]>;
  addEventListener(type: 'disconnect', listener: (event: HidDisconnectEvent) => void): void;
  removeEventListener(type: 'disconnect', listener: (event: HidDisconnectEvent) => void): void;
}

export type DeviceConnector = (
  device: BrowserHidDevice,
  definition: DeviceDefinition,
) => Promise<Peripheral>;

const DEMO_DELAY_MS = 620;

function hidApi(): BrowserHidApi | null {
  if (typeof navigator === 'undefined') return null;
  return (navigator as Navigator & { hid?: BrowserHidApi }).hid ?? null;
}

async function defaultConnector(
  device: BrowserHidDevice,
  definition: DeviceDefinition,
): Promise<Peripheral> {
  if (definition.id === 'rawm-leviathan-v4') {
    const { connectLeviathanV4 } = await import('./rawm/connectLeviathanV4');
    return connectLeviathanV4(device, definition);
  }
  throw new Error(`Nenhum conector implementado para ${definition.id}.`);
}

function peripheralIdFor(device: HidDeviceIdentity): string | null {
  const definition = matchDeviceDefinition(device);
  return definition
    ? `${definition.id}:${device.vendorId.toString(16)}:${device.productId.toString(16)}`
    : null;
}

export async function connectDemoDevices(): Promise<Peripheral[]> {
  await new Promise((resolve) => setTimeout(resolve, DEMO_DELAY_MS));
  return [createDemoMouse(), createDemoKeyboard()];
}

async function connectRecognized(
  devices: BrowserHidDevice[],
  connect: DeviceConnector,
): Promise<Peripheral[]> {
  const connected: Peripheral[] = [];
  for (const device of devices) {
    const definition = matchDeviceDefinition(device);
    if (!definition) continue;
    connected.push(await connect(device, definition));
  }
  return connected;
}

/** Opens the native WebHID picker with filters from the supported-model registry. */
export async function requestDevice(
  api: BrowserHidApi | null = hidApi(),
  connect: DeviceConnector = defaultConnector,
): Promise<ConnectionResult> {
  if (!api) return { status: 'erro', reason: 'sem-suporte' };

  try {
    const chosen = await api.requestDevice({ filters: deviceRequestFilters() });
    if (chosen.length === 0) return { status: 'cancelado' };
    const devices = await connectRecognized(chosen, connect);
    return devices.length > 0
      ? { status: 'conectado', devices }
      : { status: 'erro', reason: 'nao-reconhecido' };
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    return { status: 'erro', reason: name === 'NotAllowedError' ? 'permissao' : 'falha' };
  }
}

/** Reopens devices for which this origin already has WebHID permission. */
export async function restoreAuthorizedDevices(
  api: BrowserHidApi | null = hidApi(),
  connect: DeviceConnector = defaultConnector,
): Promise<Peripheral[]> {
  if (!api) return [];
  const authorized = await api.getDevices();
  return connectRecognized(authorized, connect);
}

/** Notifies the application with the exact peripheral identity removed by WebHID. */
export function onDeviceDisconnected(
  listener: (deviceId: string) => void,
  api: BrowserHidApi | null = hidApi(),
): () => void {
  if (!api) return () => undefined;
  const handle = (event: HidDisconnectEvent) => {
    const deviceId = peripheralIdFor(event.device);
    if (deviceId) listener(deviceId);
  };
  api.addEventListener('disconnect', handle);
  return () => api.removeEventListener('disconnect', handle);
}
