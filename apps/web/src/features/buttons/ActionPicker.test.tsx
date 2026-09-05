import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionPicker, OPTIONS } from './ActionPicker';

describe('ActionPicker', () => {
  it('abre com o diálogo nomeado pelo título e lista opções nomeadas, sem macro', () => {
    render(
      <ActionPicker open buttonLabel="Botão direito" onOpenChange={vi.fn()} onPick={vi.fn()} />,
    );

    expect(screen.getByRole('dialog', { name: 'Ação para Botão direito' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clique esquerdo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alternar DPI' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desativado' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /macro/i })).not.toBeInTheDocument();
  });

  it('não oferece a variante macro entre as opções, seja qual for o rótulo dela', () => {
    // Checagem estrutural sobre o dado, não sobre o texto exibido: uma opção
    // de macro rotulada de outro jeito (ex.: "Ação personalizada") ainda cairia aqui.
    expect(OPTIONS.every((option) => option.kind !== 'macro')).toBe(true);
  });

  it('escolher uma opção repassa a ação exata e fecha o diálogo', () => {
    const onPick = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ActionPicker open buttonLabel="Botão direito" onOpenChange={onOpenChange} onPick={onPick} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Alternar DPI' }));

    expect(onPick).toHaveBeenCalledWith({ kind: 'dpi', mode: 'cycle' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('fechado, não renderiza o diálogo', () => {
    render(
      <ActionPicker
        open={false}
        buttonLabel="Botão direito"
        onOpenChange={vi.fn()}
        onPick={vi.fn()}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
