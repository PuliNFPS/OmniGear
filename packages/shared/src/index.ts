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

export type { LeviathanV4Description } from './generated/LeviathanV4Description';
export type { LeviathanV4Usb } from './generated/LeviathanV4Usb';
export type { OnboardBinding } from './generated/OnboardBinding';
export type { OnboardSlotConfig } from './generated/OnboardSlotConfig';
export type { RawmMouseParamState } from './generated/RawmMouseParamState';

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
