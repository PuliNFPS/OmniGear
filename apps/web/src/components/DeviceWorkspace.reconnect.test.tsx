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
 * "Reconectar" must wait for the device to come back before repeating the
 * apply that failed; repeating it while the device is still offline does
 * nothing and nothing repeats it afterwards.
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
    entries: { [offline.id]: { ...initialEntry(offline), status: 'falha-aplicacao' } },
  });
});

afterEach(() => {
  cleanup();
  useEditorStore.getState().forget([offline.id]);
  unregisterDeviceDriver(offline.id);
});

it('retries the failed apply only after the device is back', async () => {
  let comeBack!: (devices: Peripheral[]) => void;
  restoreMock.mockReturnValue(new Promise<Peripheral[]>((resolve) => (comeBack = resolve)));
  render(<Workspace />);

  fireEvent.click(screen.getByRole('button', { name: 'Reconectar' }));
  expect(applyToSession).not.toHaveBeenCalled();

  await act(async () => comeBack([structuredClone(online)]));

  expect(applyToSession).toHaveBeenCalledTimes(1);
});

it('does not retry when the device did not come back', async () => {
  restoreMock.mockResolvedValue([]);
  render(<Workspace />);

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Reconectar' }));
  });

  expect(applyToSession).not.toHaveBeenCalled();
});
