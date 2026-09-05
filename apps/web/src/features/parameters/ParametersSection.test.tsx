import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMouseStore } from '../../store/mouseStore';
import { ParametersSection } from './ParametersSection';

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

describe('ParametersSection', () => {
  it('renderiza todos os controles do mouse completo', async () => {
    await open('mock-vanguard');
    render(<ParametersSection />);
    expect(screen.getByLabelText('Sincronização de movimento')).toBeInTheDocument();
    expect(screen.getByLabelText('Altura de rastreio')).toBeInTheDocument();
    expect(screen.getByLabelText('Rotação do sensor')).toBeInTheDocument();
    expect(screen.getByText('1.5 mm')).toBeInTheDocument();
  });

  it('não renderiza controles que o mouse não declara — nunca desabilitados', async () => {
    await open('mock-scout');
    render(<ParametersSection />);
    expect(screen.getByLabelText('Sincronização de movimento')).toBeInTheDocument();
    expect(screen.queryByLabelText('Altura de rastreio')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Rotação do sensor')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Correção de ondulação')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Atraso antirrepique')).toBeInTheDocument();
    expect(screen.queryByLabelText('Suspensão')).not.toBeInTheDocument();
  });
});
