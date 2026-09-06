import type { MouseActionId, MouseButtonSpot, MousePeripheral } from '@gearhub/shared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@gearhub/ui/components/select';
import { cn } from '@gearhub/ui/lib/utils';
import { useId, useState } from 'react';
import { mouseActionLabels } from '../../app/labels';
import { findSection } from '../../app/sections';
import { useMouseEditor } from '../../app/useEditor';
import { assignRPlusAction, selectRPlusActivator } from '../../domain/mouseCapabilities';
import { MouseButtonMap } from '../devices/MouseButtonMap';
import { OptionGroup } from '../OptionGroup';

type ButtonLayer = 'principal' | 'r-plus';

export function MouseButtonsSection({ device }: { device: MousePeripheral }) {
  const section = findSection('mouse', 'botoes');
  const { draft, update } = useMouseEditor(device);
  const buttons = device.capabilities.buttons;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layer, setLayer] = useState<ButtonLayer>('principal');
  const rPlusCapability = device.capabilities.rPlus;
  const rPlus = draft.rPlus;
  const editingRPlus = layer === 'r-plus' && rPlusCapability && rPlus;

  const actionsFor = (spot: MouseButtonSpot) => spot.actions ?? device.capabilities.actions;

  function assign(buttonId: string, action: MouseActionId) {
    update((current) => {
      if (editingRPlus && current.rPlus) {
        return { ...current, rPlus: assignRPlusAction(current.rPlus, buttonId, action) };
      }
      return { ...current, buttons: { ...current.buttons, [buttonId]: action } };
    });
  }

  const actionFor = (buttonId: string) =>
    editingRPlus ? editingRPlus.buttons[buttonId] : draft.buttons[buttonId];

  const defaultActionFor = (buttonId: string) =>
    editingRPlus && device.defaults.rPlus
      ? device.defaults.rPlus.buttons[buttonId]
      : device.defaults.buttons[buttonId];

  function describeButton(spot: MouseButtonSpot) {
    if (editingRPlus && spot.id === editingRPlus.activatorButtonId) {
      return `${spot.label}: ativador R-Plus`;
    }
    return `${spot.label}: ${mouseActionLabels[actionFor(spot.id)]}`;
  }

  function renderEditor(spot: MouseButtonSpot, index: number) {
    if (editingRPlus && spot.id === editingRPlus.activatorButtonId) {
      return (
        <div className="panel-shadow w-full max-w-64 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium">{spot.label} · R-Plus</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Este é o ativador da camada e não recebe uma ação secundária.
          </p>
        </div>
      );
    }
    const value = actionFor(spot.id);
    const defaultValue = defaultActionFor(spot.id);
    return (
      <ButtonEditor
        spot={spot}
        index={index}
        actions={actionsFor(spot)}
        value={value}
        canRestore={value !== defaultValue}
        onChange={(action) => assign(spot.id, action)}
        onRestore={() => assign(spot.id, defaultValue)}
      />
    );
  }

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          {section?.title ?? 'Botões'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {section?.description ?? 'Escolha um botão e defina sua ação.'}
        </p>
      </header>

      {rPlusCapability && rPlus && (
        <section className="mb-7 grid gap-5 rounded-xl border border-border bg-card p-4 sm:grid-cols-[minmax(220px,1fr)_minmax(260px,1fr)] sm:p-5">
          <div>
            <label htmlFor="r-plus-activator" className="text-sm font-medium">
              Botão R-Plus
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Segure este botão para usar uma segunda camada de ações.
            </p>
            <Select
              value={rPlus.activatorButtonId}
              onValueChange={(activatorButtonId) =>
                update((current) =>
                  current.rPlus
                    ? {
                        ...current,
                        rPlus: selectRPlusActivator(current.rPlus, activatorButtonId),
                      }
                    : current,
                )
              }
            >
              <SelectTrigger id="r-plus-activator" className="mt-3 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rPlusCapability.activatorButtonIds.map((buttonId) => {
                  const spot = buttons.find((button) => button.id === buttonId);
                  return spot ? (
                    <SelectItem key={buttonId} value={buttonId}>
                      {spot.label}
                    </SelectItem>
                  ) : null;
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-sm font-medium">Camada editada</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Escolha quais atribuições aparecem no mouse.
            </p>
            <OptionGroup
              className="mt-3"
              label="Camada editada"
              value={layer}
              options={[
                { value: 'principal', label: 'Principal' },
                { value: 'r-plus', label: 'R-Plus' },
              ]}
              onChange={(next) => setLayer(next as ButtonLayer)}
            />
          </div>
        </section>
      )}

      <MouseButtonMap
        photo={device.photo}
        buttons={buttons}
        selectedId={selectedId}
        onSelect={(id) => setSelectedId((current) => (current === id ? null : id))}
        describeButton={describeButton}
        renderCallout={(spot) => {
          const index = buttons.indexOf(spot);
          if (spot.id === selectedId) return renderEditor(spot, index);
          return (
            <span className="rounded-md bg-background/80 px-1 text-sm text-muted-foreground">
              {spot.label}
            </span>
          );
        }}
      />

      <div className="mt-6 lg:hidden">
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {buttons.map((spot, index) => (
            <li key={spot.id}>
              <button
                type="button"
                onClick={() => setSelectedId((current) => (current === spot.id ? null : spot.id))}
                aria-expanded={spot.id === selectedId}
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none"
              >
                <span className="flex items-center gap-3">
                  <span
                    className={cn(
                      'grid size-7 place-items-center rounded-full border text-xs',
                      spot.id === selectedId
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border',
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium">{spot.label}</span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {editingRPlus && spot.id === editingRPlus.activatorButtonId
                    ? 'Ativador R-Plus'
                    : mouseActionLabels[actionFor(spot.id)]}
                </span>
              </button>
              {spot.id === selectedId && (
                <div className="px-4 pb-4">{renderEditor(spot, index)}</div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function ButtonEditor({
  spot,
  index,
  actions,
  value,
  canRestore,
  onChange,
  onRestore,
}: {
  spot: MouseButtonSpot;
  index: number;
  actions: MouseActionId[];
  value: MouseActionId;
  canRestore: boolean;
  onChange(action: MouseActionId): void;
  onRestore(): void;
}) {
  const fieldId = useId();

  return (
    <div className="panel-shadow w-full max-w-64 rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <span className="grid size-6 place-items-center rounded-full border border-border text-xs">
          {index + 1}
        </span>
        {spot.label}
      </p>

      <label htmlFor={fieldId} className="mt-3 block text-xs text-muted-foreground">
        Ação atribuída
      </label>
      <Select value={value} onValueChange={(next) => onChange(next as MouseActionId)}>
        <SelectTrigger id={fieldId} className="mt-1 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {actions.map((action) => (
            <SelectItem key={action} value={action}>
              {mouseActionLabels[action]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <button
        type="button"
        onClick={onRestore}
        disabled={!canRestore}
        className="mt-3 rounded-md text-sm underline underline-offset-4 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
      >
        Restaurar botão
      </button>
    </div>
  );
}
