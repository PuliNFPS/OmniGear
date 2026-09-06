import type { DpiCapability, DpiStage } from '@gearhub/shared';

export type DpiValidation = { valid: true } | { valid: false; message: string };

export function formatDpi(value: number): string {
  return value.toLocaleString('pt-BR');
}

/** Validates a typed value against the sensor limits before it is written. */
export function validateDpi(value: number, capability: DpiCapability): DpiValidation {
  if (!Number.isFinite(value)) {
    return { valid: false, message: 'Informe um valor de DPI.' };
  }
  if (value < capability.min || value > capability.max) {
    return {
      valid: false,
      message: `Use um valor entre ${formatDpi(capability.min)} e ${formatDpi(capability.max)} DPI.`,
    };
  }
  if ((value - capability.min) % capability.step !== 0) {
    return { valid: false, message: `Use múltiplos de ${formatDpi(capability.step)} DPI.` };
  }
  return { valid: true };
}

/** Rounds to the sensor step and keeps the value inside its range. */
export function clampDpi(value: number, capability: DpiCapability): number {
  if (!Number.isFinite(value)) return capability.min;
  const steps = Math.round((value - capability.min) / capability.step);
  const stepped = capability.min + steps * capability.step;
  return Math.min(capability.max, Math.max(capability.min, stepped));
}

function nextStageId(stages: DpiStage[]): string {
  const used = new Set(stages.map((stage) => stage.id));
  for (let index = 1; ; index += 1) {
    const id = `estagio-${index}`;
    if (!used.has(id)) return id;
  }
}

export function canAddStage(stages: DpiStage[], capability: DpiCapability): boolean {
  return stages.length < capability.maxStages;
}

export function canRemoveStage(stages: DpiStage[], capability: DpiCapability): boolean {
  return stages.length > capability.minStages;
}

/** Adds a stage repeating the last value, which the user then adjusts. */
export function addStage(stages: DpiStage[], capability: DpiCapability): DpiStage[] {
  if (!canAddStage(stages, capability)) return stages;
  const last = stages.at(-1);
  return [
    ...stages,
    {
      id: nextStageId(stages),
      x: last ? last.x : clampDpi(capability.min, capability),
      y: last ? last.y : clampDpi(capability.min, capability),
    },
  ];
}

export interface StageRemoval {
  stages: DpiStage[];
  activeStageId: string;
}

/** Removes a stage and keeps an active stage selected. */
export function removeStage(
  stages: DpiStage[],
  capability: DpiCapability,
  stageId: string,
  activeStageId: string,
): StageRemoval {
  if (!canRemoveStage(stages, capability)) return { stages, activeStageId };
  const index = stages.findIndex((stage) => stage.id === stageId);
  if (index === -1) return { stages, activeStageId };

  const remaining = stages.filter((stage) => stage.id !== stageId);
  if (stageId !== activeStageId) return { stages: remaining, activeStageId };

  const fallback = remaining[Math.min(index, remaining.length - 1)];
  return { stages: remaining, activeStageId: fallback.id };
}

export function setStageAxis(
  stages: DpiStage[],
  stageId: string,
  axis: 'x' | 'y',
  value: number,
  independentAxes: boolean,
): DpiStage[] {
  return stages.map((stage) =>
    stage.id === stageId
      ? independentAxes
        ? { ...stage, [axis]: value }
        : { ...stage, x: value, y: value }
      : stage,
  );
}

/** Linking the axes brings Y to X, the single value the device then uses. */
export function linkAxes(stages: DpiStage[]): DpiStage[] {
  return stages.map((stage) => ({ ...stage, y: stage.x }));
}

/**
 * Separating the axes again restores the Y values kept from before they were
 * linked, so the checkbox does not discard what the user had typed. A stage
 * edited while linked is absent from `keptY` and keeps the value it shows.
 */
export function unlinkAxes(stages: DpiStage[], keptY: Record<string, number>): DpiStage[] {
  return stages.map((stage) => {
    const y = keptY[stage.id];
    return y === undefined ? stage : { ...stage, y };
  });
}
