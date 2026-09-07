import type { Peripheral } from '@gearhub/shared';
import { cn } from '@gearhub/ui/lib/utils';
import { BatteryFull, BatteryLow, BatteryMedium, BatteryWarning } from 'lucide-react';
import type { ComponentType } from 'react';
import { batteryLabel, batteryReading, batteryTier, type BatteryTier } from '../domain/battery';

const icons: Record<BatteryTier, ComponentType<{ className?: string }>> = {
  cheia: BatteryFull,
  media: BatteryMedium,
  baixa: BatteryLow,
  critica: BatteryWarning,
};

/**
 * Charge the device reported when it was read. Renders nothing when there is
 * no reading to show; `batteryReading` owns that rule, so the call sites can
 * ask it the same question before adding a separator.
 */
export function BatteryLevel({ device, className }: { device: Peripheral; className?: string }) {
  const percent = batteryReading(device);
  if (percent === null) return null;

  const tier = batteryTier(percent);
  const Icon = icons[tier];
  const label = batteryLabel(percent, device.demo);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap tabular-nums',
        tier === 'critica' ? 'text-destructive' : 'text-muted-foreground',
        className,
      )}
      title={label}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span aria-hidden="true">{percent}%</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
