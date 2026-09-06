import type { BrowserHidApi, BrowserHidDevice } from '../deviceDiscovery';
import { matchDeviceDefinition } from '../deviceRegistry';
import { WebHidTransport, type HardwareTransport } from '../WebHidTransport';
import {
  LEVIATHAN_V4_RECEIVER_PRODUCT_ID,
  RAWM_CONFIG_USAGE,
  RAWM_CONFIG_USAGE_PAGE,
  RAWM_VENDOR_ID,
} from './leviathanV4';
import { parseMouseParamState, type RawmMouseParamState } from './mouseParamSnapshot';
import {
  RawEventAssembler,
  buildQueryEvent,
  decodeReportChunk,
  frameEvent,
  parseQueryJson,
} from './protocol';

/**
 * Read-only bring-up probe for the RAWM receiver.
 *
 * This module exists because the production path in connectLeviathanV4.ts is
 * strict on purpose: it throws on an unexpected name or an incomplete snapshot,
 * and deviceDiscovery.ts collapses every failure into `'falha'`. That is right
 * for the app and useless for a first contact with real hardware, where the
 * payload that explains the failure is exactly what we need to keep.
 *
 * So this probe observes instead of validating. It records every input report,
 * survives a malformed one, and reports each stage independently. The only
 * bytes it ever transmits come from `buildQueryEvent`; it never constructs a
 * driver and never touches an encoder that writes.
 */

export const CHANNEL_LABELS = { fisico: 'Receptor', virtual: 'Mouse (canal virtual)' } as const;

export type DiagnosticChannel = keyof typeof CHANNEL_LABELS;

export type StageStatus = 'ok' | 'aviso' | 'falha';

export interface RawReportLog {
  channel: DiagnosticChannel;
  reportId: number;
  hex: string;
}

export interface DiagnosticStage {
  id: string;
  label: string;
  status: StageStatus;
  detail: string;
}

interface DiagnosticCollectionInfo {
  usagePage: string;
  usage: string;
  /** Whether `reportId: 0` is the right id to transmit is decided by these. */
  inputReportIds: number[];
  outputReportIds: number[];
}

interface DiagnosticDeviceInfo {
  vendorId: string;
  productId: string;
  productName: string;
  collections: DiagnosticCollectionInfo[];
}

export interface DiagnosticReport {
  geradoEm: string;
  dispositivo: DiagnosticDeviceInfo;
  reconhecido: boolean;
  etapas: DiagnosticStage[];
  relatorios: RawReportLog[];
  receptor: Record<string, unknown> | null;
  mouse: Record<string, unknown> | null;
  snapshot: RawmMouseParamState | null;
  erroSnapshot: string | null;
}

export interface DiagnosticOptions {
  /** Wide by default: a sleeping mouse behind a 2.4 GHz receiver is slow to answer. */
  timeoutMs?: number;
  createTransport?: (device: BrowserHidDevice) => HardwareTransport;
}

const DEFAULT_TIMEOUT_MS = 3000;
/**
 * The vendor channel gets its own budget. A mouse being moved emits HID reports
 * continuously on its own collection, and a single shared cap would let that
 * traffic push the vendor response out of the log — which is the one artifact
 * worth keeping when parsing fails.
 */
const MAX_VENDOR_REPORTS = 48;
const MAX_OTHER_REPORTS = 12;
const LEVIATHAN_NAME = /leviathan|魔鲸\s*v4/i;

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join(' ');
}

function hexId(value: number): string {
  return `0x${value.toString(16).padStart(4, '0')}`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function describeDevice(device: BrowserHidDevice): DiagnosticDeviceInfo {
  return {
    vendorId: hexId(device.vendorId),
    productId: hexId(device.productId),
    productName: device.productName ?? '(sem nome)',
    collections: device.collections.map((collection) => ({
      usagePage: hexId(collection.usagePage),
      usage: hexId(collection.usage),
      inputReportIds: (collection.inputReports ?? []).map((report) => report.reportId),
      outputReportIds: (collection.outputReports ?? []).map((report) => report.reportId),
    })),
  };
}

/**
 * `fonte` separates failures that look alike in a message but point at opposite
 * fixes: the device refusing our transmission, nothing coming back at all, and
 * bytes arriving that we could not decode.
 */
type CaptureSource = 'resposta' | 'envio' | 'tempo-limite' | 'decodificacao';

interface CaptureResult {
  raw: Record<string, unknown> | null;
  error: string | null;
  fonte: CaptureSource;
}

/**
 * Sends one query and listens for the whole window. Unlike `queryRawmDevice`,
 * a malformed report resets the assembler and keeps listening instead of
 * rejecting: on unknown firmware the interesting response often arrives after
 * an unsolicited report.
 */
export function captureQuery(
  transport: HardwareTransport,
  channel: DiagnosticChannel,
  log: RawReportLog[],
  timeoutMs: number,
): Promise<CaptureResult> {
  const virtualMouse = channel === 'virtual';
  const assembler = new RawEventAssembler();
  let vendorReports = 0;
  let otherReports = 0;

  return new Promise<CaptureResult>((resolve) => {
    let settled = false;
    let lastError: string | null = null;

    const finish = (result: CaptureResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(result);
    };

    const unsubscribe = transport.onInputReport((reportId, report) => {
      const vendor = reportId === 0;
      const budget = vendor ? MAX_VENDOR_REPORTS : MAX_OTHER_REPORTS;
      const seen = vendor ? vendorReports : otherReports;
      if (seen < budget) {
        if (vendor) vendorReports += 1;
        else otherReports += 1;
        log.push({ channel, reportId, hex: hex(report) });
      }
      if (!vendor) return;
      try {
        const chunk = decodeReportChunk(report, virtualMouse);
        if (chunk.length === 0) return;
        const event = assembler.push(chunk);
        if (event) finish({ raw: parseQueryJson(event), error: null, fonte: 'resposta' });
      } catch (error) {
        lastError = messageOf(error);
        assembler.reset();
      }
    });

    const timer = setTimeout(
      () =>
        finish(
          lastError === null
            ? {
                raw: null,
                error: 'Nenhuma resposta dentro do tempo limite.',
                fonte: 'tempo-limite',
              }
            : { raw: null, error: lastError, fonte: 'decodificacao' },
        ),
      timeoutMs,
    );

    void (async () => {
      try {
        await transport.open();
        for (const report of frameEvent(buildQueryEvent(), virtualMouse)) {
          await transport.send({ reportId: 0, data: report });
        }
      } catch (error) {
        finish({ raw: null, error: messageOf(error), fonte: 'envio' });
      }
    })();
  });
}

function collectionStage(device: BrowserHidDevice): DiagnosticStage {
  const found = device.collections.some(
    (collection) =>
      collection.usagePage === RAWM_CONFIG_USAGE_PAGE && collection.usage === RAWM_CONFIG_USAGE,
  );
  return {
    id: 'colecao',
    label: 'Coleção vendor de configuração',
    status: found ? 'ok' : 'falha',
    detail: found
      ? `Encontrada em ${hexId(RAWM_CONFIG_USAGE_PAGE)}/${hexId(RAWM_CONFIG_USAGE)}.`
      : `Nenhuma coleção ${hexId(RAWM_CONFIG_USAGE_PAGE)}/${hexId(RAWM_CONFIG_USAGE)} neste dispositivo. Talvez seja a interface errada do receptor.`,
  };
}

function identityStage(raw: Record<string, unknown>): DiagnosticStage {
  const productId = typeof raw.pi === 'number' ? raw.pi : null;
  const vendorId = typeof raw.vi === 'number' ? raw.vi : null;
  const matches =
    productId === LEVIATHAN_V4_RECEIVER_PRODUCT_ID &&
    (vendorId === null || vendorId === RAWM_VENDOR_ID);
  return {
    id: 'identidade-receptor',
    label: 'Identidade do receptor',
    status: matches ? 'ok' : 'aviso',
    detail: matches
      ? `pi=${hexId(productId)} confere com o esperado.`
      : `Relatado pi=${productId === null ? '(ausente)' : hexId(productId)}, vi=${
          vendorId === null ? '(ausente)' : hexId(vendorId)
        }. Esperado pi=${hexId(LEVIATHAN_V4_RECEIVER_PRODUCT_ID)}, vi=${hexId(RAWM_VENDOR_ID)}. Ajuste o registro antes de conectar pelo aplicativo.`,
  };
}

function nameStage(raw: Record<string, unknown>): DiagnosticStage {
  const deviceName = typeof raw.dn === 'string' ? raw.dn.trim() : '';
  const matches = LEVIATHAN_NAME.test(deviceName);
  return {
    id: 'nome-mouse',
    label: 'Nome do mouse',
    status: matches ? 'ok' : 'aviso',
    detail: matches
      ? `"${deviceName}" corresponde ao filtro de nome.`
      : `O mouse informou "${deviceName || '(vazio)'}", que não corresponde ao filtro atual. Registre o nome real antes de conectar pelo aplicativo.`,
  };
}

function snapshotStage(raw: Record<string, unknown>): {
  stage: DiagnosticStage;
  snapshot: RawmMouseParamState | null;
  error: string | null;
} {
  try {
    const snapshot = parseMouseParamState(raw);
    return {
      stage: {
        id: 'snapshot',
        label: 'Snapshot de parâmetros',
        status: 'ok',
        detail: `Interpretado: ${snapshot.pollingRate} Hz, modo ${snapshot.powerMode}, LOD ${snapshot.liftOffDistance}, top ${snapshot.txOutputPower}.`,
      },
      snapshot,
      error: null,
    };
  } catch (error) {
    const detail = messageOf(error);
    return {
      stage: {
        id: 'snapshot',
        label: 'Snapshot de parâmetros',
        status: 'falha',
        detail: `${detail} Use o JSON bruto abaixo para criar uma fixture e corrigir o parser.`,
      },
      snapshot: null,
      error: detail,
    };
  }
}

/**
 * Names the failure by its origin, so a receiver that refuses our transmission
 * is never reported as a mouse that is merely asleep.
 */
function queryStage(
  id: string,
  label: string,
  channel: DiagnosticChannel,
  result: CaptureResult,
): DiagnosticStage {
  if (result.raw) {
    return {
      id,
      label,
      status: 'ok',
      detail: `Respondeu com ${Object.keys(result.raw).length} campos.`,
    };
  }
  const error = result.error ?? 'Sem resposta.';
  const detail =
    result.fonte === 'envio'
      ? `O dispositivo recusou o envio: ${error} Verifique se o id de relatório 0 existe nos relatórios de saída da coleção vendor.`
      : result.fonte === 'decodificacao'
        ? `Chegaram bytes que não puderam ser decodificados: ${error} Veja os relatórios em hexadecimal abaixo.`
        : channel === 'virtual'
          ? `${error} Mexa o mouse para acordá-lo e tente de novo.`
          : error;
  return { id, label, status: 'falha', detail };
}

/**
 * Probes a receiver without writing to it. Every stage is recorded; a failed
 * stage stops only the stages that genuinely depend on it, so a bad name or an
 * unparseable snapshot still leaves the raw payload in the report.
 */
export async function runReadOnlyDiagnostic(
  device: BrowserHidDevice,
  options: DiagnosticOptions = {},
): Promise<DiagnosticReport> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const createTransport = options.createTransport ?? ((target) => new WebHidTransport(target));
  const relatorios: RawReportLog[] = [];
  const collection = collectionStage(device);
  const etapas: DiagnosticStage[] = [collection];

  const report: DiagnosticReport = {
    geradoEm: new Date().toISOString(),
    dispositivo: describeDevice(device),
    reconhecido: matchDeviceDefinition(device) !== null,
    etapas,
    relatorios,
    receptor: null,
    mouse: null,
    snapshot: null,
    erroSnapshot: null,
  };

  // Without the vendor collection the query cannot work, and the unfiltered
  // picker can hand us any HID device. Stop before transmitting to it.
  if (collection.status === 'falha') return report;

  let transport: HardwareTransport;
  try {
    transport = createTransport(device);
    await transport.open();
  } catch (error) {
    etapas.push({
      id: 'abertura',
      label: 'Abertura do dispositivo',
      status: 'falha',
      detail: messageOf(error),
    });
    return report;
  }

  const receiver = await captureQuery(transport, 'fisico', relatorios, timeoutMs);
  report.receptor = receiver.raw;
  etapas.push(queryStage('consulta-receptor', 'Consulta ao receptor', 'fisico', receiver));
  if (receiver.raw) etapas.push(identityStage(receiver.raw));

  const mouse = await captureQuery(transport, 'virtual', relatorios, timeoutMs);
  report.mouse = mouse.raw;
  etapas.push(queryStage('consulta-mouse', 'Consulta ao mouse', 'virtual', mouse));

  if (mouse.raw) {
    etapas.push(nameStage(mouse.raw));
    const result = snapshotStage(mouse.raw);
    etapas.push(result.stage);
    report.snapshot = result.snapshot;
    report.erroSnapshot = result.error;
  }

  return report;
}

/**
 * Opens the picker on the vendor configuration collection, or unfiltered when
 * `allDevices` is set.
 *
 * The receiver publishes several HID interfaces under one product name, so a
 * vendor-only filter lists identical rows and selecting the wrong one yields an
 * interface with no output reports. Naming the collection makes the picker show
 * only the interface that can answer. The unfiltered escape stays for the case
 * this filter finds nothing, which is what a different usage page would look
 * like from here.
 */
export async function requestDiagnosticDevice(
  api: BrowserHidApi,
  allDevices = false,
): Promise<BrowserHidDevice | null> {
  const filters = allDevices
    ? []
    : [
        {
          vendorId: RAWM_VENDOR_ID,
          usagePage: RAWM_CONFIG_USAGE_PAGE,
          usage: RAWM_CONFIG_USAGE,
        },
      ];
  const chosen = await api.requestDevice({ filters });
  return chosen[0] ?? null;
}
