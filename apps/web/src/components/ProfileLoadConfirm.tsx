import type { Peripheral } from '@gearhub/shared';
import { activeProfileName, profileSlots } from '../domain/settings';
import { useEditorStore } from '../store/editorStore';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * Asked before loading another profile while the draft has unsaved changes.
 * The user can keep editing, save first or discard.
 */
export function ProfileLoadConfirm({
  device,
  slotIndex,
  onClose,
}: {
  device: Peripheral;
  slotIndex: number | null;
  onClose(): void;
}) {
  const saveAndLoad = useEditorStore((state) => state.saveAndLoad);
  const loadProfile = useEditorStore((state) => state.loadProfile);
  const slot = profileSlots(device).find((item) => item.index === slotIndex);
  const targetName = slot?.name || `Slot ${slotIndex ?? ''}`;

  return (
    <ConfirmDialog
      open={slotIndex !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Carregar ${targetName}?`}
      description={`Há alterações não salvas no ${activeProfileName(device)}.`}
      actions={[
        { label: 'Cancelar', onSelect: () => undefined },
        {
          label: 'Salvar e carregar',
          onSelect: () => {
            if (slotIndex !== null) void saveAndLoad(device, slotIndex);
          },
        },
        {
          label: 'Descartar e carregar',
          variant: 'default',
          onSelect: () => {
            if (slotIndex !== null) void loadProfile(device, slotIndex);
          },
        },
      ]}
    />
  );
}
