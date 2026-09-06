import type {
  KeyboardPeripheral,
  KeyboardSettings,
  MousePeripheral,
  MouseSettings,
  Peripheral,
  PeripheralSettings,
  PeripheralType,
} from '@gearhub/shared';
import { validateDpi } from './dpi';

const PROFILE_FILE_FORMAT = 'omnigear-perfil';
const PROFILE_FILE_VERSION = 1;

export interface ProfileFile {
  formato: string;
  versao: number;
  tipo: PeripheralType;
  dispositivo: string;
  perfil: string;
  ajustes: PeripheralSettings;
}

export type ProfileFileCheck = { ok: true; file: ProfileFile } | { ok: false; message: string };

const INCOMPATIBLE = 'O arquivo não é compatível com este dispositivo.';

export function buildProfileFile(
  device: Peripheral,
  profileName: string,
  settings: PeripheralSettings,
): ProfileFile {
  return {
    formato: PROFILE_FILE_FORMAT,
    versao: PROFILE_FILE_VERSION,
    tipo: device.type,
    dispositivo: device.name,
    perfil: profileName,
    ajustes: structuredClone(settings),
  };
}

const COMBINING_MARKS = /\p{M}/gu;

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function profileFileName(device: Peripheral, profileName: string): string {
  return `omnigear-${slug(device.name)}-${slug(profileName) || 'perfil'}.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Adds fields introduced while profile format v1 was already in use. */
function migrateMouseV1(settings: Record<string, unknown>): Record<string, unknown> {
  const migrated = structuredClone(settings);
  if (!('performanceMode' in migrated)) migrated.performanceMode = null;
  if (!('rPlus' in migrated)) migrated.rPlus = null;
  if (isRecord(migrated.parameters)) {
    const parameters = { ...migrated.parameters };
    if (!('wirelessTurbo' in parameters)) parameters.wirelessTurbo = false;
    // "Alcance estendido" was a mislabeled, unverified field. Never migrate it
    // into radio turbo, because that would enable a materially different mode.
    delete parameters.extendedRange;
    migrated.parameters = parameters;
  }
  return migrated;
}

/** Mouse settings only fit a device that supports every value they carry. */
function mouseFits(settings: unknown, device: MousePeripheral): settings is MouseSettings {
  if (
    !isRecord(settings) ||
    !Array.isArray(settings.dpiStages) ||
    !isRecord(settings.buttons) ||
    !isRecord(settings.parameters)
  )
    return false;
  const { dpi, pollingRates, buttons, actions, parameters, performanceModes, rPlus } =
    device.capabilities;
  const assignments = settings.buttons;
  const values = settings.parameters;
  const performanceModeValid = performanceModes
    ? typeof settings.performanceMode === 'string' &&
      performanceModes.some((mode) => mode.id === settings.performanceMode)
    : settings.performanceMode === device.defaults.performanceMode;
  const rPlusValue = settings.rPlus;
  const rPlusButtons =
    isRecord(rPlusValue) && isRecord(rPlusValue.buttons) ? rPlusValue.buttons : null;
  const rPlusActivator = isRecord(rPlusValue) ? rPlusValue.activatorButtonId : null;
  const rPlusValid = rPlus
    ? isRecord(rPlusValue) &&
      typeof rPlusActivator === 'string' &&
      rPlus.activatorButtonIds.includes(rPlusActivator) &&
      rPlusButtons !== null &&
      Object.keys(rPlusButtons).length === buttons.length &&
      buttons.every((button) => {
        const action = rPlusButtons[button.id];
        if (button.id === rPlusActivator) return action === 'desativado';
        return (button.actions ?? actions).some((supported) => supported === action);
      })
    : rPlusValue === device.defaults.rPlus;
  const validParameters = Object.entries(device.defaults.parameters).every(([id, fallback]) => {
    const value = values[id];
    const capability = parameters[id as keyof typeof parameters];
    if (typeof fallback === 'boolean')
      return typeof value === 'boolean' && (capability === true || value === fallback);
    if (!finite(value)) return false;
    if (!capability || capability === true) return value === fallback;
    if ('options' in capability) return capability.options.includes(value);
    const steps = (value - capability.min) / capability.step;
    return (
      value >= capability.min &&
      value <= capability.max &&
      Math.abs(steps - Math.round(steps)) < 1e-8
    );
  });
  return (
    typeof settings.independentAxes === 'boolean' &&
    (!settings.independentAxes || dpi.independentAxes) &&
    settings.dpiStages.length >= dpi.minStages &&
    settings.dpiStages.length <= dpi.maxStages &&
    settings.dpiStages.every(
      (stage: unknown) =>
        isRecord(stage) &&
        typeof stage.id === 'string' &&
        stage.id.length > 0 &&
        finite(stage.x) &&
        finite(stage.y) &&
        validateDpi(stage.x, dpi).valid &&
        validateDpi(stage.y, dpi).valid &&
        (settings.independentAxes || stage.x === stage.y),
    ) &&
    new Set(settings.dpiStages.map((stage) => stage.id)).size === settings.dpiStages.length &&
    settings.dpiStages.some((stage) => stage.id === settings.activeStageId) &&
    finite(settings.pollingRate) &&
    pollingRates.includes(settings.pollingRate) &&
    performanceModeValid &&
    Object.keys(assignments).length === buttons.length &&
    buttons.every((button) =>
      (button.actions ?? actions).some((action) => action === assignments[button.id]),
    ) &&
    validParameters &&
    rPlusValid
  );
}

function keyboardFits(settings: unknown, device: KeyboardPeripheral): settings is KeyboardSettings {
  if (!isRecord(settings) || !isRecord(settings.keymap) || !isRecord(settings.lighting))
    return false;
  const { keys, lighting, actions } = device.capabilities;
  const keyIds = new Set(keys.filter((key) => key.remappable !== false).map((key) => key.id));
  const actionIds = new Set(actions.map((action) => action.id));
  const light = settings.lighting;
  return (
    Object.entries(settings.keymap).every(
      ([id, action]) => keyIds.has(id) && typeof action === 'string' && actionIds.has(action),
    ) &&
    typeof light.enabled === 'boolean' &&
    typeof light.effectId === 'string' &&
    typeof light.color === 'string' &&
    /^#[0-9a-f]{6}$/i.test(light.color) &&
    finite(light.brightness) &&
    light.brightness >= 0 &&
    light.brightness <= 100 &&
    finite(light.speed) &&
    light.speed >= 0 &&
    light.speed <= 100 &&
    (lighting
      ? lighting.effects.some((effect) => effect.id === light.effectId)
      : Object.entries(device.defaults.lighting).every(([id, value]) => light[id] === value))
  );
}

/** Validates format, version and compatibility before anything is replaced. */
export function readProfileFile(raw: unknown, device: Peripheral): ProfileFileCheck {
  if (!isRecord(raw) || raw.formato !== PROFILE_FILE_FORMAT || !isRecord(raw.ajustes)) {
    return { ok: false, message: 'O arquivo não é um perfil do OmniGear.' };
  }
  if (raw.versao !== PROFILE_FILE_VERSION) {
    return { ok: false, message: 'O arquivo foi criado em outra versão do OmniGear.' };
  }
  if (raw.tipo !== device.type) {
    return { ok: false, message: INCOMPATIBLE };
  }

  const settings = device.type === 'mouse' ? migrateMouseV1(raw.ajustes) : raw.ajustes;
  const accepted = (ajustes: PeripheralSettings): ProfileFileCheck => ({
    ok: true,
    file: {
      formato: PROFILE_FILE_FORMAT,
      versao: PROFILE_FILE_VERSION,
      tipo: device.type,
      dispositivo: typeof raw.dispositivo === 'string' ? raw.dispositivo : device.name,
      perfil: typeof raw.perfil === 'string' ? raw.perfil : '',
      ajustes,
    },
  });

  if (device.type === 'mouse') {
    return mouseFits(settings, device) ? accepted(settings) : { ok: false, message: INCOMPATIBLE };
  }
  return keyboardFits(settings, device) ? accepted(settings) : { ok: false, message: INCOMPATIBLE };
}
