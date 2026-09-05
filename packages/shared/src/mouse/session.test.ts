import { describe, expect, it } from 'vitest';
import type { MouseProfile, MouseSession } from './session';
import { estimateRuntimeHours, isDirty, profileFingerprint } from './session';
import type { MouseCapabilities } from './capabilities';

const profile: MouseProfile = {
  name: 'Competitive',
  dpi: {
    stages: [{ id: 's1', x: 800, y: 800, color: 'green' }],
    activeStageId: 's1',
    independentXY: false,
  },
  pollingRate: 1000,
  bindings: { left: { kind: 'button', button: 'left' } },
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

const session = (draft: MouseProfile): MouseSession => ({
  id: 'm1',
  name: 'Mock',
  manufacturer: 'OmniGear',
  capabilities: {} as MouseCapabilities,
  telemetry: { connection: 'dongle', firmware: 'v1' },
  slots: [{ index: 1, profile }],
  activeSlotIndex: 1,
  draft,
});

describe('profileFingerprint', () => {
  it('ignora ordem de chaves, para que dirty não dispare por reordenação', () => {
    const reordered: MouseProfile = {
      ...profile,
      bindings: { left: { button: 'left', kind: 'button' } as never },
    };
    expect(profileFingerprint(reordered)).toBe(profileFingerprint(profile));
  });
});

describe('isDirty', () => {
  it('é falso quando o draft é igual ao slot ativo', () => {
    expect(isDirty(session(structuredClone(profile)))).toBe(false);
  });

  it('é verdadeiro quando um valor do draft diverge', () => {
    const draft = structuredClone(profile);
    draft.pollingRate = 8000;
    expect(isDirty(session(draft))).toBe(true);
  });

  it('é verdadeiro quando o slot ativo está vazio', () => {
    const s = session(structuredClone(profile));
    s.slots = [{ index: 1, profile: null }];
    expect(isDirty(s)).toBe(true);
  });
});

describe('estimateRuntimeHours', () => {
  const caps = {
    pollingRate: { supported: [1000, 8000], runtimeHours: { 1000: [45, 56], 8000: [27, 34] } },
  } as unknown as MouseCapabilities;

  it('devolve a faixa declarada para o polling rate', () => {
    expect(estimateRuntimeHours(caps, 8000)).toEqual([27, 34]);
  });

  it('devolve null quando não há dado, em vez de inventar um número', () => {
    expect(estimateRuntimeHours(caps, 4000)).toBeNull();
  });
});
