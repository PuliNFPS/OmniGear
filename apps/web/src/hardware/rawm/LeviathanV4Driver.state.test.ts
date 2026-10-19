import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { MouseSettings } from '@gearhub/shared';
import type { DeviceReport } from '../deviceDriver';
import { LeviathanV4Driver } from './LeviathanV4Driver';
import { createLeviathanV4Peripheral } from './leviathanV4';
import { leviathanV4QueryFixture as fixture } from './leviathanV4Fixture';
import { connectedDriver, fakeLeviathanV4 } from './leviathanV4Harness';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const settings = createLeviathanV4Peripheral(fixture, 'test').defaults as MouseSettings;

function listen(driver: LeviathanV4Driver): DeviceReport[] {
  const reports: DeviceReport[] = [];
  driver.onDeviceReport((report) => reports.push(report));
  return reports;
}

it('connects with one query on the virtual channel', async () => {
  const fake = fakeLeviathanV4();
  const driver = new LeviathanV4Driver(fake.transport);
  await expect(driver.query()).resolves.toMatchObject({
    deviceName: 'LEVIATHAN V4',
    crcSupported: true,
  });
  expect(fake.sent).toHaveLength(1);
  expect(fake.sent[0][0]).toBe(0xc0);
});

it('counts opening the device against the query timeout', async () => {
  const fake = fakeLeviathanV4();
  fake.transport.open.mockImplementation(() => new Promise<void>(() => undefined));
  const driver = new LeviathanV4Driver(fake.transport, 5);
  const failed = expect(driver.query()).rejects.toThrow('A consulta RAWM excedeu o tempo limite.');
  await vi.advanceTimersByTimeAsync(5);
  await failed;
});

it('times out without an answer, and the next query still works', async () => {
  const fake = fakeLeviathanV4();
  fake.answerWith(null);
  const driver = new LeviathanV4Driver(fake.transport, 5);
  const failed = expect(driver.query()).rejects.toThrow('tempo limite');
  await vi.advanceTimersByTimeAsync(5);
  await failed;
  fake.answerWith(fixture);
  await expect(driver.query()).resolves.toMatchObject({ deviceName: 'LEVIATHAN V4' });
});

it('fails the pending query on a report from another channel', async () => {
  const fake = fakeLeviathanV4();
  fake.answerWith(null);
  const driver = new LeviathanV4Driver(fake.transport);
  const failed = expect(driver.query()).rejects.toThrow(
    'Relatório não pertence ao canal virtual do mouse.',
  );
  await vi.advanceTimersByTimeAsync(0);
  fake.report(new Uint8Array(64).fill(0x11));
  await failed;
});

it('refuses a mouse that is not a Leviathan V4', async () => {
  const fake = fakeLeviathanV4({ ...fixture, dn: 'RAWM HS Receiver' });
  await expect(new LeviathanV4Driver(fake.transport).query()).rejects.toThrow(
    'Mouse RAWM conectado nao reconhecido: RAWM HS Receiver.',
  );
});

it('reads the actual active memory independently of the opaque ob parameter', async () => {
  const fake = fakeLeviathanV4({ ...fixture, ob: 3, oci: 1 });
  const driver = await connectedDriver(fake);
  const reports = listen(driver);
  expect(reports[0]).toEqual({ kind: 'active-profile', slotIndex: 2 });
  fake.answerWith({ ...fixture, ob: 3, oci: 2, cpi: 3200 });
  await expect(driver.readState()).resolves.toEqual({
    activeProfileSlot: 3,
    dpi: { x: 3200, y: 3200 },
  });
  fake.notify(0x22, [3]);
  expect(reports.at(-1)).toEqual({ kind: 'active-profile', slotIndex: 4 });
});

it('receives DPI buttons and decodes independent axes for the editor', async () => {
  const fake = fakeLeviathanV4();
  const driver = await connectedDriver(fake);
  const reports = listen(driver);
  fake.notify(0x00, [0x40, 0x06]);
  expect(reports.at(-1)).toEqual({ kind: 'dpi', value: 1600, y: 1600 });
  fake.notify(0x06, [0x20, 0x03, 0x40, 0x06]);
  expect(reports.at(-1)).toEqual({ kind: 'dpi', value: 800, y: 1600 });
});

it('stops sending a session configuration when the physical memory changes', async () => {
  const fake = fakeLeviathanV4();
  const driver = await connectedDriver(fake);
  fake.transport.send.mockImplementationOnce(async ({ data }) => {
    fake.sent.push(data);
    fake.notify(0x22, [1]);
  });
  const rejected = expect(driver.applyToSession(settings)).rejects.toThrow('memória ativa mudou');
  await vi.runAllTimersAsync();
  await rejected;
  expect(fake.sent).toHaveLength(1);
});

it('does not let a timed-out query abort the next operation', async () => {
  const reference = fakeLeviathanV4();
  const clean = await connectedDriver(reference);
  const done = clean.applyToSession(settings);
  await vi.runAllTimersAsync();
  await done;

  const fake = fakeLeviathanV4();
  const driver = await connectedDriver(fake);
  let failLate: (error: Error) => void = () => undefined;
  fake.transport.send.mockImplementationOnce(
    () =>
      new Promise<void>((_resolve, reject) => {
        failLate = reject;
      }),
  );
  const timedOut = expect(driver.readState()).rejects.toThrow('tempo limite');
  await vi.advanceTimersByTimeAsync(1000);
  await timedOut;
  const apply = driver.applyToSession(settings);
  // A aplicação começou e espera a primeira pausa quando o envio velho falha.
  await vi.advanceTimersByTimeAsync(0);
  failLate(new Error('envio tardio'));
  await vi.runAllTimersAsync();
  await apply;
  expect(fake.sent).toEqual(reference.sent);
});

/** Grava o instante de cada envio; com o relógio falso, ele avança com os timers. */
function recordSendTimes(fake: ReturnType<typeof fakeLeviathanV4>): number[] {
  const times: number[] = [];
  const original = fake.transport.send.getMockImplementation();
  if (!original) throw new Error('o envio do fake não tem implementação');
  fake.transport.send.mockImplementation(async (command) => {
    times.push(Date.now());
    return original(command);
  });
  return times;
}

function gaps(times: number[]): number[] {
  return times.slice(1).map((time, index) => time - times[index]);
}

it('does not let a timed-out query steal the steps of the next operation', async () => {
  const reference = fakeLeviathanV4();
  const clean = await connectedDriver(reference);
  const referenceTimes = recordSendTimes(reference);
  const done = clean.applyToSession(settings);
  await vi.runAllTimersAsync();
  await done;

  const fake = fakeLeviathanV4();
  const driver = await connectedDriver(fake);
  const times = recordSendTimes(fake);
  let releaseLate: () => void = () => undefined;
  fake.transport.send.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        releaseLate = resolve;
      }),
  );
  const timedOut = expect(driver.readState()).rejects.toThrow('tempo limite');
  await vi.advanceTimersByTimeAsync(1000);
  await timedOut;
  const apply = driver.applyToSession(settings);
  // A aplicação começou e espera a primeira pausa quando o envio velho termina.
  await vi.advanceTimersByTimeAsync(0);
  releaseLate();
  await vi.runAllTimersAsync();
  await apply;
  expect(referenceTimes.length).toBeGreaterThan(1);
  expect(fake.sent).toEqual(reference.sent);
  expect(gaps(times)).toEqual(gaps(referenceTimes));
});

it('does not let a query failed by a foreign report abort the next operation', async () => {
  const reference = fakeLeviathanV4();
  const clean = await connectedDriver(reference);
  const done = clean.applyToSession(settings);
  await vi.runAllTimersAsync();
  await done;

  const fake = fakeLeviathanV4();
  const driver = await connectedDriver(fake);
  let failLate: (error: Error) => void = () => undefined;
  fake.transport.send.mockImplementationOnce(
    () =>
      new Promise<void>((_resolve, reject) => {
        failLate = reject;
      }),
  );
  const failed = expect(driver.readState()).rejects.toThrow(
    'Relatório não pertence ao canal virtual do mouse.',
  );
  await vi.advanceTimersByTimeAsync(0);
  fake.report(new Uint8Array(64).fill(0x11));
  await failed;
  const apply = driver.applyToSession(settings);
  // A aplicação começou e espera a primeira pausa quando o envio velho falha.
  await vi.advanceTimersByTimeAsync(0);
  failLate(new Error('envio tardio'));
  await vi.runAllTimersAsync();
  await apply;
  expect(fake.sent).toEqual(reference.sent);
});
