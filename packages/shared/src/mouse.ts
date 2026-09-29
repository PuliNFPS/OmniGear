import type { DpiStage } from './generated/DpiStage';
import type { MouseActionId } from './generated/MouseActionId';
import type { MouseParameters } from './generated/MouseParameters';
import type { MouseRPlusSettings } from './generated/MouseRPlusSettings';
import type { MouseSettings } from './generated/MouseSettings';

/**
 * Actions a physical mouse button can be assigned to. Generated from the core's
 * `MouseActionId` enum; `cargo test` fails when the two diverge.
 */
export type { MouseActionId };

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

/**
 * The editor's configuration. Generated from the core's `device/settings.rs`;
 * `cargo test` fails when the two diverge.
 */
export type { DpiStage, MouseParameters, MouseRPlusSettings, MouseSettings };

export type MouseParameterId = keyof MouseParameters;
