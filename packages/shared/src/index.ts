export interface HidCommand {
  reportId: number;
  data: Uint8Array;
}

export * from './mouse/capabilities';
export * from './mouse/profile';
export * from './mouse/telemetry';
export * from './mouse/session';
export * from './mouse/driver';
