import { useEffect } from 'react';
import type { Peripheral } from '@gearhub/shared';
import { driverFor, type OnboardProfileReport } from '../hardware/deviceDriver';
import { settingsFromSlot } from '../hardware/rawm/onboardConfig';
import { useDeviceStore } from '../store/deviceStore';
import { useEditorStore } from '../store/editorStore';

/**
 * Keeps the editor in step with what the device says about itself.
 *
 * Two things arrive unasked. A DPI cycled with the button changes the device
 * without the app asking, so without this the screen keeps showing the stage
 * the mouse already left. And the mouse dumps the mappings each onboard slot
 * holds right after the connect query, which is the only way the app learns
 * what is really bound: everything it shows before that is its own assumption.
 *
 * It lives here rather than in a store because deviceStore must not import
 * editorStore: the dependency already runs the other way.
 */

/** Fills the profile list with what each onboard slot turned out to hold. */
function withOnboardProfiles(device: Peripheral, slots: OnboardProfileReport[]): Peripheral {
  if (device.type !== 'mouse') return device;
  const bySlotIndex = new Map(slots.map((slot) => [slot.index + 1, slot]));
  return {
    ...device,
    profiles: device.profiles.map((profile) => {
      const slot = bySlotIndex.get(profile.index);
      if (!slot) return profile;
      return { ...profile, settings: settingsFromSlot(device.defaults, slot) };
    }),
  };
}

export function useDeviceReports(devices: Peripheral[]): void {
  useEffect(() => {
    const unsubscribers = devices.flatMap((device) => {
      if (device.demo) return [];
      let driver;
      try {
        driver = driverFor(device);
      } catch {
        // A device listed before its driver is registered; nothing to follow.
        return [];
      }

      const followDpi = driver.onDeviceReport?.((report) => {
        if (report.kind === 'dpi') {
          useEditorStore.getState().syncActiveDpi(device.id, report.value);
        }
      });

      const followProfiles = driver.onOnboardProfiles?.((slots) => {
        const store = useDeviceStore.getState();
        store.updateDevice(device.id, (current) => withOnboardProfiles(current, slots));
        const updated = useDeviceStore.getState().devices.find((item) => item.id === device.id);
        const active = updated?.profiles.find(
          (profile) => profile.index === updated.activeProfileSlot,
        );
        if (active?.settings) useEditorStore.getState().rebase(device.id, active.settings);
      });

      return [followDpi, followProfiles];
    });

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
  }, [devices]);
}
