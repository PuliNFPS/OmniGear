import type { MouseButtonSpot, MousePeripheral } from '@gearhub/shared';
import { describeLeviathanV4 } from '../../core/coreBridge';

/** Rótulos de tela dos modos; os ids e a ordem vêm do núcleo. */
const performanceModeLabels: Record<string, string> = {
  office: 'Office',
  lp: 'LP',
  hp: 'HP',
  'gaming-plus': 'Gaming+',
};

/**
 * Positions are fractions of the photo, which is cropped to the mouse itself:
 * any transparent margin would shift every marker away from its button.
 *
 * Read off the 213x420 render. The wheel sits at the top centre and the click
 * pads either side of it. The side buttons are flush with the body, so the
 * silhouette does not show them; the seam between them is a brightness spike at
 * y 0.447, and they straddle it. The DPI key is underneath, where a top view
 * cannot show it, so its marker sits low on the body by convention.
 */
const buttons: MouseButtonSpot[] = [
  { id: 'esquerdo', label: 'Clique esquerdo', position: { x: 0.28, y: 0.2 }, callout: 'esquerda' },
  { id: 'direito', label: 'Clique direito', position: { x: 0.72, y: 0.2 }, callout: 'direita' },
  { id: 'central', label: 'Clique central', position: { x: 0.5, y: 0.19 }, callout: 'direita' },
  {
    id: 'lateral-traseiro',
    label: 'Lateral traseiro',
    position: { x: 0.04, y: 0.48 },
    callout: 'esquerda',
  },
  {
    id: 'lateral-dianteiro',
    label: 'Lateral dianteiro',
    position: { x: 0.04, y: 0.42 },
    callout: 'esquerda',
  },
  { id: 'dpi', label: 'Botão de DPI', position: { x: 0.5, y: 0.78 }, callout: 'direita' },
];

/**
 * Compõe o periférico: o núcleo diz o que o aparelho é e em que estado está
 * (`describeLeviathanV4`); este arquivo acrescenta só o desenho — a foto, as
 * posições dos botões e os rótulos.
 */
export function createLeviathanV4Peripheral(
  raw: Record<string, unknown>,
  id: string,
): MousePeripheral {
  const description = describeLeviathanV4(raw);
  const settings = description.defaults;

  return {
    id,
    type: 'mouse',
    name: description.name,
    manufacturer: 'RAWM',
    connection: 'sem-fio',
    status: 'conectado',
    firmware: description.firmware,
    demo: false,
    battery: description.battery,
    photo: { src: '/dispositivos/leviathan-v4.png', aspect: 213 / 420 },
    capabilities: {
      dpi: description.dpi,
      pollingRates: description.pollingRates,
      performanceModes: description.performanceModes.map((mode) => ({
        id: mode,
        label: performanceModeLabels[mode] ?? mode,
      })),
      buttons,
      actions: description.actions,
      parameters: {
        motionSync: true,
        angleSnapping: true,
        rippleControl: true,
        wirelessTurbo: true,
        liftOffDistance: description.liftOffDistance,
        sensorRotation: description.sensorRotation,
      },
      rPlus: { activatorButtonIds: description.rPlusActivatorButtonIds },
      profileSlots: description.profileSlots,
    },
    defaults: structuredClone(settings),
    profiles: Array.from({ length: description.profileSlots }, (_, index) => ({
      index: index + 1,
      // The mouse reports no slot names, so this is the app's own label. It
      // follows the vendor hub's "Onboard Memory 1-4" rather than inventing a
      // separate vocabulary for the same four slots.
      name: `Memória ${index + 1}`,
      settings: structuredClone(settings),
      initial: index + 1 !== description.activeProfileSlot,
    })),
    activeProfileSlot: description.activeProfileSlot,
    liveDpi: description.liveDpi,
  };
}
