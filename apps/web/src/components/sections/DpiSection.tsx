import type { DpiCapability, DpiStage, MousePeripheral } from '@gearhub/shared';
import { Button } from '@gearhub/ui/components/button';
import { Checkbox } from '@gearhub/ui/components/checkbox';
import { Input } from '@gearhub/ui/components/input';
import { cn } from '@gearhub/ui/lib/utils';
import { Check, Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { findSection } from '../../app/sections';
import { useEditorEntry, useMouseEditor } from '../../app/useEditor';
import {
  addStage,
  canAddStage,
  canRemoveStage,
  clampDpi,
  formatDpi,
  linkAxes,
  removeStage,
  setStageAxis,
  unlinkAxes,
  validateDpi,
} from '../../domain/dpi';
import { SectionHeader } from './SectionHeader';

export function DpiSection({ device }: { device: MousePeripheral }) {
  const section = findSection('mouse', 'dpi');
  const { draft, update } = useMouseEditor(device);
  const { resetRevision } = useEditorEntry(device);
  const capability = device.capabilities.dpi;
  const axesId = useId();
  /** Y values from before the axes were linked, restored if they are separated again. */
  const [keptY, setKeptY] = useState<Record<string, number>>({});

  useEffect(() => setKeptY({}), [device.activeProfileSlot, resetRevision]);

  function changeAxis(stageId: string, axis: 'x' | 'y', value: number) {
    if (!draft.independentAxes) {
      setKeptY((current) => {
        const next = { ...current };
        delete next[stageId];
        return next;
      });
    }
    update((current) => ({
      ...current,
      dpiStages: setStageAxis(current.dpiStages, stageId, axis, value, current.independentAxes),
    }));
  }

  function changeIndependentAxes(independentAxes: boolean) {
    if (!independentAxes) {
      setKeptY(Object.fromEntries(draft.dpiStages.map((stage) => [stage.id, stage.y])));
    }
    update((current) => ({
      ...current,
      independentAxes,
      dpiStages: independentAxes
        ? unlinkAxes(current.dpiStages, keptY)
        : linkAxes(current.dpiStages),
    }));
    if (independentAxes) setKeptY({});
  }

  return (
    <>
      <SectionHeader
        title={section?.title ?? 'DPI'}
        description={section?.description ?? ''}
        actions={
          <Button
            variant="outline"
            disabled={!canAddStage(draft.dpiStages, capability)}
            onClick={() =>
              update((current) => ({
                ...current,
                dpiStages: addStage(current.dpiStages, capability),
              }))
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            Adicionar estágio
          </Button>
        }
      />

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="hidden grid-cols-[110px_minmax(0,1fr)_150px_170px] gap-6 border-b border-border px-5 py-3 text-xs text-muted-foreground md:grid">
          <span>Estágio</span>
          <span>Sensibilidade</span>
          <span>DPI</span>
          <span>Ações</span>
        </div>

        <ul className="divide-y divide-border">
          {draft.dpiStages.map((stage, index) => (
            <li key={stage.id}>
              <StageRow
                stage={stage}
                index={index}
                capability={capability}
                independentAxes={draft.independentAxes}
                active={stage.id === draft.activeStageId}
                removable={canRemoveStage(draft.dpiStages, capability)}
                onChangeAxis={(axis, value) => changeAxis(stage.id, axis, value)}
                onActivate={() => update((current) => ({ ...current, activeStageId: stage.id }))}
                onRemove={() =>
                  update((current) => {
                    const result = removeStage(
                      current.dpiStages,
                      capability,
                      stage.id,
                      current.activeStageId,
                    );
                    return {
                      ...current,
                      dpiStages: result.stages,
                      activeStageId: result.activeStageId,
                    };
                  })
                }
              />
            </li>
          ))}
        </ul>

        {capability.independentAxes && (
          <div className="flex items-start gap-3 border-t border-border px-5 py-4">
            <Checkbox
              id={axesId}
              checked={draft.independentAxes}
              onCheckedChange={(checked) => changeIndependentAxes(checked === true)}
            />
            <div>
              <label htmlFor={axesId} className="text-sm font-medium">
                Eixos X/Y independentes
              </label>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {draft.independentAxes
                  ? 'Ajuste X e Y separadamente.'
                  : 'Use a mesma sensibilidade nos dois eixos.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

interface StageRowProps {
  stage: DpiStage;
  index: number;
  capability: DpiCapability;
  independentAxes: boolean;
  active: boolean;
  removable: boolean;
  onChangeAxis(axis: 'x' | 'y', value: number): void;
  onActivate(): void;
  onRemove(): void;
}

function StageRow({
  stage,
  index,
  capability,
  independentAxes,
  active,
  removable,
  onChangeAxis,
  onActivate,
  onRemove,
}: StageRowProps) {
  const name = `Estágio ${index + 1}`;
  const axes: Array<{ axis: 'x' | 'y'; label: string | null; value: number }> = independentAxes
    ? [
        { axis: 'x', label: 'X', value: stage.x },
        { axis: 'y', label: 'Y', value: stage.y },
      ]
    : [{ axis: 'x', label: null, value: stage.x }];

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-[110px_minmax(0,1fr)_150px_170px] md:items-center md:gap-6',
        active && 'bg-accent/60',
      )}
    >
      <p className="text-sm font-medium">{name}</p>

      <div className="grid gap-4">
        {axes.map((entry) => (
          <AxisSlider
            key={entry.axis}
            axisLabel={entry.label}
            stageName={name}
            value={entry.value}
            capability={capability}
            onChange={(value) => onChangeAxis(entry.axis, value)}
          />
        ))}
      </div>

      <div className="grid gap-4">
        {axes.map((entry) => (
          <AxisField
            key={entry.axis}
            axisLabel={entry.label}
            stageName={name}
            value={entry.value}
            capability={capability}
            onChange={(value) => onChangeAxis(entry.axis, value)}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 md:justify-start">
        {active ? (
          <span className="inline-flex items-center gap-2 text-sm">
            Ativo
            <Check className="size-4" aria-hidden="true" />
          </span>
        ) : (
          <Button variant="ghost" size="sm" onClick={onActivate}>
            Tornar ativo
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          disabled={!removable}
          aria-label={`Remover ${name}`}
          title={removable ? `Remover ${name}` : 'O dispositivo exige ao menos um estágio.'}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

interface AxisProps {
  axisLabel: string | null;
  stageName: string;
  value: number;
  capability: DpiCapability;
  onChange(value: number): void;
}

function axisName(stageName: string, axisLabel: string | null): string {
  return axisLabel ? `${stageName}, eixo ${axisLabel}` : `${stageName}, sensibilidade`;
}

function AxisSlider({ axisLabel, stageName, value, capability, onChange }: AxisProps) {
  return (
    <div>
      <div className="flex items-center gap-3">
        {axisLabel && (
          <span className="w-3 text-xs text-muted-foreground" aria-hidden="true">
            {axisLabel}
          </span>
        )}
        <input
          type="range"
          className="range"
          aria-label={`${axisName(stageName, axisLabel)} em DPI`}
          min={capability.min}
          max={capability.max}
          step={capability.step}
          value={value}
          onChange={(event) => onChange(clampDpi(Number(event.target.value), capability))}
        />
      </div>
      <div
        className={cn(
          'mt-1 flex justify-between text-[11px] text-muted-foreground',
          axisLabel && 'pl-6',
        )}
        aria-hidden="true"
      >
        <span>{formatDpi(capability.min)}</span>
        <span>{formatDpi(capability.max)}</span>
      </div>
    </div>
  );
}

/** The field validates before writing, so an invalid entry never reaches the draft. */
function AxisField({ axisLabel, stageName, value, capability, onChange }: AxisProps) {
  const [raw, setRaw] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();
  const errorId = `${fieldId}-erro`;

  useEffect(() => {
    setRaw(String(value));
    setError(null);
  }, [value]);

  function commit(next: string) {
    setRaw(next);
    const parsed = next.trim() === '' ? Number.NaN : Number(next);
    const validation = validateDpi(parsed, capability);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }
    setError(null);
    onChange(parsed);
  }

  return (
    <div>
      <label className="sr-only" htmlFor={fieldId}>
        {axisName(stageName, axisLabel)} em DPI
      </label>
      <Input
        id={fieldId}
        type="number"
        inputMode="numeric"
        className="tabular-nums"
        min={capability.min}
        max={capability.max}
        step={capability.step}
        value={raw}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => commit(event.target.value)}
        onBlur={() => {
          if (error) {
            setRaw(String(value));
            setError(null);
          }
        }}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
