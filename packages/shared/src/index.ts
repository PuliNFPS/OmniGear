export type {
  ConnectionKind,
  ConnectionStatus,
  KeyboardPeripheral,
  MousePeripheral,
  Peripheral,
  PeripheralPhoto,
  PeripheralSettings,
  PeripheralType,
  ProfileSlot,
} from './peripheral';

export type {
  DpiCapability,
  DpiStage,
  MouseActionId,
  MouseButtonSpot,
  MouseCapabilities,
  MouseParameterCapabilities,
  MouseParameterId,
  MouseParameters,
  MousePerformanceMode,
  MouseRPlusCapability,
  MouseRPlusSettings,
  MouseSettings,
  NumericParameterRange,
} from './mouse';

export type {
  KeyboardAction,
  KeyboardCapabilities,
  KeyboardKeySpot,
  KeyboardSettings,
  LightingCapabilities,
  LightingEffect,
  LightingSettings,
} from './keyboard';

export interface HidCommand {
  reportId: number;
  data: Uint8Array;
}
