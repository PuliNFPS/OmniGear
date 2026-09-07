import type { Peripheral } from '@gearhub/shared';
import { create } from 'zustand';
import {
  connectDemoDevices,
  requestDevice,
  restoreAuthorizedDevices,
  type ConnectionFailure,
} from '../hardware/deviceDiscovery';

const DEMO_STORAGE_KEY = 'omnigear:demonstracao';
let demoGeneration = 0;

export type ConnectionState = 'ocioso' | 'conectando' | 'cancelado' | 'erro';

interface DeviceStore {
  devices: Peripheral[];
  /** First listing of the devices already available in this browser. */
  loading: boolean;
  connection: ConnectionState;
  connectionError: ConnectionFailure | null;
  demoMode: boolean;
  addDeviceOpen: boolean;
  restoreSession(): Promise<void>;
  openAddDevice(): void;
  closeAddDevice(): void;
  startDemo(): Promise<void>;
  /** Leaves the demonstration and forgets it, so a reload starts empty. */
  exitDemo(): void;
  connectDevice(): Promise<void>;
  resetConnection(): void;
  markDisconnected(deviceId: string): void;
  reconnect(deviceId: string): Promise<void>;
  updateDevice(deviceId: string, update: (device: Peripheral) => Peripheral): void;
}

function rememberDemo(active: boolean) {
  try {
    if (active) localStorage.setItem(DEMO_STORAGE_KEY, '1');
    else localStorage.removeItem(DEMO_STORAGE_KEY);
  } catch {
    // Storage may be blocked; the session still works without being remembered.
  }
}

function demoWasActive(): boolean {
  try {
    return localStorage.getItem(DEMO_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function mergeDevices(current: Peripheral[], connected: Peripheral[]): Peripheral[] {
  const byId = new Map(current.map((device) => [device.id, device]));
  for (const device of connected) byId.set(device.id, device);
  return [...byId.values()];
}

export const useDeviceStore = create<DeviceStore>((set, get) => ({
  devices: [],
  loading: true,
  connection: 'ocioso',
  connectionError: null,
  demoMode: false,
  addDeviceOpen: false,

  restoreSession: async () => {
    const generation = ++demoGeneration;
    const includeDemo = demoWasActive();
    const [authorized, demo] = await Promise.all([
      restoreAuthorizedDevices().catch(() => []),
      includeDemo ? connectDemoDevices() : Promise.resolve([]),
    ]);
    if (generation !== demoGeneration) return;
    set({ devices: [...authorized, ...demo], demoMode: includeDemo, loading: false });
  },

  openAddDevice: () => {
    if (get().loading || get().connection === 'conectando') return;
    set({ addDeviceOpen: true, connection: 'ocioso', connectionError: null });
  },
  closeAddDevice: () => set({ addDeviceOpen: false }),
  resetConnection: () => set({ connection: 'ocioso', connectionError: null }),

  startDemo: async () => {
    if (get().demoMode) {
      set({ addDeviceOpen: false });
      return;
    }
    if (get().connection === 'conectando') return;
    const generation = ++demoGeneration;
    set({ connection: 'conectando', connectionError: null });
    const devices = await connectDemoDevices();
    if (generation !== demoGeneration) return;
    rememberDemo(true);
    set({ devices, demoMode: true, connection: 'ocioso', addDeviceOpen: false, loading: false });
  },

  exitDemo: () => {
    demoGeneration++;
    rememberDemo(false);
    set((state) => ({
      devices: state.devices.filter((device) => !device.demo),
      demoMode: false,
      loading: false,
      connection: 'ocioso',
      connectionError: null,
      addDeviceOpen: false,
    }));
  },

  connectDevice: async () => {
    if (get().loading || get().connection === 'conectando') return;
    set({ connection: 'conectando', connectionError: null });
    const result = await requestDevice();
    if (result.status === 'conectado') {
      set((state) => ({
        devices: mergeDevices(state.devices, result.devices),
        connection: 'ocioso',
        addDeviceOpen: false,
      }));
      return;
    }
    if (result.status === 'cancelado') {
      set({ connection: 'cancelado' });
      return;
    }
    set({ connection: 'erro', connectionError: result.reason });
  },

  markDisconnected: (deviceId) =>
    get().updateDevice(deviceId, (device) => ({ ...device, status: 'desconectado' })),

  reconnect: async (deviceId) => {
    const restored = await restoreAuthorizedDevices().catch(() => []);
    const device = restored.find((item) => item.id === deviceId);
    if (device) get().updateDevice(deviceId, () => device);
  },

  updateDevice: (deviceId, update) =>
    set((state) => ({
      devices: state.devices.map((device) => (device.id === deviceId ? update(device) : device)),
    })),
}));
