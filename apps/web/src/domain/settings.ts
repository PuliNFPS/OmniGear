import type {
  ProfileSlot,
  KeyboardPeripheral,
  KeyboardSettings,
  MousePeripheral,
  MouseSettings,
  Peripheral,
  PeripheralSettings,
} from '@gearhub/shared';

/** Widens the slots of either device type to a single readable list. */
export function profileSlots(device: Peripheral): ProfileSlot<PeripheralSettings>[] {
  return device.profiles;
}

export function isMouseSettings(settings: unknown): settings is MouseSettings {
  return typeof settings === 'object' && settings !== null && 'dpiStages' in settings;
}

export function isKeyboardSettings(settings: unknown): settings is KeyboardSettings {
  return typeof settings === 'object' && settings !== null && 'keymap' in settings;
}

export function isMouse(device: Peripheral): device is MousePeripheral {
  return device.type === 'mouse';
}

export function isKeyboard(device: Peripheral): device is KeyboardPeripheral {
  return device.type === 'keyboard';
}

/** Settings the device is running: the active profile, or the factory values. */
export function activeSettings(device: Peripheral): PeripheralSettings {
  const slot = profileSlots(device).find((profile) => profile.index === device.activeProfileSlot);
  return slot?.settings ?? device.defaults;
}

export function activeProfileName(device: Peripheral): string {
  const slot = profileSlots(device).find((profile) => profile.index === device.activeProfileSlot);
  return slot && slot.name ? slot.name : `Slot ${device.activeProfileSlot}`;
}

/**
 * Writes settings into a profile slot, keeping the device type and its
 * settings consistent. A mismatch leaves the device untouched.
 */
export function withWrittenProfile(
  device: Peripheral,
  slotIndex: number,
  name: string,
  settings: PeripheralSettings,
): Peripheral {
  if (device.type === 'mouse' && isMouseSettings(settings)) {
    return {
      ...device,
      profiles: device.profiles.map((slot) =>
        slot.index === slotIndex ? { ...slot, name, settings } : slot,
      ),
    };
  }
  if (device.type === 'keyboard' && isKeyboardSettings(settings)) {
    return {
      ...device,
      profiles: device.profiles.map((slot) =>
        slot.index === slotIndex ? { ...slot, name, settings } : slot,
      ),
    };
  }
  return device;
}
