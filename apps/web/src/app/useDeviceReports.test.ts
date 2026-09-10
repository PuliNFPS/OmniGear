// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import {
  registerDeviceDriver,
  unregisterDeviceDriver,
  type DeviceDriver,
  type OnboardProfileReport,
} from '../hardware/deviceDriver';
import { createDemoMouse } from '../hardware/demoDevices';
import { useDeviceStore } from '../store/deviceStore';
import { useEditorStore } from '../store/editorStore';
import { useDeviceReports } from './useDeviceReports';

const DEVICE_ID = 'live-mouse';

function liveMouse() {
  // The hook skips demo devices, so a real one is what exercises the path.
  return { ...createDemoMouse(), id: DEVICE_ID, demo: false };
}

/**
 * Replays the dump to every new subscriber, exactly as LeviathanV4Driver does:
 * the dump answers the query the connect already sent, so it can land before
 * anything subscribes, and replaying is what catches it.
 */
function replayingDriver(slots: OnboardProfileReport[]) {
  let subscriptions = 0;
  const driver: DeviceDriver = {
    async applyToSession() {},
    async writeProfile() {},
    onOnboardProfiles(listener) {
      subscriptions += 1;
      listener(slots);
      return () => {};
    },
  };
  return { driver, subscriptions: () => subscriptions };
}

afterEach(() => {
  cleanup();
  useEditorStore.getState().forget([DEVICE_ID]);
  unregisterDeviceDriver(DEVICE_ID);
  useDeviceStore.setState({ devices: [] });
});

it('rebases the slot being edited when a dump for multiple slots arrives', async () => {
  const device = liveMouse();
  useDeviceStore.setState({ devices: [device] });
  await useEditorStore.getState().loadProfile(device, 3);
  const { driver } = replayingDriver([
    { index: 0, bindings: [] },
    { index: 2, bindings: [{ keyIds: [0x0a], action: 'clique-direito', raw: new Uint8Array() }] },
  ]);
  registerDeviceDriver(DEVICE_ID, driver);

  renderHook(() => useDeviceReports(useDeviceStore((state) => state.devices)));

  const entry = useEditorStore.getState().entries[DEVICE_ID];
  expect(entry.editingProfileSlot).toBe(3);
  expect(entry.draft).toMatchObject({ buttons: { esquerdo: 'clique-direito' } });
  expect(entry.draft).toMatchObject({ pollingRate: 500, activeStageId: 'estagio-3' });
  expect(entry.saved).toEqual(entry.draft);
  expect(useDeviceStore.getState().devices[0].activeProfileSlot).toBe(1);
});

it('subscribes once even though the dump it replays updates the store', () => {
  const device = liveMouse();
  const { driver, subscriptions } = replayingDriver([{ index: 0, bindings: [] }]);
  registerDeviceDriver(DEVICE_ID, driver);
  useDeviceStore.setState({ devices: [device] });

  renderHook(() => useDeviceReports(useDeviceStore((state) => state.devices)));

  // Following the whole device array made this resubscribe on every update:
  // the replay wrote to the store, the store handed back a new array, and the
  // effect tore down and rebuilt the subscription until React gave up.
  expect(subscriptions()).toBe(1);
});

it('writes what the dump reports into the followed profile', () => {
  const device = liveMouse();
  const { driver } = replayingDriver([{ index: 0, bindings: [] }]);
  registerDeviceDriver(DEVICE_ID, driver);
  useDeviceStore.setState({ devices: [device] });

  renderHook(() => useDeviceReports(useDeviceStore((state) => state.devices)));

  // Guards the fix above: subscribing once is only right if the one
  // subscription still delivers. Slot 0 answers for profile 1, and every
  // binding the dump omits is a button the device does not have mapped.
  const followed = useDeviceStore.getState().devices.find((item) => item.id === DEVICE_ID);
  const settings = followed?.profiles.find((item) => item.index === 1)?.settings;
  if (!settings || !('buttons' in settings)) throw new Error('esperava um perfil de mouse');

  const actions = Object.values(settings.buttons);
  expect(actions).not.toHaveLength(0);
  expect(new Set(actions)).toEqual(new Set(['desativado']));
});
