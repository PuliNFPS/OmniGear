import type { MouseActionId, MouseSettings, PeripheralSettings } from '@gearhub/shared';
import {
  encodeAction,
  encodeConfigReset,
  encodeMouseFunction,
  encodeMouseKey,
  encodeMouseParamSnapshot,
} from '../../core/coreBridge';
import { isMouseSettings } from '../../domain/settings';
import type { DeviceDriver, DeviceReport } from '../deviceDriver';
import type { HardwareTransport } from '../WebHidTransport';
import {
  FUNCTION_SHOW_POWER,
  SHOW_POWER_KEY_ID,
  TOUCH_TYPE_PRESS,
  actions,
  physicalKeyIds,
} from './leviathanV4Keys';
import {
  applySettingsToMouseParam,
  encodeMouseParamBody,
  parseMouseParamState,
  type RawmMouseParamState,
} from './mouseParamSnapshot';
import { subscribeToNotifications } from './notifications';
import { OnboardConfigCollector, type OnboardSlotConfig } from './onboardConfig';
import { frameEvent, withProtocolEnvelope } from './protocol';

export { actions, physicalKeyIds, SHOW_POWER_KEY_ID, FUNCTION_SHOW_POWER };
export type { EncodedAction } from './leviathanV4Keys';

const ACTION_SAVE_CONFIG_TO_FDS = 0x34;

export function encodeLeviathanAction(
  keyIds: number[],
  actionId: MouseActionId,
): Uint8Array | null {
  const action = actions[actionId];
  if (action.kind === 'disabled') return null;
  if (action.kind === 'function') {
    return encodeMouseFunction({
      keyIds,
      touchType: TOUCH_TYPE_PRESS,
      functionId: action.functionId,
    });
  }
  return encodeMouseKey({ keyIds, keyType: action.keyType, keyCode: action.keyCode });
}

/** Every key set the editor rebuilds, as the signature and the writer see it. */
function editorKeySets(settings: MouseSettings): { keyIds: number[]; action: MouseActionId }[] {
  const sets: { keyIds: number[]; action: MouseActionId }[] = [];
  for (const [buttonId, action] of Object.entries(settings.buttons)) {
    const keyId = physicalKeyIds[buttonId];
    if (keyId === undefined) throw new Error(`Botao RAWM desconhecido: ${buttonId}.`);
    sets.push({ keyIds: [keyId], action });
  }
  if (settings.rPlus) {
    const activator = physicalKeyIds[settings.rPlus.activatorButtonId];
    if (activator === undefined) throw new Error('Ativador R-Plus RAWM invalido.');
    for (const [buttonId, action] of Object.entries(settings.rPlus.buttons)) {
      if (buttonId === settings.rPlus.activatorButtonId) continue;
      const target = physicalKeyIds[buttonId];
      if (target === undefined) throw new Error(`Botao R-Plus RAWM desconhecido: ${buttonId}.`);
      sets.push({ keyIds: [activator, target], action });
    }
  }
  return sets;
}

/**
 * Builds the button mapping events.
 *
 * CONFIG_RESET clears every mapping the mouse holds, so this has to be the
 * complete set, not a delta: whatever it omits stops working until a power
 * cycle. That includes the seventh key, which the editor never touches.
 */
export function mappingEvents(settings: MouseSettings): Uint8Array[] {
  const events: Uint8Array[] = [];
  for (const { keyIds, action } of editorKeySets(settings)) {
    const event = encodeLeviathanAction(keyIds, action);
    if (event) events.push(event);
  }
  events.push(
    encodeMouseFunction({
      keyIds: [SHOW_POWER_KEY_ID],
      touchType: TOUCH_TYPE_PRESS,
      functionId: FUNCTION_SHOW_POWER,
    }),
  );
  return events;
}

const keyOf = (keyIds: number[]) => keyIds.join('-');

/** The seventh key is rebuilt identically on both sides, so it never differs. */
const isShowPower = (keyIds: number[]) => keyIds.length === 1 && keyIds[0] === SHOW_POWER_KEY_ID;

function signatureOf(entries: [string, string][]): string {
  return entries
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('|');
}

/** What the settings would leave on the mouse. A disabled key writes nothing. */
function intendedMappings(settings: MouseSettings): string {
  return signatureOf(
    editorKeySets(settings)
      .filter(({ action }) => actions[action].kind !== 'disabled')
      .map(({ keyIds, action }): [string, string] => [keyOf(keyIds), action]),
  );
}

/** What the mouse says it holds, named where this app has a name for it. */
function reportedMappings(slot: OnboardSlotConfig): string {
  return signatureOf(
    slot.bindings
      .filter((binding) => !isShowPower(binding.keyIds))
      .map((binding): [string, string] => [
        keyOf(binding.keyIds),
        binding.action ?? `raw:${[...binding.raw].join(',')}`,
      ]),
  );
}

function mouseSettings(settings: PeripheralSettings): MouseSettings {
  if (!isMouseSettings(settings))
    throw new TypeError('O Leviathan V4 requer configuracao de mouse.');
  return settings;
}

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class LeviathanV4Driver implements DeviceDriver {
  private snapshot: RawmMouseParamState;
  private tail: Promise<void> = Promise.resolve();
  private readonly collector = new OnboardConfigCollector();
  private slots: OnboardSlotConfig[] | null = null;
  private readonly slotListeners = new Set<(slots: OnboardSlotConfig[]) => void>();
  private readonly reportListeners = new Set<(report: DeviceReport) => void>();
  /**
   * What the mouse holds for the active slot, as a signature. Null means the
   * dump has not arrived, and then every apply rewrites the whole set: assuming
   * the mouse matches the app's defaults is what used to make the screen and
   * the mouse disagree.
   */
  private appliedMappings: string | null = null;

  constructor(
    private readonly transport: HardwareTransport,
    rawSnapshot: Record<string, unknown>,
    private readonly crcSupported: boolean,
  ) {
    this.snapshot = parseMouseParamState(rawSnapshot);
    // The dump answers the query the connect already sent, so it can land
    // before anything subscribes. Listening from here is what catches it.
    subscribeToNotifications(this.transport, (notification) => {
      if (notification.kind === 'dpi' || notification.kind === 'dpi-xy') {
        for (const listener of this.reportListeners) {
          listener({ kind: 'dpi', value: notification.value });
        }
        return;
      }
      if (notification.kind !== 'onboard-config') return;
      const collected = this.collector.push(notification.payload);
      if (!collected) return;
      this.slots = collected;
      this.appliedMappings = this.activeSlotSignature();
      for (const listener of this.slotListeners) listener(collected);
    });
  }

  private activeSlot(): OnboardSlotConfig | undefined {
    return this.slots?.find((item) => item.index === this.snapshot.onboard);
  }

  private activeSlotSignature(): string | null {
    const slot = this.activeSlot();
    return slot ? reportedMappings(slot) : null;
  }

  /** The mouse announces a DPI cycled by its own button; the editor follows. */
  onDeviceReport(listener: (report: DeviceReport) => void): () => void {
    this.reportListeners.add(listener);
    return () => {
      this.reportListeners.delete(listener);
    };
  }

  /**
   * The mappings each onboard slot holds. A dump already collected is replayed
   * at once, so a subscriber that arrives late still gets it.
   */
  onOnboardProfiles(listener: (slots: OnboardSlotConfig[]) => void): () => void {
    this.slotListeners.add(listener);
    if (this.slots) listener(this.slots);
    return () => {
      this.slotListeners.delete(listener);
    };
  }

  /**
   * Applies to the session without touching flash: a power cycle restores what
   * the mouse has saved.
   *
   * Mappings only survive inside the block CONFIG_RESET opens, so they go as a
   * complete set whenever they change. When only DPI, polling or a parameter
   * moved, the mouse already holds the right mappings and the parameter block
   * goes alone — one event instead of fourteen.
   */
  applyToSession(settings: PeripheralSettings): Promise<void> {
    return this.enqueue(async () => {
      const selected = mouseSettings(settings);
      const intended = intendedMappings(selected);
      if (this.appliedMappings !== null && this.appliedMappings === intended) {
        await this.writeParameters(selected);
        return;
      }
      await this.sendEvent(encodeConfigReset());
      await this.writeConfigurationBody(selected, intended);
    });
  }

  /**
   * Writes an onboard profile, which persists: the saves around the body are
   * what commit it, and a power cycle no longer undoes the change. The whole
   * mapping set always goes, because the reset inside the bracket would
   * otherwise commit a slot with its mappings cleared.
   */
  writeProfile(slotIndex: number, _name: string, settings: PeripheralSettings): Promise<void> {
    if (!Number.isInteger(slotIndex) || slotIndex < 1 || slotIndex > 255) {
      return Promise.reject(new RangeError('Indice de perfil RAWM invalido.'));
    }
    return this.enqueue(async () => {
      const selected = mouseSettings(settings);
      await this.sendEvent(encodeConfigReset());
      await this.sendEvent(encodeAction(ACTION_SAVE_CONFIG_TO_FDS, 1 | ((slotIndex - 1) << 8)));
      await this.writeConfigurationBody(selected, intendedMappings(selected));
      await this.sendEvent(encodeAction(ACTION_SAVE_CONFIG_TO_FDS, 0));
    });
  }

  /**
   * There is deliberately no `switchProfile` here.
   *
   * The vendor library has no command for it. `device_info.onboard` is only
   * ever read from the query's `ob`, never written to select a slot, and the
   * field that names the active slot is `oci`, a different one. What does exist
   * is NOTIFY_TYPE_MOUSE_ONBOARD_INDEX (0x22): the mouse announcing that it
   * switched, which it does on its own when its button is pressed.
   *
   * Sending a parameter block to force the index would also carry the previous
   * slot's DPI, polling and parameters — the query only ever described the
   * active slot — so it would overwrite the destination with the source. The
   * editor falls back to writing the settings instead, which is safe.
   */

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const current = this.tail.then(operation, operation);
    this.tail = current.catch(() => undefined);
    return current;
  }

  private async writeParameters(settings: MouseSettings): Promise<void> {
    const next = applySettingsToMouseParam(this.snapshot, settings);
    await this.sendEvent(encodeMouseParamSnapshot(encodeMouseParamBody(next)));
    this.snapshot = next;
  }

  private async writeConfigurationBody(settings: MouseSettings, intended: string): Promise<void> {
    // Cleared before the set goes out: a failure part way through leaves the
    // mouse holding neither, and the next apply has to write everything again.
    this.appliedMappings = null;
    await this.writeParameters(settings);
    for (const event of mappingEvents(settings)) await this.sendEvent(event);
    for (const event of this.preservedEvents(settings)) await this.sendEvent(event);
    this.appliedMappings = intended;
  }

  /**
   * Entries the mouse reported that this app has no action for — macros,
   * keyboard keys, shell commands. Rebuilding a slot from actions alone would
   * erase them from flash, so the bytes go back out untouched. Anything the
   * editor rebuilds is left out: two events for one key would fight.
   */
  private preservedEvents(settings: MouseSettings): Uint8Array[] {
    const slot = this.activeSlot();
    if (!slot) return [];
    const rebuilt = new Set(editorKeySets(settings).map(({ keyIds }) => keyOf(keyIds)));
    rebuilt.add(keyOf([SHOW_POWER_KEY_ID]));
    return slot.bindings
      .filter((binding) => binding.action === null && !rebuilt.has(keyOf(binding.keyIds)))
      .map((binding) => binding.raw);
  }

  private async sendEvent(inner: Uint8Array): Promise<void> {
    const event = withProtocolEnvelope(inner, this.crcSupported);
    for (const report of frameEvent(event, true)) {
      await this.transport.send({ reportId: 0, data: report });
    }
    await pause(8);
  }
}
