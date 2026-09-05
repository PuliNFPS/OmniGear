import type { MouseButton } from '@gearhub/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MouseRender } from './MouseRender';

const buttons: MouseButton[] = [
  { id: 'left', label: 'Botão esquerdo', hotspot: { x: 0.25, y: 0.2 }, remappable: false },
  { id: 'right', label: 'Botão direito', hotspot: { x: 0.75, y: 0.2 }, remappable: true },
];

describe('MouseRender', () => {
  it('posiciona cada callout na coordenada normalizada do botão', () => {
    render(<MouseRender renderId="generic-5button" buttons={buttons} onSelectButton={vi.fn()} />);
    const left = screen.getByRole('button', { name: 'Botão esquerdo' });
    expect(left.style.left).toBe('25%');
    expect(left.style.top).toBe('20%');
    expect(left.style.transform).toBe('translate(-50%, -50%)');
  });

  it('renderiza um callout por botão declarado nas capabilities', () => {
    render(<MouseRender renderId="generic-5button" buttons={buttons} onSelectButton={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Botão direito' })).toBeInTheDocument();
  });
});
