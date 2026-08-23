import type { ConnectedPeripheral, DeviceSettings } from '@gearhub/shared';
import { create } from 'zustand';
import { discoverDevices } from '../hardware/deviceDiscovery';

type SaveState = { deviceId: string; setting: keyof DeviceSettings } | null;
export type Feedback = { type: 'success' | 'error'; title: string; message: string };

interface DeviceStore {
  devices: ConnectedPeripheral[];
  selectedId: string | null;
  discovering: boolean;
  saveState: SaveState;
  feedback: Feedback | null;
  selectDevice(id: string | null): void;
  connectDevices(): Promise<void>;
  updateSetting<K extends keyof DeviceSettings>(
    id: string,
    key: K,
    value: DeviceSettings[K],
  ): Promise<void>;
}

export const useDeviceStore = create<DeviceStore>((set, get) => ({
  devices: [],
  selectedId: null,
  discovering: false,
  saveState: null,
  feedback: null,
  selectDevice: (selectedId) => set({ selectedId, feedback: null }),
  connectDevices: async () => {
    set({ discovering: true, feedback: null });
    try {
      const devices = await discoverDevices();
      set({
        devices,
        selectedId: devices[0]?.id ?? null,
        feedback: {
          type: 'success',
          title: 'Devices connected',
          message: `${devices.length} mock peripherals are ready to configure.`,
        },
      });
    } catch {
      set({
        feedback: {
          type: 'error',
          title: 'Connection failed',
          message: 'Check browser permissions and try again.',
        },
      });
    } finally {
      set({ discovering: false });
    }
  },
  updateSetting: async (id, key, value) => {
    set({ saveState: { deviceId: id, setting: key }, feedback: null });
    await new Promise((resolve) => setTimeout(resolve, 280));
    if (!get().devices.some((device) => device.id === id)) {
      set({
        saveState: null,
        feedback: {
          type: 'error',
          title: 'Device unavailable',
          message: 'The device is no longer connected.',
        },
      });
      return;
    }
    set((state) => ({
      devices: state.devices.map((device) =>
        device.id === id ? { ...device, settings: { ...device.settings, [key]: value } } : device,
      ),
      saveState: null,
      feedback: {
        type: 'success',
        title: 'Setting saved',
        message: 'Your change was applied to the active profile.',
      },
    }));
  },
}));
