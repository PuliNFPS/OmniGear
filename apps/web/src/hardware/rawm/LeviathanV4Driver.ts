import type { MouseActionId, MouseSettings, PeripheralSettings } from '@gearhub/shared';
import {
  dpiAxes,
  encodeAction,
  encodeConfigReset,
  encodeLeviathanShowPower,
  encodeMapping,
  encodeMouseParamSnapshot,
  frameEvent,
  leviathanKeyId,
  leviathanShowPowerKeyId,
  withProtocolEnvelope,
} from '../../core/coreBridge';
import { isMouseSettings } from '../../domain/settings';
import type { DeviceDriver, DeviceReport, DeviceState } from '../deviceDriver';
import type { HardwareTransport } from '../WebHidTransport';
import {
  applySettingsToMouseParam,
  encodeMouseParamBody,
  parseMouseParamState,
  type RawmMouseParamState,
} from './mouseParamSnapshot';
import { subscribeToNotifications } from './notifications';
import { OnboardConfigCollector, type OnboardSlotConfig } from './onboardConfig';
import { queryRawmDevice } from './session';

const ACTION_SAVE_CONFIG_TO_FDS = 0x34;

/** Every key set the editor rebuilds, as the signature and the writer see it. */
function editorKeySets(settings: MouseSettings): { keyIds: number[]; action: MouseActionId }[] {
  const sets: { keyIds: number[]; action: MouseActionId }[] = [];
  for (const [buttonId, action] of Object.entries(settings.buttons)) {
    const keyId = leviathanKeyId(buttonId);
    if (keyId === null) throw new Error(`Botao RAWM desconhecido: ${buttonId}.`);
    sets.push({ keyIds: [keyId], action });
  }
  if (settings.rPlus) {
    const activator = leviathanKeyId(settings.rPlus.activatorButtonId);
    if (activator === null) throw new Error('Ativador R-Plus RAWM invalido.');
    for (const [buttonId, action] of Object.entries(settings.rPlus.buttons)) {
      if (buttonId === settings.rPlus.activatorButtonId) continue;
      const target = leviathanKeyId(buttonId);
      if (target === null) throw new Error(`Botao R-Plus RAWM desconhecido: ${buttonId}.`);
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
    const event = encodeMapping(keyIds, action);
    if (event) events.push(event);
  }
  events.push(encodeLeviathanShowPower());
  return events;
}

const keyOf = (keyIds: number[]) => keyIds.join('-');

/** The seventh key is rebuilt identically on both sides, so it never differs. */
const isShowPower = (keyIds: number[]) =>
  keyIds.length === 1 && keyIds[0] === leviathanShowPowerKeyId();

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
      // O núcleo decide se a ação escreve algo; os bytes codificados são descartados.
      .filter(({ keyIds, action }) => encodeMapping(keyIds, action) !== null)
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
  private activeOnboardIndex: number;
  private readonly slotCount: number;
  private dpiRevision = 0;
  private slotRevision = 0;
  private applyingSlotRevision: number | null = null;
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
    this.slotCount = Array.isArray(rawSnapshot.ocs) ? rawSnapshot.ocs.length : 1;
    this.activeOnboardIndex = this.readOnboardIndex(rawSnapshot.oci ?? 0);
    // The dump answers the query the connect already sent, so it can land
    // before anything subscribes. Listening from here is what catches it.
    subscribeToNotifications(this.transport, (notification) => {
      if (notification.kind === 'dpi' || notification.kind === 'dpi-xy') {
        this.dpiRevision += 1;
        this.snapshot = { ...this.snapshot, resolution: notification.value };
        this.reportDpi();
        return;
      }
      if (notification.kind === 'onboard-index') {
        if (notification.index >= this.slotCount) return;
        if (notification.index !== this.activeOnboardIndex) this.slotRevision += 1;
        this.activeOnboardIndex = notification.index;
        this.appliedMappings = this.activeSlotSignature();
        for (const listener of this.reportListeners) {
          listener({ kind: 'active-profile', slotIndex: notification.index + 1 });
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
    return this.slots?.find((item) => item.index === this.activeOnboardIndex);
  }

  private activeSlotSignature(): string | null {
    const slot = this.activeSlot();
    return slot ? reportedMappings(slot) : null;
  }

  /** The mouse announces a DPI cycled by its own button; the editor follows. */
  onDeviceReport(listener: (report: DeviceReport) => void): () => void {
    this.reportListeners.add(listener);
    listener({ kind: 'active-profile', slotIndex: this.activeOnboardIndex + 1 });
    const dpi = dpiAxes(this.snapshot.resolution);
    listener({ kind: 'dpi', value: dpi.x, y: dpi.y });
    return () => {
      this.reportListeners.delete(listener);
    };
  }

  private readOnboardIndex(value: unknown): number {
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < 0 ||
      value >= this.slotCount
    ) {
      throw new Error('Indice onboard ausente ou invalido na resposta do mouse.');
    }
    return value;
  }

  private reportDpi(): void {
    const dpi = dpiAxes(this.snapshot.resolution);
    if (dpi.x === 0 || dpi.y === 0) return;
    for (const listener of this.reportListeners) {
      listener({ kind: 'dpi', value: dpi.x, y: dpi.y });
    }
  }

  readState(): Promise<DeviceState> {
    return this.enqueue(async () => {
      const { raw } = await queryRawmDevice(this.transport, { virtualMouse: true });
      const activeIndex = this.readOnboardIndex(raw.oci);
      const snapshot = parseMouseParamState(raw);
      this.activeOnboardIndex = activeIndex;
      this.snapshot = snapshot;
      this.appliedMappings = this.activeSlotSignature();
      return { activeProfileSlot: activeIndex + 1, dpi: dpiAxes(snapshot.resolution) };
    });
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
      this.applyingSlotRevision = this.slotRevision;
      try {
        const selected = mouseSettings(settings);
        const intended = intendedMappings(selected);
        if (this.appliedMappings !== null && this.appliedMappings === intended) {
          await this.writeParameters(selected);
          return;
        }
        await this.sendEvent(encodeConfigReset());
        await this.writeConfigurationBody(selected, intended);
      } catch (error) {
        this.appliedMappings = null;
        throw error;
      } finally {
        this.applyingSlotRevision = null;
      }
    });
  }

  /**
   * Writes an onboard profile, which persists: the saves around the body are
   * what commit it, and a power cycle no longer undoes the change. The whole
   * mapping set always goes, because the reset inside the bracket would
   * otherwise commit a slot with its mappings cleared.
   */
  writeProfile(slotIndex: number, _name: string, settings: PeripheralSettings): Promise<void> {
    if (!Number.isInteger(slotIndex) || slotIndex < 1 || slotIndex > this.slotCount) {
      return Promise.reject(new RangeError('Indice de perfil RAWM invalido.'));
    }
    return this.enqueue(async () => {
      const selected = mouseSettings(settings);
      await this.sendEvent(encodeConfigReset());
      await this.sendEvent(encodeAction(ACTION_SAVE_CONFIG_TO_FDS, 1 | ((slotIndex - 1) << 8)));
      await this.writeConfigurationBody(selected, intendedMappings(selected), slotIndex - 1);
      await this.sendEvent(encodeAction(ACTION_SAVE_CONFIG_TO_FDS, 0));
    });
  }

  /**
   * The vendor's Onboard config dropdown is an editing cursor, not a switch.
   * Loading it is local to the editor; only an explicit save calls writeProfile.
   * No mouse-side switch command has been verified. IQ_SET_PROFILE_ID (0x40)
   * belongs to HS keyboards; see docs/rawm-onboard-config.md §5.
   * Notification 0x22 and readState supply the active index independently.
   */

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const current = this.tail.then(operation, operation);
    this.tail = current.then(
      () => undefined,
      () => undefined,
    );
    return current;
  }

  private async writeParameters(settings: MouseSettings): Promise<void> {
    const next = applySettingsToMouseParam(this.snapshot, settings);
    const revision = this.dpiRevision;
    await this.sendEvent(encodeMouseParamSnapshot(encodeMouseParamBody(next)));
    // A button report during the send is newer than the value being sent.
    this.snapshot =
      revision === this.dpiRevision ? next : { ...next, resolution: this.snapshot.resolution };
  }

  private async writeConfigurationBody(
    settings: MouseSettings,
    intended: string,
    onboardIndex = this.activeOnboardIndex,
  ): Promise<void> {
    // Cleared before the set goes out: a failure part way through leaves the
    // mouse holding neither, and the next apply has to write everything again.
    this.appliedMappings = null;
    await this.writeParameters(settings);
    for (const event of mappingEvents(settings)) await this.sendEvent(event);
    for (const event of this.preservedEvents(settings, onboardIndex)) await this.sendEvent(event);
    this.appliedMappings = intended;
  }

  /**
   * Entries the mouse reported that this app has no action for — macros,
   * keyboard keys, shell commands. Rebuilding a slot from actions alone would
   * erase them from flash, so the bytes go back out untouched. Anything the
   * editor rebuilds is left out: two events for one key would fight.
   */
  private preservedEvents(settings: MouseSettings, onboardIndex: number): Uint8Array[] {
    const slot = this.slots?.find((item) => item.index === onboardIndex);
    if (!slot) return [];
    const rebuilt = new Set(editorKeySets(settings).map(({ keyIds }) => keyOf(keyIds)));
    rebuilt.add(keyOf([leviathanShowPowerKeyId()]));
    return slot.bindings
      .filter((binding) => binding.action === null && !rebuilt.has(keyOf(binding.keyIds)))
      .map((binding) => binding.raw);
  }

  private async sendEvent(inner: Uint8Array): Promise<void> {
    const checkSlot = () => {
      if (this.applyingSlotRevision !== null && this.applyingSlotRevision !== this.slotRevision) {
        throw new Error(
          'A memória ativa mudou durante a aplicação. Revise o perfil antes de aplicar novamente.',
        );
      }
    };
    checkSlot();
    const event = withProtocolEnvelope(inner, this.crcSupported);
    for (const report of frameEvent(event, true)) {
      checkSlot();
      await this.transport.send({ reportId: 0, data: report });
    }
    await pause(8);
    checkSlot();
  }
}
