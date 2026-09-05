/** Identifica qual silhueta o registry de render deve desenhar. */
export type MouseRenderId = 'generic-5button' | 'generic-7button';

export interface MouseButton {
  id: string;
  label: string;
  /** Normalizado 0..1 no viewBox do render. */
  hotspot: { x: number; y: number };
  remappable: boolean;
}

export interface ParameterCapabilities {
  motionSync?: boolean;
  straightLineCorrection?: boolean;
  rippleCorrection?: boolean;
  longRangeMode?: boolean;
  debounceMs?: { supported: number[] };
  sleepMinutes?: { supported: number[] };
  lod?: { min: number; max: number; step: number };
  sensorRotation?: { min: number; max: number; step: number };
}

export interface MouseCapabilities {
  dpi: { min: number; max: number; step: number; maxStages: number; independentXY: boolean };
  /**
   * `runtimeHours` mapeia cada polling rate suportado para a faixa de autonomia
   * declarada pelo fabricante. Sem esse dado a tela de Performance não exibe
   * estimativa — ela nunca calcula um número por conta própria.
   */
  pollingRate: { supported: number[]; runtimeHours?: Record<number, [number, number]> };
  buttons: MouseButton[];
  parameters: ParameterCapabilities;
  profiles: { onboardSlots: number };
  battery: boolean;
  renderId: MouseRenderId;
}
