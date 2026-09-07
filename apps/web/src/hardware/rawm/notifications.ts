import type { HardwareTransport } from '../WebHidTransport';
import { RawEventAssembler, decodeReportChunk } from './protocol';

/**
 * The mouse reports its own changes.
 *
 * Cycling DPI with a button changes the device without the app asking, so
 * without listening the screen keeps showing the stage the mouse left behind.
 *
 * Layout and payloads follow the vendor library's notify handler: the event
 * carries the type at index 2 and the value from index 3, little endian.
 */

const CMD_NOTIFY = 0x0b;
const NOTIFY_TYPE_MOUSE_CPI = 0x00;
const NOTIFY_TYPE_MOUSE_POLLING = 0x01;
/** Independent axes pack X and Y into 32 bits. */
const NOTIFY_TYPE_MOUSE_CPI2 = 0x06;
/** The mappings each onboard slot holds, streamed unprompted after a query. */
const NOTIFY_TYPE_MOUSE_CONFIG = 0x14;

export type RawmNotification =
  | { kind: 'dpi'; value: number }
  | { kind: 'dpi-xy'; value: number }
  | { kind: 'polling'; value: number }
  | { kind: 'onboard-config'; payload: Uint8Array };

function isNotification(event: Uint8Array): boolean {
  return (event[0] & 0x0f) === CMD_NOTIFY;
}

/** Returns null for notifications this app has no use for. */
export function parseNotification(event: Uint8Array): RawmNotification | null {
  if (!isNotification(event) || event.length < 3) return null;
  const payload = event.slice(3);
  const u16 = () => payload[0] | (payload[1] << 8);

  switch (event[2]) {
    case NOTIFY_TYPE_MOUSE_CPI:
      return payload.length >= 2 ? { kind: 'dpi', value: u16() } : null;
    case NOTIFY_TYPE_MOUSE_CPI2:
      return payload.length >= 4
        ? {
            kind: 'dpi-xy',
            value: (payload[0] | (payload[1] << 8) | (payload[2] << 16) | (payload[3] << 24)) >>> 0,
          }
        : null;
    case NOTIFY_TYPE_MOUSE_POLLING:
      return payload.length >= 2 ? { kind: 'polling', value: u16() } : null;
    // Delimiters and entries alike; onboardConfig.ts assembles the stream.
    case NOTIFY_TYPE_MOUSE_CONFIG:
      return payload.length >= 1 ? { kind: 'onboard-config', payload } : null;
    default:
      return null;
  }
}

/**
 * Listens for as long as the device stays connected. Reports that fail to
 * decode are skipped rather than ending the subscription: the same endpoint
 * also carries the receiver's own frames.
 */
export function subscribeToNotifications(
  transport: HardwareTransport,
  listener: (notification: RawmNotification) => void,
): () => void {
  const assembler = new RawEventAssembler();

  return transport.onInputReport((reportId, report) => {
    if (reportId !== 0) return;
    try {
      const chunk = decodeReportChunk(report, true);
      if (chunk === null || chunk.length === 0) return;
      for (const event of assembler.push(chunk)) {
        const notification = parseNotification(event);
        if (notification) listener(notification);
      }
    } catch {
      assembler.reset();
    }
  });
}
