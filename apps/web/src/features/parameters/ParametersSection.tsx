import { Panel, SectionHeading } from '@gearhub/ui/components/panel';
import { Segmented } from '@gearhub/ui/components/segmented';
import { Slider } from '@gearhub/ui/components/slider';
import { useMouseStore } from '../../store/mouseStore';
import { ToggleRow } from './ToggleRow';

export function ParametersSection() {
  const session = useMouseStore((state) => state.session);
  const patchDraft = useMouseStore((state) => state.patchDraft);
  if (!session) return null;

  const caps = session.capabilities.parameters;
  const { parameters } = session.draft;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-8">
      <SectionHeading>Parâmetros</SectionHeading>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Panel className="px-4 py-2">
            {caps.motionSync && (
              <ToggleRow
                label="Sincronização de movimento"
                description="Alinha o envio à leitura do sensor. Traça a trajetória com mais fidelidade e adiciona uma latência mínima."
                checked={parameters.motionSync}
                onChange={(checked) =>
                  patchDraft((profile) => {
                    profile.parameters.motionSync = checked;
                  })
                }
              />
            )}
            {caps.straightLineCorrection && (
              <ToggleRow
                label="Correção de linha reta"
                description="Remove o desvio ao puxar o mouse em linha reta. Feito para desenho, não para jogo."
                checked={parameters.straightLineCorrection}
                onChange={(checked) =>
                  patchDraft((profile) => {
                    profile.parameters.straightLineCorrection = checked;
                  })
                }
              />
            )}
            {caps.rippleCorrection && (
              <ToggleRow
                label="Correção de ondulação"
                description="Suaviza a trepidação em movimentos muito rápidos."
                checked={parameters.rippleCorrection}
                onChange={(checked) =>
                  patchDraft((profile) => {
                    profile.parameters.rippleCorrection = checked;
                  })
                }
              />
            )}
            {caps.longRangeMode && (
              <ToggleRow
                label="Alcance estendido"
                description="Mantém a conexão estável a distâncias maiores, ao custo de bateria."
                checked={parameters.longRangeMode}
                onChange={(checked) =>
                  patchDraft((profile) => {
                    profile.parameters.longRangeMode = checked;
                  })
                }
              />
            )}
          </Panel>

          {caps.debounceMs && (
            <Panel className="p-4">
              <SectionHeading as="h3">Atraso antirrepique</SectionHeading>
              <p className="mb-3 mt-1 text-[13px] text-text-muted">
                Evita que um clique seja lido duas vezes. Valores altos atrasam o clique.
              </p>
              <Segmented
                label="Atraso antirrepique"
                options={caps.debounceMs.supported}
                value={parameters.debounceMs}
                format={(ms) => `${ms} ms`}
                onChange={(ms) =>
                  patchDraft((profile) => {
                    profile.parameters.debounceMs = ms;
                  })
                }
              />
            </Panel>
          )}

          {caps.sleepMinutes && (
            <Panel className="p-4">
              <SectionHeading as="h3">Suspensão</SectionHeading>
              <p className="mb-3 mt-1 text-[13px] text-text-muted">
                Tempo parado até o mouse dormir para poupar bateria.
              </p>
              <Segmented
                label="Suspensão"
                options={caps.sleepMinutes.supported}
                value={parameters.sleepMinutes}
                format={(min) => `${min} min`}
                onChange={(min) =>
                  patchDraft((profile) => {
                    profile.parameters.sleepMinutes = min;
                  })
                }
              />
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          {caps.lod && (
            <Panel className="p-4">
              <div className="flex items-center justify-between">
                <SectionHeading as="h3">Altura de rastreio</SectionHeading>
                <span className="tnum text-sm text-text-primary">
                  {parameters.lodMm.toFixed(1)} mm
                </span>
              </div>
              <p className="mb-3 mt-1 text-[13px] text-text-muted">
                Até que altura o sensor continua lendo o mousepad ao levantar o mouse.
              </p>
              <Slider
                aria-label="Altura de rastreio"
                min={caps.lod.min}
                max={caps.lod.max}
                step={caps.lod.step}
                value={[parameters.lodMm]}
                onValueChange={([next]) =>
                  patchDraft((profile) => {
                    profile.parameters.lodMm = next!;
                  })
                }
              />
            </Panel>
          )}

          {caps.sensorRotation && (
            <Panel className="p-4">
              <div className="flex items-center justify-between">
                <SectionHeading as="h3">Rotação do sensor</SectionHeading>
                <span className="tnum text-sm text-text-primary">
                  {parameters.sensorRotationDeg}°
                </span>
              </div>
              <p className="mb-3 mt-1 text-[13px] text-text-muted">
                Compensa a inclinação da sua pegada, para que horizontal continue horizontal.
              </p>
              <Slider
                aria-label="Rotação do sensor"
                min={caps.sensorRotation.min}
                max={caps.sensorRotation.max}
                step={caps.sensorRotation.step}
                value={[parameters.sensorRotationDeg]}
                onValueChange={([next]) =>
                  patchDraft((profile) => {
                    profile.parameters.sensorRotationDeg = next!;
                  })
                }
              />
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
