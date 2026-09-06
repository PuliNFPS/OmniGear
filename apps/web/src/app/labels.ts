import type {
  ConnectionKind,
  MouseActionId,
  MouseParameterId,
  Peripheral,
  PeripheralSettings,
} from '@gearhub/shared';
import { formatDpi } from '../domain/dpi';
import { isKeyboardSettings, isMouseSettings } from '../domain/settings';
import type { ConnectionFailure } from '../hardware/deviceDiscovery';

const deviceTypeLabels = { mouse: 'Mouse', keyboard: 'Teclado' } as const;

export const connectionLabels: Record<ConnectionKind, string> = {
  usb: 'USB',
  'sem-fio': 'Sem fio',
  bluetooth: 'Bluetooth',
};

/** Short identification shown under the device name: "Mouse · USB". */
export function describeDevice(device: Peripheral): string {
  return `${deviceTypeLabels[device.type]} · ${connectionLabels[device.connection]}`;
}

export const mouseActionLabels: Record<MouseActionId, string> = {
  'clique-esquerdo': 'Clique esquerdo',
  'clique-direito': 'Clique direito',
  'clique-central': 'Clique central',
  voltar: 'Voltar',
  avancar: 'Avançar',
  'dpi-ciclo': 'Alternar DPI',
  'dpi-aumentar': 'Aumentar DPI',
  'dpi-diminuir': 'Diminuir DPI',
  'rolagem-cima': 'Rolagem para cima',
  'rolagem-baixo': 'Rolagem para baixo',
  desativado: 'Desativado',
};

export const mouseParameterLabels: Record<MouseParameterId, { title: string; help: string }> = {
  motionSync: {
    title: 'Sincronização de movimento',
    help: 'Alinha a leitura do sensor ao envio dos relatórios.',
  },
  angleSnapping: {
    title: 'Correção de linha reta',
    help: 'Ajusta traços quase retos para retas perfeitas.',
  },
  rippleControl: {
    title: 'Correção de ondulação',
    help: 'Suaviza oscilações em movimentos rápidos.',
  },
  wirelessTurbo: {
    title: 'Turbo sem fio',
    help: 'Melhora a conexão 2,4 GHz em longas distâncias ou ambientes com interferência. Pode aumentar o consumo.',
  },
  liftOffDistance: {
    title: 'Altura de rastreio',
    help: 'Altura em que o sensor para de rastrear.',
  },
  sensorRotation: {
    title: 'Rotação do sensor',
    help: 'Gira o eixo do sensor em relação ao corpo do mouse.',
  },
  debounce: {
    title: 'Atraso antirrepique',
    help: 'Intervalo mínimo entre dois cliques reconhecidos.',
  },
  sleepTimeout: {
    title: 'Suspensão',
    help: 'Tempo sem uso até o dispositivo suspender.',
  },
};

export const connectionErrorMessages: Record<
  ConnectionFailure,
  { title: string; message: string }
> = {
  'sem-suporte': {
    title: 'Este navegador não oferece o recurso necessário',
    message:
      'A seleção de periféricos usa WebHID. Abra o OmniGear em um navegador com suporte ou explore a demonstração.',
  },
  permissao: {
    title: 'Permissão negada',
    message:
      'O navegador não autorizou o acesso ao dispositivo. Tente novamente e confirme a permissão na janela do navegador.',
  },
  'nao-reconhecido': {
    title: 'Modelo ainda não suportado',
    message:
      'O dispositivo foi selecionado, mas o OmniGear ainda não implementa o protocolo desse modelo.',
  },
  falha: {
    title: 'Não foi possível conectar',
    message: 'A comunicação com o dispositivo falhou. Verifique a conexão e tente novamente.',
  },
};

/** One-line summary of what a profile holds, used in the slot grid. */
export function describeSettings(device: Peripheral, settings: PeripheralSettings): string {
  if (device.type === 'mouse' && isMouseSettings(settings)) {
    const active = settings.dpiStages.find((stage) => stage.id === settings.activeStageId);
    const dpi = active ? `${formatDpi(active.x)} DPI` : 'Sem estágio ativo';
    return `${dpi} · ${settings.pollingRate.toLocaleString('pt-BR')} Hz`;
  }
  if (device.type === 'keyboard' && isKeyboardSettings(settings)) {
    const remaps = Object.keys(settings.keymap).length;
    const effect = device.capabilities.lighting?.effects.find(
      (item) => item.id === settings.lighting.effectId,
    );
    const remapText =
      remaps === 0
        ? 'Sem remapeamentos'
        : `${remaps} ${remaps === 1 ? 'tecla' : 'teclas'} remapeada${remaps === 1 ? '' : 's'}`;
    const lightingText = settings.lighting.enabled
      ? (effect?.label ?? 'Iluminação ativa')
      : 'Iluminação desligada';
    return `${remapText} · ${lightingText}`;
  }
  return '';
}
