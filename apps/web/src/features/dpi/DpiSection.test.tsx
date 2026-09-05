import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMouseStore } from '../../store/mouseStore';
import { DpiSection } from './DpiSection';

const initial = useMouseStore.getState();
afterEach(() => {
  useMouseStore.setState(initial, true);
  vi.useRealTimers();
});

async function open(id: string) {
  vi.useFakeTimers();
  const promise = useMouseStore.getState().openMouse(id);
  await vi.runAllTimersAsync();
  await promise;
  vi.useRealTimers();
}

describe('DpiSection', () => {
  it('renderiza um card por estágio do perfil', async () => {
    await open('mock-vanguard');
    render(<DpiSection />);
    expect(screen.getAllByRole('slider')).toHaveLength(4);
  });

  it('omite o controle de X/Y quando o mouse não suporta eixos independentes', async () => {
    await open('mock-scout');
    render(<DpiSection />);
    expect(screen.queryByLabelText(/eixos x\/y independentes/i)).not.toBeInTheDocument();
  });

  it('esconde a ação de adicionar quando o limite de estágios foi atingido', async () => {
    await open('mock-scout');
    useMouseStore.getState().patchDraft((draft) => {
      draft.dpi.stages = [
        { id: 'a', x: 400, y: 400, color: 'green' },
        { id: 'b', x: 800, y: 800, color: 'cyan' },
        { id: 'c', x: 1600, y: 1600, color: 'blue' },
      ];
    });
    render(<DpiSection />);
    expect(screen.queryByRole('button', { name: /adicionar estágio/i })).not.toBeInTheDocument();
  });
});
