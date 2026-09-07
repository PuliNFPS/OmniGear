import { describe, expect, it } from 'vitest';
import { encodeLeviathanAction } from './LeviathanV4Driver';
import { OnboardConfigCollector, decodeOnboardEntry } from './onboardConfig';
import { withProtocolEnvelope } from './protocol';

/** The mouse reports entries with the length encoded, as the writer sends them. */
function entry(keyIds: number[], actionId: Parameters<typeof encodeLeviathanAction>[1]) {
  return withProtocolEnvelope(encodeLeviathanAction(keyIds, actionId)!, false);
}

describe('decodeOnboardEntry', () => {
  it('reads a mouse key back to the action that wrote it', () => {
    const decoded = decodeOnboardEntry(entry([0x0a], 'clique-esquerdo'));

    expect(decoded?.keyIds).toEqual([0x0a]);
    expect(decoded?.action).toBe('clique-esquerdo');
  });

  it('reads a wheel binding back', () => {
    expect(decodeOnboardEntry(entry([0x0c], 'rolagem-cima'))?.action).toBe('rolagem-cima');
  });

  it('reads a mouse function back', () => {
    const decoded = decodeOnboardEntry(entry([0x10], 'dpi-ciclo'));

    expect(decoded?.keyIds).toEqual([0x10]);
    expect(decoded?.action).toBe('dpi-ciclo');
  });

  it('reads an R-Plus layer as its two key ids, activator first', () => {
    const decoded = decodeOnboardEntry(entry([0x10, 0x0c], 'dpi-ciclo'));

    expect(decoded?.keyIds).toEqual([0x10, 0x0c]);
    expect(decoded?.action).toBe('dpi-ciclo');
  });

  /**
   * Macros, keyboard keys and shell commands have no MouseActionId. Losing the
   * bytes would erase them from the slot on the next write, so they are kept.
   */
  it('keeps an entry it cannot name, with the bytes intact', () => {
    const macro = withProtocolEnvelope([0x03, 0x00, 0x05, 0x01, 0x0e, 0x00, 0x01, 0x02], false);

    const decoded = decodeOnboardEntry(macro);

    expect(decoded?.action).toBeNull();
    expect(decoded?.keyIds).toEqual([0x0e]);
    expect([...decoded!.raw]).toEqual([...macro]);
  });

  it('rejects bytes that are not a configuration event', () => {
    expect(decodeOnboardEntry(Uint8Array.from([0x0b, 0x02, 0x14]))).toBeNull();
  });
});

describe('OnboardConfigCollector', () => {
  const open = (index: number) => Uint8Array.from([index]);
  const close = () => Uint8Array.from([0xff]);

  it('collects a slot between its index marker and the terminator', () => {
    const collector = new OnboardConfigCollector();

    expect(collector.push(open(0))).toBeNull();
    expect(collector.push(entry([0x0a], 'clique-esquerdo'))).toBeNull();
    const slots = collector.push(close());

    expect(slots).toEqual([
      { index: 0, bindings: [expect.objectContaining({ action: 'clique-esquerdo' })] },
    ]);
  });

  it('keeps one list per onboard slot', () => {
    const collector = new OnboardConfigCollector();

    collector.push(open(0));
    collector.push(entry([0x0a], 'clique-esquerdo'));
    collector.push(open(2));
    collector.push(entry([0x0b], 'clique-central'));
    const slots = collector.push(close());

    expect(slots?.map((slot) => slot.index)).toEqual([0, 2]);
    expect(slots?.[1].bindings[0].action).toBe('clique-central');
  });

  // The vendor clears the slot's list on the marker, so a redump replaces it.
  it('discards what it held for a slot that is dumped again', () => {
    const collector = new OnboardConfigCollector();

    collector.push(open(1));
    collector.push(entry([0x0a], 'clique-esquerdo'));
    collector.push(open(1));
    collector.push(entry([0x0b], 'clique-direito'));
    const slots = collector.push(close());

    expect(slots).toHaveLength(1);
    expect(slots?.[0].bindings).toHaveLength(1);
    expect(slots?.[0].bindings[0].action).toBe('clique-direito');
  });

  it('ignores entries that arrive before any slot marker', () => {
    const collector = new OnboardConfigCollector();

    collector.push(entry([0x0a], 'clique-esquerdo'));

    expect(collector.push(close())).toEqual([]);
  });
});
