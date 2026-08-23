import type { HidCommand } from '@gearhub/shared';

export interface HidDeviceHandle {
  opened: boolean;
  open(): Promise<void>;
  sendReport(reportId: number, data: BufferSource): Promise<void>;
}

export interface HardwareTransport {
  open(): Promise<void>;
  send(command: HidCommand): Promise<void>;
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
}
