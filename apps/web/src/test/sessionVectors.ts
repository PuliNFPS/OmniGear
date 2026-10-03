import type { OnboardSlotConfig } from '@gearhub/shared';
import { frameEvent, withProtocolEnvelope } from '../core/coreBridge';
import { toHex, type SlotJson } from './vectors';

/** O montador exige este preâmbulo antes de cada evento que chega. */
const PREAMBLE = [0xff, 0xff, 0xff, 0xff];
const CMD_NOTIFY = 0x0b;
const CMD_QUERY_RESULT = 0x02;

/** Um evento como chega ao transporte: com o preâmbulo, no canal virtual do mouse. */
export function deliveredReports(event: Uint8Array): Uint8Array[] {
  return frameEvent(Uint8Array.from([...PREAMBLE, ...event]), true);
}

/** Uma notificação do tipo `type`. As dos vetores cabem num relatório. */
export function notifyReport(type: number, payload: ArrayLike<number>): Uint8Array {
  return deliveredReports(
    withProtocolEnvelope([CMD_NOTIFY, 0, type, ...Array.from(payload)], false),
  )[0];
}

/** A resposta de consulta que um mouse com `raw` mandaria, com o terminador nulo do firmware. */
export function answerReports(raw: Record<string, unknown>): Uint8Array[] {
  const json = new TextEncoder().encode(`${JSON.stringify(raw)}\0`);
  return deliveredReports(withProtocolEnvelope([CMD_QUERY_RESULT, 0, ...json], false));
}

/** As memórias com os bytes crus em hex, como os vetores as guardam. */
export function shapeSlots(slots: OnboardSlotConfig[]): SlotJson[] {
  return slots.map((slot) => ({
    index: slot.index,
    bindings: slot.bindings.map((binding) => ({
      keyIds: binding.keyIds,
      action: binding.action,
      raw: toHex(binding.raw),
    })),
  }));
}
