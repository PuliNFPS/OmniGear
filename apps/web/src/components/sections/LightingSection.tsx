import type { KeyboardPeripheral, LightingEffect } from '@gearhub/shared';
import { Input } from '@gearhub/ui/components/input';
import { cn } from '@gearhub/ui/lib/utils';
import { Activity, Check, CircleSlash, Sun, Waves } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { hexToRgba, isHexColor } from '../../app/color';
import { findSection } from '../../app/sections';
import { useKeyboardEditor } from '../../app/useEditor';
import { KeyboardView } from '../devices/KeyboardView';
import { SectionHeader } from './SectionHeader';

const OFF = 'desligado';

const effectIcons: Record<string, LucideIcon> = {
  estatico: Sun,
  respiracao: Activity,
  onda: Waves,
  espectro: Waves,
  reativo: Activity,
};

const colorPresets = ['#FFFFFF', '#FF3B30', '#4CD964', '#34C7E0', '#2D5BFF', '#A855F7'];

export function LightingSection({ device }: { device: KeyboardPeripheral }) {
  const section = findSection('keyboard', 'iluminacao');
  const { draft, update } = useKeyboardEditor(device);
  const lighting = device.capabilities.lighting;
  const effectName = useId();
  const [triggeredKey, setTriggeredKey] = useState<{ id: string; sequence: number } | undefined>();

  if (!lighting) {
    return (
      <>
        <SectionHeader
          title={section?.title ?? 'Iluminação'}
          description="Este modelo não expõe controles de iluminação."
        />
      </>
    );
  }

  const settings = draft.lighting;
  const effect = lighting.effects.find((item) => item.id === settings.effectId);
  const selectedId = settings.enabled ? settings.effectId : OFF;
  const animated = settings.enabled && (effect?.animated ?? false);
  const usesColor = settings.enabled && (effect?.usesColor ?? false);

  function selectEffect(id: string) {
    update((current) => ({
      ...current,
      lighting:
        id === OFF
          ? { ...current.lighting, enabled: false }
          : { ...current.lighting, enabled: true, effectId: id },
    }));
  }

  return (
    <>
      <SectionHeader
        title={section?.title ?? 'Iluminação'}
        description="Escolha o efeito, a cor e a intensidade."
      />

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <section>
          <h2 className="text-sm font-medium">Efeito</h2>
          <fieldset className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            <legend className="sr-only">Efeito de iluminação</legend>
            {[...lighting.effects, offEffect].map((item) => (
              <EffectRow
                key={item.id}
                effect={item}
                name={effectName}
                selected={selectedId === item.id}
                onSelect={() => selectEffect(item.id)}
              />
            ))}
          </fieldset>
        </section>

        <div className="flex flex-col gap-5">
          <section>
            <h2 className="text-sm text-muted-foreground">Prévia simulada</h2>
            <div className="mt-2 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <KeyboardView
                tone="device"
                keys={device.capabilities.keys}
                onSelectKey={
                  settings.enabled && settings.effectId === 'reativo'
                    ? (id) =>
                        setTriggeredKey((current) => ({
                          id,
                          sequence: (current?.sequence ?? 0) + 1,
                        }))
                    : undefined
                }
                describeKey={(key) => `Testar iluminação da tecla ${key.label}`}
                glow={
                  settings.enabled
                    ? {
                        color: usesColor ? settings.color : '#FFFFFF',
                        intensity: settings.brightness,
                        effect: settings.effectId,
                        speed: settings.speed,
                        triggeredKey,
                      }
                    : null
                }
              />
            </div>
            {settings.enabled && settings.effectId === 'reativo' && (
              <p className="mt-2 text-sm text-muted-foreground">
                Clique em uma tecla da prévia para testar o efeito.
              </p>
            )}
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            {lighting.color && (
              <ColorPanel
                value={settings.color}
                disabled={!usesColor}
                hint={
                  settings.enabled
                    ? effect?.usesColor
                      ? undefined
                      : 'Este efeito usa seu próprio ciclo de cores.'
                    : 'Ative a iluminação para escolher a cor.'
                }
                onChange={(color) =>
                  update((current) => ({ ...current, lighting: { ...current.lighting, color } }))
                }
              />
            )}

            <section className="rounded-xl border border-border bg-card p-4">
              {lighting.brightness && (
                <SliderRow
                  label="Intensidade"
                  value={settings.brightness}
                  disabled={!settings.enabled}
                  hint={settings.enabled ? undefined : 'Ative a iluminação para ajustar.'}
                  onChange={(brightness) =>
                    update((current) => ({
                      ...current,
                      lighting: { ...current.lighting, brightness },
                    }))
                  }
                />
              )}
              {lighting.speed && (
                <SliderRow
                  className="mt-4"
                  label="Velocidade"
                  value={settings.speed}
                  disabled={!animated}
                  hint={animated ? undefined : 'Disponível em efeitos animados.'}
                  onChange={(speed) =>
                    update((current) => ({ ...current, lighting: { ...current.lighting, speed } }))
                  }
                />
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

const offEffect: LightingEffect = {
  id: OFF,
  label: 'Desligado',
  description: 'A iluminação do teclado fica apagada.',
  animated: false,
  usesColor: false,
};

function EffectRow({
  effect,
  name,
  selected,
  onSelect,
}: {
  effect: LightingEffect;
  name: string;
  selected: boolean;
  onSelect(): void;
}) {
  const Icon = effect.id === OFF ? CircleSlash : (effectIcons[effect.id] ?? Sun);

  return (
    <label
      title={effect.description}
      className={cn(
        'relative flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-sm transition-colors',
        selected ? 'bg-accent font-medium' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <input
        type="radio"
        name={name}
        value={effect.id}
        checked={selected}
        onChange={onSelect}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-1 rounded-md peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
      />
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{effect.label}</span>
      {selected && <Check className="size-4" aria-hidden="true" />}
    </label>
  );
}

function ColorPanel({
  value,
  disabled,
  hint,
  onChange,
}: {
  value: string;
  disabled: boolean;
  hint?: string;
  onChange(color: string): void;
}) {
  const fieldId = useId();
  const [raw, setRaw] = useState(value);

  useEffect(() => setRaw(value), [value]);

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-medium">Cor</h2>
      <div className="mt-3 flex items-center gap-3">
        <span
          className="size-8 shrink-0 rounded-full border border-strong"
          style={{ background: disabled ? 'transparent' : value }}
          aria-hidden="true"
        />
        <label className="sr-only" htmlFor={fieldId}>
          Cor da iluminação em hexadecimal
        </label>
        <Input
          id={fieldId}
          value={raw}
          disabled={disabled}
          maxLength={7}
          spellCheck={false}
          className="w-28 uppercase"
          aria-invalid={!isHexColor(raw) ? true : undefined}
          onChange={(event) => {
            setRaw(event.target.value);
            if (isHexColor(event.target.value)) onChange(event.target.value.toUpperCase());
          }}
          onBlur={() => setRaw(value)}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {colorPresets.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={disabled}
            aria-label={`Usar a cor ${preset}`}
            aria-pressed={value.toUpperCase() === preset}
            onClick={() => onChange(preset)}
            className={cn(
              'size-7 rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none disabled:opacity-40',
              value.toUpperCase() === preset ? 'border-foreground' : 'border-border',
            )}
            style={{ background: preset, boxShadow: `0 0 0 1px ${hexToRgba(preset, 0.25)}` }}
          />
        ))}
      </div>

      {hint && <p className="mt-3 text-sm text-muted-foreground">{hint}</p>}
    </section>
  );
}

function SliderRow({
  label,
  value,
  disabled,
  hint,
  className,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  hint?: string;
  className?: string;
  onChange(value: number): void;
}) {
  const fieldId = useId();

  return (
    <div className={className}>
      <div className="flex items-center gap-4">
        <label htmlFor={fieldId} className="w-24 shrink-0 text-sm font-medium">
          {label}
        </label>
        <input
          id={fieldId}
          type="range"
          className="range min-w-0 flex-1"
          min={0}
          max={100}
          step={5}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="w-12 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
          {value}%
        </span>
      </div>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
