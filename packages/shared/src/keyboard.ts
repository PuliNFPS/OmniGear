/**
 * A physical key of the model. `row`, `x` and `width` are keyboard units
 * (1 unit = one standard key), used to draw the preview and place hotspots.
 */
export interface KeyboardKeySpot {
  id: string;
  label: string;
  row: number;
  x: number;
  width: number;
  /** Extra space above the row, in units, such as under a function row. */
  topGap?: number;
  /** Extra gap before the key, in units. */
  gap?: number;
  /** Keys such as Fn that the model does not allow remapping. */
  remappable?: false;
}

/** An assignment offered when remapping a key. */
export interface KeyboardAction {
  id: string;
  label: string;
  group: string;
}

export interface LightingEffect {
  id: string;
  label: string;
  description: string;
  /** Animated effects use the speed control; static ones disable it. */
  animated: boolean;
  /** Effects that ignore the color control, such as a spectrum cycle. */
  usesColor: boolean;
}

export interface LightingCapabilities {
  effects: LightingEffect[];
  color: boolean;
  brightness: boolean;
  speed: boolean;
}

export interface KeyboardCapabilities {
  keys: KeyboardKeySpot[];
  /** Assignments offered when remapping, grouped for the picker. */
  actions: KeyboardAction[];
  /** Absent when the model has no lighting. */
  lighting?: LightingCapabilities;
  profileSlots: number;
}

export interface LightingSettings {
  enabled: boolean;
  effectId: string;
  /** Hex color used by effects that accept one. */
  color: string;
  /** Percentage. */
  brightness: number;
  /** Percentage. */
  speed: number;
}

export interface KeyboardSettings {
  /** Physical key id to assigned action id. */
  keymap: Record<string, string>;
  lighting: LightingSettings;
}
