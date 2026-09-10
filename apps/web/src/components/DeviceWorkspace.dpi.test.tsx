// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDeviceReports } from '../app/useDeviceReports';
import {
  registerDeviceDriver,
  unregisterDeviceDriver,
  type DeviceReport,
} from '../hardware/deviceDriver';
import { createLeviathanV4Peripheral } from '../hardware/rawm/leviathanV4';
import { leviathanV4QueryFixture } from '../hardware/rawm/leviathanV4Fixture';
import { useDeviceStore } from '../store/deviceStore';
import { useEditorStore } from '../store/editorStore';
import { DeviceWorkspace } from './DeviceWorkspace';

const device = createLeviathanV4Peripheral(
  { ...leviathanV4QueryFixture, cpi_l: [400, 800, 0, 0, 0, 0, 0, 0] },
  'dpi-test',
);
const applyToSession = vi.fn(async () => undefined);
let report: (report: DeviceReport) => void;

function Workspace() {
  const devices = useDeviceStore((state) => state.devices);
  useDeviceReports(devices);
  return <DeviceWorkspace device={devices[0]} sectionId="dpi" />;
}

beforeEach(() => {
  vi.useFakeTimers();
  useDeviceStore.setState({ devices: [structuredClone(device)] });
  registerDeviceDriver(device.id, {
    applyToSession,
    writeProfile: vi.fn(async () => undefined),
    onDeviceReport: (listener) => {
      report = listener;
      return () => {};
    },
  });
});
afterEach(() => {
  cleanup();
  useEditorStore.getState().forget([device.id]);
  unregisterDeviceDriver(device.id);
  vi.clearAllMocks();
  vi.useRealTimers();
});

it('follows the physical DPI button before any edit and allows website DPI above 800', async () => {
  render(<Workspace />);
  act(() => report({ kind: 'dpi', value: 400 }));
  expect(useEditorStore.getState().entries[device.id].draft).toMatchObject({
    activeStageId: 'estagio-1',
  });
  const field = screen.getByRole('spinbutton', { name: 'Estágio 1, sensibilidade em DPI' });
  expect(field.getAttribute('max')).toBe('45000');
  fireEvent.change(field, { target: { value: '2400' } });
  await act(() => vi.runAllTimersAsync());
  expect(applyToSession).toHaveBeenCalledWith(
    expect.objectContaining({
      dpiStages: expect.arrayContaining([expect.objectContaining({ x: 2400, y: 2400 })]),
    }),
  );
});

it('keeps the draft of another memory while the mouse reports its own DPI', async () => {
  render(<Workspace />);
  await act(() => useEditorStore.getState().loadProfile(device, 3));
  act(() => report({ kind: 'dpi', value: 400 }));
  expect(screen.getByText('Editando outra memória.')).toBeDefined();
  expect(useEditorStore.getState().entries[device.id]).toMatchObject({
    editingProfileSlot: 3,
    draft: { activeStageId: 'estagio-2' },
  });
  expect(applyToSession).not.toHaveBeenCalled();
});
