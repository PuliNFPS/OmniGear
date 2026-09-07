import type { MouseActionId, MouseSettings } from '@gearhub/shared';
import { actions, buttonIdsByKeyId, type EncodedAction } from './leviathanV4Keys';

/**
 * Reads the mappings the mouse reports for itself.
 *
 * The mouse answers a query with its JSON identity and then, unprompted,
 * streams NOTIFY_TYPE_MOUSE_CONFIG (0x14) events carrying the mappings each
 * onboard slot holds. The vendor library does nothing to ask for them: it sends
 * the same query this app already sends and waits. So the dump is already
 * arriving today, and the only thing missing was listening past the identity.
 *
 * The stream is delimited. A one-byte payload that is not 0xff opens a slot and
 * clears whatever was held for it; longer payloads are its entries; 0xff ends
 * the dump. Each entry has the same layout the writer uses, so the length here
 * is the same 12-bit field `protocol.ts` decodes.
 */

const CMD_CONFIG = 0x03;
const CONFIG_TYPE_MOUSE_KEY = 0x16;
const CONFIG_TYPE_MOUSE_FUNCTION = 0x18;
const END_OF_DUMP = 0xff;
/** The vendor rejects an entry naming more than a two-key R-Plus layer. */
const MAX_KEY_IDS = 2;

export interface OnboardBinding {
  /** One id, or two for an R-Plus layer with the activator first. */
  keyIds: number[];
  /** Null when no MouseActionId describes these bytes. */
  action: MouseActionId | null;
  /**
   * The entry as the mouse reported it. Macros, keyboard keys and shell
   * commands have no action in this app, and rebuilding a slot from actions
   * alone would erase them from flash, so the bytes are kept to be resent.
   */
  raw: Uint8Array;
}

export interface OnboardSlotConfig {
  index: number;
  bindings: OnboardBinding[];
}

const keyActions = new Map<string, MouseActionId>();
const functionActions = new Map<number, MouseActionId>();
for (const [id, action] of Object.entries(actions) as [MouseActionId, EncodedAction][]) {
  if (action.kind === 'key') keyActions.set(`${action.keyType}:${action.keyCode}`, id);
  else if (action.kind === 'function') functionActions.set(action.functionId, id);
}

/** The declared length, encoded across the two header bytes as the writer does. */
function declaredLength(entry: Uint8Array): number {
  return ((entry[0] & 0xf0) << 4) | entry[1];
}

function namedAction(type: number, payload: Uint8Array): MouseActionId | null {
  if (type === CONFIG_TYPE_MOUSE_KEY && payload.length >= 3) {
    // [mod1, key_type, key_code, mod2]; a modifier has no action of its own.
    return payload[0] === 0 ? (keyActions.get(`${payload[1]}:${payload[2]}`) ?? null) : null;
  }
  if (type === CONFIG_TYPE_MOUSE_FUNCTION && payload.length >= 2) {
    // [touch_type, function, value_lo, value_hi]
    return functionActions.get(payload[1]) ?? null;
  }
  return null;
}

/**
 * Decodes one entry. Returns null only for bytes that are not a configuration
 * event at all; an entry this app cannot name still comes back, with `action`
 * null and `raw` intact.
 */
export function decodeOnboardEntry(entry: Uint8Array): OnboardBinding | null {
  if (entry.length < 4) return null;
  if ((entry[0] & 0x0f) !== CMD_CONFIG) return null;
  if (entry.length < declaredLength(entry)) return null;

  const count = entry[3];
  if (count > MAX_KEY_IDS || 4 + count > entry.length) {
    return { keyIds: [], action: null, raw: entry.slice() };
  }
  const keyIds = [...entry.slice(4, 4 + count)];
  return {
    keyIds,
    action: namedAction(entry[2], entry.slice(4 + count)),
    raw: entry.slice(),
  };
}

/**
 * Assembles the delimited dump. Feed it every 0x14 payload; it answers with the
 * collected slots once the terminator arrives, and null until then.
 */
export class OnboardConfigCollector {
  private readonly slots = new Map<number, OnboardBinding[]>();
  private current: number | null = null;

  push(payload: Uint8Array): OnboardSlotConfig[] | null {
    if (payload.length === 0) return null;
    if (payload.length === 1) {
      if (payload[0] === END_OF_DUMP) return this.finish();
      this.current = payload[0];
      // The marker restarts the slot: a redump replaces, never appends.
      this.slots.set(this.current, []);
      return null;
    }
    if (this.current === null) return null;
    const binding = decodeOnboardEntry(payload);
    if (binding) this.slots.get(this.current)?.push(binding);
    return null;
  }

  private finish(): OnboardSlotConfig[] {
    const collected = [...this.slots.entries()]
      .map(([index, bindings]) => ({ index, bindings }))
      .sort((a, b) => a.index - b.index);
    this.slots.clear();
    this.current = null;
    return collected;
  }
}

/**
 * Rewrites the button mappings of `base` with what a slot actually holds.
 *
 * A key the dump never mentions holds nothing, so it reads back as disabled —
 * that is the difference between showing the mouse and showing the app's own
 * assumption. Entries with no name in this app are left alone: the driver
 * resends their bytes, and overwriting the button with a guess would be the
 * same mistake in the other direction.
 *
 * DPI, polling and the parameters are not in the dump. Only the active slot
 * reports those, through the query JSON, so they stay as they came in `base`.
 */
export function settingsFromSlot(base: MouseSettings, slot: OnboardSlotConfig): MouseSettings {
  const buttons = { ...base.buttons };
  for (const buttonId of Object.keys(buttons)) buttons[buttonId] = 'desativado';

  const rPlus = base.rPlus ? { ...base.rPlus, buttons: { ...base.rPlus.buttons } } : undefined;
  if (rPlus) {
    for (const buttonId of Object.keys(rPlus.buttons)) rPlus.buttons[buttonId] = 'desativado';
  }

  for (const binding of slot.bindings) {
    if (binding.action === null) continue;
    if (binding.keyIds.length === 1) {
      const buttonId = buttonIdsByKeyId.get(binding.keyIds[0]);
      if (buttonId && buttonId in buttons) buttons[buttonId] = binding.action;
      continue;
    }
    if (binding.keyIds.length !== 2 || !rPlus) continue;
    const activator = buttonIdsByKeyId.get(binding.keyIds[0]);
    const target = buttonIdsByKeyId.get(binding.keyIds[1]);
    if (!activator || !target || !(target in rPlus.buttons)) continue;
    rPlus.activatorButtonId = activator;
    rPlus.buttons[target] = binding.action;
  }

  // A key the app cannot name still holds something; leaving it disabled would
  // claim the button is free when it is not.
  for (const binding of slot.bindings) {
    if (binding.action !== null || binding.keyIds.length !== 1) continue;
    const buttonId = buttonIdsByKeyId.get(binding.keyIds[0]);
    if (buttonId && buttonId in buttons) buttons[buttonId] = base.buttons[buttonId];
  }

  return { ...base, buttons, ...(rPlus ? { rPlus } : {}) };
}
