import { describe, expect, it } from 'vitest';
import { leviathanV4QueryFixture } from './leviathanV4Fixture';
import { describeLeviathanV4, parseMouseParamState } from '../../core/coreBridge';
import { formatLiftOffDistance } from './leviathanV4Lod';

describe('lift-off distance levels', () => {
  // Values read off the official software, which names them rather than
  // measuring them.
  it('names each level and its distance', () => {
    expect(formatLiftOffDistance(1)).toBe('Baixo · 0,7 mm');
    expect(formatLiftOffDistance(2)).toBe('Médio · 1,0 mm');
    expect(formatLiftOffDistance(3)).toBe('Alto · 2,0 mm');
  });

  // The field is an index. Rendering it as millimetres printed "2.0 mm" for a
  // mouse that was actually at 1.0 mm.
  it('reads the captured device as the middle level, not as 2 mm', () => {
    const state = parseMouseParamState(leviathanV4QueryFixture);

    expect(state.liftOffDistance).toBe(2);
    expect(formatLiftOffDistance(state.liftOffDistance)).toContain('1,0 mm');
  });

  it('keeps an unknown level visible instead of hiding it', () => {
    expect(formatLiftOffDistance(9)).toBe('nível 9');
  });

  // The core owns the range; every level in it needs a name here, or the
  // control would show "nível N" for a level the mouse really has.
  it('names every level in the range the core advertises', () => {
    const { min, max } = describeLeviathanV4(leviathanV4QueryFixture).liftOffDistance;
    for (let raw = min; raw <= max; raw += 1) {
      expect(formatLiftOffDistance(raw)).not.toMatch(/^nível/);
    }
  });
});
