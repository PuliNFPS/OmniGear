import type {
  MouseActionId,
  MouseButtonSpot,
  MouseParameterCapabilities,
  MousePerformanceMode,
  MousePeripheral,
  MouseSettings,
} from '@gearhub/shared';
import { createRPlusSettings } from '../../domain/mouseCapabilities';

export const RAWM_VENDOR_ID = 0x1915;
export const LEVIATHAN_V4_RECEIVER_PRODUCT_ID = 0x2346;
export const RAWM_CONFIG_USAGE_PAGE = 0xff00;
export const RAWM_CONFIG_USAGE = 0x0001;

const leviathanV4PerformanceModes: MousePerformanceMode[] = [
  { id: 'office', label: 'Office' },
  { id: 'lp', label: 'LP' },
  { id: 'hp', label: 'HP' },
  { id: 'gaming-plus', label: 'Gaming+' },
];

const leviathanV4ParameterCapabilities: MouseParameterCapabilities = {
  motionSync: true,
  angleSnapping: true,
  rippleControl: true,
  wirelessTurbo: true,
  liftOffDistance: { min: 1, max: 3, step: 1 },
  sensorRotation: { min: -30, max: 30, step: 1 },
};

const buttons: MouseButtonSpot[] = [
  { id: 'esquerdo', label: 'Clique esquerdo', position: { x: 0.28, y: 0.25 }, callout: 'esquerda' },
  { id: 'direito', label: 'Clique direito', position: { x: 0.72, y: 0.25 }, callout: 'direita' },
  { id: 'central', label: 'Clique central', position: { x: 0.5, y: 0.18 }, callout: 'direita' },
  {
    id: 'lateral-traseiro',
    label: 'Lateral traseiro',
    position: { x: 0.12, y: 0.48 },
    callout: 'esquerda',
  },
  {
    id: 'lateral-dianteiro',
    label: 'Lateral dianteiro',
    position: { x: 0.12, y: 0.39 },
    callout: 'esquerda',
  },
  { id: 'dpi', label: 'Botão de DPI', position: { x: 0.5, y: 0.84 }, callout: 'direita' },
];

const actions: MouseActionId[] = [
  'clique-esquerdo',
  'clique-direito',
  'clique-central',
  'voltar',
  'avancar',
  'dpi-ciclo',
  'dpi-aumentar',
  'dpi-diminuir',
  'rolagem-cima',
  'rolagem-baixo',
  'desativado',
];

function finiteNumber(raw: Record<string, unknown>, key: string): number {
  const value = raw[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Consulta RAWM incompleta: ${key}.`);
  }
  return value;
}

function numericArray(raw: Record<string, unknown>, key: string): number[] {
  const value = raw[key];
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== 'number')
  ) {
    throw new Error(`Consulta RAWM incompleta: ${key}.`);
  }
  return value;
}

function performanceMode(rawMode: number): string {
  return leviathanV4PerformanceModes[rawMode]?.id ?? 'office';
}

/**
 * Onboard slots: `ocs` carries one status byte per slot and `ocn` states how
 * many. Both agreed on the captured firmware. If they ever disagree, fall back
 * to a single slot rather than sizing the profiles UI on a guess.
 *
 * `st` used to be read as this array; on real firmware it is the scalar 60.
 */
function onboardSlotCount(raw: Record<string, unknown>): number {
  const statuses = raw.ocs;
  if (!Array.isArray(statuses) || statuses.length === 0) return 1;
  const declared = raw.ocn;
  if (typeof declared === 'number' && declared !== statuses.length) return 1;
  return Math.min(statuses.length, 16);
}

export function createLeviathanV4Peripheral(
  raw: Record<string, unknown>,
  id: string,
): MousePeripheral {
  const name = typeof raw.dn === 'string' && raw.dn.trim() ? raw.dn.trim() : 'Leviathan V4';
  // Unused DPI slots are reported as zeros in a fixed-width array. The snapshot
  // parser keeps them for the round trip; the UI only shows populated stages.
  const dpiLevels = numericArray(raw, 'cpi_l').filter((level) => level > 0);
  const activeDpi = finiteNumber(raw, 'cpi');
  const pollingRate = finiteNumber(raw, 'polling');
  const onboardIndex = finiteNumber(raw, 'ob');
  const rawMode = finiteNumber(raw, 'pm');
  const lod = finiteNumber(raw, 'lod');
  const angleTuning = finiteNumber(raw, 'at');
  for (const key of ['ms', 'as', 'rctrl', 'top']) finiteNumber(raw, key);
  const activeIndex = Math.max(0, dpiLevels.indexOf(activeDpi));
  const buttonIds = buttons.map((button) => button.id);
  const rPlus = createRPlusSettings(buttonIds, 'lateral-dianteiro');
  const settings: MouseSettings = {
    buttons: {
      esquerdo: 'clique-esquerdo',
      direito: 'clique-direito',
      central: 'clique-central',
      'lateral-traseiro': 'voltar',
      'lateral-dianteiro': 'avancar',
      dpi: 'dpi-ciclo',
    },
    dpiStages: dpiLevels.map((dpi, index) => ({ id: `estagio-${index + 1}`, x: dpi, y: dpi })),
    activeStageId: `estagio-${activeIndex + 1}`,
    independentAxes: false,
    pollingRate,
    performanceMode: performanceMode(rawMode),
    parameters: {
      motionSync: raw.ms === 1,
      angleSnapping: raw.as === 1,
      rippleControl: raw.rctrl === 1,
      wirelessTurbo: raw.top === 8,
      liftOffDistance: lod,
      sensorRotation: angleTuning,
      debounce: 0,
      sleepTimeout: 1,
    },
    rPlus,
  };
  const profileCount = onboardSlotCount(raw);
  const activeProfileSlot = Math.min(profileCount, Math.max(1, onboardIndex + 1));

  return {
    id,
    type: 'mouse',
    name,
    manufacturer: 'RAWM',
    connection: 'sem-fio',
    status: 'conectado',
    firmware: typeof raw.r === 'string' || typeof raw.r === 'number' ? String(raw.r) : null,
    demo: false,
    battery:
      typeof raw.battery === 'number' && raw.battery >= 0 && raw.battery <= 100
        ? raw.battery
        : null,
    photo: { src: '/dispositivos/leviathan-v4.svg', aspect: 0.58 },
    capabilities: {
      dpi: {
        min: Math.min(...dpiLevels),
        max: Math.max(...dpiLevels),
        step: 50,
        minStages: 1,
        maxStages: 8,
        independentAxes: false,
      },
      pollingRates: [125, 250, 500, 1000, 2000, 4000, 8000],
      performanceModes: leviathanV4PerformanceModes,
      buttons,
      actions,
      parameters: leviathanV4ParameterCapabilities,
      rPlus: { activatorButtonIds: ['lateral-traseiro', 'lateral-dianteiro', 'dpi'] },
      profileSlots: profileCount,
    },
    defaults: structuredClone(settings),
    profiles: Array.from({ length: profileCount }, (_, index) => ({
      index: index + 1,
      name: `Perfil ${index + 1}`,
      settings: index + 1 === activeProfileSlot ? structuredClone(settings) : null,
    })),
    activeProfileSlot,
  };
}
