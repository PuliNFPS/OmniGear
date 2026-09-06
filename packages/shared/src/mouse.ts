/** Actions a physical mouse button can be assigned to. */
export type MouseActionId =
  | 'clique-esquerdo'
  | 'clique-direito'
  | 'clique-central'
  | 'voltar'
  | 'avancar'
  | 'dpi-ciclo'
  | 'dpi-aumentar'
  | 'dpi-diminuir'
  | 'rolagem-cima'
  | 'rolagem-baixo'
  | 'desativado';

/**
 * A physical button of the model, with the position used to place its hotspot
 * over the device drawing. Coordinates are fractions of the drawing box.
 */
export interface MouseButtonSpot {
  id: string;
  label: string;
  position: { x: number; y: number };
  /** Side the callout label is anchored to. */
  callout: 'esquerda' | 'direita';
  /** Actions this button accepts; omit to accept every supported action. */
  actions?: MouseActionId[];
}

export interface DpiCapability {
  min: number;
  max: number;
  step: number;
  minStages: number;
  maxStages: number;
  independentAxes: boolean;
}

export interface NumericParameterRange {
  min: number;
  max: number;
  step: number;
}

export interface MousePerformanceMode {
  id: string;
  label: string;
  description?: string;
}

export interface MouseRPlusCapability {
  /** Physical buttons that the model permits as the R-Plus activator. */
  activatorButtonIds: string[];
}

/**
 * Only the parameters present here are supported by the model, and only those
 * are rendered. Each entry carries the limits the controls must respect.
 */
export interface MouseParameterCapabilities {
  motionSync?: true;
  angleSnapping?: true;
  rippleControl?: true;
  wirelessTurbo?: true;
  /** Tracking height, in millimetres. */
  liftOffDistance?: NumericParameterRange;
  /** Sensor rotation, in degrees. */
  sensorRotation?: NumericParameterRange;
  /** Debounce delay options, in milliseconds. */
  debounce?: { options: number[] };
  /** Sleep timeout options, in minutes. */
  sleepTimeout?: { options: number[] };
}

export interface MouseCapabilities {
  dpi: DpiCapability;
  pollingRates: number[];
  /** Sensor power modes supported by this model, in display order. */
  performanceModes?: MousePerformanceMode[];
  buttons: MouseButtonSpot[];
  /** Actions offered by this model when a button does not restrict them. */
  actions: MouseActionId[];
  parameters: MouseParameterCapabilities;
  rPlus?: MouseRPlusCapability;
  profileSlots: number;
}

export interface DpiStage {
  id: string;
  x: number;
  y: number;
}

export interface MouseParameters {
  motionSync: boolean;
  angleSnapping: boolean;
  rippleControl: boolean;
  wirelessTurbo: boolean;
  liftOffDistance: number;
  sensorRotation: number;
  debounce: number;
  sleepTimeout: number;
}

export interface MouseRPlusSettings {
  activatorButtonId: string;
  buttons: Record<string, MouseActionId>;
}

export type MouseParameterId = keyof MouseParameters;

export interface MouseSettings {
  /** Button id to assigned action. */
  buttons: Record<string, MouseActionId>;
  dpiStages: DpiStage[];
  activeStageId: string;
  independentAxes: boolean;
  pollingRate: number;
  /** Null for models without selectable sensor power modes. */
  performanceMode: string | null;
  parameters: MouseParameters;
  /** Null for models without an R-Plus secondary layer. */
  rPlus: MouseRPlusSettings | null;
}
