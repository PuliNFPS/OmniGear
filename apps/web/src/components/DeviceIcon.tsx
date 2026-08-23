import type { PeripheralType } from '@gearhub/shared';
import { Keyboard, Mouse } from 'lucide-react';

export function DeviceIcon({
  type,
  className = 'size-5',
}: {
  type: PeripheralType;
  className?: string;
}) {
  return type === 'mouse' ? <Mouse className={className} /> : <Keyboard className={className} />;
}
