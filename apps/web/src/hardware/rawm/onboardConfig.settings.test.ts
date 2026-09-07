import { describe, expect, it } from 'vitest';
import type { MouseSettings } from '@gearhub/shared';
import { createLeviathanV4Peripheral } from './leviathanV4';
import { leviathanV4QueryFixture } from './leviathanV4Fixture';
import { encodeLeviathanAction } from './LeviathanV4Driver';
import { decodeOnboardEntry, settingsFromSlot, type OnboardBinding } from './onboardConfig';
import { withProtocolEnvelope } from './protocol';

const base = createLeviathanV4Peripheral(leviathanV4QueryFixture, 'real').defaults as MouseSettings;

function binding(
  keyIds: number[],
  actionId: Parameters<typeof encodeLeviathanAction>[1],
): OnboardBinding {
  return decodeOnboardEntry(withProtocolEnvelope(encodeLeviathanAction(keyIds, actionId)!, false))!;
}

const slotOf = (bindings: OnboardBinding[]) => ({ index: 0, bindings });

describe('settingsFromSlot', () => {
  it('takes the action the mouse reports for a key', () => {
    const settings = settingsFromSlot(base, slotOf([binding([0x0b], 'clique-central')]));

    expect(settings.buttons.direito).toBe('clique-central');
  });

  /**
   * The whole point of reading the dump: a key the mouse never mentions holds
   * nothing, and showing the app's default there is the divergence this fixes.
   */
  it('reads a key the dump never mentions as disabled', () => {
    expect(base.buttons.esquerdo).toBe('clique-esquerdo');

    const settings = settingsFromSlot(base, slotOf([binding([0x0b], 'clique-direito')]));

    expect(settings.buttons.esquerdo).toBe('desativado');
  });

  it('reads an R-Plus layer as its activator and target', () => {
    const settings = settingsFromSlot(base, slotOf([binding([0x10, 0x0c], 'dpi-aumentar')]));

    expect(settings.rPlus?.activatorButtonId).toBe('dpi');
    expect(settings.rPlus?.buttons.central).toBe('dpi-aumentar');
  });

  /**
   * A macro is something, not nothing. Marking the button disabled would claim
   * it is free, and the next write would then erase what is really there.
   */
  it('leaves a button whose binding it cannot name', () => {
    const macro = decodeOnboardEntry(
      withProtocolEnvelope([0x03, 0x00, 0x05, 0x01, 0x0a, 0x00, 0x01, 0x02], false),
    )!;
    expect(macro.action).toBeNull();

    const settings = settingsFromSlot(base, slotOf([macro]));

    expect(settings.buttons.esquerdo).toBe(base.buttons.esquerdo);
  });

  it('keeps DPI and polling, which the dump does not carry', () => {
    const settings = settingsFromSlot(base, slotOf([binding([0x0a], 'clique-esquerdo')]));

    expect(settings.pollingRate).toBe(base.pollingRate);
    expect(settings.dpiStages).toEqual(base.dpiStages);
  });
});
