import type { ButtonAction } from '@gearhub/shared';

const BUTTONS = {
  left: 'Clique esquerdo',
  right: 'Clique direito',
  middle: 'Clique do meio',
  back: 'Voltar',
  forward: 'Avançar',
} as const;

const DPI_MODES = {
  cycle: 'Alternar DPI',
  shift: 'DPI temporário',
  up: 'Aumentar DPI',
  down: 'Diminuir DPI',
} as const;

export function actionLabel(action: ButtonAction): string {
  switch (action.kind) {
    case 'button':
      return BUTTONS[action.button];
    case 'dpi':
      return DPI_MODES[action.mode];
    case 'keystroke':
      return action.keys.join(' + ');
    case 'scroll':
      return action.direction === 'up' ? 'Rolar para cima' : 'Rolar para baixo';
    case 'disabled':
      return 'Desativado';
    case 'macro':
      return 'Macro';
  }
}
