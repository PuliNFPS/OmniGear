import type { MousePeripheral } from '@gearhub/shared';

export function mouseFeatureVisibility(device: MousePeripheral) {
  return {
    performanceModes: (device.capabilities.performanceModes?.length ?? 0) > 0,
    wirelessTurbo: device.capabilities.parameters.wirelessTurbo === true,
    rPlus: (device.capabilities.rPlus?.activatorButtonIds.length ?? 0) > 0,
  };
}
