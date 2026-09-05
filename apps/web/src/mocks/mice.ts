import type { MouseCapabilities, MouseProfile, MouseTelemetry } from '@gearhub/shared';

export interface MockMouse {
  id: string;
  name: string;
  manufacturer: string;
  capabilities: MouseCapabilities;
  telemetry: MouseTelemetry;
  slots: (MouseProfile | null)[];
}

const vanguardProfile: MouseProfile = {
  name: 'Competitive',
  dpi: {
    stages: [
      { id: 's1', x: 400, y: 400, color: 'green' },
      { id: 's2', x: 800, y: 800, color: 'cyan' },
      { id: 's3', x: 1600, y: 1600, color: 'blue' },
      { id: 's4', x: 3200, y: 3200, color: 'violet' },
    ],
    activeStageId: 's2',
    independentXY: false,
  },
  pollingRate: 1000,
  bindings: {
    left: { kind: 'button', button: 'left' },
    right: { kind: 'button', button: 'right' },
    middle: { kind: 'button', button: 'middle' },
    back: { kind: 'button', button: 'back' },
    forward: { kind: 'dpi', mode: 'cycle' },
  },
  parameters: {
    motionSync: true,
    straightLineCorrection: false,
    rippleCorrection: false,
    longRangeMode: false,
    debounceMs: 1,
    sleepMinutes: 5,
    lodMm: 1.5,
    sensorRotationDeg: 0,
  },
};

const scoutProfile: MouseProfile = {
  name: 'Daily',
  dpi: {
    stages: [
      { id: 's1', x: 800, y: 800, color: 'green' },
      { id: 's2', x: 1600, y: 1600, color: 'magenta' },
    ],
    activeStageId: 's1',
    independentXY: false,
  },
  pollingRate: 1000,
  bindings: {
    left: { kind: 'button', button: 'left' },
    right: { kind: 'button', button: 'right' },
    middle: { kind: 'button', button: 'middle' },
  },
  parameters: {
    motionSync: false,
    straightLineCorrection: false,
    rippleCorrection: false,
    longRangeMode: false,
    debounceMs: 2,
    sleepMinutes: 10,
    lodMm: 2,
    sensorRotationDeg: 0,
  },
};

export const mockMice: MockMouse[] = [
  {
    id: 'mock-vanguard',
    name: 'Vanguard 8K',
    manufacturer: 'OmniGear',
    capabilities: {
      dpi: { min: 100, max: 26_000, step: 50, maxStages: 5, independentXY: true },
      pollingRate: {
        supported: [125, 500, 1000, 4000, 8000],
        runtimeHours: {
          125: [70, 90],
          500: [58, 70],
          1000: [45, 56],
          4000: [32, 40],
          8000: [27, 34],
        },
      },
      buttons: [
        { id: 'left', label: 'Botão esquerdo', hotspot: { x: 0.27, y: 0.19 }, remappable: false },
        { id: 'right', label: 'Botão direito', hotspot: { x: 0.73, y: 0.19 }, remappable: true },
        { id: 'middle', label: 'Botão do meio', hotspot: { x: 0.5, y: 0.18 }, remappable: true },
        { id: 'back', label: 'Lateral traseiro', hotspot: { x: 0.12, y: 0.38 }, remappable: true },
        {
          id: 'forward',
          label: 'Lateral dianteiro',
          hotspot: { x: 0.12, y: 0.47 },
          remappable: true,
        },
      ],
      parameters: {
        motionSync: true,
        straightLineCorrection: true,
        rippleCorrection: true,
        longRangeMode: true,
        debounceMs: { supported: [0, 1, 2, 4, 8, 15, 20] },
        sleepMinutes: { supported: [1, 2, 3, 5, 20, 30] },
        lod: { min: 0.7, max: 2, step: 0.1 },
        sensorRotation: { min: -30, max: 30, step: 1 },
      },
      profiles: { onboardSlots: 4 },
      battery: true,
      renderId: 'generic-5button',
    },
    telemetry: { batteryPercent: 82, charging: false, connection: 'dongle', firmware: 'v1.4.2' },
    slots: [vanguardProfile, null, null, null],
  },
  {
    id: 'mock-scout',
    name: 'Scout Wired',
    manufacturer: 'OmniGear',
    capabilities: {
      dpi: { min: 200, max: 12_000, step: 100, maxStages: 3, independentXY: false },
      pollingRate: { supported: [125, 500, 1000] },
      buttons: [
        { id: 'left', label: 'Botão esquerdo', hotspot: { x: 0.27, y: 0.19 }, remappable: false },
        { id: 'right', label: 'Botão direito', hotspot: { x: 0.73, y: 0.19 }, remappable: true },
        { id: 'middle', label: 'Botão do meio', hotspot: { x: 0.5, y: 0.18 }, remappable: true },
      ],
      // Sem sensorRotation, sem lod, sem longRangeMode: os controles somem da tela.
      parameters: {
        motionSync: true,
        debounceMs: { supported: [0, 2, 4, 8] },
      },
      profiles: { onboardSlots: 2 },
      battery: false,
      renderId: 'generic-5button',
    },
    telemetry: { connection: 'wired', firmware: 'v1.0.0' },
    slots: [scoutProfile, null],
  },
];
