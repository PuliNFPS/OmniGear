import type { Peripheral } from '@gearhub/shared';
import { Button } from '@gearhub/ui/components/button';
import { cn } from '@gearhub/ui/lib/utils';
import { RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { connectionLabels } from '../../app/labels';
import { findSection } from '../../app/sections';
import { loadCore, type CoreStatus } from '../../core/coreBridge';
import { activeProfileName } from '../../domain/settings';
import { useEditorStore } from '../../store/editorStore';
import { ConfirmDialog } from '../ConfirmDialog';
import { DevicePhoto } from '../devices/DevicePhoto';
import { SectionHeader } from './SectionHeader';

export function GeneralSection({ device }: { device: Peripheral }) {
  const section = findSection(device.type, 'geral');
  const restoreDefaults = useEditorStore((state) => state.restoreDefaults);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [core, setCore] = useState<CoreStatus | null>(null);

  useEffect(() => {
    let active = true;
    loadCore()
      .then((status) => {
        if (active) setCore(status);
      })
      .catch(() => {
        if (active) setCore({ version: 'indisponível', wasm: false });
      });
    return () => {
      active = false;
    };
  }, []);

  const connection = device.demo
    ? `${connectionLabels[device.connection]} (simulada)`
    : connectionLabels[device.connection];

  const rows = [
    { label: 'Modelo', value: device.name },
    { label: 'Conexão', value: connection },
    { label: 'Firmware', value: device.firmware ?? 'Não informado' },
    { label: 'Perfil em uso', value: activeProfileName(device) },
    {
      label: 'Núcleo',
      value: core ? `${core.version} · ${core.wasm ? 'WASM' : 'falha ao carregar'}` : 'Carregando…',
    },
  ];

  return (
    <>
      <SectionHeader
        title={section?.title ?? 'Geral'}
        description="Informações do dispositivo e ajustes gerais."
      />

      <div
        className={cn(
          'grid gap-8 lg:gap-12',
          device.type === 'keyboard'
            ? 'lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]'
            : 'lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]',
        )}
      >
        <div className="flex flex-col items-center gap-3">
          <DevicePhoto
            photo={device.photo}
            className={device.type === 'mouse' ? 'h-64 w-auto' : 'w-full max-w-md'}
          />
          {device.demo && <p className="text-sm text-muted-foreground">Modo demonstração</p>}
        </div>

        <div>
          <dl className="divide-y divide-border border-b border-border">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-6 py-3.5">
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="text-right text-sm">{row.value}</dd>
              </div>
            ))}
          </dl>

          <section className="mt-7">
            <h2 className="text-lg font-medium tracking-tight">Restaurar ajustes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Redefine os ajustes do perfil atual. Os demais perfis são mantidos.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              disabled={device.status === 'desconectado'}
              onClick={() => setConfirmOpen(true)}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Restaurar padrões
            </Button>
            <p className="mt-3 text-sm text-muted-foreground">
              Você poderá revisar antes de salvar.
            </p>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Restaurar o perfil atual?"
        description="Os ajustes padrão serão carregados para revisão. Os demais perfis serão mantidos."
        note="A gravação acontece somente ao salvar."
        actions={[
          { label: 'Cancelar', onSelect: () => undefined },
          {
            label: 'Restaurar',
            variant: 'default',
            onSelect: () => restoreDefaults(device),
          },
        ]}
      />
    </>
  );
}
