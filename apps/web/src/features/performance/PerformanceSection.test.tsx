import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMouseStore } from '../../store/mouseStore';
import { PerformanceSection } from './PerformanceSection';

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

describe('PerformanceSection', () => {
  it('mostra a estimativa de autonomia do polling rate ativo', async () => {
    await open('mock-vanguard');
    render(<PerformanceSection />);
    expect(screen.getByText('45–56 h')).toBeInTheDocument();
  });

  it('omite a estimativa quando o mouse não declara autonomia', async () => {
    await open('mock-scout');
    render(<PerformanceSection />);
    expect(screen.queryByText(/Autonomia estimada/i)).not.toBeInTheDocument();
  });
});
