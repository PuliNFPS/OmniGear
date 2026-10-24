// @vitest-environment jsdom
import type { Peripheral } from '@gearhub/shared';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const restoreMock = vi.hoisted(() => vi.fn());

vi.mock('../hardware/deviceDiscovery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hardware/deviceDiscovery')>();
  return { ...actual, restoreAuthorizedDevices: restoreMock };
});

import { createDemoMouse } from '../hardware/demoDevices';
import { registerDeviceDriver, unregisterDeviceDriver } from '../hardware/deviceDriver';
import { useDeviceStore } from '../store/deviceStore';
import { initialEntry, useEditorStore } from '../store/editorStore';
import { DeviceWorkspace } from './DeviceWorkspace';

/**
 * "Reconectar" only reconnects. The mouse is still sending its memory dump when
 * the new driver registers, so repeating the failed operation here would race
 * it; repeating is "Tentar novamente"'s job.
 */

const offline: Peripheral = {
  ...createDemoMouse(),
  id: 'mouse-reconnect',
  demo: false,
  status: 'desconectado',
};
const online: Peripheral = { ...offline, status: 'conectado' };

const applyToSession = vi.fn(async () => {});

function Workspace() {
  const devices = useDeviceStore((state) => state.devices);
  return <DeviceWorkspace device={devices[0]} sectionId="geral" />;
}

beforeEach(() => {
  restoreMock.mockReset();
  applyToSession.mockClear();
  registerDeviceDriver(offline.id, { applyToSession, writeProfile: vi.fn(async () => {}) });
  useDeviceStore.setState({ devices: [structuredClone(offline)] });
  useEditorStore.setState({
    entries: {
      [offline.id]: {
        ...initialEntry(offline),
        draft: { ...initialEntry(offline).draft, pollingRate: 500 },
        status: 'falha-aplicacao',
      },
    },
  });
});

afterEach(() => {
  cleanup();
  useEditorStore.getState().forget([offline.id]);
  unregisterDeviceDriver(offline.id);
});

it('does not repeat the failed operation by itself after reconnecting', async () => {
  let comeBack!: (devices: Peripheral[]) => void;
  restoreMock.mockReturnValue(new Promise<Peripheral[]>((resolve) => (comeBack = resolve)));
  render(<Workspace />);
  const before = structuredClone(useEditorStore.getState().entries[offline.id].draft);

  fireEvent.click(screen.getByRole('button', { name: 'Reconectar' }));
  await act(async () => comeBack([structuredClone(online)]));

  expect(restoreMock).toHaveBeenCalledTimes(1);
  expect(applyToSession).not.toHaveBeenCalled();
  const entry = useEditorStore.getState().entries[offline.id];
  expect(entry.status).toBe('falha-aplicacao');
  expect(entry.draft).toEqual(before);
  expect(useDeviceStore.getState().devices[0].status).toBe('conectado');
});

it('leaves the entry untouched when the device did not come back', async () => {
  restoreMock.mockResolvedValue([]);
  render(<Workspace />);
  const before = structuredClone(useEditorStore.getState().entries[offline.id].draft);

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Reconectar' }));
  });

  expect(restoreMock).toHaveBeenCalledTimes(1);
  expect(applyToSession).not.toHaveBeenCalled();
  const entry = useEditorStore.getState().entries[offline.id];
  expect(entry.status).toBe('falha-aplicacao');
  expect(entry.draft).toEqual(before);
});
