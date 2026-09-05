/** Estado vivo do device. Read-only, nunca persiste. */
export interface MouseTelemetry {
  batteryPercent?: number;
  charging?: boolean;
  connection: 'wired' | 'dongle' | 'bluetooth';
  firmware: string;
}
