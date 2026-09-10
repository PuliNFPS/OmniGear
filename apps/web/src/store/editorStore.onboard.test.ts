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
  it('follows the DPI button before the user has made their first edit', () => {
    useEditorStore.getState().syncActiveDpi(DEVICE_ID, 1600);
    expect(mouseDraft(DEVICE_ID).activeStageId).toBe('estagio-3');
    expect(useEditorStore.getState().entries[DEVICE_ID].draft).toEqual(
      useEditorStore.getState().entries[DEVICE_ID].saved,
    );
    expect(useDeviceStore.getState().devices[0]).toMatchObject({ liveDpi: { x: 1600, y: 1600 } });
  });

  /** X names the stage. Demanding a matching Y is what stopped this working. */
  it('follows the DPI button when the reported Y does not mirror the linked stages', () => {
    useEditorStore.getState().syncActiveDpi(DEVICE_ID, 1600, 800);
    expect(mouseDraft(DEVICE_ID).activeStageId).toBe('estagio-3');
  });

  it('updates live DPI while preserving the draft of another memory', async () => {
    const device = useDeviceStore.getState().devices[0];
    await useEditorStore.getState().loadProfile(device, 2);
    const before = structuredClone(mouseDraft(DEVICE_ID));
    useEditorStore.getState().syncActiveDpi(DEVICE_ID, 3200);
    expect(mouseDraft(DEVICE_ID)).toEqual(before);
    expect(useDeviceStore.getState().devices[0]).toMatchObject({ liveDpi: { x: 3200, y: 3200 } });
  });
  it('replaces the draft the app had assumed', () => {
    const device = useDeviceStore.getState().devices[0];
    useEditorStore.setState({ entries: { [device.id]: initialEntry(device) } });
    const reported: MouseSettings = {
      ...mouseDraft(device.id),
      buttons: { esquerdo: 'desativado' },
    };

    useEditorStore.getState().rebase(device.id, 1, reported);

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

    useEditorStore.getState().rebase(device.id, 1, { ...edited, pollingRate: 8000 });

    expect(mouseDraft(device.id).pollingRate).toBe(125);
  });
});

describe('choosing an onboard profile for editing', () => {
  it('reconciles a physical DPI change received while applying and uses it on the next edit', async () => {
    const applyToSession = vi.fn(async () => {
      useEditorStore.getState().syncActiveDpi(DEVICE_ID, 3200);
    });
    registerDeviceDriver(DEVICE_ID, { applyToSession, writeProfile: vi.fn(async () => undefined) });
    const device = useDeviceStore.getState().devices[0];
    useEditorStore.getState().edit(device, (draft) => ({ ...draft, pollingRate: 125 }));
    await vi.runAllTimersAsync();
    expect(mouseDraft(DEVICE_ID).activeStageId).toBe('estagio-4');
    useEditorStore.getState().edit(device, (draft) => ({ ...draft, pollingRate: 500 }));
    await vi.runAllTimersAsync();
    expect(applyToSession).toHaveBeenLastCalledWith(
      expect.objectContaining({ activeStageId: 'estagio-4' }),
    );
  });

  it('does not assign an in-flight onboard DPI report to the previously active memory', async () => {
    registerDeviceDriver(DEVICE_ID, {
      applyToSession: vi.fn(async () => undefined),
      writeProfile: vi.fn(async () => {
        useEditorStore.getState().syncActiveDpi(DEVICE_ID, 3200);
      }),
      readState: vi.fn(async () => ({ activeProfileSlot: 2, dpi: { x: 3200, y: 3200 } })),
    });
    const device = useDeviceStore.getState().devices[0];
    const before = structuredClone(device.profiles[0].settings);
    await useEditorStore.getState().loadProfile(device, 2);
    await useEditorStore.getState().save(device);
    expect(useDeviceStore.getState().devices[0].profiles[0].settings).toEqual(before);
    expect(mouseDraft(DEVICE_ID).activeStageId).toBe('estagio-4');
  });

  it('reads the active memory after saving and resumes live editing there', async () => {
    const applyToSession = vi.fn(async () => undefined);
    const writeProfile = vi.fn(async () => undefined);
    const readState = vi.fn(async () => ({ activeProfileSlot: 2, dpi: { x: 800, y: 800 } }));
    registerDeviceDriver(DEVICE_ID, { applyToSession, writeProfile, readState });
    const device = useDeviceStore.getState().devices[0];
    await useEditorStore.getState().loadProfile(device, 2);
    expect(await useEditorStore.getState().save(device)).toBe(true);
    expect(readState).toHaveBeenCalledOnce();
    expect(useDeviceStore.getState().devices[0].activeProfileSlot).toBe(2);
    expect(useEditorStore.getState().entries[DEVICE_ID].editingProfileSlot).toBe(2);
    useEditorStore.getState().edit(device, (draft) => ({ ...draft, activeStageId: 'estagio-3' }));
    await vi.runAllTimersAsync();
    expect(applyToSession).toHaveBeenCalledWith(
      expect.objectContaining({ activeStageId: 'estagio-3' }),
    );
    useEditorStore.getState().syncActiveDpi(DEVICE_ID, 3200);
    expect(mouseDraft(DEVICE_ID).activeStageId).toBe('estagio-4');
    expect(writeProfile).toHaveBeenCalledTimes(1);
  });

  /**
   * The cursor was following the active memory, so it follows where the mouse
   * went. Left behind it would silently stop applying edits and stop showing
   * what the device reports.
   */
  it('follows the memory the mouse reports after a save', async () => {
    registerDeviceDriver(DEVICE_ID, {
      applyToSession: vi.fn(async () => undefined),
      writeProfile: vi.fn(async () => undefined),
      readState: vi.fn(async () => ({ activeProfileSlot: 2, dpi: { x: 1600, y: 1600 } })),
    });
    const device = useDeviceStore.getState().devices[0];

    expect(await useEditorStore.getState().save(device)).toBe(true);

    expect(useEditorStore.getState().entries[DEVICE_ID]).toMatchObject({ editingProfileSlot: 2 });
    expect(mouseDraft(DEVICE_ID).pollingRate).toBe(500);
    useEditorStore.getState().syncActiveDpi(DEVICE_ID, 3200);
    expect(mouseDraft(DEVICE_ID).activeStageId).toBe('estagio-4');
  });

  /** Seeded values know less than a draft that has been following the mouse. */
  it('keeps the draft when the memory reported was never read from the device', () => {
    const mouse = onboardMouse();
    useDeviceStore.setState({
      devices: [
        {
          ...mouse,
          profiles: mouse.profiles.map((slot) =>
            slot.index === 2 ? { ...slot, initial: true } : slot,
          ),
        },
      ],
    });
    const device = useDeviceStore.getState().devices[0];
    useEditorStore.setState({ entries: { [DEVICE_ID]: initialEntry(device) } });
    const before = structuredClone(mouseDraft(DEVICE_ID));

    useEditorStore.getState().syncActiveProfile(DEVICE_ID, 2);

    expect(useEditorStore.getState().entries[DEVICE_ID]).toMatchObject({ editingProfileSlot: 2 });
    expect(mouseDraft(DEVICE_ID)).toEqual(before);
  });

  it('keeps a confirmed save when reading the active memory fails', async () => {
    registerDeviceDriver(DEVICE_ID, {
      applyToSession: vi.fn(async () => undefined),
      writeProfile: vi.fn(async () => undefined),
      readState: vi.fn(async () => {
        throw new Error('query timeout');
      }),
    });
    const device = useDeviceStore.getState().devices[0];
    await useEditorStore.getState().loadProfile(device, 2);
    expect(await useEditorStore.getState().save(device)).toBe(true);
    expect(useEditorStore.getState().entries[DEVICE_ID]).toMatchObject({
      status: 'gravado',
      stateRefreshFailed: true,
    });
    expect(useDeviceStore.getState().devices[0].activeProfileSlot).toBe(1);
  });

  it('uses the reported active memory even when it differs from the write destination', async () => {
    registerDeviceDriver(DEVICE_ID, {
      applyToSession: vi.fn(async () => undefined),
      writeProfile: vi.fn(async () => undefined),
      readState: vi.fn(async () => ({ activeProfileSlot: 1, dpi: { x: 1600, y: 1600 } })),
    });
    const device = useDeviceStore.getState().devices[0];
    await useEditorStore.getState().loadProfile(device, 2);
    await useEditorStore.getState().save(device);
    expect(useDeviceStore.getState().devices[0]).toMatchObject({
      activeProfileSlot: 1,
      liveDpi: { x: 1600, y: 1600 },
    });
    expect(useEditorStore.getState().entries[DEVICE_ID].editingProfileSlot).toBe(2);
  });

  it('keeps a newer website DPI selection when an older report arrives during debounce', async () => {
    const applyToSession = vi.fn(async () => undefined);
    registerDeviceDriver(DEVICE_ID, { applyToSession, writeProfile: vi.fn(async () => undefined) });
    const device = useDeviceStore.getState().devices[0];
    useEditorStore.getState().edit(device, (draft) => ({ ...draft, activeStageId: 'estagio-4' }));
    useEditorStore.getState().syncActiveDpi(DEVICE_ID, 400);
    expect(mouseDraft(DEVICE_ID).activeStageId).toBe('estagio-4');
    await vi.runAllTimersAsync();
    expect(applyToSession).toHaveBeenCalledWith(
      expect.objectContaining({ activeStageId: 'estagio-4' }),
    );
  });

  it('loads the editor without switching, applying or writing to the mouse', async () => {
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

    expect(switchProfile).not.toHaveBeenCalled();
    expect(applyToSession).not.toHaveBeenCalled();
    expect(driver.writeProfile).not.toHaveBeenCalled();
    expect(useDeviceStore.getState().devices[0].activeProfileSlot).toBe(1);
    expect(useEditorStore.getState().entries[DEVICE_ID].editingProfileSlot).toBe(2);
    expect(mouseDraft(DEVICE_ID).pollingRate).toBe(500);
    expect(useEditorStore.getState().entries[DEVICE_ID].status).toBe('ocioso');
  });

  it('saves and retries in the edited slot even if the mouse changes its active slot', async () => {
    const writeProfile = vi
      .fn<DeviceDriver['writeProfile']>()
      .mockRejectedValueOnce(new Error('sem resposta'))
      .mockResolvedValue(undefined);
    registerDeviceDriver(DEVICE_ID, {
      applyToSession: vi.fn(async () => undefined),
      writeProfile,
    });
    const device = useDeviceStore.getState().devices[0];
    await useEditorStore.getState().loadProfile(device, 2);
    useEditorStore.getState().edit(device, (draft) => ({ ...draft, pollingRate: 125 }));
    useDeviceStore.getState().updateDevice(device.id, (current) => ({
      ...current,
      activeProfileSlot: 1,
    }));
    await useEditorStore.getState().save(device);

    useDeviceStore.getState().updateDevice(device.id, (current) => ({
      ...current,
      activeProfileSlot: 2,
    }));
    useEditorStore.getState().retry(device);
    await vi.advanceTimersByTimeAsync(0);

    expect(writeProfile).toHaveBeenCalledTimes(2);
    for (const call of writeProfile.mock.calls) {
      expect(call).toEqual([2, 'Perfil 2', expect.objectContaining({ pollingRate: 125 })]);
    }
    const current = useDeviceStore.getState().devices[0];
    expect(current.profiles[0].settings).toMatchObject({ pollingRate: 1000 });
    expect(current.profiles[1].settings).toMatchObject({ pollingRate: 125 });
    const entry = useEditorStore.getState().entries[DEVICE_ID];
    expect(entry.saved).toEqual(entry.draft);
    expect(entry.status).toBe('gravado');
  });

  it('keeps edits and discard local when editing an inactive slot', async () => {
    const applyToSession = vi.fn(async () => undefined);
    registerDeviceDriver(DEVICE_ID, {
      applyToSession,
      writeProfile: vi.fn(async () => undefined),
    });
    const device = useDeviceStore.getState().devices[0];

    await useEditorStore.getState().loadProfile(device, 2);
    useEditorStore.getState().edit(device, (draft) => ({ ...draft, pollingRate: 125 }));
    await vi.runAllTimersAsync();
    expect(mouseDraft(DEVICE_ID).pollingRate).toBe(125);
    useEditorStore.getState().discard(device);
    await vi.runAllTimersAsync();

    expect(applyToSession).not.toHaveBeenCalled();
    expect(mouseDraft(DEVICE_ID).pollingRate).toBe(500);
  });

  it('saves the edited slot before loading the active slot back into the editor', async () => {
    const writeProfile = vi.fn(async () => undefined);
    registerDeviceDriver(DEVICE_ID, {
      applyToSession: vi.fn(async () => undefined),
      writeProfile,
    });
    const device = useDeviceStore.getState().devices[0];
    await useEditorStore.getState().loadProfile(device, 2);
    useEditorStore.getState().edit(device, (draft) => ({ ...draft, pollingRate: 125 }));

    await useEditorStore.getState().saveAndLoad(device, 1);

    expect(writeProfile).toHaveBeenCalledWith(
      2,
      'Perfil 2',
      expect.objectContaining({ pollingRate: 125 }),
    );
    expect(useEditorStore.getState().entries[DEVICE_ID].editingProfileSlot).toBe(1);
    expect(mouseDraft(DEVICE_ID).pollingRate).toBe(1000);
    expect(useDeviceStore.getState().devices[0].activeProfileSlot).toBe(1);
  });

  it('does not acknowledge a copy into the active slot as saving the edited slot', async () => {
    registerDeviceDriver(DEVICE_ID, {
      applyToSession: vi.fn(async () => undefined),
      writeProfile: vi.fn(async () => undefined),
    });
    const device = useDeviceStore.getState().devices[0];
    await useEditorStore.getState().loadProfile(device, 2);
    useEditorStore.getState().edit(device, (draft) => ({ ...draft, pollingRate: 125 }));
    await useEditorStore.getState().saveToSlot(device, 1, 'Cópia');

    const entry = useEditorStore.getState().entries[DEVICE_ID];
    expect(entry.editingProfileSlot).toBe(2);
    expect(entry.saved).toMatchObject({ pollingRate: 500 });
    expect(entry.draft).toMatchObject({ pollingRate: 125 });
  });

  it('cancels a pending apply when loading a different slot', async () => {
    const applyToSession = vi.fn(async () => undefined);
    registerDeviceDriver(DEVICE_ID, { applyToSession, writeProfile: vi.fn(async () => undefined) });
    const device = useDeviceStore.getState().devices[0];
    useEditorStore.getState().edit(device, (draft) => ({ ...draft, pollingRate: 125 }));
    await useEditorStore.getState().loadProfile(device, 2);
    await vi.runAllTimersAsync();

    expect(applyToSession).not.toHaveBeenCalled();
    expect(mouseDraft(DEVICE_ID).pollingRate).toBe(500);
  });

  it('ignores active DPI changes while another slot is being edited', async () => {
    const device = useDeviceStore.getState().devices[0];
    await useEditorStore.getState().loadProfile(device, 2);
    const before = structuredClone(useEditorStore.getState().entries[DEVICE_ID]);
    const nextStage = mouseDraft(DEVICE_ID).dpiStages.find(
      (stage) => stage.id !== mouseDraft(DEVICE_ID).activeStageId,
    )!;

    useEditorStore.getState().syncActiveDpi(DEVICE_ID, nextStage.x);

    expect(useEditorStore.getState().entries[DEVICE_ID]).toEqual(before);
  });

  it('keeps an in-flight apply attached to its editor until failure is reported', async () => {
    let rejectApply!: (error: Error) => void;
    registerDeviceDriver(DEVICE_ID, {
      applyToSession: () =>
        new Promise((_, reject) => {
          rejectApply = reject;
        }),
      writeProfile: vi.fn(async () => undefined),
    });
    const device = useDeviceStore.getState().devices[0];
    useEditorStore.getState().edit(device, (draft) => ({ ...draft, pollingRate: 125 }));
    await vi.advanceTimersByTimeAsync(180);

    await useEditorStore.getState().loadProfile(device, 2);
    rejectApply(new Error('falha após reset'));
    await vi.advanceTimersByTimeAsync(0);

    const entry = useEditorStore.getState().entries[DEVICE_ID];
    expect(entry.editingProfileSlot).toBe(1);
    expect(entry.status).toBe('falha-aplicacao');
    expect(entry.draft).toMatchObject({ pollingRate: 125 });
  });

  it('restores the active session before explicitly discarding and loading another slot', async () => {
    const applyToSession = vi.fn(async () => undefined);
    registerDeviceDriver(DEVICE_ID, { applyToSession, writeProfile: vi.fn(async () => undefined) });
    const device = useDeviceStore.getState().devices[0];
    useEditorStore.getState().edit(device, (draft) => ({ ...draft, pollingRate: 125 }));
    await vi.runAllTimersAsync();

    await useEditorStore.getState().discardAndLoad(device, 2);

    expect(applyToSession).toHaveBeenLastCalledWith(device.profiles[0].settings);
    expect(mouseDraft(DEVICE_ID).pollingRate).toBe(500);
    expect(useEditorStore.getState().entries[DEVICE_ID].editingProfileSlot).toBe(2);
    expect(useDeviceStore.getState().devices[0].activeProfileSlot).toBe(1);
  });

  it('keeps the failed edited draft when save and load cannot write', async () => {
    registerDeviceDriver(DEVICE_ID, {
      applyToSession: vi.fn(async () => undefined),
      writeProfile: vi.fn(async () => {
        throw new Error('sem resposta');
      }),
    });
    const device = useDeviceStore.getState().devices[0];
    await useEditorStore.getState().loadProfile(device, 2);
    useEditorStore.getState().edit(device, (draft) => ({ ...draft, pollingRate: 125 }));

    await useEditorStore.getState().saveAndLoad(device, 1);

    expect(useEditorStore.getState().entries[DEVICE_ID]).toMatchObject({
      editingProfileSlot: 2,
      status: 'falha-gravacao',
      draft: { pollingRate: 125 },
    });
    expect(useDeviceStore.getState().devices[0].profiles[0]).toEqual(device.profiles[0]);
  });

  it('does not move the cursor to a missing or unread slot', async () => {
    const device = useDeviceStore.getState().devices[0];
    useDeviceStore.getState().updateDevice(device.id, (current) => ({
      ...current,
      profiles: current.profiles.map((slot) => ({ ...slot, settings: null })),
    }));
    useEditorStore.setState({ entries: { [DEVICE_ID]: initialEntry(device) } });
    const before = useEditorStore.getState().entries[DEVICE_ID];

    await useEditorStore.getState().loadProfile(device, 2);
    await useEditorStore.getState().loadProfile(device, 99);

    expect(useEditorStore.getState().entries[DEVICE_ID]).toEqual(before);
  });

  it('preserves a new edit made while discard and load restores the session', async () => {
    let finishRestore!: () => void;
    const applyToSession = vi
      .fn<DeviceDriver['applyToSession']>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishRestore = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    registerDeviceDriver(DEVICE_ID, { applyToSession, writeProfile: vi.fn(async () => undefined) });
    const device = useDeviceStore.getState().devices[0];
    const loading = useEditorStore.getState().discardAndLoad(device, 2);
    useEditorStore.getState().edit(device, (draft) => ({ ...draft, pollingRate: 125 }));

    finishRestore();
    await loading;

    expect(useEditorStore.getState().entries[DEVICE_ID]).toMatchObject({
      editingProfileSlot: 1,
      draft: { pollingRate: 125 },
    });
    await vi.runAllTimersAsync();
  });
});
