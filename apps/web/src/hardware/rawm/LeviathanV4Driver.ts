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
  applySettingsToMouseParam,
  encodeMouseParamBody,
  parseMouseParamState,
  type RawmMouseParamState,
} from './mouseParamSnapshot';
import { subscribeToNotifications } from './notifications';
import { frameEvent, withProtocolEnvelope } from './protocol';

const ACTION_SAVE_CONFIG_TO_FDS = 0x34;
const TOUCH_TYPE_PRESS = 0x02;
const MOUSE_KEY_TYPE_MKEY = 0x01;
const MOUSE_KEY_TYPE_WHEEL = 0x03;

/**
 * Key ids as the mouse reports them in its own MOUSE_CONFIG dump: 0x0a left,
 * 0x0b right, 0x0c middle, 0x0e M4, 0x0f M5, 0x10 the DPI key. 0x0d is a
 * seventh key bound to FUNCTION_SHOW_POWER, which the official UI leaves
 * unlabelled, and the seven together match the seven debounce delays in `kd`.
 *
 * Earlier values here were 1 to 7, which are not key ids at all. That is why
 * every mapping written from this driver was accepted and ignored.
 */
const physicalKeyIds: Record<string, number> = {
  esquerdo: 0x0a,
  direito: 0x0b,
  central: 0x0c,
  'lateral-traseiro': 0x0e,
  'lateral-dianteiro': 0x0f,
  dpi: 0x10,
};

type EncodedAction =
  | { kind: 'key'; keyType: number; keyCode: number }
  | { kind: 'function'; functionId: number }
  | { kind: 'disabled' };

const actions: Record<MouseActionId, EncodedAction> = {
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

/**
 * The seventh key has no control in the editor, so nothing in settings would
 * ever rebuild it. CONFIG_RESET clears it like any other, and a set that leaves
 * it out silently drops the battery indicator from the mouse.
 */
const SHOW_POWER_KEY_ID = 0x0d;
const FUNCTION_SHOW_POWER = 0x0e;

/**
 * Builds the button mapping events.
 *
 * CONFIG_RESET clears every mapping the mouse holds, so this has to be the
 * complete set, not a delta: whatever it omits stops working until a power
 * cycle. That includes the seventh key, which the editor never touches.
 */
export function mappingEvents(settings: MouseSettings): Uint8Array[] {
  const events: Uint8Array[] = [];
  for (const [buttonId, action] of Object.entries(settings.buttons)) {
    const keyId = physicalKeyIds[buttonId];
    if (keyId === undefined) throw new Error(`Botao RAWM desconhecido: ${buttonId}.`);
    const event = encodeLeviathanAction([keyId], action);
    if (event) events.push(event);
  }
  if (settings.rPlus) {
    const activator = physicalKeyIds[settings.rPlus.activatorButtonId];
    if (activator === undefined) throw new Error('Ativador R-Plus RAWM invalido.');
    for (const [buttonId, action] of Object.entries(settings.rPlus.buttons)) {
      if (buttonId === settings.rPlus.activatorButtonId) continue;
      const target = physicalKeyIds[buttonId];
      if (target === undefined) throw new Error(`Botao R-Plus RAWM desconhecido: ${buttonId}.`);
      const event = encodeLeviathanAction([activator, target], action);
      if (event) events.push(event);
    }
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

  constructor(
    private readonly transport: HardwareTransport,
    rawSnapshot: Record<string, unknown>,
    private readonly crcSupported: boolean,
  ) {
    this.snapshot = parseMouseParamState(rawSnapshot);
  }

  /**
   * Applies to the session without touching flash: a power cycle restores what
   * the mouse has saved. Mappings only survive inside the block CONFIG_RESET
   * opens, so the complete set goes with them every time.
   */
  /** The mouse announces a DPI cycled by its own button; the editor follows. */
  onDeviceReport(listener: (report: DeviceReport) => void): () => void {
    return subscribeToNotifications(this.transport, (notification) => {
      if (notification.kind === 'dpi' || notification.kind === 'dpi-xy') {
        listener({ kind: 'dpi', value: notification.value });
      }
    });
  }

  applyToSession(settings: PeripheralSettings): Promise<void> {
    return this.enqueue(async () => {
      const selected = mouseSettings(settings);
      await this.sendEvent(encodeConfigReset());
      await this.writeConfigurationBody(selected);
    });
  }

  /**
   * Writes an onboard profile, which persists: the saves around the body are
   * what commit it, and a power cycle no longer undoes the change.
   */
  writeProfile(slotIndex: number, _name: string, settings: PeripheralSettings): Promise<void> {
    if (!Number.isInteger(slotIndex) || slotIndex < 1 || slotIndex > 255) {
      return Promise.reject(new RangeError('Indice de perfil RAWM invalido.'));
    }
    return this.enqueue(async () => {
      const selected = mouseSettings(settings);
      await this.sendEvent(encodeConfigReset());
      await this.sendEvent(encodeAction(ACTION_SAVE_CONFIG_TO_FDS, 1 | ((slotIndex - 1) << 8)));
      await this.writeConfigurationBody(selected);
      await this.sendEvent(encodeAction(ACTION_SAVE_CONFIG_TO_FDS, 0));
    });
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const current = this.tail.then(operation, operation);
    this.tail = current.catch(() => undefined);
    return current;
  }

  private async writeConfigurationBody(settings: MouseSettings): Promise<void> {
    const next = applySettingsToMouseParam(this.snapshot, settings);
    await this.sendEvent(encodeMouseParamSnapshot(encodeMouseParamBody(next)));
    for (const event of mappingEvents(settings)) await this.sendEvent(event);
    this.snapshot = next;
  }

  private async sendEvent(inner: Uint8Array): Promise<void> {
    const event = withProtocolEnvelope(inner, this.crcSupported);
    for (const report of frameEvent(event, true)) {
      await this.transport.send({ reportId: 0, data: report });
    }
    await pause(8);
  }
}
