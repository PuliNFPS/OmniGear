import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMouseStore } from '../../store/mouseStore';
import { ButtonsSection } from './ButtonsSection';

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

describe('ButtonsSection', () => {
  it('escolher uma ação no picker grava o binding no botão certo', async () => {
    await open('mock-vanguard');
    render(<ButtonsSection />);

    // "Lateral traseiro" é o botão `back`, remappable — não o clique
    // esquerdo, que vem `remappable: false` no fixture.
    fireEvent.click(screen.getByRole('button', { name: 'Lateral traseiro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Alternar DPI' }));

    expect(useMouseStore.getState().session!.draft.bindings.back).toEqual({
      kind: 'dpi',
      mode: 'cycle',
    });
  });
});
