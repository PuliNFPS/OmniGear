import type { MouseActionId } from '@gearhub/shared';
import { encodeMouseParamSnapshot } from '../../core/coreBridge';
import type { BrowserHidDevice } from '../deviceDiscovery';
import { WebHidTransport, type HardwareTransport } from '../WebHidTransport';
import { captureQuery, type RawReportLog } from './diagnostics';
import { encodeLeviathanAction } from './LeviathanV4Driver';
import {
  encodeMouseParamBody,
  parseMouseParamState,
  type RawmMouseParamState,
} from './mouseParamSnapshot';
import { frameEvent, withProtocolEnvelope } from './protocol';

/**
 * Smallest possible write, for confirming the binary parameter body against
 * real hardware.
 *
 * The driver's applyToSession is not a minimal test: it sends CONFIG_RESET, the
 * full parameter body and every button mapping, and the mappings were read from
 * the official software without hardware confirmation. This sends exactly one
 * mouse-parameter event, built from the snapshot just read with a single field
 * changed.
 *
 * It never sends ACTION_SAVE_CONFIG_TO_FDS, so nothing reaches flash and a
 * power cycle restores the mouse. It then reads back and reports every field
 * that moved, so a wrong byte layout shows up as a named divergence rather than
 * as a mouse behaving oddly.
 */

export interface FieldDivergence {
  campo: string;
  esperado: unknown;
  obtido: unknown;
}

export interface WriteProbeReport {
  geradoEm: string;
  alvo: { campo: string; de: number | null; para: number };
  eventoHex: string;
  antes: RawmMouseParamState | null;
  depois: RawmMouseParamState | null;
  divergencias: FieldDivergence[];
  confirmado: boolean;
  /**
   * False when the target already equalled the current value. The read back
   * matches either way then, so the run cannot tell a working write from an
   * ignored one and must not be read as evidence.
   */
  conclusivo: boolean;
  erro: string | null;
  relatorios: RawReportLog[];
}

export interface WriteProbeOptions {
  timeoutMs?: number;
  /** Time given to the mouse to apply the change before reading back. */
  settleMs?: number;
  createTransport?: (device: BrowserHidDevice) => HardwareTransport;
}

const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_SETTLE_MS = 250;

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join(' ');
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Every field that differs, so an unintended edit elsewhere cannot hide. */
export function compareStates(
  expected: RawmMouseParamState,
  actual: RawmMouseParamState,
): FieldDivergence[] {
  const divergences: FieldDivergence[] = [];
  for (const campo of Object.keys(expected) as (keyof RawmMouseParamState)[]) {
    const left = expected[campo];
    const right = actual[campo];
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      divergences.push({ campo, esperado: left, obtido: right });
    }
  }
  return divergences;
}

export async function probePollingWrite(
  device: BrowserHidDevice,
  pollingRate: number,
  options: WriteProbeOptions = {},
): Promise<WriteProbeReport> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const createTransport = options.createTransport ?? ((target) => new WebHidTransport(target));
  const relatorios: RawReportLog[] = [];
  const report: WriteProbeReport = {
    geradoEm: new Date().toISOString(),
    alvo: { campo: 'pollingRate', de: null, para: pollingRate },
    eventoHex: '',
    antes: null,
    depois: null,
    divergencias: [],
    confirmado: false,
    conclusivo: false,
    erro: null,
    relatorios,
  };

  try {
    const transport = createTransport(device);
    await transport.open();

    const before = await captureQuery(transport, 'virtual', relatorios, timeoutMs);
    if (!before.raw) {
      report.erro = `Leitura antes da escrita falhou: ${before.error ?? 'sem resposta'}.`;
      return report;
    }
    const antes = parseMouseParamState(before.raw);
    report.antes = antes;
    report.alvo.de = antes.pollingRate;

    const esperado: RawmMouseParamState = { ...antes, pollingRate };
    const inner = encodeMouseParamSnapshot(encodeMouseParamBody(esperado));
    const event = withProtocolEnvelope(inner, before.raw.crc === 1);
    report.eventoHex = hex(event);

    for (const chunk of frameEvent(event, true)) {
      await transport.send({ reportId: 0, data: chunk });
    }
    await wait(options.settleMs ?? DEFAULT_SETTLE_MS);

    const after = await captureQuery(transport, 'virtual', relatorios, timeoutMs);
    if (!after.raw) {
      report.erro = `Leitura depois da escrita falhou: ${after.error ?? 'sem resposta'}. O evento foi enviado; o estado do mouse é desconhecido.`;
      return report;
    }
    const depois = parseMouseParamState(after.raw);
    report.depois = depois;
    report.divergencias = compareStates(esperado, depois);
    report.confirmado = report.divergencias.length === 0;
    report.conclusivo = antes.pollingRate !== pollingRate;
    if (report.confirmado && !report.conclusivo) {
      report.erro = `O mouse já estava em ${pollingRate} Hz. A releitura confere de qualquer jeito, então esta execução não distingue uma escrita aceita de uma ignorada. Escolha um valor diferente.`;
    }
  } catch (error) {
    report.erro = messageOf(error);
  }

  return report;
}

/**
 * Single button-mapping write.
 *
 * Unlike the parameter probe, this one cannot confirm itself: the query
 * response carries no mapping fields, so there is nothing to read back. The
 * only verification is behavioural — press the button and see what it does.
 *
 * That matters because the physical key ids were read from the official
 * software and never confirmed. A wrong id remaps a different button than
 * intended, so the caller picks one id at a time and the mapping never reaches
 * flash: powering the mouse off and on restores it.
 */
export interface MappingProbeReport {
  geradoEm: string;
  keyId: number;
  acao: MouseActionId;
  eventoHex: string;
  enviado: boolean;
  erro: string | null;
}

export async function probeButtonMapping(
  device: BrowserHidDevice,
  keyId: number,
  acao: MouseActionId,
  options: WriteProbeOptions = {},
): Promise<MappingProbeReport> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const createTransport = options.createTransport ?? ((target) => new WebHidTransport(target));
  const report: MappingProbeReport = {
    geradoEm: new Date().toISOString(),
    keyId,
    acao,
    eventoHex: '',
    enviado: false,
    erro: null,
  };

  try {
    const transport = createTransport(device);
    await transport.open();

    // Queried first only to confirm the mouse is awake and to learn whether it
    // wants the CRC envelope; nothing from the response is written back.
    const alive = await captureQuery(transport, 'virtual', [], timeoutMs);
    if (!alive.raw) {
      report.erro = `O mouse não respondeu antes da escrita: ${alive.error ?? 'sem resposta'}.`;
      return report;
    }

    const inner = encodeLeviathanAction([keyId], acao);
    if (!inner) {
      report.erro = 'A ação escolhida desativa o botão e não gera evento.';
      return report;
    }

    const event = withProtocolEnvelope(inner, alive.raw.crc === 1);
    report.eventoHex = hex(event);
    for (const chunk of frameEvent(event, true)) {
      await transport.send({ reportId: 0, data: chunk });
    }
    report.enviado = true;
  } catch (error) {
    report.erro = messageOf(error);
  }

  return report;
}
