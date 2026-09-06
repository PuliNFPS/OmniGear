import type { MousePeripheral } from '@gearhub/shared';
import { Badge } from '@gearhub/ui/components/badge';
import { findSection } from '../../app/sections';
import { useMouseEditor } from '../../app/useEditor';
import { estimateBatteryHours, formatInterval } from '../../domain/performance';
import { DevicePhoto } from '../devices/DevicePhoto';
import { OptionGroup } from '../OptionGroup';
import { SectionHeader } from './SectionHeader';

export function PerformanceSection({ device }: { device: MousePeripheral }) {
  const section = findSection('mouse', 'desempenho');
  const { draft, update } = useMouseEditor(device);
  const rates = device.capabilities.pollingRates;
  const modes = device.capabilities.performanceModes ?? [];
  const selectedMode = modes.some((mode) => mode.id === draft.performanceMode)
    ? draft.performanceMode
    : modes[0]?.id;
  const autonomy = device.battery !== null ? estimateBatteryHours(draft.pollingRate) : null;

  return (
    <>
      <SectionHeader
        title={section?.title ?? 'Desempenho'}
        description="Ajuste a frequência de resposta do mouse."
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-10">
        <div className="grid place-items-center py-2">
          <DevicePhoto photo={device.photo} className="h-64 w-auto" />
        </div>

        <dl className="flex flex-col gap-6 lg:border-l lg:border-border lg:pl-8">
          <div>
            <dt className="text-sm text-muted-foreground">Intervalo entre envios</dt>
            <dd className="mt-1 text-3xl font-medium tracking-tight tabular-nums">
              {formatInterval(draft.pollingRate)}
              <span className="ml-1.5 text-base font-normal text-muted-foreground">ms</span>
            </dd>
          </div>

          {autonomy && (
            <div className="border-t border-border pt-6">
              <dt className="text-sm text-muted-foreground">Autonomia estimada</dt>
              <dd>
                <p className="mt-1 text-3xl font-medium tracking-tight tabular-nums">
                  {autonomy.min}–{autonomy.max}
                  <span className="ml-1.5 text-base font-normal text-muted-foreground">h</span>
                </p>
                {device.demo && (
                  <Badge variant="secondary" className="mt-2 font-normal">
                    Exemplo simulado
                  </Badge>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Com bateria cheia e taxa de {draft.pollingRate.toLocaleString('pt-BR')} Hz.
                </p>
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div
        className={`mt-8 grid gap-7 border-t border-border pt-7 ${modes.length > 0 ? 'xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] xl:gap-8' : ''}`}
      >
        <section>
          <h2 className="text-lg font-medium tracking-tight">Taxa de reporte</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Define quantas vezes por segundo o mouse envia dados ao computador.
          </p>
          <OptionGroup
            className="mt-4"
            label="Taxa de reporte"
            value={draft.pollingRate}
            options={rates.map((rate) => ({
              value: rate,
              label: `${rate.toLocaleString('pt-BR')} Hz`,
            }))}
            onChange={(pollingRate) => update((current) => ({ ...current, pollingRate }))}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Taxas maiores podem aumentar o consumo de energia.
          </p>
        </section>

        {modes.length > 0 && selectedMode && (
          <section>
            <h2 className="text-lg font-medium tracking-tight">Modo de desempenho</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Equilibre resposta do sensor e consumo de energia.
            </p>
            <OptionGroup
              className="mt-4"
              label="Modo de desempenho"
              value={selectedMode}
              options={modes.map((mode) => ({ value: mode.id, label: mode.label }))}
              onChange={(performanceMode) =>
                update((current) => ({ ...current, performanceMode }))
              }
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Modos mais rápidos podem reduzir a autonomia.
            </p>
          </section>
        )}
      </div>
    </>
  );
}
