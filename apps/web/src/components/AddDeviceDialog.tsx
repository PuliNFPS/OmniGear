import { Alert, AlertDescription, AlertTitle } from '@gearhub/ui/components/alert';
import { Button } from '@gearhub/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@gearhub/ui/components/dialog';
import { CircleAlert, Keyboard, LoaderCircle, Mouse, Usb } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { connectionErrorMessages } from '../app/labels';
import { useDeviceStore } from '../store/deviceStore';

const steps: Array<{ icon: LucideIcon; text: string }> = [
  { icon: Usb, text: 'Conecte por USB ou receptor compatível.' },
  { icon: Mouse, text: 'Clique em Selecionar dispositivo.' },
  { icon: Keyboard, text: 'Escolha o periférico na janela do navegador.' },
];

export function AddDeviceDialog() {
  const open = useDeviceStore((state) => state.addDeviceOpen);
  const connection = useDeviceStore((state) => state.connection);
  const connectionError = useDeviceStore((state) => state.connectionError);
  const closeAddDevice = useDeviceStore((state) => state.closeAddDevice);
  const connectDevice = useDeviceStore((state) => state.connectDevice);
  const startDemo = useDeviceStore((state) => state.startDemo);

  const connecting = connection === 'conectando';
  const error =
    connection === 'erro' && connectionError ? connectionErrorMessages[connectionError] : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeAddDevice();
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Adicionar dispositivo</DialogTitle>
          <DialogDescription>Conecte seu mouse ou teclado para começar.</DialogDescription>
        </DialogHeader>

        <ol className="divide-y divide-border border-y border-border">
          {steps.map((step, index) => (
            <li key={step.text} className="flex items-center gap-4 py-4">
              <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border text-xs font-medium">
                {index + 1}
              </span>
              <step.icon className="size-6 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm">{step.text}</span>
            </li>
          ))}
        </ol>

        {connection === 'cancelado' && (
          <p role="status" className="text-sm text-muted-foreground">
            Seleção cancelada. Nenhum dispositivo foi adicionado.
          </p>
        )}

        {error && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>{error.title}</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        <p className="text-sm text-muted-foreground">A compatibilidade depende do modelo.</p>

        <DialogFooter className="sm:grid sm:grid-cols-2 sm:gap-3">
          <Button size="lg" disabled={connecting} onClick={() => void connectDevice()}>
            {connecting && (
              <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
            )}
            {connecting ? 'Procurando dispositivo…' : 'Selecionar dispositivo'}
          </Button>
          <Button size="lg" variant="outline" onClick={closeAddDevice}>
            Cancelar
          </Button>
        </DialogFooter>

        <button
          type="button"
          disabled={connecting}
          onClick={() => void startDemo()}
          className="mx-auto rounded-md text-sm underline underline-offset-4 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
        >
          Explorar demonstração
        </button>
      </DialogContent>
    </Dialog>
  );
}
