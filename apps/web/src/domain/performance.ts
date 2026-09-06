export interface BatteryEstimate {
  min: number;
  max: number;
}

/** Milliseconds between reports for a polling rate: 1000 / frequency. */
function reportInterval(pollingRate: number): number {
  return 1000 / pollingRate;
}

export function formatInterval(pollingRate: number): string {
  const interval = reportInterval(pollingRate);
  const digits = interval >= 1 ? (Number.isInteger(interval) ? 0 : 2) : 3;
  return interval.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Simulated autonomy range for the demonstration. It is an illustrative model
 * anchored at 1000 Hz, not a measurement of any hardware.
 */
export function estimateBatteryHours(pollingRate: number): BatteryEstimate {
  const referenceHours = 56;
  const max = Math.round(referenceHours * (1000 / pollingRate) ** 0.45);
  return { min: Math.round(max * 0.8), max };
}
