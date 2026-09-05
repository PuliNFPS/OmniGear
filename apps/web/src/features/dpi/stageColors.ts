import type { DpiStageColor } from '@gearhub/shared';

/** As cinco identidades cromáticas do app. Nenhuma delas colide com o vermelho de perigo. */
export const STAGE_ORDER: DpiStageColor[] = ['green', 'cyan', 'blue', 'violet', 'magenta'];

const CLASSES: Record<DpiStageColor, string> = {
  green: 'bg-stage-green',
  cyan: 'bg-stage-cyan',
  blue: 'bg-stage-blue',
  violet: 'bg-stage-violet',
  magenta: 'bg-stage-magenta',
};

export function stageColorClass(color: DpiStageColor): string {
  return CLASSES[color];
}

export function nextStageColor(used: DpiStageColor[]): DpiStageColor {
  return STAGE_ORDER.find((color) => !used.includes(color)) ?? 'green';
}
