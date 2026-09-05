export type DpiStageColor = 'green' | 'cyan' | 'blue' | 'violet' | 'magenta';

export interface DpiStage {
  id: string;
  x: number;
  y: number;
  color: DpiStageColor;
}

export type ButtonAction =
  | { kind: 'button'; button: 'left' | 'right' | 'middle' | 'back' | 'forward' }
  | { kind: 'dpi'; mode: 'cycle' | 'shift' | 'up' | 'down' }
  | { kind: 'keystroke'; keys: string[] }
  | { kind: 'scroll'; direction: 'up' | 'down' }
  | { kind: 'disabled' }
  /** Reservado. Nenhuma UI no v1. */
  | { kind: 'macro'; macroId: string };

export interface MouseParameters {
  motionSync: boolean;
  straightLineCorrection: boolean;
  rippleCorrection: boolean;
  longRangeMode: boolean;
  debounceMs: number;
  sleepMinutes: number;
  lodMm: number;
  sensorRotationDeg: number;
}

export interface MouseProfile {
  name: string;
  dpi: { stages: DpiStage[]; activeStageId: string; independentXY: boolean };
  pollingRate: number;
  /** buttonId → ação. As chaves vêm de `MouseCapabilities.buttons[].id`. */
  bindings: Record<string, ButtonAction>;
  parameters: MouseParameters;
}
