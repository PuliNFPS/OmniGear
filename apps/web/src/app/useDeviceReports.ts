import { useEffect } from 'react';
import type { Peripheral } from '@gearhub/shared';
import { driverFor } from '../hardware/deviceDriver';
import { useEditorStore } from '../store/editorStore';

/**
 * Keeps the editor in step with changes the mouse makes by itself.
 *
 * Cycling DPI with the button changes the device without the app asking, so
 * without this the screen keeps showing the stage the mouse already left.
 *
 * It lives here rather than in a store because deviceStore must not import
 * editorStore: the dependency already runs the other way.
 */
export function useDeviceReports(devices: Peripheral[]): void {
  useEffect(() => {
    const unsubscribers = devices.map((device) => {
      if (device.demo) return undefined;
      let driver;
      try {
        driver = driverFor(device);
      } catch {
        // A device listed before its driver is registered; nothing to follow.
        return undefined;
      }
      return driver.onDeviceReport?.((report) => {
        if (report.kind === 'dpi') {
          useEditorStore.getState().syncActiveDpi(device.id, report.value);
        }
      });
    });

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
  }, [devices]);
}
