import { useDeviceStore } from '../store/deviceStore';
import { useEditorStore } from '../store/editorStore';

/**
 * Leaves the demonstration. The simulated peripherals go away together with the
 * drafts they carried, so a later demonstration opens at its factory values
 * instead of resuming edits from a session the user already left.
 */
export function exitDemonstration(): void {
  const store = useDeviceStore.getState();
  const demoIds = store.devices.filter((device) => device.demo).map((device) => device.id);
  store.exitDemo();
  useEditorStore.getState().forget(demoIds);
}
