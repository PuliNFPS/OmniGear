import type { MouseSettings } from '@gearhub/shared';

export interface RawmMouseParamState {
  resolution: number;
  pollingRate: number;
  light: number;
  cpiLevels: number[];
  onboard: number;
  powerMode: number;
  liftOffDistance: number;
  keyDelay: number[];
  motionSync: number;
  angleTuning: number;
  angleSnapping: number;
  rippleControl: number;
  cpiLevelColors: number[];
  txOutputPower: number;
  batteryLevels: number[];
  autoTxPower: number;
  onboardStatus: number[];
  glassMode: number;
}

const modeIds = new Map([
  ['office', 0],
  ['lp', 1],
  ['hp', 2],
  ['gaming-plus', 3],
]);

function integer(raw: Record<string, unknown>, key: string, min: number, max: number): number {
  const value = raw[key];
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw new Error(`Snapshot RAWM incompleto ou invalido: ${key}.`);
  }
  return value as number;
}

function integers(
  raw: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
  allowEmpty = false,
): number[] {
  const value = raw[key];
  // The firmware sends "" rather than [] for an unset calibration table.
  if (allowEmpty && value === '') return [];
  if (
    !Array.isArray(value) ||
    (!allowEmpty && value.length === 0) ||
    value.length > 255 ||
    value.some((item) => !Number.isInteger(item) || item < min || item > max)
  ) {
    throw new Error(`Snapshot RAWM incompleto ou invalido: ${key}.`);
  }
  return [...value];
}

function glassMode(raw: Record<string, unknown>): number {
  const value = raw.gm;
  if (Array.isArray(value)) {
    if (value.length < 2 || value.some((item) => !Number.isInteger(item))) {
      throw new Error('Snapshot RAWM incompleto ou invalido: gm.');
    }
    return value[1] ? 1 : 0;
  }
  return integer(raw, 'gm', 0, 1);
}

export function parseMouseParamState(raw: Record<string, unknown>): RawmMouseParamState {
  return {
    resolution: integer(raw, 'cpi', 1, 0xffffffff),
    pollingRate: integer(raw, 'polling', 1, 0xffff),
    light: integer(raw, 'light', 0, 0xff),
    // Unused DPI slots come back as zeros; the array is fixed width.
    cpiLevels: integers(raw, 'cpi_l', 0, 0xffffffff),
    onboard: integer(raw, 'ob', 0, 0xff),
    powerMode: integer(raw, 'pm', 0, 0xff),
    liftOffDistance: integer(raw, 'lod', 0, 0xff),
    keyDelay: integers(raw, 'kd', 0, 0xff),
    motionSync: integer(raw, 'ms', 0, 1),
    angleTuning: integer(raw, 'at', -128, 127),
    angleSnapping: integer(raw, 'as', 0, 1),
    rippleControl: integer(raw, 'rctrl', 0, 1),
    cpiLevelColors: integers(raw, 'cpi_l_c', 0, 7, true),
    txOutputPower: integer(raw, 'top', 0, 0xff),
    batteryLevels: integers(raw, 'co', 0, 0xffff, true),
    autoTxPower: integer(raw, 'atp', 0, 1),
    onboardStatus: integers(raw, 'ocs', 0, 0xff),
    glassMode: glassMode(raw),
  };
}

function pushU16(output: number[], value: number): void {
  output.push(value & 0xff, (value >>> 8) & 0xff);
}

function pushU32(output: number[], value: number): void {
  output.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function isPackedAxes(value: number): boolean {
  return value > 0xffff;
}

export function encodeMouseParamBody(state: RawmMouseParamState): Uint8Array {
  const output: number[] = [];
  const independentAxes = isPackedAxes(state.resolution) || state.cpiLevels.some(isPackedAxes);

  pushU16(output, independentAxes ? 0 : state.resolution);
  pushU16(output, state.pollingRate);
  output.push(state.light);
  output.push(independentAxes ? 0 : state.cpiLevels.length);
  if (!independentAxes) state.cpiLevels.forEach((value) => pushU16(output, value));
  output.push(state.onboard, state.powerMode);
  pushU32(output, independentAxes ? state.resolution : 0);
  output.push(independentAxes ? state.cpiLevels.length : 0);
  if (independentAxes) state.cpiLevels.forEach((value) => pushU32(output, value));
  output.push(state.liftOffDistance, state.keyDelay.length, ...state.keyDelay);
  output.push(
    state.motionSync,
    state.angleTuning & 0xff,
    state.angleSnapping,
    state.rippleControl,
    state.cpiLevelColors.length,
    ...state.cpiLevelColors.map((color) => color & 0x07),
    state.txOutputPower,
    state.batteryLevels.length,
  );
  state.batteryLevels.forEach((value) => pushU16(output, value));
  output.push(
    state.autoTxPower,
    state.onboardStatus.length,
    ...state.onboardStatus,
    state.glassMode,
  );
  return Uint8Array.from(output);
}

function packedDpi(x: number, y: number, independentAxes: boolean): number {
  return independentAxes ? ((x & 0xffff) | ((y & 0xffff) << 16)) >>> 0 : x;
}

/**
 * Restores the width the device reported. `cpi_l` is fixed width with unused
 * slots zeroed, and the editor only carries the populated stages, so a write
 * built from settings alone would narrow the array under the firmware and
 * leave it inconsistent with the same-width `cpi_l_c`.
 */
function padToWidth(values: number[], width: number): number[] {
  if (values.length >= width) return values;
  return [...values, ...Array<number>(width - values.length).fill(0)];
}

export function applySettingsToMouseParam(
  snapshot: RawmMouseParamState,
  settings: MouseSettings,
): RawmMouseParamState {
  const mode =
    settings.performanceMode === null ? undefined : modeIds.get(settings.performanceMode);
  if (mode === undefined) throw new Error('Modo de desempenho RAWM invalido.');
  const activeStage = settings.dpiStages.find((stage) => stage.id === settings.activeStageId);
  if (!activeStage || settings.dpiStages.length === 0 || settings.dpiStages.length > 255) {
    throw new Error('Configuracao de DPI RAWM invalida.');
  }

  return {
    ...snapshot,
    resolution: packedDpi(activeStage.x, activeStage.y, settings.independentAxes),
    pollingRate: settings.pollingRate,
    cpiLevels: padToWidth(
      settings.dpiStages.map((stage) => packedDpi(stage.x, stage.y, settings.independentAxes)),
      snapshot.cpiLevels.length,
    ),
    powerMode: mode,
    liftOffDistance: settings.parameters.liftOffDistance,
    motionSync: settings.parameters.motionSync ? 1 : 0,
    angleTuning: settings.parameters.sensorRotation,
    angleSnapping: settings.parameters.angleSnapping ? 1 : 0,
    rippleControl: settings.parameters.rippleControl ? 1 : 0,
    txOutputPower: settings.parameters.wirelessTurbo ? 0x08 : 0,
    keyDelay: [...snapshot.keyDelay],
    cpiLevelColors: [...snapshot.cpiLevelColors],
    batteryLevels: [...snapshot.batteryLevels],
    onboardStatus: [...snapshot.onboardStatus],
  };
}
