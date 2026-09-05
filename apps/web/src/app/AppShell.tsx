import { useMouseStore } from '../store/mouseStore';
import { DeviceGallery } from '../features/devices/DeviceGallery';
import { DeviceWorkspace } from './DeviceWorkspace';

export function AppShell() {
  const session = useMouseStore((state) => state.session);
  return session ? <DeviceWorkspace /> : <DeviceGallery />;
}
