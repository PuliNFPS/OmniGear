import type {
  KeyboardPeripheral,
  KeyboardSettings,
  MousePeripheral,
  MouseSettings,
  Peripheral,
} from '@gearhub/shared';
import { useCallback, useMemo, useState } from 'react';
import { countChanges } from '../domain/changes';
import { isKeyboardSettings, isMouseSettings } from '../domain/settings';
import { initialEntry, useEditorStore, type EditorEntry } from '../store/editorStore';

/** The draft of a device, created from its active profile on first access. */
export function useEditorEntry(device: Peripheral): EditorEntry {
  const stored = useEditorStore((state) => state.entries[device.id]);
  const fallback = useMemo(() => initialEntry(device), [device]);
  return stored ?? fallback;
}

export function useChangeCount(device: Peripheral): number {
  const entry = useEditorEntry(device);
  return countChanges(entry.saved, entry.draft);
}

export function useMouseEditor(device: MousePeripheral) {
  const entry = useEditorEntry(device);
  const edit = useEditorStore((state) => state.edit);
  const draft = isMouseSettings(entry.draft) ? entry.draft : device.defaults;

  const update = useCallback(
    (mutate: (draft: MouseSettings) => MouseSettings) => {
      edit(device, (current) => (isMouseSettings(current) ? mutate(current) : current));
    },
    [device, edit],
  );

  return { draft, update, status: entry.status };
}

export function useKeyboardEditor(device: KeyboardPeripheral) {
  const entry = useEditorEntry(device);
  const edit = useEditorStore((state) => state.edit);
  const draft = isKeyboardSettings(entry.draft) ? entry.draft : device.defaults;

  const update = useCallback(
    (mutate: (draft: KeyboardSettings) => KeyboardSettings) => {
      edit(device, (current) => (isKeyboardSettings(current) ? mutate(current) : current));
    },
    [device, edit],
  );

  return { draft, update, status: entry.status };
}

/**
 * Loading another profile replaces the editor's draft, so unsaved changes
 * must be resolved before moving the editing cursor.
 */
export function useProfileLoad(device: Peripheral) {
  const changes = useChangeCount(device);
  const { editingProfileSlot } = useEditorEntry(device);
  const loadProfile = useEditorStore((state) => state.loadProfile);
  const [pendingSlot, setPendingSlot] = useState<number | null>(null);

  const requestLoad = useCallback(
    (slotIndex: number) => {
      if (slotIndex === editingProfileSlot) return;
      if (changes > 0) {
        setPendingSlot(slotIndex);
        return;
      }
      void loadProfile(device, slotIndex);
    },
    [changes, device, editingProfileSlot, loadProfile],
  );

  return { requestLoad, pendingSlot, clearPendingSlot: () => setPendingSlot(null) };
}
