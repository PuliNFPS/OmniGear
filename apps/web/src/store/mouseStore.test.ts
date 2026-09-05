import { DeviceDisconnectedError } from '@gearhub/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockDriver } from '../hardware/mockDriver';
import { useMouseStore } from './mouseStore';

const initial = useMouseStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  useMouseStore.setState(initial, true);
});
afterEach(() => vi.useRealTimers());

async function open(id = 'mock-vanguard') {
  const promise = useMouseStore.getState().openMouse(id);
  await vi.runAllTimersAsync();
  await promise;
}

describe('mouseStore', () => {
  it('agrupa edições rápidas numa única aplicação ao device', async () => {
    await open();
    const spy = vi.spyOn(useMouseStore.getState().driver!, 'applyLive');

    for (const rate of [125, 500, 1000, 4000]) {
      useMouseStore.getState().patchDraft((draft) => {
        draft.pollingRate = rate;
      });
    }
    await vi.runAllTimersAsync();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0].pollingRate).toBe(4000);
  });

  it('reverte o draft quando applyLive falha', async () => {
    await open();
    const before = useMouseStore.getState().session!.draft.pollingRate;
    vi.spyOn(useMouseStore.getState().driver!, 'applyLive').mockRejectedValue(new Error('nope'));

    useMouseStore.getState().patchDraft((draft) => {
      draft.pollingRate = 8000;
    });
    await vi.runAllTimersAsync();

    expect(useMouseStore.getState().session!.draft.pollingRate).toBe(before);
    expect(useMouseStore.getState().feedback?.type).toBe('error');
  });

  it('preserva o draft na desconexão e reaplica ao reconectar', async () => {
    await open();
    useMouseStore.getState().patchDraft((draft) => {
      draft.pollingRate = 8000;
    });
    await vi.runAllTimersAsync();

    const driver = useMouseStore.getState().driver as ReturnType<typeof createMockDriver>;
    driver.simulateDisconnect();
    expect(useMouseStore.getState().disconnected).toBe(true);
    expect(useMouseStore.getState().session!.draft.pollingRate).toBe(8000);

    driver.simulateReconnect();
    const spy = vi.spyOn(driver, 'applyLive');
    const promise = useMouseStore.getState().reconnect();
    await vi.runAllTimersAsync();
    await promise;

    expect(useMouseStore.getState().disconnected).toBe(false);
    expect(spy.mock.calls[0]![0].pollingRate).toBe(8000);
  });

  it('trata desconexão durante o apply sem mostrar toast de erro', async () => {
    await open();
    const before = useMouseStore.getState().session!.draft.pollingRate;
    vi.spyOn(useMouseStore.getState().driver!, 'applyLive').mockRejectedValue(
      new DeviceDisconnectedError(),
    );

    useMouseStore.getState().patchDraft((draft) => {
      draft.pollingRate = 8000;
    });
    await vi.runAllTimersAsync();

    const state = useMouseStore.getState();
    expect(state.disconnected).toBe(true);
    expect(state.feedback).toBeNull();
    expect(state.session!.draft.pollingRate).toBe(before);
  });

  it('limpa o dirty ao gravar no slot', async () => {
    await open();
    useMouseStore.getState().patchDraft((draft) => {
      draft.pollingRate = 8000;
    });
    await vi.runAllTimersAsync();

    const promise = useMouseStore.getState().saveToSlot(1);
    await vi.runAllTimersAsync();
    await promise;

    const { session } = useMouseStore.getState();
    expect(session!.slots[0]!.profile!.pollingRate).toBe(8000);
  });
});
