import { describe, expect, it, vi } from 'vitest';
import { createDemoMouse } from './demoDevices';
import {
  onDeviceDisconnected,
  requestDevice,
  restoreAuthorizedDevices,
  type BrowserHidApi,
  type BrowserHidDevice,
} from './deviceDiscovery';

const knownDevice = {
  vendorId: 0x1915,
  productId: 0x2346,
  productName: 'RAWM HS Receiver',
  collections: [
    {
      usagePage: 0xff00,
      usage: 1,
      inputReports: [{ reportId: 0 }],
      outputReports: [{ reportId: 0 }],
    },
  ],
} as BrowserHidDevice;

function hidApi(devices: BrowserHidDevice[]): BrowserHidApi {
  return {
    requestDevice: vi.fn(async () => devices),
    getDevices: vi.fn(async () => devices),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

describe('WebHID discovery', () => {
  it('uses registry filters and connects a recognized receiver', async () => {
    const api = hidApi([knownDevice]);
    const peripheral = { ...createDemoMouse(), id: 'rawm-live', demo: false };
    const connect = vi.fn(async () => peripheral);

    await expect(requestDevice(api, connect)).resolves.toEqual({
      status: 'conectado',
      devices: [peripheral],
    });
    expect(api.requestDevice).toHaveBeenCalledWith({ filters: [{ vendorId: 0x1915 }] });
  });

  it('restores only authorized devices that the registry recognizes', async () => {
    const unknown = { ...knownDevice, productId: 0xffff };
    const api = hidApi([unknown, knownDevice]);
    const connect = vi.fn(async () => ({ ...createDemoMouse(), id: 'rawm-live', demo: false }));

    const devices = await restoreAuthorizedDevices(api, connect);

    expect(devices).toHaveLength(1);
    expect(connect).toHaveBeenCalledOnce();
    expect(connect).toHaveBeenCalledWith(
      knownDevice,
      expect.objectContaining({
        id: 'rawm-leviathan-v4',
      }),
    );
  });

  it('reports the identity of only the device that disconnected', () => {
    let disconnect: ((event: { device: BrowserHidDevice }) => void) | undefined;
    const api = hidApi([]);
    vi.mocked(api.addEventListener).mockImplementation((_type, listener) => {
      disconnect = listener;
    });
    const listener = vi.fn();

    onDeviceDisconnected(listener, api);
    disconnect?.({ device: knownDevice });

    expect(listener).toHaveBeenCalledWith('rawm-leviathan-v4:1915:2346');
  });
});
