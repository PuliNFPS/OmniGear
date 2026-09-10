import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { DeviceReport } from '../deviceDriver';
import { LeviathanV4Driver } from './LeviathanV4Driver';
import { leviathanV4QueryFixture as fixture } from './leviathanV4Fixture';
import { createLeviathanV4Peripheral } from './leviathanV4';
import { frameEvent, withProtocolEnvelope } from './protocol';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function harness(raw = fixture) {
  const listeners = new Set<(id: number, data: Uint8Array) => void>();
  const emit = (event: Uint8Array) => {
    for (const frame of frameEvent(Uint8Array.from([255, 255, 255, 255, ...event]), true)) {
      for (const listener of listeners) listener(0, frame);
    }
  };
  const send = vi.fn<(command: { data: Uint8Array }) => Promise<void>>(async () => {});
  const driver = new LeviathanV4Driver(
    {
      open: async () => {},
      send,
      onInputReport: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    raw,
    true,
  );
  const reports: DeviceReport[] = [];
  driver.onDeviceReport((report) => reports.push(report));
  return {
    driver,
    send,
    reports,
    notify: (type: number, payload: number[]) =>
      emit(withProtocolEnvelope([0x0b, 0, type, ...payload], false)),
    answer: (snapshot: Record<string, unknown>) =>
      emit(
        withProtocolEnvelope(
          [0x02, 0, ...new TextEncoder().encode(JSON.stringify(snapshot))],
          false,
        ),
      ),
  };
}

it('receives DPI buttons and decodes independent axes for the editor', () => {
  const { notify, reports } = harness();
  notify(0x00, [0x40, 0x06]);
  expect(reports.at(-1)).toEqual({ kind: 'dpi', value: 1600, y: 1600 });
  notify(0x06, [0x20, 0x03, 0x40, 0x06]);
  expect(reports.at(-1)).toEqual({ kind: 'dpi', value: 800, y: 1600 });
});

it('reads the actual active index independently of the opaque ob parameter', async () => {
  const { driver, send, answer, notify, reports } = harness({ ...fixture, ob: 3, oci: 1 });
  expect(reports[0]).toEqual({ kind: 'active-profile', slotIndex: 2 });
  send.mockImplementation(async ({ data }) => {
    if ((data[2] & 0x0f) === 1) answer({ ...fixture, ob: 3, oci: 2, cpi: 3200 });
  });
  await expect(driver.readState()).resolves.toEqual({
    activeProfileSlot: 3,
    dpi: { x: 3200, y: 3200 },
  });
  notify(0x22, [3]);
  expect(reports.at(-1)).toEqual({ kind: 'active-profile', slotIndex: 4 });
});

it('stops sending a session configuration when the physical memory changes', async () => {
  const { driver, send, notify } = harness();
  send.mockImplementationOnce(async () => {
    notify(0x22, [1]);
  });
  const apply = driver.applyToSession(createLeviathanV4Peripheral(fixture, 'test').defaults);
  const rejected = expect(apply).rejects.toThrow('memória ativa mudou');
  await vi.runAllTimersAsync();
  await rejected;
  expect(send).toHaveBeenCalledTimes(1);
});
