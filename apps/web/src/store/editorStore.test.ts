import type { MousePeripheral } from '@gearhub/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { countChanges } from '../domain/changes';
import { isMouseSettings } from '../domain/settings';
import { createDemoMouse } from '../hardware/demoDevices';
import {
  driverFor,
  registerDeviceDriver,
  unregisterDeviceDriver,
  type DeviceDriver,
} from '../hardware/deviceDriver';
import { useDeviceStore } from './deviceStore';
import { initialEntry, useEditorStore } from './editorStore';

function currentDevice(): MousePeripheral {
  const device = useDeviceStore.getState().devices[0];
  if (!device || device.type !== 'mouse') throw new Error('mouse de demonstração ausente');
  return device;
}

function draftOf(deviceId: string) {
  const draft = useEditorStore.getState().entries[deviceId]?.draft;
  if (!draft || !isMouseSettings(draft)) throw new Error('rascunho de mouse ausente');
  return draft;
}

beforeEach(() => {
  vi.useFakeTimers();
  useDeviceStore.setState({ devices: [createDemoMouse()], demoMode: true, loading: false });
  useEditorStore.setState({ entries: {} });
});

afterEach(() => {
  useEditorStore.getState().forget(Object.keys(useEditorStore.getState().entries));
  unregisterDeviceDriver('slow-live-mouse');
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('editing a draft', () => {
  it('applies the change to the session and keeps the profile untouched', async () => {
    const device = currentDevice();
    useEditorStore
      .getState()
      .edit(device, (draft) => (isMouseSettings(draft) ? { ...draft, pollingRate: 500 } : draft));

    expect(useEditorStore.getState().entries[device.id].status).toBe('aplicando');

    await vi.runAllTimersAsync();

    const entry = useEditorStore.getState().entries[device.id];
    expect(entry.status).toBe('ocioso');
    expect(draftOf(device.id).pollingRate).toBe(500);
    expect(countChanges(entry.saved, entry.draft)).toBe(1);

    const stored = currentDevice().profiles[0].settings;
    expect(stored?.pollingRate).toBe(1000);
  });

  it('writes the draft into the active profile only when saved', async () => {
    const device = currentDevice();
    useEditorStore
      .getState()
      .edit(device, (draft) => (isMouseSettings(draft) ? { ...draft, pollingRate: 500 } : draft));
    await vi.runAllTimersAsync();

    const saving = useEditorStore.getState().save(currentDevice());
    // Only the write delay, so the transient confirmation is still on screen.
    await vi.advanceTimersByTimeAsync(600);
    await saving;

    expect(currentDevice().profiles[0].settings?.pollingRate).toBe(500);

    const entry = useEditorStore.getState().entries[device.id];
    expect(countChanges(entry.saved, entry.draft)).toBe(0);
    expect(entry.status).toBe('gravado');

    await vi.advanceTimersByTimeAsync(3000);
    expect(useEditorStore.getState().entries[device.id].status).toBe('ocioso');
  });

  it('brings the draft back to the stored profile when discarded', async () => {
    const device = currentDevice();
    useEditorStore
      .getState()
      .edit(device, (draft) => (isMouseSettings(draft) ? { ...draft, pollingRate: 125 } : draft));
    await vi.runAllTimersAsync();

    useEditorStore.getState().discard(currentDevice());
    await vi.runAllTimersAsync();

    expect(draftOf(device.id).pollingRate).toBe(1000);
    expect(countChanges(initialEntry(currentDevice()).saved, draftOf(device.id))).toBe(0);
  });

  it('keeps the draft while the device is disconnected', async () => {
    const device = currentDevice();
    useDeviceStore.getState().markDisconnected(device.id);

    useEditorStore
      .getState()
      .edit(currentDevice(), (draft) =>
        isMouseSettings(draft) ? { ...draft, pollingRate: 250 } : draft,
      );
    await vi.runAllTimersAsync();

    expect(draftOf(device.id).pollingRate).toBe(250);
    expect(useEditorStore.getState().entries[device.id].status).toBe('ocioso');

    const blockedSave = useEditorStore.getState().save(currentDevice());
    await vi.runAllTimersAsync();
    await blockedSave;
    expect(currentDevice().profiles[0].settings?.pollingRate).toBe(1000);
  });

  it('reads the connection from the store when the screen holds an old device', async () => {
    // The screen renders with a connected device and the cable is pulled before
    // the click arrives, so the handler carries a copy that is already stale.
    const stale = currentDevice();
    useDeviceStore.getState().markDisconnected(stale.id);

    useEditorStore
      .getState()
      .edit(stale, (draft) => (isMouseSettings(draft) ? { ...draft, pollingRate: 250 } : draft));
    await vi.runAllTimersAsync();

    expect(draftOf(stale.id).pollingRate).toBe(250);
    expect(useEditorStore.getState().entries[stale.id].status).toBe('ocioso');

    const blockedSave = useEditorStore.getState().save(stale);
    await vi.runAllTimersAsync();
    await blockedSave;

    expect(currentDevice().profiles[0].settings?.pollingRate).toBe(1000);
    expect(useEditorStore.getState().entries[stale.id].status).toBe('ocioso');
  });
});

describe('loading another profile', () => {
  it('does not load or discard the draft when saving first fails', async () => {
    const device = currentDevice();
    useEditorStore
      .getState()
      .edit(device, (draft) => (isMouseSettings(draft) ? { ...draft, pollingRate: 250 } : draft));
    await vi.runAllTimersAsync();
    vi.spyOn(driverFor(device), 'writeProfile').mockRejectedValue(new Error('write failed'));

    await useEditorStore.getState().saveAndLoad(device, 3);

    expect(currentDevice().activeProfileSlot).toBe(1);
    expect(draftOf(device.id).pollingRate).toBe(250);
    expect(useEditorStore.getState().entries[device.id].status).toBe('falha-gravacao');
  });

  it('keeps the write state when an earlier session apply completes', async () => {
    const device = currentDevice();
    useEditorStore
      .getState()
      .edit(device, (draft) => (isMouseSettings(draft) ? { ...draft, pollingRate: 250 } : draft));
    const saving = useEditorStore.getState().save(device);
    await vi.advanceTimersByTimeAsync(300);
    expect(useEditorStore.getState().entries[device.id].status).toBe('gravando');
    await useEditorStore.getState().loadProfile(device, 3);
    expect(currentDevice().activeProfileSlot).toBe(1);
    await vi.runAllTimersAsync();
    await saving;
  });

  it('retries a failed write in its original slot', async () => {
    const device = currentDevice();
    const write = vi
      .spyOn(driverFor(device), 'writeProfile')
      .mockRejectedValueOnce(new Error('write failed'));
    await useEditorStore.getState().saveToSlot(device, 2, 'Cópia');
    useEditorStore.getState().retry(device);
    await vi.advanceTimersByTimeAsync(600);
    expect(write).toHaveBeenLastCalledWith(2, 'Cópia', device.defaults);
    expect(currentDevice().profiles[1].name).toBe('Cópia');
    expect(useEditorStore.getState().entries[device.id].savedProfileName).toBe('Cópia');
  });

  it('does not acknowledge a write after disconnecting or leaving the session', async () => {
    const device = currentDevice();
    const saving = useEditorStore.getState().save(device);
    useDeviceStore.getState().markDisconnected(device.id);
    await vi.runAllTimersAsync();
    expect(await saving).toBe(false);
    expect(useEditorStore.getState().entries[device.id].status).toBe('falha-gravacao');

    useDeviceStore.getState().reconnect(device.id);
    const nextSave = useEditorStore.getState().save(device);
    useEditorStore.getState().forget([device.id]);
    useDeviceStore.setState({ devices: [createDemoMouse()] });
    await vi.runAllTimersAsync();
    expect(await nextSave).toBe(false);
    expect(useEditorStore.getState().entries[device.id]).toBeUndefined();
  });

  it('replaces the draft and marks the loaded slot as the one in use', async () => {
    const device = currentDevice();
    const loading = useEditorStore.getState().loadProfile(device, 3);
    await vi.runAllTimersAsync();
    await loading;

    expect(currentDevice().activeProfileSlot).toBe(3);
    expect(draftOf(device.id).pollingRate).toBe(500);
    const entry = useEditorStore.getState().entries[device.id];
    expect(countChanges(entry.saved, entry.draft)).toBe(0);
  });
});

describe('coalescing rapid edits', () => {
  // A slider drag emits an edit per pixel, and each apply on real hardware is a
  // config reset plus the parameter block plus every mapping. Sending one per
  // event stalled input on the machine.
  it('writes once for a burst of edits, with the final value', async () => {
    const device = currentDevice();
    const applyToSession = vi.fn(async () => undefined);
    vi.spyOn({ driverFor }, 'driverFor');
    const driver = driverFor(device);
    const spy = vi.spyOn(driver, 'applyToSession').mockImplementation(applyToSession);

    for (const rate of [125, 250, 500, 1000]) {
      useEditorStore
        .getState()
        .edit(device, (draft) =>
          isMouseSettings(draft) ? { ...draft, pollingRate: rate } : draft,
        );
    }

    expect(spy).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();

    expect(spy).toHaveBeenCalledTimes(1);
    const written = spy.mock.calls[0][0];
    expect(isMouseSettings(written) && written.pollingRate).toBe(1000);
    // The draft still reflects every edit as the user typed them.
    expect(draftOf(device.id).pollingRate).toBe(1000);
  });

  it('does not let a queued apply land after a profile write', async () => {
    const device = currentDevice();
    const driver = driverFor(device);
    const apply = vi.spyOn(driver, 'applyToSession').mockResolvedValue(undefined);
    vi.spyOn(driver, 'writeProfile').mockResolvedValue(undefined);

    useEditorStore
      .getState()
      .edit(device, (draft) => (isMouseSettings(draft) ? { ...draft, pollingRate: 500 } : draft));
    await useEditorStore.getState().save(device);
    await vi.runAllTimersAsync();

    expect(apply).not.toHaveBeenCalled();
  });

  it('keeps at most the latest edit while a slow hardware apply is running', async () => {
    const device: MousePeripheral = {
      ...createDemoMouse(),
      id: 'slow-live-mouse',
      demo: false,
    };
    useDeviceStore.setState({ devices: [device], demoMode: false });

    let finishFirstApply!: () => void;
    const firstApply = new Promise<void>((resolve) => {
      finishFirstApply = resolve;
    });
    const applyToSession = vi
      .fn<DeviceDriver['applyToSession']>()
      .mockImplementationOnce(() => firstApply)
      .mockResolvedValue(undefined);
    registerDeviceDriver(device.id, {
      applyToSession,
      writeProfile: vi.fn(async () => undefined),
    });

    useEditorStore
      .getState()
      .edit(device, (draft) => (isMouseSettings(draft) ? { ...draft, pollingRate: 500 } : draft));
    await vi.advanceTimersByTimeAsync(180);

    useEditorStore
      .getState()
      .edit(device, (draft) => (isMouseSettings(draft) ? { ...draft, pollingRate: 250 } : draft));
    await vi.advanceTimersByTimeAsync(180);
    useEditorStore
      .getState()
      .edit(device, (draft) => (isMouseSettings(draft) ? { ...draft, pollingRate: 125 } : draft));
    await vi.advanceTimersByTimeAsync(180);

    expect(applyToSession).toHaveBeenCalledTimes(1);

    finishFirstApply();
    await vi.runAllTimersAsync();

    expect(applyToSession).toHaveBeenCalledTimes(2);
    const latest = applyToSession.mock.calls[1][0];
    expect(isMouseSettings(latest) && latest.pollingRate).toBe(125);
    expect(useEditorStore.getState().entries[device.id].status).toBe('ocioso');
  });
});
