import type { Peripheral } from '@gearhub/shared';
import { useEditorEntry } from '../app/useEditor';
import { profileName, profileSlots } from '../domain/settings';
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
  const { editingProfileSlot } = useEditorEntry(device);
  const discardAndLoad = useEditorStore((state) => state.discardAndLoad);
  const slot = profileSlots(device).find((item) => item.index === slotIndex);
  const targetName = slot?.name || `Slot ${slotIndex ?? ''}`;

  return (
    <ConfirmDialog
      open={slotIndex !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Carregar ${targetName}?`}
      description={`Há alterações não salvas no ${profileName(device, editingProfileSlot)}.`}
      note={
        device.type === 'mouse'
          ? 'O perfil será carregado para edição. O slot ativo no mouse não muda.'
          : undefined
      }
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
            if (slotIndex !== null) void discardAndLoad(device, slotIndex);
          },
        },
      ]}
    />
  );
}
