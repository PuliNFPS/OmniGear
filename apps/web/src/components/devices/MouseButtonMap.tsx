import type { MouseButtonSpot, PeripheralPhoto } from '@gearhub/shared';
import { cn } from '@gearhub/ui/lib/utils';
import type { CSSProperties, ReactNode } from 'react';
import { DevicePhoto } from './DevicePhoto';

/** Where the photo sits inside the map, in percentages of the 3:2 box. */
const ART = { top: 7.5, height: 85 };

/** Callout columns sit outside the photo, on each side. */
const CALLOUT = { left: 1, right: 69.5, width: 29 };

/** The box keeps the shape of the file, so the numbers stay over their buttons. */
function artBox(photo: PeripheralPhoto) {
  const width = (photo.aspect * ART.height * 2) / 3;
  return { left: (100 - width) / 2, width };
}

interface MouseButtonMapProps {
  photo: PeripheralPhoto;
  buttons: MouseButtonSpot[];
  selectedId: string | null;
  onSelect(id: string): void;
  describeButton(spot: MouseButtonSpot): string;
  /** Rendered beside each button on wide screens: its name or its editor. */
  renderCallout(spot: MouseButtonSpot): ReactNode;
}

export function MouseButtonMap({
  photo,
  buttons,
  selectedId,
  onSelect,
  describeButton,
  renderCallout,
}: MouseButtonMapProps) {
  const box = artBox(photo);
  const spotPosition = (spot: MouseButtonSpot) => ({
    left: box.left + spot.position.x * box.width,
    top: ART.top + spot.position.y * ART.height,
  });

  return (
    <div className="relative mx-auto aspect-[3/2] w-full max-w-4xl">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 hidden size-full lg:block"
        aria-hidden="true"
        focusable="false"
      >
        {buttons.map((spot) => {
          const { left, top } = spotPosition(spot);
          const anchor = spot.callout === 'esquerda' ? CALLOUT.left + CALLOUT.width : CALLOUT.right;
          return (
            <line
              key={spot.id}
              x1={anchor}
              y1={top}
              x2={left}
              y2={top}
              className="stroke-border"
              strokeWidth="0.2"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      <div
        className="absolute"
        style={{
          left: `${box.left}%`,
          width: `${box.width}%`,
          top: `${ART.top}%`,
          height: `${ART.height}%`,
        }}
      >
        <DevicePhoto photo={photo} className="size-full" />
      </div>

      {buttons.map((spot, index) => {
        const { left, top } = spotPosition(spot);
        const selected = spot.id === selectedId;
        return (
          <button
            key={spot.id}
            type="button"
            aria-pressed={selected}
            aria-label={describeButton(spot)}
            onClick={() => onSelect(spot.id)}
            style={{ left: `${left}%`, top: `${top}%` } as CSSProperties}
            className={cn(
              /* The photo is narrow on a phone, so the numbers shrink with it. */
              'absolute grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border text-[11px] font-medium transition-colors sm:size-9 sm:text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
              selected
                ? 'border-foreground bg-foreground text-background'
                : 'border-strong bg-background text-foreground hover:border-foreground',
            )}
          >
            {index + 1}
          </button>
        );
      })}

      {buttons.map((spot) => {
        const { top } = spotPosition(spot);
        const left = spot.callout === 'esquerda' ? CALLOUT.left : CALLOUT.right;
        return (
          <div
            key={spot.id}
            /* The open editor is taller than the gap between buttons, so it covers the neighbours. */
            className={cn(
              'absolute hidden -translate-y-1/2 lg:block',
              spot.id === selectedId && 'z-10',
            )}
            style={{ left: `${left}%`, top: `${top}%`, width: `${CALLOUT.width}%` }}
          >
            <div className={cn('flex', spot.callout === 'esquerda' && 'justify-end')}>
              {renderCallout(spot)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
