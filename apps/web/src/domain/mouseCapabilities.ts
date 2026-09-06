import type { MouseActionId, MouseRPlusSettings } from '@gearhub/shared';

export function createRPlusSettings(
  buttonIds: string[],
  activatorButtonId: string,
): MouseRPlusSettings {
  return {
    activatorButtonId,
    buttons: Object.fromEntries(buttonIds.map((buttonId) => [buttonId, 'desativado'])),
  };
}

export function assignRPlusAction(
  settings: MouseRPlusSettings,
  buttonId: string,
  action: MouseActionId,
): MouseRPlusSettings {
  if (buttonId === settings.activatorButtonId) return settings;
  return { ...settings, buttons: { ...settings.buttons, [buttonId]: action } };
}

export function selectRPlusActivator(
  settings: MouseRPlusSettings,
  activatorButtonId: string,
): MouseRPlusSettings {
  return {
    activatorButtonId,
    buttons: { ...settings.buttons, [activatorButtonId]: 'desativado' },
  };
}
