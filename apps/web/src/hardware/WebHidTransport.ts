import type { HidCommand } from '@gearhub/shared';

export interface HidDeviceHandle {
  opened: boolean;
  open(): Promise<void>;
  sendReport(reportId: number, data: BufferSource): Promise<void>;
  addEventListener(type: 'inputreport', listener: (event: HidInputReportEvent) => void): void;
  removeEventListener(type: 'inputreport', listener: (event: HidInputReportEvent) => void): void;
}

export interface HidInputReportEvent {
  reportId: number;
  data: DataView;
}

export interface HardwareTransport {
  open(): Promise<void>;
  send(command: HidCommand): Promise<void>;
  onInputReport(listener: (reportId: number, data: Uint8Array) => void): () => void;
}

export class WebHidTransport implements HardwareTransport {
  constructor(private readonly device: HidDeviceHandle) {}

  async open() {
    if (!this.device.opened) await this.device.open();
  }

  async send(command: HidCommand) {
    await this.open();
    await this.device.sendReport(command.reportId, command.data as Uint8Array<ArrayBuffer>);
  }

  onInputReport(listener: (reportId: number, data: Uint8Array) => void): () => void {
    const handle = (event: HidInputReportEvent) => {
      const bytes = new Uint8Array(
        event.data.buffer,
        event.data.byteOffset,
        event.data.byteLength,
      ).slice();
      listener(event.reportId, bytes);
    };
    this.device.addEventListener('inputreport', handle);
    return () => this.device.removeEventListener('inputreport', handle);
  }
}
