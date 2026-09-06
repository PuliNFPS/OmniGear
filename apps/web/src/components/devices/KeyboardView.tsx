import type { KeyboardKeySpot } from '@gearhub/shared';
import { cn } from '@gearhub/ui/lib/utils';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { hexToRgba } from '../../app/color';
import { measureRows } from '../../domain/keyboardLayout';

interface KeyboardViewProps {
  keys: KeyboardKeySpot[];
  className?: string;
  selectedKeyId?: string | null;
  remappedKeyIds?: readonly string[];
  /** Without a handler the drawing is decorative and stays out of the tab order. */
  onSelectKey?(keyId: string): void;
  describeKey?(key: KeyboardKeySpot): string;
  /** "device" keeps the dark look of the physical keyboard in both themes. */
  tone?: 'interface' | 'device';
  /** Simulated lighting drawn over the keys. `effect` and `speed` drive the animation. */
  glow?: {
    color: string;
    intensity: number;
    /** Effect id from the device capabilities; unknown ids render a static glow. */
    effect?: string;
    /** 0-100 from the Velocidade setting. Ignored by static effects. */
    speed?: number;
    triggeredKey?: { id: string; sequence: number };
  } | null;
}

export function KeyboardView({
  keys,
  className,
  selectedKeyId,
  remappedKeyIds = [],
  onSelectKey,
  describeKey,
  glow,
  tone = 'interface',
}: KeyboardViewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    let inView = true;
    const update = () => setVisible(inView && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    if (previewRef.current) observer.observe(previewRef.current);
    document.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  const columns = Math.max(...keys.map((key) => key.x + key.width));
  const rows = measureRows(keys);
  const interactive = Boolean(onSelectKey);

  const style = {
    '--key-unit': `calc(100cqw / ${columns})`,
    '--key-gap': 'calc(var(--key-unit) * 0.08)',
    height: `calc(var(--key-unit) * ${rows.height})`,
  } as CSSProperties;

  /* Velocidade 0 is the slowest useful cycle, 100 the fastest. Kept above 800ms so a
     fast setting still reads as a pulse rather than a flicker. */
  const cycleMs = glow?.speed === undefined ? 1600 : 2800 - glow.speed * 20;
  const pulses = glow?.effect === 'respiracao' || glow?.effect === 'onda';
  const cycles = glow?.effect === 'espectro';

  /* The glow is a sibling layer, not a child of the key: keys are `overflow-hidden`
     to clip their label, which would also clip the halo. */
  const glowLayer = (key: (typeof keys)[number]) => {
    if (!glow || glow.intensity === 0) return null;
    const reactive = glow.effect === 'reativo';
    if (reactive && glow.triggeredKey?.id !== key.id) return null;
    /* Espectro cycles hue, and hue-rotate on white is a no-op — the effect declares
       no colour of its own, so the layer starts from a saturated seed and sweeps the
       whole circle from there. */
    const color = cycles ? '#FF0000' : glow.color;
    return (
      <span
        key={`${key.id}-glow-${reactive ? glow.triggeredKey?.sequence : glow.effect}`}
        data-slot="key-glow"
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute border',
          pulses && 'motion-safe:animate-key-breathe',
          cycles && 'motion-safe:animate-key-spectrum',
          reactive && 'motion-safe:animate-key-reactive motion-reduce:animate-fade-out',
        )}
        style={
          {
            left: `calc(var(--key-unit) * ${key.x} + var(--key-gap) / 2)`,
            top: `calc(var(--key-unit) * ${rows.top.get(key.row) ?? key.row} + var(--key-gap) / 2)`,
            width: `calc(var(--key-unit) * ${key.width} - var(--key-gap))`,
            height: `calc(var(--key-unit) - var(--key-gap))`,
            borderRadius: 'calc(var(--key-unit) * 0.14)',
            borderColor: hexToRgba(color, (glow.intensity / 100) * 0.75),
            boxShadow: `0 0 calc(var(--key-unit) * 0.24) ${hexToRgba(color, (glow.intensity / 100) * 0.62)}`,
            animationDuration: `${cycleMs}ms`,
            animationFillMode: 'both',
            animationPlayState: visible ? 'running' : 'paused',
            /* Onda: the light travels left to right, so each column starts later. */
            animationDelay:
              glow.effect === 'onda' ? `${-(key.x / columns) * cycleMs}ms` : undefined,
          } as CSSProperties
        }
      />
    );
  };

  return (
    <div ref={previewRef} className={cn('@container w-full', className)}>
      <div className="relative w-full" style={style} aria-hidden={interactive ? undefined : true}>
        {keys.map((key) => {
          const remapped = remappedKeyIds.includes(key.id);
          const selected = selectedKeyId === key.id;
          const keyStyle = {
            left: `calc(var(--key-unit) * ${key.x} + var(--key-gap) / 2)`,
            top: `calc(var(--key-unit) * ${rows.top.get(key.row) ?? key.row} + var(--key-gap) / 2)`,
            width: `calc(var(--key-unit) * ${key.width} - var(--key-gap))`,
            height: `calc(var(--key-unit) - var(--key-gap))`,
            fontSize:
              key.label.length > 3 ? 'calc(var(--key-unit) * 0.2)' : 'calc(var(--key-unit) * 0.3)',
            borderRadius: 'calc(var(--key-unit) * 0.14)',
          } as CSSProperties;

          const keyClassName = cn(
            'absolute grid place-items-center overflow-hidden border px-[2px] leading-none transition-colors',
            selected
              ? 'border-foreground bg-foreground text-background'
              : tone === 'device'
                ? 'border-neutral-700 bg-neutral-800 text-neutral-300'
                : 'border-border bg-card text-muted-foreground',
            interactive &&
              !selected &&
              'hover:border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            interactive &&
              selected &&
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            remapped && !selected && 'border-foreground/60 text-foreground',
          );

          if (!interactive) {
            return (
              <span key={key.id} className={keyClassName} style={keyStyle}>
                {key.label}
              </span>
            );
          }

          const remappable = glow?.effect === 'reativo' || key.remappable !== false;
          return (
            <button
              key={key.id}
              type="button"
              style={keyStyle}
              className={cn(keyClassName, !remappable && 'opacity-55')}
              aria-pressed={selected}
              aria-label={describeKey ? describeKey(key) : `Tecla ${key.label}`}
              disabled={!remappable}
              onClick={() => onSelectKey?.(key.id)}
            >
              <span aria-hidden="true" className="truncate">
                {key.label}
              </span>
              {remapped && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute right-[8%] top-[8%] rounded-full',
                    selected ? 'bg-background' : 'bg-foreground',
                  )}
                  style={{
                    width: 'calc(var(--key-unit) * 0.09)',
                    height: 'calc(var(--key-unit) * 0.09)',
                  }}
                />
              )}
            </button>
          );
        })}

        {/* Drawn after the keys so the halo sits over them; the selected key keeps
            its solid highlight instead. */}
        {glow && keys.filter((key) => key.id !== selectedKeyId).map(glowLayer)}
      </div>
    </div>
  );
}
