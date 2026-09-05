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

    fireEvent.click(screen.getByRole('button', { name: 'Gravar no slot 2' }));
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    const { session } = useMouseStore.getState();
    expect(session!.slots[1]!.profile!.pollingRate).toBe(8000);
  });

  it('cada ação de slot tem um nome acessível que a distingue das outras', async () => {
    await open('mock-vanguard');
    render(<ProfilesSection />);

    // As 3 réplicas vazias (slots 2, 3, 4) teriam o mesmo nome acessível
    // "Gravar aqui" se não fosse o aria-label por índice — é exatamente o
    // problema que este teste existe para travar.
    expect(screen.getByRole('button', { name: 'Gravar no slot 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gravar no slot 3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gravar no slot 4' })).toBeInTheDocument();
  });

  it('carrega direto, sem diálogo, quando o draft não está sujo', async () => {
    await open('mock-vanguard');
    render(<ProfilesSection />);

    // Grava o draft (idêntico ao slot ativo, logo não sujo) num slot vazio.
    // saveToSlot também torna esse slot o ativo, deixando o slot 1 — ainda
    // com o perfil original — preenchido e não ativo: um alvo válido de carga.
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Gravar no slot 2' }));
    await vi.runAllTimersAsync();

    expect(useMouseStore.getState().session!.slots[0]!.profile!.pollingRate).toBe(1000);
    expect(useMouseStore.getState().session!.draft.pollingRate).toBe(1000);

    fireEvent.click(screen.getByRole('button', { name: 'Carregar o slot 1' }));
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useMouseStore.getState().session!.activeSlotIndex).toBe(1);
  });

  it('carregar por cima de um draft sujo exige confirmação antes de substituir o draft', async () => {
    await open('mock-vanguard');
    render(<ProfilesSection />);

    // Grava no slot 2 para ter um slot preenchido e não ativo (o slot 1)
    // para carregar depois.
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Gravar no slot 2' }));
    await vi.runAllTimersAsync();

    // Suja o draft de um jeito que não bate com o que está gravado no slot 1
    // nem no slot 2 — só passa se o valor vier do slot carregado, não do que
    // já estava na tela.
    useMouseStore.getState().patchDraft((draft) => {
      draft.pollingRate = 4000;
    });
    await vi.runAllTimersAsync();

    fireEvent.click(screen.getByRole('button', { name: 'Carregar o slot 1' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // O diálogo sozinho não troca nada.
    expect(useMouseStore.getState().session!.draft.pollingRate).toBe(4000);

    fireEvent.click(screen.getByRole('button', { name: 'Carregar' }));
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useMouseStore.getState().session!.draft.pollingRate).toBe(1000);
  });
});
