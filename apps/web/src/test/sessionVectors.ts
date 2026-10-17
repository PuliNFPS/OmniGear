import type { OnboardSlotConfig, SessionEvent } from '@gearhub/shared';
import { LeviathanV4Session, frameEvent, withProtocolEnvelope } from '../core/coreBridge';
import { toHex, type SessionEventJson, type SlotJson, type StepJson } from './vectors';

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
  const reports = deliveredReports(
    withProtocolEnvelope([CMD_NOTIFY, 0, type, ...Array.from(payload)], false),
  );
  if (reports.length !== 1) throw new Error('notificação maior que um relatório');
  return reports[0];
}

/** A resposta de consulta que um mouse com `raw` mandaria, com o terminador nulo do firmware. */
export function answerReports(raw: Record<string, unknown>): Uint8Array[] {
  const json = new TextEncoder().encode(`${JSON.stringify(raw)}\0`);
  return deliveredReports(withProtocolEnvelope([CMD_QUERY_RESULT, 0, ...json], false));
}

/** As memórias com os bytes crus em hex, como os vetores as guardam. */
function shapeSlots(slots: OnboardSlotConfig[]): SlotJson[] {
  return slots.map((slot) => ({
    index: slot.index,
    bindings: slot.bindings.map((binding) => ({
      keyIds: binding.keyIds,
      action: binding.action,
      raw: toHex(binding.raw),
    })),
  }));
}

/** Uma sessão do núcleo ligada pela resposta que um mouse com `raw` mandaria. */
export function connectedSession(raw: Record<string, unknown>): LeviathanV4Session {
  const session = new LeviathanV4Session();
  session.beginQuery(0);
  while (session.nextStep()) {
    // A consulta só envia; a resposta vem abaixo.
  }
  const events = answerReports(raw).flatMap((report) => session.feedReport(0, report));
  if (events.at(-1)?.kind !== 'queried') throw new Error('a resposta não ligou a sessão');
  return session;
}

/** Os passos até o fim, na forma dos vetores. */
export function drainSteps(session: LeviathanV4Session): StepJson[] {
  const steps: StepJson[] = [];
  for (let step = session.nextStep(); step; step = session.nextStep()) {
    steps.push(step.kind === 'send' ? { send: toHex(step.data) } : { wait: step.ms });
  }
  return steps;
}

/** Um evento na forma dos vetores. A resposta da consulta não aparece neles. */
export function shapeEvent(event: SessionEvent): SessionEventJson {
  switch (event.kind) {
    case 'queried':
      throw new Error('uma resposta de consulta não é evento dos vetores');
    case 'dpi':
      return { kind: 'dpi', x: event.x, y: event.y };
    case 'active-slot':
      return { kind: 'active-slot', index: event.index };
    case 'onboard-slots':
      return { kind: 'onboard-slots', slots: shapeSlots(event.slots) };
  }
}
