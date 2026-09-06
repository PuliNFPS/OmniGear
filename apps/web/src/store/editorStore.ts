import type { Peripheral, PeripheralSettings } from '@gearhub/shared';
import { create } from 'zustand';
import { activeSettings, profileSlots, withWrittenProfile } from '../domain/settings';
import { driverFor } from '../hardware/deviceDriver';
import { useDeviceStore } from './deviceStore';

/**
 * Editing changes the draft and applies it to the session. Writing it into a
 * profile is a separate, explicit action. A failure or a disconnection keeps
 * the draft.
 */
export type EditorStatus =
  'ocioso' | 'aplicando' | 'gravando' | 'gravado' | 'falha-aplicacao' | 'falha-gravacao';

export interface EditorEntry {
  draft: PeripheralSettings;
  /** Settings currently stored in the active profile slot. */
  saved: PeripheralSettings;
  status: EditorStatus;
  savedProfileName?: string;
  resetRevision: number;
}

interface EditorStore {
  entries: Record<string, EditorEntry>;
  edit(device: Peripheral, mutate: (draft: PeripheralSettings) => PeripheralSettings): void;
  discard(device: Peripheral): void;
  save(device: Peripheral): Promise<boolean>;
  saveToSlot(device: Peripheral, slotIndex: number, name: string): Promise<boolean>;
  saveAndLoad(device: Peripheral, slotIndex: number): Promise<void>;
  loadProfile(device: Peripheral, slotIndex: number): Promise<void>;
  renameProfile(device: Peripheral, slotIndex: number, name: string): Promise<boolean>;
  restoreDefaults(device: Peripheral): void;
  /** Drops the drafts of devices that left the session. */
  forget(deviceIds: string[]): void;
  /** Runs again the operation that failed, keeping the draft. */
  retry(device: Peripheral): void;
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
  return { draft: settings, saved: structuredClone(settings), status: 'ocioso', resetRevision: 0 };
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
    const token = Symbol();
    applyTokens.set(device.id, token);
    try {
      await driverFor(device).applyToSession(draft);
      if (applyTokens.get(device.id) !== token) return;
      if (liveDevice(device).status === 'desconectado') throw new Error('Disconnected');
      put(device.id, { status: 'ocioso' });
    } catch {
      if (applyTokens.get(device.id) !== token) return;
      put(device.id, { status: 'falha-aplicacao' });
    }
  }

  async function writeProfile(device: Peripheral, operation: ProfileWrite): Promise<boolean> {
    // A queued apply would land after the save and overwrite what was written.
    cancelPendingApply(device.id);
    if (
      writes.has(device.id) ||
      device.status === 'desconectado' ||
      !profileSlots(device).some((slot) => slot.index === operation.slotIndex)
    )
      return false;
    const token = Symbol();
    writes.set(device.id, token);
    applyTokens.delete(device.id);
    clearSavedTimer(device.id);
    put(device.id, { status: 'gravando', savedProfileName: operation.name }, entryOf(device));
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
          operation.slotIndex === device.activeProfileSlot
            ? structuredClone(operation.settings)
            : entry.saved,
        status: 'gravado',
      });
      failedWrites.delete(device.id);
      savedTimers.set(
        device.id,
        setTimeout(() => {
          savedTimers.delete(device.id);
          put(device.id, { status: 'ocioso' });
        }, SAVED_MESSAGE_MS),
      );
      return true;
    } catch {
      if (writes.get(device.id) === token) {
        failedWrites.set(device.id, operation);
        put(device.id, { status: 'falha-gravacao' });
      }
      return false;
    } finally {
      if (writes.get(device.id) === token) writes.delete(device.id);
    }
  }

  return {
    entries: {},

    edit: (input, mutate) => {
      const device = liveDevice(input);
      if (writes.has(device.id)) return;
      const entry = entryOf(device);
      const draft = mutate(entry.draft);
      const offline = device.status === 'desconectado';
      clearSavedTimer(device.id);
      failedWrites.delete(device.id);
      put(device.id, { draft, status: offline ? 'ocioso' : 'aplicando' }, entry);
      if (offline) return;
      cancelPendingApply(device.id);
      pendingApplies.set(
        device.id,
        setTimeout(() => {
          pendingApplies.delete(device.id);
          void applyToSession(device, draft);
        }, APPLY_DEBOUNCE_MS),
      );
    },

    discard: (input) => {
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
          status: device.status === 'desconectado' ? 'ocioso' : 'aplicando',
          resetRevision: entry.resetRevision + 1,
        },
        entry,
      );
      if (device.status !== 'desconectado') void applyToSession(device, draft);
    },

    save: async (input) => {
      const device = liveDevice(input);
      const slot = profileSlots(device).find(
        (profile) => profile.index === device.activeProfileSlot,
      );
      if (!slot) return false;
      return writeProfile(device, {
        slotIndex: slot.index,
        name: slot.name,
        settings: structuredClone(entryOf(device).draft),
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
    loadProfile: async (input, slotIndex) => {
      const device = liveDevice(input);
      if (writes.has(device.id)) return;
      const slot = profileSlots(device).find((profile) => profile.index === slotIndex);
      if (!slot?.settings) return;

      clearSavedTimer(device.id);
      const settings = structuredClone(slot.settings);
      set((state) => ({
        entries: {
          ...state.entries,
          [device.id]: {
            draft: settings,
            saved: structuredClone(settings),
            status: device.status === 'desconectado' ? 'ocioso' : 'aplicando',
            resetRevision: entryOf(device).resetRevision + 1,
          },
        },
      }));
      useDeviceStore
        .getState()
        .updateDevice(device.id, (current) => ({ ...current, activeProfileSlot: slotIndex }));
      if (device.status !== 'desconectado') await applyToSession(device, settings);
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
        applyTokens.delete(deviceId);
        writes.delete(deviceId);
        failedWrites.delete(deviceId);
      }
      set((state) => {
        const entries = { ...state.entries };
        for (const deviceId of deviceIds) delete entries[deviceId];
        return { entries };
      });
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
