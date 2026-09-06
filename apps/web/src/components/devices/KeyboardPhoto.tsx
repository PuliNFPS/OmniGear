import type { KeyboardKeySpot, PeripheralPhoto } from '@gearhub/shared';
import { cn } from '@gearhub/ui/lib/utils';
import type { CSSProperties } from 'react';
import { measureRows } from '../../domain/keyboardLayout';
import { DevicePhoto } from './DevicePhoto';

interface KeyboardPhotoProps {
  photo: PeripheralPhoto;
  keys: KeyboardKeySpot[];
  className?: string;
  selectedKeyId: string | null;
  remappedKeyIds: readonly string[];
  onSelectKey(keyId: string): void;
  describeKey(key: KeyboardKeySpot): string;
}

/**
 * Photo of the keyboard with one target over each key. The targets follow the
 * grid measured on the photo, so selecting a key means clicking the real one.
 */
export function KeyboardPhoto({
  photo,
  keys,
  className,
  selectedKeyId,
  remappedKeyIds,
  onSelectKey,
  describeKey,
}: KeyboardPhotoProps) {
  const grid = photo.keyGrid;
  const rows = measureRows(keys);

  return (
    <div
      className={cn('relative mx-auto w-full', className)}
      style={{ aspectRatio: String(photo.aspect) }}
    >
      <DevicePhoto photo={photo} className="absolute inset-0 size-full" />

      {grid &&
        keys.map((key) => {
          const selected = key.id === selectedKeyId;
          const remapped = remappedKeyIds.includes(key.id);
          const style = {
            left: `${grid.left + key.x * grid.unitX}%`,
            top: `${grid.top + (rows.top.get(key.row) ?? key.row) * grid.unitY}%`,
            width: `${key.width * grid.unitX}%`,
            height: `${grid.unitY}%`,
          } as CSSProperties;

          const remappable = key.remappable !== false;
          return (
            <button
              key={key.id}
              type="button"
              style={style}
              aria-pressed={selected}
              aria-label={describeKey(key)}
              disabled={!remappable}
              onClick={() => onSelectKey(key.id)}
              /* The keyboard is dark in both themes, so the marks are light. */
              className={cn(
                'absolute rounded-[3px] transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none',
                !remappable && 'cursor-not-allowed',
                selected
                  ? 'bg-white/40 ring-2 ring-white'
                  : remapped
                    ? 'bg-white/20 ring-1 ring-white/60 hover:bg-white/30'
                    : remappable && 'hover:bg-white/15',
              )}
            />
          );
        })}
    </div>
  );
}
