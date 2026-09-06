/**
 * Checked-in development bridge: mirrors packages/core/src/lib.rs in plain
 * JavaScript so the app and the tests run without wasm-pack. The encoders are
 * called synchronously, which the generated wasm glue cannot do before `init()`.
 *
 * `pnpm core:build` overwrites this file, and `pnpm dev` triggers that through
 * `core:prepare` whenever wasm-pack is on PATH. Never commit the generated
 * output: CI installs Rust but not wasm-pack and reads this bridge from git.
 */

export default async function init() {}

const CMD_CONFIG = 3;
const CMD_ACTION = 6;
const CONFIG_TYPE_RESET = 3;
const CONFIG_TYPE_MOUSE_PARAM = 21;
const CONFIG_TYPE_MOUSE_KEY = 22;
const CONFIG_TYPE_MOUSE_FUNCTION = 24;

function configEvent(configType, payload) {
  return Uint8Array.from([CMD_CONFIG, 0, configType, ...payload]);
}

function u16le(value) {
  return [value & 255, (value >>> 8) & 255];
}

export function encode_mouse_param_snapshot(snapshot) {
  return configEvent(CONFIG_TYPE_MOUSE_PARAM, Uint8Array.from(snapshot));
}

export function encode_action(action, value) {
  const argument = Number(value) >>> 0;
  return Uint8Array.from([
    CMD_ACTION,
    0,
    Number(action) & 255,
    argument & 255,
    (argument >>> 8) & 255,
    (argument >>> 16) & 255,
    (argument >>> 24) & 255,
  ]);
}

export function encode_config_reset() {
  return configEvent(CONFIG_TYPE_RESET, []);
}

export function encode_mouse_key(keyIds, modifierOne, modifierTwo, keyType, keyCode) {
  const ids = Uint8Array.from(keyIds);
  return configEvent(CONFIG_TYPE_MOUSE_KEY, [
    ids.length & 255,
    ...ids,
    Number(modifierOne) & 255,
    Number(keyType) & 255,
    Number(keyCode) & 255,
    Number(modifierTwo) & 255,
    0,
  ]);
}

export function encode_mouse_function(keyIds, touchType, functionId, value, text) {
  const ids = Uint8Array.from(keyIds);
  const label = Uint8Array.from(text);
  const argument = Number(value) & 65535;
  return configEvent(CONFIG_TYPE_MOUSE_FUNCTION, [
    ids.length & 255,
    ...ids,
    Number(touchType) & 255,
    Number(functionId) & 255,
    ...u16le(argument),
    0,
    ...u16le(label.length),
    ...label,
  ]);
}

export function core_version() {
  return '0.1.0-dev';
}

export function is_wasm_available() {
  return false;
}
