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

export interface WebHidTransportOptions {
  operationTimeoutMs?: number;
}

const DEFAULT_OPERATION_TIMEOUT_MS = 3000;

async function withinTimeout<T>(
  operation: () => Promise<T>,
  description: string,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Tempo limite ao ${description} (${timeoutMs} ms).`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export class WebHidTransport implements HardwareTransport {
  private readonly operationTimeoutMs: number;

  constructor(
    private readonly device: HidDeviceHandle,
    options: WebHidTransportOptions = {},
  ) {
    this.operationTimeoutMs = options.operationTimeoutMs ?? DEFAULT_OPERATION_TIMEOUT_MS;
  }

  async open() {
    if (!this.device.opened) {
      await withinTimeout(
        () => this.device.open(),
        'abrir o dispositivo HID',
        this.operationTimeoutMs,
      );
    }
  }

  async send(command: HidCommand) {
    await this.open();
    await withinTimeout(
      () => this.device.sendReport(command.reportId, command.data as Uint8Array<ArrayBuffer>),
      'enviar o relatório HID',
      this.operationTimeoutMs,
    );
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
