import { describe, expect, it } from 'vitest';
import { leviathanV4QueryFixture } from './leviathanV4Fixture';
import { LEVIATHAN_V4_LOD_LEVELS, formatLiftOffDistance } from './leviathanV4Lod';
import { parseMouseParamState } from './mouseParamSnapshot';

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

  it('spans exactly the range the capability advertises', () => {
    const raws = LEVIATHAN_V4_LOD_LEVELS.map((level) => level.raw);

    expect(raws).toEqual([1, 2, 3]);
    expect(LEVIATHAN_V4_LOD_LEVELS.map((level) => level.millimetres)).toEqual([0.7, 1.0, 2.0]);
  });
});
