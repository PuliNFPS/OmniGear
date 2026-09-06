import type { MouseCapabilities, MouseSettings } from './mouse';
import type { KeyboardCapabilities, KeyboardSettings } from './keyboard';

export type PeripheralType = 'mouse' | 'keyboard';

/** How the peripheral reaches the computer, as shown in the device header. */
export type ConnectionKind = 'usb' | 'sem-fio' | 'bluetooth';

export type ConnectionStatus = 'conectado' | 'desconectado';

/**
 * Photo of the model, shown in place of a drawing. `aspect` keeps the box that
 * holds it in the shape of the file, so the hotspots stay over their controls.
 */
export interface PeripheralPhoto {
  src: string;
  /** Width divided by height of the file. */
  aspect: number;
  /** Where the key grid sits on the photo, in percentages. Keyboards only. */
  keyGrid?: { left: number; top: number; unitX: number; unitY: number };
}

/** A profile slot on the device. `settings` is null while the slot is empty. */
export interface ProfileSlot<TSettings> {
  index: number;
  name: string;
  settings: TSettings | null;
}

interface PeripheralBase<TType extends PeripheralType, TCapabilities, TSettings> {
  id: string;
  type: TType;
  name: string;
  manufacturer: string;
  connection: ConnectionKind;
  status: ConnectionStatus;
  /** Null when the device does not report a firmware version. */
  firmware: string | null;
  /** Simulated device: never present its data as a hardware measurement. */
  demo: boolean;
  /** Percentage, or null when the device has no battery or does not report it. */
  battery: number | null;
  photo: PeripheralPhoto;
  capabilities: TCapabilities;
  /** Factory values reported by the device, used by "Restaurar padrões". */
  defaults: TSettings;
  profiles: ProfileSlot<TSettings>[];
  /** Slot index (1-based) currently in use on the device. */
  activeProfileSlot: number;
}

export type MousePeripheral = PeripheralBase<'mouse', MouseCapabilities, MouseSettings>;
export type KeyboardPeripheral = PeripheralBase<'keyboard', KeyboardCapabilities, KeyboardSettings>;

export type Peripheral = MousePeripheral | KeyboardPeripheral;
export type PeripheralSettings = MouseSettings | KeyboardSettings;
