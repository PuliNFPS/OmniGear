import type { DpiCapability, DpiStage } from '@gearhub/shared';
import { describe, expect, it } from 'vitest';
import {
  addStage,
  canRemoveStage,
  clampDpi,
  linkAxes,
  removeStage,
  setStageAxis,
  unlinkAxes,
  validateDpi,
} from './dpi';

const capability: DpiCapability = {
  min: 100,
  max: 6400,
  step: 50,
  minStages: 1,
  maxStages: 4,
  independentAxes: true,
};

const stages: DpiStage[] = [
  { id: 'estagio-1', x: 400, y: 400 },
  { id: 'estagio-2', x: 800, y: 800 },
];

describe('validateDpi', () => {
  it('accepts a value inside the range and on the sensor step', () => {
    expect(validateDpi(1600, capability)).toEqual({ valid: true });
  });

  it('rejects values outside the sensor range', () => {
    expect(validateDpi(12_000, capability)).toEqual({
      valid: false,
      message: 'Use um valor entre 100 e 6.400 DPI.',
    });
  });

  it('rejects values off the sensor step', () => {
    expect(validateDpi(825, capability)).toEqual({
      valid: false,
      message: 'Use múltiplos de 50 DPI.',
    });
  });

  it('rejects an empty or non numeric entry', () => {
    expect(validateDpi(Number.NaN, capability)).toEqual({
      valid: false,
      message: 'Informe um valor de DPI.',
    });
  });
});

describe('clampDpi', () => {
  it('rounds to the step and keeps the value inside the range', () => {
    expect(clampDpi(825, capability)).toBe(850);
    expect(clampDpi(99, capability)).toBe(100);
    expect(clampDpi(99_999, capability)).toBe(6400);
  });
});

describe('stage operations', () => {
  it('adds a stage repeating the last value until the model limit', () => {
    const three = addStage(stages, capability);
    expect(three.at(-1)).toEqual({ id: 'estagio-3', x: 800, y: 800 });

    const four = addStage(three, capability);
    expect(addStage(four, capability)).toBe(four);
  });

  it('keeps at least the minimum number of stages', () => {
    const single = [stages[0]];
    expect(canRemoveStage(single, capability)).toBe(false);
    expect(removeStage(single, capability, 'estagio-1', 'estagio-1').stages).toEqual(single);
  });

  it('moves the active stage when the active one is removed', () => {
    const removal = removeStage(stages, capability, 'estagio-2', 'estagio-2');
    expect(removal.stages).toHaveLength(1);
    expect(removal.activeStageId).toBe('estagio-1');
  });

  it('keeps the active stage when another one is removed', () => {
    const removal = removeStage(stages, capability, 'estagio-1', 'estagio-2');
    expect(removal.activeStageId).toBe('estagio-2');
  });
});

describe('axes', () => {
  it('writes both axes while they are linked', () => {
    const updated = setStageAxis(stages, 'estagio-1', 'x', 1200, false);
    expect(updated[0]).toEqual({ id: 'estagio-1', x: 1200, y: 1200 });
  });

  it('writes a single axis when they are independent', () => {
    const updated = setStageAxis(stages, 'estagio-1', 'y', 1200, true);
    expect(updated[0]).toEqual({ id: 'estagio-1', x: 400, y: 1200 });
  });

  it('brings Y back to X when the axes are linked again', () => {
    const independent = setStageAxis(stages, 'estagio-1', 'y', 1200, true);
    expect(linkAxes(independent)[0]).toEqual({ id: 'estagio-1', x: 400, y: 400 });
  });

  it('restores the kept Y when the axes are separated again', () => {
    const independent = setStageAxis(stages, 'estagio-1', 'y', 1200, true);
    const linked = linkAxes(independent);
    const restored = unlinkAxes(linked, { 'estagio-1': 1200 });

    expect(restored[0]).toEqual({ id: 'estagio-1', x: 400, y: 1200 });
    expect(restored[1]).toEqual(linked[1]);
  });

  it('keeps the shown value for a stage without a kept Y', () => {
    const linked = linkAxes(stages);
    expect(unlinkAxes(linked, {})).toEqual(linked);
  });
});
