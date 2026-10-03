import { vi } from 'vitest';
import type { MouseSettings } from '@gearhub/shared';
import { notifyReport, shapeSlots } from '../../test/sessionVectors';
import { fromHex, toHex, type SessionEventJson, type StepJson } from '../../test/vectors';
import type { DeviceReport } from '../deviceDriver';
import { LeviathanV4Driver } from './LeviathanV4Driver';
import { validateRawmIdentity } from './session';

/**
 * O driver TypeScript anterior ao passo 5, rodado contra as entradas dos
 * vetores da sessão. Existe só enquanto as duas implementações coexistem: a
 * Task 7 o apaga junto com o driver antigo.
 */

const NOTIFY_MOUSE_CONFIG = 0x14;

function legacyDriver(raw: Record<string, unknown>) {
  const listeners = new Set<(reportId: number, data: Uint8Array) => void>();
  const steps: StepJson[] = [];
  const driver = new LeviathanV4Driver(
    {
      open: async () => undefined,
      send: async ({ data }) => {
        steps.push({ send: toHex(data) });
      },
      onInputReport: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    raw,
    raw.crc === 1,
  );
  const feed = (report: Uint8Array) => {
    for (const listener of listeners) listener(0, report);
  };
  return { driver, steps, feed };
}

/** O `pause(8)` do driver vira um passo `wait`, na ordem em que acontece entre os envios. */
async function recordingPauses(steps: StepJson[], run: () => Promise<void>): Promise<void> {
  const spy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
    callback: () => void,
    milliseconds?: number,
  ) => {
    steps.push({ wait: milliseconds ?? 0 });
    callback();
    return 0;
  }) as unknown as typeof setTimeout);
  try {
    await run();
  } finally {
    spy.mockRestore();
  }
}

function feedDump(feed: (report: Uint8Array) => void, dump: string[] | null): void {
  for (const payload of dump ?? []) feed(notifyReport(NOTIFY_MOUSE_CONFIG, fromHex(payload)));
}

export function legacyIdentity(raw: Record<string, unknown>) {
  try {
    const { deviceName, productId, vendorId, crcSupported } = validateRawmIdentity(raw);
    return { deviceName, productId, vendorId, crcSupported };
  } catch {
    return null;
  }
}

export function legacyEvents(raw: Record<string, unknown>, reports: string[]): SessionEventJson[] {
  const { driver, feed } = legacyDriver(raw);
  const events: SessionEventJson[] = [];
  let streaming = false;
  driver.onDeviceReport((report: DeviceReport) => {
    // O replay da inscrição não é evento do fluxo.
    if (!streaming) return;
    events.push(
      report.kind === 'dpi'
        ? { kind: 'dpi', x: report.value, y: report.y ?? report.value }
        : { kind: 'active-slot', index: report.slotIndex - 1 },
    );
  });
  driver.onOnboardProfiles((slots) => {
    if (streaming) events.push({ kind: 'onboard-slots', slots: shapeSlots(slots) });
  });
  streaming = true;
  for (const report of reports) feed(fromHex(report));
  return events;
}

export async function legacyApply(
  raw: Record<string, unknown>,
  dump: string[] | null,
  applies: MouseSettings[],
): Promise<StepJson[][]> {
  const { driver, steps, feed } = legacyDriver(raw);
  feedDump(feed, dump);
  const results: StepJson[][] = [];
  for (const settings of applies) {
    steps.length = 0;
    await recordingPauses(steps, () => driver.applyToSession(settings));
    results.push([...steps]);
  }
  return results;
}

export async function legacyWriteProfile(
  raw: Record<string, unknown>,
  dump: string[] | null,
  slot: number,
  settings: MouseSettings,
): Promise<StepJson[]> {
  const { driver, steps, feed } = legacyDriver(raw);
  feedDump(feed, dump);
  await recordingPauses(steps, () => driver.writeProfile(slot + 1, 'Perfil', settings));
  return [...steps];
}
