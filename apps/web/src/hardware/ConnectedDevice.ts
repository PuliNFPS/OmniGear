import type {
  ConnectedPeripheral,
  DeviceCapabilities,
  DeviceSettings,
  PeripheralType,
} from '@gearhub/shared';
import type { HardwareTransport } from './WebHidTransport';

export abstract class ConnectedDevice implements ConnectedPeripheral {
  abstract id: string;
  abstract name: string;
  abstract manufacturer: string;
  abstract type: PeripheralType;
  abstract capabilities: DeviceCapabilities;
  abstract settings: DeviceSettings;

  constructor(protected readonly transport?: HardwareTransport) {}

  setDpi?(dpi: number): Promise<void>;
  setPollingRate?(rate: number): Promise<void>;
}
