import init, {
  core_version,
  encode_action as wasmEncodeAction,
  encode_config_reset as wasmEncodeConfigReset,
  encode_mouse_function as wasmEncodeMouseFunction,
  encode_mouse_key as wasmEncodeMouseKey,
  encode_mouse_param_snapshot as wasmEncodeMouseParamSnapshot,
  is_wasm_available,
} from 'gearhub-core-wasm';

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

export async function loadCore(): Promise<CoreStatus> {
  await init();
  return { version: core_version(), wasm: is_wasm_available() };
}
