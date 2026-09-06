import type {
  MouseParameterId,
  MouseParameters,
  MousePeripheral,
  NumericParameterRange,
} from '@gearhub/shared';
import { Switch } from '@gearhub/ui/components/switch';
import { useId, type ReactNode } from 'react';
import { mouseParameterLabels } from '../../app/labels';
import { findSection } from '../../app/sections';
import { useMouseEditor } from '../../app/useEditor';
import { MouseSideArt } from '../devices/MouseSideArt';
import { RotationDial } from '../devices/RotationDial';
import { OptionGroup } from '../OptionGroup';
import { SectionHeader } from './SectionHeader';

type ToggleId = Extract<
  MouseParameterId,
  'motionSync' | 'angleSnapping' | 'rippleControl' | 'wirelessTurbo'
>;

export function ParametersSection({ device }: { device: MousePeripheral }) {
  const section = findSection('mouse', 'parametros');
  const { draft, update } = useMouseEditor(device);
  const supported = device.capabilities.parameters;

  function setParameter<K extends MouseParameterId>(key: K, value: MouseParameters[K]) {
    update((current) => ({ ...current, parameters: { ...current.parameters, [key]: value } }));
  }

  const sensorToggles: ToggleId[] = (
    ['motionSync', 'angleSnapping', 'rippleControl'] as const
  ).filter((id) => supported[id]);

  return (
    <>
      <SectionHeader
        title={section?.title ?? 'Parâmetros'}
        description="Ajuste o sensor, os cliques e o repouso."
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
        <div className="flex flex-col gap-7">
          {sensorToggles.length > 0 && (
            <ParameterGroup title="Sensor">
              {sensorToggles.map((id) => (
                <ToggleRow
                  key={id}
                  id={id}
                  checked={draft.parameters[id]}
                  onChange={(value) => setParameter(id, value)}
                />
              ))}
            </ParameterGroup>
          )}

          {supported.debounce && (
            <ParameterGroup title="Cliques">
              <div className="py-3">
                <p className="text-sm font-medium">{mouseParameterLabels.debounce.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {mouseParameterLabels.debounce.help}
                </p>
                <OptionGroup
                  className="mt-3"
                  label={mouseParameterLabels.debounce.title}
                  value={draft.parameters.debounce}
                  options={supported.debounce.options.map((option) => ({
                    value: option,
                    label: `${option} ms`,
                  }))}
                  onChange={(value) => setParameter('debounce', value)}
                />
              </div>
            </ParameterGroup>
          )}

          {(supported.sleepTimeout || supported.wirelessTurbo) && (
            <ParameterGroup title="Energia">
              {supported.sleepTimeout && (
                <div className="py-3">
                  <p className="text-sm font-medium">{mouseParameterLabels.sleepTimeout.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {mouseParameterLabels.sleepTimeout.help}
                  </p>
                  <OptionGroup
                    className="mt-3"
                    label={mouseParameterLabels.sleepTimeout.title}
                    value={draft.parameters.sleepTimeout}
                    options={supported.sleepTimeout.options.map((option) => ({
                      value: option,
                      label: `${option} min`,
                    }))}
                    onChange={(value) => setParameter('sleepTimeout', value)}
                  />
                </div>
              )}
              {supported.wirelessTurbo && (
                <ToggleRow
                  id="wirelessTurbo"
                  checked={draft.parameters.wirelessTurbo}
                  onChange={(value) => setParameter('wirelessTurbo', value)}
                />
              )}
            </ParameterGroup>
          )}
        </div>

        <div className="flex flex-col gap-8 lg:border-l lg:border-border lg:pl-8">
          {supported.liftOffDistance && (
            <RangePanel
              title={`${mouseParameterLabels.liftOffDistance.title} (LOD)`}
              help={mouseParameterLabels.liftOffDistance.help}
              range={supported.liftOffDistance}
              value={draft.parameters.liftOffDistance}
              format={(value) =>
                `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} mm`
              }
              onChange={(value) => setParameter('liftOffDistance', value)}
              art={
                <MouseSideArt
                  heightRatio={
                    (draft.parameters.liftOffDistance - supported.liftOffDistance.min) /
                    (supported.liftOffDistance.max - supported.liftOffDistance.min)
                  }
                />
              }
            />
          )}

          {supported.sensorRotation && (
            <RangePanel
              title={mouseParameterLabels.sensorRotation.title}
              help={mouseParameterLabels.sensorRotation.help}
              range={supported.sensorRotation}
              value={draft.parameters.sensorRotation}
              format={(value) => `${value > 0 ? '+' : ''}${value}°`}
              onChange={(value) => setParameter('sensorRotation', value)}
              art={
                <RotationDial
                  value={draft.parameters.sensorRotation}
                  min={supported.sensorRotation.min}
                  max={supported.sensorRotation.max}
                />
              }
            />
          )}
        </div>
      </div>
    </>
  );
}

function ParameterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="eyebrow">{title}</h2>
      <div className="mt-2 divide-y divide-border border-t border-border">{children}</div>
    </section>
  );
}

function ToggleRow({
  id,
  checked,
  onChange,
}: {
  id: ToggleId;
  checked: boolean;
  onChange(value: boolean): void;
}) {
  const controlId = useId();
  const { title, help } = mouseParameterLabels[id];

  return (
    <div className="flex items-center justify-between gap-6 py-3.5">
      <div className="min-w-0">
        <label htmlFor={controlId} className="text-sm font-medium">
          {title}
        </label>
        <p className="mt-0.5 text-sm text-muted-foreground">{help}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Switch id={controlId} checked={checked} onCheckedChange={onChange} />
        <span className="w-20 text-sm text-muted-foreground">
          {checked ? 'Ativado' : 'Desativado'}
        </span>
      </div>
    </div>
  );
}

function RangePanel({
  title,
  help,
  range,
  value,
  format,
  onChange,
  art,
}: {
  title: string;
  help: string;
  range: NumericParameterRange;
  value: number;
  format(value: number): string;
  onChange(value: number): void;
  art: ReactNode;
}) {
  const controlId = useId();

  return (
    <section>
      <div className="flex items-start justify-between gap-4">
        <div>
          <label htmlFor={controlId} className="text-sm font-medium">
            {title}
          </label>
          <p className="mt-0.5 text-sm text-muted-foreground">{help}</p>
        </div>
        <span className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm tabular-nums">
          {format(value)}
        </span>
      </div>

      <div className="mt-4">{art}</div>

      <input
        id={controlId}
        type="range"
        className="range mt-3"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div
        className="mt-1 flex justify-between text-[11px] text-muted-foreground"
        aria-hidden="true"
      >
        <span>{format(range.min)}</span>
        <span>{format(range.max)}</span>
      </div>
    </section>
  );
}
