import { describe, expect, it } from 'vitest';
import type { MouseSettings } from '@gearhub/shared';
import { leviathanV4QueryFixture } from './leviathanV4Fixture';
import { createLeviathanV4Peripheral } from './leviathanV4';
import { LeviathanV4Driver, mappingEvents } from './LeviathanV4Driver';
import { withProtocolEnvelope } from './protocol';

const CMD_NOTIFY = 0x0b;
const NOTIFY_TYPE_MOUSE_CONFIG = 0x14;

/**
 * One notification as it reaches the transport: the four-byte preamble the
 * assembler demands, wrapped in a virtual-channel report.
 */
function notifyReport(payload: number[]): Uint8Array {
  const event = withProtocolEnvelope([CMD_NOTIFY, 0, NOTIFY_TYPE_MOUSE_CONFIG, ...payload], false);
  const chunk = Uint8Array.from([0xff, 0xff, 0xff, 0xff, ...event]);
  const report = new Uint8Array(64);
  report[0] = 0xc0;
  report[1] = 0x80 | chunk.length;
  report.set(chunk, 2);
  return report;
}

function harness({ failAfter }: { failAfter?: number } = {}) {
  const sent: Uint8Array[] = [];
  let listener: ((reportId: number, data: Uint8Array) => void) | null = null;
  const transport = {
    open: async () => undefined,
    send: async (command: { data: Uint8Array }) => {
      if (failAfter !== undefined && sent.length >= failAfter) {
        throw new Error('Falha de transporte simulada.');
      }
      sent.push(command.data);
    },
    onInputReport: (handler: (reportId: number, data: Uint8Array) => void) => {
      listener = handler;
      return () => undefined;
    },
  };
  const driver = new LeviathanV4Driver(transport, leviathanV4QueryFixture, true);
  const settings = createLeviathanV4Peripheral(leviathanV4QueryFixture, 'real')
    .defaults as MouseSettings;

  /** Streams a slot exactly as a mouse holding `held` would report it. */
  const reportSlot = (index: number, held: MouseSettings) => {
    listener?.(0, notifyReport([index]));
    for (const event of mappingEvents(held)) {
      listener?.(0, notifyReport([...withProtocolEnvelope(event, false)]));
    }
    listener?.(0, notifyReport([0xff]));
  };

  return { sent, driver, settings, reportSlot };
}

const innerType = (report: Uint8Array) => report[9];
const disabledCentral = (settings: MouseSettings): MouseSettings => ({
  ...settings,
  buttons: { ...settings.buttons, central: 'desativado' },
});

describe('applying once the mouse has reported its own mappings', () => {
  it('sends only the parameter block when the mappings did not change', async () => {
    const { sent, driver, settings, reportSlot } = harness();
    reportSlot(0, settings);

    await driver.applyToSession({ ...settings, pollingRate: 500 });
    const types = sent.map(innerType);

    expect(types).toContain(0x15); // parameters
    expect(types).not.toContain(0x03); // config reset
    expect(types.every((type) => type !== 0x16 && type !== 0x18)).toBe(true);
  });

  it('resends the whole set when a mapping does change', async () => {
    const { sent, driver, settings, reportSlot } = harness();
    reportSlot(0, settings);

    await driver.applyToSession(disabledCentral(settings));
    const types = sent.map(innerType);

    expect(types).toContain(0x03);
    expect(types.filter((type) => type === 0x16 || type === 0x18).length).toBeGreaterThan(4);
  });

  /**
   * Without a dump the app knows nothing about the mouse, and the defaults it
   * shows are its own invention. Trusting them is what made the screen and the
   * mouse disagree, so silence means write everything.
   */
  it('writes the whole set while no dump has arrived', async () => {
    const { sent, driver, settings } = harness();

    await driver.applyToSession({ ...settings, pollingRate: 500 });

    expect(sent.map(innerType)).toContain(0x03);
  });

  it('stops skipping after a write that failed part way through', async () => {
    const { sent, driver, settings, reportSlot } = harness({ failAfter: 4 });
    reportSlot(0, settings);

    // The reset and the first events land, then the transport gives out: the
    // mouse is left holding neither the old set nor the new one.
    await expect(driver.applyToSession(disabledCentral(settings))).rejects.toThrow();
    sent.length = 0;

    // Re-applying what the mouse originally reported must not be treated as
    // already in place; the interrupted set has to be written again.
    await driver.applyToSession(settings).catch(() => undefined);

    expect(sent.map(innerType)).toContain(0x03);
  });
});

describe('reading the onboard slots', () => {
  it('replays a dump that landed before anyone subscribed', () => {
    const { driver, settings, reportSlot } = harness();
    reportSlot(2, settings);

    let received: { index: number }[] = [];
    driver.onOnboardProfiles((slots) => {
      received = slots;
    });

    expect(received.map((slot) => slot.index)).toEqual([2]);
  });

  it('names the bindings the mouse reported', () => {
    const { driver, settings, reportSlot } = harness();
    reportSlot(0, settings);

    let received: { bindings: { keyIds: number[]; action: string | null }[] }[] = [];
    driver.onOnboardProfiles((slots) => {
      received = slots;
    });

    const left = received[0].bindings.find((binding) => binding.keyIds[0] === 0x0a);
    expect(left?.action).toBe('clique-esquerdo');
  });
});

describe('switching the active onboard slot', () => {
  it('sends the parameter block carrying the new index', async () => {
    const { sent, driver } = harness();

    await driver.switchProfile(3);

    expect(sent.filter((report) => innerType(report) === 0x15)).toHaveLength(1);
  });

  it('rejects a slot index outside the addressable range', async () => {
    const { driver } = harness();

    await expect(driver.switchProfile(0)).rejects.toThrow('invalido');
  });
});
