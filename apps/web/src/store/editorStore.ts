import type { MouseSettings, Peripheral, PeripheralSettings } from '@gearhub/shared';
import { create } from 'zustand';
import {
  activeSettings,
  isMouseSettings,
  profileSlots,
  withWrittenProfile,
} from '../domain/settings';
import { driverFor } from '../hardware/deviceDriver';
import { reportHardwareFailure } from '../hardware/hardwareFailure';
import { useDeviceStore } from './deviceStore';

/**
 * Editing changes the draft and applies it to the session. Writing it into a
 * profile is a separate, explicit action. A failure or a disconnection keeps
 * the draft.
 */
export type EditorStatus =
  'ocioso' | 'aplicando' | 'gravando' | 'gravado' | 'falha-aplicacao' | 'falha-gravacao';

export interface EditorEntry {
  /** Cursor in the editor; selecting it does not activate an onboard mouse slot. */
  editingProfileSlot: number;
  draft: PeripheralSettings;
  /** Settings currently stored in the slot being edited. */
  saved: PeripheralSettings;
  status: EditorStatus;
  savedProfileName?: string;
  stateRefreshFailed?: boolean;
  resetRevision: number;
}

interface EditorStore {
  entries: Record<string, EditorEntry>;
  edit(device: Peripheral, mutate: (draft: PeripheralSettings) => PeripheralSettings): void;
  discard(device: Peripheral): Promise<void>;
  save(device: Peripheral): Promise<boolean>;
  saveToSlot(device: Peripheral, slotIndex: number, name: string): Promise<boolean>;
  saveAndLoad(device: Peripheral, slotIndex: number): Promise<void>;
  discardAndLoad(device: Peripheral, slotIndex: number): Promise<void>;
  loadProfile(device: Peripheral, slotIndex: number): Promise<void>;
  renameProfile(device: Peripheral, slotIndex: number, name: string): Promise<boolean>;
  restoreDefaults(device: Peripheral): void;
  /** Drops the drafts of devices that left the session. */
  forget(deviceIds: string[]): void;
  /** Runs again the operation that failed, keeping the draft. */
  retry(device: Peripheral): void;
  /**
   * Follows a change the device made on its own, such as a DPI cycled with its
   * button. It is not an edit, so it moves the baseline too and leaves nothing
   * pending for the user to save.
   */
  syncActiveDpi(deviceId: string, dpi: number, y?: number): void;
  syncActiveProfile(deviceId: string, slotIndex: number): void;
  /**
   * Replaces the baseline once the device reports what it actually holds.
   *
   * Until the mouse dumps its own mappings the app shows values it invented, so
   * this is a correction, not an edit. It stands down whenever the user has
   * something of their own in the draft: their work outranks the correction.
   */
  rebase(deviceId: string, slotIndex: number, settings: PeripheralSettings): void;
}

const SAVED_MESSAGE_MS = 2600;

const applyTokens = new Map<string, symbol>();
interface ProfileWrite {
  slotIndex: number;
  name: string;
  settings: PeripheralSettings;
}
const writes = new Map<string, symbol>();
const failedWrites = new Map<string, ProfileWrite>();
const savedTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * A drag over a slider produces an edit per pixel, and on the Leviathan V4 each
 * apply is a config reset plus the parameter block plus the whole mapping set.
 * Sending that per event floods the HID endpoint hard enough to stall input on
 * the machine, so edits coalesce and only the last one is written.
 */
const APPLY_DEBOUNCE_MS = 180;
const pendingApplies = new Map<string, ReturnType<typeof setTimeout>>();
const runningApplies = new Set<string>();
const queuedApplies = new Map<string, { device: Peripheral; draft: PeripheralSettings }>();
const dpiReportRevisions = new Map<string, number>();

function cancelPendingApply(deviceId: string) {
  const timer = pendingApplies.get(deviceId);
  if (timer === undefined) return;
  clearTimeout(timer);
  pendingApplies.delete(deviceId);
}

/**
 * The device store is the authority on connection state and profiles: a device
 * captured while rendering may already be disconnected when the action runs.
 */
function liveDevice(device: Peripheral): Peripheral {
  return useDeviceStore.getState().devices.find((item) => item.id === device.id) ?? device;
}

export function initialEntry(device: Peripheral): EditorEntry {
  const settings = structuredClone(activeSettings(device));
  return {
    editingProfileSlot: device.activeProfileSlot,
    draft: settings,
    saved: structuredClone(settings),
    status: 'ocioso',
    resetRevision: 0,
  };
}

function canApplyToSession(device: Peripheral, entry: EditorEntry): boolean {
  return (
    device.status !== 'desconectado' &&
    (device.type !== 'mouse' || entry.editingProfileSlot === device.activeProfileSlot)
  );
}

export const useEditorStore = create<EditorStore>((set, get) => {
  function entryOf(device: Peripheral): EditorEntry {
    return get().entries[device.id] ?? initialEntry(device);
  }

  function put(deviceId: string, changes: Partial<EditorEntry>, base?: EditorEntry) {
    set((state) => {
      const current = base ?? state.entries[deviceId];
      if (!current) return state;
      return { entries: { ...state.entries, [deviceId]: { ...current, ...changes } } };
    });
  }

  function clearSavedTimer(deviceId: string) {
    const timer = savedTimers.get(deviceId);
    if (timer) {
      clearTimeout(timer);
      savedTimers.delete(deviceId);
    }
  }

  async function applyToSession(device: Peripheral, draft: PeripheralSettings) {
    cancelPendingApply(device.id);
    if (!canApplyToSession(liveDevice(device), entryOf(device))) {
      put(device.id, { status: 'ocioso' });
      return;
    }
    if (runningApplies.has(device.id)) {
      queuedApplies.set(device.id, { device, draft });
      return;
    }

    const token = Symbol();
    applyTokens.set(device.id, token);
    runningApplies.add(device.id);
    let beforeReport = dpiReportRevisions.get(device.id);
    try {
      let current = { device, draft };
      while (true) {
        beforeReport = dpiReportRevisions.get(device.id);
        await driverFor(current.device).applyToSession(current.draft);
        if (applyTokens.get(device.id) !== token) return;
        if (liveDevice(device).status === 'desconectado') throw new Error('Disconnected');
        if (dpiReportRevisions.get(device.id) === beforeReport && isMouseSettings(current.draft)) {
          const selected = current.draft;
          const stage = selected.dpiStages.find((item) => item.id === selected.activeStageId);
          if (stage)
            useDeviceStore
              .getState()
              .updateDevice(device.id, (item) =>
                item.type === 'mouse' ? { ...item, liveDpi: { x: stage.x, y: stage.y } } : item,
              );
        }

        const queued = queuedApplies.get(device.id);
        if (!queued) break;
        queuedApplies.delete(device.id);
        current = queued;
      }
      put(device.id, { status: 'ocioso' });
    } catch (error) {
      if (applyTokens.get(device.id) !== token) return;
      queuedApplies.delete(device.id);
      reportHardwareFailure('aplicar os ajustes', error);
      put(device.id, { status: 'falha-aplicacao' });
    } finally {
      runningApplies.delete(device.id);
      if (
        applyTokens.get(device.id) === token &&
        dpiReportRevisions.get(device.id) !== beforeReport
      ) {
        reconcileDpi(device);
      }
    }
  }

  function reconcileDpi(device: Peripheral) {
    const current = liveDevice(device);
    if (current.type === 'mouse' && current.liveDpi) {
      get().syncActiveDpi(device.id, current.liveDpi.x, current.liveDpi.y);
    }
  }

  async function writeProfile(device: Peripheral, operation: ProfileWrite): Promise<boolean> {
    // A queued apply would land after the save and overwrite what was written.
    cancelPendingApply(device.id);
    queuedApplies.delete(device.id);
    if (
      writes.has(device.id) ||
      device.status === 'desconectado' ||
      !profileSlots(device).some((slot) => slot.index === operation.slotIndex)
    )
      return false;
    const token = Symbol();
    writes.set(device.id, token);
    let refreshed = false;
    applyTokens.delete(device.id);
    clearSavedTimer(device.id);
    put(
      device.id,
      { status: 'gravando', savedProfileName: operation.name, stateRefreshFailed: false },
      entryOf(device),
    );
    try {
      await driverFor(device).writeProfile(operation.slotIndex, operation.name, operation.settings);
      if (writes.get(device.id) !== token) return false;
      if (liveDevice(device).status === 'desconectado') throw new Error('Disconnected');
      useDeviceStore
        .getState()
        .updateDevice(device.id, (current) =>
          withWrittenProfile(current, operation.slotIndex, operation.name, operation.settings),
        );
      const entry = entryOf(device);
      put(device.id, {
        saved:
          operation.slotIndex === entry.editingProfileSlot
            ? structuredClone(operation.settings)
            : entry.saved,
        status: 'gravando',
      });
      failedWrites.delete(device.id);
      // The flash write succeeded. A failed readback must never turn this into
      // a failed write or invite a retry that writes the same memory again.
      const driver = driverFor(device);
      if (driver.readState) {
        try {
          const state = await driver.readState();
          if (writes.get(device.id) !== token) return true;
          get().syncActiveProfile(device.id, state.activeProfileSlot);
          get().syncActiveDpi(device.id, state.dpi.x, state.dpi.y);
          refreshed = true;
        } catch {
          if (writes.get(device.id) !== token) return true;
          put(device.id, { stateRefreshFailed: true });
        }
      }
      put(device.id, { status: 'gravado' });
      savedTimers.set(
        device.id,
        setTimeout(() => {
          savedTimers.delete(device.id);
          put(device.id, { status: 'ocioso' });
        }, SAVED_MESSAGE_MS),
      );
      return true;
    } catch (error) {
      if (writes.get(device.id) === token) {
        failedWrites.set(device.id, operation);
        reportHardwareFailure('gravar o perfil', error);
        put(device.id, { status: 'falha-gravacao' });
      }
      return false;
    } finally {
      if (writes.get(device.id) === token) {
        writes.delete(device.id);
        if (refreshed) reconcileDpi(device);
      }
    }
  }

  return {
    entries: {},

    edit: (input, mutate) => {
      const device = liveDevice(input);
      if (writes.has(device.id)) return;
      const entry = entryOf(device);
      const draft = mutate(entry.draft);
      const apply = canApplyToSession(device, entry);
      clearSavedTimer(device.id);
      failedWrites.delete(device.id);
      put(device.id, { draft, status: apply ? 'aplicando' : 'ocioso' }, entry);
      cancelPendingApply(device.id);
      if (!apply) return;
      pendingApplies.set(
        device.id,
        setTimeout(() => {
          pendingApplies.delete(device.id);
          void applyToSession(device, draft);
        }, APPLY_DEBOUNCE_MS),
      );
    },

    discard: async (input) => {
      const device = liveDevice(input);
      if (writes.has(device.id)) return;
      const entry = entryOf(device);
      clearSavedTimer(device.id);
      failedWrites.delete(device.id);
      const draft = structuredClone(entry.saved);
      put(
        device.id,
        {
          draft,
          status: canApplyToSession(device, entry) ? 'aplicando' : 'ocioso',
          resetRevision: entry.resetRevision + 1,
        },
        entry,
      );
      cancelPendingApply(device.id);
      queuedApplies.delete(device.id);
      if (canApplyToSession(device, entry)) await applyToSession(device, draft);
    },

    save: async (input) => {
      const device = liveDevice(input);
      const entry = entryOf(device);
      const slot = profileSlots(device).find(
        (profile) => profile.index === entry.editingProfileSlot,
      );
      if (!slot) return false;
      return writeProfile(device, {
        slotIndex: slot.index,
        name: slot.name,
        settings: structuredClone(entry.draft),
      });
    },

    saveToSlot: async (input, slotIndex, name) => {
      const device = liveDevice(input);
      return writeProfile(device, {
        slotIndex,
        name,
        settings: structuredClone(entryOf(device).draft),
      });
    },

    saveAndLoad: async (device, slotIndex) => {
      if (await get().save(device)) await get().loadProfile(liveDevice(device), slotIndex);
    },
    discardAndLoad: async (input, slotIndex) => {
      const device = liveDevice(input);
      if (writes.has(device.id) || runningApplies.has(device.id)) return;
      if (!profileSlots(device).find((slot) => slot.index === slotIndex)?.settings) return;
      const sourceSlot = entryOf(device).editingProfileSlot;
      // This explicit discard also undoes the preview in the active session.
      // A plain cursor selection only reads the destination into the editor.
      await get().discard(device);
      const entry = get().entries[device.id];
      if (
        entry?.status === 'ocioso' &&
        entry.editingProfileSlot === sourceSlot &&
        JSON.stringify(entry.draft) === JSON.stringify(entry.saved)
      ) {
        await get().loadProfile(device, slotIndex);
      }
    },
    loadProfile: async (input, slotIndex) => {
      const device = liveDevice(input);
      if (writes.has(device.id) || runningApplies.has(device.id)) return;
      const slot = profileSlots(device).find((profile) => profile.index === slotIndex);
      if (!slot?.settings) return;

      clearSavedTimer(device.id);
      failedWrites.delete(device.id);
      cancelPendingApply(device.id);
      queuedApplies.delete(device.id);
      applyTokens.delete(device.id);
      const settings = structuredClone(slot.settings);
      set((state) => ({
        entries: {
          ...state.entries,
          [device.id]: {
            editingProfileSlot: slotIndex,
            draft: settings,
            saved: structuredClone(settings),
            status:
              device.type === 'mouse' || device.status === 'desconectado' ? 'ocioso' : 'aplicando',
            resetRevision: entryOf(device).resetRevision + 1,
          },
        },
      }));
      // Onboard config is an editing cursor. Loading a mouse slot must not
      // send a switch command or apply its settings to the running session.
      if (device.type === 'mouse') return;
      useDeviceStore
        .getState()
        .updateDevice(device.id, (current) => ({ ...current, activeProfileSlot: slotIndex }));
      if (device.status === 'desconectado') return;

      // A device that keeps its profiles onboard already holds this slot: ask
      // it to run that one instead of writing the settings back into it.
      let driver;
      try {
        driver = driverFor(device);
      } catch {
        driver = undefined;
      }
      if (!driver?.switchProfile) {
        await applyToSession(device, settings);
        return;
      }
      cancelPendingApply(device.id);
      queuedApplies.delete(device.id);
      try {
        await driver.switchProfile(slotIndex);
        put(device.id, { status: 'ocioso' });
      } catch (error) {
        reportHardwareFailure('trocar de perfil', error);
        put(device.id, { status: 'falha-aplicacao' });
      }
    },

    renameProfile: async (input, slotIndex, name) => {
      const device = liveDevice(input);
      const settings = profileSlots(device).find(
        (profile) => profile.index === slotIndex,
      )?.settings;
      if (!settings) return false;
      return writeProfile(device, { slotIndex, name, settings: structuredClone(settings) });
    },

    restoreDefaults: (device) => {
      if (writes.has(device.id)) return;
      get().edit(device, () => structuredClone(liveDevice(device).defaults));
      put(device.id, { resetRevision: entryOf(device).resetRevision + 1 });
    },

    forget: (deviceIds) => {
      for (const deviceId of deviceIds) {
        clearSavedTimer(deviceId);
        cancelPendingApply(deviceId);
        queuedApplies.delete(deviceId);
        applyTokens.delete(deviceId);
        writes.delete(deviceId);
        failedWrites.delete(deviceId);
        dpiReportRevisions.delete(deviceId);
      }
      set((state) => {
        const entries = { ...state.entries };
        for (const deviceId of deviceIds) delete entries[deviceId];
        return { entries };
      });
    },

    syncActiveProfile: (deviceId, slotIndex) => {
      const device = useDeviceStore.getState().devices.find((item) => item.id === deviceId);
      if (device?.type !== 'mouse' || !device.profiles.some((slot) => slot.index === slotIndex))
        return;
      const previousSlot = device.activeProfileSlot;
      if (previousSlot === slotIndex) return;
      cancelPendingApply(deviceId);
      queuedApplies.delete(deviceId);
      useDeviceStore.getState().updateDevice(deviceId, (current) => ({
        ...current,
        activeProfileSlot: slotIndex,
      }));
      const entry = get().entries[deviceId];
      // No entry yet means the editor opens on the memory now reported active.
      if (!entry) return;
      const changes: Partial<EditorEntry> = {};
      if (entry.status === 'aplicando' && !runningApplies.has(deviceId)) changes.status = 'ocioso';
      // The cursor was on the memory the mouse was running, so it moves along
      // with it. Left behind, it would stop matching the active slot: what the
      // device reports would no longer reach the editor, and edits would stop
      // being applied — both without saying so. A cursor the user pointed
      // somewhere else stays there, and so does a draft of their own.
      const target = device.profiles.find((slot) => slot.index === slotIndex);
      if (
        entry.editingProfileSlot === previousSlot &&
        JSON.stringify(entry.draft) === JSON.stringify(entry.saved)
      ) {
        changes.editingProfileSlot = slotIndex;
        // Only a memory the device has actually reported replaces the draft. A
        // slot still holding seeded values knows less than the draft does: it
        // would undo what the mouse just reported and show a stale stage.
        if (target?.settings && !target.initial) {
          const settings = structuredClone(target.settings);
          changes.draft = settings;
          changes.saved = structuredClone(settings);
          changes.resetRevision = entry.resetRevision + 1;
        }
      }
      put(deviceId, changes);
    },

    syncActiveDpi: (deviceId, dpi, y = dpi) => {
      const device = useDeviceStore.getState().devices.find((item) => item.id === deviceId);
      if (device?.type !== 'mouse' || dpi <= 0 || y <= 0 || !Number.isFinite(dpi + y)) return;
      dpiReportRevisions.set(deviceId, (dpiReportRevisions.get(deviceId) ?? 0) + 1);
      // X identifies the stage; Y only disambiguates where the axes are split.
      // Requiring both is how this stopped following a mouse that reports a Y
      // the stage list does not mirror.
      const follow = (settings: PeripheralSettings): PeripheralSettings => {
        if (!isMouseSettings(settings)) return settings;
        const stage = settings.dpiStages.find(
          (item) => item.x === dpi && (!settings.independentAxes || item.y === y),
        );
        return stage ? { ...settings, activeStageId: stage.id } : settings;
      };
      useDeviceStore.getState().updateDevice(deviceId, (current) =>
        current.type !== 'mouse'
          ? current
          : {
              ...current,
              liveDpi: { x: dpi, y },
              profiles: current.profiles.map((slot) =>
                !writes.has(deviceId) && slot.index === current.activeProfileSlot && slot.settings
                  ? { ...slot, settings: follow(slot.settings) as typeof slot.settings }
                  : slot,
              ),
            },
      );
      const entry = entryOf(device);
      if (entry.editingProfileSlot !== device.activeProfileSlot) return;
      // Stale echoes cannot replace a newer stage selected on the website.
      if (pendingApplies.has(deviceId) || runningApplies.has(deviceId) || writes.has(deviceId))
        return;
      if (
        !isMouseSettings(entry.draft) ||
        (follow(entry.draft) as MouseSettings).activeStageId === entry.draft.activeStageId
      )
        return;
      put(deviceId, { draft: follow(entry.draft), saved: follow(entry.saved) }, entry);
    },

    rebase: (deviceId, slotIndex, settings) => {
      const entry = get().entries[deviceId];
      // No entry yet means the editor has not opened this device, and it will
      // read the corrected values from the device itself when it does.
      if (!entry || entry.status !== 'ocioso') return;
      if (entry.editingProfileSlot !== slotIndex) return;
      if (writes.has(deviceId) || pendingApplies.has(deviceId) || runningApplies.has(deviceId)) {
        return;
      }
      if (JSON.stringify(entry.draft) !== JSON.stringify(entry.saved)) return;

      const corrected = structuredClone(settings);
      put(
        deviceId,
        {
          draft: corrected,
          saved: structuredClone(corrected),
          resetRevision: entry.resetRevision + 1,
        },
        entry,
      );
    },

    retry: (input) => {
      const device = liveDevice(input);
      const entry = get().entries[device.id];
      if (!entry || device.status === 'desconectado') return;
      if (writes.has(device.id)) return;
      if (entry.status === 'falha-gravacao') {
        const failed = failedWrites.get(device.id);
        if (failed) void writeProfile(device, failed);
        return;
      }
      put(device.id, { status: 'aplicando' }, entry);
      void applyToSession(device, entry.draft);
    },
  };
});
