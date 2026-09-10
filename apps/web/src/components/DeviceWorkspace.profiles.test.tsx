// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDemoMouse } from '../hardware/demoDevices';
import { registerDeviceDriver, unregisterDeviceDriver } from '../hardware/deviceDriver';
import { useDeviceStore } from '../store/deviceStore';
import { useEditorStore } from '../store/editorStore';
import { DeviceWorkspace } from './DeviceWorkspace';

const device = { ...createDemoMouse(), demo: false };
const writeProfile = vi.fn(async () => undefined);

function Workspace() {
  const current = useDeviceStore((state) => state.devices[0]);
  return <DeviceWorkspace device={current} sectionId="perfis" />;
}

beforeEach(async () => {
  useDeviceStore.setState({ devices: [device] });
  registerDeviceDriver(device.id, { applyToSession: vi.fn(async () => undefined), writeProfile });
  await useEditorStore.getState().loadProfile(device, 3);
  useEditorStore.getState().edit(device, (draft) => ({ ...draft, pollingRate: 125 }));
});

afterEach(() => {
  cleanup();
  useEditorStore.getState().forget([device.id]);
  unregisterDeviceDriver(device.id);
  vi.clearAllMocks();
});

it('shows the editing cursor, active mouse slot and save destination separately', () => {
  render(<Workspace />);

  expect(screen.getByRole('combobox', { name: 'Perfil em edição' }).textContent).toContain(
    device.profiles[2].name,
  );
  expect(screen.getByText(`Ativo no mouse: ${device.profiles[0].name}`)).toBeDefined();
  expect(screen.getByRole('button', { name: 'Aplicar no onboard · Slot 3' })).toBeDefined();
  const activeCard = screen.getByText('Slot 1').closest('li')!;
  const editedCard = screen.getByText('Slot 3').closest('li')!;
  expect(within(activeCard).getByText('Ativo no mouse')).toBeDefined();
  expect(within(editedCard).getByText('Em edição')).toBeDefined();
});

it('can return to the active mouse slot through save and load without saving there', async () => {
  render(<Workspace />);
  const activeCard = screen.getByText('Slot 1').closest('li')!;
  fireEvent.click(within(activeCard).getByRole('button', { name: 'Carregar para edição' }));

  const dialog = screen.getByRole('alertdialog');
  expect(
    within(dialog).getByText(`Há alterações não salvas no ${device.profiles[2].name}.`),
  ).toBeDefined();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar e carregar' }));

  await screen.findByRole('button', { name: 'Aplicar no onboard · Slot 1' });
  expect(writeProfile).toHaveBeenCalledWith(
    3,
    device.profiles[2].name,
    expect.objectContaining({ pollingRate: 125 }),
  );
  expect(useEditorStore.getState().entries[device.id].editingProfileSlot).toBe(1);
  expect(useDeviceStore.getState().devices[0].activeProfileSlot).toBe(1);
});

it('applies to onboard only in the slot named by the explicit action', async () => {
  render(<Workspace />);

  fireEvent.click(screen.getByRole('button', { name: 'Aplicar no onboard · Slot 3' }));

  await screen.findByText(`Alterações salvas no ${device.profiles[2].name}`);
  expect(writeProfile).toHaveBeenCalledTimes(1);
  expect(writeProfile).toHaveBeenCalledWith(
    3,
    device.profiles[2].name,
    expect.objectContaining({ pollingRate: 125 }),
  );
  expect(useDeviceStore.getState().devices[0].activeProfileSlot).toBe(1);
  expect(useEditorStore.getState().entries[device.id].editingProfileSlot).toBe(3);
});

it('can apply an unchanged memory and shows the slot confirmed by the mouse', async () => {
  await useEditorStore.getState().discard(device);
  registerDeviceDriver(device.id, {
    applyToSession: vi.fn(async () => undefined),
    writeProfile,
    readState: vi.fn(async () => ({ activeProfileSlot: 3, dpi: { x: 1600, y: 1600 } })),
  });
  render(<Workspace />);
  const apply = screen.getByRole('button', {
    name: 'Aplicar no onboard · Slot 3',
  }) as HTMLButtonElement;
  expect(apply.disabled).toBe(false);
  fireEvent.click(apply);
  await screen.findByText(`Ativo no mouse: ${device.profiles[2].name}`);
  expect(writeProfile).toHaveBeenCalledWith(
    3,
    device.profiles[2].name,
    expect.objectContaining({ pollingRate: 500 }),
  );
});
