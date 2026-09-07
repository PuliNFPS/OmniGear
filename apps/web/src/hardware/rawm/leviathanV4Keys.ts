import type { MouseActionId } from '@gearhub/shared';

/**
 * The key ids and action encodings, shared by the writer and the reader.
 *
 * They live apart from the driver so `onboardConfig.ts` can invert them without
 * importing the driver that imports it back.
 */

export const TOUCH_TYPE_PRESS = 0x02;
/** Only the `actions` table below names these, so they stay in this file. */
const MOUSE_KEY_TYPE_MKEY = 0x01;
const MOUSE_KEY_TYPE_WHEEL = 0x03;

/**
 * Key ids as the mouse reports them in its own config dump: 0x0a left, 0x0b
 * right, 0x0c middle, 0x0e M4, 0x0f M5, 0x10 the DPI key. 0x0d is a seventh key
 * bound to FUNCTION_SHOW_POWER, which the official UI leaves unlabelled, and
 * the seven together match the seven debounce delays in `kd`.
 *
 * Earlier values here were 1 to 7, which are not key ids at all. That is why
 * every mapping written from this driver was accepted and ignored.
 */
export const physicalKeyIds: Record<string, number> = {
  esquerdo: 0x0a,
  direito: 0x0b,
  central: 0x0c,
  'lateral-traseiro': 0x0e,
  'lateral-dianteiro': 0x0f,
  dpi: 0x10,
};

/** The button each key id belongs to, for reading a dump back. */
export const buttonIdsByKeyId = new Map(
  Object.entries(physicalKeyIds).map(([buttonId, keyId]) => [keyId, buttonId]),
);

export type EncodedAction =
  | { kind: 'key'; keyType: number; keyCode: number }
  | { kind: 'function'; functionId: number }
  | { kind: 'disabled' };

export const actions: Record<MouseActionId, EncodedAction> = {
  'clique-esquerdo': { kind: 'key', keyType: MOUSE_KEY_TYPE_MKEY, keyCode: 1 },
  'clique-direito': { kind: 'key', keyType: MOUSE_KEY_TYPE_MKEY, keyCode: 2 },
  'clique-central': { kind: 'key', keyType: MOUSE_KEY_TYPE_MKEY, keyCode: 3 },
  voltar: { kind: 'key', keyType: MOUSE_KEY_TYPE_MKEY, keyCode: 4 },
  avancar: { kind: 'key', keyType: MOUSE_KEY_TYPE_MKEY, keyCode: 5 },
  // MOUSE_KEY_WHEEL_UP and _DOWN in the vendor library, not 0x41 and 0x3f.
  'rolagem-cima': { kind: 'key', keyType: MOUSE_KEY_TYPE_WHEEL, keyCode: 0x07 },
  'rolagem-baixo': { kind: 'key', keyType: MOUSE_KEY_TYPE_WHEEL, keyCode: 0x08 },
  'dpi-ciclo': { kind: 'function', functionId: 1 },
  'dpi-aumentar': { kind: 'function', functionId: 2 },
  'dpi-diminuir': { kind: 'function', functionId: 3 },
  desativado: { kind: 'disabled' },
};

/**
 * The seventh key has no control in the editor, so nothing in settings would
 * ever rebuild it. CONFIG_RESET clears it like any other, and a set that leaves
 * it out silently drops the battery indicator from the mouse.
 */
export const SHOW_POWER_KEY_ID = 0x0d;
export const FUNCTION_SHOW_POWER = 0x0e;
