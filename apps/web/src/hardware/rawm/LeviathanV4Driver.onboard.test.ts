import { describe, expect, it } from 'vitest';
import type { MouseSettings } from '@gearhub/shared';
import { notifyReport } from '../../test/sessionVectors';
import { fromHex, readProtocolVectors } from '../../test/vectors';
import { createLeviathanV4Peripheral } from './leviathanV4';
import { leviathanV4QueryFixture } from './leviathanV4Fixture';
import { connectedDriver, fakeLeviathanV4 } from './leviathanV4Harness';

const settings = createLeviathanV4Peripheral(leviathanV4QueryFixture, 'real')
  .defaults as MouseSettings;
const innerType = (report: Uint8Array) => report[9];
const LEFT_CLICK_ENTRY = '030a16010a0001010000';

function deliverDump(fake: ReturnType<typeof fakeLeviathanV4>, payloads: string[]): void {
  for (const payload of payloads) fake.report(notifyReport(0x14, fromHex(payload)));
}

/** O dump de um mouse que guarda os mapeamentos padrão na memória 0, dos vetores. */
function heldDump(): string[] {
  const vector = readProtocolVectors().sessionApply.find(
    ({ name }) => name === 'com dump e mapeamentos iguais: só parâmetros',
  );
  if (!vector?.dump) throw new Error('vetor do dump padrão ausente');
  return vector.dump;
}

describe('reading the onboard slots', () => {
  it('replays a dump that landed before anyone subscribed', async () => {
    const fake = fakeLeviathanV4();
    const driver = await connectedDriver(fake);
    deliverDump(fake, ['02', LEFT_CLICK_ENTRY, 'ff']);
    let received: { index: number }[] = [];
    driver.onOnboardProfiles((slots) => {
      received = slots;
    });
    expect(received.map((slot) => slot.index)).toEqual([2]);
  });

  it('names the bindings the mouse reported', async () => {
    const fake = fakeLeviathanV4();
    const driver = await connectedDriver(fake);
    deliverDump(fake, ['00', LEFT_CLICK_ENTRY, 'ff']);
    let received: { bindings: { keyIds: number[]; action: string | null }[] }[] = [];
    driver.onOnboardProfiles((slots) => {
      received = slots;
    });
    const left = received[0].bindings.find((binding) => binding.keyIds[0] === 0x0a);
    expect(left?.action).toBe('clique-esquerdo');
  });
});

// The vendor's mouse dropdown only selects which onboard slot to edit.
describe('switching the active onboard slot', () => {
  it('is not offered without a verified mouse-side switch command', async () => {
    const driver = await connectedDriver(fakeLeviathanV4());
    expect((driver as { switchProfile?: unknown }).switchProfile).toBeUndefined();
  });
});

it('stops skipping after a write that failed part way through', async () => {
  const fake = fakeLeviathanV4();
  const driver = await connectedDriver(fake);
  deliverDump(fake, heldDump());

  // The reset and the first events land, then the transport gives out.
  fake.failAfter(4);
  await expect(
    driver.applyToSession({ ...settings, buttons: { ...settings.buttons, central: 'desativado' } }),
  ).rejects.toThrow('Falha de transporte simulada.');
  fake.failAfter(null);
  fake.sent.length = 0;

  // What the mouse originally reported is no longer assumed to be in place.
  await driver.applyToSession(settings);
  expect(fake.sent.map(innerType)).toContain(0x03);
});
