import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMouseStore } from '../../store/mouseStore';
import { ProfilesSection } from './ProfilesSection';

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

describe('ProfilesSection', () => {
  it('renderiza um slot por slot onboard declarado', async () => {
    await open('mock-vanguard');
    render(<ProfilesSection />);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('marca o slot vazio como vazio em vez de mostrar um card em branco', async () => {
    await open('mock-vanguard');
    render(<ProfilesSection />);
    expect(screen.getAllByText('Slot vazio')).toHaveLength(3);
  });

  it('gravar num slot vazio grava o draft atual (não o slot ativo) naquele índice na store', async () => {
    await open('mock-vanguard');
    render(<ProfilesSection />);

    vi.useFakeTimers();
    // Muda o draft para que ele deixe de bater com o que está no slot ativo —
    // assim o teste só passa se o slot vazio ganhar o draft, não uma cópia
    // do que já estava salvo no slot 1.
    useMouseStore.getState().patchDraft((draft) => {
      draft.pollingRate = 8000;
    });
    await vi.runAllTimersAsync();

    fireEvent.click(screen.getAllByRole('button', { name: 'Gravar aqui' })[0]!);
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    const { session } = useMouseStore.getState();
    expect(session!.slots[1]!.profile!.pollingRate).toBe(8000);
  });
});
