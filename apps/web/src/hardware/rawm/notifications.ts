import { RawEventAssembler, decodeReportChunk, parseNotification } from '../../core/coreBridge';
import type { RawmNotification } from '../../core/coreBridge';
import type { HardwareTransport } from '../WebHidTransport';

export type { RawmNotification } from '../../core/coreBridge';

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
