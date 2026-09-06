import type { PeripheralPhoto } from '@gearhub/shared';
import { cn } from '@gearhub/ui/lib/utils';

/**
 * Photo of the model. It is decorative: the name of the device is always beside
 * it and every control it shows carries its own label elsewhere on the screen.
 */
export function DevicePhoto({ photo, className }: { photo: PeripheralPhoto; className?: string }) {
  return (
    <img
      src={photo.src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn('device-photo object-contain', className)}
    />
  );
}
