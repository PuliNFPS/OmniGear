// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDeviceReports } from '../app/useDeviceReports';
import { registerDeviceDriver, unregisterDeviceDriver } from '../hardware/deviceDriver';
import { LeviathanV4Driver } from '../hardware/rawm/LeviathanV4Driver';
import { createLeviathanV4Peripheral } from '../hardware/rawm/leviathanV4';
import { leviathanV4QueryFixture as fixture } from '../hardware/rawm/leviathanV4Fixture';
import { frameEvent, withProtocolEnvelope } from '../hardware/rawm/protocol';
import { useDeviceStore } from '../store/deviceStore';
import { useEditorStore } from '../store/editorStore';
import { DeviceWorkspace } from './DeviceWorkspace';

/**
 * The DPI button, end to end through the real driver.
 *
 * A stubbed driver hid this: what the mouse announces only reaches the stage
 * list if the notification parses, the driver reports it, and the editor is
 * still pointing at the memory the mouse is running.
 */

const device = createLeviathanV4Peripheral(fixture, 'live-dpi');
/** The fixture holds 400, 800, 1600 and 3200, and is running the second. */
const DPI_1600 = [0x40, 0x06];
const DPI_3200 = [0x80, 0x0c];

function Workspace() {
  const devices = useDeviceStore((state) => state.devices);
  useDeviceReports(devices);
  return <DeviceWorkspace device={devices[0]} sectionId="dpi" />;
}

/** The stage the screen marks as active, by name. */
function activeStage(): string {
  return screen.getByText('Ativo').closest('div.grid')?.querySelector('p')?.textContent ?? '';
}

let notify: (type: number, payload: number[]) => void;

beforeEach(() => {
  vi.useFakeTimers();
  useDeviceStore.setState({ devices: [structuredClone(device)] });
  const listeners = new Set<(reportId: number, data: Uint8Array) => void>();
  notify = (type, payload) => {
    const event = withProtocolEnvelope([0x0b, 0, type, ...payload], false);
    for (const frame of frameEvent(Uint8Array.from([0xff, 0xff, 0xff, 0xff, ...event]), true)) {
      for (const listener of listeners) listener(0, frame);
    }
  };
  registerDeviceDriver(
    device.id,
    new LeviathanV4Driver(
      {
        open: async () => undefined,
        send: async () => undefined,
        onInputReport: (listener) => {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      },
      fixture,
      true,
    ),
  );
});

afterEach(() => {
  cleanup();
  useEditorStore.getState().forget([device.id]);
  unregisterDeviceDriver(device.id);
  vi.useRealTimers();
});

it('moves the active stage when the DPI button cycles the mouse', () => {
  render(<Workspace />);
  expect(activeStage()).toBe('Estágio 2');

  act(() => notify(0x00, DPI_1600));

  expect(activeStage()).toBe('Estágio 3');
});

it('keeps following the DPI button after the mouse announces another memory', () => {
  render(<Workspace />);
  act(() => notify(0x00, DPI_1600));

  // The mouse switched the memory it runs; the editor was following that one.
  act(() => notify(0x22, [1]));
  act(() => notify(0x00, DPI_3200));

  expect(useEditorStore.getState().entries[device.id]).toMatchObject({ editingProfileSlot: 2 });
  expect(activeStage()).toBe('Estágio 4');
});

it('leaves a draft of the user own where it is when the memory changes', () => {
  render(<Workspace />);
  const device0 = useDeviceStore.getState().devices[0];
  act(() => useEditorStore.getState().edit(device0, (draft) => ({ ...draft, pollingRate: 125 })));

  act(() => notify(0x22, [1]));

  expect(useEditorStore.getState().entries[device.id]).toMatchObject({
    editingProfileSlot: 1,
    draft: { pollingRate: 125 },
  });
  expect(screen.getByText('Editando outra memória.')).toBeDefined();
});
