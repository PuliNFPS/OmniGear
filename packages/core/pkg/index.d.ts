export default function init(): Promise<void>;
export function core_version(): string;
export function is_wasm_available(): boolean;

/** Encodes the complete payload returned by a RAWM mouse-parameter query. */
export function encode_mouse_param_snapshot(snapshot: Uint8Array): Uint8Array;

/** Encodes a RAWM action event without length framing or CRC. */
export function encode_action(action: number, value: number): Uint8Array;

/** Encodes a RAWM configuration reset without length framing or CRC. */
export function encode_config_reset(): Uint8Array;

/** Encodes a RAWM mouse-key mapping without length framing or CRC. */
export function encode_mouse_key(
  key_ids: Uint8Array,
  modifier_one: number,
  modifier_two: number,
  key_type: number,
  key_code: number,
): Uint8Array;

/** Encodes a RAWM mouse-function mapping without length framing or CRC. */
export function encode_mouse_function(
  key_ids: Uint8Array,
  touch_type: number,
  function_id: number,
  value: number,
  text: Uint8Array,
): Uint8Array;
