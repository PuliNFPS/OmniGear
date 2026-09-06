import type { MouseActionId, MouseSettings, PeripheralSettings } from '@gearhub/shared';
import {
  encodeAction,
  encodeConfigReset,
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
import { queryRawmDevice } from './session';

const ACTION_SAVE_CONFIG_TO_FDS = 0x34;
const TOUCH_TYPE_PRESS = 0x02;
const MOUSE_KEY_TYPE_MKEY = 0x01;
const MOUSE_KEY_TYPE_WHEEL = 0x03;

const physicalKeyIds: Record<string, number> = {
  esquerdo: 1,
  central: 2,
  direito: 3,
  'lateral-traseiro': 5,
  'lateral-dianteiro': 6,
  dpi: 7,
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
  'rolagem-cima': { kind: 'key', keyType: MOUSE_KEY_TYPE_WHEEL, keyCode: 0x41 },
  'rolagem-baixo': { kind: 'key', keyType: MOUSE_KEY_TYPE_WHEEL, keyCode: 0x3f },
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

function mappingEvents(settings: MouseSettings): Uint8Array[] {
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

  applyToSession(settings: PeripheralSettings): Promise<void> {
    return this.enqueue(() => this.writeCompleteConfiguration(mouseSettings(settings)));
  }

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

      const verified = await queryRawmDevice(this.transport, { virtualMouse: true });
      const readBack = parseMouseParamState(verified.raw);
      const expected = applySettingsToMouseParam(this.snapshot, selected);
      if (
        readBack.pollingRate !== expected.pollingRate ||
        readBack.powerMode !== expected.powerMode ||
        readBack.txOutputPower !== expected.txOutputPower
      ) {
        throw new Error('O Leviathan V4 nao confirmou a gravacao do perfil.');
      }
      this.snapshot = readBack;
    });
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const current = this.tail.then(operation, operation);
    this.tail = current.catch(() => undefined);
    return current;
  }

  private async writeCompleteConfiguration(settings: MouseSettings): Promise<void> {
    await this.sendEvent(encodeConfigReset());
    await this.writeConfigurationBody(settings);
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
