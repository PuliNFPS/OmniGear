import type { Peripheral } from '@gearhub/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requestDeviceMock = vi.hoisted(() => vi.fn());

vi.mock('../hardware/deviceDiscovery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hardware/deviceDiscovery')>();
  return { ...actual, requestDevice: requestDeviceMock };
});

import { exitDemonstration } from '../app/demo';
import { isMouseSettings } from '../domain/settings';
import { createDemoMouse } from '../hardware/demoDevices';
import { useDeviceStore } from './deviceStore';
import { useEditorStore } from './editorStore';

/** The store only remembers the demonstration through the browser storage. */
function fakeStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

async function startDemo() {
  const started = useDeviceStore.getState().startDemo();
  await vi.runAllTimersAsync();
  await started;
}

/** Runs what a page load does: a fresh store reading the browser storage. */
async function reload() {
  useDeviceStore.setState({ devices: [], demoMode: false, loading: true });
  const restored = useDeviceStore.getState().restoreSession();
  await vi.runAllTimersAsync();
  await restored;
}

beforeEach(() => {
  vi.useFakeTimers();
  requestDeviceMock.mockReset();
  vi.stubGlobal('localStorage', fakeStorage());
  useDeviceStore.setState({
    devices: [],
    demoMode: false,
    loading: false,
    connection: 'ocioso',
    connectionError: null,
    addDeviceOpen: false,
  });
  useEditorStore.setState({ entries: {} });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('leaving the demonstration', () => {
  it('does not reset an already active demonstration', async () => {
    await startDemo();
    const device = useDeviceStore.getState().devices[0];
    useDeviceStore
      .getState()
      .updateDevice(device.id, (current) => ({ ...current, activeProfileSlot: 3 }));
    await startDemo();
    expect(useDeviceStore.getState().devices[0].activeProfileSlot).toBe(3);
  });

  it('does not reopen a demonstration that was left while loading', async () => {
    const starting = useDeviceStore.getState().startDemo();
    useDeviceStore.getState().exitDemo();
    await vi.runAllTimersAsync();
    await starting;
    expect(useDeviceStore.getState().demoMode).toBe(false);
    expect(useDeviceStore.getState().devices).toEqual([]);
  });

  it('empties the device list and drops the demonstration badge', async () => {
    await startDemo();
    expect(useDeviceStore.getState().devices.length).toBeGreaterThan(0);

    useDeviceStore.getState().exitDemo();

    expect(useDeviceStore.getState().devices).toEqual([]);
    expect(useDeviceStore.getState().demoMode).toBe(false);
  });

  it('does not bring the demonstration back on the next load', async () => {
    await startDemo();
    useDeviceStore.getState().exitDemo();

    await reload();

    expect(useDeviceStore.getState().devices).toEqual([]);
    expect(useDeviceStore.getState().demoMode).toBe(false);
    expect(useDeviceStore.getState().loading).toBe(false);
  });

  it('keeps the demonstration on the next load while it was not left', async () => {
    await startDemo();

    await reload();

    expect(useDeviceStore.getState().devices.length).toBeGreaterThan(0);
    expect(useDeviceStore.getState().demoMode).toBe(true);
  });

  it('keeps peripherals that are not part of the demonstration', async () => {
    await startDemo();
    const real: Peripheral = { ...createDemoMouse(), id: 'mouse-real', demo: false };
    useDeviceStore.setState((state) => ({ devices: [...state.devices, real] }));

    useDeviceStore.getState().exitDemo();

    expect(useDeviceStore.getState().devices.map((device) => device.id)).toEqual(['mouse-real']);
  });

  it('forgets the drafts, so a later demonstration starts at its factory values', async () => {
    await startDemo();
    const device = useDeviceStore.getState().devices[0];
    useEditorStore
      .getState()
      .edit(device, (draft) => (isMouseSettings(draft) ? { ...draft, pollingRate: 500 } : draft));
    await vi.runAllTimersAsync();
    expect(useEditorStore.getState().entries[device.id]).toBeDefined();

    exitDemonstration();

    expect(useEditorStore.getState().entries[device.id]).toBeUndefined();
  });
});

describe('connecting real devices', () => {
  it('does not open manual discovery while authorized devices are being restored', () => {
    useDeviceStore.setState({ loading: true, addDeviceOpen: false });

    useDeviceStore.getState().openAddDevice();

    expect(useDeviceStore.getState().addDeviceOpen).toBe(false);
  });

  it('replaces an existing device instead of registering the same hardware twice', async () => {
    const existing: Peripheral = {
      ...createDemoMouse(),
      id: 'mouse-real',
      name: 'Disconnected mouse',
      demo: false,
      status: 'desconectado',
    };
    const connected: Peripheral = {
      ...existing,
      name: 'Connected mouse',
      status: 'conectado',
    };
    useDeviceStore.setState({ devices: [existing] });
    requestDeviceMock.mockResolvedValue({ status: 'conectado', devices: [connected] });

    await useDeviceStore.getState().connectDevice();

    expect(useDeviceStore.getState().devices).toEqual([connected]);
  });
});
