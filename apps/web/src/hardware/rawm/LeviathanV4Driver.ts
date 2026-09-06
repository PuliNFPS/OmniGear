import type { MouseActionId, MouseSettings, PeripheralSettings } from '@gearhub/shared';
import {
  encodeMouseFunction,
  encodeMouseKey,
  encodeMouseParamSnapshot,
} from '../../core/coreBridge';
import { isMouseSettings } from '../../domain/settings';
import type { DeviceDriver } from '../deviceDriver';
import type { HardwareTransport } from '../WebHidTransport';
import {
  applySettingsToMouseParam,
  encodeMouseParamBody,
  parseMouseParamState,
  type RawmMouseParamState,
} from './mouseParamSnapshot';
import { frameEvent, withProtocolEnvelope } from './protocol';

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
 * Builds the button mapping events.
 *
 * Not sent yet. CONFIG_RESET clears every mapping the mouse holds, and this set
 * covers only the six buttons: the scroll wheel has no key id here, so applying
 * it would wipe the wheel and never restore it. Confirmed on hardware, where a
 * reset plus a single mapping left the wheel dead until a power cycle.
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
   * Writes the parameter block only.
   *
   * The parameter body is confirmed against hardware; the mapping sequence is
   * not, and sending it means a CONFIG_RESET that clears mappings this driver
   * cannot rebuild. Until the key ids and the wheel are known, changing a
   * parameter must not cost the user their scroll wheel.
   */
  applyToSession(settings: PeripheralSettings): Promise<void> {
    return this.enqueue(() => this.writeParameters(mouseSettings(settings)));
  }

  /**
   * Refused for now. Writing a profile means CONFIG_RESET, the unverified
   * mapping set and ACTION_SAVE_CONFIG_TO_FDS, and that last one persists to
   * flash: unlike everything else tried so far, a power cycle would not undo it.
   */
  writeProfile(slotIndex: number, _name: string, settings: PeripheralSettings): Promise<void> {
    void settings;
    return Promise.reject(
      new Error(
        'A gravacao de perfil do Leviathan V4 ainda nao foi verificada em hardware e grava na memoria do mouse. Consulte docs/smoke-test-leviathan-v4.md.',
      ),
    );
  }

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

  private async sendEvent(inner: Uint8Array): Promise<void> {
    const event = withProtocolEnvelope(inner, this.crcSupported);
    for (const report of frameEvent(event, true)) {
      await this.transport.send({ reportId: 0, data: report });
    }
    await pause(8);
  }
}
