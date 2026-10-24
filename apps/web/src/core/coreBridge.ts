import init, {
  actionForFunction as wasmActionForFunction,
  actionForKey as wasmActionForKey,
  applySettingsToMouseParam as wasmApplySettingsToMouseParam,
  buildQueryEvent as wasmBuildQueryEvent,
  core_version,
  decodeOnboardEntry as wasmDecodeOnboardEntry,
  decodeReportChunk as wasmDecodeReportChunk,
  describeLeviathanV4 as wasmDescribeLeviathanV4,
  encode_action as wasmEncodeAction,
  encode_config_reset as wasmEncodeConfigReset,
  encode_mouse_function as wasmEncodeMouseFunction,
  encode_mouse_key as wasmEncodeMouseKey,
  encode_mouse_param_snapshot as wasmEncodeMouseParamSnapshot,
  encodeLeviathanShowPower as wasmEncodeLeviathanShowPower,
  encodeMapping as wasmEncodeMapping,
  encodeMouseParamBody as wasmEncodeMouseParamBody,
  frameEvent as wasmFrameEvent,
  is_wasm_available,
  isLeviathanV4Name as wasmIsLeviathanV4Name,
  isQueryResult as wasmIsQueryResult,
  leviathanButtonId as wasmLeviathanButtonId,
  leviathanKeyId as wasmLeviathanKeyId,
  leviathanLodMillimetres as wasmLeviathanLodMillimetres,
  leviathanQueryTimeoutMs as wasmLeviathanQueryTimeoutMs,
  LeviathanV4Session as WasmLeviathanV4Session,
  leviathanV4Usb as wasmLeviathanV4Usb,
  matchesLeviathanV4 as wasmMatchesLeviathanV4,
  OnboardConfigCollector as WasmOnboardConfigCollector,
  parseMouseParamState as wasmParseMouseParamState,
  parseRawmIdentity as wasmParseRawmIdentity,
  queryJson as wasmQueryJson,
  RawEventAssembler as WasmRawEventAssembler,
  settingsFromSlot as wasmSettingsFromSlot,
  withProtocolEnvelope as wasmWithProtocolEnvelope,
} from 'gearhub-core-wasm';
import type {
  DpiAxes,
  LeviathanV4Description,
  LeviathanV4Usb,
  MouseActionId,
  MouseSettings,
  OnboardBinding,
  OnboardSlotConfig,
  RawmIdentity,
  RawmMouseParamState,
  SessionEvent,
  SessionStep,
} from '@gearhub/shared';
import { asRawmError } from './rawmError';

export interface CoreStatus {
  version: string;
  wasm: boolean;
}

function copyBytes(value: ArrayLike<number>): Uint8Array {
  return Uint8Array.from(value);
}

function textBytes(value: string | ArrayLike<number>): Uint8Array {
  return typeof value === 'string' ? new TextEncoder().encode(value) : copyBytes(value);
}

export function encodeMouseParamSnapshot(snapshot: ArrayLike<number>): Uint8Array {
  return wasmEncodeMouseParamSnapshot(copyBytes(snapshot));
}

export function encodeAction(action: number, value: number): Uint8Array {
  return wasmEncodeAction(action, value);
}

export function encodeConfigReset(): Uint8Array {
  return wasmEncodeConfigReset();
}

export function encodeMouseKey(
  keyIds: ArrayLike<number>,
  modifier1: number,
  modifier2: number,
  keyType: number,
  keyCode: number,
): Uint8Array {
  return wasmEncodeMouseKey(copyBytes(keyIds), modifier1, modifier2, keyType, keyCode);
}

export function encodeMouseFunction(
  keyIds: ArrayLike<number>,
  touchType: number,
  functionId: number,
  value: number,
  text: string | ArrayLike<number>,
): Uint8Array {
  return wasmEncodeMouseFunction(copyBytes(keyIds), touchType, functionId, value, textBytes(text));
}

/**
 * O evento que atribui `action` às teclas — uma, ou duas para R-Plus com o
 * ativador primeiro. `null` quando a ação não escreve nada.
 */
export function encodeMapping(keyIds: ArrayLike<number>, action: MouseActionId): Uint8Array | null {
  try {
    return wasmEncodeMapping(copyBytes(keyIds), action) ?? null;
  } catch (error) {
    throw asRawmError(error);
  }
}

/**
 * A ação que um par tipo/código de tecla significa, ou `null`. O núcleo devolve o id como
 * texto; a conversão para `MouseActionId` é segura porque o tipo é gerado do mesmo enum, e
 * `cargo test` reprova quando os nomes divergem (`as_str_names_exactly_the_generated_union`).
 */
export function actionForKey(keyType: number, keyCode: number): MouseActionId | null {
  return (wasmActionForKey(keyType, keyCode) ?? null) as MouseActionId | null;
}

/** A ação que um id de função significa, ou `null`. Mesma conversão de `actionForKey`. */
export function actionForFunction(functionId: number): MouseActionId | null {
  return (wasmActionForFunction(functionId) ?? null) as MouseActionId | null;
}

/** O id de tecla que o Leviathan V4 relata para um botão, ou `null`. */
export function leviathanKeyId(buttonId: string): number | null {
  return wasmLeviathanKeyId(buttonId) ?? null;
}

/** O botão a que um id de tecla do Leviathan V4 pertence, ou `null`. */
export function leviathanButtonId(keyId: number): string | null {
  return wasmLeviathanButtonId(keyId) ?? null;
}

/** O evento que devolve à sétima tecla o indicador de bateria. */
export function encodeLeviathanShowPower(): Uint8Array {
  return wasmEncodeLeviathanShowPower();
}

/** Lê o bloco de parâmetros da resposta de consulta. */
export function parseMouseParamState(raw: Record<string, unknown>): RawmMouseParamState {
  try {
    return wasmParseMouseParamState(raw) as RawmMouseParamState;
  } catch (error) {
    throw asRawmError(error);
  }
}

/** O corpo binário do bloco, pronto para `encodeMouseParamSnapshot`. */
export function encodeMouseParamBody(state: RawmMouseParamState): Uint8Array {
  try {
    return wasmEncodeMouseParamBody(state);
  } catch (error) {
    throw asRawmError(error);
  }
}

/** A configuração do editor aplicada sobre o bloco que o mouse relatou. */
export function applySettingsToMouseParam(
  snapshot: RawmMouseParamState,
  settings: MouseSettings,
): RawmMouseParamState {
  try {
    return wasmApplySettingsToMouseParam(snapshot, settings) as RawmMouseParamState;
  } catch (error) {
    throw asRawmError(error);
  }
}

/** O que a consulta diz sobre o Leviathan V4, e o que o modelo suporta. */
export function describeLeviathanV4(raw: Record<string, unknown>): LeviathanV4Description {
  try {
    return wasmDescribeLeviathanV4(raw) as LeviathanV4Description;
  } catch (error) {
    throw asRawmError(error);
  }
}

/** A distância, em milímetros, de um nível de LOD; `null` para um nível desconhecido. */
export function leviathanLodMillimetres(raw: number): number | null {
  return wasmLeviathanLodMillimetres(raw) ?? null;
}

/** Os números USB do receptor, para o filtro do seletor WebHID. */
export function leviathanV4Usb(): LeviathanV4Usb {
  return wasmLeviathanV4Usb() as LeviathanV4Usb;
}

interface HidDeviceIdentityLike {
  vendorId: number;
  productId: number;
  collections: {
    usagePage: number;
    usage: number;
    inputReports?: { reportId: number }[];
    outputReports?: { reportId: number }[];
  }[];
}

/**
 * Se o dispositivo é o receptor do Leviathan V4 com a coleção de configuração.
 *
 * O `HIDDevice` do navegador guarda tudo em getters do protótipo, que a
 * conversão do serde não enxerga; por isso a cópia para um objeto simples.
 */
export function matchesLeviathanV4(device: HidDeviceIdentityLike): boolean {
  return wasmMatchesLeviathanV4({
    vendorId: device.vendorId,
    productId: device.productId,
    collections: device.collections.map((collection) => ({
      usagePage: collection.usagePage,
      usage: collection.usage,
      inputReports: (collection.inputReports ?? []).map(({ reportId }) => ({ reportId })),
      outputReports: (collection.outputReports ?? []).map(({ reportId }) => ({ reportId })),
    })),
  });
}

/** Se o nome que o mouse relata é o de um Leviathan V4. */
export function isLeviathanV4Name(name: string): boolean {
  return wasmIsLeviathanV4Name(name);
}

export function withProtocolEnvelope(source: ArrayLike<number>, useCrc: boolean): Uint8Array {
  try {
    return wasmWithProtocolEnvelope(copyBytes(source), useCrc);
  } catch (error) {
    throw asRawmError(error);
  }
}

export function buildQueryEvent(epochSeconds = Math.floor(Date.now() / 1000)): Uint8Array {
  try {
    return wasmBuildQueryEvent(BigInt(epochSeconds));
  } catch (error) {
    throw asRawmError(error);
  }
}

export function isQueryResult(event: Uint8Array): boolean {
  return wasmIsQueryResult(event);
}

export function parseQueryJson(event: Uint8Array): Record<string, unknown> {
  let text: string;
  try {
    text = wasmQueryJson(event);
  } catch (error) {
    throw asRawmError(error);
  }
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Identificação RAWM inválida.');
  }
  return parsed as Record<string, unknown>;
}

export function frameEvent(event: ArrayLike<number>, virtualMouse: boolean): Uint8Array[] {
  return wasmFrameEvent(copyBytes(event), virtualMouse) as Uint8Array[];
}

export function decodeReportChunk(
  report: ArrayLike<number>,
  virtualMouse: boolean,
): Uint8Array | null {
  try {
    return wasmDecodeReportChunk(copyBytes(report), virtualMouse) ?? null;
  } catch (error) {
    throw asRawmError(error);
  }
}

/**
 * Junta os pedaços que chegam num fluxo de eventos.
 *
 * A classe da ponte já tem a forma certa; este invólucro existe só para
 * traduzir o erro tipado do núcleo na mensagem em português que a casca
 * espera.
 */
export class RawEventAssembler {
  private readonly inner = new WasmRawEventAssembler();

  push(chunk: Uint8Array): Uint8Array[] {
    try {
      return this.inner.push(chunk) as Uint8Array[];
    } catch (error) {
      throw asRawmError(error);
    }
  }

  reset(): void {
    this.inner.reset();
  }
}

/**
 * Monta o dump onboard delimitado. Recebe cada payload 0x14 e devolve as
 * memórias quando o terminador chega, `null` até lá. O estado mora no núcleo;
 * este invólucro existe para a forma e para o tipo.
 */
export class OnboardConfigCollector {
  private readonly inner = new WasmOnboardConfigCollector();

  push(payload: Uint8Array): OnboardSlotConfig[] | null {
    return (this.inner.push(payload) as OnboardSlotConfig[] | null) ?? null;
  }
}

/** Uma entrada do dump; `null` para bytes que não são evento de configuração. */
export function decodeOnboardEntry(entry: Uint8Array): OnboardBinding | null {
  return (wasmDecodeOnboardEntry(entry) as OnboardBinding | null) ?? null;
}

/** O que uma memória onboard realmente guarda, aplicado sobre a configuração base. */
export function settingsFromSlot(base: MouseSettings, slot: OnboardSlotConfig): MouseSettings {
  try {
    return wasmSettingsFromSlot(base, slot) as MouseSettings;
  } catch (error) {
    throw asRawmError(error);
  }
}

/** A identidade que uma resposta de consulta declara. */
export function parseRawmIdentity(raw: Record<string, unknown>): RawmIdentity {
  try {
    return wasmParseRawmIdentity(raw) as RawmIdentity;
  } catch (error) {
    throw asRawmError(error);
  }
}

/** Quanto esperar a resposta de uma consulta, contando a abertura do dispositivo. */
export function leviathanQueryTimeoutMs(): number {
  return wasmLeviathanQueryTimeoutMs();
}

/**
 * A sessão do Leviathan V4, que vive no núcleo: o que o mouse tem e o que
 * enviar a seguir. Este invólucro só traduz o erro tipado e dá o tipo gerado
 * ao que a ponte devolve.
 */
export class LeviathanV4Session {
  private readonly inner = new WasmLeviathanV4Session();

  /** O que um relatório que chegou significa. Só falha com uma consulta pendente. */
  feedReport(reportId: number, report: Uint8Array): SessionEvent[] {
    try {
      return this.inner.feedReport(reportId, report) as SessionEvent[];
    } catch (error) {
      throw asRawmError(error);
    }
  }

  beginQuery(epochSeconds = Math.floor(Date.now() / 1000)): void {
    try {
      this.inner.beginQuery(BigInt(epochSeconds));
    } catch (error) {
      throw asRawmError(error);
    }
  }

  beginApply(settings: MouseSettings): void {
    try {
      this.inner.beginApply(settings);
    } catch (error) {
      throw asRawmError(error);
    }
  }

  /** `slot` conta de 0. */
  beginWriteProfile(slot: number, settings: MouseSettings): void {
    try {
      this.inner.beginWriteProfile(slot, settings);
    } catch (error) {
      throw asRawmError(error);
    }
  }

  /** O próximo passo; `null` quando a operação acabou. */
  nextStep(): SessionStep | null {
    try {
      return (this.inner.nextStep() as SessionStep | null) ?? null;
    } catch (error) {
      throw asRawmError(error);
    }
  }

  abort(): void {
    this.inner.abort();
  }

  /** A memória ativa, contando de 0; `null` antes da primeira resposta. */
  activeSlot(): number | null {
    return this.inner.activeSlot() ?? null;
  }

  dpi(): DpiAxes | null {
    return (this.inner.dpi() as DpiAxes | null) ?? null;
  }

  slots(): OnboardSlotConfig[] | null {
    return (this.inner.slots() as OnboardSlotConfig[] | null) ?? null;
  }
}

let ready: Promise<void> | null = null;

/**
 * Initialises the core once, handing the same promise to every later caller.
 *
 * Every encoder above is synchronous, and the wasm-bindgen glue that
 * `pnpm core:build` generates throws on any call made before `init()`
 * resolves. Skipping this await broke every apply instantly, on every
 * setting, with the error swallowed (the 2026-09-07 bug fixed in PR #7). So
 * the app awaits this before it renders.
 */
export function ensureCoreReady(): Promise<void> {
  // `init()` resolves to the generated build's `InitOutput`; normalise it to
  // `undefined` so this function's signature says what callers actually need.
  const pending =
    ready ??
    Promise.resolve(init()).then(
      () => undefined,
      (error: unknown) => {
        // A failure must not be remembered as a success, or the app would spend
        // the rest of the session believing a core that never loaded is ready.
        ready = null;
        throw error;
      },
    );
  ready = pending;
  return pending;
}

export async function loadCore(): Promise<CoreStatus> {
  await ensureCoreReady();
  return { version: core_version(), wasm: is_wasm_available() };
}
