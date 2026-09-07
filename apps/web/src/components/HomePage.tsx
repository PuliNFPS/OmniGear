import type { Peripheral } from '@gearhub/shared';
import { Button } from '@gearhub/ui/components/button';
import { cn } from '@gearhub/ui/lib/utils';
import { ChevronRight, CircleHelp, Keyboard, Mouse, Plus, Unplug } from 'lucide-react';
import { useState } from 'react';
import { describeDevice } from '../app/labels';
import { defaultSectionFor } from '../app/routes';
import { navigate } from '../app/useRoute';
import { useDeviceStore } from '../store/deviceStore';
import { DevicePhoto } from './devices/DevicePhoto';

export function HomePage() {
  const devices = useDeviceStore((state) => state.devices);
  const loading = useDeviceStore((state) => state.loading);
  const openAddDevice = useDeviceStore((state) => state.openAddDevice);
  const startDemo = useDeviceStore((state) => state.startDemo);
  const connecting = useDeviceStore((state) => state.connection === 'conectando');
  const reconnect = useDeviceStore((state) => state.reconnect);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = devices.find((device) => device.id === selectedId) ?? devices[0] ?? null;
  const empty = !loading && devices.length === 0;

  return (
    <main
      id="conteudo"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 focus:outline-none sm:px-8 sm:py-14"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Seus dispositivos
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {empty
              ? 'Conecte um periférico para começar.'
              : 'Selecione um periférico para configurar.'}
          </p>
        </div>
        <Button size="lg" disabled={loading || connecting} onClick={openAddDevice}>
          <Plus className="size-4" aria-hidden="true" />
          Adicionar dispositivo
        </Button>
      </div>

      <div className="mt-8 flex-1">
        {loading && <DeviceListSkeleton />}

        {empty && <EmptyDevices connecting={connecting} onExploreDemo={() => void startDemo()} />}

        {!loading && devices.length > 0 && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <ul className="flex flex-col gap-3">
              {devices.map((device) => (
                <li key={device.id}>
                  <DeviceCard
                    device={device}
                    selected={selected?.id === device.id}
                    onSelect={() => setSelectedId(device.id)}
                  />
                </li>
              ))}
            </ul>
            {selected && (
              <DevicePreview device={selected} onReconnect={() => reconnect(selected.id)} />
            )}
          </div>
        )}
      </div>

      <p className="mt-10">
        <button
          type="button"
          onClick={openAddDevice}
          disabled={loading || connecting}
          className="inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CircleHelp className="size-4" aria-hidden="true" />
          Precisa de ajuda para conectar?
        </button>
      </p>
    </main>
  );
}

function DeviceThumb({ device }: { device: Peripheral }) {
  return (
    <DevicePhoto
      photo={device.photo}
      className={device.type === 'mouse' ? 'h-14 w-auto' : 'max-h-12 w-full'}
    />
  );
}

function DeviceCard({
  device,
  selected,
  onSelect,
}: {
  device: Peripheral;
  selected: boolean;
  onSelect(): void;
}) {
  const offline = device.status === 'desconectado';
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-[color,background-color,border-color,scale] motion-safe:active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
        selected
          ? 'border-foreground bg-card'
          : 'border-border bg-card/60 hover:border-strong hover:bg-card',
      )}
    >
      <span className="grid h-16 w-24 shrink-0 place-items-center rounded-lg border border-border bg-background px-2">
        <DeviceThumb device={device} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{device.name}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">
          {offline ? `${describeDevice(device)} · Desconectado` : describeDevice(device)}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

function DevicePreview({ device, onReconnect }: { device: Peripheral; onReconnect(): void }) {
  const offline = device.status === 'desconectado';
  return (
    <section
      aria-label={`Prévia de ${device.name}`}
      className="panel-shadow flex flex-col items-center justify-center gap-6 rounded-xl border border-border bg-card p-8 sm:flex-row sm:gap-10"
    >
      <div
        key={device.id}
        className="device-preview-arrival grid w-full max-w-[240px] place-items-center"
      >
        <DevicePhoto
          photo={device.photo}
          className={device.type === 'mouse' ? 'h-56 w-auto' : 'w-full'}
        />
      </div>
      <div className="text-center sm:text-left">
        <h2 className="text-xl font-medium tracking-tight">{device.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{describeDevice(device)}</p>
        {offline ? (
          <div className="mt-5">
            <p className="mb-3 flex items-center justify-center gap-2 text-sm text-muted-foreground sm:justify-start">
              <Unplug className="size-4" aria-hidden="true" />
              Dispositivo desconectado
            </p>
            <Button variant="outline" onClick={onReconnect}>
              Reconectar
            </Button>
          </div>
        ) : (
          <Button
            className="mt-5 w-full sm:w-auto"
            size="lg"
            onClick={() =>
              navigate({
                name: 'device',
                deviceId: device.id,
                section: defaultSectionFor(device.type),
              })
            }
          >
            Configurar
          </Button>
        )}
      </div>
    </section>
  );
}

function EmptyDevices({
  onExploreDemo,
  connecting,
}: {
  onExploreDemo(): void;
  connecting: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <div className="flex items-end gap-4 text-muted-foreground" aria-hidden="true">
        <Mouse className="size-12" strokeWidth={1} />
        <Keyboard className="size-14" strokeWidth={1} />
      </div>
      <h2 className="mt-6 text-xl font-medium tracking-tight">Nenhum dispositivo adicionado</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Adicione seu mouse ou teclado para acessar as configurações.
      </p>
      <Button
        variant="outline"
        size="lg"
        className="mt-6"
        disabled={connecting}
        onClick={onExploreDemo}
      >
        {connecting ? 'Carregando demonstração…' : 'Explorar demonstração'}
      </Button>
    </div>
  );
}

function DeviceListSkeleton() {
  return (
    <div
      className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3">
        <div className="h-24 animate-pulse rounded-xl border border-border bg-card/60" />
        <div className="h-24 animate-pulse rounded-xl border border-border bg-card/60" />
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-border bg-card/60" />
      <span className="sr-only">Procurando dispositivos disponíveis.</span>
    </div>
  );
}
