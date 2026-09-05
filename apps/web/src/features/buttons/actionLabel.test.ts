import type { ButtonAction } from '@gearhub/shared';
import { describe, expect, it } from 'vitest';
import { actionLabel } from './actionLabel';

describe('actionLabel', () => {
  it('descreve cada variante da união sem cair num rótulo genérico', () => {
    const cases: [ButtonAction, string][] = [
      [{ kind: 'button', button: 'left' }, 'Clique esquerdo'],
      [{ kind: 'dpi', mode: 'cycle' }, 'Alternar DPI'],
      [{ kind: 'keystroke', keys: ['Ctrl', 'C'] }, 'Ctrl + C'],
      [{ kind: 'scroll', direction: 'up' }, 'Rolar para cima'],
      [{ kind: 'disabled' }, 'Desativado'],
    ];
    for (const [action, expected] of cases) expect(actionLabel(action)).toBe(expected);
  });
});
