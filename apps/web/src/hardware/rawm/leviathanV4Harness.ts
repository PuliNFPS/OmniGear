import { vi } from 'vitest';
import type { HidCommand } from '@gearhub/shared';
import { withProtocolEnvelope } from '../../core/coreBridge';
import { answerReports, deliveredReports } from '../../test/sessionVectors';
import type { HardwareTransport } from '../WebHidTransport';
import { LeviathanV4Driver } from './LeviathanV4Driver';
import { leviathanV4QueryFixture } from './leviathanV4Fixture';

const CMD_QUERY = 0x01;
const CMD_NOTIFY = 0x0b;

/**
 * Um Leviathan V4 falso: responde à consulta com `raw` e entrega ao driver o
 * que o teste anunciar. Os relatórios enviados ficam em `sent`.
 */
export function fakeLeviathanV4(raw: Record<string, unknown> = leviathanV4QueryFixture) {
  const listeners = new Set<(reportId: number, data: Uint8Array) => void>();
  const sent: Uint8Array[] = [];
  let answer: Record<string, unknown> | null = raw;
  let failAfter: number | null = null;
  const deliver = (reports: Uint8Array[]) => {
    for (const report of reports) for (const listener of listeners) listener(0, report);
  };
  const transport = {
    open: vi.fn<() => Promise<void>>(async () => undefined),
    send: vi.fn<(command: HidCommand) => Promise<void>>(async ({ data }) => {
      if (failAfter !== null && sent.length >= failAfter) {
        throw new Error('Falha de transporte simulada.');
      }
      sent.push(data);
      // [0] canal virtual, [1] cabeçalho do pedaço, [2] o comando do evento.
      const reply = answer;
      if ((data[2] & 0x0f) === CMD_QUERY && reply) {
        queueMicrotask(() => deliver(answerReports(reply)));
      }
    }),
    onInputReport(listener: (reportId: number, data: Uint8Array) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  } satisfies HardwareTransport;
  return {
    transport,
    sent,
    notify(type: number, payload: number[]) {
      deliver(deliveredReports(withProtocolEnvelope([CMD_NOTIFY, 0, type, ...payload], false)));
    },
    report(data: Uint8Array) {
      deliver([data]);
    },
    answerWith(next: Record<string, unknown> | null) {
      answer = next;
    },
    failAfter(count: number | null) {
      failAfter = count;
    },
  };
}

/** Um driver já ligado pela consulta, com os envios dela descartados. */
export async function connectedDriver(
  fake: ReturnType<typeof fakeLeviathanV4>,
): Promise<LeviathanV4Driver> {
  const driver = new LeviathanV4Driver(fake.transport);
  await driver.query();
  fake.sent.length = 0;
  return driver;
}
