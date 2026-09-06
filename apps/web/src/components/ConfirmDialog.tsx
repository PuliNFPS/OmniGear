import { Button } from '@gearhub/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@gearhub/ui/components/dialog';
import type { ReactNode } from 'react';

export interface ConfirmAction {
  label: string;
  variant?: 'default' | 'outline' | 'destructive';
  onSelect(): void;
}

/**
 * Confirmation before losing work or changing what the device is running.
 * Focus stays inside, Escape closes and the background is inert.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  note,
  actions,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  note?: ReactNode;
  actions: ConfirmAction[];
  onOpenChange(open: boolean): void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        role="alertdialog"
        className="max-w-md"
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {note && (
          <p className="border-t border-border pt-4 text-sm text-muted-foreground">{note}</p>
        )}
        <DialogFooter className="gap-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant ?? 'outline'}
              onClick={() => {
                action.onSelect();
                onOpenChange(false);
              }}
            >
              {action.label}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
