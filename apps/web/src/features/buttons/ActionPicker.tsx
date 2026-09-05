import type { ButtonAction } from '@gearhub/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@gearhub/ui/components/dialog';
import { actionLabel } from './actionLabel';

/** Macro está fora do v1: nenhuma opção de macro é oferecida. */
const OPTIONS: ButtonAction[] = [
  { kind: 'button', button: 'left' },
  { kind: 'button', button: 'right' },
  { kind: 'button', button: 'middle' },
  { kind: 'button', button: 'back' },
  { kind: 'button', button: 'forward' },
  { kind: 'dpi', mode: 'cycle' },
  { kind: 'dpi', mode: 'shift' },
  { kind: 'scroll', direction: 'up' },
  { kind: 'scroll', direction: 'down' },
  { kind: 'disabled' },
];

export function ActionPicker({
  open,
  buttonLabel,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  buttonLabel: string;
  onOpenChange(open: boolean): void;
  onPick(action: ButtonAction): void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ação para {buttonLabel}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-1">
          {OPTIONS.map((action) => (
            <button
              key={actionLabel(action)}
              type="button"
              onClick={() => {
                onPick(action);
                onOpenChange(false);
              }}
              className="rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              {actionLabel(action)}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
