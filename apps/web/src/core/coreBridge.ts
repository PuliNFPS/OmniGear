import init, {
  buildQueryEvent as wasmBuildQueryEvent,
  core_version,
  decodeReportChunk as wasmDecodeReportChunk,
  encode_action as wasmEncodeAction,
  encode_config_reset as wasmEncodeConfigReset,
  encode_mouse_function as wasmEncodeMouseFunction,
  encode_mouse_key as wasmEncodeMouseKey,
  encode_mouse_param_snapshot as wasmEncodeMouseParamSnapshot,
  frameEvent as wasmFrameEvent,
  is_wasm_available,
  isQueryResult as wasmIsQueryResult,
  queryJson as wasmQueryJson,
  RawEventAssembler as WasmRawEventAssembler,
  withProtocolEnvelope as wasmWithProtocolEnvelope,
} from 'gearhub-core-wasm';
import { asRawmError } from './rawmError';

export interface CoreStatus {
  version: string;
  wasm: boolean;
}

type ByteArrayLike = ArrayLike<number>;

interface RawMouseParamSnapshot {
  /** Complete raw payload, including fields unknown to this app version. */
  bytes?: ByteArrayLike;
  /** Alias accepted for callers that name the complete payload explicitly. */
  payload?: ByteArrayLike;
  /** Alias used by query parsers that expose a raw event body. */
  raw?: ByteArrayLike;
  [field: string]: unknown;
}

export type MouseParamSnapshot = ByteArrayLike | RawMouseParamSnapshot;

export interface RawAction {
  action: number;
  value?: number;
  argument?: number;
}

export interface RawMouseKey {
  keyIds: ByteArrayLike;
  modifier1?: number;
  modifier2?: number;
  keyType: number;
  keyCode: number;
}

export interface RawMouseFunction {
  keyIds: ByteArrayLike;
  touchType: number;
  functionId: number;
  value?: number;
  text?: string | ByteArrayLike;
}

function isByteArrayLike(value: unknown): value is ByteArrayLike {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { length?: unknown };
  return typeof candidate.length === 'number' && candidate.length >= 0;
}

function copyBytes(value: ByteArrayLike): Uint8Array {
  return Uint8Array.from(value);
}

function snapshotBytes(snapshot: MouseParamSnapshot): Uint8Array {
  if (isByteArrayLike(snapshot)) return copyBytes(snapshot);

  const source = snapshot.bytes ?? snapshot.payload ?? snapshot.raw;
  if (source === undefined) {
    throw new TypeError('Snapshot RAWM precisa fornecer o payload completo em bytes.');
  }
  return copyBytes(source);
}

function textBytes(value: string | ByteArrayLike | undefined): Uint8Array {
  return typeof value === 'string' ? new TextEncoder().encode(value) : copyBytes(value ?? []);
}

export function encodeMouseParamSnapshot(snapshot: MouseParamSnapshot): Uint8Array {
  return wasmEncodeMouseParamSnapshot(snapshotBytes(snapshot));
}

export function encodeAction(action: RawAction): Uint8Array;
export function encodeAction(action: number, value: number): Uint8Array;
export function encodeAction(action: RawAction | number, value?: number): Uint8Array {
  if (typeof action === 'number') return wasmEncodeAction(action, value ?? 0);
  return wasmEncodeAction(action.action, action.value ?? action.argument ?? 0);
}

export function encodeConfigReset(): Uint8Array {
  return wasmEncodeConfigReset();
}

export function encodeMouseKey(input: RawMouseKey): Uint8Array;
export function encodeMouseKey(
  keyIds: ByteArrayLike,
  modifier1: number,
  modifier2: number,
  keyType: number,
  keyCode: number,
): Uint8Array;
export function encodeMouseKey(
  input: RawMouseKey | ByteArrayLike,
  modifier1?: number,
  modifier2?: number,
  keyType?: number,
  keyCode?: number,
): Uint8Array {
  if (isByteArrayLike(input)) {
    return wasmEncodeMouseKey(
      copyBytes(input),
      modifier1 ?? 0,
      modifier2 ?? 0,
      keyType ?? 0,
      keyCode ?? 0,
    );
  }

  return wasmEncodeMouseKey(
    copyBytes(input.keyIds),
    input.modifier1 ?? 0,
    input.modifier2 ?? 0,
    input.keyType,
    input.keyCode,
  );
}

export function encodeMouseFunction(input: RawMouseFunction): Uint8Array;
export function encodeMouseFunction(
  keyIds: ByteArrayLike,
  touchType: number,
  functionId: number,
  value: number,
  text: string | ByteArrayLike,
): Uint8Array;
export function encodeMouseFunction(
  input: RawMouseFunction | ByteArrayLike,
  touchType?: number,
  functionId?: number,
  value?: number,
  text?: string | ByteArrayLike,
): Uint8Array {
  if (isByteArrayLike(input)) {
    return wasmEncodeMouseFunction(
      copyBytes(input),
      touchType ?? 0,
      functionId ?? 0,
      value ?? 0,
      textBytes(text),
    );
  }

  return wasmEncodeMouseFunction(
    copyBytes(input.keyIds),
    input.touchType,
    input.functionId,
    input.value ?? 0,
    textBytes(input.text),
  );
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
