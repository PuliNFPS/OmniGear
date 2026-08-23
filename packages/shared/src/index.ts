export type PeripheralType = 'mouse' | 'keyboard';

export interface DeviceCapabilities {
  dpi?: { min: number; max: number; presets: number[] };
  pollingRate?: { supported: number[] };
  battery?: boolean;
  rapidTrigger?: boolean;
  actuation?: { min: number; max: number; step: number };
  lighting?: boolean;
}

export interface DeviceSettings {
  dpi?: number;
  pollingRate?: number;
  batteryLevel?: number;
  rapidTrigger?: boolean;
  actuation?: number;
  lighting?: boolean;
  profile: string;
}

export interface ConnectedPeripheral {
  id: string;
  name: string;
  manufacturer: string;
  type: PeripheralType;
  capabilities: DeviceCapabilities;
  settings: DeviceSettings;
  setDpi?(dpi: number): Promise<void>;
  setPollingRate?(rate: number): Promise<void>;
}

export interface HidCommand {
  reportId: number;
  data: Uint8Array;
}
