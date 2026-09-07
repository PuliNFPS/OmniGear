import type { MousePeripheral, MouseSettings } from '@gearhub/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isMouseSettings } from '../domain/settings';
import { createDemoMouse } from '../hardware/demoDevices';
import {
  registerDeviceDriver,
  unregisterDeviceDriver,
  type DeviceDriver,
} from '../hardware/deviceDriver';
import { useDeviceStore } from './deviceStore';
import { initialEntry, useEditorStore } from './editorStore';

const DEVICE_ID = 'onboard-mouse';

/** A live mouse holding the same settings in two onboard slots. */
function onboardMouse(): MousePeripheral {
  const demo = createDemoMouse();
  const settings = demo.profiles[0].settings ?? demo.defaults;
  return {
    ...demo,
    id: DEVICE_ID,
    demo: false,
    activeProfileSlot: 1,
    profiles: [
      { index: 1, name: 'Perfil 1', settings: structuredClone(settings) },
      {
        index: 2,
        name: 'Perfil 2',
        settings: { ...structuredClone(settings), pollingRate: 500 },
      },
    ],
  };
}

function mouseDraft(deviceId: string): MouseSettings {
  const draft = useEditorStore.getState().entries[deviceId]?.draft;
  if (!draft || !isMouseSettings(draft)) throw new Error('rascunho de mouse ausente');
  return draft;
}

beforeEach(() => {
  vi.useFakeTimers();
  useDeviceStore.setState({ devices: [onboardMouse()], demoMode: false, loading: false });
  useEditorStore.setState({ entries: {} });
});

afterEach(() => {
  useEditorStore.getState().forget(Object.keys(useEditorStore.getState().entries));
  unregisterDeviceDriver(DEVICE_ID);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('correcting the baseline once the device reports itself', () => {
  it('replaces the draft the app had assumed', () => {
    const device = useDeviceStore.getState().devices[0];
    useEditorStore.setState({ entries: { [device.id]: initialEntry(device) } });
    const reported = { ...mouseDraft(device.id), buttons: { esquerdo: 'desativado' } };

    useEditorStore.getState().rebase(device.id, reported as MouseSettings);

    expect(mouseDraft(device.id).buttons.esquerdo).toBe('desativado');
    // Corrected, not edited: nothing is left pending for the user to save.
    const entry = useEditorStore.getState().entries[device.id];
    expect(entry.draft).toEqual(entry.saved);
  });

  /** The user's own work outranks a correction that arrives late. */
  it('stands down when the user already changed something', () => {
    const device = useDeviceStore.getState().devices[0];
    const entry = initialEntry(device);
    const edited = { ...(entry.draft as MouseSettings), pollingRate: 125 };
    useEditorStore.setState({ entries: { [device.id]: { ...entry, draft: edited } } });

    useEditorStore.getState().rebase(device.id, { ...edited, pollingRate: 8000 } as MouseSettings);

    expect(mouseDraft(device.id).pollingRate).toBe(125);
  });
});

describe('choosing an onboard profile', () => {
  it('asks the device to run that slot instead of writing settings into it', async () => {
    const switchProfile = vi.fn(async () => undefined);
    const applyToSession = vi.fn(async () => undefined);
    const driver: DeviceDriver = {
      applyToSession,
      writeProfile: vi.fn(async () => undefined),
      switchProfile,
    };
    registerDeviceDriver(DEVICE_ID, driver);
    const device = useDeviceStore.getState().devices[0];

    await useEditorStore.getState().loadProfile(device, 2);
    await vi.runAllTimersAsync();

    expect(switchProfile).toHaveBeenCalledWith(2);
    expect(applyToSession).not.toHaveBeenCalled();
    expect(useDeviceStore.getState().devices[0].activeProfileSlot).toBe(2);
    expect(useEditorStore.getState().entries[DEVICE_ID].status).toBe('ocioso');
  });

  it('reports a failed switch without losing the draft', async () => {
    const driver: DeviceDriver = {
      applyToSession: vi.fn(async () => undefined),
      writeProfile: vi.fn(async () => undefined),
      switchProfile: vi.fn(async () => {
        throw new Error('sem resposta');
      }),
    };
    registerDeviceDriver(DEVICE_ID, driver);
    const device = useDeviceStore.getState().devices[0];

    await useEditorStore.getState().loadProfile(device, 2);

    expect(useEditorStore.getState().entries[DEVICE_ID].status).toBe('falha-aplicacao');
    expect(mouseDraft(DEVICE_ID).pollingRate).toBe(500);
  });

  it('falls back to writing the settings when the device cannot switch', async () => {
    const applyToSession = vi.fn(async () => undefined);
    registerDeviceDriver(DEVICE_ID, {
      applyToSession,
      writeProfile: vi.fn(async () => undefined),
    });
    const device = useDeviceStore.getState().devices[0];

    await useEditorStore.getState().loadProfile(device, 2);
    await vi.runAllTimersAsync();

    expect(applyToSession).toHaveBeenCalled();
  });
});
