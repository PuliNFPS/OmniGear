import type { MouseCapabilities } from './capabilities';
import type { MouseProfile } from './profile';
import type { MouseTelemetry } from './telemetry';

export type { MouseProfile };

export interface ProfileSlot {
  index: number;
  profile: MouseProfile | null;
}

export interface MouseSession {
  id: string;
  name: string;
  manufacturer: string;
  capabilities: MouseCapabilities;
  telemetry: MouseTelemetry;
  slots: ProfileSlot[];
  activeSlotIndex: number;
  /** O que está na tela e no mouse. */
  draft: MouseProfile;
}

/** Serializa com chaves ordenadas, para que reordenação não conte como mudança. */
function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
}

export function profileFingerprint(profile: MouseProfile): string {
  return stable(profile);
}

/**
 * Derivado, nunca armazenado: um `dirty` guardado em estado vira uma segunda
 * fonte de verdade que sai de sincronia.
 */
export function isDirty(session: MouseSession): boolean {
  const saved = session.slots.find((slot) => slot.index === session.activeSlotIndex)?.profile;
  if (!saved) return true;
  return profileFingerprint(saved) !== profileFingerprint(session.draft);
}

/** `null` quando o fabricante não declarou autonomia para esse polling rate. */
export function estimateRuntimeHours(
  capabilities: MouseCapabilities,
  pollingRate: number,
): [number, number] | null {
  return capabilities.pollingRate.runtimeHours?.[pollingRate] ?? null;
}
