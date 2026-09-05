import { isDirty } from '@gearhub/shared';
import { Button } from '@gearhub/ui/components/button';
import { useMouseStore } from '../store/mouseStore';

export function DirtyBar() {
  const session = useMouseStore((state) => state.session);
  const saveToSlot = useMouseStore((state) => state.saveToSlot);
  if (!session || !isDirty(session)) return null;

  return (
    <div className="flex items-center justify-between border-t border-border-subtle bg-bg-surface px-6 py-3">
      <span className="text-[13px] text-text-muted">
        Alterações não salvas no slot {session.activeSlotIndex}
      </span>
      <Button onClick={() => void saveToSlot(session.activeSlotIndex)}>Salvar no slot</Button>
    </div>
  );
}
