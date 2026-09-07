import type { Peripheral } from '@gearhub/shared';

/**
 * The charge worth showing, or null when there is none.
 *
 * Two different things arrive as a null battery — a device without one, and a
 * device that has one but does not report it — and neither has a reading to
 * show. A disconnected device is the third case: it left a number behind, but
 * nothing refreshes it, so showing it would be presenting a stale value as
 * current.
 */
export function batteryReading(device: Pick<Peripheral, 'battery' | 'status'>): number | null {
  return device.status === 'desconectado' ? null : device.battery;
}

/**
 * How full the battery is, in the bands the indicator draws. The device
 * reports a percentage; only the band decides the icon and whether the
 * reading is shown as a warning.
 */
export type BatteryTier = 'cheia' | 'media' | 'baixa' | 'critica';

export function batteryTier(percent: number): BatteryTier {
  if (percent > 60) return 'cheia';
  if (percent > 30) return 'media';
  if (percent > 15) return 'baixa';
  return 'critica';
}

/**
 * Accessible name for the indicator. A simulated device says so: its charge is
 * a fixed number in the demonstration, not a measurement of any hardware.
 */
export function batteryLabel(percent: number, demo: boolean): string {
  return `Bateria ${percent}%${demo ? ' (simulada)' : ''}`;
}
